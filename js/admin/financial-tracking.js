// Financial Tracking — LedgerMan Admin Module
window.AdminFinancialTracking = {
    _container: null,
    _selectedProjectId: 'All',
    _filterDateFrom: '',
    _filterDateTo: '',

    render(container, params) {
        const self = this;
        self._container = container;
        if (params && params.projectId) self._selectedProjectId = params.projectId;
        self._renderDashboard();
    },

    _formatCurrency(n) {
        return '$' + parseFloat(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    _progressBar(actual, budget, color) {
        const pct = budget > 0 ? Math.min(100, (actual / budget) * 100) : 0;
        const overBudget = actual > budget && budget > 0;
        return `
            <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:${overBudget ? '#dc3545' : color};transition:width .3s;min-width:${pct > 0 ? 2 : 0}px"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--text2);margin-top:3px">
                <span>${pct.toFixed(1)}%</span>
                <span>${overBudget ? '<span style="color:#dc3545">Over Budget</span>' : 'of budget'}</span>
            </div>
        `;
    },

    _getActualRevenue(projectId, dateFrom, dateTo) {
        const invoices = AppData.getAll('invoices');
        return invoices.filter(inv => {
            const pid = inv.projectId || inv.project_id;
            if (projectId && projectId !== 'All' && pid !== projectId) return false;
            if (dateFrom && inv.date && inv.date < dateFrom) return false;
            if (dateTo && inv.date && inv.date > dateTo) return false;
            return true;
        }).reduce((s, inv) => s + (parseFloat(inv.total) || parseFloat(inv.amount) || 0), 0);
    },

    _getActualCost(projectId, dateFrom, dateTo) {
        const costs = AppData.getAll('cost_allocations');
        return costs.filter(c => {
            if (projectId && projectId !== 'All' && c.projectId !== projectId) return false;
            if (dateFrom && c.date && c.date < dateFrom) return false;
            if (dateTo && c.date && c.date > dateTo) return false;
            return true;
        }).reduce((s, c) => {
            const amount = parseFloat(c.amount) || 0;
            const burdenPct = parseFloat(c.burdenPercent) || 0;
            const burden = c.costType === 'Labour' ? amount * burdenPct / 100 : 0;
            return s + amount + burden;
        }, 0);
    },

    _getSnapshot(projectId) {
        const snapshots = AppData.getAll('financial_snapshots');
        return snapshots.find(s => s.projectId === projectId) || null;
    },

    _renderDashboard() {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const activeProjects = projects.filter(p => p.status !== 'Archived' && p.status !== 'Cancelled');

        if (projects.length === 0) {
            container.innerHTML = `
                <div style="margin-bottom:20px">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
                        <h2 style="margin:0">Financial Tracking</h2>
                    </div>
                </div>
                <div style="text-align:center;padding:60px 20px;background:var(--card);border-radius:10px;border:1px solid var(--border)">
                    <div style="font-size:3rem;margin-bottom:16px">📊</div>
                    <h3 style="color:var(--text-primary);margin-bottom:8px">No Projects Found</h3>
                    <p style="color:var(--text2);margin-bottom:20px">Add projects first to start tracking financial performance.</p>
                </div>
            `;
            return;
        }

        const selPid = self._selectedProjectId;
        const isAll = selPid === 'All';

        // Aggregate financials
        let budgetRevenue = 0, budgetCost = 0, forecastRevenue = 0, forecastCost = 0;
        if (isAll) {
            (AppData.getAll('financial_snapshots') || []).forEach(s => {
                budgetRevenue += parseFloat(s.budgetRevenue) || 0;
                budgetCost += parseFloat(s.budgetCost) || 0;
                forecastRevenue += parseFloat(s.forecastRevenue) || 0;
                forecastCost += parseFloat(s.forecastCost) || 0;
            });
        } else {
            const snap = self._getSnapshot(selPid);
            if (snap) {
                budgetRevenue = parseFloat(snap.budgetRevenue) || 0;
                budgetCost = parseFloat(snap.budgetCost) || 0;
                forecastRevenue = parseFloat(snap.forecastRevenue) || 0;
                forecastCost = parseFloat(snap.forecastCost) || 0;
            }
        }

        const actualRevenue = self._getActualRevenue(isAll ? null : selPid, self._filterDateFrom, self._filterDateTo);
        const actualCost = self._getActualCost(isAll ? null : selPid, self._filterDateFrom, self._filterDateTo);
        const budgetMargin = budgetRevenue - budgetCost;
        const actualMargin = actualRevenue - actualCost;
        const revenueVariance = actualRevenue - budgetRevenue;
        const costVariance = budgetCost - actualCost; // positive = under budget (good)
        const marginPct = actualRevenue > 0 ? (actualMargin / actualRevenue * 100) : 0;

        const hasSnapshot = !isAll && self._getSnapshot(selPid) !== null;

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
                    <h2 style="margin:0">Financial Tracking</h2>
                    <button class="btn-primary" id="ftSetBudgetBtn">Set Budget</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Budget vs actual performance across all projects</p>
            </div>

            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:20px;background:var(--card);padding:14px;border-radius:8px;border:1px solid var(--border)">
                <div>
                    <label style="display:block;font-size:.82rem;color:var(--text2);margin-bottom:4px">Project</label>
                    <select id="ftProjectSel" style="width:100%;min-width:200px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All" ${isAll ? 'selected' : ''}>All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${selPid === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:.82rem;color:var(--text2);margin-bottom:4px">Actual From</label>
                    <input type="date" id="ftDateFrom" value="${self._filterDateFrom}"
                        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                </div>
                <div>
                    <label style="display:block;font-size:.82rem;color:var(--text2);margin-bottom:4px">Actual To</label>
                    <input type="date" id="ftDateTo" value="${self._filterDateTo}"
                        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                </div>
            </div>

            ${!isAll && !hasSnapshot ? `
                <div style="background:var(--card);border:1px dashed var(--border);border-radius:8px;padding:24px;margin-bottom:20px;text-align:center">
                    <p style="color:var(--text2);margin-bottom:12px">No budget set for this project.</p>
                    <button class="btn-primary" id="ftSetBudgetCta">Set Budget / Forecast</button>
                </div>
            ` : ''}

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;margin-bottom:6px">Budget Revenue</div>
                    <div style="font-size:1.3rem;font-weight:700;color:var(--text-primary)">${self._formatCurrency(budgetRevenue)}</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;margin-bottom:6px">Budget Cost</div>
                    <div style="font-size:1.3rem;font-weight:700;color:var(--text-primary)">${self._formatCurrency(budgetCost)}</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid ${budgetMargin >= 0 ? '#198754' : '#dc3545'}">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;margin-bottom:6px">Budget Margin</div>
                    <div style="font-size:1.3rem;font-weight:700;color:${budgetMargin >= 0 ? '#198754' : '#dc3545'}">${self._formatCurrency(budgetMargin)}</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid #0d6efd">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;margin-bottom:6px">Actual Revenue</div>
                    <div style="font-size:1.3rem;font-weight:700;color:#0d6efd">${self._formatCurrency(actualRevenue)}</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid #fd7e14">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;margin-bottom:6px">Actual Cost</div>
                    <div style="font-size:1.3rem;font-weight:700;color:#fd7e14">${self._formatCurrency(actualCost)}</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid ${costVariance >= 0 ? '#198754' : '#dc3545'}">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;margin-bottom:6px">Cost Variance</div>
                    <div style="font-size:1.3rem;font-weight:700;color:${costVariance >= 0 ? '#198754' : '#dc3545'}">${costVariance >= 0 ? '+' : ''}${self._formatCurrency(costVariance)}</div>
                    <div style="font-size:.72rem;color:var(--text2);margin-top:3px">${costVariance >= 0 ? 'Under Budget' : 'Over Budget'}</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid ${marginPct >= 0 ? '#198754' : '#dc3545'}">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;margin-bottom:6px">Margin %</div>
                    <div style="font-size:1.3rem;font-weight:700;color:${marginPct >= 0 ? '#198754' : '#dc3545'}">${marginPct.toFixed(1)}%</div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
                <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:18px">
                    <h4 style="margin:0 0 14px 0;font-size:.9rem;color:var(--text2);text-transform:uppercase">Revenue: Actual vs Budget</h4>
                    <div style="margin-bottom:6px;font-size:.88rem">
                        <span style="font-weight:600">${self._formatCurrency(actualRevenue)}</span>
                        <span style="color:var(--text2)"> / ${self._formatCurrency(budgetRevenue)} budget</span>
                    </div>
                    ${self._progressBar(actualRevenue, budgetRevenue, '#0d6efd')}
                    ${forecastRevenue > 0 ? `<div style="margin-top:10px;font-size:.8rem;color:var(--text2)">Forecast: ${self._formatCurrency(forecastRevenue)}</div>` : ''}
                </div>
                <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:18px">
                    <h4 style="margin:0 0 14px 0;font-size:.9rem;color:var(--text2);text-transform:uppercase">Cost: Actual vs Budget</h4>
                    <div style="margin-bottom:6px;font-size:.88rem">
                        <span style="font-weight:600">${self._formatCurrency(actualCost)}</span>
                        <span style="color:var(--text2)"> / ${self._formatCurrency(budgetCost)} budget</span>
                    </div>
                    ${self._progressBar(actualCost, budgetCost, '#fd7e14')}
                    ${forecastCost > 0 ? `<div style="margin-top:10px;font-size:.8rem;color:var(--text2)">Forecast: ${self._formatCurrency(forecastCost)}</div>` : ''}
                </div>
            </div>

            <div>
                <h3 style="margin:0 0 14px 0;font-size:1rem">Project Overview</h3>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
                    ${activeProjects.map(p => {
                        const snap = self._getSnapshot(p.id);
                        const bRev = snap ? (parseFloat(snap.budgetRevenue) || 0) : 0;
                        const bCost = snap ? (parseFloat(snap.budgetCost) || 0) : 0;
                        const aRev = self._getActualRevenue(p.id, self._filterDateFrom, self._filterDateTo);
                        const aCost = self._getActualCost(p.id, self._filterDateFrom, self._filterDateTo);
                        const variance = bCost > 0 ? bCost - aCost : null;
                        const overBudget = variance !== null && variance < 0;
                        const borderColor = overBudget ? '#dc3545' : (variance !== null ? '#198754' : 'var(--border)');
                        return `
                            <div style="background:var(--card);border:1px solid ${borderColor};border-radius:8px;padding:16px;cursor:pointer" data-proj-id="${p.id}" class="ftProjCard">
                                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
                                    <div style="font-weight:600;font-size:.95rem">${Utils.escapeHtml(p.name)}</div>
                                    <span style="padding:2px 8px;border-radius:10px;font-size:.7rem;font-weight:600;background:${overBudget ? '#dc3545' : (variance !== null ? '#198754' : '#6c757d')};color:white">
                                        ${overBudget ? 'Over Budget' : (variance !== null ? 'On Track' : 'No Budget')}
                                    </span>
                                </div>
                                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:.8rem">
                                    <div>
                                        <div style="color:var(--text2)">Budget</div>
                                        <div style="font-weight:600">${bRev > 0 ? self._formatCurrency(bRev) : '—'}</div>
                                    </div>
                                    <div>
                                        <div style="color:var(--text2)">Actual Rev</div>
                                        <div style="font-weight:600;color:#0d6efd">${self._formatCurrency(aRev)}</div>
                                    </div>
                                    <div>
                                        <div style="color:var(--text2)">Cost Var</div>
                                        <div style="font-weight:600;color:${overBudget ? '#dc3545' : '#198754'}">
                                            ${variance !== null ? (variance >= 0 ? '+' : '') + self._formatCurrency(variance) : '—'}
                                        </div>
                                    </div>
                                </div>
                                ${bCost > 0 ? `
                                <div style="margin-top:10px">
                                    <div style="background:var(--border);border-radius:3px;height:5px;overflow:hidden">
                                        <div style="width:${Math.min(100, bCost > 0 ? aCost/bCost*100 : 0)}%;height:100%;background:${overBudget ? '#dc3545' : '#fd7e14'}"></div>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        document.getElementById('ftSetBudgetBtn').onclick = () => self._showBudgetModal(selPid !== 'All' ? selPid : (projects.length > 0 ? projects[0].id : ''));
        const ctaBtn = document.getElementById('ftSetBudgetCta');
        if (ctaBtn) ctaBtn.onclick = () => self._showBudgetModal(selPid);

        document.getElementById('ftProjectSel').onchange = e => { self._selectedProjectId = e.target.value; self._renderDashboard(); };
        document.getElementById('ftDateFrom').onchange = e => { self._filterDateFrom = e.target.value; self._renderDashboard(); };
        document.getElementById('ftDateTo').onchange = e => { self._filterDateTo = e.target.value; self._renderDashboard(); };

        container.querySelectorAll('.ftProjCard').forEach(card => {
            card.onclick = () => { self._selectedProjectId = card.dataset.projId; self._renderDashboard(); };
        });
    },

    _showBudgetModal(defaultProjectId) {
        const self = this;
        const projects = AppData.getProjects();
        const initPid = defaultProjectId || (projects.length > 0 ? projects[0].id : '');
        const snap = initPid ? self._getSnapshot(initPid) : null;

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';

        const renderModalContent = (pid, currentSnap) => `
            <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:24px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                    <h3 style="margin:0">Set Budget / Forecast</h3>
                    <button id="ftBudgetClose" style="background:none;border:none;color:var(--text2);font-size:1.4rem;cursor:pointer;line-height:1">&times;</button>
                </div>
                <form id="ftBudgetForm">
                    <div style="margin-bottom:16px">
                        <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Project *</label>
                        <select id="ftBudgetProject" required style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                            ${projects.map(p => `<option value="${p.id}" ${pid === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Budget Revenue ($)</label>
                            <input type="number" id="ftBudgRev" value="${currentSnap ? (parseFloat(currentSnap.budgetRevenue) || 0).toFixed(2) : '0.00'}"
                                min="0" step="0.01"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Budget Cost ($)</label>
                            <input type="number" id="ftBudgCost" value="${currentSnap ? (parseFloat(currentSnap.budgetCost) || 0).toFixed(2) : '0.00'}"
                                min="0" step="0.01"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Forecast Revenue ($)</label>
                            <input type="number" id="ftForecastRev" value="${currentSnap ? (parseFloat(currentSnap.forecastRevenue) || 0).toFixed(2) : '0.00'}"
                                min="0" step="0.01"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Forecast Cost ($)</label>
                            <input type="number" id="ftForecastCost" value="${currentSnap ? (parseFloat(currentSnap.forecastCost) || 0).toFixed(2) : '0.00'}"
                                min="0" step="0.01"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                    </div>
                    <div style="margin-bottom:20px">
                        <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Notes</label>
                        <textarea id="ftBudgetNotes" rows="3" placeholder="Budget notes, assumptions…"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;resize:vertical">${currentSnap ? Utils.escapeHtml(currentSnap.notes || '') : ''}</textarea>
                    </div>
                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="ftBudgetCancel" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary" id="ftBudgetSaveBtn">Save Budget</button>
                    </div>
                </form>
            </div>
        `;

        overlay.innerHTML = renderModalContent(initPid, snap);
        document.body.appendChild(overlay);

        const close = () => document.body.removeChild(overlay);
        document.getElementById('ftBudgetClose').onclick = close;
        document.getElementById('ftBudgetCancel').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        // When project changes, reload snapshot values
        document.getElementById('ftBudgetProject').onchange = (e) => {
            const newPid = e.target.value;
            const newSnap = self._getSnapshot(newPid);
            document.getElementById('ftBudgRev').value = newSnap ? (parseFloat(newSnap.budgetRevenue) || 0).toFixed(2) : '0.00';
            document.getElementById('ftBudgCost').value = newSnap ? (parseFloat(newSnap.budgetCost) || 0).toFixed(2) : '0.00';
            document.getElementById('ftForecastRev').value = newSnap ? (parseFloat(newSnap.forecastRevenue) || 0).toFixed(2) : '0.00';
            document.getElementById('ftForecastCost').value = newSnap ? (parseFloat(newSnap.forecastCost) || 0).toFixed(2) : '0.00';
            document.getElementById('ftBudgetNotes').value = newSnap ? (newSnap.notes || '') : '';
        };

        document.getElementById('ftBudgetForm').onsubmit = (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('ftBudgetSaveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
            try {
                const projectId = document.getElementById('ftBudgetProject').value;
                const existingSnap = self._getSnapshot(projectId);
                const record = {
                    id: existingSnap ? existingSnap.id : ('snap_' + Date.now()),
                    projectId: projectId,
                    budgetRevenue: parseFloat(document.getElementById('ftBudgRev').value) || 0,
                    budgetCost: parseFloat(document.getElementById('ftBudgCost').value) || 0,
                    forecastRevenue: parseFloat(document.getElementById('ftForecastRev').value) || 0,
                    forecastCost: parseFloat(document.getElementById('ftForecastCost').value) || 0,
                    notes: document.getElementById('ftBudgetNotes').value,
                    created_at: existingSnap ? existingSnap.created_at : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                AppData.save('financial_snapshots', record);
                Utils.showToast('Budget saved', 'success');
                close();
                self._selectedProjectId = projectId;
                self._renderDashboard();
            } catch (err) {
                console.error('Save failed:', err);
                Utils.showToast('Failed to save: ' + err.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Budget';
            }
        };
    }
};
