// ── Resource Groups (Crews) Module ────────────────────────────────────────────
// Full CRUD UI for resource groups, labour lines, and equipment lines.
// Accessed from the "Manage Crews" button in the Bid Estimates list.
// window.ResourceGroups = { render(container) }

window.ResourceGroups = (function () {

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

    const esc = Utils.escapeHtml;
    function fmt(n) { return '$' + (parseFloat(n) || 0).toFixed(2); }

    // ── State ─────────────────────────────────────────────────────────────────
    let _container = null;
    let _groups    = [];
    let _selected  = null;   // full group detail object

    // ── Public render ─────────────────────────────────────────────────────────
    async function render(container) {
        _container = container;
        await _renderList();
    }

    // ── List ──────────────────────────────────────────────────────────────────
    async function _renderList() {
        _container.innerHTML = '<div style="padding:16px;text-align:center"><p class="text-muted">Loading crews…</p></div>';
        try {
            _groups = await _api('/api/resource-groups');
        } catch (e) {
            _container.innerHTML = `<div style="padding:16px"><p class="text-muted">Failed to load: ${esc(e.message)}</p></div>`;
            return;
        }
        _renderPanel();
    }

    function _renderPanel() {
        _container.innerHTML = `
            <div style="display:flex;height:100%;min-height:400px">
                <!-- Sidebar list -->
                <div style="width:220px;flex-shrink:0;border-right:1px solid var(--border);overflow-y:auto;padding:8px">
                    <button class="btn-primary btn-sm" id="addGroupBtn" style="width:100%;margin-bottom:8px">+ New Crew</button>
                    ${_groups.length === 0
                        ? '<p class="text-muted" style="font-size:0.85rem;padding:4px">No crews yet.</p>'
                        : _groups.map(g => `
                            <div class="rg-list-item" data-id="${g.id}" style="
                                padding:8px;border-radius:4px;cursor:pointer;margin-bottom:2px;
                                background:${_selected && _selected.id === g.id ? 'var(--primary-light,#dbeafe)' : 'transparent'};
                                ${!g.active ? 'opacity:0.5' : ''}
                            ">
                                <div style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(g.name || 'Unnamed')}</div>
                                <div style="font-size:0.75rem;color:var(--text-muted)">${g.active ? 'Active' : 'Inactive'}</div>
                            </div>`).join('')
                    }
                </div>
                <!-- Detail pane -->
                <div id="rgDetailPane" style="flex:1;overflow-y:auto;padding:16px">
                    ${_selected ? _renderGroupDetail(_selected) : '<p class="text-muted">Select a crew to view details, or create a new one.</p>'}
                </div>
            </div>
        `;

        _container.querySelector('#addGroupBtn').addEventListener('click', () => _showGroupForm(null));

        _container.querySelectorAll('.rg-list-item').forEach(item => {
            item.addEventListener('click', () => _loadGroupDetail(item.dataset.id));
        });

        if (_selected) _attachDetailListeners();
    }

    async function _loadGroupDetail(gid) {
        try {
            _selected = await _api('/api/resource-groups/' + gid);
        } catch (e) {
            Utils.showToast('Failed to load crew: ' + e.message, 'error');
            return;
        }
        _renderPanel();
    }

    function _renderGroupDetail(g) {
        const labour = g.labour || [];
        const equip  = g.equipment || [];

        return `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap;gap:8px">
                <div>
                    <h3 style="margin:0">${esc(g.name)}</h3>
                    ${g.description ? `<p style="margin:2px 0 0 0;color:var(--text-muted);font-size:0.875rem">${esc(g.description)}</p>` : ''}
                    ${g.defaultProductionRate ? `<p style="margin:2px 0 0 0;font-size:0.8rem;color:var(--text-muted)">Default rate: ${g.defaultProductionRate} ${esc(g.productionUnit || 'units/hr')}</p>` : ''}
                </div>
                <div style="display:flex;gap:6px">
                    <button class="btn-secondary btn-xs" id="editGroupBtn" data-id="${g.id}">Edit</button>
                    <button class="btn-ghost btn-xs" id="deleteGroupBtn" data-id="${g.id}" style="color:var(--accent)">Delete</button>
                </div>
            </div>

            <!-- Labour -->
            <div style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <h4 style="margin:0">Labour</h4>
                    <button class="btn-secondary btn-xs" id="addLabourBtn">+ Add Role</button>
                </div>
                ${labour.length === 0
                    ? '<p class="text-muted" style="font-size:0.85rem">No labour lines.</p>'
                    : `<table style="width:100%;font-size:0.82rem;border-collapse:collapse">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border)">
                                <th style="text-align:left;padding:3px 6px">Role</th>
                                <th style="text-align:right;padding:3px 6px">Qty</th>
                                <th style="text-align:right;padding:3px 6px">$/hr</th>
                                <th style="text-align:right;padding:3px 6px">OT $/hr</th>
                                <th style="padding:3px 6px"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${labour.map(ln => `
                                <tr style="border-bottom:1px solid var(--border)">
                                    <td style="padding:3px 6px">${esc(ln.role || '—')}</td>
                                    <td style="padding:3px 6px;text-align:right">${ln.quantity}</td>
                                    <td style="padding:3px 6px;text-align:right">${fmt(ln.hourlyRate)}</td>
                                    <td style="padding:3px 6px;text-align:right">${ln.otRate ? fmt(ln.otRate) : '—'}</td>
                                    <td style="padding:3px 6px;white-space:nowrap">
                                        <button class="btn-ghost btn-xs edit-labour-btn" data-id="${ln.id}">E</button>
                                        <button class="btn-ghost btn-xs delete-labour-btn" data-id="${ln.id}" style="color:var(--accent)">×</button>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>`
                }
            </div>

            <!-- Equipment -->
            <div style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <h4 style="margin:0">Equipment</h4>
                    <button class="btn-secondary btn-xs" id="addEquipBtn">+ Add Equipment</button>
                </div>
                ${equip.length === 0
                    ? '<p class="text-muted" style="font-size:0.85rem">No equipment lines.</p>'
                    : `<table style="width:100%;font-size:0.82rem;border-collapse:collapse">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border)">
                                <th style="text-align:left;padding:3px 6px">Name</th>
                                <th style="text-align:right;padding:3px 6px">Qty</th>
                                <th style="text-align:right;padding:3px 6px">$/hr</th>
                                <th style="text-align:right;padding:3px 6px">$/day</th>
                                <th style="padding:3px 6px"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${equip.map(eq => `
                                <tr style="border-bottom:1px solid var(--border)">
                                    <td style="padding:3px 6px">${esc(eq.name || '—')}</td>
                                    <td style="padding:3px 6px;text-align:right">${eq.quantity}</td>
                                    <td style="padding:3px 6px;text-align:right">${fmt(eq.hourlyRate)}</td>
                                    <td style="padding:3px 6px;text-align:right">${eq.dailyRate ? fmt(eq.dailyRate) : '—'}</td>
                                    <td style="padding:3px 6px;white-space:nowrap">
                                        <button class="btn-ghost btn-xs edit-equip-btn" data-id="${eq.id}">E</button>
                                        <button class="btn-ghost btn-xs delete-equip-btn" data-id="${eq.id}" style="color:var(--accent)">×</button>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>`
                }
            </div>

            <!-- Cost summary -->
            <div id="costSummaryBox" style="background:var(--bg-light);border-radius:4px;padding:10px;font-size:0.85rem">
                <p style="margin:0;font-weight:600">Loading cost summary…</p>
            </div>
        `;
    }

    function _attachDetailListeners() {
        const g = _selected;

        const editGroupBtn = _container.querySelector('#editGroupBtn');
        if (editGroupBtn) editGroupBtn.addEventListener('click', () => _showGroupForm(g.id));

        const deleteGroupBtn = _container.querySelector('#deleteGroupBtn');
        if (deleteGroupBtn) deleteGroupBtn.addEventListener('click', async () => {
            if (!await Utils.confirm(`Delete crew "${esc(g.name)}"? This cannot be undone.`)) return;
            try {
                await _api('/api/resource-groups/' + g.id, { method: 'DELETE' });
                Utils.showToast('Crew deleted');
                _selected = null;
                await _renderList();
            } catch (err) { Utils.showToast('Delete failed: ' + err.message, 'error'); }
        });

        const addLabourBtn = _container.querySelector('#addLabourBtn');
        if (addLabourBtn) addLabourBtn.addEventListener('click', () => _showLabourForm(g.id, null));

        const addEquipBtn = _container.querySelector('#addEquipBtn');
        if (addEquipBtn) addEquipBtn.addEventListener('click', () => _showEquipForm(g.id, null));

        _container.querySelectorAll('.edit-labour-btn').forEach(btn => {
            const ln = (g.labour || []).find(l => l.id === btn.dataset.id);
            btn.addEventListener('click', () => _showLabourForm(g.id, ln));
        });
        _container.querySelectorAll('.delete-labour-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!await Utils.confirm('Remove this labour line?')) return;
                try {
                    await _api(`/api/resource-groups/${g.id}/labour/${btn.dataset.id}`, { method: 'DELETE' });
                    Utils.showToast('Labour line removed');
                    await _loadGroupDetail(g.id);
                } catch (err) { Utils.showToast('Error: ' + err.message, 'error'); }
            });
        });
        _container.querySelectorAll('.edit-equip-btn').forEach(btn => {
            const eq = (g.equipment || []).find(e => e.id === btn.dataset.id);
            btn.addEventListener('click', () => _showEquipForm(g.id, eq));
        });
        _container.querySelectorAll('.delete-equip-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!await Utils.confirm('Remove this equipment line?')) return;
                try {
                    await _api(`/api/resource-groups/${g.id}/equipment/${btn.dataset.id}`, { method: 'DELETE' });
                    Utils.showToast('Equipment line removed');
                    await _loadGroupDetail(g.id);
                } catch (err) { Utils.showToast('Error: ' + err.message, 'error'); }
            });
        });

        // Load cost summary async
        _loadCostSummary(g.id);
    }

    async function _loadCostSummary(gid) {
        const box = _container.querySelector('#costSummaryBox');
        if (!box) return;
        try {
            const cost = await _api('/api/resource-groups/' + gid + '/cost');
            box.innerHTML = `
                <div style="display:flex;gap:16px;flex-wrap:wrap">
                    <span>Labour: <strong>${fmt(cost.totalHourlyLabour)}/hr</strong></span>
                    <span>Equipment: <strong>${fmt(cost.totalHourlyEquip)}/hr</strong></span>
                    <span style="color:var(--primary)">Total: <strong>${fmt(cost.totalHourlyCost)}/hr</strong></span>
                    ${cost.totalDailyEquip ? `<span>Equip/day: <strong>${fmt(cost.totalDailyEquip)}</strong></span>` : ''}
                </div>
            `;
        } catch (e) {
            box.innerHTML = '<p class="text-muted" style="margin:0;font-size:0.85rem">Could not load cost.</p>';
        }
    }

    // ── Group form (create / edit) ────────────────────────────────────────────
    function _showGroupForm(editId) {
        const g = editId ? _groups.find(x => x.id === editId) || _selected : null;
        const isEdit = !!g;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:500px">
                <div class="modal-header"><h3 style="margin:0">${isEdit ? 'Edit Crew' : 'New Crew'}</h3></div>
                <div class="modal-body">
                    <form id="groupForm">
                        <div class="form-group">
                            <label>Name *</label>
                            <input name="name" value="${esc(g ? g.name : '')}" placeholder="e.g. Road Grading Crew" required>
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea name="description" style="resize:vertical;height:60px">${esc(g ? g.description : '')}</textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Default Production Rate</label>
                                <input type="number" name="defaultProductionRate" min="0" step="any"
                                    value="${g ? (g.defaultProductionRate || '') : ''}" placeholder="units/hr">
                            </div>
                            <div class="form-group">
                                <label>Production Unit</label>
                                <input name="productionUnit" value="${esc(g ? g.productionUnit : '')}" placeholder="m2/hr, m3/day…">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <textarea name="notes" style="resize:vertical;height:50px">${esc(g ? g.notes : '')}</textarea>
                        </div>
                        <div class="form-group" style="display:flex;align-items:center;gap:8px">
                            <input type="checkbox" name="active" id="chkActive" ${!g || g.active ? 'checked' : ''}>
                            <label for="chkActive" style="margin:0">Active</label>
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
            const fd   = new FormData(overlay.querySelector('#groupForm'));
            const name = fd.get('name').trim();
            if (!name) { Utils.showToast('Name is required', 'error'); return; }

            const payload = {
                name,
                description: fd.get('description').trim(),
                defaultProductionRate: parseFloat(fd.get('defaultProductionRate')) || 0,
                productionUnit: fd.get('productionUnit').trim(),
                notes: fd.get('notes').trim(),
                active: fd.get('active') === 'on',
            };

            const saveBtn = overlay.querySelector('#saveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';

            try {
                let saved;
                if (isEdit) {
                    saved = await _api('/api/resource-groups/' + g.id, {
                        method: 'PUT', body: JSON.stringify(payload)
                    });
                } else {
                    saved = await _api('/api/resource-groups', {
                        method: 'POST', body: JSON.stringify(payload)
                    });
                }
                overlay.remove();
                Utils.showToast(isEdit ? 'Crew updated' : 'Crew created');
                _selected = null;
                await _renderList();
                await _loadGroupDetail(saved.id);
            } catch (err) {
                Utils.showToast('Error: ' + err.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = isEdit ? 'Update' : 'Create';
            }
        });
    }

    // ── Labour line form ──────────────────────────────────────────────────────
    function _showLabourForm(groupId, line) {
        const isEdit = !!line;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:460px">
                <div class="modal-header"><h3 style="margin:0">${isEdit ? 'Edit Labour Line' : 'Add Labour Line'}</h3></div>
                <div class="modal-body">
                    <form id="labourForm">
                        <div class="form-group">
                            <label>Role / Trade *</label>
                            <input name="role" value="${esc(line ? line.role : '')}" placeholder="Carpenter, Labourer, Operator…" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Headcount</label>
                                <input type="number" name="quantity" min="0.5" step="0.5" value="${line ? line.quantity : 1}">
                            </div>
                            <div class="form-group">
                                <label>Straight $/hr *</label>
                                <input type="number" name="hourlyRate" min="0" step="0.01" value="${line ? line.hourlyRate : 0}" required>
                            </div>
                            <div class="form-group">
                                <label>OT $/hr</label>
                                <input type="number" name="otRate" min="0" step="0.01" value="${line ? (line.otRate || '') : ''}">
                            </div>
                            <div class="form-group">
                                <label>DT $/hr</label>
                                <input type="number" name="dtRate" min="0" step="0.01" value="${line ? (line.dtRate || '') : ''}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <input name="notes" value="${esc(line ? line.notes : '')}">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="cancelBtn">Cancel</button>
                    <button class="btn-primary" id="saveBtn">${isEdit ? 'Update' : 'Add'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#cancelBtn').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#saveBtn').addEventListener('click', async () => {
            const fd   = new FormData(overlay.querySelector('#labourForm'));
            const role = fd.get('role').trim();
            if (!role) { Utils.showToast('Role is required', 'error'); return; }

            const payload = {
                role,
                quantity:   parseFloat(fd.get('quantity')) || 1,
                hourlyRate: parseFloat(fd.get('hourlyRate')) || 0,
                otRate:     parseFloat(fd.get('otRate')) || 0,
                dtRate:     parseFloat(fd.get('dtRate')) || 0,
                notes:      fd.get('notes').trim(),
            };

            const saveBtn = overlay.querySelector('#saveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';

            try {
                if (isEdit) {
                    await _api(`/api/resource-groups/${groupId}/labour/${line.id}`, {
                        method: 'PUT', body: JSON.stringify(payload)
                    });
                } else {
                    await _api(`/api/resource-groups/${groupId}/labour`, {
                        method: 'POST', body: JSON.stringify(payload)
                    });
                }
                overlay.remove();
                Utils.showToast(isEdit ? 'Labour line updated' : 'Labour line added');
                await _loadGroupDetail(groupId);
            } catch (err) {
                Utils.showToast('Error: ' + err.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = isEdit ? 'Update' : 'Add';
            }
        });
    }

    // ── Equipment line form ───────────────────────────────────────────────────
    function _showEquipForm(groupId, eq) {
        const isEdit = !!eq;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:460px">
                <div class="modal-header"><h3 style="margin:0">${isEdit ? 'Edit Equipment Line' : 'Add Equipment Line'}</h3></div>
                <div class="modal-body">
                    <form id="equipForm">
                        <div class="form-group">
                            <label>Equipment Name *</label>
                            <input name="name" value="${esc(eq ? eq.name : '')}" placeholder="Excavator 30T, Compactor, etc." required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Quantity</label>
                                <input type="number" name="quantity" min="0.5" step="0.5" value="${eq ? eq.quantity : 1}">
                            </div>
                            <div class="form-group">
                                <label>$/hr *</label>
                                <input type="number" name="hourlyRate" min="0" step="0.01" value="${eq ? eq.hourlyRate : 0}" required>
                            </div>
                            <div class="form-group">
                                <label>$/day</label>
                                <input type="number" name="dailyRate" min="0" step="0.01" value="${eq ? (eq.dailyRate || '') : ''}">
                            </div>
                            <div class="form-group">
                                <label>Standby $/hr</label>
                                <input type="number" name="standbyRate" min="0" step="0.01" value="${eq ? (eq.standbyRate || '') : ''}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Notes</label>
                            <input name="notes" value="${esc(eq ? eq.notes : '')}">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="cancelBtn">Cancel</button>
                    <button class="btn-primary" id="saveBtn">${isEdit ? 'Update' : 'Add'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#cancelBtn').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#saveBtn').addEventListener('click', async () => {
            const fd   = new FormData(overlay.querySelector('#equipForm'));
            const name = fd.get('name').trim();
            if (!name) { Utils.showToast('Name is required', 'error'); return; }

            const payload = {
                name,
                quantity:     parseFloat(fd.get('quantity')) || 1,
                hourlyRate:   parseFloat(fd.get('hourlyRate')) || 0,
                dailyRate:    parseFloat(fd.get('dailyRate')) || 0,
                standbyRate:  parseFloat(fd.get('standbyRate')) || 0,
                notes:        fd.get('notes').trim(),
            };

            const saveBtn = overlay.querySelector('#saveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';

            try {
                if (isEdit) {
                    await _api(`/api/resource-groups/${groupId}/equipment/${eq.id}`, {
                        method: 'PUT', body: JSON.stringify(payload)
                    });
                } else {
                    await _api(`/api/resource-groups/${groupId}/equipment`, {
                        method: 'POST', body: JSON.stringify(payload)
                    });
                }
                overlay.remove();
                Utils.showToast(isEdit ? 'Equipment line updated' : 'Equipment line added');
                await _loadGroupDetail(groupId);
            } catch (err) {
                Utils.showToast('Error: ' + err.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = isEdit ? 'Update' : 'Add';
            }
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return { render };

})();
