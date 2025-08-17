const db = require('../config/db');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Helper: Get all contacts for a company
async function getCompanyContacts(companyId) {
  const [contacts] = await db.query(
    'SELECT contact_name, contact_email FROM companies_contacts WHERE company_id = ?', 
    [companyId]
  );
  return contacts;
}

// Helper: Shipments table for email
function buildShipmentsTable(companyName, shipments) {
  const rowsHtml = shipments.map(s => `
    <tr>
      <td>${companyName}</td>
      <td>${s.port_loading}</td>
      <td>${s.port_discharge}</td>
      <td>${s.container_size || '-'}</td>
      <td>${s.currency || ''} ${s.price ?? '-'}</td>
      <td>${s.house_do_fees ?? '-'}</td>
      <td>${s.validity_date || '-'}</td>
    </tr>
  `).join('');
  return `
    <table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;">
      <thead style="background:#f2f2f2;">
        <tr>
          <th>Company Name</th>
          <th>Port of Loading</th>
          <th>Port of Discharge</th>
          <th>Container Size</th>
          <th>Freight</th>
          <th>House DO Fees</th>
          <th>Validity</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

// --- Preview proposals ---
exports.previewProposals = async (req, res) => {
  try {
    const [shipments] = await db.query(`
      SELECT 
        c.id AS company_id, c.name AS company_name,
        s.port_loading, s.port_discharge, s.price, s.currency, s.container_size,
        s.house_do_fees, DATE_FORMAT(s.validity_date, '%Y-%m-%d') AS validity_date
      FROM shipments s
      JOIN companies c ON s.company_id = c.id
      WHERE s.price IS NOT NULL
      ORDER BY c.id
    `);

    const [templateRow] = await db.query(
      `SELECT template_body FROM email_templates WHERE active = 1 LIMIT 1`
    );
    if (!templateRow.length) {
      return res.json({ success: false, message: 'No active email template found' });
    }
    const template = templateRow[0].template_body;

    // Group shipments by company
    const grouped = {};
    for (const s of shipments) {
      if (!grouped[s.company_id]) {
        grouped[s.company_id] = {
          company_id: s.company_id,
          company_name: s.company_name,
          shipments: []
        };
      }
      grouped[s.company_id].shipments.push(s);
    }

    // Fetch all contacts for each company
    const previews = [];
    for (const comp of Object.values(grouped)) {
      const [contacts] = await db.query(
        `SELECT contact_name, contact_email FROM company_contacts WHERE company_id = ?`,
        [comp.company_id]
      );
      const contactNames = contacts.map(c => c.contact_name).join(', ');
      const contactEmails = contacts.map(c => c.contact_email).join(', ');

      // Build shipments HTML table
      const rowsHtml = comp.shipments.map(s => `
        <tr>
          <td>${comp.company_name}</td>
          <td>${s.port_loading}</td>
          <td>${s.port_discharge}</td>
          <td>${s.container_size || '-'}</td>
          <td>${s.currency || ''} ${s.price ?? '-'}</td>
          <td>${s.house_do_fees ?? '-'}</td>
          <td>${s.validity_date || '-'}</td>
        </tr>
      `).join('');
      const shipmentsTableHtml = `
        <table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;">
          <thead style="background:#f2f2f2;">
            <tr>
              <th>Company Name</th>
              <th>Port of Loading</th>
              <th>Port of Discharge</th>
              <th>Container Size</th>
              <th>Freight</th>
              <th>House DO Fees</th>
              <th>Validity</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;

      // Prepare email body replacing template placeholders
      const emailBody = template
        .replace(/{{company_name}}/g, comp.company_name)
        .replace(/{{contact_name}}/g, contactNames)
        .replace(/{{shipments_table}}/g, shipmentsTableHtml);

      previews.push({
        company_id: comp.company_id,
        company_name: comp.company_name,
        contact_name: contactNames,
        contact_email: contactEmails,
        preview_html: emailBody,
        shipments: comp.shipments
      });
    }

    res.json({ success: true, previews });
  } catch (error) {
    console.error('Preview proposals error:', error);
    res.status(500).json({ success: false, message: 'Error generating preview proposals' });
  }
};



