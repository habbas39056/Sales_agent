const db = require('./db');

async function addBankToPayments() {
  try {
    const connection = await db.getConnection();
    try {
      await connection.query('ALTER TABLE invoice_payments ADD COLUMN bank VARCHAR(100) DEFAULT NULL;');
      console.log('Successfully added bank column to invoice_payments.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('bank column already exists.');
      } else {
        throw e;
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit();
  }
}

addBankToPayments();
