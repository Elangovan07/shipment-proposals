const db = require('../config/db');
const nodemailer = require('nodemailer');
const { convert } = require('html-to-text'); // For better plain-text conversion
const { v4: uuidv4 } = require('uuid');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function toTitleCase(str) {
  return str ? str.toLowerCase().split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ') : '';
}

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

    const previews = [];
    for (const comp of Object.values(grouped)) {
      const [contacts] = await db.query(
        `SELECT contact_name, contact_email FROM company_contacts WHERE company_id = ?`,
        [comp.company_id]
      );
      const contactNames = contacts.map(c => c.contact_name).join(', ');
      const contactEmails = contacts.map(c => c.contact_email).join(', ');

      const rowsHtml = (comp.shipments || []).map(s => `
        <tr>
          <td>${toTitleCase(comp.company_name)}</td>
          <td>${toTitleCase(s.port_loading)}</td>
          <td>${toTitleCase(s.port_discharge)}</td>
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

exports.sendProposals = async (req, res) => {
  const io = req.io;
  const companiesToSend = req.body.selected_companies || [];

  res.json({ success: true, message: 'Email sending started' });

  let sentCount = 0;
  let failedCount = 0;

  // Fetch the active email template once
  const [templateRows] = await db.query(
    `SELECT template_body FROM email_templates WHERE active = 1 LIMIT 1`
  );
  if (!templateRows.length) {
    console.error("No active email template found");
    io.emit('emailComplete', { sent: sentCount, failed: failedCount });
    return;
  }
  const emailTemplate = templateRows[0].template_body;

  for (const comp of companiesToSend) {
    if (!comp.company_id) {
      failedCount++;
      io.emit('emailProgress', { sent: sentCount, failed: failedCount });
      continue;
    }

    const [contacts] = await db.query(
      `SELECT contact_name, contact_email FROM company_contacts WHERE company_id = ?`,
      [comp.company_id]
    );

    if (!contacts.length) {
      failedCount++;
      io.emit('emailProgress', { sent: sentCount, failed: failedCount });
      continue;
    }

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

    const emailSubject = `Ocean freight for ${[...new Set(comp.shipments.map(s => s.port_loading.trim()))].join(', ')} to ${[...new Set(comp.shipments.map(s => s.port_discharge.trim()))].join(', ')}`;

    for (const contact of contacts) {
      let emailStatus = 'Failed';
      let errorMsg = null;

      try {
        const htmlBody = emailTemplate
          .replace(/{{company_name}}/g, comp.company_name)
          .replace(/{{contact_name}}/g, contact.contact_name || '')
          .replace(/{{shipments_table}}/g, shipmentsTableHtml);

        const plainTextBody = convert(htmlBody);

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: contact.contact_email,
          subject: emailSubject,
          html: htmlBody,
          text: plainTextBody,
        });

        emailStatus = 'Sent';
      } catch (error) {
        errorMsg = error.message;
        console.error(`Error sending email to ${contact.contact_email}:`, error.message);
      }

      // Compose a stable unique ID per email to avoid duplicate logs on resend
      const uniqueEmailId = `${comp.company_id}_${contact.contact_email}`;

      // Use MySQL INSERT ... ON DUPLICATE KEY UPDATE
      await db.query(
        `INSERT INTO email_logs 
          (company_id, contact_email, email_status, sent_at, attempt_count, error_message, unique_email_id)
         VALUES (?, ?, ?, NOW(), 1, ?, ?)
         ON DUPLICATE KEY UPDATE 
           email_status = VALUES(email_status),
           sent_at = NOW(),
           attempt_count = attempt_count + 1,
           error_message = VALUES(error_message)`,
        [comp.company_id, contact.contact_email, emailStatus, errorMsg, uniqueEmailId]
      );

      if (emailStatus === 'Sent') sentCount++;
      else failedCount++;

      io.emit('emailProgress', { sent: sentCount, failed: failedCount });
    }

    // Small delay to avoid spamming mail server
    await new Promise(r => setTimeout(r, 100));
  }

  io.emit('emailComplete', { sent: sentCount, failed: failedCount });
};
