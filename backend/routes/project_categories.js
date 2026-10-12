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
  const catId = req.params.id;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Unlink any leads that used this category
    await connection.query('UPDATE leads SET category_id = NULL WHERE category_id = ?', [catId]);

    // 2. Delete the category
    const [result] = await connection.query('DELETE FROM project_categories WHERE id = ?', [catId]);

    await connection.commit();
    res.json({ message: 'Project category deleted successfully', affectedRows: result.affectedRows });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
