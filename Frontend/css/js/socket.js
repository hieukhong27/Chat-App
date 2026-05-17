const API_URL = 'https://your-app.onrender.com/api';  // ← thay URL thật
const SOCKET_URL = 'https://your-app.onrender.com';

// Kiểm tra đã đăng nhập chưa
const token = localStorage.getItem('token');
const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
if (!token || !currentUser) window.location.href = 'index.html';

// Kết nối Socket.IO, gửi kèm token
const socket = io(SOCKET_URL, {
  auth: { token }
});

socket.on('connect', () => console.log('Socket đã kết nối:', socket.id));
socket.on('connect_error', (err) => {
  console.error('Lỗi socket:', err.message);
  if (err.message.includes('Token')) {
    localStorage.clear();
    window.location.href = 'index.html';
  }
});

// Helper gọi API với token
async function apiCall(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
  return response.json();
}

function logout() {
  socket.disconnect();
  localStorage.clear();
  window.location.href = 'index.html';
}