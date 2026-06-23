// Admin Users (Workers) Module
window.AdminUsers = {
    _filter: '',
    _wizardMode: false,

    render(container, params) {
        const self = this;
        self._container = container;
        params = params || {};
        const workers = AppData.getWorkers();
        if (params.wizard || workers.length === 0) {
            self._wizardMode = true;
            self._startWizard();
        } else {
            self._wizardMode = false;
        }
        self._renderList();
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const workers = AppData.getWorkers();
        const filter = self._filter.toLowerCase();
        const filtered = filter
            ? workers.filter(function(w) {
                return (w.name || '').toLowerCase().includes(filter) ||
                    (w.role || '').toLowerCase().includes(filter) ||
                    (w.status || '').toLowerCase().includes(filter);
            })
            : workers;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                <h2>Worker Management</h2>
                <div style="display:flex;gap:8px">
                    <button class="btn-secondary btn-sm" id="usersExportCsvBtn">Export CSV</button>
                    <button class="btn-secondary btn-sm" id="usersPrintBtn">Print / PDF</button>
                    <button class="btn-secondary btn-sm" id="workerWizardBtn">Walk me through it</button>
                    <button class="btn-primary" id="addWorkerBtn">+ Add Worker</button>
                </div>
            </div>

            <div class="card" style="margin-bottom:16px">
                <div class="card-body">
                    <input type="text" class="form-control" id="workerSearch" placeholder="Search workers by name, role, or status..." value="${Utils.escapeHtml(self._filter)}">
                </div>
            </div>

            <div class="card" style="overflow-x:auto">
                ${filtered.length === 0
                    ? '<div class="empty"><h3>No Workers Found</h3><p>' + (workers.length === 0 ? 'Add your first worker to get started.' : 'No workers match your search.') + '</p></div>'
                    : `<table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Phone</th>
                                <th>PIN</th>
                                <th>Status</th>
                                <th class="amount">Pay Rate</th>
                                <th class="amount">Cost Rate</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(function(w) {
                                const statusClass = w.status === 'Active' ? 'active-s' : 'completed-s';
                                const payRate = w.payRate || w.defaultRate || 0;
                                const costRate = w.costRate || 0;
                                return '<tr>' +
                                    '<td><strong>' + Utils.escapeHtml(w.name) + '</strong>' +
                                        (w.email ? '<div style="font-size:.78rem;color:var(--text2)">' + Utils.escapeHtml(w.email) + '</div>' : '') +
                                    '</td>' +
                                    '<td>' + Utils.escapeHtml(w.role || 'Worker') + '</td>' +
                                    '<td style="font-size:.85rem;color:var(--text2)">' + (w.phone ? Utils.escapeHtml(w.phone) : '<span style="color:var(--border)">—</span>') + '</td>' +
                                    (function() {
                                        var p = w.pin || '';
                                        var isHash = p.startsWith('$2b$') || p.startsWith('$2a$') || p === '[hashed]';
                                        if (isHash) {
                                            return '<td style="white-space:nowrap;font-size:.8rem;color:var(--text2)">Reset required <button class="btn-ghost btn-sm reset-pin-worker" data-id="' + w.id + '" style="font-size:.75rem;padding:2px 6px;color:var(--warn)">Reset</button></td>';
                                        }
                                        return '<td style="white-space:nowrap">' +
                                            '<span class="pin-masked" data-id="' + w.id + '">' + '\u2022'.repeat(p.length || 4) + '</span>' +
                                            '<span class="pin-revealed" data-id="' + w.id + '" style="display:none;font-family:monospace">' + Utils.escapeHtml(p) + '</span>' +
                                            ' <button class="btn-ghost btn-sm reveal-pin" data-id="' + w.id + '" style="font-size:.75rem;padding:2px 6px">Show</button>' +
                                        '</td>';
                                    })() +
                                    '<td><span class="pstatus ' + statusClass + '">' + Utils.escapeHtml(w.status || 'Active') + '</span></td>' +
                                    '<td class="amount">' + (payRate ? Utils.formatCurrency(payRate) + '/hr' : '—') + '</td>' +
                                    '<td class="amount">' + (costRate ? Utils.formatCurrency(costRate) + '/hr' : '—') + '</td>' +
                                    '<td style="white-space:nowrap">' +
                                        '<button class="btn-ghost btn-sm view-worker" data-id="' + w.id + '" style="color:var(--info,#3b82f6)">View</button>' +
                                        '<button class="btn-ghost btn-sm edit-worker" data-id="' + w.id + '">Edit</button>' +
                                        '<button class="btn-ghost btn-sm invite-worker" data-id="' + w.id + '" style="color:var(--success)">Invite</button>' +
                                        '<button class="btn-ghost btn-sm resend-welcome-worker" data-id="' + w.id + '" style="color:var(--success)">Resend Welcome Email</button>' +
                                        '<button class="btn-ghost btn-sm reset-pin-worker" data-id="' + w.id + '" style="color:var(--warn)">Reset PIN</button>' +
                                        '<button class="btn-ghost btn-sm delete-worker" data-id="' + w.id + '" style="color:var(--accent)">Delete</button>' +
                                    '</td>' +
                                '</tr>';
                            }).join('')}
                        </tbody>
                    </table>`
                }
            </div>
        `;

        function csvEscape(val) {
            if (val === null || val === undefined) return '';
            var s = String(val);
            if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
                return '"' + s.replace(/"/g, '""') + '"';
            return s;
        }
        function csvRow(fields) { return fields.map(csvEscape).join(','); }
        function downloadCsv(content, name) {
            var today = new Date().toISOString().slice(0,10);
            var blob = new Blob([content], {type:'text/csv'});
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = 'ledgerman-' + name + '-' + today + '.csv';
            document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
        }

        container.querySelector('#usersExportCsvBtn').addEventListener('click', function() {
            var rows = [csvRow(['Name','Role','Email','Phone','Date of Birth','Status','Pay Rate','Cost Rate'])];
            filtered.forEach(function(w) {
                rows.push(csvRow([
                    w.name || '',
                    w.role || 'Worker',
                    w.email || '',
                    w.phone || '',
                    w.dob || '',
                    w.status || 'Active',
                    w.payRate || w.defaultRate || '',
                    w.costRate || ''
                ]));
            });
            downloadCsv(rows.join('\n'), 'workers');
        });

        container.querySelector('#usersPrintBtn').addEventListener('click', function() {
            if (!document.getElementById('usersPrintStyle')) {
                var s = document.createElement('style');
                s.id = 'usersPrintStyle';
                s.textContent = '@media print { .admin-nav,.worker-nav,#adminSidebar,.btn-primary,.btn-secondary,.tab-btn,#pageHelpBtn { display:none!important; } body { font-size:11pt; } .card { box-shadow:none; border:1px solid #ddd; } }';
                document.head.appendChild(s);
            }
            window.print();
        });

        container.querySelector('#addWorkerBtn').addEventListener('click', function() {
            self._showModal(null);
        });

        container.querySelector('#workerWizardBtn').addEventListener('click', function() {
            self._startWizard();
        });

        container.querySelector('#workerSearch').addEventListener('input', Utils.debounce(function(e) {
            self._filter = e.target.value;
            self._renderList();
        }, 250));

        // Reveal/hide PIN buttons
        // The worker list endpoint strips PINs for security. On first "Show" click
        // we fetch the full worker detail (GET /api/workers/<id>) which returns
        // pin_display. After the first fetch the value is cached in the DOM.
        container.querySelectorAll('.reveal-pin').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = btn.dataset.id;
                var masked = container.querySelector('.pin-masked[data-id="' + id + '"]');
                var revealed = container.querySelector('.pin-revealed[data-id="' + id + '"]');
                if (!masked || !revealed) return;

                // Already fetched — just toggle
                if (btn.dataset.pinLoaded === 'true') {
                    if (revealed.style.display === 'none') {
                        masked.style.display = 'none';
                        revealed.style.display = 'inline';
                        btn.textContent = 'Hide';
                    } else {
                        masked.style.display = 'inline';
                        revealed.style.display = 'none';
                        btn.textContent = 'Show';
                    }
                    return;
                }

                // First reveal — fetch from server
                btn.textContent = '…';
                btn.disabled = true;
                AppData.getWorkerDetail(id).then(function(detail) {
                    var pin = detail.pin_display || '';
                    var isHashed = detail.pin_is_hashed;
                    if (isHashed || pin === '[hashed — reset required]') {
                        // Replace the entire cell content with a reset-required notice
                        var td = btn.closest('td');
                        if (td) {
                            td.innerHTML = '<span style="color:var(--text2);font-size:.8rem">Reset required</span>' +
                                ' <button class="btn-ghost btn-sm reset-pin-worker" data-id="' + id + '" style="font-size:.75rem;padding:2px 6px;color:var(--warn)">Reset</button>';
                            // Re-wire the reset button
                            var resetBtn = td.querySelector('.reset-pin-worker');
                            if (resetBtn) resetBtn.addEventListener('click', function() {
                                var w = AppData.getWorker(id);
                                if (w) self._showSetPinModal(w);
                            });
                        }
                        return;
                    }
                    revealed.textContent = pin || '(no PIN set)';
                    btn.dataset.pinLoaded = 'true';
                    masked.style.display = 'none';
                    revealed.style.display = 'inline';
                    btn.textContent = 'Hide';
                    btn.disabled = false;
                }).catch(function(err) {
                    btn.textContent = 'Show';
                    btn.disabled = false;
                    Utils.showToast('Could not load PIN: ' + (err.message || 'server error'), 'error');
                });
            });
        });

        container.querySelectorAll('.view-worker').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._showDetailModal(btn.dataset.id);
            });
        });

        container.querySelectorAll('.edit-worker').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._showModal(btn.dataset.id);
            });
        });

        container.querySelectorAll('.invite-worker').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._showInviteModal(btn.dataset.id);
            });
        });

        container.querySelectorAll('.resend-welcome-worker').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._showResendWelcomeModal(btn.dataset.id);
            });
        });

        container.querySelectorAll('.reset-pin-worker').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const worker = AppData.getWorker(btn.dataset.id);
                if (!worker) return;
                self._showSetPinModal(worker);
            });
        });

        container.querySelectorAll('.delete-worker').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                const worker = AppData.getWorker(btn.dataset.id);
                if (!worker) return;
                const confirmed = await Utils.confirm('Delete worker "' + worker.name + '"? This cannot be undone.');
                if (!confirmed) return;
                AppData.deleteWorker(btn.dataset.id);
                const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'Worker Deleted', worker.name);
                Utils.showToast('Worker deleted');
                self._renderList();
            });
        });
    },

    _showDetailModal(workerId) {
        const self = this;
        const esc = Utils.escapeHtml;

        // ── Build the overlay immediately with a loading state ────────────────
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML =
            '<div class="modal" style="max-width:720px;width:100%">' +
                '<div class="modal-header" style="display:flex;justify-content:space-between;align-items:center">' +
                    '<h3 style="margin:0">Worker Profile</h3>' +
                    '<button class="btn-ghost btn-sm modal-close" style="font-size:1.2rem;line-height:1;padding:4px 10px">&times;</button>' +
                '</div>' +
                '<div class="modal-body" id="workerDetailBody" style="min-height:200px;display:flex;align-items:center;justify-content:center">' +
                    '<p style="color:var(--text2)">Loading…</p>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);

        overlay.querySelector('.modal-close').addEventListener('click', function() { overlay.remove(); });
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

        // ── Fetch worker detail + timecards in parallel ───────────────────────
        const detailPromise  = AppData.getWorkerDetail(workerId);
        const tcPromise      = AppData.getWorkerTimecards(workerId);

        Promise.all([detailPromise, tcPromise])
            .then(function(results) {
                const worker    = results[0];
                const timecards = Array.isArray(results[1]) ? results[1] : [];
                self._renderDetailContent(overlay, worker, timecards);
            })
            .catch(function(err) {
                const body = overlay.querySelector('#workerDetailBody');
                if (body) {
                    body.style.display = 'block';
                    body.innerHTML =
                        '<div class="empty" style="padding:32px 0">' +
                            '<h3 style="color:var(--accent)">Could not load worker</h3>' +
                            '<p>' + esc(err.message || 'Unknown error') + '</p>' +
                        '</div>';
                }
            });
    },

    _renderDetailContent(overlay, worker, timecards) {
        const self = this;
        const esc  = Utils.escapeHtml;

        // ── Hours summary from timecards ──────────────────────────────────────
        var totalReg = 0, totalOT = 0, totalDT = 0, totalAll = 0;
        var projectMap = {};   // projectId → { name, reg, ot, dt }
        var projects   = AppData.getProjects();
        var projectLookup = {};
        projects.forEach(function(p) { projectLookup[p.id] = p.name || p.id; });

        timecards.forEach(function(tc) {
            var reg = parseFloat(tc.regular_hours || tc.regularHours || 0);
            var ot  = parseFloat(tc.ot_hours      || tc.otHours      || 0);
            var dt  = parseFloat(tc.dt_hours      || tc.dtHours      || 0);
            totalReg += reg; totalOT += ot; totalDT += dt;
            var pid  = tc.project_id || tc.projectId || '';
            var pname = projectLookup[pid] || pid || 'Unassigned';
            if (!projectMap[pid]) projectMap[pid] = { name: pname, reg: 0, ot: 0, dt: 0 };
            projectMap[pid].reg += reg;
            projectMap[pid].ot  += ot;
            projectMap[pid].dt  += dt;
        });
        totalAll = totalReg + totalOT + totalDT;

        // ── Derive field values ───────────────────────────────────────────────
        var payRate   = worker.default_rate  || worker.defaultRate  || 0;
        var costRate  = worker.cost_rate     || worker.costRate      || 0;
        var phone     = worker.phone || '';
        var email     = worker.email || '';
        var statusClass = (worker.status || 'Active') === 'Active' ? 'active-s' : 'completed-s';

        // ── PIN section HTML ──────────────────────────────────────────────────
        var pinSectionHtml;
        if (worker.pin_is_hashed) {
            pinSectionHtml =
                '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
                    '<span style="background:var(--warn,#f59e0b);color:#fff;font-size:.78rem;font-weight:700;padding:3px 10px;border-radius:4px">HASHED</span>' +
                    '<span style="color:var(--text2);font-size:.9rem">PIN has been migrated to secure storage. The original PIN is not recoverable.</span>' +
                    '<button class="btn-secondary btn-sm detail-reset-pin" style="margin-left:auto;color:var(--warn)">Reset PIN</button>' +
                '</div>';
        } else {
            var pinVal = esc(worker.pin_display || '');
            pinSectionHtml =
                '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
                    '<span id="detailPinMasked" style="font-size:1.1rem;letter-spacing:4px">' +
                        '•'.repeat((worker.pin_display || '').length || 4) +
                    '</span>' +
                    '<span id="detailPinRevealed" style="display:none;font-family:monospace;font-size:1.1rem;letter-spacing:2px;background:var(--bg2);padding:3px 10px;border-radius:4px">' +
                        pinVal +
                    '</span>' +
                    '<button class="btn-ghost btn-sm" id="detailPinToggle" style="font-size:.8rem">Show</button>' +
                    '<button class="btn-secondary btn-sm detail-reset-pin" style="color:var(--warn)">Reset PIN</button>' +
                '</div>';
        }

        // ── Project hours table ───────────────────────────────────────────────
        var projectRows = Object.values(projectMap);
        var hoursBreakdownHtml = '';
        if (projectRows.length > 0) {
            hoursBreakdownHtml =
                '<table style="width:100%;font-size:.88rem;margin-top:8px">' +
                    '<thead><tr>' +
                        '<th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border)">Project</th>' +
                        '<th style="text-align:right;padding:4px 8px;border-bottom:1px solid var(--border)">Reg</th>' +
                        '<th style="text-align:right;padding:4px 8px;border-bottom:1px solid var(--border)">OT</th>' +
                        '<th style="text-align:right;padding:4px 8px;border-bottom:1px solid var(--border)">DT</th>' +
                        '<th style="text-align:right;padding:4px 8px;border-bottom:1px solid var(--border)">Total</th>' +
                    '</tr></thead>' +
                    '<tbody>' +
                        projectRows.map(function(p) {
                            var pTotal = p.reg + p.ot + p.dt;
                            return '<tr>' +
                                '<td style="padding:4px 8px">' + esc(p.name) + '</td>' +
                                '<td style="text-align:right;padding:4px 8px">' + p.reg.toFixed(1) + '</td>' +
                                '<td style="text-align:right;padding:4px 8px">' + p.ot.toFixed(1) + '</td>' +
                                '<td style="text-align:right;padding:4px 8px">' + p.dt.toFixed(1) + '</td>' +
                                '<td style="text-align:right;padding:4px 8px;font-weight:600">' + pTotal.toFixed(1) + '</td>' +
                            '</tr>';
                        }).join('') +
                    '</tbody>' +
                    '<tfoot><tr style="border-top:2px solid var(--border)">' +
                        '<td style="padding:4px 8px;font-weight:700">All Projects</td>' +
                        '<td style="text-align:right;padding:4px 8px;font-weight:700">' + totalReg.toFixed(1) + '</td>' +
                        '<td style="text-align:right;padding:4px 8px;font-weight:700">' + totalOT.toFixed(1) + '</td>' +
                        '<td style="text-align:right;padding:4px 8px;font-weight:700">' + totalDT.toFixed(1) + '</td>' +
                        '<td style="text-align:right;padding:4px 8px;font-weight:700">' + totalAll.toFixed(1) + ' h</td>' +
                    '</tr></tfoot>' +
                '</table>';
        } else {
            hoursBreakdownHtml = '<p style="color:var(--text2);margin:8px 0 0">No timecard records found for this worker.</p>';
        }

        // ── Full modal body HTML ──────────────────────────────────────────────
        function section(title, content) {
            return '<div style="margin-bottom:20px">' +
                '<div style="font-size:.72rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">' +
                    title +
                '</div>' +
                content +
            '</div>';
        }
        function row2(label, value) {
            return '<div style="display:flex;gap:8px;margin-bottom:6px;font-size:.92rem">' +
                '<span style="color:var(--text2);min-width:110px;flex-shrink:0">' + label + '</span>' +
                '<span style="font-weight:500">' + (value || '<span style="color:var(--border)">—</span>') + '</span>' +
            '</div>';
        }

        var bodyHtml =
            // ── Profile ──────────────────────────────────────────────────────
            section('Profile',
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">' +
                    row2('Name', '<strong style="font-size:1rem">' + esc(worker.name || '') + '</strong>') +
                    row2('Role', esc(worker.role || 'Worker')) +
                    row2('Status', '<span class="pstatus ' + statusClass + '">' + esc(worker.status || 'Active') + '</span>') +
                    row2('Member since', worker.created_at ? esc(worker.created_at.slice(0,10)) : '') +
                '</div>'
            ) +

            // ── Contact ───────────────────────────────────────────────────────
            section('Contact Information',
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">' +
                    row2('Phone', phone ? ('<a href="tel:' + esc(phone) + '" style="color:var(--accent)">' + esc(phone) + '</a>') : '') +
                    row2('Email', email ? ('<a href="mailto:' + esc(email) + '" style="color:var(--accent)">' + esc(email) + '</a>') : '') +
                '</div>'
            ) +

            // ── Access / PIN ──────────────────────────────────────────────────
            section('Access &amp; PIN',
                '<div style="margin-bottom:10px">' + row2('2FA Enabled', worker.twoFAEnabled || worker.two_fa_enabled ? '<span style="color:var(--success)">✓ Active</span>' : 'Disabled') + '</div>' +
                '<div style="background:var(--bg2,#f8f9fa);border:1px solid var(--border);border-radius:var(--radius,6px);padding:12px 14px">' +
                    '<div style="font-size:.8rem;color:var(--text2);margin-bottom:8px;font-weight:600">Worker Access PIN</div>' +
                    pinSectionHtml +
                '</div>'
            ) +

            // ── Rates ─────────────────────────────────────────────────────────
            section('Pay &amp; Bill Rates',
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">' +
                    row2('Pay Rate', payRate ? (Utils.formatCurrency(payRate) + '/hr') : '') +
                    row2('Cost Rate', costRate ? (Utils.formatCurrency(costRate) + '/hr') : '') +
                '</div>' +
                '<p style="font-size:.75rem;color:var(--text2);margin:4px 0 0"><strong>Pay Rate</strong> = worker\'s hourly pay &nbsp;·&nbsp; <strong>Cost Rate</strong> = billable rate to client</p>'
            ) +

            // ── Hours Summary ─────────────────────────────────────────────────
            section('Hours Summary (' + timecards.length + ' timecard' + (timecards.length !== 1 ? 's' : '') + ')',
                '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px">' +
                    '<div style="background:var(--bg2,#f8f9fa);border-radius:var(--radius,6px);padding:12px;text-align:center">' +
                        '<div style="font-size:1.4rem;font-weight:700;color:var(--accent)">' + totalReg.toFixed(1) + '</div>' +
                        '<div style="font-size:.75rem;color:var(--text2);margin-top:2px">Regular Hours</div>' +
                    '</div>' +
                    '<div style="background:var(--bg2,#f8f9fa);border-radius:var(--radius,6px);padding:12px;text-align:center">' +
                        '<div style="font-size:1.4rem;font-weight:700;color:var(--warn,#f59e0b)">' + totalOT.toFixed(1) + '</div>' +
                        '<div style="font-size:.75rem;color:var(--text2);margin-top:2px">Overtime Hours</div>' +
                    '</div>' +
                    '<div style="background:var(--bg2,#f8f9fa);border-radius:var(--radius,6px);padding:12px;text-align:center">' +
                        '<div style="font-size:1.4rem;font-weight:700;color:var(--accent)">' + totalAll.toFixed(1) + '</div>' +
                        '<div style="font-size:.75rem;color:var(--text2);margin-top:2px">Total Hours</div>' +
                    '</div>' +
                '</div>' +
                hoursBreakdownHtml
            );

        // ── Footer actions ────────────────────────────────────────────────────
        var footerHtml =
            '<div class="modal-footer">' +
                '<button class="btn btn-primary detail-edit-btn">Edit Worker</button>' +
                '<button class="btn btn-secondary detail-resend-welcome-btn">Resend Welcome Email</button>' +
                '<button class="btn btn-secondary modal-close">Close</button>' +
            '</div>';

        // ── Render into the overlay ───────────────────────────────────────────
        var modal = overlay.querySelector('.modal');
        var body  = overlay.querySelector('#workerDetailBody');
        body.style.cssText = 'display:block;min-height:unset';
        body.innerHTML     = bodyHtml;
        // Insert footer after body
        if (!modal.querySelector('.modal-footer')) {
            modal.insertAdjacentHTML('beforeend', footerHtml);
        }

        // Re-bind close buttons (footer close)
        modal.querySelectorAll('.modal-close').forEach(function(btn) {
            btn.addEventListener('click', function() { overlay.remove(); });
        });

        // Edit button opens the standard edit modal (without closing detail first)
        modal.querySelector('.detail-edit-btn').addEventListener('click', function() {
            overlay.remove();
            self._showModal(worker.id);
        });

        // Resend welcome email from the profile view
        modal.querySelector('.detail-resend-welcome-btn').addEventListener('click', function() {
            overlay.remove();
            self._showResendWelcomeModal(worker.id);
        });

        // Reset PIN from detail view
        modal.querySelectorAll('.detail-reset-pin').forEach(function(btn) {
            btn.addEventListener('click', function() {
                overlay.remove();
                self._showSetPinModal(worker);
            });
        });

        // PIN show/hide toggle (only present for plain-text PINs)
        var pinToggle = modal.querySelector('#detailPinToggle');
        if (pinToggle) {
            pinToggle.addEventListener('click', function() {
                var masked   = modal.querySelector('#detailPinMasked');
                var revealed = modal.querySelector('#detailPinRevealed');
                if (revealed.style.display === 'none') {
                    masked.style.display   = 'none';
                    revealed.style.display = 'inline';
                    pinToggle.textContent  = 'Hide';
                } else {
                    masked.style.display   = 'inline';
                    revealed.style.display = 'none';
                    pinToggle.textContent  = 'Show';
                }
            });
        }
    },

    _showModal(editId) {
        const self = this;
        const worker = editId ? AppData.getWorker(editId) : null;
        const isEdit = !!worker;
        const esc = Utils.escapeHtml;
        const projects = AppData.getProjects();
        const assignedProjects = [];
        if (isEdit) {
            projects.forEach(function(p) {
                if (p.assignedWorkers && p.assignedWorkers.includes(worker.id)) {
                    assignedProjects.push(p.id);
                }
            });
        }

        const bodyHtml = `
            <form id="workerModalForm" novalidate>

                <!-- Personal Information -->
                <div style="font-size:.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px">Personal Information</div>
                <div class="form-row" style="margin-bottom:12px">
                    <div class="form-group">
                        <label>Worker Name *</label>
                        <input class="form-control" name="name" value="${esc(worker ? worker.name : '')}" required>
                    </div>
                    <div class="form-group">
                        <label>Phone Number</label>
                        <input class="form-control" type="tel" name="phone" value="${esc(worker ? worker.phone || '' : '')}" placeholder="e.g. 905-555-0100">
                    </div>
                </div>
                <div class="form-row" style="margin-bottom:12px">
                    <div class="form-group">
                        <label>Date of Birth</label>
                        <input class="form-control" type="date" name="dob" value="${esc(worker ? worker.dob || '' : '')}">
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select class="form-control" name="status">
                            <option value="Active" ${(!worker || worker.status === 'Active') ? 'selected' : ''}>Active</option>
                            <option value="Inactive" ${worker && worker.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:12px">
                    <label>Home Address</label>
                    <input class="form-control" name="address" value="${esc(worker ? worker.address || '' : '')}" placeholder="Street, City, Province, Postal Code">
                </div>
                <div class="form-group" style="margin-bottom:16px">
                    <label>Social Insurance Number (SIN)</label>
                    <div style="position:relative">
                        <input class="form-control" name="sin" id="workerSinInput" type="password" value="${esc(worker ? worker.sin || '' : '')}" placeholder="9-digit SIN" maxlength="9" inputmode="numeric" style="padding-right:50px">
                        <button type="button" id="toggleSinVisibility" class="btn-ghost btn-sm" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:.75rem">Show</button>
                    </div>
                    <p style="font-size:.75rem;color:var(--text2);margin-top:4px">Stored securely. Visible only to admins. Never shared with workers.</p>
                </div>

                <!-- Account & Access -->
                <div style="font-size:.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px;border-top:1px solid var(--border);padding-top:12px">Account &amp; Access</div>
                <div class="form-row" style="margin-bottom:12px">
                    <div class="form-group">
                        <label>Role *</label>
                        <select class="form-control" name="role">
                            <option value="Worker" ${(!worker || worker.role === 'Worker') ? 'selected' : ''}>Worker</option>
                            <option value="Supervisor" ${worker && worker.role === 'Supervisor' ? 'selected' : ''}>Supervisor</option>
                            <option value="Approver" ${worker && worker.role === 'Approver' ? 'selected' : ''}>Approver</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input class="form-control" type="email" name="email" value="${esc(worker ? worker.email || '' : '')}" placeholder="worker@email.com">
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:12px">
                    <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">
                        <input type="checkbox" name="email2FA" ${worker && worker.email2FAEnabled ? 'checked' : ''}>
                        Enable Email 2FA
                    </label>
                    <p style="font-size:.75rem;color:var(--text2);margin-top:4px">Sends a verification code to the worker's email on every login. Requires email address above.</p>
                </div>
                <div class="form-group" style="margin-bottom:16px">
                    <label>PIN (6+ digits)${isEdit ? ' — leave blank to keep current' : ' *'}</label>
                    <div style="position:relative;max-width:200px">
                        <input class="form-control" name="pin" id="workerPinInput" type="password" maxlength="12" inputmode="numeric" value="" placeholder="${isEdit ? 'Leave blank to keep current' : 'Enter 6+ digit PIN'}" style="padding-right:50px">
                        <button type="button" id="togglePinVisibility" class="btn-ghost btn-sm" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:.75rem">Show</button>
                    </div>
                </div>

                <!-- Rates -->
                <div style="font-size:.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px;border-top:1px solid var(--border);padding-top:12px">Rates</div>
                <div class="form-row" style="margin-bottom:4px">
                    <div class="form-group">
                        <label>Pay Rate ($/hr)</label>
                        <input class="form-control" type="number" name="payRate" step="0.01" min="0" value="${worker ? (worker.payRate || worker.defaultRate || '') : ''}" placeholder="0.00">
                    </div>
                    <div class="form-group">
                        <label>Cost Rate ($/hr)</label>
                        <input class="form-control" type="number" name="costRate" step="0.01" min="0" value="${worker ? worker.costRate || '' : ''}" placeholder="0.00">
                    </div>
                </div>
                <p style="font-size:.75rem;color:var(--text2);margin:0 0 16px">
                    <strong>Pay Rate</strong> — what the worker earns; applied to project labour cost tracking.<br>
                    <strong>Cost Rate</strong> — billable rate charged to the client on invoices.
                </p>

                <!-- Project Assignment -->
                ${projects.length > 0 ? `
                <div style="font-size:.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px;border-top:1px solid var(--border);padding-top:12px">Project Assignment</div>
                <div class="form-group" style="margin-bottom:12px">
                    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
                        ${projects.map(function(p) {
                            const checked = assignedProjects.includes(p.id) ? ' checked' : '';
                            return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:.9rem">' +
                                '<input type="checkbox" class="project-checkbox" value="' + p.id + '"' + checked + '> ' +
                                esc(p.name) +
                            '</label>';
                        }).join('')}
                    </div>
                </div>` : ''}

            </form>
        `;

        const modal = UI.modal(
            isEdit ? 'Edit Worker' : 'Add Worker',
            bodyHtml,
            { width: '640px', submitLabel: (isEdit ? 'Update' : 'Add') + ' Worker' }
        );
        const q = s => modal.q(s);

        // Toggle PIN visibility
        q('#togglePinVisibility').addEventListener('click', function() {
            const pinInput = q('#workerPinInput');
            if (pinInput.type === 'password') {
                pinInput.type = 'text';
                this.textContent = 'Hide';
            } else {
                pinInput.type = 'password';
                this.textContent = 'Show';
            }
        });

        // Toggle SIN visibility
        q('#toggleSinVisibility').addEventListener('click', function() {
            const sinInput = q('#workerSinInput');
            if (sinInput.type === 'password') {
                sinInput.type = 'text';
                this.textContent = 'Hide';
            } else {
                sinInput.type = 'password';
                this.textContent = 'Show';
            }
        });

        q('#workerModalForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!Utils.validateForm(this)) return;
            const fd = Utils.getFormData(this);
            if (!fd.name.trim()) {
                Utils.showToast('Worker name is required', 'error');
                return;
            }
            // PIN: required on create, optional on edit (blank = keep existing)
            const pinChanged = fd.pin && fd.pin.length > 0;
            if (!isEdit && (!fd.pin || fd.pin.length < 6 || fd.pin.length > 12 || !/^\d+$/.test(fd.pin))) {
                Utils.showToast('PIN must be at least 6 digits', 'error');
                return;
            }
            if (isEdit && pinChanged && (fd.pin.length < 6 || fd.pin.length > 12 || !/^\d+$/.test(fd.pin))) {
                Utils.showToast('New PIN must be at least 6 digits', 'error');
                return;
            }

            const workerData = {
                id: isEdit ? worker.id : AppData.generateId(),
                name: fd.name.trim(),
                role: fd.role || 'Worker',
                pin: pinChanged ? fd.pin : (isEdit ? '' : fd.pin),
                status: fd.status || 'Active',
                email: (fd.email || '').trim() || (isEdit ? worker.email || '' : ''),
                phone: (fd.phone || '').trim(),
                dob: (fd.dob || '').trim(),
                address: (fd.address || '').trim(),
                sin: (fd.sin || '').trim(),
                payRate: parseFloat(fd.payRate) || 0,
                costRate: parseFloat(fd.costRate) || 0,
                defaultRate: parseFloat(fd.payRate) || 0, // backward compat
                twoFAEnabled: isEdit ? worker.twoFAEnabled || false : false,
                totpSecret: isEdit ? worker.totpSecret || '' : '',
                email2FAEnabled: fd.email2FA === 'on' && !!((fd.email || '').trim() || (isEdit ? worker.email || '' : ''))
            };
            // Workers use dedicated endpoint — saveWorkerAsync handles POST vs PUT
            const restore = UI.btnLoading(modal.submitBtn, 'Saving…');
            try {
                await AppData.saveWorkerAsync(workerData);
                // Also persist project assignment changes (fire-and-forget is acceptable here
                // since project data was already confirmed by prior loads — just updating an array field)
                const selectedProjects = [];
                modal.overlay.querySelectorAll('.project-checkbox:checked').forEach(function(cb) {
                    selectedProjects.push(cb.value);
                });
                const allProjects = AppData.getProjects();
                for (const p of allProjects) {
                    const assigned = p.assignedWorkers || [];
                    const isAssigned = assigned.includes(workerData.id);
                    const shouldBeAssigned = selectedProjects.includes(p.id);
                    if (shouldBeAssigned && !isAssigned) {
                        p.assignedWorkers = assigned.concat([workerData.id]);
                        AppData.saveEntityAsync('projects', p).catch(function() {});
                    } else if (!shouldBeAssigned && isAssigned) {
                        p.assignedWorkers = assigned.filter(function(wid) { return wid !== workerData.id; });
                        AppData.saveEntityAsync('projects', p).catch(function() {});
                    }
                }
            } catch(err) {
                restore();
                Utils.showToast('Save failed: ' + err.message, 'error');
                return;
            }
            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, isEdit ? 'Worker Updated' : 'Worker Added', workerData.name + ' (' + workerData.role + ')');
            Utils.showToast(isEdit ? 'Worker updated' : 'Worker added');
            modal.close();
            self._renderList();
        });

        if (modal.submitBtn) modal.submitBtn.addEventListener('click', () => q('#workerModalForm').requestSubmit());
    },

    _showSetPinModal(worker) {
        const self = this;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:10px;width:100%;max-width:380px;padding:24px;box-sizing:border-box">
                <h3 style="margin-bottom:6px">Set PIN — ${Utils.escapeHtml(worker.name)}</h3>
                <p style="color:#666;font-size:.88em;margin-bottom:20px">Enter a specific PIN or auto-generate a random one.</p>
                <div style="margin-bottom:16px">
                    <label style="font-size:.85em;font-weight:600;display:block;margin-bottom:6px">New PIN (6–12 digits)</label>
                    <div style="display:flex;gap:8px;align-items:center">
                        <input id="manualPinInput" type="text" inputmode="numeric" pattern="[0-9]{6,12}" maxlength="12"
                            placeholder="Enter PIN manually"
                            style="flex:1;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:1em;letter-spacing:2px">
                        <button class="btn-secondary btn-sm" id="autoGenBtn" style="white-space:nowrap">Auto-generate</button>
                    </div>
                    <div id="pinError" style="display:none;margin-top:6px;color:#e74c3c;font-size:.82em"></div>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:10px">
                    <button class="btn-secondary" id="cancelPinBtn">Cancel</button>
                    <button class="btn-primary" id="savePinBtn">Set PIN</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#autoGenBtn').onclick = function() {
            overlay.querySelector('#manualPinInput').value = String(Math.floor(100000 + Math.random() * 900000));
            overlay.querySelector('#pinError').style.display = 'none';
        };
        overlay.querySelector('#cancelPinBtn').onclick = function() { document.body.removeChild(overlay); };
        overlay.querySelector('#savePinBtn').onclick = async function() {
            const pin = overlay.querySelector('#manualPinInput').value.trim();
            const errEl = overlay.querySelector('#pinError');
            if (!pin || !/^\d{6,12}$/.test(pin)) {
                errEl.textContent = 'PIN must be 6–12 digits.';
                errEl.style.display = 'block';
                return;
            }
            worker.pin = pin;
            try {
                await AppData.saveWorkerAsync(worker);
            } catch (e) {
                errEl.textContent = 'Failed to save PIN: ' + e.message;
                errEl.style.display = 'block';
                return;
            }
            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, 'PIN Set', 'Worker: ' + worker.name);
            Utils.showToast('PIN updated for ' + worker.name);
            document.body.removeChild(overlay);
            self._renderList();
        };
        overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
    },

    _showInviteModal(workerId) {
        const self = this;
        const worker = AppData.getWorker(workerId);
        if (!worker) return;

        const base = window.location.origin + window.location.pathname;

        const _buildModal = (token) => {
            const inviteUrl = base + '#invite/' + token;
            const qrApiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(inviteUrl);

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay active';
            overlay.style.display = 'flex';
            overlay.innerHTML =
                '<div class="modal" style="max-width:480px;text-align:center">' +
                    '<h3>Invite ' + Utils.escapeHtml(worker.name) + '</h3>' +
                    '<p style="color:var(--text2);margin-bottom:20px">Share this link so ' + Utils.escapeHtml(worker.name) + ' can set up their PIN and optionally enable 2-factor authentication.</p>' +

                    '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:20px;text-align:left">' +
                        '<p style="font-size:.8rem;color:var(--text2);margin:0 0 6px">Invite Link:</p>' +
                        '<div style="display:flex;gap:8px;align-items:center">' +
                            '<input type="text" class="form-control" id="inviteLinkInput" value="' + Utils.escapeHtml(inviteUrl) + '" readonly style="font-size:.72rem;background:var(--bg)">' +
                            '<button class="btn btn-primary btn-sm" id="copyInviteLink" style="white-space:nowrap">Copy</button>' +
                        '</div>' +
                    '</div>' +

                    '<p style="font-size:.85rem;color:var(--text2);margin-bottom:10px">Or have them scan this QR code with their phone camera:</p>' +
                    '<img src="' + qrApiUrl + '" alt="Invite QR Code"' +
                    '    style="width:200px;height:200px;border-radius:8px;border:4px solid var(--bg2);margin-bottom:20px">' +

                    '<div style="background:rgba(46,204,113,.08);border:1px solid rgba(46,204,113,.25);border-radius:var(--radius);padding:10px;margin-bottom:20px;text-align:left">' +
                        '<p style="margin:0;font-size:.82rem;color:var(--success)">✓ &nbsp;One-time use &nbsp;·&nbsp; Expires in 7 days &nbsp;·&nbsp; Worker sets their own PIN</p>' +
                    '</div>' +

                    '<button class="btn btn-secondary btn-block modal-close">Done</button>' +
                '</div>';

            document.body.appendChild(overlay);
            overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
            overlay.querySelector('.modal-close').addEventListener('click', function() { overlay.remove(); });
            overlay.querySelector('#copyInviteLink').addEventListener('click', function() {
                const btn = this;
                navigator.clipboard.writeText(inviteUrl).then(function() {
                    Utils.showToast('Link copied!');
                    btn.textContent = '✓ Copied';
                    setTimeout(function() { btn.textContent = 'Copy'; }, 2500);
                }).catch(function() {
                    const input = overlay.querySelector('#inviteLinkInput');
                    input.select();
                    try { document.execCommand('copy'); } catch(e) {}
                    Utils.showToast('Link copied!');
                });
            });
        }; // end _buildModal

        const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';

        if (AppData.isApiMode()) {
            // Create invite server-side to get a secure token
            AppData.apiCreateInvite(workerId, worker.name)
                .then(function(data) {
                    _buildModal(data.token);
                    AppData.addAuditLog(username, 'Invite Generated', 'Worker: ' + worker.name);
                })
                .catch(function(err) {
                    Utils.showToast('Could not create invite: ' + err.message, 'error');
                });
        } else {
            // Legacy: generate client-side token
            const token = AppData.generateId() + AppData.generateId() + AppData.generateId();
            const invite = { id: AppData.generateId(), token: token, workerId: workerId, createdAt: new Date().toISOString(), used: false };
            AppData.saveInvite(invite);
            _buildModal(token);
            AppData.addAuditLog(username, 'Invite Generated', 'Worker: ' + worker.name);
        }
    },

    // Resend the welcome / login email to an existing worker. Confirms before
    // sending, lets the admin correct the email first, reuses the account (never
    // creates a duplicate), and reports clear success/failure. Backend records
    // who sent it and when.
    _showResendWelcomeModal(workerId) {
        const self = this;
        const worker = AppData.getWorker(workerId);
        if (!worker) return;

        if (!AppData.isApiMode() || !AppData.getJwt || !AppData.getJwt()) {
            Utils.showToast('Resend Welcome Email needs you to be signed in to the server.', 'error');
            return;
        }

        const esc = Utils.escapeHtml;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML =
            '<div class="modal" style="max-width:460px">' +
                '<h3>Resend Welcome Email</h3>' +
                '<p style="color:var(--text2);margin-bottom:16px">' +
                    'Send <strong>' + esc(worker.name) + '</strong> a fresh welcome email with a link to ' +
                    'activate their account, choose their PIN, and log in. This reuses their existing ' +
                    'account and cancels any earlier unused invite link.</p>' +
                '<div class="form-group" style="margin-bottom:18px">' +
                    '<label>Send to email address</label>' +
                    '<input type="email" class="form-control" id="resendWelcomeEmail" ' +
                        'value="' + esc(worker.email || '') + '" placeholder="worker@email.com">' +
                    '<p style="font-size:.78rem;color:var(--text2);margin:6px 0 0">' +
                        'Wrong address? Correct it here before sending and it will be saved.</p>' +
                '</div>' +
                '<div class="modal-footer">' +
                    '<button class="btn btn-primary" id="resendWelcomeConfirm">Send Welcome Email</button>' +
                    '<button class="btn btn-secondary modal-close">Cancel</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);
        const close = function() { overlay.remove(); };
        overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
        overlay.querySelector('.modal-close').addEventListener('click', close);

        const confirmBtn = overlay.querySelector('#resendWelcomeConfirm');
        confirmBtn.addEventListener('click', function() {
            const email = (overlay.querySelector('#resendWelcomeEmail').value || '').trim();
            if (!email || email.indexOf('@') < 0 || email.indexOf('.') < 0) {
                Utils.showToast('Please enter a valid email address.', 'error');
                return;
            }
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Sending…';

            // Only send a corrected email if it actually changed.
            const corrected = (email !== (worker.email || '')) ? email : null;
            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';

            AppData.apiResendWelcomeEmail(workerId, corrected)
                .then(function(resp) {
                    if (resp && resp.ok === false) {
                        throw new Error(resp.error || 'Email failed to send');
                    }
                    if (corrected) { worker.email = email; } // keep local cache in sync
                    Utils.showToast('Welcome email sent to ' + email, 'success');
                    AppData.addAuditLog(username, 'Welcome Email Resent', 'Worker: ' + worker.name + ' → ' + email);
                    close();
                    self._renderList();
                })
                .catch(function(err) {
                    Utils.showToast('Could not send welcome email: ' + (err.message || 'unknown error'), 'error');
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Send Welcome Email';
                });
        });
    },

    _startWizard() {
        const self = this;
        const projects = AppData.getProjects();
        const esc = Utils.escapeHtml;
        let step = 0;
        const totalSteps = 3;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay._wizData = {};

        function renderStep() {
            let html = '<div class="modal" style="max-width:550px"><h3>Add Worker - Step ' + (step + 1) + ' of ' + totalSteps + '</h3>';
            html += '<div style="background:var(--border);height:4px;border-radius:2px;margin-bottom:16px"><div style="background:var(--accent);height:100%;border-radius:2px;width:' + ((step + 1) / totalSteps * 100) + '%"></div></div>';

            if (step === 0) {
                html += '<p style="color:var(--text2);margin-bottom:12px">What is the worker\'s name and role?</p>' +
                    '<div class="form-group" style="margin-bottom:12px"><label>Worker Name *</label><input id="wiz-name" value="' + esc(overlay._wizData.name || '') + '" required></div>' +
                    '<div class="form-group" style="margin-bottom:4px"><label>Role</label><select id="wiz-role">' +
                    '<option value="Worker"' + (!overlay._wizData.role || overlay._wizData.role === 'Worker' ? ' selected' : '') + '>Worker</option>' +
                    '<option value="Supervisor"' + (overlay._wizData.role === 'Supervisor' ? ' selected' : '') + '>Supervisor</option>' +
                    '<option value="Approver"' + (overlay._wizData.role === 'Approver' ? ' selected' : '') + '>Approver</option></select></div>' +
                    '<p style="font-size:.75rem;color:var(--text2);margin:0 0 12px"><strong>Supervisor</strong> — can log equipment utilization on time entries in addition to regular time.</p>';
            } else if (step === 1) {
                html += '<p style="color:var(--text2);margin-bottom:12px">Set a PIN for this worker to log in with, and enter their hourly rates.</p>' +
                    '<div class="form-group" style="margin-bottom:12px"><label>PIN (6+ digits) *</label>' +
                    '<div style="position:relative;max-width:200px"><input id="wiz-pin" type="password" pattern="[0-9]{6,12}" minlength="6" maxlength="12" inputmode="numeric" value="' + esc(overlay._wizData.pin || '') + '" style="padding-right:50px">' +
                    '<button type="button" id="wiz-toggle-pin" class="btn-ghost btn-sm" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:.75rem">Show</button></div></div>' +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:4px">' +
                    '<div class="form-group"><label>Pay Rate ($/hr)</label><input type="number" id="wiz-payrate" step="0.01" min="0" value="' + (overlay._wizData.payRate || '') + '" placeholder="0.00"></div>' +
                    '<div class="form-group"><label>Cost Rate ($/hr)</label><input type="number" id="wiz-costrate" step="0.01" min="0" value="' + (overlay._wizData.costRate || '') + '" placeholder="0.00"></div>' +
                    '</div>' +
                    '<p style="font-size:.75rem;color:var(--text2);margin:0 0 12px">Pay Rate = worker\'s hourly pay. Cost Rate = billable rate charged to the client.</p>';
            } else if (step === 2) {
                html += '<p style="color:var(--text2);margin-bottom:12px">Assign this worker to projects (optional).</p>';
                if (projects.length === 0) {
                    html += '<p style="color:var(--text2)">No projects created yet. You can assign projects later.</p>';
                } else {
                    html += '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
                        projects.map(function(p) {
                            const checked = overlay._wizData.projects && overlay._wizData.projects.includes(p.id) ? ' checked' : '';
                            return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" class="wiz-project" value="' + p.id + '"' + checked + '> ' + esc(p.name) + '</label>';
                        }).join('') + '</div>';
                }
            }

            html += '<div class="form-actions" style="justify-content:space-between"><div>';
            if (step > 0) html += '<button class="btn-secondary" id="wizPrev">Previous</button>';
            html += '</div><div style="display:flex;gap:8px">';
            html += '<button class="btn-ghost" id="wizCancel">Cancel</button>';
            html += '<button class="btn-primary" id="wizNext">' + (step < totalSteps - 1 ? 'Next' : 'Add Worker') + '</button>';
            html += '</div></div></div>';

            overlay.innerHTML = html;
            var modal = overlay.querySelector('.modal');
            if (modal) { modal.style.transition = 'none'; modal.style.transform = 'none'; }
            bindEvents();
        }

        function bindEvents() {
            overlay.querySelector('#wizCancel').addEventListener('click', function() { overlay.remove(); });
            if (overlay.querySelector('#wizPrev')) {
                overlay.querySelector('#wizPrev').addEventListener('click', function() {
                    saveCurrentStep();
                    step--;
                    renderStep();
                });
            }
            // PIN toggle
            var toggleBtn = overlay.querySelector('#wiz-toggle-pin');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', function() {
                    var pinInput = overlay.querySelector('#wiz-pin');
                    if (pinInput.type === 'password') {
                        pinInput.type = 'text';
                        toggleBtn.textContent = 'Hide';
                    } else {
                        pinInput.type = 'password';
                        toggleBtn.textContent = 'Show';
                    }
                });
            }

            overlay.querySelector('#wizNext').addEventListener('click', async function() {
                if (step === 0) {
                    var name = overlay.querySelector('#wiz-name').value.trim();
                    if (!name) { Utils.showToast('Worker name is required', 'error'); return; }
                }
                if (step === 1) {
                    var pin = overlay.querySelector('#wiz-pin').value;
                    if (!pin || pin.length < 6 || pin.length > 12 || !/^\d+$/.test(pin)) {
                        Utils.showToast('PIN must be 6-12 digits', 'error');
                        return;
                    }
                    var existing = AppData.getWorkers().find(function(w) { return w.pin === pin; });
                    if (existing) {
                        Utils.showToast('This PIN is already in use by ' + existing.name, 'error');
                        return;
                    }
                }
                saveCurrentStep();
                if (step < totalSteps - 1) {
                    step++;
                    renderStep();
                } else {
                    // Create worker
                    var d = overlay._wizData;
                    var workerData = {
                        id: AppData.generateId(),
                        name: d.name,
                        role: d.role || 'Worker',
                        pin: d.pin,
                        status: 'Active',
                        payRate: parseFloat(d.payRate) || 0,
                        costRate: parseFloat(d.costRate) || 0,
                        defaultRate: parseFloat(d.payRate) || 0
                    };
                    try {
                        await AppData.saveWorkerAsync(workerData);
                    } catch (e) {
                        Utils.showToast('Failed to save worker: ' + e.message, 'error');
                        return;
                    }

                    // Assign to projects
                    var selectedProjects = d.projects || [];
                    for (var i = 0; i < selectedProjects.length; i++) {
                        var project = AppData.getProject(selectedProjects[i]);
                        if (project) {
                            var assigned = project.assignedWorkers || [];
                            if (!assigned.includes(workerData.id)) {
                                project.assignedWorkers = assigned.concat([workerData.id]);
                                try { await AppData.saveEntityAsync('projects', project); } catch (e) { /* non-critical */ }
                            }
                        }
                    }

                    var username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                    AppData.addAuditLog(username, 'Worker Added', workerData.name + ' (' + workerData.role + ') (via wizard)');
                    Utils.showToast('Worker added!');
                    overlay.remove();
                    self._renderList();
                }
            });
        }

        function saveCurrentStep() {
            if (step === 0) {
                overlay._wizData.name = overlay.querySelector('#wiz-name').value.trim();
                overlay._wizData.role = overlay.querySelector('#wiz-role').value;
            } else if (step === 1) {
                overlay._wizData.pin = overlay.querySelector('#wiz-pin').value;
                overlay._wizData.payRate = overlay.querySelector('#wiz-payrate').value;
                overlay._wizData.costRate = overlay.querySelector('#wiz-costrate').value;
            } else if (step === 2) {
                overlay._wizData.projects = [];
                overlay.querySelectorAll('.wiz-project:checked').forEach(function(cb) {
                    overlay._wizData.projects.push(cb.value);
                });
            }
        }

        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
        renderStep();
    }
};
