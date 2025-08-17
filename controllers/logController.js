const db = require('../config/db');

exports.getLogs = async (req, res) => {
  try {
    let { company, status, from, to } = req.query;

    let query = `
      SELECT
        log.id,
        c.name AS company_name,
        log.contact_email,
        log.email_status,
        DATE_FORMAT(log.sent_at, '%d-%m-%Y %H:%i:%s') AS sent_at
      FROM email_logs log
      LEFT JOIN companies c ON log.company_id = c.id
      WHERE 1
    `;
    let params = [];

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

    query += " ORDER BY log.sent_at DESC";

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching logs" });
  }
};
