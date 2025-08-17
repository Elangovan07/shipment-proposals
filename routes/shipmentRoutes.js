const express = require('express');
const router = express.Router();
const { getAllShipments, deleteShipment, updateShipment } = require('../controllers/shipmentController');
const isAuthenticated = require('../middlewares/authMiddleware');

router.get('/', isAuthenticated, getAllShipments);      // GET /api/shipments
router.delete('/:id', isAuthenticated, deleteShipment); // DELETE /api/shipments/:id
router.put('/:id', isAuthenticated, updateShipment);    // PUT /api/shipments/:id

module.exports = router;
