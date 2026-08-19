const express = require('express');
const router = express.Router();
const db = require('../db');

const defaultTemplates = [
  {
    title: 'Social Media Marketing (SMM)',
    category: 'Social Media',
    content: `1. Content Calendar & creative assets will be shared for client review 3 days prior to scheduled publishing.
2. Client approval must be provided within 48 hours to maintain regular posting schedules.
3. Ad Spend budget is separate from agency management fees and must be directly funded/billed to client ad accounts.
4. Package includes up to 2 rounds of minor revisions per creative post/caption before publishing.
5. Monthly performance & analytics report will be delivered by the 5th of each subsequent month.
6. Retainer services require 30 days prior written notice for cancellation or tier modifications.`
  },
  {
    title: 'Website Design & Development',
    category: 'Development',
    content: `1. Project will proceed according to agreed milestones: UI/UX Wireframing, Development, Testing & Launch.
2. Client must provide brand assets, copy, and access credentials within 7 working days to avoid timeline shifts.
3. Includes 30-day post-launch bug fixing & technical warranty support (excludes new feature requests).
4. Third-party hosting, domain registrations, premium plugins, and API licensing fees are billed separately to the client.
5. Scope changes or additional custom features requested beyond the initial scope will be quoted separately.
6. Full source code, ownership, and credentials transfer upon receipt of 100% final invoice settlement.`
  },
  {
    title: 'SEO & Search Engine Marketing',
    category: 'Marketing',
    content: `1. Monthly retainer includes keyword research, on-page optimization, technical audits, and high-quality backlink outreach.
2. SEO is an ongoing strategy; visible ranking improvements and organic traffic growth typically require 3 to 6 months.
3. Client agrees to provide necessary CMS and Google Analytics / Search Console access.
4. Algorithm updates and search engine policy shifts are beyond agency control but will be adapted proactively.
5. Monthly rank tracking and organic search progress reports delivered every 30 days.`
  },
  {
    title: 'Video Editing & Production',
    category: 'Video Production',
    content: `1. Production stages: Script/Concept approval -> Raw footage edit -> Rough cut -> Final color grading & audio sync.
2. Up to 2 rounds of edit revisions included per video project based on the initial approved script.
3. Raw unedited footage and project files remain agency property unless buyout is specifically agreed.
4. Stock footage, licensed voiceovers, and licensed audio tracks beyond standard library incur separate charges.
5. Final deliverable files provided in high-resolution MP4/MOV formats optimized for specified platforms.`
  },
  {
    title: 'Graphic Design & Branding',
    category: 'Design',
    content: `1. Initial delivery includes 2-3 distinct brand concept directions.
2. Includes up to 3 revision iterations on the selected design direction.
3. Final deliverables include print-ready and web-ready vectors (AI, EPS, PDF, PNG, SVG).
4. Full commercial intellectual property transfers to client upon final invoice payment.`
  },
  {
    title: 'Standard Agency Retainer',
    category: 'General',
    content: `1. Payment is due within the specified invoice due date.
2. Late payments may incur an additional 10% late fee or temporary service pause.
3. All deliverables are subject to the agreed revision cycles.
4. Work commences upon clearance of the advance/retainer payment.`
  }
];

const ensureTermsTemplatesTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS terms_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        content TEXT NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Check if table is empty, if so seed defaults
    const [rows] = await db.query('SELECT COUNT(*) as count FROM terms_templates');
    if (rows[0].count === 0) {
      for (const t of defaultTemplates) {
        await db.query(
          'INSERT INTO terms_templates (title, category, content, is_default) VALUES (?, ?, ?, TRUE)',
          [t.title, t.category, t.content]
        );
      }
      console.log('Seeded default terms and conditions templates.');
    }
  } catch (err) {
    console.error('Error ensuring terms_templates table:', err.message);
  }
};

// Auto run ensure table
ensureTermsTemplatesTable();

// GET all templates
router.get('/', async (req, res) => {
  try {
    await ensureTermsTemplatesTable();
    const [rows] = await db.query('SELECT * FROM terms_templates ORDER BY is_default DESC, id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new template
router.post('/', async (req, res) => {
  const { title, category, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  try {
    await ensureTermsTemplatesTable();
    const cat = (category && category.trim()) ? category.trim() : 'General';
    const [result] = await db.query(
      'INSERT INTO terms_templates (title, category, content, is_default) VALUES (?, ?, ?, FALSE)',
      [title.trim(), cat, content.trim()]
    );
    const newTemplate = {
      id: result.insertId,
      title: title.trim(),
      category: cat,
      content: content.trim(),
      is_default: 0
    };
    res.status(201).json({ template: newTemplate, message: 'Template created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update template
router.put('/:id', async (req, res) => {
  const { title, category, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  try {
    await db.query(
      'UPDATE terms_templates SET title = ?, category = ?, content = ? WHERE id = ?',
      [title, category || 'Custom', content, req.params.id]
    );
    res.json({ message: 'Template updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE template
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM terms_templates WHERE id = ?', [req.params.id]);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
