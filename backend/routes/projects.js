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

async function notifyManagers(projectId, message, type, link) {
  // Get PM for this project
  const [[project]] = await db.query('SELECT pm_id FROM projects WHERE id = ?', [projectId]);
  const pmId = project ? project.pm_id : null;
  
  // Get all Admins and Product Managers
  const [managers] = await db.query("SELECT id FROM users WHERE role IN ('Admin', 'Product Manager')");
  
  const userIds = new Set();
  if (pmId) userIds.add(pmId);
  managers.forEach(m => userIds.add(m.id));
  
  for (const uid of userIds) {
    await db.query(
      'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
      [uid, message, type, link]
    );
  }
}

// Get all projects
router.get('/', async (req, res) => {
  try {
    const { user_id, role } = req.query;

    let query = `
      SELECT DISTINCT projects.*, clients.full_name as client_name,
      assigned_user.name as pm_name,
      (SELECT COUNT(*) FROM project_steps WHERE project_steps.project_id = projects.id) as dyn_total_steps,
      (SELECT COUNT(*) FROM project_steps WHERE project_steps.project_id = projects.id AND project_steps.status = 'Completed') as dyn_completed_steps
      FROM projects 
      LEFT JOIN clients ON projects.client_id = clients.id
      LEFT JOIN users assigned_user ON projects.pm_id = assigned_user.id
      LEFT JOIN invoices i ON clients.id = i.client_id
    `;
    const params = [];

    if (user_id && role && role !== 'Admin') {
      query += ` WHERE (clients.user_id = ? OR clients.created_by = ? OR i.agent_id = ? OR projects.pm_id = ? OR projects.production_id = ? OR projects.id IN (SELECT project_id FROM project_members WHERE user_id = ?) OR projects.id IN (SELECT project_id FROM project_steps WHERE assignee_id = ?))`;
      params.push(user_id, user_id, user_id, user_id, user_id, user_id, user_id);
    }
    
    const [rows] = await db.query(query, params);
    
    // Fetch assigned team members and all project steps for all retrieved projects
    let allMembers = [];
    let allSteps = [];

    if (rows.length > 0) {
      const projectIds = rows.map(r => r.id);
      const [membersRows] = await db.query(`
        SELECT pm.project_id, u.id, u.name, u.email, u.role, u.commission_percentage
        FROM project_members pm 
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id IN (?)
      `, [projectIds]);
      allMembers = membersRows;

      const [stepsRows] = await db.query(`
        SELECT ps.*, u.name as assignee_name 
        FROM project_steps ps 
        LEFT JOIN users u ON ps.assignee_id = u.id
        WHERE ps.project_id IN (?)
        ORDER BY ps.id ASC
      `, [projectIds]);
      allSteps = stepsRows;
    }

    const processedRows = rows.map(r => {
      const members = allMembers.filter(m => m.project_id === r.id);
      const projectSteps = allSteps.filter(s => s.project_id === r.id);
      const userSteps = user_id ? projectSteps.filter(s => s.assignee_id == user_id) : projectSteps;
      const assignedNames = members.map(m => m.name).join(', ');
      return {
        ...r,
        total_steps: r.dyn_total_steps,
        completed_steps: r.dyn_completed_steps,
        assigned_members: members,
        steps: projectSteps,
        user_assigned_steps: userSteps,
        assigned_name: assignedNames || r.pm_name || 'Unassigned'
      };
    });
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
      clients.full_name as client_name,
      (SELECT COUNT(*) FROM project_steps WHERE project_steps.project_id = projects.id) as dyn_total_steps,
      (SELECT COUNT(*) FROM project_steps WHERE project_steps.project_id = projects.id AND project_steps.status = 'Completed') as dyn_completed_steps
      FROM projects 
      LEFT JOIN clients ON projects.client_id = clients.id
      WHERE projects.id = ?
    `, [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    project.total_steps = project.dyn_total_steps;
    project.completed_steps = project.dyn_completed_steps;
    
    const [assigned_members] = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.commission_percentage
      FROM project_members pm 
      JOIN users u ON pm.user_id = u.id 
      WHERE pm.project_id = ?
    `, [req.params.id]);

    const [deliverables] = await db.query('SELECT * FROM deliverables WHERE project_id = ? ORDER BY submitted_at DESC', [req.params.id]);
    const [revisions] = await db.query('SELECT * FROM revisions WHERE project_id = ? ORDER BY requested_at DESC', [req.params.id]);
    const [[invoice]] = await db.query('SELECT * FROM invoices WHERE project_id = ? LIMIT 1', [req.params.id]);
    
    if (invoice) {
      const [invoiceItems] = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoice.id]);
      invoice.items = invoiceItems;
    }
    const { user_id, role } = req.query;

    let stepsQuery = `
      SELECT ps.*, u.name as assignee_name 
      FROM project_steps ps 
      LEFT JOIN users u ON ps.assignee_id = u.id 
      WHERE ps.project_id = ? 
    `;
    const stepsParams = [req.params.id];

    // Restrict visibility: If not Admin, not Client, and not PM, only see your own steps or unassigned steps
    if (user_id && role && role !== 'Admin' && role !== 'Client' && project.pm_id != user_id) {
      stepsQuery += ` AND (ps.assignee_id = ? OR ps.assignee_id IS NULL)`;
      stepsParams.push(user_id);
    }
    
    stepsQuery += ` ORDER BY ps.id ASC`;
    const [steps] = await db.query(stepsQuery, stepsParams);
    
    res.json({ ...project, assigned_members: assigned_members || [], deliverables, revisions, invoice, steps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a project
router.post('/', async (req, res) => {
  const { title, description, client_id, pm_id, team_member_ids, revision_cycles_included, service_type, total_steps, completed_steps, terms_and_conditions, invoice_id } = req.body;
  try {
    let memberIds = Array.isArray(team_member_ids) ? team_member_ids : [];
    if (typeof team_member_ids === 'string') {
      try { memberIds = JSON.parse(team_member_ids); } catch(e) { memberIds = []; }
    }

    const primaryPmId = pm_id || (memberIds.length > 0 ? memberIds[0] : null);
    
    let st = service_type;
    if (Array.isArray(st)) st = JSON.stringify(st);

    const [result] = await db.query(
      'INSERT INTO projects (title, description, client_id, pm_id, revision_cycles_included, revision_cycles_remaining, service_type, total_steps, completed_steps, terms_and_conditions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description, client_id, primaryPmId, revision_cycles_included || 0, revision_cycles_included || 0, st, total_steps || 0, completed_steps || 0, terms_and_conditions || '']
    );
    const newProjectId = result.insertId;

    // Insert assigned team members
    if (memberIds.length > 0) {
      const memberValues = memberIds.map(userId => [newProjectId, userId]);
      await db.query('INSERT IGNORE INTO project_members (project_id, user_id) VALUES ?', [memberValues]);
    } else if (pm_id) {
      await db.query('INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)', [newProjectId, pm_id]);
    }

    if (invoice_id) {
      await db.query('UPDATE invoices SET project_id = ? WHERE id = ?', [newProjectId, invoice_id]);
    }

    // Add notifications for assigned members
    const projectLink = `/projects/${newProjectId}`;
    if (memberIds.length > 0) {
      for (const uid of memberIds) {
        await db.query(
          'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
          [uid, `You have been assigned to a new project: ${title}`, 'project_assigned', projectLink]
        );
      }
    } else if (primaryPmId) {
      await db.query(
        'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
        [primaryPmId, `You have been assigned as PM to a new project: ${title}`, 'project_assigned', projectLink]
      );
    }

    res.json({ id: newProjectId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a project
router.put('/:id', async (req, res) => {
  const projectId = req.params.id;
  const { title, description, client_id, pm_id, team_member_ids, service_type, revision_cycles_included, terms_and_conditions } = req.body;
  try {
    let memberIds = Array.isArray(team_member_ids) ? team_member_ids : null;
    if (typeof team_member_ids === 'string') {
      try { memberIds = JSON.parse(team_member_ids); } catch(e) { memberIds = null; }
    }

    const primaryPmId = pm_id || (memberIds && memberIds.length > 0 ? memberIds[0] : null);

    let st = service_type;
    if (Array.isArray(st)) st = JSON.stringify(st);

    await db.query(
      'UPDATE projects SET title = ?, description = ?, client_id = ?, pm_id = ?, service_type = ?, revision_cycles_included = ?, terms_and_conditions = ? WHERE id = ?',
      [title, description, client_id, primaryPmId, st, revision_cycles_included || 0, terms_and_conditions || '', projectId]
    );

    if (memberIds !== null) {
      await db.query('DELETE FROM project_members WHERE project_id = ?', [projectId]);
      if (memberIds.length > 0) {
        const memberValues = memberIds.map(userId => [projectId, userId]);
        await db.query('INSERT IGNORE INTO project_members (project_id, user_id) VALUES ?', [memberValues]);
      }
    } else if (pm_id) {
      await db.query('DELETE FROM project_members WHERE project_id = ?', [projectId]);
      await db.query('INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)', [projectId, pm_id]);
    }

    res.json({ message: 'Project updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a project step
router.delete('/:id/steps/:step_id', async (req, res) => {
  const { id, step_id } = req.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[step]] = await connection.query('SELECT * FROM project_steps WHERE id = ? AND project_id = ?', [step_id, id]);
    if (!step) {
      throw new Error('Step not found or does not belong to this project');
    }

    // Delete related data first
    await connection.query('DELETE FROM step_comments WHERE step_id = ?', [step_id]);
    await connection.query('DELETE FROM step_activity WHERE step_id = ?', [step_id]);
    
    // Delete the step
    await connection.query('DELETE FROM project_steps WHERE id = ?', [step_id]);

    await connection.commit();
    res.json({ message: 'Step deleted successfully' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Delete a project
router.delete('/:id', async (req, res) => {
  const projectId = req.params.id;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Delete related data
    await connection.query('DELETE FROM step_comments WHERE step_id IN (SELECT id FROM project_steps WHERE project_id = ?)', [projectId]);
    await connection.query('DELETE FROM step_activity WHERE step_id IN (SELECT id FROM project_steps WHERE project_id = ?)', [projectId]);
    await connection.query('DELETE FROM project_steps WHERE project_id = ?', [projectId]);
    await connection.query('DELETE FROM deliverables WHERE project_id = ?', [projectId]);
    await connection.query('DELETE FROM revisions WHERE project_id = ?', [projectId]);
    
    // Unlink invoices
    await connection.query('UPDATE invoices SET project_id = NULL WHERE project_id = ?', [projectId]);

    // Delete the project
    const [result] = await connection.query('DELETE FROM projects WHERE id = ?', [projectId]);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Project not found' });
    }

    await connection.commit();
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Add a workflow step
router.post('/:id/steps', upload.array('attachments', 5), async (req, res) => {
  const { title, description, assignee_id, deadline, requires_client_form, client_form_schema, requires_payment, allow_revision, invoice_item_ids } = req.body;
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

    let parsed_invoice_items = null;
    if (invoice_item_ids) {
      parsed_invoice_items = typeof invoice_item_ids === 'string' ? invoice_item_ids : JSON.stringify(invoice_item_ids);
    }

    const [result] = await db.query(
      'INSERT INTO project_steps (project_id, title, description, assignee_id, deadline, requires_client_form, client_form_schema, requires_payment, allow_revision, attachments, invoice_item_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        attachments,
        parsed_invoice_items
      ]
    );

    // Notify assignee
    if (assignee_id) {
      await db.query(
        'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
        [assignee_id, `You have been assigned a new step: ${title}`, 'step_assigned', `/projects/${req.params.id}`]
      );
    }

    res.json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload documents to a workflow step
router.post('/:id/steps/:step_id/documents', upload.array('documents', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const newPaths = req.files.map(file => `/uploads/${file.filename}`);

    const [[step]] = await db.query('SELECT attachments FROM project_steps WHERE id = ? AND project_id = ?', [req.params.step_id, req.params.id]);
    if (!step) return res.status(404).json({ error: 'Step not found.' });

    let existingFiles = [];
    if (step.attachments) {
      try { existingFiles = JSON.parse(step.attachments); } catch(e) { existingFiles = [step.attachments]; }
    }

    const updatedFiles = [...existingFiles, ...newPaths];
    await db.query('UPDATE project_steps SET attachments = ? WHERE id = ? AND project_id = ?', [JSON.stringify(updatedFiles), req.params.step_id, req.params.id]);

    // Log to step activity
    await db.query('INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
      [req.params.step_id, null, `Uploaded ${req.files.length} document(s)`]
    );

    res.json({ message: 'Documents uploaded', attachments: updatedFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update workflow step status or allow_revision
router.put('/:id/steps/:step_id', async (req, res) => {
  const { status, allow_revision } = req.body;
  try {
    if (status !== undefined && allow_revision !== undefined) {
      if (status === 'Completed') {
        await db.query('UPDATE project_steps SET status = ?, allow_revision = ?, completed_at = NOW() WHERE id = ? AND project_id = ?', [status, allow_revision, req.params.step_id, req.params.id]);
        
        // Notify managers that step is completed
        const [[step]] = await db.query('SELECT title FROM project_steps WHERE id = ?', [req.params.step_id]);
        if (step) {
          await notifyManagers(req.params.id, `Project step "${step.title}" has been completed.`, 'step_completed', `/projects/${req.params.id}`);
        }
      } else {
        await db.query('UPDATE project_steps SET status = ?, allow_revision = ? WHERE id = ? AND project_id = ?', [status, allow_revision, req.params.step_id, req.params.id]);
      }
      await db.query('INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
        [req.params.step_id, null, `Updated status to "${status}" and revision option to ${allow_revision ? 'Enabled' : 'Disabled'}`]
      );
    } else if (status !== undefined) {
      if (status === 'Completed') {
        await db.query('UPDATE project_steps SET status = ?, completed_at = NOW() WHERE id = ? AND project_id = ?', [status, req.params.step_id, req.params.id]);
        
        // Notify managers that step is completed
        const [[step]] = await db.query('SELECT title FROM project_steps WHERE id = ?', [req.params.step_id]);
        if (step) {
          await notifyManagers(req.params.id, `Project step "${step.title}" has been completed.`, 'step_completed', `/projects/${req.params.id}`);
        }
      } else {
        await db.query('UPDATE project_steps SET status = ? WHERE id = ? AND project_id = ?', [status, req.params.step_id, req.params.id]);
      }
      await db.query('INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
        [req.params.step_id, null, `Changed status to "${status}"`]
      );
    } else if (allow_revision !== undefined) {
      await db.query('UPDATE project_steps SET allow_revision = ? WHERE id = ? AND project_id = ?', [allow_revision, req.params.step_id, req.params.id]);
      await db.query('INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
        [req.params.step_id, null, `${allow_revision ? 'Enabled' : 'Disabled'} revision requests`]
      );
    }
    res.json({ message: 'Step updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Full update of a project step
router.put('/:id/steps/:step_id/full', upload.array('attachments', 5), async (req, res) => {
  const { title, description, assignee_id, deadline, requires_client_form, client_form_schema, requires_payment, allow_revision, invoice_item_ids } = req.body;
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

    let parsed_invoice_items = null;
    if (invoice_item_ids) {
      parsed_invoice_items = typeof invoice_item_ids === 'string' ? invoice_item_ids : JSON.stringify(invoice_item_ids);
    }

    let updateQuery = `
      UPDATE project_steps SET 
      title = ?, description = ?, assignee_id = ?, deadline = ?, requires_client_form = ?, 
      client_form_schema = ?, requires_payment = ?, allow_revision = ?, invoice_item_ids = ?
    `;
    let params = [
      title, description || '', assignee_id || null, deadline || null, req_client_form, 
      parsed_schema, req_payment, allow_rev, parsed_invoice_items
    ];

    if (attachments) {
      updateQuery += `, attachments = ?`;
      params.push(attachments);
    }
    updateQuery += ` WHERE id = ? AND project_id = ?`;
    params.push(req.params.step_id, req.params.id);

    await db.query(updateQuery, params);

    res.json({ message: 'Step updated fully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept step deadline
router.post('/:id/steps/:step_id/accept-deadline', async (req, res) => {
  const { user_id } = req.body;
  try {
    await db.query(
      'UPDATE project_steps SET deadline_status = "Accepted" WHERE id = ? AND project_id = ?',
      [req.params.step_id, req.params.id]
    );
    await db.query('INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
      [req.params.step_id, user_id || null, 'Accepted the step deadline']
    );
    res.json({ message: 'Deadline accepted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Appeal step deadline
router.post('/:id/steps/:step_id/appeal-deadline', async (req, res) => {
  const { proposed_deadline, reason, user_id } = req.body;
  try {
    await db.query(
      'UPDATE project_steps SET deadline_status = "Appealed", proposed_deadline = ?, deadline_appeal_reason = ?, appealed_by = ?, appealed_at = NOW() WHERE id = ? AND project_id = ?',
      [proposed_deadline, reason || '', user_id || null, req.params.step_id, req.params.id]
    );
    await db.query('INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
      [req.params.step_id, user_id || null, `Submitted a deadline extension appeal for ${proposed_deadline}`]
    );

    // Notify PM, Admins, and Product Managers
    const [[step]] = await db.query('SELECT title FROM project_steps WHERE id = ?', [req.params.step_id]);
    const stepTitle = step ? step.title : 'A step';
    await notifyManagers(req.params.id, `A deadline extension has been appealed for step "${stepTitle}".`, 'appeal_requested', `/deadlines`);

    res.json({ message: 'Deadline appeal submitted to Admin for approval' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin overrides/forgives a late step so it counts for commission
router.post('/:id/steps/:step_id/forgive-late', async (req, res) => {
  const { forgive } = req.body; // true or false
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      'UPDATE project_steps SET forgive_late_commission = ? WHERE id = ? AND project_id = ?',
      [forgive, req.params.step_id, req.params.id]
    );

    if (forgive) {
      await connection.query('DELETE FROM salary_penalties WHERE step_id = ?', [req.params.step_id]);

      const [[project]] = await connection.query('SELECT status FROM projects WHERE id = ?', [req.params.id]);
      if (project && project.status === 'Commission Released') {
        const [[step]] = await connection.query('SELECT assignee_id, invoice_item_ids FROM project_steps WHERE id = ?', [req.params.step_id]);
        if (step && step.assignee_id && step.invoice_item_ids) {
          let itemIds = [];
          try { itemIds = typeof step.invoice_item_ids === 'string' ? JSON.parse(step.invoice_item_ids) : step.invoice_item_ids; } catch(e){}
          
          if (Array.isArray(itemIds) && itemIds.length > 0) {
            const [items] = await connection.query('SELECT SUM(total) as items_total FROM invoice_items WHERE id IN (?)', [itemIds]);
            const items_total = items[0].items_total || 0;
            
            if (items_total > 0) {
              const [[user]] = await connection.query('SELECT commission_percentage FROM users WHERE id = ?', [step.assignee_id]);
              const comm_pct = parseFloat(user.commission_percentage) || 0;
              const base_amount = items_total * (comm_pct / 100);
              
              if (base_amount > 0) {
                await connection.query(
                  'INSERT INTO commissions (project_id, user_id, base_amount, deductions, final_amount, status, released_at, step_id) VALUES (?, ?, ?, ?, ?, "Released", NOW(), ?)', 
                  [req.params.id, step.assignee_id, base_amount, 0, base_amount, step.id]
                );
              }
            }
          }
        }
      }
    }

    await connection.commit();
    res.json({ message: forgive ? 'Late delivery forgiven. Commission processed.' : 'Late delivery penalty reinstated.' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
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

// Mark Project Complete
router.post('/:id/approve', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('UPDATE projects SET status = "Completed" WHERE id = ?', [req.params.id]);
    await connection.commit();
    res.json({ message: 'Project marked as completed' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Reassign a completed step with a new deadline
router.post('/:id/steps/:step_id/reassign', async (req, res) => {
  const { new_deadline } = req.body;
  if (!new_deadline) {
    return res.status(400).json({ error: 'New deadline is required for reassignment.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[step]] = await connection.query('SELECT * FROM project_steps WHERE id = ? AND project_id = ?', [req.params.step_id, req.params.id]);
    if (!step) throw new Error('Step not found');
    if (step.commission_released) throw new Error('Cannot reassign a step whose commission is already released.');

    // Reset step to In Progress, update deadline, reset acceptance
    await connection.query(
      `UPDATE project_steps 
       SET status = 'Pending', 
           deadline = ?, 
           deadline_status = 'Pending Acceptance', 
           completed_at = NULL,
           proposed_deadline = NULL,
           deadline_appeal_reason = NULL,
           appealed_by = NULL,
           appealed_at = NULL
       WHERE id = ?`,
      [new_deadline, step.id]
    );

    // Insert activity log
    await connection.query(
      `INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, NULL, 'Step reassigned with a new deadline by Project Manager.')`,
      [step.id]
    );

    await connection.commit();
    res.json({ message: 'Step reassigned successfully.' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Approve & Release Commission for a specific Step
router.post('/:id/steps/:step_id/approve-commission', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[step]] = await connection.query('SELECT * FROM project_steps WHERE id = ? AND project_id = ?', [req.params.step_id, req.params.id]);
    if (!step) throw new Error('Step not found');
    if (step.status !== 'Completed') throw new Error('Step must be Completed before releasing commission');
    if (step.commission_released) throw new Error('Commission already released for this step');
    if (!step.assignee_id) throw new Error('No assignee for this step to receive commission');

    // Commission Logic
    const [[late_setting]] = await connection.query('SELECT setting_value FROM settings WHERE setting_key = "late_delivery_deduction_pct"');
    const late_deduction_pct = parseFloat(late_setting.setting_value) || 0;
    
    let step_is_late = false;
    if (step.deadline && step.completed_at) {
      const d_deadline = new Date(step.deadline);
      const d_completed = new Date(step.completed_at);
      d_deadline.setHours(23, 59, 59, 999);
      if (d_completed > d_deadline) {
        step_is_late = true;
      }
    }

    let items_total = 0;
    if (step.invoice_item_ids) {
      let itemIds = [];
      try { itemIds = typeof step.invoice_item_ids === 'string' ? JSON.parse(step.invoice_item_ids) : step.invoice_item_ids; } catch(e) {}
      if (!Array.isArray(itemIds) && itemIds !== null && itemIds !== undefined) itemIds = [itemIds];
      
      if (Array.isArray(itemIds) && itemIds.length > 0) {
        const [items] = await connection.query('SELECT SUM(total) as items_total FROM invoice_items WHERE id IN (?)', [itemIds]);
        items_total = items[0].items_total || 0;
      }
    }

    let base_amount = 0;
    let deductions = 0;
    let final_amount = 0;

    if (items_total > 0) {
      const [[user]] = await connection.query('SELECT commission_percentage FROM users WHERE id = ?', [step.assignee_id]);
      const comm_pct = parseFloat(user?.commission_percentage) || 0;
      base_amount = items_total * (comm_pct / 100);
      final_amount = base_amount - deductions;
    }

    if (step_is_late && !step.forgive_late_commission) {
      // Step was late and not forgiven. Commission forfeited.
      // Insert penalty into salary_penalties
      if (base_amount > 0) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        await connection.query(
          'INSERT INTO salary_penalties (user_id, step_id, month, amount, reason) VALUES (?, ?, ?, ?, ?)',
          [step.assignee_id, step.id, currentMonth, base_amount, 'Late delivery penalty']
        );
      }

      // We still insert a record into commissions so it shows up in their breakdown as 0
      await connection.query(
        'INSERT INTO commissions (project_id, user_id, base_amount, deductions, final_amount, status, released_at, step_id) VALUES (?, ?, ?, ?, ?, "Released", NOW(), ?)', 
        [req.params.id, step.assignee_id, base_amount, base_amount, 0, step.id]
      );

      // Update step to commission released but 0 payout.
      await connection.query('UPDATE project_steps SET commission_released = TRUE WHERE id = ?', [step.id]);
      await connection.commit();
      return res.json({ message: 'Step was late and not forgiven. 0 commission released, penalty applied.' });
    }
    
    // Always insert a record so the task is counted as "Completed Tasks" on the dashboard
    await connection.query('INSERT INTO commissions (project_id, user_id, base_amount, deductions, final_amount, status, released_at, step_id) VALUES (?, ?, ?, ?, ?, "Released", NOW(), ?)', 
      [req.params.id, step.assignee_id, base_amount, deductions, final_amount, step.id]
    );

    await connection.query('UPDATE project_steps SET commission_released = TRUE WHERE id = ?', [step.id]);
    await connection.commit();
    res.json({ message: 'Step commission released' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Step Comments Endpoints
router.get('/steps/:step_id/comments', async (req, res) => {
  try {
    const [comments] = await db.query(`
      SELECT sc.*, u.name as user_name, u.role as user_role 
      FROM step_comments sc 
      JOIN users u ON sc.user_id = u.id 
      WHERE sc.step_id = ? 
      ORDER BY sc.created_at ASC
    `, [req.params.step_id]);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/steps/:step_id/comments', async (req, res) => {
  const { user_id, message } = req.body;
  if (!user_id || !message || !message.trim()) {
    return res.status(400).json({ error: 'User ID and message are required.' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO step_comments (step_id, user_id, message) VALUES (?, ?, ?)',
      [req.params.step_id, user_id, message.trim()]
    );
    const [[newComment]] = await db.query(`
      SELECT sc.*, u.name as user_name, u.role as user_role 
      FROM step_comments sc 
      JOIN users u ON sc.user_id = u.id 
      WHERE sc.id = ?
    `, [result.insertId]);

    // Also log to activity
    await db.query('INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
      [req.params.step_id, user_id, `Posted a comment: "${message.trim().substring(0, 50)}${message.trim().length > 50 ? '...' : ''}"`]
    );

    res.json(newComment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Step Activity Endpoints
router.get('/steps/:step_id/activity', async (req, res) => {
  try {
    const [activities] = await db.query(`
      SELECT sa.*, u.name as user_name, u.role as user_role 
      FROM step_activity sa 
      LEFT JOIN users u ON sa.user_id = u.id 
      WHERE sa.step_id = ? 
      ORDER BY sa.created_at DESC
    `, [req.params.step_id]);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/steps/:step_id/activity', async (req, res) => {
  const { user_id, action_text } = req.body;
  if (!action_text) {
    return res.status(400).json({ error: 'Action text is required.' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
      [req.params.step_id, user_id || null, action_text]
    );
    const [[newAct]] = await db.query(`
      SELECT sa.*, u.name as user_name, u.role as user_role 
      FROM step_activity sa 
      LEFT JOIN users u ON sa.user_id = u.id 
      WHERE sa.id = ?
    `, [result.insertId]);
    res.json(newAct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

