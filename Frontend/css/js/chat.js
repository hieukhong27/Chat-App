let currentConversationId = null;
let currentPartnerId = null;  // cho chat 1-1
let typingTimer = null;

const EMOJIS = ['😊','😂','❤️','👍','🎉','😍','🤔','😢','😡','👋','🙏','✨','💪','🔥','⭐','🎵','🤣','😅','🥰','😎','🤩','😴','🙄','😮','🥺'];

// ── KHỞI TẠO ──
window.addEventListener('DOMContentLoaded', () => {
  // Hiển thị thông tin user
  document.getElementById('myUsername').textContent = currentUser.username;
  document.getElementById('myAvatar').textContent = currentUser.username[0].toUpperCase();

  // Render emoji picker
  const grid = document.getElementById('emojiGrid');
  EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.onclick = () => insertEmoji(emoji);
    grid.appendChild(btn);
  });

  // Load dữ liệu ban đầu
  loadConversations();
  loadFriendsForGroupModal();

  // Auto resize textarea
  const textarea = document.getElementById('messageInput');
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  });

  // Gửi bằng Enter (Shift+Enter = xuống dòng)
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Sự kiện typing
  textarea.addEventListener('input', () => {
    if (currentConversationId) {
      socket.emit('typing', { conversationId: currentConversationId });
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        socket.emit('stop_typing', { conversationId: currentConversationId });
      }, 1500);
    }
  });
});

// ── LOAD DANH SÁCH CUỘC TRÒ CHUYỆN ──
async function loadConversations() {
  const data = await apiCall('/messages/conversations');
  renderConversationList(data.conversations || []);
}

function renderConversationList(conversations) {
  const list = document.getElementById('conversationList');
  if (conversations.length === 0) {
    list.innerHTML = '<div class="text-center text-muted p-3 small">Chưa có cuộc trò chuyện nào</div>';
    return;
  }
  list.innerHTML = conversations.map(conv => `
    <div class="conv-item ${conv.id === currentConversationId ? 'active' : ''}"
         onclick="openConversation('${conv.id}', ${conv.is_group})">
      <div class="avatar-sm">${conv.is_group ? '👥' : conv.name ? conv.name[0].toUpperCase() : '?'}</div>
      <div class="flex-1 overflow-hidden">
        <div class="fw-bold text-truncate">${conv.name || 'Chat'}</div>
        <div class="text-muted small text-truncate">${conv.last_message || 'Chưa có tin nhắn'}</div>
      </div>
    </div>
  `).join('');
}

// ── MỞ CUỘC TRÒ CHUYỆN ──
async function openConversation(conversationId, isGroup) {
  currentConversationId = conversationId;

  document.getElementById('noChatSelected').style.display = 'none';
  document.getElementById('activeChatArea').style.display = 'flex';
  document.getElementById('messagesContainer').innerHTML = '<div class="text-center text-muted p-3">Đang tải...</div>';

  // Cập nhật active state sidebar
  document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');

  const data = await apiCall(`/messages/conversations/${conversationId}/messages`);
  renderMessages(data.messages || []);
}

// ── RENDER TIN NHẮN ──
function renderMessages(messages) {
  const container = document.getElementById('messagesContainer');
  if (messages.length === 0) {
    container.innerHTML = '<div class="text-center text-muted p-3 small">Hãy gửi tin nhắn đầu tiên! 👋</div>';
    return;
  }
  container.innerHTML = messages.map(msg => createMessageHTML(msg)).join('');
  scrollToBottom();
}

function createMessageHTML(msg) {
  const isSent = msg.sender_id === currentUser.id;
  const time = new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `
    <div style="display:flex; flex-direction:column; align-items:${isSent ? 'flex-end' : 'flex-start'}; margin: 2px 0;">
      ${!isSent ? `<div class="message-sender-name">${msg.username || msg.sender?.username || ''}</div>` : ''}
      <div class="message-bubble ${isSent ? 'sent' : 'received'}">${escapeHtml(msg.content)}</div>
      <div class="message-time">${time}</div>
    </div>
  `;
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  container.scrollTop = container.scrollHeight;
}

// ── GỬI TIN NHẮN ──
function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content || !currentConversationId) return;

  socket.emit('send_message', {
    conversationId: currentConversationId,
    content,
    messageType: 'text'
  });

  input.value = '';
  input.style.height = 'auto';
  socket.emit('stop_typing', { conversationId: currentConversationId });
}

