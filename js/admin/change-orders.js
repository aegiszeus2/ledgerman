// Admin Change Orders Module
// Track scope changes, cost impacts, and schedule adjustments through approval workflow
window.AdminChangeOrders = {
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
        const allItems = AppData.getAll ? AppData.getAll('change_orders') : [];

        const filtered = allItems.filter(item => {
            const projectMatch = self._filterProject === 'All' || item.projectId === self._filterProject;
            const statusMatch = self._filterStatus === 'All' || item.status === self._filterStatus;
            return projectMatch && statusMatch;
        });

        const sorted = filtered.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        const statuses = ['All', 'Draft', 'Submitted', 'Pending Approval', 'Approved', 'Rejected', 'Closed'];

        // Summary stats (from all items, not filtered)
        const totalCOs = allItems.length;
        const approvedItems = allItems.filter(i => i.status === 'Approved');
        const approvedCost = approvedItems.reduce((sum, i) => sum + (parseFloat(i.costImpact) || 0), 0);
        const pendingCount = allItems.filter(i => i.status === 'Pending Approval' || i.status === 'Submitted').length;

        function formatCurrency(val) {
            const n = parseFloat(val) || 0;
            const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return (n < 0 ? '-$' : '$') + abs;
        }

        function statusBadge(s) {
            const colors = { 'Draft': '#6c757d', 'Submitted': '#0d6efd', 'Pending Approval': '#fd7e14', 'Approved': '#198754', 'Rejected': '#dc3545', 'Closed': '#495057' };
            const c = colors[s] || '#6c757d';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${c};color:white">${Utils.escapeHtml(s || 'Draft')}</span>`;
        }

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h2 style="margin:0">Change Orders</h2>
                    <button class="btn-primary" id="addCoBtn">+ Add Change Order</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Manage scope changes, cost impacts, and schedule adjustments</p>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.8rem;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Total COs</div>
                    <div style="font-size:1.8rem;font-weight:700;color:var(--text-primary)">${totalCOs}</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.8rem;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Approved Cost Impact</div>
                    <div style="font-size:1.8rem;font-weight:700;color:${approvedCost < 0 ? '#dc3545' : '#198754'}">${formatCurrency(approvedCost)}</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid ${pendingCount > 0 ? '#fd7e14' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.8rem;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Pending</div>
                    <div style="font-size:1.8rem;font-weight:700;color:${pendingCount > 0 ? '#fd7e14' : 'var(--text-primary)'}">${pendingCount}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">
                <div>
                    <label style="font-size:.85rem;color:var(--text2);display:block;margin-bottom:4px">Project:</label>
                    <select id="coProjectFilter" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.85rem;color:var(--text2);display:block;margin-bottom:4px">Status:</label>
                    <select id="coStatusFilter" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">CO #</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Project</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Title</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Reason</th>
                            <th style="padding:12px 14px;text-align:right;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Cost Impact</th>
                            <th style="padding:12px 14px;text-align:center;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Schedule (days)</th>
                            <th style="padding:12px 14px;text-align:center;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Status</th>
                            <th style="padding:12px 14px;text-align:center;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.length > 0 ? sorted.map(item => {
                            const project = projects.find(p => p.id === item.projectId);
                            const cost = parseFloat(item.costImpact) || 0;
                            const costStr = formatCurrency(cost);
                            const costColor = cost < 0 ? '#dc3545' : cost > 0 ? '#198754' : 'var(--text-primary)';
                            const schedDays = item.scheduleImpactDays !== undefined && item.scheduleImpactDays !== '' ? item.scheduleImpactDays : '—';
                            return `
                                <tr style="border-bottom:1px solid var(--border)">
                                    <td style="padding:12px 14px;font-weight:600;color:var(--primary)">${Utils.escapeHtml(item.changeOrderNumber || '—')}</td>
                                    <td style="padding:12px 14px">${Utils.escapeHtml(project ? project.name : '—')}</td>
                                    <td style="padding:12px 14px">
                                        <div style="font-weight:500">${Utils.escapeHtml(item.title || '—')}</div>
                                        ${item.requestedBy ? `<div style="font-size:.8rem;color:var(--text2);margin-top:2px">By: ${Utils.escapeHtml(item.requestedBy)}</div>` : ''}
                                    </td>
                                    <td style="padding:12px 14px;font-size:.9rem">${Utils.escapeHtml(item.reason || '—')}</td>
                                    <td style="padding:12px 14px;text-align:right;font-weight:600;color:${costColor}">${costStr}</td>
                                    <td style="padding:12px 14px;text-align:center;font-size:.9rem">${Utils.escapeHtml(String(schedDays))}</td>
                                    <td style="padding:12px 14px;text-align:center">${statusBadge(item.status || 'Draft')}</td>
                                    <td style="padding:12px 14px;text-align:center;white-space:nowrap">
                                        <button class="btn-secondary btn-sm" data-id="${item.id}" data-action="edit">Edit</button>
                                        <button class="btn-secondary btn-sm" data-id="${item.id}" data-action="delete" style="margin-left:4px">Delete</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="8">
                                    <div style="text-align:center;padding:60px 20px;color:var(--text2)">
                                        <div style="font-size:2.5rem;margin-bottom:12px">📝</div>
                                        <div style="font-size:1rem;margin-bottom:16px">No change orders found</div>
                                        <button class="btn-primary" id="addCoBtnEmpty">+ Add Change Order</button>
                                    </div>
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('addCoBtn').onclick = () => self._showForm(null);

        const emptyBtn = document.getElementById('addCoBtnEmpty');
        if (emptyBtn) emptyBtn.onclick = () => self._showForm(null);

        document.getElementById('coProjectFilter').onchange = (e) => {
            self._filterProject = e.target.value;
            self._renderList();
        };

        document.getElementById('coStatusFilter').onchange = (e) => {
            self._filterStatus = e.target.value;
            self._renderList();
        };

        document.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = (e) => { e.preventDefault(); self._showForm(btn.dataset.id); };
        });

        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to delete this change order?')) {
                    try {
                        AppData.remove('change_orders', btn.dataset.id);
                        Utils.showToast('Change order deleted', 'success');
                        self._renderList();
                    } catch (err) {
                        console.error('Delete failed:', err);
                        Utils.showToast('Failed to delete change order', 'error');
                    }
                }
            };
        });
    },

    _showForm(itemId) {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const allItems = AppData.getAll ? AppData.getAll('change_orders') : [];
        const item = itemId ? allItems.find(i => i.id === itemId) : null;
        const isNew = !item;

        const v = (field, fallback) => item ? (item[field] !== undefined ? item[field] : fallback) : fallback;

        const inputStyle = 'style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;box-sizing:border-box"';
        const labelStyle = 'style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem"';
        const fieldDiv = 'style="margin-bottom:16px"';

        const reasonOptions = ['Client Request', 'Field Condition', 'Design Change', 'Error/Omission', 'Code Requirement', 'Owner Direction', 'Other'];
        const statusOptions = ['Draft', 'Submitted', 'Pending Approval', 'Approved', 'Rejected', 'Closed'];

        container.innerHTML = `
            <div style="max-width:700px;margin:0 auto">
                <h2 style="margin-bottom:20px">${isNew ? 'New Change Order' : 'Edit Change Order'}</h2>
                <form id="coForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:24px">

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Project *</label>
                            <select id="coProjectId" ${inputStyle} required>
                                <option value="">— Select Project —</option>
                                ${projects.map(p => `<option value="${p.id}" ${v('projectId','') === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label ${labelStyle}>CO Number</label>
                            <input type="text" id="coNumber" value="${Utils.escapeHtml(v('changeOrderNumber',''))}" placeholder="e.g. CO-001" ${inputStyle} />
                        </div>
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Title *</label>
                        <input type="text" id="coTitle" value="${Utils.escapeHtml(v('title',''))}" placeholder="Brief title for this change order" ${inputStyle} required />
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Description</label>
                        <textarea id="coDescription" rows="3" placeholder="Detailed description of the scope change..." ${inputStyle}>${Utils.escapeHtml(v('description',''))}</textarea>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Reason</label>
                            <select id="coReason" ${inputStyle}>
                                <option value="">— Select Reason —</option>
                                ${reasonOptions.map(r => `<option value="${r}" ${v('reason','') === r ? 'selected' : ''}>${r}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label ${labelStyle}>Status</label>
                            <select id="coStatus" ${inputStyle}>
                                ${statusOptions.map(s => `<option value="${s}" ${v('status','Draft') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Cost Impact ($)</label>
                            <input type="number" id="coCostImpact" value="${v('costImpact','')}" placeholder="0.00" step="0.01" ${inputStyle} />
                            <div style="font-size:.8rem;color:var(--text2);margin-top:4px">Use negative value for credits</div>
                        </div>
                        <div>
                            <label ${labelStyle}>Schedule Impact (days)</label>
                            <input type="number" id="coScheduleImpact" value="${v('scheduleImpactDays','')}" placeholder="0" step="1" ${inputStyle} />
                            <div style="font-size:.8rem;color:var(--text2);margin-top:4px">Negative = schedule reduction</div>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Requested By</label>
                            <input type="text" id="coRequestedBy" value="${Utils.escapeHtml(v('requestedBy',''))}" placeholder="Name of requestor" ${inputStyle} />
                        </div>
                        <div>
                            <label ${labelStyle}>Client Reference</label>
                            <input type="text" id="coClientReference" value="${Utils.escapeHtml(v('clientReference',''))}" placeholder="Client's reference number" ${inputStyle} />
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Submitted Date</label>
                            <input type="date" id="coSubmittedDate" value="${v('submittedDate','')}" ${inputStyle} />
                        </div>
                        <div>
                            <label ${labelStyle}>Approved Date</label>
                            <input type="date" id="coApprovedDate" value="${v('approvedDate','')}" ${inputStyle} />
                        </div>
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Notes</label>
                        <textarea id="coNotes" rows="2" placeholder="Internal notes..." ${inputStyle}>${Utils.escapeHtml(v('notes',''))}</textarea>
                    </div>

                    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
                        <button type="button" id="coCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">Save Change Order</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('coCancelBtn').onclick = () => self._renderList();

        document.getElementById('coForm').onsubmit = (e) => {
            e.preventDefault();
            const submitBtn = document.querySelector('#coForm [type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }
            try {
                const costVal = document.getElementById('coCostImpact').value;
                const schedVal = document.getElementById('coScheduleImpact').value;
                const record = {
                    id: item ? item.id : ('co_' + Date.now()),
                    projectId: document.getElementById('coProjectId').value,
                    changeOrderNumber: document.getElementById('coNumber').value.trim(),
                    title: document.getElementById('coTitle').value.trim(),
                    description: document.getElementById('coDescription').value.trim(),
                    reason: document.getElementById('coReason').value,
                    costImpact: costVal !== '' ? parseFloat(costVal) : null,
                    scheduleImpactDays: schedVal !== '' ? parseInt(schedVal, 10) : null,
                    status: document.getElementById('coStatus').value,
                    requestedBy: document.getElementById('coRequestedBy').value.trim(),
                    submittedDate: document.getElementById('coSubmittedDate').value,
                    approvedDate: document.getElementById('coApprovedDate').value,
                    clientReference: document.getElementById('coClientReference').value.trim(),
                    notes: document.getElementById('coNotes').value.trim(),
                    created_at: item ? item.created_at : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                AppData.save('change_orders', record);
                Utils.showToast(isNew ? 'Change order created' : 'Change order updated', 'success');
                self._renderList();
            } catch (err) {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Change Order'; }
                console.error('Save failed:', err);
                Utils.showToast('Failed to save change order: ' + err.message, 'error');
            }
        };
    }
};
