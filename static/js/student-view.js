// ============================================================
//  STUDENT VIEWS
// ============================================================

function renderStudentAssignments() {
    const content = document.getElementById('mainContent');
    if (assignments.length === 0) {
        content.innerHTML = `
            <div class="page active">
                <div class="card">
                    <div class="empty-state">
                        <span class="empty-state-icon">📭</span>
                        No assignments yet.<br>
                        <span style="font-size:0.85rem">Ask your teacher to publish one.</span>
                    </div>
                </div>
            </div>`;
        return;
    }
    content.innerHTML = `
        <div class="page active">
            <div class="page-title"><img src='/static/assets/goose_with_books.svg' class='title-icon' alt=''> Assignments</div>
            ${assignments.map(a => {
                const submitted = submissions.some(s => s.student_name === currentStudent && s.assignment_id === a.id);
                return `
                    <div class="assignment-card" data-id="${a.id}">
                        <div class="assignment-card-title">${escapeHtml(a.title)}</div>
                        <div style="color:#1e3a4a;font-size:0.9rem">${escapeHtml((a.question||'').substring(0,90))}…</div>
                        <div class="assignment-card-meta">
                            ${submitted
                                ? '<span class="badge badge-success">✓ Submitted</span>'
                                : '<span class="badge">✨ Click to write</span>'}
                        </div>
                    </div>`;
            }).join('')}
        </div>`;

    document.querySelectorAll('.assignment-card').forEach(card => {
        card.addEventListener('click', () => openAssignment(parseInt(card.dataset.id)));
    });
}

