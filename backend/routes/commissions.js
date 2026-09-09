const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to determine step items value strictly based on selected invoice items (with smart project fallback)
async function getStepItemsTotal(step, dbClient) {
  let items_total = 0;
  
  if (step.invoice_item_ids) {
    let itemIds = [];
    try {
      itemIds = typeof step.invoice_item_ids === 'string' ? JSON.parse(step.invoice_item_ids) : step.invoice_item_ids;
    } catch(e) {}
    if (typeof itemIds === 'number') itemIds = [itemIds];
    if (!Array.isArray(itemIds) && itemIds !== null && itemIds !== undefined) itemIds = [itemIds];
    
    if (Array.isArray(itemIds) && itemIds.length > 0) {
      // Exclude items categorized as 'OTHER'
      const [items] = await dbClient.query(
        "SELECT SUM(total) as t FROM invoice_items WHERE id IN (?) AND (category != 'OTHER' OR category IS NULL)", 
        [itemIds]
      );
      items_total = parseFloat(items[0]?.t || 0);
    }
  }

  // Fallback: If no explicit items were tagged on this step, check linked project invoice items or amount
  if (items_total === 0 && step.project_id) {
    const [invItems] = await dbClient.query(
      `SELECT SUM(ii.total) as t 
       FROM invoice_items ii 
       JOIN invoices i ON ii.invoice_id = i.id 
       WHERE i.project_id = ? AND (ii.category != 'OTHER' OR ii.category IS NULL)`,
      [step.project_id]
    );
    items_total = parseFloat(invItems[0]?.t || 0);

    if (items_total === 0) {
      const [[inv]] = await dbClient.query(
        "SELECT amount FROM invoices WHERE project_id = ? ORDER BY id DESC LIMIT 1",
        [step.project_id]
      );
      if (inv && inv.amount > 0) {
        items_total = parseFloat(inv.amount);
      }
    }
  }

  return items_total;
}

