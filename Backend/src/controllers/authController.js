const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

// Tạo JWT token có thời hạn 7 ngày
const createToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ĐĂNG KÝ
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    // Kiểm tra email/username đã tồn tại chưa
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email hoặc username đã tồn tại' });
    }

    // Mã hóa mật khẩu (cost factor 12 = an toàn nhưng không quá chậm)
    const passwordHash = await bcrypt.hash(password, 12);

    // Lưu user vào database
    const result = await query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at`,
      [username, email, passwordHash]
    );

    const user = result.rows[0];
    const token = createToken(user.id);

    res.status(201).json({
      message: 'Đăng ký thành công',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });

  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ error: 'Lỗi server, thử lại sau' });
  }
};

// ĐĂNG NHẬP
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
    }

    // Tìm user theo email
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    const user = result.rows[0];

    // So sánh mật khẩu với hash đã lưu
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }

    // Cập nhật trạng thái online
    await query('UPDATE users SET is_online = TRUE WHERE id = $1', [user.id]);

    const token = createToken(user.id);

    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: { id: user.id, username: user.username, email: user.email, avatar_url: user.avatar_url }
    });

  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({ error: 'Lỗi server, thử lại sau' });
  }
};

module.exports = { register, login };