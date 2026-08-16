const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all quotations
router.get('/', async (req, res) => {
  try {
    const { user_id, role } = req.query;

    let query = `
      SELECT q.*, 
             c.full_name as client_name,
             u.name as creator_name
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN users u ON q.created_by = u.id
    `;
    const params = [];

    // Filter for non-admin roles if needed
    if (user_id && role && role !== 'Admin') {
      query += ` WHERE q.created_by = ?`;
      params.push(user_id);
    }

    query += ` ORDER BY q.created_at DESC`;
    
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific quotation with line items
router.get('/:id', async (req, res) => {
  try {
    const [quoteRows] = await db.query(`
      SELECT q.*, 
             c.full_name as client_name, c.business_name, c.email as client_email, c.physical_address
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      WHERE q.id = ?
    `, [req.params.id]);

    if (quoteRows.length === 0) return res.status(404).json({ error: 'Quotation not found' });
    const quote = quoteRows[0];

    const [items] = await db.query('SELECT * FROM quotation_items WHERE quotation_id = ?', [quote.id]);
    quote.items = items;

    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new quotation with line items
router.post('/', async (req, res) => {
  const { quotation_number, client_id, issue_date, expiry_date, terms_and_conditions, items, created_by } = req.body;
  
  if (!client_id || !issue_date || !items || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields or items' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += (item.quantity * item.unit_price);
    }

    const finalQuotationNumber = quotation_number || `QT-${Date.now()}`;
    
    const cleanCreatedBy = (created_by && created_by !== '') ? created_by : null;

    // Create Quotation
    const [quoteResult] = await connection.query(
      'INSERT INTO quotations (quotation_number, amount, status, client_id, issue_date, expiry_date, terms_and_conditions, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [finalQuotationNumber, totalAmount, 'Draft', client_id, issue_date, expiry_date || null, terms_and_conditions || '', cleanCreatedBy]
    );
    const quoteId = quoteResult.insertId;

    // Create Quotation Items
    for (const item of items) {
      const itemTotal = item.quantity * item.unit_price;
      await connection.query(
        'INSERT INTO quotation_items (quotation_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)',
        [quoteId, item.description, item.quantity, item.unit_price, itemTotal]
      );
    }

    await connection.commit();
    res.status(201).json({ id: quoteId, message: 'Quotation created successfully' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Update quotation status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE quotations SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
