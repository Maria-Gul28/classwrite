// static/js/app.js — state, session, renderApp, enterAs, event listeners
(function() {
  // ----- STATE -----
  window.__currentRole = null;
  window.__currentStudent = null;
  window.__currentStudentPin = null;
  window.__currentAssignmentId = null;
  window.__currentPage = null;
  window.__assignments = [];
  window.__submissions = [];
  window.__studentWorks = {};
  window.__activeProgressTab = null;

  // ----- HELPERS -----
  window.escapeHtml = function(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  };

  // ----- SESSION PERSISTENCE -----
  function saveSession() {
    if (window.__currentRole === 'teacher') {
      localStorage.setItem('classwrite_session', JSON.stringify({ role: 'teacher', email: 'maria_gul28@yahoo.com' }));
    } else if (window.__currentRole === 'student') {
      localStorage.setItem('classwrite_session', JSON.stringify({
        role: 'student',
        name: window.__currentStudent,
        pin: window.__currentStudentPin
      }));
    }
  }

  function loadSession() {
    const saved = localStorage.getItem('classwrite_session');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    return null;
  }

  window.__saveCurrentPage = function() {
    if (window.__currentRole && window.__currentPage) {
      localStorage.setItem('classwrite_current_page', JSON.stringify({
        role: window.__currentRole,
        page: window.__currentPage,
        assignmentId: window.__currentAssignmentId
      }));
    }
  };

  function loadSavedPage() {
    const saved = localStorage.getItem('classwrite_current_page');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    return null;
  }

  function clearSession() {
    localStorage.removeItem('classwrite_session');
    localStorage.removeItem('classwrite_current_page');
  }

  // ----- SOCKET EVENT HANDLERS (hooked from socket-handlers) -----
  window.__handleProgressUpdate = function(data) {
    const key = `${data.student_name}_${data.assignment_id}`;
    const isNew = !window.__studentWorks[key];
    window.__studentWorks[key] = data;

    if (window.__currentRole === 'teacher') {
      const activeBtn = document.querySelector('.sidebar-btn.active');
      if (activeBtn) {
        const page = activeBtn.dataset.page;
        if (page === 'overview') window.TeacherViews.renderOverview();
        else if (page === 'progress') {
          // If it's the currently viewed student, patch text; else full refresh
          if (!isNew && key === window.__activeProgressTab) {
            patchLiveProgress(data);
          } else {
            window.TeacherViews.renderLiveProgress();
          }
        } else if (page === 'submissions') window.TeacherViews.renderSubmissions();
      }
    }
  };

  function patchLiveProgress(data) {
    const fullContent = data.content || '';
    const wordCount = fullContent.trim().split(/\s+/).filter(Boolean).length;
    const updated = data.last_updated ? new Date(data.last_updated).toLocaleTimeString() : '';
    const previewEl = document.getElementById('progressPreviewText');
    if (previewEl) previewEl.textContent = fullContent;
    const timeEl = document.querySelector('#activeStudentCard .progress-time');
    if (timeEl) timeEl.textContent = `Last update: ${updated}`;
    const charsEl = document.querySelector('#activeStudentCard .progress-chars');
    if (charsEl) charsEl.textContent = `${wordCount} word${wordCount===1?'':'s'} · ${fullContent.length} characters`;
    const key = `${data.student_name}_${data.assignment_id}`;
    const tabWordsEl = document.querySelector(`.student-tab[data-key="${key}"] .tab-words`);
    if (tabWordsEl) tabWordsEl.textContent = `${wordCount}w`;
  }

  window.__handleSubmissionUpdate = function(data) {
    const subs = window.__submissions || [];
    const existing = subs.findIndex(s => s.student_name === data.student_name && s.assignment_id === data.assignment_id);
    if (existing !== -1) subs[existing] = data;
    else subs.push(data);
    window.__submissions = subs;
    const key = `${data.student_name}_${data.assignment_id}`;
    delete window.__studentWorks[key];

    if (window.__currentRole === 'teacher') {
      window.showToast(`📬 ${data.student_name} submitted!`);
      const activeBtn = document.querySelector('.sidebar-btn.active');
      if (activeBtn) {
        const page = activeBtn.dataset.page;
        if (page === 'overview') window.TeacherViews.renderOverview();
        else if (page === 'progress') window.TeacherViews.renderLiveProgress();
        else if (page === 'submissions') window.TeacherViews.renderSubmissions();
      }
    }
  };

  window.__handleStudentJoined = function(data) {
    if (window.__currentRole === 'teacher') {
      window.showToast(`👋 ${data.student_name} joined`);
      const activeBtn = document.querySelector('.sidebar-btn.active');
      if (activeBtn && activeBtn.dataset.page === 'overview') window.TeacherViews.renderOverview();
    }
  };

  window.__handleStudentLeft = function(data) {
    const key = `${data.student_name}_${data.assignment_id}`;
    delete window.__studentWorks[key];
    if (window.__currentRole === 'teacher') {
      window.showToast(`🚪 ${data.student_name} left`);
      const activeBtn = document.querySelector('.sidebar-btn.active');
      if (activeBtn) {
        const page = activeBtn.dataset.page;
        if (page === 'overview') window.TeacherViews.renderOverview();
        else if (page === 'progress') window.TeacherViews.renderLiveProgress();
      }
    }
  };

  // ----- NAVIGATION -----
  function navigateToPage(page) {
    window.__currentPage = page;
    window.__saveCurrentPage();

    if (window.__currentRole === 'teacher') {
      if (page === 'overview') window.TeacherViews.renderOverview();
      else if (page === 'create') window.TeacherViews.renderCreate();
      else if (page === 'assignments') window.TeacherViews.renderAssignments();
      else if (page === 'progress') window.TeacherViews.renderLiveProgress();
      else if (page === 'submissions') window.TeacherViews.renderSubmissions();
    } else {
      if (page === 'studentAssignments') window.StudentViews.renderAssignments();
      else if (page === 'myWork') window.StudentViews.renderMyWork();
    }
    setActiveSidebarBtn(page);
  }

  function setActiveSidebarBtn(page) {
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });
  }

  function renderApp(restorePage) {
    const sidebar = document.getElementById('sidebarNav');
    if (window.__currentRole === 'teacher') {
      sidebar.innerHTML = `
        <div><div class="sidebar-section-label">DASHBOARD</div>
        <button class="sidebar-btn" data-page="overview">🏠 Overview</button>
        <button class="sidebar-btn" data-page="create">✏️ New</button>
        <button class="sidebar-btn" data-page="assignments">📚 Assignments</button>
        <button class="sidebar-btn" data-page="progress"><span class="live-dot"></span>Live Progress</button>
        <button class="sidebar-btn" data-page="submissions">✅ Submissions</button></div>`;
      if (restorePage && restorePage.page) navigateToPage(restorePage.page);
      else { window.TeacherViews.renderOverview(); window.__currentPage = 'overview'; setActiveSidebarBtn('overview'); }
    } else {
      sidebar.innerHTML = `
        <div><div class="sidebar-section-label">CLASSROOM</div>
        <button class="sidebar-btn" data-page="studentAssignments">📚 Assignments</button>
        <button class="sidebar-btn" data-page="myWork">📝 My Work</button></div>`;
      if (restorePage && restorePage.page) navigateToPage(restorePage.page);
      else { window.StudentViews.renderAssignments(); window.__currentPage = 'studentAssignments'; setActiveSidebarBtn('studentAssignments'); }
    }

    document.querySelectorAll('.sidebar-btn').forEach(btn => {
      btn.addEventListener('click', () => navigateToPage(btn.dataset.page));
    });
  }

  // ----- ENTER AS -----
  async function enterAs(role, isRestore = false) {
    if (role === 'teacher') window.__currentRole = 'teacher';
    else window.__currentRole = 'student';

    await window.loadAllData();

    document.getElementById('entryScreen').style.display = 'none';
    document.getElementById('appShell').style.display = 'block';

    if (role === 'teacher') {
      document.getElementById('userBadge').innerHTML = '👩‍🏫 Teacher · Maria';
    } else {
      document.getElementById('userBadge').innerHTML = `✍️ ${window.escapeHtml(window.__currentStudent)}`;
    }

    if (!isRestore) saveSession();

    const savedPage = loadSavedPage();
    if (savedPage && savedPage.role === role) {
      renderApp(savedPage);
      if (savedPage.assignmentId && role === 'student') {
        window.__currentAssignmentId = savedPage.assignmentId;
        if ((window.__assignments || []).find(a => a.id === savedPage.assignmentId)) {
          window.StudentViews.openAssignment(savedPage.assignmentId);
        }
      }
    } else {
      renderApp();
    }
  }

  // ----- RESTORE SESSION -----
  async function restoreSession() {
    const session = loadSession();
    if (!session) return false;
    if (session.role === 'teacher') {
      await enterAs('teacher', true);
    } else if (session.role === 'student') {
      window.__currentStudent = session.name;
      window.__currentStudentPin = session.pin;
      await enterAs('student', true);
    }
    return true;
  }

  // ----- STUDENT INACTIVE -----
  function emitLeaveAssignment() {
    if (window.__currentRole === 'student' && window.__currentStudent && window.__currentAssignmentId) {
      if (window.__emitLeave) {
        window.__emitLeave(window.__currentStudent, window.__currentAssignmentId);
      }
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') emitLeaveAssignment();
    else if (document.visibilityState === 'visible' && window.__currentRole === 'student' && window.__currentAssignmentId) {
      if (window.__emitJoin) window.__emitJoin(window.__currentStudent, window.__currentAssignmentId);
    }
  });
  window.addEventListener('pagehide', emitLeaveAssignment);

  // ----- DOM EVENTS -----
  document.addEventListener('DOMContentLoaded', () => {
    // Entry modals
    document.getElementById('teacherChoiceBtn').onclick = () => document.getElementById('teacherModal').classList.add('active');
    document.getElementById('studentChoiceBtn').onclick = () => document.getElementById('studentModal').classList.add('active');
    document.getElementById('closeTeacherModal').onclick = () => document.getElementById('teacherModal').classList.remove('active');
    document.getElementById('closeStudentModal').onclick = () => document.getElementById('studentModal').classList.remove('active');

    document.getElementById('confirmTeacherBtn').onclick = async () => {
      const email = document.getElementById('teacherEmail').value.trim();
      const pass = document.getElementById('teacherPassword').value;
      if (email === 'maria_gul28@yahoo.com' && pass === 'maria123') {
        document.getElementById('teacherModal').classList.remove('active');
        await enterAs('teacher');
        window.showToast('Welcome back, Teacher! 🎓');
      } else {
        document.getElementById('teacherError').style.display = 'block';
      }
    };

    document.getElementById('confirmStudentBtn').onclick = async () => {
      const name = document.getElementById('studentName').value.trim();
      const pin = document.getElementById('studentPin').value.trim();
      if (!name || !/^\d{4}$/.test(pin)) {
        document.getElementById('studentError').textContent = 'Enter name and 4-digit PIN';
        document.getElementById('studentError').style.display = 'block';
        return;
      }
      window.__currentStudent = name;
      window.__currentStudentPin = pin;
      document.getElementById('studentModal').classList.remove('active');
      await enterAs('student');
      window.showToast(`Welcome, ${name}! ✍️`);
    };

    document.getElementById('signOutBtn').onclick = () => {
      clearSession();
      window.__currentRole = null;
      window.__currentStudent = null;
      window.__currentStudentPin = null;
      window.__assignments = [];
      window.__submissions = [];
      window.__studentWorks = {};
      document.getElementById('appShell').style.display = 'none';
      document.getElementById('entryScreen').style.display = 'flex';
      window.showToast('Signed out');
    };

    // Enter key support
    document.getElementById('teacherPassword').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('confirmTeacherBtn').click();
    });
    document.getElementById('studentPin').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('confirmStudentBtn').click();
    });

    // Try restoring session
    restoreSession();
  });
})();