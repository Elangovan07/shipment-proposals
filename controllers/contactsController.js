const db = require('../config/db');

// Get all contacts
exports.getAllContacts = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        cc.id,
        c.name AS company_name,
        cc.contact_name,
        cc.contact_email,
        cc.contact_phone
      FROM company_contacts cc
      LEFT JOIN companies c ON cc.company_id = c.id
      ORDER BY c.name, cc.contact_name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching contacts" });
  }
};

// Delete contact by ID
exports.deleteContact = async (req, res) => {
  try {
    const contactId = req.params.id;
    await db.query('DELETE FROM company_contacts WHERE id = ?', [contactId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error deleting contact." });
  }
};

// Update contact by ID
exports.updateContact = async (req, res) => {
  try {
    const contactId = req.params.id;
    const { contact_name, contact_email, contact_phone } = req.body;
    await db.query(
      'UPDATE company_contacts SET contact_name=?, contact_email=?, contact_phone=? WHERE id=?',
      [contact_name, contact_email, contact_phone, contactId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error updating contact." });
  }
};
