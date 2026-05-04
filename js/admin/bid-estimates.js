// ── Bid Estimates Module (v2 — dedicated API) ────────────────────────────────
// Uses /api/estimates, /api/estimates/<id>/tasks, /api/estimates/<id>/tasks/<tid>/cost-lines
// NOT the generic entity endpoint.

window.AdminEstimates = (function () {

    // ── Internal API helper ───────────────────────────────────────────────────
    async function _api(path, options) {
        const jwt = AppData.getJwt();
        const headers = { 'Content-Type': 'application/json' };
        if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 30000);
        try {
            const res = await fetch(AppData.API_BASE + path,
                Object.assign({}, options, { headers, signal: controller.signal }));
            clearTimeout(tid);
            if (!res.ok) {
                let msg = 'HTTP ' + res.status;
                try { const j = await res.json(); msg = j.error || msg; } catch (e) {}
                throw new Error(msg);
            }
            return res.json();
        } catch (e) {
            clearTimeout(tid);
            if (e.name === 'AbortError') throw new Error('Request timed out');
            throw e;
        }
    }

    // ── State ─────────────────────────────────────────────────────────────────
    let _container = null;
    let _statusFilter = 'All';
    let _estimates = [];
    let _currentEstimate = null;   // full estimate object with tasks + totals

    // ── Helpers ───────────────────────────────────────────────────────────────
    const esc = Utils.escapeHtml;

    function fmt(n) { return '$' + (parseFloat(n) || 0).toFixed(2); }

    function statusBadge(s) {
        const cls = { draft: 'draft-s', sent: 'sent-s', approved: 'approved-s' }[s] || 'draft-s';
        const label = { draft: 'Draft', sent: 'Sent', approved: 'Approved' }[s] || s;
        return `<span class="pstatus ${cls}">${label}</span>`;
    }

    function pct(v) { return (parseFloat(v) || 0).toFixed(1) + '%'; }

    // ── PUBLIC render ─────────────────────────────────────────────────────────
    async function render(container, params) {
        _container = container;
        if (params && params.estimateId) {
            await _loadAndShowDetail(params.estimateId);
        } else {
            await _renderList();
        }
    }

    // kept for back-compat with app.js routing
    async function renderDetail(container, estimateId) {
        _container = container;
        await _loadAndShowDetail(estimateId);
    }

    // ── List ──────────────────────────────────────────────────────────────────
    async function _renderList() {
        _container.innerHTML = '<div class="loading-placeholder" style="padding:24px;text-align:center"><p class="text-muted">Loading estimates…</p></div>';
        try {
            _estimates = await _api('/api/estimates');
        } catch (e) {
            _container.innerHTML = `<div class="card"><p class="text-muted">Failed to load estimates: ${esc(e.message)}</p></div>`;
            return;
        }

        const statuses = ['All', 'draft', 'sent', 'approved'];
        const filter = _statusFilter;
        const filtered = filter === 'All' ? _estimates : _estimates.filter(e => e.status === filter);

        _container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                <h2 style="margin:0">Bid Estimates</h2>
                <button class="btn-primary" id="addEstimateBtn">+ New Estimate</button>
            </div>

            <div class="tabs" style="margin-bottom:16px">
                ${statuses.map(s => {
                    const count = s === 'All' ? _estimates.length
                        : _estimates.filter(e => e.status === s).length;
                    const label = { All: 'All', draft: 'Draft', sent: 'Sent', approved: 'Approved' }[s];
                    return `<button class="tab-btn${filter === s ? ' active' : ''}" data-status="${s}">${label} (${count})</button>`;
                }).join('')}
            </div>

            <div class="card">
                ${filtered.length === 0
                    ? '<div class="empty"><h3>No Estimates</h3><p>Create your first estimate to get started.</p></div>'
                    : `<table>
                        <thead><tr>
                            <th>Title</th>
                            <th>Est #</th>
                            <th>Status</th>
                            <th>Overhead</th>
                            <th>Profit</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr></thead>
                        <tbody>${filtered.map(e => `
                            <tr class="estimate-row" data-id="${e.id}" style="cursor:pointer">
                                <td><strong>${esc(e.title || 'Untitled')}</strong>${e.description ? `<br><span class="text-muted" style="font-size:0.8rem">${esc(e.description.slice(0,60))}${e.description.length>60?'…':''}</span>` : ''}</td>
                                <td>${esc(e.estimateNumber || '—')}</td>
                                <td>${statusBadge(e.status)}</td>
                                <td>${pct(e.overheadPct)}</td>
                                <td>${pct(e.profitPct)}</td>
                                <td>${Utils.formatDate(e.createdAt)}</td>
                                <td style="white-space:nowrap">
                                    <button class="btn-ghost btn-sm edit-est-btn" data-id="${e.id}">Edit</button>
                                    <button class="btn-ghost btn-sm delete-est-btn" data-id="${e.id}" style="color:var(--accent)">Delete</button>
                                </td>
                            </tr>`).join('')}
                        </tbody>
                    </table>`
                }
            </div>
        `;

        _container.querySelectorAll('.tab-btn[data-status]').forEach(tab => {
            tab.addEventListener('click', () => { _statusFilter = tab.dataset.status; _renderList(); });
        });

        _container.querySelector('#addEstimateBtn').addEventListener('click', () => _showEstimateForm(null));

        _container.querySelectorAll('.estimate-row').forEach(row => {
            row.addEventListener('click', e => {
                if (e.target.closest('.edit-est-btn, .delete-est-btn')) return;
                _loadAndShowDetail(row.dataset.id);
            });
        });

        _container.querySelectorAll('.edit-est-btn').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); _showEstimateForm(btn.dataset.id); });
        });

        _container.querySelectorAll('.delete-est-btn').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const est = _estimates.find(x => x.id === btn.dataset.id);
                if (!est || !await Utils.confirm(`Delete estimate "${esc(est.title || 'Untitled')}"?`)) return;
                try {
                    await _api('/api/estimates/' + btn.dataset.id, { method: 'DELETE' });
                    Utils.showToast('Estimate deleted');
                    _renderList();
                } catch (err) {
                    Utils.showToast('Delete failed: ' + err.message, 'error');
                }
            });
        });
    }

    // ── Detail view ───────────────────────────────────────────────────────────
    async function _loadAndShowDetail(estimateId) {
        _container.innerHTML = '<div style="padding:24px;text-align:center"><p class="text-muted">Loading…</p></div>';
        try {
            _currentEstimate = await _api('/api/estimates/' + estimateId);
        } catch (e) {
            _container.innerHTML = `<div class="card"><p class="text-muted">Failed to load: ${esc(e.message)}</p><button class="btn-secondary" id="backBtn">← Back</button></div>`;
            _container.querySelector('#backBtn').addEventListener('click', () => _renderList());
            return;
        }
        _renderDetail();
    }

    function _renderDetail() {
        const est = _currentEstimate;
        const tasks = est.tasks || [];
        const totals = est.totals || {};
        const canEdit = est.status === 'draft';

        _container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
                <div>
                    <button class="btn-secondary btn-sm" id="backBtn">← Back</button>
                    <h2 style="margin:8px 0 0 0">${esc(est.title || 'Untitled Estimate')}</h2>
                    ${est.estimateNumber ? `<p class="text-muted" style="margin:2px 0 0 0;font-size:0.875rem">${esc(est.estimateNumber)}</p>` : ''}
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    ${canEdit ? `<button class="btn-secondary btn-sm" id="editEstBtn">Edit Info</button>` : ''}
                    ${est.status === 'draft' ? `<button class="btn-success btn-sm" id="sendBtn">Mark Sent</button>` : ''}
                    ${est.status === 'sent' ? `<button class="btn-success btn-sm" id="approveBtn">Approve</button>` : ''}
                    ${est.status === 'approved' ? `<button class="btn-success btn-sm" id="createProjBtn">Create Project</button>` : ''}
                    ${statusBadge(est.status)}
                </div>
            </div>

            ${est.description ? `<div class="card" style="margin-bottom:12px;padding:12px"><p style="margin:0">${esc(est.description)}</p></div>` : ''}

            <!-- Totals Summary -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:16px">
                ${_totalCard('Direct Cost', totals.totalDirectCost)}
                ${_totalCard('Overhead', totals.totalOverhead)}
                ${_totalCard('Profit', totals.totalProfit)}
                ${totals.totalContingency ? _totalCard('Contingency', totals.totalContingency) : ''}
                ${_totalCard('Grand Total', totals.grandTotal, true)}
            </div>

            <!-- Markup Settings -->
            <details style="margin-bottom:16px">
                <summary style="cursor:pointer;padding:8px;background:var(--bg-light);border-radius:4px;font-weight:600">
                    Estimate-Level Markups — OH: ${pct(est.overheadPct)} | Profit: ${pct(est.profitPct)} | Contingency: ${pct(est.contingencyPct)}
                </summary>
                <div style="padding:8px;background:var(--bg-light);border-radius:0 0 4px 4px">
                    <p class="text-muted" style="margin:0;font-size:0.875rem">These apply to all tasks unless a task has its own override. Edit via "Edit Info".</p>
                </div>
            </details>

            <!-- Tasks -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <h3 style="margin:0">Tasks (${tasks.length})</h3>
                ${canEdit ? `<button class="btn-primary btn-sm" id="addTaskBtn">+ Add Task</button>` : ''}
            </div>

            <div id="tasksContainer">
                ${tasks.length === 0
                    ? '<div class="card"><p class="text-muted">No tasks yet. Add a task to start building your estimate.</p></div>'
                    : tasks.map((t, i) => _renderTask(t, i, totals, canEdit)).join('')
                }
            </div>
        `;

        _container.querySelector('#backBtn').addEventListener('click', () => { _currentEstimate = null; _renderList(); });

        if (canEdit) {
            _container.querySelector('#editEstBtn').addEventListener('click', () => _showEstimateForm(est.id));
            _container.querySelector('#addTaskBtn').addEventListener('click', () => _showTaskForm(null));
        }

        const sendBtn = _container.querySelector('#sendBtn');
        if (sendBtn) sendBtn.addEventListener('click', async () => {
            if (!await Utils.confirm('Mark this estimate as Sent?')) return;
            await _patchStatus('sent');
        });

        const approveBtn = _container.querySelector('#approveBtn');
        if (approveBtn) approveBtn.addEventListener('click', async () => {
            if (!await Utils.confirm('Approve this estimate?')) return;
            await _patchStatus('approved');
        });

        const createProjBtn = _container.querySelector('#createProjBtn');
        if (createProjBtn) createProjBtn.addEventListener('click', () => _createProjectFromEstimate());

        // Task-level buttons
        _container.querySelectorAll('.task-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => _showTaskForm(btn.dataset.taskId));
        });
        _container.querySelectorAll('.task-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!await Utils.confirm('Delete this task and all its cost lines?')) return;
                try {
                    await _api(`/api/estimates/${est.id}/tasks/${btn.dataset.taskId}`, { method: 'DELETE' });
                    Utils.showToast('Task deleted');
                    await _loadAndShowDetail(est.id);
                } catch (err) { Utils.showToast('Error: ' + err.message, 'error'); }
            });
        });
        _container.querySelectorAll('.add-line-btn').forEach(btn => {
            btn.addEventListener('click', () => _showCostLineForm(btn.dataset.taskId, null));
        });
        _container.querySelectorAll('.line-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => _showCostLineForm(btn.dataset.taskId, btn.dataset.lineId));
        });
        _container.querySelectorAll('.line-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!await Utils.confirm('Delete this cost line?')) return;
                try {
                    await _api(`/api/estimates/${est.id}/tasks/${btn.dataset.taskId}/cost-lines/${btn.dataset.lineId}`, { method: 'DELETE' });
                    Utils.showToast('Cost line deleted');
                    await _loadAndShowDetail(est.id);
                } catch (err) { Utils.showToast('Error: ' + err.message, 'error'); }
            });
        });
    }

    function _totalCard(label, value, highlight) {
        const bg = highlight ? 'background:var(--primary);color:#fff' : 'background:var(--bg-light)';
        return `<div class="card" style="padding:10px;${bg}">
            <p style="margin:0;font-size:0.75rem;opacity:0.75">${label}</p>
            <p style="margin:0;font-size:1.1rem;font-weight:700">${fmt(value)}</p>
        </div>`;
    }

    function _renderTask(task, idx, totals, canEdit) {
        const lines = task.costLines || [];
        const taskSummary = (totals.tasks || []).find(s => s.taskId === task.id) || {};

        const typeColors = {
            labour: '#3b82f6', equipment: '#f59e0b', material: '#10b981',
            subcontract: '#8b5cf6', other: '#6b7280'
        };

        const flags = [];
        if (task.isOptional) flags.push('<span style="font-size:0.7rem;background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:3px">Optional</span>');
        if (task.isAlternate) flags.push('<span style="font-size:0.7rem;background:#dbeafe;color:#1e40af;padding:1px 5px;border-radius:3px">Alternate</span>');
        if (task.isLumpSum) flags.push('<span style="font-size:0.7rem;background:#f3f4f6;color:#374151;padding:1px 5px;border-radius:3px">Lump Sum</span>');

        const hasFactors = task.wastePct || task.inefficiencyPct || task.riskFactorPct;
        const hasOverrides = task.overheadPct !== null && task.overheadPct !== undefined;

        return `
        <div class="card" style="margin-bottom:12px;padding:0;overflow:hidden">
            <!-- Task header -->
            <div style="padding:12px;background:var(--bg-light);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                        <span style="font-weight:700;font-size:0.95rem">${idx + 1}. ${esc(task.description || 'Unnamed Task')}</span>
                        ${flags.join('')}
                    </div>
                    <div style="display:flex;gap:12px;margin-top:4px;flex-wrap:wrap;font-size:0.8rem;color:var(--text-muted)">
                        ${task.quantity ? `<span>${task.quantity} ${esc(task.unit || 'units')}</span>` : ''}
                        ${task.costCode ? `<span>Code: ${esc(task.costCode)}</span>` : ''}
                        ${taskSummary.derivedUnitRate ? `<span>Unit Rate: ${fmt(taskSummary.derivedUnitRate)}/${esc(task.unit || 'unit')}</span>` : ''}
                        ${taskSummary.productionHours ? `<span>Prod. Hrs: ${taskSummary.productionHours}</span>` : ''}
                    </div>
                    ${task.notes ? `<p style="margin:4px 0 0 0;font-size:0.8rem;color:var(--text-muted)">${esc(task.notes)}</p>` : ''}
                </div>
                <div style="text-align:right;flex-shrink:0">
                    <p style="margin:0;font-size:1.1rem;font-weight:700;color:var(--primary)">${fmt(taskSummary.taskTotal)}</p>
                    ${taskSummary.directCost !== taskSummary.taskTotal ? `<p style="margin:0;font-size:0.75rem;color:var(--text-muted)">Direct: ${fmt(taskSummary.directCost)}</p>` : ''}
                </div>
            </div>

            <!-- Cost lines -->
            <div style="padding:10px 12px">
                ${lines.length === 0
                    ? `<p class="text-muted" style="font-size:0.85rem;margin:4px 0">No cost lines yet.</p>`
                    : `<table style="width:100%;font-size:0.82rem;border-collapse:collapse">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border)">
                                <th style="text-align:left;padding:3px 6px;font-weight:600">Type</th>
                                <th style="text-align:left;padding:3px 6px;font-weight:600">Description</th>
                                <th style="text-align:right;padding:3px 6px;font-weight:600">Qty</th>
                                <th style="text-align:left;padding:3px 6px;font-weight:600">Unit</th>
                                <th style="text-align:right;padding:3px 6px;font-weight:600">Rate</th>
                                <th style="text-align:right;padding:3px 6px;font-weight:600">Total</th>
                                ${canEdit ? '<th style="padding:3px 6px"></th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${lines.map(ln => `
                                <tr style="border-bottom:1px solid var(--border)">
                                    <td style="padding:3px 6px"><span style="display:inline-block;padding:1px 6px;border-radius:3px;background:${typeColors[ln.type] || '#6b7280'}22;color:${typeColors[ln.type] || '#6b7280'};font-size:0.75rem;font-weight:600;text-transform:capitalize">${ln.type}</span>${ln.labourRole ? `<br><span style="font-size:0.72rem;color:var(--text-muted)">${esc(ln.labourRole)}</span>` : ''}</td>
                                    <td style="padding:3px 6px">${esc(ln.description || '—')}</td>
                                    <td style="padding:3px 6px;text-align:right">${ln.quantity}</td>
                                    <td style="padding:3px 6px">${esc(ln.unit || '')}</td>
                                    <td style="padding:3px 6px;text-align:right">${fmt(ln.rate)}</td>
                                    <td style="padding:3px 6px;text-align:right;font-weight:600">${fmt(ln.total)}</td>
                                    ${canEdit ? `
                                        <td style="padding:3px 6px;white-space:nowrap">
                                            <button class="btn-ghost btn-xs line-edit-btn" data-task-id="${task.id}" data-line-id="${ln.id}">E</button>
                                            <button class="btn-ghost btn-xs line-delete-btn" data-task-id="${task.id}" data-line-id="${ln.id}" style="color:var(--accent)">×</button>
                                        </td>
                                    ` : ''}
                                </tr>`).join('')}
                        </tbody>
                    </table>`
                }

                ${taskSummary.costByType && Object.keys(taskSummary.costByType).some(k => taskSummary.costByType[k] > 0) ? `
                    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;font-size:0.78rem">
                        ${Object.entries(taskSummary.costByType).filter(([,v]) => v > 0).map(([k,v]) =>
                            `<span style="color:${typeColors[k]||'#6b7280'}">${k}: ${fmt(v)}</span>`
                        ).join('')}
                        ${hasFactors ? `<span style="color:#f59e0b">×${(taskSummary.factorMultiplier||1).toFixed(3)} factor</span>` : ''}
                    </div>
                ` : ''}

                ${hasOverrides ? `
                    <p style="margin:6px 0 0 0;font-size:0.78rem;color:var(--text-muted)">
                        Task overrides — OH: ${pct(task.overheadPct)}
                        ${task.profitPct !== null && task.profitPct !== undefined ? ` | Profit: ${pct(task.profitPct)}` : ''}
                        ${task.contingencyPct !== null && task.contingencyPct !== undefined ? ` | Contingency: ${pct(task.contingencyPct)}` : ''}
                    </p>
                ` : ''}

                <div style="margin-top:8px;display:flex;gap:8px">
                    ${canEdit ? `<button class="btn-secondary btn-xs add-line-btn" data-task-id="${task.id}">+ Add Cost Line</button>` : ''}
                    ${canEdit ? `<button class="btn-ghost btn-xs task-edit-btn" data-task-id="${task.id}">Edit Task</button>` : ''}
                    ${canEdit ? `<button class="btn-ghost btn-xs task-delete-btn" data-task-id="${task.id}" style="color:var(--accent)">Delete Task</button>` : ''}
                </div>
            </div>
        </div>
        `;
    }

    // ── Status patch ──────────────────────────────────────────────────────────
    async function _patchStatus(newStatus) {
        try {
            await _api('/api/estimates/' + _currentEstimate.id, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            Utils.showToast('Status updated to ' + newStatus);
            await _loadAndShowDetail(_currentEstimate.id);
        } catch (err) {
            Utils.showToast('Error: ' + err.message, 'error');
        }
    }

    // ── Create project from approved estimate ─────────────────────────────────
    async function _createProjectFromEstimate() {
        if (!await Utils.confirm('Create a project from this estimate?')) return;
        try {
            const est = _currentEstimate;
            const totals = est.totals || {};
            const newProject = {
                id: AppData.generateId(),
                name: esc(est.title || 'Project from Estimate'),
                status: 'Active',
                budget: totals.grandTotal || 0,
                created_at: new Date().toISOString()
            };
            AppData.saveProject(newProject);
            Utils.showToast('Project created');
            _currentEstimate = null;
            _renderList();
        } catch (err) {
            Utils.showToast('Error: ' + err.message, 'error');
        }
    }

    // ── Estimate form (create / edit) ─────────────────────────────────────────
    function _showEstimateForm(editId) {
        const est = editId ? _estimates.find(e => e.id === editId) || _currentEstimate : null;
        const isEdit = !!est;

        const clients = AppData.getClients ? AppData.getClients() : [];
        const projects = AppData.getProjects ? AppData.getProjects() : [];

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:580px">
                <div class="modal-header"><h3 style="margin:0">${isEdit ? 'Edit Estimate' : 'New Estimate'}</h3></div>
                <div class="modal-body">
                    <form id="estForm">
                        <div class="form-group">
                            <label>Title *</label>
                            <input name="title" value="${esc(est ? est.title : '')}" placeholder="e.g. Office Renovation — Phase 1" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Estimate Number</label>
                                <input name="estimateNumber" value="${esc(est ? est.estimateNumber : '')}" placeholder="EST-001">
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select name="status">
                                    ${['draft','sent','approved'].map(s =>
                                        `<option value="${s}" ${(est && est.status === s) || (!est && s === 'draft') ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Description / Scope</label>
                            <textarea name="description" style="resize:vertical;height:70px">${esc(est ? est.description : '')}</textarea>
                        </div>
                        ${clients.length > 0 ? `
                        <div class="form-group">
                            <label>Client</label>
                            <select name="clientId">
                                <option value="">— None —</option>
                                ${clients.map(c => `<option value="${c.id}" ${est && est.clientId === c.id ? 'selected' : ''}>${esc(c.name || c.id)}</option>`).join('')}
                            </select>
                        </div>` : ''}
                        ${projects.length > 0 ? `
                        <div class="form-group">
                            <label>Linked Project</label>
                            <select name="projectId">
                                <option value="">— None —</option>
                                ${projects.map(p => `<option value="${p.id}" ${est && est.projectId === p.id ? 'selected' : ''}>${esc(p.name || p.id)}</option>`).join('')}
                            </select>
                        </div>` : ''}
                        <h4 style="margin:12px 0 8px 0">Markup Defaults (applied to all tasks unless overridden)</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Overhead %</label>
                                <input type="number" name="overheadPct" min="0" max="100" step="0.1" value="${est ? (est.overheadPct || 0) : 10}">
                            </div>
                            <div class="form-group">
                                <label>Profit %</label>
                                <input type="number" name="profitPct" min="0" max="100" step="0.1" value="${est ? (est.profitPct || 0) : 10}">
                            </div>
                            <div class="form-group">
                                <label>Contingency %</label>
                                <input type="number" name="contingencyPct" min="0" max="100" step="0.1" value="${est ? (est.contingencyPct || 0) : 0}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Internal Notes</label>
                            <textarea name="notes" style="resize:vertical;height:60px">${esc(est ? est.notes : '')}</textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="cancelBtn">Cancel</button>
                    <button class="btn-primary" id="saveBtn">${isEdit ? 'Update' : 'Create'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#cancelBtn').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#saveBtn').addEventListener('click', async () => {
            const fd = new FormData(overlay.querySelector('#estForm'));
            const title = fd.get('title').trim();
            if (!title) { Utils.showToast('Title is required', 'error'); return; }

            const payload = {
                title,
                estimateNumber: fd.get('estimateNumber').trim(),
                description: fd.get('description').trim(),
                status: fd.get('status'),
                clientId: fd.get('clientId') || '',
                projectId: fd.get('projectId') || '',
                overheadPct: parseFloat(fd.get('overheadPct')) || 0,
                profitPct: parseFloat(fd.get('profitPct')) || 0,
                contingencyPct: parseFloat(fd.get('contingencyPct')) || 0,
                notes: fd.get('notes').trim(),
            };

            const saveBtn = overlay.querySelector('#saveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';

            try {
                let saved;
                if (isEdit) {
                    saved = await _api('/api/estimates/' + est.id, {
                        method: 'PUT', body: JSON.stringify(payload)
                    });
                } else {
                    saved = await _api('/api/estimates', {
                        method: 'POST', body: JSON.stringify(payload)
                    });
                }
                overlay.remove();
                Utils.showToast(isEdit ? 'Estimate updated' : 'Estimate created');
                await _loadAndShowDetail(saved.id);
            } catch (err) {
                Utils.showToast('Error: ' + err.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = isEdit ? 'Update' : 'Create';
            }
        });
    }

    // ── Task form ─────────────────────────────────────────────────────────────
    function _showTaskForm(taskId) {
        const est = _currentEstimate;
        const task = taskId ? (est.tasks || []).find(t => t.id === taskId) : null;
        const isEdit = !!task;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:620px">
                <div class="modal-header"><h3 style="margin:0">${isEdit ? 'Edit Task' : 'New Task'}</h3></div>
                <div class="modal-body" style="max-height:70vh;overflow-y:auto">
                    <form id="taskForm">
                        <div class="form-group">
                            <label>Description *</label>
                            <input name="description" value="${esc(task ? task.description : '')}" placeholder="e.g. Concrete formwork — north wall" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Quantity</label>
                                <input type="number" name="quantity" min="0" step="any" value="${task ? task.quantity : 0}">
                            </div>
                            <div class="form-group">
                                <label>Unit</label>
                                <input name="unit" value="${esc(task ? task.unit : '')}" placeholder="m², hrs, lf, etc.">
                            </div>
                            <div class="form-group">
                                <label>Cost Code</label>
                                <input name="costCode" value="${esc(task ? task.costCode : '')}" placeholder="03-100">
                            </div>
                        </div>

                        <h4 style="margin:12px 0 8px 0">Factors (% added to direct cost)</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Waste %</label>
                                <input type="number" name="wastePct" min="0" max="100" step="0.1" value="${task ? (task.wastePct || 0) : 0}">
                            </div>
                            <div class="form-group">
                                <label>Inefficiency %</label>
                                <input type="number" name="inefficiencyPct" min="0" max="100" step="0.1" value="${task ? (task.inefficiencyPct || 0) : 0}">
                            </div>
                            <div class="form-group">
                                <label>Risk %</label>
                                <input type="number" name="riskFactorPct" min="0" max="100" step="0.1" value="${task ? (task.riskFactorPct || 0) : 0}">
                            </div>
                        </div>

                        <h4 style="margin:12px 0 8px 0">Markup Overrides <span style="font-weight:400;font-size:0.85rem;color:var(--text-muted)">(leave blank to use estimate defaults)</span></h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Overhead %</label>
                                <input type="number" name="overheadPct" min="0" max="100" step="0.1" placeholder="Inherit"
                                    value="${task && task.overheadPct !== null && task.overheadPct !== undefined ? task.overheadPct : ''}">
                            </div>
                            <div class="form-group">
                                <label>Profit %</label>
                                <input type="number" name="profitPct" min="0" max="100" step="0.1" placeholder="Inherit"
                                    value="${task && task.profitPct !== null && task.profitPct !== undefined ? task.profitPct : ''}">
                            </div>
                            <div class="form-group">
                                <label>Contingency %</label>
                                <input type="number" name="contingencyPct" min="0" max="100" step="0.1" placeholder="Inherit"
                                    value="${task && task.contingencyPct !== null && task.contingencyPct !== undefined ? task.contingencyPct : ''}">
                            </div>
                        </div>

                        <h4 style="margin:12px 0 8px 0">Production-Based Estimating <span style="font-weight:400;font-size:0.85rem;color:var(--text-muted)">(optional)</span></h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Production Rate</label>
                                <input type="number" name="productionRate" min="0" step="any" placeholder="e.g. 50"
                                    value="${task ? (task.productionRate || '') : ''}">
                            </div>
                            <div class="form-group">
                                <label>Rate Unit</label>
                                <input name="productionRateUnit" placeholder="m²/hr, m³/day" value="${esc(task ? task.productionRateUnit : '')}">
                            </div>
                            <div class="form-group">
                                <label>Crew Size</label>
                                <input type="number" name="crewSize" min="0" step="1" value="${task ? (task.crewSize || '') : ''}">
                            </div>
                            <div class="form-group">
                                <label>Crew Productivity</label>
                                <input type="number" name="crewProductivity" min="0.1" max="2" step="0.05"
                                    value="${task ? (task.crewProductivity || 1.0) : 1.0}" placeholder="1.0">
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group" style="display:flex;align-items:center;gap:8px;padding-top:20px">
                                <input type="checkbox" name="isOptional" id="chkOptional" ${task && task.isOptional ? 'checked' : ''}>
                                <label for="chkOptional" style="margin:0">Optional</label>
                            </div>
                            <div class="form-group" style="display:flex;align-items:center;gap:8px;padding-top:20px">
                                <input type="checkbox" name="isAlternate" id="chkAlternate" ${task && task.isAlternate ? 'checked' : ''}>
                                <label for="chkAlternate" style="margin:0">Alternate</label>
                            </div>
                            <div class="form-group" style="display:flex;align-items:center;gap:8px;padding-top:20px">
                                <input type="checkbox" name="isLumpSum" id="chkLumpSum" ${task && task.isLumpSum ? 'checked' : ''}>
                                <label for="chkLumpSum" style="margin:0">Lump Sum</label>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Notes / Assumptions</label>
                            <textarea name="notes" style="resize:vertical;height:60px">${esc(task ? task.notes : '')}</textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="cancelBtn">Cancel</button>
                    <button class="btn-primary" id="saveBtn">${isEdit ? 'Update' : 'Add Task'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#cancelBtn').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#saveBtn').addEventListener('click', async () => {
            const fd = new FormData(overlay.querySelector('#taskForm'));
            const description = fd.get('description').trim();
            if (!description) { Utils.showToast('Description is required', 'error'); return; }

            const ov = fd.get('overheadPct').trim();
            const pr = fd.get('profitPct').trim();
            const cg = fd.get('contingencyPct').trim();

            const payload = {
                description,
                quantity: parseFloat(fd.get('quantity')) || 0,
                unit: fd.get('unit').trim(),
                costCode: fd.get('costCode').trim(),
                wastePct: parseFloat(fd.get('wastePct')) || 0,
                inefficiencyPct: parseFloat(fd.get('inefficiencyPct')) || 0,
                riskFactorPct: parseFloat(fd.get('riskFactorPct')) || 0,
                overheadPct: ov !== '' ? parseFloat(ov) : null,
                profitPct: pr !== '' ? parseFloat(pr) : null,
                contingencyPct: cg !== '' ? parseFloat(cg) : null,
                productionRate: parseFloat(fd.get('productionRate')) || 0,
                productionRateUnit: fd.get('productionRateUnit').trim(),
                crewSize: parseFloat(fd.get('crewSize')) || 0,
                crewProductivity: parseFloat(fd.get('crewProductivity')) || 1.0,
                isOptional: fd.get('isOptional') === 'on',
                isAlternate: fd.get('isAlternate') === 'on',
                isLumpSum: fd.get('isLumpSum') === 'on',
                notes: fd.get('notes').trim(),
                sortOrder: isEdit ? (task.sortOrder || 0) : (est.tasks || []).length,
            };

            const saveBtn = overlay.querySelector('#saveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';

            try {
                if (isEdit) {
                    await _api(`/api/estimates/${est.id}/tasks/${task.id}`, {
                        method: 'PUT', body: JSON.stringify(payload)
                    });
                } else {
                    await _api(`/api/estimates/${est.id}/tasks`, {
                        method: 'POST', body: JSON.stringify(payload)
                    });
                }
                overlay.remove();
                Utils.showToast(isEdit ? 'Task updated' : 'Task added');
                await _loadAndShowDetail(est.id);
            } catch (err) {
                Utils.showToast('Error: ' + err.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = isEdit ? 'Update' : 'Add Task';
            }
        });
    }

    // ── Cost line form ────────────────────────────────────────────────────────
    function _showCostLineForm(taskId, lineId) {
        const est = _currentEstimate;
        const task = (est.tasks || []).find(t => t.id === taskId);
        const line = lineId ? (task.costLines || []).find(l => l.id === lineId) : null;
        const isEdit = !!line;

        const lineTypes = ['labour', 'equipment', 'material', 'subcontract', 'other'];

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:500px">
                <div class="modal-header">
                    <h3 style="margin:0">${isEdit ? 'Edit Cost Line' : 'Add Cost Line'}</h3>
                    <p style="margin:4px 0 0 0;font-size:0.85rem;color:var(--text-muted)">${esc(task ? task.description : '')}</p>
                </div>
                <div class="modal-body">
                    <form id="lineForm">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Type *</label>
                                <select name="type" id="lineType" required>
                                    ${lineTypes.map(t => `<option value="${t}" ${line && line.type === t ? 'selected' : ''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group" id="labourRoleGroup" style="${(!line || line.type === 'labour') ? '' : 'display:none'}">
                                <label>Role / Trade</label>
                                <input name="labourRole" value="${esc(line ? line.labourRole : '')}" placeholder="Carpenter, Labourer, etc.">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Description *</label>
                            <input name="description" value="${esc(line ? line.description : '')}" placeholder="e.g. Formwork labour — carpenter" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Quantity *</label>
                                <input type="number" name="quantity" min="0" step="any" value="${line ? line.quantity : 1}" required>
                            </div>
                            <div class="form-group">
                                <label>Unit *</label>
                                <input name="unit" value="${esc(line ? line.unit : '')}" placeholder="hrs, days, m², units" required>
                            </div>
                            <div class="form-group">
                                <label>Rate ($/unit) *</label>
                                <input type="number" name="rate" min="0" step="0.01" value="${line ? line.rate : 0}" required>
                            </div>
                        </div>
                        <div style="background:var(--bg-light);border-radius:4px;padding:10px;margin-top:4px">
                            <p style="margin:0;font-size:0.875rem">Total: <strong id="lineTotal">${fmt(line ? line.total : 0)}</strong></p>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="cancelBtn">Cancel</button>
                    <button class="btn-primary" id="saveBtn">${isEdit ? 'Update' : 'Add Line'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Show/hide labour role based on type
        overlay.querySelector('#lineType').addEventListener('change', function() {
            overlay.querySelector('#labourRoleGroup').style.display = this.value === 'labour' ? '' : 'none';
        });

        // Live total calculation
        const qtyInput = overlay.querySelector('input[name="quantity"]');
        const rateInput = overlay.querySelector('input[name="rate"]');
        const totalEl = overlay.querySelector('#lineTotal');
        function recalc() {
            const q = parseFloat(qtyInput.value) || 0;
            const r = parseFloat(rateInput.value) || 0;
            totalEl.textContent = fmt(q * r);
        }
        qtyInput.addEventListener('input', recalc);
        rateInput.addEventListener('input', recalc);

        overlay.querySelector('#cancelBtn').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#saveBtn').addEventListener('click', async () => {
            const fd = new FormData(overlay.querySelector('#lineForm'));
            const description = fd.get('description').trim();
            const unit = fd.get('unit').trim();
            if (!description || !unit) { Utils.showToast('Description and unit are required', 'error'); return; }

            const payload = {
                type: fd.get('type'),
                description,
                labourRole: fd.get('labourRole').trim(),
                quantity: parseFloat(fd.get('quantity')) || 0,
                unit,
                rate: parseFloat(fd.get('rate')) || 0,
                sortOrder: isEdit ? (line.sortOrder || 0) : (task.costLines || []).length,
            };

            const saveBtn = overlay.querySelector('#saveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';

            try {
                if (isEdit) {
                    await _api(`/api/estimates/${est.id}/tasks/${taskId}/cost-lines/${lineId}`, {
                        method: 'PUT', body: JSON.stringify(payload)
                    });
                } else {
                    await _api(`/api/estimates/${est.id}/tasks/${taskId}/cost-lines`, {
                        method: 'POST', body: JSON.stringify(payload)
                    });
                }
                overlay.remove();
                Utils.showToast(isEdit ? 'Cost line updated' : 'Cost line added');
                await _loadAndShowDetail(est.id);
            } catch (err) {
                Utils.showToast('Error: ' + err.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = isEdit ? 'Update' : 'Add Line';
            }
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return { render, renderDetail };

})();
