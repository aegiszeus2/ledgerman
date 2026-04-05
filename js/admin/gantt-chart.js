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
                <div style="padding:32px;text-align:center;color:#333">
                    <h2 style="color:#111">No projects to visualize</h2>
                    <p>Create projects first to view them on the Gantt chart.</p>
                </div>
            `;
            return;
        }

        if (!self._selectedProject && projects.length > 0) {
            self._selectedProject = projects[0].id;
        }

        const selectedProjectId = params && params.projectId ? params.projectId : self._selectedProject;
        const selectedProject = AppData.getProject(selectedProjectId);

        if (!selectedProject) {
            container.innerHTML = `<div style="padding:32px;text-align:center;color:#333;font-weight:600">Project not found</div>`;
            return;
        }

        self._selectedProject = selectedProjectId;
        self._renderChart(container, projects, selectedProject);
    },

    _renderChart(container, projects, selectedProject) {
        const self = this;
        const tasks = AppData.getTasks ? AppData.getTasks() : [];
        const workers = AppData.getWorkers ? AppData.getWorkers() : [];
        const projectTasks = tasks.filter(t => t.projectId === selectedProject.id);

        // Build Gantt data — fix: use due_date OR dueDate
        const ganttTasks = projectTasks.map((task, index) => {
            const startDate = task.startDate ? new Date(task.startDate) : new Date();
            const rawEnd = task.due_date || task.dueDate || null;
            const endDate = rawEnd ? new Date(rawEnd) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            const durationDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
            const statusNorm = (task.status || '').toLowerCase();
            const progress = (statusNorm === 'done' || statusNorm === 'completed') ? 100
                           : (statusNorm === 'in progress' || statusNorm === 'active') ? 50 : 0;
            const customClass = progress === 100 ? 'task-completed'
                              : progress === 50  ? 'task-in-progress' : 'task-open';
            return {
                id: task.id || ('task_' + index),
                name: task.name || task.title || 'Unnamed Task',
                start: self._formatDate(startDate),
                duration: durationDays,
                progress: progress,
                dependencies: task.dependencies ? task.dependencies.join(',') : '',
                custom_class: customClass,
                // keep raw refs for export
                _raw: task
            };
        });

        const hasTasks = ganttTasks.length > 0;
        if (!hasTasks) {
            ganttTasks.push({
                id: 'dummy',
                name: 'No tasks created yet',
                start: self._formatDate(new Date()),
                duration: 7,
                progress: 0,
                custom_class: 'task-dummy',
                _raw: null
            });
        }

        const chartId = 'gantt_' + Date.now();
        const esc = Utils.escapeHtml;

        container.innerHTML = `
            <div style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
                    <h2 style="color:#111">Project Timeline</h2>
                    <div style="display:flex;gap:8px">
                        <button class="btn-secondary btn-sm" id="ganttExportCsvBtn">Export CSV</button>
                        <button class="btn-secondary btn-sm" id="ganttExportPdfBtn">Export PDF</button>
                        <button class="btn-secondary btn-sm" id="refreshGanttBtn">↻ Refresh</button>
                    </div>
                </div>
                <p style="color:#333;margin:0">Visual project schedule with task progress</p>
            </div>

            <!-- Project Selector -->
            <div style="margin-bottom:16px;padding:12px;background:#f0f0f0;border-radius:6px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
                <label style="font-weight:600;color:#111">Project:</label>
                <select id="projectSelector" style="padding:6px 8px;border-radius:4px;border:1px solid #aaa;font-size:0.9em;color:#111;background:#fff">
                    ${AppData.getProjects().map(p => `
                        <option value="${p.id}" ${self._selectedProject === p.id ? 'selected' : ''}>
                            ${esc(p.name)}
                        </option>
                    `).join('')}
                </select>
                <div style="flex:1;min-width:160px;border-left:2px solid #aaa;padding-left:12px">
                    <strong style="color:#111">${esc(selectedProject.name)}</strong>
                    <div style="font-size:0.85em;color:#555;margin-top:2px">
                        ${projectTasks.length} task${projectTasks.length !== 1 ? 's' : ''}
                        &nbsp;•&nbsp; Status: ${selectedProject.status || 'Active'}
                        ${selectedProject.startDate ? '&nbsp;•&nbsp; Start: ' + Utils.formatDate(selectedProject.startDate) : ''}
                        ${selectedProject.endDate   ? '&nbsp;•&nbsp; End: '   + Utils.formatDate(selectedProject.endDate)   : ''}
                    </div>
                </div>
            </div>

            <!-- Gantt Chart -->
            <div id="${chartId}" style="border-radius:8px;overflow:hidden;border:2px solid #ccc;margin-bottom:20px;background:#fff"></div>

            <!-- Task List Table -->
            <div class="card" style="margin-bottom:20px;overflow-x:auto">
                <h3 style="font-size:.95em;font-weight:700;color:#111;margin-bottom:12px;padding:16px 16px 0">Task Schedule</h3>
                ${hasTasks ? `
                <table style="width:100%;font-size:.88rem;border-collapse:collapse">
                    <thead>
                        <tr style="background:#f5f5f5">
                            <th style="padding:10px 16px;text-align:left;border-bottom:2px solid #ddd">#</th>
                            <th style="padding:10px 16px;text-align:left;border-bottom:2px solid #ddd">Task</th>
                            <th style="padding:10px 16px;text-align:left;border-bottom:2px solid #ddd">Work Item</th>
                            <th style="padding:10px 16px;text-align:left;border-bottom:2px solid #ddd">Assigned To</th>
                            <th style="padding:10px 16px;text-align:left;border-bottom:2px solid #ddd">Start</th>
                            <th style="padding:10px 16px;text-align:left;border-bottom:2px solid #ddd">Due</th>
                            <th style="padding:10px 16px;text-align:right;border-bottom:2px solid #ddd">Duration</th>
                            <th style="padding:10px 16px;text-align:center;border-bottom:2px solid #ddd">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${projectTasks.map((t, i) => {
                            const worker = workers.find(w => w.id === (t.assigned_to || t.assigned_to_worker_id));
                            const wi = (t.workItemId && AppData.getSubtask) ? AppData.getSubtask(t.workItemId) : null;
                            const rawEnd = t.due_date || t.dueDate || null;
                            const start = t.startDate ? new Date(t.startDate) : null;
                            const end   = rawEnd ? new Date(rawEnd) : null;
                            const dur   = (start && end) ? Math.max(1, Math.ceil((end - start) / 86400000)) : '—';
                            const statusNorm = (t.status || 'To Do');
                            const statusColor = statusNorm === 'Done' || statusNorm === 'Completed' ? '#1a8a3a'
                                             : statusNorm === 'In Progress' || statusNorm === 'Active' ? '#e67e00' : '#4285F4';
                            const isOverdue = end && end < new Date() && statusNorm !== 'Done' && statusNorm !== 'Completed';
                            return `<tr style="border-bottom:1px solid #eee">
                                <td style="padding:8px 16px;color:#999">${i + 1}</td>
                                <td style="padding:8px 16px"><strong>${esc(t.name || t.title || 'Untitled')}</strong>
                                    ${t.description ? '<div style="font-size:.78rem;color:#777">' + esc(t.description) + '</div>' : ''}
                                </td>
                                <td style="padding:8px 16px;font-size:.82rem;color:#555">${wi ? esc(wi.name) : '—'}</td>
                                <td style="padding:8px 16px">${worker ? esc(worker.name) : '—'}</td>
                                <td style="padding:8px 16px;white-space:nowrap">${t.startDate ? Utils.formatDate(t.startDate) : '—'}</td>
                                <td style="padding:8px 16px;white-space:nowrap;${isOverdue ? 'color:#c0392b;font-weight:600' : ''}">${rawEnd ? Utils.formatDate(rawEnd) : '—'}${isOverdue ? ' ⚠' : ''}</td>
                                <td style="padding:8px 16px;text-align:right">${dur !== '—' ? dur + 'd' : '—'}</td>
                                <td style="padding:8px 16px;text-align:center">
                                    <span style="padding:3px 8px;border-radius:12px;font-size:.78rem;font-weight:600;background:${statusColor}18;color:${statusColor}">${esc(statusNorm)}</span>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>` : '<div style="padding:16px;color:#999">No tasks for this project yet.</div>'}
            </div>

            <!-- Legend -->
            <div style="padding:14px 16px;background:#f8f8f8;border-radius:6px;border:1px solid #e0e0e0;display:flex;gap:20px;flex-wrap:wrap">
                <div style="display:flex;align-items:center;gap:8px;font-size:.88em;color:#111">
                    <div style="width:22px;height:10px;background:#4285F4;border-radius:2px"></div><span>Open</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;font-size:.88em;color:#111">
                    <div style="width:22px;height:10px;background:#e67e00;border-radius:2px"></div><span>In Progress</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;font-size:.88em;color:#111">
                    <div style="width:22px;height:10px;background:#1a8a3a;border-radius:2px"></div><span>Completed</span>
                </div>
                <div style="margin-left:auto;font-size:.82em;color:#777">
                    💡 Set start &amp; due dates in Task Assignment for accurate bars
                </div>
            </div>

            <style>
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
                .task-open .bar { fill:#4285F4 !important; }
                .task-in-progress .bar { fill:#e67e00 !important; }
                .task-completed .bar { fill:#1a8a3a !important; }
                .task-dummy .bar { fill:#aaa !important; }
                .bar-progress { opacity:0.4; }
            </style>
        `;

        // ── Gantt init ──────────────────────────────────────────────────────────
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
                        view_mode: 'Week',
                        date_format: 'YYYY-MM-DD',
                        custom_popup_html: null,
                        tooltip: true
                    });
                } catch(err) {
                    console.error('Gantt chart initialization failed:', err);
                    document.getElementById(chartId).innerHTML =
                        `<div style="padding:32px;text-align:center;color:#c0392b;font-weight:600">Failed to render Gantt chart: ${err.message}</div>`;
                }
            } else {
                document.getElementById(chartId).innerHTML =
                    `<div style="padding:32px;text-align:center;color:#333;font-weight:600">Gantt chart library not loaded. Please refresh.</div>`;
            }
        }, 100);

        // ── Project selector ────────────────────────────────────────────────────
        document.getElementById('projectSelector').onchange = (e) => {
            self.render(self._container, { projectId: e.target.value });
        };

        // ── Refresh ─────────────────────────────────────────────────────────────
        document.getElementById('refreshGanttBtn').onclick = async () => {
            const btn = document.getElementById('refreshGanttBtn');
            try {
                btn.disabled = true; btn.textContent = '↻ Refreshing…';
                await AppData.syncFromServer();
                self.render(self._container);
            } catch(err) {
                console.error('Refresh failed:', err);
                Utils.showToast('Failed to refresh chart', 'error');
                btn.disabled = false; btn.textContent = '↻ Refresh';
            }
        };

        // ── CSV Export ──────────────────────────────────────────────────────────
        document.getElementById('ganttExportCsvBtn').onclick = () => {
            function csvEsc(v) {
                if (v === null || v === undefined) return '';
                var s = String(v);
                return (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
                    ? '"' + s.replace(/"/g, '""') + '"' : s;
            }
            const rows = [['#','Task','Work Item','Assigned To','Start Date','Due Date','Duration (days)','Status','% Complete'].map(csvEsc).join(',')];
            projectTasks.forEach((t, i) => {
                const worker = workers.find(w => w.id === (t.assigned_to || t.assigned_to_worker_id));
                const wi = (t.workItemId && AppData.getSubtask) ? AppData.getSubtask(t.workItemId) : null;
                const rawEnd = t.due_date || t.dueDate || null;
                const start = t.startDate ? new Date(t.startDate) : null;
                const end   = rawEnd ? new Date(rawEnd) : null;
                const dur   = (start && end) ? Math.max(1, Math.ceil((end - start) / 86400000)) : '';
                const statusNorm = t.status || 'To Do';
                const pct = (statusNorm === 'Done' || statusNorm === 'Completed') ? 100
                          : (statusNorm === 'In Progress' || statusNorm === 'Active') ? 50 : 0;
                rows.push([
                    i + 1,
                    t.name || t.title || '',
                    wi ? wi.name : '',
                    worker ? worker.name : '',
                    t.startDate || '',
                    rawEnd || '',
                    dur,
                    statusNorm,
                    pct + '%'
                ].map(csvEsc).join(','));
            });
            const today = new Date().toISOString().slice(0, 10);
            const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ledgerman-timeline-' + selectedProject.name.replace(/[^a-z0-9]/gi, '_') + '-' + today + '.csv';
            document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
            Utils.showToast('CSV downloaded');
        };

        // ── PDF Export ──────────────────────────────────────────────────────────
        document.getElementById('ganttExportPdfBtn').onclick = () => {
            const btn = document.getElementById('ganttExportPdfBtn');
            btn.disabled = true; btn.textContent = 'Building PDF…';

            // Capture SVG from DOM (must wait for Gantt to render)
            setTimeout(() => {
                const chartEl = document.getElementById(chartId);
                const svgEl = chartEl ? chartEl.querySelector('svg') : null;
                const svgString = svgEl ? new XMLSerializer().serializeToString(svgEl) : '';

                const settings = AppData.getSettings ? AppData.getSettings() : {};
                const companyName = settings.companyName || 'My Company';
                const companyAddr = [settings.address, settings.city, settings.province].filter(Boolean).join(', ');
                const companyPhone = settings.phone || '';
                const companyEmail = settings.email || '';
                const today = new Date().toLocaleDateString('en-CA');

                const printHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Project Timeline — ${esc(selectedProject.name)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Segoe UI",Arial,sans-serif;font-size:12px;color:#111;background:#fff;line-height:1.5}
.doc-header{background:#111;color:#fff;padding:14px 32px;display:flex;justify-content:space-between;align-items:center}
.co-name{font-size:18px;font-weight:700;letter-spacing:1px}
.co-tag{font-size:10px;color:#c9a84c;letter-spacing:2px;text-transform:uppercase;margin-top:3px}
.doc-label{text-align:right}
.doc-label h2{font-size:12px;font-weight:600;color:#c9a84c;text-transform:uppercase;letter-spacing:1px}
.doc-label p{font-size:10px;color:#aaa;margin-top:3px}
.gold-banner{background:#c9a84c;color:#111;text-align:center;padding:9px 32px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
.body{padding:20px 32px}
.meta{background:#f4f4f8;border-left:4px solid #c9a84c;padding:10px 14px;margin-bottom:20px;display:flex;gap:24px;flex-wrap:wrap}
.meta-item{font-size:11px;color:#555}
.meta-item strong{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#c9a84c;margin-bottom:2px}
.section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#c9a84c;border-bottom:1px solid #ddd;padding-bottom:6px;margin:20px 0 12px}
.gantt-wrap{overflow:hidden;border:1px solid #ddd;border-radius:4px;margin-bottom:8px;background:#fff}
.gantt-wrap svg{max-width:100%;height:auto}
/* Gantt bar colors inline */
.task-open .bar{fill:#4285F4}
.task-in-progress .bar{fill:#e67e00}
.task-completed .bar{fill:#1a8a3a}
.bar-progress{opacity:0.35}
text{fill:#111 !important;font-family:"Segoe UI",Arial,sans-serif}
.upper-text,.lower-text{font-weight:600;font-size:12px}
.bar-label{fill:#fff !important;font-weight:600;font-size:10px}
.bar-label.big{fill:#111 !important}
.grid-header{fill:#e8e8e8}
.grid-row{fill:#fff}
.grid-row:nth-child(even){fill:#f8f8f8}
.row-line{stroke:#ddd}
.tick{stroke:#ccc}
table{width:100%;border-collapse:collapse;font-size:11px}
thead tr{background:#f5f5f5}
th{padding:7px 10px;text-align:left;border-bottom:2px solid #ddd;font-weight:600;color:#333}
th.r{text-align:right} th.c{text-align:center}
td{padding:7px 10px;border-bottom:1px solid #eee;color:#111}
td.r{text-align:right} td.c{text-align:center}
.badge{padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600}
.b-open{background:#4285F418;color:#4285F4}
.b-progress{background:#e67e0018;color:#e67e00}
.b-done{background:#1a8a3a18;color:#1a8a3a}
.legend{display:flex;gap:16px;margin-top:10px}
.leg-item{display:flex;align-items:center;gap:6px;font-size:10px;color:#555}
.leg-swatch{width:18px;height:8px;border-radius:2px}
.doc-footer{background:#111;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:14px 32px;margin-top:24px}
.footer-left{font-size:11px;color:#aaa;line-height:1.8}
.footer-left strong{color:#c9a84c;font-size:12px;display:block;margin-bottom:2px}
.footer-right{font-size:10px;color:#666;text-align:right}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="doc-header">
  <div><div class="co-name">${esc(companyName)}</div><div class="co-tag">Powered by Ledgerman</div></div>
  <div class="doc-label"><h2>Project Timeline</h2><p>${esc(selectedProject.name)}</p><p>Generated ${today}</p></div>
</div>
<div class="gold-banner">${esc(selectedProject.name)}${selectedProject.clientName ? ' &nbsp;—&nbsp; ' + esc(selectedProject.clientName) : ''}</div>
<div class="body">
  <div class="meta">
    <div class="meta-item"><strong>Project</strong>${esc(selectedProject.name)}</div>
    ${selectedProject.clientName ? '<div class="meta-item"><strong>Client</strong>' + esc(selectedProject.clientName) + '</div>' : ''}
    ${selectedProject.jobSiteAddress ? '<div class="meta-item"><strong>Site</strong>' + esc(selectedProject.jobSiteAddress) + '</div>' : ''}
    ${selectedProject.startDate ? '<div class="meta-item"><strong>Start</strong>' + Utils.formatDate(selectedProject.startDate) + '</div>' : ''}
    ${selectedProject.endDate   ? '<div class="meta-item"><strong>End</strong>'   + Utils.formatDate(selectedProject.endDate)   + '</div>' : ''}
    <div class="meta-item"><strong>Status</strong>${esc(selectedProject.status || 'Active')}</div>
    <div class="meta-item"><strong>Tasks</strong>${projectTasks.length}</div>
    <div class="meta-item"><strong>Report Date</strong>${today}</div>
  </div>

  <div class="section-title">Gantt Chart</div>
  ${svgString ? '<div class="gantt-wrap">' + svgString + '</div>' : '<p style="color:#999;font-style:italic">Gantt chart not available — ensure tasks have dates set.</p>'}
  <div class="legend">
    <div class="leg-item"><div class="leg-swatch" style="background:#4285F4"></div>Open</div>
    <div class="leg-item"><div class="leg-swatch" style="background:#e67e00"></div>In Progress</div>
    <div class="leg-item"><div class="leg-swatch" style="background:#1a8a3a"></div>Completed</div>
  </div>

  <div class="section-title">Task Schedule</div>
  <table>
    <thead><tr>
      <th>#</th><th>Task</th><th>Work Item</th><th>Assigned To</th>
      <th>Start</th><th>Due</th><th class="r">Duration</th><th class="c">Status</th>
    </tr></thead>
    <tbody>
      ${projectTasks.map((t, i) => {
          const worker = workers.find(w => w.id === (t.assigned_to || t.assigned_to_worker_id));
          const wi = (t.workItemId && AppData.getSubtask) ? AppData.getSubtask(t.workItemId) : null;
          const rawEnd = t.due_date || t.dueDate || null;
          const start  = t.startDate ? new Date(t.startDate) : null;
          const end    = rawEnd ? new Date(rawEnd) : null;
          const dur    = (start && end) ? Math.max(1, Math.ceil((end - start) / 86400000)) + 'd' : '—';
          const sn     = t.status || 'To Do';
          const bdgCls = (sn === 'Done' || sn === 'Completed') ? 'b-done'
                       : (sn === 'In Progress' || sn === 'Active') ? 'b-progress' : 'b-open';
          const isOverdue = end && end < new Date() && sn !== 'Done' && sn !== 'Completed';
          return `<tr>
            <td style="color:#aaa">${i + 1}</td>
            <td><strong>${esc(t.name || t.title || '')}</strong></td>
            <td style="color:#777">${wi ? esc(wi.name) : '—'}</td>
            <td>${worker ? esc(worker.name) : '—'}</td>
            <td style="white-space:nowrap">${t.startDate ? Utils.formatDate(t.startDate) : '—'}</td>
            <td style="white-space:nowrap${isOverdue ? ';color:#c0392b;font-weight:600' : ''}">${rawEnd ? Utils.formatDate(rawEnd) : '—'}${isOverdue ? ' ⚠' : ''}</td>
            <td class="r">${dur}</td>
            <td class="c"><span class="badge ${bdgCls}">${esc(sn)}</span></td>
          </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>
<div class="doc-footer">
  <div class="footer-left">
    <strong>${esc(companyName)}</strong>
    ${companyAddr ? esc(companyAddr) + '<br>' : ''}
    ${companyPhone ? esc(companyPhone) + '&nbsp;&nbsp;' : ''}${companyEmail ? esc(companyEmail) : ''}
  </div>
  <div class="footer-right">Confidential &mdash; For internal use only</div>
</div>
</body></html>`;

                const win = window.open('', '_blank');
                win.document.write(printHtml);
                win.document.close();
                win.onload = () => win.print();

                btn.disabled = false; btn.textContent = 'Export PDF';
            }, 300); // wait for SVG to be in DOM
        };
    },

    _formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};
