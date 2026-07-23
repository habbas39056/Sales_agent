const db = require('./db.js');

db.query('ALTER TABLE invoice_items ADD COLUMN category VARCHAR(50) DEFAULT "SERVICE"')
  .then(() => {
    console.log("Done adding category");
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
