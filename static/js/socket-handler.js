// static/js/socket-handlers.js — Socket.IO + connection banner
(function() {
  const socket = io({ transports: ['websocket', 'polling'] });
  const banner = document.getElementById('connectionBanner') || (() => {
    const b = document.createElement('div');
    b.id = 'connectionBanner';
    document.body.prepend(b);
    return b;
  })();

  function showBanner(msg, isConnected = false) {
    banner.textContent = msg;
    banner.className = 'show' + (isConnected ? ' connected' : '');
  }

  function hideBanner() {
    banner.className = '';
  }

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    hideBanner();
    // notify app
    if (window.__socketConnected) window.__socketConnected();
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
    showBanner('⚠️ Lost connection — reconnecting…', false);
  });

  socket.on('connect_error', () => {
    showBanner('⚠️ Cannot reach server. Is Flask running?', false);
  });

  // Forward events to app handlers
  socket.on('progress_update', (data) => {
    if (window.__handleProgressUpdate) window.__handleProgressUpdate(data);
  });

  socket.on('submission_update', (data) => {
    if (window.__handleSubmissionUpdate) window.__handleSubmissionUpdate(data);
  });

  socket.on('student_joined', (data) => {
    if (window.__handleStudentJoined) window.__handleStudentJoined(data);
  });

  socket.on('student_left', (data) => {
    if (window.__handleStudentLeft) window.__handleStudentLeft(data);
  });

  // Expose socket and helpers
  window.__socket = socket;
  window.__emitProgress = (student_name, assignment_id, content) => {
    socket.emit('update_progress', { student_name, assignment_id, content });
  };
  window.__emitJoin = (student_name, assignment_id) => {
    socket.emit('join_assignment', { student_name, assignment_id });
  };
  window.__emitLeave = (student_name, assignment_id) => {
    socket.emit('leave_assignment', { student_name, assignment_id });
  };
})();