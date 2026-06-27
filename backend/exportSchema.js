const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function exportSchema() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Bestfather@51',
      database: 'agency_management'
    });

    const [tables] = await connection.query('SHOW TABLES');
    let fullSchema = 'CREATE DATABASE IF NOT EXISTS agency_management;\nUSE agency_management;\n\n';

    for (const row of tables) {
      const tableName = Object.values(row)[0];
      const [createTableResult] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      fullSchema += createTableResult[0]['Create Table'] + ';\n\n';
    }

    fs.writeFileSync('complete_schema.sql', fullSchema);
    console.log('Schema exported to complete_schema.sql');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

exportSchema();
