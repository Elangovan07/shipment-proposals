const bcrypt = require('bcrypt');
const db = require('../config/db');

exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query(
      'SELECT id, username, email, password_hash FROM admins WHERE username = ? OR email = ?', [username, username]
    );
    if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const user = rows[0];
    if (await bcrypt.compare(password, user.password_hash)) {
      req.session.admin = { id: user.id, username: user.username, email: user.email };
      res.json({ success: true, message: 'Login successful' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const nodemailer = require('nodemailer');
const otpStore = new Map(); // Or use a DB table for more durability

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,        // Gmail user
    pass: process.env.EMAil_PASS     // App password or OAuth token
  }
});

exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await db.query('SELECT id FROM admins WHERE email = ?', [email]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Email not found" });

    const user = rows[0];
    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    otpStore.set(user.id, { otp, expiresAt: Date.now() + 15*60*1000 });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Admin Password Reset OTP',
      text: `Your OTP is: ${otp}`
    });

    res.json({ success: true, userId: user.id, message: "OTP sent to email" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Mail error" });
  }
};

exports.resetPassword = async (req, res) => {
  const { userId, otp, newPassword } = req.body;
  try {
    const entry = otpStore.get(userId);
    if (!entry || entry.otp !== otp || entry.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }
    const password_hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE admins SET password_hash = ? WHERE id = ?', [password_hash, userId]);
    otpStore.delete(userId);
    res.json({ success: true, message: "Password successfully reset" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
