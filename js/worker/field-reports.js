// WorkerFieldReports — Supervisor daily field report creation & management
// Accessible only from the worker portal when the logged-in worker has role=Supervisor or Approver.
// Talks directly to /api/supervisor-reports and related endpoints.

window.WorkerFieldReports = {

    // ── API helpers ──────────────────────────────────────────────────────────

    _apiBase() { return AppData.API_BASE; },
    _headers()  { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppData.getJwt() }; },

    async _api(method, path, body) {
        const opts = { method, headers: this._headers() };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(this._apiBase() + path, opts);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Request failed (' + res.status + ')');
        return json;
    },

    // ── State ────────────────────────────────────────────────────────────────

    _container: null,
    _worker: null,
    _view: 'list',       // 'list' | 'create' | 'edit' | 'detail'
    _editId: null,
    _sigPad: null,       // signature pad state

    // ── Entry point ──────────────────────────────────────────────────────────

    render(container, worker) {
        this._container = container;
        this._worker    = worker;
        this._renderList();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LIST VIEW
    // ─────────────────────────────────────────────────────────────────────────

    async _renderList() {
        const self = this;
        self._view = 'list';
        const container = self._container;
        container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2)">Loading reports…</div>';

        let reports = [];
        try {
            reports = await self._api('GET', '/api/supervisor-reports');
        } catch(e) {
            container.innerHTML = `<div class="card" style="border-color:var(--accent)"><p style="color:var(--accent)">⚠️ ${Utils.escapeHtml(e.message)}</p></div>`;
            return;
        }

        // Sort: draft first, then submitted, then approved/rejected
        const order = { draft: 0, submitted: 1, rejected: 2, approved: 3 };
        reports.sort((a, b) => (order[a.status] - order[b.status]) || (b.date > a.date ? 1 : -1));

        const draft     = reports.filter(r => r.status === 'draft');
        const submitted = reports.filter(r => r.status === 'submitted');
        const closed    = reports.filter(r => r.status === 'approved' || r.status === 'rejected');

        const projects = AppData.getProjects();
        const projMap  = {};
        projects.forEach(p => { projMap[p.id] = p.name; });

        const badge = s => {
            const c = { draft: '#888', submitted: '#3498db', approved: '#2ecc71', rejected: '#e74c3c' }[s] || '#888';
            const l = { draft: 'Draft', submitted: '⏳ Submitted', approved: '✓ Approved', rejected: '✗ Rejected' }[s] || s;
            return `<span style="background:${c};color:#fff;font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:10px">${l}</span>`;
        };

        const row = r => `
            <div class="card" style="margin-bottom:10px;cursor:pointer;padding:14px" data-report-id="${r.id}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:600;font-size:.95rem;margin-bottom:2px">${Utils.escapeHtml(projMap[r.projectId] || r.projectId)}</div>
                        <div style="color:var(--text2);font-size:.82rem">${self._fmtDate(r.date)}</div>
                        ${r.weather ? `<div style="color:var(--text2);font-size:.8rem;margin-top:2px">🌤 ${Utils.escapeHtml(r.weather)}</div>` : ''}
                    </div>
                    <div style="text-align:right;flex-shrink:0">
                        ${badge(r.status)}
                        ${r.crewSummary && r.crewSummary.totalWorkers ? `<div style="color:var(--text2);font-size:.78rem;margin-top:4px">👷 ${r.crewSummary.totalWorkers} workers</div>` : ''}
                    </div>
                </div>
                ${r.status === 'rejected' && r.reviewNotes ? `<div style="margin-top:8px;padding:6px 10px;background:rgba(231,76,60,.1);border-radius:4px;font-size:.8rem;color:#e74c3c">Rejected: ${Utils.escapeHtml(r.reviewNotes)}</div>` : ''}
                ${r.status === 'draft' || r.status === 'rejected' ? `<div style="margin-top:8px;text-align:right"><span style="color:var(--primary);font-size:.82rem;font-weight:600">Edit &rsaquo;</span></div>` : '<div style="margin-top:8px;text-align:right"><span style="color:var(--text2);font-size:.82rem">View &rsaquo;</span></div>'}
            </div>`;

        const group = (title, items) => items.length === 0 ? '' : `
            <div style="margin:16px 0 8px;font-size:.8rem;font-weight:700;text-transform:uppercase;color:var(--text2);letter-spacing:.5px">${title} (${items.length})</div>
            ${items.map(row).join('')}`;

        container.innerHTML = `
            <div style="padding:0 0 80px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <h3 style="margin:0;font-size:1.05rem">Field Reports</h3>
                    <button id="createReportBtn" class="btn btn-primary btn-sm">+ New Report</button>
                </div>
                ${reports.length === 0 ? `
                    <div class="card" style="text-align:center;padding:32px">
                        <div style="font-size:2.5rem;margin-bottom:12px">📋</div>
                        <h4 style="margin-bottom:8px">No reports yet</h4>
                        <p style="color:var(--text2);font-size:.9rem">Create your first daily field report to track crew, conditions, and progress.</p>
                    </div>
                ` : `
                    ${group('Drafts / Rejected', [...draft, ...reports.filter(r=>r.status==='rejected')])}
                    ${group('Submitted for Review', submitted)}
                    ${group('Approved', closed.filter(r=>r.status==='approved'))}
                `}
            </div>`;

        container.querySelector('#createReportBtn').onclick = () => self._renderCreate();

        container.querySelectorAll('[data-report-id]').forEach(card => {
            card.onclick = () => {
                const r = reports.find(x => x.id === card.dataset.reportId);
                if (!r) return;
                if (r.status === 'draft' || r.status === 'rejected') {
                    self._renderEdit(r.id);
                } else {
                    self._renderDetail(r.id);
                }
            };
        });
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE VIEW
    // ─────────────────────────────────────────────────────────────────────────

    _renderCreate() {
        const self = this;
        self._view = 'create';
        const projects = AppData.getProjects().filter(p => p.status === 'Active');
        const today = new Date().toISOString().slice(0, 10);

        self._container.innerHTML = `
            <div style="padding:0 0 80px">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
                    <button id="backBtn" class="btn btn-secondary btn-sm">← Back</button>
                    <h3 style="margin:0;font-size:1rem">New Field Report</h3>
                </div>

                <div class="card" style="padding:16px">
                    <div style="margin-bottom:16px">
                        <label class="form-label">Project *</label>
                        <select id="projectSel" class="form-control" style="width:100%">
                            <option value="">— Select Project —</option>
                            ${projects.map(p => `<option value="${p.id}">${Utils.escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div style="margin-bottom:16px">
                        <label class="form-label">Date *</label>
                        <input type="date" id="dateIn" class="form-control" value="${today}">
                    </div>
                    <div style="margin-bottom:16px">
                        <label class="form-label">Weather</label>
                        <select id="weatherSel" class="form-control">
                            <option value="">— Select —</option>
                            <option>Clear / Sunny</option>
                            <option>Partly Cloudy</option>
                            <option>Overcast</option>
                            <option>Light Rain</option>
                            <option>Heavy Rain</option>
                            <option>Snow</option>
                            <option>Fog</option>
                            <option>High Wind</option>
                            <option>Extreme Heat</option>
                        </select>
                    </div>
                    <div style="margin-bottom:16px">
                        <label class="form-label">Temperature</label>
                        <input type="text" id="tempIn" class="form-control" placeholder="e.g. 18°C, 64°F">
                    </div>
                    <div style="margin-bottom:0">
                        <label class="form-label">Site Conditions</label>
                        <textarea id="siteCondIn" class="form-control" rows="2" placeholder="Mud, standing water, restricted access…" style="width:100%;resize:vertical"></textarea>
                    </div>
                </div>

                <div id="errMsg" style="color:var(--accent);font-size:.85rem;padding:8px 0;display:none"></div>

                <button id="nextBtn" class="btn btn-primary" style="width:100%;margin-top:8px">Continue →</button>
            </div>`;

        self._container.querySelector('#backBtn').onclick = () => self._renderList();

        self._container.querySelector('#nextBtn').onclick = async () => {
            const projectId = self._container.querySelector('#projectSel').value;
            const date      = self._container.querySelector('#dateIn').value;
            const weather   = self._container.querySelector('#weatherSel').value;
            const temp      = self._container.querySelector('#tempIn').value.trim();
            const siteCond  = self._container.querySelector('#siteCondIn').value.trim();
            const errEl     = self._container.querySelector('#errMsg');

            if (!projectId) { errEl.textContent = 'Select a project.'; errEl.style.display = 'block'; return; }
            if (!date)      { errEl.textContent = 'Select a date.';    errEl.style.display = 'block'; return; }
            errEl.style.display = 'none';

            const btn = self._container.querySelector('#nextBtn');
            btn.disabled = true; btn.textContent = 'Creating…';
            try {
                const report = await self._api('POST', '/api/supervisor-reports', {
                    projectId, date, weather, temperature: temp, siteConditions: siteCond
                });
                self._renderEdit(report.id, true);
            } catch(e) {
                errEl.textContent = e.message; errEl.style.display = 'block';
                btn.disabled = false; btn.textContent = 'Continue →';
            }
        };
    },

    // ─────────────────────────────────────────────────────────────────────────
    // EDIT VIEW — full draft editor
    // ─────────────────────────────────────────────────────────────────────────

    async _renderEdit(reportId, freshlyCreated = false) {
        const self = this;
        self._view = 'edit';
        self._editId = reportId;
        const container = self._container;
        container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2)">Loading…</div>';

        let report, timecards = [], equipment = [];
        try {
            [report, timecards, equipment] = await Promise.all([
                self._api('GET', '/api/supervisor-reports/' + reportId),
                self._api('GET', '/api/timecards?projectId=' + encodeURIComponent('')).catch(() => []),
                self._api('GET', '/api/equipment-usage').catch(() => []),
            ]);
            // Filter to same project + date
            timecards = timecards.filter(t => t.projectId === report.projectId && t.date === report.date);
            equipment = equipment.filter(e => e.projectId === report.projectId && e.date === report.date);
        } catch(e) {
            container.innerHTML = `<div class="card" style="border-color:var(--accent)"><p style="color:var(--accent)">⚠️ ${Utils.escapeHtml(e.message)}</p><button class="btn btn-secondary btn-sm" id="bk">← Back</button></div>`;
            container.querySelector('#bk').onclick = () => self._renderList();
            return;
        }

        const projName = (AppData.getProject(report.projectId) || {}).name || report.projectId;
        const workers  = AppData.getWorkers();
        const workerMap = {};
        workers.forEach(w => { workerMap[w.id] = w.name; });

        const linkedTcIds = new Set(report.timecardIds || []);
        const linkedEuIds = new Set(report.equipmentUsageIds || []);

        const tcRows = timecards.map(tc => `
            <label style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer">
                <input type="checkbox" class="tc-check" data-id="${tc.id}" ${linkedTcIds.has(tc.id) ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0">
                <div style="flex:1;min-width:0">
                    <div style="font-weight:500;font-size:.9rem">${Utils.escapeHtml(workerMap[tc.workerId] || tc.workerId)}</div>
                    <div style="color:var(--text2);font-size:.78rem">${tc.trade || 'General'} · ${tc.regularHours}h reg${tc.otHours > 0 ? ' + ' + tc.otHours + 'h OT' : ''}</div>
                </div>
            </label>`).join('');

        const euRows = equipment.map(eu => `
            <label style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer">
                <input type="checkbox" class="eu-check" data-id="${eu.id}" ${linkedEuIds.has(eu.id) ? 'checked' : ''} style="width:18px;height:18px;flex-shrink:0">
                <div style="flex:1;min-width:0">
                    <div style="font-weight:500;font-size:.9rem">${Utils.escapeHtml(eu.equipmentId)}</div>
                    <div style="color:var(--text2);font-size:.78rem">${eu.hoursUsed}h · ${Utils.escapeHtml(workerMap[eu.operatorId] || eu.operatorId)}</div>
                </div>
            </label>`).join('');

        container.innerHTML = `
            <div style="padding:0 0 120px">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
                    <button id="backBtn" class="btn btn-secondary btn-sm">← Back</button>
                    <h3 style="margin:0;font-size:1rem;flex:1">${Utils.escapeHtml(projName)} · ${self._fmtDate(report.date)}</h3>
                </div>
                <div style="color:var(--text2);font-size:.78rem;margin-bottom:16px;padding-left:2px">Status: ${report.status.toUpperCase()}</div>

                ${report.status === 'rejected' && report.reviewNotes ? `
                    <div style="margin-bottom:12px;padding:10px;background:rgba(231,76,60,.1);border-left:3px solid #e74c3c;border-radius:4px;font-size:.85rem">
                        <strong style="color:#e74c3c">Rejection reason:</strong> ${Utils.escapeHtml(report.reviewNotes)}
                    </div>` : ''}

                <!-- Work Performed -->
                <div class="card" style="padding:14px;margin-bottom:12px">
                    <h4 style="margin:0 0 12px;font-size:.9rem;text-transform:uppercase;color:var(--text2)">Work Performed</h4>
                    <div style="margin-bottom:10px">
                        <label class="form-label">Work Area</label>
                        <input type="text" id="workAreaIn" class="form-control" value="${Utils.escapeHtml(report.workArea || '')}" placeholder="Location/zone of work today">
                    </div>
                    <div>
                        <label class="form-label">Work Performed Today</label>
                        <textarea id="workPerfIn" class="form-control" rows="3" style="width:100%;resize:vertical" placeholder="Describe what was accomplished today…">${Utils.escapeHtml(report.workPerformed || '')}</textarea>
                    </div>
                </div>

                <!-- Site Conditions -->
                <div class="card" style="padding:14px;margin-bottom:12px">
                    <h4 style="margin:0 0 12px;font-size:.9rem;text-transform:uppercase;color:var(--text2)">Site Conditions</h4>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                        <div>
                            <label class="form-label">Weather</label>
                            <select id="weatherSel" class="form-control">
                                <option value="">— Select —</option>
                                ${['Clear / Sunny','Partly Cloudy','Overcast','Light Rain','Heavy Rain','Snow','Fog','High Wind','Extreme Heat'].map(w => `<option ${report.weather === w ? 'selected' : ''}>${w}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Temperature</label>
                            <input type="text" id="tempIn" class="form-control" value="${Utils.escapeHtml(report.temperature || '')}" placeholder="18°C">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Site Conditions</label>
                        <textarea id="siteCondIn" class="form-control" rows="2" style="width:100%;resize:vertical" placeholder="Ground conditions, access, hazards…">${Utils.escapeHtml(report.siteConditions || '')}</textarea>
                    </div>
                </div>

                <!-- Crew / Timecards -->
                <div class="card" style="padding:14px;margin-bottom:12px">
                    <h4 style="margin:0 0 4px;font-size:.9rem;text-transform:uppercase;color:var(--text2)">Crew Timecards</h4>
                    <p style="color:var(--text2);font-size:.78rem;margin:0 0 10px">Select timecards for ${self._fmtDate(report.date)} on this project to include in this report.</p>
                    ${tcRows || '<p style="color:var(--text2);font-size:.85rem;padding:8px 0">No timecards found for this project/date.</p>'}
                </div>

                <!-- Equipment -->
                ${euRows ? `<div class="card" style="padding:14px;margin-bottom:12px">
                    <h4 style="margin:0 0 4px;font-size:.9rem;text-transform:uppercase;color:var(--text2)">Equipment Usage</h4>
                    <p style="color:var(--text2);font-size:.78rem;margin:0 0 10px">Link equipment usage records for this report.</p>
                    ${euRows}
                </div>` : ''}

                <!-- Delays & Impact -->
                <div class="card" style="padding:14px;margin-bottom:12px">
                    <h4 style="margin:0 0 12px;font-size:.9rem;text-transform:uppercase;color:var(--text2)">Delays & Impact</h4>
                    <div>
                        <label class="form-label">Delay / Impact Notes</label>
                        <textarea id="delayNotesIn" class="form-control" rows="3" style="width:100%;resize:vertical" placeholder="Describe any delays, impact events, or non-productive time today…">${Utils.escapeHtml(report.delayNotes || '')}</textarea>
                    </div>
                </div>

                <!-- Safety -->
                <div class="card" style="padding:14px;margin-bottom:12px">
                    <h4 style="margin:0 0 12px;font-size:.9rem;text-transform:uppercase;color:var(--text2)">Safety</h4>
                    <div style="margin-bottom:12px">
                        <label class="form-label">Safety Notes / Toolbox Talk Topics</label>
                        <textarea id="safetyNotesIn" class="form-control" rows="2" style="width:100%;resize:vertical" placeholder="Describe safety briefing, observations, or actions…">${Utils.escapeHtml(report.safetyNotes || '')}</textarea>
                    </div>
                    <div style="display:flex;gap:16px">
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                            <input type="checkbox" id="incidentChk" ${report.hasSafetyIncident ? 'checked' : ''} style="width:18px;height:18px">
                            <span style="font-size:.9rem">Safety Incident</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                            <input type="checkbox" id="nearMissChk" ${report.isNearMiss ? 'checked' : ''} style="width:18px;height:18px">
                            <span style="font-size:.9rem">Near Miss</span>
                        </label>
                    </div>
                </div>

                <!-- Visitors -->
                <div class="card" style="padding:14px;margin-bottom:12px">
                    <h4 style="margin:0 0 8px;font-size:.9rem;text-transform:uppercase;color:var(--text2)">Visitors / Inspectors</h4>
                    <div id="visitorsContainer"></div>
                    <button id="addVisitorBtn" class="btn btn-secondary btn-sm" style="margin-top:8px;width:100%">+ Add Visitor</button>
                </div>

                <!-- General Notes -->
                <div class="card" style="padding:14px;margin-bottom:12px">
                    <h4 style="margin:0 0 10px;font-size:.9rem;text-transform:uppercase;color:var(--text2)">General Notes</h4>
                    <textarea id="notesIn" class="form-control" rows="3" style="width:100%;resize:vertical" placeholder="Any additional notes for this daily report…">${Utils.escapeHtml(report.notes || '')}</textarea>
                </div>

                <!-- Signature -->
                <div class="card" style="padding:14px;margin-bottom:12px">
                    <h4 style="margin:0 0 8px;font-size:.9rem;text-transform:uppercase;color:var(--text2)">Supervisor Signature</h4>
                    <p style="color:var(--text2);font-size:.78rem;margin:0 0 10px">Sign below to certify this report is accurate.</p>
                    <div id="sigWrap" style="border:2px solid var(--border);border-radius:8px;background:#f9f9f9;position:relative">
                        <canvas id="sigCanvas" style="display:block;width:100%;touch-action:none" height="140"></canvas>
                        ${report.supervisorSignature ? `<img id="existingSig" src="${report.supervisorSignature}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;border-radius:6px">` : ''}
                    </div>
                    <div style="display:flex;gap:8px;margin-top:8px">
                        <button id="clearSigBtn" class="btn btn-secondary btn-sm" style="flex:1">Clear Signature</button>
                        ${report.supervisorSignature ? '<span id="sigStatus" style="color:#2ecc71;font-size:.8rem;align-self:center">✓ Signed</span>' : '<span id="sigStatus" style="color:var(--text2);font-size:.8rem;align-self:center">Draw your signature above</span>'}
                    </div>
                </div>

                <div id="saveMsg" style="display:none;color:#2ecc71;font-size:.85rem;text-align:center;padding:4px 0"></div>
                <div id="errMsg"  style="display:none;color:var(--accent);font-size:.85rem;padding:4px 0"></div>

                <!-- Action Buttons -->
                <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">
                    <button id="saveDraftBtn" class="btn btn-secondary" style="width:100%">💾 Save Draft</button>
                    <button id="submitBtn" class="btn btn-primary" style="width:100%">📤 Submit for Review</button>
                </div>
            </div>`;

        // Visitors
        const visitors = report.visitors || [];
        self._renderVisitors(visitors);
        container.querySelector('#addVisitorBtn').onclick = () => {
            visitors.push({ name: '', company: '', purpose: '', time: '' });
            self._renderVisitors(visitors);
        };

        // Signature pad
        self._initSigPad(container.querySelector('#sigCanvas'), report.supervisorSignature);
        container.querySelector('#clearSigBtn').onclick = () => {
            self._clearSig();
            const img = container.querySelector('#existingSig');
            if (img) img.remove();
            container.querySelector('#sigStatus').textContent = 'Draw your signature above';
            container.querySelector('#sigStatus').style.color = 'var(--text2)';
        };

        container.querySelector('#backBtn').onclick = () => self._renderList();

        // Save draft
        container.querySelector('#saveDraftBtn').onclick = async () => {
            await self._saveReport(reportId, false);
        };

        // Submit
        container.querySelector('#submitBtn').onclick = async () => {
            const saved = await self._saveReport(reportId, false);
            if (!saved) return;
            const btn = container.querySelector('#submitBtn');
            const errEl = container.querySelector('#errMsg');
            btn.disabled = true; btn.textContent = 'Submitting…';
            try {
                await self._api('POST', '/api/supervisor-reports/' + reportId + '/submit');
                Utils.showToast('Report submitted for admin review!', 'success');
                self._renderList();
            } catch(e) {
                errEl.textContent = e.message; errEl.style.display = 'block';
                btn.disabled = false; btn.textContent = '📤 Submit for Review';
            }
        };
    },

    _renderVisitors(visitors) {
        const self = this;
        const container = self._container.querySelector('#visitorsContainer');
        if (!container) return;
        container.innerHTML = visitors.map((v, i) => `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;padding:10px;background:var(--bg2,#f5f5f5);border-radius:6px" data-visitor-idx="${i}">
                <input type="text" class="form-control vis-name" placeholder="Name" value="${Utils.escapeHtml(v.name || '')}" style="font-size:.85rem">
                <input type="text" class="form-control vis-company" placeholder="Company" value="${Utils.escapeHtml(v.company || '')}" style="font-size:.85rem">
                <input type="text" class="form-control vis-purpose" placeholder="Purpose" value="${Utils.escapeHtml(v.purpose || '')}" style="font-size:.85rem">
                <input type="time" class="form-control vis-time" value="${Utils.escapeHtml(v.time || '')}" style="font-size:.85rem">
                <button class="btn btn-secondary btn-sm vis-remove" data-idx="${i}" style="grid-column:span 2;font-size:.78rem">Remove</button>
            </div>`).join('');

        container.querySelectorAll('.vis-remove').forEach(btn => {
            btn.onclick = () => {
                visitors.splice(parseInt(btn.dataset.idx), 1);
                self._renderVisitors(visitors);
            };
        });
    },

    _getVisitors() {
        const items = [];
        this._container.querySelectorAll('[data-visitor-idx]').forEach(row => {
            items.push({
                name:    row.querySelector('.vis-name').value.trim(),
                company: row.querySelector('.vis-company').value.trim(),
                purpose: row.querySelector('.vis-purpose').value.trim(),
                time:    row.querySelector('.vis-time').value.trim(),
            });
        });
        return items;
    },

    async _saveReport(reportId, silent = true) {
        const self = this;
        const container = self._container;
        const errEl  = container.querySelector('#errMsg');
        const saveEl = container.querySelector('#saveMsg');
        const saveBtn = container.querySelector('#saveDraftBtn');
        if (errEl)  errEl.style.display = 'none';

        // Collect linked IDs
        const timecardIds     = [...container.querySelectorAll('.tc-check:checked')].map(c => c.dataset.id);
        const equipmentUsageIds = [...container.querySelectorAll('.eu-check:checked')].map(c => c.dataset.id);

        // Get signature
        let signature = '';
        if (self._sigPad && self._sigPad.hasContent) {
            try { signature = self._sigPad.canvas.toDataURL('image/png'); } catch(e) {}
        }
        // If existing signature was not cleared, keep it
        if (!signature && container.querySelector('#existingSig')) {
            signature = container.querySelector('#existingSig').src;
        }

        const body = {
            workArea:           container.querySelector('#workAreaIn')?.value.trim()       || '',
            workPerformed:      container.querySelector('#workPerfIn')?.value.trim()       || '',
            weather:            container.querySelector('#weatherSel')?.value              || '',
            temperature:        container.querySelector('#tempIn')?.value.trim()           || '',
            siteConditions:     container.querySelector('#siteCondIn')?.value.trim()       || '',
            delayNotes:         container.querySelector('#delayNotesIn')?.value.trim()     || '',
            safetyNotes:        container.querySelector('#safetyNotesIn')?.value.trim()    || '',
            hasSafetyIncident:  container.querySelector('#incidentChk')?.checked || false,
            isNearMiss:         container.querySelector('#nearMissChk')?.checked  || false,
            notes:              container.querySelector('#notesIn')?.value.trim()          || '',
            visitors:           self._getVisitors(),
            timecardIds,
            equipmentUsageIds,
            supervisorSignature: signature,
            signatureAt:         signature ? new Date().toISOString() : '',
        };

        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
        try {
            await self._api('PUT', '/api/supervisor-reports/' + reportId, body);
            if (!silent) {
                if (saveEl) { saveEl.textContent = '✓ Draft saved'; saveEl.style.display = 'block'; setTimeout(() => { if (saveEl) saveEl.style.display = 'none'; }, 2500); }
                Utils.showToast('Draft saved', 'success');
            }
            return true;
        } catch(e) {
            if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
            return false;
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Draft'; }
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // DETAIL VIEW — read-only (submitted/approved)
    // ─────────────────────────────────────────────────────────────────────────

    async _renderDetail(reportId) {
        const self = this;
        const container = self._container;
        container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2)">Loading…</div>';

        let report;
        try {
            report = await self._api('GET', '/api/supervisor-reports/' + reportId);
        } catch(e) {
            container.innerHTML = `<div class="card" style="border-color:var(--accent)"><p style="color:var(--accent)">⚠️ ${Utils.escapeHtml(e.message)}</p><button class="btn btn-secondary btn-sm" id="bk">← Back</button></div>`;
            container.querySelector('#bk').onclick = () => self._renderList();
            return;
        }

        const projName = (AppData.getProject(report.projectId) || {}).name || report.projectId;
        const statusColors = { draft: '#888', submitted: '#3498db', approved: '#2ecc71', rejected: '#e74c3c' };
        const sc = statusColors[report.status] || '#888';

        const crewRows = (report.crewSummary?.workers || []).map(w =>
            `<tr><td style="padding:6px 8px">${Utils.escapeHtml(w.workerName)}</td><td style="padding:6px 8px;text-align:center">${w.regularHours}h</td><td style="padding:6px 8px;text-align:center">${w.otHours || 0}h</td></tr>`
        ).join('');

        container.innerHTML = `
            <div style="padding:0 0 80px">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
                    <button id="backBtn" class="btn btn-secondary btn-sm">← Back</button>
                    <h3 style="margin:0;font-size:1rem;flex:1">${Utils.escapeHtml(projName)}</h3>
                    <span style="background:${sc};color:#fff;font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:10px;text-transform:capitalize">${report.status}</span>
                </div>

                <div style="color:var(--text2);font-size:.85rem;margin-bottom:16px">${self._fmtDate(report.date)} · Submitted by ${Utils.escapeHtml(report.submittedBy || '—')}</div>

                ${report.status === 'approved' ? `<div style="padding:10px;background:rgba(46,204,113,.1);border-left:3px solid #2ecc71;border-radius:4px;font-size:.85rem;margin-bottom:12px"><strong style="color:#2ecc71">✓ Approved</strong> by ${Utils.escapeHtml(report.reviewedBy)} ${report.reviewNotes ? '· ' + Utils.escapeHtml(report.reviewNotes) : ''}</div>` : ''}

                ${report.workPerformed ? `<div class="card" style="padding:12px;margin-bottom:10px"><strong style="font-size:.8rem;color:var(--text2);text-transform:uppercase">Work Performed</strong><p style="margin:6px 0 0">${Utils.escapeHtml(report.workPerformed)}</p></div>` : ''}
                ${(report.employeesPresent && report.employeesPresent.length) ? `<div class="card" style="padding:12px;margin-bottom:10px"><strong style="font-size:.8rem;color:var(--text2);text-transform:uppercase;display:block;margin-bottom:8px">On-Site Employees (${report.employeesPresent.length})</strong><div style="display:flex;flex-wrap:wrap;gap:6px">${report.employeesPresent.map(e => `<span style="background:var(--bg2,rgba(127,127,127,.12));border:1px solid var(--border);border-radius:12px;padding:3px 10px;font-size:.82rem">${Utils.escapeHtml(e.name || e.id || '')}</span>`).join('')}</div></div>` : ''}
                ${report.weather ? `<div class="card" style="padding:12px;margin-bottom:10px"><strong style="font-size:.8rem;color:var(--text2);text-transform:uppercase">Conditions</strong><p style="margin:6px 0 0">🌤 ${Utils.escapeHtml(report.weather)}${report.temperature ? ' · ' + Utils.escapeHtml(report.temperature) : ''}${report.siteConditions ? '<br>' + Utils.escapeHtml(report.siteConditions) : ''}</p></div>` : ''}
                ${report.delayNotes ? `<div class="card" style="padding:12px;margin-bottom:10px;border-left:3px solid #f39c12"><strong style="font-size:.8rem;color:var(--text2);text-transform:uppercase">Delays</strong><p style="margin:6px 0 0">${Utils.escapeHtml(report.delayNotes)}</p></div>` : ''}
                ${report.hasSafetyIncident || report.isNearMiss ? `<div class="card" style="padding:12px;margin-bottom:10px;border-left:3px solid #e74c3c"><strong style="font-size:.8rem;color:#e74c3c;text-transform:uppercase">⚠️ Safety Flags</strong><p style="margin:6px 0 0">${report.hasSafetyIncident ? 'Safety Incident Reported. ' : ''}${report.isNearMiss ? 'Near Miss Reported.' : ''}</p>${report.safetyNotes ? '<p style="margin:4px 0 0;color:var(--text2);font-size:.85rem">' + Utils.escapeHtml(report.safetyNotes) + '</p>' : ''}</div>` : ''}

                ${crewRows ? `<div class="card" style="padding:12px;margin-bottom:10px"><strong style="font-size:.8rem;color:var(--text2);text-transform:uppercase;display:block;margin-bottom:8px">Crew Summary</strong>
                    <table style="width:100%;font-size:.85rem;border-collapse:collapse">
                        <thead><tr style="border-bottom:2px solid var(--border)"><th style="padding:4px 8px;text-align:left">Worker</th><th style="padding:4px 8px;text-align:center">Reg</th><th style="padding:4px 8px;text-align:center">OT</th></tr></thead>
                        <tbody>${crewRows}</tbody>
                    </table>
                </div>` : ''}

                ${report.notes ? `<div class="card" style="padding:12px;margin-bottom:10px"><strong style="font-size:.8rem;color:var(--text2);text-transform:uppercase">Notes</strong><p style="margin:6px 0 0">${Utils.escapeHtml(report.notes)}</p></div>` : ''}

                ${report.supervisorSignature ? `<div class="card" style="padding:12px;margin-bottom:10px"><strong style="font-size:.8rem;color:var(--text2);text-transform:uppercase;display:block;margin-bottom:8px">Signature</strong><img src="${report.supervisorSignature}" style="max-width:200px;border:1px solid var(--border);border-radius:4px"></div>` : ''}
            </div>`;

        container.querySelector('#backBtn').onclick = () => self._renderList();
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SIGNATURE PAD
    // ─────────────────────────────────────────────────────────────────────────

    _initSigPad(canvas, existingSig) {
        const self = this;
        if (!canvas) return;

        // Set canvas resolution
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const w = canvas.offsetParent ? canvas.offsetParent.clientWidth : 300;
        canvas.width  = w * dpr;
        canvas.height = 140 * dpr;
        canvas.style.height = '140px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        self._sigPad = { canvas, ctx, drawing: false, hasContent: false };

        // If existing sig, render it dimly (user can draw over to replace)
        if (existingSig) {
            const img = new Image();
            img.onload = () => { ctx.globalAlpha = 0.3; ctx.drawImage(img, 0, 0, w, 140); ctx.globalAlpha = 1; };
            img.src = existingSig;
        }

        const getPos = e => {
            const r = canvas.getBoundingClientRect();
            const src = e.touches ? e.touches[0] : e;
            return { x: src.clientX - r.left, y: src.clientY - r.top };
        };

        canvas.addEventListener('mousedown', e => { self._sigPad.drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
        canvas.addEventListener('mousemove', e => { if (!self._sigPad.drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#1a2744'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke(); self._sigPad.hasContent = true; });
        canvas.addEventListener('mouseup',   () => { self._sigPad.drawing = false; });
        canvas.addEventListener('touchstart', e => { e.preventDefault(); self._sigPad.drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }, { passive: false });
        canvas.addEventListener('touchmove',  e => { e.preventDefault(); if (!self._sigPad.drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#1a2744'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke(); self._sigPad.hasContent = true; }, { passive: false });
        canvas.addEventListener('touchend',  () => { self._sigPad.drawing = false; });
    },

    _clearSig() {
        const self = this;
        if (!self._sigPad) return;
        const { canvas, ctx } = self._sigPad;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        self._sigPad.hasContent = false;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    _fmtDate(d) {
        if (!d) return '—';
        try { return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
        catch(e) { return d; }
    }
};