function insertEmoji(emoji) {
  const input = document.getElementById('messageInput');
  input.value += emoji;
  input.focus();
}

// ── TÌM KIẾM NGƯỜI DÙNG ──
let searchDebounce = null;
async function searchUsers(query) {
  const results = document.getElementById('searchResults');
  if (query.length < 2) { results.innerHTML = ''; return; }

  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(async () => {
    const data = await apiCall(`/users/search?q=${encodeURIComponent(query)}`);
    if (!data.users || data.users.length === 0) {
      results.innerHTML = '<div class="p-2 text-muted small">Không tìm thấy</div>';
      return;
    }
    results.innerHTML = data.users.map(u => `
      <div class="search-result-item" onclick="handleUserAction('${u.id}', '${u.username}')">
        <div class="avatar-sm" style="width:32px;height:32px;font-size:12px;">${u.username[0].toUpperCase()}</div>
        <div>
          <div class="fw-bold">${u.username}</div>
          <div class="small text-muted">${u.is_online ? '🟢 Online' : '⚫ Offline'}</div>
        </div>
        <button class="btn btn-sm btn-outline-primary ms-auto" onclick="event.stopPropagation(); addFriend('${u.id}')">
          + Kết bạn
        </button>
      </div>
    `).join('');
  }, 300);
}

async function addFriend(userId) {
  const data = await apiCall('/users/friend-request', {
    method: 'POST',
    body: JSON.stringify({ addresseeId: userId })
  });
  alert(data.message || data.error);
}

// ── TẠO NHÓM ──
async function loadFriendsForGroupModal() {
  const data = await apiCall('/users/friends');
  const friends = data.friends || [];
  const container = document.getElementById('friendCheckboxList');
  if (friends.length === 0) {
    container.innerHTML = '<div class="text-muted small">Bạn chưa có bạn bè nào</div>';
    return;
  }
  container.innerHTML = friends.map(f => `
    <div class="form-check">
      <input class="form-check-input group-member-check" type="checkbox" value="${f.id}" id="friend_${f.id}">
      <label class="form-check-label" for="friend_${f.id}">
        ${f.username} ${f.is_online ? '🟢' : '⚫'}
      </label>
    </div>
  `).join('');
}

async function createGroup() {
  const name = document.getElementById('groupName').value.trim();
  const checked = document.querySelectorAll('.group-member-check:checked');
  const memberIds = Array.from(checked).map(c => c.value);

  if (!name) return alert('Vui lòng đặt tên nhóm');
  if (memberIds.length < 2) return alert('Chọn ít nhất 2 thành viên');

  const data = await apiCall('/groups/create', {
    method: 'POST',
    body: JSON.stringify({ name, memberIds })
  });

  if (data.conversationId) {
    bootstrap.Modal.getInstance(document.getElementById('createGroupModal')).hide();
    loadConversations();
    alert(`Nhóm "${name}" đã được tạo!`);
  } else {
    alert(data.error || 'Tạo nhóm thất bại');
  }
}

// ── SOCKET EVENTS ──
socket.on('new_message', (message) => {
  // Cập nhật conversation list
  loadConversations();

  // Nếu đang mở đúng conversation này thì hiển thị tin mới
  if (message.conversation_id === currentConversationId) {
    const container = document.getElementById('messagesContainer');
    // Xóa placeholder "Chưa có tin nhắn" nếu có
    const placeholder = container.querySelector('.text-muted');
    if (placeholder && container.children.length === 1) placeholder.remove();

    container.insertAdjacentHTML('beforeend', createMessageHTML(message));
    scrollToBottom();
  }
});

socket.on('user_typing', ({ userId, conversationId }) => {
  if (conversationId === currentConversationId && userId !== currentUser.id) {
    document.getElementById('typingIndicator').textContent = 'Đang gõ...';
  }
});

socket.on('user_stop_typing', ({ conversationId }) => {
  if (conversationId === currentConversationId) {
    document.getElementById('typingIndicator').textContent = '';
  }
});

socket.on('user_online', ({ userId }) => {
  // Cập nhật trạng thái online/offline trong danh sách
  loadConversations();
});

socket.on('user_offline', ({ userId }) => {
  loadConversations();
});

socket.on('error', ({ message }) => {
  console.error('Socket error:', message);
});