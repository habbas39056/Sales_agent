const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all banks
router.get('/', async (req, res) => {
  try {
    const [banks] = await db.query('SELECT * FROM banks ORDER BY id ASC');
    res.json(banks);
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
