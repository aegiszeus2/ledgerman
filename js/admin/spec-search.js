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

    // ── Citations renderer (shared between ask + history) ─────────────────────
    function renderCitations(citations) {
        if (!citations || !citations.length) return '';
        return `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border-color)">
            <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Sources</div>
            ${citations.map((c, i) => {
                const refLine = [
                    c.section_number ? `§ ${esc(c.section_number)}` : '',
                    c.section_title  ? esc(c.section_title) : '',
                    c.page_number    ? `p. ${c.page_number}` : '',
                    (!c.section_number && c.chunk_index != null) ? `Chunk ${c.chunk_index}` : '',
                ].filter(Boolean).join(' · ');
                const metaLine = [
                    c.document_type ? esc(c.document_type) : '',
                    c.revision      ? `Rev. ${esc(c.revision)}` : '',
                ].filter(Boolean).join(' · ');
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
        </div>`;
    }

    // ── Module state ──────────────────────────────────────────────────────────
    let _container = null;
    let _currentProject = null;
    let _currentTab = 'docs'; // 'docs' | 'findings'

    // ── Document type options ─────────────────────────────────────────────────
    const DOC_TYPES = [
        ['specification',   'Specification'],
        ['contract',        'Contract Document'],
        ['special_prov',    'Special Provisions'],
        ['opss',            'OPSS Standard'],
        ['mto',             'MTO Document'],
        ['metrolinx',       'Metrolinx Specification'],
        ['rfi',             'RFI'],
        ['clarification',   'Clarification'],
        ['meeting_minutes', 'Meeting Minutes'],
        ['itp',             'Inspection & Test Plan'],
        ['ncr',             'Non-Conformance Report'],
        ['deviation',       'Approved Deviation'],
        ['quality_report',  'Quality Report'],
        ['drawing',         'Drawing'],
        ['other',           'Other'],
    ];

    const FINDING_TYPES = [
        ['confirmed_compliance',     'Confirmed Compliance'],
        ['confirmed_non_compliance', 'Confirmed Non-Compliance'],
        ['potential_concern',        'Potential Concern'],
        ['missing_info',             'Missing Information'],
        ['informational',            'Informational Observation'],
        ['requires_engineering',     'Requires Engineering Judgment'],
        ['requires_contractual',     'Requires Contractual Clarification'],
    ];

    const FINDING_STATUS_COLORS = {
        pending:  ['#f59e0b', '#fef9c3'],
        accepted: ['#22c55e', '#dcfce7'],
        rejected: ['#ef4444', '#fee2e2'],
        override: ['#8b5cf6', '#ede9fe'],
    };

    const FINDING_TYPE_COLORS = {
        confirmed_compliance:     ['#22c55e', '#dcfce7'],
        confirmed_non_compliance: ['#ef4444', '#fee2e2'],
        potential_concern:        ['#f59e0b', '#fef9c3'],
        missing_info:             ['#94a3b8', '#f1f5f9'],
        informational:            ['#64748b', '#f8fafc'],
        requires_engineering:     ['#8b5cf6', '#ede9fe'],
        requires_contractual:     ['#06b6d4', '#ecfeff'],
    };

    function findingStatusBadge(status) {
        const [fg, bg] = FINDING_STATUS_COLORS[status] || ['#94a3b8', '#f1f5f9'];
        const label = status.charAt(0).toUpperCase() + status.slice(1);
        return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600;color:${fg};background:${bg}">${esc(label)}</span>`;
    }

    function findingTypeBadge(type) {
        const [fg, bg] = FINDING_TYPE_COLORS[type] || ['#94a3b8', '#f1f5f9'];
        const label = (FINDING_TYPES.find(([k]) => k === type) || [type, type])[1];
        return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600;color:${fg};background:${bg}">${esc(label)}</span>`;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PROJECTS LIST
    // ══════════════════════════════════════════════════════════════════════════
    async function renderProjects() {
        ensureSpinStyle();
        _container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:20px">
                <h2 style="margin:0">Spec Search</h2>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-secondary" id="ss-help-btn" title="How to use Spec Search">? Help</button>
                    <button class="btn btn-secondary" id="ss-compare-btn">⇄ Compare Projects</button>
                    <button class="btn btn-primary" id="ss-new-project">+ New Project</button>
                </div>
            </div>
            <div id="ss-projects-body">${spinner('Loading projects…')}</div>`;

        _container.querySelector('#ss-new-project').addEventListener('click', showNewProjectModal);
        _container.querySelector('#ss-compare-btn').addEventListener('click', () => renderCompare());
        _container.querySelector('#ss-help-btn').addEventListener('click', () => renderHelp());

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
        const bodyHtml = `
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
        `;
        const uiModal = UI.modal('New Spec Search Project', bodyHtml, {
            width: '460px',
            submitLabel: 'Create Project',
        });
        const q = s => uiModal.q(s);
        const nameEl = q('#ss-modal-name');
        const errEl  = q('#ss-modal-err');

        uiModal.submitBtn.addEventListener('click', async () => {
            const name = nameEl.value.trim();
            if (!name) { errEl.textContent = 'Project name is required.'; errEl.style.display = ''; return; }
            errEl.style.display = 'none';
            const restore = UI.btnLoading(uiModal.submitBtn, 'Creating…');
            try {
                await api('POST', '/projects', {
                    name,
                    project_number: q('#ss-modal-num').value.trim() || null,
                    description:    q('#ss-modal-desc').value.trim() || null,
                });
                uiModal.close();
                renderProjects();
            } catch (e) {
                errEl.textContent = e.message;
                errEl.style.display = '';
                restore();
            }
        });

        setTimeout(() => nameEl.focus(), 50);
    }

    // ── Edit-project modal ────────────────────────────────────────────────────
    function showEditProjectModal(project) {
        const bodyHtml = `
            <div class="form-group">
                <label>Project Name <span style="color:#ef4444">*</span></label>
                <input class="form-control" id="ss-edit-name" value="${esc(project.name)}">
            </div>
            <div class="form-group">
                <label>Project Number</label>
                <input class="form-control" id="ss-edit-num" value="${esc(project.project_number || '')}">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea class="form-control" id="ss-edit-desc" rows="2">${esc(project.description || '')}</textarea>
            </div>
            <div id="ss-edit-err" style="color:#ef4444;font-size:0.85rem;margin-bottom:8px;display:none"></div>
        `;
        const uiModal = UI.modal('Edit Project', bodyHtml, {
            width: '460px',
            submitLabel: 'Save Changes',
        });
        const q = s => uiModal.q(s);
        const errEl = q('#ss-edit-err');

        uiModal.submitBtn.addEventListener('click', async () => {
            const name = q('#ss-edit-name').value.trim();
            if (!name) { errEl.textContent = 'Project name is required.'; errEl.style.display = ''; return; }
            errEl.style.display = 'none';
            const restore = UI.btnLoading(uiModal.submitBtn, 'Saving…');
            try {
                const updated = await api('PATCH', `/projects/${encodeURIComponent(project.id)}`, {
                    name,
                    project_number: q('#ss-edit-num').value.trim() || null,
                    description:    q('#ss-edit-desc').value.trim() || null,
                });
                uiModal.close();
                // Update cached project and re-render detail
                _currentProject = { ..._currentProject, ...updated };
                renderProjectDetail(_currentProject);
            } catch (e) {
                errEl.textContent = e.message;
                errEl.style.display = '';
                restore();
            }
        });

        setTimeout(() => q('#ss-edit-name').focus(), 50);
    }

    // ── Delete-project modal ──────────────────────────────────────────────────
    function showDeleteProjectModal(project) {
        const bodyHtml = `
            <p style="margin:0 0 8px;font-size:0.9rem">This will permanently delete <strong>${esc(project.name)}</strong> including all uploaded documents, indexed chunks, and search history.</p>
            <p style="margin:0 0 16px;font-size:0.9rem;color:var(--text-muted)">This action cannot be undone.</p>
            <div class="form-group">
                <label style="font-size:0.85rem">Type <strong style="font-family:monospace;color:#ef4444">DELETE</strong> to confirm:</label>
                <input class="form-control" id="ss-del-confirm" placeholder="DELETE" style="border-color:#ef4444;margin-top:6px">
            </div>
            <div id="ss-del-err" style="color:#ef4444;font-size:0.85rem;margin-bottom:8px;display:none"></div>
        `;
        const uiModal = UI.modal('Delete Project', bodyHtml, {
            width: '480px',
            submitLabel: 'Delete Project',
            danger: true,
        });
        const q = s => uiModal.q(s);
        const errEl = q('#ss-del-err');
        const confirmInput = q('#ss-del-confirm');

        uiModal.submitBtn.addEventListener('click', async () => {
            if (confirmInput.value.trim() !== 'DELETE') {
                errEl.textContent = 'Type DELETE (all caps) to confirm.';
                errEl.style.display = '';
                confirmInput.focus();
                return;
            }
            errEl.style.display = 'none';
            const restore = UI.btnLoading(uiModal.submitBtn, 'Deleting…');
            try {
                await api('DELETE', `/projects/${encodeURIComponent(project.id)}`);
                uiModal.close();
                _currentProject = null;
                renderProjects();
            } catch (e) {
                errEl.textContent = e.message;
                errEl.style.display = '';
                restore();
            }
        });

        setTimeout(() => confirmInput.focus(), 50);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // COMPARE VIEW
    // ══════════════════════════════════════════════════════════════════════════
    async function renderCompare() {
        ensureSpinStyle();
        _container.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
                <button class="btn btn-secondary btn-sm" id="ss-compare-back">← Projects</button>
                <h2 style="margin:0">Compare Projects</h2>
            </div>
            <div id="ss-compare-body">${spinner('Loading projects…')}</div>`;

        _container.querySelector('#ss-compare-back').addEventListener('click', () => renderProjects());

        let projects;
        try {
            projects = await api('GET', '/projects');
        } catch (e) {
            _container.querySelector('#ss-compare-body').innerHTML =
                `<div style="color:#ef4444;padding:24px">⚠ ${esc(e.message)}</div>`;
            return;
        }

        if (projects.length < 2) {
            _container.querySelector('#ss-compare-body').innerHTML = `
                <div class="card" style="text-align:center;padding:48px">
                    <div style="font-size:2rem;margin-bottom:12px">📊</div>
                    <h3>Not Enough Projects</h3>
                    <p style="color:var(--text-muted)">You need at least two projects to compare. Create another project and upload its specifications first.</p>
                </div>`;
            return;
        }

        const opts = projects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.project_number ? ' (#' + esc(p.project_number) + ')' : ''}</option>`).join('');

        _container.querySelector('#ss-compare-body').innerHTML = `
            <div class="card" style="padding:20px;margin-bottom:16px">
                <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:end">
                    <div class="form-group" style="margin:0">
                        <label style="font-weight:600">Project A</label>
                        <select class="form-control" id="ss-proj-a" style="margin-top:6px">${opts}</select>
                    </div>
                    <div style="font-size:1.4rem;padding-bottom:4px;color:var(--text-muted)">⇄</div>
                    <div class="form-group" style="margin:0">
                        <label style="font-weight:600">Project B</label>
                        <select class="form-control" id="ss-proj-b" style="margin-top:6px">${opts}</select>
                    </div>
                </div>
                <div id="ss-compare-err" style="color:#ef4444;font-size:0.85rem;margin-top:10px;display:none"></div>
                <div style="text-align:center;margin-top:16px">
                    <button class="btn btn-primary" id="ss-run-compare" style="min-width:160px">Compare Specs</button>
                </div>
            </div>
            <div id="ss-compare-result"></div>`;

        // Default second selector to second project
        if (projects.length >= 2) {
            _container.querySelector('#ss-proj-b').selectedIndex = 1;
        }

        _container.querySelector('#ss-run-compare').addEventListener('click', async () => {
            const projAId = _container.querySelector('#ss-proj-a').value;
            const projBId = _container.querySelector('#ss-proj-b').value;
            const errEl   = _container.querySelector('#ss-compare-err');
            const resultEl = _container.querySelector('#ss-compare-result');

            if (projAId === projBId) {
                errEl.textContent = 'Select two different projects.';
                errEl.style.display = '';
                return;
            }
            errEl.style.display = 'none';

            const btn = _container.querySelector('#ss-run-compare');
            btn.disabled = true; btn.textContent = 'Comparing…';
            resultEl.innerHTML = spinner('Analyzing specifications — this may take 30–60 seconds…');

            try {
                const result = await api('POST', '/compare', {
                    project_a_id: projAId,
                    project_b_id: projBId,
                });

                const projAName = result.project_a_name || projAId;
                const projBName = result.project_b_name || projBId;
                const docsAHtml = (result.docs_a || []).map(d => `<li>${esc(d.name)} (${d.chunk_count} chunks)</li>`).join('');
                const docsBHtml = (result.docs_b || []).map(d => `<li>${esc(d.name)} (${d.chunk_count} chunks)</li>`).join('');

                resultEl.innerHTML = `
                    <div class="card" style="padding:20px">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                            <h3 style="margin:0">Comparison Result</h3>
                            <div style="display:flex;gap:8px">
                                <button class="btn btn-secondary btn-sm" id="ss-copy-compare">Copy</button>
                                <button class="btn btn-secondary btn-sm" id="ss-export-compare">Export .txt</button>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;font-size:0.82rem;color:var(--text-muted)">
                            <div><strong style="color:var(--text-primary)">${esc(projAName)}</strong><ul style="margin:4px 0 0 16px;padding:0">${docsAHtml}</ul></div>
                            <div><strong style="color:var(--text-primary)">${esc(projBName)}</strong><ul style="margin:4px 0 0 16px;padding:0">${docsBHtml}</ul></div>
                        </div>
                        <div id="ss-compare-text" style="white-space:pre-wrap;line-height:1.7;color:var(--text-primary);background:var(--bg-surface,#1c2746);border-radius:8px;padding:16px;font-size:0.9rem">${esc(result.result || '')}</div>
                    </div>`;

                const rawText = `SPEC SEARCH COMPARISON\n${projAName} vs ${projBName}\n${'─'.repeat(60)}\n\n${result.result || ''}`;

                resultEl.querySelector('#ss-copy-compare').addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(rawText);
                        const b = resultEl.querySelector('#ss-copy-compare');
                        b.textContent = 'Copied!';
                        setTimeout(() => { b.textContent = 'Copy'; }, 1800);
                    } catch (_) { alert('Copy failed — please select the text manually.'); }
                });

                resultEl.querySelector('#ss-export-compare').addEventListener('click', () => {
                    const blob = new Blob([rawText], { type: 'text/plain' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `spec-compare-${projAName.replace(/\s+/g,'-')}-vs-${projBName.replace(/\s+/g,'-')}.txt`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                });

            } catch (e) {
                resultEl.innerHTML = `<div class="card" style="padding:20px;color:#ef4444">⚠ ${esc(e.message)}</div>`;
            } finally {
                btn.disabled = false; btn.textContent = 'Compare Specs';
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HELP VIEW
    // ══════════════════════════════════════════════════════════════════════════
    function renderHelp() {
        _container.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
                <button class="btn btn-secondary btn-sm" id="ss-help-back">← Projects</button>
                <h2 style="margin:0">How to Use Spec Search</h2>
            </div>
            <div style="max-width:720px">
                <div class="card" style="padding:20px;margin-bottom:16px">
                    <h3 style="margin:0 0 12px">What is Spec Search?</h3>
                    <p style="margin:0;line-height:1.6;color:var(--text-secondary,#555)">
                        Spec Search lets you upload construction specification PDFs and ask plain-English questions about them.
                        The AI reads your documents, finds the relevant sections, and gives you direct answers with source citations.
                    </p>
                </div>

                <div class="card" style="padding:20px;margin-bottom:16px">
                    <h3 style="margin:0 0 16px">Getting Started</h3>
                    <ol style="margin:0;padding-left:20px;line-height:2;color:var(--text-secondary,#555)">
                        <li><strong>Create a project</strong> — Click <em>+ New Project</em> and give it the job name and number.</li>
                        <li><strong>Upload specs</strong> — Open the project and click <em>+ Upload PDF</em>. Each PDF is indexed separately. Indexing takes 30–90 seconds per document.</li>
                        <li><strong>Wait for Ready</strong> — Documents show a status badge. Wait for <span style="color:#22c55e;font-weight:600">ready</span> before asking questions.</li>
                        <li><strong>Ask a question</strong> — Type a plain-English question in the Ask box and press <em>Ask</em> or Ctrl+Enter.</li>
                        <li><strong>Review sources</strong> — Each answer shows the document sections it drew from, including page numbers and quoted text.</li>
                        <li><strong>Check history</strong> — All previous Q&A for the project is saved. Click any history entry to expand the full answer and sources.</li>
                        <li><strong>Compare projects</strong> — Use <em>⇄ Compare Projects</em> to run an AI comparison of specs between two projects.</li>
                        <li><strong>Export</strong> — Comparison results can be copied to clipboard or exported as a .txt file.</li>
                    </ol>
                </div>

                <div class="card" style="padding:20px;margin-bottom:16px">
                    <h3 style="margin:0 0 16px">FAQ</h3>
                    <div style="display:grid;gap:14px">
                        ${[
                            ['What file types are supported?', 'PDF only. For best results, use text-based PDFs rather than scanned images.'],
                            ['How long does indexing take?', 'Typically 30–90 seconds per document depending on page count. The status badge changes to "ready" when done.'],
                            ['How many documents can I upload?', 'No hard limit. More documents give more thorough answers but may increase response time.'],
                            ['What if the answer is wrong or low confidence?', 'Check the cited sections in your PDF. Low confidence means the AI did not find strong matches. Try rephrasing your question or ensure the relevant spec section is in an uploaded document.'],
                            ['Can I delete a document?', 'Yes — click the ✕ button next to any document. This removes it and all its indexed content. The project and other documents are unaffected.'],
                            ['Can I delete a project?', 'Yes — open the project, click Delete Project, and type DELETE to confirm. This permanently removes all documents, indexed data, and history for that project.'],
                            ['Does Spec Search work offline?', 'No. It requires a connection to the LedgerMan server and an active AI relay.'],
                            ['Is my spec data stored securely?', 'Documents are stored on the LedgerMan server and only accessible to users with valid LedgerMan credentials for your company.'],
                            ['Can I compare more than two projects?', 'Currently two projects at a time. Run multiple comparisons to compare more.'],
                            ['Where is search history stored?', 'History is stored in the Spec Search database on the LedgerMan server. It persists across sessions.'],
                        ].map(([q, a]) => `
                        <div style="border-bottom:1px solid var(--border-color);padding-bottom:14px">
                            <div style="font-weight:600;margin-bottom:4px">${esc(q)}</div>
                            <div style="color:var(--text-secondary,#555);font-size:0.9rem;line-height:1.5">${esc(a)}</div>
                        </div>`).join('')}
                    </div>
                </div>
            </div>`;

        _container.querySelector('#ss-help-back').addEventListener('click', () => renderProjects());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PROJECT DETAIL
    // ══════════════════════════════════════════════════════════════════════════
    async function renderProjectDetail(project) {
        _currentProject = project;
        _currentTab = 'docs';
        _container.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
                <button class="btn btn-secondary btn-sm" id="ss-back">← Projects</button>
                <h2 style="margin:0;flex:1">${esc(project.name)}</h2>
                ${project.project_number ? `<span style="font-size:0.85rem;color:var(--text-muted)">#${esc(project.project_number)}</span>` : ''}
                <button class="btn btn-secondary btn-sm" id="ss-edit-btn">✎ Edit</button>
                <button class="btn btn-sm" id="ss-delete-btn" style="background:transparent;color:#ef4444;border-color:#ef4444">🗑 Delete</button>
            </div>

            <!-- Tab bar -->
            <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--border-color);padding-bottom:0">
                <button id="ss-tab-docs" data-tab="docs" class="ss-tab-btn" style="padding:8px 18px;border:none;background:transparent;cursor:pointer;font-size:0.9rem;font-weight:600;color:var(--accent-color,#4f8ef7);border-bottom:2px solid var(--accent-color,#4f8ef7);margin-bottom:-2px">Docs &amp; Q&amp;A</button>
                <button id="ss-tab-findings" data-tab="findings" class="ss-tab-btn" style="padding:8px 18px;border:none;background:transparent;cursor:pointer;font-size:0.9rem;font-weight:600;color:var(--text-muted);border-bottom:2px solid transparent;margin-bottom:-2px">Findings</button>
            </div>

            <!-- Docs + Ask tab -->
            <div id="ss-tab-content-docs">
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
                </div>
            </div>

            <!-- Findings tab -->
            <div id="ss-tab-content-findings" style="display:none">
                <div id="ss-findings-panel">${spinner('Loading findings…')}</div>
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

        _container.querySelector('#ss-edit-btn').addEventListener('click', () => showEditProjectModal(_currentProject));
        _container.querySelector('#ss-delete-btn').addEventListener('click', () => showDeleteProjectModal(_currentProject));

        _container.querySelector('#ss-file-input').addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) showUploadModal(project.id, file);
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

        // ── Tab switching ─────────────────────────────────────────────────────
        _container.querySelectorAll('.ss-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                _currentTab = tab;
                // Update button styles
                _container.querySelectorAll('.ss-tab-btn').forEach(b => {
                    const active = b.dataset.tab === tab;
                    b.style.color = active ? 'var(--accent-color,#4f8ef7)' : 'var(--text-muted)';
                    b.style.borderBottomColor = active ? 'var(--accent-color,#4f8ef7)' : 'transparent';
                });
                // Show/hide panels
                _container.querySelector('#ss-tab-content-docs').style.display   = tab === 'docs'     ? '' : 'none';
                _container.querySelector('#ss-tab-content-findings').style.display = tab === 'findings' ? '' : 'none';
                if (tab === 'findings') loadFindings(project.id);
            });
        });

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
                if (!confirm('Delete this document and all its indexed chunks? This cannot be undone.')) return;
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

            const confColor = result.confidence_level === 'high' ? '#22c55e'
                           : result.confidence_level === 'medium' ? '#f59e0b' : '#94a3b8';

            answerArea.innerHTML = `
                <div style="background:var(--bg-surface,#1c2746);border:1px solid var(--border-color);border-radius:8px;padding:16px;margin-bottom:12px">
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">Your question</div>
                    <div style="font-weight:500">${esc(question)}</div>
                </div>
                <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:8px;padding:16px">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap">
                        <span style="font-size:0.75rem;font-weight:600;color:${confColor};background:${confColor}22;padding:2px 8px;border-radius:999px;text-transform:uppercase">
                            ${esc(result.confidence_level || 'unknown')} confidence
                        </span>
                        <button class="btn btn-secondary btn-sm" id="ss-create-finding-btn" style="font-size:0.78rem">+ Create Finding</button>
                    </div>
                    <div style="line-height:1.6;white-space:pre-wrap;color:var(--text-primary)">${esc(result.answer)}</div>
                    ${renderCitations(result.citations)}
                </div>`;

            // Wire up the "Create Finding" button
            const findingBtn = answerArea.querySelector('#ss-create-finding-btn');
            if (findingBtn) {
                findingBtn.addEventListener('click', () => {
                    const firstCitation = result.citations && result.citations[0];
                    showCreateFindingModal(projectId, {
                        question_id: result.question_id,
                        title: question.length > 80 ? question.slice(0, 77) + '…' : question,
                        ai_assessment: result.answer,
                        confidence_score: result.confidence_level,
                        source_clause: firstCitation ? (firstCitation.section_number || '') : '',
                        requirement_text: firstCitation ? (firstCitation.quoted_text || '') : '',
                    });
                });
            }

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

    // ── History (expandable with full citations) ──────────────────────────────
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

        el.innerHTML = rows.map((r, idx) => {
            const confColor = r.confidence_level === 'high' ? '#22c55e'
                            : r.confidence_level === 'medium' ? '#f59e0b' : '#94a3b8';
            return `
            <div class="ss-history-item" data-idx="${idx}" style="border-bottom:1px solid var(--border-color)">
                <div class="ss-history-header" style="padding:12px 16px;cursor:pointer;display:flex;align-items:flex-start;gap:8px" title="Click to expand">
                    <div style="flex:1;min-width:0">
                        <div style="font-size:0.82rem;font-weight:600;margin-bottom:3px">${esc(r.question)}</div>
                        <div style="font-size:0.79rem;color:var(--text-secondary,#555);line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical" id="ss-hist-preview-${idx}">${esc(r.answer)}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px">${new Date(r.created_at).toLocaleString('en-CA', {dateStyle:'medium',timeStyle:'short'})}</div>
                    </div>
                    <span class="ss-hist-toggle" style="font-size:0.72rem;color:var(--text-muted);white-space:nowrap;padding-top:2px;flex-shrink:0">▼ Details</span>
                </div>
                <div class="ss-history-detail" id="ss-hist-detail-${idx}" style="display:none;padding:0 16px 16px">
                    <div style="background:var(--bg-surface,#1c2746);border-radius:8px;padding:14px;font-size:0.88rem">
                        ${r.confidence_level ? `<span style="font-size:0.72rem;font-weight:600;color:${confColor};background:${confColor}22;padding:2px 7px;border-radius:999px;text-transform:uppercase;display:inline-block;margin-bottom:10px">${esc(r.confidence_level)} confidence</span>` : ''}
                        <div style="line-height:1.6;white-space:pre-wrap;color:var(--text-primary)">${esc(r.answer)}</div>
                        ${renderCitations(r.citations)}
                    </div>
                </div>
            </div>`;
        }).join('');

        // Bind expand/collapse
        el.querySelectorAll('.ss-history-header').forEach(header => {
            header.addEventListener('click', () => {
                const item  = header.closest('.ss-history-item');
                const idx   = item.dataset.idx;
                const detail = document.getElementById(`ss-hist-detail-${idx}`);
                const toggle = header.querySelector('.ss-hist-toggle');
                const expanded = detail.style.display !== 'none';
                detail.style.display = expanded ? 'none' : '';
                toggle.textContent   = expanded ? '▼ Details' : '▲ Hide';
            });
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // UPLOAD WITH CLASSIFICATION MODAL
    // ══════════════════════════════════════════════════════════════════════════
    function showUploadModal(projectId, file) {
        const docTypeOpts = DOC_TYPES.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
        const bodyHtml = `
            <div class="form-group">
                <label style="font-size:0.85rem;color:var(--text-muted)">Selected file</label>
                <div style="font-weight:600;margin-top:4px;font-size:0.9rem">${esc(file.name)}</div>
                <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">${(file.size / 1024).toFixed(0)} KB — PDF</div>
            </div>
            <div class="form-group">
                <label>Document Type</label>
                <select class="form-control" id="ss-upload-type" style="margin-top:4px">
                    ${docTypeOpts}
                </select>
            </div>
            <div class="form-group">
                <label>Revision / Version <span style="color:var(--text-muted);font-size:0.82rem">(optional)</span></label>
                <input class="form-control" id="ss-upload-rev" placeholder="e.g. Rev. 3, 2026-04-15">
            </div>
            <div class="form-group">
                <label>Discipline <span style="color:var(--text-muted);font-size:0.82rem">(optional)</span></label>
                <input class="form-control" id="ss-upload-disc" placeholder="e.g. Civil, Structural, Mechanical">
            </div>
            <div id="ss-upload-modal-err" style="color:#ef4444;font-size:0.85rem;display:none"></div>`;

        const uiModal = UI.modal('Upload Document', bodyHtml, {
            width: '460px',
            submitLabel: 'Upload & Index',
        });

        uiModal.submitBtn.addEventListener('click', async () => {
            const docType  = uiModal.q('#ss-upload-type').value;
            const revision = uiModal.q('#ss-upload-rev').value.trim() || null;
            const discipline = uiModal.q('#ss-upload-disc').value.trim() || null;

            const restore = UI.btnLoading(uiModal.submitBtn, 'Uploading…');
            try {
                await uploadDocument(projectId, file, docType, revision, discipline);
                uiModal.close();
            } catch (e) {
                const errEl = uiModal.q('#ss-upload-modal-err');
                errEl.textContent = e.message;
                errEl.style.display = '';
                restore();
            }
        });
    }

    async function uploadDocument(projectId, file, docType, revision, discipline) {
        const progress = _container.querySelector('#ss-upload-progress');
        if (progress) {
            progress.textContent = `⏳ Uploading ${file.name}…`;
            progress.style.display = '';
        }

        const fd = new FormData();
        fd.append('project_id', projectId);
        fd.append('file', file);
        if (docType)    fd.append('document_type', docType);
        if (revision)   fd.append('revision', revision);
        if (discipline) fd.append('discipline', discipline);

        try {
            await api('POST', '/documents', fd, true);
            if (progress) {
                progress.textContent = `✅ ${file.name} uploaded — indexing in background.`;
                setTimeout(() => { progress.style.display = 'none'; }, 3000);
            }
            loadDocuments(projectId);
        } catch (e) {
            if (progress) {
                progress.textContent = `⚠ Upload failed: ${e.message}`;
                progress.style.background = '#fef2f2';
                progress.style.color = '#ef4444';
                setTimeout(() => {
                    progress.style.display = 'none';
                    progress.style.background = '';
                    progress.style.color = '';
                }, 5000);
            }
            throw e;
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CREATE FINDING MODAL
    // ══════════════════════════════════════════════════════════════════════════
    function showCreateFindingModal(projectId, prefill) {
        prefill = prefill || {};
        const typeOpts = FINDING_TYPES.map(([v, l]) =>
            `<option value="${esc(v)}" ${v === 'potential_concern' ? 'selected' : ''}>${esc(l)}</option>`
        ).join('');

        const bodyHtml = `
            <div class="form-group">
                <label>Title <span style="color:#ef4444">*</span></label>
                <input class="form-control" id="ss-f-title" value="${esc(prefill.title || '')}">
            </div>
            <div class="form-group">
                <label>Finding Type</label>
                <select class="form-control" id="ss-f-type">${typeOpts}</select>
            </div>
            <div class="form-group">
                <label>Source Clause / Reference</label>
                <input class="form-control" id="ss-f-clause" value="${esc(prefill.source_clause || '')}" placeholder="e.g. §3.04, Clause 7.2">
            </div>
            <div class="form-group">
                <label>Requirement / Excerpt</label>
                <textarea class="form-control" id="ss-f-req" rows="3" placeholder="Paste the relevant specification text…">${esc(prefill.requirement_text || '')}</textarea>
            </div>
            <div class="form-group">
                <label>AI Assessment</label>
                <textarea class="form-control" id="ss-f-ai" rows="3" style="font-size:0.82rem;color:var(--text-secondary)">${esc(prefill.ai_assessment || '')}</textarea>
            </div>
            <div id="ss-f-err" style="color:#ef4444;font-size:0.85rem;display:none"></div>`;

        const uiModal = UI.modal('Create Finding', bodyHtml, {
            width: '540px',
            submitLabel: 'Save Finding',
        });

        uiModal.submitBtn.addEventListener('click', async () => {
            const title = uiModal.q('#ss-f-title').value.trim();
            const errEl = uiModal.q('#ss-f-err');
            if (!title) {
                errEl.textContent = 'Title is required.';
                errEl.style.display = '';
                return;
            }
            errEl.style.display = 'none';
            const restore = UI.btnLoading(uiModal.submitBtn, 'Saving…');
            try {
                await api('POST', '/findings', {
                    project_id:       projectId,
                    question_id:      prefill.question_id || null,
                    title,
                    finding_type:     uiModal.q('#ss-f-type').value,
                    source_clause:    uiModal.q('#ss-f-clause').value.trim() || null,
                    requirement_text: uiModal.q('#ss-f-req').value.trim() || null,
                    ai_assessment:    uiModal.q('#ss-f-ai').value.trim() || null,
                    confidence_score: prefill.confidence_score || null,
                });
                uiModal.close();
                // If findings tab is active, refresh it
                if (_currentTab === 'findings') loadFindings(projectId);
            } catch (e) {
                errEl.textContent = e.message;
                errEl.style.display = '';
                restore();
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FINDINGS PANEL
    // ══════════════════════════════════════════════════════════════════════════
    async function loadFindings(projectId) {
        const panel = _container.querySelector('#ss-findings-panel');
        if (!panel) return;
        panel.innerHTML = spinner('Loading findings…');

        let findings;
        try {
            findings = await api('GET', `/findings?project_id=${encodeURIComponent(projectId)}`);
        } catch (e) {
            panel.innerHTML = `<div style="padding:16px;color:#ef4444">⚠ ${esc(e.message)}</div>`;
            return;
        }

        renderFindingsPanel(panel, projectId, findings);
    }

    function renderFindingsPanel(panel, projectId, findings) {
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
                <h3 style="margin:0">Findings &amp; Review Records</h3>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-secondary btn-sm" id="ss-findings-refresh">↻ Refresh</button>
                    <button class="btn btn-primary btn-sm" id="ss-findings-new">+ New Finding</button>
                </div>
            </div>
            ${findings.length === 0
                ? `<div class="card" style="text-align:center;padding:40px">
                    <div style="font-size:2rem;margin-bottom:10px">📋</div>
                    <h4>No Findings Yet</h4>
                    <p style="color:var(--text-muted);font-size:0.9rem">
                        Ask a question and click <em>+ Create Finding</em> to create a review record,
                        or click <em>+ New Finding</em> to create one manually.
                    </p>
                   </div>`
                : `<div class="card">
                    <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border-color)">
                                <th style="padding:10px 12px;text-align:left;font-weight:600">Finding</th>
                                <th style="padding:10px 12px;text-align:left;font-weight:600">Type</th>
                                <th style="padding:10px 12px;text-align:left;font-weight:600">Status</th>
                                <th style="padding:10px 12px;text-align:left;font-weight:600">Date</th>
                                <th style="padding:10px 12px;text-align:right;font-weight:600">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="ss-findings-tbody">
                            ${findings.map(f => renderFindingRow(f)).join('')}
                        </tbody>
                    </table>
                   </div>`
            }`;

        panel.querySelector('#ss-findings-refresh').addEventListener('click', () => loadFindings(projectId));
        panel.querySelector('#ss-findings-new').addEventListener('click', () => {
            showCreateFindingModal(projectId);
            // After modal save, if still on findings tab, it auto-refreshes
        });

        // Bind review buttons
        panel.querySelectorAll('.ss-finding-review').forEach(btn => {
            btn.addEventListener('click', () => {
                const findingId = btn.dataset.id;
                const f = findings.find(x => x.id === findingId);
                if (f) showReviewFindingModal(f, projectId);
            });
        });

        // Bind delete buttons
        panel.querySelectorAll('.ss-finding-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const findingId = btn.dataset.id;
                const f = findings.find(x => x.id === findingId);
                if (!f) return;
                if (!confirm(`Delete finding "${f.title}"? This cannot be undone.`)) return;
                btn.disabled = true;
                try {
                    await api('DELETE', `/findings/${encodeURIComponent(findingId)}`);
                    loadFindings(projectId);
                } catch (e) {
                    alert('Delete failed: ' + e.message);
                    btn.disabled = false;
                }
            });
        });
    }

    function renderFindingRow(f) {
        return `
        <tr style="border-bottom:1px solid var(--border-color)">
            <td style="padding:10px 12px">
                <div style="font-weight:600;margin-bottom:3px">${esc(f.title)}</div>
                ${f.source_clause ? `<div style="font-size:0.78rem;color:var(--text-muted)">§ ${esc(f.source_clause)}</div>` : ''}
            </td>
            <td style="padding:10px 12px">${findingTypeBadge(f.finding_type)}</td>
            <td style="padding:10px 12px">${findingStatusBadge(f.reviewer_status)}</td>
            <td style="padding:10px 12px;font-size:0.8rem;color:var(--text-muted)">${fmt(f.created_at)}</td>
            <td style="padding:10px 12px;text-align:right;white-space:nowrap">
                <button class="btn btn-secondary btn-sm ss-finding-review" data-id="${esc(f.id)}" style="margin-right:4px">Review</button>
                <button class="btn btn-sm ss-finding-delete" data-id="${esc(f.id)}" style="color:#ef4444;border-color:#ef4444;background:transparent">✕</button>
            </td>
        </tr>`;
    }

    function showReviewFindingModal(finding, projectId) {
        const typeOpts = FINDING_TYPES.map(([v, l]) =>
            `<option value="${esc(v)}" ${v === finding.finding_type ? 'selected' : ''}>${esc(l)}</option>`
        ).join('');

        const statusOpts = [
            ['pending',  'Pending Review'],
            ['accepted', 'Accepted'],
            ['rejected', 'Rejected'],
            ['override', 'Overridden'],
        ].map(([v, l]) =>
            `<option value="${esc(v)}" ${v === finding.reviewer_status ? 'selected' : ''}>${esc(l)}</option>`
        ).join('');

        const bodyHtml = `
            <div class="form-group">
                <label style="font-size:0.8rem;color:var(--text-muted)">Finding</label>
                <div style="font-weight:600;margin-top:4px">${esc(finding.title)}</div>
                ${finding.source_clause ? `<div style="font-size:0.82rem;color:var(--text-muted)">§ ${esc(finding.source_clause)}</div>` : ''}
            </div>
            ${finding.ai_assessment ? `
            <div class="form-group">
                <label style="font-size:0.8rem;color:var(--text-muted)">AI Assessment</label>
                <div style="font-size:0.82rem;line-height:1.5;color:var(--text-secondary);background:var(--bg-surface,#1c2746);border-radius:6px;padding:10px;margin-top:4px;max-height:120px;overflow-y:auto">${esc(finding.ai_assessment.slice(0, 600))}${finding.ai_assessment.length > 600 ? '…' : ''}</div>
            </div>` : ''}
            <div class="form-group">
                <label>Finding Type</label>
                <select class="form-control" id="ss-r-type">${typeOpts}</select>
            </div>
            <div class="form-group">
                <label>Reviewer Status</label>
                <select class="form-control" id="ss-r-status">${statusOpts}</select>
            </div>
            <div class="form-group">
                <label>Reviewer Comments</label>
                <textarea class="form-control" id="ss-r-comments" rows="3" placeholder="Add your review notes…">${esc(finding.reviewer_comments || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Final Disposition</label>
                <input class="form-control" id="ss-r-disposition" value="${esc(finding.final_disposition || '')}" placeholder="e.g. No action required, RFI submitted">
            </div>
            <div id="ss-r-err" style="color:#ef4444;font-size:0.85rem;display:none"></div>`;

        const uiModal = UI.modal('Review Finding', bodyHtml, {
            width: '540px',
            submitLabel: 'Save Review',
        });

        uiModal.submitBtn.addEventListener('click', async () => {
            const errEl = uiModal.q('#ss-r-err');
            errEl.style.display = 'none';
            const restore = UI.btnLoading(uiModal.submitBtn, 'Saving…');
            try {
                await api('PATCH', `/findings/${encodeURIComponent(finding.id)}`, {
                    finding_type:     uiModal.q('#ss-r-type').value,
                    reviewer_status:  uiModal.q('#ss-r-status').value,
                    reviewer_comments: uiModal.q('#ss-r-comments').value.trim() || null,
                    final_disposition: uiModal.q('#ss-r-disposition').value.trim() || null,
                });
                uiModal.close();
                loadFindings(projectId);
            } catch (e) {
                errEl.textContent = e.message;
                errEl.style.display = '';
                restore();
            }
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        render(container) {
            _container = container;
            _currentProject = null;
            _currentTab = 'docs';
            renderProjects();
        }
    };
}());