function openAssignment(id) {
    const assignment = assignments.find(a => a.id === id);
    if (!assignment) return;
    currentAssignmentId = id;
    saveCurrentPage();

    socket.emit('join_assignment', { student_name: currentStudent, assignment_id: id });

    const serverWork   = studentWorks[`${currentStudent}_${id}`];
    const savedContent = serverWork?.content || '';

    const images = assignment.images || [];
    const slideshowHtml = images.length > 0 ? `
        <div class="card">
            <div class="card-title">🖼️ Resource Images <span style="font-size:0.78rem;color:#5a7a8e;font-family:'DM Sans',sans-serif;font-weight:400">${images.length} image${images.length===1?'':'s'}</span></div>
            <div class="slideshow-wrap" id="slideshowWrap">
                <div class="slideshow-track" id="slideshowTrack">
                    ${images.map((src,i)=>`<div class="slide"><img src="${src}" alt="Resource image ${i+1}" draggable="false"></div>`).join('')}
                </div>
                ${images.length > 1 ? `
                    <button class="slide-arrow prev disabled" id="slidePrev">&#8249;</button>
                    <button class="slide-arrow next" id="slideNext">&#8250;</button>
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
                <div class="card-title">${escapeHtml(assignment.title)}</div>
                <div style="white-space:pre-wrap;line-height:1.7;color:#1e3a4a">${escapeHtml(assignment.question)}</div>
            </div>
            ${assignment.criteria?.length ? `
                <div class="card">
                    <div class="card-title">✅ Success Criteria</div>
                    ${assignment.criteria.map(c=>`<div style="margin-bottom:8px;display:flex;align-items:flex-start;gap:8px"><span style="color:#2e9dd1;font-size:0.85rem;margin-top:2px">◆</span><span style="font-size:0.92rem;line-height:1.5">${escapeHtml(c)}</span></div>`).join('')}
                </div>` : ''}
            ${assignment.resources?.length ? `
                <div class="card">
                    <div class="card-title">🔗 Resources</div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px">
                        ${assignment.resources.map(r=>`<a href="${r.startsWith('http')?r.replace(/"/g,'&quot;'):'#'}" target="_blank" rel="noopener" class="resource-link-item">🔗 ${escapeHtml(r)}</a>`).join('')}
                    </div>
                </div>` : ''}
            ${slideshowHtml}
            <div class="card">
                <div class="card-title">✍️ Your Writing</div>
                <textarea id="studentWritingArea" class="writing-area" rows="14" placeholder="Start writing here…">${escapeHtml(savedContent)}</textarea>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px">
                    <div class="autosave-indicator">
                        <span id="saveStatusDot" class="autosave-dot saved"></span>
                        <span id="saveStatusText">All changes saved</span>
                    </div>
                    <button class="btn btn-success" id="submitWorkBtn">📤 Submit Assignment</button>
                </div>
            </div>
        </div>
    `;

    // --- Slideshow logic ---
    if (images.length > 1) {
        let currentSlide = 0;
        const track   = document.getElementById('slideshowTrack');
        const prevBtn = document.getElementById('slidePrev');
        const nextBtn = document.getElementById('slideNext');
        const counter = document.getElementById('slideCounter');
        const dots    = document.querySelectorAll('#slideDots .slide-dot');

        function goToSlide(idx) {
            currentSlide = idx;
            track.style.transform = `translateX(-${currentSlide * 100}%)`;
            counter.textContent = `${currentSlide + 1} / ${images.length}`;
            dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
            prevBtn.classList.toggle('disabled', currentSlide === 0);
            nextBtn.classList.toggle('disabled', currentSlide === images.length - 1);
        }

        prevBtn.addEventListener('click', () => { if (currentSlide > 0) goToSlide(currentSlide - 1); });
        nextBtn.addEventListener('click', () => { if (currentSlide < images.length - 1) goToSlide(currentSlide + 1); });
        dots.forEach(dot => dot.addEventListener('click', () => goToSlide(+dot.dataset.idx)));

        let touchStartX = 0;
        const wrap = document.getElementById('slideshowWrap');
        wrap.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
        wrap.addEventListener('touchend', e => {
            const diff = touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 40) { diff > 0 ? nextBtn.click() : prevBtn.click(); }
        });
    }

    const textarea = document.getElementById('studentWritingArea');

    const emitProgress = () => {
        socket.emit('update_progress', {
            student_name: currentStudent,
            assignment_id: id,
            content: textarea.value
        });
    };

    textarea.addEventListener('input', () => {
        if (autoSaveTimer) clearTimeout(autoSaveTimer);
        document.getElementById('saveStatusDot').className = 'autosave-dot saving';
        document.getElementById('saveStatusText').innerText = 'Saving…';
        autoSaveTimer = setTimeout(() => {
            emitProgress();
            document.getElementById('saveStatusDot').className = 'autosave-dot saved';
            document.getElementById('saveStatusText').innerText = 'All changes saved';
        }, 800);
    });

    document.getElementById('submitWorkBtn').onclick = async () => {
        const finalContent = textarea.value.trim();
        if (!finalContent) { showToast('Please write something before submitting'); return; }

        const btn = document.getElementById('submitWorkBtn');
        btn.innerHTML = '<span class="spinner"></span> Submitting…';
        btn.disabled = true;

        const result = await apiFetch('/api/submit', {
            method: 'POST',
            body: JSON.stringify({ student_name: currentStudent, assignment_id: id, content: finalContent })
        });

        if (result?.success) {
            const existing = submissions.findIndex(s => s.student_name===currentStudent && s.assignment_id===id);
            const sub = { student_name: currentStudent, assignment_id: id, content: finalContent, submitted_at: new Date().toISOString() };
            if (existing !== -1) submissions[existing] = sub;
            else submissions.push(sub);
            showToast('✨ Assignment submitted!');
            navigateToPage('studentAssignments');
        } else {
            btn.innerHTML = '📤 Submit Assignment';
            btn.disabled = false;
        }
    };

    document.getElementById('backToAssignments').onclick = () => navigateToPage('studentAssignments');
}

function renderMyWork() {
    const mySubs  = submissions.filter(s => s.student_name === currentStudent);
    const content = document.getElementById('mainContent');

    if (mySubs.length === 0) {
        content.innerHTML = `
            <div class="page active">
                <div class="page-title"><img src='/static/assets/goose_reading.svg' class='title-icon' alt=''> My Work</div>
                <div class="card">
                    <div class="empty-state">
                        <span class="empty-state-icon">📭</span>
                        You haven't submitted any assignments yet.
                    </div>
                </div>
            </div>`;
        return;
    }

    content.innerHTML = `
        <div class="page active">
            <div class="page-title"><img src='/static/assets/goose_reading.svg' class='title-icon' alt=''> My Work</div>
            ${mySubs.map(s => {
                const assignTitle = assignments.find(a => a.id === s.assignment_id)?.title || `Assignment #${s.assignment_id}`;
                return `
                    <div class="work-item">
                        <strong>${escapeHtml(assignTitle)}</strong>
                        <div style="white-space:pre-wrap;font-family:'Lora',serif;font-size:0.9rem;margin-top:10px;line-height:1.65">${escapeHtml((s.content||'').substring(0,300))}…</div>
                        <div class="autosave-indicator" style="margin-top:8px">✓ Submitted: ${new Date(s.submitted_at).toLocaleString()}</div>
                    </div>`;
            }).join('')}
        </div>`;
}