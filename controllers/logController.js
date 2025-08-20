const db = require('../config/db');
const nodemailer = require('nodemailer');
const { convert } = require('html-to-text');
const moment = require('moment');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.getLogs = async (req, res) => {
  try {
    let { company, status, from, to, page = 1, pageSize = 50 } = req.query;
    page = parseInt(page);
    pageSize = parseInt(pageSize);
    const offset = (page - 1) * pageSize;

    // Default date to today if no filter supplied
    if (!from && !to) {
      from = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss');
      to = moment().endOf('day').format('YYYY-MM-DD HH:mm:ss');
    }

    let query = `
      SELECT
        log.id,
        c.name AS company_name,
        log.contact_email,
        log.email_status,
        DATE_FORMAT(log.sent_at, '%d-%m-%Y %H:%i:%s') AS sent_at
      FROM email_logs log
      LEFT JOIN companies c ON log.company_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (company) {
      query += " AND c.name LIKE ?";
      params.push(`%${company}%`);
    }
    if (status) {
      query += " AND log.email_status = ?";
      params.push(status);
    }
    if (from && to) {
      query += " AND log.sent_at BETWEEN ? AND ?";
      params.push(from, to);
    } else if (from) {
      query += " AND log.sent_at >= ?";
      params.push(from);
    } else if (to) {
      query += " AND log.sent_at <= ?";
      params.push(to);
    }

    query += " ORDER BY log.sent_at DESC LIMIT ? OFFSET ?";
    params.push(pageSize, offset);

    const [rows] = await db.query(query, params);

    let countQuery = `SELECT COUNT(*) as total FROM email_logs log LEFT JOIN companies c ON log.company_id = c.id WHERE 1=1`;
    const countParams = [];
    if (company) {
      countQuery += " AND c.name LIKE ?";
      countParams.push(`%${company}%`);
    }
    if (status) {
      countQuery += " AND log.email_status = ?";
      countParams.push(status);
    }
    if (from && to) {
      countQuery += " AND log.sent_at BETWEEN ? AND ?";
      countParams.push(from, to);
    } else if (from) {
      countQuery += " AND log.sent_at >= ?";
      countParams.push(from);
    } else if (to) {
      countQuery += " AND log.sent_at <= ?";
      countParams.push(to);
    }

    const [[{ total }]] = await db.query(countQuery, countParams);

    res.json({ data: rows, total, page, pageSize });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching logs" });
  }
};

exports.resendFailedEmails = async (req, res) => {
  try {
    let { company, from, to } = req.query;

    // Default resend today’s failed emails only if no filters set
    if (!from && !to) {
      from = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss');
      to = moment().endOf('day').format('YYYY-MM-DD HH:mm:ss');
    }

    // Fetch active email template once
    const [templateRows] = await db.query(
      `SELECT template_body FROM email_templates WHERE active = 1 LIMIT 1`
    );
    if (!templateRows.length) {
      return res.status(500).json({ success: false, message: "No active email template found" });
    }
    const emailTemplate = templateRows[0].template_body;

    let query = `
      SELECT 
        log.id, log.company_id, log.contact_email, c.name AS company_name
      FROM email_logs log
      LEFT JOIN companies c ON log.company_id = c.id
      WHERE log.email_status = 'Failed'
    `;
    const params = [];

    if (company) {
      query += " AND c.name LIKE ?";
      params.push(`%${company}%`);
    }
    if (from && to) {
      query += " AND log.sent_at BETWEEN ? AND ?";
      params.push(from, to);
    } else if (from) {
      query += " AND log.sent_at >= ?";
      params.push(from);
    } else if (to) {
      query += " AND log.sent_at <= ?";
      params.push(to);
    }

    const [failedEmails] = await db.query(query, params);

    let sentCount = 0;
    let failedCount = 0;

    for (const emailLog of failedEmails) {
      try {
        // Get shipments for this company to build shipments table
        const [shipments] = await db.query(
          `SELECT port_loading, port_discharge, price, currency, container_size, house_do_fees, DATE_FORMAT(validity_date, '%Y-%m-%d') AS validity_date
           FROM shipments WHERE company_id = ? AND price IS NOT NULL`,
          [emailLog.company_id]
        );

        const rowsHtml = shipments.map(s => `
          <tr>
            <td>${emailLog.company_name}</td>
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

        const htmlBody = emailTemplate
          .replace(/{{company_name}}/g, emailLog.company_name)
          .replace(/{{contact_name}}/g, '') // optionally fetch contact_name if required
          .replace(/{{shipments_table}}/g, shipmentsTableHtml);

        const plainTextBody = convert(htmlBody);

        const emailSubject = `Ocean freight proposals for ${emailLog.company_name}`;

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: emailLog.contact_email,
          subject: emailSubject,
          html: htmlBody,
          text: plainTextBody,
        });

        await db.query(`
          UPDATE email_logs SET email_status = 'Sent', last_sent_at = NOW(), attempt_count = attempt_count + 1, error_message = NULL WHERE id = ?`,
          [emailLog.id]
        );

        sentCount++;
      } catch (error) {
        await db.query(`
          UPDATE email_logs SET last_sent_at = NOW(), attempt_count = attempt_count + 1, error_message = ? WHERE id = ?`,
          [error.message, emailLog.id]
        );
        failedCount++;
      }
    }

    res.json({ success: true, sentCount, failedCount });
  } catch (error) {
    console.error('Error resending failed emails:', error);
    res.status(500).json({ success: false, message: 'Error resending failed emails' });
  }
};
