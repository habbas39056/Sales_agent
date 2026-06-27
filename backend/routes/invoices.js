const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all invoices with linked client and project info (filtered for non-admins)
router.get('/', async (req, res) => {
  try {
    const { user_id, role } = req.query;

    let query = `
      SELECT i.*, 
             c.full_name as client_name, 
             p.title as project_title
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
    `;
    const params = [];

    // Filter for non-admin roles
    if (user_id && role && role !== 'Admin') {
      query += ` WHERE (i.created_by = ? OR i.agent_id = ?)`;
      params.push(user_id, user_id);
    }

    query += ` ORDER BY i.created_at DESC`;
    
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific invoice with line items
router.get('/:id', async (req, res) => {
  try {
    const [invoiceRows] = await db.query(`
      SELECT i.*, 
             c.full_name as client_name, c.business_name, c.email as client_email, c.physical_address,
             p.title as project_title
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (invoiceRows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const invoice = invoiceRows[0];

    const [items] = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoice.id]);
    invoice.items = items;

    const [payments] = await db.query('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC, created_at DESC', [invoice.id]);
    invoice.payments = payments;

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new invoice with line items
router.post('/', async (req, res) => {
  const { invoice_number, client_id, project_id, agent_id, commission_amount, issue_date, due_date, terms_and_conditions, items, discount, bill_from_name, bill_from_address, created_by } = req.body;
  
  if (!client_id || !issue_date || !due_date || !items || items.length === 0) {
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
    const finalDiscount = parseFloat(discount) || 0;
    totalAmount = Math.max(0, totalAmount - finalDiscount);

    const finalInvoiceNumber = invoice_number || `INV-${Date.now()}`;
    
    // Create Invoice
    const [invoiceResult] = await connection.query(
      'INSERT INTO invoices (invoice_number, amount, balance, client_id, project_id, agent_id, commission_amount, issue_date, due_date, terms_and_conditions, bill_from_name, bill_from_address, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [finalInvoiceNumber, totalAmount, totalAmount, client_id, project_id || null, agent_id || null, commission_amount || 0, issue_date, due_date, terms_and_conditions, bill_from_name || 'Adwise Labs', bill_from_address || '', created_by || null]
    );
    const invoiceId = invoiceResult.insertId;

    // Create Invoice Items
    for (const item of items) {
      const itemTotal = item.quantity * item.unit_price;
      await connection.query(
        'INSERT INTO invoice_items (invoice_id, description, details, quantity, unit, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [invoiceId, item.description, item.details || '', item.quantity, item.unit || '', item.unit_price, itemTotal]
      );
    }

    await connection.commit();
    res.status(201).json({ id: invoiceId, message: 'Invoice created successfully' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Add Revision Charge Hook
router.post('/:id/add-revision-charge', async (req, res) => {
  const invoiceId = req.params.id;
  const { revision_title, amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const description = `Paid Revision: ${revision_title || 'Additional work'}`;

    // Add item
    await connection.query(
      'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)',
      [invoiceId, description, 1, amount, amount]
    );

    // Update invoice total and balance
    await connection.query(
      'UPDATE invoices SET amount = amount + ?, balance = balance + ? WHERE id = ?',
      [amount, amount, invoiceId]
    );

    await connection.commit();
    res.json({ message: 'Revision charge added to invoice' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Record a Payment
router.post('/:id/payments', async (req, res) => {
  const invoiceId = req.params.id;
  const { amount, payment_date, payment_method, transaction_id, notes, bank } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Insert payment record
    await connection.query(
      'INSERT INTO invoice_payments (invoice_id, amount, payment_date, payment_method, bank, transaction_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [invoiceId, amount, payment_date, payment_method, bank || null, transaction_id || null, notes]
    );

    // Fetch current balance
    const [[invoice]] = await connection.query('SELECT balance FROM invoices WHERE id = ? FOR UPDATE', [invoiceId]);
    if (!invoice) throw new Error('Invoice not found');

    const newBalance = Math.max(0, invoice.balance - amount);
    let newStatus = 'Unpaid';
    if (newBalance <= 0) {
      newStatus = 'Paid';
    }

    // Update invoice balance and status
    await connection.query(
      'UPDATE invoices SET balance = ?, status = ? WHERE id = ?',
      [newBalance, newStatus, invoiceId]
    );

    // Auto-sync with Expense module
    const [[invoiceDetails]] = await connection.query(`
      SELECT i.invoice_number, c.full_name 
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.id = ?
    `, [invoiceId]);

    const expenseDescription = `Payment for Invoice #${invoiceDetails.invoice_number}${notes ? ' - ' + notes : ''}`;

    await connection.query(`
      INSERT INTO expenses (date, client, description, mode, bank, reference, receipt_amount, payment_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      payment_date, 
      invoiceDetails.full_name || '', 
      expenseDescription, 
      payment_method || 'Cash', 
      bank || '', 
      transaction_id || '', 
      amount, 
      0
    ]);

    await connection.commit();
    res.json({ message: 'Payment recorded successfully', newBalance, newStatus });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Update an existing invoice
router.put('/:id', async (req, res) => {
  const invoiceId = req.params.id;
  const { client_id, project_id, agent_id, commission_amount, issue_date, due_date, terms_and_conditions, items, discount, bill_from_name, bill_from_address } = req.body;
  
  if (!client_id || !issue_date || !due_date || !items || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields or items' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += (item.quantity * item.unit_price);
    }
    const finalDiscount = parseFloat(discount) || 0;
    totalAmount = Math.max(0, totalAmount - finalDiscount);

    const [[invoice]] = await connection.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) throw new Error('Invoice not found');

    const [[paymentsSum]] = await connection.query('SELECT SUM(amount) as total_paid FROM invoice_payments WHERE invoice_id = ?', [invoiceId]);
    const paid = paymentsSum.total_paid || 0;
    
    let newBalance = totalAmount - paid;
    let status = invoice.status;
    if (newBalance <= 0) {
      newBalance = 0;
      status = 'Paid';
    } else if (new Date(due_date) < new Date()) {
      status = 'Overdue';
    } else {
      status = 'Unpaid';
    }

    await connection.query(
      'UPDATE invoices SET amount = ?, balance = ?, client_id = ?, project_id = ?, agent_id = ?, commission_amount = ?, issue_date = ?, due_date = ?, terms_and_conditions = ?, bill_from_name = ?, bill_from_address = ?, status = ? WHERE id = ?',
      [totalAmount, newBalance, client_id, project_id || null, agent_id || null, commission_amount || 0, issue_date, due_date, terms_and_conditions, bill_from_name || 'Adwise Labs', bill_from_address || '', status, invoiceId]
    );

    await connection.query('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

    for (const item of items) {
      const itemTotal = item.quantity * item.unit_price;
      await connection.query(
        'INSERT INTO invoice_items (invoice_id, description, details, quantity, unit, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [invoiceId, item.description, item.details || '', item.quantity, item.unit || '', item.unit_price, itemTotal]
      );
    }

    await connection.commit();
    res.json({ message: 'Invoice updated successfully' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Delete an invoice
router.delete('/:id', async (req, res) => {
  const invoiceId = req.params.id;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Delete related items and payments
    await connection.query('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
    await connection.query('DELETE FROM invoice_payments WHERE invoice_id = ?', [invoiceId]);
    
    // Delete the invoice itself
    const [result] = await connection.query('DELETE FROM invoices WHERE id = ?', [invoiceId]);
    
    if (result.affectedRows === 0) {
      throw new Error('Invoice not found');
    }

    await connection.commit();
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    await connection.rollback();
    if (error.message === 'Invoice not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  } finally {
    connection.release();
  }
});

module.exports = router;
