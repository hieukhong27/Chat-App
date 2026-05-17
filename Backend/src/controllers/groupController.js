const { query } = require('../db');

// Tạo nhóm chat mới
const createGroup = async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !memberIds || memberIds.length < 2) {
      return res.status(400).json({ error: 'Cần đặt tên nhóm và ít nhất 2 thành viên' });
    }

    // Tạo conversation là nhóm
    const convResult = await query(
      'INSERT INTO conversations (name, is_group, created_by) VALUES ($1, TRUE, $2) RETURNING id',
      [name, req.userId]
    );
    const conversationId = convResult.rows[0].id;

    // Thêm tất cả thành viên (bao gồm người tạo)
    const allMembers = [...new Set([req.userId, ...memberIds])];
    const insertValues = allMembers
      .map((_, i) => `($1, $${i + 2})`)
      .join(', ');
    await query(
      `INSERT INTO conversation_members (conversation_id, user_id) VALUES ${insertValues}`,
      [conversationId, ...allMembers]
    );

    res.status(201).json({
      message: 'Tạo nhóm thành công',
      conversationId,
      name
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi tạo nhóm' });
  }
};

// Thêm thành viên vào nhóm
const addMember = async (req, res) => {
  try {
    const { conversationId, userId } = req.body;

    // Kiểm tra conversation có phải nhóm không
    const conv = await query(
      'SELECT id FROM conversations WHERE id = $1 AND is_group = TRUE',
      [conversationId]
    );
    if (conv.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy nhóm' });
    }

    // Kiểm tra người thêm có thuộc nhóm không
    const memberCheck = await query(
      'SELECT id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Bạn không thuộc nhóm này' });
    }

    await query(
      'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [conversationId, userId]
    );

    res.json({ message: 'Đã thêm thành viên vào nhóm' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi thêm thành viên' });
  }
};

module.exports = { createGroup, addMember };