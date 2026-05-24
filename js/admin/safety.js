// Admin Safety Module
// Two sub-sections: Incidents and Toolbox Talks

window.AdminSafety = {
    _activeTab: 'incidents',
    _filterProject: 'All',
    _filterStatus: 'All',
    _filterSeverity: 'All',
    _filterTTProject: 'All',
    _filterTTMonth: '',

    render(container) {
        const self = this;
        self._container = container;
        self._renderShell();
    },

    _renderShell() {
        const self = this;
        const container = self._container;

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <h2 style="margin:0 0 8px 0">Safety &amp; Incidents</h2>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Track site incidents, near misses, and toolbox talk records.</p>
            </div>
            <!-- Tab Bar -->
            <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:24px">
                <button id="tabIncidents" class="safety-tab" style="padding:9px 22px;border:none;cursor:pointer;font-size:.95rem;font-weight:600;border-bottom:3px solid ${self._activeTab === 'incidents' ? 'var(--primary)' : 'transparent'};background:transparent;color:${self._activeTab === 'incidents' ? 'var(--primary)' : 'var(--text2)'};margin-bottom:-2px">
                    Incidents
                </button>
                <button id="tabToolbox" class="safety-tab" style="padding:9px 22px;border:none;cursor:pointer;font-size:.95rem;font-weight:600;border-bottom:3px solid ${self._activeTab === 'toolbox' ? 'var(--primary)' : 'transparent'};background:transparent;color:${self._activeTab === 'toolbox' ? 'var(--primary)' : 'var(--text2)'};margin-bottom:-2px">
                    Toolbox Talks
                </button>
            </div>
            <div id="safetyTabContent"></div>
        `;

        document.getElementById('tabIncidents').onclick = () => {
            self._activeTab = 'incidents';
            self._renderShell();
        };
        document.getElementById('tabToolbox').onclick = () => {
            self._activeTab = 'toolbox';
            self._renderShell();
        };

        if (self._activeTab === 'incidents') {
            self._renderIncidents();
        } else {
            self._renderToolbox();
        }
    },

    // ===================== INCIDENTS =====================

    _renderIncidents() {
        const self = this;
        const content = document.getElementById('safetyTabContent');
        const esc = Utils.escapeHtml;

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allIncidents = AppData.getAll ? AppData.getAll('safety_incidents') : [];

        const totalCount = allIncidents.length;
        const openCount = allIncidents.filter(i => i.status === 'Open').length;
        const closedCount = allIncidents.filter(i => i.status === 'Closed').length;
        const lostTimeCount = allIncidents.filter(i => i.incidentType === 'Lost Time').length;

        const statuses = ['All', 'Draft', 'Open', 'Under Review', 'Corrective Action Required', 'Closed'];
        const severities = ['All', 'Minor', 'Moderate', 'Serious', 'Critical'];

        const filtered = allIncidents.filter(i => {
            const projMatch = self._filterProject === 'All' || i.projectId === self._filterProject;
            const statusMatch = self._filterStatus === 'All' || i.status === self._filterStatus;
            const sevMatch = self._filterSeverity === 'All' || i.severity === self._filterSeverity;
            return projMatch && statusMatch && sevMatch;
        }).sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));

        const projectMap = {};
        projects.forEach(p => { projectMap[p.id] = p.name; });

        const severityColors = { Minor: '#6c757d', Moderate: '#fd7e14', Serious: '#dc3545', Critical: '#6f0000' };
        const statusColors = { Draft: '#6c757d', Open: '#dc3545', 'Under Review': '#fd7e14', 'Corrective Action Required': '#fd7e14', Closed: '#198754' };

        function severityBadge(sev) {
            const color = severityColors[sev] || '#6c757d';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${color};color:white">${esc(sev || '—')}</span>`;
        }
        function statusBadge(status) {
            const color = statusColors[status] || '#6c757d';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${color};color:white">${esc(status || '—')}</span>`;
        }

        content.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <div></div>
                <button class="btn-primary" id="incAddBtn">+ Report Incident</button>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Total</div>
                    <div style="font-size:1.7rem;font-weight:700;color:var(--text-primary)">${totalCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid ${openCount > 0 ? '#dc3545' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Open</div>
                    <div style="font-size:1.7rem;font-weight:700;color:${openCount > 0 ? '#dc3545' : 'var(--text-primary)'}">${openCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Closed</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#198754">${closedCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid ${lostTimeCount > 0 ? '#6f0000' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Lost Time</div>
                    <div style="font-size:1.7rem;font-weight:700;color:${lostTimeCount > 0 ? '#dc3545' : 'var(--text-primary)'}">${lostTimeCount}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                    <select id="incFilterProject" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Status</label>
                    <select id="incFilterStatus" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Severity</label>
                    <select id="incFilterSeverity" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${severities.map(s => `<option value="${s}" ${self._filterSeverity === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse;font-size:.9rem">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Date</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Project</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Type</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Severity</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Reported By</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Status</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">WSIB?</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(i => {
                            const proj = projectMap[i.projectId] || (i.projectId || '—');
                            return `<tr style="border-bottom:1px solid var(--border)">
                                <td style="padding:10px 14px;white-space:nowrap">${esc(i.date || '—')}${i.time ? `<div style="font-size:.8rem;color:var(--text2)">${esc(i.time)}</div>` : ''}</td>
                                <td style="padding:10px 14px">${esc(proj)}</td>
                                <td style="padding:10px 14px">${esc(i.incidentType || '—')}</td>
                                <td style="padding:10px 14px;text-align:center">${severityBadge(i.severity)}</td>
                                <td style="padding:10px 14px">${esc(i.reportedBy || '—')}</td>
                                <td style="padding:10px 14px;text-align:center">${statusBadge(i.status)}</td>
                                <td style="padding:10px 14px;text-align:center">${i.wsibReportable ? '<span style="color:#dc3545;font-weight:700;font-size:.85rem">Yes</span>' : '<span style="color:var(--text2);font-size:.85rem">No</span>'}</td>
                                <td style="padding:10px 14px;text-align:center;white-space:nowrap">
                                    <button class="btn-secondary btn-sm" data-id="${esc(i.id)}" data-action="edit-inc" style="font-size:.75rem">Edit</button>
                                    <button class="btn-secondary btn-sm" data-id="${esc(i.id)}" data-action="delete-inc" style="font-size:.75rem;margin-left:4px">Delete</button>
                                </td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="8" style="padding:36px;text-align:center;color:var(--text2)">No incidents recorded${allIncidents.length > 0 ? ' matching filters' : '. Report incidents to begin tracking.'}.</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('incFilterProject').onchange = e => { self._filterProject = e.target.value; self._renderIncidents(); };
        document.getElementById('incFilterStatus').onchange = e => { self._filterStatus = e.target.value; self._renderIncidents(); };
        document.getElementById('incFilterSeverity').onchange = e => { self._filterSeverity = e.target.value; self._renderIncidents(); };
        document.getElementById('incAddBtn').onclick = () => self._showIncidentForm(null);

        content.querySelectorAll('[data-action="edit-inc"]').forEach(btn => {
            btn.onclick = () => self._showIncidentForm(btn.dataset.id);
        });
        content.querySelectorAll('[data-action="delete-inc"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this incident record? This action cannot be undone.')) {
                    AppData.remove('safety_incidents', btn.dataset.id);
                    Utils.showToast('Incident deleted', 'success');
                    self._renderIncidents();
                }
            };
        });
    },

    _showIncidentForm(incId) {
        const self = this;
        const content = document.getElementById('safetyTabContent');
        const esc = Utils.escapeHtml;
        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allIncidents = AppData.getAll ? AppData.getAll('safety_incidents') : [];
        const inc = incId ? allIncidents.find(i => i.id === incId) : null;
        const isNew = !inc;

        function val(field, fallback) {
            return inc ? (inc[field] != null ? inc[field] : (fallback || '')) : (fallback || '');
        }

        const today = new Date().toISOString().slice(0, 10);
        const incidentTypes = ['Near Miss', 'First Aid', 'Medical Aid', 'Lost Time', 'Property Damage', 'Environmental', 'Other'];
        const severities = ['Minor', 'Moderate', 'Serious', 'Critical'];
        const statuses = ['Draft', 'Open', 'Under Review', 'Corrective Action Required', 'Closed'];

        content.innerHTML = `
            <div style="max-width:680px;margin:0 auto">
                <h3 style="margin-bottom:20px">${isNew ? 'Report Incident' : 'Edit Incident'}</h3>
                <form id="incForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px">

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Date *</label>
                            <input type="date" id="incDate" value="${esc(val('date', today))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Time</label>
                            <input type="time" id="incTime" value="${esc(val('time'))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Project</label>
                            <select id="incProject" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                <option value="">-- No Project --</option>
                                ${projects.map(p => `<option value="${p.id}" ${val('projectId') === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Incident Type *</label>
                            <select id="incType" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                                ${incidentTypes.map(t => `<option value="${t}" ${val('incidentType', 'Near Miss') === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Severity *</label>
                            <select id="incSeverity" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                                ${severities.map(s => `<option value="${s}" ${val('severity', 'Minor') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Reported By *</label>
                            <input type="text" id="incReportedBy" value="${esc(val('reportedBy'))}" placeholder="Name of person reporting"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Workers Involved</label>
                            <input type="text" id="incWorkersInvolved" value="${esc(val('workersInvolved'))}" placeholder="Names of workers involved"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Location</label>
                        <input type="text" id="incLocation" value="${esc(val('location'))}" placeholder="e.g. Level 3 east stairwell"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Description *</label>
                        <textarea id="incDescription" placeholder="Describe what happened..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:90px;resize:vertical" required>${esc(val('description'))}</textarea>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Root Cause</label>
                        <textarea id="incRootCause" placeholder="Identified root cause..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:70px;resize:vertical">${esc(val('rootCause'))}</textarea>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Corrective Actions</label>
                        <textarea id="incCorrectiveActions" placeholder="Actions taken or planned to prevent recurrence..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:70px;resize:vertical">${esc(val('correctiveActions'))}</textarea>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Status</label>
                            <select id="incStatus" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                ${statuses.map(s => `<option value="${s}" ${val('status', 'Open') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                        <div style="display:flex;flex-direction:column;justify-content:flex-end">
                            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.9rem;padding-bottom:10px">
                                <input type="checkbox" id="incWsibReportable" ${val('wsibReportable') ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer" />
                                <span style="font-weight:500">WSIB Reportable</span>
                            </label>
                        </div>
                    </div>

                    <div id="incWsibClaimRow" style="margin-bottom:14px;${val('wsibReportable') ? '' : 'display:none'}">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">WSIB Claim Number</label>
                        <input type="text" id="incWsibClaimNumber" value="${esc(val('wsibClaimNumber'))}" placeholder="e.g. WC-2026-12345"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                    </div>

                    <div style="margin-bottom:20px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Notes</label>
                        <textarea id="incNotes" placeholder="Additional notes..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:60px;resize:vertical">${esc(val('notes'))}</textarea>
                    </div>

                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="incCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">${isNew ? 'Report Incident' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        `;

        // Toggle WSIB claim row visibility
        document.getElementById('incWsibReportable').onchange = function() {
            document.getElementById('incWsibClaimRow').style.display = this.checked ? '' : 'none';
        };

        document.getElementById('incCancelBtn').onclick = () => self._renderIncidents();

        document.getElementById('incForm').onsubmit = e => {
            e.preventDefault();
            const now = new Date().toISOString();
            const record = {
                id: inc ? inc.id : ('incident_' + Date.now()),
                projectId: document.getElementById('incProject').value || null,
                date: document.getElementById('incDate').value,
                time: document.getElementById('incTime').value || null,
                reportedBy: document.getElementById('incReportedBy').value.trim(),
                workersInvolved: document.getElementById('incWorkersInvolved').value.trim(),
                incidentType: document.getElementById('incType').value,
                severity: document.getElementById('incSeverity').value,
                location: document.getElementById('incLocation').value.trim(),
                description: document.getElementById('incDescription').value.trim(),
                correctiveActions: document.getElementById('incCorrectiveActions').value.trim(),
                status: document.getElementById('incStatus').value,
                rootCause: document.getElementById('incRootCause').value.trim(),
                wsibReportable: document.getElementById('incWsibReportable').checked,
                wsibClaimNumber: document.getElementById('incWsibClaimNumber').value.trim() || null,
                notes: document.getElementById('incNotes').value.trim(),
                created_at: inc ? inc.created_at : now,
                updated_at: now
            };

            AppData.save('safety_incidents', record);
            Utils.showToast(isNew ? 'Incident reported' : 'Incident updated', 'success');
            self._renderIncidents();
        };
    },

    // ===================== TOOLBOX TALKS =====================

    _renderToolbox() {
        const self = this;
        const content = document.getElementById('safetyTabContent');
        const esc = Utils.escapeHtml;

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allTalks = AppData.getAll ? AppData.getAll('toolbox_talks') : [];

        const now = new Date();
        const thisMonth = now.toISOString().slice(0, 7);
        const thisMonthCount = allTalks.filter(t => (t.date || '').slice(0, 7) === thisMonth).length;

        const projectMap = {};
        projects.forEach(p => { projectMap[p.id] = p.name; });

        // Build month options from data
        const monthSet = new Set();
        allTalks.forEach(t => { if (t.date) monthSet.add(t.date.slice(0, 7)); });
        const monthOptions = Array.from(monthSet).sort().reverse();

        const filtered = allTalks.filter(t => {
            const projMatch = self._filterTTProject === 'All' || t.projectId === self._filterTTProject;
            const monthMatch = !self._filterTTMonth || (t.date || '').slice(0, 7) === self._filterTTMonth;
            return projMatch && monthMatch;
        }).sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));

        content.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <div></div>
                <button class="btn-primary" id="ttAddBtn">+ Log Toolbox Talk</button>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Total Talks</div>
                    <div style="font-size:1.7rem;font-weight:700;color:var(--text-primary)">${allTalks.length}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">This Month</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#198754">${thisMonthCount}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                    <select id="ttFilterProject" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterTTProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Month</label>
                    <select id="ttFilterMonth" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="">All Months</option>
                        ${monthOptions.map(m => `<option value="${m}" ${self._filterTTMonth === m ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse;font-size:.9rem">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Date</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Project</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Topic</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Conducted By</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Attendees</th>
                            <th style="padding:11px 14px;text-align:right;border-bottom:2px solid var(--border)">Duration (min)</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(t => {
                            const proj = projectMap[t.projectId] || (t.projectId || '—');
                            return `<tr style="border-bottom:1px solid var(--border)">
                                <td style="padding:10px 14px;white-space:nowrap">${esc(t.date || '—')}</td>
                                <td style="padding:10px 14px">${esc(proj)}</td>
                                <td style="padding:10px 14px"><strong>${esc(t.topic || '—')}</strong></td>
                                <td style="padding:10px 14px">${esc(t.conductedBy || '—')}</td>
                                <td style="padding:10px 14px">${esc(t.attendees || '—')}</td>
                                <td style="padding:10px 14px;text-align:right">${t.duration != null ? esc(String(t.duration)) : '—'}</td>
                                <td style="padding:10px 14px;text-align:center;white-space:nowrap">
                                    <button class="btn-secondary btn-sm" data-id="${esc(t.id)}" data-action="edit-tt" style="font-size:.75rem">Edit</button>
                                    <button class="btn-secondary btn-sm" data-id="${esc(t.id)}" data-action="delete-tt" style="font-size:.75rem;margin-left:4px">Delete</button>
                                </td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="7" style="padding:36px;text-align:center;color:var(--text2)">No toolbox talks recorded${allTalks.length > 0 ? ' matching filters' : '. Log your first toolbox talk to get started.'}.</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('ttFilterProject').onchange = e => { self._filterTTProject = e.target.value; self._renderToolbox(); };
        document.getElementById('ttFilterMonth').onchange = e => { self._filterTTMonth = e.target.value; self._renderToolbox(); };
        document.getElementById('ttAddBtn').onclick = () => self._showToolboxForm(null);

        content.querySelectorAll('[data-action="edit-tt"]').forEach(btn => {
            btn.onclick = () => self._showToolboxForm(btn.dataset.id);
        });
        content.querySelectorAll('[data-action="delete-tt"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this toolbox talk record?')) {
                    AppData.remove('toolbox_talks', btn.dataset.id);
                    Utils.showToast('Toolbox talk deleted', 'success');
                    self._renderToolbox();
                }
            };
        });
    },

    _showToolboxForm(ttId) {
        const self = this;
        const content = document.getElementById('safetyTabContent');
        const esc = Utils.escapeHtml;
        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allTalks = AppData.getAll ? AppData.getAll('toolbox_talks') : [];
        const tt = ttId ? allTalks.find(t => t.id === ttId) : null;
        const isNew = !tt;

        function val(field, fallback) {
            return tt ? (tt[field] != null ? tt[field] : (fallback || '')) : (fallback || '');
        }

        const today = new Date().toISOString().slice(0, 10);

        content.innerHTML = `
            <div style="max-width:580px;margin:0 auto">
                <h3 style="margin-bottom:20px">${isNew ? 'Log Toolbox Talk' : 'Edit Toolbox Talk'}</h3>
                <form id="ttForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px">

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Date *</label>
                            <input type="date" id="ttDate" value="${esc(val('date', today))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Project</label>
                            <select id="ttProject" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                <option value="">-- No Project --</option>
                                ${projects.map(p => `<option value="${p.id}" ${val('projectId') === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Topic *</label>
                        <input type="text" id="ttTopic" value="${esc(val('topic'))}" placeholder="e.g. Fall Protection, WHMIS, Working at Heights"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Conducted By *</label>
                            <input type="text" id="ttConductedBy" value="${esc(val('conductedBy'))}" placeholder="Name of presenter"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Duration (minutes)</label>
                            <input type="number" id="ttDuration" min="1" value="${val('duration')}" placeholder="e.g. 15"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Attendees</label>
                        <textarea id="ttAttendees" placeholder="List attendees or enter count, e.g. '8 workers' or 'John, Mike, Sarah...'"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:70px;resize:vertical">${esc(val('attendees'))}</textarea>
                    </div>

                    <div style="margin-bottom:20px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Notes</label>
                        <textarea id="ttNotes" placeholder="Key discussion points, handouts, etc."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:70px;resize:vertical">${esc(val('notes'))}</textarea>
                    </div>

                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="ttCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">${isNew ? 'Log Talk' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('ttCancelBtn').onclick = () => self._renderToolbox();

        document.getElementById('ttForm').onsubmit = e => {
            e.preventDefault();
            const now = new Date().toISOString();
            const durRaw = document.getElementById('ttDuration').value;
            const record = {
                id: tt ? tt.id : ('tt_' + Date.now()),
                projectId: document.getElementById('ttProject').value || null,
                date: document.getElementById('ttDate').value,
                conductedBy: document.getElementById('ttConductedBy').value.trim(),
                topic: document.getElementById('ttTopic').value.trim(),
                attendees: document.getElementById('ttAttendees').value.trim(),
                duration: durRaw !== '' ? parseInt(durRaw, 10) : null,
                notes: document.getElementById('ttNotes').value.trim(),
                created_at: tt ? tt.created_at : now,
                updated_at: now
            };

            AppData.save('toolbox_talks', record);
            Utils.showToast(isNew ? 'Toolbox talk logged' : 'Toolbox talk updated', 'success');
            self._renderToolbox();
        };
    }
};
