const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all project categories
router.get('/', async (req, res) => {
  try {
    const [categories] = await db.query('SELECT * FROM project_categories ORDER BY name ASC');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new project category
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const trimmedName = name.trim();
    const [result] = await db.query('INSERT INTO project_categories (name) VALUES (?)', [trimmedName]);
    res.status(201).json({ id: result.insertId, name: trimmedName, message: 'Project category created successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Project category already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete a project category
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM project_categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Project category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
