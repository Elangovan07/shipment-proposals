const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadExcel } = require('../controllers/uploadController');
const isAuthenticated = require('../middlewares/authMiddleware');

// File storage
const upload = multer({ dest: 'uploads/' });

router.post('/excel', isAuthenticated, upload.single('file'), uploadExcel);

module.exports = router;
