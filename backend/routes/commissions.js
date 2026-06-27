const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all agents and their aggregate commission data
router.get('/', async (req, res) => {
  try {
    const { user_id, role } = req.query;
    
    let query = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.commission_percentage,
        COUNT(i.id) as total_invoices,
        SUM(i.commission_amount) as total_earned,
        SUM(CASE WHEN i.status = 'Paid' THEN i.commission_amount ELSE 0 END) as total_paid_out
      FROM users u
      LEFT JOIN invoices i ON u.id = i.agent_id
      WHERE u.role != 'Client'
    `;
    const params = [];
    
    if (user_id && role && role !== 'Admin') {
      query += ` AND u.id = ? `;
      params.push(user_id);
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
