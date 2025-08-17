const db = require('../config/db');

exports.getTemplate = async (req, res) => {
  try {
    // ✅ Fetch only the active template
    const [rows] = await db.query(
      "SELECT * FROM email_templates WHERE active = 1 ORDER BY created_at DESC LIMIT 1"
    );
    res.json(rows[0] || {}); 
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching template" });
  }
};

exports.saveTemplate = async (req, res) => {
  try {
    const { template_name, template_body } = req.body;

    if (!template_name || !template_body) {
      return res.status(400).json({ message: 'Template name and body are required.' });
    }

    // 1️ Deactivate all existing templates
    await db.query("UPDATE email_templates SET active = 0");

    // 2️ Insert new template and set it as active
    await db.query(
      "INSERT INTO email_templates (template_name, template_body, active) VALUES (?, ?, 1)",
      [template_name, template_body]
    );

    res.json({ success: true, message: "Template saved and set as active" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error saving template" });
  }
};
