const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const { sendWhatsAppMessage, notifyManagersWhatsApp } = require('../utils/whatsapp');
const {
  getPortalBaseUrl,
  getCrmBaseUrl,
  summarizeRevisionWithAI,
  getDeliverySubmittedTemplate,
  getManagerRevisionSubmittedTemplate,
  getClientRevisionReceivedTemplate,
  getManagerDeliveryApprovedTemplate,
  getClientApprovalRecordedTemplate
} = require('../utils/whatsappTemplates');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Create a new client review submission
router.post('/projects/:project_id', upload.single('file'), async (req, res) => {
  const { title, description, deadline } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required.' });
  }

  try {
    const file_url = req.file ? `/uploads/${req.file.filename}` : null;
    const [result] = await db.query(
      'INSERT INTO client_reviews (project_id, title, description, file_url, deadline) VALUES (?, ?, ?, ?, ?)',
      [req.params.project_id, title, description, file_url, deadline || null]
    );

    // Get project and client for notification
    const [[project]] = await db.query('SELECT title, client_id FROM projects WHERE id = ?', [req.params.project_id]);
    if (project && project.client_id) {
      const [[client]] = await db.query('SELECT user_id, full_name, business_name, whatsapp_number FROM clients WHERE id = ?', [project.client_id]);
      if (client && client.user_id) {
        await db.query(
          'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
          [client.user_id, `New submission to review: "${title}" for project ${project.title}`, 'document', `/client-portal?id=${req.params.project_id}`]
        );
      }
      if (client && client.whatsapp_number) {
        const waText = getDeliverySubmittedTemplate({
          clientName: client.full_name || client.business_name,
          taskName: title || project.title,
          portalLink: `${getPortalBaseUrl()}/client-portal?id=${req.params.project_id}`
        });
        sendWhatsAppMessage(client.whatsapp_number, waText).catch(console.error);
      }
    }

    res.json({ message: 'Submitted for client review', review_id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get client reviews for a project
router.get('/projects/:project_id', async (req, res) => {
  try {
    const [reviews] = await db.query(
      'SELECT * FROM client_reviews WHERE project_id = ? ORDER BY created_at DESC',
      [req.params.project_id]
    );
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Client responds to a review (Approves or Requests Revision)
router.post('/:review_id/respond', upload.array('feedback_files', 5), async (req, res) => {
  const { status, feedback_todos } = req.body;
  if (!['Approved', 'Revision Requested'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  try {
    let feedbackAttachments = [];
    if (req.files && req.files.length > 0) {
      feedbackAttachments = req.files.map(file => `/uploads/${file.filename}`);
    }

    const [result] = await db.query(
      'UPDATE client_reviews SET status = ?, feedback_todos = ?, feedback_attachments = ? WHERE id = ?',
      [status, feedback_todos || null, JSON.stringify(feedbackAttachments), req.params.review_id]
    );

    // Notify project managers & clients via Portal and WhatsApp
    const [[review]] = await db.query('SELECT project_id, title FROM client_reviews WHERE id = ?', [req.params.review_id]);
    if (review) {
      const [[project]] = await db.query(
        `SELECT p.id, p.title, p.pm_id, p.production_id, c.full_name as client_name, c.business_name, c.whatsapp_number as client_whatsapp 
         FROM projects p 
         LEFT JOIN clients c ON p.client_id = c.id 
         WHERE p.id = ?`, 
        [review.project_id]
      );
      if (project) {
        const clientDisplayName = project.client_name || project.business_name || 'Client';
        const [managers] = await db.query("SELECT id FROM users WHERE role IN ('Admin', 'Product Manager')");
        const userIds = new Set(managers.map(m => m.id));
        if (project.pm_id) userIds.add(project.pm_id);
        if (project.production_id) userIds.add(project.production_id);

        // In-app notifications
        for (const uid of userIds) {
          await db.query(
            'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
            [uid, `Client ${status === 'Approved' ? 'approved' : 'requested revision for'} "${review.title}" on ${project.title}`, status === 'Approved' ? 'step_approved' : 'step_rejected', `/projects?id=${review.project_id}`]
          );
        }

        // WhatsApp dispatch
        if (status === 'Revision Requested') {
          // Parse feedback text
          let rawFeedback = '';
          if (feedback_todos) {
            try {
              const parsed = typeof feedback_todos === 'string' ? JSON.parse(feedback_todos) : feedback_todos;
              if (Array.isArray(parsed)) rawFeedback = parsed.map(p => p.text || p).join('\n');
              else rawFeedback = String(feedback_todos);
            } catch(e) { rawFeedback = String(feedback_todos); }
          }
          const aiSummary = await summarizeRevisionWithAI(rawFeedback || review.title);

          // 1. Template 2: Manager — Revision Submitted
          const managerMsg = getManagerRevisionSubmittedTemplate({
            clientName: clientDisplayName,
            taskName: review.title,
            projectName: project.title,
            revisionSummary: aiSummary,
            crmLink: `${getCrmBaseUrl()}/projects/${project.id}`
          });
          await notifyManagersWhatsApp(Array.from(userIds), managerMsg);

          // 2. Template 3: When Client Submits Revision
          if (project.client_whatsapp) {
            const clientMsg = getClientRevisionReceivedTemplate({
              clientName: clientDisplayName,
              taskName: review.title,
              portalLink: `${getPortalBaseUrl()}/client-portal?id=${project.id}`
            });
            await sendWhatsAppMessage(project.client_whatsapp, clientMsg);
          }
        } else if (status === 'Approved') {
          // 1. Template 4: Manager — Delivery Approved
          const managerMsg = getManagerDeliveryApprovedTemplate({
            clientName: clientDisplayName,
            taskName: review.title,
            projectName: project.title,
            crmLink: `${getCrmBaseUrl()}/projects/${project.id}`
          });
          await notifyManagersWhatsApp(Array.from(userIds), managerMsg);

          // 2. Template 5: When Client Approves
          if (project.client_whatsapp) {
            const clientMsg = getClientApprovalRecordedTemplate({
              clientName: clientDisplayName,
              taskName: review.title
            });
            await sendWhatsAppMessage(project.client_whatsapp, clientMsg);
          }
        }
      }
    }

    res.json({ message: 'Response submitted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a client review
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM client_reviews WHERE id = ?', [req.params.id]);
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a client review
router.put('/:id', upload.single('file'), async (req, res) => {
  const { title, description, deadline } = req.body;
  try {
    if (req.file) {
      const file_url = `/uploads/${req.file.filename}`;
      await db.query(
        'UPDATE client_reviews SET title = ?, description = ?, deadline = ?, file_url = ? WHERE id = ?',
        [title, description, deadline || null, file_url, req.params.id]
      );
    } else {
      await db.query(
        'UPDATE client_reviews SET title = ?, description = ?, deadline = ? WHERE id = ?',
        [title, description, deadline || null, req.params.id]
      );
    }
    res.json({ message: 'Review updated successfully' });
  } catch (error) {
    console.error('Put review error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
