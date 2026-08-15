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
        ps.status as step_status,
        ps.deadline as original_deadline,
        ps.proposed_deadline,
        ps.deadline_appeal_reason as appeal_reason,
        ps.appealed_at,
        ps.reassign_todos,
        ps.reject_todos,
        COALESCE(ps.deadline_status, 'Pending Acceptance') as deadline_status,
        ps.invoice_item_ids,
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
      query += ` WHERE (ps.assignee_id = ? OR ps.appealed_by = ? OR p.pm_id = ?)`;
      queryParams.push(user_id, user_id, user_id);
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

    // Fetch and attach invoice items if they exist
    const allItemIds = new Set();
    appeals.forEach(a => {
      if (a.invoice_item_ids) {
        try {
          const ids = typeof a.invoice_item_ids === 'string' ? JSON.parse(a.invoice_item_ids) : a.invoice_item_ids;
          if (Array.isArray(ids)) {
            a.parsed_invoice_item_ids = ids;
            ids.forEach(id => allItemIds.add(id));
          }
        } catch (e) {}
      }
    });

    if (allItemIds.size > 0) {
      const [items] = await db.query('SELECT * FROM invoice_items WHERE id IN (?)', [Array.from(allItemIds)]);
      const itemsMap = items.reduce((map, item) => {
        map[item.id] = item;
        return map;
      }, {});

      appeals.forEach(a => {
        if (a.parsed_invoice_item_ids && a.parsed_invoice_item_ids.length > 0) {
          a.invoice_items = a.parsed_invoice_item_ids.map(id => itemsMap[id]).filter(Boolean);
        }
      });
    }

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
      query += " AND (ps.assignee_id = ? OR ps.appealed_by = ? OR p.pm_id = ?)";
      queryParams.push(user_id, user_id, user_id);
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

    // Notify assignee and PM
    const [[stepInfo]] = await db.query('SELECT ps.assignee_id, ps.title, p.pm_id, p.id as project_id FROM project_steps ps JOIN projects p ON ps.project_id = p.id WHERE ps.id = ?', [step_id]);
    if (stepInfo) {
      const usersToNotify = new Set();
      if (stepInfo.assignee_id && String(stepInfo.assignee_id) !== String(user_id)) usersToNotify.add(stepInfo.assignee_id);
      if (stepInfo.pm_id && String(stepInfo.pm_id) !== String(user_id)) usersToNotify.add(stepInfo.pm_id);

      for (const uid of usersToNotify) {
        await db.query(
          'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
          [uid, `The deadline for step "${stepInfo.title}" has been updated to ${deadline}.`, 'deadline_updated', `/projects/${stepInfo.project_id}`]
        );
      }
    }

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
    const [[step]] = await db.query('SELECT ps.*, p.pm_id FROM project_steps ps JOIN projects p ON ps.project_id = p.id WHERE ps.id = ?', [step_id]);
    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }

    if (action === 'Approve') {
      // Use MySQL native column copying to avoid Node.js timezone shifts
      const newDeadline = step.proposed_deadline; // Keep this for the activity log string
      await db.query(`
        UPDATE project_steps 
        SET deadline = proposed_deadline, deadline_status = 'Accepted', proposed_deadline = NULL, deadline_appeal_reason = NULL 
        WHERE id = ?
      `, [step_id]);

      // Safely format the date for the activity log
      const formattedDate = newDeadline instanceof Date ? newDeadline.toISOString().split('T')[0] : newDeadline;

      await db.query('INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
        [step_id, user_id || null, `Admin approved deadline extension to ${formattedDate}`]
      );

      // Notify the assignee and PM
      const usersToNotify = new Set();
      if (step.assignee_id && String(step.assignee_id) !== String(user_id)) usersToNotify.add(step.assignee_id);
      if (step.appealed_by && String(step.appealed_by) !== String(user_id)) usersToNotify.add(step.appealed_by);
      if (step.pm_id && String(step.pm_id) !== String(user_id)) usersToNotify.add(step.pm_id);

      for (const uid of usersToNotify) {
        await db.query(
          'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
          [uid, `The deadline appeal for "${step.title}" was approved. New deadline: ${formattedDate}`, 'appeal_approved', `/projects/${step.project_id}`]
        );
      }

      res.json({ message: 'Deadline extension approved successfully', new_deadline: formattedDate });
    } else {
      await db.query(`
        UPDATE project_steps 
        SET deadline_status = 'Rejected', proposed_deadline = NULL 
        WHERE id = ?
      `, [step_id]);

      await db.query('INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, ?, ?)',
        [step_id, user_id || null, 'Admin rejected deadline extension appeal']
      );

      // Notify the assignee and PM
      const usersToNotify = new Set();
      if (step.assignee_id && String(step.assignee_id) !== String(user_id)) usersToNotify.add(step.assignee_id);
      if (step.appealed_by && String(step.appealed_by) !== String(user_id)) usersToNotify.add(step.appealed_by);
      if (step.pm_id && String(step.pm_id) !== String(user_id)) usersToNotify.add(step.pm_id);

      for (const uid of usersToNotify) {
        await db.query(
          'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
          [uid, `The deadline appeal for "${step.title}" was rejected.`, 'appeal_rejected', `/projects/${step.project_id}`]
        );
      }

      res.json({ message: 'Deadline appeal rejected' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
