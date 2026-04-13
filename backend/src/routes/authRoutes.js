const express = require('express');
const router = express.Router();
const { login, testAuth } = require('../controllers/authController');

/**
 * Authentication Routes
 * Integrates with Moodle database for user authentication
 */

// Test endpoint to verify auth system
router.get('/test', testAuth);

// Login endpoint
router.post('/login', login);

module.exports = router;
