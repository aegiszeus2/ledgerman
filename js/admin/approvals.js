// Admin Approvals Module
window.AdminApprovals = {
    _tab: 'pending',
    _impactCodes: [],  // cached impact code list

    _pendingTimecards: [],  // pending timecards (separate table from submissions)

    // Date shown with the weekday name, e.g. "Monday, Jul 20, 2026".
    // Used on approval cards so reviewers see the day of week at a glance.
    _dayDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
        if (isNaN(d.getTime())) return (window.Utils ? Utils.formatDate(dateStr) : dateStr);
        return d.toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    },

    // Clock in/out line for an approval card. Renders only when both times exist.
    _clockLine(obj) {
        if (obj && obj.startTime && obj.endTime) {
            return '<div style="font-size:.85rem;color:var(--text2);margin-bottom:4px">' +
                '<strong>Clock in:</strong> ' + Utils.escapeHtml(obj.startTime) +
                ' &nbsp;•&nbsp; <strong>Clock out:</strong> ' + Utils.escapeHtml(obj.endTime) + '</div>';
        }
        return '';
    },

    render(container) {
        const self = this;
        self._container = container;
        // Load impact codes + pending timecards in background, then render
        Promise.all([self._loadImpactCodes(), self._loadPendingTimecards()])
            .then(function() { self._renderContent(); });
    },

    async _loadImpactCodes() {
        const self = this;
        try {
            const jwt = AppData.getJwt ? AppData.getJwt() : '';
            const res = await fetch(AppData.API_BASE + '/api/impact-codes?active=true', {
                headers: { 'Authorization': 'Bearer ' + jwt }
            });
            if (res.ok) self._impactCodes = await res.json();
        } catch (e) { /* silent */ }
    },

    // Timecards live in their own table (created by AI/email/batch entry) and do NOT
    // come through /api/sync's submissions collection — fetch them directly so they
    // surface in the approvals queue.
    async _loadPendingTimecards() {
        const self = this;
        try {
            const jwt = AppData.getJwt ? AppData.getJwt() : '';
            const res = await fetch(AppData.API_BASE + '/api/timecards?status=pending', {
                headers: { 'Authorization': 'Bearer ' + jwt }
            });
            if (res.ok) {
                const data = await res.json();
                self._pendingTimecards = Array.isArray(data) ? data : [];
            }
        } catch (e) { /* silent */ }
    },

    _impactCodeName(id) {
        const self = this;
        const ic = self._impactCodes.find(function(c) { return c.id === id; });
        return ic ? (ic.code ? '[' + ic.code + '] ' + ic.name : ic.name) : id;
    },

    _impactBadgeHtml(sub) {
        // sub may be an AppData submission object with impactCodeId field
        if (!sub || !sub.impactCodeId) return '';
        const self = this;
        const name = self._impactCodeName(sub.impactCodeId);
        const color = sub.impactBillableStatus === 'Billable'    ? '#e74c3c'
                    : sub.impactBillableStatus === 'Disputed'    ? '#e67e22'
                    : sub.impactBillableStatus === 'To Be Reviewed' ? '#f39c12'
                    : '#7f8c8d';
        return '<span title="Impact: ' + Utils.escapeHtml(name) + '" style="display:inline-block;background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44;font-size:.7rem;padding:1px 8px;border-radius:10px;margin-left:6px">&#9889; Impact</span>';
    },

    _renderContent() {
        const self = this;
        const container = self._container;
        const submissions = AppData.getSubmissions();
        const pending = submissions.filter(function(s) { return s.status === 'Pending'; });
        const approved = submissions.filter(function(s) { return s.status === 'Approved'; });
        const rejected = submissions.filter(function(s) { return s.status === 'Rejected'; });
        const pendingTc = Array.isArray(self._pendingTimecards) ? self._pendingTimecards : [];
        const pendingTotal = pending.length + pendingTc.length;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:20px">
                <h2 style="margin:0">Time Approvals</h2>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <button class="btn-secondary btn-sm" id="approvalsExportCsvBtn">Export CSV</button>
                    <button class="btn-secondary btn-sm" id="approvalsPrintBtn">Print</button>
                    <button class="btn-primary btn-sm" id="addTimecardBtn">+ Add Timecard</button>
                    <button class="btn-primary btn-sm" id="bulkApproveBtn">Bulk Approve</button>
                </div>
            </div>

            <div class="tabs" style="margin-bottom:16px">
                <button class="tab-btn ${self._tab === 'pending' ? 'active' : ''}" data-tab="pending">
                    Pending ${pendingTotal > 0 ? '<span class="badge-gold" style="margin-left:6px">' + pendingTotal + '</span>' : ''}
                </button>
                <button class="tab-btn ${self._tab === 'history' ? 'active' : ''}" data-tab="history">
                    History (${approved.length + rejected.length})
                </button>
            </div>

            <div id="approvalContent"></div>
        `;

        container.querySelectorAll('.tab-btn[data-tab]').forEach(function(tab) {
            tab.addEventListener('click', function() {
                self._tab = tab.dataset.tab;
                self._renderContent();
            });
        });

        const addTcBtn = container.querySelector('#addTimecardBtn');
        if (addTcBtn) {
            addTcBtn.addEventListener('click', function() {
                self._showEditModal(null);   // null id → create mode
            });
        }

        const bulkBtn = container.querySelector('#bulkApproveBtn');
        if (bulkBtn) {
            bulkBtn.addEventListener('click', async function() {
                const confirmed = await Utils.confirm('Approve all ' + pending.length + ' pending submissions? Each will be converted to a labor expense.');
                if (!confirmed) return;
                for (const sub of pending) {
                    await self._approveSubmission(sub);
                }
                Utils.showToast(pending.length + ' submissions approved');
                self._renderContent();
            });
        }

        // CSV helpers
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

        var exportCsvBtn = container.querySelector('#approvalsExportCsvBtn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', function() {
                var allSubs = AppData.getSubmissions();
                var rows = [csvRow(['Worker','Project','Date','Hours','Status','Notes'])];
                allSubs.forEach(function(sub) {
                    var worker = AppData.getWorker(sub.workerId);
                    var project = AppData.getProject(sub.projectId);
                    rows.push(csvRow([
                        worker ? worker.name : '',
                        project ? project.name : '',
                        sub.date || '',
                        sub.hours || '',
                        sub.status || '',
                        sub.description || ''
                    ]));
                });
                downloadCsv(rows.join('\n'), 'approvals');
            });
        }

        var printBtn = container.querySelector('#approvalsPrintBtn');
        if (printBtn) {
            printBtn.addEventListener('click', function() {
                if (!document.getElementById('approvalsPrintStyle')) {
                    var s = document.createElement('style');
                    s.id = 'approvalsPrintStyle';
                    s.textContent = '@media print { .admin-nav,.worker-nav,#adminSidebar,.btn-primary,.btn-secondary,.tab-btn,#pageHelpBtn { display:none!important; } body { font-size:11pt; } .card { box-shadow:none; border:1px solid #ddd; } }';
                    document.head.appendChild(s);
                }
                window.print();
            });
        }

        const contentEl = container.querySelector('#approvalContent');
        if (self._tab === 'pending') {
            contentEl.innerHTML = '<div id="tcPendingSection"></div><div id="subPendingSection"></div>';
            self._renderPendingTimecards(contentEl.querySelector('#tcPendingSection'), pendingTc);
            const subEl = contentEl.querySelector('#subPendingSection');
            if (pending.length === 0 && pendingTc.length > 0) {
                subEl.innerHTML = '';  // timecards already shown; skip duplicate empty-state
            } else {
                self._renderPending(subEl, pending);
            }
        } else {
            self._renderHistory(contentEl, approved, rejected);
        }
    },

    // ── Pending timecards (separate store, own approve/reject endpoints) ─────────
    _renderPendingTimecards(el, timecards) {
        const self = this;
        if (!el) return;
        if (!timecards || timecards.length === 0) { el.innerHTML = ''; return; }

        el.innerHTML = '<h3 style="margin:0 0 12px;font-size:1rem">Timecards Pending Review <span class="badge-gold" style="margin-left:6px">' + timecards.length + '</span></h3>' +
            timecards.map(function(tc) {
                const worker  = AppData.getWorker(tc.workerId);
                const project = AppData.getProject(tc.projectId);
                const workerName  = worker  ? worker.name  : (tc.workerId  || 'Unknown Worker');
                const projectName = project ? project.name : (tc.projectId || 'Unknown Project');
                const reg = parseFloat(tc.regularHours) || 0;
                const ot  = parseFloat(tc.otHours) || 0;
                const dt  = parseFloat(tc.dtHours) || 0;
                const total = reg + ot + dt;
                const breakdown = (ot || dt)
                    ? ' (' + reg + ' reg' + (ot ? ' + ' + ot + ' OT' : '') + (dt ? ' + ' + dt + ' DT' : '') + ')'
                    : '';
                return '<div class="card" data-tc-id="' + tc.id + '" style="border-left:3px solid var(--accent,#3498db)">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">' +
                        '<div style="flex:1;min-width:200px">' +
                            '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
                                '<strong style="font-size:1.05rem">' + Utils.escapeHtml(workerName) + '</strong>' +
                                '<span style="font-size:.7rem;padding:1px 8px;border-radius:10px;background:rgba(52,152,219,.15);color:#2980b9">Timecard</span>' +
                                '<span style="font-size:.85rem;color:var(--text2)">' + Utils.escapeHtml(projectName) + '</span>' +
                                '<span style="font-size:.8rem;color:var(--text2)">' + self._dayDate(tc.date) + '</span>' +
                            '</div>' +
                            self._clockLine(tc) +
                            (tc.costCode ? '<div style="font-size:.85rem;margin-bottom:4px"><strong>Cost code:</strong> ' + Utils.escapeHtml(tc.costCode) + '</div>' : '') +
                            '<div style="font-size:.9rem;margin-bottom:4px">' + Utils.escapeHtml(tc.notes || tc.workDescription || 'No description') + '</div>' +
                            '<div style="font-size:.85rem;color:var(--text2)">' + total + ' hrs' + breakdown + '</div>' +
                        '</div>' +
                        '<div style="display:flex;gap:8px;align-items:flex-start">' +
                            '<button class="btn btn-primary btn-sm tc-approve-btn" data-id="' + tc.id + '">Approve</button>' +
                            '<button class="btn btn-danger btn-sm tc-reject-btn" data-id="' + tc.id + '">Reject</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('');

        el.querySelectorAll('.tc-approve-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                btn.disabled = true;
                const ok = await self._timecardAction(btn.dataset.id, 'approve');
                if (ok) {
                    Utils.showToast('Timecard approved');
                    await self._loadPendingTimecards();
                    self._renderContent();
                } else {
                    btn.disabled = false;
                }
            });
        });

        el.querySelectorAll('.tc-reject-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._showTimecardRejectModal(btn.dataset.id);
            });
        });
    },

    async _timecardAction(tcId, action, reason) {
        try {
            const jwt = AppData.getJwt ? AppData.getJwt() : '';
            const res = await fetch(AppData.API_BASE + '/api/timecards/' + encodeURIComponent(tcId) + '/' + action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt },
                body: JSON.stringify(reason ? { reason: reason } : {})
            });
            if (!res.ok) {
                let msg = 'HTTP ' + res.status;
                try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) { /* ignore */ }
                Utils.showToast('Failed: ' + msg, 'error');
                return false;
            }
            return true;
        } catch (e) {
            Utils.showToast('Failed: ' + e.message, 'error');
            return false;
        }
    },

    _showTimecardRejectModal(tcId) {
        const self = this;
        const bodyHtml = `
            <div class="form-group" style="margin-bottom:12px">
                <label>Reason for rejection</label>
                <textarea class="form-control" id="tcRejectReason" rows="3" placeholder="Enter reason..."></textarea>
            </div>
        `;
        const modal = UI.modal('Reject Timecard', bodyHtml, {
            width: '400px',
            submitLabel: 'Reject',
            danger: true,
        });
        const q = s => modal.q(s);

        modal.submitBtn.addEventListener('click', async function() {
            const reason = q('#tcRejectReason').value.trim();
            const restore = UI.btnLoading(modal.submitBtn, 'Saving…');
            const ok = await self._timecardAction(tcId, 'reject', reason);
            if (!ok) { restore(); return; }
            Utils.showToast('Timecard rejected');
            modal.close();
            await self._loadPendingTimecards();
            self._renderContent();
        });
    },

    _renderPending(contentEl, pending) {
        const self = this;
        if (pending.length === 0) {
            contentEl.innerHTML = '<div class="card"><div class="empty"><h3>No Pending Approvals</h3><p>All worker submissions have been reviewed. Check back later.</p></div></div>';
            return;
        }

        const isAdmin = window.App && window.App.currentUser && window.App.currentUser.type === 'admin';

        contentEl.innerHTML = pending.map(function(sub) {
            const worker = AppData.getWorker(sub.workerId);
            const project = AppData.getProject(sub.projectId);
            const subtask = sub.subtaskId ? AppData.getSubtask(sub.subtaskId) : null;
            const workerName = worker ? worker.name : 'Unknown Worker';
            const projectName = project ? project.name : 'Unknown Project';

            let amountInfo = '';
            if (sub.rateType === 'Flat' || sub.rateType === 'flat') {
                amountInfo = 'Flat rate: ' + Utils.formatCurrency(sub.flatRate || sub.flatAmount || sub.amount);
            } else {
                // Worker time submissions don't carry a rate; fall back to the
                // worker's master defaultRate so approvals never show $0/hr.
                var effRate = (parseFloat(sub.rate) || 0) || (worker ? (parseFloat(worker.defaultRate) || 0) : 0);
                var timeStr = (sub.startTime && sub.endTime) ? sub.startTime + ' → ' + sub.endTime + ' &nbsp;|&nbsp; ' : '';
                amountInfo = timeStr + (parseFloat(sub.hours) || 0) + ' hrs @ ' + Utils.formatCurrency(effRate) + '/hr = ' + Utils.formatCurrency((parseFloat(sub.hours) || 0) * effRate);
            }

            const editHistory = Array.isArray(sub.editHistory) ? sub.editHistory : [];
            const editBadge = editHistory.length > 0
                ? '<span style="font-size:.72rem;padding:1px 7px;border-radius:10px;background:rgba(255,165,0,.18);color:#b8860b;margin-left:6px" title="' + Utils.escapeHtml(editHistory.map(function(e){ return 'Edited by ' + e.modifiedBy + (e.reason ? ': ' + e.reason : ''); }).join(' | ')) + '">✏ edited ' + editHistory.length + 'x</span>'
                : '';

            const impactBadge     = self._impactBadgeHtml(sub);
            const cardBorderColor = sub.impactCodeId ? 'var(--accent,#e74c3c)' : 'var(--warn,#f39c12)';
            const impactDetail    = sub.impactCodeId ? (function() {
                const icName = self._impactCodeName(sub.impactCodeId);
                return '<div style="margin-top:8px;padding:8px 10px;background:rgba(231,76,60,.07);border-radius:6px;font-size:.82rem">' +
                    '<strong>Impact:</strong> ' + Utils.escapeHtml(icName) +
                    (sub.impactHours ? ' &nbsp;|&nbsp; <strong>Hours:</strong> ' + sub.impactHours : '') +
                    (sub.impactBillableStatus ? ' &nbsp;|&nbsp; <strong>Billable:</strong> ' + Utils.escapeHtml(sub.impactBillableStatus) : '') +
                    (sub.impactDescription ? '<br><span style="color:var(--text2)">' + Utils.escapeHtml(sub.impactDescription) + '</span>' : '') +
                '</div>';
            })() : '';

            return '<div class="card" data-sub-id="' + sub.id + '" style="border-left:3px solid ' + cardBorderColor + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">' +
                    '<div style="flex:1;min-width:200px">' +
                        '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
                            '<strong style="font-size:1.05rem">' + Utils.escapeHtml(workerName) + '</strong>' +
                            editBadge +
                            impactBadge +
                            '<span style="font-size:.85rem;color:var(--text2)">' + Utils.escapeHtml(projectName) + '</span>' +
                            '<span style="font-size:.8rem;color:var(--text2)">' + self._dayDate(sub.date) + '</span>' +
                        '</div>' +
                        self._clockLine(sub) +
                        (subtask ? '<div style="font-size:.85rem;margin-bottom:4px"><strong>Subtask:</strong> ' + Utils.escapeHtml(subtask.name) + '</div>' : '') +
                        '<div style="font-size:.9rem;margin-bottom:4px">' + Utils.escapeHtml(sub.description || 'No description') + '</div>' +
                        '<div style="font-size:.85rem;color:var(--text2)">' + amountInfo + '</div>' +
                        (sub.entryMethod ? '<div style="font-size:.78rem;margin-top:3px"><span style="padding:2px 7px;border-radius:10px;background:' + (sub.entryMethod === 'Clock In/Out' ? 'rgba(46,204,113,.15);color:var(--success)' : 'rgba(200,200,200,.15);color:var(--text2)') + '">' + sub.entryMethod + '</span></div>' : '') +
                        (sub.unitsCompleted ? '<div style="font-size:.85rem;color:var(--text2)">Units completed: ' + sub.unitsCompleted + '</div>' : '') +
                        impactDetail +
                        '<div class="photo-thumbs" data-sub-id="' + sub.id + '" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px"></div>' +
                    '</div>' +
                    '<div style="display:flex;gap:8px;align-items:flex-start">' +
                        '<button class="btn btn-primary btn-sm approve-btn" data-id="' + sub.id + '">Approve</button>' +
                        '<button class="btn btn-danger btn-sm reject-btn" data-id="' + sub.id + '">Reject</button>' +
                        (isAdmin ? '<button class="btn-secondary btn-sm edit-sub-btn" data-id="' + sub.id + '">Edit</button>' : '') +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');

        // Load photo thumbnails
        pending.forEach(function(sub) {
            AppData.getPhotosBySubmission(sub.id).then(function(photos) {
                const thumbsEl = contentEl.querySelector('.photo-thumbs[data-sub-id="' + sub.id + '"]');
                if (!thumbsEl || photos.length === 0) return;
                photos.forEach(function(photo) {
                    const blob = photo.thumbnail || photo.blob;
                    if (!blob) return;
                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]));
                    img.style.cssText = 'width:60px;height:60px;object-fit:cover;border-radius:4px;cursor:pointer';
                    img.addEventListener('click', function() {
                        self._showPhotoLightbox(photo);
                    });
                    thumbsEl.appendChild(img);
                });
            });
        });

        // Approve buttons
        contentEl.querySelectorAll('.approve-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                const sub = AppData.getSubmission(btn.dataset.id);
                if (!sub) return;
                await self._approveSubmission(sub);
                Utils.showToast('Submission approved');
                self._renderContent();
            });
        });

        // Reject buttons
        contentEl.querySelectorAll('.reject-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._showRejectModal(btn.dataset.id);
            });
        });

        // Edit buttons (admin only — button already hidden for non-admins via render logic)
        contentEl.querySelectorAll('.edit-sub-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._showEditModal(btn.dataset.id);
            });
        });
    },

    _renderHistory(contentEl, approved, rejected) {
        const self = this;
        const all = approved.concat(rejected).sort(function(a, b) {
            return new Date(b.reviewedAt || b.date) - new Date(a.reviewedAt || a.date);
        });

        if (all.length === 0) {
            contentEl.innerHTML = '<div class="card"><div class="empty"><h3>No History</h3><p>Approved and rejected submissions will appear here.</p></div></div>';
            return;
        }

        const isAdmin = window.App && window.App.currentUser && window.App.currentUser.type === 'admin';

        contentEl.innerHTML = '<div class="card"><table>' +
            '<thead><tr><th>Date</th><th>Worker</th><th>Project</th><th>Description</th><th class="amount">Amount</th><th>Method</th><th>Status</th><th></th></tr></thead>' +
            '<tbody>' +
            all.map(function(sub) {
                const worker = AppData.getWorker(sub.workerId);
                const project = AppData.getProject(sub.projectId);
                let amount = 0;
                if (sub.rateType === 'flat' || sub.rateType === 'Flat') {
                    amount = parseFloat(sub.flatAmount || sub.amount) || 0;
                } else {
                    amount = (parseFloat(sub.hours) || 0) * (parseFloat(sub.rate) || 0);
                }
                const statusStyle = sub.status === 'Approved'
                    ? 'background:rgba(46,204,113,.2);color:var(--success)'
                    : 'background:rgba(233,69,96,.2);color:var(--accent)';
                const editHistory = Array.isArray(sub.editHistory) ? sub.editHistory : [];
                const editedTag = editHistory.length > 0
                    ? ' <span style="font-size:.68rem;color:#b8860b" title="' + Utils.escapeHtml(editHistory.map(function(e){ return 'Edited by ' + e.modifiedBy + (e.reason ? ': ' + e.reason : ''); }).join(' | ')) + '">✏</span>'
                    : '';

                let actionBtns = '';
                if (sub.status === 'Approved') {
                    actionBtns += '<button class="btn-secondary btn-sm unapprove-btn" data-id="' + sub.id + '" style="font-size:.75rem;padding:3px 10px;white-space:nowrap">Unapprove</button> ';
                }
                if (isAdmin) {
                    actionBtns += '<button class="btn-secondary btn-sm edit-sub-btn" data-id="' + sub.id + '" style="font-size:.75rem;padding:3px 10px">Edit</button>';
                }

                const impactBadgeHistory = self._impactBadgeHtml(sub);
                return '<tr>' +
                    '<td>' + Utils.formatDate(sub.date) + '</td>' +
                    '<td>' + Utils.escapeHtml(worker ? worker.name : 'Unknown') + '</td>' +
                    '<td>' + Utils.escapeHtml(project ? project.name : 'Unknown') + '</td>' +
                    '<td>' + Utils.escapeHtml(sub.description || '') + editedTag + impactBadgeHistory +
                        (sub.rejectionReason ? '<br><span style="font-size:.8rem;color:var(--accent)">Reason: ' + Utils.escapeHtml(sub.rejectionReason) + '</span>' : '') +
                        (sub.impactCodeId ? '<br><span style="font-size:.77rem;color:var(--text2)">Impact: ' + Utils.escapeHtml(self._impactCodeName(sub.impactCodeId)) + (sub.impactHours ? ' (' + sub.impactHours + 'h)' : '') + '</span>' : '') +
                    '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(amount) + '</td>' +
                    '<td style="font-size:.78rem;white-space:nowrap">' + (sub.entryMethod === 'Clock In/Out' ? '<span style="color:var(--success)">⏱ Clock In/Out</span>' : '<span style="color:var(--text2)">✏️ Manual</span>') + '</td>' +
                    '<td><span style="font-size:.75rem;padding:2px 8px;border-radius:12px;' + statusStyle + '">' + sub.status + '</span></td>' +
                    '<td style="white-space:nowrap">' + actionBtns + '</td>' +
                '</tr>';
            }).join('') +
            '</tbody></table></div>';

        // Unapprove buttons
        contentEl.querySelectorAll('.unapprove-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                const sub = AppData.getSubmission(btn.dataset.id);
                if (!sub) return;
                const worker = AppData.getWorker(sub.workerId);
                const confirmed = await Utils.confirm('Unapprove this entry for ' + (worker ? worker.name : 'this worker') + '? The linked expense will be removed and it will return to Pending.');
                if (!confirmed) return;
                await self._unapproveSubmission(sub);
                Utils.showToast('Submission unapproved — moved back to Pending');
                self._renderContent();
            });
        });

        // Edit buttons on history tab
        contentEl.querySelectorAll('.edit-sub-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._showEditModal(btn.dataset.id);
            });
        });
    },

    async _unapproveSubmission(sub) {
        // Remove the linked expense created on approval
        const allExpenses = AppData.getExpenses ? AppData.getExpenses() : [];
        const linked = allExpenses.filter(function(e) { return e.submissionId === sub.id; });
        linked.forEach(function(e) { AppData.deleteExpense(e.id); });

        // Move back to Pending
        sub.status = 'Pending';
        sub.reviewedAt = null;
        sub.reviewedBy = null;
        try {
            await AppData.saveEntityAsync('submissions', sub);
        } catch (e) {
            Utils.showToast('Failed to unapprove: ' + e.message, 'error');
            return;
        }

        const worker = AppData.getWorker(sub.workerId);
        const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
        AppData.addAuditLog(username, 'Submission Unapproved', (worker ? worker.name : 'Worker') + ' — returned to Pending');
    },

    async _approveSubmission(sub) {
        // Create labor expense from submission
        let amount = 0;
        if (sub.rateType === 'flat') {
            amount = parseFloat(sub.flatAmount || sub.amount) || 0;
        } else {
            amount = (parseFloat(sub.hours) || 0) * (parseFloat(sub.rate) || 0);
        }

        const expense = {
            id: AppData.generateId(),
            projectId: sub.projectId,
            category: 'Labor',
            description: sub.description || 'Labor',
            date: sub.date,
            amount: amount,
            billable: true,
            changeOrder: false,
            invoiceStatus: 'Ready to Invoice',
            subtaskId: sub.subtaskId || '',
            workerId: sub.workerId,
            rateType: sub.rateType || 'hourly',
            hours: parseFloat(sub.hours) || 0,
            rate: parseFloat(sub.rate) || 0,
            source: 'Worker Submission',
            submissionId: sub.id
        };
        try {
            await AppData.saveEntityAsync('expenses', expense);
        } catch (e) {
            Utils.showToast('Failed to create expense record: ' + e.message, 'error');
            return;
        }

        // Mark submission as approved
        sub.status = 'Approved';
        sub.reviewedAt = new Date().toISOString();
        sub.reviewedBy = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
        try {
            await AppData.saveEntityAsync('submissions', sub);
        } catch (e) {
            Utils.showToast('Failed to mark submission approved: ' + e.message, 'error');
            return;
        }

        const worker = AppData.getWorker(sub.workerId);
        const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
        AppData.addAuditLog(username, 'Submission Approved', (worker ? worker.name : 'Worker') + ' - ' + Utils.formatCurrency(amount));
    },

    _showRejectModal(subId) {
        const self = this;
        const bodyHtml = `
            <div class="form-group" style="margin-bottom:12px">
                <label>Reason for rejection</label>
                <textarea class="form-control" id="rejectReason" rows="3" placeholder="Enter reason..."></textarea>
            </div>
        `;
        const modal = UI.modal('Reject Submission', bodyHtml, {
            width: '400px',
            submitLabel: 'Reject',
            danger: true,
        });
        const q = s => modal.q(s);

        modal.submitBtn.addEventListener('click', async function() {
            const reason = q('#rejectReason').value.trim();
            const sub = AppData.getSubmission(subId);
            if (!sub) { modal.close(); return; }

            sub.status = 'Rejected';
            sub.rejectionReason = reason;
            sub.reviewedAt = new Date().toISOString();
            sub.reviewedBy = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            const restore = UI.btnLoading(modal.submitBtn, 'Saving…');
            try {
                await AppData.saveEntityAsync('submissions', sub);
            } catch (e) {
                Utils.showToast('Failed to reject submission: ' + e.message, 'error');
                restore();
                return;
            }

            const worker = AppData.getWorker(sub.workerId);
            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, 'Submission Rejected', (worker ? worker.name : 'Worker') + (reason ? ' - ' + reason : ''));
            Utils.showToast('Submission rejected');
            modal.close();
            self._renderContent();
        });
    },

    _showEditModal(subId) {
        const self = this;
        const isCreate = !subId;
        let sub;
        if (isCreate) {
            const _d = new Date();
            const _today = _d.getFullYear() + '-' +
                String(_d.getMonth() + 1).padStart(2, '0') + '-' +
                String(_d.getDate()).padStart(2, '0');
            sub = { id: null, status: 'Pending', date: _today, rateType: 'Hourly', equipmentEntries: [] };
        } else {
            sub = AppData.getSubmission(subId);
        }
        if (!sub) return;

        const isApproved = sub.status === 'Approved';
        const isRejected = sub.status === 'Rejected';
        const editHistory = Array.isArray(sub.editHistory) ? sub.editHistory : [];

        // ── Dropdown data ────────────────────────────────────────────────────
        const allWorkers   = AppData.getWorkers   ? AppData.getWorkers()   : [];
        const allProjects  = AppData.getProjects  ? AppData.getProjects()  : [];
        const allEquipment = AppData.getEquipment ? AppData.getEquipment() : [];

        function buildWorkerOptions(selId) {
            const opts = allWorkers.map(function(w) {
                return '<option value="' + Utils.escapeHtml(w.id) + '"' + (w.id === selId ? ' selected' : '') + '>' + Utils.escapeHtml(w.name) + '</option>';
            }).join('');
            return isCreate ? '<option value="">— Select Worker —</option>' + opts : opts;
        }
        function buildProjectOptions(selId) {
            return '<option value="">— Select Project —</option>' +
                allProjects.map(function(p) {
                    return '<option value="' + Utils.escapeHtml(p.id) + '"' + (p.id === selId ? ' selected' : '') + '>' + Utils.escapeHtml(p.name) + '</option>';
                }).join('');
        }
        function buildSubtaskOptions(projectId, selId) {
            const subs = projectId ? AppData.getSubtasks(projectId) : [];
            return '<option value="">— None —</option>' +
                subs.map(function(s) {
                    return '<option value="' + Utils.escapeHtml(s.id) + '"' + (s.id === selId ? ' selected' : '') + '>' + Utils.escapeHtml(s.name) + '</option>';
                }).join('');
        }
        function buildEquipOptions(selId) {
            return '<option value="">— Select Equipment —</option>' +
                allEquipment.map(function(e) {
                    return '<option value="' + Utils.escapeHtml(e.id) + '"' + (e.id === selId ? ' selected' : '') + '>' + Utils.escapeHtml(e.name || e.id) + '</option>';
                }).join('');
        }
        function equipRowHtml(eq) {
            return '<div class="equip-entry-row" style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
                '<select class="form-control equip-id-sel" style="flex:1">' + buildEquipOptions(eq ? eq.equipmentId : '') + '</select>' +
                '<input type="number" class="form-control equip-hrs-inp" value="' + (eq ? (eq.hours || 0) : 0) + '" step="0.25" min="0" style="width:88px" placeholder="hrs">' +
                '<button type="button" class="btn-secondary equip-remove-btn" style="padding:4px 10px;flex-shrink:0">&#10005;</button>' +
            '</div>';
        }

        // ── Computed HTML chunks (before template literal) ──────────────────
        const currentRateType   = sub.rateType || 'Hourly';
        const isInitiallyFlat   = currentRateType === 'Flat' || currentRateType === 'flat';
        // Submissions carry no rate; seed the edit input from the worker's
        // master defaultRate so the admin never edits from a $0 baseline.
        const _editWorker       = (!isCreate && sub.workerId) ? AppData.getWorker(sub.workerId) : null;
        const editRateValue     = (parseFloat(sub.rate) || 0) || (_editWorker ? (parseFloat(_editWorker.defaultRate) || 0) : 0);
        const existingEquip     = Array.isArray(sub.equipmentEntries) ? sub.equipmentEntries : [];
        const equipListHtml     = existingEquip.map(function(eq) { return equipRowHtml(eq); }).join('');

        const impactOptionsHtml = '<option value="">— None —</option>' + self._impactCodes.map(function(ic) {
            const label = ic.code ? '[' + ic.code + '] ' + ic.name : ic.name;
            return '<option value="' + Utils.escapeHtml(ic.id) + '"' + (ic.id === sub.impactCodeId ? ' selected' : '') + '>' + Utils.escapeHtml(label) + '</option>';
        }).join('');

        const billableOptionsHtml = ['Billable', 'Disputed', 'To Be Reviewed'].map(function(opt) {
            return '<option value="' + opt + '"' + (sub.impactBillableStatus === opt ? ' selected' : '') + '>' + opt + '</option>';
        }).join('');

        const statusColor = isApproved ? 'rgba(46,204,113,.2);color:var(--success)'
                          : isRejected ? 'rgba(233,69,96,.2);color:var(--accent)'
                          : 'rgba(255,193,7,.2);color:#856404';

        // ── Edit history HTML ───────────────────────────────────────────────
        let historyHtml = '';
        if (editHistory.length > 0) {
            historyHtml = '<div style="background:var(--bg-surface);border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:.8rem">' +
                '<strong style="display:block;margin-bottom:6px;color:var(--text2)">Edit History</strong>' +
                editHistory.map(function(e) {
                    const changeLines = Object.keys(e.changes || {}).map(function(k) {
                        return '<span style="color:var(--text2)">' + Utils.escapeHtml(k) + ':</span> ' +
                               Utils.escapeHtml(String(e.changes[k].from)) + ' → ' +
                               '<strong>' + Utils.escapeHtml(String(e.changes[k].to)) + '</strong>';
                    }).join(' &nbsp;|&nbsp; ');
                    return '<div style="margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid var(--border,#e0e0e0)">' +
                        '<span style="color:var(--text2)">' + (e.modifiedAt ? new Date(e.modifiedAt).toLocaleString() : '') + '</span> &nbsp;by <strong>' + Utils.escapeHtml(e.modifiedBy || '') + '</strong>' +
                        (e.reason ? ' &mdash; <em>' + Utils.escapeHtml(e.reason) + '</em>' : '') +
                        (changeLines ? '<br>' + changeLines : '') +
                    '</div>';
                }).join('') +
            '</div>';
        }

        // ── Status warning banner ───────────────────────────────────────────
        let statusBanner = '';
        if (isApproved) {
            statusBanner = '<div style="background:rgba(255,165,0,.12);border:1px solid rgba(255,165,0,.4);border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:.85rem">' +
                '⚠️ This entry is <strong>Approved</strong>. Editing will update the record. ' +
                'Check "Require re-approval" below to move it back to Pending and invalidate the linked expense.</div>';
        } else if (isRejected) {
            statusBanner = '<div style="background:rgba(52,152,219,.1);border:1px solid rgba(52,152,219,.3);border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:.85rem">' +
                'ℹ️ This entry was <strong>Rejected</strong>. You can edit and optionally move it back to Pending for re-review.</div>';
        }

        const bodyHtml = `
            <p style="font-size:.85rem;color:var(--text2);margin:-8px 0 14px">
                <span style="font-size:.78rem;padding:2px 7px;border-radius:10px;background:${statusColor}">${sub.status || 'Pending'}</span>
            </p>
            ${statusBanner}
            ${historyHtml}

            <fieldset style="border:1px solid var(--border,#e0e0e0);border-radius:6px;padding:12px 14px;margin-bottom:14px">
                <legend style="font-size:.8rem;font-weight:600;color:var(--text2);padding:0 6px">Assignment</legend>
                <div class="form-group">
                    <label>Worker</label>
                    <select class="form-control" id="editWorkerId">${buildWorkerOptions(sub.workerId)}</select>
                </div>
                <div class="form-group">
                    <label>Project <span style="color:var(--accent)">*</span></label>
                    <select class="form-control" id="editProjectId">${buildProjectOptions(sub.projectId)}</select>
                </div>
                <div class="form-group" style="margin-bottom:0">
                    <label>Subtask / Cost Code</label>
                    <select class="form-control" id="editSubtaskId">${buildSubtaskOptions(sub.projectId, sub.subtaskId)}</select>
                </div>
            </fieldset>

            <fieldset style="border:1px solid var(--border,#e0e0e0);border-radius:6px;padding:12px 14px;margin-bottom:14px">
                <legend style="font-size:.8rem;font-weight:600;color:var(--text2);padding:0 6px">Date &amp; Pay</legend>
                <div class="form-group">
                    <label>Date <span style="color:var(--accent)">*</span></label>
                    <input type="date" class="form-control" id="editDate" value="${sub.date || ''}">
                </div>
                <div class="form-group">
                    <label>Pay Type</label>
                    <select class="form-control" id="editRateType">
                        <option value="Hourly"${!isInitiallyFlat ? ' selected' : ''}>Hourly</option>
                        <option value="Flat"${isInitiallyFlat ? ' selected' : ''}>Flat Rate</option>
                    </select>
                </div>
                <div id="editHourlySection" style="display:${isInitiallyFlat ? 'none' : 'block'}">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div class="form-group">
                            <label>Start Time</label>
                            <input type="time" class="form-control" id="editStartTime" value="${sub.startTime || ''}">
                        </div>
                        <div class="form-group">
                            <label>End Time</label>
                            <input type="time" class="form-control" id="editEndTime" value="${sub.endTime || ''}">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div class="form-group" style="margin-bottom:0">
                            <label>Hours</label>
                            <input type="number" class="form-control" id="editHours" value="${sub.hours || 0}" step="0.25" min="0">
                        </div>
                        <div class="form-group" style="margin-bottom:0">
                            <label>Rate ($/hr)</label>
                            <input type="number" class="form-control" id="editRate" value="${editRateValue}" step="0.01" min="0">
                        </div>
                    </div>
                </div>
                <div id="editFlatSection" style="display:${isInitiallyFlat ? 'block' : 'none'}">
                    <div class="form-group" style="margin-bottom:0">
                        <label>Flat Amount ($)</label>
                        <input type="number" class="form-control" id="editFlatAmount" value="${sub.flatAmount || sub.flatRate || sub.amount || 0}" step="0.01" min="0">
                    </div>
                </div>
            </fieldset>

            <fieldset style="border:1px solid var(--border,#e0e0e0);border-radius:6px;padding:12px 14px;margin-bottom:14px">
                <legend style="font-size:.8rem;font-weight:600;color:var(--text2);padding:0 6px">Work Details</legend>
                <div class="form-group">
                    <label>Description / Notes</label>
                    <textarea class="form-control" id="editDescription" rows="2">${Utils.escapeHtml(sub.description || '')}</textarea>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    <div class="form-group" style="margin-bottom:0">
                        <label>Units Completed</label>
                        <input type="number" class="form-control" id="editUnitsCompleted" value="${sub.unitsCompleted || ''}" step="any" min="0" placeholder="0">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                        <label>Unit of Measure</label>
                        <input type="text" class="form-control" id="editUnitOfMeasure" value="${Utils.escapeHtml(sub.unitOfMeasure || '')}" placeholder="e.g. sq ft">
                    </div>
                </div>
            </fieldset>

            <fieldset style="border:1px solid var(--border,#e0e0e0);border-radius:6px;padding:12px 14px;margin-bottom:14px">
                <legend style="font-size:.8rem;font-weight:600;color:var(--text2);padding:0 6px">Equipment</legend>
                <div id="editEquipList">${equipListHtml}</div>
                <button type="button" id="editAddEquipBtn" class="btn-secondary btn-sm" style="margin-top:4px">+ Add Equipment</button>
                <div class="form-group" style="margin-top:10px;margin-bottom:0">
                    <label>Equipment Note</label>
                    <input type="text" class="form-control" id="editEquipNote" value="${Utils.escapeHtml(sub.equipmentNote || '')}" placeholder="General equipment note">
                </div>
            </fieldset>

            <fieldset style="border:1px solid var(--border,#e0e0e0);border-radius:6px;padding:12px 14px;margin-bottom:14px">
                <legend style="font-size:.8rem;font-weight:600;color:var(--text2);padding:0 6px">Impact / Delay Code</legend>
                <div class="form-group">
                    <label>Impact Code</label>
                    <select class="form-control" id="editImpactCodeId">${impactOptionsHtml}</select>
                </div>
                <div id="editImpactDetails" style="display:${sub.impactCodeId ? 'block' : 'none'}">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                        <div class="form-group">
                            <label>Impact Hours</label>
                            <input type="number" class="form-control" id="editImpactHours" value="${sub.impactHours || ''}" step="0.25" min="0" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label>Billable Status</label>
                            <select class="form-control" id="editImpactBillable">
                                <option value="">— Select —</option>
                                ${billableOptionsHtml}
                            </select>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                        <label>Impact Description</label>
                        <textarea class="form-control" id="editImpactDesc" rows="2">${Utils.escapeHtml(sub.impactDescription || '')}</textarea>
                    </div>
                </div>
            </fieldset>

            <fieldset style="border:1px solid var(--border,#e0e0e0);border-radius:6px;padding:12px 14px;margin-bottom:14px">
                <legend style="font-size:.8rem;font-weight:600;color:var(--text2);padding:0 6px">Admin Notes</legend>
                <div class="form-group">
                    <label>Reason for modification <span style="color:var(--text2);font-weight:normal">(recommended)</span></label>
                    <input type="text" class="form-control" id="editReason" placeholder="e.g. Worker selected wrong project — corrected to Project ABC">
                </div>
                ${(isApproved || isRejected) ? `
                <div class="form-group" style="display:flex;align-items:center;gap:8px;margin-bottom:0">
                    <input type="checkbox" id="editReApprove" ${isRejected ? 'checked' : ''}>
                    <label for="editReApprove" style="margin:0;cursor:pointer">
                        ${isApproved ? 'Require re-approval (moves back to Pending, removes linked expense)' : 'Move back to Pending for re-review'}
                    </label>
                </div>
                ` : ''}
            </fieldset>

            <div id="editErrMsg" style="color:var(--accent);font-size:.85rem;margin-bottom:8px;display:none"></div>
        `;

        const modal = UI.modal(isCreate ? 'Add Timecard' : 'Edit Submission', bodyHtml, {
            width: '580px',
            submitLabel: isCreate ? 'Create Timecard' : 'Save Changes',
            scrollBody: true,
        });
        const q = s => modal.q(s);

        // ── Dynamic wiring ──────────────────────────────────────────────────

        // Pay-type toggle
        q('#editRateType').addEventListener('change', function() {
            const flat = this.value === 'Flat' || this.value === 'flat';
            q('#editHourlySection').style.display = flat ? 'none' : 'block';
            q('#editFlatSection').style.display   = flat ? 'block' : 'none';
        });

        // Project → reload subtasks
        q('#editProjectId').addEventListener('change', function() {
            q('#editSubtaskId').innerHTML = buildSubtaskOptions(this.value, '');
        });

        // Equipment remove existing rows
        function bindEquipRemoveBtns() {
            q('#editEquipList').querySelectorAll('.equip-remove-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    btn.closest('.equip-entry-row').remove();
                });
            });
        }
        bindEquipRemoveBtns();

        // Equipment add row
        q('#editAddEquipBtn').addEventListener('click', function() {
            const list = q('#editEquipList');
            const tmp = document.createElement('div');
            tmp.innerHTML = equipRowHtml(null);
            const row = tmp.firstChild;
            list.appendChild(row);
            row.querySelector('.equip-remove-btn').addEventListener('click', function() {
                row.remove();
            });
        });

        // Impact code details show/hide
        q('#editImpactCodeId').addEventListener('change', function() {
            q('#editImpactDetails').style.display = this.value ? 'block' : 'none';
        });

        // ── Save ────────────────────────────────────────────────────────────
        modal.submitBtn.addEventListener('click', async function() {
            const errEl = q('#editErrMsg');
            errEl.style.display = 'none';

            const newDate      = q('#editDate').value;
            const newProjectId = q('#editProjectId').value;
            if (!newDate)      { errEl.textContent = 'Date is required.';    errEl.style.display = 'block'; return; }
            if (!newProjectId) { errEl.textContent = 'Project is required.'; errEl.style.display = 'block'; return; }

            const reason       = q('#editReason').value.trim();
            const reApproveEl  = q('#editReApprove');
            const requireReApproval = reApproveEl ? reApproveEl.checked : false;

            const newWorkerId    = q('#editWorkerId').value;
            const newSubtaskId   = q('#editSubtaskId').value;
            const newRateType    = q('#editRateType').value;
            const newIsFlat      = newRateType === 'Flat' || newRateType === 'flat';
            const newImpactCode  = q('#editImpactCodeId').value;

            const selWorker  = allWorkers.find(function(w) { return w.id === newWorkerId; });
            const selProject = allProjects.find(function(p) { return p.id === newProjectId; });
            const selSubtask = newSubtaskId ? AppData.getSubtask(newSubtaskId) : null;

            // Collect equipment rows
            const equipRows = q('#editEquipList').querySelectorAll('.equip-entry-row');
            const equipmentEntries = [];
            equipRows.forEach(function(row) {
                const equipId = row.querySelector('.equip-id-sel').value;
                const hrs     = parseFloat(row.querySelector('.equip-hrs-inp').value) || 0;
                if (equipId) {
                    const eqItem = allEquipment.find(function(e) { return e.id === equipId; });
                    equipmentEntries.push({
                        equipmentId:   equipId,
                        equipmentName: eqItem ? (eqItem.name || eqItem.id) : equipId,
                        hours:         hrs,
                    });
                }
            });

            const fields = {
                date:         newDate,
                description:  q('#editDescription').value.trim(),
                projectId:    newProjectId,
                workerId:     newWorkerId,
                workerName:   selWorker  ? selWorker.name  : '',
                subtaskId:    newSubtaskId || '',
                subtaskName:  selSubtask  ? selSubtask.name : '',
                rateType:     newRateType,
                unitsCompleted:  parseFloat(q('#editUnitsCompleted').value) || null,
                unitOfMeasure:   q('#editUnitOfMeasure').value.trim(),
                equipmentEntries: equipmentEntries,
                equipmentNote:   q('#editEquipNote').value.trim(),
                impactCodeId:            newImpactCode || null,
                impactHours:             newImpactCode ? (parseFloat(q('#editImpactHours').value) || null) : null,
                impactBillableStatus:    newImpactCode ? q('#editImpactBillable').value : null,
                impactDescription:       newImpactCode ? q('#editImpactDesc').value.trim() : null,
            };

            if (newIsFlat) {
                const flatAmt    = parseFloat(q('#editFlatAmount').value) || 0;
                fields.flatAmount = flatAmt;
                fields.flatRate   = flatAmt;
                fields.amount     = flatAmt;
            } else {
                fields.startTime = q('#editStartTime').value;
                fields.endTime   = q('#editEndTime').value;
                fields.hours     = parseFloat(q('#editHours').value) || 0;
                fields.rate      = parseFloat(q('#editRate').value) || 0;
            }

            // ── Create mode: brand-new admin-entered timecard ───────────────
            if (isCreate) {
                if (!newWorkerId) { errEl.textContent = 'Worker is required.'; errEl.style.display = 'block'; return; }
                const restoreC = UI.btnLoading(modal.submitBtn, 'Creating…');
                try {
                    const newSub = Object.assign({
                        id:              AppData.generateId(),
                        status:          'Pending',
                        submittedAt:     new Date().toISOString(),
                        entryMethod:     'Admin Entry',
                        rejectionReason: null,
                    }, fields);
                    AppData.saveSubmission(newSub);
                } catch (e) {
                    errEl.textContent = 'Failed to create: ' + e.message;
                    errEl.style.display = 'block';
                    restoreC();
                    return;
                }
                Utils.showToast('Timecard created — pending approval');
                modal.close();
                self._renderContent();
                return;
            }

            // Remove linked expense client-side if re-approving
            if (requireReApproval && isApproved) {
                const allExpenses = AppData.getExpenses ? AppData.getExpenses() : [];
                const linked = allExpenses.filter(function(e) { return e.submissionId === subId; });
                linked.forEach(function(e) { AppData.deleteExpense(e.id); });
            }

            const restore = UI.btnLoading(modal.submitBtn, 'Saving…');
            try {
                if (typeof AppData.editSubmissionAsync === 'function') {
                    await AppData.editSubmissionAsync(subId, fields, reason, requireReApproval);
                } else {
                    // Fallback: generic save (older deploy)
                    Object.assign(sub, fields);
                    if (requireReApproval && isApproved) { sub.status = 'Pending'; sub.reviewedAt = null; sub.reviewedBy = null; }
                    await AppData.saveEntityAsync('submissions', sub);
                }
            } catch (e) {
                errEl.textContent = 'Failed to save: ' + e.message;
                errEl.style.display = 'block';
                restore();
                return;
            }

            Utils.showToast('Submission updated' + (requireReApproval && (isApproved || isRejected) ? ' — moved to Pending' : ''));
            modal.close();
            self._renderContent();
        });
    },

    _showPhotoLightbox(photo) {
        const blob = photo.blob || photo.thumbnail;
        if (!blob) return;
        const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]));
        const modal = UI.modal('', '<img src="' + url + '" style="max-width:100%;max-height:70vh;object-fit:contain;border-radius:var(--radius);display:block;margin:0 auto">', {
            noFooter: true,
        });
        // Revoke URL when modal is closed
        const origClose = modal.close.bind(modal);
        modal.close = function() { URL.revokeObjectURL(url); origClose(); };
    }
};
