// Admin Projects Module
window.AdminProjects = {
    _statusFilter: 'All',
    _viewingProjectId: null,
    _activeTab: 'tasks',
    _wizardMode: false,

    render(container, params) {
        const self = this;
        self._container = container;
        if (params && params.projectId) {
            self._viewingProjectId = params.projectId;
        }
        if (self._viewingProjectId) {
            self._renderDetail();
        } else {
            self._renderList();
        }
    },

    renderDetail(container, projectId, params) {
        this._container = container;
        this._viewingProjectId = projectId;
        if (params && params.tab) this._activeTab = params.tab;
        this._renderDetail();
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const filter = self._statusFilter;
        const filtered = filter === 'All' ? projects : projects.filter(function(p) { return p.status === filter; });
        const statuses = ['All', 'Active', 'Completed', 'On Hold'];

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                <h2>Projects</h2>
                <div style="display:flex;gap:8px">
                    <button class="btn-secondary btn-sm" id="projectsExportCsvBtn">Export CSV</button>
                    <button class="btn-secondary btn-sm" id="projectsPrintBtn">Print / PDF</button>
                    <button class="btn-secondary btn-sm" id="projectWizardBtn">Walk me through it</button>
                    <button class="btn-primary" id="addProjectBtn">+ New Project</button>
                </div>
            </div>

            <div class="tabs" style="margin-bottom:16px">
                ${statuses.map(function(s) {
                    const count = s === 'All' ? projects.length : projects.filter(function(p) { return p.status === s; }).length;
                    return '<button class="tab-btn' + (filter === s ? ' active' : '') + '" data-status="' + s + '">' + s + ' (' + count + ')</button>';
                }).join('')}
            </div>

            <div class="card">
                ${filtered.length === 0
                    ? '<div class="empty"><h3>No Projects</h3><p>Create your first project to start tracking expenses and invoices.</p></div>'
                    : `<table>
                        <thead><tr><th>Project Name</th><th>Client</th><th>Start Date</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>${filtered.map(function(p) {
                            const statusClass = p.status === 'Active' ? 'active-s' : (p.status === 'Completed' ? 'completed-s' : '');
                            return '<tr style="cursor:pointer" class="project-row" data-id="' + p.id + '">' +
                                '<td><strong>' + Utils.escapeHtml(p.name) + '</strong></td>' +
                                '<td>' + Utils.escapeHtml(p.clientName || p.client || '') + '</td>' +
                                '<td>' + Utils.formatDate(p.startDate) + '</td>' +
                                '<td><span class="pstatus ' + statusClass + '">' + Utils.escapeHtml(p.status) + '</span></td>' +
                                '<td style="white-space:nowrap">' +
                                    '<button class="btn-ghost btn-sm edit-project" data-id="' + p.id + '">Edit</button>' +
                                    '<button class="btn-ghost btn-sm delete-project" data-id="' + p.id + '" style="color:var(--accent)">Delete</button>' +
                                '</td>' +
                            '</tr>';
                        }).join('')}</tbody>
                    </table>`
                }
            </div>
        `;

        function csvEscape(val) {
            if (val === null || val === undefined) return '';
            var s = String(val);
            if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
                return '"' + s.replace(/"/g, '""') + '"';
            return s;
        }
        function csvRow(fields) { return fields.map(csvEscape).join(','); }
        function downloadCsv(content, name) {
            var today = new Date().toISOString().slice(0,10);
            var blob = new Blob([content], {type:'text/csv'});
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = 'ledgerman-' + name + '-' + today + '.csv';
            document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
        }

        container.querySelector('#projectsExportCsvBtn').addEventListener('click', function() {
            var rows = [csvRow(['Name','Client','Status','Start Date','Budget'])];
            filtered.forEach(function(p) {
                rows.push(csvRow([
                    p.name || '',
                    p.clientName || p.client || '',
                    p.status || '',
                    p.startDate || '',
                    p.budget || ''
                ]));
            });
            downloadCsv(rows.join('\n'), 'projects');
        });

        container.querySelector('#projectsPrintBtn').addEventListener('click', function() {
            if (!document.getElementById('projectsPrintStyle')) {
                var s = document.createElement('style');
                s.id = 'projectsPrintStyle';
                s.textContent = '@media print { .admin-nav,.worker-nav,#adminSidebar,.btn-primary,.btn-secondary,.tab-btn,#pageHelpBtn { display:none!important; } body { font-size:11pt; } .card { box-shadow:none; border:1px solid #ddd; } }';
                document.head.appendChild(s);
            }
            window.print();
        });

        // Status filter tabs
        container.querySelectorAll('.tab-btn[data-status]').forEach(function(tab) {
            tab.addEventListener('click', function() {
                self._statusFilter = tab.dataset.status;
                self._renderList();
            });
        });

        container.querySelector('#addProjectBtn').addEventListener('click', function() {
            self._showProjectForm(null);
        });

        container.querySelector('#projectWizardBtn').addEventListener('click', function() {
            self._startWizard();
        });

        // Click row to view detail
        container.querySelectorAll('.project-row').forEach(function(row) {
            row.addEventListener('click', function(e) {
                if (e.target.closest('.edit-project') || e.target.closest('.delete-project')) return;
                self._viewingProjectId = row.dataset.id;
                self._activeTab = 'work-items';
                self._renderDetail();
            });
        });

        container.querySelectorAll('.edit-project').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                self._showProjectForm(btn.dataset.id);
            });
        });

        container.querySelectorAll('.delete-project').forEach(function(btn) {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const project = AppData.getProject(btn.dataset.id);
                if (!project) return;
                const confirmed = await Utils.confirm('Delete project "' + project.name + '" and all associated data?');
                if (!confirmed) return;
                AppData.deleteProject(btn.dataset.id);
                // Also delete related subtasks and expenses
                const subtasks = AppData.getSubtasks(btn.dataset.id);
                subtasks.forEach(function(s) { AppData.deleteSubtask(s.id); });
                const expenses = AppData.getExpenses(btn.dataset.id);
                expenses.forEach(function(ex) { AppData.deleteExpense(ex.id); });
                const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'Project Deleted', project.name);
                Utils.showToast('Project deleted');
                self._renderList();
            });
        });
    },

    _showProjectForm(editId) {
        const self = this;
        const project = editId ? AppData.getProject(editId) : null;
        const isEdit = !!project;
        const clients = AppData.getClients();
        const workers = AppData.getWorkers().filter(function(w) { return w.status === 'Active'; });
        const assignedWorkers = (project && project.assignedWorkers) || [];
        const esc = Utils.escapeHtml;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:700px">
                <div class="modal-header">
                    <h3 style="margin:0">${isEdit ? 'Edit Project' : 'New Project'}</h3>
                </div>
                <div class="modal-body">
                    <form id="projectModalForm" novalidate>
                        <div class="form-group" style="margin-bottom:12px">
                            <label>Project Name *</label>
                            <input name="name" value="${esc(project ? project.name : '')}" required>
                        </div>

                        <div class="form-group" style="margin-bottom:12px">
                            <label>Client (select from address book or type manually)</label>
                            <select id="projectClientSelect" style="margin-bottom:8px">
                                <option value="">-- Select from address book --</option>
                                ${clients.map(function(c) {
                                    const sel = project && project.clientId === c.id ? ' selected' : '';
                                    return '<option value="' + c.id + '"' + sel + '>' + esc(c.name) + '</option>';
                                }).join('')}
                            </select>
                            <input name="clientName" value="${esc(project ? (project.clientName || project.client || '') : '')}" placeholder="Or type client name manually">
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Client Address</label>
                                <input name="clientAddress" value="${esc(project ? project.clientAddress : '')}">
                            </div>
                            <div class="form-group">
                                <label>Client City</label>
                                <input name="clientCity" value="${esc(project ? project.clientCity : '')}">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Client Province</label>
                                <input name="clientProvince" value="${esc(project ? project.clientProvince : '')}">
                            </div>
                            <div class="form-group">
                                <label>Client Postal Code</label>
                                <input name="clientPostalCode" value="${esc(project ? project.clientPostalCode : '')}">
                            </div>
                        </div>

                        <div class="form-group" style="margin-bottom:12px">
                            <label>Job Site Address</label>
                            <input name="jobSiteAddress" value="${esc(project ? project.jobSiteAddress : '')}">
                        </div>
                        <div class="form-group" style="margin-bottom:12px">
                            <label>Contract / PO Number</label>
                            <input name="contractNumber" value="${esc(project ? project.contractNumber : '')}">
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Start Date</label>
                                <input type="date" name="startDate" value="${project ? project.startDate || '' : Utils.today()}">
                            </div>
                            <div class="form-group">
                                <label>Estimated End Date</label>
                                <input type="date" name="endDate" value="${project ? project.endDate || '' : ''}">
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select name="status">
                                    <option value="Active" ${(!project || project.status === 'Active') ? 'selected' : ''}>Active</option>
                                    <option value="Completed" ${project && project.status === 'Completed' ? 'selected' : ''}>Completed</option>
                                    <option value="On Hold" ${project && project.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
                                </select>
                            </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Project Budget / Contract Value ($)</label>
                                <input type="number" name="budget" step="0.01" min="0" value="${project ? project.budget || '' : ''}">
                            </div>
                        </div>
                        </div>

                        <div class="form-group" style="margin-bottom:12px">
                            <label>Description / Scope</label>
                            <textarea name="description" rows="3">${esc(project ? project.description : '')}</textarea>
                        </div>

                        ${workers.length > 0 ? `
                        <div class="form-group" style="margin-bottom:12px">
                            <label>Assign Workers</label>
                            <div style="margin-bottom:8px">
                                <label style="display:inline;cursor:pointer">
                                    <input type="checkbox" id="assignAllWorkers"> Assign all active workers
                                </label>
                            </div>
                            <div style="display:flex;flex-wrap:wrap;gap:8px">
                                ${workers.map(function(w) {
                                    const checked = assignedWorkers.includes(w.id) ? ' checked' : '';
                                    return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:.9rem">' +
                                        '<input type="checkbox" class="worker-checkbox" value="' + w.id + '"' + checked + '> ' +
                                        esc(w.name) +
                                    '</label>';
                                }).join('')}
                            </div>
                        </div>` : ''}
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="submit" form="projectModalForm" class="btn-primary">${isEdit ? 'Update' : 'Create'} Project</button>
                    <button type="button" class="btn-secondary modal-close">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Client dropdown auto-fill
        overlay.querySelector('#projectClientSelect').addEventListener('change', function() {
            const clientId = this.value;
            if (!clientId) return;
            const client = AppData.getClient(clientId);
            if (!client) return;
            const form = overlay.querySelector('#projectModalForm');
            form.querySelector('[name="clientName"]').value = client.name || '';
            form.querySelector('[name="clientAddress"]').value = client.address || '';
            form.querySelector('[name="clientCity"]').value = client.city || '';
            form.querySelector('[name="clientProvince"]').value = client.province || '';
            form.querySelector('[name="clientPostalCode"]').value = client.postalCode || '';
        });

        // Assign all workers
        const assignAll = overlay.querySelector('#assignAllWorkers');
        if (assignAll) {
            assignAll.addEventListener('change', function() {
                overlay.querySelectorAll('.worker-checkbox').forEach(function(cb) {
                    cb.checked = assignAll.checked;
                });
            });
        }

        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('.modal-close').addEventListener('click', function() { overlay.remove(); });

        overlay.querySelector('#projectModalForm').addEventListener('submit', function(e) {
            e.preventDefault();
            if (!Utils.validateForm(this)) return;
            const fd = Utils.getFormData(this);
            if (!fd.name || !fd.name.trim()) {
                Utils.showToast('Project name is required', 'error');
                return;
            }
            const workerIds = [];
            overlay.querySelectorAll('.worker-checkbox:checked').forEach(function(cb) {
                workerIds.push(cb.value);
            });
            const clientSelect = overlay.querySelector('#projectClientSelect');

            const projectData = {
                id: isEdit ? project.id : AppData.generateId(),
                name: fd.name.trim(),
                clientId: clientSelect.value || (project ? project.clientId : ''),
                clientName: (fd.clientName || '').trim(),
                client: (fd.clientName || '').trim(), // backward compat
                clientAddress: (fd.clientAddress || '').trim(),
                clientCity: (fd.clientCity || '').trim(),
                clientProvince: (fd.clientProvince || '').trim(),
                clientPostalCode: (fd.clientPostalCode || '').trim(),
                jobSiteAddress: (fd.jobSiteAddress || '').trim(),
                contractNumber: (fd.contractNumber || '').trim(),
                startDate: fd.startDate || '',
                endDate: fd.endDate || '',
                status: fd.status || 'Active',
                description: (fd.description || '').trim(),
                assignedWorkers: workerIds,
                budget: parseFloat(fd.budget) || 0,
            };
            AppData.saveProject(projectData);
            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, isEdit ? 'Project Updated' : 'Project Created', projectData.name);
            Utils.showToast(isEdit ? 'Project updated' : 'Project created');
            overlay.remove();
            self._renderList();
        });
    },

    _renderDetail() {
        const self = this;
        const container = self._container;
        const project = AppData.getProject(self._viewingProjectId);
        if (!project) {
            self._viewingProjectId = null;
            self._renderList();
            return;
        }
        const esc = Utils.escapeHtml;
        const tabs = ['tasks', 'budget', 'work-items', 'expenses', 'photos', 'invoices'];
        const tabLabels = { 'tasks': 'Tasks', 'budget': 'Budget', 'work-items': 'Work Items', 'expenses': 'Expenses', 'photos': 'Photos', 'invoices': 'Invoices' };

        container.innerHTML = `
            <div style="margin-bottom:16px">
                <button class="btn-ghost btn-sm" id="backToProjects" style="margin-bottom:8px">&larr; Back to Projects</button>
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
                    <div>
                        <h2>${esc(project.name)}</h2>
                        <p style="color:var(--text2);font-size:.9rem;margin-top:4px">
                            ${esc(project.clientName || project.client || 'No client')}
                            ${project.jobSiteAddress ? ' &mdash; ' + esc(project.jobSiteAddress) : ''}
                        </p>
                        <span class="pstatus ${project.status === 'Active' ? 'active-s' : 'completed-s'}">${esc(project.status)}</span>
                        ${project.contractNumber ? '<span style="margin-left:8px;font-size:.8rem;color:var(--text2)">PO: ' + esc(project.contractNumber) + '</span>' : ''}
                    </div>
                    <button class="btn-secondary btn-sm edit-detail-project">Edit Project</button>
                </div>
            </div>

            <div class="tabs">
                ${tabs.map(function(t) {
                    return '<button class="tab-btn' + (self._activeTab === t ? ' active' : '') + '" data-tab="' + t + '">' +
                        (tabLabels[t] || (t.charAt(0).toUpperCase() + t.slice(1))) + '</button>';
                }).join('')}
            </div>

            <div id="projectTabContent"></div>
        `;

        container.querySelector('#backToProjects').addEventListener('click', function() {
            self._viewingProjectId = null;
            self._renderList();
        });

        container.querySelector('.edit-detail-project').addEventListener('click', function() {
            self._showProjectForm(self._viewingProjectId);
        });

        container.querySelectorAll('.tab-btn[data-tab]').forEach(function(tab) {
            tab.addEventListener('click', function() {
                self._activeTab = tab.dataset.tab;
                self._renderDetail();
            });
        });

        const tabContent = container.querySelector('#projectTabContent');
        switch (self._activeTab) {
            case 'tasks': self._renderTasksTab(tabContent, project); break;
            case 'budget': self._renderBudgetTab(tabContent, project); break;
            case 'work-items': self._renderSubtasksTab(tabContent, project); break;
            case 'expenses': self._renderExpensesTab(tabContent, project); break;
            case 'photos': self._renderPhotosTab(tabContent, project); break;
            case 'invoices': self._renderInvoicesTab(tabContent, project); break;
        }
    },

    _renderTasksTab(tabContent, project) {
        const self = this;
        const tasks = AppData.getTasks(project.id);
        const workers = AppData.getWorkers();
        const esc = Utils.escapeHtml;

        tabContent.innerHTML = `
            <div style="margin-bottom:12px">
                <button class="btn-primary btn-sm" id="addTaskBtn">+ Add Task</button>
            </div>
            <div class="card">
                ${tasks.length === 0
                    ? '<div class="empty"><h3>No Tasks</h3><p>Add tasks to assign work to team members and track progress.</p></div>'
                    : `<table style="width:100%;font-size:.9rem">
                        <thead><tr>
                            <th>Task</th><th>Assigned To</th><th>Due Date</th><th>Status</th><th>Actions</th>
                        </tr></thead>
                        <tbody>${tasks.map(function(t) {
                            const assignedWorker = workers.find(function(w) { return w.id === t.assigned_to; });
                            const statusClass = t.status === 'Done' ? 'status-done' : (t.status === 'Active' ? 'status-active' : 'status-todo');
                            return '<tr>' +
                                '<td><strong>' + esc(t.name) + '</strong>' +
                                    (t.description ? '<br><span style="font-size:.8rem;color:var(--text2)">' + esc(t.description) + '</span>' : '') +
                                '</td>' +
                                '<td>' + (assignedWorker ? esc(assignedWorker.name) : '<span style="color:var(--text2)">Unassigned</span>') + '</td>' +
                                '<td>' + (t.due_date ? esc(t.due_date) : '-') + '</td>' +
                                '<td><span class="status-badge ' + statusClass + '">' + esc(t.status || 'Todo') + '</span></td>' +
                                '<td style="white-space:nowrap">' +
                                    '<button class="btn-ghost btn-sm edit-task" data-id="' + t.id + '">Edit</button>' +
                                    '<button class="btn-ghost btn-sm delete-task" data-id="' + t.id + '" style="color:var(--accent)">Del</button>' +
                                '</td>' +
                            '</tr>';
                        }).join('')}</tbody>
                    </table>`
                }
            </div>
        `;

        tabContent.querySelector('#addTaskBtn').addEventListener('click', function() {
            self._showTaskModal(project.id, null);
        });
        tabContent.querySelectorAll('.edit-task').forEach(function(btn) {
            btn.addEventListener('click', function() { self._showTaskModal(project.id, btn.dataset.id); });
        });
        tabContent.querySelectorAll('.delete-task').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                const confirmed = await Utils.confirm('Delete this task?');
                if (!confirmed) return;
                AppData.deleteTask(btn.dataset.id);
                const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'Task Deleted', 'Project: ' + project.name);
                Utils.showToast('Task deleted');
                self._renderDetail();
            });
        });
    },

    _showTaskModal(projectId, editId) {
        const self = this;
        const task = editId ? AppData.getTask(editId) : null;
        const isEdit = !!task;
        const esc = Utils.escapeHtml;
        const workers = AppData.getWorkers();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:500px">
                <h3>${isEdit ? 'Edit Task' : 'Add Task'}</h3>
                <form id="taskForm" novalidate>
                    <div class="form-group" style="margin-bottom:12px">
                        <label>Task Name *</label>
                        <input name="name" value="${esc(task ? task.name : '')}" required>
                    </div>
                    <div class="form-group" style="margin-bottom:12px">
                        <label>Description</label>
                        <textarea name="description" rows="2">${esc(task ? (task.description || '') : '')}</textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Assigned To</label>
                            <select name="assigned_to">
                                <option value="">-- Unassigned --</option>
                                ${workers.map(function(w) {
                                    return '<option value="' + w.id + '" ' + (task && task.assigned_to === w.id ? 'selected' : '') + '>' + esc(w.name) + '</option>';
                                }).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select name="status">
                                <option value="Todo" ${(!task || task.status === 'Todo') ? 'selected' : ''}>Todo</option>
                                <option value="Active" ${task && task.status === 'Active' ? 'selected' : ''}>Active</option>
                                <option value="Done" ${task && task.status === 'Done' ? 'selected' : ''}>Done</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Start Date</label>
                            <input type="date" name="start_date" value="${task && task.startDate ? esc(task.startDate) : ''}">
                        </div>
                        <div class="form-group">
                            <label>Due Date</label>
                            <input type="date" name="due_date" value="${task && task.due_date ? esc(task.due_date) : ''}">
                        </div>
                    </div>
                    ${(() => {
                        const workItems = AppData.getSubtasks ? AppData.getSubtasks(projectId) : [];
                        if (workItems.length === 0) return '';
                        return '<div class="form-group" style="margin-bottom:12px">' +
                            '<label>Linked Work Item <span style="font-size:.75rem;color:var(--text2)">(optional — links this task to a budget line)</span></label>' +
                            '<select name="workItemId">' +
                            '<option value="">-- Not linked --</option>' +
                            workItems.map(function(wi) {
                                return '<option value="' + wi.id + '" ' + (task && task.workItemId === wi.id ? 'selected' : '') + '>' + esc(wi.name) + '</option>';
                            }).join('') +
                            '</select></div>';
                    })()}
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Add'}</button>
                        <button type="button" class="btn-secondary modal-close">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('.modal-close').addEventListener('click', function() { overlay.remove(); });

        overlay.querySelector('#taskForm').addEventListener('submit', function(e) {
            e.preventDefault();
            if (!Utils.validateForm(this)) return;
            const fd = Utils.getFormData(this);
            if (!fd.name.trim()) { Utils.showToast('Task name is required', 'error'); return; }
            const data = {
                id: isEdit ? task.id : AppData.generateId(),
                projectId: projectId,
                name: fd.name.trim(),
                description: (fd.description || '').trim(),
                assigned_to: fd.assigned_to || null,
                startDate: fd.start_date || null,
                due_date: fd.due_date || null,
                status: fd.status || 'Todo',
                workItemId: fd.workItemId || null
            };
            AppData.saveTask(data);
            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, isEdit ? 'Task Updated' : 'Task Added', data.name);
            Utils.showToast(isEdit ? 'Task updated' : 'Task added');
            overlay.remove();
            self._renderDetail();
        });
    },

    _renderBudgetTab(tabContent, project) {
        const workItems = AppData.getSubtasks(project.id);
        const expenses = AppData.getExpenses(project.id);
        const allSubmissions = AppData.getSubmissions().filter(function(s) {
            return s.projectId === project.id && (s.status || '').toLowerCase() === 'approved';
        });
        const workers = AppData.getWorkers();

        // Project-level summary
        const totalBudgeted = workItems.reduce(function(sum, wi) { return sum + (parseFloat(wi.budgetedCost) || 0); }, 0);
        const totalExpenses = expenses.reduce(function(sum, e) { return sum + (parseFloat(e.amount) || 0); }, 0);

        // Per-work-item labour from approved submissions (hours × worker costRate)
        function labourCostForWorkItem(wiId) {
            return allSubmissions
                .filter(function(s) { return s.subtaskId === wiId; })
                .reduce(function(sum, s) {
                    const worker = workers.find(function(w) { return w.id === s.workerId; });
                    const rate = (worker && worker.costRate) || (worker && worker.payRate) || (worker && worker.defaultRate) || parseFloat(s.rate) || 0;
                    return sum + ((parseFloat(s.hours) || 0) * rate);
                }, 0);
        }

        function expenseCostForWorkItem(wiId) {
            return expenses
                .filter(function(e) { return e.subtaskId === wiId; })
                .reduce(function(sum, e) { return sum + (parseFloat(e.amount) || 0); }, 0);
        }

        function actualQtyForWorkItem(wiId) {
            return allSubmissions
                .filter(function(s) { return s.subtaskId === wiId; })
                .reduce(function(sum, s) { return sum + (parseFloat(s.unitsCompleted) || 0); }, 0);
        }

        const totalLabour = workItems.reduce(function(sum, wi) { return sum + labourCostForWorkItem(wi.id); }, 0);
        const totalActual = totalExpenses + totalLabour;
        const projectBudget = parseFloat(project.budget) || 0;
        const projectVariance = projectBudget - totalActual;

        let html = '';

        // Summary cards
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0">';
        html += '<div style="padding:14px;background:#fff;border-radius:8px;border:1px solid #e0e0e0"><div style="font-size:.78rem;text-transform:uppercase;color:#999;margin-bottom:4px">Contract Value</div><div style="font-size:1.4em;font-weight:700;color:#333">' + Utils.formatCurrency(projectBudget || totalBudgeted) + '</div></div>';
        html += '<div style="padding:14px;background:#fff;border-radius:8px;border:1px solid #e0e0e0"><div style="font-size:.78rem;text-transform:uppercase;color:#999;margin-bottom:4px">Budgeted (WIs)</div><div style="font-size:1.4em;font-weight:700;color:#333">' + Utils.formatCurrency(totalBudgeted) + '</div></div>';
        html += '<div style="padding:14px;background:#fff;border-radius:8px;border:1px solid #e0e0e0"><div style="font-size:.78rem;text-transform:uppercase;color:#999;margin-bottom:4px">Labour (actual)</div><div style="font-size:1.4em;font-weight:700;color:#e67e00">' + Utils.formatCurrency(totalLabour) + '</div></div>';
        html += '<div style="padding:14px;background:#fff;border-radius:8px;border:1px solid #e0e0e0"><div style="font-size:.78rem;text-transform:uppercase;color:#999;margin-bottom:4px">Materials (actual)</div><div style="font-size:1.4em;font-weight:700;color:#e74c3c">' + Utils.formatCurrency(totalExpenses) + '</div></div>';
        html += '<div style="padding:14px;background:#fff;border-radius:8px;border:1px solid #e0e0e0"><div style="font-size:.78rem;text-transform:uppercase;color:#999;margin-bottom:4px">Total Actual</div><div style="font-size:1.4em;font-weight:700;color:#e74c3c">' + Utils.formatCurrency(totalActual) + '</div></div>';
        html += '<div style="padding:14px;background:#fff;border-radius:8px;border:1px solid #e0e0e0"><div style="font-size:.78rem;text-transform:uppercase;color:#999;margin-bottom:4px">Variance</div><div style="font-size:1.4em;font-weight:700;color:' + (projectVariance >= 0 ? '#1a8a3a' : '#e74c3c') + '">' + (projectVariance >= 0 ? '+' : '') + Utils.formatCurrency(projectVariance) + '</div></div>';
        html += '</div>';

        if (workItems.length === 0) {
            html += '<div class="card"><div class="empty"><h3>No Work Items</h3><p>Add Work Items on the Work Items tab to track budget vs. actual per scope item.</p></div></div>';
        } else {
            html += '<div class="card" style="overflow-x:auto">';
            html += '<table style="width:100%;font-size:.88rem"><thead><tr style="background:#f5f5f5">';
            html += '<th style="padding:10px;text-align:left">Work Item</th>';
            html += '<th style="padding:10px;text-align:center">Unit</th>';
            html += '<th style="padding:10px;text-align:right">Budgeted Qty</th>';
            html += '<th style="padding:10px;text-align:right">Budgeted Cost</th>';
            html += '<th style="padding:10px;text-align:right">Actual Qty</th>';
            html += '<th style="padding:10px;text-align:right">Labour Cost</th>';
            html += '<th style="padding:10px;text-align:right">Material Cost</th>';
            html += '<th style="padding:10px;text-align:right">Total Actual</th>';
            html += '<th style="padding:10px;text-align:right">Variance</th>';
            html += '<th style="padding:10px;text-align:center">CO</th>';
            html += '</tr></thead><tbody>';

            workItems.forEach(function(wi) {
                const labour = labourCostForWorkItem(wi.id);
                const material = expenseCostForWorkItem(wi.id);
                const actualQty = actualQtyForWorkItem(wi.id);
                const actualTotal = labour + material;
                const variance = (parseFloat(wi.budgetedCost) || 0) - actualTotal;
                const varianceColor = variance >= 0 ? '#1a8a3a' : '#e74c3c';
                const pct = wi.budgetedCost > 0 ? Math.min(100, (actualTotal / wi.budgetedCost * 100)).toFixed(0) : 0;
                const barColor = pct >= 100 ? '#e74c3c' : (pct >= 80 ? '#e67e00' : '#1a8a3a');

                html += '<tr style="border-bottom:1px solid #eee">';
                html += '<td style="padding:10px"><strong>' + Utils.escapeHtml(wi.name) + '</strong>' +
                    (wi.startDate ? '<div style="font-size:.75rem;color:#999">Start: ' + Utils.formatDate(wi.startDate) + (wi.endDate ? ' → ' + Utils.formatDate(wi.endDate) : '') + '</div>' : '') +
                '</td>';
                html += '<td style="padding:10px;text-align:center">' + Utils.escapeHtml(wi.unitOfMeasure || '—') + '</td>';
                html += '<td style="padding:10px;text-align:right">' + (parseFloat(wi.budgetedQty) || 0) + '</td>';
                html += '<td style="padding:10px;text-align:right">' + Utils.formatCurrency(wi.budgetedCost) + '</td>';
                html += '<td style="padding:10px;text-align:right">' + actualQty.toFixed(1) + '</td>';
                html += '<td style="padding:10px;text-align:right;color:#e67e00">' + Utils.formatCurrency(labour) + '</td>';
                html += '<td style="padding:10px;text-align:right;color:#e74c3c">' + Utils.formatCurrency(material) + '</td>';
                html += '<td style="padding:10px;text-align:right">' +
                    '<div style="font-weight:600">' + Utils.formatCurrency(actualTotal) + '</div>' +
                    '<div style="height:3px;background:#eee;border-radius:2px;margin-top:4px"><div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:2px"></div></div>' +
                    '<div style="font-size:.7rem;color:#999">' + pct + '% of budget</div>' +
                '</td>';
                html += '<td style="padding:10px;text-align:right;font-weight:600;color:' + varianceColor + '">' + (variance >= 0 ? '+' : '') + Utils.formatCurrency(variance) + '</td>';
                html += '<td style="padding:10px;text-align:center">' + (wi.changeOrder ? '<span style="color:#e67e00;font-weight:700;font-size:.8rem">CO</span>' : '') + '</td>';
                html += '</tr>';
            });

            // Totals row
            const totBudgetedCost = workItems.reduce(function(s, wi) { return s + (parseFloat(wi.budgetedCost) || 0); }, 0);
            const totActual = workItems.reduce(function(s, wi) { return s + labourCostForWorkItem(wi.id) + expenseCostForWorkItem(wi.id); }, 0);
            const totVariance = totBudgetedCost - totActual;
            html += '<tr style="background:#f5f5f5;font-weight:700;border-top:2px solid #ddd">';
            html += '<td style="padding:10px" colspan="3">TOTALS</td>';
            html += '<td style="padding:10px;text-align:right">' + Utils.formatCurrency(totBudgetedCost) + '</td>';
            html += '<td style="padding:10px"></td>';
            html += '<td style="padding:10px;text-align:right;color:#e67e00">' + Utils.formatCurrency(workItems.reduce(function(s, wi) { return s + labourCostForWorkItem(wi.id); }, 0)) + '</td>';
            html += '<td style="padding:10px;text-align:right;color:#e74c3c">' + Utils.formatCurrency(workItems.reduce(function(s, wi) { return s + expenseCostForWorkItem(wi.id); }, 0)) + '</td>';
            html += '<td style="padding:10px;text-align:right">' + Utils.formatCurrency(totActual) + '</td>';
            html += '<td style="padding:10px;text-align:right;color:' + (totVariance >= 0 ? '#1a8a3a' : '#e74c3c') + '">' + (totVariance >= 0 ? '+' : '') + Utils.formatCurrency(totVariance) + '</td>';
            html += '<td></td>';
            html += '</tr>';
            html += '</tbody></table></div>';

            html += '<div style="margin-top:12px;padding:10px 14px;background:#e8f4f8;border-left:4px solid #3498db;border-radius:4px;font-size:.85rem;color:#333">';
            html += '<strong>Note:</strong> Labour cost uses each worker\'s Cost Rate. Set Cost Rate in the Workers module. Materials are from expenses linked to each Work Item.';
            html += '</div>';
        }

        tabContent.innerHTML = html;
    },

    _renderSubtasksTab(tabContent, project) {
        const self = this;
        const subtasks = AppData.getSubtasks(project.id);
        const expenses = AppData.getExpenses(project.id);
        const submissions = AppData.getSubmissions().filter(function(s) { return s.projectId === project.id && s.status === 'Approved'; });

        tabContent.innerHTML = `
            <div style="margin-bottom:12px">
                <button class="btn-primary btn-sm" id="addSubtaskBtn">+ Add Work Item</button>
            </div>
            <div class="card">
                ${subtasks.length === 0
                    ? '<div class="empty"><h3>No Work Items</h3><p>Add Work Items to break down the project scope and track budget vs. actual.</p></div>'
                    : `<table>
                        <thead><tr>
                            <th>Subtask</th><th>Unit</th><th class="amount">Budgeted Qty</th><th class="amount">Budgeted Cost</th>
                            <th class="amount">Actual Qty</th><th class="amount">Actual Cost</th><th class="amount">Cost/Unit</th>
                            <th>CO</th><th>Actions</th>
                        </tr></thead>
                        <tbody>${subtasks.map(function(st) {
                            // Sum actual qty from approved submissions
                            const actualQty = submissions
                                .filter(function(s) { return s.subtaskId === st.id; })
                                .reduce(function(sum, s) { return sum + (parseFloat(s.unitsCompleted) || 0); }, 0);
                            // Sum actual cost from expenses
                            const actualCost = expenses
                                .filter(function(e) { return e.subtaskId === st.id; })
                                .reduce(function(sum, e) { return sum + (parseFloat(e.amount) || 0); }, 0);
                            const costPerUnit = actualQty > 0 ? actualCost / actualQty : 0;
                            return '<tr>' +
                                '<td><strong>' + Utils.escapeHtml(st.name) + '</strong>' +
                                    (st.description ? '<br><span style="font-size:.8rem;color:var(--text2)">' + Utils.escapeHtml(st.description) + '</span>' : '') +
                                '</td>' +
                                '<td>' + Utils.escapeHtml(st.unitOfMeasure || '-') + '</td>' +
                                '<td class="amount">' + (parseFloat(st.budgetedQty) || 0) + '</td>' +
                                '<td class="amount">' + Utils.formatCurrency(st.budgetedCost) + '</td>' +
                                '<td class="amount">' + actualQty.toFixed(1) + '</td>' +
                                '<td class="amount">' + Utils.formatCurrency(actualCost) + '</td>' +
                                '<td class="amount">' + Utils.formatCurrency(costPerUnit) + '</td>' +
                                '<td>' + (st.changeOrder ? '<span style="color:var(--warn);font-weight:700">CO</span>' : '') + '</td>' +
                                '<td style="white-space:nowrap">' +
                                    '<button class="btn-ghost btn-sm edit-subtask" data-id="' + st.id + '">Edit</button>' +
                                    '<button class="btn-ghost btn-sm delete-subtask" data-id="' + st.id + '" style="color:var(--accent)">Del</button>' +
                                '</td>' +
                            '</tr>';
                        }).join('')}</tbody>
                    </table>`
                }
            </div>
        `;

        tabContent.querySelector('#addSubtaskBtn').addEventListener('click', function() {
            self._showSubtaskModal(project.id, null);
        });
        tabContent.querySelectorAll('.edit-subtask').forEach(function(btn) {
            btn.addEventListener('click', function() { self._showSubtaskModal(project.id, btn.dataset.id); });
        });
        tabContent.querySelectorAll('.delete-subtask').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                const confirmed = await Utils.confirm('Delete this subtask?');
                if (!confirmed) return;
                AppData.deleteSubtask(btn.dataset.id);
                const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'Subtask Deleted', 'Project: ' + project.name);
                Utils.showToast('Subtask deleted');
                self._renderDetail();
            });
        });
    },

    _showSubtaskModal(projectId, editId) {
        const self = this;
        const st = editId ? AppData.getSubtask(editId) : null;
        const isEdit = !!st;
        const esc = Utils.escapeHtml;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:500px">
                <h3>${isEdit ? 'Edit Work Item' : 'Add Work Item'}</h3>
                <form id="subtaskForm" novalidate>
                    <div class="form-group" style="margin-bottom:12px">
                        <label>Subtask Name *</label>
                        <input name="name" value="${esc(st ? st.name : '')}" required>
                    </div>
                    <div class="form-group" style="margin-bottom:12px">
                        <label>Description</label>
                        <textarea name="description" rows="2">${esc(st ? st.description : '')}</textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Unit of Measure</label>
                            <input name="unitOfMeasure" value="${esc(st ? st.unitOfMeasure : '')}" placeholder="e.g. sq ft, hours, each">
                        </div>
                        <div class="form-group">
                            <label>Budgeted Qty</label>
                            <input type="number" name="budgetedQty" step="0.01" min="0" value="${st ? st.budgetedQty || '' : ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Budgeted Cost ($)</label>
                            <input type="number" name="budgetedCost" step="0.01" min="0" value="${st ? st.budgetedCost || '' : ''}">
                        </div>
                        <div class="form-group">
                            <label>Change Order?</label>
                            <select name="changeOrder">
                                <option value="no" ${(!st || !st.changeOrder) ? 'selected' : ''}>No</option>
                                <option value="yes" ${st && st.changeOrder ? 'selected' : ''}>Yes</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Planned Start Date</label>
                            <input type="date" name="startDate" value="${esc(st ? st.startDate || '' : '')}">
                        </div>
                        <div class="form-group">
                            <label>Planned End Date</label>
                            <input type="date" name="endDate" value="${esc(st ? st.endDate || '' : '')}">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Add'}</button>
                        <button type="button" class="btn-secondary modal-close">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('.modal-close').addEventListener('click', function() { overlay.remove(); });

        overlay.querySelector('#subtaskForm').addEventListener('submit', function(e) {
            e.preventDefault();
            if (!Utils.validateForm(this)) return;
            const fd = Utils.getFormData(this);
            if (!fd.name.trim()) { Utils.showToast('Name is required', 'error'); return; }
            const data = {
                id: isEdit ? st.id : AppData.generateId(),
                projectId: projectId,
                name: fd.name.trim(),
                description: (fd.description || '').trim(),
                unitOfMeasure: (fd.unitOfMeasure || '').trim(),
                budgetedQty: parseFloat(fd.budgetedQty) || 0,
                budgetedCost: parseFloat(fd.budgetedCost) || 0,
                changeOrder: fd.changeOrder === 'yes',
                startDate: (fd.startDate || '').trim(),
                endDate: (fd.endDate || '').trim()
            };
            AppData.saveSubtask(data);
            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, isEdit ? 'Subtask Updated' : 'Subtask Added', data.name);
            Utils.showToast(isEdit ? 'Subtask updated' : 'Subtask added');
            overlay.remove();
            self._renderDetail();
        });
    },

    _renderExpensesTab(tabContent, project) {
        const expenses = AppData.getExpenses(project.id);
        tabContent.innerHTML = '<div class="card">' +
            (expenses.length === 0
                ? '<div class="empty"><h3>No Expenses</h3><p>Use the Expenses page to add expenses to this project.</p></div>'
                : '<table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th class="amount">Amount</th><th>Status</th></tr></thead><tbody>' +
                    expenses.map(function(e) {
                        return '<tr><td>' + Utils.formatDate(e.date) + '</td>' +
                            '<td><span class="cat-badge cat-' + (e.category || 'material').toLowerCase() + '">' + Utils.escapeHtml(e.category || 'Material') + '</span></td>' +
                            '<td>' + Utils.escapeHtml(e.description) + '</td>' +
                            '<td class="amount">' + Utils.formatCurrency(e.amount) + '</td>' +
                            '<td>' + Utils.escapeHtml(e.invoiceStatus || 'Ready to Invoice') + '</td></tr>';
                    }).join('') +
                    '</tbody></table>'
            ) +
        '</div>';
    },

    _renderPhotosTab(tabContent, project) {
        const self = this;
        const esc = Utils.escapeHtml;
        tabContent.innerHTML = '<div class="card"><p style="color:var(--text2)">Loading photos...</p></div>';

        AppData.getPhotosByProject(project.id).then(function(photos) {
            if (photos.length === 0) {
                tabContent.innerHTML = '<div class="card"><div class="empty"><h3>No Photos</h3><p>Photos from worker submissions will appear here.</p></div></div>';
                return;
            }

            // Pull submission descriptions to enrich photos
            const submissions = AppData.getSubmissions().filter(function(s) { return s.projectId === project.id; });
            const subMap = {};
            submissions.forEach(function(s) { subMap[s.id] = s; });

            // Group photos by date → worker
            const byDate = {};
            photos.forEach(function(photo) {
                const date = photo.date || 'Unknown';
                if (!byDate[date]) byDate[date] = {};
                const wid = photo.workerId || 'unknown';
                if (!byDate[date][wid]) byDate[date][wid] = { photos: [], worker: null, descriptions: [] };
                byDate[date][wid].photos.push(photo);
                byDate[date][wid].worker = AppData.getWorker(photo.workerId);
                // Attach description from submission if available
                if (photo.submissionId && subMap[photo.submissionId]) {
                    const desc = subMap[photo.submissionId].description;
                    if (desc && byDate[date][wid].descriptions.indexOf(desc) === -1) {
                        byDate[date][wid].descriptions.push(desc);
                    }
                }
            });

            const sortedDates = Object.keys(byDate).sort().reverse();

            // Build header with export buttons
            let html = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">' +
                '<div style="font-size:.9rem;color:var(--text2)">' + photos.length + ' photo' + (photos.length !== 1 ? 's' : '') + ' across ' + sortedDates.length + ' day' + (sortedDates.length !== 1 ? 's' : '') + '</div>' +
                '<div style="display:flex;gap:8px">' +
                    '<button class="btn-secondary btn-sm" id="photoExportPDF">Export PDF</button>' +
                    '<button class="btn-secondary btn-sm" id="photoExportCSV">Export CSV</button>' +
                '</div>' +
            '</div>';

            // Day-by-day cards
            sortedDates.forEach(function(date) {
                html += '<div class="card" style="margin-bottom:16px">';
                html += '<h3 style="margin-bottom:12px;font-size:1rem">' + Utils.formatDate(date) + '</h3>';

                Object.keys(byDate[date]).forEach(function(wid) {
                    const group = byDate[date][wid];
                    const workerName = group.worker ? group.worker.name : 'Unknown Worker';

                    html += '<div style="margin-bottom:16px">';
                    html += '<div style="font-weight:600;font-size:.9rem;color:var(--text2);margin-bottom:6px">' + esc(workerName) + '</div>';

                    // Work description
                    if (group.descriptions.length > 0) {
                        html += '<div style="font-size:.9rem;color:var(--text);background:var(--bg);border-left:3px solid var(--accent);padding:8px 12px;border-radius:0 var(--radius) var(--radius) 0;margin-bottom:10px">' +
                            group.descriptions.map(function(d) { return esc(d); }).join('<br>') +
                        '</div>';
                    }

                    // Photo thumbnails
                    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">';
                    group.photos.forEach(function(photo) {
                        html += '<div class="photo-thumb" data-photo-id="' + photo.id + '" style="cursor:pointer;border-radius:var(--radius);overflow:hidden;aspect-ratio:1;background:var(--bg)">' +
                            '<img data-load-id="' + photo.id + '" style="width:100%;height:100%;object-fit:cover" alt="Photo">' +
                        '</div>';
                    });
                    html += '</div></div>';
                });

                html += '</div>';
            });

            tabContent.innerHTML = html;

            // Load thumbnails
            var objUrls = [];
            photos.forEach(function(photo) {
                const img = tabContent.querySelector('[data-load-id="' + photo.id + '"]');
                if (img && (photo.thumbnail || photo.blob)) {
                    const blobSrc = photo.thumbnail || photo.blob;
                    const blob = blobSrc instanceof Blob ? blobSrc : new Blob([blobSrc]);
                    const url = URL.createObjectURL(blob);
                    objUrls.push(url);
                    img.src = url;
                }
            });

            // Lightbox on photo click
            tabContent.querySelectorAll('.photo-thumb').forEach(function(thumb) {
                thumb.addEventListener('click', function() {
                    const pid = thumb.dataset.photoId;
                    const photo = photos.find(function(p) { return p.id === pid; });
                    if (!photo || !photo.blob) return;
                    const overlay = document.createElement('div');
                    overlay.className = 'modal-overlay active';
                    overlay.style.cssText = 'display:flex;z-index:9999';
                    const sub = photo.submissionId ? subMap[photo.submissionId] : null;
                    const workerObj = AppData.getWorker(photo.workerId);
                    overlay.innerHTML = '<div class="modal" style="max-width:90vw;padding:0;overflow:hidden;background:#000">' +
                        '<button style="position:absolute;top:8px;right:8px;z-index:10;color:#fff;background:rgba(0,0,0,.5);border:none;border-radius:50%;width:36px;height:36px;font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center" id="lbClose">&times;</button>' +
                        '<div id="lbImg" style="display:flex;align-items:center;justify-content:center;min-height:200px;background:#000"><p style="color:#ccc">Loading...</p></div>' +
                        '<div style="padding:12px 16px;background:var(--surface)">' +
                            '<p><strong>' + esc(workerObj ? workerObj.name : 'Worker') + '</strong> &mdash; ' + Utils.formatDate(photo.date) + '</p>' +
                            (sub && sub.description ? '<p style="color:var(--text2);font-size:.9rem;margin-top:4px">' + esc(sub.description) + '</p>' : '') +
                        '</div>' +
                    '</div>';
                    document.body.appendChild(overlay);
                    const blob = photo.blob instanceof Blob ? photo.blob : new Blob([photo.blob]);
                    const url = URL.createObjectURL(blob);
                    objUrls.push(url);
                    overlay.querySelector('#lbImg').innerHTML = '<img src="' + url + '" style="max-width:90vw;max-height:70vh;object-fit:contain;display:block">';
                    overlay.querySelector('#lbClose').onclick = function() { overlay.remove(); };
                    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
                });
            });

            // ── Export PDF ──────────────────────────────────────────────
            tabContent.querySelector('#photoExportPDF').addEventListener('click', async function() {
                const btn = this;
                btn.textContent = 'Building PDF...';
                btn.disabled = true;

                // Convert blobs to data URLs for embedding in the print window
                const photoDataUrls = {};
                for (var i = 0; i < photos.length; i++) {
                    const p = photos[i];
                    if (p.blob) {
                        const blob = p.blob instanceof Blob ? p.blob : new Blob([p.blob]);
                        photoDataUrls[p.id] = await Utils.blobToDataUrl(blob);
                    }
                }

                const settings = AppData.getSettings();
                const companyName = settings.companyName || 'My Company';
                const companyAddr = [settings.address, settings.city, settings.province].filter(Boolean).join(', ');
                const companyPhone = settings.phone || '';
                const companyEmail = settings.email || '';
                const clientObj = AppData.getClient(project.clientId);
                const clientName = clientObj ? clientObj.name : (project.clientName || '');

                // ── Belfort-style print document ─────────────────────────
                let printHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
                    '<title>Site Photo Report — ' + esc(project.name) + '</title>' +
                    '<style>' +
                        '*{margin:0;padding:0;box-sizing:border-box}' +
                        'body{font-family:"Segoe UI",Arial,sans-serif;font-size:12px;color:#111111;background:#fff;line-height:1.5}' +

                        /* Header bar */
                        '.doc-header{background:#111111;color:#fff;padding:14px 32px;display:flex;justify-content:space-between;align-items:center}' +
                        '.doc-header .co-name{font-size:18px;font-weight:700;letter-spacing:1px;color:#fff}' +
                        '.doc-header .co-tag{font-size:10px;color:#c9a84c;letter-spacing:2px;text-transform:uppercase;margin-top:3px}' +
                        '.doc-header .doc-label{text-align:right}' +
                        '.doc-header .doc-label h2{font-size:12px;font-weight:600;color:#c9a84c;text-transform:uppercase;letter-spacing:1px}' +
                        '.doc-header .doc-label p{font-size:10px;color:#aaa;margin-top:3px}' +

                        /* Gold banner */
                        '.gold-banner{background:#c9a84c;color:#111111;text-align:center;padding:9px 32px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase}' +

                        /* Body */
                        '.body{padding:20px 32px}' +

                        /* Project meta strip */
                        '.project-meta{background:#f4f4f8;border-left:4px solid #c9a84c;padding:10px 14px;margin-bottom:20px;display:flex;gap:32px;flex-wrap:wrap}' +
                        '.project-meta .meta-item{font-size:11px;color:#555}' +
                        '.project-meta .meta-item strong{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#c9a84c;margin-bottom:2px}' +

                        /* Section (day) */
                        '.day{margin-bottom:28px;page-break-inside:avoid}' +
                        '.day-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}' +
                        '.day-date{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#c9a84c;border-bottom:1px solid #ddd;padding-bottom:6px;flex:1}' +

                        /* Worker block */
                        '.worker-block{margin-bottom:16px}' +
                        '.worker-name{font-size:11px;font-weight:700;color:#111111;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}' +
                        '.work-desc{font-size:11px;color:#333;background:#f4f4f8;border-left:4px solid #c9a84c;padding:8px 12px;margin-bottom:10px;line-height:1.6}' +

                        /* Photos */
                        '.photo-grid{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}' +
                        '.photo-grid img{width:175px;height:130px;object-fit:cover;border:1px solid #ddd;border-top:3px solid #c9a84c}' +

                        /* Footer bar */
                        '.doc-footer{background:#111111;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:14px 32px;margin-top:auto}' +
                        '.doc-footer .footer-left{font-size:11px;color:#aaa;line-height:1.8}' +
                        '.doc-footer .footer-left strong{color:#c9a84c;font-size:12px;display:block;margin-bottom:2px}' +
                        '.doc-footer .footer-right{font-size:10px;color:#666;text-align:right}' +

                        '@media print{' +
                            'body{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
                            '.day{page-break-inside:avoid}' +
                        '}' +
                    '</style></head><body>' +

                    /* Header */
                    '<div class="doc-header">' +
                        '<div>' +
                            '<div class="co-name">' + esc(companyName) + '</div>' +
                            '<div class="co-tag">Powered by Ledgerman</div>' +
                        '</div>' +
                        '<div class="doc-label">' +
                            '<h2>Site Photo Report</h2>' +
                            '<p>' + esc(project.name) + '</p>' +
                            '<p>Generated ' + Utils.formatDate(Utils.today()) + '</p>' +
                        '</div>' +
                    '</div>' +

                    /* Gold banner */
                    '<div class="gold-banner">' + esc(project.name) +
                        (clientName ? ' &nbsp;—&nbsp; ' + esc(clientName) : '') +
                    '</div>' +

                    '<div class="body">' +

                    /* Project meta strip */
                    '<div class="project-meta">' +
                        '<div class="meta-item"><strong>Project</strong>' + esc(project.name) + '</div>' +
                        (clientName ? '<div class="meta-item"><strong>Client</strong>' + esc(clientName) + '</div>' : '') +
                        (project.jobSiteAddress ? '<div class="meta-item"><strong>Site Address</strong>' + esc(project.jobSiteAddress) + '</div>' : '') +
                        '<div class="meta-item"><strong>Days on Record</strong>' + sortedDates.length + '</div>' +
                        '<div class="meta-item"><strong>Total Photos</strong>' + photos.length + '</div>' +
                        '<div class="meta-item"><strong>Report Date</strong>' + Utils.formatDate(Utils.today()) + '</div>' +
                    '</div>';

                /* Day sections */
                sortedDates.forEach(function(date) {
                    printHtml += '<div class="day">' +
                        '<div class="day-header"><div class="day-date">' + Utils.formatDate(date) + '</div></div>';

                    Object.keys(byDate[date]).forEach(function(wid) {
                        const group = byDate[date][wid];
                        const wName = group.worker ? group.worker.name : 'Unknown Worker';
                        printHtml += '<div class="worker-block">' +
                            '<div class="worker-name">' + esc(wName) + '</div>';
                        if (group.descriptions.length > 0) {
                            printHtml += '<div class="work-desc">' + group.descriptions.map(function(d) { return esc(d); }).join('<br>') + '</div>';
                        }
                        printHtml += '<div class="photo-grid">';
                        group.photos.forEach(function(photo) {
                            if (photoDataUrls[photo.id]) {
                                printHtml += '<img src="' + photoDataUrls[photo.id] + '" alt="Site photo">';
                            }
                        });
                        printHtml += '</div></div>';
                    });

                    printHtml += '</div>';
                });

                printHtml += '</div>' + /* end .body */

                /* Footer */
                '<div class="doc-footer">' +
                    '<div class="footer-left">' +
                        '<strong>' + esc(companyName) + '</strong>' +
                        (companyAddr ? esc(companyAddr) + '<br>' : '') +
                        (companyPhone ? esc(companyPhone) + '&nbsp;&nbsp;' : '') +
                        (companyEmail ? esc(companyEmail) : '') +
                    '</div>' +
                    '<div class="footer-right">Confidential &mdash; For internal use only</div>' +
                '</div>' +
                '</body></html>';

                const win = window.open('', '_blank');
                win.document.write(printHtml);
                win.document.close();
                win.onload = function() { win.print(); };

                btn.textContent = 'Export PDF';
                btn.disabled = false;
            });

            // ── Export CSV ──────────────────────────────────────────────
            tabContent.querySelector('#photoExportCSV').addEventListener('click', function() {
                const rows = [['Date', 'Worker', 'Description of Work', 'Photo Count']];
                sortedDates.forEach(function(date) {
                    Object.keys(byDate[date]).forEach(function(wid) {
                        const group = byDate[date][wid];
                        const wName = group.worker ? group.worker.name : 'Unknown Worker';
                        const desc = group.descriptions.join(' | ');
                        rows.push([
                            Utils.formatDate(date),
                            wName,
                            desc,
                            group.photos.length
                        ]);
                    });
                });

                const csv = rows.map(function(row) {
                    return row.map(function(cell) {
                        var s = String(cell || '').replace(/"/g, '""');
                        return '"' + s + '"';
                    }).join(',');
                }).join('\r\n');

                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = project.name.replace(/[^a-zA-Z0-9]/g, '_') + '_photos_' + Utils.today() + '.csv';
                a.click();
                URL.revokeObjectURL(url);
                Utils.showToast('CSV downloaded');
            });

        }).catch(function(err) {
            tabContent.innerHTML = '<div class="card"><p style="color:var(--accent)">Error loading photos: ' + Utils.escapeHtml(String(err)) + '</p></div>';
        });
    },

    _renderInvoicesTab(tabContent, project) {
        const invoices = AppData.getInvoices(project.id);
        tabContent.innerHTML = '<div class="card">' +
            (invoices.length === 0
                ? '<div class="empty"><h3>No Invoices</h3><p>Create invoices from the Invoices page.</p></div>'
                : '<table><thead><tr><th>Invoice #</th><th>Date</th><th class="amount">Amount</th><th>Status</th></tr></thead><tbody>' +
                    invoices.map(function(inv) {
                        return '<tr><td><strong>' + Utils.escapeHtml(inv.invoiceNumber || '') + '</strong></td>' +
                            '<td>' + Utils.formatDate(inv.date) + '</td>' +
                            '<td class="amount">' + Utils.formatCurrency(inv.total) + '</td>' +
                            '<td>' + Utils.escapeHtml(inv.status || 'Unpaid') + '</td></tr>';
                    }).join('') +
                    '</tbody></table>'
            ) +
        '</div>';
    },

    _startWizard() {
        const self = this;
        const clients = AppData.getClients();
        const workers = AppData.getWorkers().filter(function(w) { return w.status === 'Active'; });
        const esc = Utils.escapeHtml;
        let step = 0;
        const totalSteps = 4;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';

        function renderWizardStep() {
            let html = '<div class="modal" style="max-width:600px"><h3>New Project Wizard - Step ' + (step + 1) + ' of ' + totalSteps + '</h3>';
            html += '<div style="background:var(--border);height:4px;border-radius:2px;margin-bottom:16px"><div style="background:var(--accent);height:100%;border-radius:2px;width:' + ((step + 1) / totalSteps * 100) + '%"></div></div>';

            if (step === 0) {
                html += '<p style="color:var(--text2);margin-bottom:12px">Let\'s start with the basics. What is this project called?</p>' +
                    '<div class="form-group" style="margin-bottom:12px"><label>Project Name *</label><input id="wiz-name" required></div>' +
                    '<div class="form-group" style="margin-bottom:12px"><label>Description / Scope</label><textarea id="wiz-desc" rows="3"></textarea></div>';
            } else if (step === 1) {
                html += '<p style="color:var(--text2);margin-bottom:12px">Who is the client for this project?</p>' +
                    '<div class="form-group" style="margin-bottom:12px"><label>Select from address book</label><select id="wiz-client-select"><option value="">-- Type manually --</option>' +
                    clients.map(function(c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
                    '<div class="form-group" style="margin-bottom:12px"><label>Client Name</label><input id="wiz-client-name"></div>' +
                    '<div class="form-group" style="margin-bottom:12px"><label>Job Site Address</label><input id="wiz-site"></div>' +
                    '<div class="form-group" style="margin-bottom:12px"><label>Contract / PO Number</label><input id="wiz-contract"></div>';
            } else if (step === 2) {
                html += '<p style="color:var(--text2);margin-bottom:12px">Set the timeline for this project.</p>' +
                    '<div class="form-row"><div class="form-group"><label>Start Date</label><input type="date" id="wiz-start" value="' + Utils.today() + '"></div>' +
                    '<div class="form-group"><label>Estimated End Date</label><input type="date" id="wiz-end"></div></div>';
            } else if (step === 3) {
                html += '<p style="color:var(--text2);margin-bottom:12px">Assign workers to this project.</p>';
                if (workers.length === 0) {
                    html += '<p style="color:var(--warn)">No active workers found. You can assign workers later from the project settings.</p>';
                } else {
                    html += '<div style="margin-bottom:8px"><label style="cursor:pointer"><input type="checkbox" id="wiz-assign-all"> Select all active workers</label></div>' +
                        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
                        workers.map(function(w) {
                            return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" class="wiz-worker" value="' + w.id + '"> ' + esc(w.name) + '</label>';
                        }).join('') + '</div>';
                }
            }

            html += '<div class="form-actions" style="justify-content:space-between"><div>';
            if (step > 0) html += '<button class="btn-secondary" id="wizPrev">Previous</button>';
            html += '</div><div style="display:flex;gap:8px">';
            html += '<button class="btn-ghost" id="wizCancel">Cancel</button>';
            html += '<button class="btn-primary" id="wizNext">' + (step < totalSteps - 1 ? 'Next' : 'Create Project') + '</button>';
            html += '</div></div></div>';

            overlay.innerHTML = html;
            // Kill transition so steps snap cleanly without overlap animation
            var modal = overlay.querySelector('.modal');
            if (modal) { modal.style.transition = 'none'; modal.style.transform = 'none'; }
            bindWizardEvents();
        }

        function bindWizardEvents() {
            overlay.querySelector('#wizCancel').addEventListener('click', function() { overlay.remove(); });
            if (overlay.querySelector('#wizPrev')) {
                overlay.querySelector('#wizPrev').addEventListener('click', function() { step--; renderWizardStep(); });
            }
            overlay.querySelector('#wizNext').addEventListener('click', function() {
                if (step === 0) {
                    const name = overlay.querySelector('#wiz-name').value.trim();
                    if (!name) { Utils.showToast('Project name is required', 'error'); return; }
                    overlay._wizData = overlay._wizData || {};
                    overlay._wizData.name = name;
                    overlay._wizData.description = overlay.querySelector('#wiz-desc').value.trim();
                } else if (step === 1) {
                    overlay._wizData.clientId = overlay.querySelector('#wiz-client-select').value;
                    overlay._wizData.clientName = overlay.querySelector('#wiz-client-name').value.trim();
                    overlay._wizData.jobSiteAddress = overlay.querySelector('#wiz-site').value.trim();
                    overlay._wizData.contractNumber = overlay.querySelector('#wiz-contract').value.trim();
                } else if (step === 2) {
                    overlay._wizData.startDate = overlay.querySelector('#wiz-start').value;
                    overlay._wizData.endDate = overlay.querySelector('#wiz-end').value;
                }

                if (step < totalSteps - 1) {
                    step++;
                    renderWizardStep();
                    // Restore data on step 1
                    if (step === 1 && overlay._wizData.clientId) {
                        overlay.querySelector('#wiz-client-select').value = overlay._wizData.clientId;
                        overlay.querySelector('#wiz-client-name').value = overlay._wizData.clientName || '';
                        overlay.querySelector('#wiz-site').value = overlay._wizData.jobSiteAddress || '';
                        overlay.querySelector('#wiz-contract').value = overlay._wizData.contractNumber || '';
                    }
                } else {
                    // Collect workers and create
                    const workerIds = [];
                    overlay.querySelectorAll('.wiz-worker:checked').forEach(function(cb) { workerIds.push(cb.value); });
                    const d = overlay._wizData;
                    const projectData = {
                        id: AppData.generateId(),
                        name: d.name,
                        description: d.description || '',
                        clientId: d.clientId || '',
                        clientName: d.clientName || '',
                        client: d.clientName || '',
                        jobSiteAddress: d.jobSiteAddress || '',
                        contractNumber: d.contractNumber || '',
                        startDate: d.startDate || '',
                        endDate: d.endDate || '',
                        status: 'Active',
                        assignedWorkers: workerIds,
                budget: parseFloat(fd.budget) || 0,
                        clientAddress: '', clientCity: '', clientProvince: '', clientPostalCode: ''
                    };
                    // Auto-fill client fields if selected from address book
                    if (d.clientId) {
                        const client = AppData.getClient(d.clientId);
                        if (client) {
                            projectData.clientName = client.name;
                            projectData.client = client.name;
                            projectData.clientAddress = client.address || '';
                            projectData.clientCity = client.city || '';
                            projectData.clientProvince = client.province || '';
                            projectData.clientPostalCode = client.postalCode || '';
                        }
                    }
                    AppData.saveProject(projectData);
                    const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                    AppData.addAuditLog(username, 'Project Created', projectData.name + ' (via wizard)');
                    Utils.showToast('Project created!');
                    overlay.remove();
                    self._viewingProjectId = projectData.id;
                    self._activeTab = 'work-items';
                    self._renderDetail();
                }
            });

            // Client select auto-fill in wizard
            const clientSelect = overlay.querySelector('#wiz-client-select');
            if (clientSelect) {
                clientSelect.addEventListener('change', function() {
                    const cid = this.value;
                    if (!cid) return;
                    const c = AppData.getClient(cid);
                    if (c) overlay.querySelector('#wiz-client-name').value = c.name || '';
                });
            }
            // Assign all checkbox
            const assignAll = overlay.querySelector('#wiz-assign-all');
            if (assignAll) {
                assignAll.addEventListener('change', function() {
                    overlay.querySelectorAll('.wiz-worker').forEach(function(cb) { cb.checked = assignAll.checked; });
                });
            }
        }

        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
        renderWizardStep();
    },

    // Public method for external navigation
    showProject(projectId) {
        this._viewingProjectId = projectId;
        this._activeTab = 'work-items';
        if (this._container) this._renderDetail();
    }
};
