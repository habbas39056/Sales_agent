const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');

// Configure multer for profile avatar upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, 'avatar-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const ensureSettingsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS settings (
        setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
        setting_value MEDIUMTEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (e) {
    // Ignore if table exists or permission restricted
  }
};

// Get all system settings as key-value pairs
router.get('/', async (req, res) => {
  try {
    await ensureSettingsTable();
    const [rows] = await db.query('SELECT setting_key, setting_value FROM settings');
    const settings = {};
    if (Array.isArray(rows)) {
      rows.forEach(row => {
        if (row && row.setting_key) {
          settings[row.setting_key] = row.setting_value;
        }
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error.message);
    res.json({});
  }
});

// Update batch of settings
router.post('/', async (req, res) => {
  try {
    await ensureSettingsTable();

    const body = req.body || {};
    const settingsToSave = (body.settings && typeof body.settings === 'object') ? body.settings : body;

    const keys = Object.keys(settingsToSave);
    for (const key of keys) {
      if (key && key !== 'settings') {
        const val = String(settingsToSave[key] ?? '');
        try {
          await db.query(
            'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [key, val, val]
          );
        } catch (queryErr) {
          console.error(`Query error for key ${key}:`, queryErr.message);
          await db.query(
            'REPLACE INTO settings (setting_key, setting_value) VALUES (?, ?)',
            [key, val]
          );
        }
      }
    }
    res.json({ message: 'Settings saved successfully', settings: settingsToSave });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: error.message || 'Failed to save settings' });
  }
});

// Upload profile avatar image
router.post('/upload-avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, message: 'Image uploaded successfully' });
});

// Get profile details of logged in user
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }
    const [rows] = await db.query(
      'SELECT id, name, username, email, role, profile_image_url, commission_percentage, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile details of logged in user
router.put('/profile', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;
    const { name, username, email, profile_image_url } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Check email uniqueness if email is changing
    const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email address is already in use by another account' });
    }

    await db.query(
      'UPDATE users SET name = ?, username = ?, email = ?, profile_image_url = ? WHERE id = ?',
      [name, username || null, email, profile_image_url || null, userId]
    );

    const [updated] = await db.query(
      'SELECT id, name, username, email, role, profile_image_url, commission_percentage, created_at FROM users WHERE id = ?',
      [userId]
    );

    res.json({ message: 'Profile updated successfully', user: updated[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update password of logged in user
router.put('/password', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.user_id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized user' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const saltRounds = 10;
    const newHash = await bcrypt.hash(newPassword, saltRounds);

    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
