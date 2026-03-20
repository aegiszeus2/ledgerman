// Admin Reports Module
window.AdminReports = {
    _activeTab: 'cost',

    render(container) {
        const self = this;
        self._container = container;
        self._renderReports();
    },

    _renderReports() {
        const self = this;
        const container = self._container;
        const tabs = [
            { id: 'cost', label: 'Cost Report' },
            { id: 'labor', label: 'Labor Report' },
            { id: 'expense', label: 'Expense Summary' },
            { id: 'invoice', label: 'Invoice Summary' }
        ];

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                <h2>Reports</h2>
                <div style="display:flex;gap:8px">
                    <button class="btn-secondary btn-sm" id="exportCsvBtn">⬇ Export CSV</button>
                    <button class="btn-secondary btn-sm" id="printReportBtn">Print Report</button>
                </div>
            </div>
            <div class="tabs" style="margin-bottom:16px">
                ${tabs.map(function(t) {
                    return '<button class="tab-btn ' + (self._activeTab === t.id ? 'active' : '') + '" data-tab="' + t.id + '">' + t.label + '</button>';
                }).join('')}
            </div>
            <div id="reportContent"></div>
        `;

        container.querySelector('#printReportBtn').addEventListener('click', function() {
            window.print();
        });

        container.querySelector('#exportCsvBtn').addEventListener('click', function() {
            self._exportCsv();
        });

        container.querySelectorAll('.tab-btn[data-tab]').forEach(function(tab) {
            tab.addEventListener('click', function() {
                self._activeTab = tab.dataset.tab;
                self._renderReports();
            });
        });

        const content = container.querySelector('#reportContent');
        switch (self._activeTab) {
            case 'cost': self._renderCostReport(content); break;
            case 'labor': self._renderLaborReport(content); break;
            case 'expense': self._renderExpenseSummary(content); break;
            case 'invoice': self._renderInvoiceSummary(content); break;
        }
    },

    _renderCostReport(content) {
        const projects = AppData.getProjects();
        const esc = Utils.escapeHtml;

        let html = '<div class="card" style="margin-bottom:16px">' +
            '<div class="form-group"><label>Select Project</label>' +
            '<select id="costProjectSelect"><option value="">-- Select a project --</option>' +
            projects.map(function(p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') +
            '</select></div></div>' +
            '<div id="costReportBody"></div>';
        content.innerHTML = html;

        content.querySelector('#costProjectSelect').addEventListener('change', function() {
            const projectId = this.value;
            const body = content.querySelector('#costReportBody');
            if (!projectId) { body.innerHTML = ''; return; }

            const project = AppData.getProject(projectId);
            const subtasks = AppData.getSubtasks(projectId);
            const expenses = AppData.getExpenses(projectId);
            const submissions = AppData.getSubmissions().filter(function(s) {
                return s.projectId === projectId && s.status === 'Approved';
            });

            if (subtasks.length === 0) {
                body.innerHTML = '<div class="card"><div class="empty"><h3>No Subtasks</h3><p>Add subtasks to this project to see cost data.</p></div></div>';
                return;
            }

            // Build subtask rows
            let totalBudgetedCost = 0, totalActualCost = 0;
            let totalBudgetedQty = 0, totalActualQty = 0;
            const rows = subtasks.map(function(st) {
                const actualQty = submissions
                    .filter(function(s) { return s.subtaskId === st.id; })
                    .reduce(function(sum, s) { return sum + (parseFloat(s.unitsCompleted) || 0); }, 0);
                const actualCost = expenses
                    .filter(function(e) { return e.subtaskId === st.id; })
                    .reduce(function(sum, e) { return sum + (parseFloat(e.amount) || 0); }, 0);
                const budgetedQty = parseFloat(st.budgetedQty) || 0;
                const budgetedCost = parseFloat(st.budgetedCost) || 0;
                const variance = budgetedCost - actualCost;
                const costPerUnit = actualQty > 0 ? actualCost / actualQty : 0;
                totalBudgetedCost += budgetedCost;
                totalActualCost += actualCost;
                totalBudgetedQty += budgetedQty;
                totalActualQty += actualQty;

                return '<tr>' +
                    '<td>' + esc(st.name) + '</td>' +
                    '<td class="amount">' + budgetedQty.toFixed(1) + '</td>' +
                    '<td class="amount">' + actualQty.toFixed(1) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(budgetedCost) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(actualCost) + '</td>' +
                    '<td class="amount" style="color:' + (variance >= 0 ? 'var(--success,green)' : 'var(--accent,red)') + '">' + Utils.formatCurrency(variance) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(costPerUnit) + '</td>' +
                '</tr>';
            });

            const totalVariance = totalBudgetedCost - totalActualCost;

            // Category totals
            const categories = {};
            expenses.forEach(function(e) {
                const cat = e.category || 'Material';
                if (!categories[cat]) categories[cat] = 0;
                categories[cat] += parseFloat(e.amount) || 0;
            });

            body.innerHTML = '<div class="card" style="margin-bottom:16px">' +
                '<h3 style="margin-bottom:12px">Cost Report: ' + esc(project.name) + '</h3>' +
                '<table><thead><tr>' +
                '<th>Subtask</th><th class="amount">Budget Qty</th><th class="amount">Actual Qty</th>' +
                '<th class="amount">Budget Cost</th><th class="amount">Actual Cost</th>' +
                '<th class="amount">Variance</th><th class="amount">Cost/Unit</th>' +
                '</tr></thead><tbody>' +
                rows.join('') +
                '<tr style="font-weight:700;border-top:2px solid var(--border)">' +
                '<td>TOTAL</td>' +
                '<td class="amount">' + totalBudgetedQty.toFixed(1) + '</td>' +
                '<td class="amount">' + totalActualQty.toFixed(1) + '</td>' +
                '<td class="amount">' + Utils.formatCurrency(totalBudgetedCost) + '</td>' +
                '<td class="amount">' + Utils.formatCurrency(totalActualCost) + '</td>' +
                '<td class="amount" style="color:' + (totalVariance >= 0 ? 'var(--success,green)' : 'var(--accent,red)') + '">' + Utils.formatCurrency(totalVariance) + '</td>' +
                '<td></td></tr>' +
                '</tbody></table></div>' +
                '<div class="card"><h3 style="margin-bottom:12px">Totals by Category</h3>' +
                (Object.keys(categories).length === 0
                    ? '<p style="color:var(--text2)">No expenses recorded yet.</p>'
                    : '<table><thead><tr><th>Category</th><th class="amount">Total</th><th class="amount">% of Total</th></tr></thead><tbody>' +
                        Object.keys(categories).map(function(cat) {
                            var pct = totalActualCost > 0 ? (categories[cat] / totalActualCost * 100).toFixed(1) : '0.0';
                            return '<tr><td><span class="cat-badge cat-' + cat.toLowerCase() + '">' + esc(cat) + '</span></td>' +
                                '<td class="amount">' + Utils.formatCurrency(categories[cat]) + '</td>' +
                                '<td class="amount">' + pct + '%</td></tr>';
                        }).join('') +
                        '<tr style="font-weight:700;border-top:2px solid var(--border)"><td>TOTAL</td><td class="amount">' +
                        Utils.formatCurrency(Object.values(categories).reduce(function(a, b) { return a + b; }, 0)) +
                        '</td><td class="amount">100%</td></tr></tbody></table>'
                ) +
                '</div>';
        });
    },

    _renderLaborReport(content) {
        const projects = AppData.getProjects();
        const esc = Utils.escapeHtml;

        content.innerHTML = `
            <div class="card" style="margin-bottom:16px">
                <div class="form-row">
                    <div class="form-group">
                        <label>Start Date</label>
                        <input type="date" id="laborStartDate">
                    </div>
                    <div class="form-group">
                        <label>End Date</label>
                        <input type="date" id="laborEndDate">
                    </div>
                    <div class="form-group">
                        <label>Project (optional)</label>
                        <select id="laborProjectFilter">
                            <option value="">All Projects</option>
                            ${projects.map(function(p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="display:flex;align-items:flex-end">
                        <button class="btn-primary btn-sm" id="laborGenerateBtn">Generate</button>
                    </div>
                </div>
            </div>
            <div id="laborReportBody"></div>
        `;

        content.querySelector('#laborGenerateBtn').addEventListener('click', function() {
            const startDate = content.querySelector('#laborStartDate').value;
            const endDate = content.querySelector('#laborEndDate').value;
            const projectId = content.querySelector('#laborProjectFilter').value;
            const body = content.querySelector('#laborReportBody');

            let submissions = AppData.getSubmissions().filter(function(s) {
                return s.status === 'Approved';
            });

            if (startDate) {
                submissions = submissions.filter(function(s) { return s.date >= startDate; });
            }
            if (endDate) {
                submissions = submissions.filter(function(s) { return s.date <= endDate; });
            }
            if (projectId) {
                submissions = submissions.filter(function(s) { return s.projectId === projectId; });
            }

            if (submissions.length === 0) {
                body.innerHTML = '<div class="card"><div class="empty"><h3>No Data</h3><p>No approved submissions found for the selected filters.</p></div></div>';
                return;
            }

            // Group by worker
            const byWorker = {};
            submissions.forEach(function(s) {
                const wid = s.workerId;
                if (!byWorker[wid]) {
                    const worker = AppData.getWorker(wid);
                    byWorker[wid] = { name: worker ? worker.name : 'Unknown', entries: [] };
                }
                byWorker[wid].entries.push(s);
            });

            let grandTotalHours = 0, grandTotalAmount = 0;
            let rows = '';
            Object.keys(byWorker).forEach(function(wid) {
                const group = byWorker[wid];
                let workerHours = 0, workerAmount = 0;
                group.entries.forEach(function(s) {
                    const project = AppData.getProject(s.projectId);
                    const hours = parseFloat(s.hours || s.hoursWorked) || 0;
                    const rate = parseFloat(s.rate || s.hourlyRate) || 0;
                    const amount = hours * rate;
                    workerHours += hours;
                    workerAmount += amount;
                    rows += '<tr>' +
                        '<td>' + esc(group.name) + '</td>' +
                        '<td>' + esc(project ? project.name : 'Unknown') + '</td>' +
                        '<td>' + Utils.formatDate(s.date) + '</td>' +
                        '<td class="amount">' + hours.toFixed(1) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(amount) + '</td>' +
                    '</tr>';
                });
                rows += '<tr style="font-weight:700;background:var(--bg)">' +
                    '<td colspan="3">' + esc(group.name) + ' Subtotal</td>' +
                    '<td class="amount">' + workerHours.toFixed(1) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(workerAmount) + '</td>' +
                '</tr>';
                grandTotalHours += workerHours;
                grandTotalAmount += workerAmount;
            });

            body.innerHTML = '<div class="card">' +
                '<h3 style="margin-bottom:12px">Labor Report' +
                (startDate || endDate ? ' (' + (startDate ? Utils.formatDate(startDate) : 'Start') + ' to ' + (endDate ? Utils.formatDate(endDate) : 'Present') + ')' : '') +
                '</h3>' +
                '<table><thead><tr><th>Worker</th><th>Project</th><th>Date</th><th class="amount">Hours</th><th class="amount">Amount</th></tr></thead><tbody>' +
                rows +
                '<tr style="font-weight:700;border-top:2px solid var(--border)">' +
                '<td colspan="3">GRAND TOTAL</td>' +
                '<td class="amount">' + grandTotalHours.toFixed(1) + '</td>' +
                '<td class="amount">' + Utils.formatCurrency(grandTotalAmount) + '</td>' +
                '</tr></tbody></table></div>';
        });
    },

    _renderExpenseSummary(content) {
        const projects = AppData.getProjects();
        const esc = Utils.escapeHtml;

        content.innerHTML = `
            <div class="card" style="margin-bottom:16px">
                <div class="form-group">
                    <label>Project (optional)</label>
                    <select id="expenseProjectFilter">
                        <option value="">All Projects</option>
                        ${projects.map(function(p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('')}
                    </select>
                </div>
            </div>
            <div id="expenseReportBody"></div>
        `;

        function generate() {
            const projectId = content.querySelector('#expenseProjectFilter').value;
            const body = content.querySelector('#expenseReportBody');
            const expenses = AppData.getExpenses(projectId || undefined);

            if (expenses.length === 0) {
                body.innerHTML = '<div class="card"><div class="empty"><h3>No Expenses</h3><p>No expenses found.</p></div></div>';
                return;
            }

            if (projectId) {
                // Group by category for single project
                const byCategory = {};
                expenses.forEach(function(e) {
                    const cat = e.category || 'Material';
                    if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0 };
                    byCategory[cat].count++;
                    byCategory[cat].total += parseFloat(e.amount) || 0;
                });

                const grandTotal = Object.values(byCategory).reduce(function(sum, c) { return sum + c.total; }, 0);
                const project = AppData.getProject(projectId);

                body.innerHTML = '<div class="card"><h3 style="margin-bottom:12px">Expense Summary: ' + esc(project ? project.name : '') + '</h3>' +
                    '<table><thead><tr><th>Category</th><th class="amount">Count</th><th class="amount">Total</th></tr></thead><tbody>' +
                    Object.keys(byCategory).map(function(cat) {
                        return '<tr><td><span class="cat-badge cat-' + cat.toLowerCase() + '">' + esc(cat) + '</span></td>' +
                            '<td class="amount">' + byCategory[cat].count + '</td>' +
                            '<td class="amount">' + Utils.formatCurrency(byCategory[cat].total) + '</td></tr>';
                    }).join('') +
                    '<tr style="font-weight:700;border-top:2px solid var(--border)"><td>TOTAL</td>' +
                    '<td class="amount">' + expenses.length + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(grandTotal) + '</td></tr>' +
                    '</tbody></table></div>';
            } else {
                // Group by project, then category
                const byProject = {};
                expenses.forEach(function(e) {
                    const pid = e.projectId || 'unassigned';
                    if (!byProject[pid]) byProject[pid] = { expenses: [], name: '' };
                    byProject[pid].expenses.push(e);
                    if (!byProject[pid].name) {
                        const project = AppData.getProject(pid);
                        byProject[pid].name = project ? project.name : 'Unassigned';
                    }
                });

                let html = '';
                let grandTotal = 0;
                Object.keys(byProject).forEach(function(pid) {
                    const group = byProject[pid];
                    const byCategory = {};
                    group.expenses.forEach(function(e) {
                        const cat = e.category || 'Material';
                        if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0 };
                        byCategory[cat].count++;
                        byCategory[cat].total += parseFloat(e.amount) || 0;
                    });
                    const projectTotal = group.expenses.reduce(function(sum, e) { return sum + (parseFloat(e.amount) || 0); }, 0);
                    grandTotal += projectTotal;

                    html += '<div class="card" style="margin-bottom:12px"><h3 style="margin-bottom:8px">' + esc(group.name) + '</h3>' +
                        '<table><thead><tr><th>Category</th><th class="amount">Count</th><th class="amount">Total</th></tr></thead><tbody>' +
                        Object.keys(byCategory).map(function(cat) {
                            return '<tr><td><span class="cat-badge cat-' + cat.toLowerCase() + '">' + esc(cat) + '</span></td>' +
                                '<td class="amount">' + byCategory[cat].count + '</td>' +
                                '<td class="amount">' + Utils.formatCurrency(byCategory[cat].total) + '</td></tr>';
                        }).join('') +
                        '<tr style="font-weight:700;border-top:2px solid var(--border)"><td>Project Total</td><td class="amount">' +
                        group.expenses.length + '</td><td class="amount">' + Utils.formatCurrency(projectTotal) + '</td></tr>' +
                        '</tbody></table></div>';
                });

                html += '<div class="card" style="font-weight:700;padding:12px 16px;font-size:1.1rem">Grand Total: ' + Utils.formatCurrency(grandTotal) + '</div>';
                body.innerHTML = html;
            }
        }

        content.querySelector('#expenseProjectFilter').addEventListener('change', generate);
        generate();
    },

    // ── CSV Export ──────────────────────────────────────────────────────────────

    _csvEscape(val) {
        if (val === null || val === undefined) return '';
        var str = String(val);
        if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    },

    _csvRow(fields) {
        var self = this;
        return fields.map(function(f) { return self._csvEscape(f); }).join(',');
    },

    _downloadCsv(csvContent, reportType) {
        var today = new Date().toISOString().slice(0, 10);
        var filename = 'ledgerman-' + reportType + '-' + today + '.csv';
        var blob = new Blob([csvContent], { type: 'text/csv' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    _exportCsv() {
        var self = this;
        switch (self._activeTab) {
            case 'cost':    self._exportCostCsv();    break;
            case 'labor':   self._exportLaborCsv();   break;
            case 'expense': self._exportExpenseCsv(); break;
            case 'invoice': self._exportInvoiceCsv(); break;
        }
    },

    _exportCostCsv() {
        var self = this;
        var container = self._container;
        var select = container.querySelector('#costProjectSelect');
        if (!select || !select.value) {
            alert('Please select a project first.');
            return;
        }
        var projectId = select.value;
        var project = AppData.getProject(projectId);
        var subtasks = AppData.getSubtasks(projectId);
        var expenses = AppData.getExpenses(projectId);
        var submissions = AppData.getSubmissions().filter(function(s) {
            return s.projectId === projectId && s.status === 'Approved';
        });

        var headers = ['Project', 'Subtask', 'UOM', 'Budgeted Qty', 'Actual Qty', '% Complete', 'Budgeted Cost', 'Actual Cost', 'Variance'];
        var lines = [self._csvRow(headers)];

        subtasks.forEach(function(st) {
            var actualQty = submissions
                .filter(function(s) { return s.subtaskId === st.id; })
                .reduce(function(sum, s) { return sum + (parseFloat(s.unitsCompleted) || 0); }, 0);
            var actualCost = expenses
                .filter(function(e) { return e.subtaskId === st.id; })
                .reduce(function(sum, e) { return sum + (parseFloat(e.amount) || 0); }, 0);
            var budgetedQty = parseFloat(st.budgetedQty) || 0;
            var budgetedCost = parseFloat(st.budgetedCost) || 0;
            var variance = budgetedCost - actualCost;
            var pctComplete = budgetedQty > 0 ? (actualQty / budgetedQty * 100).toFixed(1) : '0.0';

            lines.push(self._csvRow([
                project ? project.name : '',
                st.name,
                st.uom || '',
                budgetedQty.toFixed(2),
                actualQty.toFixed(2),
                pctComplete,
                budgetedCost.toFixed(2),
                actualCost.toFixed(2),
                variance.toFixed(2)
            ]));
        });

        self._downloadCsv(lines.join('\n'), 'cost');
    },

    _exportLaborCsv() {
        var self = this;
        var container = self._container;
        var startDateEl = container.querySelector('#laborStartDate');
        var endDateEl = container.querySelector('#laborEndDate');
        var projectFilterEl = container.querySelector('#laborProjectFilter');
        var startDate = startDateEl ? startDateEl.value : '';
        var endDate = endDateEl ? endDateEl.value : '';
        var projectId = projectFilterEl ? projectFilterEl.value : '';

        var submissions = AppData.getSubmissions().filter(function(s) {
            return s.status === 'Approved';
        });
        if (startDate) submissions = submissions.filter(function(s) { return s.date >= startDate; });
        if (endDate)   submissions = submissions.filter(function(s) { return s.date <= endDate; });
        if (projectId) submissions = submissions.filter(function(s) { return s.projectId === projectId; });

        var headers = ['Date', 'Worker', 'Project', 'Description', 'Hours', 'Status'];
        var lines = [self._csvRow(headers)];

        submissions.forEach(function(s) {
            var worker = AppData.getWorker(s.workerId);
            var project = AppData.getProject(s.projectId);
            lines.push(self._csvRow([
                s.date || '',
                worker ? worker.name : 'Unknown',
                project ? project.name : 'Unknown',
                s.description || s.notes || '',
                (parseFloat(s.hours || s.hoursWorked) || 0).toFixed(2),
                s.status || ''
            ]));
        });

        self._downloadCsv(lines.join('\n'), 'labor');
    },

    _exportExpenseCsv() {
        var self = this;
        var container = self._container;
        var projectFilterEl = container.querySelector('#expenseProjectFilter');
        var projectId = projectFilterEl ? projectFilterEl.value : '';
        var expenses = AppData.getExpenses(projectId || undefined);

        var headers = ['Category', 'Description', 'Amount', 'Date', 'Project', 'Note'];
        var lines = [self._csvRow(headers)];

        expenses.forEach(function(e) {
            var project = AppData.getProject(e.projectId);
            lines.push(self._csvRow([
                e.category || 'Material',
                e.description || '',
                (parseFloat(e.amount) || 0).toFixed(2),
                e.date || '',
                project ? project.name : '',
                e.note || e.notes || ''
            ]));
        });

        self._downloadCsv(lines.join('\n'), 'expense');
    },

    _exportInvoiceCsv() {
        var self = this;
        var invoices = AppData.getInvoices();

        var headers = ['Invoice #', 'Client', 'Project', 'Issue Date', 'Due Date', 'Amount', 'Status', 'Paid Amount', 'Balance'];
        var lines = [self._csvRow(headers)];

        invoices.forEach(function(inv) {
            var project = AppData.getProject(inv.projectId);
            var payments = AppData.getPayments(inv.id);
            var paid = payments.reduce(function(sum, p) { return sum + (parseFloat(p.amount) || 0); }, 0);
            var total = parseFloat(inv.total) || 0;
            var balance = Math.max(0, total - paid);
            var status = inv.status || 'Unpaid';
            if (balance <= 0.01 && total > 0) status = 'Paid';
            else if (paid > 0.01) status = 'Partial';
            else if (inv.dueDate && new Date(inv.dueDate) < new Date()) status = 'Overdue';

            lines.push(self._csvRow([
                inv.invoiceNumber || '',
                inv.clientName || (project ? project.clientName || project.client : '') || '',
                project ? project.name : (inv.projectName || ''),
                inv.date || '',
                inv.dueDate || '',
                total.toFixed(2),
                status,
                paid.toFixed(2),
                balance.toFixed(2)
            ]));
        });

        self._downloadCsv(lines.join('\n'), 'invoice');
    },

    // ── End CSV Export ───────────────────────────────────────────────────────────

    _renderInvoiceSummary(content) {
        const invoices = AppData.getInvoices();
        const esc = Utils.escapeHtml;

        if (invoices.length === 0) {
            content.innerHTML = '<div class="card"><div class="empty"><h3>No Invoices</h3><p>No invoices have been created yet.</p></div></div>';
            return;
        }

        let totalAmount = 0, totalPaid = 0, totalOutstanding = 0;
        const rows = invoices.map(function(inv) {
            const project = AppData.getProject(inv.projectId);
            const payments = AppData.getPayments(inv.id);
            const paid = payments.reduce(function(sum, p) { return sum + (parseFloat(p.amount) || 0); }, 0);
            const total = parseFloat(inv.total) || 0;
            const outstanding = Math.max(0, total - paid);
            let status = inv.status || 'Unpaid';
            if (outstanding <= 0.01 && total > 0) status = 'Paid';
            else if (paid > 0.01) status = 'Partial';
            else if (inv.dueDate && new Date(inv.dueDate) < new Date()) status = 'Overdue';
            const statusClass = status === 'Paid' ? 'active-s' : (status === 'Overdue' ? 'completed-s' : '');

            totalAmount += total;
            totalPaid += paid;
            totalOutstanding += outstanding;

            return '<tr>' +
                '<td><strong>' + esc(inv.invoiceNumber || '') + '</strong></td>' +
                '<td>' + esc(project ? project.name : (inv.projectName || '')) + '</td>' +
                '<td>' + esc(inv.clientName || (project ? project.clientName || project.client : '') || '') + '</td>' +
                '<td>' + Utils.formatDate(inv.date) + '</td>' +
                '<td class="amount">' + Utils.formatCurrency(total) + '</td>' +
                '<td class="amount">' + Utils.formatCurrency(paid) + '</td>' +
                '<td class="amount">' + Utils.formatCurrency(outstanding) + '</td>' +
                '<td><span class="pstatus ' + statusClass + '">' + esc(status) + '</span></td>' +
            '</tr>';
        });

        content.innerHTML = '<div class="card">' +
            '<h3 style="margin-bottom:12px">Invoice Summary</h3>' +
            '<table><thead><tr>' +
            '<th>Invoice #</th><th>Project</th><th>Client</th><th>Date</th>' +
            '<th class="amount">Total</th><th class="amount">Paid</th><th class="amount">Outstanding</th><th>Status</th>' +
            '</tr></thead><tbody>' +
            rows.join('') +
            '<tr style="font-weight:700;border-top:2px solid var(--border)">' +
            '<td colspan="4">TOTALS</td>' +
            '<td class="amount">' + Utils.formatCurrency(totalAmount) + '</td>' +
            '<td class="amount">' + Utils.formatCurrency(totalPaid) + '</td>' +
            '<td class="amount">' + Utils.formatCurrency(totalOutstanding) + '</td>' +
            '<td></td></tr>' +
            '</tbody></table></div>';
    }
};
