const { Pool } = require('pg');

// Pool = nhóm kết nối, tái sử dụng thay vì tạo mới mỗi lần
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // bắt buộc với Supabase
});

// Hàm query tiện dụng
const query = (text, params) => pool.query(text, params);

module.exports = { query, pool };