// Admin Gantt Chart Module — Tier 3
// Visual project timeline with task dependencies using frappe-gantt library
window.AdminGanttChart = {
    _selectedProject: null,

    render(container, params) {
        const self = this;
        self._container = container;

        const projects = AppData.getProjects();

        if (projects.length === 0) {
            container.innerHTML = `
                <div style="padding:32px;text-align:center;color:#f1f5f9">
                    <h2 style="color:#f1f5f9">No projects to visualize</h2>
                    <p>Create projects first to view them on the Gantt chart.</p>
                </div>
            `;
            return;
        }

        // Select first project by default
        if (!self._selectedProject && projects.length > 0) {
            self._selectedProject = projects[0].id;
        }

        const selectedProjectId = params && params.projectId ? params.projectId : self._selectedProject;
        const selectedProject = AppData.getProject(selectedProjectId);

        if (!selectedProject) {
            container.innerHTML = `<div style="padding:32px;text-align:center;color:#f1f5f9;font-weight:600">Project not found</div>`;
            return;
        }

        self._selectedProject = selectedProjectId;
        self._renderChart(container, projects, selectedProject);
    },

    _renderChart(container, projects, selectedProject) {
        const self = this;
        const tasks = AppData.getTasks ? AppData.getTasks() : [];
        const projectTasks = tasks.filter(t => t.projectId === selectedProject.id);

        // Build Gantt data from tasks
        const ganttTasks = projectTasks.map((task, index) => {
            const startDate = task.startDate ? new Date(task.startDate) : new Date();
            const endDate = task.dueDate ? new Date(task.dueDate) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days default
            const durationDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));

            return {
                id: task.id || ('task_' + index),
                name: task.name || task.title || 'Unnamed Task',
                start: this._formatDate(startDate),
                duration: durationDays,
                progress: task.status === 'Completed' ? 100 : (task.status === 'In Progress' ? 50 : 0),
                dependencies: task.dependencies ? task.dependencies.join(',') : '',
                custom_class: task.status === 'Completed' ? 'task-completed' : (task.status === 'In Progress' ? 'task-in-progress' : 'task-open')
            };
        });

        // If no tasks, create a dummy task
        if (ganttTasks.length === 0) {
            ganttTasks.push({
                id: 'dummy',
                name: 'No tasks created yet',
                start: this._formatDate(new Date()),
                duration: 7,
                progress: 0,
                custom_class: 'task-dummy'
            });
        }

        // Get the chart container ID
        const chartId = 'gantt_' + Date.now();

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <h2 style="color:#111">Project Timeline</h2>
                    <button class="btn-secondary btn-sm" id="refreshGanttBtn">↻ Refresh</button>
                </div>
                <p style="color:#b0c4de;margin:0">Visual project schedule with task progress</p>
            </div>

            <!-- Project Selector -->
            <div style="margin-bottom:16px;padding:12px;background:#f0f0f0;border-radius:6px;display:flex;gap:12px;align-items:center">
                <label style="font-weight:600;color:#111">Project:</label>
                <select id="projectSelector" style="padding:6px 8px;border-radius:4px;border:1px solid #aaa;font-size:0.9em;color:#111;background:#fff">
                    ${AppData.getProjects().map(p => `
                        <option value="${p.id}" ${self._selectedProject === p.id ? 'selected' : ''}>
                            ${Utils.escapeHtml(p.name)}
                        </option>
                    `).join('')}
                </select>
                <div style="flex:1;border-left:2px solid #aaa;padding-left:12px">
                    <strong style="color:#111">${Utils.escapeHtml(selectedProject.name)}</strong>
                    <div style="font-size:0.85em;color:#94a9c4;margin-top:2px">
                        ${projectTasks.length} task${projectTasks.length !== 1 ? 's' : ''}
                        &nbsp;•&nbsp; Status: ${selectedProject.status || 'Active'}
                    </div>
                </div>
            </div>

            <!-- Gantt Chart -->
            <div id="${chartId}" style="border-radius:8px;overflow:hidden;border:2px solid #ccc;margin-bottom:20px;background:#fff"></div>

            <!-- Legend -->
            <div style="padding:16px;background:#f0f0f0;border-radius:6px;border:1px solid #ccc">
                <h3 style="font-size:0.95em;margin-bottom:12px;color:#111;font-weight:700">Legend</h3>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
                    <div style="display:flex;align-items:center;gap:8px;font-size:0.9em;color:#111">
                        <div style="width:24px;height:12px;background:#4285F4;border-radius:2px;flex-shrink:0"></div>
                        <span>Open Task</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:0.9em;color:#111">
                        <div style="width:24px;height:12px;background:#e67e00;border-radius:2px;flex-shrink:0"></div>
                        <span>In Progress (50%)</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:0.9em;color:#111">
                        <div style="width:24px;height:12px;background:#1a8a3a;border-radius:2px;flex-shrink:0"></div>
                        <span>Completed (100%)</span>
                    </div>
                </div>
            </div>

            <!-- Info -->
            <div style="margin-top:16px;padding:12px;background:#d6eaf8;border-radius:6px;border-left:4px solid #1a6fa8;font-size:0.9em;color:#111">
                <strong>💡 Tip:</strong> Tasks are displayed with their duration based on start and due dates.
                Set task dates in Task Assignment to see them here. Progress is based on status (Open / In Progress / Completed).
            </div>

            <style>
                /* ── Frappe-Gantt text overrides ── */
                .gantt-container svg { max-width:100%; }
                .gantt .upper-text,
                .gantt .lower-text { fill:#111 !important; font-weight:600 !important; font-size:12px !important; }
                .gantt text { fill:#111 !important; }
                .gantt .bar-label { fill:#fff !important; font-weight:600 !important; font-size:11px !important; }
                .gantt .bar-label.big { fill:#111 !important; }
                .gantt .grid-header { fill:#e8e8e8 !important; }
                .gantt .grid-row { fill:#fff !important; }
                .gantt .grid-row:nth-child(even) { fill:#f8f8f8 !important; }
                .gantt .row-line { stroke:#ddd !important; }
                .gantt .tick { stroke:#ccc !important; }
                .gantt .today-highlight { fill:#fff3e0 !important; opacity:0.5; }
                /* ── Task bar colors ── */
                .task-open .bar { fill:#4285F4 !important; }
                .task-in-progress .bar { fill:#e67e00 !important; }
                .task-completed .bar { fill:#1a8a3a !important; }
                .task-dummy .bar { fill:#aaa !important; }
                .bar-progress { opacity:0.4; }
            </style>
        `;

        // Initialize Gantt chart
        setTimeout(() => {
            if (window.Gantt) {
                try {
                    new Gantt(`#${chartId}`, ganttTasks, {
                        header_height: 50,
                        column_width: 30,
                        step: 24,
                        view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
                        bar_height: 20,
                        bar_corner_radius: 3,
                        arrow_curve: 5,
                        padding: 18,
                        view_mode: 'Day',
                        date_format: 'YYYY-MM-DD',
                        custom_popup_html: null,
                        tooltip: true
                    });
                } catch(err) {
                    console.error('Gantt chart initialization failed:', err);
                    document.getElementById(chartId).innerHTML = `
                        <div style="padding:32px;text-align:center;color:#c0392b;font-weight:600">
                            <p>Failed to render Gantt chart: ${err.message}</p>
                        </div>
                    `;
                }
            } else {
                document.getElementById(chartId).innerHTML = `
                    <div style="padding:32px;text-align:center;color:#f1f5f9;font-weight:600">
                        <p>Gantt chart library not loaded. Please refresh the page.</p>
                    </div>
                `;
            }
        }, 100);

        // Event handlers
        document.getElementById('projectSelector').onchange = (e) => {
            self.render(self._container, { projectId: e.target.value });
        };

        document.getElementById('refreshGanttBtn').onclick = async () => {
            try {
                const btn = document.getElementById('refreshGanttBtn');
                btn.disabled = true;
                btn.textContent = '↻ Refreshing…';
                await AppData.syncFromServer();
                self.render(self._container);
            } catch(err) {
                console.error('Refresh failed:', err);
                Utils.showToast('Failed to refresh chart', 'error');
            }
        };
    },

    _formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};
