const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Get all projects
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT projects.*, clients.full_name as client_name,
      (SELECT COUNT(*) FROM project_steps WHERE project_steps.project_id = projects.id) as dyn_total_steps,
      (SELECT COUNT(*) FROM project_steps WHERE project_steps.project_id = projects.id AND project_steps.status = 'Completed') as dyn_completed_steps
      FROM projects 
      LEFT JOIN clients ON projects.client_id = clients.id
    `);
    const processedRows = rows.map(r => ({
      ...r,
      total_steps: r.dyn_total_steps,
      completed_steps: r.dyn_completed_steps
    }));
    res.json(processedRows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single project
router.get('/:id', async (req, res) => {
  try {
    const [[project]] = await db.query(`
      SELECT projects.*, 
      (SELECT COUNT(*) FROM project_steps WHERE project_steps.project_id = projects.id) as dyn_total_steps,
      (SELECT COUNT(*) FROM project_steps WHERE project_steps.project_id = projects.id AND project_steps.status = 'Completed') as dyn_completed_steps
      FROM projects WHERE id = ?
    `, [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    project.total_steps = project.dyn_total_steps;
    project.completed_steps = project.dyn_completed_steps;
    
    const [deliverables] = await db.query('SELECT * FROM deliverables WHERE project_id = ? ORDER BY submitted_at DESC', [req.params.id]);
    const [revisions] = await db.query('SELECT * FROM revisions WHERE project_id = ? ORDER BY requested_at DESC', [req.params.id]);
    const [[invoice]] = await db.query('SELECT * FROM invoices WHERE project_id = ? LIMIT 1', [req.params.id]);
    const [steps] = await db.query(`
      SELECT ps.*, u.name as assignee_name 
      FROM project_steps ps 
      LEFT JOIN users u ON ps.assignee_id = u.id 
      WHERE ps.project_id = ? 
      ORDER BY ps.id ASC
    `, [req.params.id]);
    
    res.json({ ...project, deliverables, revisions, invoice, steps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a project
router.post('/', async (req, res) => {
  const { title, description, client_id, pm_id, revision_cycles_included, service_type, total_steps, completed_steps, terms_and_conditions, invoice_id } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO projects (title, description, client_id, pm_id, revision_cycles_included, revision_cycles_remaining, service_type, total_steps, completed_steps, terms_and_conditions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description, client_id, pm_id, revision_cycles_included || 0, revision_cycles_included || 0, service_type, total_steps || 0, completed_steps || 0, terms_and_conditions || '']
    );
    const newProjectId = result.insertId;

    if (invoice_id) {
      await db.query('UPDATE invoices SET project_id = ? WHERE id = ?', [newProjectId, invoice_id]);
    }

    res.json({ id: newProjectId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a workflow step
router.post('/:id/steps', upload.array('attachments', 5), async (req, res) => {
  const { title, description, assignee_id, deadline, requires_client_form, client_form_schema, requires_payment, allow_revision } = req.body;
  try {
    let attachmentPaths = [];
    if (req.files && req.files.length > 0) {
      attachmentPaths = req.files.map(file => `/uploads/${file.filename}`);
    }
    const attachments = attachmentPaths.length > 0 ? JSON.stringify(attachmentPaths) : null;

    const req_client_form = requires_client_form === 'true' || requires_client_form === true ? 1 : 0;
    const req_payment = requires_payment === 'true' || requires_payment === true ? 1 : 0;
    const allow_rev = allow_revision === 'true' || allow_revision === true ? 1 : 0;

    let parsed_schema = null;
    if (client_form_schema) {
      parsed_schema = typeof client_form_schema === 'string' ? client_form_schema : JSON.stringify(client_form_schema);
    }

    const [result] = await db.query(
      'INSERT INTO project_steps (project_id, title, description, assignee_id, deadline, requires_client_form, client_form_schema, requires_payment, allow_revision, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        req.params.id, 
        title, 
        description || '',
        assignee_id || null,
        deadline || null,
        req_client_form,
        parsed_schema,
        req_payment,
        allow_rev,
        attachments
      ]
    );
    res.json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update workflow step status or allow_revision
router.put('/:id/steps/:step_id', async (req, res) => {
  const { status, allow_revision } = req.body;
  try {
    if (status !== undefined && allow_revision !== undefined) {
      await db.query('UPDATE project_steps SET status = ?, allow_revision = ? WHERE id = ? AND project_id = ?', [status, allow_revision, req.params.step_id, req.params.id]);
    } else if (status !== undefined) {
      await db.query('UPDATE project_steps SET status = ? WHERE id = ? AND project_id = ?', [status, req.params.step_id, req.params.id]);
    } else if (allow_revision !== undefined) {
      await db.query('UPDATE project_steps SET allow_revision = ? WHERE id = ? AND project_id = ?', [allow_revision, req.params.step_id, req.params.id]);
    }
    res.json({ message: 'Step updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Client accepts terms
router.post('/:id/accept-terms', async (req, res) => {
  try {
    await db.query('UPDATE projects SET terms_accepted = TRUE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Terms accepted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set/Lock deadline
router.post('/:id/lock-deadline', async (req, res) => {
  const { deadline } = req.body;
  try {
    await db.query('UPDATE projects SET locked_deadline = ?, status = "Deadline Confirmed" WHERE id = ?', [deadline, req.params.id]);
    res.json({ message: 'Deadline locked' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit delivery
router.post('/:id/submit-delivery', async (req, res) => {
  const { user_id, file_url, file_name } = req.body;
  try {
    await db.query('INSERT INTO deliverables (project_id, file_url, file_name, submitted_by) VALUES (?, ?, ?, ?)', [req.params.id, file_url, file_name, user_id]);
    await db.query('UPDATE projects SET status = "Submitted for Review" WHERE id = ?', [req.params.id]);
    // TODO: WhatsApp Notification
    res.json({ message: 'Delivery submitted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Removed multer config as it was moved to the top

// Request Revision
router.post('/:id/request-revision', upload.array('images', 5), async (req, res) => {
  const { title, description, step_id, image_url: legacy_url } = req.body;
  
  // Create an array of uploaded image paths
  let imagePaths = [];
  if (req.files && req.files.length > 0) {
    imagePaths = req.files.map(file => `/uploads/${file.filename}`);
  }
  
  // Use uploaded files if present, else fall back to legacy image_url string
  const image_url = imagePaths.length > 0 ? JSON.stringify(imagePaths) : legacy_url;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[project]] = await connection.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    
    let is_paid = false;
    let cost = 0;
    
    if (project.revision_cycles_remaining > 0) {
      await connection.query('UPDATE projects SET revision_cycles_remaining = revision_cycles_remaining - 1, status = "Revision Requested" WHERE id = ?', [req.params.id]);
    } else {
      is_paid = true;
      const [[setting]] = await connection.query('SELECT setting_value FROM settings WHERE setting_key = "paid_revision_cost"');
      cost = parseFloat(setting.setting_value);
      
      // Add to invoice balance
      const [[invoice]] = await connection.query('SELECT * FROM invoices WHERE project_id = ? LIMIT 1', [req.params.id]);
      if (invoice) {
        await connection.query('UPDATE invoices SET amount = amount + ?, balance = balance + ? WHERE id = ?', [cost, cost, invoice.id]);
        await connection.query('INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES (?, ?, 1, ?, ?)', [invoice.id, 'Paid Revision: ' + title, cost, cost]);
      }
      await connection.query('UPDATE projects SET status = "Revision Requested" WHERE id = ?', [req.params.id]);
    }
    
    await connection.query('INSERT INTO revisions (project_id, title, description, is_paid, cost, step_id, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)', 
      [req.params.id, title, description, is_paid, cost, step_id || null, image_url || null]);
    await connection.commit();
    res.json({ message: 'Revision requested', is_paid, cost, image_url });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Approve Delivery & Release Commission
router.post('/:id/approve', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('UPDATE projects SET status = "Completed" WHERE id = ?', [req.params.id]);
    
    const [[project]] = await connection.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    
    // Commission Logic
    const base_amount = 500; // Mock base commission
    const [[late_setting]] = await connection.query('SELECT setting_value FROM settings WHERE setting_key = "late_delivery_deduction_pct"');
    const late_deduction_pct = parseFloat(late_setting.setting_value);
    
    let deductions = 0;
    // Check deadline
    const [[lastDeliverable]] = await connection.query('SELECT * FROM deliverables WHERE project_id = ? ORDER BY submitted_at DESC LIMIT 1', [req.params.id]);
    
    if (lastDeliverable && project.locked_deadline) {
      const delivered_date = new Date(lastDeliverable.submitted_at);
      const locked_date = new Date(project.locked_deadline);
      if (delivered_date > locked_date) {
        deductions = base_amount * (late_deduction_pct / 100);
      }
    }
    
    const final_amount = base_amount - deductions;
    await connection.query('INSERT INTO commissions (project_id, user_id, base_amount, deductions, final_amount, status, released_at) VALUES (?, ?, ?, ?, ?, "Released", NOW())', 
      [req.params.id, project.production_id || 1, base_amount, deductions, final_amount]
    );
    
    await connection.query('UPDATE projects SET status = "Commission Released" WHERE id = ?', [req.params.id]);
    await connection.commit();
    res.json({ message: 'Approved and commission released', final_amount });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
