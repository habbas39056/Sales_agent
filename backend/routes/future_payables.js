const express = require('express');
const router = express.Router();
const db = require('../db');
const { notifyUserWhatsApp, sendWhatsAppMessage } = require('../utils/whatsapp');
const { getPayableDueAIMessage, getPayableSettledAIMessage } = require('../utils/ai_notifications');

/**
 * Automated Checker to dispatch AI WhatsApp & Portal alerts for Due / Overdue Payables
 */
async function checkAndSendPayableAlerts() {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Find payables that are due today or overdue and haven't been notified today
    const [duePayables] = await db.query(`
      SELECT fp.* 
      FROM future_payables fp
      WHERE fp.status IN ('Pending', 'Due Today', 'Overdue')
        AND fp.due_date <= ?
        AND (fp.last_notified_at IS NULL OR DATE(fp.last_notified_at) < ?)
      ORDER BY fp.due_date ASC
    `, [todayStr, todayStr]);

    if (duePayables.length === 0) {
      return { checked: 0, alertsSent: 0 };
    }

    // Find all Admin users to notify
    const [admins] = await db.query(`SELECT id, name, whatsapp_number FROM users WHERE role = 'Admin'`);
    let alertsSent = 0;

    for (const item of duePayables) {
      const isDueToday = item.due_date.toISOString().split('T')[0] === todayStr;
      
      // Generate Smart AI Notification (WhatsApp + Portal)
      const aiAlert = await getPayableDueAIMessage(item, !isDueToday);
      const whatsappMsg = aiAlert.whatsapp;
      const portalMsg = aiAlert.portal;

      // 1. Send portal notifications
      for (const admin of admins) {
        await db.query(`
          INSERT INTO notifications (user_id, message, type, link, is_read) 
          VALUES (?, ?, 'payable_alert', '/expenses?tab=future-payables', 0)
        `, [admin.id, portalMsg]);

        // 2. Send WhatsApp notification
        if (admin.whatsapp_number) {
          try {
            await sendWhatsAppMessage(admin.whatsapp_number, whatsappMsg);
          } catch (err) {
            console.error(`Failed to send WhatsApp alert to admin #${admin.id}:`, err.message);
          }
        }
      }

      // Mark last_notified_at
      await db.query(`UPDATE future_payables SET last_notified_at = NOW() WHERE id = ?`, [item.id]);
      alertsSent++;
    }

    console.log(`[Future Payables Alert Engine] Processed ${duePayables.length} due payables, sent ${alertsSent} alerts.`);
    return { checked: duePayables.length, alertsSent };
  } catch (error) {
    console.error('[Future Payables Alert Engine Error]:', error);
    return { error: error.message };
  }
}

