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

// Import and use routes
app.use('/api/clients', require('./routes/clients'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/commissions', require('./routes/commissions'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/banks', require('./routes/banks'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
