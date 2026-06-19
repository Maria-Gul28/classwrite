// ============================================================
//  SOCKET.IO — real-time connection to Flask backend
// ============================================================
const socket = io({ transports: ['websocket', 'polling'] });

socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    hideBanner();
});

socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
    showBanner('⚠️ Lost connection to server — trying to reconnect...', false);
});

socket.on('connect_error', () => {
    showBanner('⚠️ Cannot reach server. Make sure Flask is running on port 5000.', false);
});

// Teacher receives these from server when a student updates progress
socket.on('progress_update', (data) => {
    const key = `${data.student_name}_${data.assignment_id}`;
    const isNewWriter = !studentWorks[key];
    studentWorks[key] = data;

    if (currentRole === 'teacher') {
        const activeSidebarBtn = document.querySelector('.sidebar-btn.active');
        if (activeSidebarBtn) {
            const page = activeSidebarBtn.dataset.page;
            if (page === 'overview') {
                renderTeacherOverview();
            } else if (page === 'progress') {
                const previewEl = document.getElementById('progressPreviewText');
                if (!isNewWriter && key === activeProgressTab && previewEl) {
                    updateLiveProgressContent(data);
                } else {
                    renderLiveProgress();
                }
            } else if (page === 'submissions') {
                renderSubmissions();
            }
        }
    }
});

// Lightweight in-place update for live progress view — avoids full rebuild flicker
function updateLiveProgressContent(data) {
    const fullContent = data.content || '';
    const charCount = fullContent.length;
    const wordCount = fullContent.trim().split(/\s+/).filter(Boolean).length;
    const updated = data.last_updated ? new Date(data.last_updated).toLocaleTimeString() : '';

    const previewEl = document.getElementById('progressPreviewText');
    if (previewEl) {
        const prevContent = previewEl.textContent;
        if (fullContent.startsWith(prevContent)) {
            const added = fullContent.slice(prevContent.length);
            if (added) previewEl.appendChild(document.createTextNode(added));
        } else if (prevContent.startsWith(fullContent)) {
            previewEl.textContent = fullContent;
        } else {
            previewEl.textContent = fullContent;
        }
    }

    const timeEl = document.querySelector('#activeStudentCard .progress-time');
    if (timeEl) timeEl.textContent = `Last update: ${updated}`;

    const charsEl = document.querySelector('#activeStudentCard .progress-chars');
    if (charsEl) charsEl.textContent = `${wordCount} word${wordCount === 1 ? '' : 's'} · ${charCount} characters`;

    const key = `${data.student_name}_${data.assignment_id}`;
    const safeKey = key.replace(/(["\\])/g, '\\$1');
    const tabWordsEl = document.querySelector(`.student-tab[data-key="${safeKey}"] .tab-words`);
    if (tabWordsEl) tabWordsEl.textContent = `${wordCount}w`;
}

// Teacher receives this when a student submits
socket.on('submission_update', (data) => {
    const existing = submissions.findIndex(s => s.student_name === data.student_name && s.assignment_id === data.assignment_id);
    if (existing !== -1) submissions[existing] = data;
    else submissions.push(data);

    const key = `${data.student_name}_${data.assignment_id}`;
    delete studentWorks[key];

    if (currentRole === 'teacher') {
        showToast(`📬 ${data.student_name} submitted!`);
        const activeSidebarBtn = document.querySelector('.sidebar-btn.active');
        if (activeSidebarBtn) {
            const page = activeSidebarBtn.dataset.page;
            if (page === 'overview') renderTeacherOverview();
            else if (page === 'progress') renderLiveProgress();
            else if (page === 'submissions') renderSubmissions();
        }
    }
});

// Teacher receives this when a student joins
socket.on('student_joined', (data) => {
    if (currentRole === 'teacher') {
        showToast(`👋 ${data.student_name} joined assignment #${data.assignment_id}`);
        const activeSidebarBtn = document.querySelector('.sidebar-btn.active');
        if (activeSidebarBtn && activeSidebarBtn.dataset.page === 'overview') {
            renderTeacherOverview();
        }
    }
});

// Teacher receives this when a student closes/leaves their assignment tab
socket.on('student_left', (data) => {
    const key = `${data.student_name}_${data.assignment_id}`;
    delete studentWorks[key];

    if (currentRole === 'teacher') {
        showToast(`🚪 ${data.student_name} left assignment #${data.assignment_id}`);
        const activeSidebarBtn = document.querySelector('.sidebar-btn.active');
        if (activeSidebarBtn) {
            const page = activeSidebarBtn.dataset.page;
            if (page === 'overview') renderTeacherOverview();
            else if (page === 'progress') renderLiveProgress();
        }
    }
});

// ============================================================
//  CONNECTION BANNER HELPERS
// ============================================================
function showBanner(msg, isConnected = false) {
    const b = document.getElementById('connectionBanner');
    b.textContent = msg;
    b.className = 'show' + (isConnected ? ' connected' : '');
}

function hideBanner() {
    document.getElementById('connectionBanner').className = '';
}

// ============================================================
//  STUDENT INACTIVE DETECTION — fires when tab is closed/hidden
// ============================================================
function emitLeaveAssignment() {
    if (currentRole === 'student' && currentStudent && currentAssignmentId) {
        socket.emit('leave_assignment', {
            student_name: currentStudent,
            assignment_id: currentAssignmentId
        });
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        emitLeaveAssignment();
    } else if (document.visibilityState === 'visible' && currentRole === 'student' && currentAssignmentId) {
        socket.emit('join_assignment', {
            student_name: currentStudent,
            assignment_id: currentAssignmentId
        });
    }
});

window.addEventListener('pagehide', emitLeaveAssignment);