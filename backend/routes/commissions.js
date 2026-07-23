const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all agents and their aggregate commission data
router.get('/', async (req, res) => {
  try {
    const { user_id, role, start_date, end_date, agent_id, status } = req.query;
    
    let query = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role,
        u.commission_percentage,
        COUNT(i.id) as total_invoices,
        COALESCE(SUM(i.commission_amount), 0) as total_earned,
        COALESCE(SUM(CASE WHEN i.status = 'Paid' THEN i.commission_amount ELSE 0 END), 0) as total_paid_out
      FROM users u
      LEFT JOIN invoices i ON u.id = i.agent_id
    `;
    
    const conditions = ["u.role != 'Client'"];
    const params = [];
    
    if (user_id && role && role !== 'Admin') {
      conditions.push('u.id = ?');
      params.push(user_id);
    }

    if (agent_id && agent_id !== 'all') {
      conditions.push('u.id = ?');
      params.push(agent_id);
    }

    if (start_date) {
      conditions.push('(i.issue_date >= ? OR i.issue_date IS NULL)');
      params.push(start_date);
    }

    if (end_date) {
      conditions.push('(i.issue_date <= ? OR i.issue_date IS NULL)');
      params.push(end_date);
    }

    if (status && status !== 'all') {
      conditions.push('(i.status = ? OR i.status IS NULL)');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    
    query += `
      GROUP BY u.id
      ORDER BY total_earned DESC, u.name ASC
    `;
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
