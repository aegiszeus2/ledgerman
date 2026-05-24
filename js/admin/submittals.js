// Admin Submittals Module
// Submittal log: track shop drawings, product data, samples through review cycle
window.AdminSubmittals = {
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
        const allItems = AppData.getAll ? AppData.getAll('submittals') : [];

        const filtered = allItems.filter(item => {
            const projectMatch = self._filterProject === 'All' || item.projectId === self._filterProject;
            const statusMatch = self._filterStatus === 'All' || item.status === self._filterStatus;
            return projectMatch && statusMatch;
        });

        const sorted = filtered.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        const statuses = ['All', 'Draft', 'Submitted', 'Under Review', 'Revise & Resubmit', 'Approved', 'Approved as Noted', 'Rejected', 'Closed'];

        function statusBadge(s) {
            const configs = {
                'Draft': { bg: '#6c757d', color: 'white' },
                'Submitted': { bg: '#0d6efd', color: 'white' },
                'Under Review': { bg: '#fd7e14', color: 'white' },
                'Revise & Resubmit': { bg: '#ffc107', color: '#333' },
                'Approved': { bg: '#198754', color: 'white' },
                'Approved as Noted': { bg: '#20c997', color: 'white' },
                'Rejected': { bg: '#dc3545', color: 'white' },
                'Closed': { bg: '#495057', color: 'white' }
            };
            const cfg = configs[s] || { bg: '#6c757d', color: 'white' };
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${cfg.bg};color:${cfg.color};white-space:nowrap">${Utils.escapeHtml(s || 'Draft')}</span>`;
        }

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h2 style="margin:0">Submittals</h2>
                    <button class="btn-primary" id="addSubmittalBtn">+ Add Submittal</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Track shop drawings, product data, and samples through the review cycle</p>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">
                <div>
                    <label style="font-size:.85rem;color:var(--text2);display:block;margin-bottom:4px">Project:</label>
                    <select id="submittalProjectFilter" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.85rem;color:var(--text2);display:block;margin-bottom:4px">Status:</label>
                    <select id="submittalStatusFilter" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">#</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Project</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Spec Section</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Title</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Submitted By</th>
                            <th style="padding:12px 14px;text-align:center;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Status</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Required Date</th>
                            <th style="padding:12px 14px;text-align:center;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.length > 0 ? sorted.map(item => {
                            const project = projects.find(p => p.id === item.projectId);
                            return `
                                <tr style="border-bottom:1px solid var(--border)">
                                    <td style="padding:12px 14px;font-weight:600;color:var(--primary)">${Utils.escapeHtml(item.submittalNumber || '—')}</td>
                                    <td style="padding:12px 14px">${Utils.escapeHtml(project ? project.name : '—')}</td>
                                    <td style="padding:12px 14px;font-size:.9rem">${Utils.escapeHtml(item.specSection || '—')}</td>
                                    <td style="padding:12px 14px">
                                        <div style="font-weight:500">${Utils.escapeHtml(item.title || '—')}</div>
                                        ${item.reviewer ? `<div style="font-size:.8rem;color:var(--text2);margin-top:2px">Reviewer: ${Utils.escapeHtml(item.reviewer)}</div>` : ''}
                                    </td>
                                    <td style="padding:12px 14px">${Utils.escapeHtml(item.submittedBy || '—')}</td>
                                    <td style="padding:12px 14px;text-align:center">${statusBadge(item.status || 'Draft')}</td>
                                    <td style="padding:12px 14px;font-size:.9rem">${item.requiredDate ? Utils.formatDate(item.requiredDate) : '—'}</td>
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
                                        <div style="font-size:2.5rem;margin-bottom:12px">📁</div>
                                        <div style="font-size:1rem;margin-bottom:16px">No submittals found</div>
                                        <button class="btn-primary" id="addSubmittalBtnEmpty">+ Add Submittal</button>
                                    </div>
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('addSubmittalBtn').onclick = () => self._showForm(null);

        const emptyBtn = document.getElementById('addSubmittalBtnEmpty');
        if (emptyBtn) emptyBtn.onclick = () => self._showForm(null);

        document.getElementById('submittalProjectFilter').onchange = (e) => {
            self._filterProject = e.target.value;
            self._renderList();
        };

        document.getElementById('submittalStatusFilter').onchange = (e) => {
            self._filterStatus = e.target.value;
            self._renderList();
        };

        document.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = (e) => { e.preventDefault(); self._showForm(btn.dataset.id); };
        });

        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to delete this submittal?')) {
                    try {
                        AppData.remove('submittals', btn.dataset.id);
                        Utils.showToast('Submittal deleted', 'success');
                        self._renderList();
                    } catch (err) {
                        console.error('Delete failed:', err);
                        Utils.showToast('Failed to delete submittal', 'error');
                    }
                }
            };
        });
    },

    _showForm(itemId) {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const allItems = AppData.getAll ? AppData.getAll('submittals') : [];
        const item = itemId ? allItems.find(i => i.id === itemId) : null;
        const isNew = !item;

        const v = (field, fallback) => item ? (item[field] !== undefined ? item[field] : fallback) : fallback;

        const inputStyle = 'style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;box-sizing:border-box"';
        const labelStyle = 'style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem"';
        const fieldDiv = 'style="margin-bottom:16px"';

        const statusOptions = ['Draft', 'Submitted', 'Under Review', 'Revise & Resubmit', 'Approved', 'Approved as Noted', 'Rejected', 'Closed'];

        container.innerHTML = `
            <div style="max-width:700px;margin:0 auto">
                <h2 style="margin-bottom:20px">${isNew ? 'New Submittal' : 'Edit Submittal'}</h2>
                <form id="submittalForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:24px">

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Project *</label>
                            <select id="submittalProjectId" ${inputStyle} required>
                                <option value="">— Select Project —</option>
                                ${projects.map(p => `<option value="${p.id}" ${v('projectId','') === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label ${labelStyle}>Submittal Number</label>
                            <input type="text" id="submittalNumber" value="${Utils.escapeHtml(v('submittalNumber',''))}" placeholder="e.g. SUB-001" ${inputStyle} />
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Spec Section</label>
                            <input type="text" id="submittalSpecSection" value="${Utils.escapeHtml(v('specSection',''))}" placeholder="e.g. 03 30 00" ${inputStyle} />
                        </div>
                        <div>
                            <label ${labelStyle}>Status</label>
                            <select id="submittalStatus" ${inputStyle}>
                                ${statusOptions.map(s => `<option value="${s}" ${v('status','Draft') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Title *</label>
                        <input type="text" id="submittalTitle" value="${Utils.escapeHtml(v('title',''))}" placeholder="e.g. Concrete Mix Design" ${inputStyle} required />
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Description</label>
                        <textarea id="submittalDescription" rows="3" placeholder="Detailed description of the submittal..." ${inputStyle}>${Utils.escapeHtml(v('description',''))}</textarea>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Submitted By</label>
                            <input type="text" id="submittalSubmittedBy" value="${Utils.escapeHtml(v('submittedBy',''))}" placeholder="Subcontractor or name" ${inputStyle} />
                        </div>
                        <div>
                            <label ${labelStyle}>Reviewer</label>
                            <input type="text" id="submittalReviewer" value="${Utils.escapeHtml(v('reviewer',''))}" placeholder="Architect, engineer, etc." ${inputStyle} />
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Required Date</label>
                            <input type="date" id="submittalRequiredDate" value="${v('requiredDate','')}" ${inputStyle} />
                        </div>
                        <div>
                            <label ${labelStyle}>Submitted Date</label>
                            <input type="date" id="submittalSubmittedDate" value="${v('submittedDate','')}" ${inputStyle} />
                        </div>
                        <div>
                            <label ${labelStyle}>Returned Date</label>
                            <input type="date" id="submittalReturnedDate" value="${v('returnedDate','')}" ${inputStyle} />
                        </div>
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Notes</label>
                        <textarea id="submittalNotes" rows="2" placeholder="Internal notes, revision comments..." ${inputStyle}>${Utils.escapeHtml(v('notes',''))}</textarea>
                    </div>

                    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
                        <button type="button" id="submittalCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">Save Submittal</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('submittalCancelBtn').onclick = () => self._renderList();

        document.getElementById('submittalForm').onsubmit = (e) => {
            e.preventDefault();
            const submitBtn = document.querySelector('#submittalForm [type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }
            try {
                const record = {
                    id: item ? item.id : ('submittal_' + Date.now()),
                    projectId: document.getElementById('submittalProjectId').value,
                    submittalNumber: document.getElementById('submittalNumber').value.trim(),
                    specSection: document.getElementById('submittalSpecSection').value.trim(),
                    title: document.getElementById('submittalTitle').value.trim(),
                    description: document.getElementById('submittalDescription').value.trim(),
                    submittedBy: document.getElementById('submittalSubmittedBy').value.trim(),
                    reviewer: document.getElementById('submittalReviewer').value.trim(),
                    status: document.getElementById('submittalStatus').value,
                    requiredDate: document.getElementById('submittalRequiredDate').value,
                    submittedDate: document.getElementById('submittalSubmittedDate').value,
                    returnedDate: document.getElementById('submittalReturnedDate').value,
                    notes: document.getElementById('submittalNotes').value.trim(),
                    created_at: item ? item.created_at : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                AppData.save('submittals', record);
                Utils.showToast(isNew ? 'Submittal created' : 'Submittal updated', 'success');
                self._renderList();
            } catch (err) {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Submittal'; }
                console.error('Save failed:', err);
                Utils.showToast('Failed to save submittal: ' + err.message, 'error');
            }
        };
    }
};
