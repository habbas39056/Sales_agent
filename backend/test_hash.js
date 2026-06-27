const bcrypt = require('bcrypt');
bcrypt.compare('Admin@123', '$2b$10$LzGSO5vfl1DSQg7ayHDbOudBSw.7urjWH9NAP0JrjOCxUWjptWq7S').then(console.log);
