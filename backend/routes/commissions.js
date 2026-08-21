const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to determine step items value with intelligent fallbacks
async function getStepItemsTotal(step, dbClient) {
  let items_total = 0;
  
  // 1. If step has specific invoice_item_ids
  if (step.invoice_item_ids) {
    let itemIds = [];
    try {
      itemIds = typeof step.invoice_item_ids === 'string' ? JSON.parse(step.invoice_item_ids) : step.invoice_item_ids;
    } catch(e) {}
    if (typeof itemIds === 'number') itemIds = [itemIds];
    if (!Array.isArray(itemIds) && itemIds !== null && itemIds !== undefined) itemIds = [itemIds];
    
    if (Array.isArray(itemIds) && itemIds.length > 0) {
      const [items] = await dbClient.query('SELECT SUM(total) as t FROM invoice_items WHERE id IN (?)', [itemIds]);
      items_total = parseFloat(items[0]?.t || 0);
    }
  }

  // 2. Fallback: If items_total is still 0, look up the project's linked invoice
  if (items_total <= 0 && step.project_id) {
    const [projInvoices] = await dbClient.query(
      'SELECT id, amount FROM invoices WHERE project_id = ? AND status != "Void" ORDER BY id DESC LIMIT 1', 
      [step.project_id]
    );
    
    if (projInvoices.length > 0 && parseFloat(projInvoices[0].amount) > 0) {
      const [[stepCount]] = await dbClient.query('SELECT COUNT(*) as total_steps FROM project_steps WHERE project_id = ?', [step.project_id]);
      const totalSteps = Math.max(1, stepCount?.total_steps || 1);
      items_total = parseFloat(projInvoices[0].amount) / totalSteps;
    } else {
      const [projItems] = await dbClient.query(
        'SELECT SUM(ii.total) as t FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE i.project_id = ? AND i.status != "Void"',
        [step.project_id]
      );
      if (projItems.length > 0 && parseFloat(projItems[0]?.t || 0) > 0) {
        const [[stepCount]] = await dbClient.query('SELECT COUNT(*) as total_steps FROM project_steps WHERE project_id = ?', [step.project_id]);
        const totalSteps = Math.max(1, stepCount?.total_steps || 1);
        items_total = parseFloat(projItems[0].t) / totalSteps;
      }
    }
  }

  return items_total;
}

