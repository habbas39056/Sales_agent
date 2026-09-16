const express = require('express');
const router = express.Router();
const db = require('../db');
const { notifyClientWhatsApp, sendWhatsAppMessage } = require('../utils/whatsapp');
const { getClientInvoiceDueTemplate } = require('../utils/whatsappTemplates');

// Get all invoices with linked client and project info (filtered for non-admins)
router.get('/', async (req, res) => {
  try {
    const { user_id, role } = req.query;

    let query = `
      SELECT i.*, 
             c.full_name as client_name, 
             c.business_name,
             p.title as project_title,
             u.name as agent_name,
             rc.id AS recovery_case_id,
             rc.case_number AS recovery_case_number
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      LEFT JOIN users u ON i.agent_id = u.id
      LEFT JOIN recovery_cases rc ON (rc.invoice_id = i.id AND rc.status != 'Closed' AND rc.status != 'Recovered' AND rc.is_active = 1)
    `;
    const params = [];

    // Filter for non-admin roles
    if (user_id && role && role !== 'Admin') {
      query += ` WHERE (i.created_by = ? OR i.agent_id = ?)`;
      params.push(user_id, user_id);
    }

    query += ` ORDER BY i.created_at DESC`;
    
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific invoice with line items
router.get('/:id', async (req, res) => {
  try {
    const [invoiceRows] = await db.query(`
      SELECT i.*, 
             c.full_name as client_name, c.business_name, c.email as client_email, c.physical_address,
             p.title as project_title
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (invoiceRows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const invoice = invoiceRows[0];

    const [items] = await db.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoice.id]);
    invoice.items = items;

    const [payments] = await db.query('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC, created_at DESC', [invoice.id]);
    invoice.payments = payments;

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new invoice with line items
router.post('/', async (req, res) => {
  const { invoice_number, client_id, project_id, agent_id, commission_amount, issue_date, due_date, terms_and_conditions, items, discount, bill_from_name, bill_from_address, created_by } = req.body;
  
  if (!client_id || !issue_date || !due_date || !items || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields or items' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += (item.quantity * item.unit_price);
    }
    const finalDiscount = parseFloat(discount) || 0;
    totalAmount = Math.max(0, totalAmount - finalDiscount);

    const finalInvoiceNumber = invoice_number || `INV-${Date.now()}`;
    
    const cleanProjectId = (project_id && project_id !== '') ? project_id : null;
    const cleanAgentId = (agent_id && agent_id !== '') ? agent_id : null;
    const cleanCreatedBy = (created_by && created_by !== '') ? created_by : null;

    // Create Invoice
    const [invoiceResult] = await connection.query(
      'INSERT INTO invoices (invoice_number, amount, balance, client_id, project_id, agent_id, commission_amount, issue_date, due_date, terms_and_conditions, bill_from_name, bill_from_address, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [finalInvoiceNumber, totalAmount, totalAmount, client_id, cleanProjectId, cleanAgentId, commission_amount || 0, issue_date, due_date, terms_and_conditions, bill_from_name || 'Adwise Labs', bill_from_address || '', cleanCreatedBy]
    );
    const invoiceId = invoiceResult.insertId;

    // Create Invoice Items
    for (const item of items) {
      const itemTotal = item.quantity * item.unit_price;
      await connection.query(
        'INSERT INTO invoice_items (invoice_id, description, details, quantity, unit, unit_price, total, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [invoiceId, item.description, item.details || '', item.quantity, item.unit || '', item.unit_price, itemTotal, item.category || 'SERVICE']
      );
    }

    await connection.commit();

    try {
      const [[clientData]] = await connection.query('SELECT user_id, full_name, business_name, whatsapp_number FROM clients WHERE id = ?', [client_id]);
      if (clientData && clientData.user_id) {
        await connection.query(
          'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
          [clientData.user_id, `New invoice ${finalInvoiceNumber} created for amount ${totalAmount}`, 'invoice_created', '']
        );
      }
      if (clientData && clientData.whatsapp_number) {
        const clientName = clientData.full_name || clientData.business_name || 'Valued Client';
        const formattedDueDate = due_date 
          ? new Date(due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) 
          : 'Due on Receipt';
        const formattedAmount = Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

        const invoiceMsg = getClientInvoiceDueTemplate({
          clientName,
          invoiceNumber: finalInvoiceNumber,
          amount: formattedAmount,
          dueDate: formattedDueDate
        });
        await sendWhatsAppMessage(clientData.whatsapp_number, invoiceMsg);
      }
    } catch(err) { console.error('[Invoice WhatsApp Notification Error]:', err); }

    res.status(201).json({ id: invoiceId, message: 'Invoice created successfully' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Add Revision Charge Hook
router.post('/:id/add-revision-charge', async (req, res) => {
  const invoiceId = req.params.id;
  const { revision_title, amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const description = `Paid Revision: ${revision_title || 'Additional work'}`;

    // Add item
    await connection.query(
      'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)',
      [invoiceId, description, 1, amount, amount]
    );

    // Update invoice total and balance
    await connection.query(
      'UPDATE invoices SET amount = amount + ?, balance = balance + ? WHERE id = ?',
      [amount, amount, invoiceId]
    );

    await connection.commit();
    res.json({ message: 'Revision charge added to invoice' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Record a Payment
router.post('/:id/payments', async (req, res) => {
  const invoiceId = req.params.id;
  const { amount, payment_date, payment_method, transaction_id, notes, bank } = req.body;

  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Valid amount is required' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Fetch invoice details & lock row
    const [[invoice]] = await connection.query('SELECT amount, due_date, invoice_number FROM invoices WHERE id = ? FOR UPDATE', [invoiceId]);
    if (!invoice) {
      await connection.rollback();
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const [[alreadyPaidSum]] = await connection.query('SELECT COALESCE(SUM(amount), 0) as total_paid FROM invoice_payments WHERE invoice_id = ?', [invoiceId]);
    const alreadyPaid = parseFloat(alreadyPaidSum.total_paid || 0);
    const invoiceAmount = parseFloat(invoice.amount || 0);
    const paymentAmount = parseFloat(amount || 0);
    const remainingBalance = Math.max(0, invoiceAmount - alreadyPaid);

    if (paymentAmount > (remainingBalance + 0.01)) {
      await connection.rollback();
      return res.status(400).json({ 
        error: `Payment amount (PKR ${paymentAmount.toFixed(2)}) cannot exceed remaining invoice balance (PKR ${remainingBalance.toFixed(2)}).` 
      });
    }

    // Insert payment record
    await connection.query(
      'INSERT INTO invoice_payments (invoice_id, amount, payment_date, payment_method, bank, transaction_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [invoiceId, amount, payment_date, payment_method, bank || null, transaction_id || null, notes]
    );

    const totalPaid = alreadyPaid + paymentAmount;
    const newBalance = Math.max(0, invoiceAmount - totalPaid);

    let newStatus = 'Unpaid';
    if (newBalance <= 0 && invoiceAmount > 0) {
      newStatus = 'Paid';
    } else if (invoice.due_date && new Date(invoice.due_date) < new Date() && newBalance > 0) {
      newStatus = 'Overdue';
    } else {
      newStatus = 'Unpaid';
    }

    // Update invoice balance and status
    await connection.query(
      'UPDATE invoices SET balance = ?, status = ? WHERE id = ?',
      [newBalance, newStatus, invoiceId]
    );

    // Sync with Recovery Module if active recovery case exists for this invoice
    const [recoveryCases] = await connection.query(
      "SELECT * FROM recovery_cases WHERE invoice_id = ? AND status != 'Closed' AND status != 'Recovered' AND is_active = 1",
      [invoiceId]
    );

    if (recoveryCases.length > 0) {
      const recCase = recoveryCases[0];
      const newRecoveredAmount = Number(recCase.recovered_amount || 0) + paymentAmount;
      const newOutstandingAmount = Math.max(0, Number(recCase.outstanding_amount || 0) - paymentAmount);

      if (newBalance <= 0 || newOutstandingAmount <= 0) {
        // Full Recovery - Close Case
        await connection.query(`
          UPDATE recovery_cases 
          SET status = 'Recovered', outstanding_amount = 0, recovered_amount = ?, is_active = 0, closed_at = NOW() 
          WHERE id = ?
        `, [Number(recCase.outstanding_amount || invoiceAmount), recCase.id]);

        await connection.query(`
          INSERT INTO recovery_timeline (recovery_case_id, event_type, user_id, title, description)
          VALUES (?, 'Payment Verified', NULL, 'Recovery Closed - Fully Recovered', ?)
        `, [recCase.id, `Payment of PKR ${paymentAmount.toLocaleString()} verified in Accounts. Invoice balance reached PKR 0. Recovery case closed.`]);

        // Notify Salesperson and Project Manager
        await connection.query(`
          INSERT INTO notifications (user_id, message, link)
          VALUES (?, ?, ?)
        `, [recCase.assigned_salesperson_id, `🎉 Recovery Case ${recCase.case_number} completed! Full payment verified.`, `/recovery?case=${recCase.id}`]);

        if (recCase.project_id) {
          const [[proj]] = await connection.query('SELECT pm_id FROM projects WHERE id = ?', [recCase.project_id]);
          if (proj && proj.pm_id) {
            await connection.query(`
              INSERT INTO notifications (user_id, message, link)
              VALUES (?, ?, ?)
            `, [proj.pm_id, `Recovery completed for Project linked to Case ${recCase.case_number}. Review on-hold project for resumption.`, `/projects/${recCase.project_id}`]);
          }
        }
      } else {
        // Partial Recovery
        await connection.query(`
          UPDATE recovery_cases 
          SET status = 'Partial Payment', outstanding_amount = ?, recovered_amount = ? 
          WHERE id = ?
        `, [newOutstandingAmount, newRecoveredAmount, recCase.id]);

        await connection.query(`
          INSERT INTO recovery_timeline (recovery_case_id, event_type, user_id, title, description)
          VALUES (?, 'Payment Verified', NULL, 'Partial Payment Verified', ?)
        `, [recCase.id, `Partial payment of PKR ${paymentAmount.toLocaleString()} verified in Accounts. Remaining balance: PKR ${newOutstandingAmount.toLocaleString()}`]);
      }
    }

    // Auto-sync with Expense module
    const [[invoiceDetails]] = await connection.query(`
      SELECT i.invoice_number, c.full_name 
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.id = ?
    `, [invoiceId]);

    const expenseDescription = `Payment for Invoice #${invoiceDetails.invoice_number}${notes ? ' - ' + notes : ''}`;

    await connection.query(`
      INSERT INTO expenses (date, client, description, mode, bank, reference, receipt_amount, payment_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      payment_date, 
      invoiceDetails.full_name || '', 
      expenseDescription, 
      payment_method || 'Cash', 
      bank || '', 
      transaction_id || '', 
      amount, 
      0
    ]);

    // Auto-sync agent's pending payroll commission for the payment month
    const [[invAgent]] = await connection.query('SELECT agent_id FROM invoices WHERE id = ?', [invoiceId]);
    if (invAgent && invAgent.agent_id) {
      const paymentMonth = (payment_date || new Date().toISOString()).slice(0, 7);
      const payrollRouter = require('./payroll');
      if (payrollRouter.syncUserPendingPayroll) {
        await payrollRouter.syncUserPendingPayroll(invAgent.agent_id, paymentMonth, connection);
      }
    }

    await connection.commit();

    try {
      const [[client]] = await connection.query('SELECT user_id, id as client_id FROM clients WHERE id = (SELECT client_id FROM invoices WHERE id = ?)', [invoiceId]);
      if (client && client.user_id) {
        await connection.query(
          'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
          [client.user_id, `Payment of ${amount} received for invoice ${invoiceDetails.invoice_number}`, 'payment_received', '']
        );
      }
      if (client && client.client_id) {
        await notifyClientWhatsApp(client.client_id, `*Payment Received* 💸\n\nWe received a payment of *${amount}* for invoice *${invoiceDetails.invoice_number}*.\n\n_Thank you for your prompt payment!_`);
      }
    } catch(err) { console.error(err); }

    res.json({ message: 'Payment recorded successfully', newBalance, newStatus, totalPaid });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Delete a Payment
router.delete('/:id/payments/:paymentId', async (req, res) => {
  const invoiceId = req.params.id;
  const paymentId = req.params.paymentId;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get payment details
    const [[payment]] = await connection.query('SELECT * FROM invoice_payments WHERE id = ? AND invoice_id = ?', [paymentId, invoiceId]);
    if (!payment) throw new Error('Payment not found');

    // 2. Delete payment
    await connection.query('DELETE FROM invoice_payments WHERE id = ?', [paymentId]);

    // 3. Update invoice balance and status from total remaining payments
    const [[invoice]] = await connection.query('SELECT amount, due_date, invoice_number FROM invoices WHERE id = ? FOR UPDATE', [invoiceId]);
    if (!invoice) throw new Error('Invoice not found');

    const [[paymentsSum]] = await connection.query('SELECT COALESCE(SUM(amount), 0) as total_paid FROM invoice_payments WHERE invoice_id = ?', [invoiceId]);
    const totalPaid = parseFloat(paymentsSum.total_paid || 0);
    const invoiceAmount = parseFloat(invoice.amount || 0);
    const newBalance = Math.max(0, invoiceAmount - totalPaid);

    let newStatus = 'Unpaid';
    if (newBalance <= 0 && invoiceAmount > 0) {
      newStatus = 'Paid';
    } else if (invoice.due_date && new Date(invoice.due_date) < new Date() && newBalance > 0) {
      newStatus = 'Overdue';
    } else {
      newStatus = 'Unpaid';
    }

    await connection.query(
      'UPDATE invoices SET balance = ?, status = ? WHERE id = ?',
      [newBalance, newStatus, invoiceId]
    );

    // 4. Delete corresponding expense (Cashbook receipt entry)
    const expenseDescPrefix = `Payment for Invoice #${invoice.invoice_number}%`;
    await connection.query(`
      DELETE FROM expenses 
      WHERE receipt_amount = ? 
      AND (reference = ? OR description LIKE ?) 
      ORDER BY id DESC
      LIMIT 1
    `, [payment.amount, payment.transaction_id || '', expenseDescPrefix]);

    // Auto-sync agent's pending payroll commission for the payment month
    const [[invAgent]] = await connection.query('SELECT agent_id FROM invoices WHERE id = ?', [invoiceId]);
    if (invAgent && invAgent.agent_id && payment.payment_date) {
      const paymentMonth = (payment.payment_date instanceof Date 
        ? payment.payment_date.toISOString().slice(0, 7) 
        : String(payment.payment_date).slice(0, 7));
      const payrollRouter = require('./payroll');
      if (payrollRouter.syncUserPendingPayroll) {
        await payrollRouter.syncUserPendingPayroll(invAgent.agent_id, paymentMonth, connection);
      }
    }

    await connection.commit();
    res.json({ message: 'Payment deleted successfully', newBalance, newStatus, totalPaid });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Update an existing invoice
router.put('/:id', async (req, res) => {
  const invoiceId = req.params.id;
  const { client_id, project_id, agent_id, commission_amount, issue_date, due_date, terms_and_conditions, items, discount, bill_from_name, bill_from_address } = req.body;
  
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invoice items array is required' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += (item.quantity * item.unit_price);
    }
    const finalDiscount = parseFloat(discount) || 0;
    totalAmount = Math.max(0, totalAmount - finalDiscount);

    const [[invoice]] = await connection.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (!invoice) throw new Error('Invoice not found');

    const targetClientId = client_id || invoice.client_id;
    const parseDate = (d) => {
      if (!d) return new Date().toISOString().split('T')[0];
      try { return new Date(d).toISOString().split('T')[0]; }
      catch(e) { return new Date().toISOString().split('T')[0]; }
    };
    const targetIssueDate = parseDate(issue_date || invoice.issue_date);
    const targetDueDate = parseDate(due_date || invoice.due_date);
    let targetProjectId = project_id !== undefined ? project_id : invoice.project_id;
    if (targetProjectId === '') targetProjectId = null;

    let targetAgentId = agent_id !== undefined ? agent_id : invoice.agent_id;
    if (targetAgentId === '') targetAgentId = null;

    const targetCommissionAmount = commission_amount !== undefined ? commission_amount : invoice.commission_amount;
    const targetTerms = terms_and_conditions !== undefined ? terms_and_conditions : invoice.terms_and_conditions;
    const targetBillName = bill_from_name || invoice.bill_from_name || 'Adwise Labs';
    const targetBillAddress = bill_from_address !== undefined ? bill_from_address : invoice.bill_from_address;

    const [[paymentsSum]] = await connection.query('SELECT SUM(amount) as total_paid FROM invoice_payments WHERE invoice_id = ?', [invoiceId]);
    const paid = paymentsSum.total_paid || 0;
    
    let newBalance = totalAmount - paid;
    let status = invoice.status;
    if (newBalance <= 0) {
      newBalance = 0;
      status = 'Paid';
    } else if (targetDueDate && new Date(targetDueDate) < new Date()) {
      status = 'Overdue';
    } else {
      status = 'Unpaid';
    }

    await connection.query(
      'UPDATE invoices SET amount = ?, balance = ?, client_id = ?, project_id = ?, agent_id = ?, commission_amount = ?, issue_date = ?, due_date = ?, terms_and_conditions = ?, bill_from_name = ?, bill_from_address = ?, status = ? WHERE id = ?',
      [totalAmount, newBalance, targetClientId, targetProjectId, targetAgentId, targetCommissionAmount, targetIssueDate, targetDueDate, targetTerms, targetBillName, targetBillAddress, status, invoiceId]
    );

    await connection.query('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);

    for (const item of items) {
      const itemTotal = item.quantity * item.unit_price;
      await connection.query(
        'INSERT INTO invoice_items (invoice_id, description, details, quantity, unit, unit_price, total, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [invoiceId, item.description, item.details || '', item.quantity, item.unit || '', item.unit_price, itemTotal, item.category || 'SERVICE']
      );
    }

    await connection.commit();
    
    if (targetDueDate && invoice.due_date) {
      const oldDate = new Date(invoice.due_date).getTime();
      const newDate = new Date(targetDueDate).getTime();
      if (newDate > oldDate) {
        const [[client]] = await connection.query('SELECT user_id FROM clients WHERE id = ?', [targetClientId]);
        if (client && client.user_id) {
          await connection.query(
            'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
            [client.user_id, `Invoice ${invoice.invoice_number} due date has been updated to ${targetDueDate}`, 'invoice_updated', '']
          );
        }
      }
    }

    res.json({ message: 'Invoice updated successfully' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// Delete an invoice
router.delete('/:id', async (req, res) => {
  const invoiceId = req.params.id;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Fetch invoice details before deleting to remove corresponding ledger entries
    const [[invoice]] = await connection.query('SELECT invoice_number FROM invoices WHERE id = ?', [invoiceId]);

    // Delete related items and payments
    await connection.query('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
    await connection.query('DELETE FROM invoice_payments WHERE invoice_id = ?', [invoiceId]);

    // Delete corresponding receipt expenses from ledger
    if (invoice && invoice.invoice_number) {
      await connection.query(
        'DELETE FROM expenses WHERE description LIKE ?',
        [`Payment for Invoice #${invoice.invoice_number}%`]
      );
    }
    
    // Delete the invoice itself
    const [result] = await connection.query('DELETE FROM invoices WHERE id = ?', [invoiceId]);
    
    if (result.affectedRows === 0) {
      throw new Error('Invoice not found');
    }

    await connection.commit();
    res.json({ message: 'Invoice and associated ledger entries deleted successfully' });
  } catch (error) {
    await connection.rollback();
    if (error.message === 'Invoice not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  } finally {
    connection.release();
  }
});

// Send / Resend Invoice Due WhatsApp Notification on demand
router.post('/:id/send-whatsapp', async (req, res) => {
  try {
    const [[invoice]] = await db.query(
      `SELECT i.*, c.full_name as client_name, c.business_name, c.whatsapp_number as client_whatsapp 
       FROM invoices i 
       JOIN clients c ON i.client_id = c.id 
       WHERE i.id = ?`, 
      [req.params.id]
    );

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (!invoice.client_whatsapp) {
      return res.status(400).json({ error: 'Client does not have a valid WhatsApp number on file.' });
    }

    const clientName = invoice.client_name || invoice.business_name || 'Valued Client';
    const formattedDueDate = invoice.due_date 
      ? new Date(invoice.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) 
      : 'Due on Receipt';
    const formattedAmount = Number(invoice.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const message = getClientInvoiceDueTemplate({
      clientName,
      invoiceNumber: invoice.invoice_number,
      amount: formattedAmount,
      dueDate: formattedDueDate
    });

    const success = await sendWhatsAppMessage(invoice.client_whatsapp, message);
    if (!success) {
      return res.status(502).json({ error: 'Failed to dispatch message via Evolution API. Please check WhatsApp settings.' });
    }

    res.json({ message: `WhatsApp invoice alert sent to ${clientName} (${invoice.client_whatsapp}) successfully!` });
  } catch (error) {
    console.error('send-whatsapp invoice error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

