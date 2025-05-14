const express = require('express');
const router = express.Router();
const mailController = require('../controllers/mailController');

// Route to handle sending reset password email
router.post('/verify-email', mailController.sendResetLink);

// Optional routes (if implemented)
router.get('/', mailController.getForm || ((req, res) => res.send('GET /')));
router.post('/send', mailController.sendMail || ((req, res) => res.send('POST /send')));

module.exports = router;
