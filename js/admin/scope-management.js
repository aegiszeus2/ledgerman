// Admin Scope Management Module
// Track scope items: proposed changes, potential cost/schedule impacts, approval status
window.AdminScopeManagement = {
    _filterProject: 'All',
    _filterStatus: 'All',

    render(container, params) {
        const self = this;
        self._container = container;
        self._renderList();
    },

    _renderList() {
        const self = this;
        const container = self._container;

        const projects = AppData.getProjects();
        const allItems = AppData.getAll ? AppData.getAll('scope_items') : [];

        const filtered = allItems.filter(item => {
            const projectMatch = self._filterProject === 'All' || item.projectId === self._filterProject;
            const statusMatch = self._filterStatus === 'All' || item.status === self._filterStatus;
            return projectMatch && statusMatch;
        });

        const sorted = filtered.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        const statuses = ['All', 'Proposed', 'Under Review', 'Approved', 'Rejected', 'Incorporated', 'Closed'];

        // Summary stats (all items regardless of filter)
        const totalItems = allItems.length;
        const openCount = allItems.filter(i => i.status === 'Proposed' || i.status === 'Under Review').length;
        const costExposureItems = allItems.filter(i => i.status === 'Proposed' || i.status === 'Under Review' || i.status === 'Approved');
        const potentialCostExposure = costExposureItems.reduce((sum, i) => sum + (parseFloat(i.potentialCostImpact) || 0), 0);

        function statusBadge(s) {
            const colors = { 'Proposed': '#0d6efd', 'Under Review': '#fd7e14', 'Approved': '#198754', 'Rejected': '#dc3545', 'Incorporated': '#6f42c1', 'Closed': '#495057' };
            const c = colors[s] || '#6c757d';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${c};color:white">${Utils.escapeHtml(s || 'Proposed')}</span>`;
        }

        function formatCurrency(val) {
            const n = parseFloat(val) || 0;
            const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return (n < 0 ? '-$' : '$') + abs;
        }

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h2 style="margin:0">Scope Management</h2>
                    <button class="btn-primary" id="addScopeBtn">+ Add Scope Item</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Track proposed scope changes, evaluate impacts, and manage approvals</p>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.8rem;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Total Items</div>
                    <div style="font-size:1.8rem;font-weight:700;color:var(--text-primary)">${totalItems}</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid ${openCount > 0 ? '#fd7e14' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.8rem;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Open (Proposed + Under Review)</div>
                    <div style="font-size:1.8rem;font-weight:700;color:${openCount > 0 ? '#fd7e14' : 'var(--text-primary)'}">${openCount}</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.8rem;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Potential Cost Exposure</div>
                    <div style="font-size:1.6rem;font-weight:700;color:${potentialCostExposure > 0 ? '#fd7e14' : potentialCostExposure < 0 ? '#198754' : 'var(--text-primary)'}">${formatCurrency(potentialCostExposure)}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">
                <div>
                    <label style="font-size:.85rem;color:var(--text2);display:block;margin-bottom:4px">Project:</label>
                    <select id="scopeProjectFilter" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.85rem;color:var(--text2);display:block;margin-bottom:4px">Status:</label>
                    <select id="scopeStatusFilter" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Project</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Scope Item</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Source</th>
                            <th style="padding:12px 14px;text-align:right;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Potential Cost</th>
                            <th style="padding:12px 14px;text-align:center;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Schedule Days</th>
                            <th style="padding:12px 14px;text-align:center;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Status</th>
                            <th style="padding:12px 14px;text-align:center;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.length > 0 ? sorted.map(item => {
                            const project = projects.find(p => p.id === item.projectId);
                            const cost = parseFloat(item.potentialCostImpact);
                            const costStr = !isNaN(cost) ? formatCurrency(cost) : '—';
                            const costColor = !isNaN(cost) && cost > 0 ? '#fd7e14' : !isNaN(cost) && cost < 0 ? '#198754' : 'var(--text-primary)';
                            const schedDays = item.potentialScheduleImpactDays !== undefined && item.potentialScheduleImpactDays !== null && item.potentialScheduleImpactDays !== '' ? item.potentialScheduleImpactDays : '—';
                            return `
                                <tr style="border-bottom:1px solid var(--border)">
                                    <td style="padding:12px 14px">${Utils.escapeHtml(project ? project.name : '—')}</td>
                                    <td style="padding:12px 14px">
                                        <div style="font-weight:500">${Utils.escapeHtml(item.scopeItem || '—')}</div>
                                        ${item.description ? `<div style="font-size:.8rem;color:var(--text2);margin-top:2px">${Utils.escapeHtml(item.description.length > 80 ? item.description.slice(0,80) + '…' : item.description)}</div>` : ''}
                                    </td>
                                    <td style="padding:12px 14px;font-size:.9rem">${Utils.escapeHtml(item.source || '—')}</td>
                                    <td style="padding:12px 14px;text-align:right;font-weight:600;color:${costColor}">${costStr}</td>
                                    <td style="padding:12px 14px;text-align:center;font-size:.9rem">${Utils.escapeHtml(String(schedDays))}</td>
                                    <td style="padding:12px 14px;text-align:center">${statusBadge(item.status || 'Proposed')}</td>
                                    <td style="padding:12px 14px;text-align:center;white-space:nowrap">
                                        <button class="btn-secondary btn-sm" data-id="${item.id}" data-action="edit">Edit</button>
                                        <button class="btn-secondary btn-sm" data-id="${item.id}" data-action="delete" style="margin-left:4px">Delete</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="7">
                                    <div style="text-align:center;padding:60px 20px;color:var(--text2)">
                                        <div style="font-size:2.5rem;margin-bottom:12px">🔍</div>
                                        <div style="font-size:1rem;margin-bottom:16px">No scope items found</div>
                                        <button class="btn-primary" id="addScopeBtnEmpty">+ Add Scope Item</button>
                                    </div>
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('addScopeBtn').onclick = () => self._showForm(null);

        const emptyBtn = document.getElementById('addScopeBtnEmpty');
        if (emptyBtn) emptyBtn.onclick = () => self._showForm(null);

        document.getElementById('scopeProjectFilter').onchange = (e) => {
            self._filterProject = e.target.value;
            self._renderList();
        };

        document.getElementById('scopeStatusFilter').onchange = (e) => {
            self._filterStatus = e.target.value;
            self._renderList();
        };

        document.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = (e) => { e.preventDefault(); self._showForm(btn.dataset.id); };
        });

        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to delete this scope item?')) {
                    try {
                        AppData.remove('scope_items', btn.dataset.id);
                        Utils.showToast('Scope item deleted', 'success');
                        self._renderList();
                    } catch (err) {
                        console.error('Delete failed:', err);
                        Utils.showToast('Failed to delete scope item', 'error');
                    }
                }
            };
        });
    },

    _showForm(itemId) {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const allItems = AppData.getAll ? AppData.getAll('scope_items') : [];
        const item = itemId ? allItems.find(i => i.id === itemId) : null;
        const isNew = !item;

        const v = (field, fallback) => item ? (item[field] !== undefined ? item[field] : fallback) : fallback;

        const inputStyle = 'style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;box-sizing:border-box"';
        const labelStyle = 'style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem"';
        const fieldDiv = 'style="margin-bottom:16px"';

        const sourceOptions = ['Contract', 'Client Request', 'Field Condition', 'Design Change', 'Internal'];
        const statusOptions = ['Proposed', 'Under Review', 'Approved', 'Rejected', 'Incorporated', 'Closed'];

        container.innerHTML = `
            <div style="max-width:700px;margin:0 auto">
                <h2 style="margin-bottom:20px">${isNew ? 'New Scope Item' : 'Edit Scope Item'}</h2>
                <form id="scopeForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:24px">

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Project *</label>
                            <select id="scopeProjectId" ${inputStyle} required>
                                <option value="">— Select Project —</option>
                                ${projects.map(p => `<option value="${p.id}" ${v('projectId','') === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label ${labelStyle}>Source</label>
                            <select id="scopeSource" ${inputStyle}>
                                <option value="">— Select Source —</option>
                                ${sourceOptions.map(s => `<option value="${s}" ${v('source','') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Scope Item (Title) *</label>
                        <input type="text" id="scopeItem" value="${Utils.escapeHtml(v('scopeItem',''))}" placeholder="Short title for this scope item" ${inputStyle} required />
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Description</label>
                        <textarea id="scopeDescription" rows="3" placeholder="Detailed description of the scope change or item..." ${inputStyle}>${Utils.escapeHtml(v('description',''))}</textarea>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Status</label>
                            <select id="scopeStatus" ${inputStyle}>
                                ${statusOptions.map(s => `<option value="${s}" ${v('status','Proposed') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label ${labelStyle}>Potential Cost Impact ($)</label>
                            <input type="number" id="scopeCostImpact" value="${v('potentialCostImpact','')}" placeholder="0.00" step="0.01" ${inputStyle} />
                        </div>
                        <div>
                            <label ${labelStyle}>Schedule Impact (days)</label>
                            <input type="number" id="scopeScheduleImpact" value="${v('potentialScheduleImpactDays','')}" placeholder="0" step="1" ${inputStyle} />
                        </div>
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Notes</label>
                        <textarea id="scopeNotes" rows="2" placeholder="Internal notes, decisions, references..." ${inputStyle}>${Utils.escapeHtml(v('notes',''))}</textarea>
                    </div>

                    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
                        <button type="button" id="scopeCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">Save Scope Item</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('scopeCancelBtn').onclick = () => self._renderList();

        document.getElementById('scopeForm').onsubmit = (e) => {
            e.preventDefault();
            const submitBtn = document.querySelector('#scopeForm [type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }
            try {
                const costVal = document.getElementById('scopeCostImpact').value;
                const schedVal = document.getElementById('scopeScheduleImpact').value;
                const record = {
                    id: item ? item.id : ('scope_' + Date.now()),
                    projectId: document.getElementById('scopeProjectId').value,
                    scopeItem: document.getElementById('scopeItem').value.trim(),
                    description: document.getElementById('scopeDescription').value.trim(),
                    source: document.getElementById('scopeSource').value,
                    status: document.getElementById('scopeStatus').value,
                    potentialCostImpact: costVal !== '' ? parseFloat(costVal) : null,
                    potentialScheduleImpactDays: schedVal !== '' ? parseInt(schedVal, 10) : null,
                    notes: document.getElementById('scopeNotes').value.trim(),
                    created_at: item ? item.created_at : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                AppData.save('scope_items', record);
                Utils.showToast(isNew ? 'Scope item created' : 'Scope item updated', 'success');
                self._renderList();
            } catch (err) {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Scope Item'; }
                console.error('Save failed:', err);
                Utils.showToast('Failed to save scope item: ' + err.message, 'error');
            }
        };
    }
};