// Get all forfeited commissions (late steps that resulted in 0 commission)
router.get('/forfeited', async (req, res) => {
  try {
    const { user_id, role } = req.query;
    
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

    const results = [];
    for (const step of forfeitedSteps) {
      const items_total = await getStepItemsTotal(step, db);

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
    
    // 1. Fetch Released Project Step Commissions
    let releasedQuery = `
      SELECT 
        c.id as commission_id,
        u.id as agent_id,
        u.name as agent_name,
        u.role as agent_role,
        u.commission_percentage,
        p.id as project_id,
        p.title as project_title,
        ps.id as step_id,
        COALESCE(ps.title, CONCAT('Milestone Step #', c.step_id)) as step_title,
        c.base_amount as potential_commission,
        c.final_amount as earned_commission,
        0 as pending_commission,
        c.released_at as date,
        'Paid' as status,
        ps.invoice_item_ids,
        NULL as invoice_number,
        0 as invoice_total_amount,
        0 as invoice_paid_amount
      FROM commissions c
      JOIN users u ON c.user_id = u.id
      JOIN projects p ON c.project_id = p.id
      LEFT JOIN project_steps ps ON c.step_id = ps.id
      WHERE 1=1
    `;
    const releasedParams = [];

    // 2. Fetch Pending Project Step Commissions (Unreleased steps assigned to specialists)
    let pendingQuery = `
      SELECT 
        NULL as commission_id,
        u.id as agent_id,
        u.name as agent_name,
        u.role as agent_role,
        u.commission_percentage,
        p.id as project_id,
        p.title as project_title,
        ps.id as step_id,
        ps.title as step_title,
        0 as potential_commission,
        0 as earned_commission,
        0 as pending_commission,
        COALESCE(ps.completed_at, ps.created_at) as date,
        'Pending' as status,
        ps.invoice_item_ids,
        NULL as invoice_number,
        0 as invoice_total_amount,
        0 as invoice_paid_amount
      FROM project_steps ps
      JOIN users u ON ps.assignee_id = u.id
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.commission_released = FALSE
    `;
    const pendingParams = [];

    // 3. Fetch Direct Invoice Sales Commissions
    let invoiceQuery = `
      SELECT 
        NULL as commission_id,
        u.id as agent_id,
        u.name as agent_name,
        u.role as agent_role,
        u.commission_percentage,
        p.id as project_id,
        COALESCE(p.title, CONCAT('Client Invoice #', i.invoice_number)) as project_title,
        NULL as step_id,
        'Invoice Sales Commission' as step_title,
        i.commission_amount,
        i.amount as invoice_total_amount,
        (i.amount - i.balance) as invoice_paid_amount,
        i.created_at as date,
        IF(i.balance <= 0, 'Paid', IF(i.balance < i.amount, 'Partially Paid', 'Pending')) as status,
        NULL as invoice_item_ids,
        i.invoice_number,
        c.full_name as client_name
      FROM invoices i
      JOIN users u ON i.agent_id = u.id
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.status != 'Void'
    `;
    const invoiceParams = [];

    // Apply common filters
    if (user_id && role && role !== 'Admin') {
      releasedQuery += ` AND u.id = ?`;
      releasedParams.push(user_id);
      pendingQuery += ` AND u.id = ?`;
      pendingParams.push(user_id);
      invoiceQuery += ` AND u.id = ?`;
      invoiceParams.push(user_id);
    }
    if (target_role && target_role !== 'all') {
      releasedQuery += ` AND u.role = ?`;
      releasedParams.push(target_role);
      pendingQuery += ` AND u.role = ?`;
      pendingParams.push(target_role);
      invoiceQuery += ` AND u.role = ?`;
      invoiceParams.push(target_role);
    }
    if (agent_id && agent_id !== 'all') {
      releasedQuery += ` AND u.id = ?`;
      releasedParams.push(agent_id);
      pendingQuery += ` AND u.id = ?`;
      pendingParams.push(agent_id);
      invoiceQuery += ` AND u.id = ?`;
      invoiceParams.push(agent_id);
    }
    if (start_date) {
      releasedQuery += ` AND DATE(c.released_at) >= ?`;
      releasedParams.push(start_date);
      invoiceQuery += ` AND DATE(i.created_at) >= ?`;
      invoiceParams.push(start_date);
    }
    if (end_date) {
      releasedQuery += ` AND DATE(c.released_at) <= ?`;
      releasedParams.push(end_date);
      invoiceQuery += ` AND DATE(i.created_at) <= ?`;
      invoiceParams.push(end_date);
    }

    const [releasedRows] = await db.query(releasedQuery, releasedParams);
    const [pendingRows] = await db.query(pendingQuery, pendingParams);
    const [invoiceRows] = await db.query(invoiceQuery, invoiceParams);

    let allCommissions = [];

    // Append Released Project Steps
    if (!status || status === 'all' || status === 'Paid') {
      for (const relRow of releasedRows) {
        allCommissions.push(relRow);
      }
    }

    // Process pending project steps with smart value calculation
    if (!status || status === 'all' || status === 'Pending') {
      for (const row of pendingRows) {
        const items_total = await getStepItemsTotal(row, db);
        const comm_pct = parseFloat(row.commission_percentage) || 0;
        
        if (items_total > 0 && comm_pct > 0) {
          row.potential_commission = Number(((items_total * comm_pct) / 100).toFixed(2));
          row.pending_commission = row.potential_commission;
          row.earned_commission = 0;
          allCommissions.push(row);
        }
      }
    }

    // Process Direct Invoice Sales Commissions
    for (const invRow of invoiceRows) {
      const invTotal = parseFloat(invRow.invoice_total_amount) || 0;
      const invPaid = parseFloat(invRow.invoice_paid_amount) || 0;
      const commPct = parseFloat(invRow.commission_percentage) || 0;
      
      let potential = parseFloat(invRow.commission_amount) || 0;
      if (potential <= 0 && commPct > 0 && invTotal > 0) {
        potential = (invTotal * commPct) / 100;
      }

      let fraction = 0;
      if (invTotal > 0) {
        fraction = Math.min(1, Math.max(0, invPaid / invTotal));
      }

      const earned = potential * fraction;
      const pending = potential - earned;

      invRow.potential_commission = Number(potential.toFixed(2));
      invRow.earned_commission = Number(earned.toFixed(2));
      invRow.pending_commission = Number(pending.toFixed(2));
      invRow.invoice_numbers = [invRow.invoice_number];

      if (!status || status === 'all' || 
          (status === 'Paid' && invRow.status === 'Paid') || 
          (status === 'Pending' && invRow.status !== 'Paid')) {
        allCommissions.push(invRow);
      }
    }

    // Enrich remaining project step rows with invoice numbers
    for (const row of allCommissions) {
      row.invoice_numbers = row.invoice_numbers || [];
      if (row.invoice_item_ids) {
        let itemIds = [];
        try { itemIds = typeof row.invoice_item_ids === 'string' ? JSON.parse(row.invoice_item_ids) : row.invoice_item_ids; } catch(e){}
        if (typeof itemIds === 'number') itemIds = [itemIds];
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

      if (row.invoice_numbers.length === 0 && row.project_id) {
        const [projInvs] = await db.query('SELECT invoice_number FROM invoices WHERE project_id = ?', [row.project_id]);
        if (projInvs.length > 0) {
          row.invoice_numbers = projInvs.map(i => i.invoice_number);
        }
      }
    }

    // Sort by date DESC, then earned_commission DESC
    allCommissions.sort((a, b) => {
      if (a.date && b.date) return new Date(b.date) - new Date(a.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return (b.earned_commission || 0) - (a.earned_commission || 0);
    });

    res.json(allCommissions);
  } catch (error) {
    console.error('Error fetching commissions breakdown:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all agents and their aggregate commission data
router.get('/', async (req, res) => {
  try {
    const { user_id, role, target_role, start_date, end_date, agent_id } = req.query;
    
    let userQuery = `SELECT id, name, email, role, commission_percentage FROM users WHERE role != 'Client'`;
    const userParams = [];

    if (user_id && role && role !== 'Admin') {
      userQuery += ` AND id = ?`;
      userParams.push(user_id);
    }
    if (target_role && target_role !== 'all') {
      userQuery += ` AND role = ?`;
      userParams.push(target_role);
    }
    if (agent_id && agent_id !== 'all') {
      userQuery += ` AND id = ?`;
      userParams.push(agent_id);
    }

    userQuery += ` ORDER BY name ASC`;
    const [users] = await db.query(userQuery, userParams);

    const results = [];

    for (const u of users) {
      let total_earned = 0;
      let total_paid_out = 0;
      let pending_payout = 0;
      let total_invoices = 0;
      const commPct = parseFloat(u.commission_percentage || 0);

      // 1. Direct Invoice Sales Commission
      let invSql = `SELECT amount, balance, commission_amount, status FROM invoices WHERE agent_id = ? AND status != 'Void'`;
      const invParams = [u.id];
      if (start_date) {
        invSql += ` AND DATE(created_at) >= ?`;
        invParams.push(start_date);
      }
      if (end_date) {
        invSql += ` AND DATE(created_at) <= ?`;
        invParams.push(end_date);
      }

      const [invoices] = await db.query(invSql, invParams);
      total_invoices = invoices.length;

      for (const inv of invoices) {
        const invTotal = parseFloat(inv.amount || 0);
        const invBalance = parseFloat(inv.balance || 0);
        const invPaid = Math.max(0, invTotal - invBalance);

        let potential = parseFloat(inv.commission_amount || 0);
        if (potential <= 0 && commPct > 0 && invTotal > 0) {
          potential = (invTotal * commPct) / 100;
        }

        let fraction = invTotal > 0 ? Math.min(1, Math.max(0, invPaid / invTotal)) : 0;
        let earned = potential * fraction;
        let pending = potential - earned;

        total_earned += potential;
        total_paid_out += earned;
        pending_payout += pending;
      }

      // 2. Project Steps Commission (Released)
      const [releasedProjectComms] = await db.query(
        `SELECT COALESCE(SUM(final_amount), 0) as total FROM commissions WHERE user_id = ?`, 
        [u.id]
      );
      const projReleased = parseFloat(releasedProjectComms[0]?.total || 0);
      total_paid_out += projReleased;
      total_earned += projReleased;

      // 3. Project Steps Commission (Pending / In-Progress Steps)
      const [pendingSteps] = await db.query(
        `SELECT id, project_id, invoice_item_ids FROM project_steps WHERE assignee_id = ? AND commission_released = FALSE`,
        [u.id]
      );

      for (const pStep of pendingSteps) {
        const stepVal = await getStepItemsTotal(pStep, db);
        if (stepVal > 0 && commPct > 0) {
          const stepComm = (stepVal * commPct) / 100;
          pending_payout += stepComm;
          total_earned += stepComm;
        }
      }

      results.push({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        commission_percentage: u.commission_percentage || 0,
        total_invoices,
        total_earned: Number(total_earned.toFixed(2)),
        total_paid_out: Number(total_paid_out.toFixed(2)),
        pending_payout: Number(pending_payout.toFixed(2))
      });
    }

    results.sort((a, b) => b.total_earned - a.total_earned);

    res.json(results);
  } catch (error) {
    console.error('Error fetching commission aggregates:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
