const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');

// Get all clients (or filtered by creator for non-admins)
router.get('/', async (req, res) => {
  try {
    const { user_id, role } = req.query;
    
    // If role is provided and NOT admin, filter by created_by
    if (user_id && role && role !== 'Admin') {
      const [rows] = await db.query('SELECT * FROM clients WHERE created_by = ? ORDER BY created_at DESC', [user_id]);
      res.json(rows);
    } else {
      // Admins see all clients
      const [rows] = await db.query('SELECT * FROM clients ORDER BY created_at DESC');
      res.json(rows);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new client (combined with User and Invoice creation)
router.post('/', async (req, res) => {
  const { 
    full_name, business_name, whatsapp_number, email, physical_address, profile_image_url,
    password, created_by
  } = req.body;

  if (!full_name || !email || !password) {
    console.error("Missing fields in POST /api/clients:", { full_name, email, password: !!password });
    return res.status(400).json({ error: 'Missing required fields: full_name, email, or password' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Hash password & Create User Account
    const hash = await bcrypt.hash(password, 10);
    const [userResult] = await connection.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [full_name, email, hash, 'Client']
    );
    const userId = userResult.insertId;

    // 2. Create Client Profile linked to User Account
    const [clientResult] = await connection.query(
      'INSERT INTO clients (full_name, business_name, whatsapp_number, email, physical_address, profile_image_url, user_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [full_name, business_name, whatsapp_number, email, physical_address, profile_image_url, userId, created_by || null]
    );
    const clientId = clientResult.insertId;

    // Commit Transaction
    await connection.commit();
    res.status(201).json({ id: clientId, message: 'Client and Account created successfully' });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
       console.error("Duplicate email:", email);
       return res.status(400).json({ error: 'An account with this email already exists. Please use a different email.' });
    }
    console.error("Database error in POST /api/clients:", error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Get comprehensive details for a specific client
router.get('/:id/details', async (req, res) => {
  const clientId = req.params.id;
  try {
    // 1. Fetch Client Profile
    const [clientRows] = await db.query('SELECT * FROM clients WHERE id = ?', [clientId]);
    if (clientRows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const client = clientRows[0];

    // 2. Fetch Active Projects
    const [projects] = await db.query(
      "SELECT id, title, status, locked_deadline FROM projects WHERE client_id = ? AND status != 'Completed'",
      [clientId]
    );

    // 3. Fetch Invoices
    const [invoices] = await db.query(
      'SELECT id, invoice_number, amount, balance, status, due_date FROM invoices WHERE client_id = ? ORDER BY due_date DESC',
      [clientId]
    );

    // 4. Fetch Subscriptions
    const [subscriptions] = await db.query(
      'SELECT id, plan_name, status, start_date, end_date, price FROM subscriptions WHERE client_id = ? ORDER BY start_date DESC',
      [clientId]
    );

    // 5. Fetch Files (Deliverables linked to client's projects)
    const [files] = await db.query(
      `SELECT d.id, d.file_name, d.file_url, d.submitted_at, p.title as project_title 
       FROM deliverables d 
       JOIN projects p ON d.project_id = p.id 
       WHERE p.client_id = ? 
       ORDER BY d.submitted_at DESC`,
      [clientId]
    );

    res.json({
      client,
      projects,
      invoices,
      subscriptions,
      files
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single client
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comprehensive data specifically formatted for the Client Portal
router.get('/:id/portal-data', async (req, res) => {
  const clientId = req.params.id;
  try {
    // 1. Client Profile
    const [clientRows] = await db.query('SELECT * FROM clients WHERE id = ?', [clientId]);
    if (clientRows.length === 0) return res.status(404).json({ error: 'Client not found' });
    const client = clientRows[0];

    // 2. Invoices & Items
    const [invoices] = await db.query('SELECT * FROM invoices WHERE client_id = ? ORDER BY issue_date DESC', [clientId]);
    for (let inv of invoices) {
      const [items] = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [inv.id]);
      inv.items = items;
      const [payments] = await db.query('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC', [inv.id]);
      inv.payments = payments;
    }

    // 3. All Payments flat list
    const [payments] = await db.query(`
      SELECT p.*, i.invoice_number 
      FROM invoice_payments p 
      JOIN invoices i ON p.invoice_id = i.id 
      WHERE i.client_id = ? 
      ORDER BY p.payment_date DESC
    `, [clientId]);

    // 4. Projects & Steps
    const [projects] = await db.query('SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC', [clientId]);
    for (let p of projects) {
      const [steps] = await db.query('SELECT * FROM project_steps WHERE project_id = ? ORDER BY id ASC', [p.id]);
      p.steps = steps;
    }

    // 5. Files (Deliverables)
    const [files] = await db.query(`
      SELECT d.*, p.title as project_title 
      FROM deliverables d 
      JOIN projects p ON d.project_id = p.id 
      WHERE p.client_id = ? 
      ORDER BY d.submitted_at DESC
    `, [clientId]);

    // 6. Text Notes
    const [textNotes] = await db.query(`
      SELECT n.*, u.role as created_by_role, u.name as created_by_name
      FROM notes n
      JOIN users u ON n.created_by = u.id
      WHERE n.client_id = ?
      ORDER BY n.created_at DESC
    `, [clientId]);

    res.json({ client, invoices, payments, projects, files, textNotes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comprehensive data specifically formatted for the Client Portal by User ID
router.get('/user/:userId/portal-data', async (req, res) => {
  const userId = req.params.userId;
  try {
    // First, find the Client ID associated with this User ID
    const [clientLookup] = await db.query('SELECT id FROM clients WHERE user_id = ?', [userId]);
    if (clientLookup.length === 0) {
      return res.status(404).json({ error: 'Client profile not found for this user.' });
    }
    const clientId = clientLookup[0].id;

    // 1. Client Profile
    const [clientRows] = await db.query('SELECT * FROM clients WHERE id = ?', [clientId]);
    const client = clientRows[0];

    // 2. Invoices & Items
    const [invoices] = await db.query('SELECT * FROM invoices WHERE client_id = ? ORDER BY issue_date DESC', [clientId]);
    for (let inv of invoices) {
      const [items] = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [inv.id]);
      inv.items = items;
      const [payments] = await db.query('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC', [inv.id]);
      inv.payments = payments;
    }

    // 3. All Payments flat list
    const [payments] = await db.query(`
      SELECT p.*, i.invoice_number 
      FROM invoice_payments p 
      JOIN invoices i ON p.invoice_id = i.id 
      WHERE i.client_id = ? 
      ORDER BY p.payment_date DESC
    `, [clientId]);

    // 4. Projects & Steps & Revisions
    const [projects] = await db.query('SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC', [clientId]);
    for (let p of projects) {
      const [steps] = await db.query('SELECT * FROM project_steps WHERE project_id = ? ORDER BY id ASC', [p.id]);
      p.steps = steps;
      const [revisions] = await db.query('SELECT * FROM revisions WHERE project_id = ? ORDER BY requested_at DESC', [p.id]);
      p.revisions = revisions;
    }

    // 5. Files (Deliverables)
    const [files] = await db.query(`
      SELECT d.*, p.title as project_title 
      FROM deliverables d 
      JOIN projects p ON d.project_id = p.id 
      WHERE p.client_id = ? 
      ORDER BY d.submitted_at DESC
    `, [clientId]);

    // 6. Text Notes
    const [textNotes] = await db.query(`
      SELECT n.*, u.role as created_by_role, u.name as created_by_name
      FROM notes n
      JOIN users u ON n.created_by = u.id
      WHERE n.client_id = ?
      ORDER BY n.created_at DESC
    `, [clientId]);

    res.json({ client, invoices, payments, projects, files, textNotes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update client
router.put('/:id', async (req, res) => {
  const { full_name, business_name, whatsapp_number, email, physical_address } = req.body;
  try {
    await db.query(
      'UPDATE clients SET full_name = ?, business_name = ?, whatsapp_number = ?, email = ?, physical_address = ? WHERE id = ?',
      [full_name, business_name, whatsapp_number, email, physical_address, req.params.id]
    );
    res.json({ message: 'Client updated successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
       return res.status(400).json({ error: 'An account with this email already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete client
router.delete('/:id', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [clientResult] = await connection.query('SELECT user_id FROM clients WHERE id = ?', [req.params.id]);
    const userId = clientResult.length > 0 ? clientResult[0].user_id : null;

    await connection.query('DELETE FROM clients WHERE id = ?', [req.params.id]);
    
    if (userId) {
      await connection.query('DELETE FROM users WHERE id = ?', [userId]);
    }
    await connection.commit();
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(400).json({ error: 'Cannot delete client with existing projects or invoices.' });
    }
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Create note
router.post('/notes', async (req, res) => {
  const { client_id, content, created_by } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO notes (client_id, content, created_by) VALUES (?, ?, ?)',
      [client_id, content, created_by]
    );
    res.status(201).json({ id: result.insertId, message: 'Note created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update note
router.put('/notes/:id', async (req, res) => {
  const { content } = req.body;
  try {
    await db.query('UPDATE notes SET content = ? WHERE id = ?', [content, req.params.id]);
    res.json({ message: 'Note updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete note
router.delete('/notes/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM notes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
