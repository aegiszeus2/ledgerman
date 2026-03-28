// Admin Task Assignment Module
window.AdminTaskAssignment = {
    _statusFilter: 'All',
    _projectFilter: 'All',
    _workerFilter: 'All',
    _editingTaskId: null,

    render(container, params) {
        const self = this;
        self._container = container;
        self._renderList();
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const tasks = AppData.getEntities('tasks') || [];
        const projects = AppData.getProjects() || [];
        const workers = AppData.getWorkers() || [];

        // Get unique statuses from tasks
        const statuses = ['All', 'To Do', 'In Progress', 'Done'];
        const projectNames = ['All', ...new Set(projects.map(p => p.name))];
        const workerNames = ['All', ...new Set(workers.map(w => w.name))];

        // Apply filters
        let filtered = tasks;
        if (self._statusFilter !== 'All') {
            filtered = filtered.filter(t => (t.status || 'To Do') === self._statusFilter);
        }
        if (self._projectFilter !== 'All') {
            filtered = filtered.filter(t => t.projectName === self._projectFilter);
        }
        if (self._workerFilter !== 'All') {
            filtered = filtered.filter(t => (t.assigned_to_worker_name || t.assigned_to_worker_id) === self._workerFilter);
        }

        const esc = Utils.escapeHtml;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                <h2>Task Assignment</h2>
                <button class="btn-primary" id="addTaskBtn">+ New Task</button>
            </div>

            <div class="card" style="margin-bottom:16px;padding:16px">
                <div style="display:flex;gap:12px;flex-wrap:wrap">
                    <div style="flex:1;min-width:150px">
                        <label style="display:block;font-size:.85rem;color:var(--text2);margin-bottom:4px">Status</label>
                        <select id="statusFilter" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius)">
                            ${statuses.map(s => `<option value="${s}" ${self._statusFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex:1;min-width:150px">
                        <label style="display:block;font-size:.85rem;color:var(--text2);margin-bottom:4px">Project</label>
                        <select id="projectFilter" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius)">
                            ${projectNames.map(p => `<option value="${p}" ${self._projectFilter === p ? 'selected' : ''}>${p}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex:1;min-width:150px">
                        <label style="display:block;font-size:.85rem;color:var(--text2);margin-bottom:4px">Assigned To</label>
                        <select id="workerFilter" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius)">
                            ${workerNames.map(w => `<option value="${w}" ${self._workerFilter === w ? 'selected' : ''}>${w}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <div class="card">
                ${filtered.length === 0
                    ? '<div class="empty"><h3>No Tasks</h3><p>Create your first task to assign to workers.</p></div>'
                    : `<table style="width:100%">
                        <thead>
                            <tr style="border-bottom:2px solid var(--border)">
                                <th style="text-align:left;padding:12px;font-weight:600;color:var(--text2)">Task</th>
                                <th style="text-align:left;padding:12px;font-weight:600;color:var(--text2)">Project</th>
                                <th style="text-align:left;padding:12px;font-weight:600;color:var(--text2)">Assigned To</th>
                                <th style="text-align:left;padding:12px;font-weight:600;color:var(--text2)">Due Date</th>
                                <th style="text-align:left;padding:12px;font-weight:600;color:var(--text2)">Status</th>
                                <th style="text-align:right;padding:12px;font-weight:600;color:var(--text2)">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(t => {
                                const statusClass = t.status === 'Done' ? 'completed-s' : (t.status === 'In Progress' ? 'active-s' : '');
                                const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'Done';
                                const dueDisplay = t.due_date ? (isOverdue ? '<span style="color:var(--accent);font-weight:600">' + esc(Utils.formatDate(t.due_date)) + ' (OVERDUE)</span>' : esc(Utils.formatDate(t.due_date))) : '—';
                                return `
                                    <tr style="border-bottom:1px solid var(--border);padding:12px">
                                        <td style="padding:12px"><strong>${esc(t.title || 'Untitled')}</strong></td>
                                        <td style="padding:12px">${esc(t.projectName || '—')}</td>
                                        <td style="padding:12px">${esc(t.assigned_to_worker_name || '—')}</td>
                                        <td style="padding:12px">${dueDisplay}</td>
                                        <td style="padding:12px"><span class="pstatus ${statusClass}">${esc(t.status || 'To Do')}</span></td>
                                        <td style="padding:12px;text-align:right;white-space:nowrap">
                                            <button class="btn-ghost btn-sm edit-task" data-id="${t.id}" style="margin-right:4px">Edit</button>
                                            <button class="btn-ghost btn-sm delete-task" data-id="${t.id}" style="color:var(--accent)">Delete</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>`
                }
            </div>
        `;

        // Filter listeners
        container.querySelector('#statusFilter').addEventListener('change', function(e) {
            self._statusFilter = e.target.value;
            self._renderList();
        });
        container.querySelector('#projectFilter').addEventListener('change', function(e) {
            self._projectFilter = e.target.value;
            self._renderList();
        });
        container.querySelector('#workerFilter').addEventListener('change', function(e) {
            self._workerFilter = e.target.value;
            self._renderList();
        });

        // Add task button
        container.querySelector('#addTaskBtn').addEventListener('click', function() {
            self._showTaskForm(null);
        });

        // Edit and delete listeners
        container.querySelectorAll('.edit-task').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                self._showTaskForm(btn.dataset.id);
            });
        });

        container.querySelectorAll('.delete-task').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const task = AppData.getEntity(btn.dataset.id);
                if (!task) return;
                const confirmed = await Utils.confirm(`Delete task "${task.title}"?`);
                if (!confirmed) return;
                AppData.deleteEntity(task.id);
                Utils.showToast('Task deleted');
                self._renderList();
            });
        });
    },

    _showTaskForm(taskId) {
        const self = this;
        const task = taskId ? AppData.getEntity(taskId) : null;
        const isEdit = !!task;
        const projects = AppData.getProjects() || [];
        const workers = AppData.getWorkers().filter(w => w.status === 'Active') || [];
        const esc = Utils.escapeHtml;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:600px">
                <div class="modal-header">
                    <h3 style="margin:0">${isEdit ? 'Edit Task' : 'New Task'}</h3>
                </div>
                <div class="modal-body">
                    <form id="taskModalForm" novalidate>
                        <div class="form-group" style="margin-bottom:12px">
                            <label>Task Title *</label>
                            <input name="title" value="${esc(task ? task.title : '')}" placeholder="e.g., Foundation inspection" required>
                        </div>

                        <div class="form-group" style="margin-bottom:12px">
                            <label>Description</label>
                            <textarea name="description" style="min-height:80px;padding:8px;border:1px solid var(--border);border-radius:var(--radius);width:100%;font-family:inherit" placeholder="Task details...">${esc(task ? task.description : '')}</textarea>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Project</label>
                                <select name="projectId">
                                    <option value="">-- Select Project --</option>
                                    ${projects.map(p => `<option value="${p.id}" ${task && task.projectId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Assign To Worker</label>
                                <select name="assigned_to_worker_id">
                                    <option value="">-- Unassigned --</option>
                                    ${workers.map(w => `<option value="${w.id}" ${task && task.assigned_to_worker_id === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
                                </select>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Due Date</label>
                                <input type="date" name="due_date" value="${task && task.due_date ? task.due_date : ''}">
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select name="status">
                                    <option ${!task || task.status === 'To Do' ? 'selected' : ''}>To Do</option>
                                    <option ${task && task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                    <option ${task && task.status === 'Done' ? 'selected' : ''}>Done</option>
                                </select>
                            </div>
                        </div>

                        <div style="display:flex;gap:8px;margin-top:20px">
                            <button type="submit" class="btn-primary">Save Task</button>
                            <button type="button" class="btn-secondary" id="cancelTaskBtn">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const form = overlay.querySelector('#taskModalForm');
        const cancelBtn = overlay.querySelector('#cancelTaskBtn');

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            if (isEdit) {
                // Update existing task
                const updated = {
                    ...task,
                    ...data,
                    id: task.id,
                    entity_type: 'tasks'
                };
                AppData.updateEntity(updated.id, updated);
            } else {
                // Create new task
                const newTask = {
                    id: 'task_' + Date.now(),
                    entity_type: 'tasks',
                    ...data,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                AppData.addEntity(newTask);
            }

            Utils.showToast(isEdit ? 'Task updated' : 'Task created');
            overlay.remove();
            self._renderList();
        });

        cancelBtn.addEventListener('click', function() {
            overlay.remove();
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });
    }
};
