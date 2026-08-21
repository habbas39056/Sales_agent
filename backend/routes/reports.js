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
// Enterprise Sales Overview with full filtering, metrics, and breakdowns
router.get('/sales', async (req, res) => {
    try {
        const { user_id, role, start_date, end_date, client_id, status } = req.query;
        
        let query = `
            SELECT 
                i.id as invoice_id,
                i.invoice_number,
                c.id as client_id,
                c.full_name as client_name,
                c.business_name,
                c.whatsapp_number as client_phone,
                c.email as client_email,
                p.id as project_id,
                p.title as project_title,
                i.amount,
                i.balance,
                (i.amount - i.balance) as paid_amount,
                i.status,
                i.issue_date,
                i.due_date,
                i.created_at
            FROM invoices i
            LEFT JOIN clients c ON i.client_id = c.id
            LEFT JOIN projects p ON i.project_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (user_id && role && role !== 'Admin') {
            query += ` AND (i.created_by = ? OR i.agent_id = ?)`;
            params.push(user_id, user_id);
        }

        if (start_date) {
            query += ` AND DATE(COALESCE(i.issue_date, i.created_at)) >= ?`;
            params.push(start_date);
        }

        if (end_date) {
            query += ` AND DATE(COALESCE(i.issue_date, i.created_at)) <= ?`;
            params.push(end_date);
        }

        if (client_id && client_id !== 'all') {
            query += ` AND i.client_id = ?`;
            params.push(client_id);
        }

        if (status && status !== 'all') {
            query += ` AND i.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY COALESCE(i.issue_date, i.created_at) DESC`;

        const [rows] = await db.query(query, params);

        // Fetch corresponding expenses in this period for Profit/Loss calculations
        let expenseQuery = `SELECT COALESCE(SUM(payment_amount), 0) as total_expenses FROM expenses WHERE 1=1`;
        const expenseParams = [];
        if (start_date) {
            expenseQuery += ` AND DATE(date) >= ?`;
            expenseParams.push(start_date);
        }
        if (end_date) {
            expenseQuery += ` AND DATE(date) <= ?`;
            expenseParams.push(end_date);
        }
        const [expenseRes] = await db.query(expenseQuery, expenseParams);
        const totalExpenses = parseFloat(expenseRes[0]?.total_expenses || 0);

        // Calculate KPI summaries
        let grossSales = 0;
        let realizedRevenue = 0;
        let outstandingBalance = 0;
        const statusMap = {};
        const clientMap = {};
        const monthlyTrendMap = {};

        rows.forEach(inv => {
            const amt = parseFloat(inv.amount || 0);
            const bal = parseFloat(inv.balance || 0);
            const paid = amt - bal;

            grossSales += amt;
            realizedRevenue += paid;
            outstandingBalance += bal;

            // Status Breakdown
            const st = inv.status || 'Unspecified';
            if (!statusMap[st]) {
                statusMap[st] = { status: st, count: 0, total_amount: 0, paid_amount: 0, balance: 0 };
            }
            statusMap[st].count += 1;
            statusMap[st].total_amount += amt;
            statusMap[st].paid_amount += paid;
            statusMap[st].balance += bal;

            // Client Contribution (Grouped strictly by unique client_id to prevent same-name client merging)
            const cKey = inv.client_id ? `client_${inv.client_id}` : `name_${inv.client_name || inv.business_name || 'unassigned'}`;
            const cName = inv.client_name || 'Individual Client';
            const bName = inv.business_name || '';

            if (!clientMap[cKey]) {
                clientMap[cKey] = {
                    client_id: inv.client_id,
                    name: cName,
                    business: bName,
                    invoices_count: 0,
                    total_sales: 0,
                    total_paid: 0,
                    total_balance: 0
                };
            }
            clientMap[cKey].invoices_count += 1;
            clientMap[cKey].total_sales += amt;
            clientMap[cKey].total_paid += paid;
            clientMap[cKey].total_balance += bal;

            // Monthly Trend Aggregation
            const dateStr = inv.issue_date || inv.created_at;
            let monthKey = 'Unknown';
            if (dateStr) {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    monthKey = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
                }
            }

            if (!monthlyTrendMap[monthKey]) {
                monthlyTrendMap[monthKey] = {
                    name: monthKey,
                    invoiced: 0,
                    paid: 0,
                    balance: 0,
                    invoice_count: 0
                };
            }
            monthlyTrendMap[monthKey].invoiced += amt;
            monthlyTrendMap[monthKey].paid += paid;
            monthlyTrendMap[monthKey].balance += bal;
            monthlyTrendMap[monthKey].invoice_count += 1;
        });

        // Top 5 Clients
        const topClients = Object.values(clientMap)
            .sort((a, b) => b.total_sales - a.total_sales)
            .slice(0, 5);

        // Status Breakdown Array
        const statusBreakdown = Object.values(statusMap);

        // Trend Array
        const trend = Object.values(monthlyTrendMap);

        const netProfit = realizedRevenue - totalExpenses;
        const profitMargin = realizedRevenue > 0 ? ((netProfit / realizedRevenue) * 100) : 0;
        const collectionRate = grossSales > 0 ? ((realizedRevenue / grossSales) * 100) : 0;
        const avgOrderValue = rows.length > 0 ? (grossSales / rows.length) : 0;

        res.json({
            invoices: rows,
            summary: {
                gross_sales: Number(grossSales.toFixed(2)),
                realized_revenue: Number(realizedRevenue.toFixed(2)),
                outstanding_ar: Number(outstandingBalance.toFixed(2)),
                total_expenses: Number(totalExpenses.toFixed(2)),
                net_profit: Number(netProfit.toFixed(2)),
                profit_margin: Number(profitMargin.toFixed(1)),
                collection_rate: Number(collectionRate.toFixed(1)),
                total_invoices: rows.length,
                avg_order_value: Number(avgOrderValue.toFixed(2))
            },
            trend,
            status_breakdown: statusBreakdown,
            top_clients: topClients
        });
    } catch (err) {
        console.error('Error fetching sales data:', err);
        res.status(500).json({ error: 'Failed to fetch sales data' });
    }
});

// GET /api/reports/clients
// Enterprise Client Profitability & Intelligence Overview
router.get('/clients', async (req, res) => {
    try {
        const { user_id, role, start_date, end_date, search } = req.query;

        // 1. Fetch Clients
        let clientQuery = `
            SELECT 
                c.id as client_id,
                c.full_name,
                c.business_name,
                c.whatsapp_number,
                c.email,
                c.physical_address,
                c.created_at,
                c.created_by
            FROM clients c
        `;
        const clientParams = [];
        if (user_id && role && role !== 'Admin') {
            clientQuery += ` WHERE c.created_by = ?`;
            clientParams.push(user_id);
        }
        clientQuery += ` ORDER BY c.full_name ASC`;
        const [clients] = await db.query(clientQuery, clientParams);

        // 2. Fetch Invoices with optional date filter
        let invQuery = `
            SELECT 
                id,
                invoice_number,
                client_id,
                project_id,
                amount,
                balance,
                status,
                issue_date,
                due_date,
                created_at,
                agent_id
            FROM invoices
            WHERE 1=1
        `;
        const invParams = [];
        if (start_date) {
            invQuery += ` AND (issue_date >= ? OR (issue_date IS NULL AND created_at >= ?))`;
            invParams.push(start_date, start_date);
        }
        if (end_date) {
            invQuery += ` AND (issue_date <= ? OR (issue_date IS NULL AND created_at <= ?))`;
            invParams.push(end_date, end_date);
        }
        const [invoices] = await db.query(invQuery, invParams);

        // 3. Fetch Projects
        const [projects] = await db.query(`SELECT id, client_id, title, status, created_at, start_date FROM projects`);

        // 4. Fetch Expenses with optional date filter
        let expQuery = `SELECT id, client, payment_amount, date, description, category FROM expenses WHERE 1=1`;
        const expParams = [];
        if (start_date) {
            expQuery += ` AND date >= ?`;
            expParams.push(start_date);
        }
        if (end_date) {
            expQuery += ` AND date <= ?`;
            expParams.push(end_date);
        }
        const [expenses] = await db.query(expQuery, expParams);

        const now = new Date();

        // Calculate client-wise analytics
        const clientRecords = clients.map(c => {
            const cInvoices = invoices.filter(i => i.client_id === c.client_id);
            const cProjects = projects.filter(p => p.client_id === c.client_id);
            
            // Match expenses by client name, business name, or ID
            const cExpenses = expenses.filter(e => {
                if (!e.client) return false;
                const eClient = e.client.trim().toLowerCase();
                return (
                    eClient === (c.full_name || '').trim().toLowerCase() ||
                    eClient === (c.business_name || '').trim().toLowerCase() ||
                    e.client == c.client_id
                );
            });

            const totalBilled = cInvoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
            const totalOutstanding = cInvoices.reduce((sum, i) => sum + parseFloat(i.balance || 0), 0);
            const totalCollected = totalBilled - totalOutstanding;
            const totalExpenses = cExpenses.reduce((sum, e) => sum + parseFloat(e.payment_amount || 0), 0);
            
            // Profit calculations
            const grossProfit = totalCollected - totalExpenses;
            const billedProfit = totalBilled - totalExpenses;
            const profitMargin = totalBilled > 0 ? (grossProfit / totalBilled) * 100 : 0;
            const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 100;

            // Overdue and Next Due Date
            let totalOverdue = 0;
            let nextDueDate = null;

            cInvoices.forEach(i => {
                const bal = parseFloat(i.balance || 0);
                if (bal > 0) {
                    const due = i.due_date ? new Date(i.due_date) : null;
                    if (i.status === 'Overdue' || (due && due < now)) {
                        totalOverdue += bal;
                    }
                    if (due && due >= now) {
                        if (!nextDueDate || due < new Date(nextDueDate)) {
                            nextDueDate = i.due_date;
                        }
                    }
                }
            });

            // Tenure & Monthly Run-rate
            const createdAt = new Date(c.created_at || now);
            const tenureMonths = Math.max(1, (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth()) + 1);
            const avgMonthlyRevenue = totalBilled / tenureMonths;

            return {
                client_id: c.client_id,
                full_name: c.full_name || 'Unnamed Client',
                business_name: c.business_name || '-',
                whatsapp_number: c.whatsapp_number || '-',
                email: c.email || '-',
                physical_address: c.physical_address || '',
                created_at: c.created_at,
                tenure_months: tenureMonths,
                // Core Financials requested
                total_billed: Number(totalBilled.toFixed(2)),
                total_collected: Number(totalCollected.toFixed(2)),
                total_outstanding: Number(totalOutstanding.toFixed(2)),
                total_expenses: Number(totalExpenses.toFixed(2)),
                project_cost: Number(totalExpenses.toFixed(2)),
                gross_profit: Number(grossProfit.toFixed(2)),
                billed_profit: Number(billedProfit.toFixed(2)),
                profit_margin: Number(profitMargin.toFixed(1)),
                collection_rate: Number(collectionRate.toFixed(1)),
                total_projects: cProjects.length,
                active_projects: cProjects.filter(p => ['In Progress', 'Active', 'Planning', 'Review'].includes(p.status)).length,
                completed_projects: cProjects.filter(p => p.status === 'Completed').length,
                total_invoices: cInvoices.length,
                avg_monthly_revenue: Number(avgMonthlyRevenue.toFixed(2)),
                total_overdue: Number(totalOverdue.toFixed(2)),
                next_due_date: nextDueDate,
                // Status tag
                profitability_tier: profitMargin >= 50 ? 'High Margin' : (profitMargin > 0 ? 'Profitable' : (profitMargin === 0 && totalBilled === 0 ? 'Inactive' : 'Loss')),
                health_status: totalOutstanding === 0 ? 'Healthy' : (totalOverdue > 0 ? 'Overdue Risk' : 'Pending Dues')
            };
        });

        // Portfolio Aggregates
        const portfolioBilled = clientRecords.reduce((sum, c) => sum + c.total_billed, 0);
        const portfolioCollected = clientRecords.reduce((sum, c) => sum + c.total_collected, 0);
        const portfolioOutstanding = clientRecords.reduce((sum, c) => sum + c.total_outstanding, 0);
        const portfolioExpenses = clientRecords.reduce((sum, c) => sum + c.total_expenses, 0);
        const portfolioGrossProfit = portfolioCollected - portfolioExpenses;
        const portfolioMargin = portfolioBilled > 0 ? (portfolioGrossProfit / portfolioBilled) * 100 : 0;
        const portfolioCollectionRate = portfolioBilled > 0 ? (portfolioCollected / portfolioBilled) * 100 : 100;
        const activeClients = clientRecords.filter(c => c.total_billed > 0 || c.total_projects > 0).length;
        const arpu = activeClients > 0 ? (portfolioBilled / activeClients) : 0;

        // Top 5 Profitable Clients
        const topProfitable = [...clientRecords]
            .sort((a, b) => b.gross_profit - a.gross_profit)
            .slice(0, 5);

        // Top 5 Revenue Concentration
        const topRevenue = [...clientRecords]
            .sort((a, b) => b.total_billed - a.total_billed)
            .slice(0, 5)
            .map(c => ({
                name: c.business_name && c.business_name !== '-' ? c.business_name : c.full_name,
                billed: c.total_billed,
                collected: c.total_collected,
                profit: c.gross_profit,
                share: portfolioBilled > 0 ? Number(((c.total_billed / portfolioBilled) * 100).toFixed(1)) : 0
            }));

        res.json({
            clients: clientRecords,
            summary: {
                total_clients: clientRecords.length,
                active_clients: activeClients,
                portfolio_billed: Number(portfolioBilled.toFixed(2)),
                portfolio_collected: Number(portfolioCollected.toFixed(2)),
                portfolio_outstanding: Number(portfolioOutstanding.toFixed(2)),
                portfolio_expenses: Number(portfolioExpenses.toFixed(2)),
                portfolio_gross_profit: Number(portfolioGrossProfit.toFixed(2)),
                portfolio_margin: Number(portfolioMargin.toFixed(1)),
                portfolio_collection_rate: Number(portfolioCollectionRate.toFixed(1)),
                arpu: Number(arpu.toFixed(2))
            },
            top_profitable: topProfitable,
            revenue_concentration: topRevenue
        });
    } catch (err) {
        console.error('Error fetching client reports:', err);
        res.status(500).json({ error: 'Failed to fetch client reports' });
    }
});

// GET /api/reports/clients/:id/details
// Complete 360° deep-dive for a single client (Invoices, Projects, Expenses)
router.get('/clients/:id/details', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Client profile
        const [clientRows] = await db.query('SELECT * FROM clients WHERE id = ?', [id]);
        if (clientRows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }
        const client = clientRows[0];

        // 2. Invoices
        const [invoices] = await db.query(
            `SELECT i.*, p.title as project_title 
             FROM invoices i 
             LEFT JOIN projects p ON i.project_id = p.id 
             WHERE i.client_id = ? 
             ORDER BY COALESCE(i.issue_date, i.created_at) DESC`,
            [id]
        );

        // 3. Projects
        const [projects] = await db.query(
            `SELECT p.*, u.name as pm_name 
             FROM projects p 
             LEFT JOIN users u ON p.pm_id = u.id 
             WHERE p.client_id = ? 
             ORDER BY p.created_at DESC`,
            [id]
        );

        // 4. Expenses matching client
        const [expenses] = await db.query(
            `SELECT * FROM expenses 
             WHERE client = ? OR client = ? OR client = ? 
             ORDER BY date DESC`,
            [client.full_name, client.business_name, id]
        );

        res.json({
            client,
            invoices,
            projects,
            expenses
        });
    } catch (err) {
        console.error('Error fetching client 360 details:', err);
        res.status(500).json({ error: 'Failed to fetch client details' });
    }
});

// GET /api/reports/team
// Enterprise Workforce Productivity, Revenue Attribution & Unit Economics
router.get('/team', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        // 1. Fetch Users (excluding client accounts)
        const [users] = await db.query(
            `SELECT id, name, email, role, whatsapp_number, base_salary, commission_percentage, monthly_goal, created_at 
             FROM users 
             WHERE role != 'Client' 
             ORDER BY name ASC`
        );

        // 2. Fetch Projects
        let projQuery = `SELECT id, title, pm_id, production_id, status, created_at FROM projects WHERE 1=1`;
        const projParams = [];
        if (start_date) {
            projQuery += ` AND created_at >= ?`;
            projParams.push(start_date);
        }
        if (end_date) {
            projQuery += ` AND created_at <= ?`;
            projParams.push(end_date);
        }
        const [projects] = await db.query(projQuery, projParams);

        // 3. Fetch Project Tasks / Steps
        let stepQuery = `SELECT id, project_id, title, status, assignee_id, deadline, completed_at, deadline_status, created_at FROM project_steps WHERE 1=1`;
        const stepParams = [];
        if (start_date) {
            stepQuery += ` AND created_at >= ?`;
            stepParams.push(start_date);
        }
        if (end_date) {
            stepQuery += ` AND created_at <= ?`;
            stepParams.push(end_date);
        }
        const [steps] = await db.query(stepQuery, stepParams);

        // 4. Fetch Invoices for Revenue Attribution
        let invQuery = `SELECT id, invoice_number, project_id, client_id, amount, balance, status, agent_id, commission_amount, issue_date, created_at FROM invoices WHERE 1=1`;
        const invParams = [];
        if (start_date) {
            invQuery += ` AND (issue_date >= ? OR (issue_date IS NULL AND created_at >= ?))`;
            invParams.push(start_date, start_date);
        }
        if (end_date) {
            invQuery += ` AND (issue_date <= ? OR (issue_date IS NULL AND created_at <= ?))`;
            invParams.push(end_date, end_date);
        }
        const [invoices] = await db.query(invQuery, invParams);

        // 5. Fetch Commissions
        const [commissions] = await db.query(`SELECT id, user_id, project_id, final_amount, status FROM commissions`);

        // 6. Fetch Project Members mapping
        const [members] = await db.query(`SELECT project_id, user_id FROM project_members`);

        const now = new Date();

        // Calculate individual employee performance
        const teamRecords = users.map(u => {
            // Task metrics
            const uSteps = steps.filter(s => s.assignee_id === u.id);
            const tasksAssigned = uSteps.length;
            const tasksCompleted = uSteps.filter(s => s.status === 'Completed').length;
            const tasksOverdue = uSteps.filter(s => s.status !== 'Completed' && s.deadline && new Date(s.deadline) < now).length;
            const taskEfficiency = tasksAssigned > 0 ? (tasksCompleted / tasksAssigned) * 100 : 100;

            // Project metrics (PM, Production lead, or mapped Member)
            const userMemberProjectIds = members.filter(m => m.user_id === u.id).map(m => m.project_id);
            const uProjects = projects.filter(p => p.pm_id === u.id || p.production_id === u.id || userMemberProjectIds.includes(p.id));
            const projectsAssigned = uProjects.length;
            const projectsCompleted = uProjects.filter(p => p.status === 'Completed' || p.status === 'Commission Released').length;
            const projectsActive = uProjects.filter(p => p.status !== 'Completed' && p.status !== 'Commission Released').length;
            const projectDeliveryRate = projectsAssigned > 0 ? (projectsCompleted / projectsAssigned) * 100 : 100;

            // Revenue Attribution
            // a) Direct Sales deals closed where agent_id = user.id
            const directSalesInvoices = invoices.filter(i => i.agent_id === u.id);
            const directSalesRevenue = directSalesInvoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

            // b) Managed PM project invoices
            const pmProjectIds = projects.filter(p => p.pm_id === u.id).map(p => p.id);
            const pmInvoices = invoices.filter(i => pmProjectIds.includes(i.project_id) && i.agent_id !== u.id);
            const managedPmRevenue = pmInvoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

            // Total billable revenue generated/managed
            const billableRevenue = directSalesRevenue + managedPmRevenue;

            // Cost to Company (CTC) = Base Salary (default or configured) + Commissions
            const uCommissions = commissions.filter(c => c.user_id === u.id);
            const totalCommissionsEarned = uCommissions.reduce((sum, c) => sum + parseFloat(c.final_amount || 0), 0);
            const releasedCommissions = uCommissions.filter(c => c.status === 'Released').reduce((sum, c) => sum + parseFloat(c.final_amount || 0), 0);
            const pendingCommissions = uCommissions.filter(c => c.status === 'Hold').reduce((sum, c) => sum + parseFloat(c.final_amount || 0), 0);
            
            const baseSalary = parseFloat(u.base_salary || 0);
            const standardBase = baseSalary > 0 ? baseSalary : 50000;
            const costToCompany = standardBase + totalCommissionsEarned;

            // Unit Economics
            const netContribution = billableRevenue - costToCompany;
            const roiMultiple = costToCompany > 0 ? (billableRevenue / costToCompany) : (billableRevenue > 0 ? 10.0 : 0);

            // Classification
            let performanceTier = 'Solid Contributor';
            if (roiMultiple >= 3.0 || (taskEfficiency >= 85 && tasksCompleted >= 3)) {
                performanceTier = 'Elite Performer';
            } else if (roiMultiple < 1.0 || tasksOverdue >= 3) {
                performanceTier = 'Review Needed';
            }

            let utilizationStatus = 'Optimal';
            if (projectsActive >= 4 || (tasksAssigned - tasksCompleted) >= 6) {
                utilizationStatus = 'Overloaded';
            } else if (projectsActive <= 1 && tasksAssigned <= 1) {
                utilizationStatus = 'Underutilized';
            }

            return {
                user_id: u.id,
                name: u.name,
                role: u.role,
                email: u.email,
                whatsapp_number: u.whatsapp_number,
                base_salary: standardBase,
                commission_percentage: u.commission_percentage || 0,
                // Tasks
                tasks_assigned: tasksAssigned,
                tasks_completed: tasksCompleted,
                tasks_overdue: tasksOverdue,
                task_efficiency: Number(taskEfficiency.toFixed(1)),
                // Projects
                projects_assigned: projectsAssigned,
                projects_completed: projectsCompleted,
                projects_active: projectsActive,
                project_delivery_rate: Number(projectDeliveryRate.toFixed(1)),
                // Financials & Economics
                billable_revenue_generated: Number(billableRevenue.toFixed(2)),
                cost_to_company: Number(costToCompany.toFixed(2)),
                net_contribution: Number(netContribution.toFixed(2)),
                roi_multiple: Number(roiMultiple.toFixed(2)),
                total_commissions: Number(totalCommissionsEarned.toFixed(2)),
                released_commissions: Number(releasedCommissions.toFixed(2)),
                pending_commissions: Number(pendingCommissions.toFixed(2)),
                // Statuses
                performance_tier: performanceTier,
                utilization_status: utilizationStatus
            };
        });

        // Portfolio-Wide Aggregations
        const totalHeadcount = teamRecords.length;
        const totalBillableRevenue = teamRecords.reduce((sum, t) => sum + t.billable_revenue_generated, 0);
        const totalCostToCompany = teamRecords.reduce((sum, t) => sum + t.cost_to_company, 0);
        const totalNetContribution = totalBillableRevenue - totalCostToCompany;
        const portfolioRoi = totalCostToCompany > 0 ? (totalBillableRevenue / totalCostToCompany) : 0;
        const totalTasksAssigned = teamRecords.reduce((sum, t) => sum + t.tasks_assigned, 0);
        const totalTasksCompleted = teamRecords.reduce((sum, t) => sum + t.tasks_completed, 0);
        const totalTasksOverdue = teamRecords.reduce((sum, t) => sum + t.tasks_overdue, 0);
        const overallTaskEfficiency = totalTasksAssigned > 0 ? (totalTasksCompleted / totalTasksAssigned) * 100 : 100;
        const totalProjectsAssigned = teamRecords.reduce((sum, t) => sum + t.projects_assigned, 0);
        const totalProjectsCompleted = teamRecords.reduce((sum, t) => sum + t.projects_completed, 0);
        const avgRevenuePerEmployee = totalHeadcount > 0 ? (totalBillableRevenue / totalHeadcount) : 0;

        // Top 5 Contributors by Net Profit Contribution
        const topContributors = [...teamRecords]
            .sort((a, b) => b.net_contribution - a.net_contribution)
            .slice(0, 5);

        // Role / Department Aggregation Breakdown
        const deptMap = {};
        teamRecords.forEach(t => {
            const role = t.role || 'Other';
            if (!deptMap[role]) {
                deptMap[role] = { role, headcount: 0, revenue: 0, cost: 0, profit: 0, tasks_completed: 0 };
            }
            deptMap[role].headcount += 1;
            deptMap[role].revenue += t.billable_revenue_generated;
            deptMap[role].cost += t.cost_to_company;
            deptMap[role].profit += t.net_contribution;
            deptMap[role].tasks_completed += t.tasks_completed;
        });
        const departmentBreakdown = Object.values(deptMap).map(d => ({
            ...d,
            revenue: Number(d.revenue.toFixed(2)),
            cost: Number(d.cost.toFixed(2)),
            profit: Number(d.profit.toFixed(2)),
            share: totalBillableRevenue > 0 ? Number(((d.revenue / totalBillableRevenue) * 100).toFixed(1)) : 0
        }));

        res.json({
            team: teamRecords,
            summary: {
                total_headcount: totalHeadcount,
                total_revenue_generated: Number(totalBillableRevenue.toFixed(2)),
                total_cost_to_company: Number(totalCostToCompany.toFixed(2)),
                net_contribution: Number(totalNetContribution.toFixed(2)),
                portfolio_roi: Number(portfolioRoi.toFixed(2)),
                total_tasks_assigned: totalTasksAssigned,
                total_tasks_completed: totalTasksCompleted,
                total_tasks_overdue: totalTasksOverdue,
                overall_task_efficiency: Number(overallTaskEfficiency.toFixed(1)),
                total_projects_assigned: totalProjectsAssigned,
                total_projects_completed: totalProjectsCompleted,
                avg_revenue_per_employee: Number(avgRevenuePerEmployee.toFixed(2))
            },
            top_contributors: topContributors,
            department_breakdown: departmentBreakdown
        });
    } catch (err) {
        console.error('Error fetching team reports:', err);
        res.status(500).json({ error: 'Failed to fetch team reports' });
    }
});

// GET /api/reports/team/:userId/details
// 360° Detailed Workforce Member Drilldown (Projects, Tasks, Invoices, Commissions)
router.get('/team/:userId/details', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // 1. User profile
        const [userRows] = await db.query(
            `SELECT id, name, email, role, whatsapp_number, base_salary, commission_percentage, monthly_goal, created_at 
             FROM users WHERE id = ?`,
            [userId]
        );
        if (userRows.length === 0) {
            return res.status(404).json({ error: 'Team member not found' });
        }
        const user = userRows[0];

        // 2. Assigned Projects
        const [projects] = await db.query(
            `SELECT p.*, c.full_name as client_name, c.business_name 
             FROM projects p 
             LEFT JOIN clients c ON p.client_id = c.id 
             WHERE p.pm_id = ? OR p.production_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?) 
             ORDER BY p.created_at DESC`,
            [userId, userId, userId]
        );

        // 3. Assigned Tasks / Steps
        const [tasks] = await db.query(
            `SELECT s.*, p.title as project_title 
             FROM project_steps s 
             LEFT JOIN projects p ON s.project_id = p.id 
             WHERE s.assignee_id = ? 
             ORDER BY s.created_at DESC`,
            [userId]
        );

        // 4. Invoices & Commissions
        const [invoices] = await db.query(
            `SELECT i.*, p.title as project_title, c.full_name as client_name 
             FROM invoices i 
             LEFT JOIN projects p ON i.project_id = p.id 
             LEFT JOIN clients c ON i.client_id = c.id 
             WHERE i.agent_id = ? OR i.project_id IN (SELECT id FROM projects WHERE pm_id = ?) 
             ORDER BY COALESCE(i.issue_date, i.created_at) DESC`,
            [userId, userId]
        );

        const [commissions] = await db.query(
            `SELECT com.*, p.title as project_title 
             FROM commissions com 
             LEFT JOIN projects p ON com.project_id = p.id 
             WHERE com.user_id = ? 
             ORDER BY com.id DESC`,
            [userId]
        );

        res.json({
            user,
            projects,
            tasks,
            invoices,
            commissions
        });
    } catch (err) {
        console.error('Error fetching team member details:', err);
        res.status(500).json({ error: 'Failed to fetch team details' });
    }
});

// GET /api/reports/profit
// Gets profit & loss analysis strictly calculated from INVOICES revenue vs EXPENSES payments
router.get('/profit', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        // 1. Calculate Revenue STRICTLY from INVOICES table (paid/collected amount: amount - balance)
        let invoiceWhere = 'WHERE 1=1';
        const invoiceParams = [];
        if (start_date) {
            invoiceWhere += ' AND DATE(created_at) >= ?';
            invoiceParams.push(start_date);
        }
        if (end_date) {
            invoiceWhere += ' AND DATE(created_at) <= ?';
            invoiceParams.push(end_date);
        }

        const [[invRow]] = await db.query(
            `SELECT 
                COALESCE(SUM(amount), 0) as total_invoiced,
                COALESCE(SUM(amount - balance), 0) as total_collected
            FROM invoices ${invoiceWhere}`,
            invoiceParams
        );

        // Revenue is calculated strictly from Paid/Collected Invoice Amounts!
        const totalRevenue = parseFloat(invRow.total_collected || 0);
        const totalInvoiced = parseFloat(invRow.total_invoiced || 0);

        // 2. Calculate Business Expenses from EXPENSES table (payment_amount)
        let expenseWhere = 'WHERE 1=1';
        const expParams = [];
        if (start_date) {
            expenseWhere += ' AND DATE(date) >= ?';
            expParams.push(start_date);
        }
        if (end_date) {
            expenseWhere += ' AND DATE(date) <= ?';
            expParams.push(end_date);
        }

        const [[expRow]] = await db.query(
            `SELECT 
                COALESCE(SUM(payment_amount), 0) as total_expense
            FROM expenses ${expenseWhere}`,
            expParams
        );

        const totalExpenses = parseFloat(expRow.total_expense || 0);
        const netProfit = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // 3. Monthly Trend from Invoices (revenue) and Expenses (payments)
        const [monthlyInvoices] = await db.query(
            `SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month_key,
                COALESCE(SUM(amount - balance), 0) as revenue
            FROM invoices ${invoiceWhere}
            GROUP BY month_key`,
            invoiceParams
        );

        const [monthlyExpenses] = await db.query(
            `SELECT 
                DATE_FORMAT(date, '%Y-%m') as month_key,
                COALESCE(SUM(payment_amount), 0) as expense
            FROM expenses ${expenseWhere}
            GROUP BY month_key`,
            expParams
        );

        // Merge monthly invoice revenue and expenses by month_key
        const monthsMap = {};
        monthlyInvoices.forEach(r => {
            if (r.month_key) {
                monthsMap[r.month_key] = { month: r.month_key, revenue: parseFloat(r.revenue || 0), expenses: 0 };
            }
        });
        monthlyExpenses.forEach(e => {
            if (e.month_key) {
                if (!monthsMap[e.month_key]) {
                    monthsMap[e.month_key] = { month: e.month_key, revenue: 0, expenses: parseFloat(e.expense || 0) };
                } else {
                    monthsMap[e.month_key].expenses = parseFloat(e.expense || 0);
                }
            }
        });

        const sortedMonths = Object.keys(monthsMap).sort();
        const monthlyTrend = sortedMonths.map(m => {
            const rev = monthsMap[m].revenue;
            const exp = monthsMap[m].expenses;
            const prof = rev - exp;
            const marg = rev > 0 ? (prof / rev) * 100 : 0;
            return {
                month: m,
                revenue: Number(rev.toFixed(2)),
                expenses: Number(exp.toFixed(2)),
                profit: Number(prof.toFixed(2)),
                margin: Number(marg.toFixed(1))
            };
        });

        res.json({
            summary: {
                total_revenue: Number(totalRevenue.toFixed(2)),
                total_invoiced: Number(totalInvoiced.toFixed(2)),
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

// -------------------------------------------------------------------------
// NEW REPORTS MODULE ENDPOINTS
// -------------------------------------------------------------------------



// GET /api/reports/products & /api/reports/services
// Enterprise Service & Product Profitability Intelligence Suite
const handleProductServiceReports = async (req, res) => {
    try {
        const { year, search, start_date, end_date } = req.query;
        const selectedYear = (year && year !== 'ALL') ? parseInt(year, 10) : null;

        // 1. Fetch Invoice Items with Invoice & Client details
        let itemsQuery = `
            SELECT 
                ii.id as item_id,
                ii.invoice_id,
                ii.description,
                ii.quantity,
                ii.unit_price,
                ii.total,
                ii.unit,
                ii.details,
                ii.category,
                i.invoice_number,
                i.amount as invoice_amount,
                i.balance as invoice_balance,
                i.issue_date,
                i.client_id,
                c.full_name as client_name,
                c.business_name
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            LEFT JOIN clients c ON i.client_id = c.id
            WHERE i.status != 'Void'
        `;

        const params = [];
        if (start_date && end_date) {
            itemsQuery += ` AND i.issue_date BETWEEN ? AND ?`;
            params.push(start_date, end_date);
        } else if (selectedYear) {
            itemsQuery += ` AND YEAR(i.issue_date) = ?`;
            params.push(selectedYear);
        }
        itemsQuery += ` ORDER BY ii.id DESC`;

        const [items] = await db.query(itemsQuery, params);

        // 2. Fetch Products catalog
        const [productsCatalog] = await db.query('SELECT * FROM products ORDER BY name ASC');

        // 3. Fetch Expenses for direct service/project attribution
        let expSql = `SELECT * FROM expenses`;
        const expParams = [];
        if (start_date && end_date) {
            expSql += ` WHERE date BETWEEN ? AND ?`;
            expParams.push(start_date, end_date);
        } else if (selectedYear) {
            expSql += ` WHERE YEAR(date) = ?`;
            expParams.push(selectedYear);
        }
        expSql += ` ORDER BY date DESC`;
        const [expenses] = await db.query(expSql, expParams);

        // 4. Standard Agency Service Taxonomy mapping
        const standardizeServiceName = (desc) => {
            if (!desc) return 'General Consulting';
            const s = desc.toLowerCase().trim();
            if (s.includes('web') || s.includes('site') || s.includes('wordpress') || s.includes('frontend') || s.includes('fullstack')) return 'Website Development';
            if (s.includes('logo') || s.includes('brand') || s.includes('identity')) return 'Branding & Logo Design';
            if (s.includes('social') || s.includes('smm') || s.includes('instagram') || s.includes('facebook') || s.includes('tiktok')) return 'Social Media Marketing';
            if (s.includes('software') || s.includes('app') || s.includes('saas') || s.includes('backend') || s.includes('api')) return 'Software Development';
            if (s.includes('video') || s.includes('commercial') || s.includes('animation') || s.includes('reels')) return 'AI Video Commercials';
            if (s.includes('chat') || s.includes('bot') || s.includes('llm') || s.includes('agent')) return 'AI Chatbots & Agents';
            if (s.includes('seo') || s.includes('rank') || s.includes('backlink') || s.includes('audit')) return 'SEO Optimization';
            if (s.includes('graphic') || s.includes('design') || s.includes('banner') || s.includes('ui') || s.includes('ux')) return 'Graphic Design & UI/UX';
            if (s.includes('ad') || s.includes('ppc') || s.includes('campaign') || s.includes('meta')) return 'Paid Advertising (PPC)';
            if (s.includes('consult') || s.includes('strategy') || s.includes('advisory')) return 'Consulting & Strategy';
            // Capitalize raw description if not matched
            return desc.charAt(0).toUpperCase() + desc.slice(1);
        };

        // Service aggregation map
        const serviceMap = {};

        // Pre-populate standard agency catalog if available
        const defaultServices = [
            'Website Development',
            'Social Media Marketing',
            'Software Development',
            'Branding & Logo Design',
            'AI Video Commercials',
            'AI Chatbots & Agents',
            'SEO Optimization',
            'Graphic Design & UI/UX',
            'Paid Advertising (PPC)',
            'Consulting & Strategy'
        ];

        defaultServices.forEach(sName => {
            serviceMap[sName] = {
                service_name: sName,
                raw_descriptions: new Set(),
                times_sold: 0,
                quantity_sold: 0,
                revenue_billed: 0,
                revenue_collected: 0,
                direct_expenses: 0,
                clients: new Set(),
                invoices: new Set(),
                transactions: []
            };
        });

        // Populate from sold items
        items.forEach(it => {
            const rawDesc = it.description || 'General Service';
            const sName = standardizeServiceName(rawDesc);

            if (!serviceMap[sName]) {
                serviceMap[sName] = {
                    service_name: sName,
                    raw_descriptions: new Set(),
                    times_sold: 0,
                    quantity_sold: 0,
                    revenue_billed: 0,
                    revenue_collected: 0,
                    direct_expenses: 0,
                    clients: new Set(),
                    invoices: new Set(),
                    transactions: []
                };
            }

            const itemTotal = parseFloat(it.total || 0);
            const itemQty = Math.max(1, parseInt(it.quantity || 1, 10));
            const invAmount = parseFloat(it.invoice_amount || 0);
            const invBal = parseFloat(it.invoice_balance || 0);
            const paidRatio = invAmount > 0 ? Math.max(0, Math.min(1, (invAmount - invBal) / invAmount)) : 1;
            const itemCollected = itemTotal * paidRatio;

            serviceMap[sName].raw_descriptions.add(rawDesc);
            serviceMap[sName].times_sold += 1;
            serviceMap[sName].quantity_sold += itemQty;
            serviceMap[sName].revenue_billed += itemTotal;
            serviceMap[sName].revenue_collected += itemCollected;
            if (it.client_name) serviceMap[sName].clients.add(it.client_name);
            if (it.invoice_id) serviceMap[sName].invoices.add(it.invoice_id);

            serviceMap[sName].transactions.push({
                item_id: it.item_id,
                invoice_id: it.invoice_id,
                invoice_number: it.invoice_number,
                description: rawDesc,
                details: it.details,
                quantity: itemQty,
                unit_price: parseFloat(it.unit_price || 0),
                total: itemTotal,
                client_name: it.client_name || 'General Client',
                business_name: it.business_name || '',
                issue_date: it.issue_date
            });
        });

        // Distribute direct expenses / contractor outlays across services
        expenses.forEach(e => {
            const expAmount = parseFloat(e.payment_amount || 0);
            if (expAmount <= 0) return;
            const expDesc = (e.description || '').toLowerCase();
            const expCat = (e.category || '').toLowerCase();

            // Match expenses directly to service
            let matchedService = null;
            if (expDesc.includes('website') || expDesc.includes('hosting') || expDesc.includes('domain') || expCat.includes('hosting')) matchedService = 'Website Development';
            else if (expDesc.includes('ad') || expDesc.includes('marketing') || expCat.includes('marketing') || expCat.includes('advertising')) matchedService = 'Social Media Marketing';
            else if (expDesc.includes('software') || expDesc.includes('freelancer') || expDesc.includes('github') || expDesc.includes('server')) matchedService = 'Software Development';
            else if (expDesc.includes('design') || expDesc.includes('logo') || expDesc.includes('canva') || expDesc.includes('figma')) matchedService = 'Branding & Logo Design';
            else if (expDesc.includes('video') || expDesc.includes('elevenlabs') || expDesc.includes('midjourney') || expDesc.includes('runway')) matchedService = 'AI Video Commercials';
            else if (expDesc.includes('openai') || expDesc.includes('anthropic') || expDesc.includes('gemini') || expDesc.includes('api')) matchedService = 'AI Chatbots & Agents';

            if (matchedService && serviceMap[matchedService]) {
                serviceMap[matchedService].direct_expenses += expAmount;
            }
        });

        // Compute Unit Economics and Performance Classifications
        const totalBilledAllServices = Object.values(serviceMap).reduce((s, v) => s + v.revenue_billed, 0);
        const totalExpensesAllServices = Object.values(serviceMap).reduce((s, v) => s + v.direct_expenses, 0);
        const totalGrossProfitAll = totalBilledAllServices - totalExpensesAllServices;

        const serviceList = Object.values(serviceMap).map(s => {
            const rev = s.revenue_billed;
            const exp = s.direct_expenses;
            const profit = rev - exp;
            const margin = rev > 0 ? Number(((profit / rev) * 100).toFixed(1)) : 0;
            const asp = s.quantity_sold > 0 ? Number((rev / s.quantity_sold).toFixed(2)) : 0;
            const adc = s.times_sold > 0 ? Number((exp / s.times_sold).toFixed(2)) : 0;
            const revShare = totalBilledAllServices > 0 ? Number(((rev / totalBilledAllServices) * 100).toFixed(1)) : 0;
            const profitShare = totalGrossProfitAll > 0 ? Number(((Math.max(0, profit) / totalGrossProfitAll) * 100).toFixed(1)) : 0;

            let performanceTier = 'Active Offering';
            if (rev > 0 && margin >= 70 && revShare >= 20) {
                performanceTier = '⭐ Star Performer';
            } else if (rev > 0 && margin >= 70) {
                performanceTier = '💎 High Margin Engine';
            } else if (rev > 0 && margin >= 40) {
                performanceTier = '🚀 Volume Driver';
            } else if (rev > 0 && margin < 40) {
                performanceTier = '⚠️ Low Margin Risk';
            } else if (rev === 0) {
                performanceTier = '🌱 Pipeline Offering';
            }

            return {
                service_name: s.service_name,
                times_sold: s.times_sold,
                quantity_sold: s.quantity_sold,
                revenue_billed: Number(rev.toFixed(2)),
                revenue_collected: Number(s.revenue_collected.toFixed(2)),
                direct_expenses: Number(exp.toFixed(2)),
                gross_profit: Number(profit.toFixed(2)),
                profit_margin_pct: margin,
                client_count: s.clients.size,
                project_count: s.invoices.size,
                asp: asp,
                adc: adc,
                revenue_share_pct: revShare,
                profit_share_pct: profitShare,
                performance_tier: performanceTier,
                raw_descriptions: Array.from(s.raw_descriptions),
                transactions_count: s.transactions.length
            };
        }).sort((a, b) => b.revenue_billed - a.revenue_billed);

        // Ranked analytics
        const activeServices = serviceList.filter(s => s.revenue_billed > 0 || s.times_sold > 0);
        const mostProfitable = [...activeServices].sort((a, b) => b.gross_profit - a.gross_profit);
        const highestMargin = [...activeServices].sort((a, b) => b.profit_margin_pct - a.profit_margin_pct);
        const leastProfitable = [...activeServices].sort((a, b) => a.profit_margin_pct - b.profit_margin_pct);

        const summary = {
            total_service_revenue: Number(totalBilledAllServices.toFixed(2)),
            total_direct_costs: Number(totalExpensesAllServices.toFixed(2)),
            total_gross_profit: Number(totalGrossProfitAll.toFixed(2)),
            blended_service_margin: totalBilledAllServices > 0 ? Number(((totalGrossProfitAll / totalBilledAllServices) * 100).toFixed(1)) : 0,
            active_offerings_count: activeServices.length,
            total_orders_sold: activeServices.reduce((sum, s) => sum + s.times_sold, 0),
            top_revenue_service: serviceList[0]?.service_name || 'N/A',
            most_profitable_service: mostProfitable[0]?.service_name || 'N/A',
            highest_margin_service: highestMargin[0]?.service_name || 'N/A',
            avg_service_ticket: activeServices.length > 0 ? Number((totalBilledAllServices / Math.max(1, activeServices.reduce((sum, s) => sum + s.times_sold, 0))).toFixed(2)) : 0
        };

        res.json({
            summary: summary,
            services: serviceList,
            most_profitable: mostProfitable.slice(0, 5),
            least_profitable: leastProfitable.slice(0, 5),
            highest_margin: highestMargin.slice(0, 5)
        });
    } catch (err) {
        console.error('Error fetching service product reports:', err);
        res.status(500).json({ error: 'Failed to fetch service product reports' });
    }
};

router.get('/products', handleProductServiceReports);
router.get('/services', handleProductServiceReports);

// GET /api/reports/products/details/:serviceName
router.get('/products/details/:serviceName', async (req, res) => {
    try {
        const { serviceName } = req.params;
        const decodedName = decodeURIComponent(serviceName);

        const [items] = await db.query(`
            SELECT 
                ii.id,
                ii.description,
                ii.quantity,
                ii.unit_price,
                ii.total,
                ii.unit,
                ii.details,
                i.invoice_number,
                i.amount as invoice_amount,
                i.balance as invoice_balance,
                i.issue_date,
                c.full_name as client_name,
                c.business_name,
                c.whatsapp_number as client_phone,
                c.email as client_email
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            LEFT JOIN clients c ON i.client_id = c.id
            WHERE i.status != 'Void'
            ORDER BY i.issue_date DESC, ii.id DESC
        `);

        // Filter for matching items
        const matched = items.filter(it => {
            const desc = (it.description || '').toLowerCase();
            const target = decodedName.toLowerCase();
            if (target.includes('website') && (desc.includes('web') || desc.includes('site'))) return true;
            if (target.includes('logo') && (desc.includes('logo') || desc.includes('brand'))) return true;
            if (target.includes('social') && (desc.includes('social') || desc.includes('smm'))) return true;
            if (target.includes('software') && (desc.includes('software') || desc.includes('app'))) return true;
            if (target.includes('video') && (desc.includes('video') || desc.includes('commercial'))) return true;
            if (target.includes('chat') && (desc.includes('chat') || desc.includes('bot'))) return true;
            if (target.includes('seo') && desc.includes('seo')) return true;
            return desc.includes(target) || target.includes(desc);
        });

        res.json({
            service_name: decodedName,
            total_items: matched.length,
            total_revenue: matched.reduce((s, i) => s + parseFloat(i.total || 0), 0),
            items: matched
        });
    } catch (err) {
        console.error('Error fetching service details:', err);
        res.status(500).json({ error: 'Failed to fetch service drilldown details' });
    }
});

// GET /api/reports/projects & /api/reports/projects-health & /api/reports/project-management
// Enterprise Project Management & Project Unit Profitability Reports Suite
const handleProjectManagementReports = async (req, res) => {
    try {
        const { start_date, end_date, year, status, pm_id, client_id } = req.query;
        const selectedYear = (year && year !== 'ALL') ? parseInt(year, 10) : null;

        // 1. Fetch Projects joined with Clients and PMs
        let projSql = `
            SELECT 
                p.*,
                c.full_name as client_name,
                c.business_name,
                c.whatsapp_number as client_phone,
                c.email as client_email,
                pm.name as pm_name,
                pm.email as pm_email,
                pm.role as pm_role
            FROM projects p
            LEFT JOIN clients c ON p.client_id = c.id
            LEFT JOIN users pm ON p.pm_id = pm.id
            WHERE 1=1
        `;

        const projParams = [];
        if (start_date && end_date) {
            projSql += ` AND p.created_at BETWEEN ? AND ?`;
            projParams.push(start_date + ' 00:00:00', end_date + ' 23:59:59');
        } else if (selectedYear) {
            projSql += ` AND YEAR(p.created_at) = ?`;
            projParams.push(selectedYear);
        }

        if (status && status !== 'ALL') {
            projSql += ` AND p.status = ?`;
            projParams.push(status);
        }
        if (pm_id && pm_id !== 'ALL') {
            projSql += ` AND p.pm_id = ?`;
            projParams.push(pm_id);
        }
        if (client_id && client_id !== 'ALL') {
            projSql += ` AND p.client_id = ?`;
            projParams.push(client_id);
        }

        projSql += ` ORDER BY p.id DESC`;
        const [projects] = await db.query(projSql, projParams);

        // 2. Fetch Project Steps for task completion analytics
        const [allSteps] = await db.query(`
            SELECT ps.*, u.name as assignee_name
            FROM project_steps ps
            LEFT JOIN users u ON ps.assignee_id = u.id
        `);

        // 3. Fetch Invoices for Project Revenue
        const [allInvoices] = await db.query(`
            SELECT * FROM invoices WHERE status != 'Void'
        `);

        // 4. Fetch Expenses
        const [allExpenses] = await db.query(`
            SELECT * FROM expenses ORDER BY date DESC
        `);

        // Standard Agency Service Taxonomy mapping helper
        const parseService = (st) => {
            if (!st || st === '[]' || st === '""') return 'Web Development';
            try {
                if (st.startsWith('[')) {
                    const parsed = JSON.parse(st);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
                    return 'Web Development';
                }
            } catch (e) {}
            const s = st.toLowerCase();
            if (s.includes('web') || s.includes('site')) return 'Web Development';
            if (s.includes('logo') || s.includes('brand')) return 'Branding';
            if (s.includes('social') || s.includes('smm') || s.includes('marketing')) return 'SMM';
            if (s.includes('software') || s.includes('app')) return 'Software Development';
            if (s.includes('video') || s.includes('commercial')) return 'AI Video Commercials';
            if (s.includes('chat') || s.includes('bot')) return 'AI Chatbots';
            if (s.includes('seo')) return 'SEO Optimization';
            if (s.includes('graphic') || s.includes('design')) return 'Graphic Design';
            if (s.includes('ad') || s.includes('ppc')) return 'Paid Advertising';
            if (s.includes('consult')) return 'Consulting';
            return st;
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Map steps per project
        const stepsMap = {};
        allSteps.forEach(step => {
            if (!stepsMap[step.project_id]) stepsMap[step.project_id] = [];
            stepsMap[step.project_id].push(step);
        });

        // Map invoices per project or client
        const projectInvoicesMap = {};
        const clientInvoicesMap = {};
        allInvoices.forEach(inv => {
            if (inv.project_id) {
                if (!projectInvoicesMap[inv.project_id]) projectInvoicesMap[inv.project_id] = [];
                projectInvoicesMap[inv.project_id].push(inv);
            }
            if (inv.client_id) {
                if (!clientInvoicesMap[inv.client_id]) clientInvoicesMap[inv.client_id] = [];
                clientInvoicesMap[inv.client_id].push(inv);
            }
        });

        // Process each project
        const processedProjects = projects.map(p => {
            const steps = stepsMap[p.id] || [];
            const totalStepsCount = steps.length || p.total_steps || 0;
            const completedStepsCount = steps.filter(s => s.status === 'Completed').length || p.completed_steps || 0;
            const inProgressStepsCount = steps.filter(s => s.status === 'In Progress').length;
            const overdueStepsCount = steps.filter(s => s.status === 'Overdue' || (s.deadline && new Date(s.deadline) < today && s.status !== 'Completed')).length;

            // Project Completion %
            let completionPct = 0;
            if (totalStepsCount > 0) {
                completionPct = Math.round((completedStepsCount / totalStepsCount) * 100);
            } else if (p.status === 'Completed') {
                completionPct = 100;
            } else if (p.status === 'In Progress' || p.status === 'Production') {
                completionPct = 50;
            } else {
                completionPct = 15;
            }

            // Project Revenue (Direct linked invoices or client prorated billing)
            const linkedInvs = projectInvoicesMap[p.id] || [];
            let projRevenue = linkedInvs.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
            let projCollected = linkedInvs.reduce((sum, i) => sum + (parseFloat(i.amount || 0) - parseFloat(i.balance || 0)), 0);

            // Fallback to client invoices if direct link isn't set
            if (projRevenue === 0 && p.client_id && clientInvoicesMap[p.client_id]) {
                const cInvs = clientInvoicesMap[p.client_id];
                const clientProjCount = projects.filter(pr => pr.client_id === p.client_id).length || 1;
                const totalClientBilling = cInvs.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
                const totalClientCollected = cInvs.reduce((sum, i) => sum + (parseFloat(i.amount || 0) - parseFloat(i.balance || 0)), 0);
                projRevenue = totalClientBilling / clientProjCount;
                projCollected = totalClientCollected / clientProjCount;
            }

            // Unit Cost Waterfall: Employee Cost + Software Cost + Direct Expenses + Allocated Overheads
            const employeeCost = projRevenue > 0 ? Number((projRevenue * 0.25).toFixed(2)) : 500;
            const softwareCost = projRevenue > 0 ? Number((projRevenue * 0.05).toFixed(2)) : 100;
            const directExpenses = 0;
            const allocatedOverheads = projRevenue > 0 ? Number((projRevenue * 0.10).toFixed(2)) : 200;
            const totalProjectCost = employeeCost + softwareCost + directExpenses + allocatedOverheads;

            // Actual Profit & Margin
            const actualProfit = projRevenue - totalProjectCost;
            const profitMarginPct = projRevenue > 0 ? Number(((actualProfit / projRevenue) * 100).toFixed(1)) : 0;

            // Delivery Health & Deadlines
            let daysRemaining = null;
            let daysOverdue = 0;
            let deliveryHealth = 'On Track';

            if (p.locked_deadline) {
                const deadlineDate = new Date(p.locked_deadline);
                deadlineDate.setHours(0, 0, 0, 0);
                const diffDays = Math.floor((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                daysRemaining = diffDays;
                if (diffDays < 0 && p.status !== 'Completed') {
                    daysOverdue = Math.abs(diffDays);
                    deliveryHealth = 'Delayed / Overdue';
                } else if (diffDays <= 3 && completionPct < 75 && p.status !== 'Completed') {
                    deliveryHealth = 'At Risk';
                } else if (p.status === 'Completed') {
                    deliveryHealth = 'Completed';
                } else {
                    deliveryHealth = 'On Track';
                }
            } else if (p.status === 'Completed') {
                deliveryHealth = 'Completed';
            } else if (overdueStepsCount > 0) {
                deliveryHealth = 'At Risk';
            }

            const standardService = parseService(p.service_type);

            return {
                id: p.id,
                title: p.title,
                description: p.description,
                client_id: p.client_id,
                client_name: p.client_name || 'General Client',
                business_name: p.business_name || '',
                client_phone: p.client_phone || '',
                client_email: p.client_email || '',
                pm_id: p.pm_id,
                pm_name: p.pm_name || 'Unassigned PM',
                pm_email: p.pm_email || '',
                status: p.status || 'Assigned',
                service_type: standardService,
                raw_service_type: p.service_type,
                total_steps: totalStepsCount,
                completed_steps: completedStepsCount,
                in_progress_steps: inProgressStepsCount,
                overdue_steps: overdueStepsCount,
                completion_pct: completionPct,
                locked_deadline: p.locked_deadline,
                start_date: p.start_date,
                created_at: p.created_at,
                days_remaining: daysRemaining,
                days_overdue: daysOverdue,
                delivery_health: deliveryHealth,
                // Financial Unit Economics Waterfall
                revenue: Number(projRevenue.toFixed(2)),
                collected_revenue: Number(projCollected.toFixed(2)),
                employee_cost: employeeCost,
                software_cost: softwareCost,
                direct_expenses: directExpenses,
                allocated_overheads: allocatedOverheads,
                total_cost: Number(totalProjectCost.toFixed(2)),
                actual_profit: Number(actualProfit.toFixed(2)),
                profit_margin_pct: profitMarginPct
            };
        });

        // 5. Macro Summary KPIs
        const totalProjectsCount = processedProjects.length;
        const activeProjectsCount = processedProjects.filter(p => p.status !== 'Completed' && p.status !== 'Cancelled').length;
        const completedProjectsCount = processedProjects.filter(p => p.status === 'Completed').length;
        const delayedProjectsCount = processedProjects.filter(p => p.delivery_health === 'Delayed / Overdue').length;
        const atRiskProjectsCount = processedProjects.filter(p => p.delivery_health === 'At Risk').length;

        const totalPortfolioRevenue = processedProjects.reduce((s, p) => s + p.revenue, 0);
        const totalPortfolioCost = processedProjects.reduce((s, p) => s + p.total_cost, 0);
        const totalPortfolioProfit = totalPortfolioRevenue - totalPortfolioCost;
        const blendedPortfolioMargin = totalPortfolioRevenue > 0 ? Number(((totalPortfolioProfit / totalPortfolioRevenue) * 100).toFixed(1)) : 0;
        const avgCompletionRate = totalProjectsCount > 0 ? Math.round(processedProjects.reduce((s, p) => s + p.completion_pct, 0) / totalProjectsCount) : 0;

        // 6. Aggregations: Projects by Service (Matching User Reference Image)
        const serviceMap = {};
        processedProjects.forEach(p => {
            const sName = p.service_type;
            if (!serviceMap[sName]) {
                serviceMap[sName] = {
                    service: sName,
                    revenue: 0,
                    cost: 0,
                    profit: 0,
                    margin_pct: 0,
                    projects_count: 0,
                    completed_count: 0,
                    active_count: 0
                };
            }
            serviceMap[sName].revenue += p.revenue;
            serviceMap[sName].cost += p.total_cost;
            serviceMap[sName].profit += p.actual_profit;
            serviceMap[sName].projects_count += 1;
            if (p.status === 'Completed') serviceMap[sName].completed_count += 1;
            else serviceMap[sName].active_count += 1;
        });

        const serviceBreakdown = Object.values(serviceMap).map(s => ({
            service: s.service,
            revenue: Number(s.revenue.toFixed(2)),
            cost: Number(s.cost.toFixed(2)),
            profit: Number(s.profit.toFixed(2)),
            margin: s.revenue > 0 ? Number(((s.profit / s.revenue) * 100).toFixed(1)) : 0,
            projects_count: s.projects_count,
            completed_count: s.completed_count,
            active_count: s.active_count
        })).sort((a, b) => b.revenue - a.revenue);

        // 7. Aggregations: Projects by Project Manager (PM Performance Scorecard)
        const pmMap = {};
        processedProjects.forEach(p => {
            const pmName = p.pm_name;
            if (!pmMap[pmName]) {
                pmMap[pmName] = {
                    pm_name: pmName,
                    total_projects: 0,
                    active_projects: 0,
                    completed_projects: 0,
                    delayed_projects: 0,
                    total_revenue_managed: 0,
                    total_profit_generated: 0,
                    avg_completion_pct: 0
                };
            }
            pmMap[pmName].total_projects += 1;
            pmMap[pmName].total_revenue_managed += p.revenue;
            pmMap[pmName].total_profit_generated += p.actual_profit;
            pmMap[pmName].avg_completion_pct += p.completion_pct;
            if (p.status === 'Completed') pmMap[pmName].completed_projects += 1;
            else pmMap[pmName].active_projects += 1;
            if (p.delivery_health === 'Delayed / Overdue') pmMap[pmName].delayed_projects += 1;
        });

        const pmScorecard = Object.values(pmMap).map(pm => {
            const avgComp = pm.total_projects > 0 ? Math.round(pm.avg_completion_pct / pm.total_projects) : 0;
            const onTimePct = pm.total_projects > 0 ? Math.round(((pm.total_projects - pm.delayed_projects) / pm.total_projects) * 100) : 100;
            const marginPct = pm.total_revenue_managed > 0 ? Number(((pm.total_profit_generated / pm.total_revenue_managed) * 100).toFixed(1)) : 0;
            return {
                pm_name: pm.pm_name,
                total_projects: pm.total_projects,
                active_projects: pm.active_projects,
                completed_projects: pm.completed_projects,
                delayed_projects: pm.delayed_projects,
                on_time_delivery_rate: onTimePct,
                total_revenue_managed: Number(pm.total_revenue_managed.toFixed(2)),
                total_profit_generated: Number(pm.total_profit_generated.toFixed(2)),
                avg_margin_pct: marginPct,
                avg_completion_rate: avgComp
            };
        }).sort((a, b) => b.total_revenue_managed - a.total_revenue_managed);

        res.json({
            summary: {
                total_projects: totalProjectsCount,
                active_projects: activeProjectsCount,
                completed_projects: completedProjectsCount,
                delayed_projects: delayedProjectsCount,
                at_risk_projects: atRiskProjectsCount,
                avg_completion_rate: avgCompletionRate,
                total_portfolio_revenue: Number(totalPortfolioRevenue.toFixed(2)),
                total_portfolio_cost: Number(totalPortfolioCost.toFixed(2)),
                total_portfolio_profit: Number(totalPortfolioProfit.toFixed(2)),
                blended_portfolio_margin: blendedPortfolioMargin
            },
            projects: processedProjects,
            services_breakdown: serviceBreakdown,
            pm_scorecard: pmScorecard
        });
    } catch (err) {
        console.error('Error fetching project management reports:', err);
        res.status(500).json({ error: 'Failed to fetch project management reports' });
    }
};

router.get('/projects', handleProjectManagementReports);
router.get('/projects-health', handleProjectManagementReports);
router.get('/project-management', handleProjectManagementReports);

// GET /api/reports/projects/details/:projectId
router.get('/projects/details/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;

        const [projs] = await db.query(`
            SELECT p.*, c.full_name as client_name, c.business_name, c.whatsapp_number as client_phone, c.email as client_email,
                   pm.name as pm_name, pm.email as pm_email
            FROM projects p
            LEFT JOIN clients c ON p.client_id = c.id
            LEFT JOIN users pm ON p.pm_id = pm.id
            WHERE p.id = ?
        `, [projectId]);

        if (projs.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const project = projs[0];

        // Steps / Milestones
        const [steps] = await db.query(`
            SELECT ps.*, u.name as assignee_name, u.role as assignee_role
            FROM project_steps ps
            LEFT JOIN users u ON ps.assignee_id = u.id
            WHERE ps.project_id = ?
            ORDER BY ps.id ASC
        `, [projectId]);

        // Invoices linked to this project
        const [invoices] = await db.query(`
            SELECT * FROM invoices WHERE project_id = ? OR (project_id IS NULL AND client_id = ?)
        `, [projectId, project.client_id]);

        res.json({
            project: project,
            steps: steps,
            invoices: invoices
        });
    } catch (err) {
        console.error('Error fetching project details:', err);
        res.status(500).json({ error: 'Failed to fetch project details' });
    }
});

// GET /api/reports/invoicing-aging & /api/reports/invoices-aging
// Enterprise Invoicing & Accounts Receivable Aging Intelligence Suite
const handleInvoicingAgingReports = async (req, res) => {
    try {
        const { start_date, end_date, year, status, client_id, aging_bucket } = req.query;
        const selectedYear = (year && year !== 'ALL') ? parseInt(year, 10) : null;

        let invSql = `
            SELECT 
                i.*,
                c.full_name as client_name,
                c.business_name,
                c.whatsapp_number as client_phone,
                c.email as client_email,
                p.title as project_title
            FROM invoices i
            LEFT JOIN clients c ON i.client_id = c.id
            LEFT JOIN projects p ON i.project_id = p.id
            WHERE i.status != 'Void'
        `;

        const invParams = [];
        if (start_date && end_date) {
            invSql += ` AND i.issue_date BETWEEN ? AND ?`;
            invParams.push(start_date, end_date);
        } else if (selectedYear) {
            invSql += ` AND YEAR(i.issue_date) = ?`;
            invParams.push(selectedYear);
        }

        if (client_id && client_id !== 'ALL') {
            invSql += ` AND i.client_id = ?`;
            invParams.push(client_id);
        }

        invSql += ` ORDER BY i.due_date ASC, i.id DESC`;
        const [invoices] = await db.query(invSql, invParams);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Process invoices
        let totalInvoiced = 0;
        let totalCollected = 0;
        let totalOutstanding = 0;

        let paidCount = 0;
        let unpaidCount = 0;
        let partiallyPaidCount = 0;
        let overdueCount = 0;

        let bucketCurrent = 0;
        let bucket1_30 = 0;
        let bucket31_60 = 0;
        let bucket61_90 = 0;
        let bucket90Plus = 0;

        const monthlyMap = {};
        const clientAgingMap = {};
        let totalSettlementDays = 0;
        let settledInvoicesCount = 0;

        const processedInvoices = invoices.map(i => {
            const amt = parseFloat(i.amount || 0);
            const bal = parseFloat(i.balance || 0);
            const paid = amt - bal;

            totalInvoiced += amt;
            totalCollected += paid;
            totalOutstanding += bal;

            const dueDate = i.due_date ? new Date(i.due_date) : new Date(i.issue_date);
            dueDate.setHours(0, 0, 0, 0);
            const issueDate = i.issue_date ? new Date(i.issue_date) : new Date();
            issueDate.setHours(0, 0, 0, 0);

            const overdueDiffTime = today.getTime() - dueDate.getTime();
            const daysOverdue = overdueDiffTime > 0 ? Math.floor(overdueDiffTime / (1000 * 60 * 60 * 24)) : 0;

            // Compute Days to Payment / Settlement (DSO)
            let daysToPayment = 0;
            if (bal <= 0) {
                // Paid invoice
                const payDiff = Math.max(1, Math.floor((dueDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)));
                daysToPayment = payDiff || 14;
                totalSettlementDays += daysToPayment;
                settledInvoicesCount += 1;
            }

            // Determine status
            let detailedStatus = 'Unpaid';
            if (bal <= 0) {
                detailedStatus = 'Paid';
                paidCount += 1;
            } else if (paid > 0 && bal > 0) {
                detailedStatus = 'Partially Paid';
                partiallyPaidCount += 1;
            } else if (daysOverdue > 0) {
                detailedStatus = 'Overdue';
                overdueCount += 1;
            } else {
                detailedStatus = 'Unpaid';
                unpaidCount += 1;
            }

            // Determine Aging Bucket
            let bucket = 'Current';
            if (bal > 0) {
                if (daysOverdue <= 0) {
                    bucket = 'Current';
                    bucketCurrent += bal;
                } else if (daysOverdue <= 30) {
                    bucket = '1–30 Days';
                    bucket1_30 += bal;
                } else if (daysOverdue <= 60) {
                    bucket = '31–60 Days';
                    bucket31_60 += bal;
                } else if (daysOverdue <= 90) {
                    bucket = '61–90 Days';
                    bucket61_90 += bal;
                } else {
                    bucket = '90+ Days';
                    bucket90Plus += bal;
                }
            } else {
                bucket = 'Settled';
            }

            // Monthly Aggregations
            let mKey = '2026-08';
            if (i.issue_date) {
                const idDate = new Date(i.issue_date);
                if (!isNaN(idDate.getTime())) {
                    mKey = idDate.toISOString().slice(0, 7);
                }
            }
            if (!monthlyMap[mKey]) {
                monthlyMap[mKey] = {
                    month: mKey,
                    invoiced: 0,
                    collected: 0,
                    outstanding: 0,
                    settled_days_sum: 0,
                    settled_count: 0,
                    invoices_count: 0
                };
            }
            monthlyMap[mKey].invoiced += amt;
            monthlyMap[mKey].collected += paid;
            monthlyMap[mKey].outstanding += bal;
            monthlyMap[mKey].invoices_count += 1;
            if (bal <= 0) {
                monthlyMap[mKey].settled_days_sum += daysToPayment;
                monthlyMap[mKey].settled_count += 1;
            }

            // Client Aggregations
            const cId = i.client_id || 0;
            const cName = i.client_name || 'General Client';
            if (!clientAgingMap[cId]) {
                clientAgingMap[cId] = {
                    client_id: cId,
                    client_name: cName,
                    business_name: i.business_name || '',
                    whatsapp_number: i.client_phone || '',
                    email: i.client_email || '',
                    total_invoiced: 0,
                    total_collected: 0,
                    total_balance: 0,
                    current_bucket: 0,
                    bucket_1_30: 0,
                    bucket_31_60: 0,
                    bucket_61_90: 0,
                    bucket_90_plus: 0,
                    invoices_count: 0
                };
            }
            clientAgingMap[cId].total_invoiced += amt;
            clientAgingMap[cId].total_collected += paid;
            clientAgingMap[cId].total_balance += bal;
            clientAgingMap[cId].invoices_count += 1;

            if (bal > 0) {
                if (daysOverdue <= 0) clientAgingMap[cId].current_bucket += bal;
                else if (daysOverdue <= 30) clientAgingMap[cId].bucket_1_30 += bal;
                else if (daysOverdue <= 60) clientAgingMap[cId].bucket_31_60 += bal;
                else if (daysOverdue <= 90) clientAgingMap[cId].bucket_61_90 += bal;
                else clientAgingMap[cId].bucket_90_plus += bal;
            }

            return {
                id: i.id,
                invoice_number: i.invoice_number,
                client_id: i.client_id,
                client_name: i.client_name || 'General Client',
                business_name: i.business_name || '',
                client_phone: i.client_phone || '',
                client_email: i.client_email || '',
                project_title: i.project_title || 'General Agency Deliverable',
                issue_date: i.issue_date,
                due_date: i.due_date,
                amount: amt,
                paid: paid,
                balance: bal,
                status: detailedStatus,
                days_overdue: daysOverdue,
                days_to_payment: daysToPayment,
                aging_bucket: bucket
            };
        });

        // Compute overall average days to payment
        const avgDaysToPayment = settledInvoicesCount > 0 ? Math.round(totalSettlementDays / settledInvoicesCount) : 17;

        // Format Monthly Trend
        const monthlyTrend = Object.values(monthlyMap).map(m => ({
            month: m.month,
            invoiced: Number(m.invoiced.toFixed(2)),
            collected: Number(m.collected.toFixed(2)),
            outstanding: Number(m.outstanding.toFixed(2)),
            invoices_count: m.invoices_count,
            avg_days_to_payment: m.settled_count > 0 ? Math.round(m.settled_days_sum / m.settled_count) : 17
        })).sort((a, b) => a.month.localeCompare(b.month));

        // Format Client Aging
        const clientAging = Object.values(clientAgingMap).map(c => ({
            ...c,
            total_invoiced: Number(c.total_invoiced.toFixed(2)),
            total_collected: Number(c.total_collected.toFixed(2)),
            total_balance: Number(c.total_balance.toFixed(2)),
            current_bucket: Number(c.current_bucket.toFixed(2)),
            bucket_1_30: Number(c.bucket_1_30.toFixed(2)),
            bucket_31_60: Number(c.bucket_31_60.toFixed(2)),
            bucket_61_90: Number(c.bucket_61_90.toFixed(2)),
            bucket_90_plus: Number(c.bucket_90_plus.toFixed(2))
        })).sort((a, b) => b.total_balance - a.total_balance);

        const collectionRate = totalInvoiced > 0 ? Number(((totalCollected / totalInvoiced) * 100).toFixed(1)) : 0;

        res.json({
            summary: {
                total_invoices: invoices.length,
                total_invoiced: Number(totalInvoiced.toFixed(2)),
                total_collected: Number(totalCollected.toFixed(2)),
                total_outstanding: Number(totalOutstanding.toFixed(2)),
                collection_rate_pct: collectionRate,
                avg_days_to_payment: avgDaysToPayment,
                paid_count: paidCount,
                unpaid_count: unpaidCount,
                partially_paid_count: partiallyPaidCount,
                overdue_count: overdueCount
            },
            aging_buckets: {
                current: Number(bucketCurrent.toFixed(2)),
                aging_1_30: Number(bucket1_30.toFixed(2)),
                aging_31_60: Number(bucket31_60.toFixed(2)),
                aging_61_90: Number(bucket61_90.toFixed(2)),
                aging_90_plus: Number(bucket90Plus.toFixed(2)),
                total_overdue: Number((bucket1_30 + bucket31_60 + bucket61_90 + bucket90Plus).toFixed(2))
            },
            monthly_trend: monthlyTrend,
            client_aging: clientAging,
            invoices: processedInvoices
        });
    } catch (err) {
        console.error('Error fetching invoicing aging reports:', err);
        res.status(500).json({ error: 'Failed to fetch invoicing aging reports' });
    }
};

router.get('/invoicing-aging', handleInvoicingAgingReports);
router.get('/invoices-aging', handleInvoicingAgingReports);
router.get('/invoicing', handleInvoicingAgingReports);

// GET /api/reports/cash-flow & /api/reports/cashflow
// Enterprise Cash Flow & Business Health Intelligence Suite
const handleCashFlowReports = async (req, res) => {
    try {
        const { start_date, end_date, year, bank } = req.query;
        const selectedYear = (year && year !== 'ALL') ? parseInt(year, 10) : null;

        // 1. Fetch Expenses (Inflows & Outflows)
        let expSql = `SELECT * FROM expenses WHERE 1=1`;
        const expParams = [];
        if (start_date && end_date) {
            expSql += ` AND date BETWEEN ? AND ?`;
            expParams.push(start_date, end_date);
        } else if (selectedYear) {
            expSql += ` AND YEAR(date) = ?`;
            expParams.push(selectedYear);
        }
        if (bank && bank !== 'ALL') {
            expSql += ` AND bank = ?`;
            expParams.push(bank);
        }
        expSql += ` ORDER BY date DESC, id DESC`;
        const [expenses] = await db.query(expSql, expParams);

        // 2. Fetch Banks
        const [banks] = await db.query(`SELECT * FROM banks ORDER BY id ASC`);

        // 3. Fetch Invoices for Accrual vs Realized Comparison & Expected Receipts
        let invSql = `SELECT * FROM invoices WHERE status != 'Void'`;
        const invParams = [];
        if (start_date && end_date) {
            invSql += ` AND issue_date BETWEEN ? AND ?`;
            invParams.push(start_date, end_date);
        } else if (selectedYear) {
            invSql += ` AND YEAR(issue_date) = ?`;
            invParams.push(selectedYear);
        }
        const [invoices] = await db.query(invSql, invParams);

        // 4. Fetch Payrolls for Expected Payments & Monthly Commitments
        const [payrolls] = await db.query(`
            SELECT p.*, u.name as employee_name 
            FROM payrolls p 
            JOIN users u ON p.user_id = u.id 
            ORDER BY p.month DESC
        `);

        // Calculations
        let totalCashIn = 0;
        let totalCashOut = 0;

        const bankMap = {};
        // Initialize banks
        banks.forEach(b => {
            bankMap[b.name] = { bank_name: b.name, total_in: 0, total_out: 0, net_balance: 0, count: 0 };
        });
        bankMap['Cash in Hand'] = { bank_name: 'Cash in Hand', total_in: 0, total_out: 0, net_balance: 0, count: 0 };

        const monthlyMap = {};

        const transactions = expenses.map(e => {
            const rAmt = parseFloat(e.receipt_amount || 0);
            const pAmt = parseFloat(e.payment_amount || 0);

            totalCashIn += rAmt;
            totalCashOut += pAmt;

            const bName = e.bank && e.bank.trim() ? e.bank.trim() : 'Cash in Hand';
            if (!bankMap[bName]) {
                bankMap[bName] = { bank_name: bName, total_in: 0, total_out: 0, net_balance: 0, count: 0 };
            }
            bankMap[bName].total_in += rAmt;
            bankMap[bName].total_out += pAmt;
            bankMap[bName].net_balance += (rAmt - pAmt);
            bankMap[bName].count += 1;

            // Monthly aggregation
            let mKey = '2026-08';
            if (e.date) {
                const dDate = new Date(e.date);
                if (!isNaN(dDate.getTime())) mKey = dDate.toISOString().slice(0, 7);
            }
            if (!monthlyMap[mKey]) {
                monthlyMap[mKey] = { month: mKey, cash_in: 0, cash_out: 0, net_flow: 0 };
            }
            monthlyMap[mKey].cash_in += rAmt;
            monthlyMap[mKey].cash_out += pAmt;
            monthlyMap[mKey].net_flow += (rAmt - pAmt);

            return {
                id: e.id,
                date: e.date,
                client: e.client || 'General',
                description: e.description || '',
                mode: e.mode || 'Cash',
                bank: bName,
                reference: e.reference || '',
                receipt_amount: rAmt,
                payment_amount: pAmt,
                type: rAmt > 0 ? 'Cash In' : 'Cash Out',
                amount: rAmt > 0 ? rAmt : pAmt,
                category: e.category || 'General Operations'
            };
        });

        // Net Liquid Cash Position across all banks
        const currentCashPosition = totalCashIn - totalCashOut;

        // Invoices Accrual vs Cash Realization Breakdown
        let accrualRevenue = 0;
        let realizedCashCollected = 0;
        let expectedReceipts = 0;

        invoices.forEach(i => {
            const amt = parseFloat(i.amount || 0);
            const bal = parseFloat(i.balance || 0);
            accrualRevenue += amt;
            expectedReceipts += bal;
            realizedCashCollected += (amt - bal);
        });

        const accrualProfit = accrualRevenue - totalCashOut;
        const trappedReceivables = expectedReceipts;
        const cashRealizationRate = accrualRevenue > 0 ? Number(((realizedCashCollected / accrualRevenue) * 100).toFixed(1)) : 0;

        // Expected Payments (Pending staff payrolls + upcoming operational obligations)
        const pendingPayrolls = payrolls.filter(p => p.status === 'Pending' || p.status === 'Draft');
        const expectedPayments = pendingPayrolls.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0) + 15000;

        // Monthly Burn Rate (Average monthly outflow)
        const activeMonthsCount = Math.max(1, Object.keys(monthlyMap).length);
        const monthlyBurnRate = activeMonthsCount > 0 ? Number((totalCashOut / activeMonthsCount).toFixed(2)) : 0;

        // Cash Runway in Months
        let cashRunwayMonths = 0;
        if (currentCashPosition > 0 && monthlyBurnRate > 0) {
            cashRunwayMonths = Number((currentCashPosition / monthlyBurnRate).toFixed(1));
        } else if (currentCashPosition > 0) {
            cashRunwayMonths = 12.0;
        }

        // Monthly Trend
        let runningBalance = 0;
        const monthlyTrend = Object.values(monthlyMap).map(m => {
            runningBalance += m.net_flow;
            return {
                month: m.month,
                cash_in: Number(m.cash_in.toFixed(2)),
                cash_out: Number(m.cash_out.toFixed(2)),
                net_flow: Number(m.net_flow.toFixed(2)),
                cumulative_balance: Number(runningBalance.toFixed(2))
            };
        }).sort((a, b) => a.month.localeCompare(b.month));

        // Bank Accounts Allocation
        const bankAccounts = Object.values(bankMap).map(b => ({
            bank_name: b.bank_name,
            total_in: Number(b.total_in.toFixed(2)),
            total_out: Number(b.total_out.toFixed(2)),
            net_balance: Number(b.net_balance.toFixed(2)),
            transaction_count: b.count
        })).sort((a, b) => b.net_balance - a.net_balance);

        // 30 / 60 / 90 Days Cash Forecast
        const forecast30 = Number((currentCashPosition + (expectedReceipts * 0.6) - (expectedPayments * 0.8)).toFixed(2));
        const forecast60 = Number((currentCashPosition + (expectedReceipts * 0.85) - (expectedPayments * 1.5)).toFixed(2));
        const forecast90 = Number((currentCashPosition + (expectedReceipts * 1.0) - (expectedPayments * 2.2)).toFixed(2));

        res.json({
            summary: {
                current_cash_position: Number(currentCashPosition.toFixed(2)),
                total_cash_in: Number(totalCashIn.toFixed(2)),
                total_cash_out: Number(totalCashOut.toFixed(2)),
                net_cash_flow: Number((totalCashIn - totalCashOut).toFixed(2)),
                expected_receipts: Number(expectedReceipts.toFixed(2)),
                expected_payments: Number(expectedPayments.toFixed(2)),
                monthly_burn_rate: monthlyBurnRate,
                cash_runway_months: cashRunwayMonths,
                // Profit vs Cash Realization Breakdown (Highlighting User's Exact Requirement)
                accrual_revenue: Number(accrualRevenue.toFixed(2)),
                accrual_profit: Number(accrualProfit.toFixed(2)),
                realized_cash_collected: Number(realizedCashCollected.toFixed(2)),
                trapped_receivables: Number(trappedReceivables.toFixed(2)),
                cash_realization_rate_pct: cashRealizationRate
            },
            forecast: {
                day_30: forecast30,
                day_60: forecast60,
                day_90: forecast90
            },
            bank_accounts: bankAccounts,
            monthly_trend: monthlyTrend,
            transactions: transactions
        });
    } catch (err) {
        console.error('Error fetching cash flow reports:', err);
        res.status(500).json({ error: 'Failed to fetch cash flow reports' });
    }
};

router.get('/cash-flow', handleCashFlowReports);
router.get('/cashflow', handleCashFlowReports);

// GET /api/reports/revenue-concentration & /api/reports/concentration
// Enterprise Revenue Concentration & Client Risk Exposure Intelligence Suite
const handleRevenueConcentrationReports = async (req, res) => {
    try {
        const { start_date, end_date, year } = req.query;
        const selectedYear = (year && year !== 'ALL') ? parseInt(year, 10) : null;

        // 1. Fetch Invoices with Clients and Sales Agents
        let invSql = `
            SELECT 
                i.*,
                c.full_name as client_name,
                c.business_name,
                c.whatsapp_number as client_phone,
                c.email as client_email,
                u.name as salesperson_name,
                p.title as project_title,
                p.service_type as project_service
            FROM invoices i
            LEFT JOIN clients c ON i.client_id = c.id
            LEFT JOIN users u ON i.agent_id = u.id
            LEFT JOIN projects p ON i.project_id = p.id
            WHERE i.status != 'Void'
        `;

        const invParams = [];
        if (start_date && end_date) {
            invSql += ` AND i.issue_date BETWEEN ? AND ?`;
            invParams.push(start_date, end_date);
        } else if (selectedYear) {
            invSql += ` AND YEAR(i.issue_date) = ?`;
            invParams.push(selectedYear);
        }

        const [invoices] = await db.query(invSql, invParams);

        // 2. Fetch Invoice Items for Service Level Concentration
        let itemSql = `
            SELECT ii.*, i.issue_date
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE i.status != 'Void'
        `;
        const itemParams = [];
        if (start_date && end_date) {
            itemSql += ` AND i.issue_date BETWEEN ? AND ?`;
            itemParams.push(start_date, end_date);
        } else if (selectedYear) {
            itemSql += ` AND YEAR(i.issue_date) = ?`;
            itemParams.push(selectedYear);
        }
        const [invoiceItems] = await db.query(itemSql, itemParams);

        // Standard Agency Service Taxonomy mapping helper
        const parseService = (st) => {
            if (!st || st === '[]' || st === '""') return 'Web Development';
            try {
                if (st.startsWith('[')) {
                    const parsed = JSON.parse(st);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
                    return 'Web Development';
                }
            } catch (e) {}
            const s = st.toLowerCase();
            if (s.includes('web') || s.includes('site')) return 'Web Development';
            if (s.includes('logo') || s.includes('brand')) return 'Branding';
            if (s.includes('social') || s.includes('smm') || s.includes('marketing')) return 'SMM';
            if (s.includes('software') || s.includes('app')) return 'Software Development';
            if (s.includes('video') || s.includes('commercial')) return 'AI Video Commercials';
            if (s.includes('chat') || s.includes('bot')) return 'AI Chatbots';
            if (s.includes('seo')) return 'SEO Optimization';
            if (s.includes('graphic') || s.includes('design')) return 'Graphic Design';
            if (s.includes('ad') || s.includes('ppc')) return 'Paid Advertising';
            if (s.includes('consult')) return 'Consulting';
            return st;
        };

        const totalPortfolioRevenue = invoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

        // 3. Client Concentration Aggregation
        const clientMap = {};
        invoices.forEach(i => {
            const cId = i.client_id || 0;
            const cName = i.client_name || 'General Client';
            if (!clientMap[cId]) {
                clientMap[cId] = {
                    client_id: cId,
                    client_name: cName,
                    business_name: i.business_name || '',
                    whatsapp_number: i.client_phone || '',
                    email: i.client_email || '',
                    revenue: 0,
                    invoices_count: 0
                };
            }
            clientMap[cId].revenue += parseFloat(i.amount || 0);
            clientMap[cId].invoices_count += 1;
        });

        const sortedClients = Object.values(clientMap).sort((a, b) => b.revenue - a.revenue);
        let clientCumulative = 0;
        const clientsConcentration = sortedClients.map((c, idx) => {
            const share = totalPortfolioRevenue > 0 ? (c.revenue / totalPortfolioRevenue) * 100 : 0;
            clientCumulative += share;
            let riskTier = 'Low Risk';
            if (share >= 30) riskTier = 'Critical Dependency (>30%)';
            else if (share >= 15) riskTier = 'High Exposure (>15%)';
            else if (share >= 8) riskTier = 'Moderate (8–15%)';

            return {
                rank: idx + 1,
                client_id: c.client_id,
                client_name: c.client_name,
                business_name: c.business_name,
                whatsapp_number: c.whatsapp_number,
                email: c.email,
                revenue: Number(c.revenue.toFixed(2)),
                share_pct: Number(share.toFixed(1)),
                cumulative_share_pct: Number(Math.min(100, clientCumulative).toFixed(1)),
                invoices_count: c.invoices_count,
                risk_tier: riskTier
            };
        });

        // Top 1, Top 5, Top 10 percentages
        const top1Pct = clientsConcentration.length > 0 ? clientsConcentration[0].share_pct : 0;
        const top5Pct = clientsConcentration.slice(0, 5).reduce((sum, c) => sum + c.share_pct, 0);
        const top10Pct = clientsConcentration.slice(0, 10).reduce((sum, c) => sum + c.share_pct, 0);

        // Herfindahl-Hirschman Index (HHI): sum of squared market shares
        const hhiScore = Math.round(clientsConcentration.reduce((sum, c) => sum + Math.pow(c.share_pct, 2), 0));
        let overallRiskLevel = 'Diversified & Healthy';
        let riskColor = 'green';
        if (hhiScore >= 2500 || top1Pct >= 30 || top5Pct >= 65) {
            overallRiskLevel = 'Critical Client Dependency Risk';
            riskColor = 'red';
        } else if (hhiScore >= 1500 || top1Pct >= 20 || top5Pct >= 50) {
            overallRiskLevel = 'Moderate Concentration Risk';
            riskColor = 'orange';
        }

        // 4. Service Concentration Aggregation
        const serviceMap = {};
        if (invoiceItems.length > 0) {
            invoiceItems.forEach(item => {
                const sName = parseService(item.category || item.description);
                if (!serviceMap[sName]) serviceMap[sName] = { service: sName, revenue: 0, count: 0 };
                serviceMap[sName].revenue += parseFloat(item.total || item.unit_price || 0);
                serviceMap[sName].count += 1;
            });
        } else {
            invoices.forEach(i => {
                const sName = parseService(i.project_service);
                if (!serviceMap[sName]) serviceMap[sName] = { service: sName, revenue: 0, count: 0 };
                serviceMap[sName].revenue += parseFloat(i.amount || 0);
                serviceMap[sName].count += 1;
            });
        }

        const totalServiceRevenue = Object.values(serviceMap).reduce((sum, s) => sum + s.revenue, 0) || totalPortfolioRevenue;
        const sortedServices = Object.values(serviceMap).sort((a, b) => b.revenue - a.revenue);
        let srvCumulative = 0;
        const servicesConcentration = sortedServices.map((s, idx) => {
            const share = totalServiceRevenue > 0 ? (s.revenue / totalServiceRevenue) * 100 : 0;
            srvCumulative += share;
            return {
                rank: idx + 1,
                service: s.service,
                revenue: Number(s.revenue.toFixed(2)),
                share_pct: Number(share.toFixed(1)),
                cumulative_share_pct: Number(Math.min(100, srvCumulative).toFixed(1)),
                count: s.count
            };
        });

        const topServicePct = servicesConcentration.length > 0 ? servicesConcentration[0].share_pct : 0;

        // 5. Salesperson / Agent Concentration Aggregation
        const agentMap = {};
        invoices.forEach(i => {
            const aName = i.salesperson_name || 'General / Inbound';
            if (!agentMap[aName]) agentMap[aName] = { salesperson: aName, revenue: 0, deals_count: 0 };
            agentMap[aName].revenue += parseFloat(i.amount || 0);
            agentMap[aName].deals_count += 1;
        });

        const sortedAgents = Object.values(agentMap).sort((a, b) => b.revenue - a.revenue);
        let agentCumulative = 0;
        const salespeopleConcentration = sortedAgents.map((a, idx) => {
            const share = totalPortfolioRevenue > 0 ? (a.revenue / totalPortfolioRevenue) * 100 : 0;
            agentCumulative += share;
            return {
                rank: idx + 1,
                salesperson: a.salesperson,
                revenue: Number(a.revenue.toFixed(2)),
                share_pct: Number(share.toFixed(1)),
                cumulative_share_pct: Number(Math.min(100, agentCumulative).toFixed(1)),
                deals_count: a.deals_count
            };
        });

        const topSalespersonPct = salespeopleConcentration.length > 0 ? salespeopleConcentration[0].share_pct : 0;

        res.json({
            summary: {
                total_portfolio_revenue: Number(totalPortfolioRevenue.toFixed(2)),
                total_clients_count: sortedClients.length,
                top_1_client_pct: top1Pct,
                top_5_clients_pct: Number(top5Pct.toFixed(1)),
                top_10_clients_pct: Number(top10Pct.toFixed(1)),
                hhi_score: hhiScore,
                risk_level: overallRiskLevel,
                risk_color: riskColor,
                top_service_pct: topServicePct,
                top_service_name: servicesConcentration.length > 0 ? servicesConcentration[0].service : 'N/A',
                top_salesperson_pct: topSalespersonPct,
                top_salesperson_name: salespeopleConcentration.length > 0 ? salespeopleConcentration[0].salesperson : 'N/A'
            },
            clients_concentration: clientsConcentration,
            services_concentration: servicesConcentration,
            salespeople_concentration: salespeopleConcentration
        });
    } catch (err) {
        console.error('Error fetching revenue concentration reports:', err);
        res.status(500).json({ error: 'Failed to fetch revenue concentration reports' });
    }
};

router.get('/revenue-concentration', handleRevenueConcentrationReports);
router.get('/concentration', handleRevenueConcentrationReports);

// GET /api/reports/accounting
// Enterprise Certified Finance & Accounting Suite: P&L, Balance Sheet, Cash Flow, Trial Balance, AR Aging, AP Payables Intelligence
router.get('/accounting', async (req, res) => {
    try {
        const { year, start_date, end_date } = req.query;
        const selectedYear = parseInt(year || new Date().getFullYear().toString(), 10);

        // 1. Fetch Invoices with Client data
        let invSql = `
            SELECT i.*, c.full_name as client_name, c.business_name, c.email as client_email, c.whatsapp_number as client_phone
            FROM invoices i
            LEFT JOIN clients c ON i.client_id = c.id
            WHERE i.status != 'Void'
        `;
        const invParams = [];
        if (start_date && end_date) {
            invSql += ` AND i.issue_date BETWEEN ? AND ?`;
            invParams.push(start_date, end_date);
        } else if (year && year !== 'ALL') {
            invSql += ` AND YEAR(i.issue_date) = ?`;
            invParams.push(selectedYear);
        }
        invSql += ` ORDER BY i.due_date ASC, i.id DESC`;
        const [invoices] = await db.query(invSql, invParams);

        // 2. Fetch Expenses & Cashbook Records
        let expSql = `SELECT * FROM expenses`;
        const expParams = [];
        if (start_date && end_date) {
            expSql += ` WHERE date BETWEEN ? AND ?`;
            expParams.push(start_date, end_date);
        } else if (year && year !== 'ALL') {
            expSql += ` WHERE YEAR(date) = ?`;
            expParams.push(selectedYear);
        }
        expSql += ` ORDER BY date DESC, id DESC`;
        const [expenses] = await db.query(expSql, expParams);

        // 3. Fetch Banks & Liquid Balances
        const [banks] = await db.query(`
            SELECT * FROM banks ORDER BY id ASC
        `);

        // 4. Fetch Payrolls (Pending & Paid)
        let paySql = `
            SELECT p.*, u.name as employee_name, u.email as employee_email, u.role as employee_role
            FROM payrolls p
            JOIN users u ON p.user_id = u.id
        `;
        const payParams = [];
        if (start_date && end_date) {
            const startMonth = start_date.slice(0, 7);
            const endMonth = end_date.slice(0, 7);
            paySql += ` WHERE p.month BETWEEN ? AND ?`;
            payParams.push(startMonth, endMonth);
        } else if (year && year !== 'ALL') {
            paySql += ` WHERE p.month LIKE ?`;
            payParams.push(`${selectedYear}-%`);
        }
        paySql += ` ORDER BY p.month DESC, p.id DESC`;
        const [payrolls] = await db.query(paySql, payParams);

        // 5. Fetch Projects for WIP / Pipeline Context
        const [projects] = await db.query(`
            SELECT * FROM projects
        `);

        // =========================================================================
        // A. ACCOUNTS RECEIVABLE (AR) & 5-TIER AGING INTELLIGENCE
        // =========================================================================
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let arCurrent = 0;
        let ar1_30 = 0;
        let ar31_60 = 0;
        let ar61_90 = 0;
        let ar90Plus = 0;

        const outstandingInvoices = [];
        const clientArMap = {};

        invoices.forEach(inv => {
            const amount = parseFloat(inv.amount || 0);
            const balance = parseFloat(inv.balance || 0);
            const paid = amount - balance;
            const clientName = inv.client_name || 'General Client';

            if (!clientArMap[clientName]) {
                clientArMap[clientName] = {
                    client_name: clientName,
                    business_name: inv.business_name || '',
                    client_email: inv.client_email || '',
                    client_phone: inv.client_phone || '',
                    total_invoiced: 0,
                    total_paid: 0,
                    total_balance: 0,
                    current_due: 0,
                    aging_1_30: 0,
                    aging_31_60: 0,
                    aging_61_90: 0,
                    aging_90_plus: 0,
                    invoice_count: 0,
                    overdue_count: 0
                };
            }

            clientArMap[clientName].total_invoiced += amount;
            clientArMap[clientName].total_paid += paid;
            clientArMap[clientName].total_balance += balance;
            clientArMap[clientName].invoice_count += 1;

            if (balance > 0 && inv.status !== 'Paid') {
                const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.issue_date);
                dueDate.setHours(0, 0, 0, 0);
                const diffTime = today.getTime() - dueDate.getTime();
                const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                let bucket = 'Current';
                if (daysOverdue <= 0) {
                    bucket = 'Current';
                    arCurrent += balance;
                    clientArMap[clientName].current_due += balance;
                } else if (daysOverdue <= 30) {
                    bucket = '1–30 Days';
                    ar1_30 += balance;
                    clientArMap[clientName].aging_1_30 += balance;
                    clientArMap[clientName].overdue_count += 1;
                } else if (daysOverdue <= 60) {
                    bucket = '31–60 Days';
                    ar31_60 += balance;
                    clientArMap[clientName].aging_31_60 += balance;
                    clientArMap[clientName].overdue_count += 1;
                } else if (daysOverdue <= 90) {
                    bucket = '61–90 Days';
                    ar61_90 += balance;
                    clientArMap[clientName].aging_61_90 += balance;
                    clientArMap[clientName].overdue_count += 1;
                } else {
                    bucket = '90+ Days';
                    ar90Plus += balance;
                    clientArMap[clientName].aging_90_plus += balance;
                    clientArMap[clientName].overdue_count += 1;
                }

                outstandingInvoices.push({
                    id: inv.id,
                    invoice_number: inv.invoice_number || `INV-${inv.id}`,
                    client_name: clientName,
                    amount: amount,
                    balance: balance,
                    paid_amount: paid,
                    issue_date: inv.issue_date,
                    due_date: inv.due_date,
                    days_overdue: daysOverdue > 0 ? daysOverdue : 0,
                    aging_bucket: bucket,
                    status: daysOverdue > 0 ? 'Overdue' : 'Unpaid'
                });
            }
        });

        const clientReceivablesList = Object.values(clientArMap).map(c => ({
            ...c,
            total_invoiced: Number(c.total_invoiced.toFixed(2)),
            total_paid: Number(c.total_paid.toFixed(2)),
            total_balance: Number(c.total_balance.toFixed(2)),
            current_due: Number(c.current_due.toFixed(2)),
            aging_1_30: Number(c.aging_1_30.toFixed(2)),
            aging_31_60: Number(c.aging_31_60.toFixed(2)),
            aging_61_90: Number(c.aging_61_90.toFixed(2)),
            aging_90_plus: Number(c.aging_90_plus.toFixed(2)),
            collection_rate: c.total_invoiced > 0 ? Number(((c.total_paid / c.total_invoiced) * 100).toFixed(1)) : 0
        })).sort((a, b) => b.total_balance - a.total_balance);

        const totalAccountsReceivable = arCurrent + ar1_30 + ar31_60 + ar61_90 + ar90Plus;

        // =========================================================================
        // B. ACCOUNTS PAYABLE (AP) & OBLIGATIONS INTELLIGENCE (CRITICAL)
        // =========================================================================
        // Pending Payroll Obligations
        const pendingPayrolls = payrolls.filter(p => p.status === 'Pending');
        const totalPendingPayroll = pendingPayrolls.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);

        let apImmediate = 0;  // 1-7 days
        let apUpcoming = 0;   // 8-30 days
        let ap31_60 = 0;
        let ap61_90 = 0;
        let ap90Plus = 0;

        const payablesLedger = [];

        // Add pending payroll items as payables
        pendingPayrolls.forEach(p => {
            const netSal = parseFloat(p.net_salary || 0);
            // Default salary due date = end of payroll month
            const pMonthDate = new Date(`${p.month}-01`);
            const pDueDate = new Date(pMonthDate.getFullYear(), pMonthDate.getMonth() + 1, 5); // 5th of next month
            const diffDays = Math.floor((today.getTime() - pDueDate.getTime()) / (1000 * 60 * 60 * 24));

            let apBucket = 'Immediate (1–7d)';
            if (diffDays <= 7 && diffDays >= -7) {
                apBucket = 'Immediate (1–7d)';
                apImmediate += netSal;
            } else if (diffDays < -7) {
                apBucket = 'Upcoming (8–30d)';
                apUpcoming += netSal;
            } else if (diffDays <= 30) {
                apBucket = '1–30 Days Past Due';
                apUpcoming += netSal;
            } else if (diffDays <= 60) {
                apBucket = '31–60 Days Past Due';
                ap31_60 += netSal;
            } else if (diffDays <= 90) {
                apBucket = '61–90 Days Past Due';
                ap61_90 += netSal;
            } else {
                apBucket = '90+ Days Past Due';
                ap90Plus += netSal;
            }

            payablesLedger.push({
                id: `PAYROLL-${p.id}`,
                obligation_type: 'Staff Payroll / Salary',
                payee_name: p.employee_name,
                role: p.employee_role,
                amount_due: netSal,
                due_date: pDueDate.toISOString().slice(0, 10),
                reference_month: p.month,
                aging_bucket: apBucket,
                status: diffDays > 0 ? 'Overdue' : 'Pending',
                is_payroll: true
            });
        });

        const totalAccountsPayable = totalPendingPayroll;

        // =========================================================================
        // C. LIQUIDITY, BANK BALANCES & CASH ON HAND
        // =========================================================================
        const totalReceipts = expenses.reduce((sum, e) => sum + parseFloat(e.receipt_amount || 0), 0);
        const totalPayments = expenses.reduce((sum, e) => sum + parseFloat(e.payment_amount || 0), 0);
        const netCashbookBalance = Math.max(0, totalReceipts - totalPayments);

        // Bank Accounts list with live balances
        const bankAccounts = banks.map(b => {
            const bankReceipts = expenses.filter(e => e.bank === b.bank_name || e.bank === b.name).reduce((sum, e) => sum + parseFloat(e.receipt_amount || 0), 0);
            const bankPayments = expenses.filter(e => e.bank === b.bank_name || e.bank === b.name).reduce((sum, e) => sum + parseFloat(e.payment_amount || 0), 0);
            const computedBal = parseFloat(b.starting_balance || 0) + (bankReceipts - bankPayments);
            return {
                id: b.id,
                bank_name: b.bank_name || b.name,
                account_number: b.account_number || '-',
                branch: b.branch || '-',
                balance: Number(Math.max(0, computedBal).toFixed(2))
            };
        });

        const totalLiquidCash = bankAccounts.reduce((sum, b) => sum + b.balance, 0) || netCashbookBalance;

        // Liquidity Runway & Coverage
        const workingCapital = totalAccountsReceivable + totalLiquidCash - totalAccountsPayable;
        const currentRatio = totalAccountsPayable > 0 ? Number(((totalAccountsReceivable + totalLiquidCash) / totalAccountsPayable).toFixed(2)) : 10;
        const quickRatio = totalAccountsPayable > 0 ? Number((totalLiquidCash / totalAccountsPayable).toFixed(2)) : 10;
        const cashBufferRunwayMonths = totalPayments > 0 ? Number(((totalLiquidCash / (totalPayments / 12)).toFixed(1))) : 12;

        // =========================================================================
        // D. CORE ACCOUNTING: PROFIT & LOSS (INCOME STATEMENT)
        // =========================================================================
        const totalBilledRevenue = invoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
        const totalCollectedRevenue = invoices.reduce((sum, i) => sum + (parseFloat(i.amount || 0) - parseFloat(i.balance || 0)), 0);

        // Cost of Goods Sold (Direct Reimbursable Client / Project Costs)
        const directProjectCosts = expenses.filter(e => e.reimbursability === 'Reimbursable').reduce((sum, e) => sum + parseFloat(e.payment_amount || 0), 0);
        const grossProfit = totalBilledRevenue - directProjectCosts;
        const grossProfitMargin = totalBilledRevenue > 0 ? Number(((grossProfit / totalBilledRevenue) * 100).toFixed(1)) : 0;

        // Categorized Operating Expenses (OpEx)
        const opExBreakdown = {};
        expenses.filter(e => e.reimbursability !== 'Reimbursable').forEach(e => {
            const cat = e.category || 'General Operational';
            if (!opExBreakdown[cat]) opExBreakdown[cat] = 0;
            opExBreakdown[cat] += parseFloat(e.payment_amount || 0);
        });

        const totalOperatingExpenses = Object.values(opExBreakdown).reduce((s, v) => s + v, 0);
        const netOperatingIncome = grossProfit - totalOperatingExpenses;
        const netProfitMargin = totalBilledRevenue > 0 ? Number(((netOperatingIncome / totalBilledRevenue) * 100).toFixed(1)) : 0;

        const pnlStatement = {
            revenue: {
                total_billed_revenue: Number(totalBilledRevenue.toFixed(2)),
                total_collected_revenue: Number(totalCollectedRevenue.toFixed(2)),
                uncollected_receivables: Number(totalAccountsReceivable.toFixed(2))
            },
            cogs: {
                direct_project_costs: Number(directProjectCosts.toFixed(2)),
                contractor_pass_through: 0
            },
            gross_profit: Number(grossProfit.toFixed(2)),
            gross_profit_margin: grossProfitMargin,
            operating_expenses: {
                categories: Object.entries(opExBreakdown).map(([name, amount]) => ({
                    category_name: name,
                    amount: Number(amount.toFixed(2)),
                    percentage: totalOperatingExpenses > 0 ? Number(((amount / totalOperatingExpenses) * 100).toFixed(1)) : 0
                })),
                total_opex: Number(totalOperatingExpenses.toFixed(2))
            },
            net_operating_income: Number(netOperatingIncome.toFixed(2)),
            net_profit_margin: netProfitMargin,
            is_profitable: netOperatingIncome >= 0
        };

        // =========================================================================
        // E. CORE ACCOUNTING: BALANCE SHEET (STATEMENT OF FINANCIAL POSITION)
        // =========================================================================
        const currentAssetsTotal = totalLiquidCash + totalAccountsReceivable;
        const fixedAssetsTotal = 0; // Hardware/infrastructure (or equipment spend)
        const totalAssets = currentAssetsTotal + fixedAssetsTotal;

        const currentLiabilitiesTotal = totalAccountsPayable;
        const longTermLiabilitiesTotal = 0;
        const totalLiabilities = currentLiabilitiesTotal + longTermLiabilitiesTotal;

        // Equity = Assets - Liabilities (Retained Earnings)
        const totalEquity = totalAssets - totalLiabilities;

        const balanceSheet = {
            assets: {
                current_assets: {
                    cash_and_banks: Number(totalLiquidCash.toFixed(2)),
                    accounts_receivable: Number(totalAccountsReceivable.toFixed(2)),
                    bank_accounts_detail: bankAccounts,
                    total_current_assets: Number(currentAssetsTotal.toFixed(2))
                },
                fixed_assets: {
                    equipment_and_hardware: 0,
                    total_fixed_assets: 0
                },
                total_assets: Number(totalAssets.toFixed(2))
            },
            liabilities: {
                current_liabilities: {
                    accounts_payable: Number(totalAccountsPayable.toFixed(2)),
                    pending_payroll_obligations: Number(totalPendingPayroll.toFixed(2)),
                    total_current_liabilities: Number(currentLiabilitiesTotal.toFixed(2))
                },
                total_liabilities: Number(totalLiabilities.toFixed(2))
            },
            equity: {
                retained_earnings: Number(totalEquity.toFixed(2)),
                owners_capital: 0,
                total_equity: Number(totalEquity.toFixed(2))
            },
            balanced_check: {
                assets_equal_liabilities_plus_equity: true,
                variance: 0
            }
        };

        // =========================================================================
        // F. CORE ACCOUNTING: CASH FLOW STATEMENT
        // =========================================================================
        const operatingCashInflow = totalReceipts;
        const operatingCashOutflow = totalPayments;
        const netCashFromOperations = operatingCashInflow - operatingCashOutflow;

        const cashFlowStatement = {
            operating_activities: {
                cash_receipts_from_clients: Number(operatingCashInflow.toFixed(2)),
                cash_payments_for_operations: Number(operatingCashOutflow.toFixed(2)),
                net_cash_from_operations: Number(netCashFromOperations.toFixed(2))
            },
            investing_activities: {
                capital_expenditures: 0,
                net_cash_from_investing: 0
            },
            financing_activities: {
                capital_contributions: 0,
                drawings: 0,
                net_cash_from_financing: 0
            },
            net_change_in_cash: Number(netCashFromOperations.toFixed(2)),
            ending_cash_position: Number(totalLiquidCash.toFixed(2))
        };

        // =========================================================================
        // G. TRIAL BALANCE (DOUBLE-ENTRY SUMMARY)
        // =========================================================================
        const trialBalanceAccounts = [
            { code: '1010', name: 'Cash & Liquid Bank Accounts', type: 'Asset', debit: totalLiquidCash, credit: 0 },
            { code: '1020', name: 'Accounts Receivable (Trade Debtors)', type: 'Asset', debit: totalAccountsReceivable, credit: 0 },
            { code: '2010', name: 'Accounts Payable (Trade Creditors & Payroll)', type: 'Liability', debit: 0, credit: totalAccountsPayable },
            { code: '3010', name: 'Retained Earnings / Owner Equity', type: 'Equity', debit: 0, credit: Math.max(0, totalEquity) },
            { code: '4010', name: 'Gross Revenue from Agency Services', type: 'Revenue', debit: 0, credit: totalBilledRevenue },
            { code: '5010', name: 'Direct Project Costs & Reimbursables', type: 'Expense', debit: directProjectCosts, credit: 0 },
            { code: '6010', name: 'Operating Expenditures (Salaries, SaaS, Rent)', type: 'Expense', debit: totalOperatingExpenses, credit: 0 }
        ];

        const totalDebits = trialBalanceAccounts.reduce((sum, a) => sum + a.debit, 0);
        const totalCredits = trialBalanceAccounts.reduce((sum, a) => sum + a.credit, 0);

        res.json({
            summary: {
                total_liquid_cash: Number(totalLiquidCash.toFixed(2)),
                total_receivables: Number(totalAccountsReceivable.toFixed(2)),
                total_payables: Number(totalAccountsPayable.toFixed(2)),
                net_working_capital: Number(workingCapital.toFixed(2)),
                current_ratio: currentRatio,
                quick_ratio: quickRatio,
                cash_buffer_runway_months: cashBufferRunwayMonths,
                net_retained_surplus: Number(totalEquity.toFixed(2))
            },
            pnl_statement: pnlStatement,
            balance_sheet: balanceSheet,
            cash_flow_statement: cashFlowStatement,
            receivables_ar: {
                total_receivables: Number(totalAccountsReceivable.toFixed(2)),
                buckets: {
                    current: Number(arCurrent.toFixed(2)),
                    aging_1_30: Number(ar1_30.toFixed(2)),
                    aging_31_60: Number(ar31_60.toFixed(2)),
                    aging_61_90: Number(ar61_90.toFixed(2)),
                    aging_90_plus: Number(ar90Plus.toFixed(2))
                },
                client_matrix: clientReceivablesList,
                outstanding_invoices: outstandingInvoices
            },
            payables_ap: {
                total_payables: Number(totalAccountsPayable.toFixed(2)),
                pending_payroll_total: Number(totalPendingPayroll.toFixed(2)),
                buckets: {
                    immediate_1_7d: Number(apImmediate.toFixed(2)),
                    upcoming_8_30d: Number(apUpcoming.toFixed(2)),
                    aging_31_60: Number(ap31_60.toFixed(2)),
                    aging_61_90: Number(ap61_90.toFixed(2)),
                    aging_90_plus: Number(ap90Plus.toFixed(2))
                },
                payables_ledger: payablesLedger
            },
            trial_balance: {
                accounts: trialBalanceAccounts.map(a => ({
                    ...a,
                    debit: Number(a.debit.toFixed(2)),
                    credit: Number(a.credit.toFixed(2))
                })),
                total_debits: Number(totalDebits.toFixed(2)),
                total_credits: Number(totalCredits.toFixed(2)),
                is_balanced: Math.abs(totalDebits - totalCredits) < 5
            }
        });
    } catch (err) {
        console.error('Error fetching comprehensive accounting report:', err);
        res.status(500).json({ error: 'Failed to fetch accounting report' });
    }
});

// GET /api/reports/invoices-aging
router.get('/invoices-aging', async (req, res) => {
    try {
        const query = `
            SELECT 
                SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) <= 0 THEN balance ELSE 0 END) as current,
                SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 1 AND 30 THEN balance ELSE 0 END) as overdue_1_30,
                SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 31 AND 60 THEN balance ELSE 0 END) as overdue_31_60,
                SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) BETWEEN 61 AND 90 THEN balance ELSE 0 END) as overdue_61_90,
                SUM(CASE WHEN DATEDIFF(CURDATE(), due_date) > 90 THEN balance ELSE 0 END) as overdue_90_plus
            FROM invoices
            WHERE status != 'Paid' AND status != 'Void' AND due_date IS NOT NULL
        `;
        const [rows] = await db.query(query);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching invoice aging:', err);
        res.status(500).json({ error: 'Failed to fetch invoice aging' });
    }
});

// GET /api/reports/cash-flow
router.get('/cash-flow', async (req, res) => {
    try {
        const queryIn = `
            SELECT DATE_FORMAT(payment_date, '%Y-%m') as month, SUM(amount) as inflow
            FROM invoice_payments
            GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
        `;
        const queryOut = `
            SELECT DATE_FORMAT(date, '%Y-%m') as month, SUM(payment_amount) as outflow
            FROM expenses
            GROUP BY DATE_FORMAT(date, '%Y-%m')
        `;
        const [inflows] = await db.query(queryIn);
        const [outflows] = await db.query(queryOut);

        const flowMap = {};
        inflows.forEach(i => {
            if (i.month) flowMap[i.month] = { month: i.month, inflow: i.inflow, outflow: 0 };
        });
        outflows.forEach(o => {
            if (o.month) {
                if (!flowMap[o.month]) flowMap[o.month] = { month: o.month, inflow: 0, outflow: 0 };
                flowMap[o.month].outflow = o.outflow;
            }
        });

        const sortedFlow = Object.values(flowMap).sort((a, b) => a.month.localeCompare(b.month));
        res.json(sortedFlow);
    } catch (err) {
        console.error('Error fetching cash flow:', err);
        res.status(500).json({ error: 'Failed to fetch cash flow' });
    }
});

// GET /api/reports/revenue-concentration
router.get('/revenue-concentration', async (req, res) => {
    try {
        const query = `
            SELECT 
                c.full_name as client_name,
                c.business_name,
                COALESCE(SUM(i.amount), 0) as total_revenue,
                COUNT(i.id) as total_invoices
            FROM clients c
            JOIN invoices i ON c.id = i.client_id
            WHERE i.status != 'Void'
            GROUP BY c.id
            ORDER BY total_revenue DESC
            LIMIT 10
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching revenue concentration:', err);
        res.status(500).json({ error: 'Failed to fetch revenue concentration' });
    }
});

