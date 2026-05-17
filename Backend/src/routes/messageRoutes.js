const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { getMessages, getConversations } = require('../controllers/messageController');

router.get('/conversations', authenticate, getConversations);
router.get('/conversations/:conversationId/messages', authenticate, getMessages);

module.exports = router;