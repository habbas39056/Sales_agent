const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all banks with live calculated ledger balance
router.get('/', async (req, res) => {
  try {
    const [banks] = await db.query('SELECT * FROM banks ORDER BY id ASC');
    
    // Calculate live net balance for each bank from expenses (Receipts - Payments)
    const [expenseBalances] = await db.query(`
      SELECT bank, 
             SUM(receipt_amount - payment_amount) as net_balance,
             SUM(CASE WHEN category = 'Opening Balance' OR reference LIKE 'OPENING-%' THEN 1 ELSE 0 END) as has_opening_in_expenses
      FROM expenses 
      WHERE bank IS NOT NULL AND bank != ''
      GROUP BY bank
    `);

    const balanceMap = {};
    expenseBalances.forEach(row => {
      balanceMap[row.bank] = {
        net: parseFloat(row.net_balance || 0),
        hasOpening: Number(row.has_opening_in_expenses || 0) > 0
      };
    });

    const banksWithBalance = banks.map(b => {
      const opening = parseFloat(b.opening_balance || 0);
      const row = balanceMap[b.name];
      // If opening balance is already recorded as an entry inside expenses, row.net already includes it!
      // Otherwise, balance is opening + row.net
      const balance = row ? (row.hasOpening ? row.net : (opening + row.net)) : opening;
      return {
        ...b,
        opening_balance: opening,
        balance: balance
      };
    });

    res.json(banksWithBalance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a bank
router.post('/', async (req, res) => {
  const { name, opening_balance } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Bank name is required' });
  const bankName = name.trim();
  const opening = parseFloat(opening_balance) || 0.00;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [bankResult] = await connection.query(
      'INSERT INTO banks (name, opening_balance) VALUES (?, ?)',
      [bankName, opening]
    );
    const bankId = bankResult.insertId;

    if (opening > 0) {
      const today = new Date().toISOString().split('T')[0];
      await connection.query(`
        INSERT INTO expenses (date, client, description, mode, bank, reference, receipt_amount, payment_amount, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, 'Opening Balance')
      `, [
        today,
        'Initial Deposit',
        `Opening Balance - ${bankName}`,
        'Bank Transfer',
        bankName,
        `OPENING-BANK-${bankId}`,
        opening
      ]);
    }

    await connection.commit();
    res.status(201).json({ message: 'Bank created successfully', bank_id: bankId });
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Bank already exists' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Update a bank (name and opening_balance)
router.put('/:id', async (req, res) => {
  const { name, opening_balance } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Bank name is required' });
  const bankId = req.params.id;
  const newName = name.trim();
  const newOpening = parseFloat(opening_balance) || 0.00;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[oldBank]] = await connection.query('SELECT * FROM banks WHERE id = ?', [bankId]);
    if (!oldBank) {
      await connection.rollback();
      return res.status(404).json({ error: 'Bank not found' });
    }
    const oldName = oldBank.name;

    await connection.query('UPDATE banks SET name = ?, opening_balance = ? WHERE id = ?', [newName, newOpening, bankId]);

    // If bank name changed, update all existing expenses that reference the old bank name
    if (oldName !== newName) {
      await connection.query('UPDATE expenses SET bank = ? WHERE bank = ?', [newName, oldName]);
    }

    // Check if an Opening Balance record exists in expenses
    const [existingEntries] = await connection.query(
      "SELECT id FROM expenses WHERE reference = ? OR (category = 'Opening Balance' AND bank = ?)",
      [`OPENING-BANK-${bankId}`, newName]
    );

    if (newOpening > 0) {
      if (existingEntries.length > 0) {
        // Update existing opening balance entry
        await connection.query(`
          UPDATE expenses 
          SET bank = ?, description = ?, receipt_amount = ?, reference = ?
          WHERE id = ?
        `, [
          newName,
          `Opening Balance - ${newName}`,
          newOpening,
          `OPENING-BANK-${bankId}`,
          existingEntries[0].id
        ]);
      } else {
        // Insert new opening balance entry
        const today = new Date().toISOString().split('T')[0];
        await connection.query(`
          INSERT INTO expenses (date, client, description, mode, bank, reference, receipt_amount, payment_amount, category)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, 'Opening Balance')
        `, [
          today,
          'Initial Deposit',
          `Opening Balance - ${newName}`,
          'Bank Transfer',
          newName,
          `OPENING-BANK-${bankId}`,
          newOpening
        ]);
      }
    } else {
      // If opening balance set to 0, delete the opening balance record if it exists
      if (existingEntries.length > 0) {
        await connection.query('DELETE FROM expenses WHERE id = ?', [existingEntries[0].id]);
      }
    }

    await connection.commit();
    res.json({ message: 'Bank updated successfully' });
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Another bank with this name already exists' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// Delete a bank
router.delete('/:id', async (req, res) => {
  const bankId = req.params.id;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[bank]] = await connection.query('SELECT * FROM banks WHERE id = ?', [bankId]);
    if (bank) {
      await connection.query(
        "DELETE FROM expenses WHERE reference = ? OR (category = 'Opening Balance' AND bank = ?)",
        [`OPENING-BANK-${bankId}`, bank.name]
      );
      await connection.query('DELETE FROM banks WHERE id = ?', [bankId]);
    }
    await connection.commit();
    res.json({ message: 'Bank deleted successfully' });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
