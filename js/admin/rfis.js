// Admin RFIs Module
// Request for Information tracking: submit, assign, respond, close
window.AdminRfis = {
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
        const allItems = AppData.getAll ? AppData.getAll('rfis') : [];

        const filtered = allItems.filter(item => {
            const projectMatch = self._filterProject === 'All' || item.projectId === self._filterProject;
            const statusMatch = self._filterStatus === 'All' || item.status === self._filterStatus;
            return projectMatch && statusMatch;
        });

        const sorted = filtered.slice().sort((a, b) => {
            const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
            return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        });

        const statuses = ['All', 'Draft', 'Open', 'Answered', 'Closed', 'Void'];

        function priorityBadge(p) {
            const colors = { 'Low': '#6c757d', 'Medium': '#0d6efd', 'High': '#fd7e14', 'Urgent': '#dc3545' };
            const c = colors[p] || '#6c757d';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${c};color:white">${Utils.escapeHtml(p || 'Medium')}</span>`;
        }

        function statusBadge(s) {
            const colors = { 'Draft': '#6c757d', 'Open': '#0d6efd', 'Answered': '#198754', 'Closed': '#495057', 'Void': '#adb5bd' };
            const c = colors[s] || '#6c757d';
            const textColor = s === 'Void' ? '#333' : 'white';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${c};color:${textColor}">${Utils.escapeHtml(s || 'Draft')}</span>`;
        }

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h2 style="margin:0">RFIs</h2>
                    <button class="btn-primary" id="addRfiBtn">+ Add RFI</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Request for Information — submit questions, track responses</p>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">
                <div>
                    <label style="font-size:.85rem;color:var(--text2);display:block;margin-bottom:4px">Project:</label>
                    <select id="rfiProjectFilter" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.85rem;color:var(--text2);display:block;margin-bottom:4px">Status:</label>
                    <select id="rfiStatusFilter" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">RFI #</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Project</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Subject</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Assigned To</th>
                            <th style="padding:12px 14px;text-align:center;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Priority</th>
                            <th style="padding:12px 14px;text-align:center;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Status</th>
                            <th style="padding:12px 14px;text-align:left;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Due Date</th>
                            <th style="padding:12px 14px;text-align:center;font-size:.85rem;color:var(--text2);font-weight:600;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.length > 0 ? sorted.map(item => {
                            const project = projects.find(p => p.id === item.projectId);
                            return `
                                <tr style="border-bottom:1px solid var(--border)">
                                    <td style="padding:12px 14px;font-weight:600;color:var(--primary)">${Utils.escapeHtml(item.rfiNumber || '—')}</td>
                                    <td style="padding:12px 14px">${Utils.escapeHtml(project ? project.name : '—')}</td>
                                    <td style="padding:12px 14px">
                                        <div style="font-weight:500">${Utils.escapeHtml(item.subject || '—')}</div>
                                        ${item.submittedBy ? `<div style="font-size:.8rem;color:var(--text2);margin-top:2px">By: ${Utils.escapeHtml(item.submittedBy)}</div>` : ''}
                                    </td>
                                    <td style="padding:12px 14px">${Utils.escapeHtml(item.assignedTo || '—')}</td>
                                    <td style="padding:12px 14px;text-align:center">${priorityBadge(item.priority || 'Medium')}</td>
                                    <td style="padding:12px 14px;text-align:center">${statusBadge(item.status || 'Draft')}</td>
                                    <td style="padding:12px 14px;font-size:.9rem">${item.dueDate ? Utils.formatDate(item.dueDate) : '—'}</td>
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
                                        <div style="font-size:2.5rem;margin-bottom:12px">📋</div>
                                        <div style="font-size:1rem;margin-bottom:16px">No RFIs found</div>
                                        <button class="btn-primary" id="addRfiBtnEmpty">+ Add RFI</button>
                                    </div>
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('addRfiBtn').onclick = () => self._showForm(null);

        const emptyBtn = document.getElementById('addRfiBtnEmpty');
        if (emptyBtn) emptyBtn.onclick = () => self._showForm(null);

        document.getElementById('rfiProjectFilter').onchange = (e) => {
            self._filterProject = e.target.value;
            self._renderList();
        };

        document.getElementById('rfiStatusFilter').onchange = (e) => {
            self._filterStatus = e.target.value;
            self._renderList();
        };

        document.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = (e) => { e.preventDefault(); self._showForm(btn.dataset.id); };
        });

        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to delete this RFI?')) {
                    try {
                        AppData.remove('rfis', btn.dataset.id);
                        Utils.showToast('RFI deleted', 'success');
                        self._renderList();
                    } catch (err) {
                        console.error('Delete failed:', err);
                        Utils.showToast('Failed to delete RFI', 'error');
                    }
                }
            };
        });
    },

    _showForm(itemId) {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const allItems = AppData.getAll ? AppData.getAll('rfis') : [];
        const item = itemId ? allItems.find(i => i.id === itemId) : null;
        const isNew = !item;

        const today = new Date().toISOString().slice(0, 10);

        const v = (field, fallback) => item ? (item[field] !== undefined ? item[field] : fallback) : fallback;

        const inputStyle = 'style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;box-sizing:border-box"';
        const labelStyle = 'style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem"';
        const fieldDiv = 'style="margin-bottom:16px"';

        container.innerHTML = `
            <div style="max-width:700px;margin:0 auto">
                <h2 style="margin-bottom:20px">${isNew ? 'New RFI' : 'Edit RFI'}</h2>
                <form id="rfiForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:24px">

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Project *</label>
                            <select id="rfiProjectId" ${inputStyle} required>
                                <option value="">— Select Project —</option>
                                ${projects.map(p => `<option value="${p.id}" ${v('projectId','') === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label ${labelStyle}>RFI Number</label>
                            <input type="text" id="rfiNumber" value="${Utils.escapeHtml(v('rfiNumber',''))}" placeholder="e.g. RFI-001" ${inputStyle} />
                        </div>
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Subject *</label>
                        <input type="text" id="rfiSubject" value="${Utils.escapeHtml(v('subject',''))}" placeholder="Short description of the question" ${inputStyle} required />
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Question</label>
                        <textarea id="rfiQuestion" rows="3" placeholder="Detailed question or clarification needed..." ${inputStyle}>${Utils.escapeHtml(v('question',''))}</textarea>
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Suggested Solution</label>
                        <textarea id="rfiSuggestedSolution" rows="2" placeholder="Optional suggested solution..." ${inputStyle}>${Utils.escapeHtml(v('suggestedSolution',''))}</textarea>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Submitted By</label>
                            <input type="text" id="rfiSubmittedBy" value="${Utils.escapeHtml(v('submittedBy',''))}" placeholder="Name of submitter" ${inputStyle} />
                        </div>
                        <div>
                            <label ${labelStyle}>Assigned To</label>
                            <input type="text" id="rfiAssignedTo" value="${Utils.escapeHtml(v('assignedTo',''))}" placeholder="Architect, engineer, etc." ${inputStyle} />
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Status</label>
                            <select id="rfiStatus" ${inputStyle}>
                                ${['Draft','Open','Answered','Closed','Void'].map(s => `<option value="${s}" ${v('status','Draft') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label ${labelStyle}>Priority</label>
                            <select id="rfiPriority" ${inputStyle}>
                                ${['Low','Medium','High','Urgent'].map(s => `<option value="${s}" ${v('priority','Medium') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label ${labelStyle}>Date Submitted</label>
                            <input type="date" id="rfiDateSubmitted" value="${v('dateSubmitted', today)}" ${inputStyle} />
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Due Date</label>
                            <input type="date" id="rfiDueDate" value="${v('dueDate','')}" ${inputStyle} />
                        </div>
                        <div>
                            <label ${labelStyle}>Response Date</label>
                            <input type="date" id="rfiResponseDate" value="${v('responseDate','')}" ${inputStyle} />
                        </div>
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Response</label>
                        <textarea id="rfiResponse" rows="3" placeholder="Official response / answer..." ${inputStyle}>${Utils.escapeHtml(v('response',''))}</textarea>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label ${labelStyle}>Response By</label>
                            <input type="text" id="rfiResponseBy" value="${Utils.escapeHtml(v('responseBy',''))}" placeholder="Who provided the response" ${inputStyle} />
                        </div>
                    </div>

                    <div ${fieldDiv}>
                        <label ${labelStyle}>Notes</label>
                        <textarea id="rfiNotes" rows="2" placeholder="Internal notes..." ${inputStyle}>${Utils.escapeHtml(v('notes',''))}</textarea>
                    </div>

                    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
                        <button type="button" id="rfiCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">Save RFI</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('rfiCancelBtn').onclick = () => self._renderList();

        document.getElementById('rfiForm').onsubmit = (e) => {
            e.preventDefault();
            const submitBtn = document.querySelector('#rfiForm [type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }
            try {
                const record = {
                    id: item ? item.id : ('rfi_' + Date.now()),
                    projectId: document.getElementById('rfiProjectId').value,
                    rfiNumber: document.getElementById('rfiNumber').value.trim(),
                    subject: document.getElementById('rfiSubject').value.trim(),
                    question: document.getElementById('rfiQuestion').value.trim(),
                    suggestedSolution: document.getElementById('rfiSuggestedSolution').value.trim(),
                    submittedBy: document.getElementById('rfiSubmittedBy').value.trim(),
                    assignedTo: document.getElementById('rfiAssignedTo').value.trim(),
                    status: document.getElementById('rfiStatus').value,
                    priority: document.getElementById('rfiPriority').value,
                    dateSubmitted: document.getElementById('rfiDateSubmitted').value,
                    dueDate: document.getElementById('rfiDueDate').value,
                    response: document.getElementById('rfiResponse').value.trim(),
                    responseBy: document.getElementById('rfiResponseBy').value.trim(),
                    responseDate: document.getElementById('rfiResponseDate').value,
                    notes: document.getElementById('rfiNotes').value.trim(),
                    created_at: item ? item.created_at : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                AppData.save('rfis', record);
                Utils.showToast(isNew ? 'RFI created' : 'RFI updated', 'success');
                self._renderList();
            } catch (err) {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save RFI'; }
                console.error('Save failed:', err);
                Utils.showToast('Failed to save RFI: ' + err.message, 'error');
            }
        };
    }
};
