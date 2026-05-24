// Admin Certified Payroll — Prevailing Wage Reporting
// Generate, review, certify, and export payroll reports per work week
window.AdminCertifiedPayroll = {
    _filterProject: 'All',
    _filterStatus: 'All',
    _filterWeekEnd: '',
    _view: 'list',   // 'list' | 'report'
    _editingId: null,

    render(container) {
        const self = this;
        self._container = container;
        if (self._view === 'report') {
            self._renderReportView(self._editingId);
        } else {
            self._renderList();
        }
    },

    _renderList() {
        const self = this;
        const container = self._container;

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allItems = AppData.getAll ? AppData.getAll('certified_payroll_reports') : [];
        const items = Array.isArray(allItems) ? allItems : [];

        const statuses = ['Draft', 'Reviewed', 'Certified', 'Submitted'];

        const filtered = items.filter(item => {
            const projMatch = self._filterProject === 'All' || item.projectId === self._filterProject;
            const statMatch = self._filterStatus === 'All' || item.status === self._filterStatus;
            const weekMatch = !self._filterWeekEnd || item.workWeekEnd === self._filterWeekEnd;
            return projMatch && statMatch && weekMatch;
        }).sort((a, b) => (b.workWeekEnd || '').localeCompare(a.workWeekEnd || ''));

        const totalReports   = items.length;
        const submittedCount = items.filter(i => i.status === 'Submitted').length;
        const draftCount     = items.filter(i => i.status === 'Draft' || i.status === 'Reviewed').length;

        function statusBadge(status) {
            const colors = { Draft: '#6c757d', Reviewed: '#fd7e14', Certified: '#0d6efd', Submitted: '#198754' };
            const color = colors[status] || '#6c757d';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${color};color:white">${Utils.escapeHtml(status||'Draft')}</span>`;
        }

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h2 style="margin:0">Certified Payroll</h2>
                    <button class="btn-primary" id="newCpReportBtn">+ New Report</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Prevailing wage payroll reporting by work week</p>
            </div>

            <!-- Disclaimer -->
            <div style="padding:12px 16px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;margin-bottom:20px;color:#856404;font-size:.88rem">
                <strong>Notice:</strong> This module provides a payroll reporting template. Verify all entries comply with applicable labour regulations and prevailing wage requirements for your jurisdiction.
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Total Reports</div>
                    <div style="font-size:1.7rem;font-weight:700;color:var(--text-primary)">${totalReports}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid #198754">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Submitted</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#198754">${submittedCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid #6c757d">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Draft/Pending</div>
                    <div style="font-size:1.7rem;font-weight:700;color:var(--text-primary)">${draftCount}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                    <select id="cpProjectFilter" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Status</label>
                    <select id="cpStatusFilter" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All" ${self._filterStatus === 'All' ? 'selected' : ''}>All Statuses</option>
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Week Ending</label>
                    <input type="date" id="cpWeekFilter" value="${self._filterWeekEnd}"
                        style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                </div>
                ${self._filterWeekEnd ? `<div style="align-self:flex-end"><button class="btn-secondary btn-sm" id="cpClearWeekFilter">Clear</button></div>` : ''}
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:11px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.85rem;white-space:nowrap">Week Ending</th>
                            <th style="padding:11px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.85rem">Project</th>
                            <th style="padding:11px 12px;text-align:center;border-bottom:2px solid var(--border);font-size:.85rem">Status</th>
                            <th style="padding:11px 12px;text-align:center;border-bottom:2px solid var(--border);font-size:.85rem;white-space:nowrap"># Workers</th>
                            <th style="padding:11px 12px;text-align:right;border-bottom:2px solid var(--border);font-size:.85rem;white-space:nowrap">Total Hours</th>
                            <th style="padding:11px 12px;text-align:right;border-bottom:2px solid var(--border);font-size:.85rem;white-space:nowrap">Total Gross</th>
                            <th style="padding:11px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.85rem;white-space:nowrap">Reported By</th>
                            <th style="padding:11px 12px;text-align:center;border-bottom:2px solid var(--border);font-size:.85rem">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(item => {
                            const proj = projects.find(p => p.id === item.projectId);
                            const lines = Array.isArray(item.payrollLines) ? item.payrollLines : [];
                            const numWorkers = lines.length;
                            const totalHrs = lines.reduce((s, l) => s + (parseFloat(l.regularHours)||0) + (parseFloat(l.overtimeHours)||0), 0);
                            const totalGross = lines.reduce((s, l) => s + self._calcGross(l), 0);
                            return `
                                <tr style="border-bottom:1px solid var(--border)">
                                    <td style="padding:10px 12px;font-size:.88rem;font-weight:600">${item.workWeekEnd || '—'}</td>
                                    <td style="padding:10px 12px;font-size:.88rem">${Utils.escapeHtml(proj ? proj.name : 'Unknown')}</td>
                                    <td style="padding:10px 12px;text-align:center">${statusBadge(item.status)}</td>
                                    <td style="padding:10px 12px;text-align:center;font-size:.88rem">${numWorkers}</td>
                                    <td style="padding:10px 12px;text-align:right;font-size:.88rem">${totalHrs.toFixed(1)}</td>
                                    <td style="padding:10px 12px;text-align:right;font-size:.88rem;font-weight:600">$${parseFloat(totalGross||0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                                    <td style="padding:10px 12px;font-size:.85rem;color:var(--text2)">${Utils.escapeHtml(item.reportedBy || '—')}</td>
                                    <td style="padding:10px 12px;text-align:center;white-space:nowrap">
                                        <button class="btn-secondary btn-sm" data-id="${item.id}" data-action="view" style="margin-right:4px">View/Edit</button>
                                        <button class="btn-secondary btn-sm" data-id="${item.id}" data-action="delete">Delete</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="8" style="padding:36px;text-align:center;color:var(--text2)">
                                    No certified payroll reports found. Click "+ New Report" to create one.
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('cpProjectFilter').onchange = e => { self._filterProject = e.target.value; self._renderList(); };
        document.getElementById('cpStatusFilter').onchange  = e => { self._filterStatus  = e.target.value; self._renderList(); };
        document.getElementById('cpWeekFilter').onchange    = e => { self._filterWeekEnd = e.target.value; self._renderList(); };
        const clearWeekBtn = document.getElementById('cpClearWeekFilter');
        if (clearWeekBtn) clearWeekBtn.onclick = () => { self._filterWeekEnd = ''; self._renderList(); };

        document.getElementById('newCpReportBtn').onclick = () => {
            self._view = 'report';
            self._editingId = null;
            self._renderReportView(null);
        };

        container.querySelectorAll('[data-action="view"]').forEach(btn => {
            btn.onclick = () => {
                self._view = 'report';
                self._editingId = btn.dataset.id;
                self._renderReportView(btn.dataset.id);
            };
        });

        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this certified payroll report? This cannot be undone.')) {
                    try {
                        AppData.remove('certified_payroll_reports', btn.dataset.id);
                        Utils.showToast('Report deleted', 'success');
                        self._renderList();
                    } catch(err) {
                        console.error('Delete failed:', err);
                        Utils.showToast('Failed to delete', 'error');
                    }
                }
            };
        });
    },

    _calcGross(line) {
        const reg  = parseFloat(line.regularHours)  || 0;
        const ot   = parseFloat(line.overtimeHours)  || 0;
        const rr   = parseFloat(line.regularRate)    || 0;
        const otr  = parseFloat(line.overtimeRate)   || 0;
        const fr   = parseFloat(line.fringeRate)     || 0;
        return (reg * rr) + (ot * otr) + ((reg + ot) * fr);
    },

    _renderReportView(reportId) {
        const self = this;
        const container = self._container;

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allItems = AppData.getAll ? AppData.getAll('certified_payroll_reports') : [];
        const report = reportId ? (Array.isArray(allItems) ? allItems.find(i => i.id === reportId) : null) : null;

        const isNew = !report;
        const id = report ? report.id : ('cp_' + Date.now());
        const fv = (field, def) => report ? (report[field] !== undefined && report[field] !== null ? report[field] : def) : def;

        // Payroll lines stored in module state for editing
        self._lines = report && Array.isArray(report.payrollLines)
            ? report.payrollLines.map(l => Object.assign({}, l))
            : [];

        const statuses = ['Draft', 'Reviewed', 'Certified', 'Submitted'];
        const weekLabel = fv('workWeekEnd', '') || 'New Report';

        container.innerHTML = `
            <div>
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
                    <button class="btn-secondary btn-sm" id="cpBackBtn">← Back to List</button>
                    <h2 style="margin:0">Certified Payroll Report — Week Ending ${Utils.escapeHtml(weekLabel)}</h2>
                </div>

                <!-- Disclaimer -->
                <div style="padding:10px 14px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;margin-bottom:20px;color:#856404;font-size:.85rem">
                    <strong>Notice:</strong> Verify all entries comply with applicable labour regulations and prevailing wage requirements for your jurisdiction.
                </div>

                <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px;margin-bottom:24px">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Project *</label>
                            <select id="cpReportProject" required style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                <option value="">— Select Project —</option>
                                ${projects.map(p => `<option value="${p.id}" ${fv('projectId','') === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Work Week Ending *</label>
                            <input type="date" id="cpWeekEnd" required value="${fv('workWeekEnd','')}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Status</label>
                            <select id="cpReportStatus" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                ${statuses.map(s => `<option value="${s}" ${fv('status','Draft') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Reported By</label>
                            <input type="text" id="cpReportedBy" placeholder="Name of certifying officer" value="${Utils.escapeHtml(fv('reportedBy',''))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div style="grid-column:1/-1">
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Notes</label>
                            <textarea id="cpReportNotes" rows="2"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;resize:vertical">${Utils.escapeHtml(fv('notes',''))}</textarea>
                        </div>
                    </div>
                </div>

                <!-- Payroll Lines -->
                <div style="margin-bottom:24px">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                        <h3 style="margin:0;font-size:1rem">Payroll Lines</h3>
                        <div style="display:flex;gap:8px">
                            <button class="btn-secondary btn-sm" id="cpExportCsvBtn">Export CSV</button>
                            <button class="btn-secondary btn-sm" id="cpAddWorkerBtn">+ Add Worker</button>
                        </div>
                    </div>
                    <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                        <table id="cpLinesTable" style="width:100%;border-collapse:collapse;min-width:900px">
                            <thead>
                                <tr style="background:var(--card)">
                                    <th style="padding:10px 8px;text-align:left;border-bottom:2px solid var(--border);font-size:.8rem;white-space:nowrap">Worker Name</th>
                                    <th style="padding:10px 8px;text-align:left;border-bottom:2px solid var(--border);font-size:.8rem">Classification</th>
                                    <th style="padding:10px 8px;text-align:center;border-bottom:2px solid var(--border);font-size:.8rem;white-space:nowrap">Reg Hrs</th>
                                    <th style="padding:10px 8px;text-align:center;border-bottom:2px solid var(--border);font-size:.8rem;white-space:nowrap">OT Hrs</th>
                                    <th style="padding:10px 8px;text-align:right;border-bottom:2px solid var(--border);font-size:.8rem;white-space:nowrap">Reg Rate $</th>
                                    <th style="padding:10px 8px;text-align:right;border-bottom:2px solid var(--border);font-size:.8rem;white-space:nowrap">OT Rate $</th>
                                    <th style="padding:10px 8px;text-align:right;border-bottom:2px solid var(--border);font-size:.8rem;white-space:nowrap">Fringe $</th>
                                    <th style="padding:10px 8px;text-align:right;border-bottom:2px solid var(--border);font-size:.8rem;white-space:nowrap">Total Gross $</th>
                                    <th style="padding:10px 8px;text-align:center;border-bottom:2px solid var(--border);font-size:.8rem"></th>
                                </tr>
                            </thead>
                            <tbody id="cpLinesBody">
                            </tbody>
                            <tfoot id="cpLinesFoot" style="background:var(--card)">
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px">
                    <button type="button" id="cpCancelBtn" class="btn-secondary">Cancel</button>
                    <button type="button" id="cpSaveBtn" class="btn-primary">Save Report</button>
                </div>
            </div>
        `;

        document.getElementById('cpBackBtn').onclick   = () => { self._view = 'list'; self._editingId = null; self._renderList(); };
        document.getElementById('cpCancelBtn').onclick = () => { self._view = 'list'; self._editingId = null; self._renderList(); };
        document.getElementById('cpAddWorkerBtn').onclick = () => { self._lines.push({ workerName:'', classification:'', regularHours:0, overtimeHours:0, regularRate:0, overtimeRate:0, fringeRate:0 }); self._renderLines(); };

        document.getElementById('cpExportCsvBtn').onclick = () => self._exportCsv();
        document.getElementById('cpSaveBtn').onclick = () => self._saveReport(id, report);

        self._renderLines();
    },

    _renderLines() {
        const self = this;
        const tbody = document.getElementById('cpLinesBody');
        const tfoot = document.getElementById('cpLinesFoot');
        if (!tbody) return;

        function numInput(val, cls) {
            return `<input type="number" step="0.01" min="0" value="${parseFloat(val)||0}" class="${cls}" style="width:80px;padding:5px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);font-size:.82rem;text-align:right" />`;
        }
        function txtInput(val, cls, ph) {
            return `<input type="text" value="${Utils.escapeHtml(val||'')}" placeholder="${ph||''}" class="${cls}" style="width:100%;min-width:110px;padding:5px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);font-size:.82rem" />`;
        }

        tbody.innerHTML = self._lines.map((line, idx) => {
            const gross = self._calcGross(line);
            return `
                <tr style="border-bottom:1px solid var(--border)" data-line-idx="${idx}">
                    <td style="padding:6px 8px">${txtInput(line.workerName, 'cp-worker-name', 'Worker name')}</td>
                    <td style="padding:6px 8px">${txtInput(line.classification, 'cp-classification', 'e.g. Journeyman Carpenter')}</td>
                    <td style="padding:6px 8px;text-align:center">${numInput(line.regularHours, 'cp-reg-hrs')}</td>
                    <td style="padding:6px 8px;text-align:center">${numInput(line.overtimeHours, 'cp-ot-hrs')}</td>
                    <td style="padding:6px 8px;text-align:right">${numInput(line.regularRate, 'cp-reg-rate')}</td>
                    <td style="padding:6px 8px;text-align:right">${numInput(line.overtimeRate, 'cp-ot-rate')}</td>
                    <td style="padding:6px 8px;text-align:right">${numInput(line.fringeRate, 'cp-fringe-rate')}</td>
                    <td style="padding:6px 8px;text-align:right;font-weight:600;font-size:.85rem" class="cp-gross-cell">$${parseFloat(gross).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                    <td style="padding:6px 8px;text-align:center">
                        <button class="btn-secondary btn-sm cp-remove-line" data-idx="${idx}" style="padding:3px 8px;font-size:.75rem;color:#dc3545">✕</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Totals row
        const totHrs   = self._lines.reduce((s, l) => s + (parseFloat(l.regularHours)||0) + (parseFloat(l.overtimeHours)||0), 0);
        const totGross  = self._lines.reduce((s, l) => s + self._calcGross(l), 0);
        tfoot.innerHTML = self._lines.length > 0 ? `
            <tr style="border-top:2px solid var(--border)">
                <td colspan="2" style="padding:8px 10px;font-weight:600;font-size:.88rem">TOTALS</td>
                <td colspan="4" style="padding:8px 10px;text-align:right;font-size:.85rem;color:var(--text2)">${totHrs.toFixed(1)} total hours</td>
                <td style="padding:8px 10px"></td>
                <td style="padding:8px 10px;text-align:right;font-weight:700;font-size:.9rem">$${parseFloat(totGross).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                <td></td>
            </tr>
        ` : '';

        // Wire up inputs — live recalc
        tbody.querySelectorAll('tr[data-line-idx]').forEach(row => {
            const idx = parseInt(row.dataset.lineIdx);
            function syncLine() {
                const line = self._lines[idx];
                if (!line) return;
                line.workerName     = row.querySelector('.cp-worker-name').value;
                line.classification = row.querySelector('.cp-classification').value;
                line.regularHours   = parseFloat(row.querySelector('.cp-reg-hrs').value) || 0;
                line.overtimeHours  = parseFloat(row.querySelector('.cp-ot-hrs').value)  || 0;
                line.regularRate    = parseFloat(row.querySelector('.cp-reg-rate').value) || 0;
                line.overtimeRate   = parseFloat(row.querySelector('.cp-ot-rate').value)  || 0;
                line.fringeRate     = parseFloat(row.querySelector('.cp-fringe-rate').value) || 0;
                const gross = self._calcGross(line);
                row.querySelector('.cp-gross-cell').textContent = '$' + parseFloat(gross).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});
                // Update footer totals
                const totHrs2  = self._lines.reduce((s, l) => s + (parseFloat(l.regularHours)||0) + (parseFloat(l.overtimeHours)||0), 0);
                const totGross2 = self._lines.reduce((s, l) => s + self._calcGross(l), 0);
                if (tfoot.querySelector('td:last-of-type') && tfoot.rows.length > 0) {
                    const cells = tfoot.rows[0].cells;
                    if (cells[1]) cells[1].innerHTML = `${totHrs2.toFixed(1)} total hours`;
                    if (cells[3]) cells[3].textContent = '$' + parseFloat(totGross2).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});
                }
            }
            row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', syncLine));
        });

        // Remove row buttons
        tbody.querySelectorAll('.cp-remove-line').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.idx);
                if (confirm('Remove this worker line?')) {
                    self._lines.splice(idx, 1);
                    self._renderLines();
                }
            };
        });
    },

    _saveReport(id, existingReport) {
        const self = this;
        const projectId  = document.getElementById('cpReportProject').value;
        const workWeekEnd = document.getElementById('cpWeekEnd').value;
        if (!projectId || !workWeekEnd) { Utils.showToast('Project and Week Ending are required', 'error'); return; }

        // Collect current line values from inputs
        const tbody = document.getElementById('cpLinesBody');
        if (tbody) {
            tbody.querySelectorAll('tr[data-line-idx]').forEach(row => {
                const idx = parseInt(row.dataset.lineIdx);
                const line = self._lines[idx];
                if (!line) return;
                line.workerName     = row.querySelector('.cp-worker-name').value;
                line.classification = row.querySelector('.cp-classification').value;
                line.regularHours   = parseFloat(row.querySelector('.cp-reg-hrs').value)   || 0;
                line.overtimeHours  = parseFloat(row.querySelector('.cp-ot-hrs').value)    || 0;
                line.regularRate    = parseFloat(row.querySelector('.cp-reg-rate').value)  || 0;
                line.overtimeRate   = parseFloat(row.querySelector('.cp-ot-rate').value)   || 0;
                line.fringeRate     = parseFloat(row.querySelector('.cp-fringe-rate').value) || 0;
            });
        }

        // Compute total gross on each line
        self._lines.forEach(line => { line.totalGross = self._calcGross(line); });

        const saveBtn = document.getElementById('cpSaveBtn');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

        try {
            const newReport = {
                id,
                projectId,
                workWeekEnd,
                status:      document.getElementById('cpReportStatus').value,
                reportedBy:  document.getElementById('cpReportedBy').value,
                notes:       document.getElementById('cpReportNotes').value,
                payrollLines: self._lines,
                created_at: existingReport ? existingReport.created_at : new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            AppData.save('certified_payroll_reports', newReport);
            Utils.showToast('Report saved', 'success');
            self._view = 'list';
            self._editingId = null;
            self._renderList();
        } catch(err) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Report'; }
            console.error('Save failed:', err);
            Utils.showToast('Failed to save: ' + err.message, 'error');
        }
    },

    _exportCsv() {
        const self = this;
        function csvEscape(val) {
            if (val === null || val === undefined) return '';
            const s = String(val);
            if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
                return '"' + s.replace(/"/g, '""') + '"';
            return s;
        }
        function csvRow(fields) { return fields.map(csvEscape).join(','); }

        // Sync from DOM first
        const tbody = document.getElementById('cpLinesBody');
        if (tbody) {
            tbody.querySelectorAll('tr[data-line-idx]').forEach(row => {
                const idx = parseInt(row.dataset.lineIdx);
                const line = self._lines[idx];
                if (!line) return;
                line.workerName     = row.querySelector('.cp-worker-name').value;
                line.classification = row.querySelector('.cp-classification').value;
                line.regularHours   = parseFloat(row.querySelector('.cp-reg-hrs').value)   || 0;
                line.overtimeHours  = parseFloat(row.querySelector('.cp-ot-hrs').value)    || 0;
                line.regularRate    = parseFloat(row.querySelector('.cp-reg-rate').value)  || 0;
                line.overtimeRate   = parseFloat(row.querySelector('.cp-ot-rate').value)   || 0;
                line.fringeRate     = parseFloat(row.querySelector('.cp-fringe-rate').value) || 0;
            });
        }

        const weekEnd = (document.getElementById('cpWeekEnd') || {}).value || 'unknown';
        const rows = [csvRow(['Worker Name', 'Classification', 'Regular Hours', 'OT Hours', 'Regular Rate', 'OT Rate', 'Fringe Rate', 'Total Gross'])];
        self._lines.forEach(line => {
            rows.push(csvRow([
                line.workerName || '',
                line.classification || '',
                line.regularHours || 0,
                line.overtimeHours || 0,
                line.regularRate || 0,
                line.overtimeRate || 0,
                line.fringeRate || 0,
                self._calcGross(line).toFixed(2)
            ]));
        });

        const content = rows.join('\n');
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'certified-payroll-' + weekEnd + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Utils.showToast('CSV exported', 'success');
    }
};
