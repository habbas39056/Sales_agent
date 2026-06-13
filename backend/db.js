const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Bestfather@51',
  database: process.env.DB_NAME || 'agency_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection immediately
pool.getConnection()
  .then(connection => {
    console.log('✅ Database Connected Successfully!');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database Connection Failed:', err.message);
  });

module.exports = pool;
