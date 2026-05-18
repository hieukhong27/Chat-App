const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { searchUsers, sendFriendRequest, acceptFriendRequest, getFriends } = require('../controllers/userController');
const { searchUsers, sendFriendRequest, acceptFriendRequest, getFriends, getFriendRequests } = require('../controllers/userController');

router.get('/search', authenticate, searchUsers);
router.get('/friends', authenticate, getFriends);
router.get('/friend-requests', authenticate, getFriendRequests);
router.post('/friend-request', authenticate, sendFriendRequest);
router.post('/friend-accept', authenticate, acceptFriendRequest);

module.exports = router;