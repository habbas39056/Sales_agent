const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all products/services
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new product/service
router.post('/', async (req, res) => {
  const { name, description, default_price } = req.body;
  if (!name || default_price === undefined) {
    return res.status(400).json({ error: 'Name and default_price are required' });
  }
  
  try {
    const [result] = await db.query(
      'INSERT INTO products (name, description, default_price) VALUES (?, ?, ?)',
      [name, description, default_price]
    );
    res.status(201).json({ id: result.insertId, message: 'Product created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
