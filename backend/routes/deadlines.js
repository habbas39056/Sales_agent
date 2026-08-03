const express = require('express');
const router = express.Router();
const db = require('../db');

// Get pending deadline appeals & step deadlines with role-based scoping
router.get('/appeals', async (req, res) => {
  const { user_id, role } = req.query;
  const isAdminOrPm = role === 'Admin' || role === 'Product Manager' || role === 'PM' || role === 'Project Manager';

  try {
    let query = `
      SELECT 
        ps.id as step_id,
        ps.project_id,
        ps.title as step_title,
        ps.deadline as original_deadline,
        ps.proposed_deadline,
        ps.deadline_appeal_reason as appeal_reason,
        ps.appealed_at,
        COALESCE(ps.deadline_status, 'Pending Acceptance') as deadline_status,
        p.title as project_title,
        c.full_name as client_name,
        u.name as employee_name,
        u.email as employee_email,
        u.role as employee_role
      FROM project_steps ps
      JOIN projects p ON ps.project_id = p.id
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON COALESCE(ps.appealed_by, ps.assignee_id) = u.id
    `;

    const queryParams = [];

    if (!isAdminOrPm && user_id) {
      query += ` WHERE (ps.assignee_id = ? OR ps.appealed_by = ? OR p.pm_id = ? OR p.production_id = ?)`;
      queryParams.push(user_id, user_id, user_id, user_id);
    }

    query += `
      ORDER BY 
        CASE 
          WHEN ps.deadline_status = 'Appealed' THEN 1 
          WHEN ps.deadline_status = 'Pending Acceptance' OR ps.deadline_status IS NULL THEN 2 
          ELSE 3 
        END,
        ps.id DESC
    `;

    const [appeals] = await db.query(query, queryParams);
    res.json(appeals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending deadline appeals & pending acceptance count with role-based scoping
router.get('/appeals/count', async (req, res) => {
  const { user_id, role } = req.query;
  const isAdminOrPm = role === 'Admin' || role === 'Product Manager' || role === 'PM' || role === 'Project Manager';

  try {
    let query = "SELECT COUNT(*) as pending_count FROM project_steps ps JOIN projects p ON ps.project_id = p.id WHERE (ps.deadline_status = 'Appealed' OR ps.deadline_status = 'Pending Acceptance' OR ps.deadline_status IS NULL)";
    const queryParams = [];

    if (!isAdminOrPm && user_id) {
      query += " AND (ps.assignee_id = ? OR ps.appealed_by = ? OR p.pm_id = ? OR p.production_id = ?)";
      queryParams.push(user_id, user_id, user_id, user_id);
    }

    const [[result]] = await db.query(query, queryParams);
    res.json({ pending_count: result ? result.pending_count : 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm / Accept a step deadline
router.post('/accept/:step_id', async (req, res) => {
  const { step_id } = req.params;
  const { user_id } = req.body;
  try {
    await db.query("UPDATE project_steps SET deadline_status = 'Accepted' WHERE id = ?", [step_id]);
    await db.query('INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
      [step_id, user_id || null, 'Confirmed and accepted step deadline']
    );
    res.json({ message: 'Deadline confirmed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update step deadline date directly by Admin / PM
router.post('/update-date/:step_id', async (req, res) => {
  const { step_id } = req.params;
  const { deadline, user_id } = req.body;
  if (!deadline) return res.status(400).json({ error: 'Deadline date is required' });
  try {
    await db.query('UPDATE project_steps SET deadline = ?, deadline_status = "Accepted" WHERE id = ?', [deadline, step_id]);
    await db.query('INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
      [step_id, user_id || null, `Updated step deadline to ${deadline}`]
    );
    res.json({ message: 'Step deadline updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Review (Approve or Reject) a deadline appeal
router.post('/appeals/:step_id/review', async (req, res) => {
  const { step_id } = req.params;
  const { action, user_id } = req.body;

  if (!action || (action !== 'Approve' && action !== 'Reject')) {
    return res.status(400).json({ error: 'Action must be "Approve" or "Reject"' });
  }

  try {
    const [[step]] = await db.query('SELECT * FROM project_steps WHERE id = ?', [step_id]);
    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }

    if (action === 'Approve') {
      const newDeadline = step.proposed_deadline;
      await db.query(`
        UPDATE project_steps 
        SET deadline = ?, deadline_status = 'Accepted', proposed_deadline = NULL, deadline_appeal_reason = NULL 
        WHERE id = ?
      `, [newDeadline, step_id]);

      await db.query('INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
        [step_id, user_id || null, `Admin approved deadline extension to ${newDeadline}`]
      );

      res.json({ message: 'Deadline extension approved successfully', new_deadline: newDeadline });
    } else {
      await db.query(`
        UPDATE project_steps 
        SET deadline_status = 'Rejected', proposed_deadline = NULL 
        WHERE id = ?
      `, [step_id]);

      await db.query('INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
        [step_id, user_id || null, 'Admin rejected deadline extension appeal']
      );

      res.json({ message: 'Deadline appeal rejected' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
