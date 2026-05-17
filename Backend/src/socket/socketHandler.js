const jwt = require('jsonwebtoken');
const { query } = require('../db');

// Map lưu: userId → socketId (biết ai đang online)
const onlineUsers = new Map();

const initSocket = (io) => {

  // Middleware xác thực socket: mỗi kết nối phải có token hợp lệ
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Không có token'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;  // gắn userId vào socket object
      next();
    } catch {
      next(new Error('Token không hợp lệ'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User ${socket.userId} đã kết nối (socket: ${socket.id})`);

    // Lưu vào map và cập nhật DB
    onlineUsers.set(socket.userId, socket.id);
    await query('UPDATE users SET is_online = TRUE WHERE id = $1', [socket.userId]);

    // Thông báo cho tất cả mọi người biết user này online
    socket.broadcast.emit('user_online', { userId: socket.userId });

    // ── GỬI TIN NHẮN ──
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, content, messageType = 'text' } = data;

        // 1. Kiểm tra user có thuộc conversation này không
        const memberCheck = await query(
          'SELECT id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, socket.userId]
        );
        if (memberCheck.rows.length === 0) {
          return socket.emit('error', { message: 'Bạn không thuộc cuộc trò chuyện này' });
        }

        // 2. Lưu tin nhắn vào database
        const result = await query(
          `INSERT INTO messages (conversation_id, sender_id, content, message_type)
           VALUES ($1, $2, $3, $4)
           RETURNING id, conversation_id, sender_id, content, message_type, created_at`,
          [conversationId, socket.userId, content, messageType]
        );
        const message = result.rows[0];

        // Lấy thêm thông tin người gửi
        const userResult = await query(
          'SELECT username, avatar_url FROM users WHERE id = $1',
          [socket.userId]
        );
        message.sender = userResult.rows[0];

        // 3. Lấy danh sách thành viên trong conversation
        const members = await query(
          'SELECT user_id FROM conversation_members WHERE conversation_id = $1',
          [conversationId]
        );

        // 4. Gửi tin nhắn tới từng thành viên đang online
        members.rows.forEach(({ user_id }) => {
          const targetSocketId = onlineUsers.get(user_id);
          if (targetSocketId) {
            io.to(targetSocketId).emit('new_message', message);
          }
        });

      } catch (error) {
        console.error('Lỗi gửi tin nhắn:', error);
        socket.emit('error', { message: 'Không thể gửi tin nhắn' });
      }
    });

    // ── ĐANG GÕ... ──
    socket.on('typing', async ({ conversationId }) => {
      const members = await query(
        'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2',
        [conversationId, socket.userId]
      );
      members.rows.forEach(({ user_id }) => {
        const targetSocketId = onlineUsers.get(user_id);
        if (targetSocketId) {
          io.to(targetSocketId).emit('user_typing', {
            userId: socket.userId,
            conversationId
          });
        }
      });
    });

    socket.on('stop_typing', async ({ conversationId }) => {
      const members = await query(
        'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2',
        [conversationId, socket.userId]
      );
      members.rows.forEach(({ user_id }) => {
        const targetSocketId = onlineUsers.get(user_id);
        if (targetSocketId) {
          io.to(targetSocketId).emit('user_stop_typing', {
            userId: socket.userId,
            conversationId
          });
        }
      });
    });

    // ── WEBRTC SIGNALING ── (trao đổi thông tin để thiết lập cuộc gọi)
    socket.on('call_offer', ({ targetUserId, offer, callType }) => {
      // callType: 'audio' hoặc 'video'
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('incoming_call', {
          callerId: socket.userId,
          offer,
          callType
        });
      } else {
        socket.emit('call_failed', { message: 'Người dùng không online' });
      }
    });

    socket.on('call_answer', ({ callerId, answer }) => {
      const callerSocketId = onlineUsers.get(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_answered', { answer });
      }
    });

    socket.on('ice_candidate', ({ targetUserId, candidate }) => {
      // ICE candidate giúp thiết lập kết nối P2P qua NAT/firewall
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('ice_candidate', { candidate });
      }
    });

    socket.on('call_reject', ({ callerId }) => {
      const callerSocketId = onlineUsers.get(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_rejected');
      }
    });

    socket.on('call_end', ({ targetUserId }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call_ended');
      }
    });

    // ── NGẮT KẾT NỐI ──
    socket.on('disconnect', async () => {
      console.log(`User ${socket.userId} đã ngắt kết nối`);
      onlineUsers.delete(socket.userId);
      await query(
        'UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = $1',
        [socket.userId]
      );
      socket.broadcast.emit('user_offline', { userId: socket.userId });
    });
  });
};

module.exports = { initSocket, onlineUsers };