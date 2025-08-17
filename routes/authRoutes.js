const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// OTP login endpoints
router.post('/request-login-otp', authController.requestLoginOtp);
router.post('/verify-login-otp', authController.verifyLoginOtp);

// Logout/check
router.post('/logout', authController.logout);
router.get('/check', authController.check);

module.exports = router;
