const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all expenses with full balances and summaries
router.get('/', async (req, res) => {
  try {
    const [rawExpenses] = await db.query('SELECT * FROM expenses ORDER BY date ASC, id ASC');
    const [banks] = await db.query('SELECT * FROM banks ORDER BY id ASC');

    const validBankNames = new Set(banks.map(b => b.name.trim().toLowerCase()));

    // Exclude any orphan records belonging to banks that were deleted
    const expenses = rawExpenses.filter(exp => {
      if (!exp.bank || !exp.bank.trim()) return true;
      const bLower = exp.bank.trim().toLowerCase();
      if (bLower === 'cash') return true;
      return validBankNames.has(bLower);
    });

    // 1. Initialize bank balances
    const bankTotals = {};
    let unrecordedOpeningBalance = 0;

    // Check which banks already have an opening balance ledger entry in expenses
    banks.forEach(b => {
      const op = parseFloat(b.opening_balance || 0);
      const hasOpeningInExpenses = expenses.some(exp => 
        exp.bank === b.name && 
        (exp.category === 'Opening Balance' || (exp.reference && exp.reference.startsWith('OPENING-')))
      );
      // If opening balance is already an entry in expenses, start with 0 so the entry adds it in the loop.
      // If not yet in expenses, initialize with op.
      const initialOp = hasOpeningInExpenses ? 0 : op;
      bankTotals[b.name] = initialOp;
      unrecordedOpeningBalance += initialOp;
    });

    // 2. Running balance starts with unrecorded opening balance
    let runningBalance = unrecordedOpeningBalance;
    let cashInHand = 0;
    let totalExpenses = 0;
    let totalReceipts = 0;
    const categoryTotals = {};
    let uncategorizedExpenses = 0;

    const dataWithBalance = expenses.map(exp => {
      const rAmount = Number(exp.receipt_amount || 0);
      const pAmount = Number(exp.payment_amount || 0);
      const net = rAmount - pAmount;

      runningBalance += net;
      totalReceipts += rAmount;
      totalExpenses += pAmount;

      const bName = exp.bank ? exp.bank.trim() : '';
      const modeLower = (exp.mode || '').toLowerCase();

      if (bName) {
        if (bankTotals[bName] === undefined) bankTotals[bName] = 0;
        bankTotals[bName] += net;
      } else if (modeLower === 'cash' || !bName) {
        cashInHand += net;
      }

      const cName = exp.category ? exp.category.trim() : '';
      if (cName) {
        if (!categoryTotals[cName]) categoryTotals[cName] = 0;
        categoryTotals[cName] += (pAmount - rAmount); // Net expense
      } else {
        if (pAmount > 0 || rAmount > 0) {
          uncategorizedExpenses += (pAmount - rAmount);
        }
      }

      return { ...exp, balance: runningBalance };
    });

    // Invoices summary excluding cancelled/void/draft
    const [[invoiceTotals]] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as total_invoiced, COALESCE(SUM(balance), 0) as total_balance 
      FROM invoices 
      WHERE status NOT IN ('Cancelled', 'Void', 'Draft')
    `);

    res.json({
      data: dataWithBalance.reverse(), // latest first for display
      summary: {
        cashInHand,
        otherExpenses: totalExpenses, // for backwards compatibility
        totalExpenses,
        totalReceipts,
        totalOpeningBalance: banks.reduce((s, b) => s + (parseFloat(b.opening_balance) || 0), 0),
        totalNetBalance: runningBalance,
        bankTotals,
        categoryTotals,
        uncategorizedExpenses,
        totalInvoiced: parseFloat(invoiceTotals.total_invoiced || 0),
        totalInvoiceBalance: parseFloat(invoiceTotals.total_balance || 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check for orphan receipts (deleted invoices or deleted banks)
router.get('/orphan-check', async (req, res) => {
  try {
    const [invoices] = await db.query('SELECT invoice_number FROM invoices');
    const validInvNumbers = new Set(invoices.map(i => i.invoice_number));

    const [banks] = await db.query('SELECT name FROM banks');
    const validBankNames = new Set(banks.map(b => b.name.trim().toLowerCase()));

    const [allExpenses] = await db.query("SELECT * FROM expenses");
    const orphans = allExpenses.filter(exp => {
      // 1. Deleted invoice receipt
      if (exp.description && exp.description.startsWith('Payment for Invoice #')) {
        const match = exp.description.match(/Payment for Invoice #([^\s-]+(?:-[^\s-]+)*)/);
        if (match && !validInvNumbers.has(match[1])) {
          return true;
        }
      }
      // 2. Deleted bank transaction
      if (exp.bank && exp.bank.trim()) {
        const bName = exp.bank.trim().toLowerCase();
        if (bName !== 'cash' && !validBankNames.has(bName)) {
          return true;
        }
      }
      return false;
    });

    res.json({ count: orphans.length, orphans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clean up orphan receipts from deleted invoices or deleted banks
router.post('/cleanup-orphans', async (req, res) => {
  try {
    const [invoices] = await db.query('SELECT invoice_number FROM invoices');
    const validInvNumbers = new Set(invoices.map(i => i.invoice_number));

    const [banks] = await db.query('SELECT name FROM banks');
    const validBankNames = new Set(banks.map(b => b.name.trim().toLowerCase()));

    const [allExpenses] = await db.query("SELECT id, description, bank, receipt_amount, payment_amount FROM expenses");
    const orphanIds = [];
    allExpenses.forEach(exp => {
      // 1. Invoice orphan
      if (exp.description && exp.description.startsWith('Payment for Invoice #')) {
        const match = exp.description.match(/Payment for Invoice #([^\s-]+(?:-[^\s-]+)*)/);
        if (match && !validInvNumbers.has(match[1])) {
          orphanIds.push(exp.id);
          return;
        }
      }
      // 2. Deleted bank orphan
      if (exp.bank && exp.bank.trim()) {
        const bName = exp.bank.trim().toLowerCase();
        if (bName !== 'cash' && !validBankNames.has(bName)) {
          orphanIds.push(exp.id);
        }
      }
    });

    if (orphanIds.length > 0) {
      await db.query('DELETE FROM expenses WHERE id IN (?)', [orphanIds]);
    }

    res.json({ message: `Successfully cleaned up ${orphanIds.length} orphan entries.`, cleanedIds: orphanIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new expense/receipt or transfer
router.post('/', async (req, res) => {
  const { date, client, description, mode, bank, reference, type, amount, category, from_bank, to_bank } = req.body;
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  // Handle Account Transfer
  if (type === 'transfer') {
    if (!from_bank || !to_bank) {
      return res.status(400).json({ error: 'Both From Account and To Account are required for a transfer.' });
    }
    if (from_bank === to_bank) {
      return res.status(400).json({ error: 'Source and Destination accounts cannot be the same.' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const entryDate = date || new Date().toISOString().split('T')[0];
      const descOut = description ? `${description} (Transfer to ${to_bank})` : `Transfer to ${to_bank}`;
      const descIn = description ? `${description} (Transfer from ${from_bank})` : `Transfer from ${from_bank}`;

      // 1. Outflow from source
      await connection.query(`
        INSERT INTO expenses (date, client, description, mode, bank, reference, receipt_amount, payment_amount, category)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'Account Transfer')
      `, [
        entryDate, 
        client || '', 
        descOut, 
        from_bank === 'Cash' ? 'Cash' : 'Bank Transfer', 
        from_bank === 'Cash' ? '' : from_bank, 
        reference || '', 
        numAmount
      ]);

      // 2. Inflow to destination
      await connection.query(`
        INSERT INTO expenses (date, client, description, mode, bank, reference, receipt_amount, payment_amount, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Account Transfer')
      `, [
        entryDate, 
        client || '', 
        descIn, 
        to_bank === 'Cash' ? 'Cash' : 'Bank Transfer', 
        to_bank === 'Cash' ? '' : to_bank, 
        reference || '', 
        numAmount
      ]);

      await connection.commit();
      return res.status(201).json({ message: 'Account transfer recorded successfully' });
    } catch (err) {
      await connection.rollback();
      return res.status(500).json({ error: err.message });
    } finally {
      connection.release();
    }
  }

  // Standard Receipt / Payment
  try {
    const receipt_amount = type === 'receipt' ? numAmount : 0;
    const payment_amount = type === 'payment' ? numAmount : 0;
    const actualBank = (mode || '').toLowerCase() === 'cash' ? '' : (bank || '');

    await db.query(`
      INSERT INTO expenses (date, client, description, mode, bank, reference, receipt_amount, payment_amount, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [date, client || '', description || '', mode || '', actualBank, reference || '', receipt_amount, payment_amount, category || '']);

    res.status(201).json({ message: 'Entry added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Wipe all expense data
router.delete('/wipe', async (req, res) => {
  try {
    await db.query('TRUNCATE TABLE expenses');
    res.json({ message: 'All expense data wiped successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an expense/receipt
router.put('/:id', async (req, res) => {
  const { date, client, description, mode, bank, reference, type, amount, category } = req.body;
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  try {
    const receipt_amount = type === 'receipt' ? numAmount : 0;
    const payment_amount = type === 'payment' ? numAmount : 0;
    const actualBank = (mode || '').toLowerCase() === 'cash' ? '' : (bank || '');

    await db.query(`
      UPDATE expenses 
      SET date = ?, client = ?, description = ?, mode = ?, bank = ?, reference = ?, receipt_amount = ?, payment_amount = ?, category = ?
      WHERE id = ?
    `, [date, client || '', description || '', mode || '', actualBank, reference || '', receipt_amount, payment_amount, category || '', req.params.id]);

    res.json({ message: 'Entry updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an expense
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    res.json({ message: 'Entry deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
