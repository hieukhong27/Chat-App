const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { searchUsers, sendFriendRequest, acceptFriendRequest, getFriends } = require('../controllers/userController');

router.get('/search', authenticate, searchUsers);
router.get('/friends', authenticate, getFriends);
router.post('/friend-request', authenticate, sendFriendRequest);
router.post('/friend-accept', authenticate, acceptFriendRequest);

module.exports = router;