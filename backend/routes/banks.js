const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all banks with live calculated ledger balance
router.get('/', async (req, res) => {
  try {
    const [banks] = await db.query('SELECT * FROM banks ORDER BY id ASC');
    
    // Calculate live net balance for each bank from expenses (Receipts - Payments)
    const [expenseBalances] = await db.query(`
      SELECT bank, SUM(receipt_amount - payment_amount) as net_balance 
      FROM expenses 
      WHERE bank IS NOT NULL AND bank != ''
      GROUP BY bank
    `);

    const balanceMap = {};
    expenseBalances.forEach(row => {
      balanceMap[row.bank] = parseFloat(row.net_balance || 0);
    });

    const banksWithBalance = banks.map(b => ({
      ...b,
      balance: balanceMap[b.name] !== undefined ? balanceMap[b.name] : 0
    }));

    res.json(banksWithBalance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a bank
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Bank name is required' });
  try {
    await db.query('INSERT INTO banks (name) VALUES (?)', [name]);
    res.status(201).json({ message: 'Bank created successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Bank already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete a bank
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM banks WHERE id = ?', [req.params.id]);
    res.json({ message: 'Bank deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
