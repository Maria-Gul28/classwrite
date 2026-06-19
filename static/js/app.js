// ============================================================
//  STATE
// ============================================================
let currentRole         = null;
let currentStudent      = null;
let currentStudentPin   = null;
let currentAssignmentId = null;
let autoSaveTimer       = null;
let currentPage         = null;

// In-memory data (loaded fresh from server on each login)
let assignments  = [];
let submissions  = [];
let studentWorks = {};

// ============================================================
//  PERSISTENCE
// ============================================================
function saveSession() {
    if (currentRole === 'teacher') {
        localStorage.setItem('classwrite_session', JSON.stringify({ role: 'teacher', email: 'maria_gul28@yahoo.com' }));
    } else if (currentRole === 'student') {
        localStorage.setItem('classwrite_session', JSON.stringify({ role: 'student', name: currentStudent, pin: currentStudentPin }));
    }
}

function saveCurrentPage() {
    if (currentRole && currentPage) {
        localStorage.setItem('classwrite_current_page', JSON.stringify({ role: currentRole, page: currentPage, assignmentId: currentAssignmentId }));
    }
}

function loadSession() {
    const saved = localStorage.getItem('classwrite_session');
    if (saved) {
        try {
            const session = JSON.parse(saved);
            if (session.role === 'teacher') return { role: 'teacher', email: session.email };
            if (session.role === 'student') return { role: 'student', name: session.name, pin: session.pin };
        } catch (e) { console.error('Failed to parse session', e); }
    }
    return null;
}

function loadSavedPage() {
    const saved = localStorage.getItem('classwrite_current_page');
    if (saved) {
        try { return JSON.parse(saved); }
        catch (e) { console.error('Failed to parse saved page', e); }
    }
    return null;
}

function clearSession() {
    localStorage.removeItem('classwrite_session');
    localStorage.removeItem('classwrite_current_page');
}

// ============================================================
//  UTILITY
// ============================================================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

// ============================================================
//  APP SHELL & ROUTING
// ============================================================
function renderApp(restorePage = null) {
    const sidebar = document.getElementById('sidebarNav');

    if (currentRole === 'teacher') {
        sidebar.innerHTML = `
            <div>
                <div class="sidebar-section-label">Dashboard</div>
                <button class="sidebar-btn" data-page="overview">🏠 Overview</button>
                <button class="sidebar-btn" data-page="create">✏️ New Assignment</button>
                <button class="sidebar-btn" data-page="assignments">📚 Assignments</button>
                <button class="sidebar-btn" data-page="progress"><span class="live-dot"></span>Live Progress</button>
                <button class="sidebar-btn" data-page="submissions">✅ Submissions</button>
            </div>
            <img src="/static/assets/books1.png" class="sidebar-deco" alt="">
        `;
        if (restorePage?.page) {
            navigateToPage(restorePage.page);
        } else {
            renderTeacherOverview();
            currentPage = 'overview';
            setActiveSidebarBtn('overview');
        }
    } else {
        sidebar.innerHTML = `
            <div>
                <div class="sidebar-section-label">Classroom</div>
                <button class="sidebar-btn" data-page="studentAssignments">📚 Assignments</button>
                <button class="sidebar-btn" data-page="myWork">📝 My Work</button>
            </div>
            <img src="/static/assets/books2.png" class="sidebar-deco" alt="">
        `;
        if (restorePage?.page) {
            navigateToPage(restorePage.page);
        } else {
            renderStudentAssignments();
            currentPage = 'studentAssignments';
            setActiveSidebarBtn('studentAssignments');
        }
    }

    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.addEventListener('click', () => navigateToPage(btn.dataset.page));
    });
}

