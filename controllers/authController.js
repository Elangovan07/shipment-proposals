const nodemailer = require('nodemailer');
const db = require('../config/db');

const otpStore = new Map(); // For production, use a DB table

// Setup Nodemailer with Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,        // must match your env vars!
    pass: process.env.EMAIL_PASS
  }
});

// POST /api/auth/request-login-otp
exports.requestLoginOtp = async (req, res) => {
  const { email } = req.body;
  try {
    const [rows] = await db.query('SELECT id FROM admins WHERE email = ?', [email]);
    if (!rows.length) return res.status(404).json({ success: false, message: "Email not found" });

    const user = rows[0];
    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    otpStore.set(user.id, { otp, expiresAt: Date.now() + 10*60*1000 });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Your Admin Login OTP',
      text: `Your OTP is: ${otp}`
    });

    res.json({ success: true, userId: user.id, message: "OTP sent to email" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Mail error" });
  }
};

// POST /api/auth/verify-login-otp
exports.verifyLoginOtp = async (req, res) => {
  const { userId, otp } = req.body;
  try {
    const entry = otpStore.get(userId);
    if (!entry || entry.otp !== otp || entry.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }
    // Login successful
    req.session.admin = { id: userId };
    otpStore.delete(userId);
    res.json({ success: true, message: "Logged in" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// (Optional) Logout and check endpoints
exports.logout = (req, res) => {
  req.session.destroy();
  res.json({ success: true });
};

exports.check = (req, res) => {
  if (req.session && req.session.admin) {
    res.json({ loggedIn: true });
  } else {
    res.status(401).json({ loggedIn: false });
  }
};
