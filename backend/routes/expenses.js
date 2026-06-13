const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all expenses
router.get('/', async (req, res) => {
  try {
    const [expenses] = await db.query('SELECT * FROM expenses ORDER BY date ASC, id ASC');
    
    // Calculate running balance and bank totals
    let runningBalance = 0;
    let cashInHand = 0;
    let otherExpenses = 0;
    const bankTotals = {}; // Dynamic map for banks

    const dataWithBalance = expenses.map(exp => {
      runningBalance += Number(exp.receipt_amount) - Number(exp.payment_amount);
      cashInHand += Number(exp.receipt_amount);
      otherExpenses += Number(exp.payment_amount);

      if (exp.bank && exp.bank.trim() !== '') {
        if (!bankTotals[exp.bank]) bankTotals[exp.bank] = 0;
        bankTotals[exp.bank] += Number(exp.receipt_amount) - Number(exp.payment_amount);
      }

      return { ...exp, balance: runningBalance };
    });

    const [[invoiceTotals]] = await db.query('SELECT SUM(amount) as total_invoiced, SUM(balance) as total_balance FROM invoices');

    res.json({
      data: dataWithBalance.reverse(), // latest first for display
      summary: {
        cashInHand,
        otherExpenses,
        totalNetBalance: runningBalance,
        bankTotals,
        totalInvoiced: invoiceTotals.total_invoiced || 0,
        totalInvoiceBalance: invoiceTotals.total_balance || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new expense/receipt
router.post('/', async (req, res) => {
  const { date, client, description, mode, bank, reference, type, amount } = req.body;
  try {
    const receipt_amount = type === 'receipt' ? amount : 0;
    const payment_amount = type === 'payment' ? amount : 0;

    await db.query(`
      INSERT INTO expenses (date, client, description, mode, bank, reference, receipt_amount, payment_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [date, client || '', description || '', mode || '', bank || '', reference || '', receipt_amount, payment_amount]);

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
  const { date, client, description, mode, bank, reference, type, amount } = req.body;
  try {
    const receipt_amount = type === 'receipt' ? amount : 0;
    const payment_amount = type === 'payment' ? amount : 0;

    await db.query(`
      UPDATE expenses 
      SET date = ?, client = ?, description = ?, mode = ?, bank = ?, reference = ?, receipt_amount = ?, payment_amount = ?
      WHERE id = ?
    `, [date, client || '', description || '', mode || '', bank || '', reference || '', receipt_amount, payment_amount, req.params.id]);

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