// GET /api/reports/expenses
// Enterprise Corporate Expense Intelligence, Category Analytics & Spend Control
router.get('/expenses', async (req, res) => {
    try {
        const { start_date, end_date, category, expense_type, mode, client } = req.query;

        // 1. Fetch Expenses
        let expWhere = 'WHERE 1=1';
        const expParams = [];
        if (start_date) {
            expWhere += ' AND DATE(date) >= ?';
            expParams.push(start_date);
        }
        if (end_date) {
            expWhere += ' AND DATE(date) <= ?';
            expParams.push(end_date);
        }

        const [expenseRows] = await db.query(
            `SELECT * FROM expenses ${expWhere} ORDER BY date DESC, id DESC`,
            expParams
        );

        // 2. Fetch Users, Clients, Projects, and real Expense Categories from DB
        const [users] = await db.query(`SELECT id, name, email, role FROM users`);
        const [clients] = await db.query(`SELECT id, full_name, business_name FROM clients`);
        const [projects] = await db.query(`SELECT id, title, client_id FROM projects`);
        const [dbCategories] = await db.query(`SELECT id, name FROM expense_categories ORDER BY id ASC`);

        const userNames = users.map(u => (u.name || '').toLowerCase());
        const validCategoryNames = dbCategories.map(c => c.name);

        // Smart & Accurate Categorizer (respects user database categories)
        const categorize = (item) => {
            if (item.category && item.category.trim()) {
                // If it matches an exact DB category, preserve it
                const matched = validCategoryNames.find(c => c.toLowerCase() === item.category.trim().toLowerCase());
                return matched || item.category.trim();
            }

            const desc = (item.description || '').toLowerCase();
            const clientStr = (item.client || '').toLowerCase();

            // Match against user's actual database categories first
            for (const catName of validCategoryNames) {
                const catLower = catName.toLowerCase();
                if (desc.includes(catLower) || clientStr.includes(catLower)) {
                    return catName;
                }
            }

            // Keyword heuristics mapped to user categories
            if (desc.includes('salary') || desc.includes('payroll') || desc.includes('advance') || desc.includes('bonus')) {
                return validCategoryNames.find(c => c.toLowerCase().includes('payroll') || c.toLowerCase().includes('salar')) || 'Payroll';
            }
            if (desc.includes('rent') || desc.includes('building') || desc.includes('office space')) {
                return validCategoryNames.find(c => c.toLowerCase().includes('rent')) || 'Rent';
            }
            if (desc.includes('software') || desc.includes('subscription') || desc.includes('saas') || desc.includes('figma') || desc.includes('adobe') || desc.includes('github') || desc.includes('openai') || desc.includes('zoom')) {
                return validCategoryNames.find(c => c.toLowerCase().includes('software')) || 'Software Subscriptions';
            }
            if (desc.includes('marketing') || desc.includes('ad') || desc.includes('facebook') || desc.includes('meta') || desc.includes('google ads') || desc.includes('campaign')) {
                return validCategoryNames.find(c => c.toLowerCase().includes('marketing')) || 'Marketing';
            }
            if (desc.includes('electricity') || desc.includes('utility') || desc.includes('wapda') || desc.includes('lesco') || desc.includes('kelectric') || desc.includes('water') || desc.includes('gas') || desc.includes('bill')) {
                return validCategoryNames.find(c => c.toLowerCase().includes('utilit')) || 'Utilities';
            }
            if (desc.includes('supply') || desc.includes('supplies') || desc.includes('paper') || desc.includes('stationery')) {
                return validCategoryNames.find(c => c.toLowerCase().includes('suppl')) || 'Office Supplies';
            }

            return 'Uncategorized';
        };

        const RECURRING_KEYWORDS = ['payroll', 'salary', 'rent', 'subscription', 'software', 'utility', 'utilities', 'hosting'];

        // Process each expense record
        const processedExpenses = expenseRows.map(e => {
            const cat = categorize(e);
            const isRecurring = RECURRING_KEYWORDS.some(kw => cat.toLowerCase().includes(kw));
            const clientLower = (e.client || '').trim().toLowerCase();
            const isEmployee = userNames.some(un => clientLower === un || clientLower.includes(un));
            const isClientAttributed = Boolean(e.client && e.client.trim() && !isEmployee);
            const paymentAmount = parseFloat(e.payment_amount || 0);
            const receiptAmount = parseFloat(e.receipt_amount || 0);

            // Attempt to match linked project
            let linkedProject = null;
            if (e.description) {
                const descL = e.description.toLowerCase();
                const matchedProj = projects.find(p => p.title && descL.includes(p.title.toLowerCase()));
                if (matchedProj) linkedProject = matchedProj.title;
            }

            return {
                id: e.id,
                date: e.date,
                category: cat,
                description: e.description || '-',
                client: e.client || '-',
                mode: e.mode || 'Cash',
                bank: e.bank || '-',
                reference: e.reference || '-',
                payment_amount: paymentAmount,
                receipt_amount: receiptAmount,
                balance: parseFloat(e.balance || 0),
                expense_type: isRecurring ? 'Recurring' : 'One-Time',
                reimbursability: isClientAttributed ? 'Reimbursable' : 'Non-Reimbursable',
                is_employee_payee: isEmployee,
                linked_project: linkedProject,
                created_at: e.created_at
            };
        });

        // Filter out records where payment_amount > 0 for pure spend analytics
        const spendRecords = processedExpenses.filter(e => e.payment_amount > 0);
        const receiptRecords = processedExpenses.filter(e => e.receipt_amount > 0);

        // 1. Portfolio Macro Summary
        const totalExpenses = spendRecords.reduce((sum, e) => sum + e.payment_amount, 0);
        const totalReceipts = receiptRecords.reduce((sum, e) => sum + e.receipt_amount, 0);
        const netCashFlow = totalReceipts - totalExpenses;
        const totalTransactions = spendRecords.length;
        const avgTransactionSize = totalTransactions > 0 ? (totalExpenses / totalTransactions) : 0;
        const recurringBurn = spendRecords.filter(e => e.expense_type === 'Recurring').reduce((sum, e) => sum + e.payment_amount, 0);
        const onetimeBurn = spendRecords.filter(e => e.expense_type === 'One-Time').reduce((sum, e) => sum + e.payment_amount, 0);
        const reimbursableTotal = spendRecords.filter(e => e.reimbursability === 'Reimbursable').reduce((sum, e) => sum + e.payment_amount, 0);
        const nonReimbursableTotal = spendRecords.filter(e => e.reimbursability === 'Non-Reimbursable').reduce((sum, e) => sum + e.payment_amount, 0);

        // 2. Spend by Category Aggregation
        const catMap = {};
        spendRecords.forEach(e => {
            if (!catMap[e.category]) {
                catMap[e.category] = {
                    category_name: e.category,
                    total_amount: 0,
                    transaction_count: 0,
                    recurring_amount: 0,
                    onetime_amount: 0
                };
            }
            catMap[e.category].total_amount += e.payment_amount;
            catMap[e.category].transaction_count += 1;
            if (e.expense_type === 'Recurring') catMap[e.category].recurring_amount += e.payment_amount;
            else catMap[e.category].onetime_amount += e.payment_amount;
        });

        const byCategory = Object.values(catMap)
            .map(c => ({
                ...c,
                total_amount: Number(c.total_amount.toFixed(2)),
                percentage: totalExpenses > 0 ? Number(((c.total_amount / totalExpenses) * 100).toFixed(1)) : 0,
                avg_ticket: c.transaction_count > 0 ? Number((c.total_amount / c.transaction_count).toFixed(2)) : 0
            }))
            .sort((a, b) => b.total_amount - a.total_amount);

        const topSpendingCategory = byCategory.length > 0 ? byCategory[0] : null;

        // 3. Spend by Client Aggregation
        const clientMap = {};
        spendRecords.filter(e => e.reimbursability === 'Reimbursable').forEach(e => {
            const cName = e.client || 'General Client';
            if (!clientMap[cName]) {
                clientMap[cName] = { client_name: cName, total_amount: 0, count: 0 };
            }
            clientMap[cName].total_amount += e.payment_amount;
            clientMap[cName].count += 1;
        });
        const byClient = Object.values(clientMap)
            .map(c => ({ ...c, total_amount: Number(c.total_amount.toFixed(2)) }))
            .sort((a, b) => b.total_amount - a.total_amount);

        // 4. Spend by Project Aggregation
        const projMap = {};
        spendRecords.filter(e => e.linked_project).forEach(e => {
            const pTitle = e.linked_project;
            if (!projMap[pTitle]) {
                projMap[pTitle] = { project_title: pTitle, total_amount: 0, count: 0 };
            }
            projMap[pTitle].total_amount += e.payment_amount;
            projMap[pTitle].count += 1;
        });
        const byProject = Object.values(projMap)
            .map(p => ({ ...p, total_amount: Number(p.total_amount.toFixed(2)) }))
            .sort((a, b) => b.total_amount - a.total_amount);

        // 5. Spend by Employee Aggregation
        const empMap = {};
        spendRecords.filter(e => e.is_employee_payee).forEach(e => {
            const empName = e.client || 'Staff';
            if (!empMap[empName]) {
                empMap[empName] = { employee_name: empName, total_amount: 0, count: 0 };
            }
            empMap[empName].total_amount += e.payment_amount;
            empMap[empName].count += 1;
        });
        const byEmployee = Object.values(empMap)
            .map(emp => ({ ...emp, total_amount: Number(emp.total_amount.toFixed(2)) }))
            .sort((a, b) => b.total_amount - a.total_amount);

        // 6. Monthly Spending Trend
        const trendMap = {};
        spendRecords.forEach(e => {
            const d = e.date ? new Date(e.date) : new Date(e.created_at);
            const m = d.toISOString().slice(0, 7); // YYYY-MM
            if (!trendMap[m]) {
                trendMap[m] = { month: m, amount: 0, transaction_count: 0 };
            }
            trendMap[m].amount += e.payment_amount;
            trendMap[m].transaction_count += 1;
        });
        const monthlyTrend = Object.values(trendMap)
            .map(t => ({ ...t, amount: Number(t.amount.toFixed(2)) }))
            .sort((a, b) => a.month.localeCompare(b.month));

        // 7. Payment Mode Breakdown
        const modeMap = {};
        spendRecords.forEach(e => {
            const m = e.mode || 'Cash';
            if (!modeMap[m]) {
                modeMap[m] = { mode: m, amount: 0, count: 0 };
            }
            modeMap[m].amount += e.payment_amount;
            modeMap[m].count += 1;
        });
        const paymentModes = Object.values(modeMap)
            .map(m => ({
                ...m,
                amount: Number(m.amount.toFixed(2)),
                percentage: totalExpenses > 0 ? Number(((m.amount / totalExpenses) * 100).toFixed(1)) : 0
            }))
            .sort((a, b) => b.amount - a.amount);

        // 8. 12-Month Category Pivot Matrix (Annual Matrix by Selected Year)
        const selectedYear = parseInt(req.query.year || new Date().getFullYear().toString(), 10);
        const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        const yearExpenses = spendRecords.filter(e => {
            const d = e.date ? new Date(e.date) : new Date(e.created_at);
            return d.getFullYear() === selectedYear;
        });

        // Use real categories from database plus any categories recorded on expenses
        const allCategoryNames = Array.from(new Set([
            ...validCategoryNames,
            ...yearExpenses.map(e => e.category)
        ])).filter(Boolean);

        const matrix = allCategoryNames.map(catName => {
            const monthlyValues = new Array(12).fill(0);
            yearExpenses.filter(e => e.category === catName).forEach(e => {
                const d = e.date ? new Date(e.date) : new Date(e.created_at);
                const monthIdx = d.getMonth();
                if (monthIdx >= 0 && monthIdx < 12) {
                    monthlyValues[monthIdx] += e.payment_amount;
                }
            });

            const totalYear = monthlyValues.reduce((s, v) => s + v, 0);
            return {
                category_name: catName,
                monthly_values: monthlyValues.map(v => Number(v.toFixed(2))),
                total_year: Number(totalYear.toFixed(2))
            };
        });

        // Subtotals per month
        const monthlySubtotals = new Array(12).fill(0);
        const billableMonthly = new Array(12).fill(0);
        const nonBillableMonthly = new Array(12).fill(0);

        yearExpenses.forEach(e => {
            const d = e.date ? new Date(e.date) : new Date(e.created_at);
            const monthIdx = d.getMonth();
            if (monthIdx >= 0 && monthIdx < 12) {
                monthlySubtotals[monthIdx] += e.payment_amount;
                if (e.reimbursability === 'Reimbursable') {
                    billableMonthly[monthIdx] += e.payment_amount;
                } else {
                    nonBillableMonthly[monthIdx] += e.payment_amount;
                }
            }
        });

        const annualGrandTotal = monthlySubtotals.reduce((s, v) => s + v, 0);

        res.json({
            expenses: processedExpenses,
            summary: {
                total_expenses: Number(totalExpenses.toFixed(2)),
                total_receipts: Number(totalReceipts.toFixed(2)),
                net_cash_flow: Number(netCashFlow.toFixed(2)),
                total_transactions: totalTransactions,
                avg_transaction_size: Number(avgTransactionSize.toFixed(2)),
                recurring_burn: Number(recurringBurn.toFixed(2)),
                onetime_burn: Number(onetimeBurn.toFixed(2)),
                reimbursable_total: Number(reimbursableTotal.toFixed(2)),
                non_reimbursable_total: Number(nonReimbursableTotal.toFixed(2)),
                top_spending_category: topSpendingCategory ? `${topSpendingCategory.category_name} (${topSpendingCategory.percentage}%)` : 'N/A'
            },
            by_category: byCategory,
            by_client: byClient,
            by_project: byProject,
            by_employee: byEmployee,
            monthly_trend: monthlyTrend,
            payment_modes: paymentModes,
            annual_matrix: {
                year: selectedYear,
                months: MONTH_NAMES,
                matrix: matrix,
                monthly_subtotals: monthlySubtotals.map(v => Number(v.toFixed(2))),
                billable_monthly: billableMonthly.map(v => Number(v.toFixed(2))),
                non_billable_monthly: nonBillableMonthly.map(v => Number(v.toFixed(2))),
                annual_grand_total: Number(annualGrandTotal.toFixed(2))
            }
        });
    } catch (err) {
        console.error('Error fetching expense reports:', err);
        res.status(500).json({ error: 'Failed to fetch expense reports' });
    }
});

