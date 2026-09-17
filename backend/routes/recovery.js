const express = require('express');
const router = express.Router();
const db = require('../db');
const { notifyUserWhatsApp } = require('../utils/whatsapp');

/**
 * Helper: Calculate Category, Communication Tone Guidance, and Priority Score
 */
function evaluateCaseCategoryAndTone(caseRow, settings) {
  const highValThresh = Number(settings?.high_value_threshold || 100000);
  const noRespThresh = Number(settings?.no_response_attempts_threshold || 3);
  const missedPromThresh = Number(settings?.missed_promises_threshold || 2);
  const outstanding = Number(caseRow.outstanding_amount || 0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const promisedDateStr = caseRow.promised_date ? new Date(caseRow.promised_date).toISOString().slice(0, 10) : null;

  let category = 'Contact Required';
  let tone = 'Professional / Helpful';

  if (caseRow.escalation_level === 'Management Escalation' || caseRow.unsuccessful_attempts_count >= (noRespThresh + 2)) {
    category = 'Management Escalation';
    tone = 'Formal / Controlled';
  } else if (caseRow.category === 'Dispute') {
    category = 'Dispute';
    tone = 'Neutral / Resolution-focused';
  } else if (outstanding >= highValThresh) {
    category = 'High-Value Recovery';
    tone = 'Top Priority / Senior Involvement';
  } else if (caseRow.unsuccessful_attempts_count >= noRespThresh) {
    category = 'No Response';
    tone = 'Formal / Escalated';
  } else if (caseRow.missed_promises_count >= missedPromThresh) {
    category = 'Repeated Delay';
    tone = 'Direct / Firm';
  } else if (promisedDateStr && promisedDateStr < todayStr && Number(caseRow.outstanding_amount) > 0) {
    category = 'Promise Missed';
    tone = 'Firm / Professional';
  } else if (promisedDateStr && promisedDateStr >= todayStr) {
    category = 'Payment Promised';
    tone = 'Friendly but Firm';
  } else if (caseRow.last_followup_date) {
    category = 'Normal Follow-up';
    tone = 'Friendly / Professional';
  } else {
    category = 'Contact Required';
    tone = 'Professional / Helpful';
  }

  // Calculate priority score (higher score = higher priority)
  let priorityScore = Math.floor(outstanding / 1000);
  if (category === 'High-Value Recovery') priorityScore += 500;
  if (category === 'Management Escalation') priorityScore += 1000;
  if (category === 'Promise Missed') priorityScore += 300;
  if (category === 'Repeated Delay') priorityScore += 400;

  return { category, tone, priorityScore, isHighValue: outstanding >= highValThresh ? 1 : 0 };
}

/**
 * 1. GET /api/recovery - Recovery Queue List
 */
router.get('/', async (req, res) => {
  try {
    const { search, salesperson_id, category, status, priority, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClauses = ['rc.is_active = 1'];
    let queryParams = [];

    if (salesperson_id && salesperson_id !== 'All') {
      whereClauses.push('rc.assigned_salesperson_id = ?');
      queryParams.push(salesperson_id);
    }

    if (category && category !== 'All') {
      whereClauses.push('rc.category = ?');
      queryParams.push(category);
    }

    if (status && status !== 'All') {
      whereClauses.push('rc.status = ?');
      queryParams.push(status);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClauses.push('(c.full_name LIKE ? OR c.business_name LIKE ? OR i.invoice_number LIKE ? OR p.title LIKE ? OR rc.case_number LIKE ?)');
      queryParams.push(term, term, term, term, term);
    }

    const whereSql = whereClauses.join(' AND ');

    // Order strictly by Outstanding Amount (Highest to Lowest) then Days Overdue & Priority
    const query = `
      SELECT 
        rc.*,
        c.full_name AS client_name,
        c.business_name AS client_business_name,
        c.email AS client_email,
        c.whatsapp_number AS client_whatsapp,
        i.invoice_number,
        i.amount AS invoice_amount,
        i.balance AS invoice_balance,
        i.due_date AS invoice_due_date,
        p.title AS project_title,
        p.status AS project_status,
        u.name AS salesperson_name,
        DATEDIFF(CURRENT_DATE, i.due_date) AS days_overdue
      FROM recovery_cases rc
      LEFT JOIN clients c ON rc.client_id = c.id
      LEFT JOIN invoices i ON rc.invoice_id = i.id
      LEFT JOIN projects p ON rc.project_id = p.id
      LEFT JOIN users u ON rc.assigned_salesperson_id = u.id
      WHERE ${whereSql}
      ORDER BY rc.outstanding_amount DESC, days_overdue DESC, rc.missed_promises_count DESC, rc.priority_score DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(Number(limit), Number(offset));
    const [rows] = await db.query(query, queryParams);

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM recovery_cases rc 
       LEFT JOIN clients c ON rc.client_id = c.id 
       LEFT JOIN invoices i ON rc.invoice_id = i.id 
       WHERE ${whereSql}`,
      queryParams.slice(0, queryParams.length - 2)
    );

    res.json({
      cases: rows,
      total: countRows[0]?.total || 0,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    console.error('Error fetching recovery queue:', error);
    res.status(500).json({ error: 'Failed to fetch recovery queue' });
  }
});

/**
 * 2. GET /api/recovery/stats - Recovery Portal Summary KPIs
 */
router.get('/stats', async (req, res) => {
  try {
    const { salesperson_id } = req.query;
    let whereSql = 'WHERE is_active = 1';
    let params = [];

    if (salesperson_id && salesperson_id !== 'All') {
      whereSql += ' AND assigned_salesperson_id = ?';
      params.push(salesperson_id);
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    const [rows] = await db.query(`
      SELECT 
        COALESCE(SUM(outstanding_amount), 0) AS total_assigned,
        COALESCE(SUM(recovered_amount), 0) AS total_recovered,
        COUNT(CASE WHEN status != 'Closed' AND status != 'Recovered' THEN 1 END) AS active_cases,
        COUNT(CASE WHEN (last_followup_date IS NULL OR status = 'New') AND status != 'Closed' AND status != 'Recovered' THEN 1 END) AS pending_touch_cases,
        COUNT(CASE WHEN DATE(next_followup_date) = ? THEN 1 END) AS followup_today,
        COUNT(CASE WHEN category = 'Payment Promised' OR (promised_date >= ?) THEN 1 END) AS payment_promised,
        COUNT(CASE WHEN category = 'Promise Missed' OR (promised_date < ? AND outstanding_amount > 0) THEN 1 END) AS overdue_cases
      FROM recovery_cases
      ${whereSql}
    `, [todayStr, todayStr, todayStr, ...params]);

    const stats = rows[0] || {};
    res.json({
      total_assigned: Number(stats.total_assigned || 0),
      total_recovered: Number(stats.total_recovered || 0),
      total_outstanding: Number(stats.total_assigned || 0) - Number(stats.total_recovered || 0),
      active_cases: Number(stats.active_cases || 0),
      pending_touch_cases: Number(stats.pending_touch_cases || 0),
      followup_today: Number(stats.followup_today || 0),
      overdue_cases: Number(stats.overdue_cases || 0),
      payment_promised: Number(stats.payment_promised || 0)
    });
  } catch (error) {
    console.error('Error fetching recovery stats:', error);
    res.status(500).json({ error: 'Failed to fetch recovery KPI stats' });
  }
});

/**
 * 3. GET /api/recovery/settings - Fetch Configurable Settings
 */
router.get('/settings', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM recovery_settings LIMIT 1');
    if (rows.length === 0) {
      return res.json({
        high_value_threshold: 100000.00,
        no_response_attempts_threshold: 3,
        missed_promises_threshold: 2,
        auto_overdue_days: 15
      });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching recovery settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * 4. PUT /api/recovery/settings - Update Settings
 */
router.put('/settings', async (req, res) => {
  try {
    const { high_value_threshold, no_response_attempts_threshold, missed_promises_threshold, auto_overdue_days } = req.body;
    const [rows] = await db.query('SELECT id FROM recovery_settings LIMIT 1');

    if (rows.length > 0) {
      await db.query(`
        UPDATE recovery_settings 
        SET high_value_threshold = ?, no_response_attempts_threshold = ?, missed_promises_threshold = ?, auto_overdue_days = ?
        WHERE id = ?
      `, [high_value_threshold, no_response_attempts_threshold, missed_promises_threshold, auto_overdue_days, rows[0].id]);
    } else {
      await db.query(`
        INSERT INTO recovery_settings (high_value_threshold, no_response_attempts_threshold, missed_promises_threshold, auto_overdue_days)
        VALUES (?, ?, ?, ?)
      `, [high_value_threshold, no_response_attempts_threshold, missed_promises_threshold, auto_overdue_days]);
    }

    res.json({ message: 'Recovery settings updated successfully' });
  } catch (error) {
    console.error('Error updating recovery settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * GET /api/recovery/categories - Fetch all custom & default recovery categories
 */
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM recovery_categories ORDER BY id ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching recovery categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * POST /api/recovery/categories - Create a new custom recovery category
 */
router.post('/categories', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const [result] = await db.query(
      'INSERT INTO recovery_categories (name, color) VALUES (?, ?)',
      [name.trim(), color || '#4f46e5']
    );
    res.status(201).json({ success: true, id: result.insertId, name: name.trim(), color: color || '#4f46e5' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Category name already exists' });
    }
    console.error('Error adding recovery category:', error);
    res.status(500).json({ error: 'Failed to add custom category' });
  }
});

/**
 * DELETE /api/recovery/categories/:id - Delete a custom category
 */
router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM recovery_categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting recovery category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

/**
 * 5. GET /api/recovery/:id - Full 8-Tab Case Detail Object
 */
router.get('/:id', async (req, res) => {
  try {
    const caseId = req.params.id;

    // Core Case & Linked Records
    const [caseRows] = await db.query(`
      SELECT 
        rc.*,
        c.full_name AS client_name,
        c.business_name AS client_business_name,
        c.email AS client_email,
        c.whatsapp_number AS client_whatsapp,
        c.physical_address AS client_address,
        i.invoice_number,
        i.amount AS invoice_amount,
        i.balance AS invoice_balance,
        i.issue_date AS invoice_issue_date,
        i.due_date AS invoice_due_date,
        i.status AS invoice_status,
        p.title AS project_title,
        p.description AS project_description,
        p.status AS project_status,
        p.total_steps,
        p.completed_steps,
        u.name AS salesperson_name,
        u.email AS salesperson_email,
        orig_u.name AS original_salesperson_name,
        creator.name AS creator_name,
        DATEDIFF(CURRENT_DATE, i.due_date) AS days_overdue
      FROM recovery_cases rc
      LEFT JOIN clients c ON rc.client_id = c.id
      LEFT JOIN invoices i ON rc.invoice_id = i.id
      LEFT JOIN projects p ON rc.project_id = p.id
      LEFT JOIN users u ON rc.assigned_salesperson_id = u.id
      LEFT JOIN users orig_u ON rc.original_salesperson_id = orig_u.id
      LEFT JOIN users creator ON rc.created_by_user_id = creator.id
      WHERE (rc.id = ? OR rc.case_number = ?)
      ORDER BY CASE WHEN rc.id = ? THEN 1 WHEN rc.case_number = ? THEN 2 ELSE 3 END, rc.id DESC
      LIMIT 1
    `, [caseId, caseId, caseId, caseId]);

    if (caseRows.length === 0) {
      return res.status(404).json({ error: 'Recovery case not found' });
    }

    const caseData = caseRows[0];

    // Tab 1: Contacts
    const [contacts] = await db.query('SELECT * FROM recovery_contacts WHERE recovery_case_id = ? ORDER BY created_at DESC', [caseData.id]);

    // Tab 2: Financial Payments & Items
    let invoiceItems = [];
    let paymentHistory = [];
    if (caseData.invoice_id) {
      const [iRows] = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [caseData.invoice_id]);
      invoiceItems = iRows;
    }

    // Fetch payments for case invoice and client invoices (from invoice_payments)
    let clientPayments = [];
    if (caseData.client_id || caseData.invoice_id) {
      const [ipRows] = await db.query(`
        SELECT ip.*, i.invoice_number 
        FROM invoice_payments ip
        JOIN invoices i ON ip.invoice_id = i.id
        WHERE i.client_id = ? OR ip.invoice_id = ?
        ORDER BY ip.payment_date DESC, ip.id DESC
      `, [caseData.client_id || 0, caseData.invoice_id || 0]);

      paymentHistory = ipRows;
      clientPayments = ipRows;
    }

    // All Client Invoices
    let allClientInvoices = [];
    let clientStats = { total_invoices: 0, total_invoiced: 0, total_paid: 0, total_outstanding: 0, total_projects: 0, active_projects: 0, completed_projects: 0 };
    if (caseData.client_id) {
      const [invs] = await db.query(`
        SELECT i.*, (i.amount - i.balance) AS paid_amount 
        FROM invoices i 
        WHERE i.client_id = ? 
        ORDER BY i.created_at DESC
      `, [caseData.client_id]);
      allClientInvoices = invs;

      const [statRows] = await db.query(`
        SELECT 
          COUNT(id) AS total_invoices,
          COALESCE(SUM(amount), 0) AS total_invoiced,
          COALESCE(SUM(amount - balance), 0) AS total_paid,
          COALESCE(SUM(balance), 0) AS total_outstanding
        FROM invoices 
        WHERE client_id = ?
      `, [caseData.client_id]);
      
      if (statRows.length > 0) {
        clientStats.total_invoices = Number(statRows[0].total_invoices || 0);
        clientStats.total_invoiced = Number(statRows[0].total_invoiced || 0);
        clientStats.total_paid = Number(statRows[0].total_paid || 0);
        clientStats.total_outstanding = Number(statRows[0].total_outstanding || 0);
      }
    }

    // Tab 3: Project Steps & Deliverables & All Client Projects
    let projectSteps = [];
    let deliverables = [];
    let allClientProjects = [];
    if (caseData.project_id) {
      const [sRows] = await db.query('SELECT * FROM project_steps WHERE project_id = ? ORDER BY id ASC', [caseData.project_id]);
      projectSteps = sRows;
      const [dRows] = await db.query('SELECT * FROM deliverables WHERE project_id = ? ORDER BY created_at DESC', [caseData.project_id]);
      deliverables = dRows;
    }

    if (caseData.client_id) {
      const [pRows] = await db.query(`
        SELECT p.*, 
          (SELECT COUNT(*) FROM project_steps WHERE project_id = p.id) AS total_steps_calc,
          (SELECT COUNT(*) FROM project_steps WHERE project_id = p.id AND status = 'Completed') AS completed_steps_calc
        FROM projects p 
        WHERE p.client_id = ? 
        ORDER BY p.created_at DESC
      `, [caseData.client_id]);
      allClientProjects = pRows;

      clientStats.total_projects = pRows.length;
      clientStats.completed_projects = pRows.filter(pr => pr.status === 'Completed' || pr.status === 'Paid').length;
      clientStats.active_projects = pRows.filter(pr => pr.status !== 'Completed' && pr.status !== 'Cancelled').length;
    }

    // Tab 4: Timeline Events
    const [timeline] = await db.query(`
      SELECT rt.*, u.name AS user_name 
      FROM recovery_timeline rt 
      LEFT JOIN users u ON rt.user_id = u.id 
      WHERE rt.recovery_case_id = ? 
      ORDER BY rt.created_at DESC
    `, [caseData.id]);

    // Tab 5: Follow-up History
    const [followups] = await db.query(`
      SELECT rf.*, u.name AS user_name 
      FROM recovery_followups rf 
      LEFT JOIN users u ON rf.user_id = u.id 
      WHERE rf.recovery_case_id = ? 
      ORDER BY rf.created_at DESC
    `, [caseData.id]);

    // Tab 6: Quotations
    let quotations = [];
    if (caseData.client_id) {
      const [qRows] = await db.query('SELECT id, quotation_number, amount, status, created_at FROM quotations WHERE client_id = ? ORDER BY created_at DESC', [caseData.client_id]);
      quotations = qRows;
    }

    res.json({
      case: caseData,
      contacts,
      financial: {
        invoice_items: invoiceItems,
        payment_history: paymentHistory,
        all_invoices: allClientInvoices,
        client_payments: clientPayments
      },
      project: {
        steps: projectSteps,
        deliverables,
        all_projects: allClientProjects
      },
      client_stats: clientStats,
      timeline,
      followups,
      quotations
    });
  } catch (error) {
    console.error('Error fetching recovery case detail:', error);
    res.status(500).json({ error: 'Failed to fetch case detail' });
  }
});

/**
 * 6. POST /api/recovery/manual-trigger - Manager Sends Case to Recovery
 */
const handleTriggerCase = async (req, res) => {
  try {
    let { invoice_id, project_id, trigger_reason, manager_reason, manager_remark, assigned_salesperson_id, user_id } = req.body;
    const reason = trigger_reason || manager_reason || 'Manual Manager Trigger';

    // If project_id is provided, check if active recovery case already exists for project
    if (project_id) {
      const [pCases] = await db.query(
        "SELECT id, case_number FROM recovery_cases WHERE project_id = ? AND status != 'Closed' AND status != 'Recovered' AND is_active = 1",
        [project_id]
      );
      if (pCases.length > 0) {
        return res.status(400).json({
          success: false,
          error: `An active recovery case (${pCases[0].case_number}) already exists for this project.`
        });
      }
    }

    // If project_id is provided but invoice_id is missing, look up or create invoice for project
    if (!invoice_id && project_id) {
      const [invByProj] = await db.query('SELECT id FROM invoices WHERE project_id = ? ORDER BY id DESC LIMIT 1', [project_id]);
      if (invByProj.length > 0) {
        invoice_id = invByProj[0].id;
      } else {
        // Find project client
        const [projRows] = await db.query('SELECT client_id FROM projects WHERE id = ?', [project_id]);

        // Auto-create recovery invoice if still no invoice found specifically for this project
        if (!invoice_id && projRows.length > 0) {
          const p = projRows[0];
          const invNum = `INV-REC-${Date.now().toString().slice(-6)}`;
          const [invRes] = await db.query(`
            INSERT INTO invoices (invoice_number, client_id, project_id, amount, balance, status, issue_date, due_date, created_by)
            VALUES (?, ?, ?, 0.00, 0.00, 'Overdue', CURRENT_DATE, CURRENT_DATE, ?)
          `, [invNum, p.client_id || 1, project_id, user_id || 1]);
          invoice_id = invRes.insertId;
        }
      }
    }

    if (!invoice_id) {
      return res.status(400).json({ success: false, error: 'No invoice found associated with this project. Please create an invoice first.' });
    }

    // Fetch Invoice details
    const [invRows] = await db.query('SELECT * FROM invoices WHERE id = ?', [invoice_id]);
    if (invRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }
    const inv = invRows[0];
    const outstanding = Number(inv.balance !== undefined && inv.balance !== null ? inv.balance : inv.amount);

    // Ensure invoice is linked to project if project_id was passed
    if (project_id && !inv.project_id) {
      await db.query('UPDATE invoices SET project_id = ? WHERE id = ?', [project_id, invoice_id]);
      inv.project_id = project_id;
    }

    // Prevent active duplicate case for same invoice
    const [existingCases] = await db.query(
      "SELECT id, case_number FROM recovery_cases WHERE invoice_id = ? AND status != 'Closed' AND status != 'Recovered' AND is_active = 1",
      [invoice_id]
    );

    if (existingCases.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: `An active recovery case (${existingCases[0].case_number}) already exists for this invoice.` 
      });
    }

    // Determine default Salesperson if not manually specified
    let targetSalespersonId = assigned_salesperson_id;
    if (!targetSalespersonId) {
      const [clientRows] = await db.query('SELECT user_id FROM clients WHERE id = ?', [inv.client_id]);
      targetSalespersonId = clientRows[0]?.user_id || inv.agent_id || user_id || 1;
    }

    // Generate unique case number
    const caseNumber = `REC-${Date.now().toString().slice(-6)}`;

    // Insert recovery case
    const [result] = await db.query(`
      INSERT INTO recovery_cases (
        case_number, invoice_id, project_id, client_id, assigned_salesperson_id,
        created_by_user_id, trigger_type, manager_reason, manager_remark,
        outstanding_amount, status, category, tone_guidance
      ) VALUES (?, ?, ?, ?, ?, ?, 'Manual Manager', ?, ?, ?, 'New', 'Contact Required', 'Professional / Helpful')
    `, [
      caseNumber, invoice_id, project_id || inv.project_id || null, inv.client_id,
      targetSalespersonId, user_id || null, reason,
      manager_remark || '', outstanding
    ]);

    const newCaseId = result.insertId;

    // Fetch settings and evaluate initial category and priority
    const [settings] = await db.query('SELECT * FROM recovery_settings LIMIT 1');
    const evalData = evaluateCaseCategoryAndTone({ outstanding_amount: outstanding, category: 'Contact Required' }, settings[0]);

    await db.query(`
      UPDATE recovery_cases 
      SET category = ?, tone_guidance = ?, priority_score = ?, is_high_value = ? 
      WHERE id = ?
    `, [evalData.category, evalData.tone, evalData.priorityScore, evalData.isHighValue, newCaseId]);

    // Insert Timeline Event
    await db.query(`
      INSERT INTO recovery_timeline (recovery_case_id, event_type, user_id, title, description)
      VALUES (?, 'Case Created', ?, 'Recovery Case Triggered', ?)
    `, [newCaseId, user_id || null, `Manager triggered recovery for Invoice #${inv.invoice_number} (Outstanding: PKR ${outstanding.toLocaleString()}). Reason: ${reason}`]);

    // Send In-App & WhatsApp Notification to Salesperson
    await db.query(`
      INSERT INTO notifications (user_id, message, link)
      VALUES (?, ?, ?)
    `, [targetSalespersonId, `🚨 Overdue Recovery Case Assigned: ${caseNumber} for Invoice ${inv.invoice_number} (PKR ${outstanding.toLocaleString()}). Invoice due date exceeded!`, `/recovery?case=${newCaseId}`]);

    notifyUserWhatsApp(
      targetSalespersonId,
      `*ERP Recovery Alert!* 🚨\n\nInvoice *${inv.invoice_number}* due date has exceeded and moved to Recovery Queue.\n\nCase *${caseNumber}* (PKR ${outstanding.toLocaleString()}) has been assigned to you for client follow-up.\n\n_Log in to CRM to record client discussion._`
    ).catch(err => console.error('WhatsApp notify error:', err));

    res.status(201).json({ success: true, id: newCaseId, case_number: caseNumber, message: 'Recovery case created successfully' });
  } catch (error) {
    console.error('Error creating manual recovery case:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create recovery case' });
  }
};

router.post('/trigger', handleTriggerCase);
router.post('/manual-trigger', handleTriggerCase);

/**
 * 7. POST /api/recovery/:id/followups - Record Follow-up Entry Form
 */
router.post('/:id/followups', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { user_id, method, outcome, remark, promised_amount, promised_date, next_followup_date, attachment_url } = req.body;

    if (!remark || !remark.trim()) {
      return res.status(400).json({ error: 'Follow-up remark is required' });
    }

    const [caseRows] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', [caseId]);
    if (caseRows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    const currentCase = caseRows[0];

    // Insert Followup
    await db.query(`
      INSERT INTO recovery_followups (
        recovery_case_id, user_id, method, outcome, remark, promised_amount, promised_date, next_followup_date, attachment_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      caseId, user_id || currentCase.assigned_salesperson_id, method || 'Call',
      outcome || 'Other', remark.trim(), promised_amount || null,
      promised_date || null, next_followup_date || null, attachment_url || null
    ]);

    // Update Case state counters
    let missedPromises = currentCase.missed_promises_count;
    let unsuccessfulAttempts = currentCase.unsuccessful_attempts_count;

    if (outcome === 'No Response') {
      unsuccessfulAttempts += 1;
    }

    // Re-evaluate Category and Tone
    const [settings] = await db.query('SELECT * FROM recovery_settings LIMIT 1');
    const updatedCaseObj = {
      ...currentCase,
      outcome,
      promised_date: promised_date || currentCase.promised_date,
      missed_promises_count: missedPromises,
      unsuccessful_attempts_count: unsuccessfulAttempts,
      last_followup_date: new Date()
    };

    const evalRes = evaluateCaseCategoryAndTone(updatedCaseObj, settings[0]);

    let newStatus = currentCase.status === 'New' ? 'Follow-up' : currentCase.status;
    if (outcome === 'Payment Promised') {
      newStatus = 'Payment Promised';
    }

    // Update Recovery Case
    await db.query(`
      UPDATE recovery_cases 
      SET 
        status = ?,
        category = ?,
        tone_guidance = ?,
        priority_score = ?,
        is_high_value = ?,
        promised_amount = COALESCE(?, promised_amount),
        promised_date = COALESCE(?, promised_date),
        next_followup_date = ?,
        last_followup_date = CURRENT_TIMESTAMP,
        last_followup_remark = ?,
        missed_promises_count = ?,
        unsuccessful_attempts_count = ?
      WHERE id = ?
    `, [
      newStatus, evalRes.category, evalRes.tone, evalRes.priorityScore, evalRes.isHighValue,
      promised_amount || null, promised_date || null, next_followup_date || null,
      remark.trim(), missedPromises, unsuccessfulAttempts, caseId
    ]);

    // Insert Timeline Event
    await db.query(`
      INSERT INTO recovery_timeline (recovery_case_id, event_type, user_id, title, description)
      VALUES (?, 'Follow-up Added', ?, ?, ?)
    `, [caseId, user_id || null, `Follow-up via ${method} (${outcome})`, remark.trim()]);

    res.json({ message: 'Follow-up recorded successfully', category: evalRes.category, tone: evalRes.tone });
  } catch (error) {
    console.error('Error recording recovery follow-up:', error);
    res.status(500).json({ error: 'Failed to record follow-up' });
  }
});

/**
 * 8. PUT /api/recovery/:id/reassign - Reassign Salesperson
 */
router.put('/:id/reassign', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { new_salesperson_id, reason, user_id } = req.body;

    const [caseRows] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', [caseId]);
    if (caseRows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    const currentCase = caseRows[0];

    const [newSalesperson] = await db.query('SELECT name FROM users WHERE id = ?', [new_salesperson_id]);
    const newName = newSalesperson[0]?.name || 'Salesperson';

    await db.query(`
      UPDATE recovery_cases 
      SET 
        original_salesperson_id = COALESCE(original_salesperson_id, assigned_salesperson_id),
        assigned_salesperson_id = ?
      WHERE id = ?
    `, [new_salesperson_id, caseId]);

    // Timeline event
    await db.query(`
      INSERT INTO recovery_timeline (recovery_case_id, event_type, user_id, title, description)
      VALUES (?, 'Reassigned', ?, 'Case Reassigned', ?)
    `, [caseId, user_id || null, `Case reassigned to ${newName}. Reason: ${reason || 'N/A'}`]);

    // In-App & WhatsApp Notification
    await db.query(`
      INSERT INTO notifications (user_id, message, link)
      VALUES (?, ?, ?)
    `, [new_salesperson_id, `🚨 Recovery Case ${currentCase.case_number} Reassigned: Assigned to you for Invoice ${currentCase.invoice_number} (PKR ${Number(currentCase.outstanding_amount).toLocaleString()}).`, `/recovery?case=${caseId}`]);

    notifyUserWhatsApp(
      new_salesperson_id,
      `*Recovery Case Assigned* 🚨\n\nRecovery case *${currentCase.case_number}* for invoice *${currentCase.invoice_number}* (PKR ${Number(currentCase.outstanding_amount).toLocaleString()}) has been reassigned to you.\n\n_Log in to CRM to view and record client discussion._`
    ).catch(err => console.error('WhatsApp notify error:', err));

    res.json({ message: 'Case reassigned successfully' });
  } catch (error) {
    console.error('Error reassigning case:', error);
    res.status(500).json({ error: 'Failed to reassign case' });
  }
});

/**
 * 9. POST /api/recovery/:id/contacts - Add Contact Details
 */
router.post('/:id/contacts', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { contact_name, role_designation, phone, email, notes } = req.body;

    if (!contact_name) {
      return res.status(400).json({ error: 'Contact name is required' });
    }

    await db.query(`
      INSERT INTO recovery_contacts (recovery_case_id, contact_name, role_designation, phone, email, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [caseId, contact_name, role_designation || null, phone || null, email || null, notes || null]);

    res.status(201).json({ message: 'Contact added successfully' });
  } catch (error) {
    console.error('Error adding recovery contact:', error);
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

/**
 * 10. POST /api/recovery/:id/escalate - Escalate Case
 */
router.post('/:id/escalate', async (req, res) => {
  try {
    const caseId = req.params.id;
    const { escalation_level, reason, user_id } = req.body;

    const [caseRows] = await db.query('SELECT * FROM recovery_cases WHERE id = ?', [caseId]);
    if (caseRows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    const currentCase = caseRows[0];

    const category = escalation_level === 'Management Escalation' ? 'Management Escalation' : 'Repeated Delay';
    const tone = escalation_level === 'Management Escalation' ? 'Formal / Controlled' : 'Direct / Firm';

    await db.query(`
      UPDATE recovery_cases 
      SET escalation_level = ?, escalation_reason = ?, category = ?, tone_guidance = ?
      WHERE id = ?
    `, [escalation_level, reason || null, category, tone, caseId]);

    // Timeline event
    await db.query(`
      INSERT INTO recovery_timeline (recovery_case_id, event_type, user_id, title, description)
      VALUES (?, 'Escalation', ?, 'Case Escalated', ?)
    `, [caseId, user_id || null, `Escalated to ${escalation_level}. Reason: ${reason || 'N/A'}`]);

    res.json({ message: 'Case escalated successfully' });
  } catch (error) {
    console.error('Error escalating recovery case:', error);
    res.status(500).json({ error: 'Failed to escalate case' });
  }
});

/**
 * 11. POST /api/recovery/auto-trigger-check - Auto 15-Day Overdue & Escalation Evaluator
 */
const runAutoOverdueCheck = async () => {
  const [settings] = await db.query('SELECT * FROM recovery_settings LIMIT 1');
  const autoDays = Number(settings[0]?.auto_overdue_days || 15);

  // Find invoices >= 15 days overdue with balance > 0 and no active recovery case
  const [overdueInvoices] = await db.query(`
    SELECT i.*, c.user_id AS client_salesperson_id
    FROM invoices i
    JOIN clients c ON i.client_id = c.id
    WHERE i.balance > 0 
      AND i.due_date IS NOT NULL 
      AND DATEDIFF(CURRENT_DATE, i.due_date) >= ?
      AND i.id NOT IN (
        SELECT invoice_id FROM recovery_cases WHERE status != 'Closed' AND status != 'Recovered' AND is_active = 1
      )
  `, [autoDays]);

  let createdCount = 0;
  for (const inv of overdueInvoices) {
    const caseNumber = `REC-AUTO-${Date.now().toString().slice(-6)}-${inv.id}`;
    const outstanding = Number(inv.balance);
    const targetSalespersonId = inv.client_salesperson_id || 1;

    const [result] = await db.query(`
      INSERT INTO recovery_cases (
        case_number, invoice_id, project_id, client_id, assigned_salesperson_id,
        trigger_type, manager_reason, manager_remark, outstanding_amount, status, category, tone_guidance
      ) VALUES (?, ?, ?, ?, ?, 'Automatic 15-Day Overdue', ?, 'Automatic system trigger at 15+ days past due date', ?, 'New', 'Contact Required', 'Professional / Helpful')
    `, [caseNumber, inv.id, inv.project_id || null, inv.client_id, targetSalespersonId, `Automatic Trigger (${autoDays} days past due date)`, outstanding]);

    const caseId = result.insertId;

    const evalData = evaluateCaseCategoryAndTone({ outstanding_amount: outstanding, category: 'Contact Required' }, settings[0]);
    await db.query(`
      UPDATE recovery_cases 
      SET category = ?, tone_guidance = ?, priority_score = ?, is_high_value = ? 
      WHERE id = ?
    `, [evalData.category, evalData.tone, evalData.priorityScore, evalData.isHighValue, caseId]);

    await db.query(`
      INSERT INTO notifications (user_id, message, link)
      VALUES (?, ?, ?)
    `, [targetSalespersonId, `🚨 Auto-Recovery Alert: Invoice ${inv.invoice_number} (PKR ${outstanding.toLocaleString()}) is 15+ days overdue and assigned to you.`, `/recovery?case=${caseId}`]);

    notifyUserWhatsApp(
      targetSalespersonId,
      `*Automatic Overdue Recovery Alert!* 🚨\n\nInvoice *${inv.invoice_number}* is 15+ days overdue.\n\nSystem generated Recovery Case *${caseNumber}* (PKR ${outstanding.toLocaleString()}) assigned to you.\n\n_Log in to CRM to record client discussion._`
    ).catch(err => console.error('WhatsApp notify error:', err));

    createdCount++;
  }
  return { created_cases: createdCount };
};

router.runAutoOverdueCheck = runAutoOverdueCheck;

router.post('/auto-trigger-check', async (req, res) => {
  try {
    const result = await runAutoOverdueCheck();
    res.json({ message: 'Auto overdue evaluation completed', ...result });
  } catch (error) {
    console.error('Error running auto trigger check:', error);
    res.status(500).json({ error: 'Failed to run auto trigger check' });
  }
});

/**
 * 12. DELETE /api/recovery/:id - Delete a Recovery Case
 */
router.delete('/:id', async (req, res) => {
  try {
    const caseId = req.params.id;
    await db.query('DELETE FROM recovery_followups WHERE recovery_case_id = ?', [caseId]);
    await db.query('DELETE FROM recovery_timeline WHERE recovery_case_id = ?', [caseId]);
    await db.query('DELETE FROM recovery_contacts WHERE recovery_case_id = ?', [caseId]);
    const [result] = await db.query('DELETE FROM recovery_cases WHERE id = ? OR case_number = ?', [caseId, caseId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Recovery case not found' });
    }

    res.json({ success: true, message: 'Recovery case deleted successfully' });
  } catch (error) {
    console.error('Error deleting recovery case:', error);
    res.status(500).json({ success: false, error: 'Failed to delete recovery case' });
  }
});

module.exports = router;