// --- Send proposals ---
exports.sendProposals = async (req, res) => {
  try {
    let companiesToSend = req.body.selected_companies || [];

    // Fetch template once
    const [templateRow] = await db.query(
      `SELECT template_body FROM email_templates WHERE active = 1 LIMIT 1`
    );
    if (!templateRow.length) {
      return res.status(400).json({ success: false, message: 'No active email template found' });
    }
    const emailTemplate = templateRow[0].template_body;

    let sentCount = 0;
    let failedCount = 0;

    for (const comp of companiesToSend) {
      if (!comp.company_id) {
        failedCount++;
        continue;
      }

      const [contacts] = await db.query(
        `SELECT contact_name, contact_email FROM company_contacts WHERE company_id = ?`,
        [comp.company_id]
      );

      if (!contacts.length) {
        failedCount++;
        continue;
      }

      // Build unique loading and discharge ports for subject
      const loadingPortsSet = new Set();
      const dischargePortsSet = new Set();
      (comp.shipments || []).forEach(s => {
        if (s.port_loading) loadingPortsSet.add(s.port_loading.trim());
        if (s.port_discharge) dischargePortsSet.add(s.port_discharge.trim());
      });
      const loadingPorts = Array.from(loadingPortsSet).join(', ');
      const dischargePorts = Array.from(dischargePortsSet).join(', ');

      const emailSubject = `Ocean freight for ${loadingPorts} to ${dischargePorts}`;

      // Build shipments table HTML outside contacts loop
      const rowsHtml = (comp.shipments || []).map(s => `
        <tr>
          <td>${comp.company_name}</td>
          <td>${s.port_loading}</td>
          <td>${s.port_discharge}</td>
          <td>${s.container_size || '-'}</td>
          <td>${s.currency || ''} ${s.price ?? '-'}</td>
          <td>${s.house_do_fees ?? '-'}</td>
          <td>${s.validity_date || '-'}</td>
        </tr>
      `).join('');
      const shipmentsTableHtml = `
        <table border="1" cellspacing="0" cellpadding="5" style="border-collapse:collapse;width:100%;">
          <thead style="background:#f2f2f2;">
            <tr>
              <th>Company Name</th>
              <th>Port of Loading</th>
              <th>Port of Discharge</th>
              <th>Container Size</th>
              <th>Freight</th>
              <th>House DO Fees</th>
              <th>Validity</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;

      // Send individual emails to all contacts
      for (const contact of contacts) {
        let emailStatus = 'Failed';
        try {
          const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: contact.contact_email,
            subject: emailSubject,
            html: emailTemplate
              .replace(/{{company_name}}/g, comp.company_name)
              .replace(/{{contact_name}}/g, contact.contact_name || '')
              .replace(/{{shipments_table}}/g, shipmentsTableHtml)
          });

          if (info.rejected && info.rejected.length > 0) {
            console.error(`Email to ${contact.contact_email} rejected:`, info.rejected);
            failedCount++;
            emailStatus = 'Failed';
          } else {
            sentCount++;
            emailStatus = 'Sent';
          }
        } catch (e) {
          failedCount++;
          emailStatus = 'Failed';
          console.error(`Error sending email to ${contact.contact_email}:`, e.message);
        }

        // Log email attempt
        await db.query(
          `INSERT INTO email_logs (company_id, shipment_id, email_status, shipments_summary, contact_email)
           VALUES (?, ?, ?, ?, ?)`,
          [
            comp.company_id,
            null,
            emailStatus,
            JSON.stringify(comp.shipments || []),
            contact.contact_email
          ]
        );
      }
    }

    res.json({ success: true, message: `Emails sent: ${sentCount}, failed: ${failedCount}` });
  } catch (error) {
    console.error('Send proposals error:', error);
    res.status(500).json({ success: false, message: 'Error sending proposals' });
  }
};
