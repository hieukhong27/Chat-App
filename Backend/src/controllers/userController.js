const { query } = require('../db');

// Tìm kiếm người dùng theo username
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Nhập ít nhất 2 ký tự để tìm kiếm' });
    }
    const result = await query(
      `SELECT id, username, email, avatar_url, is_online
       FROM users
       WHERE username ILIKE $1 AND id != $2
       LIMIT 20`,
      [`%${q}%`, req.userId]
    );
    res.json({ users: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi tìm kiếm' });
  }
};

// Gửi lời mời kết bạn
const sendFriendRequest = async (req, res) => {
  try {
    const { addresseeId } = req.body;
    if (addresseeId === req.userId) {
      return res.status(400).json({ error: 'Không thể kết bạn với chính mình' });
    }

    // Kiểm tra đã kết bạn/gửi lời mời chưa
    const existing = await query(
      `SELECT id, status FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [req.userId, addresseeId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Đã gửi lời mời hoặc đã là bạn bè' });
    }

    await query(
      'INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)',
      [req.userId, addresseeId]
    );
    res.status(201).json({ message: 'Đã gửi lời mời kết bạn' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi gửi lời mời' });
  }
};

// Chấp nhận lời mời kết bạn
const acceptFriendRequest = async (req, res) => {
  try {
    const { requesterId } = req.body;
    const result = await query(
      `UPDATE friendships SET status = 'accepted'
       WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'
       RETURNING id`,
      [requesterId, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy lời mời' });
    }

    // Tự động tạo cuộc trò chuyện 1-1
    const conv = await query(
      'INSERT INTO conversations (is_group) VALUES (FALSE) RETURNING id',
      []
    );
    const conversationId = conv.rows[0].id;
    await query(
      'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
      [conversationId, req.userId, requesterId]
    );

    res.json({ message: 'Đã chấp nhận lời mời kết bạn', conversationId });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi chấp nhận lời mời' });
  }
};

// Lấy danh sách bạn bè
const getFriends = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.avatar_url, u.is_online, u.last_seen
       FROM users u
       JOIN friendships f ON (
         (f.requester_id = u.id AND f.addressee_id = $1) OR
         (f.addressee_id = u.id AND f.requester_id = $1)
       )
       WHERE f.status = 'accepted'
       ORDER BY u.is_online DESC, u.username`,
      [req.userId]
    );
    res.json({ friends: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy danh sách bạn bè' });
  }
};

module.exports = { searchUsers, sendFriendRequest, acceptFriendRequest, getFriends };