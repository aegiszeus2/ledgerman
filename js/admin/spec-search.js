// Spec Search — native LedgerMan module
// No iframe, no external domain, no SSO. API calls go through
// LedgerMan backend (/api/specsearch/*) which proxies to the FastAPI service.
window.AdminSpecSearch = (function () {

    const BASE = '/api/specsearch';

    // ── API helper ────────────────────────────────────────────────────────────
    async function api(method, path, body, isForm) {
        const jwt = AppData.getJwt();
        const opts = {
            method,
            headers: { 'Authorization': 'Bearer ' + jwt },
        };
        if (isForm) {
            // body is FormData — let browser set Content-Type w/ boundary
            opts.body = body;
        } else if (body !== undefined && body !== null) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        const res = await fetch(AppData.API_BASE + BASE + path, opts);
        if (!res.ok) {
            let msg = `Error ${res.status}`;
            try { const j = await res.json(); msg = j.detail || j.error || msg; } catch (_) {}
            throw new Error(msg);
        }
        if (res.status === 204) return {};
        return res.json();
    }

    // ── Shared helpers ────────────────────────────────────────────────────────
    function esc(s) {
        return Utils && Utils.escapeHtml ? Utils.escapeHtml(String(s || '')) : String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    function fmt(iso) {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('en-CA');
    }

    function badge(status) {
        const map = {
            active:     ['#22c55e', '#dcfce7'],
            ready:      ['#22c55e', '#dcfce7'],
            processing: ['#f59e0b', '#fef9c3'],
            failed:     ['#ef4444', '#fee2e2'],
            archived:   ['#94a3b8', '#f1f5f9'],
        };
        const [fg, bg] = map[status] || ['#94a3b8', '#f1f5f9'];
        return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600;color:${fg};background:${bg}">${esc(status)}</span>`;
    }

    function spinner(msg) {
        return `<div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:48px;color:var(--text-muted,#888)">
            <div style="width:20px;height:20px;border:2px solid #ccc;border-top-color:#555;border-radius:50%;animation:lm-spin 0.7s linear infinite"></div>
            <span>${esc(msg)}</span>
        </div>`;
    }

    function ensureSpinStyle() {
        if (document.getElementById('lm-spin-style')) return;
        const s = document.createElement('style');
        s.id = 'lm-spin-style';
        s.textContent = '@keyframes lm-spin{to{transform:rotate(360deg)}}';
        document.head.appendChild(s);
    }

    // ── Module state ──────────────────────────────────────────────────────────
    let _container = null;
    let _currentProject = null;

    // ══════════════════════════════════════════════════════════════════════════
    // PROJECTS LIST
    // ══════════════════════════════════════════════════════════════════════════
    async function renderProjects() {
        ensureSpinStyle();
        _container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:20px">
                <h2 style="margin:0">Spec Search</h2>
                <button class="btn btn-primary" id="ss-new-project">+ New Project</button>
            </div>
            <div id="ss-projects-body">${spinner('Loading projects…')}</div>`;

        _container.querySelector('#ss-new-project').addEventListener('click', showNewProjectModal);

        let projects;
        try {
            projects = await api('GET', '/projects');
        } catch (e) {
            _container.querySelector('#ss-projects-body').innerHTML =
                `<div class="empty-state"><p style="color:#ef4444">⚠ ${esc(e.message)}</p>
                 <p style="color:var(--text-muted)">Make sure the Spec Search service is running.</p></div>`;
            return;
        }

        const body = _container.querySelector('#ss-projects-body');
        if (!projects.length) {
            body.innerHTML = `
                <div class="card" style="text-align:center;padding:48px">
                    <div style="font-size:2.5rem;margin-bottom:12px">📋</div>
                    <h3>No Projects Yet</h3>
                    <p style="color:var(--text-muted)">Create a project and upload specification documents to get started.</p>
                    <button class="btn btn-primary" id="ss-first-project" style="margin-top:12px">+ Create First Project</button>
                </div>`;
            body.querySelector('#ss-first-project').addEventListener('click', showNewProjectModal);
            return;
        }

        body.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
                ${projects.map(p => `
                <div class="card ss-project-card" data-id="${esc(p.id)}" style="cursor:pointer;transition:box-shadow 0.15s">
                    <div style="padding:16px">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
                            <strong style="font-size:1rem">${esc(p.name)}</strong>
                            ${badge(p.status)}
                        </div>
                        ${p.project_number ? `<div style="font-size:0.8rem;color:var(--text-muted)">#${esc(p.project_number)}</div>` : ''}
                        ${p.description ? `<div style="font-size:0.85rem;margin-top:8px;color:var(--text-secondary,#555)">${esc(p.description)}</div>` : ''}
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:0.8rem;color:var(--text-muted)">
                            <span>📄 ${p.document_count || 0} document${p.document_count === 1 ? '' : 's'}</span>
                            <span>${fmt(p.created_at)}</span>
                        </div>
                    </div>
                </div>`).join('')}
            </div>`;

        body.querySelectorAll('.ss-project-card').forEach(card => {
            card.addEventListener('mouseenter', () => card.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)');
            card.addEventListener('mouseleave', () => card.style.boxShadow = '');
            card.addEventListener('click', () => {
                const proj = projects.find(p => p.id === card.dataset.id);
                if (proj) renderProjectDetail(proj);
            });
        });
    }

    // ── New-project modal ─────────────────────────────────────────────────────
    function showNewProjectModal() {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1000;display:flex;align-items:center;justify-content:center';
        modal.innerHTML = `
            <div class="card" style="width:460px;max-width:95vw;padding:24px">
                <h3 style="margin:0 0 16px">New Spec Search Project</h3>
                <div class="form-group">
                    <label>Project Name <span style="color:#ef4444">*</span></label>
                    <input class="form-control" id="ss-modal-name" placeholder="e.g. Office Building A" autofocus>
                </div>
                <div class="form-group">
                    <label>Project Number</label>
                    <input class="form-control" id="ss-modal-num" placeholder="e.g. 2024-001">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea class="form-control" id="ss-modal-desc" rows="2" placeholder="Optional notes…"></textarea>
                </div>
                <div id="ss-modal-err" style="color:#ef4444;font-size:0.85rem;margin-bottom:8px;display:none"></div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
                    <button class="btn btn-secondary" id="ss-modal-cancel">Cancel</button>
                    <button class="btn btn-primary" id="ss-modal-save">Create Project</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        const nameEl = modal.querySelector('#ss-modal-name');
        const errEl  = modal.querySelector('#ss-modal-err');

        modal.querySelector('#ss-modal-cancel').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

        modal.querySelector('#ss-modal-save').addEventListener('click', async () => {
            const name = nameEl.value.trim();
            if (!name) { errEl.textContent = 'Project name is required.'; errEl.style.display = ''; return; }
            errEl.style.display = 'none';
            const btn = modal.querySelector('#ss-modal-save');
            btn.disabled = true; btn.textContent = 'Creating…';
            try {
                await api('POST', '/projects', {
                    name,
                    project_number: modal.querySelector('#ss-modal-num').value.trim() || null,
                    description:    modal.querySelector('#ss-modal-desc').value.trim() || null,
                });
                modal.remove();
                renderProjects();
            } catch (e) {
                errEl.textContent = e.message;
                errEl.style.display = '';
                btn.disabled = false; btn.textContent = 'Create Project';
            }
        });

        setTimeout(() => nameEl.focus(), 50);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PROJECT DETAIL
    // ══════════════════════════════════════════════════════════════════════════
    async function renderProjectDetail(project) {
        _currentProject = project;
        _container.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap">
                <button class="btn btn-secondary btn-sm" id="ss-back">← Projects</button>
                <h2 style="margin:0;flex:1">${esc(project.name)}</h2>
                ${project.project_number ? `<span style="font-size:0.85rem;color:var(--text-muted)">#${esc(project.project_number)}</span>` : ''}
            </div>

            <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:20px;align-items:start" id="ss-detail-grid">
                <!-- Documents panel -->
                <div>
                    <div class="card">
                        <div style="padding:14px 16px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center">
                            <strong>Documents</strong>
                            <label class="btn btn-primary btn-sm" style="cursor:pointer;margin:0">
                                + Upload PDF
                                <input type="file" id="ss-file-input" accept=".pdf" style="display:none">
                            </label>
                        </div>
                        <div id="ss-upload-progress" style="display:none;padding:10px 16px;background:#f0f9ff;font-size:0.85rem;color:#0369a1"></div>
                        <div id="ss-docs-list" style="min-height:80px">${spinner('Loading…')}</div>
                    </div>
                </div>

                <!-- Ask panel -->
                <div>
                    <div class="card">
                        <div style="padding:14px 16px;border-bottom:1px solid var(--border-color)">
                            <strong>Ask a Question</strong>
                        </div>
                        <div style="padding:16px">
                            <div style="display:flex;gap:8px">
                                <textarea id="ss-question-input" class="form-control" rows="2"
                                    placeholder="e.g. What is the compressive strength requirement for concrete footings?"
                                    style="resize:vertical;flex:1"></textarea>
                                <button class="btn btn-primary" id="ss-ask-btn" style="align-self:flex-end;white-space:nowrap">Ask</button>
                            </div>
                            <div id="ss-ask-error" style="color:#ef4444;font-size:0.82rem;margin-top:6px;display:none"></div>
                        </div>
                        <div id="ss-answer-area" style="padding:0 16px 16px"></div>
                    </div>

                    <div class="card" style="margin-top:16px">
                        <div style="padding:14px 16px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center">
                            <strong>History</strong>
                            <button class="btn btn-secondary btn-sm" id="ss-refresh-history">↻</button>
                        </div>
                        <div id="ss-history-list" style="min-height:60px">${spinner('Loading…')}</div>
                    </div>
                </div>
            </div>`;

        // Make grid single-column on narrow viewports
        const grid = _container.querySelector('#ss-detail-grid');
        const checkWidth = () => {
            grid.style.gridTemplateColumns = grid.offsetWidth < 640 ? '1fr' : '1fr 1.4fr';
        };
        checkWidth();
        window.addEventListener('resize', checkWidth);

        _container.querySelector('#ss-back').addEventListener('click', () => {
            window.removeEventListener('resize', checkWidth);
            _currentProject = null;
            renderProjects();
        });

        _container.querySelector('#ss-file-input').addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) uploadDocument(project.id, file);
            e.target.value = '';
        });

        _container.querySelector('#ss-ask-btn').addEventListener('click', () => {
            const q = _container.querySelector('#ss-question-input').value.trim();
            if (q) askQuestion(project.id, q);
        });

        _container.querySelector('#ss-question-input').addEventListener('keydown', e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                const q = _container.querySelector('#ss-question-input').value.trim();
                if (q) askQuestion(project.id, q);
            }
        });

        _container.querySelector('#ss-refresh-history').addEventListener('click', () => loadHistory(project.id));

        await Promise.all([loadDocuments(project.id), loadHistory(project.id)]);
    }

    // ── Documents ─────────────────────────────────────────────────────────────
    async function loadDocuments(projectId) {
        const el = _container.querySelector('#ss-docs-list');
        if (!el) return;
        el.innerHTML = spinner('Loading…');
        let docs;
        try {
            docs = await api('GET', `/documents?project_id=${encodeURIComponent(projectId)}`);
        } catch (e) {
            el.innerHTML = `<div style="padding:12px;color:#ef4444;font-size:0.85rem">⚠ ${esc(e.message)}</div>`;
            return;
        }
        if (!docs.length) {
            el.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.9rem">
                📄 No documents yet.<br>Upload a PDF specification to get started.</div>`;
            return;
        }
        el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:0.85rem">
            <thead>
                <tr style="border-bottom:1px solid var(--border-color)">
                    <th style="padding:8px 12px;text-align:left;font-weight:600">File</th>
                    <th style="padding:8px 12px;text-align:left;font-weight:600">Status</th>
                    <th style="padding:8px 12px;text-align:right;font-weight:600"></th>
                </tr>
            </thead>
            <tbody>
                ${docs.map(d => `
                <tr style="border-bottom:1px solid var(--border-color)" data-doc-id="${esc(d.id)}">
                    <td style="padding:8px 12px">
                        <div style="font-weight:500;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(d.file_name)}">${esc(d.file_name)}</div>
                        <div style="color:var(--text-muted);font-size:0.77rem">${d.page_count ? d.page_count + ' pages · ' : ''}${fmt(d.uploaded_at)}</div>
                    </td>
                    <td style="padding:8px 12px">${badge(d.status)}</td>
                    <td style="padding:8px 12px;text-align:right">
                        <button class="btn btn-secondary btn-sm ss-del-doc" data-id="${esc(d.id)}" title="Delete document" style="padding:2px 8px;color:#ef4444;border-color:#ef4444">✕</button>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>`;

        el.querySelectorAll('.ss-del-doc').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this document and all its indexed chunks?')) return;
                btn.disabled = true;
                try {
                    await api('DELETE', `/documents/${encodeURIComponent(btn.dataset.id)}`);
                    loadDocuments(projectId);
                } catch (e) {
                    alert('Delete failed: ' + e.message);
                    btn.disabled = false;
                }
            });
        });

        // Auto-refresh if any doc is still processing
        if (docs.some(d => d.status === 'processing')) {
            setTimeout(() => {
                if (_currentProject && _currentProject.id === projectId) loadDocuments(projectId);
            }, 4000);
        }
    }

    async function uploadDocument(projectId, file) {
        const progress = _container.querySelector('#ss-upload-progress');
        progress.textContent = `⏳ Uploading ${file.name}…`;
        progress.style.display = '';

        const fd = new FormData();
        fd.append('project_id', projectId);
        fd.append('file', file);

        try {
            await api('POST', '/documents', fd, true);
            progress.textContent = `✅ ${file.name} uploaded — indexing in background.`;
            setTimeout(() => { progress.style.display = 'none'; }, 3000);
            loadDocuments(projectId);
        } catch (e) {
            progress.textContent = `⚠ Upload failed: ${e.message}`;
            progress.style.background = '#fef2f2';
            progress.style.color = '#ef4444';
            setTimeout(() => {
                progress.style.display = 'none';
                progress.style.background = '';
                progress.style.color = '';
            }, 5000);
        }
    }

    // ── Ask ───────────────────────────────────────────────────────────────────
    async function askQuestion(projectId, question) {
        const btn = _container.querySelector('#ss-ask-btn');
        const errEl = _container.querySelector('#ss-ask-error');
        const answerArea = _container.querySelector('#ss-answer-area');

        errEl.style.display = 'none';
        btn.disabled = true;
        btn.textContent = 'Thinking…';
        answerArea.innerHTML = spinner('Searching specs…');

        try {
            const result = await api('POST', '/ask', { project_id: projectId, question });

            // Confidence colour
            const confColor = result.confidence_level === 'high' ? '#22c55e'
                           : result.confidence_level === 'medium' ? '#f59e0b' : '#94a3b8';

            answerArea.innerHTML = `
                <div style="background:var(--bg-surface,#1c2746);border:1px solid var(--border-color);border-radius:8px;padding:16px;margin-bottom:12px">
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;display:flex;align-items:center;gap:8px">
                        <span>Your question</span>
                    </div>
                    <div style="font-weight:500">${esc(question)}</div>
                </div>
                <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:8px;padding:16px">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                        <span style="font-size:0.75rem;font-weight:600;color:${confColor};background:${confColor}22;padding:2px 8px;border-radius:999px;text-transform:uppercase">
                            ${esc(result.confidence_level || 'unknown')} confidence
                        </span>
                    </div>
                    <div style="line-height:1.6;white-space:pre-wrap;color:var(--text-primary)">${esc(result.answer)}</div>
                    ${result.citations && result.citations.length ? `
                    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-color)">
                        <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Sources</div>
                        ${result.citations.map((c, i) => {
                            const refLine = [
                                c.section_number ? `§ ${esc(c.section_number)}` : '',
                                c.section_title  ? esc(c.section_title) : '',
                                c.page_number    ? `p. ${c.page_number}` : '',
                                (!c.section_number && c.chunk_index != null) ? `Chunk ${c.chunk_index}` : '',
                            ].filter(Boolean).join(' · ');
                            const metaLine = [
                                c.document_type ? esc(c.document_type) : '',
                                c.revision      ? `Rev. ${esc(c.revision)}` : '',
                            ].filter(Boolean).join(' · ');
                            return `
                        <div style="background:var(--bg-surface,#1c2746);border-radius:6px;padding:10px 12px;margin-bottom:8px;font-size:0.82rem;border-left:3px solid var(--border-color-strong,#34467a)">
                            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:4px">
                                <div style="font-weight:600;color:var(--text-primary)">${esc(c.document_name || 'Unknown document')}</div>
                                <div style="font-size:0.72rem;color:var(--text-muted);white-space:nowrap;flex-shrink:0">Source ${i + 1}</div>
                            </div>
                            ${refLine ? `<div style="color:var(--text-muted);margin-bottom:3px">${refLine}</div>` : ''}
                            ${metaLine ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:3px">${metaLine}</div>` : ''}
                            ${c.quoted_text ? `<div style="margin-top:6px;color:var(--text-secondary,#b9c4dc);font-style:italic;border-top:1px solid var(--border-color-soft,#1a2340);padding-top:6px">"${esc(c.quoted_text.slice(0, 300))}${c.quoted_text.length > 300 ? '…' : ''}"</div>` : ''}
                        </div>`;
                        }).join('')}
                    </div>` : ''}
                </div>`;

            _container.querySelector('#ss-question-input').value = '';
            loadHistory(projectId);
        } catch (e) {
            answerArea.innerHTML = '';
            errEl.textContent = '⚠ ' + e.message;
            errEl.style.display = '';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Ask';
        }
    }

    // ── History ───────────────────────────────────────────────────────────────
    async function loadHistory(projectId) {
        const el = _container.querySelector('#ss-history-list');
        if (!el) return;
        el.innerHTML = spinner('Loading…');
        let rows;
        try {
            rows = await api('GET', `/ask/history?project_id=${encodeURIComponent(projectId)}`);
        } catch (e) {
            el.innerHTML = `<div style="padding:12px;color:#ef4444;font-size:0.85rem">⚠ ${esc(e.message)}</div>`;
            return;
        }
        if (!rows.length) {
            el.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.85rem">No questions asked yet.</div>`;
            return;
        }
        el.innerHTML = rows.map(r => `
            <div style="padding:12px 16px;border-bottom:1px solid var(--border-color)">
                <div style="font-size:0.82rem;font-weight:600;margin-bottom:4px">${esc(r.question)}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary,#555);line-height:1.5;max-height:60px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(r.answer)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${new Date(r.created_at).toLocaleString('en-CA', {dateStyle:'medium',timeStyle:'short'})}</div>
            </div>`).join('');
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        render(container) {
            _container = container;
            _currentProject = null;
            renderProjects();
        }
    };

})();
