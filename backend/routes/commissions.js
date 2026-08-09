const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all forfeited commissions (late steps that resulted in 0 commission)
router.get('/forfeited', async (req, res) => {
  try {
    const { user_id, role } = req.query;
    
    // We only care about projects that are at least 'Commission Released'
    // where a step was late, and forgive_late_commission is false.
    let query = `
      SELECT 
        ps.id as step_id,
        ps.title as step_title,
        ps.deadline,
        ps.completed_at,
        p.id as project_id,
        p.title as project_title,
        p.locked_deadline,
        u.name as agent_name,
        u.commission_percentage,
        ps.invoice_item_ids
      FROM project_steps ps
      JOIN projects p ON ps.project_id = p.id
      JOIN users u ON ps.assignee_id = u.id
      WHERE p.status = 'Commission Released'
        AND ps.status = 'Completed'
        AND ps.forgive_late_commission = FALSE
        AND ps.deadline IS NOT NULL
        AND ps.completed_at IS NOT NULL
        AND DATE(ps.completed_at) > DATE(ps.deadline)
    `;

    const params = [];
    if (user_id && role && role !== 'Admin') {
      query += ` AND ps.assignee_id = ?`;
      params.push(user_id);
    }

    query += ` ORDER BY ps.completed_at DESC`;

    const [forfeitedSteps] = await db.query(query, params);

    // Now we need to calculate the potential commission for each step
    const results = [];
    for (const step of forfeitedSteps) {
      let items_total = 0;
      if (step.invoice_item_ids) {
        let itemIds = [];
        try { itemIds = typeof step.invoice_item_ids === 'string' ? JSON.parse(step.invoice_item_ids) : step.invoice_item_ids; } catch(e){}
        if (Array.isArray(itemIds) && itemIds.length > 0) {
          const [items] = await db.query('SELECT SUM(total) as t FROM invoice_items WHERE id IN (?)', [itemIds]);
          items_total = items[0].t || 0;
        }
      }

      if (items_total > 0) {
        const comm_pct = parseFloat(step.commission_percentage) || 0;
        const potential_base = items_total * (comm_pct / 100);
        
        results.push({
          ...step,
          items_total,
          potential_commission: potential_base
        });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get detailed breakdown of commissions (Paid and Pending)
router.get('/breakdown', async (req, res) => {
  try {
    const { user_id, role, target_role, start_date, end_date, agent_id, status } = req.query;
    
    // 1. Fetch Released Commissions
    let releasedQuery = `
      SELECT 
        c.id as commission_id,
        u.id as agent_id,
        u.name as agent_name,
        u.role as agent_role,
        p.id as project_id,
        p.title as project_title,
        ps.id as step_id,
        ps.title as step_title,
        c.final_amount as amount,
        c.released_at as date,
        'Paid' as status,
        ps.invoice_item_ids
      FROM commissions c
      JOIN users u ON c.user_id = u.id
      JOIN projects p ON c.project_id = p.id
      LEFT JOIN project_steps ps ON c.step_id = ps.id
      WHERE u.role NOT IN ('Sales', 'Sales Rep')
    `;
    const releasedParams = [];

    // 2. Fetch Pending Commissions (from completed steps not yet released)
    let pendingQuery = `
      SELECT 
        NULL as commission_id,
        u.id as agent_id,
        u.name as agent_name,
        u.role as agent_role,
        p.id as project_id,
        p.title as project_title,
        ps.id as step_id,
        ps.title as step_title,
        0 as amount, -- We will calculate this below
        NULL as date,
        'Pending' as status,
        ps.invoice_item_ids,
        u.commission_percentage
      FROM project_steps ps
      JOIN users u ON ps.assignee_id = u.id
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.commission_released = FALSE AND u.role NOT IN ('Sales', 'Sales Rep')
    `;
    const pendingParams = [];

    // Apply common filters
    if (user_id && role && role !== 'Admin') {
      releasedQuery += ` AND u.id = ?`;
      releasedParams.push(user_id);
      pendingQuery += ` AND u.id = ?`;
      pendingParams.push(user_id);
    }
    if (target_role && target_role !== 'all') {
      releasedQuery += ` AND u.role = ?`;
      releasedParams.push(target_role);
      pendingQuery += ` AND u.role = ?`;
      pendingParams.push(target_role);
    }
    if (agent_id && agent_id !== 'all') {
      releasedQuery += ` AND u.id = ?`;
      releasedParams.push(agent_id);
      pendingQuery += ` AND u.id = ?`;
      pendingParams.push(agent_id);
    }
    if (start_date) {
      releasedQuery += ` AND DATE(c.released_at) >= ?`;
      releasedParams.push(start_date);
    }
    if (end_date) {
      releasedQuery += ` AND DATE(c.released_at) <= ?`;
      releasedParams.push(end_date);
    }

    const [releasedRows] = await db.query(releasedQuery, releasedParams);
    const [pendingRows] = await db.query(pendingQuery, pendingParams);

    // 3. Fetch Invoice Commissions (Sales)
    let invoiceQuery = `
      SELECT 
        NULL as commission_id,
        u.id as agent_id,
        u.name as agent_name,
        u.role as agent_role,
        p.id as project_id,
        p.title as project_title,
        NULL as step_id,
        'Invoice Commission' as step_title,
        i.commission_amount as amount,
        i.created_at as date,
        IF(i.status = 'Paid', 'Paid', 'Pending') as status,
        NULL as invoice_item_ids,
        i.invoice_number
      FROM invoices i
      JOIN users u ON i.agent_id = u.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.commission_amount > 0
    `;
    const invoiceParams = [];

    if (user_id && role && role !== 'Admin') {
      invoiceQuery += ` AND u.id = ?`;
      invoiceParams.push(user_id);
    }
    if (target_role && target_role !== 'all') {
      invoiceQuery += ` AND u.role = ?`;
      invoiceParams.push(target_role);
    }
    if (agent_id && agent_id !== 'all') {
      invoiceQuery += ` AND u.id = ?`;
      invoiceParams.push(agent_id);
    }
    if (start_date) {
      invoiceQuery += ` AND DATE(i.created_at) >= ?`;
      invoiceParams.push(start_date);
    }
    if (end_date) {
      invoiceQuery += ` AND DATE(i.created_at) <= ?`;
      invoiceParams.push(end_date);
    }
    if (status && status !== 'all') {
      if (status === 'Paid') invoiceQuery += ` AND i.status = 'Paid'`;
      if (status === 'Pending') invoiceQuery += ` AND i.status != 'Paid'`;
    }

    const [invoiceRows] = await db.query(invoiceQuery, invoiceParams);

    let allCommissions = [];

    if (!status || status === 'all' || status === 'Paid') {
      allCommissions = allCommissions.concat(releasedRows);
    }

    // Process pending to calculate potential amount
    if (!status || status === 'all' || status === 'Pending') {
      for (const row of pendingRows) {
        if (row.invoice_item_ids) {
          let itemIds = [];
          try { itemIds = typeof row.invoice_item_ids === 'string' ? JSON.parse(row.invoice_item_ids) : row.invoice_item_ids; } catch(e){}
          if (!Array.isArray(itemIds) && itemIds !== null && itemIds !== undefined) itemIds = [itemIds];
          
          if (Array.isArray(itemIds) && itemIds.length > 0) {
            const [items] = await db.query('SELECT SUM(total) as t FROM invoice_items WHERE id IN (?)', [itemIds]);
            const items_total = items[0].t || 0;
            const comm_pct = parseFloat(row.commission_percentage) || 0;
            row.amount = items_total * (comm_pct / 100);
            
            // Only include if amount > 0
            if (row.amount > 0) {
              allCommissions.push(row);
            }
          }
        }
      }
    }

    // Now enrich with invoice numbers
    for (const row of allCommissions) {
      row.invoice_numbers = row.invoice_numbers || [];
      // If it came from the invoices query, it already has invoice_number
      if (row.invoice_number) {
        row.invoice_numbers.push(row.invoice_number);
      }
      if (row.invoice_item_ids) {
        let itemIds = [];
        try { itemIds = typeof row.invoice_item_ids === 'string' ? JSON.parse(row.invoice_item_ids) : row.invoice_item_ids; } catch(e){}
        if (!Array.isArray(itemIds) && itemIds !== null && itemIds !== undefined) itemIds = [itemIds];
        
        if (Array.isArray(itemIds) && itemIds.length > 0) {
          const [invoices] = await db.query(`
            SELECT DISTINCT i.invoice_number 
            FROM invoice_items it
            JOIN invoices i ON it.invoice_id = i.id
            WHERE it.id IN (?)
          `, [itemIds]);
          const newInvs = invoices.map(inv => inv.invoice_number);
          row.invoice_numbers = [...row.invoice_numbers, ...newInvs];
        }
      }
    }

    // Append invoiceRows which are pre-processed
    for (const row of invoiceRows) {
      row.invoice_numbers = [row.invoice_number];
      allCommissions.push(row);
    }

    // Sort by date DESC, then amount DESC
    allCommissions.sort((a, b) => {
      if (a.date && b.date) return new Date(b.date) - new Date(a.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return b.amount - a.amount;
    });

    res.json(allCommissions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all agents and their aggregate commission data
router.get('/', async (req, res) => {
  try {
    const { user_id, role, target_role, start_date, end_date, agent_id, status } = req.query;
    
    let query = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role,
        u.commission_percentage,
        COUNT(c.id) as total_invoices,
        COALESCE(SUM(c.base_amount), 0) as total_earned_project,
        COALESCE(SUM(c.final_amount), 0) as total_paid_out_project
      FROM users u
      LEFT JOIN commissions c ON u.id = c.user_id AND u.role NOT IN ('Sales', 'Sales Rep')
    `;
    
    const conditions = ["u.role != 'Client'"];
    const params = [];
    
    if (user_id && role && role !== 'Admin') {
      conditions.push('u.id = ?');
      params.push(user_id);
    }

    if (target_role && target_role !== 'all') {
      conditions.push('u.role = ?');
      params.push(target_role);
    }

    if (agent_id && agent_id !== 'all') {
      conditions.push('u.id = ?');
      params.push(agent_id);
    }

    if (start_date) {
      conditions.push('(c.released_at >= ? OR c.released_at IS NULL)');
      params.push(start_date);
    }

    if (end_date) {
      conditions.push('(c.released_at <= ? OR c.released_at IS NULL)');
      params.push(end_date);
    }

    if (status && status !== 'all') {
      conditions.push('(c.status = ? OR c.status IS NULL)');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    
    query += `
      GROUP BY u.id
      ORDER BY total_earned_project DESC, u.name ASC
    `;
    const [rows] = await db.query(query, params);

    // Calculate pending payout for each user and add invoice commissions
    for (const row of rows) {
      let pending_payout = 0;
      let total_earned = parseFloat(row.total_earned_project) || 0;
      let total_paid_out = parseFloat(row.total_paid_out_project) || 0;
      row.total_invoices = 0; // Will be set by invoice logic for Sales
      
      if (row.role !== 'Sales' && row.role !== 'Sales Rep') {
        const [pendingSteps] = await db.query('SELECT invoice_item_ids FROM project_steps WHERE assignee_id = ? AND commission_released = FALSE', [row.id]);
      
      for (const step of pendingSteps) {
        if (step.invoice_item_ids) {
          let itemIds = [];
          try { itemIds = typeof step.invoice_item_ids === 'string' ? JSON.parse(step.invoice_item_ids) : step.invoice_item_ids; } catch(e){}
          if (!Array.isArray(itemIds) && itemIds !== null && itemIds !== undefined) itemIds = [itemIds];
          
          if (Array.isArray(itemIds) && itemIds.length > 0) {
            const [items] = await db.query('SELECT SUM(total) as t FROM invoice_items WHERE id IN (?)', [itemIds]);
            const items_total = items[0].t || 0;
            const comm_pct = parseFloat(row.commission_percentage) || 0;
            pending_payout += items_total * (comm_pct / 100);
          }
        }
      }
      }

      // Add invoice commissions (Sales)
      const [invoiceCommissions] = await db.query('SELECT commission_amount, status FROM invoices WHERE agent_id = ? AND commission_amount > 0', [row.id]);
      for (const inv of invoiceCommissions) {
        total_earned += parseFloat(inv.commission_amount);
        if (inv.status === 'Paid') {
          total_paid_out += parseFloat(inv.commission_amount);
        } else {
          pending_payout += parseFloat(inv.commission_amount);
        }
        row.total_invoices += 1;
      }
      
      row.total_earned = total_earned;
      row.total_paid_out = total_paid_out;
      row.pending_payout = pending_payout;
    }

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
