const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/payroll/employees
// Fetch list of employees with their configured base salary
router.get('/employees', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, email, role, COALESCE(base_salary, 0.00) as base_salary 
       FROM users 
       WHERE role != 'Client' 
       ORDER BY name ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching employees for payroll:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// PUT /api/payroll/base-salaries
// Batch update employee base salaries
router.put('/base-salaries', async (req, res) => {
  const { salaries } = req.body; // Array of { user_id, base_salary }
  if (!Array.isArray(salaries)) {
    return res.status(400).json({ error: 'Salaries array is required' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const item of salaries) {
      const salary = parseFloat(item.base_salary) || 0;
      await connection.query(
        'UPDATE users SET base_salary = ? WHERE id = ?',
        [salary, item.user_id]
      );
    }
    await connection.commit();
    res.json({ message: 'Base salaries updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating base salaries:', error);
    res.status(500).json({ error: 'Failed to update base salaries' });
  } finally {
    connection.release();
  }
});

// GET /api/payroll
// Get payroll records for a selected month (YYYY-MM)
router.get('/', async (req, res) => {
  try {
    const { month, status, search } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7); // Default to current YYYY-MM

    // 1. If no payroll records exist yet for targetMonth, auto-initialize for active employees
    const [[countRow]] = await db.query('SELECT COUNT(*) as cnt FROM payrolls WHERE month = ?', [targetMonth]);
    if (countRow.cnt === 0) {
      const [employees] = await db.query("SELECT id, COALESCE(base_salary, 0.00) as base_salary FROM users WHERE role != 'Client'");
      for (const emp of employees) {
        const baseSalary = parseFloat(emp.base_salary) || 0;
        const [[advRow]] = await db.query('SELECT COALESCE(SUM(amount), 0.00) as total_adv FROM salary_advances WHERE user_id = ? AND month = ?', [emp.id, targetMonth]);
        const advSalary = parseFloat(advRow?.total_adv || 0);

        const [[penRow]] = await db.query('SELECT COALESCE(SUM(amount), 0.00) as total_pen FROM salary_penalties WHERE user_id = ? AND month = ?', [emp.id, targetMonth]);
        const otherDeductions = parseFloat(penRow?.total_pen || 0);

        const commission = await calculateUserMonthlyCommission(emp.id, targetMonth, db);
        const grossSalary = baseSalary + commission;
        const totalDeductions = advSalary + otherDeductions;
        const netSalary = Math.max(0, grossSalary - totalDeductions);

        await db.query(`
          INSERT INTO payrolls (user_id, month, base_salary, overtime_allowance, bonus, gross_salary, advance_salary, tax_deduction, other_deductions, deductions, net_salary, status)
          VALUES (?, ?, ?, ?, 0.00, ?, ?, 0.00, ?, ?, ?, 'Pending')
        `, [emp.id, targetMonth, baseSalary, commission, grossSalary, advSalary, otherDeductions, totalDeductions, netSalary]);
      }
    } else {
      // 2. Real-time Auto-Sync: Recalculate and update current commission for all Pending payrolls in targetMonth
      const [pendingPayrolls] = await db.query(
        'SELECT id, user_id, base_salary, bonus, advance_salary, tax_deduction, other_deductions FROM payrolls WHERE month = ? AND status = "Pending"',
        [targetMonth]
      );
      for (const p of pendingPayrolls) {
        const commission = await calculateUserMonthlyCommission(p.user_id, targetMonth, db);
        const baseSalary = parseFloat(p.base_salary || 0);
        const bonus = parseFloat(p.bonus || 0);
        const advanceSalary = parseFloat(p.advance_salary || 0);
        const tax = parseFloat(p.tax_deduction || 0);
        const otherDeds = parseFloat(p.other_deductions || 0);

        const grossSalary = baseSalary + commission + bonus;
        const totalDeductions = advanceSalary + tax + otherDeds;
        const netSalary = Math.max(0, grossSalary - totalDeductions);

        await db.query(`
          UPDATE payrolls 
          SET overtime_allowance = ?, gross_salary = ?, deductions = ?, net_salary = ? 
          WHERE id = ?
        `, [commission, grossSalary, totalDeductions, netSalary, p.id]);
      }
    }

    let query = `
      SELECT 
        p.*,
        u.name as employee_name,
        u.email as employee_email,
        u.role as employee_role,
        u.profile_image_url
      FROM payrolls p
      JOIN users u ON p.user_id = u.id
      WHERE p.month = ?
    `;
    const params = [targetMonth];

    if (status && status !== 'All') {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    if (search && search.trim()) {
      query += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.role LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY u.name ASC`;

    const [rows] = await db.query(query, params);

    // Fetch penalties for this month
    const [penalties] = await db.query(
      `SELECT sp.*, ps.title as step_title, p.title as project_title 
       FROM salary_penalties sp
       LEFT JOIN project_steps ps ON sp.step_id = ps.id
       LEFT JOIN projects p ON ps.project_id = p.id
       WHERE sp.month = ?`,
      [targetMonth]
    );

    // Account Balances Calculation from Cashbook/Expenses
    const [allExpenses] = await db.query('SELECT mode, bank, receipt_amount, payment_amount FROM expenses');
    let cashInHand = 0;
    let totalNetBalance = 0;
    const bankTotals = {};

    allExpenses.forEach(exp => {
      const net = Number(exp.receipt_amount || 0) - Number(exp.payment_amount || 0);
      totalNetBalance += net;

      const modeLower = (exp.mode || '').toLowerCase();
      if (modeLower === 'cash' || (!exp.bank || exp.bank.trim() === '')) {
        cashInHand += net;
      }

      if (exp.bank && exp.bank.trim() !== '') {
        const bName = exp.bank.trim();
        if (!bankTotals[bName]) bankTotals[bName] = 0;
        bankTotals[bName] += net;
      }
    });

    res.json({ 
      month: targetMonth, 
      payrolls: rows,
      penalties: penalties,
      accounts: {
        cashInHand,
        totalNetBalance,
        bankTotals
      }
    });
  } catch (error) {
    console.error('Error fetching payroll records:', error);
    res.status(500).json({ error: 'Failed to fetch payroll records' });
  }
});

// Helper to calculate an employee's exact earned commission for a specific month (YYYY-MM)
async function calculateUserMonthlyCommission(userId, targetMonth, dbClient) {
  let totalCommission = 0;

  // 1. Direct Invoice Payments Commission for this month (Payments received in this month)
  const [payments] = await dbClient.query(`
    SELECT 
      ip.amount as payment_amount,
      i.amount as invoice_amount,
      i.commission_amount as invoice_commission_amount,
      u.commission_percentage
    FROM invoice_payments ip
    JOIN invoices i ON ip.invoice_id = i.id
    JOIN users u ON i.agent_id = u.id
    WHERE i.agent_id = ? 
      AND i.status != 'Void'
      AND (DATE_FORMAT(ip.payment_date, '%Y-%m') = ? OR ip.payment_date LIKE ?)
  `, [userId, targetMonth, `${targetMonth}%`]);

  for (const pay of payments) {
    const payAmt = parseFloat(pay.payment_amount || 0);
    const invAmt = parseFloat(pay.invoice_amount || 0);
    const invComm = parseFloat(pay.invoice_commission_amount || 0);
    const commPct = parseFloat(pay.commission_percentage || 0);

    let comm = 0;
    if (invComm > 0 && invAmt > 0) {
      comm = (payAmt / invAmt) * invComm;
    } else if (commPct > 0) {
      comm = payAmt * (commPct / 100);
    }
    totalCommission += comm;
  }

  // 2. Project Step Commissions released in this month
  const [stepComms] = await dbClient.query(`
    SELECT COALESCE(SUM(final_amount), 0) as step_total
    FROM commissions
    WHERE user_id = ?
      AND status = 'Released'
      AND (DATE_FORMAT(released_at, '%Y-%m') = ? OR released_at LIKE ?)
  `, [userId, targetMonth, `${targetMonth}%`]);

  totalCommission += parseFloat(stepComms[0]?.step_total || 0);

  return Number(totalCommission.toFixed(2));
}

// Helper to auto-sync or auto-create a user's pending payroll record when payments or commissions change
async function syncUserPendingPayroll(userId, month, dbClient) {
  if (!userId || !month) return;

  const [[emp]] = await dbClient.query('SELECT id, base_salary FROM users WHERE id = ?', [userId]);
  if (!emp) return;

  const baseSalary = parseFloat(emp.base_salary || 0);
  const commission = await calculateUserMonthlyCommission(userId, month, dbClient);

  const [[existing]] = await dbClient.query('SELECT * FROM payrolls WHERE user_id = ? AND month = ?', [userId, month]);

  if (!existing) {
    const [[advRow]] = await dbClient.query('SELECT COALESCE(SUM(amount), 0.00) as total_adv FROM salary_advances WHERE user_id = ? AND month = ?', [userId, month]);
    const advSalary = parseFloat(advRow?.total_adv || 0);

    const [[penRow]] = await dbClient.query('SELECT COALESCE(SUM(amount), 0.00) as total_pen FROM salary_penalties WHERE user_id = ? AND month = ?', [userId, month]);
    const otherDeductions = parseFloat(penRow?.total_pen || 0);

    const grossSalary = baseSalary + commission;
    const totalDeductions = advSalary + otherDeductions;
    const netSalary = Math.max(0, grossSalary - totalDeductions);

    await dbClient.query(`
      INSERT INTO payrolls (user_id, month, base_salary, overtime_allowance, bonus, gross_salary, advance_salary, tax_deduction, other_deductions, deductions, net_salary, status)
      VALUES (?, ?, ?, ?, 0.00, ?, ?, 0.00, ?, ?, ?, 'Pending')
    `, [userId, month, baseSalary, commission, grossSalary, advSalary, otherDeductions, totalDeductions, netSalary]);
  } else if (existing.status === 'Pending') {
    const bonus = parseFloat(existing.bonus || 0);
    const advanceSalary = parseFloat(existing.advance_salary || 0);
    const tax = parseFloat(existing.tax_deduction || 0);
    const otherDeds = parseFloat(existing.other_deductions || 0);
    const grossSalary = baseSalary + commission + bonus;
    const totalDeductions = advanceSalary + tax + otherDeds;
    const netSalary = Math.max(0, grossSalary - totalDeductions);

    await dbClient.query(`
      UPDATE payrolls 
      SET base_salary = ?, overtime_allowance = ?, gross_salary = ?, deductions = ?, net_salary = ? 
      WHERE id = ?
    `, [baseSalary, commission, grossSalary, totalDeductions, netSalary, existing.id]);
  }
}

// POST /api/payroll/generate
// Generate monthly payroll for all non-client active users for a month
router.post('/generate', async (req, res) => {
  const { month } = req.body;
  const targetMonth = month || new Date().toISOString().slice(0, 7);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Fetch all active employees
    const [employees] = await connection.query(
      `SELECT id, COALESCE(base_salary, 0.00) as base_salary FROM users WHERE role != 'Client'`
    );

    let generatedCount = 0;
    for (const emp of employees) {
      const baseSalary = parseFloat(emp.base_salary) || 0;

      // Check total salary advance already issued to this user in targetMonth
      const [[advRow]] = await connection.query(
        `SELECT COALESCE(SUM(amount), 0.00) as total_adv FROM salary_advances WHERE user_id = ? AND month = ?`,
        [emp.id, targetMonth]
      );
      const advSalary = parseFloat(advRow.total_adv || 0);

      // Check total late penalties for this user in targetMonth
      const [[penRow]] = await connection.query(
        `SELECT COALESCE(SUM(amount), 0.00) as total_pen FROM salary_penalties WHERE user_id = ? AND month = ?`,
        [emp.id, targetMonth]
      );
      const otherDeductions = parseFloat(penRow.total_pen || 0);

      // Calculate earned commission for this employee in targetMonth (from invoice payments and milestone steps)
      const commission = await calculateUserMonthlyCommission(emp.id, targetMonth, connection);

      const [[existing]] = await connection.query(
        'SELECT * FROM payrolls WHERE user_id = ? AND month = ?',
        [emp.id, targetMonth]
      );

      if (!existing) {
        const grossSalary = baseSalary + commission;
        const totalDeductions = advSalary + otherDeductions;
        const netSalary = Math.max(0, grossSalary - totalDeductions);

        await connection.query(
          `INSERT INTO payrolls (user_id, month, base_salary, overtime_allowance, bonus, gross_salary, advance_salary, tax_deduction, other_deductions, deductions, net_salary, status)
           VALUES (?, ?, ?, ?, 0.00, ?, ?, 0.00, ?, ?, ?, 'Pending')`,
          [emp.id, targetMonth, baseSalary, commission, grossSalary, advSalary, otherDeductions, totalDeductions, netSalary]
        );
        generatedCount++;
      } else if (existing.status === 'Pending') {
        const bonus = parseFloat(existing.bonus || 0);
        const tax = parseFloat(existing.tax_deduction || 0);
        const grossSalary = baseSalary + commission + bonus;
        const totalDeductions = advSalary + otherDeductions + tax;
        const netSalary = Math.max(0, grossSalary - totalDeductions);

        await connection.query(
          `UPDATE payrolls 
           SET base_salary = ?, overtime_allowance = ?, advance_salary = ?, other_deductions = ?, deductions = ?, gross_salary = ?, net_salary = ? 
           WHERE id = ?`,
          [baseSalary, commission, advSalary, otherDeductions, totalDeductions, grossSalary, netSalary, existing.id]
        );
        generatedCount++;
      }
    }

    await connection.commit();
    res.json({ message: `Processed payroll records for ${generatedCount} employees for ${targetMonth}` });
  } catch (error) {
    await connection.rollback();
    console.error('Error generating monthly payroll:', error);
    res.status(500).json({ error: 'Failed to generate monthly payroll' });
  } finally {
    connection.release();
  }
});

// POST /api/payroll/sync-commissions
// Recalculate commissions for all Pending payrolls in targetMonth
router.post('/sync-commissions', async (req, res) => {
  const { month } = req.body;
  const targetMonth = month || new Date().toISOString().slice(0, 7);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [pendingPayrolls] = await connection.query(
      'SELECT id, user_id, base_salary, bonus, advance_salary, tax_deduction, other_deductions FROM payrolls WHERE month = ? AND status = "Pending"',
      [targetMonth]
    );

    let updatedCount = 0;
    for (const p of pendingPayrolls) {
      const commission = await calculateUserMonthlyCommission(p.user_id, targetMonth, connection);
      const baseSalary = parseFloat(p.base_salary || 0);
      const bonus = parseFloat(p.bonus || 0);
      const grossSalary = baseSalary + commission + bonus;

      const advanceSalary = parseFloat(p.advance_salary || 0);
      const tax = parseFloat(p.tax_deduction || 0);
      const otherDeds = parseFloat(p.other_deductions || 0);
      const totalDeductions = advanceSalary + tax + otherDeds;
      const netSalary = Math.max(0, grossSalary - totalDeductions);

      await connection.query(`
        UPDATE payrolls 
        SET overtime_allowance = ?, gross_salary = ?, deductions = ?, net_salary = ? 
        WHERE id = ?
      `, [commission, grossSalary, totalDeductions, netSalary, p.id]);

      updatedCount++;
    }

    await connection.commit();
    res.json({ message: `Successfully synchronized commissions for ${updatedCount} employees for ${targetMonth}` });
  } catch (error) {
    await connection.rollback();
    console.error('Error syncing monthly commissions:', error);
    res.status(500).json({ error: 'Failed to sync monthly commissions' });
  } finally {
    connection.release();
  }
});

// GET /api/payroll/advances
// Fetch list of salary advances for a month
router.get('/advances', async (req, res) => {
  try {
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const [rows] = await db.query(
      `SELECT sa.*, u.name as employee_name, u.email as employee_email 
       FROM salary_advances sa 
       JOIN users u ON sa.user_id = u.id 
       WHERE sa.month = ? 
       ORDER BY sa.advance_date DESC`,
      [targetMonth]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching salary advances:', error);
    res.status(500).json({ error: 'Failed to fetch salary advances' });
  }
});

// POST /api/payroll/advances
// Issue a Salary Advance to an employee (and log Cashbook payment)
router.post('/advances', async (req, res) => {
  const { user_id, month, advance_date, amount, payment_method, bank_name, notes } = req.body;
  const advAmount = parseFloat(amount) || 0;
  if (!user_id || advAmount <= 0) {
    return res.status(400).json({ error: 'User ID and valid advance amount are required' });
  }

  const advMonth = month || new Date().toISOString().slice(0, 7);
  const advDate = advance_date || new Date().toISOString().split('T')[0];
  const payMethod = payment_method || 'Cash';
  const bank = bank_name || '';

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[user]] = await connection.query('SELECT name FROM users WHERE id = ?', [user_id]);
    if (!user) throw new Error('Employee not found');

    // 1. Insert Cashbook Expense Payment
    const desc = `Salary Advance (${advMonth}) - ${user.name}`;
    const [expRes] = await connection.query(
      `INSERT INTO expenses (date, client, description, mode, bank, reference, receipt_amount, payment_amount)
       VALUES (?, ?, ?, ?, ?, ?, 0.00, ?)`,
      [advDate, user.name, desc, payMethod, bank, `SALARY-ADV-${user_id}`, advAmount]
    );

    // 2. Insert into salary_advances table
    await connection.query(
      `INSERT INTO salary_advances (user_id, month, advance_date, amount, payment_method, bank_name, expense_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, advMonth, advDate, advAmount, payMethod, bank, expRes.insertId, notes || null]
    );

    // 3. Update or ensure payroll record for user & month exists and update advance_salary
    const [[existingPayroll]] = await connection.query('SELECT * FROM payrolls WHERE user_id = ? AND month = ?', [user_id, advMonth]);
    if (existingPayroll) {
      const newAdv = parseFloat(existingPayroll.advance_salary || 0) + advAmount;
      const base = parseFloat(existingPayroll.base_salary || 0);
      const overtime = parseFloat(existingPayroll.overtime_allowance || 0);
      const bonus = parseFloat(existingPayroll.bonus || 0);
      const gross = base + overtime + bonus;
      const tax = parseFloat(existingPayroll.tax_deduction || 0);
      const otherDed = parseFloat(existingPayroll.other_deductions || 0);
      const totalDed = newAdv + tax + otherDed;
      const newNet = Math.max(0, gross - totalDed);

      await connection.query(
        `UPDATE payrolls 
         SET gross_salary = ?, advance_salary = ?, deductions = ?, net_salary = ? 
         WHERE id = ?`,
        [gross, newAdv, totalDed, newNet, existingPayroll.id]
      );

      if (existingPayroll.status === 'Paid' && existingPayroll.expense_id) {
        await connection.query('UPDATE expenses SET payment_amount = ? WHERE id = ?', [newNet, existingPayroll.expense_id]);
      }
    }

    await connection.commit();
    res.json({ message: `Salary advance of PKR ${advAmount} issued to ${user.name}` });
  } catch (error) {
    await connection.rollback();
    console.error('Error adding salary advance:', error);
    res.status(500).json({ error: error.message || 'Failed to add salary advance' });
  } finally {
    connection.release();
  }
});

// DELETE /api/payroll/advances/:id
// Delete a salary advance entry
router.delete('/advances/:id', async (req, res) => {
  const advId = req.params.id;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[adv]] = await connection.query('SELECT * FROM salary_advances WHERE id = ?', [advId]);
    if (!adv) return res.status(404).json({ error: 'Salary advance record not found' });

    if (adv.expense_id) {
      await connection.query('DELETE FROM expenses WHERE id = ?', [adv.expense_id]);
    }

    // Update payroll record advance_salary deduction
    const [[payroll]] = await connection.query('SELECT * FROM payrolls WHERE user_id = ? AND month = ?', [adv.user_id, adv.month]);
    if (payroll) {
      const newAdv = Math.max(0, parseFloat(payroll.advance_salary || 0) - parseFloat(adv.amount || 0));
      const base = parseFloat(payroll.base_salary || 0);
      const overtime = parseFloat(payroll.overtime_allowance || 0);
      const bonus = parseFloat(payroll.bonus || 0);
      const gross = base + overtime + bonus;
      const tax = parseFloat(payroll.tax_deduction || 0);
      const otherDed = parseFloat(payroll.other_deductions || 0);
      const totalDed = newAdv + tax + otherDed;
      const newNet = Math.max(0, gross - totalDed);

      await connection.query(
        `UPDATE payrolls SET advance_salary = ?, deductions = ?, net_salary = ? WHERE id = ?`,
        [newAdv, totalDed, newNet, payroll.id]
      );

      if (payroll.status === 'Paid' && payroll.expense_id) {
        await connection.query('UPDATE expenses SET payment_amount = ? WHERE id = ?', [newNet, payroll.expense_id]);
      }
    }

    await connection.query('DELETE FROM salary_advances WHERE id = ?', [advId]);

    await connection.commit();
    res.json({ message: 'Salary advance deleted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting salary advance:', error);
    res.status(500).json({ error: 'Failed to delete salary advance' });
  } finally {
    connection.release();
  }
});

// PUT /api/payroll/:id
// Update individual payroll record (base_salary, overtime_allowance, bonus, advance_salary, tax_deduction, other_deductions, notes)
router.put('/:id', async (req, res) => {
  const payrollId = req.params.id;
  const { base_salary, overtime_allowance, bonus, advance_salary, tax_deduction, other_deductions, notes } = req.body;

  try {
    const [[existing]] = await db.query('SELECT * FROM payrolls WHERE id = ?', [payrollId]);
    if (!existing) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    const newBase = base_salary !== undefined ? parseFloat(base_salary) : parseFloat(existing.base_salary || 0);
    const newOvertime = overtime_allowance !== undefined ? parseFloat(overtime_allowance) : parseFloat(existing.overtime_allowance || 0);
    const newBonus = bonus !== undefined ? parseFloat(bonus) : parseFloat(existing.bonus || 0);
    const newGross = newBase + newOvertime + newBonus;

    const newAdvance = advance_salary !== undefined ? parseFloat(advance_salary) : parseFloat(existing.advance_salary || 0);
    const newTax = tax_deduction !== undefined ? parseFloat(tax_deduction) : parseFloat(existing.tax_deduction || 0);
    const newOtherDed = other_deductions !== undefined ? parseFloat(other_deductions) : parseFloat(existing.other_deductions || 0);
    const newTotalDeductions = newAdvance + newTax + newOtherDed;

    const newNet = Math.max(0, newGross - newTotalDeductions);
    const newNotes = notes !== undefined ? notes : existing.notes;

    await db.query(
      `UPDATE payrolls 
       SET base_salary = ?, overtime_allowance = ?, bonus = ?, gross_salary = ?, 
           advance_salary = ?, tax_deduction = ?, other_deductions = ?, deductions = ?, 
           net_salary = ?, notes = ? 
       WHERE id = ?`,
      [newBase, newOvertime, newBonus, newGross, newAdvance, newTax, newOtherDed, newTotalDeductions, newNet, newNotes, payrollId]
    );

    // If already paid, update linked expense cashbook amount if expense_id exists
    if (existing.status === 'Paid' && existing.expense_id) {
      await db.query(
        'UPDATE expenses SET payment_amount = ? WHERE id = ?',
        [newNet, existing.expense_id]
      );
    }

    res.json({ message: 'Payroll record updated successfully', net_salary: newNet, gross_salary: newGross, deductions: newTotalDeductions });
  } catch (error) {
    console.error('Error updating payroll record:', error);
    res.status(500).json({ error: 'Failed to update payroll record' });
  }
});

// POST /api/payroll/:id/pay
// Mark payroll item as Paid and insert corresponding Expense Cashbook record
router.post('/:id/pay', async (req, res) => {
  const payrollId = req.params.id;
  const { payment_date, payment_method, bank_name, notes } = req.body;

  const payDate = payment_date || new Date().toISOString().split('T')[0];
  const payMethod = payment_method || 'Bank Transfer';
  const bank = bank_name || '';

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[payroll]] = await connection.query(
      `SELECT p.*, u.name as employee_name 
       FROM payrolls p 
       JOIN users u ON p.user_id = u.id 
       WHERE p.id = ? FOR UPDATE`,
      [payrollId]
    );

    if (!payroll) {
      throw new Error('Payroll record not found');
    }

    const netSalary = parseFloat(payroll.net_salary) || 0;
    const desc = `Salary Payment (${payroll.month}) - ${payroll.employee_name}`;

    let expenseId = payroll.expense_id;

    // Create or update Cashbook Expense record
    if (expenseId) {
      await connection.query(
        `UPDATE expenses 
         SET date = ?, client = ?, description = ?, mode = ?, bank = ?, payment_amount = ?, category = 'Payroll' 
         WHERE id = ?`,
        [payDate, payroll.employee_name, desc, payMethod, bank, netSalary, expenseId]
      );
    } else {
      const [expResult] = await connection.query(
        `INSERT INTO expenses (date, client, description, mode, bank, reference, receipt_amount, payment_amount, category)
         VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, 'Payroll')`,
        [payDate, payroll.employee_name, desc, payMethod, bank, `PAYROLL-${payroll.id}`, netSalary]
      );
      expenseId = expResult.insertId;
    }

    // Update payroll status
    await connection.query(
      `UPDATE payrolls 
       SET status = 'Paid', payment_date = ?, payment_method = ?, bank_name = ?, expense_id = ?, notes = COALESCE(?, notes)
       WHERE id = ?`,
      [payDate, payMethod, bank, expenseId, notes || null, payrollId]
    );

    await connection.commit();
    res.json({ message: 'Salary payment processed and recorded in Cashbook successfully', expense_id: expenseId });
  } catch (error) {
    await connection.rollback();
    console.error('Error processing salary payment:', error);
    res.status(500).json({ error: error.message || 'Failed to process salary payment' });
  } finally {
    connection.release();
  }
});

// DELETE /api/payroll/:id
// Delete a payroll record and clean up associated expense record
router.delete('/:id', async (req, res) => {
  const payrollId = req.params.id;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[payroll]] = await connection.query('SELECT * FROM payrolls WHERE id = ?', [payrollId]);
    if (!payroll) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    if (payroll.expense_id) {
      await connection.query('DELETE FROM expenses WHERE id = ?', [payroll.expense_id]);
    }

    await connection.query('DELETE FROM payrolls WHERE id = ?', [payrollId]);

    await connection.commit();
    res.json({ message: 'Payroll record deleted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error deleting payroll record:', error);
    res.status(500).json({ error: 'Failed to delete payroll record' });
  } finally {
    connection.release();
  }
});

router.calculateUserMonthlyCommission = calculateUserMonthlyCommission;
router.syncUserPendingPayroll = syncUserPendingPayroll;

module.exports = router;
