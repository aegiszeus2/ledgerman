// Admin Expenses Module
window.AdminExpenses = {
    _projectId: null,
    _tab: 'ready',
    _categoryFilter: 'All',

    render(container, projectId) {
        const self = this;
        self._container = container;
        if (projectId) self._projectId = projectId;
        const projects = AppData.getProjects();

        if (!self._projectId && projects.length > 0) {
            self._projectId = projects[0].id;
        }

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                <h2>Expenses</h2>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <label style="font-size:.85rem;color:var(--text2)">Project:</label>
                    <select class="form-control" id="expenseProjectSelect" style="width:auto;min-width:200px">
                        ${projects.length === 0 ? '<option value="">No projects</option>' : ''}
                        ${projects.map(function(p) {
                            return '<option value="' + p.id + '"' + (self._projectId === p.id ? ' selected' : '') + '>' + Utils.escapeHtml(p.name) + '</option>';
                        }).join('')}
                    </select>
                    <button class="btn-primary btn-sm" id="addExpenseBtn" ${!self._projectId ? 'disabled' : ''}>+ Add Expense</button>
                    <button class="btn-secondary btn-sm" id="expensesExportCsvBtn">Export CSV</button>
                    <button class="btn-secondary btn-sm" id="expensesPrintBtn">Print / PDF</button>
                </div>
            </div>
            <div id="expenseContent"></div>
        `;

        container.querySelector('#expenseProjectSelect').addEventListener('change', function() {
            self._projectId = this.value;
            self._renderExpenses();
        });

        container.querySelector('#addExpenseBtn').addEventListener('click', function() {
            if (!self._projectId) return;
            self._showTypeSelector();
        });

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

        container.querySelector('#expensesExportCsvBtn').addEventListener('click', function() {
            var allExpenses = self._projectId ? AppData.getExpenses(self._projectId) : AppData.getExpenses();
            var rows = [csvRow(['Date','Project','Category','Description','Amount','Vendor','Billable','Invoiced'])];
            allExpenses.forEach(function(e) {
                var proj = AppData.getProject(e.projectId);
                rows.push(csvRow([
                    e.date || '',
                    proj ? proj.name : '',
                    e.category || '',
                    e.description || '',
                    e.amount || '',
                    e.vendorName || e.vendor || '',
                    e.billable ? 'Yes' : 'No',
                    e.invoiceStatus || ''
                ]));
            });
            downloadCsv(rows.join('\n'), 'expenses');
        });

        container.querySelector('#expensesPrintBtn').addEventListener('click', function() {
            if (!document.getElementById('expensesPrintStyle')) {
                var s = document.createElement('style');
                s.id = 'expensesPrintStyle';
                s.textContent = '@media print { .admin-nav,.worker-nav,#adminSidebar,.btn-primary,.btn-secondary,.tab-btn,#pageHelpBtn { display:none!important; } body { font-size:11pt; } .card { box-shadow:none; border:1px solid #ddd; } }';
                document.head.appendChild(s);
            }
            window.print();
        });

        self._renderExpenses();
    },

    _renderExpenses() {
        const self = this;
        const contentEl = self._container.querySelector('#expenseContent');
        if (!self._projectId) {
            contentEl.innerHTML = '<div class="empty"><h3>No Project Selected</h3><p>Create a project first, then add expenses.</p></div>';
            return;
        }

        const expenses = AppData.getExpenses(self._projectId);
        const ready = expenses.filter(function(e) { return e.billable && e.invoiceStatus !== 'Already Invoiced'; });
        const invoiced = expenses.filter(function(e) { return e.invoiceStatus === 'Already Invoiced'; });
        const nonBillable = expenses.filter(function(e) { return !e.billable; });

        const tabs = [
            { key: 'ready', label: 'Ready to Invoice', count: ready.length },
            { key: 'invoiced', label: 'Already Invoiced', count: invoiced.length },
            { key: 'nonbillable', label: 'Non-Billable', count: nonBillable.length },
            { key: 'all', label: 'All Expenses', count: expenses.length }
        ];

        let displayExpenses;
        switch (self._tab) {
            case 'ready': displayExpenses = ready; break;
            case 'invoiced': displayExpenses = invoiced; break;
            case 'nonbillable': displayExpenses = nonBillable; break;
            default: displayExpenses = expenses; break;
        }

        // Category filter
        if (self._categoryFilter !== 'All') {
            displayExpenses = displayExpenses.filter(function(e) { return e.category === self._categoryFilter; });
        }

        contentEl.innerHTML = `
            <div class="tabs">
                ${tabs.map(function(t) {
                    return '<button class="tab-btn' + (self._tab === t.key ? 'active' : '') + '" data-tab="' + t.key + '">' + t.label + ' (' + t.count + ')</button>';
                }).join('')}
            </div>

            <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <label style="font-size:.85rem;color:var(--text2)">Filter by category:</label>
                <select class="form-control" id="expCategoryFilter" style="width:auto">
                    <option value="All" ${self._categoryFilter === 'All' ? 'selected' : ''}>All Categories</option>
                    <option value="Labor" ${self._categoryFilter === 'Labor' ? 'selected' : ''}>Labor</option>
                    <option value="Equipment" ${self._categoryFilter === 'Equipment' ? 'selected' : ''}>Equipment</option>
                    <option value="Material" ${self._categoryFilter === 'Material' ? 'selected' : ''}>Material</option>
                </select>
            </div>

            <div class="card">
                ${displayExpenses.length === 0
                    ? '<div class="empty"><h3>No Expenses</h3><p>No expenses match the current filters.</p></div>'
                    : `<table>
                        <thead><tr><th>Date</th><th>Type</th><th>Description</th><th class="amount">Amount</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>${displayExpenses.map(function(e) {
                            const source = e.source === 'Worker Submission' ? '<br><span style="font-size:.7rem;color:var(--text2)">(Worker Submission)</span>' : '';
                            const changeOrder = e.changeOrder ? ' <span style="color:var(--warn);font-size:.7rem;font-weight:700">CO</span>' : '';
                            return '<tr>' +
                                '<td>' + Utils.formatDate(e.date) + '</td>' +
                                '<td><span class="cat-badge cat-' + (e.category || 'material').toLowerCase() + '">' + Utils.escapeHtml(e.category || 'Material') + '</span></td>' +
                                '<td>' + Utils.escapeHtml(e.description) + changeOrder + source + '</td>' +
                                '<td class="amount">' + Utils.formatCurrency(e.amount) + '</td>' +
                                '<td style="font-size:.8rem">' + Utils.escapeHtml(e.billable ? (e.invoiceStatus || 'Ready to Invoice') : 'Non-Billable') + '</td>' +
                                '<td style="white-space:nowrap">' +
                                    (e.invoiceStatus !== 'Already Invoiced'
                                        ? '<button class="btn-ghost btn-sm edit-expense" data-id="' + e.id + '">Edit</button>' +
                                          '<button class="btn-ghost btn-sm delete-expense" data-id="' + e.id + '" style="color:var(--accent)">Del</button>'
                                        : '<span style="font-size:.8rem;color:var(--text2)">Locked</span>') +
                                '</td>' +
                            '</tr>';
                        }).join('')}</tbody>
                        <tfoot><tr>
                            <td colspan="3" style="font-weight:700">Total</td>
                            <td class="amount" style="font-weight:700;border-top:2px solid var(--border)">${Utils.formatCurrency(displayExpenses.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0))}</td>
                            <td colspan="2"></td>
                        </tr></tfoot>
                    </table>`
                }
            </div>
        `;

        contentEl.querySelectorAll('.tab-btn[data-tab]').forEach(function(tab) {
            tab.addEventListener('click', function() {
                self._tab = tab.dataset.tab;
                self._renderExpenses();
            });
        });

        contentEl.querySelector('#expCategoryFilter').addEventListener('change', function() {
            self._categoryFilter = this.value;
            self._renderExpenses();
        });

        contentEl.querySelectorAll('.edit-expense').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const expense = AppData.getExpense(btn.dataset.id);
                if (expense) self._showExpenseForm(expense.category, expense);
            });
        });

        contentEl.querySelectorAll('.delete-expense').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                const confirmed = await Utils.confirm('Delete this expense?');
                if (!confirmed) return;
                AppData.deleteExpense(btn.dataset.id);
                const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'Expense Deleted', 'Project expense removed');
                Utils.showToast('Expense deleted');
                self._renderExpenses();
            });
        });
    },

    _showTypeSelector() {
        const self = this;
        const typeBodyHtml = `
            <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
                <button class="btn-primary" style="padding:16px;font-size:1rem" data-type="Labor">
                    Labor
                    <div style="font-size:.8rem;font-weight:normal;margin-top:4px">Worker hours, flat rate labor</div>
                </button>
                <button class="btn-secondary" style="padding:16px;font-size:1rem" data-type="Equipment">
                    Equipment
                    <div style="font-size:.8rem;font-weight:normal;margin-top:4px">Equipment rental, tools</div>
                </button>
                <button class="btn-secondary" style="padding:16px;font-size:1rem" data-type="Material">
                    Material
                    <div style="font-size:.8rem;font-weight:normal;margin-top:4px">Building materials, supplies</div>
                </button>
            </div>
        `;
        const modal = UI.modal('Select Expense Type', typeBodyHtml, { width: '400px', noFooter: true });
        modal.overlay.querySelectorAll('[data-type]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                modal.close();
                self._showExpenseForm(btn.dataset.type, null);
            });
        });
    },

    _showExpenseForm(type, existing) {
        const self = this;
        const isEdit = !!existing;
        const esc = Utils.escapeHtml;
        const workers = AppData.getWorkers().filter(function(w) { return w.status === 'Active'; });
        const subtasks = AppData.getSubtasks(self._projectId);
        const isLabor = type === 'Labor';
        const vendors = AppData.getData('vendors') || [];
        const existingVendorId = existing ? (existing.vendorId || '') : '';
        const existingVendorManual = existing ? (existing.vendorName || existing.vendor || '') : '';
        const isVendorManual = !existingVendorId && !!existingVendorManual;
        const vendorOptionsHtml = vendors.map(function(v) {
            return '<option value="' + v.id + '"' + (existingVendorId === v.id ? ' selected' : '') + '>' + esc(v.name) + '</option>';
        }).join('');
        const vendorFieldHtml = '<div class="form-group" style="margin-bottom:12px"><label>Vendor</label>' +
            '<select class="form-control" name="vendorSelect" id="vendorSelectField">' +
            '<option value="">-- No Vendor --</option>' + vendorOptionsHtml +
            '<option value="__manual__"' + (isVendorManual ? ' selected' : '') + '>Type manually...</option>' +
            '</select></div>' +
            '<div class="form-group" id="vendorManualGroup" style="margin-bottom:12px;' + (isVendorManual ? '' : 'display:none') + '">' +
            '<label>Vendor Name</label><input class="form-control" name="vendorManual" value="' + esc(existingVendorManual) + '" placeholder="Enter vendor name"></div>';

        let formFields = '';
        if (isLabor) {
            formFields = `
                <div class="form-group" style="margin-bottom:12px">
                    <label>Worker</label>
                    <select class="form-control" name="workerId">
                        <option value="">-- Select Worker --</option>
                        ${workers.map(function(w) {
                            return '<option value="' + w.id + '"' + (existing && existing.workerId === w.id ? ' selected' : '') + '>' + esc(w.name) + '</option>';
                        }).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px">
                    <label>Date *</label>
                    <input class="form-control" type="date" name="date" value="${existing ? existing.date || '' : Utils.today()}" required>
                </div>
                <div class="form-group" style="margin-bottom:12px">
                    <label>Subtask</label>
                    <select class="form-control" name="subtaskId">
                        <option value="">-- None --</option>
                        ${subtasks.map(function(s) {
                            return '<option value="' + s.id + '"' + (existing && existing.subtaskId === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
                        }).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px">
                    <label>Description *</label>
                    <input class="form-control" name="description" value="${esc(existing ? existing.description : '')}" required>
                </div>
                ${vendorFieldHtml}
                <div class="form-group" style="margin-bottom:12px">
                    <label>Rate Type</label>
                    <select class="form-control" id="laborRateType">
                        <option value="hourly" ${(!existing || existing.rateType !== 'flat') ? 'selected' : ''}>Hourly</option>
                        <option value="flat" ${existing && existing.rateType === 'flat' ? 'selected' : ''}>Flat Rate</option>
                    </select>
                </div>
                <div id="hourlyFields" class="form-row" ${existing && existing.rateType === 'flat' ? 'style="display:none"' : ''}>
                    <div class="form-group">
                        <label>Hours</label>
                        <input class="form-control" type="number" name="hours" step="0.25" min="0" value="${existing ? existing.hours || '' : ''}">
                    </div>
                    <div class="form-group">
                        <label>Rate ($/hr)</label>
                        <input class="form-control" type="number" name="rate" step="0.01" min="0" value="${existing ? existing.rate || '' : ''}">
                    </div>
                </div>
                <div id="flatFields" class="form-group" style="margin-bottom:12px;${(!existing || existing.rateType !== 'flat') ? 'display:none' : ''}">
                    <label>Flat Amount ($)</label>
                    <input class="form-control" type="number" name="flatAmount" step="0.01" min="0" value="${existing && existing.rateType === 'flat' ? existing.amount || '' : ''}">
                </div>
            `;
        } else {
            formFields = `
                <div class="form-group" style="margin-bottom:12px">
                    <label>Description *</label>
                    <input class="form-control" name="description" value="${esc(existing ? existing.description : '')}" required>
                </div>
                ${vendorFieldHtml}
                <div class="form-row">
                    <div class="form-group">
                        <label>Date *</label>
                        <input class="form-control" type="date" name="date" value="${existing ? existing.date || '' : Utils.today()}" required>
                    </div>
                    <div class="form-group">
                        <label>Amount ($) *</label>
                        <input class="form-control" type="number" name="amount" step="0.01" min="0" value="${existing ? existing.amount || '' : ''}" required>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:12px">
                    <label>Subtask</label>
                    <select class="form-control" name="subtaskId">
                        <option value="">-- None --</option>
                        ${subtasks.map(function(s) {
                            return '<option value="' + s.id + '"' + (existing && existing.subtaskId === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
                        }).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:12px">
                    <label>Notes</label>
                    <textarea class="form-control" name="notes" rows="2">${esc(existing ? existing.notes : '')}</textarea>
                </div>
            `;
        }

        const bodyHtml = `
            <form id="expenseFormModal" novalidate>
                ${formFields}
                <div class="form-row">
                    <div class="form-group">
                        <div class="toggle-wrap">
                            <label class="toggle">
                                <input type="checkbox" name="billable" ${(!existing || existing.billable) ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                            <span>Billable</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="toggle-wrap">
                            <label class="toggle">
                                <input type="checkbox" name="changeOrder" ${existing && existing.changeOrder ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                            <span>Change Order</span>
                        </div>
                    </div>
                </div>
            </form>
        `;

        const modal = UI.modal(
            (isEdit ? 'Edit' : 'Add') + ' ' + type + ' Expense',
            bodyHtml,
            { width: '550px', submitLabel: (isEdit ? 'Update' : 'Add') + ' Expense' }
        );
        const q = s => modal.q(s);

        // Labor rate type toggle
        if (isLabor) {
            q('#laborRateType').addEventListener('change', function() {
                const isFlat = this.value === 'flat';
                q('#hourlyFields').style.display = isFlat ? 'none' : '';
                q('#flatFields').style.display = isFlat ? '' : 'none';
            });
        }

        // Vendor select toggle
        var vendorSelectToggle = q('#vendorSelectField');
        if (vendorSelectToggle) {
            vendorSelectToggle.addEventListener('change', function() {
                var manualGroup = q('#vendorManualGroup');
                if (manualGroup) manualGroup.style.display = (this.value === '__manual__') ? '' : 'none';
            });
        }

        q('#expenseFormModal').addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!Utils.validateForm(this)) return;
            const fd = Utils.getFormData(this);
            if (!fd.description || !fd.description.trim()) {
                Utils.showToast('Description is required', 'error');
                return;
            }

            let amount = 0;
            let rateType = '';
            if (isLabor) {
                rateType = q('#laborRateType').value;
                if (rateType === 'flat') {
                    amount = parseFloat(fd.flatAmount) || 0;
                } else {
                    const hours = parseFloat(fd.hours) || 0;
                    const rate = parseFloat(fd.rate) || 0;
                    amount = hours * rate;
                }
            } else {
                amount = parseFloat(fd.amount) || 0;
            }

            if (amount <= 0) {
                Utils.showToast('Amount must be greater than zero', 'error');
                return;
            }

            const billable = !!q('[name="billable"]').checked;
            const changeOrder = !!q('[name="changeOrder"]').checked;

            const expenseData = {
                id: isEdit ? existing.id : AppData.generateId(),
                projectId: self._projectId,
                category: type,
                description: fd.description.trim(),
                date: fd.date || Utils.today(),
                amount: amount,
                billable: billable,
                changeOrder: changeOrder,
                invoiceStatus: billable ? (isEdit && existing.invoiceStatus === 'Already Invoiced' ? 'Already Invoiced' : 'Ready to Invoice') : 'N/A',
                subtaskId: fd.subtaskId || '',
                source: isEdit ? (existing.source || '') : ''
            };

            if (isLabor) {
                expenseData.workerId = fd.workerId || '';
                expenseData.rateType = rateType;
                expenseData.hours = parseFloat(fd.hours) || 0;
                expenseData.rate = parseFloat(fd.rate) || 0;
            } else {
                expenseData.notes = (fd.notes || '').trim();
            }

            // Vendor capture (all expense types)
            var vendorSelEl = q('[name="vendorSelect"]');
            if (vendorSelEl) {
                var vendorVal = vendorSelEl.value;
                if (vendorVal === '__manual__') {
                    var vmEl = q('[name="vendorManual"]');
                    expenseData.vendorId = '';
                    expenseData.vendorName = vmEl ? vmEl.value.trim() : '';
                } else if (vendorVal) {
                    expenseData.vendorId = vendorVal;
                    var matchVendor = vendors.find(function(v) { return v.id === vendorVal; });
                    expenseData.vendorName = matchVendor ? matchVendor.name : '';
                } else {
                    expenseData.vendorId = '';
                    expenseData.vendorName = '';
                }
                // Keep 'vendor' field for backward compat
                if (!isLabor) expenseData.vendor = expenseData.vendorName || '';
            } else {
                // Preserve existing vendor text if no select found
                expenseData.vendorId = existing ? (existing.vendorId || '') : '';
                expenseData.vendorName = existing ? (existing.vendorName || existing.vendor || '') : '';
                if (!isLabor) expenseData.vendor = expenseData.vendorName || '';
            }

            const restore = UI.btnLoading(modal.submitBtn, 'Saving…');
            try {
                await AppData.saveEntityAsync('expenses', expenseData);
            } catch(err) {
                restore();
                Utils.showToast('Save failed: ' + err.message, 'error');
                return;
            }
            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, isEdit ? 'Expense Updated' : 'Expense Added', type + ': ' + expenseData.description + ' - ' + Utils.formatCurrency(amount));
            Utils.showToast(isEdit ? 'Expense updated' : 'Expense added');
            modal.close();
            self._renderExpenses();
        });

        if (modal.submitBtn) modal.submitBtn.addEventListener('click', () => q('#expenseFormModal').requestSubmit());
    }
};
