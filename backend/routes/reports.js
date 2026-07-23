const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/reports/dashboard
// Gets top-level metrics: total invoiced, total paid, total balance across all clients
router.get('/dashboard', async (req, res) => {
    try {
        const { user_id, role } = req.query;
        let query = `
            SELECT 
                COALESCE(SUM(amount), 0) as total_invoiced,
                COALESCE(SUM(amount) - SUM(balance), 0) as total_paid,
                COALESCE(SUM(balance), 0) as total_balance
            FROM invoices i
        `;
        const params = [];
        if (user_id && role && role !== 'Admin') {
            query += ` WHERE (i.created_by = ? OR i.agent_id = ?)`;
            params.push(user_id, user_id);
        }
        const [rows] = await db.query(query, params);
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
        const { user_id, role } = req.query;
        let query = `
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
        `;
        const params = [];
        if (user_id && role && role !== 'Admin') {
            query += ` WHERE (i.created_by = ? OR i.agent_id = ?)`;
            params.push(user_id, user_id);
        }
        query += ` ORDER BY i.created_at DESC`;
        const [rows] = await db.query(query, params);
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
        const { user_id, role } = req.query;
        let query = `
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
        `;
        const params = [];
        if (user_id && role && role !== 'Admin') {
            query += ` WHERE (c.created_by = ? OR i.agent_id = ?)`;
            params.push(user_id, user_id);
        }
        query += ` GROUP BY c.id ORDER BY c.full_name ASC`;
        
        const [rows] = await db.query(query, params);
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

// GET /api/reports/profit
// Gets profit & loss analysis (revenue vs expenses and net profit)
router.get('/profit', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        let invoiceWhere = '';
        let expenseWhere = '';
        const invParams = [];
        const expParams = [];

        if (start_date) {
            invoiceWhere += ' AND issue_date >= ?';
            expenseWhere += ' AND date >= ?';
            invParams.push(start_date);
            expParams.push(start_date);
        }
        if (end_date) {
            invoiceWhere += ' AND issue_date <= ?';
            expenseWhere += ' AND date <= ?';
            invParams.push(end_date);
            expParams.push(end_date);
        }

        // Total Collections (Revenue from Invoices paid + Receipts)
        const [invRows] = await db.query(
            `SELECT COALESCE(SUM(amount - balance), 0) as total_revenue, COALESCE(SUM(amount), 0) as total_invoiced FROM invoices WHERE 1=1 ${invoiceWhere}`,
            invParams
        );

        const [expRows] = await db.query(
            `SELECT 
                COALESCE(SUM(payment_amount), 0) as total_expense,
                COALESCE(SUM(receipt_amount), 0) as extra_receipts
            FROM expenses WHERE 1=1 ${expenseWhere}`,
            expParams
        );

        const totalRevenue = parseFloat(invRows[0].total_revenue || 0) + parseFloat(expRows[0].extra_receipts || 0);
        const totalExpenses = parseFloat(expRows[0].total_expense || 0);
        const netProfit = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // Monthly trends query
        const [monthlyRev] = await db.query(
            `SELECT DATE_FORMAT(issue_date, '%Y-%m') as month_key, COALESCE(SUM(amount - balance), 0) as revenue FROM invoices WHERE 1=1 ${invoiceWhere} GROUP BY month_key ORDER BY month_key ASC`,
            invParams
        );

        const [monthlyExp] = await db.query(
            `SELECT DATE_FORMAT(date, '%Y-%m') as month_key, COALESCE(SUM(payment_amount), 0) as expense, COALESCE(SUM(receipt_amount), 0) as receipt FROM expenses WHERE 1=1 ${expenseWhere} GROUP BY month_key ORDER BY month_key ASC`,
            expParams
        );

        // Combine monthly data
        const monthMap = {};

        monthlyRev.forEach(r => {
            if (r.month_key) {
                monthMap[r.month_key] = {
                    month: r.month_key,
                    revenue: parseFloat(r.revenue || 0),
                    expenses: 0
                };
            }
        });

        monthlyExp.forEach(e => {
            if (e.month_key) {
                if (!monthMap[e.month_key]) {
                    monthMap[e.month_key] = { month: e.month_key, revenue: 0, expenses: 0 };
                }
                monthMap[e.month_key].revenue += parseFloat(e.receipt || 0);
                monthMap[e.month_key].expenses += parseFloat(e.expense || 0);
            }
        });

        const monthlyTrend = Object.keys(monthMap).sort().map(key => {
            const rev = monthMap[key].revenue;
            const exp = monthMap[key].expenses;
            const prof = rev - exp;
            const marg = rev > 0 ? (prof / rev) * 100 : 0;
            return {
                month: key,
                revenue: Number(rev.toFixed(2)),
                expenses: Number(exp.toFixed(2)),
                profit: Number(prof.toFixed(2)),
                margin: Number(marg.toFixed(1))
            };
        });

        res.json({
            summary: {
                total_revenue: Number(totalRevenue.toFixed(2)),
                total_expenses: Number(totalExpenses.toFixed(2)),
                net_profit: Number(netProfit.toFixed(2)),
                profit_margin: Number(profitMargin.toFixed(1))
            },
            monthlyTrend
        });
    } catch (err) {
        console.error('Error fetching profit report:', err);
        res.status(500).json({ error: 'Failed to fetch profit report' });
    }
});

module.exports = router;
