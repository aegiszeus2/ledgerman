// Admin Reports Module
window.AdminReports = {

    render(container) {
        const self = this;
        self._container = container;

        if (!self._dateRange) {
            const today = new Date();
            const firstDayPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            self._dateRange = {
                start: firstDayPrevMonth.toISOString().slice(0, 10),
                end: lastDayPrevMonth.toISOString().slice(0, 10)
            };
        }

        if (!self._selectedReport) {
            self._selectedReport = 'cost';
        }

        self._renderReports();
    },

    _renderReports() {
        const self = this;
        const container = self._container;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                <h2>Reports</h2>
                <div style="display:flex;gap:8px">
                    <button class="btn-secondary btn-sm" id="exportCsvBtn">⬇ Export CSV</button>
                    <button class="btn-secondary btn-sm" id="printReportBtn">🖨 Print Report</button>
                </div>
            </div>
            <div class="report-controls" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:16px;padding:12px 16px;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border-color)">
                <div class="form-group" style="margin:0;flex:2;min-width:180px">
                    <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:4px">Report Type</label>
                    <select id="reportTypeSelect" style="width:100%">
                        <option value="cost" ${self._selectedReport === 'cost' ? 'selected' : ''}>Cost Report</option>
                        <option value="labor" ${self._selectedReport === 'labor' ? 'selected' : ''}>Labour Report</option>
                        <option value="expense" ${self._selectedReport === 'expense' ? 'selected' : ''}>Expense Summary</option>
                        <option value="invoice" ${self._selectedReport === 'invoice' ? 'selected' : ''}>Invoice Summary</option>
                        <option value="equipment" ${self._selectedReport === 'equipment' ? 'selected' : ''}>Equipment Report</option>
                        <option value="labor-notes" ${self._selectedReport === 'labor-notes' ? 'selected' : ''}>Labor &amp; Notes Report</option>
                        <option value="impact" ${self._selectedReport === 'impact' ? 'selected' : ''}>&#9889; Impact Report</option>
                    </select>
                </div>
                <div class="form-group" style="margin:0">
                    <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:4px">Start Date</label>
                    <input type="date" id="globalStartDate" value="${self._dateRange.start}">
                </div>
                <div class="form-group" style="margin:0">
                    <label style="font-size:.8rem;font-weight:600;display:block;margin-bottom:4px">End Date</label>
                    <input type="date" id="globalEndDate" value="${self._dateRange.end}">
                </div>
                <button class="btn-primary btn-sm" id="applyDateBtn" style="height:36px">Apply</button>
            </div>
            <div id="reportContent"></div>
        `;

        container.querySelector('#printReportBtn').addEventListener('click', function() {
            window.print();
        });

        container.querySelector('#exportCsvBtn').addEventListener('click', function() {
            self._exportCsv();
        });

        container.querySelector('#reportTypeSelect').addEventListener('change', function() {
            self._selectedReport = this.value;
            self._renderReportContent();
        });

        container.querySelector('#applyDateBtn').addEventListener('click', function() {
            const s = container.querySelector('#globalStartDate').value;
            const e = container.querySelector('#globalEndDate').value;
            if (s) self._dateRange.start = s;
            if (e) self._dateRange.end = e;
            self._renderReportContent();
        });

        self._renderReportContent();
    },

    _renderReportContent() {
        const self = this;
        const content = self._container.querySelector('#reportContent');
        switch (self._selectedReport) {
            case 'cost':        self._renderCostReport(content);        break;
            case 'labor':       self._renderLaborReport(content);       break;
            case 'expense':     self._renderExpenseSummary(content);    break;
            case 'invoice':     self._renderInvoiceSummary(content);    break;
            case 'equipment':   self._renderEquipmentReport(content);   break;
            case 'labor-notes': self._renderLaborNotesReport(content);  break;
            case 'impact':      self._renderImpactReport(content);      break;
        }
    },

    _renderCostReport(content) {
        const self = this;
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

            const startDate = self._dateRange ? self._dateRange.start : '';
            const endDate = self._dateRange ? self._dateRange.end : '';

            const project = AppData.getProject(projectId);
            const subtasks = AppData.getSubtasks(projectId);
            let expenses = AppData.getExpenses(projectId);
            if (startDate) expenses = expenses.filter(function(e) { return (e.date || '') >= startDate; });
            if (endDate)   expenses = expenses.filter(function(e) { return (e.date || '') <= endDate; });
            let submissions = AppData.getSubmissions().filter(function(s) {
                return s.projectId === projectId && s.status === 'Approved';
            });
            if (startDate) submissions = submissions.filter(function(s) { return (s.date || '') >= startDate; });
            if (endDate)   submissions = submissions.filter(function(s) { return (s.date || '') <= endDate; });

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

            // Equipment cost/revenue for this project
            const eqLogs = AppData.getEquipmentLogs ? AppData.getEquipmentLogs(projectId) : [];
            const eqByItem = {};
            let totalEqCost = 0, totalEqRevenue = 0, totalEqHours = 0;
            eqLogs.forEach(function(l) {
                const key = l.equipmentId || l.equipmentName;
                if (!eqByItem[key]) eqByItem[key] = { name: l.equipmentName || 'Unknown', hours: 0, cost: 0, revenue: 0 };
                eqByItem[key].hours   += parseFloat(l.hours) || 0;
                eqByItem[key].cost    += parseFloat(l.cost) || 0;
                eqByItem[key].revenue += parseFloat(l.revenue) || 0;
                totalEqCost    += parseFloat(l.cost) || 0;
                totalEqRevenue += parseFloat(l.revenue) || 0;
                totalEqHours   += parseFloat(l.hours) || 0;
            });

            const eqTableHtml = Object.keys(eqByItem).length === 0
                ? '<p style="color:var(--text2)">No equipment hours logged for this project yet.</p>'
                : '<table><thead><tr>' +
                  '<th>Equipment</th><th class="amount">Hours</th>' +
                  '<th class="amount">Cost</th><th class="amount">Revenue</th><th class="amount">Margin</th>' +
                  '</tr></thead><tbody>' +
                  Object.values(eqByItem).map(function(eq) {
                      var margin = eq.revenue - eq.cost;
                      return '<tr>' +
                          '<td>' + esc(eq.name) + '</td>' +
                          '<td class="amount">' + eq.hours.toFixed(1) + '</td>' +
                          '<td class="amount">' + Utils.formatCurrency(eq.cost) + '</td>' +
                          '<td class="amount">' + Utils.formatCurrency(eq.revenue) + '</td>' +
                          '<td class="amount" style="color:' + (margin >= 0 ? 'var(--success,green)' : 'var(--accent,red)') + '">' + Utils.formatCurrency(margin) + '</td>' +
                      '</tr>';
                  }).join('') +
                  '<tr style="font-weight:700;border-top:2px solid var(--border)">' +
                  '<td>TOTAL</td>' +
                  '<td class="amount">' + totalEqHours.toFixed(1) + '</td>' +
                  '<td class="amount">' + Utils.formatCurrency(totalEqCost) + '</td>' +
                  '<td class="amount">' + Utils.formatCurrency(totalEqRevenue) + '</td>' +
                  '<td class="amount" style="color:' + (totalEqRevenue - totalEqCost >= 0 ? 'var(--success,green)' : 'var(--accent,red)') + '">' + Utils.formatCurrency(totalEqRevenue - totalEqCost) + '</td>' +
                  '</tr></tbody></table>';

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
                '<div class="card" style="margin-bottom:16px"><h3 style="margin-bottom:12px">Totals by Category</h3>' +
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
                '</div>' +
                '<div class="card"><h3 style="margin-bottom:12px">🔧 Equipment Cost vs. Revenue</h3>' +
                eqTableHtml +
                '</div>';
        });
    },

    _renderLaborReport(content) {
        const self = this;
        const projects = AppData.getProjects();
        const esc = Utils.escapeHtml;

        content.innerHTML = `
            <div class="card" style="margin-bottom:16px">
                <div class="form-row">
                    <div class="form-group">
                        <label>Project (optional)</label>
                        <select id="laborProjectFilter">
                            <option value="">All Projects</option>
                            ${projects.map(function(p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('')}
                        </select>
                    </div>
                </div>
            </div>
            <div id="laborReportBody"></div>
        `;

        function generate() {
            const startDate = self._dateRange ? self._dateRange.start : '';
            const endDate = self._dateRange ? self._dateRange.end : '';
            const projectId = content.querySelector('#laborProjectFilter').value;
            const body = content.querySelector('#laborReportBody');

            let submissions = AppData.getSubmissions().filter(function(s) {
                return s.status === 'Approved';
            });

            if (startDate) submissions = submissions.filter(function(s) { return s.date >= startDate; });
            if (endDate)   submissions = submissions.filter(function(s) { return s.date <= endDate; });
            if (projectId) submissions = submissions.filter(function(s) { return s.projectId === projectId; });

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
        }

        content.querySelector('#laborProjectFilter').addEventListener('change', generate);
        generate();
    },

    _renderExpenseSummary(content) {
        const self = this;
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
            const startDate = self._dateRange ? self._dateRange.start : '';
            const endDate = self._dateRange ? self._dateRange.end : '';
            const body = content.querySelector('#expenseReportBody');
            let expenses = AppData.getExpenses(projectId || undefined);
            if (startDate) expenses = expenses.filter(function(e) { return (e.date || '') >= startDate; });
            if (endDate)   expenses = expenses.filter(function(e) { return (e.date || '') <= endDate; });

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
        switch (self._selectedReport) {
            case 'cost':        self._exportCostCsv();      break;
            case 'labor':       self._exportLaborCsv();     break;
            case 'expense':     self._exportExpenseCsv();   break;
            case 'invoice':     self._exportInvoiceCsv();   break;
            case 'equipment':   self._exportEquipmentCsv(); break;
            case 'labor-notes': break; // PDF-only via Print Report button
            case 'impact':      break; // uses inline Export CSV button
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
        var projectFilterEl = container.querySelector('#laborProjectFilter');
        var startDate = self._dateRange ? self._dateRange.start : '';
        var endDate = self._dateRange ? self._dateRange.end : '';
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
        var startDate = self._dateRange ? self._dateRange.start : '';
        var endDate = self._dateRange ? self._dateRange.end : '';
        var expenses = AppData.getExpenses(projectId || undefined);
        if (startDate) expenses = expenses.filter(function(e) { return (e.date || '') >= startDate; });
        if (endDate)   expenses = expenses.filter(function(e) { return (e.date || '') <= endDate; });

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
        var startDate = self._dateRange ? self._dateRange.start : '';
        var endDate = self._dateRange ? self._dateRange.end : '';
        var invoices = AppData.getInvoices();
        if (startDate) invoices = invoices.filter(function(inv) { return (inv.date || '') >= startDate; });
        if (endDate)   invoices = invoices.filter(function(inv) { return (inv.date || '') <= endDate; });

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
        const self = this;
        const startDate = self._dateRange ? self._dateRange.start : '';
        const endDate = self._dateRange ? self._dateRange.end : '';
        let invoices = AppData.getInvoices();
        if (startDate) invoices = invoices.filter(function(inv) { return (inv.date || '') >= startDate; });
        if (endDate)   invoices = invoices.filter(function(inv) { return (inv.date || '') <= endDate; });
        const esc = Utils.escapeHtml;

        if (invoices.length === 0) {
            content.innerHTML = '<div class="card"><div class="empty"><h3>No Invoices</h3><p>No invoices found for the selected date range.</p></div></div>';
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
    },

    _renderLaborNotesReport(content) {
        const self = this;
        const esc = Utils.escapeHtml;
        const projects = AppData.getProjects();
        const settings = AppData.getSettings() || {};
        const logoUrl = settings.logoUrl || settings.logo || '';
        const companyName = settings.companyName || 'My Company';
        const companyAddress = [settings.address, settings.city, settings.province, settings.postalCode].filter(Boolean).join(', ');
        const hstNumber = settings.hstNumber ? 'HST# ' + settings.hstNumber : '';

        // Filters UI
        content.innerHTML =
            '<div class="card" style="margin-bottom:16px">' +
            '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">' +
            '<div class="form-group" style="margin:0;flex:1;min-width:160px"><label>Project</label>' +
            '<select id="lnrProject"><option value="">All Projects</option>' +
            projects.map(function(p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="form-group" style="margin:0"><label>From</label><input type="date" id="lnrFrom"></div>' +
            '<div class="form-group" style="margin:0"><label>To</label><input type="date" id="lnrTo"></div>' +
            '<button class="btn-primary" id="lnrRun">Generate Report</button>' +
            '<button class="btn-secondary" id="lnrPrint" style="display:none">🖨 Print / Save PDF</button>' +
            '</div></div>' +
            '<div id="lnrBody"></div>';

        // Pre-populate from shared date range
        content.querySelector('#lnrFrom').value = self._dateRange ? self._dateRange.start : '';
        content.querySelector('#lnrTo').value   = self._dateRange ? self._dateRange.end   : '';

        content.querySelector('#lnrPrint').addEventListener('click', function() { window.print(); });

        content.querySelector('#lnrRun').addEventListener('click', async function() {
            const projectId = content.querySelector('#lnrProject').value;
            const fromDate = content.querySelector('#lnrFrom').value;
            const toDate = content.querySelector('#lnrTo').value;
            const body = content.querySelector('#lnrBody');
            content.querySelector('#lnrPrint').style.display = '';

            // Gather data
            const allSubmissions = AppData.getSubmissions().filter(function(s) {
                if ((s.status || '').toLowerCase() !== 'approved') return false;
                const d = (s.date || s.createdAt || '').slice(0, 10);
                if (fromDate && d < fromDate) return false;
                if (toDate && d > toDate) return false;
                if (projectId && s.projectId !== projectId) return false;
                return true;
            });

            const allExpenses = AppData.getExpenses();
            const allWorkers = AppData.getWorkers();
            // Build submissionId → [{src, filename}] map from IndexedDB photos
            const allPhotos = {};
            try {
                const rawPhotos = await AppData.getAllPhotos();
                rawPhotos.forEach(function(ph) {
                    const sid = ph.submissionId;
                    if (!sid) return;
                    if (!allPhotos[sid]) allPhotos[sid] = [];
                    var src = '';
                    if (ph.thumbnail instanceof Blob) {
                        src = URL.createObjectURL(ph.thumbnail);
                    } else if (ph.blob instanceof Blob) {
                        src = URL.createObjectURL(ph.blob);
                    } else {
                        src = ph.dataUrl || ph.url || ph.thumbnail || '';
                    }
                    allPhotos[sid].push({ src: src, filename: ph.filename || '' });
                });
            } catch(e) { console.warn('[LNR] photos load failed:', e); }

            // Group: project → date → submissions
            const grouped = {};
            allSubmissions.forEach(function(s) {
                const pid = s.projectId || '';
                const date = (s.date || s.createdAt || '').slice(0, 10);
                if (!grouped[pid]) grouped[pid] = {};
                if (!grouped[pid][date]) grouped[pid][date] = [];
                grouped[pid][date].push(s);
            });

            if (!Object.keys(grouped).length) {
                body.innerHTML = '<div class="empty-state"><p>No approved submissions found for the selected range.</p></div>';
                return;
            }

            // Build report HTML
            let html = '';

            // ── Printable header (hidden on screen, shown on print) ──
            html += '<div class="print-header" style="display:none">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a3a5c;padding-bottom:12px;margin-bottom:20px">' +
                (logoUrl ? '<img src="' + esc(logoUrl) + '" style="max-height:64px;max-width:180px;object-fit:contain">' : '<div style="width:180px"></div>') +
                '<div style="text-align:right">' +
                '<div style="font-size:1.3rem;font-weight:700;color:#1a3a5c">' + esc(companyName) + '</div>' +
                (companyAddress ? '<div style="font-size:.85rem;color:#555">' + esc(companyAddress) + '</div>' : '') +
                (hstNumber ? '<div style="font-size:.8rem;color:#555">' + esc(hstNumber) + '</div>' : '') +
                '</div></div>' +
                '<div style="font-size:1.1rem;font-weight:700;color:#1a3a5c;margin-bottom:4px">Labor & Notes Report</div>' +
                '<div style="font-size:.85rem;color:#555;margin-bottom:16px">Period: ' + esc(fromDate) + ' to ' + esc(toDate) + '</div>' +
                '</div>';

            Object.keys(grouped).forEach(function(pid) {
                const project = projects.find(function(p) { return p.id === pid; }) || { name: 'Unknown Project' };
                html += '<div class="card" style="margin-bottom:20px;break-inside:avoid">' +
                    '<h3 style="color:#1a3a5c;border-bottom:2px solid #1a3a5c;padding-bottom:8px;margin-bottom:12px">📁 ' + esc(project.name) + '</h3>';

                const dates = Object.keys(grouped[pid]).sort();
                dates.forEach(function(date) {
                    html += '<div style="margin-bottom:16px">' +
                        '<div style="font-weight:700;font-size:.95rem;color:var(--text-secondary);background:var(--bg-surface);padding:6px 10px;border-radius:4px;margin-bottom:10px">📅 ' + Utils.formatDate(date) + '</div>';

                    grouped[pid][date].forEach(function(s) {
                        const worker = allWorkers.find(function(w) { return w.id === s.workerId; });
                        const workerName = worker ? worker.name : (s.workerName || 'Unknown Worker');
                        const hours = parseFloat(s.hours || 0).toFixed(1);
                        const notes = s.notes || s.description || '';

                        // Expenses linked to this submission
                        const subExpenses = allExpenses.filter(function(e) {
                            return e.submissionId === s.id || (e.projectId === pid && (e.date || '').slice(0, 10) === date && e.workerId === s.workerId);
                        });

                        // Photos linked to submission
                        const subPhotos = allPhotos[s.id] || [];

                        html += '<div style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:8px">' +
                            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
                            '<strong style="color:#1a3a5c">👷 ' + esc(workerName) + '</strong>' +
                            '<span style="font-size:.85rem;color:#555">⏱ ' + hours + ' hrs</span>' +
                            '</div>';

                        if (notes) {
                            html += '<div style="font-size:.9rem;color:var(--text-secondary);margin-bottom:8px;padding:6px 8px;background:var(--bg-surface);border-radius:4px;border-left:3px solid var(--info)">' +
                                '<strong>Notes:</strong> ' + esc(notes) + '</div>';
                        }

                        if (subExpenses.length) {
                            html += '<div style="margin-bottom:8px"><strong style="font-size:.85rem;color:#555">Expenses:</strong>' +
                                '<table style="width:100%;font-size:.85rem;margin-top:4px"><thead><tr>' +
                                '<th style="text-align:left;padding:2px 4px;color:#555">Description</th>' +
                                '<th style="text-align:left;padding:2px 4px;color:#555">Category</th>' +
                                '<th style="text-align:right;padding:2px 4px;color:#555">Amount</th></tr></thead><tbody>';
                            subExpenses.forEach(function(e) {
                                html += '<tr><td style="padding:2px 4px">' + esc(e.description || e.vendor || '—') + '</td>' +
                                    '<td style="padding:2px 4px">' + esc(e.category || '—') + '</td>' +
                                    '<td style="text-align:right;padding:2px 4px">' + Utils.formatCurrency(e.amount || 0) + '</td></tr>';
                            });
                            const expTotal = subExpenses.reduce(function(sum, e) { return sum + parseFloat(e.amount || 0); }, 0);
                            html += '<tr style="font-weight:700;border-top:1px solid #e5e7eb"><td colspan="2" style="padding:2px 4px">Total</td>' +
                                '<td style="text-align:right;padding:2px 4px">' + Utils.formatCurrency(expTotal) + '</td></tr>' +
                                '</tbody></table></div>';
                        }

                        if (subPhotos.length) {
                            html += '<div style="margin-top:6px"><strong style="font-size:.85rem;color:#555">Site Photos (' + subPhotos.length + '):</strong>' +
                                '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">';
                            subPhotos.slice(0, 6).forEach(function(ph) {
                                if (ph.src) html += '<img src="' + ph.src + '" style="width:80px;height:60px;object-fit:cover;border-radius:4px;border:1px solid #e5e7eb">';
                            });
                            html += '</div></div>';
                        }

                        html += '</div>'; // submission card
                    });

                    html += '</div>'; // date group
                });

                html += '</div>'; // project card
            });

            body.innerHTML = html;

            // Inject print CSS once
            if (!document.getElementById('lnrPrintStyle')) {
                const style = document.createElement('style');
                style.id = 'lnrPrintStyle';
                style.textContent = '@media print { .admin-nav,.worker-nav,#adminSidebar,.btn-primary,.btn-secondary,#pageHelpBtn,.tabs { display:none!important; } .print-header { display:block!important; } body { font-size:11pt; } .card { box-shadow:none; border:1px solid #ddd; } }';
                document.head.appendChild(style);
            }
        });
    },

    // ── Equipment Report ─────────────────────────────────────────────────────────

    _renderEquipmentReport(content) {
        const self = this;
        const projects = AppData.getProjects();
        const esc = Utils.escapeHtml;

        content.innerHTML =
            '<div class="card" style="margin-bottom:16px">' +
                '<div class="form-row">' +
                    '<div class="form-group">' +
                        '<label>Start Date</label>' +
                        '<input type="date" id="eqStartDate">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>End Date</label>' +
                        '<input type="date" id="eqEndDate">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Project (optional)</label>' +
                        '<select id="eqProjectFilter">' +
                            '<option value="">All Projects</option>' +
                            projects.map(function(p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') +
                        '</select>' +
                    '</div>' +
                    '<div class="form-group" style="display:flex;align-items:flex-end">' +
                        '<button class="btn-primary btn-sm" id="eqGenerateBtn">Generate</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div id="eqReportBody"></div>';

        // Pre-populate from shared date range
        content.querySelector('#eqStartDate').value = self._dateRange ? self._dateRange.start : '';
        content.querySelector('#eqEndDate').value   = self._dateRange ? self._dateRange.end   : '';

        content.querySelector('#eqGenerateBtn').addEventListener('click', function() {
            const startDate = content.querySelector('#eqStartDate').value;
            const endDate   = content.querySelector('#eqEndDate').value;
            const projectId = content.querySelector('#eqProjectFilter').value;
            const body      = content.querySelector('#eqReportBody');

            let logs = AppData.getEquipmentLogs ? AppData.getEquipmentLogs(projectId || undefined) : [];
            if (startDate) logs = logs.filter(function(l) { return l.date >= startDate; });
            if (endDate)   logs = logs.filter(function(l) { return l.date <= endDate; });

            if (logs.length === 0) {
                body.innerHTML = '<div class="card"><div class="empty"><h3>No Equipment Logs</h3>' +
                    '<p>No equipment utilization has been logged for the selected filters. Workers log equipment on their time entries.</p></div></div>';
                return;
            }

            // Group by project
            const byProject = {};
            logs.forEach(function(l) {
                const pid = l.projectId || 'unassigned';
                if (!byProject[pid]) {
                    const proj = AppData.getProject(pid);
                    byProject[pid] = { name: proj ? proj.name : 'Unassigned', logs: [] };
                }
                byProject[pid].logs.push(l);
            });

            let grandHours = 0, grandCost = 0, grandRevenue = 0;
            let html = '';

            Object.keys(byProject).forEach(function(pid) {
                const group = byProject[pid];
                let projHours = 0, projCost = 0, projRevenue = 0;

                const rows = group.logs.map(function(l) {
                    const hrs  = parseFloat(l.hours) || 0;
                    const cost = parseFloat(l.cost)  || 0;
                    const rev  = parseFloat(l.revenue) || 0;
                    const margin = rev - cost;
                    projHours   += hrs;
                    projCost    += cost;
                    projRevenue += rev;
                    return '<tr>' +
                        '<td>' + esc(l.date || '') + '</td>' +
                        '<td>' + esc(l.workerName || '') + '</td>' +
                        '<td style="font-weight:500">' + esc(l.equipmentName || '') + '</td>' +
                        '<td class="amount">' + hrs.toFixed(2) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(l.costRate || 0) + '/hr</td>' +
                        '<td class="amount">' + Utils.formatCurrency(l.chargeOutRate || 0) + '/hr</td>' +
                        '<td class="amount">' + Utils.formatCurrency(cost) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(rev) + '</td>' +
                        '<td class="amount" style="color:' + (margin >= 0 ? 'var(--success,green)' : 'var(--accent,red)') + '">' + Utils.formatCurrency(margin) + '</td>' +
                    '</tr>';
                }).join('');

                grandHours   += projHours;
                grandCost    += projCost;
                grandRevenue += projRevenue;

                html += '<div class="card" style="margin-bottom:16px">' +
                    '<h3 style="margin-bottom:12px">📋 ' + esc(group.name) + '</h3>' +
                    '<div style="overflow-x:auto">' +
                    '<table><thead><tr>' +
                    '<th>Date</th><th>Worker</th><th>Equipment</th>' +
                    '<th class="amount">Hours</th><th class="amount">Cost Rate</th><th class="amount">Charge-Out</th>' +
                    '<th class="amount">Cost</th><th class="amount">Revenue</th><th class="amount">Margin</th>' +
                    '</tr></thead><tbody>' +
                    rows +
                    '<tr style="font-weight:700;border-top:2px solid var(--border)">' +
                    '<td colspan="3">Project Total</td>' +
                    '<td class="amount">' + projHours.toFixed(2) + '</td>' +
                    '<td colspan="2"></td>' +
                    '<td class="amount">' + Utils.formatCurrency(projCost) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(projRevenue) + '</td>' +
                    '<td class="amount" style="color:' + (projRevenue - projCost >= 0 ? 'var(--success,green)' : 'var(--accent,red)') + '">' + Utils.formatCurrency(projRevenue - projCost) + '</td>' +
                    '</tr></tbody></table>' +
                    '</div></div>';
            });

            // Grand summary card
            html += '<div class="card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;text-align:center">' +
                '<div><div style="font-size:.75rem;color:var(--text2);text-transform:uppercase;font-weight:600;margin-bottom:4px">Total Hours</div>' +
                    '<div style="font-size:1.5rem;font-weight:700">' + grandHours.toFixed(1) + '</div></div>' +
                '<div><div style="font-size:.75rem;color:var(--text2);text-transform:uppercase;font-weight:600;margin-bottom:4px">Total Cost</div>' +
                    '<div style="font-size:1.5rem;font-weight:700;color:var(--accent)">' + Utils.formatCurrency(grandCost) + '</div></div>' +
                '<div><div style="font-size:.75rem;color:var(--text2);text-transform:uppercase;font-weight:600;margin-bottom:4px">Total Revenue</div>' +
                    '<div style="font-size:1.5rem;font-weight:700;color:var(--success)">' + Utils.formatCurrency(grandRevenue) + '</div></div>' +
                '<div><div style="font-size:.75rem;color:var(--text2);text-transform:uppercase;font-weight:600;margin-bottom:4px">Net Margin</div>' +
                    '<div style="font-size:1.5rem;font-weight:700;color:' + (grandRevenue - grandCost >= 0 ? 'var(--success)' : 'var(--accent)') + '">' + Utils.formatCurrency(grandRevenue - grandCost) + '</div></div>' +
            '</div>';

            body.innerHTML = html;
        });
    },

    _exportEquipmentCsv() {
        var self = this;
        var container = self._container;
        var startDate = (container.querySelector('#eqStartDate') || {}).value || '';
        var endDate   = (container.querySelector('#eqEndDate')   || {}).value || '';
        var projectId = (container.querySelector('#eqProjectFilter') || {}).value || '';

        var logs = AppData.getEquipmentLogs ? AppData.getEquipmentLogs(projectId || undefined) : [];
        if (startDate) logs = logs.filter(function(l) { return l.date >= startDate; });
        if (endDate)   logs = logs.filter(function(l) { return l.date <= endDate; });

        var headers = ['Date', 'Project', 'Worker', 'Equipment', 'Hours', 'Cost Rate ($/hr)', 'Charge-Out Rate ($/hr)', 'Cost ($)', 'Revenue ($)', 'Margin ($)'];
        var lines = [self._csvRow(headers)];

        logs.forEach(function(l) {
            var proj = AppData.getProject(l.projectId);
            var cost = parseFloat(l.cost) || 0;
            var rev  = parseFloat(l.revenue) || 0;
            lines.push(self._csvRow([
                l.date || '',
                proj ? proj.name : (l.projectId || ''),
                l.workerName || '',
                l.equipmentName || '',
                (parseFloat(l.hours) || 0).toFixed(2),
                (parseFloat(l.costRate) || 0).toFixed(2),
                (parseFloat(l.chargeOutRate) || 0).toFixed(2),
                cost.toFixed(2),
                rev.toFixed(2),
                (rev - cost).toFixed(2)
            ]));
        });

        self._downloadCsv(lines.join('\n'), 'equipment');
    },

    // ── Impact Report ─────────────────────────────────────────────────────────

    _renderImpactReport(content) {
        var self = this;
        var esc  = Utils.escapeHtml;
        var projects = AppData.getProjects ? AppData.getProjects() : [];

        var projectOptions = '<option value="">All Projects</option>' +
            projects.map(function(p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('');

        var billableOptions = ['', 'Non-Billable', 'Billable', 'Disputed', 'To Be Reviewed']
            .map(function(s) { return '<option value="' + esc(s) + '">' + (s || 'All Statuses') + '</option>'; }).join('');

        content.innerHTML =
            '<div class="card" style="margin-bottom:16px">' +
                '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">' +
                    '<div class="form-group" style="flex:1;min-width:160px;margin-bottom:0">' +
                        '<label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:4px">Project</label>' +
                        '<select class="form-control" id="irProject">' + projectOptions + '</select>' +
                    '</div>' +
                    '<div class="form-group" style="flex:1;min-width:140px;margin-bottom:0">' +
                        '<label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:4px">Start Date</label>' +
                        '<input class="form-control" type="date" id="irStartDate">' +
                    '</div>' +
                    '<div class="form-group" style="flex:1;min-width:140px;margin-bottom:0">' +
                        '<label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:4px">End Date</label>' +
                        '<input class="form-control" type="date" id="irEndDate">' +
                    '</div>' +
                    '<div class="form-group" style="flex:1;min-width:160px;margin-bottom:0">' +
                        '<label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:4px">Billable Status</label>' +
                        '<select class="form-control" id="irBillable">' + billableOptions + '</select>' +
                    '</div>' +
                    '<button class="btn btn-primary" id="irGenerateBtn" style="white-space:nowrap">Generate</button>' +
                '</div>' +
            '</div>' +
            '<div id="irBody"></div>';

        // Pre-populate from shared date range
        content.querySelector('#irStartDate').value = self._dateRange ? self._dateRange.start : '';
        content.querySelector('#irEndDate').value   = self._dateRange ? self._dateRange.end   : '';

        content.querySelector('#irGenerateBtn').addEventListener('click', function() {
            self._fetchAndRenderImpact(content);
        });

        // Auto-generate on load
        self._fetchAndRenderImpact(content);
    },

    async _fetchAndRenderImpact(content) {
        var self = this;
        var esc  = Utils.escapeHtml;
        var body = content.querySelector('#irBody');

        var projectId    = (content.querySelector('#irProject')   || {}).value || '';
        var startDate    = (content.querySelector('#irStartDate') || {}).value || '';
        var endDate      = (content.querySelector('#irEndDate')   || {}).value || '';
        var billable     = (content.querySelector('#irBillable')  || {}).value || '';

        body.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text2)">Loading…</div>';

        var params = [];
        if (projectId) params.push('projectId=' + encodeURIComponent(projectId));
        if (startDate) params.push('startDate=' + encodeURIComponent(startDate));
        if (endDate)   params.push('endDate='   + encodeURIComponent(endDate));
        if (billable)  params.push('billableStatus=' + encodeURIComponent(billable));
        var url = '/api/reports/impact' + (params.length ? '?' + params.join('&') : '');

        var records;
        try {
            var jwt = AppData.getJwt ? AppData.getJwt() : '';
            var res = await fetch(AppData.API_BASE + url, {
                headers: { 'Authorization': 'Bearer ' + jwt }
            });
            if (!res.ok) { var j = await res.json(); throw new Error(j.error || 'HTTP ' + res.status); }
            records = await res.json();
        } catch (e) {
            body.innerHTML = '<div class="card" style="color:var(--accent);padding:16px">Failed to load impact report: ' + esc(e.message) + '</div>';
            return;
        }

        if (records.length === 0) {
            body.innerHTML = '<div class="card"><div style="text-align:center;padding:32px;color:var(--text2)"><h3>No Impact Records</h3><p>No timecards or equipment usage with impact codes match the selected filters.</p></div></div>';
            return;
        }

        var totalHours = 0, totalCost = 0;
        var rows = records.map(function(r) {
            var hours = parseFloat(r.impactHours) || 0;
            var cost  = parseFloat(r.impactCost)  || 0;
            totalHours += hours;
            totalCost  += cost;
            var billableColor = r.billableStatus === 'Billable'     ? '#27ae60'
                              : r.billableStatus === 'Disputed'     ? '#e67e22'
                              : r.billableStatus === 'To Be Reviewed' ? '#f39c12'
                              : '#7f8c8d';
            var statusBadge = r.billableStatus
                ? '<span style="background:' + billableColor + '22;color:' + billableColor + ';font-size:.7rem;padding:1px 8px;border-radius:10px">' + esc(r.billableStatus) + '</span>'
                : '<span style="color:var(--text2);font-size:.8rem">—</span>';
            var tcStatusStyle = r.status === 'approved'
                ? 'color:var(--success,#27ae60)'
                : r.status === 'rejected' ? 'color:var(--accent,#e74c3c)' : 'color:var(--text2)';
            return '<tr>' +
                '<td>' + esc(r.date || '') + '</td>' +
                '<td>' + esc(r.workerName || r.equipmentName || '—') + '</td>' +
                '<td>' + esc(r.projectName || r.projectId || '—') + '</td>' +
                '<td><strong>' + esc(r.impactCode || '—') + '</strong><br><span style="font-size:.78rem;color:var(--text2)">' + esc(r.impactCategory || '') + '</span></td>' +
                '<td style="font-size:.82rem;color:var(--text2);max-width:200px">' + esc(r.impactDescription || '—') + '</td>' +
                '<td class="amount">' + hours.toFixed(2) + '</td>' +
                '<td class="amount">' + Utils.formatCurrency(r.labourRate || 0) + '/hr</td>' +
                '<td class="amount"><strong>' + Utils.formatCurrency(cost) + '</strong></td>' +
                '<td>' + statusBadge + '</td>' +
                '<td style="' + tcStatusStyle + ';font-size:.78rem;text-transform:capitalize">' + esc(r.status || '—') + '</td>' +
            '</tr>';
        }).join('');

        var summaryRow =
            '<tr style="font-weight:700;border-top:2px solid var(--border);background:var(--bg-surface)">' +
                '<td colspan="5" style="text-align:right">TOTAL</td>' +
                '<td class="amount">' + totalHours.toFixed(2) + '</td>' +
                '<td></td>' +
                '<td class="amount">' + Utils.formatCurrency(totalCost) + '</td>' +
                '<td colspan="2"></td>' +
            '</tr>';

        body.innerHTML =
            '<div style="display:flex;justify-content:flex-end;margin-bottom:8px">' +
                '<button class="btn btn-secondary btn-sm" id="irExportCsv">⬇ Export CSV</button>' +
            '</div>' +
            '<div class="card" style="overflow-x:auto">' +
                '<table id="irTable">' +
                    '<thead><tr>' +
                        '<th>Date</th><th>Worker / Equipment</th><th>Project</th>' +
                        '<th>Impact Code</th><th>Description</th>' +
                        '<th class="amount">Hours</th><th class="amount">Rate</th>' +
                        '<th class="amount">Cost</th><th>Billable</th><th>TC Status</th>' +
                    '</tr></thead>' +
                    '<tbody>' + rows + summaryRow + '</tbody>' +
                '</table>' +
            '</div>';

        body.querySelector('#irExportCsv').addEventListener('click', function() {
            self._exportImpactCsv(records, totalHours, totalCost);
        });
    },

    _exportImpactCsv(records, totalHours, totalCost) {
        var self = this;
        var headers = ['Date', 'Type', 'Worker / Equipment', 'Project', 'Impact Code', 'Category', 'Description', 'Hours', 'Rate ($/hr)', 'Cost ($)', 'Billable Status', 'TC Status'];
        var lines = [self._csvRow(headers)];
        records.forEach(function(r) {
            lines.push(self._csvRow([
                r.date || '',
                r.type || '',
                r.workerName || r.equipmentName || '',
                r.projectName || r.projectId || '',
                r.impactCode || '',
                r.impactCategory || '',
                r.impactDescription || '',
                (parseFloat(r.impactHours) || 0).toFixed(2),
                (parseFloat(r.labourRate)  || 0).toFixed(2),
                (parseFloat(r.impactCost)  || 0).toFixed(2),
                r.billableStatus || '',
                r.status || '',
            ]));
        });
        lines.push(self._csvRow(['', '', '', '', '', '', 'TOTAL', totalHours.toFixed(2), '', totalCost.toFixed(2), '', '']));
        self._downloadCsv(lines.join('\n'), 'impact');
    },
};