function navigateToPage(page) {
    currentPage = page;
    saveCurrentPage();

    if (currentRole === 'teacher') {
        if (page === 'overview')     renderTeacherOverview();
        else if (page === 'create')       renderCreateAssignment();
        else if (page === 'assignments')  renderTeacherAssignments();
        else if (page === 'progress')     renderLiveProgress();
        else if (page === 'submissions')  renderSubmissions();
    } else {
        if (page === 'studentAssignments') renderStudentAssignments();
        else if (page === 'myWork')        renderMyWork();
    }

    setActiveSidebarBtn(page);
}

function setActiveSidebarBtn(page) {
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });
}

// ============================================================
//  ROLE FLOW WITH PERSISTENCE
// ============================================================
async function restoreSession() {
    const session = loadSession();
    if (!session) return false;

    if (session.role === 'teacher') {
        currentRole = 'teacher';
        await enterAs('teacher', true);
    } else if (session.role === 'student') {
        currentStudent    = session.name;
        currentStudentPin = session.pin;
        currentRole       = 'student';
        await enterAs('student', true);
    }
    return true;
}

async function enterAs(role, isRestore = false) {
    showBanner('⏳ Loading classroom data…', false);
    currentRole = role;

    await loadAllData();
    hideBanner();

    document.getElementById('entryScreen').style.display = 'none';
    document.getElementById('appShell').style.display    = 'block';

    if (role === 'teacher') {
        document.getElementById('userBadge').innerHTML = '👩‍🏫 Teacher · Maria';
    } else {
        document.getElementById('userBadge').innerHTML = `✍️ ${escapeHtml(currentStudent)}`;
    }

    if (!isRestore) saveSession();

    const savedPage = loadSavedPage();
    if (savedPage && savedPage.role === role) {
        renderApp(savedPage);
        if (savedPage.assignmentId && role === 'student') {
            currentAssignmentId = savedPage.assignmentId;
            if (assignments.find(a => a.id === savedPage.assignmentId)) {
                openAssignment(savedPage.assignmentId);
            }
        }
    } else {
        renderApp();
    }
}

// ============================================================
//  EVENT LISTENERS
// ============================================================
document.getElementById('teacherChoiceBtn').onclick = () => document.getElementById('teacherModal').classList.add('active');
document.getElementById('studentChoiceBtn').onclick = () => document.getElementById('studentModal').classList.add('active');
document.getElementById('closeTeacherModal').onclick = () => document.getElementById('teacherModal').classList.remove('active');
document.getElementById('closeStudentModal').onclick = () => document.getElementById('studentModal').classList.remove('active');

document.getElementById('confirmTeacherBtn').onclick = async () => {
    const email = document.getElementById('teacherEmail').value.trim();
    const pass  = document.getElementById('teacherPassword').value;
    if (email === 'maria_gul28@yahoo.com' && pass === 'maria123') {
        document.getElementById('teacherModal').classList.remove('active');
        await enterAs('teacher');
        showToast('Welcome back, Teacher! 🎓');
    } else {
        document.getElementById('teacherError').style.display = 'block';
    }
};

document.getElementById('teacherPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('confirmTeacherBtn').click();
});

document.getElementById('confirmStudentBtn').onclick = async () => {
    const name = document.getElementById('studentName').value.trim();
    const pin  = document.getElementById('studentPin').value.trim();
    if (!name || !/^\d{4}$/.test(pin)) {
        document.getElementById('studentError').textContent = 'Enter your name and a valid 4-digit PIN';
        document.getElementById('studentError').style.display = 'block';
        return;
    }
    currentStudent    = name;
    currentStudentPin = pin;
    document.getElementById('studentModal').classList.remove('active');
    await enterAs('student');
    showToast(`Welcome, ${name}! ✍️`);
};

document.getElementById('studentPin').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('confirmStudentBtn').click();
});

document.getElementById('signOutBtn').onclick = () => {
    clearSession();
    currentRole = null; currentStudent = null; currentStudentPin = null;
    assignments = []; submissions = []; studentWorks = {};
    document.getElementById('appShell').style.display    = 'none';
    document.getElementById('entryScreen').style.display = 'flex';
    showToast('Signed out');
};

// Try to restore session on page load
restoreSession();