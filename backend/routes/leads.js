const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendWhatsAppMessage } = require('../utils/whatsapp');

// Helper to generate next Lead Number (e.g., LEAD-1001)
async function generateLeadNumber() {
  try {
    const [rows] = await db.query("SELECT id FROM leads ORDER BY id DESC LIMIT 1");
    const nextId = (rows[0]?.id || 0) + 1;
    return `LEAD-${1000 + nextId}`;
  } catch (err) {
    return `LEAD-${Date.now().toString().slice(-6)}`;
  }
}

// 1. GET ALL LEADS & SUMMARY METRICS
router.get('/', async (req, res) => {
  try {
    const { search, status, priority, assigned_to, source } = req.query;

    let sql = `
      SELECT 
        l.*,
        u.name as assigned_name,
        u.profile_image_url as assigned_avatar,
        pc.name as category_name,
        c.full_name as client_name,
        c.business_name as client_business,
        (SELECT MAX(created_at) FROM lead_activities WHERE lead_id = l.id) as last_activity_at,
        (SELECT summary FROM lead_activities WHERE lead_id = l.id ORDER BY id DESC LIMIT 1) as latest_activity_summary
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      LEFT JOIN project_categories pc ON l.category_id = pc.id
      LEFT JOIN clients c ON l.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (l.title LIKE ? OR l.contact_name LIKE ? OR l.company_name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.lead_number LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term, term);
    }

    if (status && status !== 'All') {
      sql += ` AND l.status = ?`;
      params.push(status);
    }

    if (priority && priority !== 'All') {
      sql += ` AND l.priority = ?`;
      params.push(priority);
    }

    if (assigned_to && assigned_to !== 'All') {
      sql += ` AND l.assigned_to = ?`;
      params.push(assigned_to);
    }

    if (source && source !== 'All') {
      sql += ` AND l.source = ?`;
      params.push(source);
    }

    sql += ` ORDER BY l.created_at DESC`;

    const [leads] = await db.query(sql, params);

    // Compute Summary Stats
    const [allLeadsStats] = await db.query(`
      SELECT 
        COUNT(*) as total_leads,
        COALESCE(SUM(estimated_value), 0) as total_pipeline_value,
        COALESCE(SUM(CASE WHEN status = 'Won' THEN 1 ELSE 0 END), 0) as won_count,
        COALESCE(SUM(CASE WHEN status = 'Won' THEN estimated_value ELSE 0 END), 0) as won_value,
        COALESCE(SUM(CASE WHEN status IN ('New Lead', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation') THEN 1 ELSE 0 END), 0) as active_count,
        COALESCE(SUM(CASE WHEN next_followup_date IS NOT NULL AND DATE(next_followup_date) <= CURDATE() AND status NOT IN ('Won', 'Lost') THEN 1 ELSE 0 END), 0) as followups_due
      FROM leads
    `);

    const stats = allLeadsStats[0] || {};

    res.json({
      leads,
      summary: {
        total_leads: Number(stats.total_leads || 0),
        total_pipeline_value: Number(stats.total_pipeline_value || 0),
        active_count: Number(stats.active_count || 0),
        won_count: Number(stats.won_count || 0),
        won_value: Number(stats.won_value || 0),
        followups_due: Number(stats.followups_due || 0)
      }
    });
  } catch (err) {
    console.error('Error fetching leads:', err);
    res.status(500).json({ error: 'Failed to load leads' });
  }
});

// 2. GET SINGLE LEAD DETAILS WITH ACTIVITIES
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT 
        l.*,
        u.name as assigned_name,
        u.email as assigned_email,
        pc.name as category_name,
        c.full_name as client_name,
        c.business_name as client_business
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      LEFT JOIN project_categories pc ON l.category_id = pc.id
      LEFT JOIN clients c ON l.client_id = c.id
      WHERE l.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = rows[0];

    // Fetch activities
    const [activities] = await db.query(`
      SELECT 
        la.*,
        u.name as author_name,
        u.profile_image_url as author_avatar
      FROM lead_activities la
      LEFT JOIN users u ON la.user_id = u.id
      WHERE la.lead_id = ?
      ORDER BY la.created_at DESC
    `, [id]);

    res.json({ lead, activities });
  } catch (err) {
    console.error('Error fetching lead details:', err);
    res.status(500).json({ error: 'Failed to fetch lead details' });
  }
});

// 3. CREATE NEW LEAD
router.post('/', async (req, res) => {
  try {
    const {
      title,
      contact_name,
      company_name,
      email,
      phone,
      whatsapp_number,
      source,
      status,
      priority,
      estimated_value,
      category_id,
      assigned_to,
      next_followup_date,
      notes
    } = req.body;

    if (!title || !contact_name) {
      return res.status(400).json({ error: 'Lead title and contact name are required.' });
    }

    const lead_number = await generateLeadNumber();
    const currentUserId = req.user?.id || null;

    const [result] = await db.query(`
      INSERT INTO leads (
        lead_number, title, contact_name, company_name, email, phone, 
        whatsapp_number, source, status, priority, estimated_value, 
        category_id, assigned_to, next_followup_date, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      lead_number,
      title.trim(),
      contact_name.trim(),
      company_name ? company_name.trim() : null,
      email ? email.trim() : null,
      phone ? phone.trim() : (whatsapp_number ? whatsapp_number.trim() : null),
      phone ? phone.trim() : (whatsapp_number ? whatsapp_number.trim() : null),
      source || 'Website',
      status || 'New Lead',
      priority || 'Medium',
      estimated_value ? parseFloat(estimated_value) : 0.00,
      category_id ? parseInt(category_id) : null,
      assigned_to ? parseInt(assigned_to) : null,
      next_followup_date || null,
      notes ? notes.trim() : null,
      currentUserId
    ]);

    const newLeadId = result.insertId;

    // Log creation activity
    await db.query(`
      INSERT INTO lead_activities (lead_id, user_id, type, summary)
      VALUES (?, ?, 'Note', ?)
    `, [newLeadId, currentUserId, `Lead Created (${lead_number})`]);

    res.status(201).json({ message: 'Lead created successfully!', lead_id: newLeadId, lead_number });
  } catch (err) {
    console.error('Error creating lead:', err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// 4. UPDATE LEAD
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      contact_name,
      company_name,
      email,
      phone,
      whatsapp_number,
      source,
      status,
      priority,
      estimated_value,
      category_id,
      assigned_to,
      next_followup_date,
      notes
    } = req.body;

    const [existingRows] = await db.query('SELECT * FROM leads WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const oldLead = existingRows[0];
    const currentUserId = req.user?.id || null;

    await db.query(`
      UPDATE leads SET
        title = ?,
        contact_name = ?,
        company_name = ?,
        email = ?,
        phone = ?,
        whatsapp_number = ?,
        source = ?,
        status = ?,
        priority = ?,
        estimated_value = ?,
        category_id = ?,
        assigned_to = ?,
        next_followup_date = ?,
        notes = ?
      WHERE id = ?
    `, [
      title ? title.trim() : oldLead.title,
      contact_name ? contact_name.trim() : oldLead.contact_name,
      company_name !== undefined ? (company_name ? company_name.trim() : null) : oldLead.company_name,
      email !== undefined ? (email ? email.trim() : null) : oldLead.email,
      phone !== undefined ? (phone ? phone.trim() : null) : (whatsapp_number !== undefined ? (whatsapp_number ? whatsapp_number.trim() : null) : oldLead.phone),
      phone !== undefined ? (phone ? phone.trim() : null) : (whatsapp_number !== undefined ? (whatsapp_number ? whatsapp_number.trim() : null) : oldLead.whatsapp_number),
      source || oldLead.source,
      status || oldLead.status,
      priority || oldLead.priority,
      estimated_value !== undefined ? parseFloat(estimated_value) : oldLead.estimated_value,
      category_id !== undefined ? (category_id ? parseInt(category_id) : null) : oldLead.category_id,
      assigned_to !== undefined ? (assigned_to ? parseInt(assigned_to) : null) : oldLead.assigned_to,
      next_followup_date !== undefined ? (next_followup_date || null) : oldLead.next_followup_date,
      notes !== undefined ? (notes ? notes.trim() : null) : oldLead.notes,
      id
    ]);

    // Log activity for meaningful changes if not silent
    if (!req.body.silent) {
      if (status && status !== oldLead.status) {
        await db.query(`
          INSERT INTO lead_activities (lead_id, user_id, type, summary)
          VALUES (?, ?, 'Status Change', ?)
        `, [id, currentUserId, `Status updated from "${oldLead.status}" to "${status}"`]);
      } else if (priority && priority !== oldLead.priority) {
        await db.query(`
          INSERT INTO lead_activities (lead_id, user_id, type, summary)
          VALUES (?, ?, 'Note', ?)
        `, [id, currentUserId, `Priority updated to "${priority}"`]);
      } else if (assigned_to !== undefined && Number(assigned_to || 0) !== Number(oldLead.assigned_to || 0)) {
        await db.query(`
          INSERT INTO lead_activities (lead_id, user_id, type, summary)
          VALUES (?, ?, 'Note', 'Assigned sales representative updated')
        `, [id, currentUserId]);
      }
    }

    res.json({ message: 'Lead updated successfully!' });
  } catch (err) {
    console.error('Error updating lead:', err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// 5. ADD ACTIVITY / NOTE TO LEAD
router.post('/:id/activities', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, summary } = req.body;
    const currentUserId = req.user?.id || null;

    if (!summary || !summary.trim()) {
      return res.status(400).json({ error: 'Activity summary is required.' });
    }

    await db.query(`
      INSERT INTO lead_activities (lead_id, user_id, type, summary)
      VALUES (?, ?, ?, ?)
    `, [id, currentUserId, type || 'Note', summary.trim()]);

    res.status(201).json({ message: 'Activity logged successfully!' });
  } catch (err) {
    console.error('Error logging lead activity:', err);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

// 6. CONVERT LEAD TO CLIENT
router.post('/:id/convert', async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id || null;

    const [leadRows] = await db.query('SELECT * FROM leads WHERE id = ?', [id]);
    if (leadRows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const lead = leadRows[0];

    if (lead.client_id) {
      return res.status(400).json({ error: 'This lead has already been converted to a Client.' });
    }

    // Insert into clients
    const [clientRes] = await db.query(`
      INSERT INTO clients (full_name, business_name, email, whatsapp_number)
      VALUES (?, ?, ?, ?)
    `, [
      lead.contact_name,
      lead.company_name || lead.title,
      lead.email || null,
      lead.whatsapp_number || lead.phone || null
    ]);

    const newClientId = clientRes.insertId;

    // Update lead status to 'Won' and link client_id
    await db.query(`
      UPDATE leads SET status = 'Won', client_id = ? WHERE id = ?
    `, [newClientId, id]);

    // Log Activity
    await db.query(`
      INSERT INTO lead_activities (lead_id, user_id, type, summary)
      VALUES (?, ?, 'Status Change', ?)
    `, [id, currentUserId, `Lead converted to Client #${newClientId} (${lead.contact_name})`]);

    res.json({ message: 'Lead converted to Client successfully!', client_id: newClientId });
  } catch (err) {
    console.error('Error converting lead to client:', err);
    res.status(500).json({ error: 'Failed to convert lead to client' });
  }
});

// 7. DELETE LEAD
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM leads WHERE id = ?', [id]);
    res.json({ message: 'Lead deleted successfully!' });
  } catch (err) {
    console.error('Error deleting lead:', err);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// 8. SEND WHATSAPP MESSAGE TO LEAD VIA EVOLUTION API
router.post('/:id/send-whatsapp', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM leads WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const lead = rows[0];

    const phoneRaw = lead.phone || lead.whatsapp_number;
    if (!phoneRaw) {
      return res.status(400).json({ error: 'Lead has no phone or WhatsApp number' });
    }

    const clientName = lead.contact_name || 'Valued Client';
    const serviceName = lead.category_name || lead.title || 'our services';
    const refId = lead.lead_number || `#${lead.id}`;

    const defaultMsg = `Dear ${clientName},\n\nGreetings from Adwise Sales!\n\nWe are reaching out regarding your inquiry for ${serviceName} (Ref: ${refId}). We would love to discuss how we can best assist you with your project requirements.\n\nPlease let us know a convenient time for a brief call or chat.\n\nBest regards,\nSales Team | Adwise`;

    const message = req.body.message || defaultMsg;

    const sent = await sendWhatsAppMessage(phoneRaw, message);

    if (sent) {
      // Log activity in database
      const currentUserId = req.user?.id || null;
      await db.query(`
        INSERT INTO lead_activities (lead_id, user_id, type, summary)
        VALUES (?, ?, 'Call', ?)
      `, [id, currentUserId, `Auto-sent WhatsApp message via Evolution API: "${message.substring(0, 50)}..."`]);

      res.json({ success: true, message: `WhatsApp message automatically sent to ${clientName} via Evolution API!` });
    } else {
      res.status(502).json({ error: 'Evolution API delivery failed. Check Evolution API instance status.' });
    }
  } catch (err) {
    console.error('Error sending WhatsApp message via Evolution API:', err);
    res.status(500).json({ error: 'Failed to send WhatsApp message via Evolution API' });
  }
});

module.exports = router;
