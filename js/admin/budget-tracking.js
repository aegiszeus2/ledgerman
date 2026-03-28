// Admin Budget Tracking Module — Tier 3
window.AdminBudgetTracking = {
    _sortBy: 'name',
    _filterStatus: 'All',

    render(container) {
        const self = this;
        self._container = container;

        const projects = AppData.getProjects();
        const expenses = AppData.getExpenses();

        // Compute budget vs actual for each project
        const budgetData = projects.map(project => {
            const projectExpenses = expenses.filter(e => e.projectId === project.id);
            const spent = projectExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            const budget = parseFloat(project.budget) || 0;
            const variance = budget - spent;
            const variancePercent = budget > 0 ? ((variance / budget) * 100).toFixed(1) : 0;
            const percentSpent = budget > 0 ? ((spent / budget) * 100).toFixed(1) : (spent > 0 ? '∞' : '0');

            return {
                id: project.id,
                name: project.name,
                status: project.status || 'Active',
                budget: budget,
                spent: spent,
                variance: variance,
                variancePercent: variancePercent,
                percentSpent: percentSpent
            };
        });

        // Filter and sort
        const filtered = self._filterStatus === 'All'
            ? budgetData
            : budgetData.filter(d => d.status === self._filterStatus);

        const sorted = filtered.sort((a, b) => {
            switch(self._sortBy) {
                case 'budget': return b.budget - a.budget;
                case 'spent': return b.spent - a.spent;
                case 'variance': return b.variance - a.variance;
                case 'percentSpent': return parseFloat(b.percentSpent) - parseFloat(a.percentSpent);
                default: return a.name.localeCompare(b.name);
            }
        });

        const statuses = ['All', 'Active', 'Completed', 'On Hold'];
        const totalBudget = budgetData.reduce((s, d) => s + d.budget, 0);
        const totalSpent = budgetData.reduce((s, d) => s + d.spent, 0);
        const totalVariance = budgetData.reduce((s, d) => s + d.variance, 0);
        const avgPercentSpent = budgetData.length > 0
            ? (budgetData.reduce((s, d) => s + parseFloat(d.percentSpent || 0), 0) / budgetData.length).toFixed(1)
            : 0;

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <h2>Budget Tracking & Variance Analysis</h2>
                    <button class="btn-secondary btn-sm" id="refreshBudgetBtn">↻ Refresh</button>
                </div>
                <p style="color:#666;margin:0">Monitor project budgets vs. actual spending. Projects without budgets show $0.</p>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:16px;background:#fff;border-radius:8px;border:1px solid #e0e0e0">
                    <div style="color:#999;font-size:0.85em;text-transform:uppercase;margin-bottom:6px">Total Budget</div>
                    <div style="font-size:1.6em;font-weight:bold;color:#333">$${totalBudget.toFixed(2)}</div>
                    <div style="font-size:0.85em;color:#999;margin-top:4px">${projects.length} projects</div>
                </div>
                <div style="padding:16px;background:#fff;border-radius:8px;border:1px solid #e0e0e0">
                    <div style="color:#999;font-size:0.85em;text-transform:uppercase;margin-bottom:6px">Total Spent</div>
                    <div style="font-size:1.6em;font-weight:bold;color:#e74c3c">$${totalSpent.toFixed(2)}</div>
                    <div style="font-size:0.85em;color:#999;margin-top:4px">${(totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0)}% of budget</div>
                </div>
                <div style="padding:16px;background:#fff;border-radius:8px;border:1px solid #e0e0e0">
                    <div style="color:#999;font-size:0.85em;text-transform:uppercase;margin-bottom:6px">Remaining</div>
                    <div style="font-size:1.6em;font-weight:bold;color:${totalVariance >= 0 ? '#2ecc71' : '#e74c3c'}">${totalVariance >= 0 ? '+' : ''}$${totalVariance.toFixed(2)}</div>
                    <div style="font-size:0.85em;color:#999;margin-top:4px">${totalVariance >= 0 ? 'Under budget' : 'Over budget'}</div>
                </div>
                <div style="padding:16px;background:#fff;border-radius:8px;border:1px solid #e0e0e0">
                    <div style="color:#999;font-size:0.85em;text-transform:uppercase;margin-bottom:6px">Avg Spending</div>
                    <div style="font-size:1.6em;font-weight:bold;color:#3498db">${avgPercentSpent}%</div>
                    <div style="font-size:0.85em;color:#999;margin-top:4px">Across all projects</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
                ${statuses.map(s => `
                    <button class="tab-btn ${self._filterStatus === s ? 'active' : ''}" data-status="${s}" style="padding:6px 12px">
                        ${s} (${s === 'All' ? budgetData.length : budgetData.filter(d => d.status === s).length})
                    </button>
                `).join('')}
            </div>

            <!-- Sort Controls -->
            <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
                <label style="font-size:0.9em;color:#666">Sort by:</label>
                <select id="sortBySelect" style="padding:6px 8px;border-radius:4px;border:1px solid #ddd;font-size:0.9em">
                    <option value="name" ${self._sortBy === 'name' ? 'selected' : ''}>Project Name</option>
                    <option value="budget" ${self._sortBy === 'budget' ? 'selected' : ''}>Budget (High→Low)</option>
                    <option value="spent" ${self._sortBy === 'spent' ? 'selected' : ''}>Spent (High→Low)</option>
                    <option value="variance" ${self._sortBy === 'variance' ? 'selected' : ''}>Variance (High→Low)</option>
                    <option value="percentSpent" ${self._sortBy === 'percentSpent' ? 'selected' : ''}>% Spent (High→Low)</option>
                </select>
            </div>

            <!-- Budget Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid #e0e0e0">
                <table class="table" style="width:100%;margin:0;border-collapse:collapse">
                    <thead style="background:#f5f5f5">
                        <tr>
                            <th style="padding:12px;text-align:left;border-bottom:2px solid #e0e0e0">Project</th>
                            <th style="padding:12px;text-align:right;border-bottom:2px solid #e0e0e0">Budget</th>
                            <th style="padding:12px;text-align:right;border-bottom:2px solid #e0e0e0">Spent</th>
                            <th style="padding:12px;text-align:right;border-bottom:2px solid #e0e0e0">Remaining</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #e0e0e0">% Spent</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #e0e0e0">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.length > 0 ? sorted.map(d => {
                            const percentNum = parseFloat(d.percentSpent);
                            let barColor = '#2ecc71'; // green
                            if (percentNum >= 100) barColor = '#e74c3c'; // red
                            else if (percentNum >= 80) barColor = '#f39c12'; // orange

                            return `
                                <tr style="border-bottom:1px solid #e0e0e0;transition:background 0.2s">
                                    <td style="padding:12px;text-align:left">
                                        <strong>${Utils.escapeHtml(d.name)}</strong>
                                    </td>
                                    <td style="padding:12px;text-align:right;color:#333">$${d.budget.toFixed(2)}</td>
                                    <td style="padding:12px;text-align:right;color:#e74c3c;font-weight:500">$${d.spent.toFixed(2)}</td>
                                    <td style="padding:12px;text-align:right;color:${d.variance >= 0 ? '#2ecc71' : '#e74c3c'};font-weight:500">
                                        ${d.variance >= 0 ? '+' : ''}$${d.variance.toFixed(2)}
                                    </td>
                                    <td style="padding:12px;text-align:center">
                                        <div style="background:#f0f0f0;padding:6px 10px;border-radius:4px;font-size:0.85em;display:inline-block">
                                            <div style="height:4px;width:60px;background:${barColor};border-radius:2px;margin-bottom:3px"></div>
                                            <strong>${d.percentSpent}%</strong>
                                        </div>
                                    </td>
                                    <td style="padding:12px;text-align:center">
                                        <span style="padding:4px 8px;border-radius:4px;font-size:0.85em;background:#f0f0f0">${d.status}</span>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="6" style="padding:24px;text-align:center;color:#999">
                                    No projects found
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>

            <!-- Info Box -->
            <div style="margin-top:20px;padding:12px;background:#e8f4f8;border-radius:6px;border-left:4px solid #3498db;font-size:0.9em">
                <strong>💡 Tip:</strong> To set project budgets, edit a project and add a "budget" field. Budget values are in dollars.
                This table calculates spending from all expenses assigned to each project.
            </div>
        `;

        // Event handlers
        document.querySelectorAll('[data-status]').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                self._filterStatus = btn.dataset.status;
                self.render(container);
            };
        });

        document.getElementById('sortBySelect').onchange = (e) => {
            self._sortBy = e.target.value;
            self.render(container);
        };

        document.getElementById('refreshBudgetBtn').onclick = async () => {
            try {
                const btn = document.getElementById('refreshBudgetBtn');
                btn.disabled = true;
                btn.textContent = '↻ Refreshing…';
                await AppData.syncFromServer();
                self.render(container);
            } catch(err) {
                console.error('Refresh failed:', err);
                Utils.showToast('Failed to refresh budget data', 'error');
            }
        };
    }
};
