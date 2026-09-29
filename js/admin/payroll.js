// Admin Payroll — record pay runs and employee deductions.
//
// A pay run is a record of what was paid for a period: approved hours per employee
// at their pay rate, less any deductions applied that period, and how it was paid.
// A deduction is money owed back by an employee (a purchase made for them, a cost
// they caused, an advance). It stays open until it has been recovered through one
// or more pay runs.
//
// Storage: generic entities 'payroll_runs' and 'payroll_deductions' on the server.
// Both are admin-only on the backend (workers and supervisors get 403).
window.AdminPayroll = {
    _tab: 'runs',          // 'runs' | 'deductions'
    _view: 'list',         // 'list' | 'new' | 'detail'
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
        if (self._view === 'new') return self._renderNewRun();
        if (self._view === 'detail') return self._renderRunDetail();

        const openDed = self._deductions.filter(function(d) { return d.status !== 'applied' && self._remaining(d) > 0.005; });
        c.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:20px">
                <h2 style="margin:0">Payroll</h2>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    ${self._tab === 'runs'
                        ? '<button class="btn-primary btn-sm" id="payNewRunBtn">+ New Pay Run</button>'
                        : '<button class="btn-primary btn-sm" id="payAddDedBtn">+ Add Deduction</button>'}
                </div>
            </div>
            <div class="tabs" style="margin-bottom:16px">
                <button class="tab-btn ${self._tab === 'runs' ? 'active' : ''}" data-tab="runs">Pay Runs (${self._runs.length})</button>
                <button class="tab-btn ${self._tab === 'deductions' ? 'active' : ''}" data-tab="deductions">Deductions ${openDed.length ? '<span class="badge-gold" style="margin-left:6px">' + openDed.length + ' open</span>' : ''}</button>
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

        const el = c.querySelector('#payrollContent');
        if (self._tab === 'runs') self._renderRunsList(el);
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
            '<thead><tr><th>Period</th><th>Employees</th><th class="amount">Hours</th><th class="amount">Gross</th><th class="amount">Deductions</th><th class="amount">Net paid</th><th>Paid</th><th></th></tr></thead><tbody>' +
            runs.map(function(r) {
                const t = r.totals || {};
                const lines = Array.isArray(r.lines) ? r.lines : [];
                return '<tr>' +
                    '<td style="white-space:nowrap">' + Utils.escapeHtml(self._dayDate(r.periodStart)) + ' to ' + Utils.escapeHtml(self._dayDate(r.periodEnd)) + '</td>' +
                    '<td>' + Utils.escapeHtml(lines.map(function(l) { return l.workerName; }).join(', ')) + '</td>' +
                    '<td class="amount">' + self._num(t.hours).toFixed(2) + '</td>' +
                    '<td class="amount">' + self._money(t.gross) + '</td>' +
                    '<td class="amount">' + (self._num(t.deductions) ? '-' + self._money(t.deductions) : '—') + '</td>' +
                    '<td class="amount"><strong>' + self._money(t.net) + '</strong></td>' +
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
            periodStart: wk.from, periodEnd: wk.to,
            paidDate: self._localDate(), method: 'E-transfer', reference: '', notes: '',
            lines: null, pendingCount: 0, alreadyPaid: 0
        };
        self._view = 'new';
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
        d.alreadyPaid = approved.filter(function(tc) { return paid[String(tc.id)]; }).length;

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
                    deductions: []
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
        const lines = Object.keys(byWorker).map(function(k) { return byWorker[k]; });
        lines.sort(function(a, b) { return a.workerName.localeCompare(b.workerName); });
        lines.forEach(function(l) {
            l.days.sort(function(a, b) { return a.date.localeCompare(b.date); });
            l.deductions = self._openDeductions(l.workerId).map(function(dd) {
                return { deductionId: dd.id, description: dd.description || dd.type || 'Deduction', type: dd.type || '', remaining: self._remaining(dd), amount: self._remaining(dd), apply: true };
            });
        });
        d.lines = lines;
        self._renderContent();
    },

    _lineGross(l) {
        const r = this._num(l.rate);
        return this._round2(this._num(l.regularHours) * r + this._num(l.otHours) * r * 1.5 + this._num(l.dtHours) * r * 2);
    },
    _lineDeductions(l) {
        const self = this;
        return self._round2((l.deductions || []).reduce(function(s, d) { return s + (d.apply ? self._num(d.amount) : 0); }, 0));
    },
    _lineHours(l) { return this._round2(this._num(l.regularHours) + this._num(l.otHours) + this._num(l.dtHours)); },

    _renderNewRun() {
        const self = this;
        const c = self._container;
        const d = self._draft;
        const lines = d.lines;

        let tableHtml = '';
        if (lines === null) {
            tableHtml = '<div class="card"><div class="empty"><h3>Pick the period, then load hours</h3><p>Approved timecards inside the period come in grouped by employee at their pay rate on file.</p></div></div>';
        } else if (lines.length === 0) {
            tableHtml = '<div class="card"><div class="empty"><h3>No approved hours in this period</h3><p>' +
                (d.pendingCount ? d.pendingCount + ' timecard' + (d.pendingCount === 1 ? '' : 's') + ' in this period still pending approval. Approve them first, then reload.' : 'Nothing approved between these dates.') +
                (d.alreadyPaid ? ' ' + d.alreadyPaid + ' already paid in an earlier run.' : '') + '</p></div></div>';
        } else {
            let totHours = 0, totGross = 0, totDed = 0;
            tableHtml = '<div class="card" style="overflow-x:auto"><table>' +
                '<thead><tr><th>Employee</th><th class="amount">Hours</th><th class="amount">Rate</th><th class="amount">Gross</th><th>Deductions this run</th><th class="amount">Net</th></tr></thead><tbody>' +
                lines.map(function(l, i) {
                    const hrs = self._lineHours(l), gross = self._lineGross(l), ded = self._lineDeductions(l), net = self._round2(gross - ded);
                    totHours += hrs; totGross += gross; totDed += ded;
                    const breakdown = (l.otHours || l.dtHours) ? '<div style="font-size:.75rem;color:var(--text2)">' + l.regularHours + ' reg' + (l.otHours ? ' + ' + l.otHours + ' OT x1.5' : '') + (l.dtHours ? ' + ' + l.dtHours + ' DT x2' : '') + '</div>' : '';
                    const daysHtml = '<div style="font-size:.75rem;color:var(--text2);margin-top:4px">' + l.days.map(function(dd) { return Utils.escapeHtml(self._dayDate(dd.date)) + ' ' + dd.hours + 'h'; }).join(' · ') + '</div>';
                    const dedHtml = (l.deductions.length === 0)
                        ? '<span style="color:var(--text2);font-size:.85rem">None open</span>'
                        : l.deductions.map(function(dd, j) {
                            return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;font-size:.85rem">' +
                                '<input type="checkbox" class="pay-ded-apply" data-i="' + i + '" data-j="' + j + '"' + (dd.apply ? ' checked' : '') + '>' +
                                '<input type="number" step="0.01" min="0" max="' + dd.remaining + '" class="form-control pay-ded-amt" data-i="' + i + '" data-j="' + j + '" value="' + dd.amount + '" style="width:96px;padding:3px 6px"' + (dd.apply ? '' : ' disabled') + '>' +
                                '<span title="' + Utils.escapeHtml(dd.type) + '">' + Utils.escapeHtml(dd.description) + ' <span style="color:var(--text2)">(' + self._money(dd.remaining) + ' owing)</span></span>' +
                            '</div>';
                        }).join('');
                    const rateWarn = self._num(l.rate) > 0 ? '' : '<div style="font-size:.72rem;color:var(--accent)">No pay rate on file</div>';
                    return '<tr>' +
                        '<td><strong>' + Utils.escapeHtml(l.workerName) + '</strong>' + daysHtml + '</td>' +
                        '<td class="amount">' + hrs.toFixed(2) + breakdown + '</td>' +
                        '<td class="amount"><input type="number" step="0.01" min="0" class="form-control pay-rate" data-i="' + i + '" value="' + self._num(l.rate) + '" style="width:90px;padding:3px 6px;text-align:right">' + rateWarn + '</td>' +
                        '<td class="amount">' + self._money(gross) + '</td>' +
                        '<td>' + dedHtml + '</td>' +
                        '<td class="amount"><strong>' + self._money(net) + '</strong></td>' +
                    '</tr>';
                }).join('') +
                '</tbody><tfoot><tr style="font-weight:600"><td>Total</td><td class="amount">' + self._round2(totHours).toFixed(2) + '</td><td></td><td class="amount">' + self._money(totGross) + '</td><td class="amount">' + (totDed ? '-' + self._money(totDed) : '') + '</td><td class="amount">' + self._money(totGross - totDed) + '</td></tr></tfoot></table></div>';
            const notes = [];
            if (d.pendingCount) notes.push(d.pendingCount + ' timecard' + (d.pendingCount === 1 ? '' : 's') + ' in this period still pending approval and not included.');
            if (d.alreadyPaid) notes.push(d.alreadyPaid + ' approved timecard' + (d.alreadyPaid === 1 ? '' : 's') + ' already paid in an earlier run, left out.');
            if (notes.length) tableHtml += '<div class="card" style="border-left:3px solid var(--warn,#f39c12);font-size:.88rem">' + notes.map(Utils.escapeHtml).join('<br>') + '</div>';
        }

        c.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:20px">
                <h2 style="margin:0">New Pay Run</h2>
                <button class="btn-secondary btn-sm" id="payBackBtn">Back</button>
            </div>
            <div class="card" style="padding:12px 14px">
                <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
                    <div class="form-group" style="margin:0"><label style="font-size:.78rem">Period start</label><input type="date" class="form-control" id="payFrom" value="${Utils.escapeHtml(d.periodStart)}"></div>
                    <div class="form-group" style="margin:0"><label style="font-size:.78rem">Period end</label><input type="date" class="form-control" id="payTo" value="${Utils.escapeHtml(d.periodEnd)}"></div>
                    <button class="btn-primary btn-sm" id="payLoadBtn" type="button">${lines === null ? 'Load approved hours' : 'Reload hours'}</button>
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
                <div style="margin-top:12px;display:flex;justify-content:flex-end"><button class="btn-primary" id="payRecordBtn" type="button">Record Pay Run</button></div>
            </div>` : ''}
        `;

        c.querySelector('#payBackBtn').addEventListener('click', function() { self._view = 'list'; self._draft = null; self._renderContent(); });
        c.querySelector('#payFrom').addEventListener('change', function(e) { d.periodStart = e.target.value; });
        c.querySelector('#payTo').addEventListener('change', function(e) { d.periodEnd = e.target.value; });
        c.querySelector('#payLoadBtn').addEventListener('click', function() {
            const restore = UI.btnLoading ? UI.btnLoading(c.querySelector('#payLoadBtn'), 'Loading…') : function() {};
            self._loadHours().finally(restore);
        });
        c.querySelectorAll('.pay-rate').forEach(function(inp) {
            inp.addEventListener('change', function() { lines[+inp.dataset.i].rate = self._num(inp.value); self._renderContent(); });
        });
        c.querySelectorAll('.pay-ded-apply').forEach(function(cb) {
            cb.addEventListener('change', function() { lines[+cb.dataset.i].deductions[+cb.dataset.j].apply = cb.checked; self._renderContent(); });
        });
        c.querySelectorAll('.pay-ded-amt').forEach(function(inp) {
            inp.addEventListener('change', function() {
                const dd = lines[+inp.dataset.i].deductions[+inp.dataset.j];
                let v = self._round2(self._num(inp.value));
                if (v < 0) v = 0;
                if (v > dd.remaining) { v = dd.remaining; Utils.showToast('Capped at the ' + self._money(dd.remaining) + ' still owing', 'error'); }
                dd.amount = v; self._renderContent();
            });
        });
        const paidDate = c.querySelector('#payPaidDate');
        if (paidDate) {
            paidDate.addEventListener('change', function(e) { d.paidDate = e.target.value; });
            c.querySelector('#payMethod').addEventListener('change', function(e) { d.method = e.target.value; });
            c.querySelector('#payRef').addEventListener('input', function(e) { d.reference = e.target.value; });
            c.querySelector('#payNotes').addEventListener('input', function(e) { d.notes = e.target.value; });
            c.querySelector('#payRecordBtn').addEventListener('click', function() { self._recordRun(); });
        }
    },

    async _recordRun() {
        const self = this;
        const d = self._draft;
        const btn = self._container.querySelector('#payRecordBtn');
        if (!d || !d.lines || !d.lines.length) return;
        if (!d.paidDate) { Utils.showToast('Enter the date it was paid', 'error'); return; }
        const zeroRate = d.lines.filter(function(l) { return self._lineHours(l) > 0 && self._num(l.rate) <= 0; });
        if (zeroRate.length) {
            const ok = await Utils.confirm(zeroRate.map(function(l) { return l.workerName; }).join(', ') + ' would be paid at $0 an hour. Record anyway?');
            if (!ok) return;
        }
        const lines = d.lines.map(function(l) {
            const gross = self._lineGross(l), ded = self._lineDeductions(l);
            return {
                workerId: l.workerId, workerName: l.workerName, rate: self._num(l.rate),
                regularHours: l.regularHours, otHours: l.otHours, dtHours: l.dtHours, hours: self._lineHours(l),
                gross: gross, deductionTotal: ded, net: self._round2(gross - ded),
                days: l.days, timecardIds: l.timecardIds,
                deductions: l.deductions.filter(function(x) { return x.apply && self._num(x.amount) > 0; }).map(function(x) {
                    return { deductionId: x.deductionId, description: x.description, type: x.type, amount: self._round2(x.amount) };
                })
            };
        });
        const totals = lines.reduce(function(t, l) {
            t.hours = self._round2(t.hours + l.hours); t.gross = self._round2(t.gross + l.gross);
            t.deductions = self._round2(t.deductions + l.deductionTotal); t.net = self._round2(t.net + l.net); return t;
        }, { hours: 0, gross: 0, deductions: 0, net: 0 });
        const run = {
            id: AppData.generateId(), periodStart: d.periodStart, periodEnd: d.periodEnd,
            paidDate: d.paidDate, method: d.method, reference: d.reference || '', notes: d.notes || '',
            lines: lines, totals: totals, status: 'recorded',
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
        const failed = [];
        for (const l of lines) {
            for (const x of l.deductions) {
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
        if (window.AppData && AppData.addAuditLog) AppData.addAuditLog(self._actor(), 'Pay Run Recorded', d.periodStart + ' to ' + d.periodEnd + ' — net ' + self._money(totals.net));
        try { await self._load(); } catch (e) { /* list refresh only */ }
        restore();
        if (failed.length) Utils.showToast('Pay run recorded, but these deductions did not update: ' + failed.join(', '), 'error');
        else Utils.showToast('Pay run recorded: ' + self._money(totals.net) + ' net');
        self._draft = null; self._detailId = run.id; self._view = 'detail';
        self._renderContent();
    },

    // ── run detail ───────────────────────────────────────────────────────────
    _renderRunDetail() {
        const self = this;
        const c = self._container;
        const r = self._runs.find(function(x) { return x.id === self._detailId; });
        if (!r) { self._view = 'list'; return self._renderContent(); }
        const t = r.totals || {};
        const lines = Array.isArray(r.lines) ? r.lines : [];
        c.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:20px">
                <h2 style="margin:0">Pay Run, ${Utils.escapeHtml(self._dayDate(r.periodStart))} to ${Utils.escapeHtml(self._dayDate(r.periodEnd))}</h2>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn-secondary btn-sm" id="payPrintBtn">Print</button>
                    <button class="btn-secondary btn-sm" id="payDeleteBtn" style="color:var(--accent)">Delete run</button>
                    <button class="btn-secondary btn-sm" id="payBackBtn">Back</button>
                </div>
            </div>
            <div class="card" style="font-size:.9rem">
                <div><strong>Paid on:</strong> ${Utils.escapeHtml(self._dayDate(r.paidDate))} &nbsp;•&nbsp; <strong>Method:</strong> ${Utils.escapeHtml(r.method || '')}${r.reference ? ' &nbsp;•&nbsp; <strong>Ref:</strong> ' + Utils.escapeHtml(r.reference) : ''}</div>
                <div style="color:var(--text2);margin-top:4px">Recorded by ${Utils.escapeHtml(r.createdBy || 'Admin')} on ${Utils.escapeHtml(Utils.formatDate(r.createdAt))}</div>
                ${r.notes ? '<div style="margin-top:6px">' + Utils.escapeHtml(r.notes) + '</div>' : ''}
            </div>
            ${lines.map(function(l) {
                const days = Array.isArray(l.days) ? l.days : [];
                const deds = Array.isArray(l.deductions) ? l.deductions : [];
                return '<div class="card">' +
                    '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:baseline">' +
                        '<strong style="font-size:1.05rem">' + Utils.escapeHtml(l.workerName) + '</strong>' +
                        '<span>' + self._num(l.hours).toFixed(2) + ' h @ ' + self._money(l.rate) + ' = ' + self._money(l.gross) + (l.deductionTotal ? ' &minus; ' + self._money(l.deductionTotal) : '') + ' = <strong>' + self._money(l.net) + ' net</strong></span>' +
                    '</div>' +
                    (days.length ? '<table style="margin-top:8px;font-size:.85rem"><thead><tr><th>Day</th><th>Project</th><th class="amount">Hours</th></tr></thead><tbody>' +
                        days.map(function(dd) { return '<tr><td>' + Utils.escapeHtml(self._dayDate(dd.date)) + '</td><td>' + Utils.escapeHtml(dd.projectName || '') + '</td><td class="amount">' + self._num(dd.hours).toFixed(2) + '</td></tr>'; }).join('') +
                        '</tbody></table>' : '') +
                    (deds.length ? '<div style="margin-top:8px;font-size:.85rem"><strong>Deducted:</strong> ' + deds.map(function(x) { return Utils.escapeHtml(x.description) + ' ' + self._money(x.amount); }).join(', ') + '</div>' : '') +
                '</div>';
            }).join('')}
            <div class="card" style="font-weight:600;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <span>${lines.length} employee${lines.length === 1 ? '' : 's'}, ${self._num(t.hours).toFixed(2)} hours</span>
                <span>Gross ${self._money(t.gross)}${self._num(t.deductions) ? ' &minus; deductions ' + self._money(t.deductions) : ''} = Net ${self._money(t.net)}</span>
            </div>
        `;
        c.querySelector('#payBackBtn').addEventListener('click', function() { self._view = 'list'; self._renderContent(); });
        c.querySelector('#payPrintBtn').addEventListener('click', function() { window.print(); });
        c.querySelector('#payDeleteBtn').addEventListener('click', async function() {
            const ok = await Utils.confirm('Delete this pay run? The hours go back to unpaid and any deductions taken in it reopen. This does not reverse any money already sent.');
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
        const failed = [];
        for (const l of (r.lines || [])) {
            for (const x of (l.deductions || [])) {
                const ded = self._deductions.find(function(q) { return q.id === x.deductionId; });
                if (!ded) continue;
                const upd = Object.assign({}, ded);
                upd.recovered = Math.max(0, self._round2(self._num(ded.recovered) - self._num(x.amount)));
                upd.status = upd.recovered >= self._num(ded.amount) - 0.005 ? 'applied' : 'open';
                upd.applications = (Array.isArray(ded.applications) ? ded.applications : []).filter(function(a) { return a.runId !== r.id; });
                upd.updatedAt = new Date().toISOString();
                try { await self._api('/api/payroll_deductions', { method: 'POST', body: JSON.stringify(upd) }); }
                catch (e) { failed.push(ded.description || ded.id); }
            }
        }
        if (window.AppData && AppData.addAuditLog) AppData.addAuditLog(self._actor(), 'Pay Run Deleted', r.periodStart + ' to ' + r.periodEnd);
        try { await self._load(); } catch (e) { /* ignore */ }
        if (failed.length) Utils.showToast('Run deleted, but these deductions did not reopen: ' + failed.join(', '), 'error');
        else Utils.showToast('Pay run deleted');
        self._view = 'list';
        self._renderContent();
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
            (items.length === 0
                ? '<div class="card"><div class="empty"><h3>No deductions</h3><p>Record anything an employee owes back: a purchase you made for them, a cost they caused, an advance. It is taken off their next pay run.</p></div></div>'
                : '<div class="card"><table><thead><tr><th>Date</th><th>Employee</th><th>Type</th><th>Description</th><th class="amount">Amount</th><th class="amount">Recovered</th><th class="amount">Owing</th><th>Status</th><th></th></tr></thead><tbody>' +
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
