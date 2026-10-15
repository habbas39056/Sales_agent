const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

const path = require('path');
const fs = require('fs');

// Ensure uploads directories exist (both inside backend and in root if launched from there)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const rootUploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(rootUploadDir)) {
  try { fs.mkdirSync(rootUploadDir, { recursive: true }); } catch(e) {}
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(uploadDir));

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
app.use('/api/leads', authMiddleware, require('./routes/leads'));
app.use('/api/recovery', authMiddleware, require('./routes/recovery'));
const { router: futurePayablesRouter, checkAndSendPayableAlerts } = require('./routes/future_payables');
app.use('/api/future-payables', authMiddleware, futurePayablesRouter);

// Error handling middleware for API routes and file uploads (e.g. Multer 20MB limit)
app.use((err, req, res, next) => {
  if (err && (err.name === 'MulterError' || err.code?.startsWith('LIMIT_'))) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 20MB limit. Please upload documents under 20MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files uploaded at once.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  } else if (err) {
    console.error('API Error:', err.message || err);
    return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
  next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Fallback for React Router (Single Page Application)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const updateLiveDb = require('./update_live_db');
const { checkAndAutoAcceptDeadlines } = require('./utils/deadlineAutoAccept');

const startDeadlineAutoAccepter = () => {
  const checkAndAutoAccept = async () => {
    try {
      // 1. Deliverables client review acceptance after 2 hours
      const [steps] = await db.query(`
        SELECT ps.*, p.title AS project_title, p.pm_id, p.production_id, p.client_id
        FROM project_steps ps
        JOIN projects p ON ps.project_id = p.id
        WHERE ps.status IN ('Submitted for Review', 'Completed')
          AND ps.submitted_for_review_at IS NOT NULL
          AND TIMESTAMPDIFF(HOUR, ps.submitted_for_review_at, NOW()) >= 2
          AND (ps.is_terms_accepted IS NULL OR ps.is_terms_accepted = 0)
      `);

      for (const step of steps) {
        await db.query(`
          UPDATE project_steps 
          SET is_terms_accepted = 1, terms_accepted_at = NOW(), status = 'Completed'
          WHERE id = ?
        `, [step.id]);
      }

      // 2. Project milestone step deadline auto-acceptance after 2 hours
      await checkAndAutoAcceptDeadlines();
    } catch (err) {
      console.error('Error in deadline auto accepter:', err);
    }
  };

  setTimeout(checkAndAutoAccept, 3000);
  setInterval(checkAndAutoAccept, 60 * 1000); // Check every 60 seconds
};

const startFuturePayablesNotifier = () => {
  setTimeout(() => {
    checkAndSendPayableAlerts().catch(console.error);
  }, 5000);

  setInterval(async () => {
    try {
      await checkAndSendPayableAlerts();
    } catch (error) {
      console.error('Error in future payables notifier:', error);
    }
  }, 30 * 60 * 1000);
};

const startRecoveryAutoOverdueChecker = () => {
  const runAutoCheck = async () => {
    try {
      const recoveryRouter = require('./routes/recovery');
      if (recoveryRouter && typeof recoveryRouter.runAutoOverdueCheck === 'function') {
        await recoveryRouter.runAutoOverdueCheck();
      }
    } catch (err) {
      console.error('Error in recovery auto overdue checker:', err);
    }
  };
  setTimeout(runAutoCheck, 10000);
  setInterval(runAutoCheck, 60 * 60 * 1000); // Every hour
};

async function startServer() {
  try {
    await updateLiveDb();
  } catch (err) {
    console.error('❌ Database migration error during startup:', err);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    startDeadlineAutoAccepter();
    startFuturePayablesNotifier();
    startRecoveryAutoOverdueChecker();
  });
}

startServer();
