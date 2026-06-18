// static/js/teacher-views.js — all teacher render functions
window.TeacherViews = {
  renderOverview() {
    const content = document.getElementById('mainContent');
    const assignments = window.__assignments || [];
    const submissions = window.__submissions || [];
    const studentWorks = window.__studentWorks || {};
    const activeWriters = Object.keys(studentWorks).length;
    const recentSubs = [...submissions].reverse().slice(0, 5);

    content.innerHTML = `
      <div class="page active">
        <div class="page-title">Good day, Teacher ✨</div>
        <div class="page-subtitle">Your classroom, live</div>
        <div class="stats-row">
          <div class="stat-card"><div class="stat-number">${assignments.length}</div><div class="stat-label">Assignments</div></div>
          <div class="stat-card"><div class="stat-number">${activeWriters}</div><div class="stat-label"><span class="live-dot"></span>Active Writers</div></div>
          <div class="stat-card"><div class="stat-number">${submissions.length}</div><div class="stat-label">Submissions</div></div>
        </div>
        <div class="card">
          <div class="card-title">📬 Recent Submissions</div>
          <div id="recentSubmissionsList">
            ${recentSubs.length === 0
              ? '<div class="empty-state"><span class="empty-state-icon">📭</span>No submissions yet</div>'
              : recentSubs.map(s => `
                <div class="work-item">
                  <strong>${window.escapeHtml(s.student_name)}</strong> — Assignment #${s.assignment_id}
                  <div style="font-size:0.78rem;margin-top:6px;color:#2a4a5e">${window.escapeHtml((s.content||'').substring(0,120))}…</div>
                  <div style="font-size:0.72rem;color:#5a7a8a;margin-top:6px">${new Date(s.submitted_at).toLocaleString()}</div>
                </div>`).join('')}
          </div>
        </div>
      </div>`;
  },

  renderCreate() {
    const content = document.getElementById('mainContent');
    content.innerHTML = `
      <div class="page active">
        <div class="page-title">✨ New Assignment</div>
        <div class="card">
          <div class="card-title">Details</div>
          <div class="form-group"><label class="form-label">Title</label><input class="form-input" id="newTitle" placeholder="e.g., Descriptive writing..."></div>
          <div class="form-group"><label class="form-label">Prompt / Question</label><textarea class="form-textarea" id="newQuestion" rows="4" placeholder="What should students write about?"></textarea></div>
          <div class="form-group">
            <label class="form-label">Resources (links or notes)</label>
            <div id="resList" class="tag-list"></div>
            <div style="display:flex;gap:8px"><input class="form-input" id="resInput" placeholder="https://…"><button class="btn btn-ghost" id="addResBtn">+ Add</button></div>
          </div>
          <div class="form-group">
            <label class="form-label">Resource Images</label>
            <div class="image-upload-area" id="imageDropZone">
              <div style="font-size:2rem;margin-bottom:8px">🖼️</div>
              <div style="font-weight:600;font-size:0.9rem;color:#1a2a3a">Drop images here or click to upload</div>
              <div style="font-size:0.75rem;color:#5a7a8a;margin-top:4px">PNG, JPG, GIF, WebP — up to 10 images</div>
              <input type="file" id="imageFileInput" accept="image/*" multiple style="display:none">
            </div>
            <div class="image-thumb-grid" id="imageThumbGrid"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Success Criteria</label>
            <div id="critList" class="tag-list"></div>
            <div style="display:flex;gap:8px"><input class="form-input" id="critInput" placeholder="e.g. Clear thesis, vocabulary…"><button class="btn btn-ghost" id="addCritBtn">+ Add</button></div>
          </div>
          <div class="form-group"><label class="form-label">Mindmap / Notes</label><textarea class="form-textarea" id="newMindmap" rows="3" placeholder="Optional notes for students…"></textarea></div>
          <button class="btn btn-primary" id="publishAssignmentBtn">📢 Publish Assignment</button>
        </div>
      </div>`;

    let resourcesArr = [], criteriaArr = [], imagesArr = [];

    const updateResUI = () => { document.getElementById('resList').innerHTML = resourcesArr.map((r,i)=>`<span class="tag">📌 ${window.escapeHtml(r)} <button class="tag-remove" data-i="${i}" data-t="res">✕</button></span>`).join(''); };
    const updateCritUI = () => { document.getElementById('critList').innerHTML = criteriaArr.map((c,i)=>`<span class="tag">◆ ${window.escapeHtml(c)} <button class="tag-remove" data-i="${i}" data-t="crit">✕</button></span>`).join(''); };
    const renderThumbs = () => {
      const grid = document.getElementById('imageThumbGrid');
      if (!grid) return;
      grid.innerHTML = imagesArr.map((src,i)=>`<div class="image-thumb"><img src="${src}" alt="img ${i+1}"><button class="image-thumb-remove" data-i="${i}">✕</button></div>`).join('');
      grid.querySelectorAll('.image-thumb-remove').forEach(btn => btn.addEventListener('click', ()=>{ imagesArr.splice(+btn.dataset.i,1); renderThumbs(); }));
    };

    document.getElementById('addResBtn').onclick = () => { const v=document.getElementById('resInput').value.trim(); if(v){resourcesArr.push(v);updateResUI();document.getElementById('resInput').value='';} };
    document.getElementById('addCritBtn').onclick = () => { const v=document.getElementById('critInput').value.trim(); if(v){criteriaArr.push(v);updateCritUI();document.getElementById('critInput').value='';} };

    document.getElementById('resList').addEventListener('click', e => { if(e.target.classList.contains('tag-remove')&&e.target.dataset.t==='res'){resourcesArr.splice(+e.target.dataset.i,1);updateResUI();} });
    document.getElementById('critList').addEventListener('click', e => { if(e.target.classList.contains('tag-remove')&&e.target.dataset.t==='crit'){criteriaArr.splice(+e.target.dataset.i,1);updateCritUI();} });

    const compressImage = (file,maxW,maxH,q) => new Promise(res => {
      const r=new FileReader();
      r.onload=e=>{const img=new Image(); img.onload=()=>{let{width,height}=img; if(width>maxW||height>maxH){const ratio=Math.min(maxW/width,maxH/height); width=Math.round(width*ratio); height=Math.round(height*ratio);} const c=document.createElement('canvas'); c.width=width; c.height=height; c.getContext('2d').drawImage(img,0,0,width,height); res(c.toDataURL('image/jpeg',q));}; img.src=e.target.result;};
      r.readAsDataURL(file);
    });

    const processImages = (files) => {
      const remaining = 10 - imagesArr.length;
      Array.from(files).slice(0, remaining).forEach(f => {
        if (!f.type.startsWith('image/')) return;
        compressImage(f, 1200, 1200, 0.75).then(c => { imagesArr.push(c); renderThumbs(); });
      });
    };

    const dropZone = document.getElementById('imageDropZone');
    const fileInput = document.getElementById('imageFileInput');
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => processImages(e.target.files));
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); processImages(e.dataTransfer.files); });

    document.getElementById('publishAssignmentBtn').onclick = async () => {
      const title = document.getElementById('newTitle').value.trim();
      const question = document.getElementById('newQuestion').value.trim();
      const mindmap = document.getElementById('newMindmap').value.trim();
      if (!title || !question) { window.showToast('Title and prompt are required'); return; }

      const btn = document.getElementById('publishAssignmentBtn');
      btn.innerHTML = '<span class="spinner"></span> Publishing…';
      btn.disabled = true;

      const result = await window.apiFetch('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({ title, question, resources: resourcesArr, criteria: criteriaArr, mindmap, images: imagesArr })
      });

      if (result) {
        (window.__assignments || []).push(result);
        window.showToast(`✅ "${title}" published!`);
        window.TeacherViews.renderAssignments();
      } else {
        btn.innerHTML = '📢 Publish Assignment';
        btn.disabled = false;
      }
    };
  },

  renderAssignments() {
    const content = document.getElementById('mainContent');
    const assignments = window.__assignments || [];
    if (assignments.length === 0) {
      content.innerHTML = `<div class="page active"><div class="card"><div class="empty-state"><span class="empty-state-icon">📭</span>No assignments yet.<br><button class="btn btn-ghost" id="goCreateBtn" style="margin-top:16px">Create one</button></div></div></div>`;
      document.getElementById('goCreateBtn')?.addEventListener('click', () => window.TeacherViews.renderCreate());
      return;
    }

    content.innerHTML = `
      <div class="page active">
        <div class="page-title">📚 Assignments</div>
        <div class="page-subtitle">${assignments.length} assignment${assignments.length===1?'':'s'} published</div>
        ${assignments.map(a => `
          <div class="assignment-card" style="cursor:default">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
              <div style="flex:1;min-width:0">
                <div class="assignment-card-title">${window.escapeHtml(a.title)}</div>
                <div style="color:#2a4a5e;font-size:0.9rem;margin-top:4px">${window.escapeHtml((a.question||'').substring(0,110))}${(a.question||'').length>110?'…':''}</div>
              </div>
              <div class="assign-action-row" style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="btn-outline preview-assign" data-id="${a.id}">👁 Preview</button>
                <button class="btn-outline edit-assign" data-id="${a.id}">✏️ Edit</button>
                <button class="btn-outline danger delete-assign" data-id="${a.id}">🗑</button>
              </div>
            </div>
            <div class="assignment-card-meta" style="margin-top:14px">
              <span class="tag">📎 ${a.resources?.length||0} resources</span>
              <span class="tag">📋 ${a.criteria?.length||0} criteria</span>
              <span class="tag">📬 ${(window.__submissions||[]).filter(s=>s.assignment_id===a.id).length} submitted</span>
            </div>
          </div>`).join('')}
      </div>`;

    document.querySelectorAll('.delete-assign').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        if (!confirm('Delete this assignment?')) return;
        const result = await window.apiFetch(`/api/assignments/${id}`, { method: 'DELETE' });
        if (result?.success) {
          window.__assignments = (window.__assignments || []).filter(a => a.id !== id);
          window.TeacherViews.renderAssignments();
          window.showToast('Assignment deleted');
        }
      });
    });

    document.querySelectorAll('.edit-assign').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.TeacherViews.renderEdit(parseInt(btn.dataset.id));
      });
    });

    document.querySelectorAll('.preview-assign').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.TeacherViews.preview(parseInt(btn.dataset.id));
      });
    });
  },

  renderEdit(id) {
    const a = (window.__assignments || []).find(x => x.id === id);
    if (!a) return;
    const content = document.getElementById('mainContent');
    let resourcesArr = [...(a.resources||[])];
    let criteriaArr = [...(a.criteria||[])];
    let imagesArr = [...(a.images||[])];

    content.innerHTML = `
      <div class="page active">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <button class="btn-outline" id="backToAssigns">← Back</button>
          <div class="page-title" style="margin-bottom:0">✏️ Edit Assignment</div>
        </div>
        <div class="card">
          <div class="form-group"><label class="form-label">Title</label><input class="form-input" id="editTitle" value="${window.escapeHtml(a.title)}"></div>
          <div class="form-group"><label class="form-label">Prompt</label><textarea class="form-textarea" id="editQuestion" rows="4">${window.escapeHtml(a.question||'')}</textarea></div>
          <div class="form-group">
            <label class="form-label">Resources</label>
            <div id="editResList" class="tag-list"></div>
            <div style="display:flex;gap:8px"><input class="form-input" id="editResInput" placeholder="https://…"><button class="btn btn-ghost" id="editAddResBtn">+ Add</button></div>
          </div>
          <div class="form-group">
            <label class="form-label">Images</label>
            <div class="image-upload-area" id="editImageDropZone">
              <div style="font-size:2rem;margin-bottom:8px">🖼️</div>
              <div style="font-weight:600;font-size:0.9rem;color:#1a2a3a">Drop images here or click</div>
              <input type="file" id="editImageFileInput" accept="image/*" multiple style="display:none">
            </div>
            <div class="image-thumb-grid" id="editImageThumbGrid"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Success Criteria</label>
            <div id="editCritList" class="tag-list"></div>
            <div style="display:flex;gap:8px"><input class="form-input" id="editCritInput" placeholder="e.g. Clear thesis…"><button class="btn btn-ghost" id="editAddCritBtn">+ Add</button></div>
          </div>
          <div class="form-group"><label class="form-label">Mindmap</label><textarea class="form-textarea" id="editMindmap" rows="3">${window.escapeHtml(a.mindmap||'')}</textarea></div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button class="btn btn-primary" id="saveEditBtn">💾 Save Changes</button>
            <button class="btn btn-ghost" id="cancelEditBtn">Cancel</button>
          </div>
        </div>
      </div>`;

    const updateResUI = () => { document.getElementById('editResList').innerHTML = resourcesArr.map((r,i)=>`<span class="tag">📌 ${window.escapeHtml(r)} <button class="tag-remove" data-i="${i}" data-t="res">✕</button></span>`).join(''); };
    const updateCritUI = () => { document.getElementById('editCritList').innerHTML = criteriaArr.map((c,i)=>`<span class="tag">◆ ${window.escapeHtml(c)} <button class="tag-remove" data-i="${i}" data-t="crit">✕</button></span>`).join(''); };
    const renderThumbs = () => {
      const grid = document.getElementById('editImageThumbGrid');
      if (!grid) return;
      grid.innerHTML = imagesArr.map((src,i)=>`<div class="image-thumb"><img src="${src}" alt="img ${i+1}"><button class="image-thumb-remove" data-i="${i}">✕</button></div>`).join('');
      grid.querySelectorAll('.image-thumb-remove').forEach(btn => btn.addEventListener('click', ()=>{ imagesArr.splice(+btn.dataset.i,1); renderThumbs(); }));
    };

    updateResUI(); updateCritUI(); renderThumbs();

    document.getElementById('editAddResBtn').onclick = () => { const v=document.getElementById('editResInput').value.trim(); if(v){resourcesArr.push(v);updateResUI();document.getElementById('editResInput').value='';} };
    document.getElementById('editAddCritBtn').onclick = () => { const v=document.getElementById('editCritInput').value.trim(); if(v){criteriaArr.push(v);updateCritUI();document.getElementById('editCritInput').value='';} };

    document.getElementById('editResList').addEventListener('click', e => { if(e.target.classList.contains('tag-remove')&&e.target.dataset.t==='res'){resourcesArr.splice(+e.target.dataset.i,1);updateResUI();} });
    document.getElementById('editCritList').addEventListener('click', e => { if(e.target.classList.contains('tag-remove')&&e.target.dataset.t==='crit'){criteriaArr.splice(+e.target.dataset.i,1);updateCritUI();} });

    const compressImage = (file,maxW,maxH,q) => new Promise(res => {
      const r=new FileReader();
      r.onload=e=>{const img=new Image(); img.onload=()=>{let{width,height}=img; if(width>maxW||height>maxH){const ratio=Math.min(maxW/width,maxH/height); width=Math.round(width*ratio); height=Math.round(height*ratio);} const c=document.createElement('canvas'); c.width=width; c.height=height; c.getContext('2d').drawImage(img,0,0,width,height); res(c.toDataURL('image/jpeg',q));}; img.src=e.target.result;};
      r.readAsDataURL(file);
    });

    const processImages = (files) => {
      const remaining = 10 - imagesArr.length;
      Array.from(files).slice(0, remaining).forEach(f => {
        if (!f.type.startsWith('image/')) return;
        compressImage(f, 1200, 1200, 0.75).then(c => { imagesArr.push(c); renderThumbs(); });
      });
    };

    const dropZone = document.getElementById('editImageDropZone');
    const fileInput = document.getElementById('editImageFileInput');
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => processImages(e.target.files));
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); processImages(e.dataTransfer.files); });

    document.getElementById('backToAssigns').onclick = () => window.TeacherViews.renderAssignments();
    document.getElementById('cancelEditBtn').onclick = () => window.TeacherViews.renderAssignments();

    document.getElementById('saveEditBtn').onclick = async () => {
      const title = document.getElementById('editTitle').value.trim();
      const question = document.getElementById('editQuestion').value.trim();
      const mindmap = document.getElementById('editMindmap').value.trim();
      if (!title || !question) { window.showToast('Title and prompt are required'); return; }

      const btn = document.getElementById('saveEditBtn');
      btn.innerHTML = '<span class="spinner"></span> Saving…';
      btn.disabled = true;

      const result = await window.apiFetch(`/api/assignments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, question, resources: resourcesArr, criteria: criteriaArr, mindmap, images: imagesArr })
      });

      if (result) {
        const idx = (window.__assignments || []).findIndex(x => x.id === id);
        if (idx !== -1) window.__assignments[idx] = result;
        window.showToast('✅ Assignment updated!');
        window.TeacherViews.renderAssignments();
      } else {
        btn.innerHTML = '💾 Save Changes';
        btn.disabled = false;
      }
    };
  },

  preview(id) {
    const a = (window.__assignments || []).find(x => x.id === id);
    if (!a) return;
    const images = a.images || [];
    const slideshowHtml = images.length > 0 ? `
      <div class="card">
        <div class="card-title">🖼️ Resource Images</div>
        <div class="slideshow-wrap" id="previewSlideshow">
          <div class="slideshow-track" id="previewTrack">${images.map((src,i)=>`<div class="slide"><img src="${src}" alt="Resource ${i+1}"></div>`).join('')}</div>
          ${images.length>1?`<button class="slide-arrow prev disabled" id="previewPrev">‹</button><button class="slide-arrow next" id="previewNext">›</button><div class="slide-dots">${images.map((_,i)=>`<button class="slide-dot${i===0?' active':''}" data-si="${i}"></button>`).join('')}</div><div class="slide-counter" id="previewCounter">1 / ${images.length}</div>`:''}
        </div>
      </div>` : '';

    const content = document.getElementById('mainContent');
    content.innerHTML = `
      <div class="page active">
        <div class="preview-banner">
          <div class="preview-banner-label">👁 Preview: <strong>${window.escapeHtml(a.title)}</strong></div>
          <button class="preview-banner-close" id="exitPreviewBtn">✕ Exit</button>
        </div>
        <div style="padding:20px 0">
          <div class="card">
            <div class="card-title">${window.escapeHtml(a.title)}</div>
            <div style="white-space:pre-wrap;line-height:1.7">${window.escapeHtml(a.question)}</div>
          </div>
          ${a.resources?.length ? `<div class="card"><div class="card-title">🔗 Resources</div>${a.resources.map(r=>`<a class="resource-link-item" href="${r.startsWith('http')?r.replace(/"/g,'&quot;'):'#'}" target="_blank">🔗 ${window.escapeHtml(r)}</a>`).join('')}</div>` : ''}
          ${slideshowHtml}
          <div class="card"><div class="card-title">✍️ Student would write here</div><textarea class="writing-area" disabled placeholder="Student response…" style="min-height:120px"></textarea></div>
        </div>
      </div>`;

    document.getElementById('exitPreviewBtn').onclick = () => window.TeacherViews.renderAssignments();

    if (images.length > 1) {
      let si = 0;
      const track = document.getElementById('previewTrack');
      const prev = document.getElementById('previewPrev');
      const next = document.getElementById('previewNext');
      const counter = document.getElementById('previewCounter');
      const dots = content.querySelectorAll('.slide-dot');
      const goTo = (n) => {
        si = Math.max(0, Math.min(n, images.length-1));
        track.style.transform = `translateX(-${si*100}%)`;
        dots.forEach((d,i)=>d.classList.toggle('active',i===si));
        if(counter) counter.textContent=`${si+1} / ${images.length}`;
        if(prev) prev.classList.toggle('disabled',si===0);
        if(next) next.classList.toggle('disabled',si===images.length-1);
      };
      if(prev) prev.addEventListener('click',()=>goTo(si-1));
      if(next) next.addEventListener('click',()=>goTo(si+1));
      dots.forEach(d=>d.addEventListener('click',()=>goTo(+d.dataset.si)));
    }
  },

  renderLiveProgress() {
    const content = document.getElementById('mainContent');
    const activeList = Object.values(window.__studentWorks || {});
    if (activeList.length === 0) {
      content.innerHTML = `<div class="page active"><div class="page-title"><span class="live-dot"></span>Live Progress</div><div class="page-subtitle">Updates appear here in real time</div><div class="card"><div class="empty-state"><span class="empty-state-icon">👀</span>No active writers right now</div></div></div>`;
      return;
    }

    let activeKey = window.__activeProgressTab;
    if (!activeKey || !window.__studentWorks[activeKey]) {
      activeKey = Object.keys(window.__studentWorks)[0];
    }
    window.__activeProgressTab = activeKey;

    const w = window.__studentWorks[activeKey];
    const assignTitle = (window.__assignments || []).find(a => a.id === w.assignment_id)?.title || `Assignment #${w.assignment_id}`;
    const fullContent = (w.content || '');
    const wordCount = fullContent.trim().split(/\s+/).filter(Boolean).length;
    const charCount = fullContent.length;
    const updated = w.last_updated ? new Date(w.last_updated).toLocaleTimeString() : '';

    const tabsHtml = activeList.map(sw => {
      const key = `${sw.student_name}_${sw.assignment_id}`;
      const wc = (sw.content || '').trim().split(/\s+/).filter(Boolean).length;
      const isActive = key === activeKey;
      return `<button class="student-tab ${isActive?'active':''}" data-key="${key}"><span class="tab-dot"></span><span>${window.escapeHtml(sw.student_name)}</span><span class="tab-words">${wc}w</span></button>`;
    }).join('');

    content.innerHTML = `
      <div class="page active">
        <div class="page-title"><span class="live-dot"></span>Live Progress</div>
        <div class="page-subtitle">${activeList.length} student${activeList.length===1?'':'s'} writing</div>
        <div class="student-tabs-bar">${tabsHtml}</div>
        <div class="progress-card" id="activeStudentCard">
          <div class="progress-card-header" style="display:flex;justify-content:space-between;margin-bottom:12px">
            <div><div class="progress-student" style="font-weight:700;font-size:1.05rem">✍️ ${window.escapeHtml(w.student_name)}</div><div style="font-size:0.78rem;color:#5a7a8a">${window.escapeHtml(assignTitle)}</div></div>
            <div class="progress-time" style="font-size:0.75rem;color:#5a7a8a">Last update: ${updated}</div>
          </div>
          <div class="progress-preview" id="progressPreviewText">${window.escapeHtml(fullContent)}</div>
          <div class="progress-chars" style="font-size:0.75rem;color:#5a7a8a;margin-top:12px">${wordCount} word${wordCount===1?'':'s'} · ${charCount} characters</div>
        </div>
      </div>`;

    content.querySelectorAll('.student-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        window.__activeProgressTab = tab.dataset.key;
        window.TeacherViews.renderLiveProgress();
      });
    });
  },

  renderSubmissions() {
    const content = document.getElementById('mainContent');
    const submissions = window.__submissions || [];
    if (submissions.length === 0) {
      content.innerHTML = `<div class="page active"><div class="page-title">✅ Submissions</div><div class="card"><div class="empty-state"><span class="empty-state-icon">📭</span>No submitted work yet</div></div></div>`;
      return;
    }

    const groups = {};
    submissions.forEach(s => {
      const key = s.assignment_id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    const groupsHtml = Object.entries(groups).map(([aid, subs]) => {
      const a = (window.__assignments || []).find(x => x.id === parseInt(aid));
      const title = a ? a.title : `Assignment #${aid}`;
      const subsHtml = subs.map(s => {
        const globalIdx = submissions.indexOf(s);
        return `<div class="sub-student-row" data-sidx="${globalIdx}"><div class="sub-student-name">✍️ ${window.escapeHtml(s.student_name)}</div><div class="sub-student-time">${new Date(s.submitted_at).toLocaleString()}</div></div>`;
      }).join('');
      return `<div class="assign-group"><div class="assign-group-header"><div class="assign-group-title">📄 ${window.escapeHtml(title)}</div><div class="assign-group-meta"><span class="badge">${subs.length}</span><span class="assign-group-chevron">▶</span></div></div><div class="assign-group-body">${subsHtml}</div></div>`;
    }).join('');

    content.innerHTML = `
      <div class="page active">
        <div class="page-title">✅ Submissions</div>
        <div class="page-subtitle">${submissions.length} submission${submissions.length===1?'':'s'}</div>
        ${groupsHtml}
      </div>
      <div class="sub-overlay" id="subOverlay">
        <div class="sub-modal">
          <div class="sub-modal-header"><div><div class="sub-modal-title" id="subModalTitle"></div><div class="sub-modal-meta" id="subModalMeta"></div></div><button class="sub-modal-close" id="subModalClose">✕</button></div>
          <div class="sub-modal-body"><div class="sub-modal-content" id="subModalContent"></div><div class="sub-modal-wordcount" id="subModalWordcount"></div></div>
        </div>
      </div>`;

    content.querySelectorAll('.assign-group-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.assign-group').classList.toggle('open');
      });
    });
    content.querySelector('.assign-group')?.classList.add('open');

    content.querySelectorAll('.sub-student-row').forEach(row => {
      row.addEventListener('click', () => {
        const sub = submissions[parseInt(row.dataset.sidx)];
        if (!sub) return;
        const assign = (window.__assignments || []).find(a => a.id === sub.assignment_id);
        const wc = (sub.content||'').trim().split(/\s+/).filter(Boolean).length;
        document.getElementById('subModalTitle').textContent = sub.student_name;
        document.getElementById('subModalMeta').textContent = (assign ? assign.title : 'Assignment') + ' · ' + new Date(sub.submitted_at).toLocaleString();
        document.getElementById('subModalContent').textContent = sub.content || '(No content)';
        document.getElementById('subModalWordcount').textContent = `${wc} word${wc===1?'':'s'}`;
        document.getElementById('subOverlay').classList.add('active');
      });
    });

    document.getElementById('subModalClose').addEventListener('click', () => document.getElementById('subOverlay').classList.remove('active'));
    document.getElementById('subOverlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('subOverlay')) document.getElementById('subOverlay').classList.remove('active');
    });
  }
};