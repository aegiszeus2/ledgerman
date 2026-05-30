// ── Admin Submittals Module ──────────────────────────────────────────────────
// Complete workflow: AI-assisted draft generation, manual creation,
// import/modify, and official submittal register tracking.
//
// Three views:
//   register — official submittal register (state=official)
//   drafts   — AI-generated and imported items awaiting review
//   generate — AI analysis panel (paste spec text → draft items)
// ─────────────────────────────────────────────────────────────────────────────

window.AdminSubmittals = (function () {

    // ── State ─────────────────────────────────────────────────────────────────
    let _container = null;
    let _view      = 'register';   // 'register' | 'drafts' | 'generate'
    let _filter    = { projectId: 'All', status: 'All', specSection: '' };
    let _draftFilter = { projectId: 'All' };

    // ── API helper ────────────────────────────────────────────────────────────
    function _api(method, path, body) {
        const opts = {
            method,
            headers: {
                'Content-Type':  'application/json',
                'Authorization': 'Bearer ' + AppData.getJwt(),
            },
        };
        if (body !== undefined) opts.body = JSON.stringify(body);
        return fetch(AppData.API_BASE + path, opts).then(r =>
            r.json().then(j => {
                if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
                return j;
            })
        );
    }

    // ── Constants ─────────────────────────────────────────────────────────────
    const STATUSES = [
        'Not Started', 'Submitted', 'Under Review',
        'Revise & Resubmit', 'Approved', 'Approved as Noted',
        'Rejected', 'Closed',
    ];

    const TYPES = [
        { value: 'shop_drawing',  label: 'Shop Drawing' },
        { value: 'product_data',  label: 'Product Data' },
        { value: 'sample',        label: 'Sample' },
        { value: 'calculations',  label: 'Calculations' },
        { value: 'test_report',   label: 'Test Report' },
        { value: 'warranty',      label: 'Warranty' },
        { value: 'other',         label: 'Other' },
    ];

    // ── Style helpers ─────────────────────────────────────────────────────────
    function statusBadge(s) {
        const map = {
            'Not Started':        { bg: '#4a4a5a', fg: '#ccc' },
            'Submitted':          { bg: '#0d6efd', fg: '#fff' },
            'Under Review':       { bg: '#fd7e14', fg: '#fff' },
            'Revise & Resubmit':  { bg: '#ffc107', fg: '#333' },
            'Approved':           { bg: '#198754', fg: '#fff' },
            'Approved as Noted':  { bg: '#20c997', fg: '#fff' },
            'Rejected':           { bg: '#dc3545', fg: '#fff' },
            'Closed':             { bg: '#495057', fg: '#ccc' },
        };
        const c = map[s] || { bg: '#555', fg: '#ccc' };
        return `<span style="padding:3px 10px;border-radius:12px;font-size:.72rem;font-weight:600;background:${c.bg};color:${c.fg};white-space:nowrap">${Utils.escapeHtml(s || 'Not Started')}</span>`;
    }

    function sourceBadge(source) {
        const map = {
            manual:    { bg: '#2d4a7a', fg: '#7eb3ff', label: 'Manual' },
            ai_draft:  { bg: '#3d2d6a', fg: '#b38eff', label: '✨ AI Draft' },
            imported:  { bg: '#2d5a3d', fg: '#7ed9a8', label: 'Imported' },
        };
        const c = map[source] || { bg: '#444', fg: '#ccc', label: source };
        return `<span style="padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600;background:${c.bg};color:${c.fg}">${c.label}</span>`;
    }

    function typeBadge(t) {
        const labels = {
            shop_drawing: 'Shop Drawing', product_data: 'Product Data',
            sample: 'Sample', calculations: 'Calculations',
            test_report: 'Test Report', warranty: 'Warranty', other: 'Other',
        };
        return `<span style="font-size:.8rem;color:var(--text2)">${Utils.escapeHtml(labels[t] || t)}</span>`;
    }

    function confidenceBar(val) {
        if (val === null || val === undefined) return '';
        const pct  = Math.round(val * 100);
        const col  = val >= 0.8 ? '#198754' : val >= 0.5 ? '#fd7e14' : '#dc3545';
        return `<div style="display:flex;align-items:center;gap:6px">
            <div style="height:4px;width:60px;background:#333;border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${col}"></div>
            </div>
            <span style="font-size:.72rem;color:${col}">${pct}%</span>
        </div>`;
    }

    // ── Tab bar ───────────────────────────────────────────────────────────────
    function _tabBar(active) {
        const tabs = [
            { id: 'register', icon: '📋', label: 'Register' },
            { id: 'drafts',   icon: '📝', label: 'Draft Review' },
            { id: 'generate', icon: '✨', label: 'AI Generate' },
        ];
        return `<div style="display:flex;gap:2px;margin-bottom:20px;border-bottom:2px solid var(--border)">
            ${tabs.map(t => `
                <button data-tab="${t.id}" class="sub-tab-btn" style="
                    padding:9px 18px;border:none;border-radius:6px 6px 0 0;cursor:pointer;
                    font-size:.88rem;font-weight:600;transition:all .15s;
                    background:${active === t.id ? 'var(--primary)' : 'transparent'};
                    color:${active === t.id ? '#000' : 'var(--text2)'};
                    margin-bottom:-2px;border-bottom:${active === t.id ? '2px solid var(--primary)' : '2px solid transparent'};
                ">${t.icon} ${t.label}</button>
            `).join('')}
        </div>`;
    }

    // ── Entry point ───────────────────────────────────────────────────────────
    function render(container, params) {
        _container = container;
        if (params && params.view) _view = params.view;
        _switchView(_view);
    }

    function _switchView(view) {
        _view = view;
        if (view === 'register') _renderRegister();
        else if (view === 'drafts')   _renderDrafts();
        else if (view === 'generate') _renderGenerate();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REGISTER VIEW — official submittals
    // ══════════════════════════════════════════════════════════════════════════

    async function _renderRegister() {
        _container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text2)">Loading…</div>';

        let items = [];
        try {
            let url = '/api/submittals?state=official';
            if (_filter.projectId !== 'All') url += '&projectId=' + encodeURIComponent(_filter.projectId);
            if (_filter.status    !== 'All') url += '&status='    + encodeURIComponent(_filter.status);
            items = await _api('GET', url);
        } catch (e) {
            _container.innerHTML = `<div style="color:#e74c3c;padding:20px">Failed to load submittals: ${Utils.escapeHtml(e.message)}</div>`;
            return;
        }

        const projects = AppData.getProjects();
        const projMap  = {};
        projects.forEach(p => { projMap[p.id] = p.name; });

        // Filter client-side by spec section
        const specFilter = (_filter.specSection || '').toLowerCase().trim();
        const filtered = specFilter
            ? items.filter(i => (i.specSection || '').toLowerCase().includes(specFilter))
            : items;

        // Summary counts
        const counts = {};
        STATUSES.forEach(s => { counts[s] = 0; });
        filtered.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });

        // Drafts badge count
        let draftCount = 0;
        try {
            const d = await _api('GET', '/api/submittals?state=draft_requirement');
            draftCount = d.length;
        } catch (_) { /* ignore */ }

        _container.innerHTML = `
            ${_tabBar('register')}

            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:8px">
                <div>
                    <h2 style="margin:0 0 4px">Submittal Register</h2>
                    <p style="color:var(--text2);margin:0;font-size:.88rem">Official project submittals — assign, track, and close the review cycle</p>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    ${draftCount > 0 ? `<button id="goToDraftsBtn" class="btn-secondary btn-sm" style="position:relative">
                        📝 Draft Review <span style="background:#fd7e14;color:#fff;font-size:.7rem;padding:1px 6px;border-radius:10px;margin-left:4px">${draftCount}</span>
                    </button>` : ''}
                    <button id="importBtn"    class="btn-secondary btn-sm">↑ Import CSV</button>
                    <button id="addManualBtn" class="btn-primary btn-sm">+ Add Submittal</button>
                </div>
            </div>

            <!-- Summary pills -->
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
                ${[
                    ['All', filtered.length, '#4a4a5a'],
                    ['Approved', counts['Approved'] + counts['Approved as Noted'], '#198754'],
                    ['Under Review', counts['Under Review'], '#fd7e14'],
                    ['Revise & Resubmit', counts['Revise & Resubmit'], '#ffc107'],
                    ['Rejected', counts['Rejected'], '#dc3545'],
                ].map(([label, count, color]) => `
                    <div style="padding:6px 14px;background:var(--card);border:1px solid var(--border);border-radius:20px;font-size:.82rem">
                        <span style="color:${color};font-weight:700">${count}</span>
                        <span style="color:var(--text2);margin-left:4px">${label}</span>
                    </div>
                `).join('')}
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:flex-end">
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                    <select id="filterProject" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${_filter.projectId === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Status</label>
                    <select id="filterStatus" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem">
                        <option value="All">All Statuses</option>
                        ${STATUSES.map(s => `<option value="${s}" ${_filter.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Spec Section</label>
                    <input type="text" id="filterSpec" value="${Utils.escapeHtml(_filter.specSection)}" placeholder="e.g. 03 30 00"
                        style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem;width:130px">
                </div>
                <button id="exportCsvBtn" class="btn-secondary btn-sm" style="margin-bottom:0">Export CSV</button>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse;min-width:900px">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:10px 12px;text-align:left;font-size:.8rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border);white-space:nowrap">#</th>
                            <th style="padding:10px 12px;text-align:left;font-size:.8rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border);white-space:nowrap">Spec Section</th>
                            <th style="padding:10px 12px;text-align:left;font-size:.8rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Title</th>
                            <th style="padding:10px 12px;text-align:left;font-size:.8rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Type</th>
                            <th style="padding:10px 12px;text-align:left;font-size:.8rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Project</th>
                            <th style="padding:10px 12px;text-align:center;font-size:.8rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Status</th>
                            <th style="padding:10px 12px;text-align:left;font-size:.8rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border);white-space:nowrap">Submitted By</th>
                            <th style="padding:10px 12px;text-align:left;font-size:.8rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border);white-space:nowrap">Required By</th>
                            <th style="padding:10px 12px;text-align:center;font-size:.8rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(item => {
                            const projName = projMap[item.projectId] || '—';
                            const isOverdue = item.requiredByDate && item.status === 'Not Started' && new Date(item.requiredByDate) < new Date();
                            return `
                                <tr style="border-bottom:1px solid var(--border);${isOverdue ? 'background:rgba(220,53,69,.04)' : ''}">
                                    <td style="padding:10px 12px;font-weight:600;color:var(--primary);white-space:nowrap">${Utils.escapeHtml(item.submittalNumber || '—')}</td>
                                    <td style="padding:10px 12px;font-size:.85rem;white-space:nowrap">${Utils.escapeHtml(item.specSection || '—')}</td>
                                    <td style="padding:10px 12px">
                                        <div style="font-weight:500">${Utils.escapeHtml(item.title)}</div>
                                        ${item.reviewer ? `<div style="font-size:.78rem;color:var(--text2);margin-top:2px">Reviewer: ${Utils.escapeHtml(item.reviewer)}</div>` : ''}
                                        ${isOverdue ? '<div style="font-size:.72rem;color:#dc3545;margin-top:2px">⚠ Overdue</div>' : ''}
                                    </td>
                                    <td style="padding:10px 12px">${typeBadge(item.submittalType)}</td>
                                    <td style="padding:10px 12px;font-size:.85rem">${Utils.escapeHtml(projName)}</td>
                                    <td style="padding:10px 12px;text-align:center">${statusBadge(item.status)}</td>
                                    <td style="padding:10px 12px;font-size:.85rem">${Utils.escapeHtml(item.submittedBy || '—')}</td>
                                    <td style="padding:10px 12px;font-size:.85rem;white-space:nowrap">${item.requiredByDate || '—'}</td>
                                    <td style="padding:10px 12px;text-align:center;white-space:nowrap">
                                        <button class="btn-secondary btn-sm" data-id="${item.id}" data-action="edit">Edit</button>
                                        <button class="btn-secondary btn-sm" data-id="${item.id}" data-action="delete" style="margin-left:4px">Delete</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="9">
                                    <div style="text-align:center;padding:60px 20px;color:var(--text2)">
                                        <div style="font-size:2.5rem;margin-bottom:12px">📋</div>
                                        <div style="font-weight:600;margin-bottom:6px">No submittals in register</div>
                                        <div style="font-size:.88rem;margin-bottom:20px">Add manually, import from CSV, or generate from spec documents</div>
                                        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
                                            <button id="emptyAddBtn" class="btn-primary">+ Add Manually</button>
                                            <button id="emptyAiBtn" class="btn-secondary">✨ Generate from Docs</button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        `;

        // Bind events
        _container.querySelector('#filterProject').onchange = e => { _filter.projectId = e.target.value; _renderRegister(); };
        _container.querySelector('#filterStatus').onchange  = e => { _filter.status    = e.target.value; _renderRegister(); };
        _container.querySelector('#filterSpec').oninput     = e => { _filter.specSection = e.target.value; _renderRegister(); };

        _container.querySelector('#addManualBtn').onclick = () => _showForm(null, 'official');
        const goToDrafts = _container.querySelector('#goToDraftsBtn');
        if (goToDrafts) goToDrafts.onclick = () => _switchView('drafts');
        const emptyAdd = _container.querySelector('#emptyAddBtn');
        if (emptyAdd) emptyAdd.onclick = () => _showForm(null, 'official');
        const emptyAi = _container.querySelector('#emptyAiBtn');
        if (emptyAi) emptyAi.onclick = () => _switchView('generate');

        _container.querySelector('#importBtn').onclick = () => _showImport();

        _container.querySelector('#exportCsvBtn').onclick = () => _exportCsv(filtered, projMap);

        _container.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = () => _showForm(btn.dataset.id, null);
        });
        _container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = () => _deleteItem(btn.dataset.id, _renderRegister);
        });

        // Bind tab buttons
        _container.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.onclick = () => _switchView(btn.dataset.tab);
        });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // DRAFTS VIEW — review AI-generated and imported draft items
    // ══════════════════════════════════════════════════════════════════════════

    async function _renderDrafts() {
        _container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text2)">Loading draft items…</div>';

        let items = [];
        try {
            let url = '/api/submittals?state=draft_requirement';
            if (_draftFilter.projectId !== 'All') url += '&projectId=' + encodeURIComponent(_draftFilter.projectId);
            items = await _api('GET', url);
        } catch (e) {
            _container.innerHTML = `<div style="color:#e74c3c;padding:20px">Failed to load drafts: ${Utils.escapeHtml(e.message)}</div>`;
            return;
        }

        const projects = AppData.getProjects();
        const projMap  = {};
        projects.forEach(p => { projMap[p.id] = p.name; });

        _container.innerHTML = `
            ${_tabBar('drafts')}

            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:8px">
                <div>
                    <h2 style="margin:0 0 4px">Draft Review</h2>
                    <p style="color:var(--text2);margin:0;font-size:.88rem">
                        Review AI-generated and imported draft requirements. Accept to promote to the official register.
                        <strong style="color:#fd7e14"> AI items never become official automatically.</strong>
                    </p>
                </div>
                <button id="generateMoreBtn" class="btn-secondary btn-sm">✨ Generate More</button>
            </div>

            <!-- Filter -->
            <div style="display:flex;gap:10px;margin-bottom:16px;align-items:flex-end">
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                    <select id="draftFilterProject" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${_draftFilter.projectId === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
            </div>

            ${items.length === 0 ? `
                <div style="text-align:center;padding:60px 20px;color:var(--text2);background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="font-size:2.5rem;margin-bottom:12px">📝</div>
                    <div style="font-weight:600;margin-bottom:6px">No draft items awaiting review</div>
                    <div style="font-size:.88rem;margin-bottom:20px">Use AI Generate to analyse spec documents, or import a CSV</div>
                    <button id="emptyGenerateBtn" class="btn-primary">✨ Generate from Docs</button>
                </div>
            ` : `
                <div style="display:flex;justify-content:flex-end;margin-bottom:12px;gap:8px">
                    <button id="acceptAllBtn" class="btn-secondary btn-sm">✓ Accept All Shown (${items.length})</button>
                    <button id="deleteAllBtn" class="btn-secondary btn-sm" style="color:#dc3545">✕ Discard All Shown</button>
                </div>
                <div id="draftList">
                    ${items.map(item => _draftCard(item, projMap)).join('')}
                </div>
            `}
        `;

        _container.querySelector('#draftFilterProject').onchange = e => { _draftFilter.projectId = e.target.value; _renderDrafts(); };
        _container.querySelector('#generateMoreBtn').onclick = () => _switchView('generate');

        const emptyGen = _container.querySelector('#emptyGenerateBtn');
        if (emptyGen) emptyGen.onclick = () => _switchView('generate');

        const acceptAll = _container.querySelector('#acceptAllBtn');
        if (acceptAll) acceptAll.onclick = () => _acceptAll(items);

        const deleteAll = _container.querySelector('#deleteAllBtn');
        if (deleteAll) deleteAll.onclick = async () => {
            if (!confirm(`Discard all ${items.length} draft items? This cannot be undone.`)) return;
            deleteAll.disabled = true; deleteAll.textContent = 'Discarding…';
            try {
                await Promise.all(items.map(i => _api('DELETE', '/api/submittals/' + i.id)));
                Utils.showToast('All draft items discarded', 'success');
                _renderDrafts();
            } catch (e) { Utils.showToast('Error: ' + e.message, 'error'); deleteAll.disabled = false; deleteAll.textContent = '✕ Discard All'; }
        };

        // Bind per-card buttons
        _container.querySelectorAll('[data-card-id]').forEach(card => {
            const id = card.dataset.cardId;
            const acceptBtn = card.querySelector('[data-card-action="accept"]');
            const editBtn   = card.querySelector('[data-card-action="edit"]');
            const delBtn    = card.querySelector('[data-card-action="discard"]');
            if (acceptBtn) acceptBtn.onclick = () => _acceptDraft(id, acceptBtn);
            if (editBtn)   editBtn.onclick   = () => _showForm(id, null);
            if (delBtn)    delBtn.onclick    = () => _deleteItem(id, _renderDrafts);
        });

        _container.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.onclick = () => _switchView(btn.dataset.tab);
        });
    }

    function _draftCard(item, projMap) {
        const projName = projMap[item.projectId] || '—';
        const confBar  = item.source === 'ai_draft' ? confidenceBar(item.aiConfidence) : '';
        return `
            <div data-card-id="${item.id}" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
                    <div style="flex:1;min-width:200px">
                        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
                            ${sourceBadge(item.source)}
                            <span style="font-weight:600;font-size:.95rem">${Utils.escapeHtml(item.title)}</span>
                        </div>
                        ${item.specSection ? `<div style="font-size:.82rem;color:var(--text2);margin-bottom:4px">Spec: <strong>${Utils.escapeHtml(item.specSection)}</strong></div>` : ''}
                        <div style="font-size:.82rem;color:var(--text2);margin-bottom:4px">Project: ${Utils.escapeHtml(projName)} &nbsp;·&nbsp; Type: ${Utils.escapeHtml(item.submittalType.replace('_', ' '))}</div>
                        ${item.sourceSection ? `<div style="font-size:.8rem;color:var(--text2)">Found in: <em>${Utils.escapeHtml(item.sourceSection)}</em></div>` : ''}
                        ${item.sourceWording ? `
                            <div style="font-size:.8rem;color:#a0b4cc;margin-top:6px;padding:6px 10px;background:rgba(255,255,255,.04);border-left:3px solid var(--primary);border-radius:0 4px 4px 0;font-style:italic">
                                "${Utils.escapeHtml(item.sourceWording.substring(0, 200))}${item.sourceWording.length > 200 ? '…' : ''}"
                            </div>
                        ` : ''}
                        ${confBar ? `<div style="margin-top:8px">${confBar}</div>` : ''}
                        ${item.notes ? `<div style="font-size:.8rem;color:var(--text2);margin-top:4px">${Utils.escapeHtml(item.notes)}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap">
                        <button data-card-action="accept" class="btn-primary btn-sm">✓ Accept</button>
                        <button data-card-action="edit"   class="btn-secondary btn-sm">Edit</button>
                        <button data-card-action="discard" class="btn-secondary btn-sm" style="color:#dc3545">Discard</button>
                    </div>
                </div>
            </div>
        `;
    }

    async function _acceptDraft(id, btn) {
        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = '…';
        try {
            await _api('POST', '/api/submittals/' + id + '/accept', {});
            Utils.showToast('Submittal accepted and added to register', 'success');
            _renderDrafts();
        } catch (e) {
            Utils.showToast('Accept failed: ' + e.message, 'error');
            btn.disabled = false; btn.textContent = orig;
        }
    }

    async function _acceptAll(items) {
        const btn = _container.querySelector('#acceptAllBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Accepting…'; }
        try {
            await Promise.all(items.map(i => _api('POST', '/api/submittals/' + i.id + '/accept', {})));
            Utils.showToast(`${items.length} item(s) accepted and added to register`, 'success');
            _renderDrafts();
        } catch (e) {
            Utils.showToast('Error: ' + e.message, 'error');
            if (btn) { btn.disabled = false; btn.textContent = `✓ Accept All (${items.length})`; }
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // AI GENERATE VIEW
    // ══════════════════════════════════════════════════════════════════════════

    function _renderGenerate() {
        const projects = AppData.getProjects();

        _container.innerHTML = `
            ${_tabBar('generate')}

            <div style="max-width:760px">
                <h2 style="margin:0 0 4px">AI Generate from Specification</h2>
                <p style="color:var(--text2);margin:0 0 20px;font-size:.88rem">
                    Paste specification or contract language and Claude will identify every submittal requirement.
                    Results are <strong>draft items</strong> — you review and accept each one individually.
                </p>

                <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px;margin-bottom:20px">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.88rem">Project (optional)</label>
                            <select id="aiProjectId" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem">
                                <option value="">— Not project-specific —</option>
                                ${projects.map(p => `<option value="${p.id}">${Utils.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.88rem">Document Name</label>
                            <input type="text" id="aiDocName" value="Project Specification" placeholder="e.g. Division 03 — Concrete"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem;box-sizing:border-box">
                        </div>
                    </div>

                    <div style="margin-bottom:16px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.88rem">Specification / Contract Text *</label>
                        <textarea id="aiDocText" rows="12" placeholder="Paste specification or contract language here…&#10;&#10;Example: Section 03 30 00 — Cast-in-Place Concrete&#10;1.4 SUBMITTALS&#10;A. Product Data: Submit manufacturer's product data for each type of admixture, curing compound, and form-release agent.&#10;B. Design Mix: Submit design mix for each type of concrete…"
                            style="width:100%;padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem;resize:vertical;font-family:inherit;box-sizing:border-box"></textarea>
                        <div style="text-align:right;font-size:.75rem;color:var(--text2);margin-top:4px">Max 12,000 characters</div>
                    </div>

                    <div style="display:flex;gap:8px;align-items:center">
                        <button id="aiGenerateBtn" class="btn-primary">✨ Analyse &amp; Find Submittals</button>
                        <span id="aiStatus" style="font-size:.85rem;color:var(--text2)"></span>
                    </div>
                </div>

                <!-- Results appear here -->
                <div id="aiResults"></div>
            </div>
        `;

        _container.querySelector('#aiGenerateBtn').onclick = _runAiGenerate;

        _container.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.onclick = () => _switchView(btn.dataset.tab);
        });
    }

    async function _runAiGenerate() {
        const btn       = _container.querySelector('#aiGenerateBtn');
        const statusEl  = _container.querySelector('#aiStatus');
        const resultsEl = _container.querySelector('#aiResults');
        const docText   = _container.querySelector('#aiDocText').value.trim();
        const docName   = _container.querySelector('#aiDocName').value.trim() || 'Project Specification';
        const projectId = _container.querySelector('#aiProjectId').value;

        if (!docText) {
            Utils.showToast('Please paste some specification text first', 'error');
            return;
        }

        btn.disabled = true;
        statusEl.textContent = 'Analysing…';
        resultsEl.innerHTML  = '<div style="padding:20px;text-align:center;color:var(--text2)">🔍 Claude is reading your specification…</div>';

        let result;
        try {
            result = await _api('POST', '/api/submittals/ai-generate', {
                docText,
                docName,
                projectId,
            });
        } catch (e) {
            statusEl.textContent = '';
            resultsEl.innerHTML  = `<div style="color:#dc3545;padding:12px;background:var(--card);border-radius:6px;border:1px solid var(--border)">Error: ${Utils.escapeHtml(e.message)}</div>`;
            btn.disabled = false;
            return;
        }

        btn.disabled     = false;
        statusEl.textContent = '';

        const items = result.items || [];
        if (items.length === 0) {
            resultsEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text2);background:var(--card);border-radius:8px;border:1px solid var(--border)">
                <div style="font-size:1.5rem;margin-bottom:8px">🤔</div>
                No submittal requirements were found in the provided text. Try a different section.
            </div>`;
            return;
        }

        // Show results with save controls
        resultsEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
                <div style="font-weight:600">Found <span style="color:var(--primary)">${items.length}</span> potential submittal requirement${items.length !== 1 ? 's' : ''}</div>
                <div style="display:flex;gap:8px">
                    <button id="saveAllDraftsBtn" class="btn-primary">Save All as Drafts (${items.length})</button>
                </div>
            </div>
            <div id="aiItemsList">
                ${items.map((item, idx) => `
                    <div data-ai-idx="${idx}" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:10px">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
                            <div style="flex:1;min-width:200px">
                                <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
                                    ${sourceBadge('ai_draft')}
                                    ${confidenceBar(item.confidence)}
                                    <span style="font-weight:600">${Utils.escapeHtml(item.title)}</span>
                                </div>
                                ${item.specSection ? `<div style="font-size:.82rem;color:var(--text2);margin-bottom:2px">Spec section: <strong>${Utils.escapeHtml(item.specSection)}</strong></div>` : ''}
                                <div style="font-size:.8rem;color:var(--text2)">Type: ${Utils.escapeHtml(item.submittalType.replace(/_/g,' '))}${item.sourceSection ? ` &nbsp;·&nbsp; ${Utils.escapeHtml(item.sourceSection)}` : ''}</div>
                                ${item.sourceWording ? `<div style="font-size:.78rem;color:#a0b4cc;margin-top:6px;padding:5px 10px;background:rgba(255,255,255,.04);border-left:2px solid var(--primary);border-radius:0 4px 4px 0;font-style:italic">"${Utils.escapeHtml(item.sourceWording.substring(0, 200))}${item.sourceWording.length > 200 ? '…' : ''}"</div>` : ''}
                                ${item.notes ? `<div style="font-size:.78rem;color:var(--text2);margin-top:4px">Note: ${Utils.escapeHtml(item.notes)}</div>` : ''}
                            </div>
                            <button data-ai-save="${idx}" class="btn-secondary btn-sm">Save Draft</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Save individual item
        _container.querySelectorAll('[data-ai-save]').forEach(btn => {
            btn.onclick = () => _saveAiItem(btn, items[parseInt(btn.dataset.aiSave)], projectId, docName);
        });

        // Save all
        _container.querySelector('#saveAllDraftsBtn').onclick = () => _saveAllAiItems(items, projectId, docName);
    }

    async function _saveAiItem(btn, item, projectId, docName) {
        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = '…';
        try {
            await _api('POST', '/api/submittals', {
                title:          item.title,
                specSection:    item.specSection,
                submittalType:  item.submittalType,
                source:         'ai_draft',
                state:          'draft_requirement',
                sourceDocName:  docName,
                sourcePageRef:  item.sourcePageRef || '',
                sourceSection:  item.sourceSection || '',
                sourceWording:  item.sourceWording || '',
                aiConfidence:   item.confidence,
                notes:          item.notes || '',
                projectId:      projectId,
            });
            btn.textContent = '✓ Saved';
            btn.style.color = '#198754';
        } catch (e) {
            Utils.showToast('Save failed: ' + e.message, 'error');
            btn.disabled = false; btn.textContent = orig;
        }
    }

    async function _saveAllAiItems(items, projectId, docName) {
        const btn = _container.querySelector('#saveAllDraftsBtn');
        btn.disabled = true; btn.textContent = `Saving ${items.length} items…`;
        try {
            const body = items.map(item => ({
                title:         item.title,
                specSection:   item.specSection,
                submittalType: item.submittalType,
                source:        'ai_draft',
                state:         'draft_requirement',
                sourceDocName: docName,
                sourcePageRef: item.sourcePageRef || '',
                sourceSection: item.sourceSection || '',
                sourceWording: item.sourceWording || '',
                aiConfidence:  item.confidence,
                notes:         item.notes || '',
                projectId:     projectId,
            }));
            const result = await _api('POST', '/api/submittals/bulk-import', { projectId, items: body });
            Utils.showToast(`${result.created} draft items saved — go to Draft Review to accept them`, 'success');
            // Mark all individual save buttons as saved
            _container.querySelectorAll('[data-ai-save]').forEach(b => {
                b.textContent = '✓ Saved'; b.disabled = true; b.style.color = '#198754';
            });
            btn.textContent = `✓ ${result.created} Saved`;
        } catch (e) {
            Utils.showToast('Error: ' + e.message, 'error');
            btn.disabled = false; btn.textContent = `Save All as Drafts (${items.length})`;
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ADD / EDIT FORM
    // ══════════════════════════════════════════════════════════════════════════

    async function _showForm(itemId, forceState) {
        const projects = AppData.getProjects();
        let item = null;

        if (itemId) {
            try {
                item = await _api('GET', '/api/submittals/' + itemId);
            } catch (e) {
                Utils.showToast('Failed to load submittal: ' + e.message, 'error');
                return;
            }
        }

        const isNew    = !item;
        const v        = (f, def) => item ? (item[f] !== undefined ? item[f] : def) : def;
        const inp      = 'style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem;box-sizing:border-box"';
        const lbl      = 'style="display:block;font-weight:500;margin-bottom:6px;font-size:.88rem"';
        const fld      = 'style="margin-bottom:14px"';
        const stateVal = forceState || v('state', 'official');

        _container.innerHTML = `
            <div style="max-width:720px;margin:0 auto">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
                    <button id="backBtn" class="btn-secondary btn-sm">← Back</button>
                    <h2 style="margin:0">${isNew ? 'New Submittal' : 'Edit Submittal'}</h2>
                    ${!isNew && item.source !== 'manual' ? sourceBadge(item.source) : ''}
                </div>

                ${!isNew && item.state === 'draft_requirement' ? `
                    <div style="padding:12px 16px;background:rgba(253,126,20,.1);border:1px solid rgba(253,126,20,.3);border-radius:6px;margin-bottom:16px;font-size:.88rem">
                        ⚠ This is a <strong>draft item</strong> — it is not yet in the official register.
                        Save your edits, then return to Draft Review and click Accept to make it official.
                    </div>
                ` : ''}

                <form id="submittalForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:24px">

                    <!-- Row 1: Project + Number -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label ${lbl}>Project *</label>
                            <select id="fProjectId" ${inp} required>
                                <option value="">— Select Project —</option>
                                ${projects.map(p => `<option value="${p.id}" ${v('projectId','') === p.id ? 'selected':''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label ${lbl}>Submittal Number</label>
                            <input type="text" id="fNumber" value="${Utils.escapeHtml(v('submittalNumber',''))}" placeholder="e.g. SUB-001" ${inp}>
                        </div>
                    </div>

                    <!-- Row 2: Spec Section + Type -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label ${lbl}>Spec Section</label>
                            <input type="text" id="fSpecSection" value="${Utils.escapeHtml(v('specSection',''))}" placeholder="e.g. 03 30 00" ${inp}>
                        </div>
                        <div>
                            <label ${lbl}>Type</label>
                            <select id="fType" ${inp}>
                                ${TYPES.map(t => `<option value="${t.value}" ${v('submittalType','shop_drawing') === t.value ? 'selected':''}>${t.label}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Title -->
                    <div ${fld}>
                        <label ${lbl}>Title *</label>
                        <input type="text" id="fTitle" value="${Utils.escapeHtml(v('title',''))}" placeholder="e.g. Concrete Mix Design" ${inp} required>
                    </div>

                    <!-- Description -->
                    <div ${fld}>
                        <label ${lbl}>Description</label>
                        <textarea id="fDesc" rows="3" ${inp}>${Utils.escapeHtml(v('description',''))}</textarea>
                    </div>

                    <!-- Row 3: Status + State -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label ${lbl}>Status</label>
                            <select id="fStatus" ${inp}>
                                ${STATUSES.map(s => `<option value="${s}" ${v('status','Not Started') === s ? 'selected':''}>${s}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label ${lbl}>Register State</label>
                            <select id="fState" ${inp}>
                                <option value="draft_requirement" ${stateVal === 'draft_requirement' ? 'selected':''}>Draft Requirement (not official)</option>
                                <option value="official"          ${stateVal === 'official'          ? 'selected':''}>Official (in register)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Row 4: Responsibility -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label ${lbl}>Submitted By</label>
                            <input type="text" id="fSubmittedBy" value="${Utils.escapeHtml(v('submittedBy',''))}" placeholder="Subcontractor or name" ${inp}>
                        </div>
                        <div>
                            <label ${lbl}>Reviewer / Architect</label>
                            <input type="text" id="fReviewer" value="${Utils.escapeHtml(v('reviewer',''))}" placeholder="Architect, engineer, etc." ${inp}>
                        </div>
                    </div>

                    <!-- Row 5: Dates -->
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label ${lbl}>Required By</label>
                            <input type="date" id="fRequiredDate" value="${v('requiredByDate','')}" ${inp}>
                        </div>
                        <div>
                            <label ${lbl}>Submitted Date</label>
                            <input type="date" id="fSubmittedDate" value="${v('submittedDate','')}" ${inp}>
                        </div>
                        <div>
                            <label ${lbl}>Returned Date</label>
                            <input type="date" id="fReturnedDate" value="${v('returnedDate','')}" ${inp}>
                        </div>
                    </div>

                    <!-- Notes -->
                    <div ${fld}>
                        <label ${lbl}>Notes</label>
                        <textarea id="fNotes" rows="3" placeholder="Internal notes, revision comments…" ${inp}>${Utils.escapeHtml(v('notes',''))}</textarea>
                    </div>

                    <!-- AI Traceability (show if source is ai_draft) -->
                    ${item && item.source === 'ai_draft' ? `
                        <details style="margin-bottom:14px">
                            <summary style="cursor:pointer;font-size:.88rem;font-weight:500;color:var(--text2);margin-bottom:8px">✨ AI Source Traceability</summary>
                            <div style="padding:12px;background:rgba(99,102,241,.07);border-radius:6px;border:1px solid rgba(99,102,241,.2)">
                                <div style="font-size:.82rem;margin-bottom:6px"><strong>Document:</strong> ${Utils.escapeHtml(item.sourceDocName || '—')}</div>
                                ${item.sourceSection ? `<div style="font-size:.82rem;margin-bottom:6px"><strong>Section:</strong> ${Utils.escapeHtml(item.sourceSection)}</div>` : ''}
                                ${item.sourcePageRef ? `<div style="font-size:.82rem;margin-bottom:6px"><strong>Page/Ref:</strong> ${Utils.escapeHtml(item.sourcePageRef)}</div>` : ''}
                                ${item.sourceWording ? `<div style="font-size:.82rem;margin-bottom:6px"><strong>Source wording:</strong><br><em style="color:#a0b4cc">"${Utils.escapeHtml(item.sourceWording)}"</em></div>` : ''}
                                ${item.aiConfidence !== null && item.aiConfidence !== undefined ? `<div style="font-size:.82rem"><strong>AI Confidence:</strong> ${confidenceBar(item.aiConfidence)}</div>` : ''}
                            </div>
                        </details>
                    ` : ''}

                    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
                        <button type="button" id="cancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary" id="saveBtn">${isNew ? 'Create Submittal' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        `;

        _container.querySelector('#backBtn').onclick  = () => _switchView(_view === 'generate' ? 'register' : _view);
        _container.querySelector('#cancelBtn').onclick = () => _switchView(item && item.state === 'draft_requirement' ? 'drafts' : 'register');

        _container.querySelector('#submittalForm').onsubmit = async (e) => {
            e.preventDefault();
            const saveBtn = _container.querySelector('#saveBtn');
            saveBtn.disabled = true; saveBtn.textContent = 'Saving…';

            const payload = {
                projectId:       _container.querySelector('#fProjectId').value,
                submittalNumber: _container.querySelector('#fNumber').value.trim(),
                specSection:     _container.querySelector('#fSpecSection').value.trim(),
                submittalType:   _container.querySelector('#fType').value,
                title:           _container.querySelector('#fTitle').value.trim(),
                description:     _container.querySelector('#fDesc').value.trim(),
                status:          _container.querySelector('#fStatus').value,
                state:           _container.querySelector('#fState').value,
                submittedBy:     _container.querySelector('#fSubmittedBy').value.trim(),
                reviewer:        _container.querySelector('#fReviewer').value.trim(),
                requiredByDate:  _container.querySelector('#fRequiredDate').value,
                submittedDate:   _container.querySelector('#fSubmittedDate').value,
                returnedDate:    _container.querySelector('#fReturnedDate').value,
                notes:           _container.querySelector('#fNotes').value.trim(),
            };

            if (!payload.title) {
                Utils.showToast('Title is required', 'error');
                saveBtn.disabled = false; saveBtn.textContent = isNew ? 'Create Submittal' : 'Save Changes';
                return;
            }

            try {
                if (isNew) {
                    payload.source = 'manual';
                    await _api('POST', '/api/submittals', payload);
                    Utils.showToast('Submittal created', 'success');
                } else {
                    await _api('PUT', '/api/submittals/' + item.id, payload);
                    Utils.showToast('Submittal updated', 'success');
                }
                _switchView(payload.state === 'draft_requirement' ? 'drafts' : 'register');
            } catch (err) {
                Utils.showToast('Save failed: ' + err.message, 'error');
                saveBtn.disabled = false; saveBtn.textContent = isNew ? 'Create Submittal' : 'Save Changes';
            }
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // IMPORT CSV
    // ══════════════════════════════════════════════════════════════════════════

    function _showImport() {
        const projects = AppData.getProjects();
        const overlay  = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';

        overlay.innerHTML = `
            <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:12px;padding:28px;width:100%;max-width:560px;max-height:80vh;overflow-y:auto">
                <h3 style="margin:0 0 12px">Import Submittal Register</h3>
                <p style="color:var(--text2);font-size:.88rem;margin-bottom:16px">
                    Paste CSV data below. Required column: <code>title</code>. Optional: <code>submittalNumber, specSection, submittalType, status, submittedBy, reviewer, requiredByDate, notes</code>
                </p>
                <div style="margin-bottom:14px">
                    <label style="display:block;font-size:.88rem;font-weight:500;margin-bottom:6px">Project</label>
                    <select id="importProjectId" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem">
                        <option value="">— None —</option>
                        ${projects.map(p => `<option value="${p.id}">${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div style="margin-bottom:14px">
                    <label style="display:block;font-size:.88rem;font-weight:500;margin-bottom:6px">Import as</label>
                    <select id="importState" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem">
                        <option value="draft_requirement">Draft (requires review before official)</option>
                        <option value="official">Official (add directly to register)</option>
                    </select>
                </div>
                <textarea id="importCsv" rows="10" placeholder="title,specSection,submittalNumber,status&#10;Concrete Mix Design,03 30 00,SUB-001,Not Started&#10;Reinforcing Steel Shop Drawings,03 20 00,SUB-002,Submitted"
                    style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.82rem;resize:vertical;font-family:monospace;box-sizing:border-box"></textarea>
                <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
                    <button id="cancelImportBtn" class="btn-secondary">Cancel</button>
                    <button id="doImportBtn" class="btn-primary">Import</button>
                </div>
                <div id="importStatus" style="margin-top:10px;font-size:.85rem"></div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#cancelImportBtn').onclick = () => document.body.removeChild(overlay);
        overlay.querySelector('#doImportBtn').onclick = async () => {
            const csv       = overlay.querySelector('#importCsv').value.trim();
            const projectId = overlay.querySelector('#importProjectId').value;
            const state     = overlay.querySelector('#importState').value;
            const statusEl  = overlay.querySelector('#importStatus');
            const importBtn = overlay.querySelector('#doImportBtn');

            if (!csv) { statusEl.textContent = 'Paste CSV data first'; statusEl.style.color='#dc3545'; return; }

            const lines  = csv.split('\n').map(l => l.trim()).filter(Boolean);
            const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
            const idxOf  = col => header.indexOf(col);

            const items = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = _parseCsvLine(lines[i]);
                const title = (cols[idxOf('title')] || '').trim();
                if (!title) continue;
                items.push({
                    title,
                    submittalNumber: cols[idxOf('submittalNumber')] || cols[idxOf('submittalnumber')] || '',
                    specSection:     cols[idxOf('specSection')]     || cols[idxOf('specsection')]     || '',
                    submittalType:   cols[idxOf('submittalType')]   || cols[idxOf('submittaltype')]   || 'other',
                    status:          cols[idxOf('status')]          || 'Not Started',
                    submittedBy:     cols[idxOf('submittedBy')]     || cols[idxOf('submittedby')]     || '',
                    reviewer:        cols[idxOf('reviewer')]        || '',
                    requiredByDate:  cols[idxOf('requiredByDate')]  || cols[idxOf('requiredbydate')]  || '',
                    notes:           cols[idxOf('notes')]           || '',
                    source:          'imported',
                    state,
                    projectId,
                });
            }

            if (items.length === 0) { statusEl.textContent = 'No valid rows found'; statusEl.style.color='#dc3545'; return; }

            importBtn.disabled = true; importBtn.textContent = `Importing ${items.length} rows…`;
            try {
                const result = await _api('POST', '/api/submittals/bulk-import', { projectId, items });
                document.body.removeChild(overlay);
                Utils.showToast(`Imported ${result.created} submittals`, 'success');
                if (state === 'draft_requirement') _switchView('drafts');
                else _renderRegister();
            } catch (e) {
                importBtn.disabled = false; importBtn.textContent = 'Import';
                statusEl.textContent = 'Error: ' + e.message; statusEl.style.color='#dc3545';
            }
        };
    }

    function _parseCsvLine(line) {
        const result = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
            else { cur += ch; }
        }
        result.push(cur.trim());
        return result;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // COMMON HELPERS
    // ══════════════════════════════════════════════════════════════════════════

    async function _deleteItem(id, onSuccess) {
        if (!confirm('Delete this submittal? This cannot be undone.')) return;
        try {
            await _api('DELETE', '/api/submittals/' + id);
            Utils.showToast('Submittal deleted', 'success');
            onSuccess();
        } catch (e) {
            Utils.showToast('Delete failed: ' + e.message, 'error');
        }
    }

    function _exportCsv(items, projMap) {
        const esc = v => { v = String(v === null || v === undefined ? '' : v); return (v.includes(',') || v.includes('"') || v.includes('\n')) ? '"' + v.replace(/"/g,'""') + '"' : v; };
        const row = fields => fields.map(esc).join(',');
        const headers = ['Submittal #', 'Spec Section', 'Title', 'Type', 'Project', 'Status', 'Submitted By', 'Reviewer', 'Required By', 'Submitted Date', 'Returned Date', 'Notes'];
        const rows = items.map(i => row([
            i.submittalNumber, i.specSection, i.title,
            i.submittalType, projMap[i.projectId] || '', i.status,
            i.submittedBy, i.reviewer, i.requiredByDate,
            i.submittedDate, i.returnedDate, i.notes,
        ]));
        const csv  = [row(headers), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = 'submittals.csv'; a.click();
        URL.revokeObjectURL(url);
    }

    // ── Public API ─────────────────────────────────────────────────────────────
    return { render };

})();
