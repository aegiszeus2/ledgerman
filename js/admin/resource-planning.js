// Admin Resource Planning — Assignment Scheduling & Capacity Overview
// Track worker assignments across projects, detect over-allocation
window.AdminResourcePlanning = {
    _filterProject: 'All',
    _filterWorker: '',

    render(container) {
        const self = this;
        self._container = container;
        self._renderList();
    },

    _renderList() {
        const self = this;
        const container = self._container;

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const workers  = AppData.getWorkers  ? AppData.getWorkers()  : [];
        const allItems = AppData.getAll ? AppData.getAll('resource_assignments') : [];
        const items    = Array.isArray(allItems) ? allItems : [];

        const today = new Date().toISOString().slice(0, 10);

        // Filter
        const filtered = items.filter(item => {
            const projMatch = self._filterProject === 'All' || item.projectId === self._filterProject;
            const workerSearch = self._filterWorker.trim().toLowerCase();
            const workerName = (item.workerName || self._workerDisplayName(item, workers)).toLowerCase();
            const workerMatch = !workerSearch || workerName.includes(workerSearch);
            return projMatch && workerMatch;
        });

        // Summary stats
        const totalAssignments = items.length;
        const uniqueWorkers = new Set(items.map(i => i.workerId || i.workerName || '')).size;
        const activeAssignments = items.filter(i => {
            const start = i.startDate || '';
            const end   = i.endDate   || '';
            return (!start || start <= today) && (!end || end >= today);
        }).length;

        // Over-allocation map: workerId/workerName -> [{assignment}]
        const overAllocMap = self._buildOverAllocMap(items, today);

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h2 style="margin:0">Resource Planning</h2>
                    <button class="btn-primary" id="addAssignmentBtn">+ Add Assignment</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Schedule workers across projects and monitor capacity utilisation</p>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Total Assignments</div>
                    <div style="font-size:1.7rem;font-weight:700;color:var(--text-primary)">${totalAssignments}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Workers Assigned</div>
                    <div style="font-size:1.7rem;font-weight:700;color:var(--text-primary)">${uniqueWorkers}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid #198754">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Active Today</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#198754">${activeAssignments}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                    <select id="rpProjectFilter" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Worker Search</label>
                    <input type="text" id="rpWorkerSearch" placeholder="Search worker name…" value="${Utils.escapeHtml(self._filterWorker)}"
                        style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-width:180px" />
                </div>
            </div>

            <!-- Assignments Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border);margin-bottom:32px">
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:11px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.85rem">Project</th>
                            <th style="padding:11px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.85rem">Worker</th>
                            <th style="padding:11px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.85rem">Role</th>
                            <th style="padding:11px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.85rem;white-space:nowrap">Start Date</th>
                            <th style="padding:11px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.85rem;white-space:nowrap">End Date</th>
                            <th style="padding:11px 12px;text-align:center;border-bottom:2px solid var(--border);font-size:.85rem;white-space:nowrap">Alloc %</th>
                            <th style="padding:11px 12px;text-align:center;border-bottom:2px solid var(--border);font-size:.85rem;white-space:nowrap">Hrs/Week</th>
                            <th style="padding:11px 12px;text-align:center;border-bottom:2px solid var(--border);font-size:.85rem">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(item => {
                            const proj = projects.find(p => p.id === item.projectId);
                            const wKey = item.workerId || item.workerName || '';
                            const isOverAlloc = overAllocMap[wKey] && overAllocMap[wKey] > 100;
                            const displayName = self._workerDisplayName(item, workers);
                            const isActive = (!item.startDate || item.startDate <= today) && (!item.endDate || item.endDate >= today);
                            return `
                                <tr style="border-bottom:1px solid var(--border);${isActive ? '' : 'opacity:0.7'}">
                                    <td style="padding:10px 12px;font-size:.88rem">${Utils.escapeHtml(proj ? proj.name : 'Unknown')}</td>
                                    <td style="padding:10px 12px;font-size:.88rem">
                                        ${Utils.escapeHtml(displayName)}
                                        ${isOverAlloc ? `<span style="margin-left:6px;padding:2px 8px;border-radius:10px;font-size:.72rem;font-weight:600;background:#fd7e14;color:white">Over-allocated</span>` : ''}
                                    </td>
                                    <td style="padding:10px 12px;font-size:.88rem;color:var(--text2)">${Utils.escapeHtml(item.role || '—')}</td>
                                    <td style="padding:10px 12px;font-size:.85rem">${item.startDate || '—'}</td>
                                    <td style="padding:10px 12px;font-size:.85rem">${item.endDate || '—'}</td>
                                    <td style="padding:10px 12px;text-align:center;font-size:.9rem;font-weight:600">${parseFloat(item.allocationPercent)||100}%</td>
                                    <td style="padding:10px 12px;text-align:center;font-size:.88rem">${item.hoursPerWeek ? item.hoursPerWeek + 'h' : '—'}</td>
                                    <td style="padding:10px 12px;text-align:center;white-space:nowrap">
                                        <button class="btn-secondary btn-sm" data-id="${item.id}" data-action="edit" style="margin-right:4px">Edit</button>
                                        <button class="btn-secondary btn-sm" data-id="${item.id}" data-action="delete">Delete</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="8" style="padding:36px;text-align:center;color:var(--text2)">
                                    No assignments found. Click "+ Add Assignment" to schedule a worker.
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>

            <!-- Capacity Overview -->
            ${self._renderCapacitySection(items, workers, projects, today, overAllocMap)}
        `;

        document.getElementById('rpProjectFilter').onchange = e => { self._filterProject = e.target.value; self._renderList(); };
        document.getElementById('rpWorkerSearch').oninput = e => { self._filterWorker = e.target.value; self._renderList(); };

        document.getElementById('addAssignmentBtn').onclick = () => self._showForm(null);

        container.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = () => self._showForm(btn.dataset.id);
        });

        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this assignment?')) {
                    try {
                        AppData.remove('resource_assignments', btn.dataset.id);
                        Utils.showToast('Assignment deleted', 'success');
                        self._renderList();
                    } catch(err) {
                        console.error('Delete failed:', err);
                        Utils.showToast('Failed to delete', 'error');
                    }
                }
            };
        });
    },

    _workerDisplayName(item, workers) {
        if (item.workerId) {
            const w = workers.find(wk => wk.id === item.workerId);
            if (w) return w.name || w.id;
        }
        return item.workerName || 'Unknown';
    },

    // Build map of workerKey -> total concurrent allocation on any given day
    _buildOverAllocMap(items, today) {
        const map = {};
        // For each worker, find all active assignments (overlapping today)
        items.forEach(item => {
            const wKey = item.workerId || item.workerName || '';
            if (!wKey) return;
            const start = item.startDate || '0000-01-01';
            const end   = item.endDate   || '9999-12-31';
            if (start <= today && end >= today) {
                map[wKey] = (map[wKey] || 0) + (parseFloat(item.allocationPercent) || 100);
            }
        });
        return map;
    },

    _renderCapacitySection(items, workers, projects, today, overAllocMap) {
        // Get all unique worker keys from active assignments
        const activeItems = items.filter(i => {
            const s = i.startDate || '0000-01-01';
            const e = i.endDate   || '9999-12-31';
            return s <= today && e >= today;
        });

        if (activeItems.length === 0) {
            return `<div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border);color:var(--text2);text-align:center;font-size:.9rem">No active assignments today — capacity overview unavailable.</div>`;
        }

        const self = this;
        const rows = activeItems.map(item => {
            const proj = projects.find(p => p.id === item.projectId);
            const wKey = item.workerId || item.workerName || '';
            const totalAlloc = overAllocMap[wKey] || (parseFloat(item.allocationPercent) || 100);
            const isOver = totalAlloc > 100;
            const displayName = self._workerDisplayName(item, workers);
            return `
                <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:9px 12px;font-size:.88rem">${Utils.escapeHtml(displayName)}</td>
                    <td style="padding:9px 12px;font-size:.88rem">${Utils.escapeHtml(proj ? proj.name : 'Unknown')}</td>
                    <td style="padding:9px 12px;font-size:.85rem">${item.startDate || '—'} – ${item.endDate || 'ongoing'}</td>
                    <td style="padding:9px 12px;text-align:center;font-size:.88rem;font-weight:600">
                        ${parseFloat(item.allocationPercent)||100}%
                    </td>
                    <td style="padding:9px 12px;text-align:center">
                        ${isOver ? `<span style="padding:2px 10px;border-radius:10px;font-size:.75rem;font-weight:600;background:#fd7e14;color:white">Total ${totalAlloc}% — Over-allocated</span>` : `<span style="padding:2px 10px;border-radius:10px;font-size:.75rem;font-weight:600;background:#198754;color:white">OK (${totalAlloc}%)</span>`}
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div style="margin-top:8px">
                <h3 style="font-size:1rem;margin-bottom:12px">Capacity Overview — Active Assignments</h3>
                <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                    <table style="width:100%;border-collapse:collapse">
                        <thead>
                            <tr style="background:var(--card)">
                                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.82rem">Worker</th>
                                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.82rem">Project</th>
                                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.82rem">Dates</th>
                                <th style="padding:10px 12px;text-align:center;border-bottom:2px solid var(--border);font-size:.82rem">Allocation %</th>
                                <th style="padding:10px 12px;text-align:center;border-bottom:2px solid var(--border);font-size:.82rem">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    _showForm(itemId) {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const workers  = AppData.getWorkers  ? AppData.getWorkers()  : [];
        const allItems = AppData.getAll ? AppData.getAll('resource_assignments') : [];
        const item = itemId ? (Array.isArray(allItems) ? allItems.find(i => i.id === itemId) : null) : null;

        const isNew = !item;
        const id = item ? item.id : ('resassign_' + Date.now());
        const fv = (field, def) => item ? (item[field] !== undefined && item[field] !== null ? item[field] : def) : def;

        const hasWorkerSelected = item && item.workerId;

        container.innerHTML = `
            <div style="max-width:620px;margin:0 auto">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
                    <button class="btn-secondary btn-sm" id="rpBackBtn">← Back</button>
                    <h2 style="margin:0">${isNew ? 'Add Assignment' : 'Edit Assignment'}</h2>
                </div>

                <form id="rpForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                        <div style="grid-column:1/-1">
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Project *</label>
                            <select id="rpProjectId" required style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                <option value="">— Select Project —</option>
                                ${projects.map(p => `<option value="${p.id}" ${fv('projectId','') === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>

                        <div style="grid-column:1/-1">
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Worker</label>
                            <select id="rpWorkerSelect" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;margin-bottom:8px">
                                <option value="">— Select from workers list (or type name below) —</option>
                                ${workers.map(w => `<option value="${w.id}" ${fv('workerId','') === w.id ? 'selected' : ''}>${Utils.escapeHtml(w.name || w.id)}</option>`).join('')}
                            </select>
                            <input type="text" id="rpWorkerName" placeholder="Or type worker name if not in system"
                                value="${Utils.escapeHtml(fv('workerName',''))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                            <div style="font-size:.78rem;color:var(--text2);margin-top:4px">Select a worker from the dropdown OR type a name. If both are filled, the dropdown takes precedence.</div>
                        </div>

                        <div style="grid-column:1/-1">
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Role</label>
                            <input type="text" id="rpRole" placeholder="e.g., Site Supervisor, Electrician" value="${Utils.escapeHtml(fv('role',''))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>

                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Start Date *</label>
                            <input type="date" id="rpStartDate" required value="${fv('startDate','')}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">End Date *</label>
                            <input type="date" id="rpEndDate" required value="${fv('endDate','')}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>

                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Allocation % (1–100)</label>
                            <input type="number" id="rpAllocation" min="1" max="100" step="1" value="${fv('allocationPercent',100)}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Hours/Week (optional)</label>
                            <input type="number" id="rpHoursPerWeek" min="0" step="0.5" value="${fv('hoursPerWeek','')}"
                                placeholder="e.g., 40"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>

                        <div style="grid-column:1/-1">
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Notes</label>
                            <textarea id="rpNotes" rows="2" placeholder="Additional notes about this assignment…"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;resize:vertical">${Utils.escapeHtml(fv('notes',''))}</textarea>
                        </div>
                    </div>

                    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:16px;border-top:1px solid var(--border);margin-top:4px">
                        <button type="button" id="rpCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">${isNew ? 'Create Assignment' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('rpBackBtn').onclick = () => self._renderList();
        document.getElementById('rpCancelBtn').onclick = () => self._renderList();

        document.getElementById('rpForm').onsubmit = e => {
            e.preventDefault();
            const submitBtn = document.querySelector('#rpForm [type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

            try {
                const workerIdVal = document.getElementById('rpWorkerSelect').value;
                const workerNameVal = document.getElementById('rpWorkerName').value.trim();
                const newItem = {
                    id,
                    projectId:         document.getElementById('rpProjectId').value,
                    workerId:          workerIdVal || null,
                    workerName:        workerIdVal ? '' : workerNameVal,
                    role:              document.getElementById('rpRole').value,
                    startDate:         document.getElementById('rpStartDate').value,
                    endDate:           document.getElementById('rpEndDate').value,
                    allocationPercent: Math.min(100, Math.max(1, parseFloat(document.getElementById('rpAllocation').value) || 100)),
                    hoursPerWeek:      parseFloat(document.getElementById('rpHoursPerWeek').value) || null,
                    notes:             document.getElementById('rpNotes').value,
                    created_at: item ? item.created_at : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                AppData.save('resource_assignments', newItem);
                Utils.showToast(isNew ? 'Assignment created' : 'Assignment updated', 'success');
                self._renderList();
            } catch(err) {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = isNew ? 'Create Assignment' : 'Save Changes'; }
                console.error('Save failed:', err);
                Utils.showToast('Failed to save: ' + err.message, 'error');
            }
        };
    }
};
