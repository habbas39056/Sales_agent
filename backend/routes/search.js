const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const { q, user_id, role } = req.query;
    
    if (!q || q.trim() === '') {
      return res.json({ clients: [], projects: [], invoices: [] });
    }

    const searchTerm = `%${q}%`;
    const results = { clients: [], projects: [], invoices: [] };

    // Common non-admin filter condition
    const isNonAdmin = user_id && role && role !== 'Admin';

    // 1. Search Clients
    let clientsQuery = `SELECT DISTINCT c.id, c.full_name, c.business_name, c.email FROM clients c LEFT JOIN invoices i ON c.id = i.client_id WHERE (c.full_name LIKE ? OR c.business_name LIKE ? OR c.email LIKE ?)`;
    const clientsParams = [searchTerm, searchTerm, searchTerm];
    if (isNonAdmin) {
      clientsQuery += ` AND (c.created_by = ? OR i.agent_id = ?)`;
      clientsParams.push(user_id, user_id);
    }
    clientsQuery += ` LIMIT 5`;
    const [clients] = await db.query(clientsQuery, clientsParams);
    results.clients = clients;

    // 2. Search Invoices
    let invoicesQuery = `SELECT i.id, i.invoice_number, c.full_name as client_name FROM invoices i JOIN clients c ON i.client_id = c.id WHERE i.invoice_number LIKE ?`;
    const invoicesParams = [searchTerm];
    if (isNonAdmin) {
      invoicesQuery += ` AND (i.created_by = ? OR i.agent_id = ?)`;
      invoicesParams.push(user_id, user_id);
    }
    invoicesQuery += ` LIMIT 5`;
    const [invoices] = await db.query(invoicesQuery, invoicesParams);
    results.invoices = invoices;

    // 3. Search Projects
    let projectsQuery = `SELECT DISTINCT p.id, p.title, c.full_name as client_name FROM projects p JOIN clients c ON p.client_id = c.id LEFT JOIN invoices i ON c.id = i.client_id WHERE p.title LIKE ?`;
    const projectsParams = [searchTerm];
    if (isNonAdmin) {
      projectsQuery += ` AND (c.created_by = ? OR i.agent_id = ?)`;
      projectsParams.push(user_id, user_id);
    }
    projectsQuery += ` LIMIT 5`;
    const [projects] = await db.query(projectsQuery, projectsParams);
    results.projects = projects;

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
