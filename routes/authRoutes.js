const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/request-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

const isAuthenticated = require('../middlewares/authMiddleware');

router.get('/check', isAuthenticated, (req, res) => {
    res.json({ loggedIn: true });
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

module.exports = router;
