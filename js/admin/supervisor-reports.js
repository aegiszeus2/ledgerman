// AdminSupervisorReports — Review, approve, reject supervisor field reports
// Always-on in admin nav. Talks directly to /api/supervisor-reports.

window.AdminSupervisorReports = {

    _container: null,
    _filter:   { status: 'All', projectId: 'All', startDate: '', endDate: '' },
    _view:     'list',    // 'list' | 'detail'

    // ── API helpers ──────────────────────────────────────────────────────────

    _api(method, path, body) {
        const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppData.getJwt() } };
        if (body) opts.body = JSON.stringify(body);
        return fetch(AppData.API_BASE + path, opts).then(r => r.json().then(j => { if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; }));
    },

    // ── Entry point ──────────────────────────────────────────────────────────

    render(container, params) {
        this._container = container;
        if (params && params.reportId) {
            this._renderDetail(params.reportId);
        } else {
            this._renderList();
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LIST
    // ─────────────────────────────────────────────────────────────────────────

    async _renderList() {
        const self = this;
        self._view = 'list';
        const container = self._container;
        container.innerHTML = '<div style="padding:32px;text-align:center;color:#94a9c4">Loading reports…</div>';

        let reports = [];
        try {
            let url = '/api/supervisor-reports?';
            if (self._filter.projectId  !== 'All') url += 'projectId='  + encodeURIComponent(self._filter.projectId)  + '&';
            if (self._filter.status     !== 'All') url += 'status='     + encodeURIComponent(self._filter.status.toLowerCase()) + '&';
            if (self._filter.startDate)             url += 'startDate='  + encodeURIComponent(self._filter.startDate)  + '&';
            if (self._filter.endDate)               url += 'endDate='    + encodeURIComponent(self._filter.endDate)    + '&';
            reports = await self._api('GET', url);
        } catch(e) {
            container.innerHTML = `<div style="color:#e74c3c;padding:16px">Failed to load reports: ${Utils.escapeHtml(e.message)}</div>`;
            return;
        }

        const projects  = AppData.getProjects();
        const workers   = AppData.getWorkers();
        const projMap   = {};
        projects.forEach(p => { projMap[p.id] = p.name; });
        const workerMap = {};
        workers.forEach(w => { workerMap[w.id] = w.name; });

        const totalCount     = reports.length;
        const submittedCount = reports.filter(r => r.status === 'submitted').length;
        const draftCount     = reports.filter(r => r.status === 'draft').length;

        const statusBadge = s => {
            const map = { draft: ['#888','Draft'], submitted: ['#3498db','Pending Review'], approved: ['#2ecc71','Approved'], rejected: ['#e74c3c','Rejected'] };
            const [c, l] = map[s] || ['#888', s];
            return `<span style="background:${c};color:#fff;font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap">${l}</span>`;
        };

        const csvEscape = v => { v = String(v === null || v === undefined ? '' : v); return (v.includes(',') || v.includes('"') || v.includes('\n')) ? '"' + v.replace(/"/g,'""') + '"' : v; };
        const csvRow    = fields => fields.map(csvEscape).join(',');

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
                    <h2 style="margin:0">Supervisor Field Reports</h2>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <button id="exportCsvBtn" class="btn-secondary btn-sm">Export CSV</button>
                        <button id="refreshBtn"   class="btn-secondary btn-sm">↻ Refresh</button>
                    </div>
                </div>
                <p style="color:#b0c4de;margin:0 0 16px;font-size:.9rem">Review and approve daily field reports submitted by site supervisors.</p>

                <!-- Summary cards -->
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px">
                    <div style="padding:12px;background:#fff;border-radius:8px;border:1px solid #e0e0e0">
                        <div style="color:#999;font-size:.78rem;text-transform:uppercase;margin-bottom:4px">Total</div>
                        <div style="font-size:1.8em;font-weight:bold;color:#333">${totalCount}</div>
                    </div>
                    <div style="padding:12px;background:#fff;border-radius:8px;border:1px solid #e0e0e0">
                        <div style="color:#999;font-size:.78rem;text-transform:uppercase;margin-bottom:4px">Pending Review</div>
                        <div style="font-size:1.8em;font-weight:bold;color:#3498db">${submittedCount}</div>
                    </div>
                    <div style="padding:12px;background:#fff;border-radius:8px;border:1px solid #e0e0e0">
                        <div style="color:#999;font-size:.78rem;text-transform:uppercase;margin-bottom:4px">Drafts</div>
                        <div style="font-size:1.8em;font-weight:bold;color:#888">${draftCount}</div>
                    </div>
                </div>

                <!-- Filters -->
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:flex-end">
                    <div>
                        <label style="font-size:.8rem;color:#b0c4de;display:block;margin-bottom:3px">Status</label>
                        <select id="statusFilter" style="padding:6px 8px;border-radius:4px;border:1px solid #ddd;font-size:.85rem;min-width:130px">
                            ${['All','Draft','Submitted','Approved','Rejected'].map(s => `<option value="${s}" ${self._filter.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="font-size:.8rem;color:#b0c4de;display:block;margin-bottom:3px">Project</label>
                        <select id="projectFilter" style="padding:6px 8px;border-radius:4px;border:1px solid #ddd;font-size:.85rem;min-width:160px">
                            <option value="All">All Projects</option>
                            ${projects.map(p => `<option value="${p.id}" ${self._filter.projectId === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="font-size:.8rem;color:#b0c4de;display:block;margin-bottom:3px">From</label>
                        <input type="date" id="startDateFilter" value="${self._filter.startDate}" style="padding:6px 8px;border-radius:4px;border:1px solid #ddd;font-size:.85rem">
                    </div>
                    <div>
                        <label style="font-size:.8rem;color:#b0c4de;display:block;margin-bottom:3px">To</label>
                        <input type="date" id="endDateFilter" value="${self._filter.endDate}" style="padding:6px 8px;border-radius:4px;border:1px solid #ddd;font-size:.85rem">
                    </div>
                    <button id="applyFilterBtn" class="btn-primary btn-sm" style="align-self:flex-end">Apply</button>
                    <button id="clearFilterBtn" class="btn-secondary btn-sm" style="align-self:flex-end">Clear</button>
                </div>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid #e0e0e0">
                <table class="table" style="width:100%;margin:0;border-collapse:collapse">
                    <thead style="background:#f5f5f5">
                        <tr>
                            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e0e0e0">Date</th>
                            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e0e0e0">Project</th>
                            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e0e0e0">Supervisor</th>
                            <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #e0e0e0">Crew</th>
                            <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #e0e0e0">Flags</th>
                            <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #e0e0e0">Status</th>
                            <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #e0e0e0">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reports.length === 0 ? `<tr><td colspan="7" style="padding:32px;text-align:center;color:#94a9c4">No reports match the current filters.</td></tr>` :
                        reports.map(r => {
                            const flags = [r.hasSafetyIncident && '⚠️ Incident', r.isNearMiss && '⚡ Near Miss'].filter(Boolean).join(' ');
                            return `<tr style="border-bottom:1px solid #e0e0e0;cursor:pointer" data-report-id="${r.id}">
                                <td style="padding:10px 12px;font-size:.9rem">
                                    <div style="font-weight:500">${r.date}</div>
                                    ${r.weather ? `<div style="color:#94a9c4;font-size:.8rem">${Utils.escapeHtml(r.weather)}</div>` : ''}
                                </td>
                                <td style="padding:10px 12px;font-size:.9rem">${Utils.escapeHtml(projMap[r.projectId] || r.projectId)}</td>
                                <td style="padding:10px 12px;font-size:.9rem">${Utils.escapeHtml(workerMap[r.supervisorId] || r.supervisorId || '—')}</td>
                                <td style="padding:10px 12px;text-align:center;font-size:.9rem">${r.crewSummary && r.crewSummary.totalWorkers ? r.crewSummary.totalWorkers : (r.timecardIds ? r.timecardIds.length : '—')}</td>
                                <td style="padding:10px 12px;text-align:center;font-size:.8rem;color:#e74c3c">${flags || '—'}</td>
                                <td style="padding:10px 12px;text-align:center">${statusBadge(r.status)}</td>
                                <td style="padding:10px 12px;text-align:center">
                                    <button class="btn-secondary btn-sm" data-review-id="${r.id}" style="font-size:.8rem">
                                        ${r.status === 'submitted' ? '📋 Review' : 'View'}
                                    </button>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;

        // Filters
        container.querySelector('#statusFilter').onchange  = e => { self._filter.status    = e.target.value; };
        container.querySelector('#projectFilter').onchange = e => { self._filter.projectId = e.target.value; };
        container.querySelector('#startDateFilter').onchange = e => { self._filter.startDate = e.target.value; };
        container.querySelector('#endDateFilter').onchange   = e => { self._filter.endDate   = e.target.value; };
        container.querySelector('#applyFilterBtn').onclick = () => self._renderList();
        container.querySelector('#clearFilterBtn').onclick = () => { self._filter = { status: 'All', projectId: 'All', startDate: '', endDate: '' }; self._renderList(); };
        container.querySelector('#refreshBtn').onclick = () => self._renderList();

        // Row / button click → detail
        container.querySelectorAll('[data-review-id]').forEach(btn => {
            btn.onclick = e => { e.stopPropagation(); self._renderDetail(btn.dataset.reviewId); };
        });
        container.querySelectorAll('[data-report-id]').forEach(row => {
            row.onclick = () => self._renderDetail(row.dataset.reportId);
        });

        // CSV export
        container.querySelector('#exportCsvBtn').onclick = () => {
            const rows = [csvRow(['Date','Project','Supervisor','Status','Crew','Reg Hours','OT Hours','Equipment Hours','Safety Incident','Near Miss','Weather','Delay Notes','Submitted At','Review Notes'])];
            reports.forEach(r => {
                rows.push(csvRow([
                    r.date, projMap[r.projectId] || r.projectId, workerMap[r.supervisorId] || r.supervisorId, r.status,
                    r.crewSummary?.totalWorkers || '', r.crewSummary?.totalRegHours || '', r.crewSummary?.totalOtHours || '',
                    r.crewSummary?.totalEquipmentHours || '',
                    r.hasSafetyIncident ? 'Yes' : 'No', r.isNearMiss ? 'Yes' : 'No',
                    r.weather, r.delayNotes, r.submittedAt, r.reviewNotes
                ]));
            });
            const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'supervisor-reports-' + new Date().toISOString().slice(0,10) + '.csv';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // DETAIL / REVIEW
    // ─────────────────────────────────────────────────────────────────────────

    async _renderDetail(reportId) {
        const self = this;
        self._view = 'detail';
        const container = self._container;
        container.innerHTML = '<div style="padding:32px;text-align:center;color:#94a9c4">Loading report…</div>';

        let report;
        try {
            report = await self._api('GET', '/api/supervisor-reports/' + reportId);
        } catch(e) {
            container.innerHTML = `<div style="color:#e74c3c;padding:16px">⚠️ ${Utils.escapeHtml(e.message)}<br><br><button class="btn-secondary btn-sm" id="bk">← Back</button></div>`;
            container.querySelector('#bk').onclick = () => self._renderList();
            return;
        }

        const workers  = AppData.getWorkers();
        const workerMap = {};
        workers.forEach(w => { workerMap[w.id] = w.name; });
        const projects  = AppData.getProjects();
        const projMap   = {};
        projects.forEach(p => { projMap[p.id] = p.name; });

        const projName = projMap[report.projectId] || report.projectId;
        const supName  = workerMap[report.supervisorId] || report.supervisorId || '—';
        const cs       = report.crewSummary || {};

        const statusColors = { draft: '#888', submitted: '#3498db', approved: '#2ecc71', rejected: '#e74c3c' };
        const sc = statusColors[report.status] || '#888';

        const section = (title, content) => `
            <div style="padding:14px;background:#fff;border-radius:8px;border:1px solid #e0e0e0;margin-bottom:12px">
                <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;color:#94a9c4;margin-bottom:8px">${title}</div>
                ${content}
            </div>`;

        const crewRows = (cs.workers || []).map(w =>
            `<tr><td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${Utils.escapeHtml(w.workerName)}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${w.trade || '—'}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${w.regularHours || 0}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${w.otHours || 0}</td></tr>`
        ).join('');

        const tcRows = (report.timecards || []).map(tc =>
            `<tr><td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${Utils.escapeHtml(workerMap[tc.workerId] || tc.workerId)}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${Utils.escapeHtml(tc.trade || '—')}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${tc.regularHours}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${tc.otHours || 0}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0"><span style="padding:2px 6px;border-radius:8px;font-size:.72rem;background:${tc.status==='approved'?'#2ecc7122':'#f39c1222'};color:${tc.status==='approved'?'#27ae60':'#e67e22'}">${tc.status}</span></td></tr>`
        ).join('');

        const euRows = (report.equipmentUsageRecords || []).map(eu =>
            `<tr><td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${Utils.escapeHtml(eu.equipmentName || eu.equipmentId)}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${Utils.escapeHtml(eu.operatorName || eu.operatorId)}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${eu.hoursUsed}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${eu.notes || '—'}</td></tr>`
        ).join('');

        const prodRows = (report.productionEntries || []).map(pe =>
            `<tr><td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${Utils.escapeHtml(pe.itemDescription || '—')}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${pe.quantity} ${pe.unit || ''}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${pe.notes || '—'}</td></tr>`
        ).join('');

        const photoGrid = (report.photos || []).map(ph =>
            `<div style="width:80px;height:80px;overflow:hidden;border-radius:6px;border:1px solid #ddd">
                <img src="${ph.thumbnail || ''}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">
             </div>`
        ).join('');

        const visRows = (report.visitors || []).filter(v => v.name).map(v =>
            `<tr><td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${Utils.escapeHtml(v.name)}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${Utils.escapeHtml(v.company || '—')}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${Utils.escapeHtml(v.purpose || '—')}</td>
             <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0">${Utils.escapeHtml(v.time || '—')}</td></tr>`
        ).join('');

        container.innerHTML = `
            <div style="max-width:860px">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
                    <button id="backBtn" class="btn-secondary btn-sm">← Back to Reports</button>
                    <h2 style="margin:0;flex:1;font-size:1.1rem">${Utils.escapeHtml(projName)} — ${report.date}</h2>
                    <span style="background:${sc};color:#fff;font-size:.78rem;font-weight:700;padding:4px 12px;border-radius:10px;text-transform:capitalize">${report.status}</span>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px">
                    <div style="padding:10px;background:#fff;border-radius:8px;border:1px solid #e0e0e0;text-align:center">
                        <div style="color:#999;font-size:.72rem;text-transform:uppercase">Supervisor</div>
                        <div style="font-weight:600;margin-top:4px;font-size:.9rem">${Utils.escapeHtml(supName)}</div>
                    </div>
                    <div style="padding:10px;background:#fff;border-radius:8px;border:1px solid #e0e0e0;text-align:center">
                        <div style="color:#999;font-size:.72rem;text-transform:uppercase">Workers</div>
                        <div style="font-size:1.5em;font-weight:bold;color:#3498db">${cs.totalWorkers || 0}</div>
                    </div>
                    <div style="padding:10px;background:#fff;border-radius:8px;border:1px solid #e0e0e0;text-align:center">
                        <div style="color:#999;font-size:.72rem;text-transform:uppercase">Labour Hours</div>
                        <div style="font-size:1.5em;font-weight:bold;color:#333">${(cs.totalRegHours || 0) + (cs.totalOtHours || 0)}h</div>
                    </div>
                    <div style="padding:10px;background:#fff;border-radius:8px;border:1px solid #e0e0e0;text-align:center">
                        <div style="color:#999;font-size:.72rem;text-transform:uppercase">Equipment Hours</div>
                        <div style="font-size:1.5em;font-weight:bold;color:#333">${cs.totalEquipmentHours || 0}h</div>
                    </div>
                    ${report.hasSafetyIncident || report.isNearMiss ? `<div style="padding:10px;background:#fdf0f0;border-radius:8px;border:1px solid #e74c3c;text-align:center">
                        <div style="color:#e74c3c;font-size:.72rem;text-transform:uppercase">Safety Flags</div>
                        <div style="font-size:.85rem;font-weight:600;color:#e74c3c;margin-top:4px">${[report.hasSafetyIncident && 'Incident', report.isNearMiss && 'Near Miss'].filter(Boolean).join(' + ')}</div>
                    </div>` : ''}
                </div>

                ${report.workPerformed ? section('Work Performed', `<div style="white-space:pre-wrap">${Utils.escapeHtml(report.workArea ? '📍 ' + report.workArea + '\n\n' : '') + Utils.escapeHtml(report.workPerformed)}</div>`) : ''}

                ${report.weather ? section('Site Conditions', `
                    <div style="display:flex;gap:16px;flex-wrap:wrap">
                        <span>🌤 ${Utils.escapeHtml(report.weather)}${report.temperature ? ' · ' + Utils.escapeHtml(report.temperature) : ''}</span>
                        ${report.siteConditions ? `<span style="color:#666">${Utils.escapeHtml(report.siteConditions)}</span>` : ''}
                    </div>`) : ''}

                ${report.delayNotes ? section('Delays / Impact', `<div style="border-left:3px solid #f39c12;padding-left:10px;color:#856404">${Utils.escapeHtml(report.delayNotes)}</div>`) : ''}

                ${report.hasSafetyIncident || report.isNearMiss || report.safetyNotes ? section('Safety', `
                    ${report.hasSafetyIncident ? '<div style="color:#e74c3c;font-weight:600;margin-bottom:6px">⚠️ Safety Incident Reported</div>' : ''}
                    ${report.isNearMiss        ? '<div style="color:#e74c3c;font-weight:600;margin-bottom:6px">⚡ Near Miss Reported</div>' : ''}
                    ${report.safetyNotes       ? '<div>' + Utils.escapeHtml(report.safetyNotes) + '</div>' : ''}`) : ''}

                ${tcRows ? section('Timecards', `
                    <table style="width:100%;font-size:.85rem;border-collapse:collapse">
                        <thead><tr style="border-bottom:2px solid #e0e0e0">
                            <th style="padding:5px 8px;text-align:left">Worker</th>
                            <th style="padding:5px 8px;text-align:left">Trade</th>
                            <th style="padding:5px 8px;text-align:center">Reg</th>
                            <th style="padding:5px 8px;text-align:center">OT</th>
                            <th style="padding:5px 8px">Status</th>
                        </tr></thead>
                        <tbody>${tcRows}</tbody>
                    </table>`) : ''}

                ${euRows ? section('Equipment Usage', `
                    <table style="width:100%;font-size:.85rem;border-collapse:collapse">
                        <thead><tr style="border-bottom:2px solid #e0e0e0">
                            <th style="padding:5px 8px;text-align:left">Equipment</th>
                            <th style="padding:5px 8px;text-align:left">Operator</th>
                            <th style="padding:5px 8px;text-align:center">Hours</th>
                            <th style="padding:5px 8px;text-align:left">Notes</th>
                        </tr></thead>
                        <tbody>${euRows}</tbody>
                    </table>`) : ''}

                ${prodRows ? section('Production Entries', `
                    <table style="width:100%;font-size:.85rem;border-collapse:collapse">
                        <thead><tr style="border-bottom:2px solid #e0e0e0">
                            <th style="padding:5px 8px;text-align:left">Item</th>
                            <th style="padding:5px 8px;text-align:center">Quantity</th>
                            <th style="padding:5px 8px;text-align:left">Notes</th>
                        </tr></thead>
                        <tbody>${prodRows}</tbody>
                    </table>`) : ''}

                ${photoGrid ? section('Photos', `<div style="display:flex;flex-wrap:wrap;gap:8px">${photoGrid}</div>`) : ''}

                ${visRows ? section('Visitors / Inspectors', `
                    <table style="width:100%;font-size:.85rem;border-collapse:collapse">
                        <thead><tr style="border-bottom:2px solid #e0e0e0">
                            <th style="padding:5px 8px;text-align:left">Name</th>
                            <th style="padding:5px 8px;text-align:left">Company</th>
                            <th style="padding:5px 8px;text-align:left">Purpose</th>
                            <th style="padding:5px 8px;text-align:left">Time</th>
                        </tr></thead>
                        <tbody>${visRows}</tbody>
                    </table>`) : ''}

                ${report.notes ? section('General Notes', `<div style="white-space:pre-wrap">${Utils.escapeHtml(report.notes)}</div>`) : ''}

                ${crewRows ? section('Crew Summary (Snapshot at Submission)', `
                    <table style="width:100%;font-size:.85rem;border-collapse:collapse">
                        <thead><tr style="border-bottom:2px solid #e0e0e0">
                            <th style="padding:5px 8px;text-align:left">Worker</th>
                            <th style="padding:5px 8px;text-align:left">Trade</th>
                            <th style="padding:5px 8px;text-align:center">Reg Hrs</th>
                            <th style="padding:5px 8px;text-align:center">OT Hrs</th>
                        </tr></thead>
                        <tbody>${crewRows}</tbody>
                    </table>`) : ''}

                ${report.supervisorSignature ? section('Supervisor Signature', `
                    <img src="${report.supervisorSignature}" style="max-width:200px;max-height:80px;border:1px solid #ddd;border-radius:4px">
                    ${report.signatureAt ? `<div style="color:#94a9c4;font-size:.78rem;margin-top:4px">Signed: ${new Date(report.signatureAt).toLocaleString()}</div>` : ''}`) : ''}

                ${section('Report Info', `
                    <div style="display:flex;flex-direction:column;gap:4px;font-size:.85rem">
                        <div><strong>Report ID:</strong> ${report.id}</div>
                        <div><strong>Created:</strong> ${new Date(report.createdAt).toLocaleString()}</div>
                        ${report.submittedAt ? `<div><strong>Submitted:</strong> ${new Date(report.submittedAt).toLocaleString()} by ${Utils.escapeHtml(report.submittedBy || '—')}</div>` : ''}
                        ${report.reviewedAt  ? `<div><strong>Reviewed:</strong> ${new Date(report.reviewedAt).toLocaleString()} by ${Utils.escapeHtml(report.reviewedBy || '—')}</div>` : ''}
                        ${report.reviewNotes ? `<div><strong>Review Notes:</strong> ${Utils.escapeHtml(report.reviewNotes)}</div>` : ''}
                    </div>`)}

                <!-- Approve / Reject (admin only, submitted reports) -->
                ${report.status === 'submitted' ? `
                <div style="padding:16px;background:#fff;border-radius:8px;border:2px solid #3498db;margin-top:8px">
                    <h4 style="margin:0 0 12px;color:#3498db">Admin Review</h4>
                    <div style="margin-bottom:10px">
                        <label style="font-size:.85rem;display:block;margin-bottom:4px">Review Notes (optional)</label>
                        <textarea id="reviewNotesIn" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:.85rem;resize:vertical" rows="2" placeholder="Add notes for the supervisor…"></textarea>
                    </div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap">
                        <button id="approveBtn" class="btn-primary" style="flex:1;min-width:120px;background:#2ecc71;border-color:#2ecc71;color:#fff">✓ Approve Report</button>
                        <button id="rejectBtn"  class="btn-secondary" style="flex:1;min-width:120px;background:#e74c3c;border-color:#e74c3c;color:#fff">✗ Reject — Send Back</button>
                    </div>
                    <div id="reviewErr" style="display:none;color:#e74c3c;font-size:.85rem;margin-top:8px"></div>
                </div>` : ''}

                ${report.status === 'approved' ? `<div style="padding:12px;background:#e8f8f0;border-radius:8px;border:1px solid #2ecc71;margin-top:8px">
                    <strong style="color:#27ae60">✓ Report Approved</strong>
                    ${report.reviewedAt ? ` · ${new Date(report.reviewedAt).toLocaleString()}` : ''}
                    ${report.reviewNotes ? `<p style="margin:6px 0 0;font-size:.85rem">${Utils.escapeHtml(report.reviewNotes)}</p>` : ''}
                </div>` : ''}
            </div>`;

        container.querySelector('#backBtn').onclick = () => self._renderList();

        const approveBtn = container.querySelector('#approveBtn');
        const rejectBtn  = container.querySelector('#rejectBtn');
        if (approveBtn) {
            approveBtn.onclick = async () => {
                const notes = container.querySelector('#reviewNotesIn').value.trim();
                approveBtn.disabled = rejectBtn.disabled = true;
                approveBtn.textContent = 'Approving…';
                try {
                    await self._api('POST', '/api/supervisor-reports/' + reportId + '/approve', { reviewNotes: notes });
                    Utils.showToast('Report approved!', 'success');
                    self._renderList();
                } catch(e) {
                    const errEl = container.querySelector('#reviewErr');
                    errEl.textContent = e.message; errEl.style.display = 'block';
                    approveBtn.disabled = rejectBtn.disabled = false;
                    approveBtn.textContent = '✓ Approve Report';
                }
            };
        }
        if (rejectBtn) {
            rejectBtn.onclick = async () => {
                const notes = container.querySelector('#reviewNotesIn').value.trim();
                if (!notes) {
                    const errEl = container.querySelector('#reviewErr');
                    errEl.textContent = 'Please enter rejection notes explaining what needs to be corrected.';
                    errEl.style.display = 'block';
                    return;
                }
                rejectBtn.disabled = approveBtn.disabled = true;
                rejectBtn.textContent = 'Rejecting…';
                try {
                    await self._api('POST', '/api/supervisor-reports/' + reportId + '/reject', { reviewNotes: notes });
                    Utils.showToast('Report rejected — supervisor notified.', 'info');
                    self._renderList();
                } catch(e) {
                    const errEl = container.querySelector('#reviewErr');
                    errEl.textContent = e.message; errEl.style.display = 'block';
                    rejectBtn.disabled = approveBtn.disabled = false;
                    rejectBtn.textContent = '✗ Reject — Send Back';
                }
            };
        }
    }
};
