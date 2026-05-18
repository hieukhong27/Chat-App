const API_URL = 'https://your-app.onrender.com/api';  // ← thay URL thật khi deploy

function showTab(tab) {
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('loginTab').classList.toggle('active', tab === 'login');
  document.getElementById('registerTab').classList.toggle('active', tab === 'register');
}

function showAlert(message, type = 'danger') {
  const box = document.getElementById('alertBox');
  box.className = `alert alert-${type} mt-3`;
  box.textContent = message;
  box.style.display = 'block';
  setTimeout(() => box.style.display = 'none', 4000);
}

async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) return showAlert('Vui lòng điền đầy đủ');

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();

    if (!response.ok) return showAlert(data.error);

    // Lưu token và thông tin user vào localStorage
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    showAlert('Đăng nhập thành công! Đang chuyển hướng...', 'success');
    setTimeout(() => window.location.href = 'chat.html', 1000);
  } catch {
    showAlert('Không kết nối được server');
  }
}

async function register() {
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  if (!username || !email || !password) return showAlert('Vui lòng điền đầy đủ');

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await response.json();

    if (!response.ok) return showAlert(data.error);

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    showAlert('Đăng ký thành công!', 'success');
    setTimeout(() => window.location.href = 'chat.html', 1000);
  } catch {
    showAlert('Không kết nối được server');
  }
}

// Nếu đã đăng nhập thì redirect luôn
if (localStorage.getItem('token')) {
  window.location.href = 'chat.html';
}