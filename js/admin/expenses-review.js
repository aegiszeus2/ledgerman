// Admin Expenses Review Module — All expenses across all projects
window.AdminExpensesReview = {
    _container: null,
    _filters: {
        projectId: '',
        category: '',
        vendorId: '',
        vendorSearch: '',
        dateFrom: '',
        dateTo: '',
        billable: '',
        invoiced: '',
        payment: ''
    },
    _sort: { field: 'date', dir: 'desc' },
    _selected: [],

    render(container) {
        this._container = container;
        this._selected = [];
        this._renderView();
    },

    _getProjects() {
        return AppData.getProjects();
    },

    _getVendors() {
        return AppData.getData('vendors') || [];
    },

    _getAllExpenses() {
        // Get all expenses and join with project name
        var projects = this._getProjects();
        var projectMap = {};
        projects.forEach(function(p) { projectMap[p.id] = p.name; });
        var expenses = AppData.getExpenses(); // no project filter
        return expenses.map(function(e) {
            return Object.assign({}, e, {
                projectName: projectMap[e.projectId || e.project_id] || 'Unknown Project'
            });
        });
    },

    _applyFilters(expenses) {
        var f = this._filters;
        return expenses.filter(function(e) {
            if (f.projectId && e.projectId !== f.projectId && e.project_id !== f.projectId) return false;
            if (f.category && e.category !== f.category) return false;
            if (f.vendorId && e.vendorId !== f.vendorId) return false;
            if (f.vendorSearch) {
                var vn = (e.vendorName || e.vendor || '').toLowerCase();
                if (!vn.includes(f.vendorSearch.toLowerCase())) return false;
            }
            if (f.dateFrom && e.date < f.dateFrom) return false;
            if (f.dateTo && e.date > f.dateTo) return false;
            if (f.billable === 'yes' && !e.billable) return false;
            if (f.billable === 'no' && e.billable) return false;
            // Billed state is derived by the server from invoice line items (uid 1122)
            var billed = AppData.expenseBilledState(e);
            if (f.invoiced === 'yes' && billed === 'not_invoiced') return false;
            if (f.invoiced === 'no' && billed !== 'not_invoiced') return false;
            if (f.invoiced === 'draft' && billed !== 'on_draft') return false;
            if (f.invoiced === 'issued' && billed !== 'issued') return false;
            if (f.payment) {
                var ps = AppData.expensePaymentState(e);
                if (f.payment === 'paid' && ps !== 'paid') return false;
                if (f.payment === 'open' && ps === 'paid') return false;
                if (f.payment === 'overdue' && ps !== 'overdue') return false;
                if (f.payment === 'payable' && AppData.expensePaymentType(e) !== 'payable') return false;
            }
            return true;
        });
    },

    _applySort(expenses) {
        var field = this._sort.field;
        var dir = this._sort.dir;
        return expenses.slice().sort(function(a, b) {
            var va, vb;
            if (field === 'date') { va = a.date || ''; vb = b.date || ''; }
            else if (field === 'amount') { va = parseFloat(a.amount) || 0; vb = parseFloat(b.amount) || 0; }
            else if (field === 'category') { va = a.category || ''; vb = b.category || ''; }
            else if (field === 'project') { va = a.projectName || ''; vb = b.projectName || ''; }
            else if (field === 'due') { va = AppData.expenseDueDate(a) || ''; vb = AppData.expenseDueDate(b) || ''; }
            else if (field === 'vendor') {
                va = a.vendorName || a.vendor || '';
                vb = b.vendorName || b.vendor || '';
            } else { va = ''; vb = ''; }
            var cmp = (va < vb) ? -1 : (va > vb) ? 1 : 0;
            return dir === 'asc' ? cmp : -cmp;
        });
    },

    _renderView() {
        var self = this;
        var esc = Utils.escapeHtml;
        var projects = this._getProjects();
        var vendors = this._getVendors();
        var f = self._filters;

        var allExpenses = self._getAllExpenses();
        var filtered = self._applyFilters(allExpenses);
        var sorted = self._applySort(filtered);

        // Summary
        var total = filtered.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
        var billableAmt = filtered.filter(function(e) { return e.billable; }).reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
        var invoicedAmt = filtered.filter(function(e) { return AppData.expenseIsBilled(e); }).reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
        var onDraftAmt = filtered.filter(function(e) { return AppData.expenseBilledState(e) === 'on_draft'; }).reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
        var payableOpen = filtered.filter(function(e) { return AppData.expensePaymentType(e) === 'payable' && !AppData.expenseIsPaid(e); });
        var payableOpenAmt = payableOpen.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
        var overdueAmt = payableOpen.filter(function(e) { return AppData.expensePaymentState(e) === 'overdue'; }).reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
        var paidAmt = filtered.filter(function(e) { return AppData.expenseIsPaid(e); }).reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);

        // Sort indicator
        var si = function(col) { return self._sort.field === col ? (self._sort.dir === 'asc' ? ' ▲' : ' ▼') : ''; };

        var html = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">' +
            '<h2>Expenses — All Projects</h2>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button class="btn btn-secondary btn-sm" id="erExportCsv">📥 Export CSV</button>' +
            '<button class="btn btn-primary btn-sm" id="erAddExpense">+ Add Expense</button>' +
            '</div></div>';

        // Filter bar
        html += '<div class="er-filter-bar">' +
            '<div class="filter-group">' +
            '<label>Project</label>' +
            '<select id="erFProject">' +
            '<option value="">All Projects</option>' +
            projects.map(function(p) { return '<option value="' + p.id + '"' + (f.projectId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') +
            '</select></div>' +

            '<div class="filter-group">' +
            '<label>Category</label>' +
            '<select id="erFCategory">' +
            '<option value="">All Categories</option>' +
            ['Labour', 'Materials', 'Equipment', 'Other', 'Labor', 'Material'].map(function(c) {
                return '<option value="' + c + '"' + (f.category === c ? ' selected' : '') + '>' + c + '</option>';
            }).join('') +
            '</select></div>' +

            '<div class="filter-group">' +
            '<label>Vendor</label>' +
            '<select id="erFVendor">' +
            '<option value="">All Vendors</option>' +
            vendors.map(function(v) { return '<option value="' + v.id + '"' + (f.vendorId === v.id ? ' selected' : '') + '>' + esc(v.name) + '</option>'; }).join('') +
            '</select></div>' +

            '<div class="filter-group">' +
            '<label>Date From</label>' +
            '<input type="date" id="erFDateFrom" value="' + esc(f.dateFrom) + '"></div>' +

            '<div class="filter-group">' +
            '<label>Date To</label>' +
            '<input type="date" id="erFDateTo" value="' + esc(f.dateTo) + '"></div>' +

            '<div class="filter-group">' +
            '<label>Billable</label>' +
            '<select id="erFBillable">' +
            '<option value="">All</option>' +
            '<option value="yes"' + (f.billable === 'yes' ? ' selected' : '') + '>Billable</option>' +
            '<option value="no"' + (f.billable === 'no' ? ' selected' : '') + '>Non-Billable</option>' +
            '</select></div>' +

            '<div class="filter-group">' +
            '<label>Invoiced</label>' +
            '<select id="erFInvoiced">' +
            '<option value="">All</option>' +
            '<option value="no"' + (f.invoiced === 'no' ? ' selected' : '') + '>Not invoiced</option>' +
            '<option value="draft"' + (f.invoiced === 'draft' ? ' selected' : '') + '>On draft</option>' +
            '<option value="issued"' + (f.invoiced === 'issued' ? ' selected' : '') + '>Issued</option>' +
            '<option value="yes"' + (f.invoiced === 'yes' ? ' selected' : '') + '>On draft or issued</option>' +
            '</select></div>' +

            '<div class="filter-group">' +
            '<label>Payment</label>' +
            '<select id="erFPayment">' +
            '<option value="">All</option>' +
            '<option value="open"' + (f.payment === 'open' ? ' selected' : '') + '>Payable, open</option>' +
            '<option value="overdue"' + (f.payment === 'overdue' ? ' selected' : '') + '>Payable, overdue</option>' +
            '<option value="payable"' + (f.payment === 'payable' ? ' selected' : '') + '>Payable, all</option>' +
            '<option value="paid"' + (f.payment === 'paid' ? ' selected' : '') + '>Paid</option>' +
            '</select></div>' +

            '<div class="filter-group" style="justify-content:flex-end">' +
            '<label>&nbsp;</label>' +
            '<button class="btn btn-secondary btn-sm" id="erClearFilters">Clear Filters</button>' +
            '</div>' +
            '</div>';

        // Summary strip
        html += '<div class="er-summary-strip">' +
            '<span class="sr-item">Count: <strong>' + filtered.length + '</strong></span>' +
            '<span class="sr-item">Total: <strong>' + Utils.formatCurrency(total) + '</strong></span>' +
            '<span class="sr-item">Billable: <strong>' + Utils.formatCurrency(billableAmt) + '</strong></span>' +
            '<span class="sr-item">Billed: <strong>' + Utils.formatCurrency(invoicedAmt) + '</strong>' + (onDraftAmt > 0 ? ' <span style="color:var(--text-muted)">(on draft ' + Utils.formatCurrency(onDraftAmt) + ')</span>' : '') + '</span>' +
            '<span class="sr-item">Paid: <strong>' + Utils.formatCurrency(paidAmt) + '</strong></span>' +
            '<span class="sr-item">Payable open: <strong>' + Utils.formatCurrency(payableOpenAmt) + '</strong>' + (overdueAmt > 0 ? ' <span style="color:var(--danger,#c0392b)">(overdue ' + Utils.formatCurrency(overdueAmt) + ')</span>' : '') + '</span>' +
            '</div>';

        // Bulk actions
        html += '<div id="erBulkBar" style="display:none;margin-bottom:8px;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-surface);border:1px solid var(--border-color);border-radius:var(--radius)">' +
            '<span id="erSelCount" style="font-size:.85rem;color:var(--text-muted)">0 selected</span>' +
            '<button class="btn btn-secondary btn-sm" id="erMarkBillable">Mark Billable</button>' +
            '<button class="btn btn-secondary btn-sm" id="erMarkNonBillable">Mark Non-Billable</button>' +
            '<button class="btn btn-secondary btn-sm" id="erMarkPaid">Mark Paid</button>' +
            '</div>';

        // Table
        if (sorted.length === 0) {
            html += '<div class="card"><div class="empty-state"><h3>No Expenses Found</h3><p>Adjust your filters or add expenses to a project.</p></div></div>';
        } else {
            html += '<div style="overflow-x:auto"><table class="table" id="erTable">' +
                '<thead><tr>' +
                '<th style="width:30px"><input type="checkbox" id="erSelectAll" title="Select all"></th>' +
                '<th class="sortable" data-col="date" style="cursor:pointer">Date' + si('date') + '</th>' +
                '<th class="sortable" data-col="project" style="cursor:pointer">Project' + si('project') + '</th>' +
                '<th class="sortable" data-col="category" style="cursor:pointer">Category' + si('category') + '</th>' +
                '<th class="sortable" data-col="vendor" style="cursor:pointer">Vendor' + si('vendor') + '</th>' +
                '<th>Description</th>' +
                '<th class="sortable" data-col="amount" style="cursor:pointer;text-align:right">Amount' + si('amount') + '</th>' +
                '<th style="text-align:center">Billable</th>' +
                '<th class="sortable" data-col="due" style="cursor:pointer">Payment' + si('due') + '</th>' +
                '<th>Billed</th>' +
                '</tr></thead>' +
                '<tbody id="erTbody">';

            sorted.forEach(function(e) {
                var vendorDisplay = e.vendorName || e.vendor || '—';
                var isBillable = !!e.billable;
                var isInvoiced = AppData.expenseIsBilled(e);
                var isSelected = self._selected.indexOf(e.id) !== -1;
                var payState = AppData.expensePaymentState(e);
                var payColor = payState === 'overdue' ? 'var(--danger,#c0392b)' : (payState === 'paid' ? 'var(--text-muted)' : 'inherit');
                var billedText = e.billable === false ? 'Non-billable' : (e.excludeFromInvoice ? 'Excluded' : AppData.expenseBilledLabel(e));
                html += '<tr class="er-row" data-id="' + e.id + '">' +
                    '<td onclick="event.stopPropagation()"><input type="checkbox" class="er-cb" data-id="' + e.id + '"' + (isSelected ? ' checked' : '') + '></td>' +
                    '<td>' + Utils.formatDate(e.date) + '</td>' +
                    '<td>' + esc(e.projectName) + '</td>' +
                    '<td><span style="font-size:.75rem;padding:2px 7px;border-radius:999px;background:var(--bg-surface);color:var(--text-secondary)">' + esc(e.category || 'Other') + '</span></td>' +
                    '<td>' + esc(vendorDisplay) + '</td>' +
                    '<td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(e.description) + '">' + esc(e.description) + '</td>' +
                    '<td style="text-align:right;font-weight:600">' + Utils.formatCurrency(e.amount) + '</td>' +
                    '<td style="text-align:center">' + (isBillable ? '✅' : '❌') + '</td>' +
                    '<td style="white-space:nowrap;font-size:.85rem;color:' + payColor + '" class="er-pay er-pay-' + payState + '">' + esc(AppData.expensePaymentLabel(e)) + '</td>' +
                    '<td style="white-space:nowrap;font-size:.85rem" class="er-billed er-billed-' + AppData.expenseBilledState(e) + '">' + esc(billedText) + '</td>' +
                    '</tr>' +
                    '<tr class="er-expand-row" id="er-expand-' + e.id + '" style="display:none"><td colspan="10"></td></tr>';
            });

            html += '</tbody></table></div>';
        }

        self._container.innerHTML = html;

        // Filter event listeners
        var filterIds = ['erFProject', 'erFCategory', 'erFVendor', 'erFDateFrom', 'erFDateTo', 'erFBillable', 'erFInvoiced', 'erFPayment'];
        var filterKeys = ['projectId', 'category', 'vendorId', 'dateFrom', 'dateTo', 'billable', 'invoiced', 'payment'];
        filterIds.forEach(function(id, i) {
            var el = self._container.querySelector('#' + id);
            if (el) {
                el.addEventListener('change', function() {
                    self._filters[filterKeys[i]] = this.value;
                    self._selected = [];
                    self._renderView();
                });
            }
        });

        var clearBtn = self._container.querySelector('#erClearFilters');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                self._filters = { projectId: '', category: '', vendorId: '', vendorSearch: '', dateFrom: '', dateTo: '', billable: '', invoiced: '', payment: '' };
                self._selected = [];
                self._renderView();
            });
        }

        // Sort listeners
        self._container.querySelectorAll('.sortable').forEach(function(th) {
            th.addEventListener('click', function() {
                var col = th.dataset.col;
                if (self._sort.field === col) {
                    self._sort.dir = self._sort.dir === 'asc' ? 'desc' : 'asc';
                } else {
                    self._sort.field = col;
                    self._sort.dir = 'desc';
                }
                self._renderView();
            });
        });

        // Row expand
        self._container.querySelectorAll('.er-row').forEach(function(row) {
            row.style.cursor = 'pointer';
            row.addEventListener('click', function(e) {
                if (e.target.type === 'checkbox') return;
                var id = row.dataset.id;
                var expandRow = self._container.querySelector('#er-expand-' + id);
                if (!expandRow) return;
                if (expandRow.style.display === 'none') {
                    expandRow.style.display = '';
                    self._renderExpandRow(expandRow, id);
                } else {
                    expandRow.style.display = 'none';
                }
            });
        });

        // Checkboxes
        var selectAll = self._container.querySelector('#erSelectAll');
        if (selectAll) {
            selectAll.addEventListener('change', function() {
                self._selected = [];
                self._container.querySelectorAll('.er-cb').forEach(function(cb) {
                    cb.checked = selectAll.checked;
                    if (selectAll.checked) self._selected.push(cb.dataset.id);
                });
                self._updateBulkBar();
            });
        }

        self._container.querySelectorAll('.er-cb').forEach(function(cb) {
            cb.addEventListener('change', function() {
                if (cb.checked) {
                    if (self._selected.indexOf(cb.dataset.id) === -1) self._selected.push(cb.dataset.id);
                } else {
                    self._selected = self._selected.filter(function(id) { return id !== cb.dataset.id; });
                }
                self._updateBulkBar();
            });
        });

        // Bulk actions
        var markBillable = self._container.querySelector('#erMarkBillable');
        if (markBillable) {
            markBillable.addEventListener('click', async function() {
                await self._bulkSetBillable(true);
            });
        }
        var markNonBillable = self._container.querySelector('#erMarkNonBillable');
        if (markNonBillable) {
            markNonBillable.addEventListener('click', async function() {
                await self._bulkSetBillable(false);
            });
        }
        var markPaidBtn = self._container.querySelector('#erMarkPaid');
        if (markPaidBtn) markPaidBtn.addEventListener('click', function() { self._bulkMarkPaid(); });

        // Export CSV
        var exportBtn = self._container.querySelector('#erExportCsv');
        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                self._exportCsv(sorted);
            });
        }

        // Add Expense
        var addBtn = self._container.querySelector('#erAddExpense');
        if (addBtn) {
            addBtn.addEventListener('click', function() {
                self._showAddExpenseDialog();
            });
        }

        self._updateBulkBar();
    },

    _updateBulkBar() {
        var bar = this._container.querySelector('#erBulkBar');
        var count = this._container.querySelector('#erSelCount');
        if (!bar) return;
        if (this._selected.length > 0) {
            bar.style.display = 'flex';
            if (count) count.textContent = this._selected.length + ' selected';
        } else {
            bar.style.display = 'none';
        }
    },

    _renderExpandRow(expandRow, expenseId) {
        var expense = AppData.getExpense(expenseId);
        if (!expense) {
            expandRow.querySelector('td').innerHTML = '<em>Expense not found.</em>';
            return;
        }
        var esc = Utils.escapeHtml;
        var projects = AppData.getProjects();
        var projectMap = {};
        projects.forEach(function(p) { projectMap[p.id] = p.name; });
        var vendorDisplay = expense.vendorName || expense.vendor || '—';
        var worker = expense.workerId ? AppData.getWorker(expense.workerId) : null;

        var html = '<div style="display:flex;flex-wrap:wrap;gap:16px;font-size:.875rem">' +
            '<div><strong>Project:</strong> ' + esc(projectMap[expense.projectId] || '—') + '</div>' +
            '<div><strong>Date:</strong> ' + Utils.formatDate(expense.date) + '</div>' +
            '<div><strong>Category:</strong> ' + esc(expense.category || '—') + '</div>' +
            '<div><strong>Vendor:</strong> ' + esc(vendorDisplay) + '</div>' +
            (worker ? '<div><strong>Worker:</strong> ' + esc(worker.name) + '</div>' : '') +
            '<div><strong>Amount:</strong> ' + Utils.formatCurrency(expense.amount) + '</div>' +
            '<div><strong>Billable:</strong> ' + (expense.billable ? 'Yes' : 'No') + '</div>' +
            '<div><strong>Payment:</strong> ' + esc(AppData.expensePaymentLabel(expense)) + '</div>' +
            '<div><strong>Billed:</strong> ' + esc(expense.excludeFromInvoice ? 'Excluded from invoicing' + (expense.excludeReason ? ' (' + expense.excludeReason + ')' : '') : AppData.expenseBilledLabel(expense)) + '</div>' +
            (expense.source_timecard_id ? '<div><strong>Source:</strong> timecard line (' + esc(expense.source_type || '') + ')</div>' : '') +
            (expense.changeOrder ? '<div><strong style="color:var(--warning)">Change Order</strong></div>' : '') +
            '</div>';

        if (expense.notes) {
            html += '<div style="margin-top:8px;font-size:.85rem;color:var(--text-secondary)"><strong>Notes:</strong> ' + esc(expense.notes) + '</div>';
        }

        // Receipt photo
        if (expense.receiptPhotoId) {
            AppData.getPhoto(expense.receiptPhotoId).then(function(photo) {
                if (photo && photo.blob) {
                    var url = URL.createObjectURL(photo.blob);
                    var imgEl = expandRow.querySelector('.er-receipt-placeholder');
                    if (imgEl) imgEl.innerHTML = '<img src="' + url + '" class="er-receipt-img" alt="Receipt">';
                }
            }).catch(function() {});
        }

        html += '<div class="er-receipt-placeholder">' + (expense.receiptPhotoId ? '<em style="font-size:.8rem;color:var(--text-muted)">Loading receipt…</em>' : '') + '</div>';

        // Actions
        html += '<div style="margin-top:10px;display:flex;gap:8px">';
        if (AppData.expensePaymentType(expense) === 'payable' && !AppData.expenseIsPaid(expense)) {
            html += '<button class="btn btn-secondary btn-sm er-paid-btn" data-id="' + expense.id + '">Mark paid</button>';
        }
        if (!AppData.expenseIsBilled(expense) && expense.status !== 'approved') {
            html += '<button class="btn btn-secondary btn-sm er-edit-btn" data-id="' + expense.id + '">Edit</button>' +
                '<button class="btn btn-danger btn-sm er-del-btn" data-id="' + expense.id + '">Delete</button>';
        }
        html += '</div>';

        expandRow.querySelector('td').innerHTML = html;

        var paidBtn = expandRow.querySelector('.er-paid-btn');
        if (paidBtn) {
            paidBtn.addEventListener('click', async function() {
                var paidDate = window.prompt('Paid on (YYYY-MM-DD)', Utils.today());
                if (!paidDate) return;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) { Utils.showToast('Enter the date as YYYY-MM-DD', 'error'); return; }
                try {
                    await AppData.updateExpensePayment(expense.id, { paidDate: paidDate });
                    Utils.showToast('Marked paid ' + paidDate);
                    window.AdminExpensesReview._renderView();
                } catch (err) { Utils.showToast('Could not mark paid: ' + err.message, 'error'); }
            });
        }

        // Edit
        var editBtn = expandRow.querySelector('.er-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', function() {
                var exp = AppData.getExpense(editBtn.dataset.id);
                if (exp && window.AdminExpenses) {
                    AdminExpenses._projectId = exp.projectId;
                    AdminExpenses._showExpenseForm(exp.category, exp);
                }
            });
        }

        // Delete
        var delBtn = expandRow.querySelector('.er-del-btn');
        if (delBtn) {
            delBtn.addEventListener('click', async function() {
                var confirmed = await Utils.confirm('Delete this expense?');
                if (!confirmed) return;
                AppData.deleteExpense(delBtn.dataset.id);
                var username = (window.App && window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'Expense Deleted', 'Deleted from expenses review');
                Utils.showToast('Expense deleted');
                window.AdminExpensesReview._renderView();
            });
        }
    },

    async _bulkMarkPaid() {
        var self = this;
        if (self._selected.length === 0) return;
        var paidDate = window.prompt('Paid on (YYYY-MM-DD)', Utils.today());
        if (!paidDate) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) { Utils.showToast('Enter the date as YYYY-MM-DD', 'error'); return; }
        var done = 0, failed = 0;
        for (var _pi = 0; _pi < self._selected.length; _pi++) {
            var pe = AppData.getExpense(self._selected[_pi]);
            if (!pe || AppData.expenseIsPaid(pe)) continue;
            try { await AppData.updateExpensePayment(pe.id, { paidDate: paidDate }); done++; } catch (e) { failed++; }
        }
        Utils.showToast('Marked ' + done + ' paid' + (failed ? ', ' + failed + ' failed' : ''), failed ? 'error' : 'success');
        self._selected = [];
        self._renderView();
    },

    async _bulkSetBillable(billable) {
        var self = this;
        if (self._selected.length === 0) return;
        for (var _bi = 0; _bi < self._selected.length; _bi++) {
            var exp = AppData.getExpense(self._selected[_bi]);
            if (!exp || AppData.expenseIsBilled(exp) || exp.status === 'approved') continue;
            exp.billable = billable;
            exp.invoiceStatus = billable ? 'Ready to Invoice' : 'N/A';
            try { await AppData.saveEntityAsync('expenses', exp); } catch (e) { /* non-critical */ }
        }
        Utils.showToast('Updated ' + self._selected.length + ' expense(s)');
        self._selected = [];
        self._renderView();
    },

    _exportCsv(expenses) {
        var esc = function(v) { return '"' + String(v || '').replace(/"/g, '""') + '"'; };
        var projects = AppData.getProjects();
        var projectMap = {};
        projects.forEach(function(p) { projectMap[p.id] = p.name; });

        var header = ['Date', 'Project', 'Category', 'Vendor', 'Description', 'Amount', 'Billable', 'Payment', 'Due', 'Paid', 'Billed', 'Invoice', 'Change Order'];
        var rows = expenses.map(function(e) {
            var vendorDisplay = e.vendorName || e.vendor || '';
            return [
                esc(e.date || ''),
                esc(projectMap[e.projectId || e.project_id] || ''),
                esc(e.category || ''),
                esc(vendorDisplay),
                esc(e.description || ''),
                esc((parseFloat(e.amount) || 0).toFixed(2)),
                esc(e.billable ? 'Yes' : 'No'),
                esc(AppData.expensePaymentType(e)),
                esc(AppData.expenseDueDate(e)),
                esc(e.paidDate || (AppData.expensePaymentType(e) === 'paid' ? (e.date || '') : '')),
                esc(AppData.expenseBilledState(e)),
                esc(e.billedInvoiceNumber || ''),
                esc(e.changeOrder ? 'Yes' : 'No')
            ].join(',');
        });

        var csv = [header.join(',')].concat(rows).join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'ledgerman-expenses-' + Utils.today() + '.csv';
        a.click();
        URL.revokeObjectURL(url);
    },

    _showAddExpenseDialog() {
        var self = this;
        var esc = Utils.escapeHtml;
        var projects = AppData.getProjects();
        if (projects.length === 0) {
            Utils.showToast('Create a project first to add expenses.', 'error');
            return;
        }

        var bodyHtml = '<div class="form-group"><label class="form-label">Project</label>' +
            '<select class="form-control" id="erAddProject">' +
            projects.map(function(p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="form-group"><label class="form-label">Type</label>' +
            '<select class="form-control" id="erAddType">' +
            '<option value="Labor">Labor</option>' +
            '<option value="Equipment">Equipment</option>' +
            '<option value="Material" selected>Material</option>' +
            '</select></div>';

        var modal = UI.modal('Select Project & Type', bodyHtml, {
            width: '420px',
            submitLabel: 'Continue',
        });
        var q = function(s) { return modal.q(s); };

        modal.submitBtn.onclick = function() {
            var projectId = q('#erAddProject').value;
            var type = q('#erAddType').value;
            modal.close();
            if (window.AdminExpenses) {
                AdminExpenses._projectId = projectId;
                AdminExpenses._container = self._container;
                AdminExpenses._showExpenseForm(type, null);
                // After save, re-render expenses review
                var origRender = AdminExpenses._renderExpenses.bind(AdminExpenses);
                AdminExpenses._renderExpenses = function() {
                    AdminExpenses._renderExpenses = origRender;
                    self._renderView();
                };
            }
        };
    }
};
