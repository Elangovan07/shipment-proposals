const xlsx = require('xlsx');
const fs = require('fs');
const db = require('../config/db');

exports.uploadExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const workbook = xlsx.readFile(req.file.path);

    // First sheet: shipments
    const shipmentsSheetName = workbook.SheetNames[0];
    const shipmentsSheet = workbook.Sheets[shipmentsSheetName];
    const shipmentsData = xlsx.utils.sheet_to_json(shipmentsSheet);

    // Second sheet: contacts
    const contactsSheetName = workbook.SheetNames[1];
    if (!contactsSheetName) {
      return res.status(400).json({ message: "Second sheet (contacts) missing in Excel file." });
    }
    const contactsSheet = workbook.Sheets[contactsSheetName];
    const contactsData = xlsx.utils.sheet_to_json(contactsSheet);

    // Unique company names from both sheets
    const companyNames = [
      ...new Set([
        ...shipmentsData.map(s => s['Company Name']?.trim().toLowerCase()),
        ...contactsData.map(c => c['Company Name']?.trim().toLowerCase())
      ])
    ].filter(Boolean);

    // Map company name to company_id
    const companyIdMap = {};
    for (const name of companyNames) {
      let [existing] = await db.query(
        "SELECT id FROM companies WHERE LOWER(TRIM(name)) = ?",
        [name]
      );
      let id;
      if (existing.length > 0) {
        id = existing[0].id;
      } else {
        let [result] = await db.query(
          "INSERT INTO companies (name) VALUES (?)",
          [name]
        );
        id = result.insertId;
      }
      companyIdMap[name] = id;
    }

    // Deduplicate and insert contacts
    for (const contact of contactsData) {
      const companyName = contact['Company Name']?.trim().toLowerCase();
      const companyId = companyIdMap[companyName];
      if (!companyId) continue;

      const contactEmail = contact['Contact Email']?.trim().toLowerCase();
      if (!contactEmail) continue; // skip if no email

      const [existingContact] = await db.query(
        "SELECT id FROM company_contacts WHERE company_id = ? AND LOWER(TRIM(contact_email)) = ?",
        [companyId, contactEmail]
      );
      if (existingContact.length === 0) {
        await db.query(
          "INSERT INTO company_contacts (company_id, contact_name, contact_email, contact_phone) VALUES (?, ?, ?, ?)",
          [
            companyId,
            contact['Contact Person'] || '',
            contactEmail,
            contact['Contact Phone'] || ''
          ]
        );
      }
    }

    // Deduplicate and insert shipments
    // Deduplicate and insert shipments
    for (const s of shipmentsData) {
      const companyName = s['Company Name']?.trim().toLowerCase();
      const companyId = companyIdMap[companyName];
      if (!companyId) continue;
    
      // Check if shipment already exists by company_id + port_loading + port_discharge
      const [existingShipment] = await db.query(
        `SELECT id FROM shipments 
         WHERE company_id = ? AND port_loading = ? AND port_discharge = ?`,
        [companyId, s['Port of Loading'], s['Port of Discharge']]
      );
    
        if (existingShipment.length === 0) {
        await db.query(
          `INSERT INTO shipments
           (raw_customer_name, raw_company_name, company_id, port_loading, port_discharge, price, currency)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            s['Customer Name'] || '',
            s['Company Name'],
            companyId,
            s['Port of Loading'] || '',
            s['Port of Discharge'] || '',
            s['Price'] || null,
            s['Currency'] || null
          ]
        );
      }
    }
    // Cleanup uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ success: true, message: 'File uploaded and data saved with deduplication.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error processing the Excel file.' });
  }
};
