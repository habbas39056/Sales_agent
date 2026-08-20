const db = require('./db');

async function migrate() {
  try {
    console.log('Starting WhatsApp notifications migration...');

    // 1. Add whatsapp_number to users table
    try {
      await db.query(`ALTER TABLE users ADD COLUMN whatsapp_number VARCHAR(50) NULL AFTER email;`);
      console.log('Added whatsapp_number to users table.');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('whatsapp_number column already exists in users table.');
      } else {
        throw err;
      }
    }

    // 2. Add global settings
    await db.query(`INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('whatsapp_notifications_enabled', 'true')`);
    
    // Set global api keys for evolution if they don't exist
    await db.query(`INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('evolution_api_url', 'https://evolution-evolution-api.o1nqjj.easypanel.host')`);
    await db.query(`INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('evolution_instance_name', 'Adwise ERP')`);
    await db.query(`INSERT IGNORE INTO settings (setting_key, setting_value) VALUES ('evolution_api_key', '429683C4C977415CAAFCCE10F7D57E11')`);

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
