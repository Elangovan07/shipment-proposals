const express = require('express');
const router = express.Router();
const { getAllContacts, deleteContact, updateContact } = require('../controllers/contactsController');
const isAuthenticated = require('../middlewares/authMiddleware');

router.get('/', isAuthenticated, getAllContacts);        // GET /api/contacts
router.delete('/:id', isAuthenticated, deleteContact);   // DELETE /api/contacts/:id
router.put('/:id', isAuthenticated, updateContact);      // PUT /api/contacts/:id

module.exports = router;
