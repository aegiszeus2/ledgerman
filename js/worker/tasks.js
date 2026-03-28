// Worker Tasks Module
window.WorkerTasks = {
    _statusFilter: 'All',

    render(container, worker, params) {
        const self = this;
        self._container = container;
        self._worker = worker;
        self._renderPage();
    },

    _renderPage() {
        const self = this;
        const container = self._container;
        const worker = self._worker;
        const esc = Utils.escapeHtml;

        // Get all tasks, filter for ones assigned to this worker
        const allTasks = AppData.getEntities('tasks') || [];
        const myTasks = allTasks.filter(t => t.assigned_to_worker_id === worker.id || t.assigned_to === worker.id);

        // Apply status filter
        let filtered = myTasks;
        if (self._statusFilter !== 'All') {
            filtered = filtered.filter(t => (t.status || 'To Do') === self._statusFilter);
        }

        // Sort by due date, overdue first
        filtered.sort((a, b) => {
            const aOverdue = a.due_date && new Date(a.due_date) < new Date() && a.status !== 'Done';
            const bOverdue = b.due_date && new Date(b.due_date) < new Date() && b.status !== 'Done';
            if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
            if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
            return 0;
        });

        const statuses = ['All', 'To Do', 'In Progress', 'Done'];

        container.innerHTML = `
            <div style="margin-bottom:16px">
                <h2 style="margin-bottom:16px">My Tasks</h2>
                
                <div class="tabs" style="margin-bottom:16px">
                    ${statuses.map(s => {
                        const count = s === 'All' ? myTasks.length : myTasks.filter(t => (t.status || 'To Do') === s).length;
                        return `<button class="tab-btn ${self._statusFilter === s ? 'active' : ''}" data-status="${s}">${s} (${count})</button>`;
                    }).join('')}
                </div>
            </div>

            <div id="tasksContainer">
                ${filtered.length === 0
                    ? `<div class="card" style="text-align:center;padding:40px 20px">
                        <h3 style="color:var(--text);margin-bottom:8px">No Tasks</h3>
                        <p style="color:var(--text2);font-size:.9rem">
                            ${self._statusFilter === 'All' ? 'No tasks assigned to you yet.' : `No ${self._statusFilter.toLowerCase()} tasks.`}
                        </p>
                       </div>`
                    : filtered.map(t => {
                        const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'Done';
                        const project = AppData.getProject(t.projectId);
                        const statusClass = t.status === 'Done' ? 'completed-s' : (t.status === 'In Progress' ? 'active-s' : '');
                        
                        return `
                            <div class="card" style="padding:16px;margin-bottom:12px;cursor:pointer;transition:all 0.2s;border:1px solid var(--border)" data-task-id="${t.id}">
                                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px">
                                    <div style="flex:1;min-width:0">
                                        <h3 style="margin:0;font-size:1.05rem;font-weight:600;color:var(--text)">${esc(t.title || 'Untitled')}</h3>
                                        <div style="font-size:.85rem;color:var(--text2);margin-top:2px">
                                            ${project ? esc(project.name) : 'No project'}
                                        </div>
                                    </div>
                                    <span class="pstatus ${statusClass}" style="white-space:nowrap">${esc(t.status || 'To Do')}</span>
                                </div>

                                ${t.description ? `<p style="font-size:.9rem;color:var(--text);margin:8px 0;line-height:1.4">${esc(t.description)}</p>` : ''}

                                <div style="display:flex;gap:12px;align-items:center;margin:8px 0;flex-wrap:wrap;font-size:.85rem">
                                    ${t.due_date ? `
                                        <div style="padding:4px 8px;background:${isOverdue ? 'rgba(233,69,96,.1)' : 'rgba(52,152,219,.1)'};border-radius:4px;color:${isOverdue ? 'var(--accent)' : 'var(--primary)'}">
                                            📅 ${isOverdue ? '<strong>OVERDUE: ' : ''}${esc(Utils.formatDate(t.due_date))}${isOverdue ? '</strong>' : ''}
                                        </div>
                                    ` : ''}
                                </div>

                                ${t.status !== 'Done' ? `
                                    <div style="display:flex;gap:8px;margin-top:12px">
                                        ${t.status !== 'In Progress' ? `
                                            <button class="btn-primary btn-sm mark-in-progress" data-id="${t.id}" style="font-size:.85rem">
                                                Start Task
                                            </button>
                                        ` : ''}
                                        ${t.status === 'In Progress' ? `
                                            <button class="btn-success btn-sm mark-done" data-id="${t.id}" style="font-size:.85rem">
                                                Mark Complete
                                            </button>
                                        ` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
            </div>
        `;

        // Tab filtering
        container.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', function() {
                self._statusFilter = tab.dataset.status;
                self._renderPage();
            });
        });

        // Mark in progress
        container.querySelectorAll('.mark-in-progress').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const taskId = btn.dataset.id;
                const task = AppData.getEntity(taskId);
                if (!task) return;
                
                const updated = {
                    ...task,
                    status: 'In Progress'
                };
                AppData.updateEntity(taskId, updated);
                Utils.showToast('Task started');
                self._renderPage();
            });
        });

        // Mark done
        container.querySelectorAll('.mark-done').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const taskId = btn.dataset.id;
                const task = AppData.getEntity(taskId);
                if (!task) return;
                
                const updated = {
                    ...task,
                    status: 'Done',
                    completed_at: new Date().toISOString()
                };
                AppData.updateEntity(taskId, updated);
                Utils.showToast('Task completed! 🎉');
                self._renderPage();
            });
        });

        // Click card to view detail
        container.querySelectorAll('[data-task-id]').forEach(card => {
            card.addEventListener('click', function(e) {
                if (!e.target.closest('button')) {
                    self._showTaskDetail(this.dataset.taskId);
                }
            });
        });
    },

    _showTaskDetail(taskId) {
        const task = AppData.getEntity(taskId);
        const project = AppData.getProject(task.projectId);
        const esc = Utils.escapeHtml;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3 style="margin:0">${esc(task.title || 'Untitled')}</h3>
                </div>
                <div class="modal-body">
                    ${task.description ? `
                        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
                            <h4 style="color:var(--text2);font-size:.85rem;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0">Description</h4>
                            <p style="margin:0;line-height:1.5;color:var(--text)">${esc(task.description)}</p>
                        </div>
                    ` : ''}

                    ${project ? `
                        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
                            <h4 style="color:var(--text2);font-size:.85rem;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0">Project</h4>
                            <p style="margin:0;color:var(--text)">${esc(project.name)}</p>
                        </div>
                    ` : ''}

                    ${task.due_date ? `
                        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
                            <h4 style="color:var(--text2);font-size:.85rem;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0">Due Date</h4>
                            <p style="margin:0;color:var(--text)">${esc(Utils.formatDate(task.due_date))}</p>
                        </div>
                    ` : ''}

                    <div style="margin-bottom:16px">
                        <h4 style="color:var(--text2);font-size:.85rem;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0">Status</h4>
                        <p style="margin:0;color:var(--text)">${esc(task.status || 'To Do')}</p>
                    </div>
                </div>
                <div class="modal-footer" style="display:flex;gap:8px">
                    <button class="btn-secondary" id="closeTaskDetail">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.querySelector('#closeTaskDetail').addEventListener('click', function() {
            overlay.remove();
        });
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });
    }
};
