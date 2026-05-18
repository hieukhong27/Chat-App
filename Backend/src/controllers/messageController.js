const { query } = require('../db');

const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { before, limit = 50 } = req.query;

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
      queryText += ` AND m.created_at < $${params.length + 1}`;
      params.push(before);
    }

    queryText += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await query(queryText, params);
    res.json({ messages: result.rows.reverse() });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy tin nhắn' });
  }
};

const getConversations = async (req, res) => {
  try {
    const result = await query(
      `SELECT
        c.id, c.name, c.is_group, c.created_at,
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

const getConversationMembers = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const memberCheck = await query(
      'SELECT id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Không có quyền' });
    }
    const result = await query(
      `SELECT cm.user_id, u.username, u.is_online
       FROM conversation_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.conversation_id = $1`,
      [conversationId]
    );
    res.json({ members: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi lấy thành viên' });
  }
};

module.exports = { getMessages, getConversations, getConversationMembers };