// Get all forfeited commissions (late steps that resulted in 0 commission)
router.get('/forfeited', async (req, res) => {
  try {
    const { user_id, role, agent_id, target_role, start_date, end_date } = req.query;
    const isManager = ['Admin', 'Project Manager', 'PM', 'Product Manager'].includes(role);
    
    let query = `
      SELECT 
        ps.id as step_id,
        ps.title as step_title,
        ps.deadline,
        ps.completed_at,
        p.id as project_id,
        p.title as project_title,
        p.locked_deadline,
        u.name as agent_name,
        u.commission_percentage,
        ps.invoice_item_ids
      FROM project_steps ps
      JOIN projects p ON ps.project_id = p.id
      JOIN users u ON ps.assignee_id = u.id
      WHERE ps.status = 'Completed'
        AND (ps.forgive_late_commission = FALSE OR ps.forgive_late_commission IS NULL)
        AND ps.deadline IS NOT NULL
        AND ps.completed_at IS NOT NULL
        AND DATE(ps.completed_at) > DATE(ps.deadline)
    `;

    const params = [];
    if (user_id && role && !isManager) {
      query += ` AND ps.assignee_id = ?`;
      params.push(user_id);
    }
    if (agent_id && agent_id !== 'all') {
      query += ` AND ps.assignee_id = ?`;
      params.push(agent_id);
    }
    if (target_role && target_role !== 'all') {
      query += ` AND u.role = ?`;
      params.push(target_role);
    }
    if (start_date) {
      query += ` AND DATE(ps.completed_at) >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND DATE(ps.completed_at) <= ?`;
      params.push(end_date);
    }

    query += ` ORDER BY ps.completed_at DESC`;

    const [forfeitedSteps] = await db.query(query, params);

    const results = [];
    for (const step of forfeitedSteps) {
      const items_total = await getStepItemsTotal(step, db);

      if (items_total > 0) {
        const comm_pct = parseFloat(step.commission_percentage) || 0;
        const potential_base = items_total * (comm_pct / 100);
        
        results.push({
          ...step,
          items_total,
          potential_commission: potential_base
        });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment and commission release timeline for an invoice
router.get('/invoice-timeline/:invoiceIdOrNumber', async (req, res) => {
  try {
    const param = req.params.invoiceIdOrNumber;
    const query = `
      SELECT 
        i.id, i.invoice_number, i.amount as total_invoiced, i.balance as pending_balance,
        i.commission_amount, i.status, i.created_at,
        u.id as agent_id, u.name as agent_name, u.role as agent_role, u.commission_percentage,
        COALESCE(c.business_name, c.full_name, 'Client') as client_name
      FROM invoices i
      LEFT JOIN users u ON i.agent_id = u.id
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.id = ? OR i.invoice_number = ?
      LIMIT 1
    `;
    const [[inv]] = await db.query(query, [param, param]);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    // Fetch payments
    const [payments] = await db.query(`
      SELECT id, amount, payment_date, payment_method, bank, transaction_id, notes, created_at
      FROM invoice_payments
      WHERE invoice_id = ?
      ORDER BY payment_date ASC, id ASC
    `, [inv.id]);

    const totalInvoiced = parseFloat(inv.total_invoiced || 0);
    const pendingBalance = parseFloat(inv.pending_balance || 0);
    const totalCollected = Math.max(0, totalInvoiced - pendingBalance);
    const commPct = parseFloat(inv.commission_percentage || 0);
    const fixedComm = parseFloat(inv.commission_amount || 0);

    let totalCommissionReleased = 0;
    const installments = payments.map((p, idx) => {
      const pAmt = parseFloat(p.amount || 0);
      let comm = 0;
      if (fixedComm > 0 && totalInvoiced > 0) {
        comm = (pAmt / totalInvoiced) * fixedComm;
      } else if (commPct > 0) {
        comm = pAmt * (commPct / 100);
      }
      totalCommissionReleased += comm;

      // Format payment_date to Month Name YYYY (e.g. "September 2026")
      const pDate = new Date(p.payment_date);
      const payrollMonth = pDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      // Combine mode & notes / transaction
      const notesArr = [p.payment_method || 'Cash'];
      if (p.bank) notesArr.push(`Bank: ${p.bank}`);
      if (p.transaction_id) notesArr.push(`Ref: ${p.transaction_id}`);
      if (p.notes) notesArr.push(p.notes);

      // Format date as DD/MM/YYYY
      const day = String(pDate.getDate()).padStart(2, '0');
      const monthStr = String(pDate.getMonth() + 1).padStart(2, '0');
      const yearStr = pDate.getFullYear();
      const formattedDate = `${day}/${monthStr}/${yearStr}`;

      return {
        index: idx + 1,
        id: p.id,
        payment_date: p.payment_date,
        formatted_date: formattedDate,
        amount: pAmt,
        payment_method: p.payment_method || 'Cash',
        mode_and_notes: notesArr.join(' - '),
        commission_released: Number(comm.toFixed(2)),
        payroll_month: payrollMonth,
        raw_month: p.payment_date ? String(p.payment_date).slice(0, 7) : ''
      };
    });

    res.json({
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      agent_name: inv.agent_name || 'Sales Rep',
      client_name: inv.client_name || 'Client',
      total_invoiced: totalInvoiced,
      total_collected: totalCollected,
      pending_balance: pendingBalance,
      paid_percentage: totalInvoiced > 0 ? Number(((totalCollected / totalInvoiced) * 100).toFixed(1)) : 0,
      total_commission_released: Number(totalCommissionReleased.toFixed(2)),
      installments_count: installments.length,
      installments
    });
  } catch (err) {
    console.error('Error fetching invoice timeline:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get detailed breakdown of commissions (Paid and Pending)
router.get('/breakdown', async (req, res) => {
  try {
    const { user_id, role, target_role, start_date, end_date, agent_id, status } = req.query;
    
    // 1. Fetch Released Project Step Commissions
    let releasedQuery = `
      SELECT 
        c.id as commission_id,
        u.id as agent_id,
        u.name as agent_name,
        u.role as agent_role,
        u.commission_percentage,
        p.id as project_id,
        p.title as project_title,
        ps.id as step_id,
        COALESCE(ps.title, CONCAT('Milestone Step #', c.step_id)) as step_title,
        c.base_amount as potential_commission,
        c.final_amount as earned_commission,
        0 as pending_commission,
        c.released_at as date,
        'Paid' as status,
        ps.invoice_item_ids,
        NULL as invoice_number,
        0 as invoice_total_amount,
        0 as invoice_paid_amount,
        0 as installments_count,
        FALSE as is_sales_commission
      FROM commissions c
      JOIN users u ON c.user_id = u.id
      JOIN projects p ON c.project_id = p.id
      LEFT JOIN project_steps ps ON c.step_id = ps.id
      WHERE 1=1
    `;
    const releasedParams = [];

    // 2. Fetch Pending Project Step Commissions (Unreleased steps assigned to specialists)
    let pendingQuery = `
      SELECT 
        NULL as commission_id,
        u.id as agent_id,
        u.name as agent_name,
        u.role as agent_role,
        u.commission_percentage,
        p.id as project_id,
        p.title as project_title,
        ps.id as step_id,
        ps.title as step_title,
        0 as potential_commission,
        0 as earned_commission,
        0 as pending_commission,
        COALESCE(ps.completed_at, ps.created_at) as date,
        'Pending' as status,
        ps.invoice_item_ids,
        NULL as invoice_number,
        0 as invoice_total_amount,
        0 as invoice_paid_amount,
        0 as installments_count,
        FALSE as is_sales_commission
      FROM project_steps ps
      JOIN users u ON ps.assignee_id = u.id
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.commission_released = FALSE
    `;
    const pendingParams = [];

    // 3. Fetch Direct Invoice Sales Commissions (Earned from actual payments received)
    let paymentQuery = `
      SELECT 
        NULL as commission_id,
        i.id as invoice_id,
        (SELECT COUNT(*) FROM invoice_payments WHERE invoice_id = i.id) as installments_count,
        TRUE as is_sales_commission,
        u.id as agent_id,
        u.name as agent_name,
        u.role as agent_role,
        u.commission_percentage,
        p.id as project_id,
        COALESCE(p.title, CONCAT('Client Invoice #', i.invoice_number)) as project_title,
        NULL as step_id,
        CONCAT('Payment Received (Inv #', i.invoice_number, ')') as step_title,
        i.commission_amount,
        i.amount as invoice_total_amount,
        ip.amount as invoice_paid_amount,
        ip.payment_date as date,
        'Paid' as status,
        NULL as invoice_item_ids,
        i.invoice_number,
        c.full_name as client_name,
        ip.payment_method,
        ip.bank,
        ip.notes as payment_notes
      FROM invoice_payments ip
      JOIN invoices i ON ip.invoice_id = i.id
      JOIN users u ON i.agent_id = u.id
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.status != 'Void'
    `;
    const paymentParams = [];

    // 4. Fetch Pending Invoice Balances (Unpaid amounts on invoices)
    let pendingInvoiceQuery = `
      SELECT 
        NULL as commission_id,
        i.id as invoice_id,
        (SELECT COUNT(*) FROM invoice_payments WHERE invoice_id = i.id) as installments_count,
        TRUE as is_sales_commission,
        u.id as agent_id,
        u.name as agent_name,
        u.role as agent_role,
        u.commission_percentage,
        p.id as project_id,
        COALESCE(p.title, CONCAT('Client Invoice #', i.invoice_number)) as project_title,
        NULL as step_id,
        CONCAT('Pending Balance (Inv #', i.invoice_number, ')') as step_title,
        i.commission_amount,
        i.amount as invoice_total_amount,
        i.balance as invoice_pending_balance,
        (i.amount - i.balance) as invoice_paid_amount,
        i.created_at as date,
        'Pending' as status,
        NULL as invoice_item_ids,
        i.invoice_number,
        c.full_name as client_name
      FROM invoices i
      JOIN users u ON i.agent_id = u.id
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.status != 'Void' AND i.balance > 0
    `;
    const pendingInvoiceParams = [];

    // Apply common filters
    if (user_id && role && role !== 'Admin') {
      releasedQuery += ` AND u.id = ?`;
      releasedParams.push(user_id);
      pendingQuery += ` AND u.id = ?`;
      pendingParams.push(user_id);
      paymentQuery += ` AND u.id = ?`;
      paymentParams.push(user_id);
      pendingInvoiceQuery += ` AND u.id = ?`;
      pendingInvoiceParams.push(user_id);
    }
    if (target_role && target_role !== 'all') {
      releasedQuery += ` AND u.role = ?`;
      releasedParams.push(target_role);
      pendingQuery += ` AND u.role = ?`;
      pendingParams.push(target_role);
      paymentQuery += ` AND u.role = ?`;
      paymentParams.push(target_role);
      pendingInvoiceQuery += ` AND u.role = ?`;
      pendingInvoiceParams.push(target_role);
    }
    if (agent_id && agent_id !== 'all') {
      releasedQuery += ` AND u.id = ?`;
      releasedParams.push(agent_id);
      pendingQuery += ` AND u.id = ?`;
      pendingParams.push(agent_id);
      paymentQuery += ` AND u.id = ?`;
      paymentParams.push(agent_id);
      pendingInvoiceQuery += ` AND u.id = ?`;
      pendingInvoiceParams.push(agent_id);
    }
    if (start_date) {
      releasedQuery += ` AND DATE(c.released_at) >= ?`;
      releasedParams.push(start_date);
      pendingQuery += ` AND DATE(COALESCE(ps.completed_at, ps.created_at)) >= ?`;
      pendingParams.push(start_date);
      paymentQuery += ` AND DATE(ip.payment_date) >= ?`;
      paymentParams.push(start_date);
      pendingInvoiceQuery += ` AND DATE(COALESCE(i.issue_date, i.created_at)) >= ?`;
      pendingInvoiceParams.push(start_date);
    }
    if (end_date) {
      releasedQuery += ` AND DATE(c.released_at) <= ?`;
      releasedParams.push(end_date);
      pendingQuery += ` AND DATE(COALESCE(ps.completed_at, ps.created_at)) <= ?`;
      pendingParams.push(end_date);
      paymentQuery += ` AND DATE(ip.payment_date) <= ?`;
      paymentParams.push(end_date);
      pendingInvoiceQuery += ` AND DATE(COALESCE(i.issue_date, i.created_at)) <= ?`;
      pendingInvoiceParams.push(end_date);
    }

    const isPaidFilter = status === 'Paid';
    const isPendingFilter = status === 'Pending' || status === 'Unpaid';
    const isOverdueFilter = status === 'Overdue';
    const isAllFilter = !status || status === 'all';

    if (isOverdueFilter) {
      pendingQuery += ` AND ps.deadline IS NOT NULL AND DATE(ps.deadline) < CURDATE()`;
      pendingInvoiceQuery += ` AND i.due_date IS NOT NULL AND DATE(i.due_date) < CURDATE()`;
    }

    const [releasedRows] = (isAllFilter || isPaidFilter) ? await db.query(releasedQuery, releasedParams) : [[]];
    const [pendingRows] = (isAllFilter || isPendingFilter || isOverdueFilter) ? await db.query(pendingQuery, pendingParams) : [[]];
    const [paymentRows] = (isAllFilter || isPaidFilter) ? await db.query(paymentQuery, paymentParams) : [[]];
    const [pendingInvRows] = (isAllFilter || isPendingFilter || isOverdueFilter) ? await db.query(pendingInvoiceQuery, pendingInvoiceParams) : [[]];

    let allCommissions = [];

    // Append Released Project Steps (Paid)
    if (isAllFilter || isPaidFilter) {
      for (const relRow of releasedRows) {
        allCommissions.push(relRow);
      }
    }

    // Process pending project steps with smart value calculation (Pending / Unpaid / Overdue)
    if (isAllFilter || isPendingFilter || isOverdueFilter) {
      for (const row of pendingRows) {
        const items_total = await getStepItemsTotal(row, db);
        const comm_pct = parseFloat(row.commission_percentage) || 0;
        
        if (items_total > 0 && comm_pct > 0) {
          row.potential_commission = Number(((items_total * comm_pct) / 100).toFixed(2));
          row.pending_commission = row.potential_commission;
          row.earned_commission = 0;
          allCommissions.push(row);
        }
      }
    }

    // Process Direct Invoice Payments (Earned Commissions / Paid)
    if (isAllFilter || isPaidFilter) {
      for (const payRow of paymentRows) {
        const invTotal = parseFloat(payRow.invoice_total_amount) || 0;
        const payAmt = parseFloat(payRow.invoice_paid_amount) || 0;
        const commPct = parseFloat(payRow.commission_percentage) || 0;
        const invComm = parseFloat(payRow.commission_amount) || 0;

        let earned = 0;
        if (invComm > 0 && invTotal > 0) {
          earned = (payAmt / invTotal) * invComm;
        } else if (commPct > 0) {
          earned = payAmt * (commPct / 100);
        }

        payRow.potential_commission = Number(earned.toFixed(2));
        payRow.earned_commission = Number(earned.toFixed(2));
        payRow.pending_commission = 0;
        payRow.invoice_numbers = [payRow.invoice_number];

        allCommissions.push(payRow);
      }
    }

    // Process Pending Invoice Balances (Pending Commissions / Unpaid / Overdue)
    if (isAllFilter || isPendingFilter || isOverdueFilter) {
      for (const pInvRow of pendingInvRows) {
        const invTotal = parseFloat(pInvRow.invoice_total_amount) || 0;
        const balAmt = parseFloat(pInvRow.invoice_pending_balance) || 0;
        const commPct = parseFloat(pInvRow.commission_percentage) || 0;
        const invComm = parseFloat(pInvRow.commission_amount) || 0;

        let pending = 0;
        if (invComm > 0 && invTotal > 0) {
          pending = (balAmt / invTotal) * invComm;
        } else if (commPct > 0) {
          pending = balAmt * (commPct / 100);
        }

        pInvRow.potential_commission = Number(pending.toFixed(2));
        pInvRow.earned_commission = 0;
        pInvRow.pending_commission = Number(pending.toFixed(2));
        pInvRow.invoice_numbers = [pInvRow.invoice_number];

        allCommissions.push(pInvRow);
      }
    }

    // Enrich commission rows with invoice numbers and products details
    for (const row of allCommissions) {
      row.invoice_numbers = row.invoice_numbers || [];
      row.products = row.products || [];

      if (row.invoice_item_ids) {
        let itemIds = [];
        try { itemIds = typeof row.invoice_item_ids === 'string' ? JSON.parse(row.invoice_item_ids) : row.invoice_item_ids; } catch(e){}
        if (typeof itemIds === 'number') itemIds = [itemIds];
        if (!Array.isArray(itemIds) && itemIds !== null && itemIds !== undefined) itemIds = [itemIds];
        
        if (Array.isArray(itemIds) && itemIds.length > 0) {
          const [invoices] = await db.query(`
            SELECT DISTINCT i.invoice_number 
            FROM invoice_items it
            JOIN invoices i ON it.invoice_id = i.id
            WHERE it.id IN (?)
          `, [itemIds]);
          
          const newInvs = invoices.map(inv => inv.invoice_number);
          row.invoice_numbers = [...row.invoice_numbers, ...newInvs];

          // Fetch exact products for this step
          const [invoiceItems] = await db.query(`
            SELECT description, total 
            FROM invoice_items 
            WHERE id IN (?)
          `, [itemIds]);
          row.products = invoiceItems;
        }
      }

      if (row.invoice_numbers.length === 0 && row.project_id) {
        const [projInvs] = await db.query('SELECT id, invoice_number FROM invoices WHERE project_id = ?', [row.project_id]);
        if (projInvs.length > 0) {
          row.invoice_numbers = projInvs.map(i => i.invoice_number);
        }
      }
    }

    // Sort by date DESC, then earned_commission DESC
    allCommissions.sort((a, b) => {
      if (a.date && b.date) return new Date(b.date) - new Date(a.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return (b.earned_commission || 0) - (a.earned_commission || 0);
    });

    res.json(allCommissions);
  } catch (error) {
    console.error('Error fetching commissions breakdown:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all agents and their aggregate commission data
router.get('/', async (req, res) => {
  try {
    const { user_id, role, target_role, start_date, end_date, agent_id, status } = req.query;

    const isPaidFilter = status === 'Paid';
    const isPendingFilter = status === 'Pending' || status === 'Unpaid';
    const isOverdueFilter = status === 'Overdue';
    const isAllFilter = !status || status === 'all';
    
    let userQuery = `SELECT id, name, email, role, commission_percentage FROM users WHERE role != 'Client'`;
    const userParams = [];

    if (user_id && role && role !== 'Admin') {
      userQuery += ` AND id = ?`;
      userParams.push(user_id);
    }
    if (target_role && target_role !== 'all') {
      userQuery += ` AND role = ?`;
      userParams.push(target_role);
    }
    if (agent_id && agent_id !== 'all') {
      userQuery += ` AND id = ?`;
      userParams.push(agent_id);
    }

    userQuery += ` ORDER BY name ASC`;
    const [users] = await db.query(userQuery, userParams);

    const results = [];

    for (const u of users) {
      let total_earned = 0;
      let total_paid_out = 0;
      let pending_payout = 0;
      let total_invoices = 0;
      const commPct = parseFloat(u.commission_percentage || 0);

      // 1. Direct Invoice Sales Commission (Paid / Earned)
      if (isAllFilter || isPaidFilter) {
        let paySql = `
          SELECT ip.amount as payment_amount, i.amount as invoice_amount, i.commission_amount, u.commission_percentage
          FROM invoice_payments ip
          JOIN invoices i ON ip.invoice_id = i.id
          JOIN users u ON i.agent_id = u.id
          WHERE i.agent_id = ? AND i.status != 'Void'
        `;
        const payParams = [u.id];
        if (start_date) {
          paySql += ` AND DATE(ip.payment_date) >= ?`;
          payParams.push(start_date);
        }
        if (end_date) {
          paySql += ` AND DATE(ip.payment_date) <= ?`;
          payParams.push(end_date);
        }

        const [payments] = await db.query(paySql, payParams);
        for (const p of payments) {
          const payAmt = parseFloat(p.payment_amount || 0);
          const invAmt = parseFloat(p.invoice_amount || 0);
          const invComm = parseFloat(p.commission_amount || 0);

          let earned = 0;
          if (invComm > 0 && invTotal > 0) {
            earned = (payAmt / invTotal) * invComm;
          } else if (commPct > 0) {
            earned = payAmt * (commPct / 100);
          }
          total_paid_out += earned;
          total_earned += earned;
        }

        // 2. Project Steps Commission (Released / Paid)
        let relSql = `SELECT COALESCE(SUM(final_amount), 0) as total FROM commissions WHERE user_id = ? AND status = 'Released'`;
        const relParams = [u.id];
        if (start_date) {
          relSql += ` AND DATE(released_at) >= ?`;
          relParams.push(start_date);
        }
        if (end_date) {
          relSql += ` AND DATE(released_at) <= ?`;
          relParams.push(end_date);
        }
        const [releasedProjectComms] = await db.query(relSql, relParams);
        const projReleased = parseFloat(releasedProjectComms[0]?.total || 0);
        total_paid_out += projReleased;
        total_earned += projReleased;
      }

      // 3. Direct Invoice Pending Commission (Unpaid invoice balances)
      if (isAllFilter || isPendingFilter || isOverdueFilter) {
        let pendingInvSql = `
          SELECT amount, balance, commission_amount, due_date
          FROM invoices 
          WHERE agent_id = ? AND status != 'Void' AND balance > 0
        `;
        const pendingInvParams = [u.id];
        if (start_date) {
          pendingInvSql += ` AND DATE(COALESCE(issue_date, created_at)) >= ?`;
          pendingInvParams.push(start_date);
        }
        if (end_date) {
          pendingInvSql += ` AND DATE(COALESCE(issue_date, created_at)) <= ?`;
          pendingInvParams.push(end_date);
        }
        if (isOverdueFilter) {
          pendingInvSql += ` AND due_date IS NOT NULL AND DATE(due_date) < CURDATE()`;
        }

        const [pendingInvoices] = await db.query(pendingInvSql, pendingInvParams);
        for (const inv of pendingInvoices) {
          const invTotal = parseFloat(inv.amount || 0);
          const invBalance = parseFloat(inv.balance || 0);
          const invComm = parseFloat(inv.commission_amount || 0);

          let pending = 0;
          if (invComm > 0 && invTotal > 0) {
            pending = (invBalance / invTotal) * invComm;
          } else if (commPct > 0) {
            pending = invBalance * (commPct / 100);
          }
          pending_payout += pending;
          total_earned += pending;
        }

        // 4. Project Steps Commission (Pending / In-Progress Steps)
        let pendingStepSql = `
          SELECT id, project_id, invoice_item_ids, deadline, completed_at, created_at 
          FROM project_steps 
          WHERE assignee_id = ? AND commission_released = FALSE
        `;
        const pendingStepParams = [u.id];
        if (start_date) {
          pendingStepSql += ` AND DATE(COALESCE(completed_at, created_at)) >= ?`;
          pendingStepParams.push(start_date);
        }
        if (end_date) {
          pendingStepSql += ` AND DATE(COALESCE(completed_at, created_at)) <= ?`;
          pendingStepParams.push(end_date);
        }
        if (isOverdueFilter) {
          pendingStepSql += ` AND deadline IS NOT NULL AND DATE(deadline) < CURDATE()`;
        }

        const [pendingSteps] = await db.query(pendingStepSql, pendingStepParams);

        for (const pStep of pendingSteps) {
          const stepVal = await getStepItemsTotal(pStep, db);
          if (stepVal > 0 && commPct > 0) {
            const stepComm = (stepVal * commPct) / 100;
            pending_payout += stepComm;
            total_earned += stepComm;
          }
        }
      }

      // Tasks / Invoices count based on role and date filter
      let invCountSql = `SELECT COUNT(*) as cnt FROM invoices WHERE agent_id = ? AND status != 'Void'`;
      const invCountParams = [u.id];
      if (start_date) {
        invCountSql += ` AND DATE(COALESCE(issue_date, created_at)) >= ?`;
        invCountParams.push(start_date);
      }
      if (end_date) {
        invCountSql += ` AND DATE(COALESCE(issue_date, created_at)) <= ?`;
        invCountParams.push(end_date);
      }
      const [invCountRes] = await db.query(invCountSql, invCountParams);
      const invCount = invCountRes[0]?.cnt || 0;

      let stepCountSql = `SELECT COUNT(*) as cnt FROM project_steps WHERE assignee_id = ? AND status = 'Completed'`;
      const stepCountParams = [u.id];
      if (start_date) {
        stepCountSql += ` AND DATE(completed_at) >= ?`;
        stepCountParams.push(start_date);
      }
      if (end_date) {
        stepCountSql += ` AND DATE(completed_at) <= ?`;
        stepCountParams.push(end_date);
      }
      const [stepCountRes] = await db.query(stepCountSql, stepCountParams);
      const stepCount = stepCountRes[0]?.cnt || 0;

      if (u.role === 'Production') {
        total_invoices = stepCount;
      } else if (u.role === 'Sales' || u.role === 'Sales Rep') {
        total_invoices = invCount;
      } else {
        total_invoices = invCount > 0 ? invCount : stepCount;
      }

      results.push({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        commission_percentage: u.commission_percentage || 0,
        total_invoices,
        total_earned: Number(total_earned.toFixed(2)),
        total_paid_out: Number(total_paid_out.toFixed(2)),
        pending_payout: Number(pending_payout.toFixed(2))
      });
    }

    results.sort((a, b) => b.total_earned - a.total_earned);

    res.json(results);
  } catch (error) {
    console.error('Error fetching commission aggregates:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
