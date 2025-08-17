const db = require('../config/db');

// Add shipment (Company + POL + POD)
exports.addShipment = async (req, res) => {
  try {
    const { company_name, port_loading, port_discharge } = req.body;
    if (!company_name || !port_loading || !port_discharge) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const companyNameNorm = company_name.trim();
    const companyNameLower = companyNameNorm.toLowerCase();
    const portLoadingNorm = port_loading.trim();
    const portDischargeNorm = port_discharge.trim();

    // Deduplicate company
    const [company] = await db.query(
      "SELECT id FROM companies WHERE LOWER(TRIM(name)) = ?", [companyNameLower]
    );
    let companyId;
    if (company.length > 0) {
      companyId = company[0].id;
    } else {
      const [result] = await db.query(
        "INSERT INTO companies (name) VALUES (?)", [companyNameNorm]
      );
      companyId = result.insertId;
    }

    // Deduplicate shipment
    const [existingShipment] = await db.query(
      "SELECT id FROM shipments WHERE company_id = ? AND port_loading = ? AND port_discharge = ?",
      [companyId, portLoadingNorm, portDischargeNorm]
    );
    if (existingShipment.length > 0) {
      return res.json({ success: true, message: 'Shipment already exists' });
    }

    await db.query(
      `INSERT INTO shipments (company_id, port_loading, port_discharge, raw_company_name, uploaded_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [companyId, portLoadingNorm, portDischargeNorm, companyNameNorm]
    );

    res.json({ success: true, message: 'Shipment added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error adding shipment' });
  }
};

// Add contact (Company + Contact details)
exports.addContact = async (req, res) => {
  try {
    const { company_name, contact_name, contact_email, contact_phone } = req.body;
    if (!company_name || !contact_name || !contact_email) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const companyNameNorm = company_name.trim();
    const companyNameLower = companyNameNorm.toLowerCase();
    const contactNameNorm = contact_name.trim();
    const contactEmailNorm = contact_email.trim();
    const contactEmailLower = contactEmailNorm.toLowerCase();
    const contactPhoneNorm = contact_phone ? contact_phone.trim() : null;

    // Deduplicate company
    const [company] = await db.query(
      "SELECT id FROM companies WHERE LOWER(TRIM(name)) = ?", [companyNameLower]
    );
    let companyId;
    if (company.length > 0) {
      companyId = company[0].id;
    } else {
      const [result] = await db.query(
        "INSERT INTO companies (name) VALUES (?)", [companyNameNorm]
      );
      companyId = result.insertId;
    }

    // Deduplicate contact by company and email
    const [existingContact] = await db.query(
      "SELECT id FROM company_contacts WHERE company_id = ? AND LOWER(TRIM(contact_email)) = ?",
      [companyId, contactEmailLower]
    );
    if (existingContact.length > 0) {
      return res.json({ success: true, message: 'Contact already exists' });
    }

    await db.query(
      "INSERT INTO company_contacts (company_id, contact_name, contact_email, contact_phone) VALUES (?, ?, ?, ?)",
      [companyId, contactNameNorm, contactEmailNorm, contactPhoneNorm]
    );

    res.json({ success: true, message: 'Contact added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error adding contact' });
  }
};
