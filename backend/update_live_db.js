const db = require('./db');

async function updateLiveDb() {
  const connection = await db.getConnection();
  try {
    console.log('Starting full database schema update for production...');

    // Helper function to safely add columns
    const addColumnIfNotExists = async (table, column, definition) => {
      const [rows] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
      if (rows.length === 0) {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`✅ Added ${column} to ${table}.`);
      } else {
        console.log(`⏩ ${table}.${column} already exists.`);
      }
    };

    // 1. Users Table Updates
    await addColumnIfNotExists('users', 'username', 'VARCHAR(255) NULL');
    await addColumnIfNotExists('users', 'modules_access', 'JSON NULL');
    await addColumnIfNotExists('users', 'commission_percentage', 'DECIMAL(5,2) DEFAULT 0.00');
    await addColumnIfNotExists('users', 'profile_image_url', 'VARCHAR(255) NULL');

    // Update Enum
    try {
      await connection.query(`ALTER TABLE users MODIFY COLUMN role ENUM('Admin', 'Project Manager', 'Sales Rep', 'Production', 'QA', 'Client', 'Employee') NOT NULL`);
      console.log('✅ Updated role enum in users table.');
    } catch (e) {
      console.log('⚠️ Error updating role enum:', e.message);
    }

    // 2. Data Scoping (created_by)
    await addColumnIfNotExists('clients', 'created_by', 'INT NULL');
    await addColumnIfNotExists('projects', 'created_by', 'INT NULL');
    await addColumnIfNotExists('invoices', 'created_by', 'INT NULL');

    // 3. Commissions
    await addColumnIfNotExists('invoices', 'agent_id', 'INT NULL');
    await addColumnIfNotExists('invoices', 'commission_amount', 'DECIMAL(10,2) DEFAULT 0.00');

    // 4. Settings Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
        setting_value TEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Ensured settings table exists.');

    // Seed default settings if empty
    const [existingSettings] = await connection.query('SELECT COUNT(*) as count FROM settings');
    if (existingSettings[0].count === 0) {
      const defaults = [
        ['company_name', 'Adwise Labs'],
        ['company_email', 'contact@adwiselabs.com'],
        ['company_phone', '+1 (555) 019-2834'],
        ['company_address', '123 Tech Avenue, Suite 400, New York, NY'],
        ['company_website', 'https://adwiselabs.com'],
        ['company_logo_url', '/logo.png'],
        ['tax_number', 'TAX-987654321'],
        ['currency', 'USD'],
        ['currency_symbol', '$'],
        ['invoice_prefix', 'INV-'],
        ['default_terms', 'Payment is due within 15 days of invoice date. Thank you for your business!'],
        ['default_commission_pct', '10.00'],
        ['default_revision_cycles', '2'],
        ['email_notifications', 'true'],
        ['project_updates', 'true']
      ];
      const defaultTermsText = `1. PAYMENT TERMS: Payments are due within 15 days from the date of invoice issuance. Late payments may be subject to a 1.5% monthly service charge.
2. REVISIONS & SCOPE: Any additional feature requests or out-of-scope revisions beyond agreed milestone deliverables will be billed separately.
3. INTELLECTUAL PROPERTY: Final project deliverables and assets will be released to the client upon receipt of 100% full payment.
4. CONFIDENTIALITY: Both parties agree to maintain non-disclosure of proprietary business data and technology shared during project execution.
5. CANCELLATION & REFUNDS: Deposits and work completed prior to cancellation are non-refundable.`;
      
      await connection.query('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)', ['terms_and_conditions', defaultTermsText]);
      
      for (const [key, val] of defaults) {
        await connection.query('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, val]);
      }
      console.log('✅ Seeded default system settings.');
    } else {
      const defaultTermsText = `1. PAYMENT TERMS: Payments are due within 15 days from the date of invoice issuance. Late payments may be subject to a 1.5% monthly service charge.
2. REVISIONS & SCOPE: Any additional feature requests or out-of-scope revisions beyond agreed milestone deliverables will be billed separately.
3. INTELLECTUAL PROPERTY: Final project deliverables and assets will be released to the client upon receipt of 100% full payment.
4. CONFIDENTIALITY: Both parties agree to maintain non-disclosure of proprietary business data and technology shared during project execution.
5. CANCELLATION & REFUNDS: Deposits and work completed prior to cancellation are non-refundable.`;
      await connection.query('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)', ['terms_and_conditions', defaultTermsText]);
    }

    // 5. Project Categories Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS project_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Ensured project_categories table exists.');

    const [existingCategories] = await connection.query('SELECT COUNT(*) as count FROM project_categories');
    if (existingCategories[0].count === 0) {
      const defaultCategories = [
        'Income Tax Return Filing',
        'Sales Tax Registration',
        'Corporate Tax Filing',
        'Company Registration',
        'Website Development',
        'Logo Design',
        'SEO Optimization'
      ];
      for (const catName of defaultCategories) {
        await connection.query('INSERT IGNORE INTO project_categories (name) VALUES (?)', [catName]);
      }
      console.log('✅ Seeded default project categories.');
    }

    console.log('\n🎉 Live database update completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    connection.release();
  }
}

module.exports = updateLiveDb;

