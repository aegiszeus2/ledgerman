// WorkerSafety — Worker portal Health & Safety module
// Endpoints used: /api/worker/safety/*  (worker-scoped, tenant-isolated)
// Workers can: report hazards, report incidents, view+ack toolbox talks,
//              view+ack assigned JHAs, and review their own submissions.
// Workers CANNOT: read other workers' records, approve/close/review records.

window.WorkerSafety = {

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
    _activeTab: 'report',   // 'report' | 'toolbox' | 'jha' | 'submissions'
    _subView: null,         // null | 'log-hazard' | 'report-incident'

    // ── Entry point ──────────────────────────────────────────────────────────

    render(container, worker) {
        this._container = container;
        this._worker    = worker;
        this._subView   = null;
        this._renderShell();
    },

    // ── Shell / Tab bar ──────────────────────────────────────────────────────

    _renderShell() {
        const self = this;
        const container = self._container;
        const at = self._activeTab;

        const tabs = [
            { id: 'report',      label: '⚠️ Report' },
            { id: 'toolbox',     label: '📋 Toolbox' },
            { id: 'jha',         label: '📝 JHAs' },
            { id: 'submissions', label: '📁 My Submissions' },
        ];

        container.innerHTML = `
            <div style="padding:0 0 12px 0">
                <h2 style="margin:0 0 4px 0;font-size:1.3rem">Safety</h2>
                <p style="margin:0;color:var(--text2);font-size:.85rem">Report hazards, incidents, and acknowledge safety briefings.</p>
            </div>
            <!-- Tab Bar -->
            <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;overflow-x:auto">
                ${tabs.map(t => `
                <button data-tab="${t.id}"
                    style="padding:8px 14px;border:none;cursor:pointer;font-size:.85rem;font-weight:600;white-space:nowrap;
                    border-bottom:3px solid ${at === t.id ? 'var(--primary)' : 'transparent'};
                    background:transparent;color:${at === t.id ? 'var(--primary)' : 'var(--text2)'};margin-bottom:-2px">
                    ${t.label}
                </button>`).join('')}
            </div>
            <div id="workerSafetyContent"></div>
        `;

        tabs.forEach(t => {
            container.querySelector(`[data-tab="${t.id}"]`).onclick = () => {
                self._activeTab = t.id;
                self._subView   = null;
                self._renderShell();
            };
        });

        switch (at) {
            case 'report':      self._subView ? self._renderSubView() : self._renderReportMenu(); break;
            case 'toolbox':     self._renderToolbox();    break;
            case 'jha':         self._renderJHA();        break;
            case 'submissions': self._renderSubmissions(); break;
        }
    },

    _renderSubView() {
        const self = this;
        if (self._subView === 'log-hazard')      self._renderHazardForm();
        else if (self._subView === 'report-incident') self._renderIncidentForm();
        else self._renderReportMenu();
    },

    // ── Report Menu ──────────────────────────────────────────────────────────

    _renderReportMenu() {
        const self = this;
        const content = document.getElementById('workerSafetyContent');

        content.innerHTML = `
            <div style="max-width:480px">
                <p style="color:var(--text2);margin-bottom:20px;font-size:.9rem">
                    Use the buttons below to report a site hazard or incident/near miss.
                    Your submission will be reviewed by your supervisor.
                </p>

                <div style="display:grid;gap:14px">
                    <button id="btnLogHazard"
                        style="display:flex;align-items:center;gap:14px;padding:18px 20px;background:var(--card);
                        border:2px solid var(--border);border-radius:10px;cursor:pointer;text-align:left;
                        transition:border-color .15s">
                        <span style="font-size:2rem;line-height:1">⚠️</span>
                        <div>
                            <div style="font-weight:600;font-size:1rem;color:var(--text-primary)">Log Hazard Observation</div>
                            <div style="font-size:.83rem;color:var(--text2);margin-top:2px">Report an unsafe condition or potential hazard on site.</div>
                        </div>
                    </button>

                    <button id="btnReportIncident"
                        style="display:flex;align-items:center;gap:14px;padding:18px 20px;background:var(--card);
                        border:2px solid var(--border);border-radius:10px;cursor:pointer;text-align:left;
                        transition:border-color .15s">
                        <span style="font-size:2rem;line-height:1">🚨</span>
                        <div>
                            <div style="font-weight:600;font-size:1rem;color:var(--text-primary)">Report Incident / Near Miss</div>
                            <div style="font-size:.83rem;color:var(--text2);margin-top:2px">Report an injury, near miss, or any safety-related event.</div>
                        </div>
                    </button>
                </div>

                <div style="margin-top:20px;padding:12px 14px;background:rgba(220,53,69,.06);border:1px solid rgba(220,53,69,.2);border-radius:8px">
                    <p style="margin:0;font-size:.83rem;color:var(--text2)">
                        <strong style="color:#dc3545">Emergency?</strong> Call 911 immediately. Do not use this form in an emergency.
                    </p>
                </div>
            </div>
        `;

        document.getElementById('btnLogHazard').onclick = () => {
            self._subView = 'log-hazard';
            self._renderHazardForm();
        };
        document.getElementById('btnReportIncident').onclick = () => {
            self._subView = 'report-incident';
            self._renderIncidentForm();
        };
    },

    // ── Hazard Form ──────────────────────────────────────────────────────────

    _renderHazardForm() {
        const self = this;
        const content = document.getElementById('workerSafetyContent');
        const esc = Utils.escapeHtml;
        const today = new Date().toISOString().slice(0, 10);
        const workerName = (self._worker && (self._worker.name || self._worker.workerName)) || '';

        const hazardTypes = [
            'Slip/Trip/Fall', 'Struck By', 'Caught In/Between', 'Electrical',
            'Chemical/Hazardous Material', 'Ergonomic', 'Working at Heights',
            'Weather/Environmental', 'Equipment/Tool', 'Other'
        ];
        const severities = ['Low', 'Medium', 'High', 'Critical'];

        content.innerHTML = `
            <div style="max-width:520px">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
                    <button id="hazBackBtn" style="border:none;background:transparent;cursor:pointer;color:var(--text2);font-size:1.1rem;padding:4px">← Back</button>
                    <h3 style="margin:0;font-size:1.1rem">Log Hazard Observation</h3>
                </div>

                <form id="workerHazardForm" style="display:grid;gap:14px">
                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Date *</label>
                        <input type="date" id="whDate" value="${today}"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Hazard Type *</label>
                        <select id="whType" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                            ${hazardTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Severity *</label>
                        <select id="whSeverity" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                            ${severities.map(s => `<option value="${s}" ${s === 'Medium' ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Location</label>
                        <input type="text" id="whLocation" placeholder="e.g. Roof deck, West wall"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Description *</label>
                        <textarea id="whDescription" placeholder="Describe the hazard clearly..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:90px;resize:vertical" required></textarea>
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Your Name</label>
                        <input type="text" id="whReportedBy" value="${esc(workerName)}"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                    </div>

                    <div id="whStatus" style="padding:0"></div>

                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="hazBackBtn2" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary" id="whSubmitBtn">Submit Hazard Report</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('hazBackBtn').onclick = () => {
            self._subView = null;
            self._renderReportMenu();
        };
        document.getElementById('hazBackBtn2').onclick = () => {
            self._subView = null;
            self._renderReportMenu();
        };

        document.getElementById('workerHazardForm').onsubmit = async e => {
            e.preventDefault();
            const statusEl = document.getElementById('whStatus');
            const submitBtn = document.getElementById('whSubmitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting…';
            statusEl.innerHTML = '';

            const payload = {
                date:        document.getElementById('whDate').value,
                hazardType:  document.getElementById('whType').value,
                severity:    document.getElementById('whSeverity').value,
                location:    document.getElementById('whLocation').value.trim(),
                description: document.getElementById('whDescription').value.trim(),
                reportedBy:  document.getElementById('whReportedBy').value.trim(),
            };

            try {
                await self._api('POST', '/api/worker/safety/hazard', payload);
                statusEl.innerHTML = `<div style="padding:10px 12px;background:rgba(25,135,84,.1);border:1px solid rgba(25,135,84,.3);border-radius:6px;color:#198754;font-size:.9rem">
                    ✅ Hazard reported successfully. Your supervisor has been notified.
                </div>`;
                // Reset form after short delay
                setTimeout(() => {
                    self._subView = null;
                    self._renderReportMenu();
                }, 2000);
            } catch(err) {
                statusEl.innerHTML = `<div style="padding:10px 12px;background:rgba(220,53,69,.08);border:1px solid rgba(220,53,69,.3);border-radius:6px;color:#dc3545;font-size:.9rem">
                    ⚠️ ${Utils.escapeHtml(err.message)}
                </div>`;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Hazard Report';
            }
        };
    },

    // ── Incident Form ────────────────────────────────────────────────────────

    _renderIncidentForm() {
        const self = this;
        const content = document.getElementById('workerSafetyContent');
        const esc = Utils.escapeHtml;
        const today = new Date().toISOString().slice(0, 10);
        const workerName = (self._worker && (self._worker.name || self._worker.workerName)) || '';

        const incidentTypes = ['Near Miss', 'First Aid', 'Medical Aid', 'Lost Time', 'Property Damage', 'Environmental', 'Other'];
        const severities = ['Minor', 'Moderate', 'Serious', 'Critical'];

        content.innerHTML = `
            <div style="max-width:520px">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
                    <button id="incBackBtn" style="border:none;background:transparent;cursor:pointer;color:var(--text2);font-size:1.1rem;padding:4px">← Back</button>
                    <h3 style="margin:0;font-size:1.1rem">Report Incident / Near Miss</h3>
                </div>

                <div style="padding:10px 14px;background:rgba(220,53,69,.06);border:1px solid rgba(220,53,69,.2);border-radius:8px;margin-bottom:16px">
                    <p style="margin:0;font-size:.83rem;color:#dc3545"><strong>Emergency?</strong> Call 911 first. This form is for non-emergency reporting only.</p>
                </div>

                <form id="workerIncidentForm" style="display:grid;gap:14px">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Date *</label>
                            <input type="date" id="wiDate" value="${today}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Time</label>
                            <input type="time" id="wiTime"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Incident Type *</label>
                            <select id="wiType" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                                ${incidentTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Severity *</label>
                            <select id="wiSeverity" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                                ${severities.map(s => `<option value="${s}" ${s === 'Minor' ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Location</label>
                        <input type="text" id="wiLocation" placeholder="Where did this occur?"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Description *</label>
                        <textarea id="wiDescription" placeholder="Describe what happened in detail..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:100px;resize:vertical" required></textarea>
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Workers Involved <span style="font-weight:400;color:var(--text2)">(comma-separated)</span></label>
                        <input type="text" id="wiWorkersInvolved" placeholder="Names of any workers involved"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Reported By *</label>
                        <input type="text" id="wiReportedBy" value="${esc(workerName)}"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                    </div>

                    <div id="wiStatus" style="padding:0"></div>

                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="incBackBtn2" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary" id="wiSubmitBtn">Submit Incident Report</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('incBackBtn').onclick = () => {
            self._subView = null;
            self._renderReportMenu();
        };
        document.getElementById('incBackBtn2').onclick = () => {
            self._subView = null;
            self._renderReportMenu();
        };

        document.getElementById('workerIncidentForm').onsubmit = async e => {
            e.preventDefault();
            const statusEl = document.getElementById('wiStatus');
            const submitBtn = document.getElementById('wiSubmitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting…';
            statusEl.innerHTML = '';

            const payload = {
                date:             document.getElementById('wiDate').value,
                time:             document.getElementById('wiTime').value || null,
                incidentType:     document.getElementById('wiType').value,
                severity:         document.getElementById('wiSeverity').value,
                location:         document.getElementById('wiLocation').value.trim(),
                description:      document.getElementById('wiDescription').value.trim(),
                workersInvolved:  document.getElementById('wiWorkersInvolved').value.trim(),
                reportedBy:       document.getElementById('wiReportedBy').value.trim(),
            };

            try {
                await self._api('POST', '/api/worker/safety/incident', payload);
                statusEl.innerHTML = `<div style="padding:10px 12px;background:rgba(25,135,84,.1);border:1px solid rgba(25,135,84,.3);border-radius:6px;color:#198754;font-size:.9rem">
                    ✅ Incident reported successfully. Your supervisor has been notified.
                </div>`;
                setTimeout(() => {
                    self._subView = null;
                    self._renderReportMenu();
                }, 2500);
            } catch(err) {
                statusEl.innerHTML = `<div style="padding:10px 12px;background:rgba(220,53,69,.08);border:1px solid rgba(220,53,69,.3);border-radius:6px;color:#dc3545;font-size:.9rem">
                    ⚠️ ${Utils.escapeHtml(err.message)}
                </div>`;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Incident Report';
            }
        };
    },

    // ── Toolbox Talks ────────────────────────────────────────────────────────

    async _renderToolbox() {
        const self = this;
        const content = document.getElementById('workerSafetyContent');
        const esc = Utils.escapeHtml;

        content.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">Loading toolbox talks…</div>';

        let talks = [];
        try {
            talks = await self._api('GET', '/api/worker/safety/toolbox-talks');
        } catch(e) {
            content.innerHTML = `<div style="padding:12px 14px;background:rgba(220,53,69,.08);border:1px solid rgba(220,53,69,.3);border-radius:8px;color:#dc3545">
                ⚠️ ${esc(e.message)}
            </div>`;
            return;
        }

        if (talks.length === 0) {
            content.innerHTML = `
                <div style="padding:40px;text-align:center;color:var(--text2)">
                    <div style="font-size:2rem;margin-bottom:8px">📋</div>
                    <div style="font-weight:500">No toolbox talks yet</div>
                    <div style="font-size:.85rem;margin-top:4px">Your supervisor will post toolbox talks here for you to review and acknowledge.</div>
                </div>`;
            return;
        }

        const pending = talks.filter(t => !t._worker_acknowledged);
        const done    = talks.filter(t => t._worker_acknowledged);

        content.innerHTML = `
            ${pending.length > 0 ? `
            <div style="margin-bottom:8px;font-weight:600;font-size:.9rem;color:#fd7e14">
                ⚠️ ${pending.length} talk${pending.length > 1 ? 's' : ''} require${pending.length === 1 ? 's' : ''} acknowledgement
            </div>` : `
            <div style="margin-bottom:12px;font-weight:500;font-size:.9rem;color:#198754">✅ All talks acknowledged</div>`}

            <div id="ttTalkList" style="display:grid;gap:12px"></div>
        `;

        const listEl = document.getElementById('ttTalkList');
        talks.forEach(talk => {
            const acked = talk._worker_acknowledged;
            const card = document.createElement('div');
            card.style.cssText = `padding:16px;background:var(--card);border:1px solid ${acked ? 'var(--border)' : '#fd7e14'};border-radius:8px`;
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
                    <div style="flex:1">
                        <div style="font-weight:600;font-size:.95rem">${esc(talk.topic || 'Toolbox Talk')}</div>
                        <div style="font-size:.82rem;color:var(--text2);margin-top:4px">
                            ${esc(talk.date || '—')} · ${esc(talk.conductedBy || '—')}
                            ${talk.duration ? ` · ${talk.duration} min` : ''}
                        </div>
                        ${talk.notes ? `<div style="font-size:.85rem;color:var(--text2);margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">${esc(talk.notes)}</div>` : ''}
                    </div>
                    <div style="flex-shrink:0">
                        ${acked
                            ? `<span style="padding:5px 12px;border-radius:20px;font-size:.78rem;font-weight:600;background:#198754;color:white">✓ Acknowledged</span>`
                            : `<button class="btn-primary" style="font-size:.82rem;padding:6px 14px" data-ack-tt="${esc(talk.id)}">Acknowledge</button>`
                        }
                    </div>
                </div>
            `;
            listEl.appendChild(card);
        });

        listEl.querySelectorAll('[data-ack-tt]').forEach(btn => {
            btn.onclick = async () => {
                const talkId = btn.dataset.ackTt;
                btn.disabled = true;
                btn.textContent = '…';
                try {
                    await self._api('POST', '/api/worker/safety/toolbox-acknowledgement', { toolboxTalkId: talkId });
                    Utils.showToast('Talk acknowledged', 'success');
                    self._renderToolbox();
                } catch(err) {
                    Utils.showToast(err.message, 'error');
                    btn.disabled = false;
                    btn.textContent = 'Acknowledge';
                }
            };
        });
    },

    // ── JHA / FLHA ───────────────────────────────────────────────────────────

    async _renderJHA() {
        const self = this;
        const content = document.getElementById('workerSafetyContent');
        const esc = Utils.escapeHtml;

        content.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">Loading JHA/FLHA records…</div>';

        let jhas = [];
        try {
            jhas = await self._api('GET', '/api/worker/safety/jha');
        } catch(e) {
            content.innerHTML = `<div style="padding:12px 14px;background:rgba(220,53,69,.08);border:1px solid rgba(220,53,69,.3);border-radius:8px;color:#dc3545">
                ⚠️ ${esc(e.message)}
            </div>`;
            return;
        }

        if (jhas.length === 0) {
            content.innerHTML = `
                <div style="padding:40px;text-align:center;color:var(--text2)">
                    <div style="font-size:2rem;margin-bottom:8px">📝</div>
                    <div style="font-weight:500">No JHAs assigned</div>
                    <div style="font-size:.85rem;margin-top:4px">JHA/FLHA records assigned to you will appear here for review and acknowledgement.</div>
                </div>`;
            return;
        }

        const pending = jhas.filter(j => !j._worker_acknowledged);

        content.innerHTML = `
            ${pending.length > 0 ? `
            <div style="margin-bottom:8px;font-weight:600;font-size:.9rem;color:#fd7e14">
                ⚠️ ${pending.length} JHA${pending.length > 1 ? 's' : ''} require${pending.length === 1 ? 's' : ''} acknowledgement
            </div>` : `
            <div style="margin-bottom:12px;font-weight:500;font-size:.9rem;color:#198754">✅ All JHAs acknowledged</div>`}

            <div id="jhaList" style="display:grid;gap:12px"></div>
        `;

        const listEl = document.getElementById('jhaList');
        jhas.forEach(jha => {
            const acked = jha._worker_acknowledged;
            const hazardsArr = Array.isArray(jha.hazards) ? jha.hazards : (jha.hazards ? [jha.hazards] : []);
            const controlsArr = Array.isArray(jha.controls) ? jha.controls : (jha.controls ? [jha.controls] : []);

            const card = document.createElement('div');
            card.style.cssText = `padding:16px;background:var(--card);border:1px solid ${acked ? 'var(--border)' : '#fd7e14'};border-radius:8px`;
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px">
                    <div>
                        <div style="font-weight:600;font-size:.95rem">${esc(jha.jobTitle || jha.task || 'JHA/FLHA')}</div>
                        <div style="font-size:.82rem;color:var(--text2);margin-top:3px">
                            ${esc(jha.date || '—')} · Conducted by: ${esc(jha.conductedBy || '—')}
                        </div>
                    </div>
                    <div style="flex-shrink:0">
                        ${acked
                            ? `<span style="padding:5px 12px;border-radius:20px;font-size:.78rem;font-weight:600;background:#198754;color:white">✓ Acknowledged</span>`
                            : `<button class="btn-primary" style="font-size:.82rem;padding:6px 14px" data-ack-jha="${esc(jha.id)}">Sign Off</button>`
                        }
                    </div>
                </div>
                ${hazardsArr.length > 0 ? `
                <div style="padding:10px;background:rgba(220,53,69,.05);border-radius:6px;margin-bottom:8px">
                    <div style="font-size:.8rem;font-weight:600;color:#dc3545;margin-bottom:4px">IDENTIFIED HAZARDS</div>
                    <ul style="margin:0;padding-left:18px">
                        ${hazardsArr.map(h => `<li style="font-size:.85rem;color:var(--text2);margin-bottom:2px">${esc(h)}</li>`).join('')}
                    </ul>
                </div>` : ''}
                ${controlsArr.length > 0 ? `
                <div style="padding:10px;background:rgba(25,135,84,.05);border-radius:6px">
                    <div style="font-size:.8rem;font-weight:600;color:#198754;margin-bottom:4px">CONTROLS / MITIGATIONS</div>
                    <ul style="margin:0;padding-left:18px">
                        ${controlsArr.map(c => `<li style="font-size:.85rem;color:var(--text2);margin-bottom:2px">${esc(c)}</li>`).join('')}
                    </ul>
                </div>` : ''}
                ${jha.notes ? `<div style="font-size:.83rem;color:var(--text2);margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">${esc(jha.notes)}</div>` : ''}
            `;
            listEl.appendChild(card);
        });

        listEl.querySelectorAll('[data-ack-jha]').forEach(btn => {
            btn.onclick = async () => {
                const jhaId = btn.dataset.ackJha;
                btn.disabled = true;
                btn.textContent = '…';
                try {
                    await self._api('POST', '/api/worker/safety/jha-acknowledgement', { jhaRecordId: jhaId });
                    Utils.showToast('JHA acknowledged', 'success');
                    self._renderJHA();
                } catch(err) {
                    Utils.showToast(err.message, 'error');
                    btn.disabled = false;
                    btn.textContent = 'Sign Off';
                }
            };
        });
    },

    // ── My Submissions ───────────────────────────────────────────────────────

    async _renderSubmissions() {
        const self = this;
        const content = document.getElementById('workerSafetyContent');
        const esc = Utils.escapeHtml;

        content.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">Loading your submissions…</div>';

        let data = { hazards: [], incidents: [], jha_acks: [], toolbox_acks: [] };
        try {
            data = await self._api('GET', '/api/worker/safety/my-submissions');
        } catch(e) {
            content.innerHTML = `<div style="padding:12px 14px;background:rgba(220,53,69,.08);border:1px solid rgba(220,53,69,.3);border-radius:8px;color:#dc3545">
                ⚠️ ${esc(e.message)}
            </div>`;
            return;
        }

        const hazards   = data.hazards   || [];
        const incidents = data.incidents  || [];
        const jhaAcks   = data.jha_acks  || [];
        const ttAcks    = data.toolbox_acks || [];

        const sevColors = { Low: '#198754', Medium: '#fd7e14', High: '#dc3545', Critical: '#6f0000' };
        const incSevColors = { Minor: '#6c757d', Moderate: '#fd7e14', Serious: '#dc3545', Critical: '#6f0000' };

        function badge(val, colors) {
            const c = colors[val] || '#6c757d';
            return `<span style="padding:2px 8px;border-radius:10px;font-size:.73rem;font-weight:600;background:${c};color:white">${esc(val || '—')}</span>`;
        }

        const total = hazards.length + incidents.length;

        if (total === 0 && jhaAcks.length === 0 && ttAcks.length === 0) {
            content.innerHTML = `
                <div style="padding:40px;text-align:center;color:var(--text2)">
                    <div style="font-size:2rem;margin-bottom:8px">📁</div>
                    <div style="font-weight:500">No submissions yet</div>
                    <div style="font-size:.85rem;margin-top:4px">Your hazard and incident reports will appear here.</div>
                </div>`;
            return;
        }

        content.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px">
                <div style="padding:12px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="font-size:.75rem;color:var(--text2);text-transform:uppercase;margin-bottom:3px">Hazards</div>
                    <div style="font-size:1.5rem;font-weight:700">${hazards.length}</div>
                </div>
                <div style="padding:12px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="font-size:.75rem;color:var(--text2);text-transform:uppercase;margin-bottom:3px">Incidents</div>
                    <div style="font-size:1.5rem;font-weight:700">${incidents.length}</div>
                </div>
                <div style="padding:12px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="font-size:.75rem;color:var(--text2);text-transform:uppercase;margin-bottom:3px">JHA Acks</div>
                    <div style="font-size:1.5rem;font-weight:700;color:#198754">${jhaAcks.length}</div>
                </div>
                <div style="padding:12px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="font-size:.75rem;color:var(--text2);text-transform:uppercase;margin-bottom:3px">Talk Acks</div>
                    <div style="font-size:1.5rem;font-weight:700;color:#198754">${ttAcks.length}</div>
                </div>
            </div>

            ${hazards.length > 0 ? `
            <div style="margin-bottom:20px">
                <h4 style="margin:0 0 10px 0;font-size:.95rem;color:var(--text2)">Hazard Observations</h4>
                <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                    <table style="width:100%;border-collapse:collapse;font-size:.88rem">
                        <thead>
                            <tr style="background:var(--card)">
                                <th style="padding:9px 12px;text-align:left;border-bottom:1px solid var(--border)">Date</th>
                                <th style="padding:9px 12px;text-align:left;border-bottom:1px solid var(--border)">Type</th>
                                <th style="padding:9px 12px;text-align:left;border-bottom:1px solid var(--border)">Description</th>
                                <th style="padding:9px 12px;text-align:center;border-bottom:1px solid var(--border)">Severity</th>
                                <th style="padding:9px 12px;text-align:center;border-bottom:1px solid var(--border)">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${hazards.map(h => {
                                const desc = (h.description || '').length > 55 ? h.description.slice(0, 55) + '…' : (h.description || '—');
                                const statusColor = { Open: '#dc3545', Assigned: '#fd7e14', Resolved: '#198754', Closed: '#6c757d' };
                                return `<tr style="border-bottom:1px solid var(--border)">
                                    <td style="padding:8px 12px;white-space:nowrap">${esc(h.date || '—')}</td>
                                    <td style="padding:8px 12px">${esc(h.hazardType || '—')}</td>
                                    <td style="padding:8px 12px;max-width:200px">${esc(desc)}</td>
                                    <td style="padding:8px 12px;text-align:center">${badge(h.severity, sevColors)}</td>
                                    <td style="padding:8px 12px;text-align:center">${badge(h.status, statusColor)}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>` : ''}

            ${incidents.length > 0 ? `
            <div style="margin-bottom:20px">
                <h4 style="margin:0 0 10px 0;font-size:.95rem;color:var(--text2)">Incident Reports</h4>
                <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                    <table style="width:100%;border-collapse:collapse;font-size:.88rem">
                        <thead>
                            <tr style="background:var(--card)">
                                <th style="padding:9px 12px;text-align:left;border-bottom:1px solid var(--border)">Date</th>
                                <th style="padding:9px 12px;text-align:left;border-bottom:1px solid var(--border)">Type</th>
                                <th style="padding:9px 12px;text-align:left;border-bottom:1px solid var(--border)">Description</th>
                                <th style="padding:9px 12px;text-align:center;border-bottom:1px solid var(--border)">Severity</th>
                                <th style="padding:9px 12px;text-align:center;border-bottom:1px solid var(--border)">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${incidents.map(i => {
                                const desc = (i.description || '').length > 55 ? i.description.slice(0, 55) + '…' : (i.description || '—');
                                const statusColor = { Draft: '#6c757d', Open: '#dc3545', 'Under Review': '#fd7e14', 'Corrective Action Required': '#fd7e14', Closed: '#198754', Submitted: '#0d6efd' };
                                return `<tr style="border-bottom:1px solid var(--border)">
                                    <td style="padding:8px 12px;white-space:nowrap">${esc(i.date || '—')}</td>
                                    <td style="padding:8px 12px">${esc(i.incidentType || '—')}</td>
                                    <td style="padding:8px 12px;max-width:200px">${esc(desc)}</td>
                                    <td style="padding:8px 12px;text-align:center">${badge(i.severity, incSevColors)}</td>
                                    <td style="padding:8px 12px;text-align:center">${badge(i.status, statusColor)}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>` : ''}

            ${(jhaAcks.length > 0 || ttAcks.length > 0) ? `
            <div>
                <h4 style="margin:0 0 10px 0;font-size:.95rem;color:var(--text2)">Acknowledgements</h4>
                <div style="display:grid;gap:8px">
                    ${jhaAcks.map(a => `
                    <div style="padding:10px 14px;background:var(--card);border:1px solid var(--border);border-radius:6px;display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <span style="font-size:.82rem;font-weight:600;color:#0d6efd">JHA</span>
                            <span style="font-size:.85rem;color:var(--text2);margin-left:8px">${esc(a.jhaRecordId || '—')}</span>
                        </div>
                        <span style="font-size:.78rem;color:var(--text2)">${esc((a.created_at || '').slice(0,10) || '—')}</span>
                    </div>`).join('')}
                    ${ttAcks.map(a => `
                    <div style="padding:10px 14px;background:var(--card);border:1px solid var(--border);border-radius:6px;display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <span style="font-size:.82rem;font-weight:600;color:#198754">Talk</span>
                            <span style="font-size:.85rem;color:var(--text2);margin-left:8px">${esc(a.toolboxTalkId || '—')}</span>
                        </div>
                        <span style="font-size:.78rem;color:var(--text2)">${esc((a.created_at || '').slice(0,10) || '—')}</span>
                    </div>`).join('')}
                </div>
            </div>` : ''}
        `;
    },
};
