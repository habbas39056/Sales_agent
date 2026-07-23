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

    // 1. Search Clients (Name, Business Name, Email, Phone/WhatsApp, Address)
    let clientsQuery = `SELECT DISTINCT c.id, c.full_name, c.business_name, c.email, c.whatsapp_number FROM clients c LEFT JOIN invoices i ON c.id = i.client_id WHERE (c.full_name LIKE ? OR c.business_name LIKE ? OR c.email LIKE ? OR c.whatsapp_number LIKE ? OR c.physical_address LIKE ?)`;
    const clientsParams = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];
    if (isNonAdmin) {
      clientsQuery += ` AND (c.created_by = ? OR i.agent_id = ?)`;
      clientsParams.push(user_id, user_id);
    }
    clientsQuery += ` LIMIT 5`;
    const [clients] = await db.query(clientsQuery, clientsParams);
    results.clients = clients;

    // 2. Search Invoices (Invoice Number, Client Name, Email, Phone)
    let invoicesQuery = `SELECT i.id, i.invoice_number, c.full_name as client_name, i.amount FROM invoices i JOIN clients c ON i.client_id = c.id WHERE (i.invoice_number LIKE ? OR c.full_name LIKE ? OR c.email LIKE ? OR c.whatsapp_number LIKE ?)`;
    const invoicesParams = [searchTerm, searchTerm, searchTerm, searchTerm];
    if (isNonAdmin) {
      invoicesQuery += ` AND (i.created_by = ? OR i.agent_id = ?)`;
      invoicesParams.push(user_id, user_id);
    }
    invoicesQuery += ` LIMIT 5`;
    const [invoices] = await db.query(invoicesQuery, invoicesParams);
    results.invoices = invoices;

    // 3. Search Projects (Title, Service Type, Client Name)
    let projectsQuery = `SELECT DISTINCT p.id, p.title, c.full_name as client_name, p.service_type FROM projects p JOIN clients c ON p.client_id = c.id LEFT JOIN invoices i ON c.id = i.client_id WHERE (p.title LIKE ? OR p.service_type LIKE ? OR c.full_name LIKE ?)`;
    const projectsParams = [searchTerm, searchTerm, searchTerm];
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
