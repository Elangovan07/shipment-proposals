const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middlewares/authMiddleware');
const { getTemplate, saveTemplate } = require('../controllers/templateController');

router.get('/', isAuthenticated, getTemplate);
router.post('/', isAuthenticated, saveTemplate);

module.exports = router;
