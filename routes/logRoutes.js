const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middlewares/authMiddleware');
const { getLogs } = require('../controllers/logController');

router.get('/', isAuthenticated, getLogs);

module.exports = router;
