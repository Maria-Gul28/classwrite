// ============================================================
//  API HELPERS — all data goes through Flask, not localStorage
// ============================================================
async function apiFetch(url, options = {}) {
    try {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('[API Error]', url, err);
        showToast('⚠️ Server error — check Flask is running');
        return null;
    }
}

// Load all classroom data from server
async function loadAllData() {
    const [a, s, w] = await Promise.all([
        apiFetch('/api/assignments'),
        apiFetch('/api/submissions'),
        apiFetch('/api/student-work')
    ]);
    if (a) assignments = a;
    if (s) submissions = s;
    if (w) studentWorks = w;
}

// ============================================================
//  TOAST
// ============================================================
function showToast(msg, duration = 2800) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}