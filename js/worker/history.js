// Worker History Module
window.WorkerHistory = {
    render(container, worker) {
        var esc = Utils.escapeHtml;
        var allSubmissions = AppData.getWorkerSubmissions(worker.id);
        var currentFilter = 'All';

        renderPage();

        function renderPage() {
            container.innerHTML = '';

            // Header
            var header = document.createElement('div');
            header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap';
            header.innerHTML =
                '<button class="btn-secondary btn-sm" id="histBack" style="padding:8px 16px;font-size:.95rem">&larr; Back</button>' +
                '<h2 style="flex:1;font-size:1.15rem">Submission History</h2>';
            container.appendChild(header);

            header.querySelector('#histBack').addEventListener('click', function() {
                window.App.navigateWorker('home');
            });

            // Filter tabs
            var tabBar = document.createElement('div');
            tabBar.className = 'tabs';
            tabBar.style.cssText = 'margin-bottom:16px';
            var filters = ['All', 'Pending', 'Approved', 'Rejected'];
            filters.forEach(function(f) {
                var tab = document.createElement('button');
                tab.className = 'tab-btn' + (currentFilter === f ? ' active' : '');
                tab.style.cssText = 'padding:10px 16px;font-size:.9rem';
                var count = (f === 'All') ? allSubmissions.length : allSubmissions.filter(function(s) { return s.status === f; }).length;
                tab.textContent = f + ' (' + count + ')';
                tab.addEventListener('click', function() {
                    currentFilter = f;
                    renderPage();
                });
                tabBar.appendChild(tab);
            });
            container.appendChild(tabBar);

            // Filter submissions
            var filtered = (currentFilter === 'All')
                ? allSubmissions
                : allSubmissions.filter(function(s) { return s.status === currentFilter; });

            // Sort newest first
            filtered.sort(function(a, b) {
                return new Date(b.submittedAt || b.date) - new Date(a.submittedAt || a.date);
            });

            // Empty state
            if (filtered.length === 0) {
                var emptyCard = document.createElement('div');
                emptyCard.className = 'card';
                emptyCard.style.cssText = 'text-align:center;padding:40px 20px';
                var emptyMsg = 'No submissions yet.';
                if (currentFilter === 'Pending') emptyMsg = 'No pending submissions.';
                else if (currentFilter === 'Approved') emptyMsg = 'No approved submissions yet.';
                else if (currentFilter === 'Rejected') emptyMsg = 'No rejected submissions. Good job!';
                emptyCard.innerHTML =
                    '<h3 style="color:var(--text);margin-bottom:8px">Nothing Here</h3>' +
                    '<p style="color:var(--text2);font-size:.9rem">' + esc(emptyMsg) + '</p>';
                container.appendChild(emptyCard);
                return;
            }

            // Submission cards
            filtered.forEach(function(sub) {
                var project = AppData.getProject(sub.projectId);
                var projectName = project ? project.name : 'Unknown Project';

                // Status badge colors
                var badgeStyle = '';
                if (sub.status === 'Pending') badgeStyle = 'background:rgba(243,156,18,.2);color:var(--warn)';
                else if (sub.status === 'Approved') badgeStyle = 'background:rgba(46,204,113,.2);color:var(--success)';
                else if (sub.status === 'Rejected') badgeStyle = 'background:rgba(233,69,96,.2);color:var(--accent)';

                // Truncate description
                var desc = sub.description || '';
                var truncDesc = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;

                // Hours display (no pay shown to worker)
                var amountText = '';
                if (sub.hours) {
                    amountText = sub.hours + ' hours worked';
                }

                var card = document.createElement('div');
                card.className = 'card';
                card.style.cssText = 'padding:16px;margin-bottom:12px';
                if (sub.status === 'Rejected') {
                    card.style.borderColor = 'var(--accent)';
                }

                var cardHTML =
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">' +
                        '<div style="flex:1;min-width:0">' +
                            '<div style="font-weight:700;font-size:1rem">' + esc(projectName) + '</div>' +
                            '<div style="font-size:.85rem;color:var(--text2);margin-top:2px">' + esc(Utils.formatDate(sub.date)) +
                                (sub.subtaskName ? ' &mdash; ' + esc(sub.subtaskName) : '') +
                            '</div>' +
                        '</div>' +
                        '<span style="font-size:.75rem;padding:4px 10px;border-radius:12px;font-weight:600;white-space:nowrap;' + badgeStyle + '">' + esc(sub.status) + '</span>' +
                    '</div>' +
                    '<p style="font-size:.9rem;color:var(--text);margin-bottom:6px">' + esc(truncDesc) + '</p>' +
                    (amountText ? '<div style="font-size:.85rem;color:var(--text2);font-variant-numeric:tabular-nums">' + esc(amountText) + '</div>' : '');

                // Units completed
                if (sub.unitsCompleted && sub.unitOfMeasure) {
                    cardHTML += '<div style="font-size:.85rem;color:var(--text2);margin-top:2px">Units: ' + esc(String(sub.unitsCompleted)) + ' ' + esc(sub.unitOfMeasure) + '</div>';
                }

                // Expenses
                if (sub.expenses && sub.expenses.length > 0) {
                    var expenseTotal = 0;
                    var expenseList = '';
                    sub.expenses.forEach(function(exp) {
                        expenseTotal += parseFloat(exp.amount) || 0;
                        expenseList += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:.8rem">' +
                            '<span>' + esc(exp.description) + '</span>' +
                            '<span>' + Utils.formatCurrency(exp.amount) + '</span>' +
                        '</div>';
                    });
                    cardHTML += '<div style="margin-top:8px;padding:8px;background:rgba(243,156,18,.1);border-radius:var(--radius);border-left:3px solid var(--amber)">' +
                        '<div style="font-size:.85rem;font-weight:600;color:var(--amber);margin-bottom:4px">Expenses:</div>' +
                        expenseList +
                        '<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);margin-top:6px;font-weight:600;font-size:.85rem">' +
                            '<span>Total:</span>' +
                            '<span>' + Utils.formatCurrency(expenseTotal) + '</span>' +
                        '</div>' +
                    '</div>';
                }

                // Photo count
                if (sub.photoIds && sub.photoIds.length > 0) {
                    cardHTML += '<div style="font-size:.85rem;color:var(--text2);margin-top:2px">&#128247; ' + sub.photoIds.length + ' photo' + (sub.photoIds.length !== 1 ? 's' : '') + ' attached</div>';
                }

                // Submitted timestamp
                if (sub.submittedAt) {
                    cardHTML += '<div style="font-size:.8rem;color:var(--text2);margin-top:4px">Submitted: ' + esc(Utils.formatDateTime(sub.submittedAt)) + '</div>';
                }

                // Rejection reason and resubmit button
                if (sub.status === 'Rejected') {
                    cardHTML +=
                        '<div style="margin-top:10px;padding:10px;background:rgba(233,69,96,.1);border-radius:var(--radius);border-left:3px solid var(--accent)">' +
                            '<div style="font-size:.85rem;font-weight:600;color:var(--accent);margin-bottom:4px">Rejection Reason:</div>' +
                            '<div style="font-size:.9rem;color:var(--accent)">' + esc(sub.rejectionReason || 'No reason provided.') + '</div>' +
                        '</div>' +
                        '<button class="btn-primary resubmit-btn" style="margin-top:12px;padding:12px 20px;font-size:.95rem;width:100%" data-sub-id="' + esc(sub.id) + '">Resubmit This Entry</button>';
                }

                card.innerHTML = cardHTML;
                container.appendChild(card);
            });

            // Bind resubmit buttons
            var resubmitBtns = container.querySelectorAll('.resubmit-btn');
            for (var i = 0; i < resubmitBtns.length; i++) {
                resubmitBtns[i].addEventListener('click', function() {
                    var subId = this.getAttribute('data-sub-id');
                    var sub = AppData.getSubmission(subId);
                    if (!sub) {
                        Utils.showToast('Submission not found.', 'error');
                        return;
                    }
                    // Delete the rejected submission
                    AppData.deleteSubmission(subId);
                    // Navigate to time entry pre-filled with submission data (minus photos)
                    window.App.navigateWorker('timeentry', sub.projectId, {
                        date: sub.date,
                        subtaskId: sub.subtaskId,
                        rateType: sub.rateType,
                        hours: sub.hours,
                        rate: sub.rate,
                        flatRate: sub.flatRate,
                        description: sub.description,
                        unitsCompleted: sub.unitsCompleted
                    });
                });
            }
        }
    }
};
