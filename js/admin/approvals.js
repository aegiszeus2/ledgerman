// Admin Approvals Module
window.AdminApprovals = {
    _tab: 'pending',

    render(container) {
        const self = this;
        self._container = container;
        self._renderContent();
    },

    _renderContent() {
        const self = this;
        const container = self._container;
        const submissions = AppData.getSubmissions();
        const pending = submissions.filter(function(s) { return s.status === 'Pending'; });
        const approved = submissions.filter(function(s) { return s.status === 'Approved'; });
        const rejected = submissions.filter(function(s) { return s.status === 'Rejected'; });

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                <h2>Approvals</h2>
                <div style="display:flex;gap:8px">
                    ${pending.length > 1 ? '<button class="btn btn-primary btn-sm" id="bulkApproveBtn">Approve All (' + pending.length + ')</button>' : ''}
                    <button class="btn-secondary btn-sm" id="approvalsExportCsvBtn">Export CSV</button>
                    <button class="btn-secondary btn-sm" id="approvalsPrintBtn">Print / PDF</button>
                </div>
            </div>

            <div class="tabs">
                <button class="tab-btn ${self._tab === 'pending' ? 'active' : ''}" data-tab="pending">
                    Pending ${pending.length > 0 ? '<span style="background:var(--amber);color:#000;font-size:.7rem;padding:1px 6px;border-radius:10px;margin-left:4px">' + pending.length + '</span>' : ''}
                </button>
                <button class="tab-btn ${self._tab === 'history' ? 'active' : ''}" data-tab="history">
                    Approved / Rejected (${approved.length + rejected.length})
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
            self._renderPending(contentEl, pending);
        } else {
            self._renderHistory(contentEl, approved, rejected);
        }
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
                var timeStr = (sub.startTime && sub.endTime) ? sub.startTime + ' → ' + sub.endTime + ' &nbsp;|&nbsp; ' : '';
                amountInfo = timeStr + (parseFloat(sub.hours) || 0) + ' hrs @ ' + Utils.formatCurrency(sub.rate || 0) + '/hr = ' + Utils.formatCurrency((parseFloat(sub.hours) || 0) * (parseFloat(sub.rate) || 0));
            }

            const editHistory = Array.isArray(sub.editHistory) ? sub.editHistory : [];
            const editBadge = editHistory.length > 0
                ? '<span style="font-size:.72rem;padding:1px 7px;border-radius:10px;background:rgba(255,165,0,.18);color:#b8860b;margin-left:6px" title="' + Utils.escapeHtml(editHistory.map(function(e){ return 'Edited by ' + e.modifiedBy + (e.reason ? ': ' + e.reason : ''); }).join(' | ')) + '">✏ edited ' + editHistory.length + 'x</span>'
                : '';

            return '<div class="card" data-sub-id="' + sub.id + '" style="border-left:3px solid var(--warn)">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">' +
                    '<div style="flex:1;min-width:200px">' +
                        '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
                            '<strong style="font-size:1.05rem">' + Utils.escapeHtml(workerName) + '</strong>' +
                            editBadge +
                            '<span style="font-size:.85rem;color:var(--text2)">' + Utils.escapeHtml(projectName) + '</span>' +
                            '<span style="font-size:.8rem;color:var(--text2)">' + Utils.formatDate(sub.date) + '</span>' +
                        '</div>' +
                        (subtask ? '<div style="font-size:.85rem;margin-bottom:4px"><strong>Subtask:</strong> ' + Utils.escapeHtml(subtask.name) + '</div>' : '') +
                        '<div style="font-size:.9rem;margin-bottom:4px">' + Utils.escapeHtml(sub.description || 'No description') + '</div>' +
                        '<div style="font-size:.85rem;color:var(--text2)">' + amountInfo + '</div>' +
                        (sub.entryMethod ? '<div style="font-size:.78rem;margin-top:3px"><span style="padding:2px 7px;border-radius:10px;background:' + (sub.entryMethod === 'Clock In/Out' ? 'rgba(46,204,113,.15);color:var(--success)' : 'rgba(200,200,200,.15);color:var(--text2)') + '">' + sub.entryMethod + '</span></div>' : '') +
                        (sub.unitsCompleted ? '<div style="font-size:.85rem;color:var(--text2)">Units completed: ' + sub.unitsCompleted + '</div>' : '') +
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

                return '<tr>' +
                    '<td>' + Utils.formatDate(sub.date) + '</td>' +
                    '<td>' + Utils.escapeHtml(worker ? worker.name : 'Unknown') + '</td>' +
                    '<td>' + Utils.escapeHtml(project ? project.name : 'Unknown') + '</td>' +
                    '<td>' + Utils.escapeHtml(sub.description || '') + editedTag +
                        (sub.rejectionReason ? '<br><span style="font-size:.8rem;color:var(--accent)">Reason: ' + Utils.escapeHtml(sub.rejectionReason) + '</span>' : '') +
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
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:400px">
                <h3>Reject Submission</h3>
                <div class="form-group" style="margin-bottom:12px">
                    <label>Reason for rejection</label>
                    <textarea class="form-control" id="rejectReason" rows="3" placeholder="Enter reason..."></textarea>
                </div>
                <div class="form-actions">
                    <button class="btn btn-danger" id="confirmReject">Reject</button>
                    <button class="btn btn-secondary modal-close">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('.modal-close').addEventListener('click', function() { overlay.remove(); });

        overlay.querySelector('#confirmReject').addEventListener('click', async function() {
            const reason = overlay.querySelector('#rejectReason').value.trim();
            const sub = AppData.getSubmission(subId);
            if (!sub) { overlay.remove(); return; }

            sub.status = 'Rejected';
            sub.rejectionReason = reason;
            sub.reviewedAt = new Date().toISOString();
            sub.reviewedBy = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            try {
                await AppData.saveEntityAsync('submissions', sub);
            } catch (e) {
                Utils.showToast('Failed to reject submission: ' + e.message, 'error');
                return;
            }

            const worker = AppData.getWorker(sub.workerId);
            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, 'Submission Rejected', (worker ? worker.name : 'Worker') + (reason ? ' - ' + reason : ''));
            Utils.showToast('Submission rejected');
            overlay.remove();
            self._renderContent();
        });
    },

    _showEditModal(subId) {
        const self = this;
        const sub = AppData.getSubmission(subId);
        if (!sub) return;

        const worker = AppData.getWorker(sub.workerId);
        const project = AppData.getProject(sub.projectId);
        const isFlat = sub.rateType === 'Flat' || sub.rateType === 'flat';
        const isApproved = sub.status === 'Approved';
        const isRejected = sub.status === 'Rejected';
        const editHistory = Array.isArray(sub.editHistory) ? sub.editHistory : [];

        // Build edit history HTML
        let historyHtml = '';
        if (editHistory.length > 0) {
            historyHtml = '<div style="background:var(--bg2,#f8f8f8);border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:.8rem">' +
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

        // Status warning banner
        let statusBanner = '';
        if (isApproved) {
            statusBanner = '<div style="background:rgba(255,165,0,.12);border:1px solid rgba(255,165,0,.4);border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:.85rem">' +
                '⚠️ This entry is <strong>Approved</strong>. Editing will update the record. ' +
                'Check "Require re-approval" below to move it back to Pending and invalidate the linked expense.' +
            '</div>';
        } else if (isRejected) {
            statusBanner = '<div style="background:rgba(52,152,219,.1);border:1px solid rgba(52,152,219,.3);border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:.85rem">' +
                'ℹ️ This entry was <strong>Rejected</strong>. You can edit and optionally move it back to Pending for re-review.' +
            '</div>';
        }

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:500px;max-height:90vh;overflow-y:auto">
                <h3>Edit Submission</h3>
                <p style="font-size:.85rem;color:var(--text2);margin-top:-8px;margin-bottom:14px">
                    ${Utils.escapeHtml(worker ? worker.name : 'Worker')} &mdash; ${Utils.escapeHtml(project ? project.name : 'Project')}
                    <span style="font-size:.78rem;padding:2px 7px;border-radius:10px;margin-left:6px;background:${isApproved ? 'rgba(46,204,113,.2);color:var(--success)' : isRejected ? 'rgba(233,69,96,.2);color:var(--accent)' : 'rgba(255,193,7,.2);color:#856404'}">${sub.status || 'Pending'}</span>
                </p>

                ${statusBanner}
                ${historyHtml}

                <div class="form-group">
                    <label>Date</label>
                    <input type="date" class="form-control" id="editDate" value="${sub.date || ''}">
                </div>

                <div class="form-group">
                    <label>Description / Notes</label>
                    <textarea class="form-control" id="editDescription" rows="2">${Utils.escapeHtml(sub.description || '')}</textarea>
                </div>

                ${isFlat ? `
                <div class="form-group">
                    <label>Flat Amount ($)</label>
                    <input type="number" class="form-control" id="editFlatAmount" value="${sub.flatAmount || sub.flatRate || sub.amount || 0}" step="0.01" min="0">
                </div>
                ` : `
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
                    <div class="form-group">
                        <label>Hours</label>
                        <input type="number" class="form-control" id="editHours" value="${sub.hours || 0}" step="0.25" min="0">
                    </div>
                    <div class="form-group">
                        <label>Rate ($/hr)</label>
                        <input type="number" class="form-control" id="editRate" value="${sub.rate || 0}" step="0.01" min="0">
                    </div>
                </div>
                `}

                <div class="form-group">
                    <label>Reason for modification <span style="color:var(--text2);font-weight:normal">(recommended)</span></label>
                    <input type="text" class="form-control" id="editReason" placeholder="e.g. Worker reported wrong hours, corrected to 7.5">
                </div>

                ${(isApproved || isRejected) ? `
                <div class="form-group" style="display:flex;align-items:center;gap:8px">
                    <input type="checkbox" id="editReApprove" ${isRejected ? 'checked' : ''}>
                    <label for="editReApprove" style="margin:0;cursor:pointer">
                        ${isApproved ? 'Require re-approval (moves back to Pending, removes linked expense)' : 'Move back to Pending for re-review'}
                    </label>
                </div>
                ` : ''}

                <div id="editErrMsg" style="color:var(--accent);font-size:.85rem;margin-bottom:8px;display:none"></div>

                <div class="form-actions">
                    <button class="btn btn-primary" id="saveEditBtn">Save Changes</button>
                    <button class="btn btn-secondary modal-close">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('.modal-close').addEventListener('click', function() { overlay.remove(); });

        overlay.querySelector('#saveEditBtn').addEventListener('click', async function() {
            const saveBtn = overlay.querySelector('#saveEditBtn');
            const errEl = overlay.querySelector('#editErrMsg');
            errEl.style.display = 'none';

            const newDate = overlay.querySelector('#editDate').value;
            if (!newDate) { errEl.textContent = 'Date is required.'; errEl.style.display = 'block'; return; }

            const reason = overlay.querySelector('#editReason').value.trim();
            const reApproveEl = overlay.querySelector('#editReApprove');
            const requireReApproval = reApproveEl ? reApproveEl.checked : false;

            const fields = { date: newDate, description: overlay.querySelector('#editDescription').value.trim() };

            if (isFlat) {
                const flatAmt = parseFloat(overlay.querySelector('#editFlatAmount').value) || 0;
                fields.flatAmount = flatAmt;
                fields.flatRate = flatAmt;
                fields.amount = flatAmt;
            } else {
                fields.startTime = overlay.querySelector('#editStartTime').value;
                fields.endTime = overlay.querySelector('#editEndTime').value;
                fields.hours = parseFloat(overlay.querySelector('#editHours').value) || 0;
                fields.rate = parseFloat(overlay.querySelector('#editRate').value) || 0;
            }

            // If moving approved back to pending, also remove linked expense client-side
            if (requireReApproval && isApproved) {
                const allExpenses = AppData.getExpenses ? AppData.getExpenses() : [];
                const linked = allExpenses.filter(function(e) { return e.submissionId === subId; });
                linked.forEach(function(e) { AppData.deleteExpense(e.id); });
            }

            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
            try {
                // Use editSubmissionAsync if available (dedicated route with full audit trail)
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
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
                return;
            }

            Utils.showToast('Submission updated' + (requireReApproval && (isApproved || isRejected) ? ' — moved to Pending' : ''));
            overlay.remove();
            self._renderContent();
        });
    },

    _showPhotoLightbox(photo) {
        const blob = photo.blob || photo.thumbnail;
        if (!blob) return;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.style.cursor = 'pointer';
        const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]));
        overlay.innerHTML = '<img src="' + url + '" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:var(--radius)">';
        overlay.addEventListener('click', function() {
            URL.revokeObjectURL(url);
            overlay.remove();
        });
        document.body.appendChild(overlay);
    }
};
