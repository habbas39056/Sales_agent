const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/reports/dashboard
// Gets top-level metrics: total invoiced, total paid, total balance across all clients
router.get('/dashboard', async (req, res) => {
    try {
        const query = `
            SELECT 
                COALESCE(SUM(amount), 0) as total_invoiced,
                COALESCE(SUM(amount) - SUM(balance), 0) as total_paid,
                COALESCE(SUM(balance), 0) as total_balance
            FROM invoices
        `;
        const [rows] = await db.query(query);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching dashboard metrics:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
    }
});

// GET /api/reports/sales
// Gets an overview of all sales/invoices
router.get('/sales', async (req, res) => {
    try {
        const query = `
            SELECT 
                i.id as invoice_id,
                i.invoice_number,
                c.full_name as client_name,
                c.business_name,
                i.amount,
                i.balance,
                i.status,
                i.issue_date,
                i.due_date
            FROM invoices i
            LEFT JOIN clients c ON i.client_id = c.id
            ORDER BY i.created_at DESC
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching sales data:', err);
        res.status(500).json({ error: 'Failed to fetch sales data' });
    }
});

// GET /api/reports/clients
// Gets 360 view for each client: total balance, invoices, paids, due dates
router.get('/clients', async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id as client_id,
                c.full_name,
                c.business_name,
                c.email,
                COUNT(i.id) as total_invoices,
                COALESCE(SUM(i.amount), 0) as total_invoiced_amount,
                COALESCE(SUM(i.balance), 0) as total_balance,
                COALESCE(SUM(i.amount) - SUM(i.balance), 0) as total_paid,
                MIN(CASE WHEN i.status != 'Paid' AND i.due_date >= CURDATE() THEN i.due_date END) as next_due_date,
                SUM(CASE WHEN i.status = 'Overdue' THEN i.balance ELSE 0 END) as total_overdue
            FROM clients c
            LEFT JOIN invoices i ON c.id = i.client_id
            GROUP BY c.id
            ORDER BY c.full_name ASC
        `;
        
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching client reports:', err);
        res.status(500).json({ error: 'Failed to fetch client reports' });
    }
});

// GET /api/reports/team
// Gets reporting for team members: commissions, projects assigned (completed/not)
router.get('/team', async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id as user_id,
                u.name,
                u.role,
                u.email,
                COUNT(DISTINCT p.id) as total_projects,
                SUM(CASE WHEN p.status = 'Completed' OR p.status = 'Commission Released' THEN 1 ELSE 0 END) as completed_projects,
                SUM(CASE WHEN p.status != 'Completed' AND p.status != 'Commission Released' THEN 1 ELSE 0 END) as active_projects,
                COALESCE(SUM(c.final_amount), 0) as total_commissions,
                COALESCE(SUM(CASE WHEN c.status = 'Released' THEN c.final_amount ELSE 0 END), 0) as released_commissions,
                COALESCE(SUM(CASE WHEN c.status = 'Hold' THEN c.final_amount ELSE 0 END), 0) as pending_commissions
            FROM users u
            LEFT JOIN projects p ON (u.id = p.pm_id OR u.id = p.production_id)
            LEFT JOIN commissions c ON u.id = c.user_id
            WHERE u.role != 'Client'
            GROUP BY u.id
            ORDER BY u.name ASC
        `;

        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching team reports:', err);
        res.status(500).json({ error: 'Failed to fetch team reports' });
    }
});

// GET /api/reports/clients/:clientId/details
// Gets detailed invoice and project progress for a specific client
router.get('/clients/:clientId/details', async (req, res) => {
    try {
        const { clientId } = req.params;
        const query = `
            SELECT 
                i.id as invoice_id,
                i.invoice_number,
                i.amount,
                i.balance,
                i.status as invoice_status,
                i.issue_date,
                i.due_date,
                p.id as project_id,
                p.title as project_title,
                p.status as project_status,
                p.total_steps,
                p.completed_steps
            FROM invoices i
            LEFT JOIN projects p ON i.project_id = p.id
            WHERE i.client_id = ?
            ORDER BY i.created_at DESC
        `;
        
        const [rows] = await db.query(query, [clientId]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching client details:', err);
        res.status(500).json({ error: 'Failed to fetch client details' });
    }
});
// GET /api/reports/team/:userId/details
// Gets detailed project, invoice, and commission progress for a specific team member
router.get('/team/:userId/details', async (req, res) => {
    try {
        const { userId } = req.params;
        const query = `
            SELECT 
                p.id as project_id,
                p.title as project_title,
                p.status as project_status,
                p.total_steps,
                p.completed_steps,
                c.full_name as client_name,
                c.business_name,
                i.invoice_number,
                i.status as invoice_status,
                i.amount as invoice_amount,
                i.balance as invoice_balance,
                com.final_amount as commission_amount,
                com.status as commission_status
            FROM projects p
            LEFT JOIN clients c ON p.client_id = c.id
            LEFT JOIN invoices i ON p.id = i.project_id
            LEFT JOIN commissions com ON p.id = com.project_id AND com.user_id = ?
            WHERE (p.pm_id = ? OR p.production_id = ?)
            ORDER BY p.created_at DESC
        `;
        
        const [rows] = await db.query(query, [userId, userId, userId]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching team member details:', err);
        res.status(500).json({ error: 'Failed to fetch team details' });
    }
});

module.exports = router;
