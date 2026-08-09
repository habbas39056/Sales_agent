const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all expense categories
router.get('/', async (req, res) => {
  try {
    const [categories] = await db.query('SELECT * FROM expense_categories ORDER BY name ASC');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new category
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Category name is required' });
  }
  try {
    const [result] = await db.query('INSERT INTO expense_categories (name) VALUES (?)', [name.trim()]);
    res.status(201).json({ message: 'Category added successfully', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Category already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete a category
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM expense_categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
