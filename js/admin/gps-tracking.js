// Admin GPS Tracking Module
// Read-only view of GPS events captured during worker clock-in/out.
// Also supports manual admin entry for testing/manual logging.

window.AdminGpsTracking = {
    _filterProject: 'All',
    _filterWorker: '',
    _filterEventType: 'All',
    _filterDateFrom: '',
    _filterDateTo: '',

    render(container) {
        const self = this;
        self._container = container;
        self._renderList();
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const esc = Utils.escapeHtml;

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allEvents = AppData.getAll ? AppData.getAll('gps_events') : [];

        const today = new Date().toISOString().slice(0, 10);
        const todayEvents = allEvents.filter(e => (e.capturedAt || '').slice(0, 10) === today);
        const deniedCount = allEvents.filter(e => e.permissionStatus === 'denied' || e.permissionStatus === 'unavailable').length;

        // Apply filters
        const filtered = allEvents.filter(e => {
            const projMatch = self._filterProject === 'All' || e.projectId === self._filterProject;
            const workerMatch = !self._filterWorker || (e.workerId || '').toLowerCase().includes(self._filterWorker.toLowerCase());
            const typeMatch = self._filterEventType === 'All' || e.eventType === self._filterEventType;
            const dateFrom = self._filterDateFrom ? (e.capturedAt || '').slice(0, 10) >= self._filterDateFrom : true;
            const dateTo = self._filterDateTo ? (e.capturedAt || '').slice(0, 10) <= self._filterDateTo : true;
            return projMatch && workerMatch && typeMatch && dateFrom && dateTo;
        }).sort((a, b) => new Date(b.capturedAt || b.created_at || 0) - new Date(a.capturedAt || a.created_at || 0));

        function permBadge(status) {
            const colors = { granted: '#198754', denied: '#dc3545', unavailable: '#6c757d' };
            const color = colors[status] || '#6c757d';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${color};color:white">${esc(status || 'unknown')}</span>`;
        }

        function eventTypeBadge(type) {
            const colors = { clock_in: '#0d6efd', clock_out: '#6c757d', break_start: '#fd7e14', break_end: '#198754' };
            const color = colors[type] || '#6c757d';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${color};color:white">${esc(type || '—')}</span>`;
        }

        function fmtCoord(val) {
            const n = parseFloat(val);
            return isNaN(n) ? '<span style="color:var(--text2)">—</span>' : n.toFixed(6);
        }

        function fmtDatetime(dt) {
            if (!dt) return '—';
            try { return new Date(dt).toLocaleString(); } catch(e) { return esc(dt); }
        }

        const projectMap = {};
        projects.forEach(p => { projectMap[p.id] = p.name; });

        const eventTypes = ['All', 'clock_in', 'clock_out', 'break_start', 'break_end'];

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h2 style="margin:0">GPS Tracking</h2>
                    <button class="btn-primary" id="gpsAddBtn">+ Log GPS Event</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Monitor worker location events captured during clock-in/out operations.</p>
            </div>

            <!-- Info Banner -->
            <div style="padding:12px 16px;background:rgba(255,193,7,.13);border:1px solid rgba(255,193,7,.4);border-radius:8px;margin-bottom:20px;font-size:.9rem;color:var(--text-primary)">
                <strong style="color:#f59e0b">GPS Tracking:</strong> GPS coordinates are captured when workers clock in/out via the mobile app. Enable location permissions on worker devices for automatic capture. Events with "denied" or "unavailable" status indicate location was not captured.
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Total Events</div>
                    <div style="font-size:1.7rem;font-weight:700;color:var(--text-primary)">${allEvents.length}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Today's Events</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#0d6efd">${todayEvents.length}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid ${deniedCount > 0 ? '#dc3545' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Denied / Unavailable</div>
                    <div style="font-size:1.7rem;font-weight:700;color:${deniedCount > 0 ? '#dc3545' : 'var(--text-primary)'}">${deniedCount}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                    <select id="gpsFilterProject" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Worker</label>
                    <input type="text" id="gpsFilterWorker" placeholder="Search worker..." value="${esc(self._filterWorker)}"
                        style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;width:160px" />
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Event Type</label>
                    <select id="gpsFilterType" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${eventTypes.map(t => `<option value="${t}" ${self._filterEventType === t ? 'selected' : ''}>${t === 'All' ? 'All Types' : t}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">From Date</label>
                    <input type="date" id="gpsFilterFrom" value="${esc(self._filterDateFrom)}"
                        style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">To Date</label>
                    <input type="date" id="gpsFilterTo" value="${esc(self._filterDateTo)}"
                        style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                </div>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse;font-size:.9rem">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border);white-space:nowrap">Date / Time</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Worker</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Project</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Event Type</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Lat / Lng</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Accuracy</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Permission</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(ev => {
                            const proj = projectMap[ev.projectId] || ev.projectId || '—';
                            const hasCoords = ev.latitude != null && ev.longitude != null;
                            const coordStr = hasCoords
                                ? `${fmtCoord(ev.latitude)}, ${fmtCoord(ev.longitude)}`
                                : '<span style="color:var(--text2);font-size:.82rem">unavailable</span>';
                            const accuracyStr = ev.accuracy != null ? `${parseFloat(ev.accuracy).toFixed(0)} m` : '—';
                            return `<tr style="border-bottom:1px solid var(--border)">
                                <td style="padding:10px 14px;white-space:nowrap;color:var(--text-primary)">${fmtDatetime(ev.capturedAt)}</td>
                                <td style="padding:10px 14px">${esc(ev.workerId || '—')}</td>
                                <td style="padding:10px 14px">${esc(proj)}</td>
                                <td style="padding:10px 14px">${eventTypeBadge(ev.eventType)}</td>
                                <td style="padding:10px 14px;font-family:monospace;font-size:.82rem">${coordStr}</td>
                                <td style="padding:10px 14px;color:var(--text2)">${accuracyStr}</td>
                                <td style="padding:10px 14px">${permBadge(ev.permissionStatus)}</td>
                                <td style="padding:10px 14px;text-align:center">
                                    <button class="btn-secondary btn-sm" data-id="${esc(ev.id)}" data-action="delete" style="font-size:.75rem">Delete</button>
                                </td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="8" style="padding:36px;text-align:center;color:var(--text2)">No GPS events found${allEvents.length > 0 ? ' matching your filters' : '. Events are recorded when workers clock in/out with location permissions enabled.'}.</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;

        // Filter event handlers
        document.getElementById('gpsFilterProject').onchange = e => { self._filterProject = e.target.value; self._renderList(); };
        document.getElementById('gpsFilterType').onchange = e => { self._filterEventType = e.target.value; self._renderList(); };
        document.getElementById('gpsFilterFrom').onchange = e => { self._filterDateFrom = e.target.value; self._renderList(); };
        document.getElementById('gpsFilterTo').onchange = e => { self._filterDateTo = e.target.value; self._renderList(); };
        document.getElementById('gpsFilterWorker').oninput = e => { self._filterWorker = e.target.value; self._renderList(); };

        document.getElementById('gpsAddBtn').onclick = () => self._showForm(null);

        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this GPS event? This action cannot be undone.')) {
                    AppData.remove('gps_events', btn.dataset.id);
                    Utils.showToast('GPS event deleted', 'success');
                    self._renderList();
                }
            };
        });
    },

    _showForm(evtId) {
        const self = this;
        const container = self._container;
        const esc = Utils.escapeHtml;
        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const workers = AppData.getWorkers ? AppData.getWorkers() : [];
        const allEvents = AppData.getAll ? AppData.getAll('gps_events') : [];
        const evt = evtId ? allEvents.find(e => e.id === evtId) : null;

        const nowDt = new Date().toISOString().slice(0, 16);

        container.innerHTML = `
            <div style="max-width:580px;margin:0 auto">
                <h2 style="margin-bottom:20px">Log GPS Event</h2>
                <form id="gpsForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px">

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Worker *</label>
                            <select id="gpsWorker" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                                <option value="">-- Select Worker --</option>
                                ${workers.map(w => `<option value="${esc(w.id)}" ${evt && evt.workerId === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Project</label>
                            <select id="gpsProject" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                <option value="">-- No Project --</option>
                                ${projects.map(p => `<option value="${p.id}" ${evt && evt.projectId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Event Type *</label>
                            <select id="gpsEventType" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                                <option value="clock_in" ${evt && evt.eventType === 'clock_in' ? 'selected' : ''}>clock_in</option>
                                <option value="clock_out" ${evt && evt.eventType === 'clock_out' ? 'selected' : ''}>clock_out</option>
                                <option value="break_start" ${evt && evt.eventType === 'break_start' ? 'selected' : ''}>break_start</option>
                                <option value="break_end" ${evt && evt.eventType === 'break_end' ? 'selected' : ''}>break_end</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Captured At *</label>
                            <input type="datetime-local" id="gpsCapturedAt" value="${esc(evt ? (evt.capturedAt || '').slice(0,16) : nowDt)}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Latitude</label>
                            <input type="number" id="gpsLat" step="any" placeholder="e.g. 43.6532"
                                value="${evt && evt.latitude != null ? evt.latitude : ''}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Longitude</label>
                            <input type="number" id="gpsLng" step="any" placeholder="e.g. -79.3832"
                                value="${evt && evt.longitude != null ? evt.longitude : ''}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Accuracy (m)</label>
                            <input type="number" id="gpsAccuracy" step="any" min="0" placeholder="e.g. 15"
                                value="${evt && evt.accuracy != null ? evt.accuracy : ''}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Permission Status</label>
                        <select id="gpsPermission" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                            <option value="granted" ${!evt || evt.permissionStatus === 'granted' ? 'selected' : ''}>granted</option>
                            <option value="denied" ${evt && evt.permissionStatus === 'denied' ? 'selected' : ''}>denied</option>
                            <option value="unavailable" ${evt && evt.permissionStatus === 'unavailable' ? 'selected' : ''}>unavailable</option>
                        </select>
                    </div>

                    <div style="margin-bottom:20px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Notes</label>
                        <textarea id="gpsNotes" placeholder="Optional notes..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:70px;resize:vertical">${esc(evt ? (evt.notes || '') : '')}</textarea>
                    </div>

                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="gpsCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">Save Event</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('gpsCancelBtn').onclick = () => self._renderList();

        document.getElementById('gpsForm').onsubmit = e => {
            e.preventDefault();
            const workerId = document.getElementById('gpsWorker').value;
            if (!workerId) { Utils.showToast('Please select a worker', 'error'); return; }

            const latVal = document.getElementById('gpsLat').value;
            const lngVal = document.getElementById('gpsLng').value;

            const now = new Date().toISOString();
            const record = {
                id: evt ? evt.id : ('gps_' + Date.now()),
                workerId: workerId,
                projectId: document.getElementById('gpsProject').value || null,
                eventType: document.getElementById('gpsEventType').value,
                latitude: latVal !== '' ? parseFloat(latVal) : null,
                longitude: lngVal !== '' ? parseFloat(lngVal) : null,
                accuracy: document.getElementById('gpsAccuracy').value !== '' ? parseFloat(document.getElementById('gpsAccuracy').value) : null,
                capturedAt: document.getElementById('gpsCapturedAt').value || now,
                permissionStatus: document.getElementById('gpsPermission').value,
                notes: document.getElementById('gpsNotes').value.trim(),
                created_at: evt ? evt.created_at : now,
                updated_at: now
            };

            AppData.save('gps_events', record);
            Utils.showToast('GPS event saved', 'success');
            self._renderList();
        };
    }
};
