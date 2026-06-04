// WorkerSafety — Worker portal Health & Safety module
// Endpoints used: /api/worker/safety/*  (worker-scoped, tenant-isolated)
//                /api/worker/coworkers  (company roster for JHA assignee picker)
// Workers can: report hazards, report incidents, view+ack toolbox talks,
//              view+ack assigned JHAs, and review their own submissions.
// Supervisors/Approvers additionally: create JHAs and assign them for sign-off.
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
            talks = (await self._api('GET', '/api/worker/safety/toolbox-talks')).toolbox_talks || [];
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
        const isSupervisor = self._worker &&
            (self._worker.role === 'Supervisor' || self._worker.role === 'Approver');

        content.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">Loading JHA/FLHA records…</div>';

        let jhas = [];
        try {
            const resp = await self._api('GET', '/api/worker/safety/jha');
            jhas = resp.jha_records || [];
        } catch(e) {
            content.innerHTML = `<div style="padding:12px 14px;background:rgba(220,53,69,.08);border:1px solid rgba(220,53,69,.3);border-radius:8px;color:#dc3545">
                ⚠️ ${esc(e.message)}
            </div>`;
            return;
        }

        // Separate: JHAs created by this supervisor vs. JHAs assigned to this user
        const createdByMe  = isSupervisor ? jhas.filter(j => j._created_by_me) : [];
        const assignedToMe = jhas.filter(j => !j._created_by_me);
        const pending      = assignedToMe.filter(j => !j._worker_acknowledged);

        let html = '';

        // Supervisor action bar
        if (isSupervisor) {
            html += `
            <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
                <button id="jhaCreateBtn" class="btn-primary" style="font-size:.88rem;padding:8px 16px">+ Create JHA / FLHA</button>
            </div>`;
        }

        // Assigned to me section
        if (assignedToMe.length === 0) {
            html += `
            <div style="padding:${createdByMe.length > 0 ? '16px' : '40px'};text-align:center;color:var(--text2);border:1px solid var(--border);border-radius:8px;margin-bottom:${createdByMe.length > 0 ? '20px' : '0'}">
                <div style="font-size:${createdByMe.length > 0 ? '1.4rem' : '2rem'};margin-bottom:6px">📝</div>
                <div style="font-weight:500">No JHAs assigned to you</div>
                <div style="font-size:.85rem;margin-top:4px">JHA/FLHA records assigned to you will appear here for review and sign-off.</div>
            </div>`;
        } else {
            html += `
            ${pending.length > 0
                ? `<div style="margin-bottom:8px;font-weight:600;font-size:.9rem;color:#fd7e14">⚠️ ${pending.length} JHA${pending.length > 1 ? 's' : ''} require${pending.length === 1 ? 's' : ''} sign-off</div>`
                : `<div style="margin-bottom:12px;font-weight:500;font-size:.9rem;color:#198754">✅ All JHAs signed</div>`}
            <div id="jhaList" style="display:grid;gap:12px;margin-bottom:${createdByMe.length > 0 ? '28px' : '0'}"></div>`;
        }

        // Created by me section (supervisor only)
        if (createdByMe.length > 0) {
            html += `
            <div style="border-top:1px solid var(--border);padding-top:20px">
                <h4 style="margin:0 0 12px 0;font-size:.95rem;font-weight:600;color:var(--text-primary)">JHAs You Created</h4>
                <div id="jhaCreatedList" style="display:grid;gap:12px"></div>
            </div>`;
        }

        content.innerHTML = html;

        // Render assigned JHAs
        if (assignedToMe.length > 0) {
            const listEl = document.getElementById('jhaList');
            assignedToMe.forEach(jha => {
                const acked = jha._worker_acknowledged;
                const hazardsArr  = Array.isArray(jha.hazards)  ? jha.hazards  : (jha.hazards  ? [jha.hazards]  : []);
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
                                ? `<span style="padding:5px 12px;border-radius:20px;font-size:.78rem;font-weight:600;background:#198754;color:white">✓ Signed</span>`
                                : `<button class="btn-primary" style="font-size:.82rem;padding:6px 14px" data-ack-jha="${esc(jha.id)}">Sign Off</button>`}
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
                        Utils.showToast('JHA signed', 'success');
                        self._renderJHA();
                    } catch(err) {
                        Utils.showToast(err.message, 'error');
                        btn.disabled = false;
                        btn.textContent = 'Sign Off';
                    }
                };
            });
        }

        // Render supervisor-created JHAs with signature status
        if (createdByMe.length > 0) {
            const createdEl = document.getElementById('jhaCreatedList');
            createdByMe.forEach(jha => {
                const assigned    = Array.isArray(jha.assignedWorkers) ? jha.assignedWorkers : [];
                const ackStatus   = jha._ack_status || [];
                const signedCount = ackStatus.length;
                const totalCount  = jha._assignee_count != null ? jha._assignee_count : assigned.length;
                const allSigned   = totalCount > 0 && signedCount >= totalCount;
                const hazardsArr  = Array.isArray(jha.hazards) ? jha.hazards : [];
                const controlsArr = Array.isArray(jha.controls) ? jha.controls : [];
                const card = document.createElement('div');
                card.style.cssText = 'padding:16px;background:var(--card);border:1px solid var(--border);border-radius:8px';
                card.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px">
                        <div>
                            <div style="font-weight:600;font-size:.95rem">${esc(jha.jobTitle || jha.task || 'JHA/FLHA')}</div>
                            <div style="font-size:.82rem;color:var(--text2);margin-top:3px">
                                ${esc(jha.date || '—')} · ${totalCount} assignee${totalCount !== 1 ? 's' : ''}
                            </div>
                        </div>
                        <span style="padding:5px 12px;border-radius:20px;font-size:.78rem;font-weight:600;flex-shrink:0;
                            background:${allSigned ? '#198754' : signedCount > 0 ? '#fd7e14' : '#6c757d'};color:white">
                            ${signedCount}/${totalCount} signed
                        </span>
                    </div>
                    ${hazardsArr.length > 0 ? `
                    <div style="padding:8px 10px;background:rgba(220,53,69,.05);border-radius:6px;margin-bottom:8px">
                        <div style="font-size:.78rem;font-weight:600;color:#dc3545;margin-bottom:3px">HAZARDS</div>
                        ${hazardsArr.map(h => `<div style="font-size:.82rem;color:var(--text2)">${esc(h)}</div>`).join('')}
                    </div>` : ''}
                    ${ackStatus.length > 0 ? `
                    <div style="padding:8px 10px;background:rgba(25,135,84,.05);border-radius:6px">
                        <div style="font-size:.78rem;font-weight:600;color:#198754;margin-bottom:4px">SIGNED BY</div>
                        ${ackStatus.map(a => `
                        <div style="font-size:.82rem;color:var(--text2);display:flex;justify-content:space-between">
                            <span>${esc(a.workerName || '—')}</span>
                            <span style="color:var(--text2);font-size:.75rem">${esc((a.acknowledgedAt || '').slice(0,10) || '—')}</span>
                        </div>`).join('')}
                    </div>` : (totalCount > 0 ? '<div style="font-size:.82rem;color:var(--text2);margin-top:4px">No signatures yet.</div>' : '')}
                    ${jha.notes ? `<div style="font-size:.83rem;color:var(--text2);margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">${esc(jha.notes)}</div>` : ''}
                    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);text-align:right">
                        <button class="btn-secondary" style="font-size:.78rem;padding:4px 12px" data-edit-jha="${esc(jha.id)}">✏️ Edit</button>
                    </div>
                `;
                createdEl.appendChild(card);
            });
        }

        // Create button handler (supervisor only)
        if (isSupervisor) {
            const createBtn = document.getElementById('jhaCreateBtn');
            if (createBtn) createBtn.onclick = () => self._showJHAForm(null);
        }

        // Edit button handlers — pass the full JHA object
        content.querySelectorAll('[data-edit-jha]').forEach(btn => {
            btn.onclick = () => {
                const jhaId = btn.dataset.editJha;
                const jha   = jhas.find(j => j.id === jhaId);
                if (jha) self._showJHAForm(jha);
            };
        });
    },

    // ── JHA Creation Form (Supervisor / Approver only) ────────────────────────

    // jha = null → create mode; jha = object → edit mode (supervisor's own JHA only)
    async _showJHAForm(jha) {
        const self    = this;
        const isEdit  = !!jha;
        const content = document.getElementById('workerSafetyContent');
        const esc     = Utils.escapeHtml;
        const today   = new Date().toISOString().slice(0, 10);
        const supervisorName = (self._worker && (self._worker.name || self._worker.workerName)) || '';
        const supervisorId   = (self._worker && self._worker.id) || '';

        content.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">Loading…</div>';

        // Fetch company roster for assignee picker
        let coworkers = [];
        try {
            const resp = await self._api('GET', '/api/worker/coworkers');
            coworkers = resp.workers || [];
        } catch(_) { /* non-fatal — show empty picker */ }

        // Pre-fill values for edit mode
        const prefill = {
            date:            (jha && jha.date)        || today,
            projectId:       (jha && jha.projectId)   || '',
            jobTitle:        (jha && jha.jobTitle)     || '',
            conductedBy:     (jha && jha.conductedBy)  || supervisorName,
            hazards:         Array.isArray(jha && jha.hazards)  ? jha.hazards.join('\n')  : '',
            controls:        Array.isArray(jha && jha.controls) ? jha.controls.join('\n') : '',
            assignedWorkers: Array.isArray(jha && jha.assignedWorkers) ? jha.assignedWorkers : [],
            notes:           (jha && jha.notes) || '',
        };

        content.innerHTML = `
            <div style="max-width:560px">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">
                    <button id="jhaFormBackBtn" style="border:none;background:transparent;cursor:pointer;color:var(--text2);font-size:1.1rem;padding:4px">← Back</button>
                    <h3 style="margin:0;font-size:1.1rem">${isEdit ? 'Edit JHA / FLHA' : 'Create JHA / FLHA'}</h3>
                </div>

                <form id="workerJHAForm" style="display:grid;gap:14px">

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Date *</label>
                            <input type="date" id="jfDate" value="${esc(prefill.date)}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Project / Work Area</label>
                            <input type="text" id="jfProject" value="${esc(prefill.projectId)}" placeholder="e.g. Level 3 Framing"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Work Activity / Task *</label>
                        <input type="text" id="jfJobTitle" value="${esc(prefill.jobTitle)}" placeholder="e.g. Installing roof trusses at heights"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Conducted By</label>
                        <input type="text" id="jfConductedBy" value="${esc(prefill.conductedBy)}"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Identified Hazards <span style="font-weight:400;color:var(--text2)">(one per line)</span></label>
                        <textarea id="jfHazards" placeholder="e.g.&#10;Fall from heights&#10;Struck by falling objects&#10;Electrical contact"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:80px;resize:vertical">${esc(prefill.hazards)}</textarea>
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Controls / Mitigations <span style="font-weight:400;color:var(--text2)">(one per line)</span></label>
                        <textarea id="jfControls" placeholder="e.g.&#10;Install guardrails and safety nets&#10;Hard hats required&#10;LOTO procedures enforced"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:80px;resize:vertical">${esc(prefill.controls)}</textarea>
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Assign for Sign-Off</label>
                        <div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;background:var(--bg-primary);max-height:200px;overflow-y:auto">
                            ${coworkers.length === 0
                                ? '<div style="padding:12px;color:var(--text2);font-size:.85rem">No workers found in company roster.</div>'
                                : coworkers.map(w => `
                                <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:.88rem">
                                    <input type="checkbox" name="jfWorker" value="${esc(w.id)}"
                                        ${(isEdit ? prefill.assignedWorkers.includes(w.id) : w.id === supervisorId) ? 'checked' : ''}
                                        style="width:15px;height:15px;cursor:pointer;flex-shrink:0" />
                                    <span>${esc(w.name)}</span>
                                    ${(w.role && w.role !== 'Worker') ? `<span style="font-size:.73rem;color:var(--text2);margin-left:auto">${esc(w.role)}</span>` : ''}
                                </label>`).join('')}
                        </div>
                        <div style="font-size:.78rem;color:var(--text2);margin-top:4px">
                            ${isEdit ? 'Add or remove workers who must sign off.' : 'Select everyone who must review and sign this JHA before work begins.'}
                        </div>
                    </div>

                    <div>
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Notes</label>
                        <textarea id="jfNotes" placeholder="Additional safety instructions or notes…"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:60px;resize:vertical">${esc(prefill.notes)}</textarea>
                    </div>

                    <div id="jfStatus" style="padding:0"></div>

                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="jhaFormCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary" id="jfSubmitBtn">${isEdit ? 'Save Changes' : 'Create JHA / FLHA'}</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('jhaFormBackBtn').onclick   = () => self._renderJHA();
        document.getElementById('jhaFormCancelBtn').onclick = () => self._renderJHA();

        document.getElementById('workerJHAForm').onsubmit = async e => {
            e.preventDefault();
            const statusEl  = document.getElementById('jfStatus');
            const submitBtn = document.getElementById('jfSubmitBtn');
            submitBtn.disabled  = true;
            submitBtn.textContent = 'Creating…';
            statusEl.innerHTML  = '';

            const assignedWorkers = Array.from(
                document.querySelectorAll('input[name="jfWorker"]:checked')
            ).map(cb => cb.value);

            const payload = {
                date:            document.getElementById('jfDate').value,
                projectId:       document.getElementById('jfProject').value.trim() || null,
                jobTitle:        document.getElementById('jfJobTitle').value.trim(),
                conductedBy:     document.getElementById('jfConductedBy').value.trim(),
                hazards:         document.getElementById('jfHazards').value.split('\n').map(s => s.trim()).filter(Boolean),
                controls:        document.getElementById('jfControls').value.split('\n').map(s => s.trim()).filter(Boolean),
                assignedWorkers,
                notes:           document.getElementById('jfNotes').value.trim(),
            };

            try {
                if (isEdit) {
                    await self._api('PATCH', '/api/worker/safety/jha/' + jha.id, payload);
                    Utils.showToast('JHA updated', 'success');
                } else {
                    await self._api('POST', '/api/worker/safety/jha', payload);
                    Utils.showToast('JHA created', 'success');
                }
                self._renderJHA();
            } catch(err) {
                statusEl.innerHTML = `<div style="padding:10px 12px;background:rgba(220,53,69,.08);border:1px solid rgba(220,53,69,.3);border-radius:6px;color:#dc3545;font-size:.9rem">
                    ⚠️ ${esc(err.message)}
                </div>`;
                submitBtn.disabled    = false;
                submitBtn.textContent = isEdit ? 'Save Changes' : 'Create JHA / FLHA';
            }
        };
    },

    // ── My Submissions ───────────────────────────────────────────────────────

    async _renderSubmissions() {
        const self = this;
        const content = document.getElementById('workerSafetyContent');
        const esc = Utils.escapeHtml;

        content.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">Loading your submissions…</div>';

        let data = { hazard_observations: [], safety_incidents: [], jha_records: [], talk_acknowledgements: [] };
        try {
            data = await self._api('GET', '/api/worker/safety/my-submissions');
        } catch(e) {
            content.innerHTML = `<div style="padding:12px 14px;background:rgba(220,53,69,.08);border:1px solid rgba(220,53,69,.3);border-radius:8px;color:#dc3545">
                ⚠️ ${esc(e.message)}
            </div>`;
            return;
        }

        const hazards   = data.hazard_observations || [];
        const incidents = data.safety_incidents    || [];
        const allAcks   = data.talk_acknowledgements || [];
        const jhaAcks   = allAcks.filter(a => a.jhaRecordId);
        const ttAcks    = allAcks.filter(a => a.toolboxTalkId);

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
