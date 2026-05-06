// Admin Contracts Module — Contract Setup + Schedule of Values + Progress Certificates
window.AdminContracts = {
    _container: null,
    _viewingContractId: null,
    _activeTab: 'items',
    _viewingCertId: null,

    render(container, params) {
        this._container = container;
        if (params && params.contractId) this._viewingContractId = params.contractId;
        if (params && params.tab) this._activeTab = params.tab;
        if (params && params.certId) { this._viewingCertId = params.certId; this._renderCertDetail(); return; }
        if (this._viewingContractId) { this._renderContractDetail(); } else { this._renderList(); }
    },

    // ── LIST ──────────────────────────────────────────────────────────────────
    async _renderList() {
        var self = this;
        var container = self._container;
        container.innerHTML = '<div class="loading-state"><p>Loading contracts...</p></div>';
        var contracts = [];
        try {
            contracts = await AppData.apiGetContracts();
        } catch (e) {
            container.innerHTML = '<div class="empty-state"><p>Failed to load contracts: ' + Utils.escapeHtml(e.message) + '</p></div>';
            return;
        }
        var projects = AppData.getProjects();
        var esc = Utils.escapeHtml;

        container.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">' +
            '<h2>Contracts</h2>' +
            '<button class="btn-primary" id="newContractBtn">+ New Contract</button>' +
            '</div>' +
            '<div class="card">' +
            (contracts.length === 0
                ? '<div class="empty"><h3>No Contracts</h3><p>Create a contract to track billing, SOV items, and progress certificates.</p></div>'
                : '<table>' +
                  '<thead><tr><th>Contract #</th><th>Title</th><th>Project</th><th>Type</th><th class="amount">Value</th><th>Status</th><th>Actions</th></tr></thead>' +
                  '<tbody>' + contracts.map(function(c) {
                      var proj = projects.find(function(p) { return p.id === c.projectId; });
                      var typeLabels = { lump_sum: 'Lump Sum', lump_sum_with_sov: 'Lump Sum / SOV', unit_price: 'Unit Price', time_and_material: 'T&M', mixed: 'Mixed' };
                      var statusColors = { Active: 'background:rgba(46,204,113,.2);color:var(--success)', draft: 'background:rgba(243,156,18,.2);color:var(--warn)', closed: 'background:rgba(150,150,150,.2);color:var(--text2)' };
                      return '<tr style="cursor:pointer" class="contract-row" data-id="' + c.id + '">' +
                          '<td style="font-family:monospace;font-size:.82rem">' + esc(c.contractNumber || '—') + '</td>' +
                          '<td><strong>' + esc(c.title) + '</strong></td>' +
                          '<td>' + esc(proj ? proj.name : (c.projectId || '—')) + '</td>' +
                          '<td style="font-size:.82rem">' + esc(typeLabels[c.contractType] || c.contractType || '—') + '</td>' +
                          '<td class="amount">' + Utils.formatCurrency(c.originalValue) + '</td>' +
                          '<td><span style="font-size:.75rem;padding:2px 8px;border-radius:12px;' + (statusColors[c.status] || '') + '">' + esc(c.status) + '</span></td>' +
                          '<td style="white-space:nowrap">' +
                              '<button class="btn-ghost btn-sm view-contract" data-id="' + c.id + '">Open</button>' +
                              '<button class="btn-ghost btn-sm delete-contract" data-id="' + c.id + '" style="color:var(--accent)">Delete</button>' +
                          '</td>' +
                      '</tr>';
                  }).join('') + '</tbody></table>'
            ) +
            '</div>';

        container.querySelectorAll('.contract-row, .view-contract').forEach(function(el) {
            el.addEventListener('click', function(e) {
                if (e.target.classList.contains('delete-contract')) return;
                var id = el.dataset.id || e.currentTarget.dataset.id;
                self._viewingContractId = id;
                self._activeTab = 'items';
                self._renderContractDetail();
            });
        });

        container.querySelectorAll('.delete-contract').forEach(function(btn) {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                if (!confirm('Delete this contract? This cannot be undone if no certificates exist.')) return;
                try {
                    await AppData.apiDeleteContract(btn.dataset.id);
                    Utils.showToast('Contract deleted');
                    self._renderList();
                } catch (e2) {
                    Utils.showToast('Delete failed: ' + e2.message, 'error');
                }
            });
        });

        container.querySelector('#newContractBtn').addEventListener('click', function() {
            self._showContractForm(null);
        });
    },

    // ── CONTRACT DETAIL ───────────────────────────────────────────────────────
    async _renderContractDetail() {
        var self = this;
        var container = self._container;
        container.innerHTML = '<div class="loading-state"><p>Loading...</p></div>';
        var contract;
        try {
            contract = await AppData.apiGetContract(self._viewingContractId);
        } catch (e) {
            container.innerHTML = '<div class="empty-state"><p>Failed to load contract.</p></div>';
            return;
        }
        var esc = Utils.escapeHtml;
        var typeLabels = { lump_sum: 'Lump Sum', lump_sum_with_sov: 'Lump Sum / SOV', unit_price: 'Unit Price', time_and_material: 'T&M', mixed: 'Mixed' };
        var tabs = ['items', 'certificates'];
        var tabLabels = { items: 'SOV / Items', certificates: 'Progress Certificates' };

        container.innerHTML =
            '<div style="margin-bottom:16px">' +
            '<button class="btn-ghost btn-sm" id="backToContracts">&larr; All Contracts</button>' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-top:8px">' +
            '<div>' +
            (contract.contractNumber ? '<div style="font-size:.8rem;color:var(--text2);font-family:monospace">' + esc(contract.contractNumber) + '</div>' : '') +
            '<h2>' + esc(contract.title) + '</h2>' +
            '<p style="color:var(--text2);font-size:.9rem;margin-top:4px">' +
            esc(typeLabels[contract.contractType] || contract.contractType) + ' &mdash; ' +
            'Original Value: <strong>' + Utils.formatCurrency(contract.originalValue) + '</strong>' +
            (contract.approvedChanges ? ' + Changes: ' + Utils.formatCurrency(contract.approvedChanges) : '') +
            ' &mdash; Holdback: ' + contract.holdbackPct + '%' +
            '</p>' +
            (contract.ownerName ? '<p style="font-size:.85rem;color:var(--text2)">' + esc(contract.ownerName) + '</p>' : '') +
            '</div>' +
            '<button class="btn-secondary btn-sm" id="editContractBtn">Edit Contract</button>' +
            '</div>' +
            '</div>' +
            '<div class="tabs">' +
            tabs.map(function(t) {
                return '<button class="tab-btn' + (self._activeTab === t ? ' active' : '') + '" data-tab="' + t + '">' + tabLabels[t] + '</button>';
            }).join('') +
            '</div>' +
            '<div id="contractTabContent"></div>';

        container.querySelector('#backToContracts').addEventListener('click', function() {
            self._viewingContractId = null;
            self._renderList();
        });
        container.querySelector('#editContractBtn').addEventListener('click', function() {
            self._showContractForm(contract);
        });
        container.querySelectorAll('.tab-btn[data-tab]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._activeTab = btn.dataset.tab;
                container.querySelectorAll('.tab-btn[data-tab]').forEach(function(b) { b.classList.toggle('active', b === btn); });
                self._renderContractTab(container.querySelector('#contractTabContent'), contract);
            });
        });
        this._renderContractTab(container.querySelector('#contractTabContent'), contract);
    },

    _renderContractTab(tabContent, contract) {
        if (this._activeTab === 'items') this._renderItemsTab(tabContent, contract);
        else if (this._activeTab === 'certificates') this._renderCertificatesTab(tabContent, contract);
    },

    // ── SOV / ITEMS TAB ───────────────────────────────────────────────────────
    async _renderItemsTab(tabContent, contract) {
        var self = this;
        tabContent.innerHTML = '<div class="loading-state"><p>Loading items...</p></div>';
        var items = [];
        try {
            items = await AppData.apiGetContractItems(contract.id);
        } catch (e) {
            tabContent.innerHTML = '<p style="color:var(--accent)">Failed to load items.</p>';
            return;
        }
        var esc = Utils.escapeHtml;
        var bmLabels = { lump_sum_percent: 'LS %', lump_sum_amount: 'LS $', unit_price_quantity: 'Unit Price', time_and_material: 'T&M' };
        var totalScheduled = items.reduce(function(s, i) { return s + (parseFloat(i.scheduledValue) || 0); }, 0);

        tabContent.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
            '<span style="font-size:.9rem;color:var(--text2)">Total Scheduled Value: <strong>' + Utils.formatCurrency(totalScheduled) + '</strong>' +
            (contract.originalValue ? ' / Contract: <strong>' + Utils.formatCurrency(contract.originalValue) + '</strong>' : '') +
            '</span>' +
            '<button class="btn-primary btn-sm" id="addItemBtn">+ Add Item</button>' +
            '</div>' +
            '<div class="card" style="overflow-x:auto">' +
            (items.length === 0
                ? '<div class="empty"><p>No SOV items yet. Add items to define the Schedule of Values.</p></div>'
                : '<table>' +
                  '<thead><tr><th>#</th><th>Description</th><th>Billing</th><th>UOM</th><th class="amount">Qty</th><th class="amount">Rate</th><th class="amount">Scheduled Value</th><th>Actions</th></tr></thead>' +
                  '<tbody>' + items.map(function(item) {
                      return '<tr>' +
                          '<td style="font-family:monospace;font-size:.82rem">' + esc(item.itemNumber || '') + '</td>' +
                          '<td>' + esc(item.description) + '</td>' +
                          '<td style="font-size:.75rem;color:var(--text2)">' + (bmLabels[item.billingMethod] || item.billingMethod || 'LS %') + '</td>' +
                          '<td style="font-size:.82rem">' + esc(item.uom || 'LS') + '</td>' +
                          '<td class="amount">' + (item.contractQuantity ? item.contractQuantity.toLocaleString() : '—') + '</td>' +
                          '<td class="amount">' + (item.unitRate ? Utils.formatCurrency(item.unitRate) : '—') + '</td>' +
                          '<td class="amount"><strong>' + Utils.formatCurrency(item.scheduledValue) + '</strong></td>' +
                          '<td style="white-space:nowrap">' +
                              '<button class="btn-ghost btn-sm edit-item" data-id="' + item.id + '">Edit</button>' +
                              '<button class="btn-ghost btn-sm delete-item" data-id="' + item.id + '" style="color:var(--accent)">Del</button>' +
                          '</td>' +
                      '</tr>';
                  }).join('') + '</tbody></table>'
            ) +
            '</div>';

        tabContent.querySelector('#addItemBtn').addEventListener('click', function() {
            self._showItemForm(contract, null, items.length);
        });
        tabContent.querySelectorAll('.edit-item').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var item = items.find(function(i) { return i.id === btn.dataset.id; });
                if (item) self._showItemForm(contract, item, items.length);
            });
        });
        tabContent.querySelectorAll('.delete-item').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                if (!confirm('Delete this item?')) return;
                try {
                    await AppData.apiDeleteContractItem(contract.id, btn.dataset.id);
                    Utils.showToast('Item deleted');
                    self._renderItemsTab(tabContent, contract);
                } catch (e) {
                    Utils.showToast('Delete failed: ' + e.message, 'error');
                }
            });
        });
    },

    // ── CERTIFICATES TAB ──────────────────────────────────────────────────────
    async _renderCertificatesTab(tabContent, contract) {
        var self = this;
        tabContent.innerHTML = '<div class="loading-state"><p>Loading certificates...</p></div>';
        var certs = [];
        try {
            certs = await AppData.apiGetCertificates(contract.id);
        } catch (e) {
            tabContent.innerHTML = '<p style="color:var(--accent)">Failed to load certificates.</p>';
            return;
        }
        var esc = Utils.escapeHtml;
        var statusColors = {
            draft: 'background:rgba(243,156,18,.2);color:var(--warn)',
            submitted: 'background:rgba(52,152,219,.2);color:#5dade2',
            approved: 'background:rgba(46,204,113,.2);color:var(--success)',
            void: 'background:rgba(150,150,150,.2);color:var(--text2)'
        };

        tabContent.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
            '<span style="font-size:.9rem;color:var(--text2)">' + certs.length + ' certificate(s)</span>' +
            '<button class="btn-primary btn-sm" id="newCertBtn">+ Generate Progress Certificate</button>' +
            '</div>' +
            '<div class="card">' +
            (certs.length === 0
                ? '<div class="empty"><h3>No Certificates</h3><p>Generate the first progress certificate to begin billing.</p></div>'
                : '<table>' +
                  '<thead><tr><th>Cert #</th><th>Period</th><th>Gross This Period</th><th>Holdback</th><th>Net Payable</th><th>Status</th><th>Actions</th></tr></thead>' +
                  '<tbody>' + certs.map(function(c) {
                      return '<tr style="cursor:pointer" class="cert-row" data-id="' + c.id + '">' +
                          '<td><strong>PC-' + c.certificateNumber + '</strong></td>' +
                          '<td style="font-size:.82rem">' + esc(c.periodFrom || '') + ' – ' + esc(c.periodTo || '') + '</td>' +
                          '<td class="amount">' + (c.grossThisPeriod ? Utils.formatCurrency(c.grossThisPeriod) : '—') + '</td>' +
                          '<td class="amount">' + (c.holdbackThisPeriod ? Utils.formatCurrency(c.holdbackThisPeriod) : '—') + '</td>' +
                          '<td class="amount"><strong>' + (c.netPayableThisPeriod ? Utils.formatCurrency(c.netPayableThisPeriod) : '—') + '</strong></td>' +
                          '<td><span style="font-size:.75rem;padding:2px 8px;border-radius:12px;' + (statusColors[c.status] || '') + '">' + esc(c.status) + '</span></td>' +
                          '<td style="white-space:nowrap">' +
                              '<button class="btn-ghost btn-sm view-cert" data-id="' + c.id + '">Open</button>' +
                          '</td>' +
                      '</tr>';
                  }).join('') + '</tbody></table>'
            ) +
            '</div>';

        tabContent.querySelector('#newCertBtn').addEventListener('click', function() {
            self._showNewCertForm(contract, tabContent);
        });
        tabContent.querySelectorAll('.view-cert, .cert-row').forEach(function(el) {
            el.addEventListener('click', function(e) {
                if (e.target.classList.contains('view-cert') && el.classList.contains('cert-row')) return;
                var id = el.dataset.id;
                self._viewingCertId = id;
                self._renderCertDetail(contract);
            });
        });
    },

    // ── CERTIFICATE DETAIL ────────────────────────────────────────────────────
    async _renderCertDetail(contractArg) {
        var self = this;
        var container = self._container;
        container.innerHTML = '<div class="loading-state"><p>Loading certificate...</p></div>';

        var contract = contractArg;
        if (!contract) {
            try { contract = await AppData.apiGetContract(self._viewingContractId); } catch(e) {}
        }

        var cert;
        try {
            cert = await AppData.apiGetCertificate(self._viewingContractId, self._viewingCertId);
        } catch (e) {
            container.innerHTML = '<div class="empty-state"><p>Failed to load certificate.</p></div>';
            return;
        }

        var esc = Utils.escapeHtml;
        var locked = cert.status === 'approved' || cert.status === 'void';
        var lines = cert.lines || [];
        var totals = cert.totals || {};
        var holdbackPct = cert.holdbackPct || (contract ? contract.holdbackPct : 10);

        var grossThisPeriod = totals.thisPeriodTotal || 0;
        var holdbackThisPeriod = Math.round(grossThisPeriod * holdbackPct) / 100;
        var netPayable = grossThisPeriod - holdbackThisPeriod;

        var statusColors = {
            draft: 'background:rgba(243,156,18,.2);color:var(--warn)',
            submitted: 'background:rgba(52,152,219,.2);color:#5dade2',
            approved: 'background:rgba(46,204,113,.2);color:var(--success)',
            void: 'background:rgba(150,150,150,.2);color:var(--text2)'
        };

        var apiBase = (AppData.API_BASE || '');

        container.innerHTML =
            '<div style="margin-bottom:16px">' +
            '<button class="btn-ghost btn-sm" id="backToCert">&larr; Back to Contract</button>' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-top:8px">' +
            '<div>' +
            '<h2>Progress Certificate No. ' + cert.certificateNumber + '</h2>' +
            '<p style="color:var(--text2);font-size:.9rem;margin-top:4px">' +
            'Period: ' + esc(cert.periodFrom || '') + ' – ' + esc(cert.periodTo || '') +
            ' &nbsp;&nbsp;Holdback: ' + holdbackPct + '%' +
            ' &nbsp;&nbsp;<span style="padding:2px 8px;border-radius:12px;font-size:.75rem;' + (statusColors[cert.status] || '') + '">' + esc(cert.status) + '</span>' +
            '</p>' +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            (!locked && cert.status === 'draft' ? '<button class="btn-secondary btn-sm" id="submitCertBtn">Submit for Approval</button>' : '') +
            (!locked && cert.status === 'submitted' ? '<button class="btn-primary btn-sm" id="approveCertBtn">Approve Certificate</button>' : '') +
            (!locked && cert.status === 'submitted' ? '<button class="btn-secondary btn-sm" id="revertCertBtn">Revert to Draft</button>' : '') +
            (cert.status === 'approved' ? '<button class="btn-primary btn-sm" id="invoiceCertBtn">Create Invoice</button>' : '') +
            '<a href="' + apiBase + '/api/contracts/' + esc(self._viewingContractId) + '/certificates/' + esc(self._viewingCertId) + '/html" target="_blank" class="btn-secondary btn-sm">View / Print</a>' +
            '</div>' +
            '</div>' +
            '</div>' +

            '<div class="card" style="overflow-x:auto;margin-bottom:16px">' +
            '<table style="min-width:900px">' +
            '<thead><tr style="font-size:.78rem">' +
            '<th style="min-width:40px">#</th>' +
            '<th style="min-width:200px">Description</th>' +
            '<th style="min-width:80px">Billing</th>' +
            '<th style="min-width:80px">UOM</th>' +
            '<th class="amount" style="min-width:100px">Scheduled Value</th>' +
            '<th class="amount" style="min-width:110px">Prev Certified</th>' +
            '<th class="amount" style="min-width:120px">This Period ' + (locked ? '' : '(Editable)') + '</th>' +
            '<th class="amount" style="min-width:110px">To Date</th>' +
            '<th class="amount" style="min-width:80px">% Done</th>' +
            '<th class="amount" style="min-width:110px">Balance</th>' +
            '</tr></thead>' +
            '<tbody>' +
            lines.map(function(line) {
                var bmLabels = { lump_sum_percent: 'LS %', lump_sum_amount: 'LS $', unit_price_quantity: 'Unit Price', time_and_material: 'T&M' };
                var bm = line.billingMethod || 'lump_sum_percent';
                var isQty = bm === 'unit_price_quantity';
                var thisPeriodCell;
                if (locked) {
                    thisPeriodCell = Utils.formatCurrency(line.thisPeriodAmt || 0) +
                        '<br><small style="color:var(--text2)">' + (line.thisPeriodPct ? line.thisPeriodPct.toFixed(1) + '%' : '') + '</small>';
                } else {
                    var inputHtml;
                    if (isQty) {
                        inputHtml = '<input type="number" class="line-qty-input" data-line-id="' + line.id + '" data-bm="' + bm + '" min="0" step="any" value="' + (line.certifiedThisPeriodQty || 0) + '" style="width:80px;text-align:right" />';
                    } else if (bm === 'lump_sum_percent') {
                        inputHtml = '<input type="number" class="line-pct-input" data-line-id="' + line.id + '" min="0" max="100" step="0.01" value="' + (line.thisPeriodPct || 0) + '" style="width:70px;text-align:right" placeholder="%" />';
                    } else {
                        inputHtml = '<input type="number" class="line-amt-input" data-line-id="' + line.id + '" min="0" step="0.01" value="' + (line.thisPeriodAmt || 0) + '" style="width:90px;text-align:right" />';
                    }
                    thisPeriodCell = '<div style="display:flex;flex-direction:column;gap:2px">' +
                        inputHtml +
                        '<small style="color:var(--text2);font-size:.72rem">' + Utils.formatCurrency(line.thisPeriodAmt || 0) + '</small>' +
                        '</div>';
                }
                return '<tr data-line-id="' + line.id + '">' +
                    '<td style="font-size:.78rem;font-family:monospace">' + esc(line.itemNumber || '') + '</td>' +
                    '<td style="font-size:.82rem">' + esc(line.itemDescription || line.description || '') + '</td>' +
                    '<td style="font-size:.72rem;color:var(--text2)">' + (bmLabels[bm] || bm) + '</td>' +
                    '<td style="font-size:.78rem">' + esc(line.uom || 'LS') + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(line.scheduledValue || 0) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(line.prevCertifiedAmt || 0) + '<br><small style="color:var(--text2)">' + (line.prevCertifiedPct ? line.prevCertifiedPct.toFixed(1) + '%' : '') + '</small></td>' +
                    '<td class="amount">' + thisPeriodCell + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(line.cumulativeAmt || 0) + '<br><small style="color:var(--text2)">' + (line.cumulativePct ? line.cumulativePct.toFixed(1) + '%' : '') + '</small></td>' +
                    '<td class="amount">' + ((line.cumulativePct || 0).toFixed(1)) + '%</td>' +
                    '<td class="amount">' + Utils.formatCurrency(line.balanceToFinish || 0) + '</td>' +
                    '</tr>';
            }).join('') +
            '</tbody>' +
            '<tfoot><tr style="font-weight:700;border-top:2px solid var(--border)">' +
            '<td colspan="4">TOTALS</td>' +
            '<td class="amount">' + Utils.formatCurrency(totals.scheduledValueTotal || 0) + '</td>' +
            '<td class="amount">' + Utils.formatCurrency(totals.prevCertifiedTotal || 0) + '</td>' +
            '<td class="amount" id="thisPeriodTotalCell">' + Utils.formatCurrency(totals.thisPeriodTotal || 0) + '</td>' +
            '<td class="amount">' + Utils.formatCurrency(totals.cumulativeTotal || 0) + '</td>' +
            '<td class="amount"></td>' +
            '<td class="amount">' + Utils.formatCurrency(totals.balanceToFinishTotal || 0) + '</td>' +
            '</tr></tfoot>' +
            '</table>' +
            '</div>' +

            '<div class="card" style="max-width:400px">' +
            '<h4 style="margin-bottom:8px">Certificate Summary</h4>' +
            '<table style="width:100%">' +
            '<tr><td>Gross This Period</td><td class="amount" id="summGross">' + Utils.formatCurrency(grossThisPeriod) + '</td></tr>' +
            '<tr><td>Holdback (' + holdbackPct + '%)</td><td class="amount" id="summHoldback" style="color:var(--accent)">– ' + Utils.formatCurrency(holdbackThisPeriod) + '</td></tr>' +
            '<tr style="font-weight:700;border-top:1px solid var(--border)"><td>Net Payable This Period</td><td class="amount" id="summNet">' + Utils.formatCurrency(netPayable) + '</td></tr>' +
            '</table>' +
            '</div>';

        container.querySelector('#backToCert').addEventListener('click', function() {
            self._viewingCertId = null;
            self._activeTab = 'certificates';
            self._renderContractDetail();
        });

        // Save line changes
        if (!locked) {
            var saveTimer = null;
            async function saveLine(lineId, data) {
                try {
                    var updated = await AppData.apiGetCertificate(self._viewingContractId, self._viewingCertId);
                    var linesPayload = (updated.lines || []).map(function(l) {
                        if (l.id === lineId) return Object.assign({}, l, data);
                        return l;
                    });
                    await AppData.apiUpdateCertificateLines(self._viewingContractId, self._viewingCertId, linesPayload);
                    self._renderCertDetail(contract);
                } catch(e) {
                    Utils.showToast('Save failed: ' + e.message, 'error');
                }
            }

            container.querySelectorAll('.line-pct-input').forEach(function(inp) {
                inp.addEventListener('change', function() {
                    clearTimeout(saveTimer);
                    saveTimer = setTimeout(function() { saveLine(inp.dataset.lineId, { thisPeriodPct: parseFloat(inp.value) || 0 }); }, 600);
                });
            });
            container.querySelectorAll('.line-amt-input').forEach(function(inp) {
                inp.addEventListener('change', function() {
                    clearTimeout(saveTimer);
                    saveTimer = setTimeout(function() { saveLine(inp.dataset.lineId, { thisPeriodAmt: parseFloat(inp.value) || 0 }); }, 600);
                });
            });
            container.querySelectorAll('.line-qty-input').forEach(function(inp) {
                inp.addEventListener('change', function() {
                    clearTimeout(saveTimer);
                    saveTimer = setTimeout(function() { saveLine(inp.dataset.lineId, { certifiedThisPeriodQty: parseFloat(inp.value) || 0 }); }, 600);
                });
            });
        }

        var submitBtn = container.querySelector('#submitCertBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', async function() {
                try {
                    await AppData.apiSubmitCertificate(self._viewingContractId, self._viewingCertId);
                    Utils.showToast('Certificate submitted');
                    self._renderCertDetail(contract);
                } catch (e) { Utils.showToast('Failed: ' + e.message, 'error'); }
            });
        }
        var approveBtn = container.querySelector('#approveCertBtn');
        if (approveBtn) {
            approveBtn.addEventListener('click', async function() {
                if (!confirm('Approve this certificate? This action locks it permanently.')) return;
                try {
                    await AppData.apiApproveCertificate(self._viewingContractId, self._viewingCertId);
                    Utils.showToast('Certificate approved!');
                    self._renderCertDetail(contract);
                } catch (e) { Utils.showToast('Failed: ' + e.message, 'error'); }
            });
        }
        var revertBtn = container.querySelector('#revertCertBtn');
        if (revertBtn) {
            revertBtn.addEventListener('click', async function() {
                try {
                    await AppData.apiRevertCertificate(self._viewingContractId, self._viewingCertId);
                    Utils.showToast('Reverted to draft');
                    self._renderCertDetail(contract);
                } catch (e) { Utils.showToast('Failed: ' + e.message, 'error'); }
            });
        }
        var invoiceBtn = container.querySelector('#invoiceCertBtn');
        if (invoiceBtn) {
            invoiceBtn.addEventListener('click', async function() {
                try {
                    var result = await AppData.apiCreateInvoiceFromCertificate(self._viewingContractId, self._viewingCertId, {});
                    Utils.showToast('Invoice created! Total: ' + Utils.formatCurrency(result.total));
                } catch (e) { Utils.showToast('Failed: ' + e.message, 'error'); }
            });
        }
    },

    // ── NEW CERT FORM ─────────────────────────────────────────────────────────
    _showNewCertForm(contract, tabContent) {
        var self = this;
        var today = new Date().toISOString().slice(0, 10);
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML =
            '<div class="modal" style="max-width:480px">' +
            '<h3>Generate Progress Certificate</h3>' +
            '<div class="form-group"><label>Period From</label><input type="date" id="certFrom" value="' + today + '"></div>' +
            '<div class="form-group"><label>Period To</label><input type="date" id="certTo" value="' + today + '"></div>' +
            '<div class="form-group"><label>Holdback % (default: ' + contract.holdbackPct + '%)</label><input type="number" id="certHoldback" value="' + contract.holdbackPct + '" min="0" max="100" step="0.01"></div>' +
            '<div class="form-group"><label>Notes</label><textarea id="certNotes" rows="2"></textarea></div>' +
            '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">' +
            '<button class="btn-secondary" id="cancelCertBtn">Cancel</button>' +
            '<button class="btn-primary" id="createCertBtn">Generate</button>' +
            '</div>' +
            '</div>';
        overlay.querySelector('#cancelCertBtn').addEventListener('click', function() { overlay.remove(); });
        overlay.querySelector('#createCertBtn').addEventListener('click', async function() {
            try {
                var cert = await AppData.apiCreateCertificate(contract.id, {
                    periodFrom: overlay.querySelector('#certFrom').value,
                    periodTo: overlay.querySelector('#certTo').value,
                    holdbackPct: parseFloat(overlay.querySelector('#certHoldback').value) || contract.holdbackPct,
                    notes: overlay.querySelector('#certNotes').value,
                });
                Utils.showToast('Certificate PC-' + cert.certificateNumber + ' generated');
                overlay.remove();
                self._viewingCertId = cert.id;
                self._renderCertDetail(contract);
            } catch (e) { Utils.showToast('Failed: ' + e.message, 'error'); }
        });
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    },

    // ── CONTRACT FORM ─────────────────────────────────────────────────────────
    _showContractForm(contract) {
        var self = this;
        var isNew = !contract || !contract.id;
        var projects = AppData.getProjects();
        var esc = Utils.escapeHtml;
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML =
            '<div class="modal" style="max-width:560px">' +
            '<h3>' + (isNew ? 'New Contract' : 'Edit Contract') + '</h3>' +
            '<div class="form-group"><label>Title *</label><input type="text" id="cTitle" value="' + esc(contract ? contract.title || '' : '') + '" placeholder="e.g. Main Construction Contract"></div>' +
            '<div class="form-group"><label>Contract Number</label><input type="text" id="cNumber" value="' + esc(contract ? (contract.contractNumber || '') : '') + '" placeholder="e.g. C-2026-001"></div>' +
            '<div class="form-group"><label>Project</label>' +
            '<select id="cProject">' +
            '<option value="">— No project linked —</option>' +
            projects.map(function(p) { return '<option value="' + p.id + '"' + (contract && contract.projectId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="form-group"><label>Contract Type</label>' +
            '<select id="cType">' +
            '<option value="lump_sum_with_sov"' + (contract && contract.contractType === 'lump_sum_with_sov' ? ' selected' : (!contract || !contract.contractType ? ' selected' : '')) + '>Lump Sum with Schedule of Values</option>' +
            '<option value="lump_sum"' + (contract && contract.contractType === 'lump_sum' ? ' selected' : '') + '>Lump Sum (single item)</option>' +
            '<option value="unit_price"' + (contract && contract.contractType === 'unit_price' ? ' selected' : '') + '>Unit Price</option>' +
            '<option value="time_and_material"' + (contract && contract.contractType === 'time_and_material' ? ' selected' : '') + '>Time &amp; Material</option>' +
            '<option value="mixed"' + (contract && contract.contractType === 'mixed' ? ' selected' : '') + '>Mixed</option>' +
            '</select></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
            '<div class="form-group"><label>Original Value ($)</label><input type="number" id="cValue" value="' + (contract ? contract.originalValue || 0 : 0) + '" min="0" step="0.01"></div>' +
            '<div class="form-group"><label>Approved Changes ($)</label><input type="number" id="cChanges" value="' + (contract ? (contract.approvedChanges || 0) : 0) + '" step="0.01"></div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
            '<div class="form-group"><label>Holdback %</label><input type="number" id="cHoldback" value="' + (contract ? contract.holdbackPct || 10 : 10) + '" min="0" max="100" step="0.01"></div>' +
            '<div class="form-group"><label>Contract Date</label><input type="date" id="cDate" value="' + (contract ? (contract.contractDate || '') : '') + '"></div>' +
            '</div>' +
            '<div class="form-group"><label>Owner / Client Name</label><input type="text" id="cOwner" value="' + esc(contract ? (contract.ownerName || '') : '') + '"></div>' +
            '<div class="form-group"><label>Status</label>' +
            '<select id="cStatus">' +
            '<option value="Active"' + (!contract || contract.status === 'Active' ? ' selected' : '') + '>Active</option>' +
            '<option value="draft"' + (contract && contract.status === 'draft' ? ' selected' : '') + '>Draft</option>' +
            '<option value="closed"' + (contract && contract.status === 'closed' ? ' selected' : '') + '>Closed</option>' +
            '</select></div>' +
            '<div class="form-group"><label>Notes</label><textarea id="cNotes" rows="2">' + esc(contract ? (contract.notes || '') : '') + '</textarea></div>' +
            '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">' +
            '<button class="btn-secondary" id="cancelContractBtn">Cancel</button>' +
            '<button class="btn-primary" id="saveContractBtn">' + (isNew ? 'Create Contract' : 'Save Changes') + '</button>' +
            '</div>' +
            '</div>';
        overlay.querySelector('#cancelContractBtn').addEventListener('click', function() { overlay.remove(); });
        overlay.querySelector('#saveContractBtn').addEventListener('click', async function() {
            var title = overlay.querySelector('#cTitle').value.trim();
            if (!title) { Utils.showToast('Title is required', 'error'); return; }
            var data = {
                title: title,
                contractNumber: overlay.querySelector('#cNumber').value.trim(),
                projectId: overlay.querySelector('#cProject').value,
                contractType: overlay.querySelector('#cType').value,
                originalValue: parseFloat(overlay.querySelector('#cValue').value) || 0,
                approvedChanges: parseFloat(overlay.querySelector('#cChanges').value) || 0,
                holdbackPct: parseFloat(overlay.querySelector('#cHoldback').value) || 10,
                contractDate: overlay.querySelector('#cDate').value,
                ownerName: overlay.querySelector('#cOwner').value.trim(),
                status: overlay.querySelector('#cStatus').value,
                notes: overlay.querySelector('#cNotes').value.trim(),
            };
            try {
                if (isNew) {
                    var created = await AppData.apiCreateContract(data);
                    Utils.showToast('Contract created');
                    overlay.remove();
                    self._viewingContractId = created.id;
                    self._activeTab = 'items';
                    self._renderContractDetail();
                } else {
                    await AppData.apiUpdateContract(contract.id, data);
                    Utils.showToast('Contract saved');
                    overlay.remove();
                    self._renderContractDetail();
                }
            } catch (e) { Utils.showToast('Save failed: ' + e.message, 'error'); }
        });
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    },

    // ── ITEM FORM ─────────────────────────────────────────────────────────────
    _showItemForm(contract, item, existingCount) {
        var self = this;
        var isNew = !item;
        var esc = Utils.escapeHtml;
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML =
            '<div class="modal" style="max-width:520px">' +
            '<h3>' + (isNew ? 'Add SOV Item' : 'Edit SOV Item') + '</h3>' +
            '<div style="display:grid;grid-template-columns:1fr 2fr;gap:12px">' +
            '<div class="form-group"><label>Item #</label><input type="text" id="iNum" value="' + esc(item ? (item.itemNumber || '') : (existingCount + 1) + '') + '" placeholder="e.g. 01"></div>' +
            '<div class="form-group"><label>Description *</label><input type="text" id="iDesc" value="' + esc(item ? item.description : '') + '" placeholder="e.g. Site Preparation"></div>' +
            '</div>' +
            '<div class="form-group"><label>Billing Method</label>' +
            '<select id="iBilling">' +
            '<option value="lump_sum_percent"' + (!item || item.billingMethod === 'lump_sum_percent' ? ' selected' : '') + '>Lump Sum — % Complete</option>' +
            '<option value="lump_sum_amount"' + (item && item.billingMethod === 'lump_sum_amount' ? ' selected' : '') + '>Lump Sum — Dollar Amount</option>' +
            '<option value="unit_price_quantity"' + (item && item.billingMethod === 'unit_price_quantity' ? ' selected' : '') + '>Unit Price (Qty × Rate)</option>' +
            '<option value="time_and_material"' + (item && item.billingMethod === 'time_and_material' ? ' selected' : '') + '>Time &amp; Material</option>' +
            '</select></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">' +
            '<div class="form-group"><label>UOM</label><input type="text" id="iUom" value="' + esc(item ? (item.uom || 'LS') : 'LS') + '" placeholder="LS, m2, hr..."></div>' +
            '<div class="form-group"><label>Contract Qty</label><input type="number" id="iQty" value="' + (item ? (item.contractQuantity || '') : '') + '" min="0" step="any" placeholder="optional"></div>' +
            '<div class="form-group"><label>Unit Rate ($)</label><input type="number" id="iRate" value="' + (item ? (item.unitRate || '') : '') + '" min="0" step="0.01" placeholder="optional"></div>' +
            '</div>' +
            '<div class="form-group"><label>Scheduled Value ($)</label><input type="number" id="iValue" value="' + (item ? item.scheduledValue : 0) + '" min="0" step="0.01" placeholder="Total value of this item"></div>' +
            '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">' +
            '<button class="btn-secondary" id="cancelItemBtn">Cancel</button>' +
            '<button class="btn-primary" id="saveItemBtn">' + (isNew ? 'Add Item' : 'Save') + '</button>' +
            '</div>' +
            '</div>';

        // Auto-calculate scheduled value for unit price
        function recalc() {
            var qty = parseFloat(overlay.querySelector('#iQty').value) || 0;
            var rate = parseFloat(overlay.querySelector('#iRate').value) || 0;
            var bm = overlay.querySelector('#iBilling').value;
            if (bm === 'unit_price_quantity' && qty && rate) {
                overlay.querySelector('#iValue').value = (qty * rate).toFixed(2);
            }
        }
        overlay.querySelector('#iQty').addEventListener('input', recalc);
        overlay.querySelector('#iRate').addEventListener('input', recalc);

        overlay.querySelector('#cancelItemBtn').addEventListener('click', function() { overlay.remove(); });
        overlay.querySelector('#saveItemBtn').addEventListener('click', async function() {
            var desc = overlay.querySelector('#iDesc').value.trim();
            if (!desc) { Utils.showToast('Description is required', 'error'); return; }
            var data = {
                itemNumber: overlay.querySelector('#iNum').value.trim(),
                description: desc,
                billingMethod: overlay.querySelector('#iBilling').value,
                uom: overlay.querySelector('#iUom').value.trim() || 'LS',
                contractQuantity: parseFloat(overlay.querySelector('#iQty').value) || 0,
                unitRate: parseFloat(overlay.querySelector('#iRate').value) || 0,
                scheduledValue: parseFloat(overlay.querySelector('#iValue').value) || 0,
                sortOrder: item ? item.sortOrder : existingCount,
            };
            try {
                if (isNew) {
                    await AppData.apiCreateContractItem(contract.id, data);
                    Utils.showToast('Item added');
                } else {
                    await AppData.apiUpdateContractItem(contract.id, item.id, data);
                    Utils.showToast('Item saved');
                }
                overlay.remove();
                var tabContent = document.querySelector('#contractTabContent');
                if (tabContent) self._renderItemsTab(tabContent, contract);
            } catch (e) { Utils.showToast('Save failed: ' + e.message, 'error'); }
        });
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    },
};
