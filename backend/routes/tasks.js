const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all tasks (project steps) assigned to a user
router.get('/', async (req, res) => {
  try {
    const { user_id, role } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // We fetch steps assigned to this user, along with project details
    // If Admin, they could potentially fetch all, but here we'll scope it to assignee unless 'all' is requested
    
    let query = `
      SELECT 
        ps.*, 
        p.title as project_title, 
        c.full_name as client_name,
        u.name as pm_name
      FROM project_steps ps
      JOIN projects p ON ps.project_id = p.id
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON p.pm_id = u.id
    `;
    const params = [];

    if (role !== 'Admin') {
      query += ` WHERE ps.assignee_id = ?`;
      params.push(user_id);
    } else if (req.query.all !== 'true') {
      query += ` WHERE ps.assignee_id = ?`;
      params.push(user_id);
    }

    query += ` ORDER BY 
      CASE WHEN ps.deadline IS NULL THEN 1 ELSE 0 END, 
      ps.deadline ASC
    `;

    const [rows] = await db.query(query, params);
    res.json(rows);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// We can optionally add endpoints to update task status here if needed, 
// though they are currently handled in projects.js (e.g. PUT /projects/:id/steps/:step_id)

module.exports = router;
