// static/js/student-views.js — all student render functions
window.StudentViews = {
  renderAssignments() {
    const content = document.getElementById('mainContent');
    const assignments = window.__assignments || [];
    const student = window.__currentStudent;
    const submissions = window.__submissions || [];

    if (assignments.length === 0) {
      content.innerHTML = `<div class="page active"><div class="card"><div class="empty-state"><span class="empty-state-icon">📭</span>No assignments yet.<br><span style="font-size:0.85rem">Ask your teacher to publish one.</span></div></div></div>`;
      return;
    }

    content.innerHTML = `
      <div class="page active">
        <div class="page-title">📖 Assignments</div>
        ${assignments.map(a => {
          const submitted = submissions.some(s => s.student_name === student && s.assignment_id === a.id);
          return `
            <div class="assignment-card" data-id="${a.id}">
              <div class="assignment-card-title">${window.escapeHtml(a.title)}</div>
              <div style="color:#2a4a5e;font-size:0.9rem">${window.escapeHtml((a.question||'').substring(0,90))}…</div>
              <div class="assignment-card-meta" style="margin-top:12px">
                ${submitted
                  ? '<span class="badge" style="background:#d6ebe1;color:#2a6a3a">✓ Submitted</span>'
                  : '<span class="badge">✨ Click to write</span>'}
              </div>
            </div>`;
        }).join('')}
      </div>`;
    document.querySelectorAll('.assignment-card').forEach(card => {
      card.addEventListener('click', () => window.StudentViews.openAssignment(parseInt(card.dataset.id)));
    });
  },

  openAssignment(id) {
    const assignment = (window.__assignments || []).find(a => a.id === id);
    if (!assignment) return;
    window.__currentAssignmentId = id;
    if (window.__saveCurrentPage) window.__saveCurrentPage();

    // notify server
    if (window.__emitJoin) window.__emitJoin(window.__currentStudent, id);

    const savedContent = (window.__studentWorks || {})[`${window.__currentStudent}_${id}`]?.content || '';

    const images = assignment.images || [];
    const slideshowHtml = images.length > 0 ? `
      <div class="card">
        <div class="card-title">🖼️ Resource Images <span style="font-size:0.78rem;color:#5a7a8a;font-weight:400">${images.length} image${images.length===1?'':'s'}</span></div>
        <div class="slideshow-wrap" id="slideshowWrap">
          <div class="slideshow-track" id="slideshowTrack">
            ${images.map((src,i)=>`<div class="slide"><img src="${src}" alt="Resource ${i+1}" draggable="false"></div>`).join('')}
          </div>
          ${images.length > 1 ? `
            <button class="slide-arrow prev disabled" id="slidePrev">‹</button>
            <button class="slide-arrow next" id="slideNext">›</button>
            <div class="slide-dots" id="slideDots">
              ${images.map((_,i)=>`<button class="slide-dot${i===0?' active':''}" data-idx="${i}"></button>`).join('')}
            </div>
            <div class="slide-counter" id="slideCounter">1 / ${images.length}</div>
          ` : ''}
        </div>
      </div>` : '';

    const contentDiv = document.getElementById('mainContent');
    contentDiv.innerHTML = `
      <div class="page active">
        <button class="btn btn-ghost" id="backToAssignments" style="margin-bottom:20px">← Back</button>
        <div class="card">
          <div class="card-title">${window.escapeHtml(assignment.title)}</div>
          <div style="white-space:pre-wrap;line-height:1.7;color:#1a2a3a">${window.escapeHtml(assignment.question)}</div>
        </div>
        ${assignment.criteria?.length ? `
          <div class="card">
            <div class="card-title">✅ Success Criteria</div>
            ${assignment.criteria.map(c=>`<div style="margin-bottom:8px;display:flex;align-items:flex-start;gap:8px"><span style="color:var(--classroom-blue);font-size:0.85rem;margin-top:2px">◆</span><span style="font-size:0.92rem;line-height:1.5">${window.escapeHtml(c)}</span></div>`).join('')}
          </div>` : ''}
        ${assignment.resources?.length ? `
          <div class="card">
            <div class="card-title">🔗 Resources</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${assignment.resources.map(r=>`<a href="${r.startsWith('http')?r.replace(/"/g,'&quot;'):'#'}" target="_blank" rel="noopener" class="resource-link-item">🔗 ${window.escapeHtml(r)}</a>`).join('')}
            </div>
          </div>` : ''}
        ${slideshowHtml}
        <div class="card">
          <div class="card-title">✍️ Your Writing</div>
          <textarea id="studentWritingArea" class="writing-area" rows="14" placeholder="Start writing here…">${window.escapeHtml(savedContent)}</textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">
            <div class="autosave-indicator">
              <span id="saveStatusDot" class="autosave-dot saved"></span>
              <span id="saveStatusText">All changes saved</span>
            </div>
            <button class="btn btn-success" id="submitWorkBtn">📤 Submit Assignment</button>
          </div>
        </div>
      </div>`;

    // Slideshow logic
    if (images.length > 1) {
      let currentSlide = 0;
      const track = document.getElementById('slideshowTrack');
      const prevBtn = document.getElementById('slidePrev');
      const nextBtn = document.getElementById('slideNext');
      const counter = document.getElementById('slideCounter');
      const dots = document.querySelectorAll('#slideDots .slide-dot');

      function goToSlide(idx) {
        currentSlide = idx;
        track.style.transform = `translateX(-${currentSlide * 100}%)`;
        if (counter) counter.textContent = `${currentSlide + 1} / ${images.length}`;
        dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
        if (prevBtn) prevBtn.classList.toggle('disabled', currentSlide === 0);
        if (nextBtn) nextBtn.classList.toggle('disabled', currentSlide === images.length - 1);
      }

      if (prevBtn) prevBtn.addEventListener('click', () => { if (currentSlide > 0) goToSlide(currentSlide - 1); });
      if (nextBtn) nextBtn.addEventListener('click', () => { if (currentSlide < images.length - 1) goToSlide(currentSlide + 1); });
      dots.forEach(dot => dot.addEventListener('click', () => goToSlide(+dot.dataset.idx)));

      const wrap = document.getElementById('slideshowWrap');
      let touchStartX = 0;
      wrap.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
      wrap.addEventListener('touchend', e => {
        const diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) { diff > 0 ? nextBtn?.click() : prevBtn?.click(); }
      });
    }

    const textarea = document.getElementById('studentWritingArea');
    let autoSaveTimer = null;

    const emitProgress = () => {
      if (window.__emitProgress) {
        window.__emitProgress(window.__currentStudent, id, textarea.value);
      }
    };

    textarea.addEventListener('input', () => {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      document.getElementById('saveStatusDot').className = 'autosave-dot saving';
      document.getElementById('saveStatusText').innerText = 'Saving…';
      autoSaveTimer = setTimeout(() => {
        emitProgress();
        document.getElementById('saveStatusDot').className = 'autosave-dot saved';
        document.getElementById('saveStatusText').innerText = 'All changes saved';
      }, 700);
    });

    document.getElementById('submitWorkBtn').onclick = async () => {
      const finalContent = textarea.value.trim();
      if (!finalContent) { window.showToast('Please write something before submitting'); return; }

      const btn = document.getElementById('submitWorkBtn');
      btn.innerHTML = '<span class="spinner"></span> Submitting…';
      btn.disabled = true;

      const result = await window.apiFetch('/api/submit', {
        method: 'POST',
        body: JSON.stringify({ student_name: window.__currentStudent, assignment_id: id, content: finalContent })
      });

      if (result?.success) {
        const subs = window.__submissions || [];
        const existing = subs.findIndex(s => s.student_name === window.__currentStudent && s.assignment_id === id);
        const sub = { student_name: window.__currentStudent, assignment_id: id, content: finalContent, submitted_at: new Date().toISOString() };
        if (existing !== -1) subs[existing] = sub;
        else subs.push(sub);
        window.__submissions = subs;
        window.showToast('✨ Assignment submitted!');
        window.StudentViews.renderAssignments();
      } else {
        btn.innerHTML = '📤 Submit Assignment';
        btn.disabled = false;
      }
    };

    document.getElementById('backToAssignments').onclick = () => window.StudentViews.renderAssignments();
  },

  renderMyWork() {
    const content = document.getElementById('mainContent');
    const mySubs = (window.__submissions || []).filter(s => s.student_name === window.__currentStudent);
    if (mySubs.length === 0) {
      content.innerHTML = `<div class="page active"><div class="page-title">📋 My Work</div><div class="card"><div class="empty-state"><span class="empty-state-icon">📭</span>You haven't submitted any assignments yet.</div></div></div>`;
      return;
    }
    content.innerHTML = `
      <div class="page active">
        <div class="page-title">📋 My Work</div>
        ${mySubs.map(s => {
          const assignTitle = (window.__assignments || []).find(a=>a.id===s.assignment_id)?.title || `Assignment #${s.assignment_id}`;
          return `
            <div class="work-item">
              <strong>${window.escapeHtml(assignTitle)}</strong>
              <div style="white-space:pre-wrap;font-family:'Gochi Hand',cursive;font-size:0.95rem;margin-top:10px;line-height:1.7">${window.escapeHtml((s.content||'').substring(0,300))}…</div>
              <div class="autosave-indicator" style="margin-top:8px">✓ Submitted: ${new Date(s.submitted_at).toLocaleString()}</div>
            </div>`;
        }).join('')}
      </div>`;
  }
};