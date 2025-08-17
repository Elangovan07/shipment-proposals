const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middlewares/authMiddleware');
const { getPricingData, updateAllPricing } = require('../controllers/pricingController');


router.get('/', isAuthenticated, getPricingData);
router.put('/update-all', isAuthenticated, updateAllPricing);


module.exports = router;
