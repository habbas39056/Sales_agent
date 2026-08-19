const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

const path = require('path');

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Agency Management System API is running' });
});

const authMiddleware = require('./middleware/auth');

// Import and use routes
app.use('/api/users', require('./routes/users')); // Users handles its own auth for /login
app.use('/api/clients', authMiddleware, require('./routes/clients'));
app.use('/api/projects', authMiddleware, require('./routes/projects'));
app.use('/api/tasks', authMiddleware, require('./routes/tasks'));
app.use('/api/invoices', authMiddleware, require('./routes/invoices'));
app.use('/api/products', authMiddleware, require('./routes/products'));
app.use('/api/commissions', authMiddleware, require('./routes/commissions'));
app.use('/api/reports', authMiddleware, require('./routes/reports'));
app.use('/api/expenses', authMiddleware, require('./routes/expenses'));
app.use('/api/banks', authMiddleware, require('./routes/banks'));
app.use('/api/expense-categories', authMiddleware, require('./routes/expense_categories'));
app.use('/api/search', authMiddleware, require('./routes/search'));
app.use('/api/settings', authMiddleware, require('./routes/settings'));
app.use('/api/payroll', authMiddleware, require('./routes/payroll'));
app.use('/api/project-categories', authMiddleware, require('./routes/project_categories'));
app.use('/api/deadlines', authMiddleware, require('./routes/deadlines'));
app.use('/api/notifications', authMiddleware, require('./routes/notifications'));
app.use('/api/client-reviews', authMiddleware, require('./routes/client_reviews'));
app.use('/api/quotations', authMiddleware, require('./routes/quotations'));
app.use('/api/terms-templates', authMiddleware, require('./routes/terms_templates'));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Fallback for React Router (Single Page Application)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const updateLiveDb = require('./update_live_db');

const startDeadlineAutoAccepter = () => {
  setInterval(async () => {
    try {
      const [steps] = await db.query(`
        SELECT id FROM project_steps 
        WHERE assignee_id IS NOT NULL 
          AND deadline IS NOT NULL 
          AND deadline_status = 'Pending Acceptance' 
          AND created_at < NOW() - INTERVAL 12 HOUR
      `);

      for (const step of steps) {
        await db.query(`UPDATE project_steps SET deadline_status = 'Accepted' WHERE id = ?`, [step.id]);
        await db.query(`INSERT INTO step_activity (step_id, user_id, action_text) VALUES (?, NULL, 'System Auto-Accepted the deadline after 12 hours of inactivity.')`, [step.id]);
      }
      if (steps.length > 0) {
        console.log(`Auto-accepted ${steps.length} pending deadlines.`);
      }
    } catch (error) {
      console.error('Error in deadline auto-accepter:', error);
    }
  }, 60 * 60 * 1000); // Check every 1 hour
};

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  await updateLiveDb();
  startDeadlineAutoAccepter();
});
