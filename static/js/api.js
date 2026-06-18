// static/js/api.js — apiFetch, loadAllData, toast
const API = {
  async fetch(url, options = {}) {
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[API Error]', url, err);
      API.toast('⚠️ Server error — is Flask running?');
      return null;
    }
  },

  toast(msg, duration = 2800) {
    const el = document.getElementById('toast') || (() => {
      const t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
      return t;
    })();
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._hide);
    el._hide = setTimeout(() => el.classList.remove('show'), duration);
  },

  async loadAllData() {
    const [a, s, w] = await Promise.all([
      API.fetch('/api/assignments'),
      API.fetch('/api/submissions'),
      API.fetch('/api/student-work')
    ]);
    if (a) window.__assignments = a;
    if (s) window.__submissions = s;
    if (w) window.__studentWorks = w;
    return { assignments: window.__assignments, submissions: window.__submissions, studentWorks: window.__studentWorks };
  }
};

// Expose globally
window.apiFetch = API.fetch.bind(API);
window.loadAllData = API.loadAllData.bind(API);
window.showToast = API.toast.bind(API);