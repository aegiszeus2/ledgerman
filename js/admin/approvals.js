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
                ${pending.length > 1 ? '<button class="btn btn-primary btn-sm" id="bulkApproveBtn">Approve All (' + pending.length + ')</button>' : ''}
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
                    self._approveSubmission(sub);
                }
                Utils.showToast(pending.length + ' submissions approved');
                self._renderContent();
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

            return '<div class="card" data-sub-id="' + sub.id + '" style="border-left:3px solid var(--warn)">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">' +
                    '<div style="flex:1;min-width:200px">' +
                        '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
                            '<strong style="font-size:1.05rem">' + Utils.escapeHtml(workerName) + '</strong>' +
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
            btn.addEventListener('click', function() {
                const sub = AppData.getSubmission(btn.dataset.id);
                if (!sub) return;
                self._approveSubmission(sub);
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

        contentEl.innerHTML = '<div class="card"><table>' +
            '<thead><tr><th>Date</th><th>Worker</th><th>Project</th><th>Description</th><th class="amount">Amount</th><th>Method</th><th>Status</th></tr></thead>' +
            '<tbody>' +
            all.map(function(sub) {
                const worker = AppData.getWorker(sub.workerId);
                const project = AppData.getProject(sub.projectId);
                let amount = 0;
                if (sub.rateType === 'flat') {
                    amount = parseFloat(sub.flatAmount || sub.amount) || 0;
                } else {
                    amount = (parseFloat(sub.hours) || 0) * (parseFloat(sub.rate) || 0);
                }
                const statusStyle = sub.status === 'Approved'
                    ? 'background:rgba(46,204,113,.2);color:var(--success)'
                    : 'background:rgba(233,69,96,.2);color:var(--accent)';
                return '<tr>' +
                    '<td>' + Utils.formatDate(sub.date) + '</td>' +
                    '<td>' + Utils.escapeHtml(worker ? worker.name : 'Unknown') + '</td>' +
                    '<td>' + Utils.escapeHtml(project ? project.name : 'Unknown') + '</td>' +
                    '<td>' + Utils.escapeHtml(sub.description || '') +
                        (sub.rejectionReason ? '<br><span style="font-size:.8rem;color:var(--accent)">Reason: ' + Utils.escapeHtml(sub.rejectionReason) + '</span>' : '') +
                    '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(amount) + '</td>' +
                    '<td style="font-size:.78rem;white-space:nowrap">' + (sub.entryMethod === 'Clock In/Out' ? '<span style="color:var(--success)">⏱ Clock In/Out</span>' : '<span style="color:var(--text2)">✏️ Manual</span>') + '</td>' +
                    '<td><span style="font-size:.75rem;padding:2px 8px;border-radius:12px;' + statusStyle + '">' + sub.status + '</span></td>' +
                '</tr>';
            }).join('') +
            '</tbody></table></div>';
    },

    _approveSubmission(sub) {
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
        AppData.saveExpense(expense);

        // Mark submission as approved
        sub.status = 'Approved';
        sub.reviewedAt = new Date().toISOString();
        sub.reviewedBy = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
        AppData.saveSubmission(sub);

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

        overlay.querySelector('#confirmReject').addEventListener('click', function() {
            const reason = overlay.querySelector('#rejectReason').value.trim();
            const sub = AppData.getSubmission(subId);
            if (!sub) { overlay.remove(); return; }

            sub.status = 'Rejected';
            sub.rejectionReason = reason;
            sub.reviewedAt = new Date().toISOString();
            sub.reviewedBy = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.saveSubmission(sub);

            const worker = AppData.getWorker(sub.workerId);
            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, 'Submission Rejected', (worker ? worker.name : 'Worker') + (reason ? ' - ' + reason : ''));
            Utils.showToast('Submission rejected');
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
