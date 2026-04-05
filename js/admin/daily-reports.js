// Admin Daily Reports Module — Tier 3
// Shows daily crew reports submitted by workers (site summaries, crew info, expenses, issues)
window.AdminDailyReports = {
    _filterStatus: 'All',
    _filterProject: 'All',
    _sortBy: 'date',
    _selectedReportId: null,

    render(container, params) {
        const self = this;
        self._container = container;

        if (params && params.reportId) {
            self._renderDetail(params.reportId);
        } else {
            self._renderList();
        }
    },

    _renderList() {
        const self = this;
        const container = self._container;

        // Get all daily reports (stored as entities)
        const allReports = AppData.getAll ? AppData.getAll('daily_reports') : [];
        const reports = allReports.length > 0 ? allReports : [];

        // Get projects for filter dropdown
        const projects = AppData.getProjects();
        const statuses = ['All', 'Submitted', 'Reviewed', 'Approved'];

        // Filter reports
        const filtered = reports.filter(r => {
            let statusMatch = self._filterStatus === 'All' || r.status === self._filterStatus;
            let projectMatch = self._filterProject === 'All' || r.projectId === self._filterProject;
            return statusMatch && projectMatch;
        });

        // Sort reports
        const sorted = filtered.sort((a, b) => {
            if (self._sortBy === 'date') {
                return new Date(b.date || b.created_at) - new Date(a.date || a.created_at);
            } else if (self._sortBy === 'project') {
                return (a.projectName || '').localeCompare(b.projectName || '');
            }
            return 0;
        });

        const todayCount = reports.filter(r => {
            const rDate = new Date(r.date || r.created_at).toDateString();
            const today = new Date().toDateString();
            return rDate === today;
        }).length;

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <h2>Daily Crew Reports</h2>
                    <button class="btn-secondary btn-sm" id="refreshReportsBtn">↻ Refresh</button>
                </div>
                <p style="color:#666;margin:0">Site summaries submitted by workers (crew count, hours, expenses, issues, photos)</p>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:12px;background:#fff;border-radius:8px;border:1px solid #e0e0e0">
                    <div style="color:#999;font-size:0.8em;text-transform:uppercase;margin-bottom:4px">Today's Reports</div>
                    <div style="font-size:1.8em;font-weight:bold;color:#3498db">${todayCount}</div>
                </div>
                <div style="padding:12px;background:#fff;border-radius:8px;border:1px solid #e0e0e0">
                    <div style="color:#999;font-size:0.8em;text-transform:uppercase;margin-bottom:4px">Total Reports</div>
                    <div style="font-size:1.8em;font-weight:bold;color:#333">${reports.length}</div>
                </div>
                <div style="padding:12px;background:#fff;border-radius:8px;border:1px solid #e0e0e0">
                    <div style="color:#999;font-size:0.8em;text-transform:uppercase;margin-bottom:4px">Pending Review</div>
                    <div style="font-size:1.8em;font-weight:bold;color:#f39c12">${reports.filter(r => r.status !== 'Approved').length}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
                <div>
                    <label style="font-size:0.85em;color:#666;display:block;margin-bottom:4px">Status:</label>
                    <select id="statusFilter" style="padding:6px 8px;border-radius:4px;border:1px solid #ddd;font-size:0.9em">
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:0.85em;color:#666;display:block;margin-bottom:4px">Project:</label>
                    <select id="projectFilter" style="padding:6px 8px;border-radius:4px;border:1px solid #ddd;font-size:0.9em">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:0.85em;color:#666;display:block;margin-bottom:4px">Sort:</label>
                    <select id="sortBySelect" style="padding:6px 8px;border-radius:4px;border:1px solid #ddd;font-size:0.9em">
                        <option value="date" ${self._sortBy === 'date' ? 'selected' : ''}>Date (Newest)</option>
                        <option value="project" ${self._sortBy === 'project' ? 'selected' : ''}>Project Name</option>
                    </select>
                </div>
            </div>

            <!-- Reports List -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid #e0e0e0">
                <table class="table" style="width:100%;margin:0;border-collapse:collapse">
                    <thead style="background:#f5f5f5">
                        <tr>
                            <th style="padding:12px;text-align:left;border-bottom:2px solid #e0e0e0">Date</th>
                            <th style="padding:12px;text-align:left;border-bottom:2px solid #e0e0e0">Project</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #e0e0e0">Crew</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #e0e0e0">Hours</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #e0e0e0">Issues</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #e0e0e0">Status</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #e0e0e0">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.length > 0 ? sorted.map(r => {
                            const reportDate = new Date(r.date || r.created_at);
                            const dateStr = reportDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
                            const timeStr = reportDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                            const statusColor = r.status === 'Approved' ? '#2ecc71' : (r.status === 'Reviewed' ? '#3498db' : '#f39c12');
                            const hasIssues = r.issues || r.plan ? '⚠️' : '✓';

                            return `
                                <tr style="border-bottom:1px solid #e0e0e0">
                                    <td style="padding:12px;font-size:0.9em">
                                        <div style="font-weight:500">${dateStr}</div>
                                        <div style="color:#999;font-size:0.85em">${timeStr}</div>
                                    </td>
                                    <td style="padding:12px">
                                        ${Utils.escapeHtml(r.projectName || 'N/A')}
                                    </td>
                                    <td style="padding:12px;text-align:center">
                                        ${r.crewCount || 0}
                                    </td>
                                    <td style="padding:12px;text-align:center">
                                        ${r.totalHours || 0}h
                                    </td>
                                    <td style="padding:12px;text-align:center">
                                        <span style="cursor:help;title='${r.issues ? 'Issues reported' : 'No issues'}'">
                                            ${hasIssues}
                                        </span>
                                    </td>
                                    <td style="padding:12px;text-align:center">
                                        <span style="padding:4px 8px;border-radius:4px;font-size:0.8em;background:${statusColor};color:white">
                                            ${r.status || 'Submitted'}
                                        </span>
                                    </td>
                                    <td style="padding:12px;text-align:center">
                                        <button class="btn-secondary btn-sm" data-report-id="${r.id}" style="font-size:0.8em">Review</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="7" style="padding:32px;text-align:center;color:#999">
                                    No daily reports yet. Workers can submit reports from the worker portal or daily-report.html.
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>

            <!-- Info -->
            <div style="margin-top:20px;padding:12px;background:#e8f4f8;border-radius:6px;border-left:4px solid #3498db;font-size:0.9em">
                <strong>💡 Tip:</strong> Workers submit daily reports from the worker portal or dedicated report form.
                Reviews can include photos, issue tracking, and crew information.
            </div>
        `;

        // Event handlers
        document.getElementById('statusFilter').onchange = (e) => {
            self._filterStatus = e.target.value;
            self._renderList();
        };

        document.getElementById('projectFilter').onchange = (e) => {
            self._filterProject = e.target.value;
            self._renderList();
        };

        document.getElementById('sortBySelect').onchange = (e) => {
            self._sortBy = e.target.value;
            self._renderList();
        };

        document.getElementById('refreshReportsBtn').onclick = async () => {
            try {
                const btn = document.getElementById('refreshReportsBtn');
                btn.disabled = true;
                btn.textContent = '↻ Refreshing…';
                await AppData.syncFromServer();
                self._renderList();
            } catch(err) {
                console.error('Refresh failed:', err);
                Utils.showToast('Failed to refresh reports', 'error');
            }
        };

        // Review buttons
        document.querySelectorAll('[data-report-id]').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                self.render(container, { reportId: btn.dataset.reportId });
            };
        });
    },

    _renderDetail(reportId) {
        const self = this;
        const container = self._container;

        // Find the report
        const allReports = AppData.getAll ? AppData.getAll('daily_reports') : [];
        const report = allReports.find(r => r.id === reportId);

        if (!report) {
            container.innerHTML = '<div class="empty-state"><h2>Report not found</h2></div>';
            return;
        }

        const project = AppData.getProject(report.projectId);
        const reportDate = new Date(report.date || report.created_at);
        const dateStr = reportDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

        container.innerHTML = `
            <div style="max-width:800px;margin:0 auto">
                <div style="margin-bottom:20px">
                    <button class="btn-secondary btn-sm" id="backBtn" style="margin-bottom:12px">← Back to Reports</button>
                    <h2>${dateStr}</h2>
                    <p style="color:#666;margin:4px 0 0">${Utils.escapeHtml(project ? project.name : report.projectName || 'Unknown Project')}</p>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px">
                    <div style="padding:12px;background:#f9f9f9;border-radius:6px">
                        <div style="font-size:0.8em;color:#999;text-transform:uppercase">Crew Count</div>
                        <div style="font-size:1.8em;font-weight:bold">${report.crewCount || 0}</div>
                    </div>
                    <div style="padding:12px;background:#f9f9f9;border-radius:6px">
                        <div style="font-size:0.8em;color:#999;text-transform:uppercase">Total Hours</div>
                        <div style="font-size:1.8em;font-weight:bold">${report.totalHours || 0}h</div>
                    </div>
                    <div style="padding:12px;background:#f9f9f9;border-radius:6px">
                        <div style="font-size:0.8em;color:#999;text-transform:uppercase">Equipment Expense</div>
                        <div style="font-size:1.8em;font-weight:bold">$${(report.equipmentExpense || 0).toFixed(2)}</div>
                    </div>
                </div>

                ${report.weather ? `
                    <div style="padding:12px;background:#e3f2fd;border-radius:6px;margin-bottom:16px">
                        <strong style="font-size:0.9em">Weather:</strong> ${Utils.escapeHtml(report.weather)}
                    </div>
                ` : ''}

                ${report.issues ? `
                    <div style="padding:12px;background:#fff3cd;border-radius:6px;margin-bottom:16px;border-left:4px solid #ffc107">
                        <strong style="font-size:0.9em;color:#856404">⚠️ Issues:</strong>
                        <p style="margin:6px 0 0;color:#856404">${Utils.escapeHtml(report.issues)}</p>
                    </div>
                ` : ''}

                ${report.plan ? `
                    <div style="padding:12px;background:#e8f5e9;border-radius:6px;margin-bottom:16px;border-left:4px solid #4caf50">
                        <strong style="font-size:0.9em;color:#2e7d32">📋 Tomorrow's Plan:</strong>
                        <p style="margin:6px 0 0;color:#2e7d32">${Utils.escapeHtml(report.plan)}</p>
                    </div>
                ` : ''}

                ${report.notes ? `
                    <div style="padding:12px;background:#f5f5f5;border-radius:6px;margin-bottom:16px">
                        <strong style="font-size:0.9em">Notes:</strong>
                        <p style="margin:6px 0 0;color:#666">${Utils.escapeHtml(report.notes)}</p>
                    </div>
                ` : ''}

                <div style="padding:12px;background:#f9f9f9;border-radius:6px;margin-bottom:20px;font-size:0.9em">
                    <div style="color:#999;margin-bottom:8px"><strong>Status:</strong></div>
                    <div style="display:flex;gap:8px">
                        <button class="btn-primary ${report.status === 'Reviewed' ? 'btn-success' : ''}" data-action="mark-reviewed" style="font-size:0.85em">
                            ✓ Mark Reviewed
                        </button>
                        <button class="btn-secondary ${report.status === 'Approved' ? 'btn-success' : ''}" data-action="mark-approved" style="font-size:0.85em">
                            ✓ Mark Approved
                        </button>
                    </div>
                </div>

                <div style="padding:12px;background:#f0f0f0;border-radius:6px;font-size:0.85em;color:#666">
                    <strong>Submitted:</strong> ${reportDate.toLocaleString()}
                </div>
            </div>
        `;

        // Event handlers
        document.getElementById('backBtn').onclick = () => {
            self._renderList();
        };

        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.onclick = async (e) => {
                e.preventDefault();
                const action = btn.dataset.action;
                const newStatus = action === 'mark-reviewed' ? 'Reviewed' : 'Approved';

                try {
                    // Update report status
                    const updated = Object.assign({}, report, { status: newStatus });
                    AppData.save('daily_reports', updated);
                    Utils.showToast(`Report marked as ${newStatus}`, 'success');
                    self._renderDetail(reportId);
                } catch(err) {
                    console.error('Update failed:', err);
                    Utils.showToast('Failed to update report', 'error');
                }
            };
        });
    }
};
