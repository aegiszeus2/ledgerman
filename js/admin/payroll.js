// Admin Payroll — record pay runs and employee deductions.
//
// A pay run is a record of a payment day for one period: approved hours per employee
// at their pay rate, less any deductions applied that period (that is the PAY PERIOD,
// what they earned), and what was actually paid out (the PAYMENT). A payment goes to
// the run's own period first and can also go toward earlier periods still owed. Each
// period keeps its own list of payments and its own balance; nothing is ever carried
// from one period into another. See "pay periods and payments" below.
// A period can be paid short (the rest stays owed on it) or paid over (the extra is an
// overpayment that comes back off the next run for that person). Both carry forward
// to the next period as their own line under the name, and either can take a note.
// A recorded run can be edited: the money side (paid on, method, reference, notes,
// rate, what was paid, the note) and who is on it. The period itself is fixed.
// A deduction is money owed back by an employee (a purchase made for them, a cost
// they caused, an advance). It stays open until it has been recovered through one
// or more pay runs.
//
// Storage: generic entities 'payroll_runs' and 'payroll_deductions' on the server.
// Both are admin-only on the backend (workers and supervisors get 403).
window.AdminPayroll = {
    _tab: 'runs',          // 'runs' | 'deductions' | 'employees'
    _view: 'list',         // 'list' | 'new' | 'edit' | 'detail'
    _empId: '',            // employee whose pay history is open on the Employees tab
    _runs: [],
    _deductions: [],
    _detailId: null,
    _dedFilter: { workerId: '', status: 'open' },
    _draft: null,          // in-progress pay run (see _buildDraft)

    DEDUCTION_TYPES: ['Purchase for employee', 'Cost caused by employee', 'Advance repayment', 'Other'],
    PAY_METHODS: ['E-transfer', 'Direct deposit', 'Cheque', 'Cash', 'Other'],

    // ── helpers ──────────────────────────────────────────────────────────────
    _localDate(d) {
        d = d || new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    // Monday to Sunday of the most recent completed week, in local time.
    _lastWeek() {
        const now = new Date();
        const dow = (now.getDay() + 6) % 7;            // Monday = 0
        const thisMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
        const lastMon = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() - 7);
        const lastSun = new Date(lastMon.getFullYear(), lastMon.getMonth(), lastMon.getDate() + 6);
        return { from: this._localDate(lastMon), to: this._localDate(lastSun) };
    },

    _dayDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00');
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
    },

    _money(n) { return Utils.formatCurrency(parseFloat(n) || 0); },
    _num(n) { const v = parseFloat(n); return isNaN(v) ? 0 : v; },
    _round2(n) { return Math.round((parseFloat(n) || 0) * 100) / 100; },

    _workerName(id) {
        const w = AppData.getWorker(id);
        return w ? w.name : (id || 'Unknown');
    },

    _isAdmin() {
        return !!(window.App && window.App.currentUser && window.App.currentUser.type === 'admin');
    },

    _actor() {
        return (window.App && window.App.currentUser && window.App.currentUser.name) || 'Admin';
    },

    async _api(path, opts) {
        opts = opts || {};
        const jwt = AppData.getJwt ? AppData.getJwt() : '';
        const headers = Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt }, opts.headers || {});
        const res = await fetch(AppData.API_BASE + path, Object.assign({}, opts, { headers: headers }));
        let body = null;
        try { body = await res.json(); } catch (e) { body = null; }
        if (!res.ok) {
            throw new Error((body && body.error) ? body.error : ('HTTP ' + res.status));
        }
        return body;
    },

    async _load() {
        const self = this;
        const results = await Promise.all([
            self._api('/api/payroll_runs'),
            self._api('/api/payroll_deductions')
        ]);
        self._runs = Array.isArray(results[0]) ? results[0] : [];
        self._deductions = Array.isArray(results[1]) ? results[1] : [];
    },

    _openDeductions(workerId) {
        const self = this;
        return self._deductions.filter(function(d) {
            return String(d.workerId) === String(workerId) && d.status !== 'applied' && self._remaining(d) > 0.005;
        });
    },

    _remaining(d) {
        return this._round2(this._num(d.amount) - this._num(d.recovered));
    },

    // ── entry ────────────────────────────────────────────────────────────────
    async render(container, params) {
        const self = this;
        self._container = container;
        // Every visit starts on the list. A half-built run from an earlier visit is dropped.
        self._view = 'list';
        self._draft = null;
        self._detailId = null;
        if (!self._isAdmin()) {
            container.innerHTML = '<div class="card"><div class="empty"><h3>Payroll is for administrators</h3><p>Pay runs and deductions are only available on the company admin login.</p></div></div>';
            return;
        }
        container.innerHTML = '<div class="card"><p style="color:var(--text2)">Loading payroll…</p></div>';
        try {
            await self._load();
        } catch (e) {
            container.innerHTML = '<div class="card"><div class="empty"><h3>Could not load payroll</h3><p>' + Utils.escapeHtml(e.message) + '</p></div></div>';
            return;
        }
        if (params && params.tab) self._tab = params.tab;
        self._renderContent();
    },

    _renderContent() {
        const self = this;
        const c = self._container;
        if (self._view === 'new' || self._view === 'edit') return self._renderNewRun();
        if (self._view === 'detail') return self._renderRunDetail();

        const openDed = self._deductions.filter(function(d) { return d.status !== 'applied' && self._remaining(d) > 0.005; });
        c.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:20px">
                <h2 style="margin:0">Payroll</h2>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    ${self._tab === 'runs'
                        ? '<button class="btn-primary btn-sm" id="payNewRunBtn">+ New Pay Run</button>'
                        : self._tab === 'deductions'
                            ? '<button class="btn-primary btn-sm" id="payAddDedBtn">+ Add Deduction</button>'
                            : (self._empId ? '<button class="btn-secondary btn-sm" id="payEmpPrintBtn">Print statement</button>' : '')}
                </div>
            </div>
            <div class="tabs" style="margin-bottom:16px">
                <button class="tab-btn ${self._tab === 'runs' ? 'active' : ''}" data-tab="runs">Pay Runs (${self._runs.length})</button>
                <button class="tab-btn ${self._tab === 'deductions' ? 'active' : ''}" data-tab="deductions">Deductions ${openDed.length ? '<span class="badge-gold" style="margin-left:6px">' + openDed.length + ' open</span>' : ''}</button>
                <button class="tab-btn ${self._tab === 'employees' ? 'active' : ''}" data-tab="employees">Employees (${self._employeeHistory().length})</button>
            </div>
            <div id="payrollContent"></div>
        `;
        c.querySelectorAll('.tab-btn[data-tab]').forEach(function(t) {
            t.addEventListener('click', function() { self._tab = t.dataset.tab; self._renderContent(); });
        });
        const newBtn = c.querySelector('#payNewRunBtn');
        if (newBtn) newBtn.addEventListener('click', function() { self._startNewRun(); });
        const addBtn = c.querySelector('#payAddDedBtn');
        if (addBtn) addBtn.addEventListener('click', function() { self._showDeductionModal(null); });
        const empPrint = c.querySelector('#payEmpPrintBtn');
        if (empPrint) empPrint.addEventListener('click', function() { window.print(); });

        const el = c.querySelector('#payrollContent');
        if (self._tab === 'runs') self._renderRunsList(el);
        else if (self._tab === 'employees') self._renderEmployees(el);
        else self._renderDeductions(el);
    },

    // ── pay runs list ────────────────────────────────────────────────────────
    _renderRunsList(el) {
        const self = this;
        const runs = self._runs.slice().sort(function(a, b) {
            return String(b.periodEnd || '').localeCompare(String(a.periodEnd || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        });
        if (runs.length === 0) {
            el.innerHTML = '<div class="card"><div class="empty"><h3>No pay runs recorded</h3><p>Click "+ New Pay Run", pick the period, and the approved hours load in for every employee. Record it once the money has gone out.</p></div></div>';
            return;
        }
        el.innerHTML = '<div class="card"><table>' +
            '<thead><tr><th>Period</th><th>Employees</th><th class="amount">Hours</th><th class="amount">Gross</th><th class="amount">Deductions</th><th class="amount">Net</th><th class="amount">Paid</th><th>Paid on</th><th></th></tr></thead><tbody>' +
            runs.map(function(r) {
                const t = r.totals || {};
                const lines = Array.isArray(r.lines) ? r.lines : [];
                let net = 0, paidAmt = 0, alloc = 0, recov = 0, owed = 0, over = 0;
                lines.forEach(function(l) {
                    const sl = self._savedLine(r, l);
                    const p = self._period(r.id, l.workerId);
                    net += sl.net; paidAmt += sl.paid; alloc += sl.allocationsPaid; recov += sl.allocationsRecovered;
                    owed += p ? p.owed : 0; over += p ? p.overpaid : 0;
                });
                return '<tr class="pay-run-row" data-id="' + Utils.escapeHtml(r.id) + '">' +
                    '<td style="white-space:nowrap">' + Utils.escapeHtml(self._dayDate(r.periodStart)) + ' to ' + Utils.escapeHtml(self._dayDate(r.periodEnd)) + '</td>' +
                    '<td>' + Utils.escapeHtml(lines.map(function(l) { return l.workerName; }).join(', ')) + '</td>' +
                    '<td class="amount">' + self._num(t.hours).toFixed(2) + '</td>' +
                    '<td class="amount">' + self._money(t.gross) + '</td>' +
                    '<td class="amount">' + (self._num(t.deductions) ? '-' + self._money(t.deductions) : '—') + '</td>' +
                    '<td class="amount">' + self._money(net) +
                        (owed > 0.005 ? '<div class="pay-run-short" style="font-size:.72rem;color:#b8860b">' + self._money(owed) + ' still owed on this period</div>' : '') +
                        (over > 0.005 ? '<div class="pay-run-over" style="font-size:.72rem;color:#b8860b">' + self._money(over) + ' overpaid on this period</div>' : '') + '</td>' +
                    '<td class="amount"><strong>' + self._money(paidAmt) + '</strong>' +
                        (alloc > 0.005 ? '<div class="pay-run-alloc" style="font-size:.72rem;color:var(--text2)">incl. ' + self._money(alloc) + ' toward earlier periods</div>' : '') +
                        (recov > 0.005 ? '<div class="pay-run-recov" style="font-size:.72rem;color:var(--text2)">less ' + self._money(recov) + ' recovered from earlier overpayments</div>' : '') + '</td>' +
                    '<td style="white-space:nowrap;font-size:.85rem">' + Utils.escapeHtml(self._dayDate(r.paidDate)) + (r.method ? '<br><span style="color:var(--text2)">' + Utils.escapeHtml(r.method) + '</span>' : '') + '</td>' +
                    '<td style="white-space:nowrap"><button class="btn-secondary btn-sm pay-view-btn" data-id="' + Utils.escapeHtml(r.id) + '">View</button></td>' +
                '</tr>';
            }).join('') +
            '</tbody></table></div>';
        el.querySelectorAll('.pay-view-btn').forEach(function(b) {
            b.addEventListener('click', function() { self._detailId = b.dataset.id; self._view = 'detail'; self._renderContent(); });
        });
    },

    // ── new pay run ──────────────────────────────────────────────────────────
    _startNewRun() {
        const self = this;
        const wk = self._lastWeek();
        self._draft = {
            editId: null,
            periodStart: wk.from, periodEnd: wk.to,
            paidDate: self._localDate(), method: 'E-transfer', reference: '', notes: '',
            lines: null, pendingCount: 0, approvedCount: 0, alreadyPaid: 0, paidIn: []
        };
        self._view = 'new';
        self._renderContent();
    },

    // Open a recorded run on the same form. The period and the hours are fixed by the
    // approved cards; what can change is the money side (paid on, method, reference,
    // notes, rate, what was paid and the note) and who is on the run. Deductions taken
    // in the run stay as they were; to change them, delete the run and record it again.
    _startEditRun(r) {
        const self = this;
        // Earlier periods as they stand WITHOUT this run, so a balance this run settled
        // shows up again with this run's own payment toward it already in the box.
        const others = (self._runs || []).filter(function(x) { return x.id !== r.id; });
        const openBy = self._openPeriodsByWorkerIn(others);
        const lines = (Array.isArray(r.lines) ? r.lines : []).map(function(l) {
            const sl = self._savedLine(r, l);
            const net = sl.net;
            const saved = {};
            sl.allocations.forEach(function(a) { saved[String(a.runId)] = a.amount; });
            const earlier = (openBy[String(l.workerId)] || []).filter(function(p) { return p.periodEnd < r.periodStart; }).map(function(p) {
                const kind = p.overpaid > 0.005 ? 'over' : 'owed';
                const was = saved[String(p.runId)] || 0;
                return { runId: p.runId, periodStart: p.periodStart, periodEnd: p.periodEnd, since: p.since, kind: kind,
                    balance: kind === 'over' ? p.overpaid : p.owed, reason: p.reason || '', amount: self._round2(Math.abs(was)) };
            });
            return {
                workerId: String(l.workerId || ''), workerName: l.workerName || self._workerName(l.workerId),
                rate: self._num(l.rate), regularHours: self._num(l.regularHours), otHours: self._num(l.otHours), dtHours: self._num(l.dtHours),
                days: Array.isArray(l.days) ? l.days : [], timecardIds: Array.isArray(l.timecardIds) ? l.timecardIds : [],
                deductions: (Array.isArray(l.deductions) ? l.deductions : []).map(function(x) {
                    return { deductionId: x.deductionId, description: x.description, type: x.type || '', remaining: self._num(x.amount), amount: self._num(x.amount), apply: true, locked: true };
                }),
                pay: true,
                earlier: earlier,
                paid: Math.abs(sl.ownPaid - net) < 0.005 ? null : sl.ownPaid,
                adjustReason: sl.adjustReason || ''
            };
        });
        self._draft = {
            editId: r.id, editRun: r,
            periodStart: r.periodStart, periodEnd: r.periodEnd,
            paidDate: String(r.paidDate || '').slice(0, 10), method: r.method || 'E-transfer', reference: r.reference || '', notes: r.notes || '',
            lines: lines, pendingCount: 0, approvedCount: 0, alreadyPaid: 0, paidIn: []
        };
        self._view = 'edit';
        self._renderContent();
    },

    // Ids of every approved timecard already inside a recorded run, so the same
    // shift can never be paid twice.
    _paidTimecardIds() {
        const set = {};
        (this._runs || []).forEach(function(r) {
            (r.lines || []).forEach(function(l) {
                (l.timecardIds || []).forEach(function(id) { set[String(id)] = r.id; });
            });
        });
        return set;
    },

    async _loadHours() {
        const self = this;
        const d = self._draft;
        if (!d.periodStart || !d.periodEnd || d.periodStart > d.periodEnd) {
            Utils.showToast('Pick a valid period (start on or before end)', 'error');
            return;
        }
        let cards;
        try {
            cards = await self._api('/api/timecards?status=approved');
        } catch (e) {
            Utils.showToast('Could not load approved hours: ' + e.message, 'error');
            return;
        }
        let pendingCards = [];
        try { pendingCards = await self._api('/api/timecards?status=pending'); } catch (e) { pendingCards = []; }

        const inPeriod = function(tc) {
            const dt = String(tc.date || '').slice(0, 10);
            return dt >= d.periodStart && dt <= d.periodEnd;
        };
        const paid = self._paidTimecardIds();
        const approved = (Array.isArray(cards) ? cards : []).filter(inPeriod);
        d.pendingCount = (Array.isArray(pendingCards) ? pendingCards : []).filter(inPeriod).length;
        d.approvedCount = approved.length;
        d.alreadyPaid = approved.filter(function(tc) { return paid[String(tc.id)]; }).length;
        // Which recorded runs those already-paid cards sit on, so the note can name them.
        d.paidIn = [];
        approved.forEach(function(tc) {
            const rid = paid[String(tc.id)];
            if (!rid) return;
            let hit = d.paidIn.find(function(x) { return x.runId === rid; });
            if (!hit) {
                const r = (self._runs || []).find(function(x) { return x.id === rid; }) || {};
                hit = { runId: rid, periodStart: r.periodStart || '', periodEnd: r.periodEnd || '', paidDate: r.paidDate || '', cards: 0, names: [] };
                d.paidIn.push(hit);
            }
            hit.cards += 1;
            const nm = self._workerName(tc.workerId);
            if (hit.names.indexOf(nm) === -1) hit.names.push(nm);
        });
        d.paidIn.sort(function(a, b) { return String(a.periodStart).localeCompare(String(b.periodStart)) || String(a.paidDate).localeCompare(String(b.paidDate)); });

        const byWorker = {};
        approved.forEach(function(tc) {
            if (paid[String(tc.id)]) return;
            const wid = String(tc.workerId || '');
            if (!byWorker[wid]) {
                const w = AppData.getWorker(wid);
                byWorker[wid] = {
                    workerId: wid,
                    workerName: w ? w.name : (wid || 'Unknown'),
                    rate: w ? self._num(w.defaultRate) : 0,
                    regularHours: 0, otHours: 0, dtHours: 0,
                    days: [], timecardIds: [],
                    deductions: [],
                    pay: true   // untick on the form to leave this person out of the run
                };
            }
            const line = byWorker[wid];
            const reg = self._num(tc.regularHours), ot = self._num(tc.otHours), dt = self._num(tc.dtHours);
            line.regularHours = self._round2(line.regularHours + reg);
            line.otHours = self._round2(line.otHours + ot);
            line.dtHours = self._round2(line.dtHours + dt);
            const p = AppData.getProject(tc.projectId);
            line.days.push({ date: String(tc.date || '').slice(0, 10), projectName: p ? p.name : (tc.projectId || ''), hours: self._round2(reg + ot + dt), timecardId: tc.id });
            line.timecardIds.push(tc.id);
        });
        // Anyone still owed on an earlier period gets a line even with no hours this
        // period, so the balance can be paid on its own.
        // (Someone only OVERPAID earlier, with no hours now, gets no line: there is
        // nothing to recover the overpayment from until they have pay due again.)
        const owedBy = self._openPeriodsByWorker();
        Object.keys(owedBy).forEach(function(wid) {
            if (byWorker[wid]) return;
            if (!owedBy[wid].some(function(p) { return p.periodEnd < d.periodStart && p.owed > 0.005; })) return;
            const w = AppData.getWorker(wid);
            byWorker[wid] = {
                workerId: wid,
                workerName: w ? w.name : (owedBy[wid][0].workerName || wid || 'Unknown'),
                rate: w ? self._num(w.defaultRate) : 0,
                regularHours: 0, otHours: 0, dtHours: 0,
                days: [], timecardIds: [],
                deductions: [],
                pay: true
            };
        });
        const lines = Object.keys(byWorker).map(function(k) { return byWorker[k]; });
        lines.sort(function(a, b) { return a.workerName.localeCompare(b.workerName); });
        lines.forEach(function(l) {
            l.days.sort(function(a, b) { return a.date.localeCompare(b.date); });
            l.deductions = self._openDeductions(l.workerId).map(function(dd) {
                return { deductionId: dd.id, description: dd.description || dd.type || 'Deduction', type: dd.type || '', remaining: self._remaining(dd), amount: self._remaining(dd), apply: true };
            });
            // Only periods that ENDED BEFORE this one starts. Going back to record an old
            // period can never see a balance from a later one.
            // An earlier period still OWED gets a "pay toward it now" box starting at zero.
            // An earlier period OVERPAID gets a "recover now" box that starts at the full
            // overpayment (capped by this period's net), since it comes off the next pay.
            const net = self._lineNet(l);
            l.earlier = (owedBy[l.workerId] || []).filter(function(p) { return p.periodEnd < d.periodStart; }).map(function(p) {
                const kind = p.overpaid > 0.005 ? 'over' : 'owed';
                const bal = kind === 'over' ? p.overpaid : p.owed;
                return { runId: p.runId, periodStart: p.periodStart, periodEnd: p.periodEnd, since: p.since, kind: kind, balance: bal, reason: p.reason || '',
                    amount: kind === 'over' ? self._round2(Math.min(bal, net)) : 0 };
            });
            l.paid = null;          // null = this period's net paid in full; a number = what was actually paid toward it (less or more)
            l.adjustReason = '';    // optional note when paid short or over
        });
        d.lines = lines;
        self._renderContent();
    },

    // ── pay periods and payments ─────────────────────────────────────────────
    // Two things are kept apart. A PAY PERIOD is what someone earned in one period: the
    // hours, gross, deductions and net on a run line, fixed by the approved cards. A
    // PAYMENT is money that went out on a run: it goes to the run's own period first, and
    // can also go toward earlier periods still owed (the line's `allocations`). A period
    // is paid in full, partly paid or unpaid according to every payment made against it,
    // whichever run they were made on, and it never shows anything from another period.
    //
    // Runs recorded before this existed carried balances by `carriedIn` on the later run.
    // They are read under one rule: a run's paid amount goes to its own period first,
    // anything above its net goes to older open periods oldest first, and a balance
    // carried in from a LATER period is dropped (it was never this period's business).
    //
    // An OVERPAYMENT is the reverse of a shortfall: a period's own payment above its net.
    // The period then carries a negative balance until a later run recovers it, recorded
    // as a NEGATIVE allocation on that later run (less cash went out). Either way the
    // amount carries forward to the next period for that person, under their name.
    _isLedgerLine(l) { return Array.isArray(l.allocations); },
    _pkey(runId, workerId) { return String(runId) + '|' + String(workerId); },

    _ledger() {
        const self = this;
        if (self._ledgerCache && self._ledgerCache.src === self._runs) return self._ledgerCache.val;
        const val = self._ledgerOf(self._runs || []);
        self._ledgerCache = { src: self._runs, val: val };
        return val;
    },
    _ledgerOf(runList) {
        const self = this;
        const runs = (runList || []).slice().sort(function(a, b) {
            return String(a.paidDate || '').localeCompare(String(b.paidDate || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id).localeCompare(String(b.id));
        });
        const periods = {};   // key -> period
        const lines = {};     // key -> normalised view of the saved line
        runs.forEach(function(r) {
            (Array.isArray(r.lines) ? r.lines : []).forEach(function(l) {
                const wid = String(l.workerId || '');
                const key = self._pkey(r.id, wid);
                const gross = self._num(l.gross), ded = self._num(l.deductionTotal);
                const net = l.net !== undefined ? self._num(l.net) : self._round2(gross - ded);
                let ownPaid, allocs;
                const ledgerLine = self._isLedgerLine(l);
                if (ledgerLine) {
                    // ownPaid may be ABOVE net: that is an overpayment on this period.
                    ownPaid = l.ownPaid !== undefined ? self._num(l.ownPaid) : Math.min(self._num(l.paid), net);
                    allocs = l.allocations.map(function(a) { return { runId: String(a.runId), periodStart: a.periodStart, periodEnd: a.periodEnd, amount: self._round2(a.amount) }; });
                } else {
                    const paidTotal = l.paid !== undefined && l.paid !== null ? self._num(l.paid) : net;
                    ownPaid = self._round2(Math.min(paidTotal, net));
                    let surplus = self._round2(paidTotal - ownPaid);
                    allocs = [];
                    if (surplus > 0.005) {
                        const older = Object.keys(periods).map(function(k) { return periods[k]; })
                            .filter(function(p) { return p.workerId === wid && p.periodEnd < r.periodStart && self._round2(p.net - p.ownPaid - p.receivedTotal) > 0.005; })
                            .sort(function(a, b) { return String(a.periodEnd).localeCompare(String(b.periodEnd)); });
                        older.forEach(function(p) {
                            if (surplus <= 0.005) return;
                            const open = self._round2(p.net - p.ownPaid - p.receivedTotal);
                            const amt = Math.min(open, surplus);
                            allocs.push({ runId: p.runId, periodStart: p.periodStart, periodEnd: p.periodEnd, amount: self._round2(amt) });
                            surplus = self._round2(surplus - amt);
                        });
                    }
                }
                if (ownPaid < 0) ownPaid = 0;
                if (!ledgerLine && ownPaid > net) ownPaid = net;
                const reason = l.adjustReason || l.shortReason || '';
                periods[key] = {
                    key: key, runId: r.id, workerId: wid, workerName: l.workerName || '',
                    periodStart: r.periodStart, periodEnd: r.periodEnd, paidDate: r.paidDate, method: r.method || '', reference: r.reference || '',
                    hours: self._num(l.hours) || self._lineHours(l), gross: gross, deductionTotal: ded, net: net,
                    ownPaid: self._round2(ownPaid), reason: reason,
                    received: [], receivedTotal: 0
                };
                allocs.forEach(function(a) {
                    const tgt = periods[self._pkey(a.runId, wid)];
                    if (tgt) {
                        a.periodStart = tgt.periodStart; a.periodEnd = tgt.periodEnd;
                        tgt.received.push({ runId: r.id, paidDate: r.paidDate, method: r.method || '', reference: r.reference || '', amount: a.amount, periodStart: r.periodStart, periodEnd: r.periodEnd });
                        tgt.receivedTotal = self._round2(tgt.receivedTotal + a.amount);
                    } else {
                        a.orphan = true;    // the period it paid toward has since been deleted
                    }
                });
                const allocTotal = self._round2(allocs.reduce(function(s, a) { return s + a.amount; }, 0));
                const allocPaid = self._round2(allocs.reduce(function(s, a) { return s + (a.amount > 0 ? a.amount : 0); }, 0));
                const allocRecovered = self._round2(allocs.reduce(function(s, a) { return s + (a.amount < 0 ? -a.amount : 0); }, 0));
                lines[key] = {
                    net: net, ownPaid: self._round2(ownPaid),
                    shortfall: self._round2(Math.max(0, net - ownPaid)), overpaid: self._round2(Math.max(0, ownPaid - net)),
                    adjustReason: reason, shortReason: reason,
                    allocations: allocs, allocationsTotal: allocTotal, allocationsPaid: allocPaid, allocationsRecovered: allocRecovered,
                    paid: self._round2(ownPaid + allocTotal)
                };
            });
        });
        Object.keys(periods).forEach(function(k) {
            const p = periods[k];
            p.paidAgainst = self._round2(p.ownPaid + p.receivedTotal);
            p.balance = self._round2(p.net - p.paidAgainst);     // positive = still owed, negative = overpaid
            p.owed = p.balance > 0.005 ? p.balance : 0;
            p.overpaid = p.balance < -0.005 ? self._round2(-p.balance) : 0;
            p.received.sort(function(a, b) { return String(a.paidDate || '').localeCompare(String(b.paidDate || '')); });
            // Owed (or overpaid) since the day this period was paid; settled on the day the last payment landed.
            const open = p.owed > 0 || p.overpaid > 0;
            p.since = open ? p.paidDate : '';
            p.settledOn = open ? '' : (p.received.length ? p.received[p.received.length - 1].paidDate : p.paidDate);
            p.status = p.net <= 0.005 && p.paidAgainst <= 0.005 ? 'none' : p.overpaid > 0 ? 'over' : p.owed <= 0 ? 'paid' : p.paidAgainst > 0.005 ? 'part' : 'unpaid';
        });
        return { periods: periods, lines: lines };
    },
    _period(runId, workerId) { return this._ledger().periods[this._pkey(runId, workerId)] || null; },
    // The saved line as the ledger reads it (paid, own period paid, shortfall or overpayment, allocations).
    _savedLine(r, l) {
        const self = this;
        return self._ledger().lines[self._pkey(r.id, l.workerId)] || { net: self._num(l.net), ownPaid: self._num(l.net), shortfall: 0, overpaid: 0, adjustReason: '', shortReason: '', allocations: [], allocationsTotal: 0, allocationsPaid: 0, allocationsRecovered: 0, paid: self._num(l.net) };
    },
    // Every period not settled (still owed, or overpaid), keyed by worker, oldest first.
    _openPeriodsByWorker() { return this._openPeriodsByWorkerIn(null); },
    _openPeriodsByWorkerIn(runList) {
        const self = this;
        const by = {};
        const periods = (runList ? self._ledgerOf(runList) : self._ledger()).periods;
        Object.keys(periods).forEach(function(k) {
            const p = periods[k];
            if (p.owed <= 0 && p.overpaid <= 0) return;
            if (!by[p.workerId]) by[p.workerId] = [];
            by[p.workerId].push(p);
        });
        Object.keys(by).forEach(function(wid) {
            by[wid].sort(function(a, b) { return String(a.periodEnd || '').localeCompare(String(b.periodEnd || '')) || String(a.paidDate || '').localeCompare(String(b.paidDate || '')); });
        });
        return by;
    },
    _openPeriodsFor(workerId) { return this._openPeriodsByWorker()[String(workerId)] || []; },
    _owedPeriodsFor(workerId) { return this._openPeriodsFor(workerId).filter(function(p) { return p.owed > 0; }); },
    _overpaidPeriodsFor(workerId) { return this._openPeriodsFor(workerId).filter(function(p) { return p.overpaid > 0; }); },
    _owedTotal(workerId) {
        const self = this;
        return self._round2(self._openPeriodsFor(workerId).reduce(function(s, p) { return s + p.owed; }, 0));
    },
    _overpaidTotal(workerId) {
        const self = this;
        return self._round2(self._openPeriodsFor(workerId).reduce(function(s, p) { return s + p.overpaid; }, 0));
    },
    // Periods of this run that a later run has paid toward (so this run cannot go first).
    _runsPayingToward(runId) {
        const self = this;
        const r = (self._runs || []).find(function(x) { return x.id === runId; });
        const out = [];
        (r && Array.isArray(r.lines) ? r.lines : []).forEach(function(l) {
            const p = self._period(runId, l.workerId);
            if (p) p.received.forEach(function(x) { if (!out.some(function(o) { return o.runId === x.runId; })) out.push(x); });
        });
        return out;
    },
    _periodLabel(p) { return this._dayDate(p.periodStart) + ' to ' + this._dayDate(p.periodEnd); },
    // "$X from <period>, owed since <date>" or "$X overpaid on <period>, paid <date>".
    _owedLabel(p) {
        const self = this;
        if (p.overpaid > 0.005 && !(p.owed > 0.005)) {
            return self._money(p.overpaid) + ' overpaid on ' + self._periodLabel(p) + ', paid ' + self._dayDate(p.since) + (p.reason ? ' (' + p.reason + ')' : '');
        }
        return self._money(p.owed !== undefined ? p.owed : p.balance) + ' from ' + self._periodLabel(p) + ', owed since ' + self._dayDate(p.since) + (p.reason ? ' (' + p.reason + ')' : '');
    },
    _paymentsLabel(p) {
        const self = this;
        const parts = [];
        if (p.ownPaid > 0.005) parts.push(self._money(p.ownPaid) + ' on ' + self._dayDate(p.paidDate) + (p.method ? ', ' + p.method : ''));
        p.received.forEach(function(x) {
            const runOf = ' (run of ' + self._dayDate(x.periodStart) + ' to ' + self._dayDate(x.periodEnd) + ')';
            if (x.amount < 0) parts.push(self._money(-x.amount) + ' recovered on ' + self._dayDate(x.paidDate) + runOf);
            else parts.push(self._money(x.amount) + ' on ' + self._dayDate(x.paidDate) + (x.method ? ', ' + x.method : '') + runOf);
        });
        return parts;
    },
    _statusHtml(p) {
        const self = this;
        if (p.net <= 0.005 && p.paidAgainst <= 0.005) return '';
        if (p.overpaid > 0.005) {
            return '<span class="pay-status pay-status-over" style="color:#b8860b"><strong>' + self._money(p.overpaid) + ' overpaid</strong> on ' + Utils.escapeHtml(self._dayDate(p.since)) + ', comes off their next pay' + (p.reason ? ' (' + Utils.escapeHtml(p.reason) + ')' : '') + '</span>';
        }
        if (p.owed <= 0.005) {
            const late = p.received.length > 0;
            return '<span class="pay-status pay-status-paid" style="color:var(--success,#27ae60)">Paid in full' + (late ? ' on ' + Utils.escapeHtml(self._dayDate(p.settledOn)) : '') + '</span>';
        }
        return '<span class="pay-status pay-status-owed" style="color:#b8860b"><strong>' + self._money(p.owed) + ' still owed</strong> since ' + Utils.escapeHtml(self._dayDate(p.since)) + (p.reason ? ' (' + Utils.escapeHtml(p.reason) + ')' : '') + '</span>';
    },
    _when(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        return Utils.formatDateTime ? Utils.formatDateTime(iso) : d.toLocaleString('en-CA');
    },

    // ── draft line arithmetic (New Pay Run) ──────────────────────────────────
    _lineGross(l) {
        const r = this._num(l.rate);
        return this._round2(this._num(l.regularHours) * r + this._num(l.otHours) * r * 1.5 + this._num(l.dtHours) * r * 2);
    },
    _lineDeductions(l) {
        const self = this;
        return self._round2((l.deductions || []).reduce(function(s, d) { return s + (d.apply ? self._num(d.amount) : 0); }, 0));
    },
    _lineHours(l) { return this._round2(this._num(l.regularHours) + this._num(l.otHours) + this._num(l.dtHours)); },
    _lineNet(l) { return this._round2(this._lineGross(l) - this._lineDeductions(l)); },
    // Paid toward this period's own net. Less than net is a shortfall (stays owed on this
    // period); more than net is an overpayment (comes back off the next run).
    _lineOwnPaid(l) {
        const net = this._lineNet(l);
        if (l.paid === null || l.paid === undefined) return net;
        const p = this._round2(this._num(l.paid));
        return p < 0 ? 0 : p;
    },
    _lineShortfall(l) { return this._round2(Math.max(0, this._lineNet(l) - this._lineOwnPaid(l))); },
    _lineOverpaid(l) { return this._round2(Math.max(0, this._lineOwnPaid(l) - this._lineNet(l))); },
    // Paid toward earlier periods still owed, on this run.
    _lineAllocatedPaid(l) {
        const self = this;
        return self._round2((l.earlier || []).reduce(function(s, p) { return s + (p.kind === 'over' ? 0 : self._num(p.amount)); }, 0));
    },
    // Recovered on this run from earlier overpayments (reduces the cash out).
    _lineRecovered(l) {
        const self = this;
        return self._round2((l.earlier || []).reduce(function(s, p) { return s + (p.kind === 'over' ? self._num(p.amount) : 0); }, 0));
    },
    // Net effect of the earlier-period boxes on the cash out: paid toward, less recovered.
    _lineAllocated(l) { return this._round2(this._lineAllocatedPaid(l) - this._lineRecovered(l)); },
    _linePaid(l) { return this._round2(this._lineOwnPaid(l) + this._lineAllocated(l)); },
    _lineEarlierOwed(l) {
        const self = this;
        return self._round2((l.earlier || []).reduce(function(s, p) { return s + (p.kind === 'over' ? 0 : self._num(p.balance)); }, 0));
    },
    _lineEarlierOver(l) {
        const self = this;
        return self._round2((l.earlier || []).reduce(function(s, p) { return s + (p.kind === 'over' ? self._num(p.balance) : 0); }, 0));
    },

    _renderNewRun() {
        const self = this;
        const c = self._container;
        const d = self._draft;
        const lines = d.lines;
        const editing = !!d.editId;

        let tableHtml = '';
        if (lines === null) {
            tableHtml = '<div class="card"><div class="empty"><h3>Pick the period, then load hours</h3><p>Approved timecards inside the period come in grouped by employee at their pay rate on file.</p></div></div>';
        } else if (lines.length === 0) {
            tableHtml = self._noHoursHtml(d);
        } else {
            let totHours = 0, totGross = 0, totDed = 0, totNet = 0, totPaid = 0, totShort = 0, totOver = 0, totAlloc = 0, totRecov = 0, totEarlier = 0, totEarlierOver = 0;
            const paying = lines.filter(function(l) { return l.pay !== false; }).length;
            const earlierPeople = lines.filter(function(l) { return l.pay !== false && (l.earlier || []).length; }).length;
            const noteText = editing
                ? 'This run is already recorded. Change what you need and save. Paid now is this period only: less than Due leaves the rest owed on this period, more than Due is an overpayment that comes off their next pay, and either can take a note. Untick a person to take them off the run; their hours go back to unpaid and any deductions taken from them in this run reopen. The period and the hours are fixed by the approved cards, and deductions already taken stay as they are. To change those, delete the run and record it again.'
                : (paying === lines.length
                    ? 'Everyone with approved hours in this period is listed. To pay one person on their own, untick the others. Anyone left unticked is not paid in this run and their hours come back the next time you load a run.'
                    : 'Paying ' + paying + ' of ' + lines.length + '. The unticked ' + (lines.length - paying === 1 ? 'person is' : 'people are') + ' left out of this run and their hours stay unpaid until you include them in a later run.') +
                  ' Due is this period only. Paid now starts at the full amount. Enter less to record a partial payment and the rest stays owed on this period until a later run pays it. Enter more to record an overpayment and the extra comes off their next pay. Either way you can add a note saying why.' +
                  (earlierPeople ? ' ' + earlierPeople + (earlierPeople === 1 ? ' person has' : ' people have') + ' an earlier period not yet settled, listed under their name with its own box. Money owed from before is paid on top of this period; an earlier overpayment is recovered out of this one.' : '');
            tableHtml = '<div class="card" style="border-left:3px solid var(--primary,#2d6cdf);font-size:.88rem" id="payPickNote">' + noteText + '</div>' +
                '<div class="card" style="overflow-x:auto"><table>' +
                '<thead><tr><th>Pay</th><th>Employee</th><th class="amount">Hours</th><th class="amount">Rate</th><th class="amount">Gross</th><th>Deductions this run</th><th class="amount">Due</th><th class="amount">Paid now</th></tr></thead><tbody>' +
                lines.map(function(l, i) {
                    const inRun = l.pay !== false;
                    const hrs = self._lineHours(l), gross = self._lineGross(l), ded = self._lineDeductions(l), net = self._lineNet(l);
                    const ownPaid = self._lineOwnPaid(l), short = self._lineShortfall(l), over = self._lineOverpaid(l);
                    const allocPaid = self._lineAllocatedPaid(l), recov = self._lineRecovered(l), cashOut = self._linePaid(l);
                    const earlierOwed = self._lineEarlierOwed(l), earlierOver = self._lineEarlierOver(l);
                    if (inRun) { totHours += hrs; totGross += gross; totDed += ded; totNet += net; totPaid += cashOut; totShort += short; totOver += over; totAlloc += allocPaid; totRecov += recov; totEarlier += earlierOwed; totEarlierOver += earlierOver; }
                    const breakdown = (l.otHours || l.dtHours) ? '<div style="font-size:.75rem;color:var(--text2)">' + l.regularHours + ' reg' + (l.otHours ? ' + ' + l.otHours + ' OT x1.5' : '') + (l.dtHours ? ' + ' + l.dtHours + ' DT x2' : '') + '</div>' : '';
                    const daysHtml = l.days.length
                        ? '<div style="font-size:.75rem;color:var(--text2);margin-top:4px">' + l.days.map(function(dd) { return Utils.escapeHtml(self._dayDate(dd.date)) + ' ' + dd.hours + 'h'; }).join(' · ') + '</div>'
                        : '<div style="font-size:.75rem;color:var(--text2);margin-top:4px">No approved hours this period</div>';
                    const earlierHtml = (l.earlier || []).length
                        ? '<div class="pay-earlier" style="font-size:.75rem;color:#b8860b;margin-top:6px"><div style="font-weight:600">Carried forward from earlier periods</div>' +
                            l.earlier.map(function(p, k) {
                                const isOver = p.kind === 'over';
                                return '<div class="pay-earlier-row" data-run="' + Utils.escapeHtml(p.runId) + '" data-kind="' + (isOver ? 'over' : 'owed') + '" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:3px">' +
                                    '<span>' + Utils.escapeHtml(self._owedLabel(isOver ? { overpaid: p.balance, owed: 0, periodStart: p.periodStart, periodEnd: p.periodEnd, since: p.since, reason: p.reason } : { owed: p.balance, overpaid: 0, periodStart: p.periodStart, periodEnd: p.periodEnd, since: p.since, reason: p.reason })) + '</span>' +
                                    '<label style="display:flex;gap:4px;align-items:center;white-space:nowrap">' + (isOver ? 'Recover now' : 'Pay toward it now') + ' <input type="number" step="0.01" min="0" max="' + p.balance + '" class="form-control pay-earlier-amt" data-i="' + i + '" data-k="' + k + '" value="' + self._num(p.amount).toFixed(2) + '" style="width:90px;padding:2px 6px;text-align:right"' + (inRun ? '' : ' disabled') + '></label>' +
                                '</div>';
                            }).join('') + '</div>'
                        : '';
                    const adjustHtml = (short > 0.005 || over > 0.005)
                        ? '<div class="' + (short > 0.005 ? 'pay-short' : 'pay-over') + '" style="font-size:.75rem;color:#b8860b;margin-top:4px;text-align:left;min-width:160px"><strong>' +
                              (short > 0.005 ? self._money(short) + ' short</strong>, stays owed on this period.' : self._money(over) + ' over</strong>, an overpayment; it comes off their next pay.') +
                              '<textarea class="form-control pay-adjust-reason pay-short-reason" data-i="' + i + '" rows="2" placeholder="Why (optional)" style="margin-top:4px;font-size:.8rem">' + Utils.escapeHtml(l.adjustReason || '') + '</textarea></div>'
                        : '';
                    const allocParts = [];
                    if (allocPaid > 0.005) allocParts.push('+ ' + self._money(allocPaid) + ' toward earlier periods');
                    if (recov > 0.005) allocParts.push('&minus; ' + self._money(recov) + ' recovered from the earlier overpayment');
                    const paidHtml = '<input type="number" step="0.01" min="0" class="form-control pay-paid" data-i="' + i + '" value="' + ownPaid.toFixed(2) + '" style="width:100px;padding:3px 6px;text-align:right"' + (inRun ? '' : ' disabled') + '>' +
                        adjustHtml +
                        (allocParts.length ? '<div class="pay-alloc-note" style="font-size:.72rem;color:var(--text2);margin-top:4px;text-align:left">' + allocParts.join(' ') + ' = ' + self._money(cashOut) + ' paid</div>' : '');
                    const dedHtml = (l.deductions.length === 0)
                        ? '<span style="color:var(--text2);font-size:.85rem">None open</span>'
                        : l.deductions.map(function(dd, j) {
                            if (dd.locked) {
                                return '<div class="pay-ded-locked" style="font-size:.85rem;margin-bottom:4px">' + self._money(dd.amount) + ' ' + Utils.escapeHtml(dd.description) + ' <span style="color:var(--text2)">(taken in this run)</span></div>';
                            }
                            return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;font-size:.85rem">' +
                                '<input type="checkbox" class="pay-ded-apply" data-i="' + i + '" data-j="' + j + '"' + (dd.apply ? ' checked' : '') + '>' +
                                '<input type="number" step="0.01" min="0" max="' + dd.remaining + '" class="form-control pay-ded-amt" data-i="' + i + '" data-j="' + j + '" value="' + dd.amount + '" style="width:96px;padding:3px 6px"' + (dd.apply ? '' : ' disabled') + '>' +
                                '<span title="' + Utils.escapeHtml(dd.type) + '">' + Utils.escapeHtml(dd.description) + ' <span style="color:var(--text2)">(' + self._money(dd.remaining) + ' owing)</span></span>' +
                            '</div>';
                        }).join('');
                    const rateWarn = self._num(l.rate) > 0 ? '' : '<div style="font-size:.72rem;color:var(--accent)">No pay rate on file</div>';
                    return '<tr class="pay-line' + (inRun ? '' : ' pay-line-out') + '" data-wid="' + Utils.escapeHtml(l.workerId) + '"' + (inRun ? '' : ' style="opacity:.45"') + '>' +
                        '<td><input type="checkbox" class="pay-line-include" data-i="' + i + '" aria-label="Pay ' + Utils.escapeHtml(l.workerName) + ' in this run"' + (inRun ? ' checked' : '') + '></td>' +
                        '<td><strong>' + Utils.escapeHtml(l.workerName) + '</strong>' + (inRun ? '' : ' <span style="font-size:.72rem;color:var(--text2)">' + (editing ? 'taken off this run on save' : 'left out of this run') + '</span>') + daysHtml + earlierHtml + '</td>' +
                        '<td class="amount">' + hrs.toFixed(2) + breakdown + '</td>' +
                        '<td class="amount"><input type="number" step="0.01" min="0" class="form-control pay-rate" data-i="' + i + '" value="' + self._num(l.rate) + '" style="width:90px;padding:3px 6px;text-align:right">' + rateWarn + '</td>' +
                        '<td class="amount">' + self._money(gross) + '</td>' +
                        '<td>' + dedHtml + '</td>' +
                        '<td class="amount"><strong>' + self._money(net) + '</strong>' +
                            (earlierOwed > 0.005 ? '<div class="pay-earlier-due" style="font-size:.72rem;font-weight:400;color:#b8860b">' + self._money(earlierOwed) + ' owed on earlier periods</div>' : '') +
                            (earlierOver > 0.005 ? '<div class="pay-earlier-over" style="font-size:.72rem;font-weight:400;color:#b8860b">' + self._money(earlierOver) + ' overpaid earlier, to recover</div>' : '') + '</td>' +
                        '<td class="amount">' + paidHtml + '</td>' +
                    '</tr>';
                }).join('') +
                '</tbody><tfoot><tr style="font-weight:600"><td></td><td>Total, ' + paying + ' of ' + lines.length + ' paid</td><td class="amount">' + self._round2(totHours).toFixed(2) + '</td><td></td><td class="amount">' + self._money(totGross) + '</td><td class="amount">' + (totDed ? '-' + self._money(totDed) : '') + '</td><td class="amount">' + self._money(totNet) +
                    (totEarlier > 0.005 ? '<div style="font-size:.72rem;font-weight:400;color:#b8860b">' + self._money(totEarlier) + ' owed on earlier periods</div>' : '') +
                    (totEarlierOver > 0.005 ? '<div style="font-size:.72rem;font-weight:400;color:#b8860b">' + self._money(totEarlierOver) + ' overpaid earlier</div>' : '') + '</td><td class="amount">' + self._money(totPaid) +
                    (totAlloc > 0.005 ? '<div id="payAllocTotal" style="font-size:.72rem;font-weight:400;color:var(--text2)">incl. ' + self._money(totAlloc) + ' toward earlier periods</div>' : '') +
                    (totRecov > 0.005 ? '<div id="payRecovTotal" style="font-size:.72rem;font-weight:400;color:var(--text2)">less ' + self._money(totRecov) + ' recovered from earlier overpayments</div>' : '') +
                    (totShort > 0.005 ? '<div id="payShortTotal" style="font-size:.72rem;color:#b8860b">' + self._money(totShort) + ' unsettled on this period</div>' : '') +
                    (totOver > 0.005 ? '<div id="payOverTotal" style="font-size:.72rem;color:#b8860b">' + self._money(totOver) + ' overpaid on this period, carried to the next</div>' : '') + '</td></tr></tfoot></table></div>';
            if (!editing) {
                const notes = [];
                if (d.pendingCount) notes.push(d.pendingCount + ' timecard' + (d.pendingCount === 1 ? '' : 's') + ' in this period still pending approval and not included.');
                if (d.alreadyPaid) notes.push(d.alreadyPaid + ' approved timecard' + (d.alreadyPaid === 1 ? '' : 's') + ' already paid in an earlier run, left out: ' + self._paidInText(d) + '.');
                if (notes.length) tableHtml += '<div class="card" id="payLoadNotes" style="border-left:3px solid var(--warn,#f39c12);font-size:.88rem">' + notes.map(Utils.escapeHtml).join('<br>') + '</div>';
            }
        }

        c.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:20px">
                <h2 style="margin:0" id="payFormTitle">${editing ? 'Edit Pay Run, ' + Utils.escapeHtml(self._dayDate(d.periodStart)) + ' to ' + Utils.escapeHtml(self._dayDate(d.periodEnd)) : 'New Pay Run'}</h2>
                <button class="btn-secondary btn-sm" id="payBackBtn">${editing ? 'Cancel' : 'Back'}</button>
            </div>
            <div class="card" style="padding:12px 14px">
                <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
                    <div class="form-group" style="margin:0"><label style="font-size:.78rem">Period start</label><input type="date" class="form-control" id="payFrom" value="${Utils.escapeHtml(d.periodStart)}"${editing ? ' disabled' : ''}></div>
                    <div class="form-group" style="margin:0"><label style="font-size:.78rem">Period end</label><input type="date" class="form-control" id="payTo" value="${Utils.escapeHtml(d.periodEnd)}"${editing ? ' disabled' : ''}></div>
                    ${editing ? '<span style="font-size:.8rem;color:var(--text2)">The period is fixed on a recorded run.</span>' : '<button class="btn-primary btn-sm" id="payLoadBtn" type="button">' + (lines === null ? 'Load approved hours' : 'Reload hours') + '</button>'}
                </div>
            </div>
            ${tableHtml}
            ${lines && lines.length ? `
            <div class="card" style="padding:12px 14px">
                <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
                    <div class="form-group" style="margin:0"><label style="font-size:.78rem">Paid on</label><input type="date" class="form-control" id="payPaidDate" value="${Utils.escapeHtml(d.paidDate)}"></div>
                    <div class="form-group" style="margin:0"><label style="font-size:.78rem">Method</label><select class="form-control" id="payMethod">${self.PAY_METHODS.map(function(m) { return '<option' + (m === d.method ? ' selected' : '') + '>' + m + '</option>'; }).join('')}</select></div>
                    <div class="form-group" style="margin:0;flex:1;min-width:160px"><label style="font-size:.78rem">Reference (optional)</label><input type="text" class="form-control" id="payRef" value="${Utils.escapeHtml(d.reference)}" placeholder="e-transfer or cheque numbers"></div>
                </div>
                <div class="form-group" style="margin:10px 0 0"><label style="font-size:.78rem">Notes (optional)</label><textarea class="form-control" id="payNotes" rows="2">${Utils.escapeHtml(d.notes)}</textarea></div>
                <div style="margin-top:12px;display:flex;justify-content:flex-end"><button class="btn-primary" id="payRecordBtn" type="button">${editing ? 'Save changes' : 'Record Pay Run'}</button></div>
            </div>` : ''}
        `;

        c.querySelector('#payBackBtn').addEventListener('click', function() {
            if (editing) { self._view = 'detail'; self._detailId = d.editId; } else { self._view = 'list'; }
            self._draft = null; self._renderContent();
        });
        if (!editing) {
            c.querySelector('#payFrom').addEventListener('change', function(e) { d.periodStart = e.target.value; });
            c.querySelector('#payTo').addEventListener('change', function(e) { d.periodEnd = e.target.value; });
            c.querySelector('#payLoadBtn').addEventListener('click', function() {
                const restore = UI.btnLoading ? UI.btnLoading(c.querySelector('#payLoadBtn'), 'Loading…') : function() {};
                self._loadHours().finally(restore);
            });
        }
        c.querySelectorAll('.pay-view-btn').forEach(function(b) {
            b.addEventListener('click', function() { self._draft = null; self._detailId = b.dataset.id; self._view = 'detail'; self._renderContent(); });
        });
        if (!lines || !lines.length) return;
        c.querySelectorAll('.pay-line-include').forEach(function(cb) {
            cb.addEventListener('change', function() { lines[+cb.dataset.i].pay = cb.checked; self._renderContent(); });
        });
        c.querySelectorAll('.pay-rate').forEach(function(inp) {
            inp.addEventListener('change', function() { lines[+inp.dataset.i].rate = self._num(inp.value); self._capRecoveries(lines[+inp.dataset.i]); self._renderContent(); });
        });
        c.querySelectorAll('.pay-ded-apply').forEach(function(cb) {
            cb.addEventListener('change', function() { lines[+cb.dataset.i].deductions[+cb.dataset.j].apply = cb.checked; self._capRecoveries(lines[+cb.dataset.i]); self._renderContent(); });
        });
        c.querySelectorAll('.pay-ded-amt').forEach(function(inp) {
            inp.addEventListener('change', function() {
                const dd = lines[+inp.dataset.i].deductions[+inp.dataset.j];
                let v = self._round2(self._num(inp.value));
                if (v < 0) v = 0;
                if (v > dd.remaining) { v = dd.remaining; Utils.showToast('Capped at the ' + self._money(dd.remaining) + ' still owing', 'error'); }
                dd.amount = v; self._capRecoveries(lines[+inp.dataset.i]); self._renderContent();
            });
        });
        c.querySelectorAll('.pay-paid').forEach(function(inp) {
            inp.addEventListener('change', function() {
                const l = lines[+inp.dataset.i];
                const net = self._lineNet(l);
                let v = self._round2(self._num(inp.value));
                if (v < 0) v = 0;
                l.paid = (Math.abs(v - net) < 0.005) ? null : v;
                self._capRecoveries(l);
                self._renderContent();
                const again = c.querySelector('.pay-adjust-reason[data-i="' + inp.dataset.i + '"]');
                if (again) again.focus();
            });
        });
        c.querySelectorAll('.pay-earlier-amt').forEach(function(inp) {
            inp.addEventListener('change', function() {
                const l = lines[+inp.dataset.i];
                const p = l.earlier[+inp.dataset.k];
                let v = self._round2(self._num(inp.value));
                if (v < 0) v = 0;
                if (v > p.balance) { v = p.balance; Utils.showToast('Capped at the ' + self._money(p.balance) + (p.kind === 'over' ? ' overpaid on ' : ' still owed on ') + self._periodLabel(p), 'error'); }
                p.amount = v;
                if (p.kind === 'over' && self._linePaid(l) < -0.005) {
                    p.amount = self._round2(Math.max(0, v + self._linePaid(l)));
                    Utils.showToast('Capped at ' + self._money(p.amount) + ': you can only recover as much as is being paid this run', 'error');
                }
                self._renderContent();
            });
        });
        c.querySelectorAll('.pay-adjust-reason').forEach(function(ta) {
            ta.addEventListener('input', function() { lines[+ta.dataset.i].adjustReason = ta.value; });
        });
        const paidDate = c.querySelector('#payPaidDate');
        if (paidDate) {
            paidDate.addEventListener('change', function(e) { d.paidDate = e.target.value; });
            c.querySelector('#payMethod').addEventListener('change', function(e) { d.method = e.target.value; });
            c.querySelector('#payRef').addEventListener('input', function(e) { d.reference = e.target.value; });
            c.querySelector('#payNotes').addEventListener('input', function(e) { d.notes = e.target.value; });
            c.querySelector('#payRecordBtn').addEventListener('click', function() { if (editing) self._saveEditedRun(); else self._recordRun(); });
        }
    },

    // A recovery can never exceed what is actually being paid out on the line.
    _capRecoveries(l) {
        const self = this;
        (l.earlier || []).forEach(function(p) {
            if (p.kind !== 'over') return;
            const cash = self._linePaid(l);
            if (cash < -0.005) p.amount = self._round2(Math.max(0, self._num(p.amount) + cash));
        });
    },

    // "the run of Mon, Sep 14 to Sun, Sep 20, paid Thu, Sep 24 (3 cards, Kosta S)"
    _paidInText(d) {
        const self = this;
        return (d.paidIn || []).map(function(x) {
            return 'the run of ' + self._dayDate(x.periodStart) + ' to ' + self._dayDate(x.periodEnd) + ', paid ' + self._dayDate(x.paidDate) + ' (' + x.cards + (x.cards === 1 ? ' card' : ' cards') + (x.names.length ? ', ' + x.names.join(', ') : '') + ')';
        }).join('; ');
    },

    // Empty state for a loaded period with nothing to pay. Two different situations:
    // nothing was ever approved in the period, or everything approved is already on a run.
    _noHoursHtml(d) {
        const self = this;
        const pending = d.pendingCount ? d.pendingCount + ' timecard' + (d.pendingCount === 1 ? '' : 's') + ' in this period still pending approval. Approve them first, then reload.' : '';
        if (!d.approvedCount) {
            return '<div class="card" id="payNoHours" data-state="none"><div class="empty"><h3>No approved hours in this period</h3><p>' +
                Utils.escapeHtml(pending || 'Nothing approved between these dates.') + '</p></div></div>';
        }
        const n = d.approvedCount;
        const runsHtml = (d.paidIn || []).map(function(x) {
            return '<li>' + Utils.escapeHtml(self._dayDate(x.periodStart) + ' to ' + self._dayDate(x.periodEnd) + ', paid ' + self._dayDate(x.paidDate) + ': ' + x.cards + (x.cards === 1 ? ' card' : ' cards') + (x.names.length ? ' (' + x.names.join(', ') + ')' : '')) +
                ' <button class="btn-secondary btn-sm pay-view-btn" data-id="' + Utils.escapeHtml(x.runId) + '" style="font-size:.72rem;padding:2px 8px">View run</button></li>';
        }).join('');
        return '<div class="card" id="payNoHours" data-state="all-paid"><div class="empty"><h3>All approved hours in this period have already been paid</h3><p>' +
            n + ' approved timecard' + (n === 1 ? '' : 's') + ' between these dates, and ' + (n === 1 ? 'it is' : 'all ' + n + ' are') + ' already on a recorded run. There is nothing left to pay for this period.' +
            (pending ? ' ' + Utils.escapeHtml(pending) : '') + '</p>' +
            (runsHtml ? '<ul style="text-align:left;display:inline-block;margin:8px 0 0;font-size:.88rem">' + runsHtml + '</ul>' : '') +
            '</div></div>';
    },

    // ── building and saving a run from the form ──────────────────────────────
    _draftLine(l) {
        const self = this;
        const gross = self._lineGross(l), ded = self._lineDeductions(l), net = self._lineNet(l);
        const ownPaid = self._lineOwnPaid(l), short = self._lineShortfall(l), over = self._lineOverpaid(l);
        const allocs = (l.earlier || []).filter(function(p) { return self._num(p.amount) > 0.005; }).map(function(p) {
            const amt = self._round2(p.amount);
            return { runId: p.runId, periodStart: p.periodStart, periodEnd: p.periodEnd, amount: p.kind === 'over' ? -amt : amt };
        });
        const allocPaid = self._lineAllocatedPaid(l), recov = self._lineRecovered(l);
        const reason = (short > 0.005 || over > 0.005) ? String(l.adjustReason || '').trim() : '';
        return {
            workerId: l.workerId, workerName: l.workerName, rate: self._num(l.rate),
            regularHours: l.regularHours, otHours: l.otHours, dtHours: l.dtHours, hours: self._lineHours(l),
            gross: gross, deductionTotal: ded, net: net,
            ownPaid: ownPaid, shortfall: short, overpaid: over,
            adjustReason: reason,
            shortReason: short > 0.005 ? reason : '',
            allocations: allocs,
            allocationsTotal: self._round2(allocPaid - recov), allocationsPaid: allocPaid, allocationsRecovered: recov,
            paid: self._linePaid(l),
            days: l.days, timecardIds: l.timecardIds,
            deductions: l.deductions.filter(function(x) { return x.apply && self._num(x.amount) > 0; }).map(function(x) {
                return { deductionId: x.deductionId, description: x.description, type: x.type, amount: self._round2(x.amount) };
            })
        };
    },
    _draftTotals(lines) {
        const self = this;
        return lines.reduce(function(t, l) {
            t.hours = self._round2(t.hours + l.hours); t.gross = self._round2(t.gross + l.gross);
            t.deductions = self._round2(t.deductions + l.deductionTotal); t.net = self._round2(t.net + l.net);
            t.paid = self._round2(t.paid + l.paid); t.shortfall = self._round2(t.shortfall + l.shortfall); t.overpaid = self._round2(t.overpaid + l.overpaid);
            t.allocated = self._round2(t.allocated + l.allocationsTotal); t.allocatedPaid = self._round2(t.allocatedPaid + l.allocationsPaid); t.recovered = self._round2(t.recovered + l.allocationsRecovered);
            return t;
        }, { hours: 0, gross: 0, deductions: 0, net: 0, paid: 0, shortfall: 0, overpaid: 0, allocated: 0, allocatedPaid: 0, recovered: 0 });
    },
    // Checks that apply to a new run and to an edit alike. Returns true when clear.
    async _checkDraft(picked) {
        const self = this;
        const d = self._draft;
        if (!picked.length) { Utils.showToast('Tick at least one person to pay', 'error'); return false; }
        if (!d.paidDate) { Utils.showToast('Enter the date it was paid', 'error'); return false; }
        const zeroRate = picked.filter(function(l) { return self._lineHours(l) > 0 && self._num(l.rate) <= 0; });
        if (zeroRate.length) {
            const ok = await Utils.confirm(zeroRate.map(function(l) { return l.workerName; }).join(', ') + ' would be paid at $0 an hour. Record anyway?');
            if (!ok) return false;
        }
        // A line with no hours and nothing paid toward an earlier period records nothing.
        const empty = picked.filter(function(l) { return self._lineHours(l) <= 0 && self._lineOwnPaid(l) <= 0.005 && self._lineAllocatedPaid(l) <= 0.005; });
        if (empty.length) {
            Utils.showToast(empty.map(function(l) { return l.workerName; }).join(', ') + (empty.length === 1 ? ' has' : ' have') + ' no hours this period and nothing entered toward the earlier balance. Enter an amount or untick them.', 'error');
            return false;
        }
        // Paying more than due is allowed, but it is confirmed so a slipped digit never goes through unseen.
        const over = picked.filter(function(l) { return self._lineOverpaid(l) > 0.005; });
        if (over.length) {
            const ok = await Utils.confirm(over.map(function(l) { return l.workerName + ' ' + self._money(self._lineOverpaid(l)) + ' more than due this period'; }).join('; ') + '. The extra is recorded as an overpayment and comes off their next pay. Record it?');
            if (!ok) return false;
        }
        return true;
    },
    _tail(totals) {
        const self = this;
        return (totals.allocatedPaid > 0.005 ? ', ' + self._money(totals.allocatedPaid) + ' of it toward earlier periods' : '') +
            (totals.recovered > 0.005 ? ', ' + self._money(totals.recovered) + ' recovered from earlier overpayments' : '') +
            (totals.shortfall > 0.005 ? ', ' + self._money(totals.shortfall) + ' left owed on this period' : '') +
            (totals.overpaid > 0.005 ? ', ' + self._money(totals.overpaid) + ' overpaid and carried to the next period' : '');
    },

    async _recordRun() {
        const self = this;
        const d = self._draft;
        const btn = self._container.querySelector('#payRecordBtn');
        if (!d || !d.lines || !d.lines.length) return;
        const picked = d.lines.filter(function(l) { return l.pay !== false; });
        if (!(await self._checkDraft(picked))) return;
        const lines = picked.map(function(l) { return self._draftLine(l); });
        const totals = self._draftTotals(lines);
        const run = {
            id: AppData.generateId(), periodStart: d.periodStart, periodEnd: d.periodEnd,
            paidDate: d.paidDate, method: d.method, reference: d.reference || '', notes: d.notes || '',
            lines: lines, totals: totals, status: 'recorded', ledger: 'periods',
            createdBy: self._actor(), createdAt: new Date().toISOString()
        };
        const restore = UI.btnLoading ? UI.btnLoading(btn, 'Recording…') : function() {};
        try {
            await self._api('/api/payroll_runs', { method: 'POST', body: JSON.stringify(run) });
        } catch (e) {
            restore();
            Utils.showToast('Pay run not recorded: ' + e.message, 'error');
            return;
        }
        // Apply the deductions that were taken. The run is already saved, so report any
        // straggler instead of pretending it worked.
        const failed = await self._applyDeductions(lines, run);
        const tail = self._tail(totals);
        if (window.AppData && AppData.addAuditLog) AppData.addAuditLog(self._actor(), 'Pay Run Recorded', d.periodStart + ' to ' + d.periodEnd + ' — paid ' + self._money(totals.paid) + tail);
        try { await self._load(); } catch (e) { /* list refresh only */ }
        restore();
        if (failed.length) Utils.showToast('Pay run recorded, but these deductions did not update: ' + failed.join(', '), 'error');
        else Utils.showToast('Pay run recorded: ' + self._money(totals.paid) + ' paid' + tail);
        self._draft = null; self._detailId = run.id; self._view = 'detail';
        self._renderContent();
    },

    // Save an edited run over the recorded one (same id). People unticked come off the
    // run: their deductions taken in it reopen and their cards go back to unpaid.
    async _saveEditedRun() {
        const self = this;
        const d = self._draft;
        const btn = self._container.querySelector('#payRecordBtn');
        if (!d || !d.editId || !d.lines) return;
        const prev = d.editRun || (self._runs || []).find(function(x) { return x.id === d.editId; });
        if (!prev) { Utils.showToast('That run is no longer on file', 'error'); return; }
        const picked = d.lines.filter(function(l) { return l.pay !== false; });
        const dropped = d.lines.filter(function(l) { return l.pay === false; });
        // Someone a later run has paid toward (on this period) cannot be taken off it.
        for (const l of dropped) {
            const p = self._period(prev.id, l.workerId);
            if (p && p.received.length) {
                const x = p.received[0];
                Utils.showToast('The run of ' + self._dayDate(x.periodStart) + ' to ' + self._dayDate(x.periodEnd) + ' paid ' + self._money(Math.abs(x.amount)) + ' toward ' + l.workerName + ' on this period. Delete that one first, or keep ' + l.workerName + ' on this run.', 'error');
                return;
            }
        }
        if (!(await self._checkDraft(picked))) return;
        const lines = picked.map(function(l) { return self._draftLine(l); });
        const totals = self._draftTotals(lines);
        const run = Object.assign({}, prev, {
            id: prev.id, periodStart: prev.periodStart, periodEnd: prev.periodEnd,
            paidDate: d.paidDate, method: d.method, reference: d.reference || '', notes: d.notes || '',
            lines: lines, totals: totals, status: 'recorded', ledger: 'periods',
            createdBy: prev.createdBy || self._actor(), createdAt: prev.createdAt || new Date().toISOString(),
            updatedBy: self._actor(), updatedAt: new Date().toISOString(),
            edits: (Array.isArray(prev.edits) ? prev.edits : []).concat([{ at: new Date().toISOString(), by: self._actor(), paidBefore: self._num((prev.totals || {}).paid), paidAfter: totals.paid }])
        });
        const restore = UI.btnLoading ? UI.btnLoading(btn, 'Saving…') : function() {};
        try {
            await self._api('/api/payroll_runs', { method: 'POST', body: JSON.stringify(run) });
        } catch (e) {
            restore();
            Utils.showToast('Changes not saved: ' + e.message, 'error');
            return;
        }
        const droppedSaved = (Array.isArray(prev.lines) ? prev.lines : []).filter(function(l) { return dropped.some(function(x) { return String(x.workerId) === String(l.workerId); }); });
        const failed = await self._reverseDeductions(droppedSaved, prev.id);
        if (window.AppData && AppData.addAuditLog) AppData.addAuditLog(self._actor(), 'Pay Run Edited', prev.periodStart + ' to ' + prev.periodEnd + ' — paid ' + self._money(self._num((prev.totals || {}).paid)) + ' before, ' + self._money(totals.paid) + ' after' + (dropped.length ? ', ' + dropped.map(function(l) { return l.workerName; }).join(', ') + ' taken off' : ''));
        try { await self._load(); } catch (e) { /* list refresh only */ }
        restore();
        if (failed.length) Utils.showToast('Changes saved, but these deductions did not reopen: ' + failed.join(', '), 'error');
        else Utils.showToast('Pay run updated: ' + self._money(totals.paid) + ' paid' + self._tail(totals));
        self._draft = null; self._detailId = prev.id; self._view = 'detail';
        self._renderContent();
    },

    // Take the deductions on these saved lines off the open balances. Returns the
    // descriptions of any that failed to save.
    async _applyDeductions(lines, run) {
        const self = this;
        const failed = [];
        for (const l of lines) {
            for (const x of (l.deductions || [])) {
                const ded = self._deductions.find(function(q) { return q.id === x.deductionId; });
                if (!ded) continue;
                const upd = Object.assign({}, ded);
                upd.recovered = self._round2(self._num(ded.recovered) + x.amount);
                upd.status = upd.recovered >= self._num(ded.amount) - 0.005 ? 'applied' : 'open';
                upd.applications = (Array.isArray(ded.applications) ? ded.applications : []).concat([{ runId: run.id, amount: x.amount, paidDate: run.paidDate }]);
                upd.updatedAt = new Date().toISOString();
                try { await self._api('/api/payroll_deductions', { method: 'POST', body: JSON.stringify(upd) }); }
                catch (e) { failed.push(ded.description || ded.id); }
            }
        }
        return failed;
    },
    // Put the deductions on these saved lines back as owing (the run, or the person, is gone).
    async _reverseDeductions(lines, runId) {
        const self = this;
        const failed = [];
        for (const l of lines) {
            for (const x of (l.deductions || [])) {
                const ded = self._deductions.find(function(q) { return q.id === x.deductionId; });
                if (!ded) continue;
                const upd = Object.assign({}, ded);
                upd.recovered = Math.max(0, self._round2(self._num(ded.recovered) - self._num(x.amount)));
                upd.status = upd.recovered >= self._num(ded.amount) - 0.005 ? 'applied' : 'open';
                upd.applications = (Array.isArray(ded.applications) ? ded.applications : []).filter(function(a) { return a.runId !== runId; });
                upd.updatedAt = new Date().toISOString();
                try { await self._api('/api/payroll_deductions', { method: 'POST', body: JSON.stringify(upd) }); }
                catch (e) { failed.push(ded.description || ded.id); }
            }
        }
        return failed;
    },

    // ── run detail ───────────────────────────────────────────────────────────
    _renderRunDetail() {
        const self = this;
        const c = self._container;
        const r = self._runs.find(function(x) { return x.id === self._detailId; });
        if (!r) { self._view = 'list'; return self._renderContent(); }
        const t = r.totals || {};
        const lines = Array.isArray(r.lines) ? r.lines : [];
        let sumNet = 0, sumPaid = 0, sumAlloc = 0, sumRecov = 0, sumOwed = 0, sumOver = 0;
        c.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:20px">
                <h2 style="margin:0">Pay Run, ${Utils.escapeHtml(self._dayDate(r.periodStart))} to ${Utils.escapeHtml(self._dayDate(r.periodEnd))}</h2>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn-secondary btn-sm" id="payPrintBtn">Print</button>
                    <button class="btn-secondary btn-sm" id="payEditBtn">Edit run</button>
                    <button class="btn-secondary btn-sm" id="payDeleteBtn" style="color:var(--accent)">Delete run</button>
                    <button class="btn-secondary btn-sm" id="payBackBtn">Back</button>
                </div>
            </div>
            <div class="card" style="font-size:.9rem">
                <div><strong>Paid on:</strong> ${Utils.escapeHtml(self._dayDate(r.paidDate))} &nbsp;•&nbsp; <strong>Method:</strong> ${Utils.escapeHtml(r.method || '')}${r.reference ? ' &nbsp;•&nbsp; <strong>Ref:</strong> ' + Utils.escapeHtml(r.reference) : ''}</div>
                <div style="color:var(--text2);margin-top:4px" id="payRecordedBy">Recorded by ${Utils.escapeHtml(r.createdBy || 'Admin')}${r.createdAt ? ' on ' + Utils.escapeHtml(self._when(r.createdAt)) : ''}${r.updatedAt ? ', edited by ' + Utils.escapeHtml(r.updatedBy || 'Admin') + ' on ' + Utils.escapeHtml(self._when(r.updatedAt)) : ''}</div>
                ${r.notes ? '<div style="margin-top:6px">' + Utils.escapeHtml(r.notes) + '</div>' : ''}
            </div>
            ${lines.map(function(l) {
                const days = Array.isArray(l.days) ? l.days : [];
                const deds = Array.isArray(l.deductions) ? l.deductions : [];
                const sl = self._savedLine(r, l);
                const p = self._period(r.id, l.workerId);
                const net = sl.net, owed = p ? p.owed : 0, over = p ? p.overpaid : 0;
                sumNet += net; sumPaid += sl.paid; sumAlloc += sl.allocationsPaid; sumRecov += sl.allocationsRecovered; sumOwed += owed; sumOver += over;
                const payments = p ? self._paymentsLabel(p) : [];
                const paidNote = [];
                if (sl.allocationsPaid > 0.005) paidNote.push(self._money(sl.allocationsPaid) + ' toward earlier periods');
                if (sl.allocationsRecovered > 0.005) paidNote.push(self._money(sl.allocationsRecovered) + ' recovered from an earlier overpayment');
                return '<div class="card pay-detail-line" data-wid="' + Utils.escapeHtml(l.workerId) + '">' +
                    '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline">' +
                        '<strong style="font-size:1.05rem">' + Utils.escapeHtml(l.workerName) + ' <button class="btn-secondary btn-sm pay-emp-link" data-wid="' + Utils.escapeHtml(l.workerId) + '" style="font-size:.72rem;padding:2px 8px;margin-left:6px;vertical-align:middle">Pay history</button></strong>' +
                        '<span>' + self._num(l.hours).toFixed(2) + ' h @ ' + self._money(l.rate) + ' = ' + self._money(l.gross) + (l.deductionTotal ? ' &minus; ' + self._money(l.deductionTotal) : '') + ' = <strong>' + self._money(net) + ' net</strong>' +
                            (paidNote.length || sl.shortfall > 0.005 || sl.overpaid > 0.005 ? ', <strong>' + self._money(sl.paid) + ' paid</strong>' + (paidNote.length ? ' (' + self._money(sl.ownPaid) + ' on this period, ' + paidNote.join(', ') + ')' : '') : '') + '</span>' +
                    '</div>' +
                    (p && net > 0.005 ? '<div class="pay-detail-period" style="margin-top:6px;font-size:.85rem">' +
                        (payments.length ? '<div class="pay-detail-payments"><strong>Paid on this period:</strong> ' + payments.map(Utils.escapeHtml).join('; ') + '</div>' : '<div class="pay-detail-payments"><strong>Paid on this period:</strong> nothing yet</div>') +
                        '<div class="pay-detail-status" style="margin-top:2px">' + self._statusHtml(p) + '</div>' +
                    '</div>' : '') +
                    (sl.allocations.length ? '<div class="pay-detail-alloc" style="margin-top:6px;font-size:.85rem;color:var(--text2)"><strong>Also on this run:</strong> ' + sl.allocations.map(function(a) { return Utils.escapeHtml(self._money(Math.abs(a.amount)) + (a.amount < 0 ? ' recovered from the overpayment on ' : ' paid toward ') + (a.orphan ? 'a period since deleted' : self._dayDate(a.periodStart) + ' to ' + self._dayDate(a.periodEnd))); }).join('; ') + '</div>' : '') +
                    (days.length ? '<table style="margin-top:8px;font-size:.85rem"><thead><tr><th>Day</th><th>Project</th><th class="amount">Hours</th></tr></thead><tbody>' +
                        days.map(function(dd) { return '<tr><td>' + Utils.escapeHtml(self._dayDate(dd.date)) + '</td><td>' + Utils.escapeHtml(dd.projectName || '') + '</td><td class="amount">' + self._num(dd.hours).toFixed(2) + '</td></tr>'; }).join('') +
                        '</tbody></table>' : '') +
                    (deds.length ? '<div style="margin-top:8px;font-size:.85rem"><strong>Deducted:</strong> ' + deds.map(function(x) { return Utils.escapeHtml(x.description) + ' ' + self._money(x.amount); }).join(', ') + '</div>' : '') +
                '</div>';
            }).join('')}
            <div class="card" style="font-weight:600;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px" id="payDetailTotals">
                <span>${lines.length} employee${lines.length === 1 ? '' : 's'}, ${self._num(t.hours).toFixed(2)} hours</span>
                <span>Gross ${self._money(t.gross)}${self._num(t.deductions) ? ' &minus; deductions ' + self._money(t.deductions) : ''} = Net ${self._money(sumNet)}, Paid ${self._money(sumPaid)}${sumAlloc > 0.005 ? ' (incl. ' + self._money(sumAlloc) + ' toward earlier periods)' : ''}${sumRecov > 0.005 ? ' (less ' + self._money(sumRecov) + ' recovered from earlier overpayments)' : ''}${sumOwed > 0.005 ? ', <span style="color:#b8860b">' + self._money(sumOwed) + ' still owed on this period</span>' : ''}${sumOver > 0.005 ? ', <span style="color:#b8860b">' + self._money(sumOver) + ' overpaid on this period</span>' : ''}</span>
            </div>
        `;
        c.querySelector('#payBackBtn').addEventListener('click', function() { self._view = 'list'; self._renderContent(); });
        c.querySelector('#payPrintBtn').addEventListener('click', function() { window.print(); });
        c.querySelector('#payEditBtn').addEventListener('click', function() { self._startEditRun(r); });
        c.querySelectorAll('.pay-emp-link').forEach(function(b) {
            b.addEventListener('click', function() { self._empId = b.dataset.wid; self._tab = 'employees'; self._view = 'list'; self._renderContent(); });
        });
        c.querySelector('#payDeleteBtn').addEventListener('click', async function() {
            const later = self._runsPayingToward(r.id);
            if (later.length) {
                Utils.showToast('The run of ' + self._dayDate(later[0].periodStart) + ' to ' + self._dayDate(later[0].periodEnd) + (later[0].amount < 0 ? ' recovered ' : ' paid ') + self._money(Math.abs(later[0].amount)) + (later[0].amount < 0 ? ' from' : ' toward') + ' this period. Delete that one first.', 'error');
                return;
            }
            const alloc = lines.reduce(function(s, l) { return s + self._savedLine(r, l).allocationsPaid; }, 0);
            const recov = lines.reduce(function(s, l) { return s + self._savedLine(r, l).allocationsRecovered; }, 0);
            const ok = await Utils.confirm('Delete this pay run? The hours go back to unpaid and any deductions taken in it reopen.' + (alloc > 0.005 ? ' The ' + self._money(alloc) + ' it paid toward earlier periods is removed and those periods are owed again.' : '') + (recov > 0.005 ? ' The ' + self._money(recov) + ' it recovered from earlier overpayments is undone and those overpayments are open again.' : '') + ' This does not reverse any money already sent.');
            if (!ok) return;
            await self._deleteRun(r);
        });
    },

    async _deleteRun(r) {
        const self = this;
        try {
            await self._api('/api/payroll_runs/' + encodeURIComponent(r.id), { method: 'DELETE' });
        } catch (e) {
            Utils.showToast('Could not delete: ' + e.message, 'error');
            return;
        }
        const failed = await self._reverseDeductions(r.lines || [], r.id);
        if (window.AppData && AppData.addAuditLog) AppData.addAuditLog(self._actor(), 'Pay Run Deleted', r.periodStart + ' to ' + r.periodEnd);
        try { await self._load(); } catch (e) { /* ignore */ }
        if (failed.length) Utils.showToast('Run deleted, but these deductions did not reopen: ' + failed.join(', '), 'error');
        else Utils.showToast('Pay run deleted');
        self._view = 'list';
        self._renderContent();
    },

    // ── employees: pay history per person across every period ────────────────
    // Built from the recorded runs only, so it always agrees with the Pay Runs tab
    // to the cent. One entry per employee who appears on at least one run line.
    // Net is what they earned over their periods; paid is every dollar that went out
    // to them on any run; owed is the sum of their periods still open.
    _employeeHistory() {
        const self = this;
        const by = {};
        (self._runs || []).forEach(function(r) {
            (Array.isArray(r.lines) ? r.lines : []).forEach(function(l) {
                const wid = String(l.workerId || '');
                if (!by[wid]) {
                    const w = AppData.getWorker(wid);
                    by[wid] = { workerId: wid, workerName: (w && w.name) || l.workerName || wid || 'Unknown', runs: 0, hours: 0, gross: 0, deductions: 0, net: 0, paid: 0, unsettled: 0, overpaid: 0, firstPaid: '', lastPaid: '', entries: [] };
                }
                const e = by[wid];
                const sl = self._savedLine(r, l);
                const p = self._period(r.id, wid);
                const hrs = self._num(l.hours) || self._lineHours(l);
                const gross = self._num(l.gross), ded = self._num(l.deductionTotal), net = sl.net;
                e.runs += 1;
                e.hours = self._round2(e.hours + hrs); e.gross = self._round2(e.gross + gross);
                e.deductions = self._round2(e.deductions + ded); e.net = self._round2(e.net + net);
                e.paid = self._round2(e.paid + sl.paid);
                const paid = String(r.paidDate || '').slice(0, 10);
                if (paid && (!e.firstPaid || paid < e.firstPaid)) e.firstPaid = paid;
                if (paid && (!e.lastPaid || paid > e.lastPaid)) e.lastPaid = paid;
                e.entries.push({
                    runId: r.id, periodStart: r.periodStart, periodEnd: r.periodEnd, paidDate: r.paidDate,
                    method: r.method || '', reference: r.reference || '',
                    hours: hrs, regularHours: self._num(l.regularHours), otHours: self._num(l.otHours), dtHours: self._num(l.dtHours),
                    rate: self._num(l.rate), gross: gross, deductionTotal: ded, net: net,
                    ownPaid: sl.ownPaid, paid: sl.paid, shortfall: sl.shortfall, overpaid: sl.overpaid, shortReason: sl.shortReason, adjustReason: sl.adjustReason,
                    allocations: sl.allocations, allocationsTotal: sl.allocationsTotal, allocationsPaid: sl.allocationsPaid, allocationsRecovered: sl.allocationsRecovered,
                    period: p,
                    deductions: Array.isArray(l.deductions) ? l.deductions : [],
                    days: Array.isArray(l.days) ? l.days : []
                });
            });
        });
        const list = Object.keys(by).map(function(k) { return by[k]; });
        list.forEach(function(e) {
            e.unsettled = self._owedTotal(e.workerId);
            e.overpaid = self._overpaidTotal(e.workerId);
            e.entries.sort(function(a, b) {
                return String(b.periodEnd || '').localeCompare(String(a.periodEnd || '')) || String(b.paidDate || '').localeCompare(String(a.paidDate || ''));
            });
        });
        list.sort(function(a, b) { return a.workerName.localeCompare(b.workerName); });
        return list;
    },

    _owingFor(workerId) {
        const self = this;
        return self._round2(self._openDeductions(workerId).reduce(function(s, d) { return s + self._remaining(d); }, 0));
    },

    _renderEmployees(el) {
        const self = this;
        const hist = self._employeeHistory();
        const workers = (AppData.getWorkers ? AppData.getWorkers() : []).slice().sort(function(a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
        // every current worker, plus anyone on a run who is no longer on the crew list
        const options = workers.map(function(w) { return { id: String(w.id), name: w.name }; });
        hist.forEach(function(e) { if (!options.some(function(o) { return o.id === e.workerId; })) options.push({ id: e.workerId, name: e.workerName }); });
        options.sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); });

        let html = '<div class="card" style="padding:10px 14px"><div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">' +
            '<div class="form-group" style="margin:0;min-width:200px"><label style="font-size:.78rem">Employee</label><select class="form-control" id="payEmpSelect"><option value="">All employees, one line each</option>' +
                options.map(function(o) { return '<option value="' + Utils.escapeHtml(o.id) + '"' + (o.id === String(self._empId) ? ' selected' : '') + '>' + Utils.escapeHtml(o.name) + '</option>'; }).join('') +
            '</select></div></div></div>';

        if (!self._empId) html += self._employeeSummaryHtml(hist);
        else html += self._employeeStatementHtml(hist.find(function(e) { return e.workerId === String(self._empId); }) || null);
        el.innerHTML = html;

        el.querySelector('#payEmpSelect').addEventListener('change', function(e) { self._empId = e.target.value; self._renderContent(); });
        el.querySelectorAll('.pay-emp-open').forEach(function(b) {
            b.addEventListener('click', function() { self._empId = b.dataset.wid; self._renderContent(); });
        });
        el.querySelectorAll('.pay-emp-run').forEach(function(b) {
            b.addEventListener('click', function() { self._detailId = b.dataset.run; self._view = 'detail'; self._renderContent(); });
        });
    },

    _employeeSummaryHtml(hist) {
        const self = this;
        if (hist.length === 0) {
            return '<div class="card"><div class="empty"><h3>Nobody has been paid yet</h3><p>Once a pay run is recorded, every employee on it gets a line here with everything they have been paid across all runs.</p></div></div>';
        }
        let tH = 0, tG = 0, tD = 0, tN = 0, tP = 0, tU = 0;
        const rows = hist.map(function(e) {
            tH += e.hours; tG += e.gross; tD += e.deductions; tN += e.net; tP += e.paid; tU += e.unsettled;
            const owing = self._owingFor(e.workerId);
            const open = self._owedPeriodsFor(e.workerId);
            const overs = self._overpaidPeriodsFor(e.workerId);
            const oldest = open.length ? open[0] : null;
            return '<tr class="pay-emp-row" data-wid="' + Utils.escapeHtml(e.workerId) + '">' +
                '<td><strong>' + Utils.escapeHtml(e.workerName) + '</strong>' + (owing ? '<div style="font-size:.75rem;color:#b8860b">' + self._money(owing) + ' still owing</div>' : '') +
                    (oldest ? '<div class="pay-emp-unsettled" style="font-size:.75rem;color:#b8860b">' + self._money(e.unsettled) + ' unsettled, owed to them since ' + Utils.escapeHtml(self._dayDate(oldest.since)) + (open.length > 1 ? ' over ' + open.length + ' periods' : '') + '</div>' : '') +
                    (overs.length ? '<div class="pay-emp-overpaid" style="font-size:.75rem;color:#b8860b">' + self._money(e.overpaid) + ' overpaid on ' + Utils.escapeHtml(self._dayDate(overs[0].since)) + (overs.length > 1 ? ' and ' + (overs.length - 1) + ' more' : '') + ', comes off their next pay</div>' : '') + '</td>' +
                '<td class="amount">' + e.runs + '</td>' +
                '<td class="amount">' + e.hours.toFixed(2) + '</td>' +
                '<td class="amount">' + self._money(e.gross) + '</td>' +
                '<td class="amount">' + (e.deductions ? '-' + self._money(e.deductions) : '—') + '</td>' +
                '<td class="amount">' + self._money(e.net) + '</td>' +
                '<td class="amount"><strong>' + self._money(e.paid) + '</strong></td>' +
                '<td style="white-space:nowrap;font-size:.85rem">' + Utils.escapeHtml(self._dayDate(e.lastPaid)) + '</td>' +
                '<td style="white-space:nowrap"><button class="btn-secondary btn-sm pay-emp-open" data-wid="' + Utils.escapeHtml(e.workerId) + '">View</button></td>' +
            '</tr>';
        }).join('');
        return '<div class="card" style="overflow-x:auto"><table>' +
            '<thead><tr><th>Employee</th><th class="amount">Pay runs</th><th class="amount">Hours</th><th class="amount">Gross</th><th class="amount">Deductions</th><th class="amount">Net due</th><th class="amount">Net paid</th><th>Last paid</th><th></th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '<tfoot><tr style="font-weight:600"><td>Total, ' + hist.length + ' employee' + (hist.length === 1 ? '' : 's') + (tU > 0.005 ? '<div style="font-size:.75rem;color:#b8860b;font-weight:400">' + self._money(self._round2(tU)) + ' unsettled in total</div>' : '') + '</td><td></td><td class="amount">' + self._round2(tH).toFixed(2) + '</td><td class="amount">' + self._money(tG) + '</td><td class="amount">' + (tD ? '-' + self._money(tD) : '') + '</td><td class="amount">' + self._money(tN) + '</td><td class="amount">' + self._money(tP) + '</td><td></td><td></td></tr></tfoot>' +
            '</table></div>';
    },

    _employeeStatementHtml(e) {
        const self = this;
        const name = e ? e.workerName : self._workerName(self._empId);
        const owing = self._owingFor(self._empId);
        const openDeds = self._openDeductions(self._empId);
        const open = self._owedPeriodsFor(self._empId);
        const overs = self._overpaidPeriodsFor(self._empId);
        let html = '<div class="card" id="payEmpStatement" style="font-size:.9rem">' +
            '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline">' +
                '<strong style="font-size:1.1rem">' + Utils.escapeHtml(name) + ', pay history</strong>' +
                (e ? '<span>' + e.runs + ' pay run' + (e.runs === 1 ? '' : 's') + ', ' + Utils.escapeHtml(self._dayDate(e.firstPaid)) + (e.firstPaid !== e.lastPaid ? ' to ' + Utils.escapeHtml(self._dayDate(e.lastPaid)) : '') + '</span>' : '') +
            '</div>';
        if (e) {
            html += '<div style="margin-top:6px"><strong>' + e.hours.toFixed(2) + ' hours</strong>, gross ' + self._money(e.gross) + (e.deductions ? ' &minus; deductions ' + self._money(e.deductions) : '') +
                (Math.abs(e.paid - e.net) < 0.005 && !e.unsettled
                    ? ' = <strong>' + self._money(e.net) + ' net paid</strong>'
                    : ' = ' + self._money(e.net) + ' net due, <strong>' + self._money(e.paid) + ' paid</strong>') + '</div>';
            if (open.length) {
                html += '<div class="pay-emp-unsettled" style="margin-top:6px;color:#b8860b"><strong>' + self._money(e.unsettled) + ' unsettled, owed to ' + Utils.escapeHtml(name) + '</strong>: ' +
                    open.map(function(p) { return Utils.escapeHtml(self._owedLabel(p)); }).join('; ') + '. Each period is listed below with its own box the next time you record a run for a later period.</div>';
            }
            if (overs.length) {
                html += '<div class="pay-emp-overpaid" style="margin-top:6px;color:#b8860b"><strong>' + self._money(e.overpaid) + ' overpaid to ' + Utils.escapeHtml(name) + '</strong>: ' +
                    overs.map(function(p) { return Utils.escapeHtml(self._owedLabel(p)); }).join('; ') + '. It comes off their next pay run, with its own box under their name.</div>';
            }
        }
        if (owing) {
            html += '<div style="margin-top:6px;color:#b8860b">' + self._money(owing) + ' still owing: ' + openDeds.map(function(d) { return Utils.escapeHtml(d.description || d.type || 'Deduction') + ' ' + self._money(self._remaining(d)); }).join(', ') + '</div>';
        }
        html += '</div>';

        if (!e) {
            html += '<div class="card"><div class="empty"><h3>No pay recorded for ' + Utils.escapeHtml(name) + '</h3><p>They have not been on any pay run yet.' + (owing ? ' Their open deductions are listed above and will come off their first run.' : '') + '</p></div></div>';
            return html;
        }
        const rows = e.entries.map(function(x) {
            const p = x.period;
            const breakdown = (x.otHours || x.dtHours) ? '<div style="font-size:.75rem;color:var(--text2)">' + x.regularHours + ' reg' + (x.otHours ? ' + ' + x.otHours + ' OT' : '') + (x.dtHours ? ' + ' + x.dtHours + ' DT' : '') + '</div>' : '';
            const dedTxt = x.deductions.length ? '<div style="font-size:.75rem;color:var(--text2)">' + x.deductions.map(function(d) { return Utils.escapeHtml(d.description || d.type || 'Deduction') + ' ' + self._money(d.amount); }).join(', ') + '</div>' : '';
            const allocTxt = x.allocations.length ? '<div class="pay-emp-alloc" style="font-size:.75rem;color:var(--text2)">' + x.allocations.map(function(a) { return (a.amount < 0 ? 'less ' + self._money(-a.amount) + ' recovered from ' : 'incl. ' + self._money(a.amount) + ' toward ') + (a.orphan ? 'a deleted period' : Utils.escapeHtml(self._dayDate(a.periodStart)) + ' to ' + Utils.escapeHtml(self._dayDate(a.periodEnd))); }).join(', ') + '</div>' : '';
            const payTxt = p && p.received.length ? '<div class="pay-emp-received" style="font-size:.75rem;color:var(--text2)">' + p.received.map(function(y) { return (y.amount < 0 ? '&minus; ' + self._money(-y.amount) + ' recovered on ' : '+ ' + self._money(y.amount) + ' on ') + Utils.escapeHtml(self._dayDate(y.paidDate)); }).join(', ') + ' from later runs</div>' : '';
            const statusTxt = p && x.net > 0.005 ? '<div class="pay-emp-status" style="font-size:.75rem">' + self._statusHtml(p) + '</div>' : '';
            return '<tr class="pay-emp-entry" data-run="' + Utils.escapeHtml(x.runId) + '">' +
                '<td style="white-space:nowrap">' + Utils.escapeHtml(self._dayDate(x.periodStart)) + ' to ' + Utils.escapeHtml(self._dayDate(x.periodEnd)) + '</td>' +
                '<td style="white-space:nowrap;font-size:.85rem">' + Utils.escapeHtml(self._dayDate(x.paidDate)) + (x.method ? '<br><span style="color:var(--text2)">' + Utils.escapeHtml(x.method) + (x.reference ? ', ' + Utils.escapeHtml(x.reference) : '') + '</span>' : '') + '</td>' +
                '<td class="amount">' + self._num(x.hours).toFixed(2) + breakdown + '</td>' +
                '<td class="amount">' + self._money(x.rate) + '</td>' +
                '<td class="amount">' + self._money(x.gross) + '</td>' +
                '<td class="amount">' + (x.deductionTotal ? '-' + self._money(x.deductionTotal) : '—') + dedTxt + '</td>' +
                '<td class="amount">' + self._money(x.net) + statusTxt + '</td>' +
                '<td class="amount"><strong>' + self._money(x.paid) + '</strong>' + allocTxt + payTxt + '</td>' +
                '<td style="white-space:nowrap"><button class="btn-secondary btn-sm pay-emp-run" data-run="' + Utils.escapeHtml(x.runId) + '" style="font-size:.75rem;padding:3px 10px">Run</button></td>' +
            '</tr>';
        }).join('');
        html += '<div class="card" style="overflow-x:auto"><table>' +
            '<thead><tr><th>Period</th><th>Paid</th><th class="amount">Hours</th><th class="amount">Rate</th><th class="amount">Gross</th><th class="amount">Deductions</th><th class="amount">Net</th><th class="amount">Paid</th><th></th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '<tfoot><tr style="font-weight:600"><td>Total</td><td></td><td class="amount">' + e.hours.toFixed(2) + '</td><td></td><td class="amount">' + self._money(e.gross) + '</td><td class="amount">' + (e.deductions ? '-' + self._money(e.deductions) : '') + '</td><td class="amount">' + self._money(e.net) + '</td><td class="amount">' + self._money(e.paid) + (e.unsettled ? '<div style="font-size:.75rem;color:#b8860b;font-weight:400">' + self._money(e.unsettled) + ' unsettled</div>' : '') + '</td><td></td></tr></tfoot>' +
            '</table></div>';
        return html;
    },
    // ── deductions ───────────────────────────────────────────────────────────
    _renderDeductions(el) {
        const self = this;
        const f = self._dedFilter;
        const workers = (AppData.getWorkers ? AppData.getWorkers() : []).slice().sort(function(a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
        let items = self._deductions.slice();
        if (f.workerId) items = items.filter(function(d) { return String(d.workerId) === String(f.workerId); });
        if (f.status === 'open') items = items.filter(function(d) { return d.status !== 'applied'; });
        if (f.status === 'applied') items = items.filter(function(d) { return d.status === 'applied'; });
        items.sort(function(a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });

        const owing = {};
        self._deductions.forEach(function(d) { if (d.status !== 'applied') owing[d.workerId] = self._round2((owing[d.workerId] || 0) + self._remaining(d)); });
        const owingHtml = Object.keys(owing).filter(function(k) { return owing[k] > 0; }).map(function(k) {
            return '<span style="display:inline-block;padding:3px 10px;border-radius:12px;background:rgba(243,156,18,.15);font-size:.82rem;margin:2px">' + Utils.escapeHtml(self._workerName(k)) + ': ' + self._money(owing[k]) + '</span>';
        }).join('');

        el.innerHTML = '<div class="card" style="padding:10px 14px"><div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">' +
            '<div class="form-group" style="margin:0;min-width:180px"><label style="font-size:.78rem">Employee</label><select class="form-control" id="dedFilterWorker"><option value="">All employees</option>' +
                workers.map(function(w) { return '<option value="' + Utils.escapeHtml(w.id) + '"' + (String(w.id) === String(f.workerId) ? ' selected' : '') + '>' + Utils.escapeHtml(w.name) + '</option>'; }).join('') + '</select></div>' +
            '<div class="form-group" style="margin:0"><label style="font-size:.78rem">Show</label><select class="form-control" id="dedFilterStatus">' +
                ['open', 'applied', 'all'].map(function(s) { return '<option value="' + s + '"' + (f.status === s ? ' selected' : '') + '>' + (s === 'open' ? 'Still owing' : s === 'applied' ? 'Fully recovered' : 'All') + '</option>'; }).join('') + '</select></div>' +
            '</div>' + (owingHtml ? '<div style="margin-top:8px"><span style="font-size:.78rem;color:var(--text2)">Owing:</span> ' + owingHtml + '</div>' : '') + '</div>' +
            '<div class="card" id="dedOwingNote" style="border-left:3px solid var(--primary,#2d6cdf);font-size:.88rem">' +
                '<strong>What Owing means.</strong> A deduction is money an employee has to pay back to the company: something bought for them, a cost they caused, an advance. ' +
                '<strong>Owing</strong> is how much of it they still have to pay back: the amount of the deduction less what has already been <strong>recovered</strong> off their pay runs. ' +
                'It is not money the company owes them. It comes off their next pay run automatically, in full or in part as you choose on the run, until Owing reaches zero and the deduction shows as Recovered.' +
            '</div>' +
            (items.length === 0
                ? '<div class="card"><div class="empty"><h3>No deductions</h3><p>Record anything an employee owes back: a purchase you made for them, a cost they caused, an advance. It is taken off their next pay run.</p></div></div>'
                : '<div class="card"><table><thead><tr><th>Date</th><th>Employee</th><th>Type</th><th>Description</th><th class="amount">Amount</th><th class="amount" title="Already taken off their pay runs">Recovered</th><th class="amount" title="Still to be paid back: amount less recovered">Owing</th><th>Status</th><th></th></tr></thead><tbody>' +
                    items.map(function(d) {
                        const rem = self._remaining(d);
                        const st = d.status === 'applied' ? '<span style="font-size:.75rem;padding:2px 8px;border-radius:12px;background:rgba(46,204,113,.2);color:var(--success)">Recovered</span>' : '<span style="font-size:.75rem;padding:2px 8px;border-radius:12px;background:rgba(243,156,18,.2);color:#b8860b">Open</span>';
                        const canDelete = self._num(d.recovered) === 0;
                        return '<tr>' +
                            '<td style="white-space:nowrap">' + Utils.escapeHtml(self._dayDate(d.date)) + '</td>' +
                            '<td>' + Utils.escapeHtml(self._workerName(d.workerId)) + '</td>' +
                            '<td style="font-size:.85rem">' + Utils.escapeHtml(d.type || '') + '</td>' +
                            '<td>' + Utils.escapeHtml(d.description || '') + (d.notes ? '<br><span style="font-size:.78rem;color:var(--text2)">' + Utils.escapeHtml(d.notes) + '</span>' : '') + '</td>' +
                            '<td class="amount">' + self._money(d.amount) + '</td>' +
                            '<td class="amount">' + (self._num(d.recovered) ? self._money(d.recovered) : '—') + '</td>' +
                            '<td class="amount"><strong>' + self._money(rem) + '</strong></td>' +
                            '<td>' + st + '</td>' +
                            '<td style="white-space:nowrap">' +
                                '<button class="btn-secondary btn-sm ded-edit-btn" data-id="' + Utils.escapeHtml(d.id) + '" style="font-size:.75rem;padding:3px 10px">Edit</button> ' +
                                (canDelete ? '<button class="btn-secondary btn-sm ded-del-btn" data-id="' + Utils.escapeHtml(d.id) + '" style="font-size:.75rem;padding:3px 10px;color:var(--accent)">Delete</button>' : '') +
                            '</td></tr>';
                    }).join('') + '</tbody></table></div>');

        el.querySelector('#dedFilterWorker').addEventListener('change', function(e) { f.workerId = e.target.value; self._renderContent(); });
        el.querySelector('#dedFilterStatus').addEventListener('change', function(e) { f.status = e.target.value; self._renderContent(); });
        el.querySelectorAll('.ded-edit-btn').forEach(function(b) { b.addEventListener('click', function() { self._showDeductionModal(b.dataset.id); }); });
        el.querySelectorAll('.ded-del-btn').forEach(function(b) {
            b.addEventListener('click', async function() {
                const d = self._deductions.find(function(x) { return x.id === b.dataset.id; });
                if (!d) return;
                const ok = await Utils.confirm('Delete the ' + self._money(d.amount) + ' deduction for ' + self._workerName(d.workerId) + '?');
                if (!ok) return;
                try { await self._api('/api/payroll_deductions/' + encodeURIComponent(d.id), { method: 'DELETE' }); }
                catch (e) { Utils.showToast('Could not delete: ' + e.message, 'error'); return; }
                await self._load();
                Utils.showToast('Deduction deleted');
                self._renderContent();
            });
        });
    },

    _showDeductionModal(id) {
        const self = this;
        const existing = id ? self._deductions.find(function(x) { return x.id === id; }) : null;
        const locked = existing && self._num(existing.recovered) > 0;
        const workers = (AppData.getWorkers ? AppData.getWorkers() : []).slice().sort(function(a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
        const projects = (AppData.getProjects ? AppData.getProjects() : []).slice().sort(function(a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
        const body = `
            <div class="form-group"><label>Employee</label><select class="form-control" id="dedWorker"${locked ? ' disabled' : ''}>
                <option value="">Select employee…</option>
                ${workers.map(function(w) { return '<option value="' + Utils.escapeHtml(w.id) + '"' + (existing && String(existing.workerId) === String(w.id) ? ' selected' : '') + '>' + Utils.escapeHtml(w.name) + '</option>'; }).join('')}
            </select></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
                <div class="form-group" style="flex:1"><label>Date</label><input type="date" class="form-control" id="dedDate" value="${Utils.escapeHtml(existing ? existing.date : self._localDate())}"></div>
                <div class="form-group" style="flex:1"><label>Amount</label><input type="number" step="0.01" min="0" class="form-control" id="dedAmount" value="${existing ? self._num(existing.amount) : ''}"${locked ? ' disabled' : ''}></div>
            </div>
            <div class="form-group"><label>Type</label><select class="form-control" id="dedType">
                ${self.DEDUCTION_TYPES.map(function(t) { return '<option' + (existing && existing.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('')}
            </select></div>
            <div class="form-group"><label>Description</label><input type="text" class="form-control" id="dedDesc" value="${Utils.escapeHtml(existing ? (existing.description || '') : '')}" placeholder="e.g. Work boots from Mark's, or Broken tailgate on the F-150"></div>
            <div class="form-group"><label>Project (optional)</label><select class="form-control" id="dedProject"><option value="">None</option>
                ${projects.map(function(p) { return '<option value="' + Utils.escapeHtml(p.id) + '"' + (existing && existing.projectId === p.id ? ' selected' : '') + '>' + Utils.escapeHtml(p.name) + '</option>'; }).join('')}
            </select></div>
            <div class="form-group"><label>Notes (optional)</label><textarea class="form-control" id="dedNotes" rows="2">${Utils.escapeHtml(existing ? (existing.notes || '') : '')}</textarea></div>
            ${locked ? '<p style="font-size:.8rem;color:var(--text2)">Employee and amount are locked because part of this has already been taken off a pay run (' + self._money(existing.recovered) + ' so far).</p>' : ''}
        `;
        const modal = UI.modal(existing ? 'Edit Deduction' : 'Add Deduction', body, { width: '520px', submitLabel: existing ? 'Save' : 'Add Deduction' });
        const q = function(s) { return modal.q(s); };
        modal.submitBtn.addEventListener('click', async function() {
            const workerId = existing && locked ? existing.workerId : q('#dedWorker').value;
            const amount = existing && locked ? self._num(existing.amount) : self._round2(self._num(q('#dedAmount').value));
            const date = q('#dedDate').value;
            const description = q('#dedDesc').value.trim();
            if (!workerId) { Utils.showToast('Pick the employee', 'error'); return; }
            if (!(amount > 0)) { Utils.showToast('Enter an amount above zero', 'error'); return; }
            if (!date) { Utils.showToast('Enter the date', 'error'); return; }
            if (!description) { Utils.showToast('Say what it is for', 'error'); return; }
            const rec = Object.assign({}, existing || {}, {
                id: existing ? existing.id : AppData.generateId(),
                workerId: workerId, date: date, amount: amount,
                type: q('#dedType').value, description: description,
                projectId: q('#dedProject').value || '', notes: q('#dedNotes').value.trim(),
                recovered: existing ? self._num(existing.recovered) : 0,
                applications: existing && Array.isArray(existing.applications) ? existing.applications : [],
                createdBy: existing ? (existing.createdBy || self._actor()) : self._actor(),
                createdAt: existing ? (existing.createdAt || new Date().toISOString()) : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            rec.status = rec.recovered >= rec.amount - 0.005 ? 'applied' : 'open';
            const restore = UI.btnLoading ? UI.btnLoading(modal.submitBtn, 'Saving…') : function() {};
            try {
                await self._api('/api/payroll_deductions', { method: 'POST', body: JSON.stringify(rec) });
            } catch (e) {
                restore();
                Utils.showToast('Not saved: ' + e.message, 'error');
                return;
            }
            if (window.AppData && AppData.addAuditLog) AppData.addAuditLog(self._actor(), existing ? 'Deduction Updated' : 'Deduction Added', self._workerName(workerId) + ' — ' + self._money(amount) + ' ' + description);
            modal.close();
            await self._load();
            Utils.showToast(existing ? 'Deduction saved' : 'Deduction added');
            self._tab = 'deductions';
            self._renderContent();
        });
    }
};
