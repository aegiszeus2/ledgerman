// Admin Invoices Module
window.AdminInvoices = {
    _container: null,
    _statusFilter: 'All',

    // ============ INVOICE LIST VIEW ============

    render(container, params) {
        var self = this;
        self._container = container;
        self._statusFilter = (params && params.statusFilter) || self._statusFilter || 'All';
        self._renderList();
    },

    _renderList() {
        var self = this;
        var container = self._container;
        var invoices = AppData.getInvoices();
        var payments = AppData.getPayments();

        // Compute status for each invoice
        var enriched = invoices.map(function(inv) {
            var invPayments = payments.filter(function(p) { return p.invoiceId === inv.id; });
            var paid = invPayments.reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
            var total = parseFloat(inv.total) || 0;
            var balance = total - paid;
            var status = inv.status || 'Unpaid';
            if (balance <= 0.01) {
                status = 'Paid';
            } else if (paid > 0.01) {
                status = 'Partially Paid';
            } else if (inv.dueDate && new Date(inv.dueDate) < new Date()) {
                status = 'Overdue';
            } else {
                status = 'Unpaid';
            }
            return Object.assign({}, inv, { computedStatus: status, balance: balance, totalPaid: paid });
        });

        // Apply status filter
        var filtered = enriched;
        if (self._statusFilter !== 'All') {
            filtered = enriched.filter(function(inv) { return inv.computedStatus === self._statusFilter; });
        }

        var statusOptions = ['All', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue'];

        container.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">' +
                '<h2>Invoices</h2>' +
                '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
                    '<label style="font-size:.85rem;color:var(--text2)">Status:</label>' +
                    '<select id="invoiceStatusFilter" style="width:auto;min-width:140px">' +
                        statusOptions.map(function(s) {
                            return '<option value="' + s + '"' + (self._statusFilter === s ? ' selected' : '') + '>' + s + '</option>';
                        }).join('') +
                    '</select>' +
                    '<button class="btn-primary" id="newInvoiceBtn">+ Create Invoice</button>' +
                '</div>' +
            '</div>' +
            '<div class="card">' +
                (filtered.length === 0
                    ? '<div class="empty"><h3>No Invoices</h3><p>' + (self._statusFilter !== 'All' ? 'No invoices match the selected filter.' : 'Create your first invoice by clicking "Create Invoice".') + '</p></div>'
                    : '<table>' +
                        '<thead><tr><th>Invoice #</th><th>Project</th><th>Client</th><th>Date</th><th class="amount">Amount</th><th>Status</th><th>Actions</th></tr></thead>' +
                        '<tbody>' + filtered.map(function(inv) {
                            var statusColors = {
                                'Paid': 'background:rgba(46,204,113,.2);color:var(--success)',
                                'Partially Paid': 'background:rgba(243,156,18,.2);color:var(--warn)',
                                'Unpaid': 'background:rgba(52,152,219,.2);color:#5dade2',
                                'Overdue': 'background:rgba(233,69,96,.2);color:var(--accent)'
                            };
                            return '<tr>' +
                                '<td><strong>' + Utils.escapeHtml(inv.invoiceNumber || '') + '</strong></td>' +
                                '<td>' + Utils.escapeHtml(inv.projectName || '') + '</td>' +
                                '<td>' + Utils.escapeHtml(inv.clientName || inv.client || '') + '</td>' +
                                '<td>' + Utils.formatDate(inv.date || inv.invoiceDate) + '</td>' +
                                '<td class="amount">' + Utils.formatCurrency(inv.total) + '</td>' +
                                '<td><span style="font-size:.75rem;padding:2px 8px;border-radius:12px;' + (statusColors[inv.computedStatus] || '') + '">' + inv.computedStatus + '</span></td>' +
                                '<td style="white-space:nowrap">' +
                                    '<button class="btn-ghost btn-sm view-invoice" data-id="' + inv.id + '">View</button>' +
                                    (inv.computedStatus !== 'Paid' ? '<button class="btn-ghost btn-sm record-payment-list" data-id="' + inv.id + '" data-balance="' + inv.balance.toFixed(2) + '" style="color:var(--success)">Record Payment</button>' : '') +
                                '</td>' +
                            '</tr>';
                        }).join('') + '</tbody>' +
                    '</table>') +
            '</div>';

        container.querySelector('#invoiceStatusFilter').addEventListener('change', function() {
            self._statusFilter = this.value;
            self._renderList();
        });

        container.querySelector('#newInvoiceBtn').addEventListener('click', function() {
            window.App.navigate('invoice-create');
        });

        container.querySelectorAll('.view-invoice').forEach(function(btn) {
            btn.addEventListener('click', function() {
                window.App.navigate('invoice-detail', { invoiceId: btn.dataset.id });
            });
        });

        container.querySelectorAll('.record-payment-list').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var balance = parseFloat(btn.dataset.balance) || 0;
                self._showPaymentModal(btn.dataset.id, balance, function() {
                    self._renderList();
                });
            });
        });
    },

    // ============ CREATE INVOICE WIZARD ============

    renderCreate(container, params) {
        var self = this;
        self._container = container;

        // Find projects with billable ready-to-invoice expenses
        var projects = AppData.getProjects();
        var eligible = projects.filter(function(p) {
            var expenses = AppData.getExpenses(p.id);
            return expenses.some(function(e) { return e.billable !== false && !e.invoiced; });
        });

        // Also treat expenses without a billable flag as billable (backwards compat)
        var eligible2 = projects.filter(function(p) {
            var expenses = AppData.getExpenses(p.id);
            return expenses.some(function(e) { return e.billable !== false && !e.invoiced; });
        });

        if (eligible2.length === 0) {
            container.innerHTML = '<div style="padding:32px;text-align:center"><h3 style="color:#1a2744;margin-bottom:12px">No billable expenses found</h3><p style="color:#555;margin-bottom:24px">Add expenses to a project first, then create an invoice.</p><button class="btn btn-primary" onclick="window.App.navigate(\'invoices\')">← Back to Invoices</button></div>';
            return;
        }

        // Use the broader eligible set
        var eligible = eligible2;

        var settings = AppData.getSettings();

        self._wizardStep = 0;
        self._wizardData = {
            eligibleProjects: eligible,
            projectId: (params && params.projectId) || null,
            selectedExpenseIds: [],
            invoiceNumber: '',
            invoiceDate: Utils.today(),
            billingStart: '',
            billingEnd: '',
            paymentTerms: settings.defaultPaymentTerms || 'Net 30',
            notes: settings.defaultInvoiceNotes || '',
            enableHst: true,
            hstRate: settings.defaultHstRate != null ? settings.defaultHstRate : 13,
            enableHoldback: false,
            holdbackRate: 10
        };

        // If a project was pre-selected, pre-select all its expenses
        if (self._wizardData.projectId) {
            var expenses = AppData.getExpenses(self._wizardData.projectId).filter(function(e) {
                return e.billable !== false && !e.invoiced;
            });
            self._wizardData.selectedExpenseIds = expenses.map(function(e) { return e.id; });
        }

        self._renderWizard();
    },

    _renderWizard() {
        var self = this;
        var container = self._container;
        var wd = self._wizardData;
        var settings = AppData.getSettings();

        var stepTitles = ['Select Project', 'Select Expenses', 'Invoice Details', 'Preview'];

        container.innerHTML =
            '<div style="margin-bottom:16px"><button class="btn-ghost btn-sm" id="wizardCancel">&larr; Cancel</button></div>' +
            '<div style="display:flex;gap:4px;margin-bottom:20px">' +
                stepTitles.map(function(t, i) {
                    var active = i === self._wizardStep
                        ? 'background:var(--accent);color:#fff'
                        : (i < self._wizardStep ? 'background:var(--success);color:#fff' : 'background:var(--border);color:var(--text2)');
                    return '<div style="flex:1;padding:8px 4px;text-align:center;border-radius:var(--radius);font-size:.8rem;' + active + '">' + (i + 1) + '. ' + t + '</div>';
                }).join('') +
            '</div>' +
            '<div id="wizardStepContent" class="card"></div>' +
            '<div class="form-actions" style="justify-content:space-between" id="wizardNav"></div>';

        var stepEl = container.querySelector('#wizardStepContent');
        var navEl = container.querySelector('#wizardNav');

        container.querySelector('#wizardCancel').addEventListener('click', function() {
            window.App.navigate('invoices');
        });

        if (self._wizardStep === 0) {
            self._renderWizardStep0(stepEl, navEl, wd);
        } else if (self._wizardStep === 1) {
            self._renderWizardStep1(stepEl, navEl, wd, settings);
        } else if (self._wizardStep === 2) {
            self._renderWizardStep2(stepEl, navEl, wd, settings);
        } else if (self._wizardStep === 3) {
            self._renderWizardStep3(stepEl, navEl, wd, settings);
        }
    },

    _renderWizardStep0(stepEl, navEl, wd) {
        var self = this;
        var esc = Utils.escapeHtml;

        stepEl.innerHTML = '<h3 class="section-title">Select a Project</h3>' +
            '<p style="color:var(--text2);margin-bottom:12px">Choose a project that has billable expenses ready to invoice.</p>' +
            wd.eligibleProjects.map(function(p) {
                var expenses = AppData.getExpenses(p.id).filter(function(e) { return e.billable !== false && !e.invoiced; });
                var total = expenses.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
                var selected = wd.projectId === p.id ? 'border-color:var(--accent);background:rgba(233,69,96,.05)' : '';
                return '<div class="project-option" data-id="' + p.id + '" style="padding:16px;border:2px solid var(--border);border-radius:var(--radius);margin-bottom:8px;cursor:pointer;' + selected + '">' +
                    '<strong>' + esc(p.name) + '</strong>' +
                    '<div style="font-size:.85rem;color:var(--text2)">' + esc(p.clientName || p.client || '') + ' &mdash; ' + expenses.length + ' expenses &mdash; ' + Utils.formatCurrency(total) + '</div>' +
                '</div>';
            }).join('');

        stepEl.querySelectorAll('.project-option').forEach(function(el) {
            el.addEventListener('click', function() {
                stepEl.querySelectorAll('.project-option').forEach(function(o) {
                    o.style.borderColor = 'var(--border)';
                    o.style.background = '';
                });
                el.style.borderColor = 'var(--accent)';
                el.style.background = 'rgba(233,69,96,.05)';
                wd.projectId = el.dataset.id;
                // Pre-select all expenses
                var expenses = AppData.getExpenses(wd.projectId).filter(function(e) {
                    return e.billable !== false && !e.invoiced;
                });
                wd.selectedExpenseIds = expenses.map(function(e) { return e.id; });
            });
        });

        navEl.innerHTML = '<div></div><button class="btn-primary" id="wizNext">Next: Select Expenses</button>';
        navEl.querySelector('#wizNext').addEventListener('click', function() {
            if (!wd.projectId) { Utils.showToast('Please select a project', 'error'); return; }
            self._wizardStep = 1;
            self._renderWizard();
        });
    },

    _renderWizardStep1(stepEl, navEl, wd, settings) {
        var self = this;
        var esc = Utils.escapeHtml;
        var expenses = AppData.getExpenses(wd.projectId).filter(function(e) {
            return e.billable !== false && !e.invoiced;
        });

        // Build vendor list and apply filter
        var allVendors = [];
        expenses.forEach(function(e) {
            var vn = e.vendorName || e.vendor || '';
            if (vn && allVendors.indexOf(vn) === -1) allVendors.push(vn);
        });
        wd.vendorFilter = wd.vendorFilter !== undefined ? wd.vendorFilter : '';
        var filteredExpenses = wd.vendorFilter
            ? expenses.filter(function(e) {
                var vn = e.vendorName || e.vendor || '';
                return vn === wd.vendorFilter;
            })
            : expenses;

        var groups = { Labor: [], Equipment: [], Material: [] };
        filteredExpenses.forEach(function(e) {
            var cat = e.category || 'Material';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(e);
        });

        var vendorFilterHtml = allVendors.length > 0
            ? '<div style="margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
              '<label style="font-size:.85rem;color:var(--text-secondary);font-weight:500">Filter by vendor:</label>' +
              '<select id="wizVendorFilter" style="width:auto;min-width:160px">' +
              '<option value="">All Vendors</option>' +
              allVendors.map(function(v) {
                  return '<option value="' + esc(v) + '"' + (wd.vendorFilter === v ? ' selected' : '') + '>' + esc(v) + '</option>';
              }).join('') +
              '</select></div>'
            : '';

        stepEl.innerHTML = '<h3 class="section-title">Select Expenses to Include</h3>' + vendorFilterHtml;

        ['Labor', 'Equipment', 'Material'].forEach(function(cat) {
            var items = groups[cat];
            if (!items || items.length === 0) return;
            var catTotal = items.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
            var allChecked = items.every(function(e) { return wd.selectedExpenseIds.indexOf(e.id) !== -1; });
            stepEl.innerHTML +=
                '<h4 style="margin:16px 0 8px;color:var(--text2)">' + cat + ' (' + Utils.formatCurrency(catTotal) + ')</h4>' +
                '<table><thead><tr>' +
                    '<th style="width:30px"><input type="checkbox" class="select-cat" data-cat="' + cat + '"' + (allChecked ? ' checked' : '') + '></th>' +
                    '<th>Date</th><th>Description</th><th class="amount">Amount</th>' +
                '</tr></thead><tbody>' +
                items.map(function(e) {
                    var checked = wd.selectedExpenseIds.indexOf(e.id) !== -1 ? ' checked' : '';
                    var co = e.changeOrder ? ' <span style="color:var(--warn);font-size:.7rem;font-weight:700">CO</span>' : '';
                    var desc = '';
                    if (cat === 'Labor') {
                        var worker = e.workerId ? AppData.getWorker(e.workerId) : null;
                        desc = (worker ? esc(worker.name) + ' - ' : '') + esc(e.description);
                    } else {
                        var vendorDisplay = e.vendorName || e.vendor || '';
                        desc = (vendorDisplay ? esc(vendorDisplay) + ' - ' : '') + esc(e.description);
                    }
                    return '<tr>' +
                        '<td><input type="checkbox" class="expense-cb" data-id="' + e.id + '" data-cat="' + cat + '"' + checked + '></td>' +
                        '<td>' + Utils.formatDate(e.date) + '</td>' +
                        '<td>' + desc + co + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(e.amount) + '</td>' +
                    '</tr>';
                }).join('') + '</tbody></table>';
        });

        // Category select-all
        stepEl.querySelectorAll('.select-cat').forEach(function(cb) {
            cb.addEventListener('change', function() {
                var cat = cb.dataset.cat;
                stepEl.querySelectorAll('.expense-cb[data-cat="' + cat + '"]').forEach(function(ecb) {
                    ecb.checked = cb.checked;
                });
            });
        });

        // Vendor filter change handler
        var wizVendorFilter = stepEl.querySelector('#wizVendorFilter');
        if (wizVendorFilter) {
            wizVendorFilter.addEventListener('change', function() {
                wd.vendorFilter = this.value;
                self._renderWizardStep1(stepEl, navEl, wd, settings);
            });
        }

        navEl.innerHTML = '<button class="btn-secondary" id="wizPrev">Previous</button><button class="btn-primary" id="wizNext">Next: Invoice Details</button>';
        navEl.querySelector('#wizPrev').addEventListener('click', function() {
            self._wizardStep = 0;
            self._renderWizard();
        });
        navEl.querySelector('#wizNext').addEventListener('click', function() {
            wd.selectedExpenseIds = [];
            stepEl.querySelectorAll('.expense-cb:checked').forEach(function(cb) {
                wd.selectedExpenseIds.push(cb.dataset.id);
            });
            if (wd.selectedExpenseIds.length === 0) {
                Utils.showToast('Select at least one expense', 'error');
                return;
            }

            // Auto-compute billing period from selected expenses
            var selectedExpenses = AppData.getExpenses(wd.projectId).filter(function(e) {
                return wd.selectedExpenseIds.indexOf(e.id) !== -1;
            });
            var dates = selectedExpenses.map(function(e) { return e.date; }).filter(Boolean).sort();
            if (dates.length > 0) {
                wd.billingStart = wd.billingStart || dates[0];
                wd.billingEnd = wd.billingEnd || dates[dates.length - 1];
            }

            // Get invoice number if not yet assigned
            if (!wd.invoiceNumber) {
                wd.invoiceNumber = AppData.getNextInvoiceNumber();
            }

            // Defaults from settings
            wd.paymentTerms = wd.paymentTerms || settings.defaultPaymentTerms || 'Net 30';
            wd.notes = wd.notes || settings.defaultInvoiceNotes || '';
            wd.hstRate = settings.defaultHstRate != null ? settings.defaultHstRate : 13;

            self._wizardStep = 2;
            self._renderWizard();
        });
    },

    _renderWizardStep2(stepEl, navEl, wd, settings) {
        var self = this;
        var esc = Utils.escapeHtml;
        var project = AppData.getProject(wd.projectId);

        // Build line items preview from selected expenses
        var selectedExpenses = AppData.getExpenses(wd.projectId).filter(function(e) {
            return wd.selectedExpenseIds.indexOf(e.id) !== -1;
        });

        var lineItemsHtml = self._buildLineItemsTable(selectedExpenses);

        // Calculate totals
        var subtotal = selectedExpenses.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
        var hstAmount = wd.enableHst ? subtotal * (wd.hstRate / 100) : 0;
        var holdbackAmount = wd.enableHoldback ? subtotal * (wd.holdbackRate / 100) : 0;
        var total = subtotal + hstAmount;
        var netPayable = total - holdbackAmount;

        stepEl.innerHTML =
            '<h3 class="section-title">Invoice Details</h3>' +

            // Company info (read-only display)
            '<div style="background:var(--bg);padding:12px;border-radius:var(--radius);margin-bottom:16px;font-size:.85rem;color:var(--text2)">' +
                '<strong>From:</strong> ' + esc(settings.companyName) +
                (settings.address ? ', ' + esc(settings.address) : '') +
                (settings.city ? ', ' + esc(settings.city) : '') +
                (settings.hstNumber ? ' | HST: ' + esc(settings.hstNumber) : '') +
            '</div>' +

            // Client info (read-only display)
            '<div style="background:var(--bg);padding:12px;border-radius:var(--radius);margin-bottom:16px;font-size:.85rem;color:var(--text2)">' +
                '<strong>Bill To:</strong> ' + esc(project.clientName || project.client || '') +
                (project.clientAddress ? ', ' + esc(project.clientAddress) : '') +
                (project.clientPhone ? ' | Phone: ' + esc(project.clientPhone) : '') +
                (project.clientEmail ? ' | Email: ' + esc(project.clientEmail) : '') +
                (project.contractNumber ? '<br><strong>Contract/PO:</strong> ' + esc(project.contractNumber) : '') +
            '</div>' +

            // Editable fields
            '<div class="form-row">' +
                '<div class="form-group"><label>Invoice Number</label><input id="wizInvNum" value="' + esc(wd.invoiceNumber) + '" readonly></div>' +
                '<div class="form-group"><label>Invoice Date</label><input type="date" id="wizInvDate" value="' + (wd.invoiceDate || Utils.today()) + '"></div>' +
            '</div>' +
            '<div class="form-row">' +
                '<div class="form-group"><label>Billing Period Start</label><input type="date" id="wizBillingStart" value="' + (wd.billingStart || '') + '"></div>' +
                '<div class="form-group"><label>Billing Period End</label><input type="date" id="wizBillingEnd" value="' + (wd.billingEnd || '') + '"></div>' +
            '</div>' +

            // Line items table
            '<h4 style="margin:16px 0 8px;color:var(--text2)">Line Items</h4>' +
            lineItemsHtml +

            // Subtotal display
            '<div style="text-align:right;margin:12px 0;font-size:.9rem"><strong>Subtotal: ' + Utils.formatCurrency(subtotal) + '</strong></div>' +

            // HST toggle
            '<div class="form-row" style="align-items:center">' +
                '<div class="form-group"><div class="toggle-wrap">' +
                    '<label class="toggle"><input type="checkbox" id="wizHst" ' + (wd.enableHst ? 'checked' : '') + '><span class="slider"></span></label>' +
                    '<span>Apply HST</span>' +
                '</div></div>' +
                '<div class="form-group"><label>HST Rate (%)</label><input type="number" id="wizHstRate" step="0.01" min="0" max="100" value="' + wd.hstRate + '"></div>' +
            '</div>' +

            // Holdback toggle
            '<div class="form-row" style="align-items:center">' +
                '<div class="form-group"><div class="toggle-wrap">' +
                    '<label class="toggle"><input type="checkbox" id="wizHoldback" ' + (wd.enableHoldback ? 'checked' : '') + '><span class="slider"></span></label>' +
                    '<span>Statutory Holdback (Ontario Construction Act, 10%)</span>' +
                '</div></div>' +
                '<div class="form-group"><label>Holdback Rate (%)</label><input type="number" id="wizHoldbackRate" step="0.1" min="0" max="100" value="' + wd.holdbackRate + '"></div>' +
            '</div>' +

            // Totals summary
            '<div id="wizTotals" style="text-align:right;margin:12px 0;padding:12px;background:var(--bg);border-radius:var(--radius);font-size:.9rem">' +
                self._buildTotalsHtml(subtotal, wd.enableHst, wd.hstRate, wd.enableHoldback, wd.holdbackRate) +
            '</div>' +

            // Payment terms & notes
            '<div class="form-group" style="margin-bottom:12px"><label>Payment Terms</label><input id="wizPayTerms" value="' + esc(wd.paymentTerms) + '"></div>' +
            '<p style="font-size:.8rem;color:var(--text2);margin:-8px 0 12px">Under the Ontario Construction Act, the statutory payment period is 28 days from receipt of a proper invoice.</p>' +
            '<div class="form-group" style="margin-bottom:12px"><label>Notes</label><textarea id="wizNotes" rows="3">' + esc(wd.notes) + '</textarea></div>';

        // Live totals update
        var updateTotals = function() {
            var hstOn = stepEl.querySelector('#wizHst').checked;
            var hstR = parseFloat(stepEl.querySelector('#wizHstRate').value) || 0;
            var hbOn = stepEl.querySelector('#wizHoldback').checked;
            var hbR = parseFloat(stepEl.querySelector('#wizHoldbackRate').value) || 0;
            var totalsEl = stepEl.querySelector('#wizTotals');
            if (totalsEl) {
                totalsEl.innerHTML = self._buildTotalsHtml(subtotal, hstOn, hstR, hbOn, hbR);
            }
        };
        stepEl.querySelector('#wizHst').addEventListener('change', updateTotals);
        stepEl.querySelector('#wizHstRate').addEventListener('input', updateTotals);
        stepEl.querySelector('#wizHoldback').addEventListener('change', updateTotals);
        stepEl.querySelector('#wizHoldbackRate').addEventListener('input', updateTotals);

        navEl.innerHTML = '<button class="btn-secondary" id="wizPrev">Previous</button><button class="btn-primary" id="wizNext">Next: Preview</button>';
        navEl.querySelector('#wizPrev').addEventListener('click', function() {
            self._captureStep2Fields(stepEl, wd);
            self._wizardStep = 1;
            self._renderWizard();
        });
        navEl.querySelector('#wizNext').addEventListener('click', function() {
            self._captureStep2Fields(stepEl, wd);
            self._wizardStep = 3;
            self._renderWizard();
        });
    },

    _captureStep2Fields(stepEl, wd) {
        wd.invoiceNumber = stepEl.querySelector('#wizInvNum').value;
        wd.invoiceDate = stepEl.querySelector('#wizInvDate').value;
        wd.billingStart = stepEl.querySelector('#wizBillingStart').value;
        wd.billingEnd = stepEl.querySelector('#wizBillingEnd').value;
        wd.enableHst = stepEl.querySelector('#wizHst').checked;
        wd.hstRate = parseFloat(stepEl.querySelector('#wizHstRate').value) || 0;
        wd.enableHoldback = stepEl.querySelector('#wizHoldback').checked;
        wd.holdbackRate = parseFloat(stepEl.querySelector('#wizHoldbackRate').value) || 10;
        wd.paymentTerms = stepEl.querySelector('#wizPayTerms').value;
        wd.notes = stepEl.querySelector('#wizNotes').value;
    },

    _buildTotalsHtml(subtotal, hstOn, hstRate, hbOn, hbRate) {
        var hstAmt = hstOn ? subtotal * (hstRate / 100) : 0;
        var total = subtotal + hstAmt;
        var hbAmt = hbOn ? subtotal * (hbRate / 100) : 0;
        var net = total - hbAmt;

        var html = '<div><strong>Subtotal:</strong> ' + Utils.formatCurrency(subtotal) + '</div>';
        if (hstOn) {
            html += '<div>HST (' + hstRate + '%): ' + Utils.formatCurrency(hstAmt) + '</div>';
        }
        html += '<div><strong>Total:</strong> ' + Utils.formatCurrency(total) + '</div>';
        if (hbOn) {
            html += '<div>Statutory Holdback (' + hbRate + '%): -' + Utils.formatCurrency(hbAmt) + '</div>';
            html += '<div style="font-size:1.1rem;font-weight:700;color:var(--accent)">Net Payable: ' + Utils.formatCurrency(net) + '</div>';
        } else {
            html += '<div style="font-size:1.1rem;font-weight:700;color:var(--accent)">Total Due: ' + Utils.formatCurrency(total) + '</div>';
        }
        return html;
    },

    _buildLineItemsTable(expenses) {
        var esc = Utils.escapeHtml;
        var groups = { Labor: [], Equipment: [], Material: [] };
        expenses.forEach(function(e) {
            var cat = e.category || 'Material';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(e);
        });

        var html = '<table><thead><tr><th>Description</th><th>Category</th><th style="text-align:center">Qty/Hours</th><th class="amount">Rate</th><th class="amount">Amount</th></tr></thead><tbody>';

        ['Labor', 'Equipment', 'Material'].forEach(function(cat) {
            var items = groups[cat];
            if (!items || items.length === 0) return;
            items.forEach(function(item) {
                var co = item.changeOrder ? ' <span style="color:#e74c3c;font-size:.75rem">[Change Order]</span>' : '';
                var desc = '';
                if (cat === 'Labor') {
                    var worker = item.workerId ? AppData.getWorker(item.workerId) : null;
                    desc = (worker ? esc(worker.name) + ' - ' : '') + esc(item.description);
                } else {
                    var vd = item.vendorName || item.vendor || '';
                    desc = (vd ? esc(vd) + ' - ' : '') + esc(item.description);
                }
                var qtyCol = '';
                var rateCol = '';
                if (item.rateType !== 'flat' && item.hours) {
                    qtyCol = item.hours + ' hrs';
                    rateCol = Utils.formatCurrency(item.rate || 0) + '/hr';
                }
                html += '<tr>' +
                    '<td>' + desc + co + '</td>' +
                    '<td><span class="cat-badge cat-' + cat.toLowerCase() + '">' + cat + '</span></td>' +
                    '<td style="text-align:center">' + qtyCol + '</td>' +
                    '<td class="amount">' + rateCol + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(item.amount) + '</td>' +
                '</tr>';
            });
        });

        html += '</tbody></table>';
        return html;
    },

    _renderWizardStep3(stepEl, navEl, wd, settings) {
        var self = this;
        var preview = self._buildInvoicePreview(wd, settings);
        stepEl.innerHTML = '<h3 class="section-title">Invoice Preview</h3>' +
            '<p style="font-size:.85rem;color:var(--text2);margin-bottom:12px">Review the invoice below. This format meets Ontario Construction Act proper invoice requirements.</p>' +
            preview;

        navEl.innerHTML = '<button class="btn-secondary" id="wizPrev">Previous</button><button class="btn-primary" id="wizSave" style="background:var(--success)">Save Invoice</button>';
        navEl.querySelector('#wizPrev').addEventListener('click', function() {
            self._wizardStep = 2;
            self._renderWizard();
        });
        navEl.querySelector('#wizSave').addEventListener('click', function() {
            self._saveInvoice();
        });
    },

    _buildInvoicePreview(wd, settings) {
        if (!settings) settings = AppData.getSettings();
        var project = AppData.getProject(wd.projectId);
        var allExpenses = AppData.getExpenses(wd.projectId);
        var selectedExpenses = allExpenses.filter(function(e) { return wd.selectedExpenseIds.indexOf(e.id) !== -1; });
        var esc = Utils.escapeHtml;

        var groups = { Labor: [], Equipment: [], Material: [] };
        selectedExpenses.forEach(function(e) {
            var cat = e.category || 'Material';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(e);
        });

        var subtotal = selectedExpenses.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
        var hstAmount = wd.enableHst ? subtotal * (wd.hstRate / 100) : 0;
        var holdbackAmount = wd.enableHoldback ? subtotal * (wd.holdbackRate / 100) : 0;
        var total = subtotal + hstAmount;
        var netPayable = total - holdbackAmount;

        // Compute due date from payment terms
        var dueDate = '';
        var netDays = parseInt((wd.paymentTerms || '').replace(/[^0-9]/g, ''));
        if (netDays && wd.invoiceDate) {
            var d = new Date(wd.invoiceDate + 'T00:00:00');
            d.setDate(d.getDate() + netDays);
            dueDate = d.toISOString().split('T')[0];
        }

        // Build line items with proper descriptions
        var linesHtml = '';
        ['Labor', 'Equipment', 'Material'].forEach(function(cat) {
            var items = groups[cat];
            if (!items || items.length === 0) return;
            linesHtml += '<tr><td colspan="5" style="font-weight:700;padding-top:16px;border-bottom:none;color:#1a1a2e">' + cat + '</td></tr>';
            items.forEach(function(item) {
                var co = item.changeOrder ? ' <span style="color:#e74c3c;font-size:.75rem">[Change Order]</span>' : '';
                var desc = '';
                if (cat === 'Labor') {
                    var worker = item.workerId ? AppData.getWorker(item.workerId) : null;
                    desc = (worker ? esc(worker.name) + ' - ' : '') + esc(item.description);
                } else {
                    var vd2 = item.vendorName || item.vendor || '';
                    desc = (vd2 ? esc(vd2) + ' - ' : '') + esc(item.description);
                }
                var qtyRate = '';
                if (item.rateType !== 'flat' && item.hours) {
                    qtyRate = '<td style="text-align:center">' + item.hours + ' hrs</td><td class="amount">' + Utils.formatCurrency(item.rate || 0) + '/hr</td>';
                } else {
                    qtyRate = '<td></td><td></td>';
                }
                linesHtml += '<tr><td style="padding-left:20px">' + desc + co + '</td>' +
                    '<td>' + cat + '</td>' +
                    qtyRate +
                    '<td class="amount">' + Utils.formatCurrency(item.amount) + '</td></tr>';
            });
        });

        return '<div class="invoice-preview">' +
            // Header: Company info + Invoice title
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">' +
                '<div>' +
                    '<div class="company">' + esc(settings.companyName) + '</div>' +
                    '<div style="color:#888;font-size:.85rem;margin-top:4px">' +
                        [settings.address, settings.city, settings.province, settings.postalCode].filter(Boolean).join(', ') +
                    '</div>' +
                    (settings.phone ? '<div style="color:#888;font-size:.85rem">' + esc(settings.phone) + '</div>' : '') +
                    (settings.email ? '<div style="color:#888;font-size:.85rem">' + esc(settings.email) + '</div>' : '') +
                    (settings.hstNumber ? '<div style="color:#888;font-size:.85rem">HST: ' + esc(settings.hstNumber) + '</div>' : '') +
                '</div>' +
                '<div style="text-align:right">' +
                    '<h2>INVOICE</h2>' +
                    '<div style="font-size:1.1rem;color:#e94560;font-weight:700">' + esc(wd.invoiceNumber || '') + '</div>' +
                    '<div style="font-size:.9rem;color:#555;margin-top:4px">Date: ' + Utils.formatDate(wd.invoiceDate) + '</div>' +
                    (wd.billingStart && wd.billingEnd ? '<div style="font-size:.85rem;color:#555">Period: ' + Utils.formatDate(wd.billingStart) + ' - ' + Utils.formatDate(wd.billingEnd) + '</div>' : '') +
                '</div>' +
            '</div>' +

            // Bill To / Project / Contract meta
            '<div class="invoice-meta">' +
                '<div><strong>Bill To</strong>' + esc(project.clientName || project.client || '') +
                    (project.clientAddress ? '<br>' + esc(project.clientAddress) : '') +
                    (project.clientCity ? '<br>' + esc(project.clientCity) + (project.clientProvince ? ', ' + esc(project.clientProvince) : '') + (project.clientPostalCode ? ' ' + esc(project.clientPostalCode) : '') : '') +
                    (project.clientPhone ? '<br>' + esc(project.clientPhone) : '') +
                    (project.clientEmail ? '<br>' + esc(project.clientEmail) : '') +
                '</div>' +
                '<div><strong>Project</strong>' + esc(project.name) +
                    (project.jobSiteAddress ? '<br>' + esc(project.jobSiteAddress) : '') +
                '</div>' +
                (project.contractNumber ? '<div><strong>Contract/PO</strong>' + esc(project.contractNumber) + '</div>' : '') +
            '</div>' +

            // Line items
            '<table><thead><tr><th>Description</th><th>Category</th><th style="text-align:center">Qty/Hours</th><th class="amount">Rate</th><th class="amount">Amount</th></tr></thead><tbody>' +
            linesHtml + '</tbody></table>' +

            // Totals
            '<div class="invoice-totals">' +
                '<div class="total-line"><span>Subtotal</span><span>' + Utils.formatCurrency(subtotal) + '</span></div>' +
                (wd.enableHst ? '<div class="total-line"><span>HST (' + wd.hstRate + '%)</span><span>' + Utils.formatCurrency(hstAmount) + '</span></div>' : '') +
                '<div class="total-line" style="font-weight:700"><span>Total</span><span>' + Utils.formatCurrency(total) + '</span></div>' +
                (wd.enableHoldback
                    ? '<div class="total-line"><span>Statutory Holdback (' + wd.holdbackRate + '%)</span><span>-' + Utils.formatCurrency(holdbackAmount) + '</span></div>' +
                      '<div class="total-line grand-total"><span>Net Payable</span><span>' + Utils.formatCurrency(netPayable) + '</span></div>'
                    : '<div class="total-line grand-total"><span>Total Due</span><span>' + Utils.formatCurrency(total) + '</span></div>'
                ) +
            '</div>' +

            // Payment terms
            (wd.paymentTerms ? '<div style="margin-top:20px;font-size:.9rem;color:#555"><strong>Payment Terms:</strong> ' + esc(wd.paymentTerms) +
                (dueDate ? ' (Due: ' + Utils.formatDate(dueDate) + ')' : '') +
                '<br><span style="font-size:.8rem;color:#888">Note: Under the Ontario Construction Act, the statutory payment period is 28 days from receipt of a proper invoice.</span>' +
            '</div>' : '') +

            // Notes
            (wd.notes ? '<div style="margin-top:8px;font-size:.9rem;color:#555"><strong>Notes:</strong> ' + esc(wd.notes) + '</div>' : '') +

            // Payment contact
            (settings.contactName || settings.phone || settings.email
                ? '<div style="margin-top:16px;padding:12px;background:#f8f9fa;border-radius:4px;font-size:.85rem;color:#555">' +
                    '<strong>Payment Contact:</strong><br>' +
                    (settings.contactName ? esc(settings.contactName) + (settings.contactTitle ? ', ' + esc(settings.contactTitle) : '') + '<br>' : esc(settings.companyName) + '<br>') +
                    (settings.phone ? 'Phone: ' + esc(settings.phone) + '<br>' : '') +
                    (settings.email ? 'Email: ' + esc(settings.email) + '<br>' : '') +
                    (settings.address ? 'Mail: ' + [settings.address, settings.city, settings.province, settings.postalCode].filter(Boolean).join(', ') : '') +
                '</div>'
                : '') +

            // Holdback notice
            (wd.enableHoldback
                ? '<div style="margin-top:16px;padding:12px;background:#fff3cd;border-radius:4px;font-size:.85rem;color:#856404">' +
                    '<strong>Statutory Holdback Notice:</strong> In accordance with the Ontario Construction Act, ' +
                    wd.holdbackRate + '% of the contract price is held back. The holdback amount of ' +
                    Utils.formatCurrency(holdbackAmount) + ' will be released as required by the Act.' +
                '</div>'
                : '') +

            // Compliance footer
            '<div style="margin-top:20px;padding-top:12px;border-top:1px solid #dee2e6;font-size:.8rem;color:#aaa;text-align:center">' +
                'This invoice constitutes a proper invoice under Section 6.1 of the Ontario Construction Act, 2017.' +
            '</div>' +
        '</div>';
    },

    _saveInvoice() {
        var self = this;
        var wd = self._wizardData;
        var project = AppData.getProject(wd.projectId);
        var allExpenses = AppData.getExpenses(wd.projectId);
        var selectedExpenses = allExpenses.filter(function(e) { return wd.selectedExpenseIds.indexOf(e.id) !== -1; });
        var settings = AppData.getSettings();

        var subtotal = selectedExpenses.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
        var hstAmount = wd.enableHst ? subtotal * (wd.hstRate / 100) : 0;
        var holdbackAmount = wd.enableHoldback ? subtotal * (wd.holdbackRate / 100) : 0;
        var total = subtotal + hstAmount;
        var netPayable = total - holdbackAmount;

        var dueDate = '';
        var netDays = parseInt((wd.paymentTerms || '').replace(/[^0-9]/g, ''));
        if (netDays && wd.invoiceDate) {
            var d = new Date(wd.invoiceDate + 'T00:00:00');
            d.setDate(d.getDate() + netDays);
            dueDate = d.toISOString().split('T')[0];
        }

        var invoice = {
            id: AppData.generateId(),
            invoiceNumber: wd.invoiceNumber || AppData.getNextInvoiceNumber(),
            projectId: wd.projectId,
            projectName: project.name,
            clientName: project.clientName || project.client || '',
            clientAddress: project.clientAddress || '',
            clientPhone: project.clientPhone || '',
            clientEmail: project.clientEmail || '',
            clientCity: project.clientCity || '',
            clientProvince: project.clientProvince || '',
            clientPostalCode: project.clientPostalCode || '',
            contractReference: project.contractNumber || '',
            invoiceDate: wd.invoiceDate || Utils.today(),
            date: wd.invoiceDate || Utils.today(),
            dueDate: dueDate,
            billingPeriodStart: wd.billingStart || '',
            billingPeriodEnd: wd.billingEnd || '',
            billingStart: wd.billingStart || '',
            billingEnd: wd.billingEnd || '',
            lineItems: selectedExpenses.map(function(e) {
                var worker = e.workerId ? AppData.getWorker(e.workerId) : null;
                var desc = '';
                if (e.category === 'Labor') {
                    desc = (worker ? worker.name + ' - ' : '') + e.description;
                } else {
                    desc = (e.vendor ? e.vendor + ' - ' : '') + e.description;
                }
                return {
                    expenseId: e.id,
                    description: desc,
                    category: e.category || 'Material',
                    quantity: e.hours || 1,
                    rate: e.rate || e.amount || 0,
                    amount: parseFloat(e.amount) || 0,
                    isChangeOrder: e.changeOrder || false,
                    hours: e.hours,
                    rateType: e.rateType,
                    workerId: e.workerId || '',
                    vendor: e.vendor || ''
                };
            }),
            items: selectedExpenses.map(function(e) {
                return {
                    id: e.id,
                    description: e.description,
                    category: e.category,
                    amount: parseFloat(e.amount) || 0,
                    date: e.date,
                    changeOrder: e.changeOrder || false,
                    hours: e.hours,
                    rate: e.rate,
                    rateType: e.rateType,
                    workerId: e.workerId || '',
                    vendor: e.vendor || ''
                };
            }),
            subtotal: subtotal,
            hstEnabled: wd.enableHst,
            hstRate: wd.hstRate,
            hstAmount: hstAmount,
            hst: hstAmount,
            holdbackEnabled: wd.enableHoldback,
            holdbackRate: wd.holdbackRate,
            holdbackAmount: holdbackAmount,
            holdback: holdbackAmount,
            total: total,
            netPayable: netPayable,
            paymentTerms: wd.paymentTerms || '',
            notes: wd.notes || '',
            companyName: settings.companyName || '',
            companyAddress: [settings.address, settings.city, settings.province, settings.postalCode].filter(Boolean).join(', '),
            companyPhone: settings.phone || '',
            companyEmail: settings.email || '',
            hstNumber: settings.hstNumber || '',
            status: 'Unpaid',
            createdAt: new Date().toISOString()
        };

        AppData.saveInvoice(invoice);

        // Mark expenses as invoiced
        selectedExpenses.forEach(function(e) {
            e.invoiced = true;
            e.invoiceId = invoice.id;
            AppData.saveExpense(e);
        });

        var username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
        AppData.addAuditLog(username, 'Invoice Created', invoice.invoiceNumber + ' - ' + Utils.formatCurrency(total) + ' for ' + project.name);

        Utils.showToast('Invoice ' + invoice.invoiceNumber + ' created!');
        self._wizardData = null;
        window.App.navigate('invoice-detail', { invoiceId: invoice.id });
    },

    // ============ INVOICE DETAIL VIEW ============

    renderDetail(container, invoiceId) {
        var self = this;
        self._container = container;
        var inv = AppData.getInvoice(invoiceId);
        if (!inv) {
            Utils.showToast('Invoice not found', 'error');
            window.App.navigate('invoices');
            return;
        }

        var settings = AppData.getSettings();
        var payments = AppData.getPayments(inv.id);
        var totalPaid = payments.reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
        var balance = (parseFloat(inv.total) || 0) - totalPaid;
        var esc = Utils.escapeHtml;
        var project = AppData.getProject(inv.projectId) || {};

        // Compute displayed status
        var statusLabel = 'Unpaid';
        var statusStyle = 'background:rgba(52,152,219,.2);color:#5dade2';
        if (balance <= 0.01) {
            statusLabel = 'Paid';
            statusStyle = 'background:rgba(46,204,113,.2);color:var(--success)';
        } else if (totalPaid > 0.01) {
            statusLabel = 'Partially Paid';
            statusStyle = 'background:rgba(243,156,18,.2);color:var(--warn)';
        } else if (inv.dueDate && new Date(inv.dueDate) < new Date()) {
            statusLabel = 'Overdue';
            statusStyle = 'background:rgba(233,69,96,.2);color:var(--accent)';
        }

        // Build line items from whichever items array is available
        var invoiceItems = inv.lineItems || inv.items || [];
        var linesHtml = '';
        var groups = { Labor: [], Equipment: [], Material: [] };
        invoiceItems.forEach(function(item) {
            var cat = item.category || 'Material';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });

        ['Labor', 'Equipment', 'Material'].forEach(function(cat) {
            var items = groups[cat];
            if (!items || items.length === 0) return;
            linesHtml += '<tr><td colspan="5" style="font-weight:700;padding-top:16px;border-bottom:none;color:#1a1a2e">' + cat + '</td></tr>';
            items.forEach(function(item) {
                var co = (item.isChangeOrder || item.changeOrder) ? ' <span style="color:#e74c3c;font-size:.75rem">[Change Order]</span>' : '';
                var desc = esc(item.description || '');
                // If description doesn't already include worker/vendor info, prepend it
                if (cat === 'Labor' && item.workerId && desc.indexOf(' - ') === -1) {
                    var worker = AppData.getWorker(item.workerId);
                    if (worker) desc = esc(worker.name) + ' - ' + desc;
                } else if ((cat === 'Equipment' || cat === 'Material') && item.vendor && desc.indexOf(' - ') === -1) {
                    desc = esc(item.vendor) + ' - ' + desc;
                }
                var qtyRate = '';
                if (item.rateType !== 'flat' && item.hours) {
                    qtyRate = '<td style="text-align:center">' + item.hours + ' hrs</td><td class="amount">' + Utils.formatCurrency(item.rate || 0) + '/hr</td>';
                } else if (item.quantity && item.quantity !== 1 && item.rate) {
                    qtyRate = '<td style="text-align:center">' + item.quantity + '</td><td class="amount">' + Utils.formatCurrency(item.rate) + '</td>';
                } else {
                    qtyRate = '<td></td><td></td>';
                }
                linesHtml += '<tr><td style="padding-left:20px">' + desc + co + '</td><td>' + cat + '</td>' + qtyRate + '<td class="amount">' + Utils.formatCurrency(item.amount) + '</td></tr>';
            });
        });

        // Get invoice date fields (support both field naming conventions)
        var invoiceDate = inv.invoiceDate || inv.date || '';
        var billingStart = inv.billingPeriodStart || inv.billingStart || '';
        var billingEnd = inv.billingPeriodEnd || inv.billingEnd || '';
        var contractRef = inv.contractReference || inv.contractNumber || '';

        // Build email mailto link
        var emailSubject = encodeURIComponent('Invoice ' + (inv.invoiceNumber || '') + ' - ' + (settings.companyName || ''));
        var emailBody = encodeURIComponent(
            'Please find attached invoice ' + (inv.invoiceNumber || '') +
            ' dated ' + Utils.formatDate(invoiceDate) +
            ' for ' + Utils.formatCurrency(inv.total) + '.\n\n' +
            'Thank you,\n' + (settings.companyName || '')
        );
        var clientEmail = inv.clientEmail || project.clientEmail || '';

        container.innerHTML =
            // Action buttons (hidden on print)
            '<div class="no-print-actions">' +
                '<button class="btn-ghost btn-sm" id="backToInvoices">&larr; Back to Invoices</button>' +
                '<button class="btn-primary btn-sm" id="printInvoice">Print / Export PDF</button>' +
                '<button class="btn-secondary btn-sm" id="emailInvoice">Email Invoice</button>' +
                (balance > 0.01 ? '<button class="btn-sm" id="recordPaymentBtn" style="background:var(--success);color:#fff">Record Payment</button>' : '') +
            '</div>' +

            // Status bar
            '<div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">' +
                '<span style="font-size:.85rem;padding:4px 12px;border-radius:12px;' + statusStyle + '">' + statusLabel + '</span>' +
                '<span style="font-size:.9rem;color:var(--text2)">Balance: <strong style="color:var(--text)">' + Utils.formatCurrency(balance) + '</strong></span>' +
            '</div>' +

            // Invoice card
            '<div class="card">' +
                '<div class="invoice-preview">' +
                    // Company header
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">' +
                        '<div>' +
                            '<div id="invoiceLogoArea"></div>' +
                            '<div class="company">' + esc(inv.companyName || settings.companyName) + '</div>' +
                            '<div style="color:#888;font-size:.85rem;margin-top:4px">' +
                                (inv.companyAddress || [settings.address, settings.city, settings.province, settings.postalCode].filter(Boolean).join(', ')) +
                            '</div>' +
                            (function() {
                                var phone = inv.companyPhone || settings.phone;
                                var email = inv.companyEmail || settings.email;
                                var hst = inv.hstNumber || settings.hstNumber;
                                return (phone ? '<div style="color:#888;font-size:.85rem">' + esc(phone) + '</div>' : '') +
                                    (email ? '<div style="color:#888;font-size:.85rem">' + esc(email) + '</div>' : '') +
                                    (hst ? '<div style="color:#888;font-size:.85rem">HST: ' + esc(hst) + '</div>' : '');
                            })() +
                        '</div>' +
                        '<div style="text-align:right">' +
                            '<h2>INVOICE</h2>' +
                            '<div style="font-size:1.1rem;color:#e94560;font-weight:700">' + esc(inv.invoiceNumber) + '</div>' +
                            '<div style="font-size:.9rem;color:#555;margin-top:4px">Date: ' + Utils.formatDate(invoiceDate) + '</div>' +
                            (billingStart && billingEnd ? '<div style="font-size:.85rem;color:#555">Period: ' + Utils.formatDate(billingStart) + ' - ' + Utils.formatDate(billingEnd) + '</div>' : '') +
                        '</div>' +
                    '</div>' +

                    // Contract/Authority reference
                    (contractRef ? '<div style="margin-top:12px;font-size:.9rem;color:#555"><strong>Contract/Authority Reference:</strong> ' + esc(contractRef) + '</div>' : '') +

                    // Bill To / Project
                    '<div class="invoice-meta">' +
                        '<div><strong>Bill To</strong>' +
                            esc(inv.clientName || inv.client || '') +
                            (inv.clientAddress ? '<br>' + esc(inv.clientAddress) : '') +
                            ((inv.clientCity || project.clientCity) ? '<br>' + esc(inv.clientCity || project.clientCity) +
                                ((inv.clientProvince || project.clientProvince) ? ', ' + esc(inv.clientProvince || project.clientProvince) : '') +
                                ((inv.clientPostalCode || project.clientPostalCode) ? ' ' + esc(inv.clientPostalCode || project.clientPostalCode) : '')
                            : '') +
                            ((inv.clientPhone || project.clientPhone) ? '<br>' + esc(inv.clientPhone || project.clientPhone) : '') +
                            ((inv.clientEmail || project.clientEmail) ? '<br>' + esc(inv.clientEmail || project.clientEmail) : '') +
                        '</div>' +
                        '<div><strong>Project</strong>' + esc(inv.projectName || '') +
                            (project.jobSiteAddress ? '<br>' + esc(project.jobSiteAddress) : '') +
                        '</div>' +
                    '</div>' +

                    // Line items table
                    '<table>' +
                        '<thead><tr><th>Description</th><th>Category</th><th style="text-align:center">Qty/Hours</th><th class="amount">Rate</th><th class="amount">Amount</th></tr></thead>' +
                        '<tbody>' + linesHtml + '</tbody>' +
                    '</table>' +

                    // Totals
                    '<div class="invoice-totals">' +
                        '<div class="total-line"><span>Subtotal</span><span>' + Utils.formatCurrency(inv.subtotal) + '</span></div>' +
                        (inv.hstEnabled ? '<div class="total-line"><span>HST (' + inv.hstRate + '%)</span><span>' + Utils.formatCurrency(inv.hstAmount || inv.hst) + '</span></div>' : '') +
                        '<div class="total-line" style="font-weight:700"><span>Total</span><span>' + Utils.formatCurrency(inv.total) + '</span></div>' +
                        (inv.holdbackEnabled
                            ? '<div class="total-line"><span>Statutory Holdback (' + inv.holdbackRate + '%)</span><span>-' + Utils.formatCurrency(inv.holdbackAmount || inv.holdback) + '</span></div>' +
                              '<div class="total-line grand-total"><span>Net Payable</span><span>' + Utils.formatCurrency(inv.netPayable) + '</span></div>'
                            : '<div class="total-line grand-total"><span>Total Due</span><span>' + Utils.formatCurrency(inv.total) + '</span></div>'
                        ) +
                    '</div>' +

                    // Payment terms
                    (inv.paymentTerms ? '<div style="margin-top:20px;font-size:.9rem;color:#555"><strong>Payment Terms:</strong> ' + esc(inv.paymentTerms) +
                        (inv.dueDate ? ' (Due: ' + Utils.formatDate(inv.dueDate) + ')' : '') +
                        '<br><span style="font-size:.8rem;color:#888">Note: Under the Ontario Construction Act, the statutory payment period is 28 days from receipt of a proper invoice.</span>' +
                    '</div>' : '') +

                    // Notes
                    (inv.notes ? '<div style="margin-top:8px;font-size:.9rem;color:#555"><strong>Notes:</strong> ' + esc(inv.notes) + '</div>' : '') +

                    // Payment contact info
                    '<div style="margin-top:16px;padding:12px;background:#f8f9fa;border-radius:4px;font-size:.85rem;color:#555">' +
                        '<strong>Payment Contact:</strong><br>' +
                        (settings.contactName ? esc(settings.contactName) + (settings.contactTitle ? ', ' + esc(settings.contactTitle) : '') + '<br>' : esc(settings.companyName || inv.companyName || '') + '<br>') +
                        ((settings.phone || inv.companyPhone) ? 'Phone: ' + esc(settings.phone || inv.companyPhone) + '<br>' : '') +
                        ((settings.email || inv.companyEmail) ? 'Email: ' + esc(settings.email || inv.companyEmail) + '<br>' : '') +
                        (settings.address ? 'Mail: ' + [settings.address, settings.city, settings.province, settings.postalCode].filter(Boolean).join(', ') : '') +
                    '</div>' +

                    // Holdback notice
                    (inv.holdbackEnabled
                        ? '<div style="margin-top:16px;padding:12px;background:#fff3cd;border-radius:4px;font-size:.85rem;color:#856404">' +
                            '<strong>Statutory Holdback Notice:</strong> In accordance with the Ontario Construction Act, ' +
                            inv.holdbackRate + '% of the contract price is held back. The holdback amount of ' +
                            Utils.formatCurrency(inv.holdbackAmount || inv.holdback) + ' will be released as required by the Act.' +
                        '</div>'
                        : '') +

                    // Compliance footer
                    '<div style="margin-top:20px;padding-top:12px;border-top:1px solid #dee2e6;font-size:.8rem;color:#aaa;text-align:center">' +
                        'This invoice constitutes a proper invoice under Section 6.1 of the Ontario Construction Act, 2017.' +
                    '</div>' +

                '</div>' +
            '</div>' +

            // Payment History section
            (payments.length > 0
                ? '<div class="card" style="margin-top:16px">' +
                    '<h3 class="section-title">Payment History</h3>' +
                    '<table><thead><tr><th>Date</th><th>Method</th><th class="amount">Amount</th><th>Notes</th></tr></thead><tbody>' +
                    payments.map(function(p) {
                        return '<tr>' +
                            '<td>' + Utils.formatDate(p.date) + '</td>' +
                            '<td>' + esc(p.method || '') + '</td>' +
                            '<td class="amount">' + Utils.formatCurrency(p.amount) + '</td>' +
                            '<td style="font-size:.85rem;color:var(--text2)">' + esc(p.notes || '') + '</td>' +
                        '</tr>';
                    }).join('') +
                    '<tr style="font-weight:700"><td colspan="2">Total Paid</td><td class="amount">' + Utils.formatCurrency(totalPaid) + '</td><td></td></tr>' +
                    '<tr style="font-weight:700"><td colspan="2">Outstanding Balance</td><td class="amount" style="color:' + (balance > 0.01 ? 'var(--accent)' : 'var(--success)') + '">' + Utils.formatCurrency(balance) + '</td><td></td></tr>' +
                    '</tbody></table>' +
                '</div>'
                : '') +

            // Record Payment form (inline when no payments yet and balance > 0)
            (payments.length === 0 && balance > 0.01
                ? '<div class="card" style="margin-top:16px">' +
                    '<h3 class="section-title">Payment Status</h3>' +
                    '<p style="color:var(--text2)">No payments have been recorded for this invoice. Outstanding balance: <strong>' + Utils.formatCurrency(balance) + '</strong></p>' +
                '</div>'
                : '');

        // Load company logo into invoice
        AppData.getLogo().then(function(logo) {
            if (logo && logo.blob) {
                var logoArea = container.querySelector('#invoiceLogoArea');
                if (logoArea) {
                    var url = URL.createObjectURL(logo.blob);
                    logoArea.innerHTML = '<img src="' + url + '" alt="Logo" style="max-height:60px;margin-bottom:8px">';
                }
            }
        }).catch(function() {});

        // Event handlers
        container.querySelector('#backToInvoices').addEventListener('click', function() {
            window.App.navigate('invoices');
        });

        container.querySelector('#printInvoice').addEventListener('click', function() {
            window.print();
        });

        container.querySelector('#emailInvoice').addEventListener('click', function() {
            window.open('mailto:' + encodeURIComponent(clientEmail) + '?subject=' + emailSubject + '&body=' + emailBody);
        });

        var payBtn = container.querySelector('#recordPaymentBtn');
        if (payBtn) {
            payBtn.addEventListener('click', function() {
                self._showPaymentModal(inv.id, balance, function() {
                    self.renderDetail(container, invoiceId);
                });
            });
        }
    },

    // ============ PAYMENT MODAL ============

    _showPaymentModal(invoiceId, maxAmount, onComplete) {
        var self = this;
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML =
            '<div class="modal" style="max-width:450px">' +
                '<h3>Record Payment</h3>' +
                '<form id="paymentForm" novalidate>' +
                    '<div class="form-row">' +
                        '<div class="form-group">' +
                            '<label>Payment Date *</label>' +
                            '<input type="date" name="date" value="' + Utils.today() + '" required>' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>Amount ($) *</label>' +
                            '<input type="number" name="amount" step="0.01" min="0.01" max="' + maxAmount.toFixed(2) + '" value="' + maxAmount.toFixed(2) + '" required>' +
                        '</div>' +
                    '</div>' +
                    '<div class="form-group" style="margin-bottom:12px">' +
                        '<label>Payment Method</label>' +
                        '<select name="method">' +
                            '<option value="Cheque">Cheque</option>' +
                            '<option value="E-Transfer">E-Transfer</option>' +
                            '<option value="Cash">Cash</option>' +
                            '<option value="Other">Other</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="form-group" style="margin-bottom:12px">' +
                        '<label>Notes</label>' +
                        '<textarea name="notes" rows="2"></textarea>' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button type="submit" class="btn-primary">Record Payment</button>' +
                        '<button type="button" class="btn-secondary modal-close">Cancel</button>' +
                    '</div>' +
                '</form>' +
            '</div>';

        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('.modal-close').addEventListener('click', function() { overlay.remove(); });

        overlay.querySelector('#paymentForm').addEventListener('submit', function(e) {
            e.preventDefault();
            if (!Utils.validateForm(this)) return;
            var fd = Utils.getFormData(this);
            var amount = parseFloat(fd.amount);
            if (!amount || amount <= 0) {
                Utils.showToast('Enter a valid amount', 'error');
                return;
            }

            var payment = {
                id: AppData.generateId(),
                invoiceId: invoiceId,
                date: fd.date || Utils.today(),
                amount: amount,
                method: fd.method || 'Other',
                notes: (fd.notes || '').trim()
            };
            AppData.savePayment(payment);

            // Update invoice status
            var inv = AppData.getInvoice(invoiceId);
            if (inv) {
                var allPayments = AppData.getPayments(invoiceId);
                var totalPaid = allPayments.reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
                if (totalPaid >= (parseFloat(inv.total) || 0) - 0.01) {
                    inv.status = 'Paid';
                } else {
                    inv.status = 'Partially Paid';
                }
                AppData.saveInvoice(inv);
            }

            var username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, 'Payment Recorded', Utils.formatCurrency(amount) + ' via ' + payment.method + ' for invoice ' + (inv ? inv.invoiceNumber : ''));
            Utils.showToast('Payment of ' + Utils.formatCurrency(amount) + ' recorded');
            overlay.remove();

            if (onComplete) onComplete();
        });
    }
};
