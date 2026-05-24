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
                    '<button class="btn-secondary btn-sm" id="invoicesExportCsvBtn">Export CSV</button>' +
                    '<button class="btn-secondary btn-sm" id="invoicesPrintBtn">Print / PDF</button>' +
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

        container.querySelector('#invoicesExportCsvBtn').addEventListener('click', function() {
            var rows = [csvRow(['Invoice #','Project','Client','Date','Due Date','Total','Paid','Balance','Status'])];
            filtered.forEach(function(inv) {
                rows.push(csvRow([
                    inv.invoiceNumber || '',
                    inv.projectName || '',
                    inv.clientName || inv.client || '',
                    inv.date || inv.invoiceDate || '',
                    inv.dueDate || '',
                    inv.total || '',
                    inv.totalPaid || '',
                    inv.balance || '',
                    inv.computedStatus || ''
                ]));
            });
            downloadCsv(rows.join('\n'), 'invoices');
        });

        container.querySelector('#invoicesPrintBtn').addEventListener('click', function() {
            if (!document.getElementById('invoicesPrintStyle')) {
                var s = document.createElement('style');
                s.id = 'invoicesPrintStyle';
                s.textContent = '@media print { .admin-nav,.worker-nav,#adminSidebar,.btn-primary,.btn-secondary,.tab-btn,#pageHelpBtn { display:none!important; } body { font-size:11pt; } .card { box-shadow:none; border:1px solid #ddd; } }';
                document.head.appendChild(s);
            }
            window.print();
        });

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

    // ============ SHARED INVOICE DOCUMENT RENDERER ============
    // Produces the professional inv-doc HTML used by both the
    // wizard preview and the saved-invoice detail view.
    // inv must contain all invoice fields; settings is the
    // current company settings object.

    _buildInvoiceDocument(inv, settings) {
        var esc = Utils.escapeHtml;
        if (!settings) settings = AppData.getSettings();

        // Company details (prefer saved values on invoice, fall back to settings)
        var companyName  = inv.companyName  || settings.companyName  || '';
        var companyAddr  = inv.companyAddress || [settings.address, settings.city, settings.province, settings.postalCode].filter(Boolean).join(', ');
        var companyPhone = inv.companyPhone  || settings.phone  || '';
        var companyEmail = inv.companyEmail  || settings.email  || '';
        var hstNum       = inv.hstNumber     || settings.hstNumber || '';

        // Invoice metadata
        var invNum       = inv.invoiceNumber  || '';
        var invDate      = inv.invoiceDate || inv.date || '';
        var billingStart = inv.billingPeriodStart || inv.billingStart || '';
        var billingEnd   = inv.billingPeriodEnd   || inv.billingEnd   || '';

        // Client info
        var clientName   = inv.clientName || inv.client || '';
        var clientParts  = [];
        if (inv.clientAddress) clientParts.push(esc(inv.clientAddress));
        var cityLine = [inv.clientCity, inv.clientProvince ? (inv.clientProvince + (inv.clientPostalCode ? ' ' + inv.clientPostalCode : '')) : inv.clientPostalCode].filter(Boolean).join(', ');
        if (cityLine) clientParts.push(esc(cityLine));
        if (inv.clientPhone) clientParts.push(esc(inv.clientPhone));
        if (inv.clientEmail) clientParts.push(esc(inv.clientEmail));
        var clientAddrHtml = clientParts.join('<br>');

        // Project
        var projectName = inv.projectName   || '';
        var jobSiteAddr = inv.jobSiteAddress || '';

        // Contract reference
        var contractRef = inv.contractReference || inv.contractNumber || '';

        // ── Line items grouped by category ──────────────────
        var lineItems = inv.lineItems || inv.items || [];
        var groups = { Labor: [], Equipment: [], Material: [] };
        lineItems.forEach(function(item) {
            var cat = item.category || 'Material';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });

        var linesHtml = '';
        ['Labor', 'Equipment', 'Material'].forEach(function(cat) {
            var items = groups[cat];
            if (!items || items.length === 0) return;
            linesHtml += '<tr class="inv-cat-row"><td colspan="5">' + cat + '</td></tr>';
            items.forEach(function(item) {
                var co = (item.isChangeOrder || item.changeOrder)
                    ? ' <span class="inv-co-badge">CO</span>' : '';
                var desc = esc(item.description || '');
                var qtyCell  = '';
                var rateCell = '';
                if (item.rateType !== 'flat' && item.hours) {
                    qtyCell  = esc(String(item.hours)) + ' hrs';
                    rateCell = Utils.formatCurrency(item.rate || 0) + '/hr';
                } else if (item.quantity && item.quantity !== 1 && item.rate) {
                    qtyCell  = esc(String(item.quantity));
                    rateCell = Utils.formatCurrency(item.rate);
                }
                linesHtml +=
                    '<tr class="inv-line-row">' +
                        '<td class="inv-td-desc">' + desc + co + '</td>' +
                        '<td class="inv-td-cat"><span class="inv-cat-tag inv-cat-' + cat.toLowerCase() + '">' + cat + '</span></td>' +
                        '<td class="inv-td-qty">'  + qtyCell  + '</td>' +
                        '<td class="inv-td-rate">' + rateCell + '</td>' +
                        '<td class="inv-td-amt">'  + Utils.formatCurrency(item.amount) + '</td>' +
                    '</tr>';
            });
        });

        // ── Totals ───────────────────────────────────────────
        var subtotal   = parseFloat(inv.subtotal) || 0;
        var hstEnabled = inv.hstEnabled;
        var hstRate    = parseFloat(inv.hstRate) || 13;
        var hstAmt     = parseFloat(inv.hstAmount || inv.hst) || 0;
        var hbEnabled  = inv.holdbackEnabled;
        var hbRate     = parseFloat(inv.holdbackRate) || 10;
        var hbAmt      = parseFloat(inv.holdbackAmount || inv.holdback) || 0;
        var total      = parseFloat(inv.total) || 0;
        var netPayable = parseFloat(inv.netPayable) || total;

        var totalsHtml =
            '<tr>' +
                '<td class="inv-totals-lbl">Subtotal</td>' +
                '<td class="inv-totals-val">' + Utils.formatCurrency(subtotal) + '</td>' +
            '</tr>';
        if (hstEnabled) {
            totalsHtml +=
                '<tr>' +
                    '<td class="inv-totals-lbl">HST (' + hstRate + '%)</td>' +
                    '<td class="inv-totals-val">' + Utils.formatCurrency(hstAmt) + '</td>' +
                '</tr>';
        }
        totalsHtml +=
            '<tr class="inv-totals-total-row">' +
                '<td class="inv-totals-lbl">Total</td>' +
                '<td class="inv-totals-val">' + Utils.formatCurrency(total) + '</td>' +
            '</tr>';
        if (hbEnabled) {
            totalsHtml +=
                '<tr>' +
                    '<td class="inv-totals-lbl">Statutory Holdback (' + hbRate + '%)</td>' +
                    '<td class="inv-totals-val">&minus;' + Utils.formatCurrency(hbAmt) + '</td>' +
                '</tr>' +
                '<tr class="inv-totals-due-row">' +
                    '<td class="inv-totals-lbl">Net Payable</td>' +
                    '<td class="inv-totals-val">' + Utils.formatCurrency(netPayable) + '</td>' +
                '</tr>';
        } else {
            totalsHtml +=
                '<tr class="inv-totals-due-row">' +
                    '<td class="inv-totals-lbl">Total Due</td>' +
                    '<td class="inv-totals-val">' + Utils.formatCurrency(total) + '</td>' +
                '</tr>';
        }

        // Payment contact
        var contactName  = settings.contactName  || companyName;
        var contactTitle = settings.contactTitle  || '';
        var contactPhone = companyPhone;
        var contactEmail = companyEmail;

        // ── Build document HTML ──────────────────────────────
        return '<div class="inv-doc">' +

            // Header
            '<div class="inv-header">' +
                '<div class="inv-company-block">' +
                    '<div id="invLogoArea"></div>' +
                    '<div class="inv-company-name">' + esc(companyName) + '</div>' +
                    '<div class="inv-company-meta">' +
                        (companyAddr  ? '<div>' + esc(companyAddr)  + '</div>' : '') +
                        (companyPhone ? '<div>' + esc(companyPhone) + '</div>' : '') +
                        (companyEmail ? '<div>' + esc(companyEmail) + '</div>' : '') +
                        (hstNum       ? '<div>HST: ' + esc(hstNum) + '</div>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="inv-title-block">' +
                    '<div class="inv-title-text">INVOICE</div>' +
                    '<div class="inv-number">' + esc(invNum) + '</div>' +
                    '<div class="inv-title-meta">' +
                        '<div class="inv-title-meta-row"><span>Date</span><span>' + Utils.formatDate(invDate) + '</span></div>' +
                        (billingStart && billingEnd
                            ? '<div class="inv-title-meta-row"><span>Period</span><span>' + Utils.formatDate(billingStart) + ' &ndash; ' + Utils.formatDate(billingEnd) + '</span></div>'
                            : '') +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div class="inv-header-rule"></div>' +

            // Bill To / Project
            '<div class="inv-parties-row">' +
                '<div class="inv-party">' +
                    '<div class="inv-party-label">Bill To</div>' +
                    '<div class="inv-party-name">' + esc(clientName) + '</div>' +
                    '<div class="inv-party-details">' + clientAddrHtml + '</div>' +
                '</div>' +
                '<div class="inv-party">' +
                    '<div class="inv-party-label">Project</div>' +
                    '<div class="inv-party-name">' + esc(projectName) + '</div>' +
                    (jobSiteAddr ? '<div class="inv-party-details">' + esc(jobSiteAddr) + '</div>' : '') +
                '</div>' +
            '</div>' +

            (contractRef
                ? '<div class="inv-contract-ref"><strong>Contract / Authority Reference:</strong> ' + esc(contractRef) + '</div>'
                : '') +

            // Line items table
            '<table class="inv-table">' +
                '<colgroup>' +
                    '<col style="width:36%">' +
                    '<col style="width:13%">' +
                    '<col style="width:12%">' +
                    '<col style="width:16%">' +
                    '<col style="width:16%">' +
                '</colgroup>' +
                '<thead><tr>' +
                    '<th class="inv-th-desc">Description</th>' +
                    '<th class="inv-th-cat">Category</th>' +
                    '<th class="inv-th-qty">Qty / Hours</th>' +
                    '<th class="inv-th-rate">Rate</th>' +
                    '<th class="inv-th-amt">Amount</th>' +
                '</tr></thead>' +
                '<tbody>' + linesHtml + '</tbody>' +
            '</table>' +

            // Totals — uses a real table for guaranteed alignment
            '<div class="inv-totals-section">' +
                '<table class="inv-totals-table">' + totalsHtml + '</table>' +
            '</div>' +

            // Payment terms
            (inv.paymentTerms
                ? '<div class="inv-terms">' +
                    '<div class="inv-terms-line"><strong>Payment Terms:</strong> ' + esc(inv.paymentTerms) +
                        (inv.dueDate ? ' &nbsp;&bull;&nbsp; <strong>Due:</strong> ' + Utils.formatDate(inv.dueDate) : '') +
                    '</div>' +
                    '<div class="inv-terms-note">Under the Ontario Construction Act, the statutory payment period is 28 days from receipt of a proper invoice.</div>' +
                  '</div>'
                : '') +

            // Notes
            (inv.notes
                ? '<div class="inv-notes-section">' +
                    '<strong class="inv-notes-title">Notes</strong>' +
                    '<div class="inv-notes-text">' + esc(inv.notes) + '</div>' +
                  '</div>'
                : '') +

            // Payment contact
            ((contactName || contactPhone || contactEmail)
                ? '<div class="inv-contact-box">' +
                    '<div class="inv-contact-title">Payment Contact</div>' +
                    '<div class="inv-contact-body">' +
                        esc(contactName) + (contactTitle ? ', ' + esc(contactTitle) : '') + '<br>' +
                        (contactPhone ? 'Phone: ' + esc(contactPhone) + '<br>' : '') +
                        (contactEmail ? 'Email: ' + esc(contactEmail) + '<br>' : '') +
                        (companyAddr  ? 'Mail: '  + esc(companyAddr)  : '') +
                    '</div>' +
                  '</div>'
                : '') +

            // Holdback notice
            (hbEnabled
                ? '<div class="inv-holdback-notice">' +
                    '<strong>Statutory Holdback Notice:</strong> In accordance with the Ontario Construction Act, ' +
                    hbRate + '% of the contract price is held back. The holdback amount of ' +
                    Utils.formatCurrency(hbAmt) + ' will be released as required by the Act.' +
                  '</div>'
                : '') +

            // Footer / compliance
            '<div class="inv-footer">' +
                'This invoice constitutes a proper invoice under Section 6.1 of the Ontario Construction Act, 2017.' +
            '</div>' +

        '</div>';
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
        navEl.querySelector('#wizSave').addEventListener('click', async function() {
            await self._saveInvoice();
        });
    },

    _buildInvoicePreview(wd, settings) {
        var self = this;
        if (!settings) settings = AppData.getSettings();
        var project = AppData.getProject(wd.projectId) || {};
        var allExpenses = AppData.getExpenses(wd.projectId);
        var selectedExpenses = allExpenses.filter(function(e) { return wd.selectedExpenseIds.indexOf(e.id) !== -1; });

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

        // Build normalized line items for the shared renderer
        var lineItems = selectedExpenses.map(function(e) {
            var worker = e.workerId ? AppData.getWorker(e.workerId) : null;
            var desc = '';
            if (e.category === 'Labor') {
                desc = (worker ? worker.name + ' - ' : '') + (e.description || '');
            } else {
                var vd = e.vendorName || e.vendor || '';
                desc = (vd ? vd + ' - ' : '') + (e.description || '');
            }
            return {
                description: desc,
                category: e.category || 'Material',
                quantity: e.hours || 1,
                rate: e.rate || 0,
                amount: parseFloat(e.amount) || 0,
                isChangeOrder: e.changeOrder || false,
                hours: e.hours,
                rateType: e.rateType
            };
        });

        // Build a normalized invoice object and delegate to shared renderer
        var tempInv = {
            companyName:      settings.companyName || '',
            companyAddress:   [settings.address, settings.city, settings.province, settings.postalCode].filter(Boolean).join(', '),
            companyPhone:     settings.phone || '',
            companyEmail:     settings.email || '',
            hstNumber:        settings.hstNumber || '',
            invoiceNumber:    wd.invoiceNumber || '',
            invoiceDate:      wd.invoiceDate || '',
            billingPeriodStart: wd.billingStart || '',
            billingPeriodEnd:   wd.billingEnd   || '',
            clientName:       project.clientName || project.client || '',
            clientAddress:    project.clientAddress  || '',
            clientCity:       project.clientCity     || '',
            clientProvince:   project.clientProvince || '',
            clientPostalCode: project.clientPostalCode || '',
            clientPhone:      project.clientPhone || '',
            clientEmail:      project.clientEmail || '',
            projectName:      project.name || '',
            jobSiteAddress:   project.jobSiteAddress || '',
            contractReference: project.contractNumber || '',
            lineItems:        lineItems,
            subtotal:         subtotal,
            hstEnabled:       wd.enableHst,
            hstRate:          wd.hstRate,
            hstAmount:        hstAmount,
            hst:              hstAmount,
            holdbackEnabled:  wd.enableHoldback,
            holdbackRate:     wd.holdbackRate,
            holdbackAmount:   holdbackAmount,
            holdback:         holdbackAmount,
            total:            total,
            netPayable:       netPayable,
            paymentTerms:     wd.paymentTerms || '',
            dueDate:          dueDate,
            notes:            wd.notes || ''
        };

        return self._buildInvoiceDocument(tempInv, settings);
    },

    async _saveInvoice() {
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

        try {
            await AppData.saveEntityAsync('invoices', invoice);
        } catch (e) {
            Utils.showToast('Failed to save invoice: ' + e.message, 'error');
            return;
        }

        // Mark expenses as invoiced
        for (var _ei = 0; _ei < selectedExpenses.length; _ei++) {
            var _exp = selectedExpenses[_ei];
            _exp.invoiced = true;
            _exp.invoiceId = invoice.id;
            try { await AppData.saveEntityAsync('expenses', _exp); } catch (e) { /* non-critical */ }
        }

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

        // Pre-compute invoice document HTML using shared professional renderer
        var invoiceDocHtml = self._buildInvoiceDocument(
            Object.assign({}, inv, {
                jobSiteAddress: (project && project.jobSiteAddress) || inv.jobSiteAddress || ''
            }),
            settings
        );

        container.innerHTML =
            // Action buttons (hidden on print)
            '<div class="no-print-actions">' +
                '<button class="btn-ghost btn-sm" id="backToInvoices">&larr; Back to Invoices</button>' +
                '<button class="btn-primary btn-sm" id="printInvoice">Print / Export PDF</button>' +
                '<button class="btn-secondary btn-sm" id="emailInvoice">Email Invoice</button>' +
                '<button class="btn-sm" id="editInvoiceBtn" style="background:#1a3a5c;color:#fff">Edit Invoice</button>' +
                (balance > 0.01 ? '<button class="btn-sm" id="recordPaymentBtn" style="background:var(--success);color:#fff">Record Payment</button>' : '') +
            '</div>' +

            // Status bar
            '<div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">' +
                '<span style="font-size:.85rem;padding:4px 12px;border-radius:12px;' + statusStyle + '">' + statusLabel + '</span>' +
                '<span style="font-size:.9rem;color:var(--text2)">Balance: <strong style="color:var(--text)">' + Utils.formatCurrency(balance) + '</strong></span>' +
            '</div>' +

            // Invoice card — professional redesigned layout
            '<div class="card">' + invoiceDocHtml + '</div>' +

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

        // Load company logo into invoice (targets #invLogoArea from _buildInvoiceDocument)
        AppData.getLogo().then(function(logo) {
            if (logo && logo.blob) {
                var logoArea = container.querySelector('#invLogoArea');
                if (logoArea) {
                    var url = URL.createObjectURL(logo.blob);
                    logoArea.innerHTML = '<img src="' + url + '" alt="Logo" style="max-height:56px;max-width:200px;object-fit:contain;margin-bottom:8px;display:block">';
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

        container.querySelector('#editInvoiceBtn').addEventListener('click', function() {
            self._showEditModal(inv.id, function() {
                self.renderDetail(container, invoiceId);
            });
        });
    },

    // ============ EDIT INVOICE MODAL (FULL) ============

    _showEditModal(invoiceId, onComplete) {
        var self = this;
        var inv = AppData.getInvoice(invoiceId);
        if (!inv) { Utils.showToast('Invoice not found', 'error'); return; }
        var esc = Utils.escapeHtml;

        // Working copy of line items
        var editItems = JSON.parse(JSON.stringify(inv.lineItems || inv.items || []));
        var originalExpenseIds = editItems.map(function(i) { return i.expenseId || i.id || null; }).filter(Boolean);
        var currentProjectId = inv.projectId || '';

        var hstEnabled = inv.hstEnabled !== false;
        var hstRate = parseFloat(inv.hstRate) || 13;
        var holdbackEnabled = inv.holdbackEnabled || false;
        var holdbackRate = parseFloat(inv.holdbackRate) || 10;

        var allProjects = AppData.getProjects();
        var projectOptionsHtml = allProjects.map(function(p) {
            return '<option value="' + p.id + '"' + (p.id === currentProjectId ? ' selected' : '') + '>' + esc(p.name) + '</option>';
        }).join('');
        if (!currentProjectId) projectOptionsHtml = '<option value="">— Select project —</option>' + projectOptionsHtml;

        var bodyHtml =
            '<form id="editInvoiceForm" novalidate>' +
                    '<div class="form-group" style="margin-bottom:16px;padding:12px;background:#f0f4ff;border-radius:8px;border:1px solid #c7d2fe">' +
                        '<label style="font-weight:700;color:#1a3a5c">Project</label>' +
                        '<select id="editProjectSelect" style="width:100%;margin-top:4px">' + projectOptionsHtml + '</select>' +
                        '<p style="font-size:.78rem;color:#6366f1;margin:4px 0 0">Changing the project updates the available expenses below.</p>' +
                    '</div>' +
                    '<h4 style="color:#1a3a5c;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin-bottom:12px">Invoice Details</h4>' +
                    '<div class="form-row">' +
                        '<div class="form-group"><label>Invoice Number</label><input type="text" name="invoiceNumber" value="' + esc(inv.invoiceNumber || '') + '"></div>' +
                        '<div class="form-group"><label>Status</label><select name="status">' +
                            ['Draft','Sent','Unpaid','Partially Paid','Paid','Overdue'].map(function(s) {
                                return '<option value="' + s + '"' + (inv.status === s ? ' selected' : '') + '>' + s + '</option>';
                            }).join('') +
                        '</select></div>' +
                    '</div>' +
                    '<div class="form-row">' +
                        '<div class="form-group"><label>Invoice Date</label><input type="date" name="invoiceDate" value="' + esc(inv.invoiceDate || inv.date || '') + '"></div>' +
                        '<div class="form-group"><label>Due Date</label><input type="date" name="dueDate" value="' + esc(inv.dueDate || '') + '"></div>' +
                    '</div>' +
                    '<div class="form-row">' +
                        '<div class="form-group"><label>Billing Period Start</label><input type="date" name="billingPeriodStart" value="' + esc(inv.billingPeriodStart || inv.billingStart || '') + '"></div>' +
                        '<div class="form-group"><label>Billing Period End</label><input type="date" name="billingPeriodEnd" value="' + esc(inv.billingPeriodEnd || inv.billingEnd || '') + '"></div>' +
                    '</div>' +
                    '<div class="form-group" style="margin-bottom:8px"><label>Payment Terms</label><input type="text" name="paymentTerms" value="' + esc(inv.paymentTerms || '') + '" placeholder="e.g. Net 30"></div>' +
                    '<div class="form-group" style="margin-bottom:8px"><label>Contract / Authority Reference</label><input type="text" name="contractReference" value="' + esc(inv.contractReference || inv.contractNumber || '') + '"></div>' +
                    '<div class="form-group" style="margin-bottom:16px"><label>Notes</label><textarea name="notes" rows="2">' + esc(inv.notes || '') + '</textarea></div>' +

                    '<h4 style="color:#1a3a5c;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin-bottom:12px">Line Items</h4>' +
                    '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:8px">' +
                    '<table style="width:100%;min-width:360px;border-collapse:collapse">' +
                        '<thead><tr style="background:#f3f4f6">' +
                            '<th style="padding:7px 6px;text-align:left;font-size:.82rem;font-weight:600">Description</th>' +
                            '<th style="padding:7px 6px;text-align:left;font-size:.82rem;font-weight:600;width:115px">Category</th>' +
                            '<th style="padding:7px 6px;text-align:right;font-size:.82rem;font-weight:600;width:100px">Amount</th>' +
                            '<th style="padding:7px 6px;width:36px"></th>' +
                        '</tr></thead>' +
                        '<tbody id="editLineItemsBody"></tbody>' +
                    '</table>' +
                    '</div>' +
                    '<button type="button" id="addCustomItem" style="background:var(--bg-surface);border:1px dashed var(--border-color);padding:6px 14px;border-radius:4px;cursor:pointer;font-size:.85rem;color:var(--text-secondary);margin-bottom:20px">+ Add Custom Line Item</button>' +

                    '<h4 style="color:#1a3a5c;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin-bottom:10px">Add from Project Expenses</h4>' +
                    '<div id="availableExpensesSection" style="margin-bottom:20px"></div>' +

                    '<h4 style="color:#1a3a5c;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin-bottom:12px">Tax & Holdback</h4>' +
                    '<div class="form-row" style="align-items:center">' +
                        '<div class="form-group"><div class="toggle-wrap"><label class="toggle"><input type="checkbox" id="editHst"' + (hstEnabled ? ' checked' : '') + '><span class="slider"></span></label><span style="font-size:.9rem">Apply HST</span></div></div>' +
                        '<div class="form-group"><label>HST Rate (%)</label><input type="number" id="editHstRate" step="0.01" min="0" max="100" value="' + hstRate + '" style="width:80px"></div>' +
                    '</div>' +
                    '<div class="form-row" style="align-items:center">' +
                        '<div class="form-group"><div class="toggle-wrap"><label class="toggle"><input type="checkbox" id="editHoldback"' + (holdbackEnabled ? ' checked' : '') + '><span class="slider"></span></label><span style="font-size:.9rem">Statutory Holdback</span></div></div>' +
                        '<div class="form-group"><label>Holdback Rate (%)</label><input type="number" id="editHoldbackRate" step="0.1" min="0" max="100" value="' + holdbackRate + '" style="width:80px"></div>' +
                    '</div>' +
                    '<div id="editTotals" style="background:#f8f9fa;padding:12px;border-radius:6px;text-align:right;font-size:.9rem;margin-bottom:20px;border:1px solid #e5e7eb"></div>' +

                    '<div class="form-actions">' +
                    '</div>' +
                '</form>';

        var modal = UI.modal('Edit Invoice', bodyHtml, {
            width: '700px',
            submitLabel: 'Save Invoice',
            scrollBody: true,
        });
        var overlay = modal.overlay;
        var q = function(s) { return modal.q(s); };

        function calcTotals() {
            var subtotal = editItems.reduce(function(s, i) { return s + (parseFloat(i.amount) || 0); }, 0);
            var hstAmt = hstEnabled ? subtotal * (hstRate / 100) : 0;
            var total = subtotal + hstAmt;
            var hbAmt = holdbackEnabled ? subtotal * (holdbackRate / 100) : 0;
            var net = total - hbAmt;
            return { subtotal: subtotal, hstAmt: hstAmt, total: total, hbAmt: hbAmt, net: net };
        }

        function renderTotals() {
            var t = calcTotals();
            var el = q('#editTotals');
            if (!el) return;
            var html = '<div style="color:var(--text-secondary)"><strong>Subtotal:</strong> ' + Utils.formatCurrency(t.subtotal) + '</div>';
            if (hstEnabled) html += '<div style="color:var(--text-secondary)">HST (' + hstRate + '%): ' + Utils.formatCurrency(t.hstAmt) + '</div>';
            html += '<div style="color:var(--text-primary)"><strong>Total:</strong> ' + Utils.formatCurrency(t.total) + '</div>';
            if (holdbackEnabled) {
                html += '<div style="color:var(--text-secondary)">Holdback (' + holdbackRate + '%): &minus;' + Utils.formatCurrency(t.hbAmt) + '</div>';
                html += '<div style="font-weight:700;font-size:1rem;color:var(--amber-hover);margin-top:4px">Net Payable: ' + Utils.formatCurrency(t.net) + '</div>';
            } else {
                html += '<div style="font-weight:700;font-size:1rem;color:var(--amber-hover);margin-top:4px">Total Due: ' + Utils.formatCurrency(t.total) + '</div>';
            }
            el.innerHTML = html;
        }

        function renderLineItems() {
            var tbody = q('#editLineItemsBody');
            if (!tbody) return;
            if (editItems.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:16px;font-size:.85rem">No line items. Add from project expenses or add a custom item.</td></tr>';
                return;
            }
            tbody.innerHTML = editItems.map(function(item, idx) {
                return '<tr data-idx="' + idx + '" style="border-bottom:1px solid var(--border-color-soft)">' +
                    '<td style="padding:5px 4px"><input type="text" class="li-desc" style="width:100%;border:1px solid var(--border-color);padding:5px 6px;font-size:.85rem;border-radius:3px;background:var(--bg-input);color:var(--text-primary)" value="' + esc(item.description || '') + '"></td>' +
                    '<td style="padding:5px 4px"><select class="li-cat" style="border:1px solid var(--border-color);padding:5px 4px;font-size:.85rem;border-radius:3px;background:var(--bg-input);color:var(--text-primary);color-scheme:dark;width:100%">' +
                        ['Labor','Equipment','Material'].map(function(c) {
                            return '<option value="' + c + '"' + (item.category === c ? ' selected' : '') + '>' + c + '</option>';
                        }).join('') +
                    '</select></td>' +
                    '<td style="padding:5px 4px"><input type="number" class="li-amt" step="0.01" min="0" style="width:95px;border:1px solid var(--border-color);padding:5px 6px;font-size:.85rem;border-radius:3px;text-align:right;background:var(--bg-input);color:var(--text-primary)" value="' + (parseFloat(item.amount) || 0).toFixed(2) + '"></td>' +
                    '<td style="padding:5px 4px;text-align:center"><button type="button" class="li-remove" data-idx="' + idx + '" style="background:var(--danger-bg);color:var(--danger);border:none;width:26px;height:26px;border-radius:3px;cursor:pointer;font-size:.85rem;line-height:1">✕</button></td>' +
                '</tr>';
            }).join('');

            tbody.querySelectorAll('tr[data-idx]').forEach(function(row) {
                var idx = parseInt(row.dataset.idx);
                row.querySelector('.li-desc').addEventListener('input', function() { editItems[idx].description = this.value; });
                row.querySelector('.li-cat').addEventListener('change', function() { editItems[idx].category = this.value; });
                row.querySelector('.li-amt').addEventListener('input', function() {
                    editItems[idx].amount = parseFloat(this.value) || 0;
                    renderTotals();
                });
                row.querySelector('.li-remove').addEventListener('click', function() {
                    editItems.splice(idx, 1);
                    renderLineItems();
                    renderTotals();
                    renderUnusedExpenses();
                });
            });
        }

        function getAvailableExpenses() {
            if (!currentProjectId) return [];
            var expenses = AppData.getExpenses(currentProjectId);
            var currentExpenseIds = editItems.map(function(i) { return i.expenseId || i.id || null; }).filter(Boolean);
            return expenses.filter(function(e) {
                if (currentExpenseIds.indexOf(e.id) !== -1) return false;
                return !e.invoiced || e.invoiceId === invoiceId;
            });
        }

        function renderUnusedExpenses() {
            var el = q('#availableExpensesSection');
            if (!el) return;
            var available = getAvailableExpenses();
            if (available.length === 0) {
                el.innerHTML = '<p style="color:#888;font-size:.85rem;padding:8px 0">All project expenses are already on this invoice, or there are no uninvoiced expenses.</p>';
                return;
            }
            el.innerHTML = '<table style="width:100%;font-size:.85rem;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:4px">' +
                '<thead><tr style="background:#f3f4f6">' +
                    '<th style="padding:6px 8px;text-align:left;font-weight:600">Date</th>' +
                    '<th style="padding:6px 8px;text-align:left;font-weight:600">Description</th>' +
                    '<th style="padding:6px 8px;text-align:left;font-weight:600">Cat</th>' +
                    '<th style="padding:6px 8px;text-align:right;font-weight:600">Amount</th>' +
                    '<th style="padding:6px 8px"></th>' +
                '</tr></thead><tbody>' +
                available.map(function(e) {
                    var desc = '';
                    if (e.category === 'Labor') {
                        var worker = e.workerId ? AppData.getWorker(e.workerId) : null;
                        desc = (worker ? esc(worker.name) + ' &ndash; ' : '') + esc(e.description || '');
                    } else {
                        var vd = e.vendorName || e.vendor || '';
                        desc = (vd ? esc(vd) + ' &ndash; ' : '') + esc(e.description || '');
                    }
                    return '<tr style="border-top:1px solid var(--border-color-soft)">' +
                        '<td style="padding:6px 8px;color:var(--text-secondary)">' + Utils.formatDate(e.date) + '</td>' +
                        '<td style="padding:6px 8px;color:var(--text-primary)">' + desc + '</td>' +
                        '<td style="padding:6px 8px;color:var(--text-secondary)">' + (e.category || 'Material') + '</td>' +
                        '<td style="padding:6px 8px;text-align:right;color:var(--text-primary)">' + Utils.formatCurrency(e.amount) + '</td>' +
                        '<td style="padding:6px 8px"><button type="button" class="add-exp-btn" data-id="' + e.id + '" style="background:var(--bg-surface-hover);color:var(--text-primary);border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:.8rem;white-space:nowrap">+ Add</button></td>' +
                    '</tr>';
                }).join('') +
                '</tbody></table>';

            el.querySelectorAll('.add-exp-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var expId = btn.dataset.id;
                    var exps = AppData.getExpenses(currentProjectId);
                    var exp = null;
                    for (var i = 0; i < exps.length; i++) { if (exps[i].id === expId) { exp = exps[i]; break; } }
                    if (!exp) return;
                    var worker = exp.workerId ? AppData.getWorker(exp.workerId) : null;
                    var desc = '';
                    if (exp.category === 'Labor') {
                        desc = (worker ? worker.name + ' - ' : '') + (exp.description || '');
                    } else {
                        desc = ((exp.vendorName || exp.vendor || '') ? (exp.vendorName || exp.vendor) + ' - ' : '') + (exp.description || '');
                    }
                    editItems.push({
                        expenseId: exp.id,
                        description: desc,
                        category: exp.category || 'Material',
                        amount: parseFloat(exp.amount) || 0,
                        hours: exp.hours || null,
                        rate: exp.rate || null,
                        rateType: exp.rateType || null,
                        workerId: exp.workerId || '',
                        vendor: exp.vendor || exp.vendorName || '',
                        isChangeOrder: exp.changeOrder || false
                    });
                    renderLineItems();
                    renderTotals();
                    renderUnusedExpenses();
                });
            });
        }

        // Project selector — live-refresh available expenses when project changes
        q('#editProjectSelect').addEventListener('change', function() {
            currentProjectId = this.value;
            renderUnusedExpenses();
        });

        // Initial render
        renderLineItems();
        renderTotals();
        renderUnusedExpenses();

        // Add custom line item
        q('#addCustomItem').addEventListener('click', function() {
            editItems.push({ expenseId: null, description: '', category: 'Material', amount: 0 });
            renderLineItems();
            renderTotals();
        });

        // Tax toggles
        q('#editHst').addEventListener('change', function() { hstEnabled = this.checked; renderTotals(); });
        q('#editHstRate').addEventListener('input', function() { hstRate = parseFloat(this.value) || 0; renderTotals(); });
        q('#editHoldback').addEventListener('change', function() { holdbackEnabled = this.checked; renderTotals(); });
        q('#editHoldbackRate').addEventListener('input', function() { holdbackRate = parseFloat(this.value) || 0; renderTotals(); });

        // Save
        q('#editInvoiceForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            var fd = Utils.getFormData(this);
            var t = calcTotals();

            var newExpenseIds = editItems.map(function(i) { return i.expenseId || null; }).filter(Boolean);

            // Unmark expenses removed from this invoice (search all expenses, not just current project)
            for (var _ri = 0; _ri < originalExpenseIds.length; _ri++) {
                var _reid = originalExpenseIds[_ri];
                if (newExpenseIds.indexOf(_reid) === -1) {
                    var _rexps = AppData.getExpenses();
                    for (var _rj = 0; _rj < _rexps.length; _rj++) {
                        if (_rexps[_rj].id === _reid) {
                            _rexps[_rj].invoiced = false;
                            _rexps[_rj].invoiceId = null;
                            try { await AppData.saveEntityAsync('expenses', _rexps[_rj]); } catch (e) { /* non-critical */ }
                            break;
                        }
                    }
                }
            }

            // Mark newly added expenses as invoiced
            for (var _ai = 0; _ai < newExpenseIds.length; _ai++) {
                var _aeid = newExpenseIds[_ai];
                if (originalExpenseIds.indexOf(_aeid) === -1) {
                    var _aexps = AppData.getExpenses(currentProjectId);
                    for (var _aj = 0; _aj < _aexps.length; _aj++) {
                        if (_aexps[_aj].id === _aeid) {
                            _aexps[_aj].invoiced = true;
                            _aexps[_aj].invoiceId = invoiceId;
                            try { await AppData.saveEntityAsync('expenses', _aexps[_aj]); } catch (e) { /* non-critical */ }
                            break;
                        }
                    }
                }
            }

            // Compute due date
            var dueDate = fd.dueDate || '';
            if (!dueDate && fd.paymentTerms && fd.invoiceDate) {
                var netDays = parseInt((fd.paymentTerms || '').replace(/[^0-9]/g, ''));
                if (netDays) {
                    var d = new Date(fd.invoiceDate + 'T00:00:00');
                    d.setDate(d.getDate() + netDays);
                    dueDate = d.toISOString().split('T')[0];
                }
            }

            inv.invoiceNumber = fd.invoiceNumber || inv.invoiceNumber;
            inv.status = fd.status || inv.status;
            if (currentProjectId && currentProjectId !== inv.projectId) {
                var newProject = AppData.getProject(currentProjectId);
                inv.projectId = currentProjectId;
                inv.projectName = newProject ? newProject.name : inv.projectName;
            }
            inv.invoiceDate = fd.invoiceDate || inv.invoiceDate;
            inv.date = fd.invoiceDate || inv.date;
            inv.dueDate = dueDate;
            inv.billingPeriodStart = fd.billingPeriodStart || '';
            inv.billingStart = fd.billingPeriodStart || '';
            inv.billingPeriodEnd = fd.billingPeriodEnd || '';
            inv.billingEnd = fd.billingPeriodEnd || '';
            inv.paymentTerms = fd.paymentTerms || '';
            inv.contractReference = fd.contractReference || '';
            inv.notes = fd.notes || '';
            inv.lineItems = editItems;
            inv.items = editItems;
            inv.subtotal = t.subtotal;
            inv.hstEnabled = hstEnabled;
            inv.hstRate = hstRate;
            inv.hstAmount = t.hstAmt;
            inv.hst = t.hstAmt;
            inv.holdbackEnabled = holdbackEnabled;
            inv.holdbackRate = holdbackRate;
            inv.holdbackAmount = t.hbAmt;
            inv.holdback = t.hbAmt;
            inv.total = t.total;
            inv.netPayable = t.net;
            var restore = UI.btnLoading(modal.submitBtn, 'Saving…');
            try {
                await AppData.saveEntityAsync('invoices', inv);
            } catch(err) {
                restore();
                Utils.showToast('Save failed: ' + err.message, 'error');
                return;
            }
            var username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, 'Invoice Edited', 'Invoice ' + inv.invoiceNumber + ' — ' + editItems.length + ' items, total ' + Utils.formatCurrency(t.total));
            Utils.showToast('Invoice saved');
            modal.close();
            if (onComplete) onComplete();
        });

        modal.submitBtn.addEventListener('click', function() { q('#editInvoiceForm').requestSubmit(); });
    },

    // ============ PAYMENT MODAL ============

    _showPaymentModal(invoiceId, maxAmount, onComplete) {
        var self = this;
        var bodyHtml =
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
            '</form>';

        var modal = UI.modal('Record Payment', bodyHtml, {
            width: '450px',
            submitLabel: 'Record Payment',
        });
        var q = function(s) { return modal.q(s); };

        q('#paymentForm').addEventListener('submit', async function(e) {
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

            // Compute new invoice status (local calc only — no save yet)
            var inv = AppData.getInvoice(invoiceId);
            if (inv) {
                // Include the new payment in the total (it's not in cache yet)
                var existingPayments = AppData.getPayments(invoiceId);
                var totalPaid = existingPayments.reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0) + amount;
                inv.status = totalPaid >= (parseFloat(inv.total) || 0) - 0.01 ? 'Paid' : 'Partially Paid';
            }

            var restore = UI.btnLoading(modal.submitBtn, 'Saving…');
            try {
                await AppData.saveEntityAsync('payments', payment);
                if (inv) { await AppData.saveEntityAsync('invoices', inv); }
            } catch(err) {
                restore();
                Utils.showToast('Save failed: ' + err.message, 'error');
                return;
            }
            var username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, 'Payment Recorded', Utils.formatCurrency(amount) + ' via ' + payment.method + ' for invoice ' + (inv ? inv.invoiceNumber : ''));
            Utils.showToast('Payment of ' + Utils.formatCurrency(amount) + ' recorded');
            modal.close();
            if (onComplete) onComplete();
        });

        modal.submitBtn.addEventListener('click', function() { q('#paymentForm').requestSubmit(); });
    }
};
