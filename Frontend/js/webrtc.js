const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

let peerConnection = null;
let localStream = null;
let currentCallType = null;
let currentCallerId = null;
let currentCalleeId = null;

const callModal = new bootstrap.Modal(document.getElementById('callModal'));

function setRemoteStream(stream) {
  const remoteVideo = document.getElementById('remoteVideo');
  const remoteAudio = document.getElementById('remoteAudio');
  remoteVideo.srcObject = stream;
  remoteVideo.muted = false;
  remoteVideo.volume = 1.0;
  remoteVideo.play().catch(e => console.log('Video play error:', e));
  remoteAudio.srcObject = stream;
  remoteAudio.muted = false;
  remoteAudio.volume = 1.0;
  remoteAudio.play().catch(e => console.log('Audio play error:', e));
}

async function startCall(callType) {
  if (!currentPartnerId) return alert('Chọn cuộc trò chuyện 1-1 để gọi');

  currentCallType = callType;
  currentCalleeId = currentPartnerId;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video'
    });

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

    peerConnection = new RTCPeerConnection(ICE_SERVERS);

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      document.getElementById('callStatus').textContent = 'Đã kết nối ✅';
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice_candidate', {
          targetUserId: currentCalleeId,
          candidate: event.candidate
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'connected') {
        document.getElementById('callStatus').textContent = 'Đã kết nối ✅';
      } else if (state === 'disconnected' || state === 'failed') {
        endCall();
      }
    };

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

socket.on('incoming_call', async ({ callerId, offer, callType }) => {
  currentCallerId = callerId;
  currentCallType = callType;

  document.getElementById('callModalTitle').textContent = callType === 'video' ? '📹 Video call đến' : '📞 Cuộc gọi đến';
  document.getElementById('callStatus').textContent = 'Có cuộc gọi đến...';
  document.getElementById('callerName').textContent = `Từ: ${callerId}`;
  document.getElementById('answerBtn').style.display = 'inline-block';

  if (callType === 'video') {
    document.getElementById('videoContainer').style.display = 'flex';
    document.getElementById('audioCallUI').style.display = 'none';
  }

  callModal.show();
  window._pendingOffer = offer;
});

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
      setRemoteStream(event.streams[0]);
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

    await peerConnection.setRemoteDescription(new RTCSessionDescription(window._pendingOffer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('call_answer', { callerId: currentCallerId, answer });

  } catch (error) {
    console.error('Lỗi nghe máy:', error);
    endCall();
  }
}

socket.on('call_answered', async ({ answer }) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

socket.on('ice_candidate', async ({ candidate }) => {
  if (peerConnection && candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Lỗi thêm ICE candidate:', error);
    }
  }
});

socket.on('call_rejected', () => {
  document.getElementById('callStatus').textContent = 'Cuộc gọi bị từ chối';
  setTimeout(endCall, 2000);
});

socket.on('call_ended', () => {
  document.getElementById('callStatus').textContent = 'Cuộc gọi đã kết thúc';
  setTimeout(endCall, 1500);
});

function endCall() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (currentCalleeId) {
    socket.emit('call_end', { targetUserId: currentCalleeId });
  } else if (currentCallerId) {
    socket.emit('call_end', { targetUserId: currentCallerId });
  }

  const remoteAudio = document.getElementById('remoteAudio');
  remoteAudio.srcObject = null;
  document.getElementById('remoteVideo').srcObject = null;
  document.getElementById('localVideo').srcObject = null;
  document.getElementById('videoContainer').style.display = 'none';
  document.getElementById('audioCallUI').style.display = 'block';

  currentCallerId = null;
  currentCalleeId = null;
  currentCallType = null;

  callModal.hide();
}