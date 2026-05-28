// Admin Safety Module — 5 tabs: Metrics, Incidents, Hazard Observations, JHA/FLHA, Toolbox Talks

window.AdminSafety = {
    _activeTab: 'metrics',
    _filterProject: 'All',
    _filterStatus: 'All',
    _filterSeverity: 'All',
    _filterHazProject: 'All',
    _filterHazStatus: 'All',
    _filterJHAProject: 'All',
    _filterJHAStatus: 'All',
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
        const tabs = [
            { id: 'metrics',   label: 'Metrics' },
            { id: 'incidents', label: 'Incidents' },
            { id: 'hazards',   label: 'Hazard Obs.' },
            { id: 'jha',       label: 'JHA / FLHA' },
            { id: 'toolbox',   label: 'Toolbox Talks' },
        ];
        const at = self._activeTab;

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <h2 style="margin:0 0 8px 0">Safety &amp; Health</h2>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Incidents, hazard observations, JHA/FLHA records, toolbox talks, and safety metrics.</p>
            </div>
            <!-- Tab Bar -->
            <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:24px;flex-wrap:wrap">
                ${tabs.map(t => `
                <button id="safetyTab_${t.id}" class="safety-tab"
                    style="padding:9px 18px;border:none;cursor:pointer;font-size:.9rem;font-weight:600;
                    border-bottom:3px solid ${at === t.id ? 'var(--primary)' : 'transparent'};
                    background:transparent;color:${at === t.id ? 'var(--primary)' : 'var(--text2)'};margin-bottom:-2px">
                    ${t.label}
                </button>`).join('')}
            </div>
            <div id="safetyTabContent"></div>
        `;

        tabs.forEach(t => {
            document.getElementById(`safetyTab_${t.id}`).onclick = () => {
                self._activeTab = t.id;
                self._renderShell();
            };
        });

        switch (at) {
            case 'metrics':   self._renderMetrics();   break;
            case 'incidents': self._renderIncidents(); break;
            case 'hazards':   self._renderHazards();   break;
            case 'jha':       self._renderJHA();       break;
            case 'toolbox':   self._renderToolbox();   break;
        }
    },

    // ===================== METRICS =====================

    _renderMetrics() {
        const content = document.getElementById('safetyTabContent');
        const esc = Utils.escapeHtml;

        const incidents    = AppData.getAll ? AppData.getAll('safety_incidents') : [];
        const hazards      = AppData.getAll ? AppData.getAll('hazard_observations') : [];
        const jhaRecords   = AppData.getAll ? AppData.getAll('jha_records') : [];
        const toolboxTalks = AppData.getAll ? AppData.getAll('toolbox_talks') : [];
        const acks         = AppData.getAll ? AppData.getAll('talk_acknowledgements') : [];

        const now = new Date();
        const thisMonth = now.toISOString().slice(0, 7);
        const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString().slice(0, 10);

        // Incident stats
        const openInc      = incidents.filter(i => i.status === 'Open').length;
        const lostTime     = incidents.filter(i => i.incidentType === 'Lost Time').length;
        const nearMiss     = incidents.filter(i => i.incidentType === 'Near Miss').length;
        const wsibCount    = incidents.filter(i => i.wsibReportable).length;
        const last30Inc    = incidents.filter(i => (i.date || '') >= thirtyDaysAgo).length;

        // Hazard stats
        const openHaz      = hazards.filter(h => h.status === 'Open' || h.status === 'Assigned').length;
        const closedHaz    = hazards.filter(h => h.status === 'Resolved' || h.status === 'Closed').length;
        const criticalHaz  = hazards.filter(h => h.severity === 'Critical' || h.severity === 'High').length;

        // JHA stats
        const activeJHA    = jhaRecords.filter(j => j.status === 'Active').length;
        const totalAcks    = acks.length;

        // Toolbox stats
        const ttThisMonth  = toolboxTalks.filter(t => (t.date || '').slice(0, 7) === thisMonth).length;

        // Severity breakdown for incidents
        const sevBreakdown = { Minor: 0, Moderate: 0, Serious: 0, Critical: 0 };
        incidents.forEach(i => { if (sevBreakdown[i.severity] !== undefined) sevBreakdown[i.severity]++; });

        // Recent incidents (last 5)
        const recentInc = incidents
            .slice().sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0))
            .slice(0, 5);

        const sevColors = { Minor: '#6c757d', Moderate: '#fd7e14', Serious: '#dc3545', Critical: '#6f0000' };

        content.innerHTML = `
            <h3 style="margin:0 0 16px 0;font-size:1rem;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Safety Overview</h3>

            <!-- Primary KPI Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:28px">
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid ${openInc > 0 ? '#dc3545' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Open Incidents</div>
                    <div style="font-size:2rem;font-weight:700;color:${openInc > 0 ? '#dc3545' : 'var(--text-primary)'}">${openInc}</div>
                    <div style="font-size:.78rem;color:var(--text2);margin-top:4px">${incidents.length} total</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid ${lostTime > 0 ? '#6f0000' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Lost Time</div>
                    <div style="font-size:2rem;font-weight:700;color:${lostTime > 0 ? '#dc3545' : 'var(--text-primary)'}">${lostTime}</div>
                    <div style="font-size:.78rem;color:var(--text2);margin-top:4px">${wsibCount} WSIB reportable</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Near Misses</div>
                    <div style="font-size:2rem;font-weight:700;color:var(--text-primary)">${nearMiss}</div>
                    <div style="font-size:.78rem;color:var(--text2);margin-top:4px">${last30Inc} incidents last 30d</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid ${criticalHaz > 0 ? '#fd7e14' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Open Hazards</div>
                    <div style="font-size:2rem;font-weight:700;color:${openHaz > 0 ? '#fd7e14' : 'var(--text-primary)'}">${openHaz}</div>
                    <div style="font-size:.78rem;color:var(--text2);margin-top:4px">${criticalHaz} high/critical</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Active JHAs</div>
                    <div style="font-size:2rem;font-weight:700;color:var(--text-primary)">${activeJHA}</div>
                    <div style="font-size:.78rem;color:var(--text2);margin-top:4px">${totalAcks} acknowledgements</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Toolbox Talks</div>
                    <div style="font-size:2rem;font-weight:700;color:#198754">${ttThisMonth}</div>
                    <div style="font-size:.78rem;color:var(--text2);margin-top:4px">this month (${toolboxTalks.length} total)</div>
                </div>
            </div>

            <!-- Incident Severity Breakdown + Recent -->
            <div style="display:grid;grid-template-columns:1fr 1.6fr;gap:20px;margin-bottom:24px">
                <!-- Severity Breakdown -->
                <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:18px">
                    <div style="font-weight:600;margin-bottom:14px">Incident Severity Breakdown</div>
                    ${incidents.length === 0
                        ? `<div style="color:var(--text2);font-size:.9rem;padding:20px 0;text-align:center">No incidents recorded</div>`
                        : Object.entries(sevBreakdown).map(([sev, count]) => `
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                            <div style="width:80px;font-size:.85rem;color:var(--text2)">${sev}</div>
                            <div style="flex:1;background:var(--border);border-radius:4px;height:10px;overflow:hidden">
                                <div style="width:${incidents.length > 0 ? Math.round(count/incidents.length*100) : 0}%;height:100%;background:${sevColors[sev]};border-radius:4px"></div>
                            </div>
                            <div style="width:28px;text-align:right;font-weight:600;font-size:.9rem">${count}</div>
                        </div>`).join('')}
                </div>
                <!-- Recent Incidents -->
                <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:18px">
                    <div style="font-weight:600;margin-bottom:14px">Recent Incidents</div>
                    ${recentInc.length === 0
                        ? `<div style="color:var(--text2);font-size:.9rem;padding:20px 0;text-align:center">No incidents recorded</div>`
                        : recentInc.map(i => `
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
                            <div>
                                <div style="font-size:.9rem;font-weight:500">${esc(i.incidentType || 'Incident')} — ${esc(i.location || 'Site')}</div>
                                <div style="font-size:.78rem;color:var(--text2)">${esc(i.date || '—')} · ${esc(i.reportedBy || '—')}</div>
                            </div>
                            <span style="padding:3px 9px;border-radius:10px;font-size:.72rem;font-weight:600;background:${sevColors[i.severity] || '#6c757d'};color:white;white-space:nowrap">${esc(i.severity || '—')}</span>
                        </div>`).join('')}
                </div>
            </div>

            <!-- Hazard Status Summary -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Hazards Logged</div>
                    <div style="font-size:1.6rem;font-weight:700">${hazards.length}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Hazards Closed</div>
                    <div style="font-size:1.6rem;font-weight:700;color:#198754">${closedHaz}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">JHAs Total</div>
                    <div style="font-size:1.6rem;font-weight:700">${jhaRecords.length}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Talk Acks</div>
                    <div style="font-size:1.6rem;font-weight:700">${totalAcks}</div>
                </div>
            </div>
        `;
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
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Source</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(i => {
                            const proj = projectMap[i.projectId] || (i.projectId || '—');
                            const isWorkerSubmitted = i.source === 'Worker Portal';
                            return `<tr style="border-bottom:1px solid var(--border)${isWorkerSubmitted ? ';background:rgba(var(--primary-rgb,25,118,210),0.04)' : ''}">
                                <td style="padding:10px 14px;white-space:nowrap">${esc(i.date || '—')}${i.time ? `<div style="font-size:.8rem;color:var(--text2)">${esc(i.time)}</div>` : ''}</td>
                                <td style="padding:10px 14px">${esc(proj)}</td>
                                <td style="padding:10px 14px">${esc(i.incidentType || '—')}</td>
                                <td style="padding:10px 14px;text-align:center">${severityBadge(i.severity)}</td>
                                <td style="padding:10px 14px">${esc(i.reportedBy || '—')}</td>
                                <td style="padding:10px 14px;text-align:center">${statusBadge(i.status)}</td>
                                <td style="padding:10px 14px;text-align:center">${i.wsibReportable ? '<span style="color:#dc3545;font-weight:700;font-size:.85rem">Yes</span>' : '<span style="color:var(--text2);font-size:.85rem">No</span>'}</td>
                                <td style="padding:10px 14px;text-align:center">${isWorkerSubmitted ? '<span style="font-size:.75rem;color:#0d6efd;font-weight:600">Worker</span>' : '<span style="font-size:.75rem;color:var(--text2)">Admin</span>'}</td>
                                <td style="padding:10px 14px;text-align:center;white-space:nowrap">
                                    <button class="btn-secondary btn-sm" data-id="${esc(i.id)}" data-action="edit-inc" style="font-size:.75rem">Edit</button>
                                    <button class="btn-secondary btn-sm" data-id="${esc(i.id)}" data-action="delete-inc" style="font-size:.75rem;margin-left:4px">Delete</button>
                                </td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="9" style="padding:36px;text-align:center;color:var(--text2)">No incidents recorded${allIncidents.length > 0 ? ' matching filters' : '. Report incidents to begin tracking.'}.</td></tr>`}
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
                source: inc ? (inc.source || 'Admin') : 'Admin',
                created_at: inc ? inc.created_at : now,
                updated_at: now
            };

            AppData.save('safety_incidents', record);
            Utils.showToast(isNew ? 'Incident reported' : 'Incident updated', 'success');
            self._renderIncidents();
        };
    },

    // ===================== HAZARD OBSERVATIONS =====================

    _renderHazards() {
        const self = this;
        const content = document.getElementById('safetyTabContent');
        const esc = Utils.escapeHtml;

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allHazards = AppData.getAll ? AppData.getAll('hazard_observations') : [];

        const openCount    = allHazards.filter(h => h.status === 'Open' || h.status === 'Assigned').length;
        const resolvedCount = allHazards.filter(h => h.status === 'Resolved' || h.status === 'Closed').length;
        const criticalCount = allHazards.filter(h => h.severity === 'Critical').length;

        const hazardStatuses = ['All', 'Open', 'Assigned', 'Resolved', 'Closed'];
        const hazardSeverities = ['All', 'Low', 'Medium', 'High', 'Critical'];

        const filtered = allHazards.filter(h => {
            const projMatch = self._filterHazProject === 'All' || h.projectId === self._filterHazProject;
            const statusMatch = self._filterHazStatus === 'All' || h.status === self._filterHazStatus;
            return projMatch && statusMatch;
        }).sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));

        const projectMap = {};
        projects.forEach(p => { projectMap[p.id] = p.name; });

        const sevColors = { Low: '#198754', Medium: '#fd7e14', High: '#dc3545', Critical: '#6f0000' };
        const statusColors = { Open: '#dc3545', Assigned: '#fd7e14', Resolved: '#198754', Closed: '#6c757d' };

        function badge(val, colorMap) {
            const color = colorMap[val] || '#6c757d';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${color};color:white">${esc(val || '—')}</span>`;
        }

        content.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <div></div>
                <button class="btn-primary" id="hazAddBtn">+ Log Hazard</button>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Total</div>
                    <div style="font-size:1.7rem;font-weight:700">${allHazards.length}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid ${openCount > 0 ? '#fd7e14' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Open</div>
                    <div style="font-size:1.7rem;font-weight:700;color:${openCount > 0 ? '#fd7e14' : 'var(--text-primary)'}">${openCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Resolved</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#198754">${resolvedCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid ${criticalCount > 0 ? '#6f0000' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Critical</div>
                    <div style="font-size:1.7rem;font-weight:700;color:${criticalCount > 0 ? '#dc3545' : 'var(--text-primary)'}">${criticalCount}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                    <select id="hazFilterProject" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterHazProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Status</label>
                    <select id="hazFilterStatus" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${hazardStatuses.map(s => `<option value="${s}" ${self._filterHazStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
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
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Hazard Type</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Description</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Severity</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Reported By</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Status</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Source</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(h => {
                            const proj = projectMap[h.projectId] || (h.projectId || '—');
                            const isWorker = h.source === 'Worker Portal';
                            const desc = (h.description || '').length > 60 ? h.description.slice(0, 60) + '…' : (h.description || '—');
                            return `<tr style="border-bottom:1px solid var(--border)${isWorker ? ';background:rgba(var(--primary-rgb,25,118,210),0.04)' : ''}">
                                <td style="padding:10px 14px;white-space:nowrap">${esc(h.date || '—')}</td>
                                <td style="padding:10px 14px">${esc(proj)}</td>
                                <td style="padding:10px 14px">${esc(h.hazardType || '—')}</td>
                                <td style="padding:10px 14px;max-width:220px">${esc(desc)}</td>
                                <td style="padding:10px 14px;text-align:center">${badge(h.severity, sevColors)}</td>
                                <td style="padding:10px 14px">${esc(h.reportedBy || '—')}</td>
                                <td style="padding:10px 14px;text-align:center">${badge(h.status, statusColors)}</td>
                                <td style="padding:10px 14px;text-align:center">${isWorker ? '<span style="font-size:.75rem;color:#0d6efd;font-weight:600">Worker</span>' : '<span style="font-size:.75rem;color:var(--text2)">Admin</span>'}</td>
                                <td style="padding:10px 14px;text-align:center;white-space:nowrap">
                                    <button class="btn-secondary btn-sm" data-id="${esc(h.id)}" data-action="edit-haz" style="font-size:.75rem">Edit</button>
                                    <button class="btn-secondary btn-sm" data-id="${esc(h.id)}" data-action="delete-haz" style="font-size:.75rem;margin-left:4px">Delete</button>
                                </td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="9" style="padding:36px;text-align:center;color:var(--text2)">No hazard observations${allHazards.length > 0 ? ' matching filters' : '. Log hazards to begin tracking.'}.</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('hazFilterProject').onchange = e => { self._filterHazProject = e.target.value; self._renderHazards(); };
        document.getElementById('hazFilterStatus').onchange = e => { self._filterHazStatus = e.target.value; self._renderHazards(); };
        document.getElementById('hazAddBtn').onclick = () => self._showHazardForm(null);

        content.querySelectorAll('[data-action="edit-haz"]').forEach(btn => {
            btn.onclick = () => self._showHazardForm(btn.dataset.id);
        });
        content.querySelectorAll('[data-action="delete-haz"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this hazard observation? This cannot be undone.')) {
                    AppData.remove('hazard_observations', btn.dataset.id);
                    Utils.showToast('Hazard observation deleted', 'success');
                    self._renderHazards();
                }
            };
        });
    },

    _showHazardForm(hazId) {
        const self = this;
        const content = document.getElementById('safetyTabContent');
        const esc = Utils.escapeHtml;
        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allHazards = AppData.getAll ? AppData.getAll('hazard_observations') : [];
        const haz = hazId ? allHazards.find(h => h.id === hazId) : null;
        const isNew = !haz;

        function val(field, fallback) {
            return haz ? (haz[field] != null ? haz[field] : (fallback || '')) : (fallback || '');
        }

        const today = new Date().toISOString().slice(0, 10);
        const hazardTypes = ['Slip/Trip/Fall', 'Struck By', 'Caught In/Between', 'Electrical', 'Chemical/Hazardous Material', 'Ergonomic', 'Working at Heights', 'Weather/Environmental', 'Equipment/Tool', 'Other'];
        const severities = ['Low', 'Medium', 'High', 'Critical'];
        const statuses = ['Open', 'Assigned', 'Resolved', 'Closed'];

        content.innerHTML = `
            <div style="max-width:680px;margin:0 auto">
                <h3 style="margin-bottom:20px">${isNew ? 'Log Hazard Observation' : 'Edit Hazard Observation'}</h3>
                <form id="hazForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px">

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Date *</label>
                            <input type="date" id="hazDate" value="${esc(val('date', today))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Project</label>
                            <select id="hazProject" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                <option value="">-- No Project --</option>
                                ${projects.map(p => `<option value="${p.id}" ${val('projectId') === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Hazard Type *</label>
                            <select id="hazType" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                                ${hazardTypes.map(t => `<option value="${t}" ${val('hazardType', 'Other') === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Severity *</label>
                            <select id="hazSeverity" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                                ${severities.map(s => `<option value="${s}" ${val('severity', 'Medium') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Location</label>
                        <input type="text" id="hazLocation" value="${esc(val('location'))}" placeholder="e.g. Roof deck, Section B"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Description *</label>
                        <textarea id="hazDescription" placeholder="Describe the hazard observed..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:80px;resize:vertical" required>${esc(val('description'))}</textarea>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Reported By *</label>
                            <input type="text" id="hazReportedBy" value="${esc(val('reportedBy'))}" placeholder="Name"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Assigned To</label>
                            <input type="text" id="hazAssignedTo" value="${esc(val('assignedTo'))}" placeholder="Name of person responsible"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Due Date</label>
                            <input type="date" id="hazDueDate" value="${esc(val('dueDate'))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Status</label>
                            <select id="hazStatus" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                ${statuses.map(s => `<option value="${s}" ${val('status', 'Open') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom:20px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Resolution Notes</label>
                        <textarea id="hazResolutionNotes" placeholder="Describe how the hazard was resolved..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:60px;resize:vertical">${esc(val('resolutionNotes'))}</textarea>
                    </div>

                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="hazCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">${isNew ? 'Log Hazard' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('hazCancelBtn').onclick = () => self._renderHazards();

        document.getElementById('hazForm').onsubmit = e => {
            e.preventDefault();
            const now = new Date().toISOString();
            const record = {
                id: haz ? haz.id : ('haz_' + Date.now()),
                projectId: document.getElementById('hazProject').value || null,
                date: document.getElementById('hazDate').value,
                hazardType: document.getElementById('hazType').value,
                severity: document.getElementById('hazSeverity').value,
                location: document.getElementById('hazLocation').value.trim(),
                description: document.getElementById('hazDescription').value.trim(),
                reportedBy: document.getElementById('hazReportedBy').value.trim(),
                assignedTo: document.getElementById('hazAssignedTo').value.trim() || null,
                dueDate: document.getElementById('hazDueDate').value || null,
                status: document.getElementById('hazStatus').value,
                resolutionNotes: document.getElementById('hazResolutionNotes').value.trim() || null,
                source: haz ? (haz.source || 'Admin') : 'Admin',
                created_at: haz ? haz.created_at : now,
                updated_at: now
            };

            AppData.save('hazard_observations', record);
            Utils.showToast(isNew ? 'Hazard logged' : 'Hazard updated', 'success');
            self._renderHazards();
        };
    },

    // ===================== JHA / FLHA =====================

    _renderJHA() {
        const self = this;
        const content = document.getElementById('safetyTabContent');
        const esc = Utils.escapeHtml;

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allJHAs = AppData.getAll ? AppData.getAll('jha_records') : [];
        const acks = AppData.getAll ? AppData.getAll('talk_acknowledgements') : [];

        const activeCount  = allJHAs.filter(j => j.status === 'Active').length;
        const draftCount   = allJHAs.filter(j => j.status === 'Draft').length;
        const doneCount    = allJHAs.filter(j => j.status === 'Completed' || j.status === 'Archived').length;

        const jhaStatuses = ['All', 'Draft', 'Active', 'Completed', 'Archived'];

        const filtered = allJHAs.filter(j => {
            const projMatch = self._filterJHAProject === 'All' || j.projectId === self._filterJHAProject;
            const statusMatch = self._filterJHAStatus === 'All' || j.status === self._filterJHAStatus;
            return projMatch && statusMatch;
        }).sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));

        const projectMap = {};
        projects.forEach(p => { projectMap[p.id] = p.name; });

        const statusColors = { Draft: '#6c757d', Active: '#0d6efd', Completed: '#198754', Archived: '#6c757d' };

        // Build ack count map per jhaRecordId
        const jhaAckMap = {};
        acks.forEach(a => { if (a.jhaRecordId) { jhaAckMap[a.jhaRecordId] = (jhaAckMap[a.jhaRecordId] || 0) + 1; } });

        content.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <div></div>
                <button class="btn-primary" id="jhaAddBtn">+ Create JHA/FLHA</button>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Total JHAs</div>
                    <div style="font-size:1.7rem;font-weight:700">${allJHAs.length}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid ${activeCount > 0 ? '#0d6efd' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Active</div>
                    <div style="font-size:1.7rem;font-weight:700;color:${activeCount > 0 ? '#0d6efd' : 'var(--text-primary)'}">${activeCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Draft</div>
                    <div style="font-size:1.7rem;font-weight:700">${draftCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Completed</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#198754">${doneCount}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                    <select id="jhaFilterProject" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterJHAProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Status</label>
                    <select id="jhaFilterStatus" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${jhaStatuses.map(s => `<option value="${s}" ${self._filterJHAStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
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
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Task / Job</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Conducted By</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Assigned Workers</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Status</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Acks</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(j => {
                            const proj = projectMap[j.projectId] || (j.projectId || '—');
                            const sColor = statusColors[j.status] || '#6c757d';
                            const ackCount = jhaAckMap[j.id] || 0;
                            const workers = Array.isArray(j.assignedWorkers) ? j.assignedWorkers.join(', ') : (j.assignedWorkers || '—');
                            return `<tr style="border-bottom:1px solid var(--border)">
                                <td style="padding:10px 14px;white-space:nowrap">${esc(j.date || '—')}</td>
                                <td style="padding:10px 14px">${esc(proj)}</td>
                                <td style="padding:10px 14px"><strong>${esc(j.jobTitle || j.task || '—')}</strong></td>
                                <td style="padding:10px 14px">${esc(j.conductedBy || '—')}</td>
                                <td style="padding:10px 14px;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(workers)}</td>
                                <td style="padding:10px 14px;text-align:center"><span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${sColor};color:white">${esc(j.status || '—')}</span></td>
                                <td style="padding:10px 14px;text-align:center">
                                    <span style="font-weight:600;color:${ackCount > 0 ? '#198754' : 'var(--text2)'}">${ackCount}</span>
                                </td>
                                <td style="padding:10px 14px;text-align:center;white-space:nowrap">
                                    <button class="btn-secondary btn-sm" data-id="${esc(j.id)}" data-action="edit-jha" style="font-size:.75rem">Edit</button>
                                    <button class="btn-secondary btn-sm" data-id="${esc(j.id)}" data-action="delete-jha" style="font-size:.75rem;margin-left:4px">Delete</button>
                                </td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="8" style="padding:36px;text-align:center;color:var(--text2)">No JHA/FLHA records${allJHAs.length > 0 ? ' matching filters' : '. Create your first JHA/FLHA to get started.'}.</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('jhaFilterProject').onchange = e => { self._filterJHAProject = e.target.value; self._renderJHA(); };
        document.getElementById('jhaFilterStatus').onchange = e => { self._filterJHAStatus = e.target.value; self._renderJHA(); };
        document.getElementById('jhaAddBtn').onclick = () => self._showJHAForm(null);

        content.querySelectorAll('[data-action="edit-jha"]').forEach(btn => {
            btn.onclick = () => self._showJHAForm(btn.dataset.id);
        });
        content.querySelectorAll('[data-action="delete-jha"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this JHA/FLHA record? This cannot be undone.')) {
                    AppData.remove('jha_records', btn.dataset.id);
                    Utils.showToast('JHA/FLHA deleted', 'success');
                    self._renderJHA();
                }
            };
        });
    },

    _showJHAForm(jhaId) {
        const self = this;
        const content = document.getElementById('safetyTabContent');
        const esc = Utils.escapeHtml;
        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allJHAs = AppData.getAll ? AppData.getAll('jha_records') : [];
        const jha = jhaId ? allJHAs.find(j => j.id === jhaId) : null;
        const isNew = !jha;

        function val(field, fallback) {
            return jha ? (jha[field] != null ? jha[field] : (fallback || '')) : (fallback || '');
        }

        const today = new Date().toISOString().slice(0, 10);
        const statuses = ['Draft', 'Active', 'Completed', 'Archived'];

        // assignedWorkers may be array or comma-string
        const assignedWorkersStr = Array.isArray(val('assignedWorkers')) ? val('assignedWorkers').join(', ') : val('assignedWorkers');
        // hazards and controls may be arrays
        const hazardsStr = Array.isArray(val('hazards')) ? val('hazards').join('\n') : val('hazards');
        const controlsStr = Array.isArray(val('controls')) ? val('controls').join('\n') : val('controls');

        content.innerHTML = `
            <div style="max-width:680px;margin:0 auto">
                <h3 style="margin-bottom:20px">${isNew ? 'Create JHA / FLHA' : 'Edit JHA / FLHA'}</h3>
                <form id="jhaForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px">

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Date *</label>
                            <input type="date" id="jhaDate" value="${esc(val('date', today))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Project</label>
                            <select id="jhaProject" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                <option value="">-- No Project --</option>
                                ${projects.map(p => `<option value="${p.id}" ${val('projectId') === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Task / Job Description *</label>
                        <input type="text" id="jhaJobTitle" value="${esc(val('jobTitle') || val('task'))}" placeholder="e.g. Roof membrane installation, Concrete pour Level 2"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Conducted By *</label>
                            <input type="text" id="jhaConductedBy" value="${esc(val('conductedBy'))}" placeholder="Supervisor / Safety officer"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Status</label>
                            <select id="jhaStatus" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                ${statuses.map(s => `<option value="${s}" ${val('status', 'Draft') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Assigned Workers <span style="font-weight:400;color:var(--text2)">(comma-separated)</span></label>
                        <input type="text" id="jhaWorkers" value="${esc(assignedWorkersStr)}" placeholder="e.g. John Smith, Maria Garcia, Tom Lee"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Identified Hazards <span style="font-weight:400;color:var(--text2)">(one per line)</span></label>
                        <textarea id="jhaHazards" placeholder="e.g.&#10;Fall from heights&#10;Struck by falling objects&#10;Electrical contact"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:90px;resize:vertical">${esc(hazardsStr)}</textarea>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Controls / Mitigations <span style="font-weight:400;color:var(--text2)">(one per line)</span></label>
                        <textarea id="jhaControls" placeholder="e.g.&#10;Install guardrails and safety nets&#10;Hard hats required at all times&#10;LOTO procedures enforced"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:90px;resize:vertical">${esc(controlsStr)}</textarea>
                    </div>

                    <div style="margin-bottom:20px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Notes</label>
                        <textarea id="jhaNotes" placeholder="Additional notes or special instructions..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:60px;resize:vertical">${esc(val('notes'))}</textarea>
                    </div>

                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="jhaCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">${isNew ? 'Create JHA/FLHA' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('jhaCancelBtn').onclick = () => self._renderJHA();

        document.getElementById('jhaForm').onsubmit = e => {
            e.preventDefault();
            const now = new Date().toISOString();
            const workersRaw = document.getElementById('jhaWorkers').value;
            const hazardsRaw = document.getElementById('jhaHazards').value;
            const controlsRaw = document.getElementById('jhaControls').value;

            const assignedWorkers = workersRaw.split(',').map(s => s.trim()).filter(Boolean);
            const hazardsArr = hazardsRaw.split('\n').map(s => s.trim()).filter(Boolean);
            const controlsArr = controlsRaw.split('\n').map(s => s.trim()).filter(Boolean);

            const record = {
                id: jha ? jha.id : ('jha_' + Date.now()),
                projectId: document.getElementById('jhaProject').value || null,
                date: document.getElementById('jhaDate').value,
                jobTitle: document.getElementById('jhaJobTitle').value.trim(),
                conductedBy: document.getElementById('jhaConductedBy').value.trim(),
                status: document.getElementById('jhaStatus').value,
                assignedWorkers,
                hazards: hazardsArr,
                controls: controlsArr,
                notes: document.getElementById('jhaNotes').value.trim(),
                created_at: jha ? jha.created_at : now,
                updated_at: now
            };

            AppData.save('jha_records', record);
            Utils.showToast(isNew ? 'JHA/FLHA created' : 'JHA/FLHA updated', 'success');
            self._renderJHA();
        };
    },

    // ===================== TOOLBOX TALKS =====================

    _renderToolbox() {
        const self = this;
        const content = document.getElementById('safetyTabContent');
        const esc = Utils.escapeHtml;

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allTalks = AppData.getAll ? AppData.getAll('toolbox_talks') : [];
        const acks = AppData.getAll ? AppData.getAll('talk_acknowledgements') : [];

        const now = new Date();
        const thisMonth = now.toISOString().slice(0, 7);
        const thisMonthCount = allTalks.filter(t => (t.date || '').slice(0, 7) === thisMonth).length;

        const projectMap = {};
        projects.forEach(p => { projectMap[p.id] = p.name; });

        // Build ack count map per toolboxTalkId
        const ttAckMap = {};
        acks.forEach(a => { if (a.toolboxTalkId) { ttAckMap[a.toolboxTalkId] = (ttAckMap[a.toolboxTalkId] || 0) + 1; } });

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
                    <div style="font-size:1.7rem;font-weight:700">${allTalks.length}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">This Month</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#198754">${thisMonthCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Total Acks</div>
                    <div style="font-size:1.7rem;font-weight:700">${acks.filter(a => a.toolboxTalkId).length}</div>
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
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Acks</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(t => {
                            const proj = projectMap[t.projectId] || (t.projectId || '—');
                            const ackCount = ttAckMap[t.id] || 0;
                            return `<tr style="border-bottom:1px solid var(--border)">
                                <td style="padding:10px 14px;white-space:nowrap">${esc(t.date || '—')}</td>
                                <td style="padding:10px 14px">${esc(proj)}</td>
                                <td style="padding:10px 14px"><strong>${esc(t.topic || '—')}</strong></td>
                                <td style="padding:10px 14px">${esc(t.conductedBy || '—')}</td>
                                <td style="padding:10px 14px">${esc(t.attendees || '—')}</td>
                                <td style="padding:10px 14px;text-align:right">${t.duration != null ? esc(String(t.duration)) : '—'}</td>
                                <td style="padding:10px 14px;text-align:center">
                                    <span style="font-weight:600;color:${ackCount > 0 ? '#198754' : 'var(--text2)'}">${ackCount}</span>
                                </td>
                                <td style="padding:10px 14px;text-align:center;white-space:nowrap">
                                    <button class="btn-secondary btn-sm" data-id="${esc(t.id)}" data-action="edit-tt" style="font-size:.75rem">Edit</button>
                                    <button class="btn-secondary btn-sm" data-id="${esc(t.id)}" data-action="delete-tt" style="font-size:.75rem;margin-left:4px">Delete</button>
                                </td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="8" style="padding:36px;text-align:center;color:var(--text2)">No toolbox talks recorded${allTalks.length > 0 ? ' matching filters' : '. Log your first toolbox talk to get started.'}.</td></tr>`}
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
