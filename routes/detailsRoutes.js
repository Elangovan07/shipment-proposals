const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middlewares/authMiddleware');
const { addShipment, addContact } = require('../controllers/detailsController');
const { getAllShipments } = require('../controllers/shipmentController');
const { getAllContacts } = require('../controllers/contactsController');

router.post('/add-shipment', isAuthenticated, addShipment);
router.post('/add-contact', isAuthenticated, addContact);
router.get('/shipments', isAuthenticated, getAllShipments);
router.get('/contacts', isAuthenticated, getAllContacts);

module.exports = router;