// 1. Get all Future Payables with KPIs & filtering
router.get('/', async (req, res) => {
  try {
    const { status, category, priority, start_date, end_date, search } = req.query;
    const todayStr = new Date().toISOString().split('T')[0];

    // Dynamic auto-status updater in DB
    await db.query(`
      UPDATE future_payables 
      SET status = 'Overdue' 
      WHERE status = 'Pending' AND due_date < ?
    `, [todayStr]);

    await db.query(`
      UPDATE future_payables 
      SET status = 'Due Today' 
      WHERE status = 'Pending' AND due_date = ?
    `, [todayStr]);

    let query = `
      SELECT fp.*, u.name as creator_name
      FROM future_payables fp
      LEFT JOIN users u ON fp.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND fp.status = ?`;
      params.push(status);
    }
    if (category && category !== 'all') {
      query += ` AND fp.category = ?`;
      params.push(category);
    }
    if (priority && priority !== 'all') {
      query += ` AND fp.priority = ?`;
      params.push(priority);
    }
    if (start_date) {
      query += ` AND fp.due_date >= ?`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND fp.due_date <= ?`;
      params.push(end_date);
    }
    if (search) {
      query += ` AND (fp.title LIKE ? OR fp.notes LIKE ? OR fp.reference_no LIKE ? OR fp.category LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ` ORDER BY 
      CASE fp.status 
        WHEN 'Due Today' THEN 1 
        WHEN 'Overdue' THEN 2 
        WHEN 'Pending' THEN 3 
        WHEN 'Paid' THEN 4 
        ELSE 5 
      END, 
      fp.due_date ASC, 
      fp.id DESC`;

    const [rows] = await db.query(query, params);

    // Compute Macro Summary KPIs
    const [allPayables] = await db.query(`SELECT * FROM future_payables`);

    let totalPendingAmount = 0;
    let dueTodayCount = 0;
    let dueTodayAmount = 0;
    let due7DaysCount = 0;
    let due7DaysAmount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let paidThisMonthAmount = 0;

    const curMonth = todayStr.slice(0, 7);
    const in7DaysDate = new Date();
    in7DaysDate.setDate(in7DaysDate.getDate() + 7);
    const in7DaysStr = in7DaysDate.toISOString().split('T')[0];

    allPayables.forEach(p => {
      const amt = parseFloat(p.amount || 0);
      const dDateStr = p.due_date ? p.due_date.toISOString().split('T')[0] : '';

      if (p.status !== 'Paid' && p.status !== 'Cancelled') {
        totalPendingAmount += amt;

        if (dDateStr === todayStr) {
          dueTodayCount++;
          dueTodayAmount += amt;
        } else if (dDateStr < todayStr) {
          overdueCount++;
          overdueAmount += amt;
        }

        if (dDateStr >= todayStr && dDateStr <= in7DaysStr) {
          due7DaysCount++;
          due7DaysAmount += amt;
        }
      }

      if (p.status === 'Paid') {
        const paidDateStr = p.paid_at ? p.paid_at.toISOString().split('T')[0] : dDateStr;
        if (paidDateStr.startsWith(curMonth)) {
          paidThisMonthAmount += amt;
        }
      }
    });

    res.json({
      data: rows,
      summary: {
        total_pending_amount: totalPendingAmount,
        due_today_count: dueTodayCount,
        due_today_amount: dueTodayAmount,
        due_7days_count: due7DaysCount,
        due_7days_amount: due7DaysAmount,
        overdue_count: overdueCount,
        overdue_amount: overdueAmount,
        paid_this_month_amount: paidThisMonthAmount,
        total_records: rows.length
      }
    });
  } catch (err) {
    console.error('Error fetching future payables:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Create a new Future Payable
router.post('/', async (req, res) => {
  const { title, category, amount, due_date, priority, preferred_bank, notes, reference_no, recurring_cycle, created_by } = req.body;
  
  if (!title || !amount || !due_date) {
    return res.status(400).json({ error: 'Title, amount, and due date are required.' });
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    let initialStatus = 'Pending';
    if (due_date === todayStr) initialStatus = 'Due Today';
    else if (due_date < todayStr) initialStatus = 'Overdue';

    const [result] = await db.query(`
      INSERT INTO future_payables 
        (title, category, amount, due_date, priority, preferred_bank, notes, reference_no, recurring_cycle, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title.trim(),
      category || 'General',
      parseFloat(amount) || 0,
      due_date,
      priority || 'Medium',
      preferred_bank || null,
      notes || null,
      reference_no || null,
      recurring_cycle || 'One-Time',
      initialStatus,
      created_by || null
    ]);

    // Check if immediate notification is needed
    if (initialStatus === 'Due Today' || initialStatus === 'Overdue') {
      setTimeout(() => checkAndSendPayableAlerts(), 500);
    }

    res.status(201).json({ message: 'Future payable created successfully', id: result.insertId });
  } catch (err) {
    console.error('Error creating future payable:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Update an existing Future Payable
router.put('/:id', async (req, res) => {
  const { title, category, amount, due_date, priority, preferred_bank, notes, reference_no, recurring_cycle, status } = req.body;

  try {
    await db.query(`
      UPDATE future_payables
      SET title = ?, category = ?, amount = ?, due_date = ?, priority = ?, preferred_bank = ?, notes = ?, reference_no = ?, recurring_cycle = ?, status = ?
      WHERE id = ?
    `, [
      title,
      category,
      parseFloat(amount) || 0,
      due_date,
      priority,
      preferred_bank,
      notes,
      reference_no,
      recurring_cycle,
      status || 'Pending',
      req.params.id
    ]);

    res.json({ message: 'Future payable updated successfully' });
  } catch (err) {
    console.error('Error updating future payable:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Delete a Future Payable
router.delete('/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM future_payables WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Future payable removed successfully' });
  } catch (err) {
    console.error('Error deleting future payable:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. 1-Click "Mark as Paid" -> Converts & posts to actual `expenses` table
router.post('/:id/pay', async (req, res) => {
  const { payment_date, payment_mode, bank, reference_no, notes } = req.body;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [[payable]] = await connection.query(`SELECT * FROM future_payables WHERE id = ?`, [req.params.id]);
    if (!payable) throw new Error('Payable record not found.');
    if (payable.status === 'Paid') throw new Error('This payable has already been settled and paid.');

    const pDate = payment_date || new Date().toISOString().split('T')[0];
    const pMode = payment_mode || 'Bank Transfer';
    const pBank = bank || payable.preferred_bank || '';
    const pRef = reference_no || payable.reference_no || `PAYABLE-SETTLE-#${payable.id}`;
    const pDesc = `[Scheduled Payable] ${payable.title}${notes ? ' - ' + notes : (payable.notes ? ' - ' + payable.notes : '')}`;

    // 1. Insert into actual expenses table as a Payment voucher
    const [expResult] = await connection.query(`
      INSERT INTO expenses 
        (date, client, description, mode, bank, reference, receipt_amount, payment_amount, category)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [
      pDate,
      payable.title,
      pDesc,
      pMode,
      pBank,
      pRef,
      payable.amount,
      payable.category || 'General'
    ]);

    const generatedExpenseId = expResult.insertId;

    // 2. Mark this future payable as Paid
    await connection.query(`
      UPDATE future_payables
      SET status = 'Paid', paid_at = NOW(), expense_id = ?
      WHERE id = ?
    `, [generatedExpenseId, payable.id]);

    // 3. Handle recurring cycle generation (if applicable)
    let nextPayableId = null;
    if (payable.recurring_cycle && payable.recurring_cycle !== 'One-Time') {
      const curDueDate = new Date(payable.due_date);
      const nextDueDate = new Date(curDueDate);

      if (payable.recurring_cycle === 'Weekly') {
        nextDueDate.setDate(nextDueDate.getDate() + 7);
      } else if (payable.recurring_cycle === 'Monthly') {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      } else if (payable.recurring_cycle === 'Quarterly') {
        nextDueDate.setMonth(nextDueDate.getMonth() + 3);
      } else if (payable.recurring_cycle === 'Yearly') {
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      }

      const nextDueStr = nextDueDate.toISOString().split('T')[0];
      const [nextRes] = await connection.query(`
        INSERT INTO future_payables 
          (title, category, amount, due_date, priority, preferred_bank, notes, reference_no, recurring_cycle, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
      `, [
        payable.title,
        payable.category,
        payable.amount,
        nextDueStr,
        payable.priority,
        payable.preferred_bank,
        payable.notes,
        payable.reference_no,
        payable.recurring_cycle,
        payable.created_by
      ]);
      nextPayableId = nextRes.insertId;
    }

    await connection.commit();

    // 4. Send AI WhatsApp Payment Receipt Confirmation to Admin
    try {
      const [admins] = await db.query(`SELECT id, whatsapp_number FROM users WHERE role = 'Admin'`);
      const aiSettled = await getPayableSettledAIMessage(payable, {
        bank: pBank,
        payment_mode: pMode,
        reference_no: pRef,
        expense_id: generatedExpenseId
      });

      for (const admin of admins) {
        // Send Portal Notification
        await db.query(`
          INSERT INTO notifications (user_id, message, type, link, is_read)
          VALUES (?, ?, 'payable_settled', '/expenses', 0)
        `, [admin.id, aiSettled.portal]);

        // Send WhatsApp
        if (admin.whatsapp_number) {
          sendWhatsAppMessage(admin.whatsapp_number, aiSettled.whatsapp).catch(console.error);
        }
      }
    } catch (e) {
      console.error('WhatsApp payment confirmation error:', e.message);
    }

    res.json({
      message: 'Payable settled and converted to Expense successfully',
      expense_id: generatedExpenseId,
      next_payable_id: nextPayableId
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error settling future payable:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

// 6. Trigger check-alerts manually
router.post('/check-alerts', async (req, res) => {
  const result = await checkAndSendPayableAlerts();
  res.json(result);
});

module.exports = {
  router,
  checkAndSendPayableAlerts
};
