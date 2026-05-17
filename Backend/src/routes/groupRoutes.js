const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { createGroup, addMember } = require('../controllers/groupController');

router.post('/create', authenticate, createGroup);
router.post('/add-member', authenticate, addMember);

module.exports = router;