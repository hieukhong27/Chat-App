// ── WEBRTC: Gọi thoại & Video call ──

// Cấu hình STUN server (miễn phí của Google)
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

let peerConnection = null;      // kết nối WebRTC với peer
let localStream = null;         // stream từ mic/camera của mình
let currentCallType = null;     // 'audio' hoặc 'video'
let currentCallerId = null;     // ID người gọi (khi mình là bên nhận)
let currentCalleeId = null;     // ID người nhận (khi mình là bên gọi)

const callModal = new bootstrap.Modal(document.getElementById('callModal'));

// ── GỌI CHO NGƯỜI KHÁC ──
async function startCall(callType) {
  if (!currentPartnerId) return alert('Chọn cuộc trò chuyện 1-1 để gọi');

  currentCallType = callType;
  currentCalleeId = currentPartnerId;

  try {
    // Xin quyền truy cập mic/camera
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video'
    });

    // Hiển thị video local nếu là video call
    if (callType === 'video') {
      document.getElementById('videoContainer').style.display = 'flex';
      document.getElementById('audioCallUI').style.display = 'none';
      document.getElementById('localVideo').srcObject = localStream;
    }

    document.getElementById('callModalTitle').textContent = callType === 'video' ? '📹 Video call' : '📞 Gọi thoại';
    document.getElementById('callStatus').textContent = 'Đang gọi...';
    document.getElementById('callerName').textContent = currentUser.username;
    document.getElementById('answerBtn').style.display = 'none';
    callModal.show();

    // Tạo RTCPeerConnection
    peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Thêm local stream vào peer connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Khi nhận được remote stream → hiển thị
    peerConnection.ontrack = (event) => {
      document.getElementById('remoteVideo').srcObject = event.streams[0];
      document.getElementById('callStatus').textContent = 'Đang kết nối...';
    };

    // Khi có ICE candidate → gửi qua signaling server
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice_candidate', {
          targetUserId: currentCalleeId,
          candidate: event.candidate
        });
      }
    };

    // Theo dõi trạng thái kết nối
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'connected') {
        document.getElementById('callStatus').textContent = 'Đã kết nối ✅';
      } else if (state === 'disconnected' || state === 'failed') {
        endCall();
      }
    };

    // Tạo offer và gửi tới người nhận
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('call_offer', {
      targetUserId: currentCalleeId,
      offer,
      callType
    });

  } catch (error) {
    console.error('Lỗi bắt đầu cuộc gọi:', error);
    if (error.name === 'NotAllowedError') {
      alert('Vui lòng cấp quyền truy cập mic/camera');
    } else {
      alert('Không thể bắt đầu cuộc gọi');
    }
    endCall();
  }
}

// ── NHẬN CUỘC GỌI ──
socket.on('incoming_call', async ({ callerId, offer, callType }) => {
  currentCallerId = callerId;
  currentCallType = callType;

  document.getElementById('callModalTitle').textContent = callType === 'video' ? '📹 Video call đến' : '📞 Cuộc gọi đến';
  document.getElementById('callStatus').textContent = 'Có cuộc gọi đến...';
  document.getElementById('callerName').textContent = `Từ ID: ${callerId}`;  // thay bằng username sau
  document.getElementById('answerBtn').style.display = 'inline-block';

  if (callType === 'video') {
    document.getElementById('videoContainer').style.display = 'flex';
    document.getElementById('audioCallUI').style.display = 'none';
  }

  callModal.show();

  // Lưu offer để dùng khi người dùng bấm "Nghe máy"
  window._pendingOffer = offer;
});

// ── NGHE MÁY ──
async function answerCall() {
  document.getElementById('answerBtn').style.display = 'none';
  document.getElementById('callStatus').textContent = 'Đang kết nối...';

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: currentCallType === 'video'
    });

    if (currentCallType === 'video') {
      document.getElementById('localVideo').srcObject = localStream;
    }

    peerConnection = new RTCPeerConnection(ICE_SERVERS);

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
      document.getElementById('remoteVideo').srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice_candidate', {
          targetUserId: currentCallerId,
          candidate: event.candidate
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        document.getElementById('callStatus').textContent = 'Đã kết nối ✅';
      }
    };

    // Set remote description từ offer nhận được
    await peerConnection.setRemoteDescription(new RTCSessionDescription(window._pendingOffer));

    // Tạo answer và gửi lại
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('call_answer', { callerId: currentCallerId, answer });

  } catch (error) {
    console.error('Lỗi nghe máy:', error);
    endCall();
  }
}

// ── NHẬN ANSWER (bên gọi) ──
socket.on('call_answered', async ({ answer }) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

// ── NHẬN ICE CANDIDATE ──
socket.on('ice_candidate', async ({ candidate }) => {
  if (peerConnection && candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Lỗi thêm ICE candidate:', error);
    }
  }
});

// ── BỊ TỪ CHỐI / KẾT THÚC ──
socket.on('call_rejected', () => {
  document.getElementById('callStatus').textContent = 'Cuộc gọi bị từ chối';
  setTimeout(endCall, 2000);
});

socket.on('call_ended', () => {
  document.getElementById('callStatus').textContent = 'Cuộc gọi đã kết thúc';
  setTimeout(endCall, 1500);
});

// ── KẾT THÚC CUỘC GỌI ──
function endCall() {
  // Dừng tất cả tracks (mic, camera)
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  // Đóng peer connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  // Thông báo bên kia
  if (currentCalleeId) {
    socket.emit('call_end', { targetUserId: currentCalleeId });
  } else if (currentCallerId) {
    socket.emit('call_end', { targetUserId: currentCallerId });
  }

  // Reset UI
  document.getElementById('remoteVideo').srcObject = null;
  document.getElementById('localVideo').srcObject = null;
  document.getElementById('videoContainer').style.display = 'none';
  document.getElementById('audioCallUI').style.display = 'block';

  currentCallerId = null;
  currentCalleeId = null;
  currentCallType = null;

  callModal.hide();
}