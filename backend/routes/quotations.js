const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all quotations
router.get('/', async (req, res) => {
  try {
    const { user_id, role } = req.query;

    let query = `
      SELECT q.*, 
             COALESCE(c.full_name, q.manual_client_name, 'Unknown Client') as client_name,
             COALESCE(c.business_name, q.manual_client_business) as business_name,
             COALESCE(c.email, q.manual_client_email) as client_email,
             COALESCE(c.physical_address, q.manual_client_address) as client_address,
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
             COALESCE(c.full_name, q.manual_client_name, 'Unknown Client') as client_name, 
             COALESCE(c.business_name, q.manual_client_business) as business_name, 
             COALESCE(c.email, q.manual_client_email) as client_email, 
             COALESCE(c.physical_address, q.manual_client_address) as physical_address
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
  const { 
    quotation_number, 
    client_id, 
    manual_client_name, 
    manual_client_email, 
    manual_client_phone, 
    manual_client_business, 
    manual_client_address, 
    issue_date, 
    expiry_date, 
    terms_and_conditions, 
    items, 
    created_by 
  } = req.body;
  
  if ((!client_id && !manual_client_name) || !issue_date || !items || items.length === 0) {
    return res.status(400).json({ error: 'Please select or enter a client name, issue date, and at least one item' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += (Number(item.quantity || 1) * Number(item.unit_price || 0));
    }

    const finalQuotationNumber = quotation_number || `QT-${Date.now()}`;
    const cleanCreatedBy = (created_by && created_by !== '') ? created_by : null;
    const cleanClientId = (client_id && client_id !== '' && client_id !== 'manual') ? client_id : null;

    // Create Quotation
    const [quoteResult] = await connection.query(
      `INSERT INTO quotations (
        quotation_number, amount, status, client_id, 
        manual_client_name, manual_client_email, manual_client_phone, manual_client_business, manual_client_address,
        issue_date, expiry_date, terms_and_conditions, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalQuotationNumber, 
        totalAmount, 
        'Draft', 
        cleanClientId, 
        manual_client_name || null,
        manual_client_email || null,
        manual_client_phone || null,
        manual_client_business || null,
        manual_client_address || null,
        issue_date, 
        expiry_date || null, 
        terms_and_conditions || '', 
        cleanCreatedBy
      ]
    );
    const quoteId = quoteResult.insertId;

    // Create Quotation Items
    for (const item of items) {
      const itemTotal = Number(item.quantity || 1) * Number(item.unit_price || 0);
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

// Update full quotation with line items
router.put('/:id', async (req, res) => {
  const { 
    quotation_number, 
    client_id, 
    manual_client_name, 
    manual_client_email, 
    manual_client_phone, 
    manual_client_business, 
    manual_client_address, 
    issue_date, 
    expiry_date, 
    terms_and_conditions, 
    items 
  } = req.body;

  if ((!client_id && !manual_client_name) || !issue_date || !items || items.length === 0) {
    return res.status(400).json({ error: 'Please select or enter a client name, issue date, and at least one item' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += (Number(item.quantity || 1) * Number(item.unit_price || 0));
    }

    const cleanClientId = (client_id && client_id !== '' && client_id !== 'manual') ? client_id : null;

    await connection.query(
      `UPDATE quotations SET 
        quotation_number = COALESCE(?, quotation_number),
        amount = ?,
        client_id = ?,
        manual_client_name = ?,
        manual_client_email = ?,
        manual_client_phone = ?,
        manual_client_business = ?,
        manual_client_address = ?,
        issue_date = ?,
        expiry_date = ?,
        terms_and_conditions = ?
      WHERE id = ?`,
      [
        quotation_number || null,
        totalAmount,
        cleanClientId,
        manual_client_name || null,
        manual_client_email || null,
        manual_client_phone || null,
        manual_client_business || null,
        manual_client_address || null,
        issue_date,
        expiry_date || null,
        terms_and_conditions || '',
        req.params.id
      ]
    );

    // Replace items
    await connection.query('DELETE FROM quotation_items WHERE quotation_id = ?', [req.params.id]);
    for (const item of items) {
      const itemTotal = Number(item.quantity || 1) * Number(item.unit_price || 0);
      await connection.query(
        'INSERT INTO quotation_items (quotation_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, item.description, item.quantity, item.unit_price, itemTotal]
      );
    }

    await connection.commit();
    res.json({ message: 'Quotation updated successfully' });
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

// Delete quotation
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM quotations WHERE id = ?', [req.params.id]);
    res.json({ message: 'Quotation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
