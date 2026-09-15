const express = require('express');
const router = express.Router();
const db = require('../db');

// Auto-migrate products table schema if needed
async function ensureProductsSchema() {
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM products");
    const colNames = cols.map(c => c.Field);
    
    if (!colNames.includes('unit')) {
      await db.query("ALTER TABLE products ADD COLUMN unit VARCHAR(50) DEFAULT ''");
    }
    if (!colNames.includes('group_name')) {
      await db.query("ALTER TABLE products ADD COLUMN group_name VARCHAR(100) DEFAULT ''");
    }
    if (!colNames.includes('tax_rate')) {
      await db.query("ALTER TABLE products ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0.00");
    }
  } catch (err) {
    console.error("Failed ensuring products schema:", err.message);
  }
}
ensureProductsSchema();

// 1. GET ALL PRODUCTS / ITEMS (WITH SEARCH & GROUP FILTERS)
router.get('/', async (req, res) => {
  try {
    const { search, group_name } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR group_name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (group_name && group_name !== 'All') {
      sql += ' AND group_name = ?';
      params.push(group_name);
    }

    sql += ' ORDER BY group_name ASC, name ASC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. GET DISTINCT ITEM GROUPS
router.get('/groups', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT DISTINCT group_name FROM products WHERE group_name IS NOT NULL AND group_name != "" ORDER BY group_name ASC');
    const groups = rows.map(r => r.group_name);
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. CREATE NEW PRODUCT / ITEM TEMPLATE
router.post('/', async (req, res) => {
  const { name, description, default_price, unit, group_name, tax_rate } = req.body;
  if (!name || default_price === undefined) {
    return res.status(400).json({ error: 'Name and default_price are required' });
  }
  
  try {
    const [result] = await db.query(
      'INSERT INTO products (name, description, default_price, unit, group_name, tax_rate) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', parseFloat(default_price) || 0, unit || '', group_name || '', parseFloat(tax_rate) || 0]
    );
    res.status(201).json({ id: result.insertId, message: 'Item created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. UPDATE PRODUCT / ITEM TEMPLATE
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, default_price, unit, group_name, tax_rate } = req.body;
  if (!name || default_price === undefined) {
    return res.status(400).json({ error: 'Name and default_price are required' });
  }

  try {
    await db.query(
      'UPDATE products SET name = ?, description = ?, default_price = ?, unit = ?, group_name = ?, tax_rate = ? WHERE id = ?',
      [name, description || '', parseFloat(default_price) || 0, unit || '', group_name || '', parseFloat(tax_rate) || 0, id]
    );
    res.json({ message: 'Item updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. DELETE PRODUCT / ITEM TEMPLATE
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. BULK IMPORT ITEMS
router.post('/import', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided for import' });
  }

  try {
    let imported = 0;
    for (const item of items) {
      if (!item.name) continue;
      await db.query(
        'INSERT INTO products (name, description, default_price, unit, group_name, tax_rate) VALUES (?, ?, ?, ?, ?, ?)',
        [
          item.name, 
          item.description || '', 
          parseFloat(item.default_price || item.rate || 0) || 0, 
          item.unit || '', 
          item.group_name || item.group || '', 
          parseFloat(item.tax_rate || 0) || 0
        ]
      );
      imported++;
    }
    res.json({ message: `Successfully imported ${imported} items!` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
