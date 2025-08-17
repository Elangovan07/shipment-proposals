const express = require('express');
const router = express.Router();
const { previewProposals, sendProposals } = require('../controllers/proposalController');

router.get('/preview', previewProposals);
router.post('/send', sendProposals);

module.exports = router;
