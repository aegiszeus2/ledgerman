// Worker History Module
window.WorkerHistory = {
    render(container, worker) {
        var esc = Utils.escapeHtml;
        var allSubmissions = AppData.getWorkerSubmissions(worker.id);
        var currentFilter = 'All';
        // Period for the hours summary. Kept out here so it survives the
        // wholesale re-render that a status-tab click triggers.
        var currentPeriod = 'thisWeek';

        // ── Hours summary helpers ──────────────────────────────────────────
        // Dates are 'YYYY-MM-DD' strings. Parse them as LOCAL dates: bare
        // new Date('2026-08-21') is UTC and rolls back a day west of Greenwich,
        // which would put Monday's work in the previous week.
        function parseLocalDate(ymd) {
            var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
            if (!m) return null;
            return new Date(+m[1], +m[2] - 1, +m[3]);
        }

        function toYmd(d) {
            return d.getFullYear() + '-' +
                   String(d.getMonth() + 1).padStart(2, '0') + '-' +
                   String(d.getDate()).padStart(2, '0');
        }

        // Weeks run Monday to Sunday, the standard construction timesheet week.
        function startOfWeek(d) {
            var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            var dow = (x.getDay() + 6) % 7; // Mon = 0
            x.setDate(x.getDate() - dow);
            return x;
        }

        function addDays(d, n) {
            var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            x.setDate(x.getDate() + n);
            return x;
        }

        // Hours on a submission, deriving from the time range when the explicit
        // hours field is absent. Same fallback the entry rows already use, so
        // the summary can never disagree with the list below it.
        function submissionHours(sub) {
            var hrs = parseFloat(sub.hours) || 0;
            if (!hrs && sub.startTime && sub.endTime) {
                var pt = function(t) {
                    var m = String(t).split(':');
                    return (parseInt(m[0], 10) || 0) + (parseInt(m[1], 10) || 0) / 60;
                };
                var d = pt(sub.endTime) - pt(sub.startTime);
                if (d < 0) d += 24;
                hrs = Math.round(d * 100) / 100;
            }
            return hrs;
        }

        // 8 not 8.00, 21.5 not 21.50 — reads like a timesheet, not an invoice.
        function fmtHours(h) {
            return String(Math.round(h * 100) / 100);
        }

        function shortDate(d) {
            return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }

        // Inclusive [from, to] window for the chosen period; null = everything.
        function periodRange(period) {
            var today = new Date();
            var tw    = startOfWeek(today);
            if (period === 'thisWeek')  return { from: tw, to: addDays(tw, 6), label: 'This week' };
            if (period === 'lastWeek')  { var lw = addDays(tw, -7); return { from: lw, to: addDays(lw, 6), label: 'Last week' }; }
            if (period === 'last2Weeks'){ var l2 = addDays(tw, -7); return { from: l2, to: addDays(tw, 6), label: 'Last 2 weeks' }; }
            if (period === 'thisMonth') {
                var ms = new Date(today.getFullYear(), today.getMonth(), 1);
                return { from: ms, to: new Date(today.getFullYear(), today.getMonth() + 1, 0), label: 'This month' };
            }
            if (period === 'lastMonth') {
                var ls = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                return { from: ls, to: new Date(today.getFullYear(), today.getMonth(), 0), label: 'Last month' };
            }
            return null; // allTime
        }

        var PERIODS = [
            { value: 'thisWeek',   label: 'This week' },
            { value: 'lastWeek',   label: 'Last week' },
            { value: 'last2Weeks', label: 'Last 2 weeks' },
            { value: 'thisMonth',  label: 'This month' },
            { value: 'lastMonth',  label: 'Last month' },
            { value: 'allTime',    label: 'All time' }
        ];

        renderPage();

        function renderSummary() {
            var range = periodRange(currentPeriod);

            // Period selector — a native select so it inherits the worker
            // portal's 48px / 16px touch sizing on a phone.
            var picker = document.createElement('div');
            picker.className = 'form-group';
            picker.style.cssText = 'margin-bottom:12px';
            picker.innerHTML =
                '<label class="form-label" for="histPeriod">Hours summary</label>' +
                '<select class="form-control" id="histPeriod">' +
                PERIODS.map(function(p) {
                    return '<option value="' + p.value + '"' +
                           (p.value === currentPeriod ? ' selected' : '') + '>' +
                           esc(p.label) + '</option>';
                }).join('') +
                '</select>';
            container.appendChild(picker);
            picker.querySelector('#histPeriod').addEventListener('change', function() {
                currentPeriod = this.value;
                renderPage();
            });

            // Entries inside the window (by work date, not submitted date).
            var inRange = allSubmissions.filter(function(s) {
                var d = parseLocalDate(s.date);
                if (!d) return false;
                if (!range) return true;
                return d >= range.from && d <= range.to;
            });

            var totalHours    = 0, approvedHours = 0, pendingHours = 0;
            var daysWorked    = {};
            inRange.forEach(function(s) {
                var h = submissionHours(s);
                // Rejected entries are not hours worked — they were sent back.
                if (s.status === 'Rejected') return;
                totalHours += h;
                if (s.status === 'Approved') approvedHours += h;
                else                          pendingHours  += h;
                if (s.date) daysWorked[s.date] = true;
            });

            var tiles = document.createElement('div');
            tiles.className = 'worker-summary';
            tiles.innerHTML =
                '<div class="stat-card"><div class="stat-value">' + fmtHours(totalHours) + '</div>' +
                    '<div class="stat-label">Total hours</div></div>' +
                '<div class="stat-card"><div class="stat-value">' + Object.keys(daysWorked).length + '</div>' +
                    '<div class="stat-label">Days worked</div></div>' +
                '<div class="stat-card"><div class="stat-value" style="color:var(--success)">' + fmtHours(approvedHours) + '</div>' +
                    '<div class="stat-label">Approved</div></div>' +
                '<div class="stat-card"><div class="stat-value" style="color:var(--warn)">' + fmtHours(pendingHours) + '</div>' +
                    '<div class="stat-label">Awaiting approval</div></div>';
            container.appendChild(tiles);

            // Week-by-week breakdown, newest week first.
            var byWeek = {};
            inRange.forEach(function(s) {
                if (s.status === 'Rejected') return;
                var d = parseLocalDate(s.date);
                if (!d) return;
                var key = toYmd(startOfWeek(d));
                if (!byWeek[key]) byWeek[key] = { hours: 0, days: {} };
                byWeek[key].hours += submissionHours(s);
                byWeek[key].days[s.date] = true;
            });
            var weekKeys = Object.keys(byWeek).sort().reverse();

            var breakdown = document.createElement('div');
            breakdown.className = 'card';
            breakdown.style.cssText = 'padding:14px 16px;margin-bottom:16px';
            var rangeLabel = range
                ? shortDate(range.from) + ' \u2013 ' + shortDate(range.to)
                : 'All time';
            var rows = '<div style="font-size:.8rem;color:var(--text2);margin-bottom:10px">' +
                       esc(rangeLabel) + '</div>';
            if (weekKeys.length === 0) {
                rows += '<div style="font-size:.9rem;color:var(--text2)">No hours recorded in this period.</div>';
            } else {
                rows += weekKeys.map(function(k) {
                    var wStart = parseLocalDate(k);
                    var wEnd   = addDays(wStart, 6);
                    var w      = byWeek[k];
                    var nDays  = Object.keys(w.days).length;
                    return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;' +
                                'padding:8px 0;border-top:1px solid var(--border)">' +
                             '<div><div style="font-size:.9rem">Week of ' + esc(shortDate(wStart)) + '</div>' +
                               '<div style="font-size:.75rem;color:var(--text2)">' +
                                 esc(shortDate(wStart)) + ' \u2013 ' + esc(shortDate(wEnd)) +
                                 ' \u00b7 ' + nDays + (nDays === 1 ? ' day' : ' days') +
                               '</div></div>' +
                             '<div class="hours" style="font-size:1.05rem;font-weight:600;white-space:nowrap">' +
                               fmtHours(w.hours) + ' hrs</div>' +
                           '</div>';
                }).join('');
            }
            breakdown.innerHTML = rows;
            container.appendChild(breakdown);
        }

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

            // ── Hours summary ────────────────────────────────────────────
            renderSummary();

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
                var _hrs = parseFloat(sub.hours) || 0;
                if (!_hrs && sub.startTime && sub.endTime) {
                    // Time-range submissions may not store an explicit hours field;
                    // derive it so the card never shows a day with no hours.
                    var _pt = function(t){ var m = String(t).split(':'); return (parseInt(m[0],10)||0) + (parseInt(m[1],10)||0)/60; };
                    var _d2 = _pt(sub.endTime) - _pt(sub.startTime);
                    if (_d2 < 0) _d2 += 24;
                    _hrs = Math.round(_d2 * 100) / 100;
                }
                if (_hrs) {
                    amountText = _hrs + ' hours worked';
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

                // Rejection reason and action buttons
                if (sub.status === 'Rejected') {
                    cardHTML +=
                        '<div style="margin-top:10px;padding:10px;background:rgba(233,69,96,.1);border-radius:var(--radius);border-left:3px solid var(--accent)">' +
                            '<div style="font-size:.85rem;font-weight:600;color:var(--accent);margin-bottom:4px">Rejection Reason:</div>' +
                            '<div style="font-size:.9rem;color:var(--accent)">' + esc(sub.rejectionReason || 'No reason provided.') + '</div>' +
                        '</div>' +
                        '<div style="display:flex;gap:8px;margin-top:12px">' +
                            '<button class="btn-primary resubmit-btn" style="flex:1;padding:12px 16px;font-size:.95rem" data-sub-id="' + esc(sub.id) + '">✏️ Edit &amp; Resubmit</button>' +
                            '<button class="btn-danger delete-rejected-btn" style="padding:12px 16px;font-size:.95rem" data-sub-id="' + esc(sub.id) + '">Delete</button>' +
                        '</div>';
                }

                // Pending entries: let the worker fix a mistake before approval
                if (sub.status === 'Pending') {
                    cardHTML +=
                        '<div style="display:flex;gap:8px;margin-top:12px">' +
                            '<button class="btn-secondary edit-pending-btn" style="flex:1;padding:12px 16px;font-size:.95rem" data-sub-id="' + esc(sub.id) + '">✏️ Edit Entry</button>' +
                        '</div>';
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

            // Bind edit buttons on pending entries (delete + re-open prefilled in time entry)
            var editPendingBtns = container.querySelectorAll('.edit-pending-btn');
            for (var k = 0; k < editPendingBtns.length; k++) {
                editPendingBtns[k].addEventListener('click', function() {
                    var subId = this.getAttribute('data-sub-id');
                    var sub = AppData.getSubmission(subId);
                    if (!sub) {
                        Utils.showToast('Submission not found.', 'error');
                        return;
                    }
                    AppData.deleteSubmission(subId);
                    window.App.navigateWorker('timeentry', sub.projectId, {
                        date: sub.date,
                        subtaskId: sub.subtaskId,
                        rateType: sub.rateType,
                        hours: sub.hours,
                        rate: sub.rate,
                        flatRate: sub.flatRate,
                        startTime: sub.startTime,
                        endTime: sub.endTime,
                        description: sub.description,
                        unitsCompleted: sub.unitsCompleted
                    });
                });
            }

            // Bind delete buttons on rejected entries
            var deleteBtns = container.querySelectorAll('.delete-rejected-btn');
            for (var j = 0; j < deleteBtns.length; j++) {
                deleteBtns[j].addEventListener('click', function() {
                    var subId = this.getAttribute('data-sub-id');
                    if (!subId) return;
                    Utils.confirm('Delete this rejected entry? This cannot be undone.').then(function(confirmed) {
                        if (!confirmed) return;
                        AppData.deleteSubmission(subId);
                        Utils.showToast('Entry deleted.');
                        allSubmissions = AppData.getWorkerSubmissions(worker.id);
                        renderPage();
                    });
                });
            }
        }
    }
};
