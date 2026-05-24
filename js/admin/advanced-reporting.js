// Admin Advanced Reporting — Multi-entity cross-project reports with CSV export
window.AdminAdvancedReporting = {
    _reportType: '',
    _projectId: 'All',
    _fromDate: '',
    _toDate: '',
    _lastReportHtml: '',
    _lastReportRows: [],  // raw data rows for CSV export

    render(container) {
        const self = this;
        self._container = container;
        self._renderMain();
    },

    _renderMain() {
        const self = this;
        const container = self._container;

        // Default date range: first of previous month → today
        if (!self._toDate) {
            self._toDate = new Date().toISOString().slice(0, 10);
        }
        if (!self._fromDate) {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - 1);
            self._fromDate = d.toISOString().slice(0, 10);
        }

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const reportTypes = [
            { value: 'project_summary',      label: 'Project Summary' },
            { value: 'labour_summary',        label: 'Labour Summary' },
            { value: 'cost_summary',          label: 'Cost Summary' },
            { value: 'invoice_aging',         label: 'Invoice Aging' },
            { value: 'incident_summary',      label: 'Incident Summary' },
            { value: 'rfi_log',               label: 'RFI Log' },
            { value: 'subcontractor_list',    label: 'Subcontractor List' },
        ];

        const savedConfigs = Array.isArray(AppData.getAll ? AppData.getAll('report_configs') : [])
            ? (AppData.getAll ? AppData.getAll('report_configs') : [])
            : [];

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <h2 style="margin:0 0 6px">Advanced Reporting</h2>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Generate cross-project reports from your live data</p>
            </div>

            <!-- Controls -->
            <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:20px">
                <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
                    <div>
                        <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Report Type</label>
                        <select id="arReportType" style="padding:7px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-width:200px">
                            <option value="">— Select Report —</option>
                            ${reportTypes.map(r => `<option value="${r.value}" ${self._reportType === r.value ? 'selected' : ''}>${r.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                        <select id="arProjectFilter" style="padding:7px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                            <option value="All">All Projects</option>
                            ${projects.map(p => `<option value="${p.id}" ${self._projectId === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">From</label>
                        <input type="date" id="arFromDate" value="${self._fromDate}"
                            style="padding:7px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                    </div>
                    <div>
                        <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">To</label>
                        <input type="date" id="arToDate" value="${self._toDate}"
                            style="padding:7px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                    </div>
                    <div style="display:flex;gap:8px">
                        <button class="btn-primary" id="arGenerateBtn">Generate Report</button>
                        <button class="btn-secondary" id="arExportCsvBtn" disabled>Export CSV</button>
                    </div>
                </div>
            </div>

            <!-- Report Output -->
            <div id="reportOutput" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px;margin-bottom:24px;min-height:120px">
                <div style="color:var(--text2);text-align:center;padding:32px;font-size:.95rem">
                    Select a report type and date range, then click Generate Report.
                </div>
            </div>

            <!-- Saved Reports -->
            <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <h3 style="margin:0;font-size:.95rem">Saved Report Configurations</h3>
                    <button class="btn-secondary btn-sm" id="arSaveConfigBtn">+ Save This Config</button>
                </div>
                <div id="arSavedConfigsList">
                    ${savedConfigs.length > 0
                        ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
                            <thead><tr style="border-bottom:1px solid var(--border)">
                                <th style="padding:8px 10px;text-align:left;font-size:.8rem;color:var(--text2)">Name</th>
                                <th style="padding:8px 10px;text-align:left;font-size:.8rem;color:var(--text2)">Report Type</th>
                                <th style="padding:8px 10px;text-align:left;font-size:.8rem;color:var(--text2)">Project</th>
                                <th style="padding:8px 10px;text-align:left;font-size:.8rem;color:var(--text2)">Date Range</th>
                                <th style="padding:8px 10px;text-align:center;font-size:.8rem;color:var(--text2)">Actions</th>
                            </tr></thead>
                            <tbody>
                                ${savedConfigs.map(cfg => {
                                    const proj = (AppData.getProjects ? AppData.getProjects() : []).find(p => p.id === cfg.projectId);
                                    const rt = reportTypes.find(r => r.value === cfg.reportType);
                                    return `<tr style="border-bottom:1px solid var(--border)">
                                        <td style="padding:8px 10px;font-size:.88rem;font-weight:500">${Utils.escapeHtml(cfg.name||'Unnamed')}</td>
                                        <td style="padding:8px 10px;font-size:.85rem">${rt ? rt.label : Utils.escapeHtml(cfg.reportType||'')}</td>
                                        <td style="padding:8px 10px;font-size:.85rem">${proj ? Utils.escapeHtml(proj.name) : (cfg.projectId === 'All' ? 'All Projects' : '—')}</td>
                                        <td style="padding:8px 10px;font-size:.82rem;color:var(--text2)">${cfg.fromDate||'?'} – ${cfg.toDate||'?'}</td>
                                        <td style="padding:8px 10px;text-align:center;white-space:nowrap">
                                            <button class="btn-secondary btn-sm" data-cfg-id="${cfg.id}" data-action="load" style="margin-right:4px">Load</button>
                                            <button class="btn-secondary btn-sm" data-cfg-id="${cfg.id}" data-action="del-cfg">Delete</button>
                                        </td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table></div>`
                        : `<div style="color:var(--text2);font-size:.88rem;text-align:center;padding:16px">No saved configurations yet. Generate a report and click "+ Save This Config".</div>`
                    }
                </div>
            </div>
        `;

        // Event bindings
        document.getElementById('arReportType').onchange    = e => { self._reportType = e.target.value; };
        document.getElementById('arProjectFilter').onchange = e => { self._projectId  = e.target.value; };
        document.getElementById('arFromDate').onchange      = e => { self._fromDate   = e.target.value; };
        document.getElementById('arToDate').onchange        = e => { self._toDate     = e.target.value; };

        document.getElementById('arGenerateBtn').onclick = () => {
            self._reportType = document.getElementById('arReportType').value;
            self._projectId  = document.getElementById('arProjectFilter').value;
            self._fromDate   = document.getElementById('arFromDate').value;
            self._toDate     = document.getElementById('arToDate').value;
            self._generateReport(self._reportType, self._projectId, self._fromDate, self._toDate);
        };

        document.getElementById('arExportCsvBtn').onclick = () => self._exportCsv();

        document.getElementById('arSaveConfigBtn').onclick = () => {
            const type = document.getElementById('arReportType').value;
            if (!type) { Utils.showToast('Select a report type first', 'error'); return; }
            const name = prompt('Name for this configuration:');
            if (!name) return;
            const cfg = {
                id: 'rcfg_' + Date.now(),
                name,
                reportType: type,
                projectId: document.getElementById('arProjectFilter').value,
                fromDate: document.getElementById('arFromDate').value,
                toDate: document.getElementById('arToDate').value,
                created_at: new Date().toISOString()
            };
            try {
                AppData.save('report_configs', cfg);
                Utils.showToast('Configuration saved', 'success');
                self._renderMain();
            } catch(err) {
                Utils.showToast('Failed to save config', 'error');
            }
        };

        container.querySelectorAll('[data-action="load"]').forEach(btn => {
            btn.onclick = () => {
                const cfgId = btn.dataset.cfgId;
                const cfgs = Array.isArray(AppData.getAll ? AppData.getAll('report_configs') : []) ? (AppData.getAll ? AppData.getAll('report_configs') : []) : [];
                const cfg = cfgs.find(c => c.id === cfgId);
                if (!cfg) return;
                self._reportType = cfg.reportType || '';
                self._projectId  = cfg.projectId || 'All';
                self._fromDate   = cfg.fromDate || self._fromDate;
                self._toDate     = cfg.toDate || self._toDate;
                self._renderMain();
                // Auto-generate
                setTimeout(() => self._generateReport(self._reportType, self._projectId, self._fromDate, self._toDate), 50);
            };
        });

        container.querySelectorAll('[data-action="del-cfg"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this saved configuration?')) {
                    try {
                        AppData.remove('report_configs', btn.dataset.cfgId);
                        Utils.showToast('Configuration deleted', 'success');
                        self._renderMain();
                    } catch(err) {
                        Utils.showToast('Failed to delete', 'error');
                    }
                }
            };
        });

        // If we have pending report output to restore (after re-render on save config)
        if (self._lastReportHtml) {
            const outEl = document.getElementById('reportOutput');
            if (outEl) {
                outEl.innerHTML = self._lastReportHtml;
                const csvBtn = document.getElementById('arExportCsvBtn');
                if (csvBtn) csvBtn.disabled = false;
            }
        }
    },

    _generateReport(type, projectId, from, to) {
        const self = this;
        const outEl = document.getElementById('reportOutput');
        if (!outEl) return;

        if (!type) {
            outEl.innerHTML = `<div style="color:var(--text2);text-align:center;padding:32px">Select a report type and date range, then click Generate Report.</div>`;
            return;
        }

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        let html = '';

        try {
            if (type === 'project_summary') {
                let data = projects;
                if (projectId !== 'All') data = data.filter(p => p.id === projectId);
                html = self._reportProjectSummary(data, from, to);

            } else if (type === 'labour_summary') {
                let data = AppData.getAll ? AppData.getAll('submissions') : [];
                if (!Array.isArray(data)) data = [];
                if (projectId !== 'All') data = data.filter(i => i.projectId === projectId);
                html = self._reportLabourSummary(data, from, to);

            } else if (type === 'cost_summary') {
                let data = AppData.getAll ? AppData.getAll('cost_allocations') : [];
                if (!Array.isArray(data)) data = [];
                if (projectId !== 'All') data = data.filter(i => i.projectId === projectId);
                html = self._reportCostSummary(data, from, to);

            } else if (type === 'invoice_aging') {
                let data = AppData.getAll ? AppData.getAll('invoices') : [];
                if (!Array.isArray(data)) data = [];
                if (projectId !== 'All') data = data.filter(i => i.projectId === projectId);
                html = self._reportInvoiceAging(data, from, to);

            } else if (type === 'incident_summary') {
                let data = AppData.getAll ? AppData.getAll('safety_incidents') : [];
                if (!Array.isArray(data)) data = [];
                if (projectId !== 'All') data = data.filter(i => i.projectId === projectId);
                html = self._reportIncidentSummary(data, from, to);

            } else if (type === 'rfi_log') {
                let data = AppData.getAll ? AppData.getAll('rfis') : [];
                if (!Array.isArray(data)) data = [];
                if (projectId !== 'All') data = data.filter(i => i.projectId === projectId);
                html = self._reportRfiLog(data, from, to);

            } else if (type === 'subcontractor_list') {
                let data = AppData.getAll ? AppData.getAll('subcontractors') : [];
                if (!Array.isArray(data)) data = [];
                if (projectId !== 'All') data = data.filter(i => i.projectId === projectId);
                html = self._reportSubcontractorList(data, from, to);

            } else {
                html = `<div style="color:var(--text2);text-align:center;padding:32px">Unknown report type.</div>`;
            }
        } catch(err) {
            console.error('Report generation error:', err);
            html = `<div style="color:#dc3545;padding:20px">Error generating report: ${Utils.escapeHtml(err.message)}</div>`;
        }

        outEl.innerHTML = html;
        self._lastReportHtml = html;

        const csvBtn = document.getElementById('arExportCsvBtn');
        if (csvBtn) csvBtn.disabled = false;
    },

    // ── Report Renderers ────────────────────────────────────────────────────

    _reportProjectSummary(projects, from, to) {
        const self = this;
        self._lastReportRows = [];

        if (!projects || projects.length === 0) {
            return `<div style="color:var(--text2);text-align:center;padding:32px">No data found for this report in the selected date range.</div>`;
        }

        const headers = ['Project Name', 'Status', 'Start Date', 'End Date', 'Budget', 'Client'];
        self._lastReportRows = [headers];

        const rows = projects.map(p => {
            const row = [
                p.name || '—',
                p.status || '—',
                p.startDate || p.start_date || '—',
                p.endDate || p.end_date || '—',
                p.budget ? ('$' + parseFloat(p.budget).toLocaleString('en-CA', {minimumFractionDigits:2,maximumFractionDigits:2})) : '—',
                p.client || p.clientName || '—'
            ];
            self._lastReportRows.push(row);
            return `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:9px 12px;font-size:.88rem;font-weight:500">${Utils.escapeHtml(p.name||'—')}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(p.status||'—')}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(p.startDate||p.start_date||'—')}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(p.endDate||p.end_date||'—')}</td>
                <td style="padding:9px 12px;font-size:.85rem;text-align:right">${p.budget ? ('$'+parseFloat(p.budget).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})) : '—'}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(p.client||p.clientName||'—')}</td>
            </tr>`;
        }).join('');

        return self._tableWrap('Project Summary', headers, rows, projects.length);
    },

    _reportLabourSummary(items, from, to) {
        const self = this;
        self._lastReportRows = [];
        const projects = AppData.getProjects ? AppData.getProjects() : [];

        const filtered = items.filter(i => {
            const d = i.date || i.created_at || '';
            return (!from || d >= from) && (!to || d <= to);
        });

        if (filtered.length === 0) {
            return `<div style="color:var(--text2);text-align:center;padding:32px">No data found for this report in the selected date range.</div>`;
        }

        const headers = ['Date', 'Worker', 'Project', 'Regular Hours', 'OT Hours', 'Total Hours', 'Status'];
        self._lastReportRows = [headers];

        const rows = filtered.map(i => {
            const proj = projects.find(p => p.id === i.projectId);
            const regHrs = parseFloat(i.regularHours || i.hours || 0);
            const otHrs  = parseFloat(i.overtimeHours || i.overtime_hours || 0);
            const totHrs = regHrs + otHrs;
            const workerName = i.workerName || i.worker_name || i.name || i.workerId || '—';
            const row = [
                i.date || (i.created_at||'').slice(0,10) || '—',
                workerName,
                proj ? proj.name : (i.projectId||'—'),
                regHrs.toFixed(1),
                otHrs.toFixed(1),
                totHrs.toFixed(1),
                i.status || '—'
            ];
            self._lastReportRows.push(row);
            return `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(row[0])}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(row[1])}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(row[2])}</td>
                <td style="padding:9px 12px;font-size:.85rem;text-align:right">${row[3]}</td>
                <td style="padding:9px 12px;font-size:.85rem;text-align:right">${row[4]}</td>
                <td style="padding:9px 12px;font-size:.85rem;font-weight:600;text-align:right">${row[5]}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(row[6])}</td>
            </tr>`;
        }).join('');

        const totHrs = filtered.reduce((s, i) => s + parseFloat(i.regularHours||i.hours||0) + parseFloat(i.overtimeHours||i.overtime_hours||0), 0);

        return self._tableWrap('Labour Summary', headers, rows, filtered.length,
            `<tr style="border-top:2px solid var(--border);background:var(--card)">
                <td colspan="5" style="padding:9px 12px;font-weight:600;font-size:.88rem">TOTAL</td>
                <td style="padding:9px 12px;font-weight:700;font-size:.9rem;text-align:right">${totHrs.toFixed(1)}</td>
                <td></td>
            </tr>`
        );
    },

    _reportCostSummary(items, from, to) {
        const self = this;
        self._lastReportRows = [];
        const projects = AppData.getProjects ? AppData.getProjects() : [];

        const filtered = items.filter(i => {
            const d = i.date || i.created_at || '';
            return (!from || d >= from) && (!to || d <= to);
        });

        if (filtered.length === 0) {
            return `<div style="color:var(--text2);text-align:center;padding:32px">No data found for this report in the selected date range.</div>`;
        }

        const headers = ['Date', 'Project', 'Type', 'Description', 'Amount'];
        self._lastReportRows = [headers];

        let grandTotal = 0;
        const rows = filtered.map(i => {
            const proj = projects.find(p => p.id === i.projectId);
            const amt = parseFloat(i.amount || i.cost || 0);
            grandTotal += amt;
            const row = [
                i.date || (i.created_at||'').slice(0,10) || '—',
                proj ? proj.name : (i.projectId||'—'),
                i.type || i.costType || i.category || '—',
                i.description || i.name || '—',
                '$' + amt.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})
            ];
            self._lastReportRows.push(row);
            return `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(row[0])}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(row[1])}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(row[2])}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(row[3])}</td>
                <td style="padding:9px 12px;font-size:.85rem;text-align:right;font-weight:500">${row[4]}</td>
            </tr>`;
        }).join('');

        return self._tableWrap('Cost Summary', headers, rows, filtered.length,
            `<tr style="border-top:2px solid var(--border);background:var(--card)">
                <td colspan="4" style="padding:9px 12px;font-weight:600;font-size:.88rem">TOTAL</td>
                <td style="padding:9px 12px;font-weight:700;font-size:.9rem;text-align:right">$${grandTotal.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
            </tr>`
        );
    },

    _reportInvoiceAging(items, from, to) {
        const self = this;
        self._lastReportRows = [];
        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const today = new Date().toISOString().slice(0, 10);

        const filtered = items.filter(i => {
            const d = i.date || i.issueDate || i.created_at || '';
            return (!from || d >= from) && (!to || d <= to);
        });

        if (filtered.length === 0) {
            return `<div style="color:var(--text2);text-align:center;padding:32px">No data found for this report in the selected date range.</div>`;
        }

        const headers = ['Invoice #', 'Project', 'Client', 'Issue Date', 'Due Date', 'Amount', 'Status', 'Days Outstanding'];
        self._lastReportRows = [headers];

        const rows = filtered.map(i => {
            const proj = projects.find(p => p.id === i.projectId);
            const amt = parseFloat(i.amount || i.total || 0);
            const dueDate = i.dueDate || i.due_date || '';
            const daysOut = dueDate ? Math.max(0, Math.round((new Date(today) - new Date(dueDate)) / 86400000)) : 0;
            const isOverdue = dueDate && dueDate < today && i.status !== 'Paid';
            const row = [
                i.invoiceNumber || i.number || i.id || '—',
                proj ? proj.name : (i.projectId||'—'),
                i.client || i.clientName || '—',
                i.date || i.issueDate || (i.created_at||'').slice(0,10) || '—',
                dueDate || '—',
                '$' + amt.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2}),
                i.status || '—',
                isOverdue ? daysOut + ' days overdue' : (dueDate ? 'Current' : '—')
            ];
            self._lastReportRows.push(row);
            return `<tr style="border-bottom:1px solid var(--border)${isOverdue ? ';background:rgba(220,53,69,0.05)' : ''}">
                <td style="padding:9px 12px;font-size:.85rem;font-weight:500">${Utils.escapeHtml(row[0])}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(row[1])}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(row[2])}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(row[3])}</td>
                <td style="padding:9px 12px;font-size:.85rem${isOverdue ? ';color:#dc3545;font-weight:600' : ''}">${Utils.escapeHtml(row[4])}</td>
                <td style="padding:9px 12px;font-size:.85rem;text-align:right;font-weight:500">${row[5]}</td>
                <td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(row[6])}</td>
                <td style="padding:9px 12px;font-size:.85rem${isOverdue ? ';color:#dc3545;font-weight:600' : ''}">${Utils.escapeHtml(row[7])}</td>
            </tr>`;
        }).join('');

        const totalAmt = filtered.reduce((s, i) => s + parseFloat(i.amount||i.total||0), 0);
        return self._tableWrap('Invoice Aging', headers, rows, filtered.length,
            `<tr style="border-top:2px solid var(--border);background:var(--card)">
                <td colspan="5" style="padding:9px 12px;font-weight:600;font-size:.88rem">TOTAL</td>
                <td style="padding:9px 12px;font-weight:700;font-size:.9rem;text-align:right">$${totalAmt.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                <td colspan="2"></td>
            </tr>`
        );
    },

    _reportIncidentSummary(items, from, to) {
        const self = this;
        self._lastReportRows = [];
        const projects = AppData.getProjects ? AppData.getProjects() : [];

        const filtered = items.filter(i => {
            const d = i.date || i.incidentDate || i.created_at || '';
            return (!from || d >= from) && (!to || d <= to);
        });

        if (filtered.length === 0) {
            return `<div style="color:var(--text2);text-align:center;padding:32px">No data found for this report in the selected date range.</div>`;
        }

        const headers = ['Date', 'Project', 'Type', 'Severity', 'Description', 'Reported By', 'Status'];
        self._lastReportRows = [headers];

        const rows = filtered.map(i => {
            const proj = projects.find(p => p.id === i.projectId);
            const row = [
                i.date || i.incidentDate || (i.created_at||'').slice(0,10) || '—',
                proj ? proj.name : (i.projectId||'—'),
                i.type || i.incidentType || '—',
                i.severity || '—',
                (i.description||i.summary||'—').substring(0, 100),
                i.reportedBy || i.reporter || '—',
                i.status || '—'
            ];
            self._lastReportRows.push(row);
            return `<tr style="border-bottom:1px solid var(--border)">
                ${row.map((cell,idx) => `<td style="padding:9px 12px;font-size:.85rem${idx===4?';color:var(--text2)':''}">${Utils.escapeHtml(String(cell))}</td>`).join('')}
            </tr>`;
        }).join('');

        return self._tableWrap('Incident Summary', headers, rows, filtered.length);
    },

    _reportRfiLog(items, from, to) {
        const self = this;
        self._lastReportRows = [];
        const projects = AppData.getProjects ? AppData.getProjects() : [];

        const filtered = items.filter(i => {
            const d = i.date || i.submittedDate || i.created_at || '';
            return (!from || d >= from) && (!to || d <= to);
        });

        if (filtered.length === 0) {
            return `<div style="color:var(--text2);text-align:center;padding:32px">No data found for this report in the selected date range.</div>`;
        }

        const headers = ['RFI #', 'Project', 'Subject', 'Submitted', 'Due Date', 'Status', 'Assigned To'];
        self._lastReportRows = [headers];

        const rows = filtered.map(i => {
            const proj = projects.find(p => p.id === i.projectId);
            const row = [
                i.rfiNumber || i.number || i.id || '—',
                proj ? proj.name : (i.projectId||'—'),
                (i.subject || i.title || i.description || '—').substring(0, 80),
                i.date || i.submittedDate || (i.created_at||'').slice(0,10) || '—',
                i.dueDate || i.due_date || '—',
                i.status || '—',
                i.assignedTo || i.assigned_to || '—'
            ];
            self._lastReportRows.push(row);
            return `<tr style="border-bottom:1px solid var(--border)">
                ${row.map((cell,idx) => `<td style="padding:9px 12px;font-size:.85rem${idx===2?';color:var(--text2)':''}">${Utils.escapeHtml(String(cell))}</td>`).join('')}
            </tr>`;
        }).join('');

        return self._tableWrap('RFI Log', headers, rows, filtered.length);
    },

    _reportSubcontractorList(items, from, to) {
        const self = this;
        self._lastReportRows = [];
        const projects = AppData.getProjects ? AppData.getProjects() : [];

        // Subcontractors may not be date-filtered in the same way; filter by created_at if present
        const filtered = items.filter(i => {
            const d = i.created_at || '';
            return (!from || d >= from) && (!to || d <= to);
        });

        const display = filtered.length > 0 ? filtered : items;

        if (display.length === 0) {
            return `<div style="color:var(--text2);text-align:center;padding:32px">No data found for this report in the selected date range.</div>`;
        }

        const headers = ['Company', 'Project', 'Scope / Trade', 'Contact', 'Phone', 'Email', 'Contract Value', 'Status'];
        self._lastReportRows = [headers];

        const rows = display.map(i => {
            const proj = projects.find(p => p.id === i.projectId);
            const val = parseFloat(i.contractValue || i.contract_value || i.value || 0);
            const row = [
                i.company || i.name || i.companyName || '—',
                proj ? proj.name : (i.projectId ? i.projectId : '—'),
                i.scope || i.trade || i.description || '—',
                i.contactName || i.contact || '—',
                i.phone || '—',
                i.email || '—',
                val > 0 ? ('$' + val.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})) : '—',
                i.status || '—'
            ];
            self._lastReportRows.push(row);
            return `<tr style="border-bottom:1px solid var(--border)">
                ${row.map(cell => `<td style="padding:9px 12px;font-size:.85rem">${Utils.escapeHtml(String(cell))}</td>`).join('')}
            </tr>`;
        }).join('');

        return self._tableWrap('Subcontractor List', headers, rows, display.length);
    },

    // ── Helpers ─────────────────────────────────────────────────────────────

    _tableWrap(title, headers, rowsHtml, count, footerHtml) {
        return `
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <h3 style="margin:0;font-size:1rem">${Utils.escapeHtml(title)}</h3>
                    <span style="font-size:.82rem;color:var(--text2)">${count} record${count !== 1 ? 's' : ''}</span>
                </div>
                <div style="overflow-x:auto;border-radius:6px;border:1px solid var(--border)">
                    <table style="width:100%;border-collapse:collapse">
                        <thead>
                            <tr style="background:var(--card)">
                                ${headers.map(h => `<th style="padding:10px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.8rem;white-space:nowrap">${Utils.escapeHtml(h)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                        ${footerHtml ? `<tfoot>${footerHtml}</tfoot>` : ''}
                    </table>
                </div>
            </div>
        `;
    },

    _exportCsv() {
        const self = this;
        if (!self._lastReportRows || self._lastReportRows.length === 0) {
            Utils.showToast('No report data to export', 'error');
            return;
        }

        function csvEscape(val) {
            if (val === null || val === undefined) return '';
            const s = String(val);
            if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
                return '"' + s.replace(/"/g, '""') + '"';
            return s;
        }

        const reportTypes = {
            project_summary: 'project-summary',
            labour_summary: 'labour-summary',
            cost_summary: 'cost-summary',
            invoice_aging: 'invoice-aging',
            incident_summary: 'incident-summary',
            rfi_log: 'rfi-log',
            subcontractor_list: 'subcontractor-list'
        };

        const content = self._lastReportRows.map(row => row.map(csvEscape).join(',')).join('\n');
        const today = new Date().toISOString().slice(0, 10);
        const typeName = reportTypes[self._reportType] || 'report';
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ledgerman-' + typeName + '-' + today + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Utils.showToast('CSV exported', 'success');
    }
};
