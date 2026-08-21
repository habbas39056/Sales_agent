const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all notifications for a user (Admins see all company notifications)
router.get('/', async (req, res) => {
  const { user_id, role } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    const [[userRecord]] = await db.query('SELECT role FROM users WHERE id = ?', [user_id]);
    const userRole = role || userRecord?.role;

    let query;
    let params;

    if (userRole === 'Admin') {
      query = 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 60';
      params = [];
    } else {
      query = 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50';
      params = [user_id];
    }

    const [notifications] = await db.query(query, params);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread notification count
router.get('/unread-count', async (req, res) => {
  const { user_id, role } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    const [[userRecord]] = await db.query('SELECT role FROM users WHERE id = ?', [user_id]);
    const userRole = role || userRecord?.role;

    const query = userRole === 'Admin' 
      ? 'SELECT COUNT(*) as count FROM notifications WHERE is_read = FALSE'
      : 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE';
    const params = userRole === 'Admin' ? [] : [user_id];

    const [[result]] = await db.query(query, params);
    res.json({ count: result ? result.count : 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark single notification as read
router.put('/:id/read', async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all as read for user (or all company notifications if Admin)
router.put('/mark-all-read', async (req, res) => {
  const { user_id, role } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    const [[userRecord]] = await db.query('SELECT role FROM users WHERE id = ?', [user_id]);
    const userRole = role || userRecord?.role;

    if (userRole === 'Admin') {
      await db.query('UPDATE notifications SET is_read = TRUE');
    } else {
      await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [user_id]);
    }
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all as read for specific project
router.put('/read-project/:project_id', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  try {
    const linkQuery1 = `%/projects?id=${req.params.project_id}%`;
    const linkQuery2 = `%/projects/${req.params.project_id}%`;
    const linkQuery3 = `%/client-portal?id=${req.params.project_id}%`;

    await db.query(`
      UPDATE notifications 
      SET is_read = TRUE 
      WHERE user_id = ? AND (link LIKE ? OR link LIKE ? OR link LIKE ?)
    `, [user_id, linkQuery1, linkQuery2, linkQuery3]);

    res.json({ message: 'Project notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