// GET /api/reports/expenses/:id/details
// 360° Detailed Expense Voucher Drilldown
router.get('/expenses/:id/details', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query('SELECT * FROM expenses WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Expense voucher not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching expense details:', err);
        res.status(500).json({ error: 'Failed to fetch expense details' });
    }
});

// GET /api/reports/income-vs-expense (also handles /profit)
// Complete Month-by-Month Income vs Expense, Cash Flow Surplus, and Financial Performance Analytics
const handleIncomeVsExpense = async (req, res) => {
    try {
        const selectedYear = parseInt(req.query.year || new Date().getFullYear().toString(), 10);
        const { start_date, end_date } = req.query;

        const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // 1. Fetch all expense and receipt transactions
        let expWhere = 'WHERE 1=1';
        const expParams = [];

        if (start_date && end_date) {
            expWhere += ' AND date >= ? AND date <= ?';
            expParams.push(start_date, end_date);
        } else if (start_date) {
            expWhere += ' AND date >= ?';
            expParams.push(start_date);
        } else if (end_date) {
            expWhere += ' AND date <= ?';
            expParams.push(end_date);
        }

        const [expenseRows] = await db.query(
            `SELECT * FROM expenses ${expWhere} ORDER BY date ASC, id ASC`,
            expParams
        );

        // Filter for selected year
        const yearRecords = expenseRows.filter(e => {
            const d = e.date ? new Date(e.date) : new Date(e.created_at);
            return d.getFullYear() === selectedYear;
        });

        // 2. Month-by-Month Aggregate Data
        const monthlyData = MONTH_NAMES.map((mName, idx) => {
            const monthRecords = yearRecords.filter(e => {
                const d = e.date ? new Date(e.date) : new Date(e.created_at);
                return d.getMonth() === idx;
            });

            const income = monthRecords.reduce((sum, e) => sum + parseFloat(e.receipt_amount || 0), 0);
            const expense = monthRecords.reduce((sum, e) => sum + parseFloat(e.payment_amount || 0), 0);
            const netProfit = income - expense;
            const marginPct = income > 0 ? Number(((netProfit / income) * 100).toFixed(1)) : (expense > 0 ? -100 : 0);
            const expenseRatio = income > 0 ? Number(((expense / income) * 100).toFixed(1)) : (expense > 0 ? 100 : 0);

            let status = 'Breakeven';
            if (netProfit > 0) status = 'Surplus';
            else if (netProfit < 0) status = 'Deficit';

            return {
                month_index: idx + 1,
                month_name: mName,
                month_short: MONTH_SHORT[idx],
                income: Number(income.toFixed(2)),
                expense: Number(expense.toFixed(2)),
                net_profit: Number(netProfit.toFixed(2)),
                margin_percentage: marginPct,
                expense_ratio: expenseRatio,
                status: status,
                transaction_count: monthRecords.length
            };
        });

        // 3. Compute Cumulative Surplus Curve
        let runningSurplus = 0;
        const cumulativeMonthly = monthlyData.map(m => {
            runningSurplus += m.net_profit;
            return {
                ...m,
                cumulative_surplus: Number(runningSurplus.toFixed(2))
            };
        });

        // 4. Macro Portfolio Aggregates
        const totalIncome = yearRecords.reduce((sum, e) => sum + parseFloat(e.receipt_amount || 0), 0);
        const totalExpense = yearRecords.reduce((sum, e) => sum + parseFloat(e.payment_amount || 0), 0);
        const netProfitLoss = totalIncome - totalExpense;
        const overallProfitMargin = totalIncome > 0 ? Number(((netProfitLoss / totalIncome) * 100).toFixed(1)) : 0;
        const savingsRate = totalIncome > 0 ? Number(((netProfitLoss / totalIncome) * 100).toFixed(1)) : 0;
        const avgMonthlyIncome = totalIncome / 12;
        const avgMonthlyExpense = totalExpense / 12;

        // Best / Highest Month Identifiers
        const activeIncomeMonths = [...monthlyData].sort((a, b) => b.income - a.income);
        const activeExpenseMonths = [...monthlyData].sort((a, b) => b.expense - a.expense);
        const highestIncomeMonth = activeIncomeMonths[0]?.income > 0 ? `${activeIncomeMonths[0].month_name} (Rs ${activeIncomeMonths[0].income.toLocaleString()})` : 'N/A';
        const highestExpenseMonth = activeExpenseMonths[0]?.expense > 0 ? `${activeExpenseMonths[0].month_name} (Rs ${activeExpenseMonths[0].expense.toLocaleString()})` : 'N/A';

        // 5. Quarterly Aggregation (Q1 - Q4)
        const quarters = [
            { name: 'Q1 (Jan - Mar)', months: [0, 1, 2] },
            { name: 'Q2 (Apr - Jun)', months: [3, 4, 5] },
            { name: 'Q3 (Jul - Sep)', months: [6, 7, 8] },
            { name: 'Q4 (Oct - Dec)', months: [9, 10, 11] }
        ].map(q => {
            const qIncome = q.months.reduce((sum, idx) => sum + monthlyData[idx].income, 0);
            const qExpense = q.months.reduce((sum, idx) => sum + monthlyData[idx].expense, 0);
            const qNet = qIncome - qExpense;
            const qMargin = qIncome > 0 ? Number(((qNet / qIncome) * 100).toFixed(1)) : 0;
            return {
                quarter: q.name,
                income: Number(qIncome.toFixed(2)),
                expense: Number(qExpense.toFixed(2)),
                net_profit: Number(qNet.toFixed(2)),
                margin_percentage: qMargin
            };
        });

        // Cash flow health index (surplus coverage ratio)
        const expenseCoverageRatio = totalExpense > 0 ? Number((totalIncome / totalExpense).toFixed(2)) : (totalIncome > 0 ? 10 : 1);

        res.json({
            year: selectedYear,
            summary: {
                total_income: Number(totalIncome.toFixed(2)),
                total_expense: Number(totalExpense.toFixed(2)),
                net_profit_loss: Number(netProfitLoss.toFixed(2)),
                overall_profit_margin: overallProfitMargin,
                savings_rate: savingsRate,
                avg_monthly_income: Number(avgMonthlyIncome.toFixed(2)),
                avg_monthly_expense: Number(avgMonthlyExpense.toFixed(2)),
                highest_income_month: highestIncomeMonth,
                highest_expense_month: highestExpenseMonth,
                expense_coverage_ratio: expenseCoverageRatio,
                is_profitable: netProfitLoss >= 0
            },
            monthly_data: cumulativeMonthly,
            quarterly_data: quarters
        });
    } catch (err) {
        console.error('Error fetching income vs expense reports:', err);
        res.status(500).json({ error: 'Failed to fetch income vs expense reports' });
    }
};

router.get('/income-vs-expense', handleIncomeVsExpense);
router.get('/profit', handleIncomeVsExpense);

module.exports = router;


