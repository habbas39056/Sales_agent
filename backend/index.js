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
app.use('/api/invoices', authMiddleware, require('./routes/invoices'));
app.use('/api/products', authMiddleware, require('./routes/products'));
app.use('/api/commissions', authMiddleware, require('./routes/commissions'));
app.use('/api/reports', authMiddleware, require('./routes/reports'));
app.use('/api/expenses', authMiddleware, require('./routes/expenses'));
app.use('/api/banks', authMiddleware, require('./routes/banks'));
app.use('/api/search', authMiddleware, require('./routes/search'));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Fallback for React Router (Single Page Application)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const updateLiveDb = require('./update_live_db');

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  await updateLiveDb();
});
