const { query } = require('../db');

// Lấy lịch sử tin nhắn của một cuộc trò chuyện
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { before, limit = 50 } = req.query;  // hỗ trợ phân trang

    // Kiểm tra user có quyền xem conversation này không
    const memberCheck = await query(
      'SELECT id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Không có quyền xem cuộc trò chuyện này' });
    }

    let queryText = `
      SELECT m.id, m.content, m.message_type, m.created_at,
             u.id as sender_id, u.username, u.avatar_url
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
    `;
    const params = [conversationId];

    if (before) {
      // Load thêm tin nhắn cũ hơn (infinite scroll)
      queryText += ` AND m.created_at < $${params.length + 1}`;
      params.push(before);
    }

    queryText += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await query(queryText, params);
    // Đảo lại để hiển thị từ cũ → mới
    res.json({ messages: result.rows.reverse() });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy tin nhắn' });
  }
};

// Lấy danh sách tất cả cuộc trò chuyện của user
const getConversations = async (req, res) => {
  try {
    const result = await query(
      `SELECT
        c.id, c.name, c.is_group, c.created_at,
        -- Tin nhắn cuối cùng
        lm.content as last_message,
        lm.created_at as last_message_at,
        lu.username as last_message_sender
       FROM conversations c
       JOIN conversation_members cm ON c.id = cm.conversation_id AND cm.user_id = $1
       LEFT JOIN LATERAL (
         SELECT m.content, m.created_at, m.sender_id
         FROM messages m
         WHERE m.conversation_id = c.id
         ORDER BY m.created_at DESC
         LIMIT 1
       ) lm ON TRUE
       LEFT JOIN users lu ON lm.sender_id = lu.id
       ORDER BY COALESCE(lm.created_at, c.created_at) DESC`,
      [req.userId]
    );
    res.json({ conversations: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy danh sách cuộc trò chuyện' });
  }
};

module.exports = { getMessages, getConversations };