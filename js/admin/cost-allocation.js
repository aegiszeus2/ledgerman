// Cost Allocation — LedgerMan Admin Module
window.AdminCostAllocation = {
    _container: null,
    _filterProject: 'All',
    _filterType: 'All',
    _filterDateFrom: '',
    _filterDateTo: '',

    render(container, params) {
        const self = this;
        self._container = container;
        self._renderList();
    },

    _costTypeColor(type) {
        return {
            'Labour': '#6f42c1',
            'Equipment': '#fd7e14',
            'Material': '#0d6efd',
            'Subcontract': '#20c997',
            'Other': '#6c757d'
        }[type] || '#6c757d';
    },

    _formatCurrency(n) {
        return '$' + parseFloat(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    _calcTotal(entry) {
        const amount = parseFloat(entry.amount) || 0;
        const burdenPct = parseFloat(entry.burdenPercent) || 0;
        return amount + (entry.costType === 'Labour' ? amount * burdenPct / 100 : 0);
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const allCosts = AppData.getAll('cost_allocations');
        const costTypes = ['All', 'Labour', 'Equipment', 'Material', 'Subcontract', 'Other'];

        const filtered = allCosts.filter(c => {
            const pm = self._filterProject === 'All' || c.projectId === self._filterProject;
            const tm = self._filterType === 'All' || c.costType === self._filterType;
            const dm = (!self._filterDateFrom || c.date >= self._filterDateFrom);
            const dm2 = (!self._filterDateTo || c.date <= self._filterDateTo);
            return pm && tm && dm && dm2;
        });

        // Summary by type
        const totalCost = allCosts.reduce((s, c) => s + self._calcTotal(c), 0);
        const byType = {};
        ['Labour','Equipment','Material','Subcontract','Other'].forEach(t => {
            byType[t] = allCosts.filter(c => c.costType === t).reduce((s, c) => s + self._calcTotal(c), 0);
        });

        const filteredTotal = filtered.reduce((s, c) => s + self._calcTotal(c), 0);

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
                    <h2 style="margin:0">Cost Allocation</h2>
                    <div style="display:flex;gap:8px">
                        <button class="btn-secondary btn-sm" id="caExportBtn">Export CSV</button>
                        <button class="btn-primary" id="caNewBtn">+ Add Cost</button>
                    </div>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Track and allocate project costs by type, code, and resource</p>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:24px">
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;margin-bottom:4px">Total Cost</div>
                    <div style="font-size:1.3rem;font-weight:700;color:var(--text-primary)">${self._formatCurrency(totalCost)}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border-left:3px solid #6f42c1">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;margin-bottom:4px">Labour</div>
                    <div style="font-size:1.2rem;font-weight:700;color:#6f42c1">${self._formatCurrency(byType['Labour'])}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border-left:3px solid #fd7e14">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;margin-bottom:4px">Equipment</div>
                    <div style="font-size:1.2rem;font-weight:700;color:#fd7e14">${self._formatCurrency(byType['Equipment'])}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border-left:3px solid #0d6efd">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;margin-bottom:4px">Materials</div>
                    <div style="font-size:1.2rem;font-weight:700;color:#0d6efd">${self._formatCurrency(byType['Material'])}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border-left:3px solid #20c997">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;margin-bottom:4px">Subcontract</div>
                    <div style="font-size:1.2rem;font-weight:700;color:#20c997">${self._formatCurrency(byType['Subcontract'])}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border-left:3px solid #6c757d">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;margin-bottom:4px">Other</div>
                    <div style="font-size:1.2rem;font-weight:700;color:#6c757d">${self._formatCurrency(byType['Other'])}</div>
                </div>
            </div>

            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px;background:var(--card);padding:14px;border-radius:8px;border:1px solid var(--border)">
                <div>
                    <label style="display:block;font-size:.82rem;color:var(--text2);margin-bottom:4px">Project</label>
                    <select id="caProjectFilter" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:.82rem;color:var(--text2);margin-bottom:4px">Cost Type</label>
                    <select id="caTypeFilter" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${costTypes.map(t => `<option value="${t}" ${self._filterType === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:.82rem;color:var(--text2);margin-bottom:4px">Date From</label>
                    <input type="date" id="caDateFrom" value="${self._filterDateFrom}"
                        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                </div>
                <div>
                    <label style="display:block;font-size:.82rem;color:var(--text2);margin-bottom:4px">Date To</label>
                    <input type="date" id="caDateTo" value="${self._filterDateTo}"
                        style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                </div>
                <div>
                    <button class="btn-secondary btn-sm" id="caClearFilters" style="margin-top:20px">Clear Filters</button>
                </div>
            </div>

            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:11px;text-align:left;border-bottom:1px solid var(--border);font-size:.82rem;color:var(--text2)">Date</th>
                            <th style="padding:11px;text-align:left;border-bottom:1px solid var(--border);font-size:.82rem;color:var(--text2)">Project</th>
                            <th style="padding:11px;text-align:center;border-bottom:1px solid var(--border);font-size:.82rem;color:var(--text2)">Type</th>
                            <th style="padding:11px;text-align:left;border-bottom:1px solid var(--border);font-size:.82rem;color:var(--text2)">Description</th>
                            <th style="padding:11px;text-align:left;border-bottom:1px solid var(--border);font-size:.82rem;color:var(--text2)">Cost Code</th>
                            <th style="padding:11px;text-align:right;border-bottom:1px solid var(--border);font-size:.82rem;color:var(--text2)">Qty × Unit</th>
                            <th style="padding:11px;text-align:right;border-bottom:1px solid var(--border);font-size:.82rem;color:var(--text2)">Rate</th>
                            <th style="padding:11px;text-align:right;border-bottom:1px solid var(--border);font-size:.82rem;color:var(--text2)">Amount</th>
                            <th style="padding:11px;text-align:right;border-bottom:1px solid var(--border);font-size:.82rem;color:var(--text2)">Burden</th>
                            <th style="padding:11px;text-align:right;border-bottom:1px solid var(--border);font-size:.82rem;color:var(--text2)">Total</th>
                            <th style="padding:11px;text-align:center;border-bottom:1px solid var(--border);font-size:.82rem;color:var(--text2)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length === 0 ? `
                            <tr><td colspan="11" style="padding:40px;text-align:center;color:var(--text2)">
                                No cost entries found. Click "+ Add Cost" to record a cost.
                            </td></tr>
                        ` : filtered.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(c => {
                            const proj = projects.find(p => p.id === c.projectId);
                            const amount = parseFloat(c.amount) || 0;
                            const burdenPct = parseFloat(c.burdenPercent) || 0;
                            const burden = c.costType === 'Labour' ? amount * burdenPct / 100 : 0;
                            const total = amount + burden;
                            const qtyUnit = (c.quantity && c.unit) ? `${c.quantity} ${Utils.escapeHtml(c.unit)}` : (c.quantity ? String(c.quantity) : '—');
                            return `
                                <tr style="border-bottom:1px solid var(--border)">
                                    <td style="padding:11px;font-size:.88rem">${Utils.escapeHtml(c.date || '—')}</td>
                                    <td style="padding:11px;font-size:.88rem">${Utils.escapeHtml(proj ? proj.name : '—')}</td>
                                    <td style="padding:11px;text-align:center">
                                        <span style="padding:3px 8px;border-radius:12px;font-size:.73rem;font-weight:600;background:${self._costTypeColor(c.costType)};color:white">${Utils.escapeHtml(c.costType || 'Other')}</span>
                                    </td>
                                    <td style="padding:11px">
                                        <div>${Utils.escapeHtml(c.description || '—')}</div>
                                        ${c.notes ? `<div style="font-size:.78rem;color:var(--text2);margin-top:2px">${Utils.escapeHtml(c.notes)}</div>` : ''}
                                    </td>
                                    <td style="padding:11px;font-size:.85rem;color:var(--text2)">${Utils.escapeHtml(c.costCode || '—')}</td>
                                    <td style="padding:11px;text-align:right;font-size:.85rem">${qtyUnit}</td>
                                    <td style="padding:11px;text-align:right;font-size:.85rem">${c.rate ? self._formatCurrency(c.rate) : '—'}</td>
                                    <td style="padding:11px;text-align:right;font-weight:600">${self._formatCurrency(amount)}</td>
                                    <td style="padding:11px;text-align:right;font-size:.85rem;color:#6f42c1">${burden > 0 ? self._formatCurrency(burden) : '—'}</td>
                                    <td style="padding:11px;text-align:right;font-weight:700;color:var(--primary)">${self._formatCurrency(total)}</td>
                                    <td style="padding:11px;text-align:center;white-space:nowrap">
                                        <button class="btn-secondary btn-sm" data-id="${c.id}" data-action="edit">Edit</button>
                                        <button class="btn-secondary btn-sm" data-id="${c.id}" data-action="delete" style="margin-left:4px">Delete</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    ${filtered.length > 0 ? `
                    <tfoot>
                        <tr style="background:var(--card);font-weight:700;border-top:2px solid var(--border)">
                            <td colspan="9" style="padding:12px;text-align:right">Filtered Total:</td>
                            <td style="padding:12px;text-align:right;color:var(--primary)">${self._formatCurrency(filteredTotal)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                    ` : ''}
                </table>
            </div>
        `;

        document.getElementById('caNewBtn').onclick = () => self._showForm(null);
        document.getElementById('caProjectFilter').onchange = e => { self._filterProject = e.target.value; self._renderList(); };
        document.getElementById('caTypeFilter').onchange = e => { self._filterType = e.target.value; self._renderList(); };
        document.getElementById('caDateFrom').onchange = e => { self._filterDateFrom = e.target.value; self._renderList(); };
        document.getElementById('caDateTo').onchange = e => { self._filterDateTo = e.target.value; self._renderList(); };
        document.getElementById('caClearFilters').onclick = () => {
            self._filterProject = 'All'; self._filterType = 'All';
            self._filterDateFrom = ''; self._filterDateTo = '';
            self._renderList();
        };

        document.getElementById('caExportBtn').onclick = () => self._exportCsv(filtered, projects);

        container.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = () => self._showForm(btn.dataset.id);
        });
        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this cost entry? This cannot be undone.')) {
                    AppData.remove('cost_allocations', btn.dataset.id);
                    Utils.showToast('Cost entry deleted', 'success');
                    self._renderList();
                }
            };
        });
    },

    _exportCsv(filtered, projects) {
        const self = this;
        const csvEscape = (val) => {
            if (val === null || val === undefined) return '';
            const s = String(val);
            if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
                return '"' + s.replace(/"/g, '""') + '"';
            return s;
        };
        const rows = ['Date,Project,Type,Description,Cost Code,Quantity,Unit,Rate,Amount,Burden%,Total'];
        filtered.forEach(c => {
            const proj = projects.find(p => p.id === c.projectId);
            const amount = parseFloat(c.amount) || 0;
            const burdenPct = parseFloat(c.burdenPercent) || 0;
            const burden = c.costType === 'Labour' ? amount * burdenPct / 100 : 0;
            const total = amount + burden;
            rows.push([
                c.date || '',
                proj ? proj.name : '',
                c.costType || '',
                c.description || '',
                c.costCode || '',
                c.quantity || '',
                c.unit || '',
                c.rate || '',
                amount.toFixed(2),
                burdenPct || '',
                total.toFixed(2)
            ].map(csvEscape).join(','));
        });
        const csv = rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cost-allocation-' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Utils.showToast('CSV exported', 'success');
    },

    _showForm(costId) {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const allCosts = AppData.getAll('cost_allocations');
        const cost = costId ? allCosts.find(c => c.id === costId) : null;
        const isNew = !cost;
        const id = cost ? cost.id : ('cost_' + Date.now());
        const today = new Date().toISOString().slice(0, 10);

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';
        overlay.innerHTML = `
            <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;width:100%;max-width:600px;max-height:90vh;overflow-y:auto;padding:24px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                    <h3 style="margin:0">${isNew ? 'Add Cost Entry' : 'Edit Cost Entry'}</h3>
                    <button id="caFormClose" style="background:none;border:none;color:var(--text2);font-size:1.4rem;cursor:pointer;line-height:1">&times;</button>
                </div>
                <form id="caForm">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Date *</label>
                            <input type="date" id="caDate" value="${cost ? (cost.date || today) : today}" required
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Project</label>
                            <select id="caProject" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                <option value="">— None —</option>
                                ${projects.map(p => `<option value="${p.id}" ${(cost && cost.projectId === p.id) ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Cost Type *</label>
                            <select id="caCostType" required style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                ${['Labour','Equipment','Material','Subcontract','Other'].map(t => `<option value="${t}" ${(cost ? cost.costType : 'Labour') === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Cost Code</label>
                            <input type="text" id="caCostCode" value="${cost ? Utils.escapeHtml(cost.costCode || '') : ''}"
                                placeholder="e.g., 03-100"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                    </div>
                    <div style="margin-bottom:14px">
                        <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Description *</label>
                        <input type="text" id="caDescription" value="${cost ? Utils.escapeHtml(cost.description || '') : ''}"
                            placeholder="Description of cost…" required
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Quantity</label>
                            <input type="number" id="caQuantity" value="${cost ? (cost.quantity || '') : ''}"
                                min="0" step="any" placeholder="0"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Unit</label>
                            <input type="text" id="caUnit" value="${cost ? Utils.escapeHtml(cost.unit || '') : ''}"
                                placeholder="hrs, m², ea…"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Rate ($)</label>
                            <input type="number" id="caRate" value="${cost ? (cost.rate || '') : ''}"
                                min="0" step="0.01" placeholder="0.00"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Amount ($) *</label>
                            <input type="number" id="caAmount" value="${cost ? (parseFloat(cost.amount) || 0).toFixed(2) : '0.00'}"
                                min="0" step="0.01" required
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                        <div id="caBurdenWrapper" style="${(cost ? cost.costType : 'Labour') === 'Labour' ? '' : 'opacity:.4;pointer-events:none'}">
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Burden % (Labour overhead)</label>
                            <input type="number" id="caBurden" value="${cost ? (cost.burdenPercent || 0) : 0}"
                                min="0" max="100" step="0.5"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                    </div>
                    <div style="margin-bottom:20px">
                        <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Notes</label>
                        <textarea id="caNotes" rows="3" placeholder="Additional notes…"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;resize:vertical">${cost ? Utils.escapeHtml(cost.notes || '') : ''}</textarea>
                    </div>
                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="caFormCancel" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary" id="caSaveBtn">Save Cost</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => document.body.removeChild(overlay);
        document.getElementById('caFormClose').onclick = close;
        document.getElementById('caFormCancel').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        // Toggle burden field visibility based on cost type
        document.getElementById('caCostType').onchange = (e) => {
            const burdenWrapper = document.getElementById('caBurdenWrapper');
            if (e.target.value === 'Labour') {
                burdenWrapper.style.opacity = '1';
                burdenWrapper.style.pointerEvents = 'auto';
            } else {
                burdenWrapper.style.opacity = '0.4';
                burdenWrapper.style.pointerEvents = 'none';
            }
        };

        document.getElementById('caForm').onsubmit = (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('caSaveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
            try {
                const record = {
                    id: id,
                    projectId: document.getElementById('caProject').value,
                    date: document.getElementById('caDate').value,
                    costType: document.getElementById('caCostType').value,
                    description: document.getElementById('caDescription').value,
                    costCode: document.getElementById('caCostCode').value,
                    amount: parseFloat(document.getElementById('caAmount').value) || 0,
                    quantity: document.getElementById('caQuantity').value ? parseFloat(document.getElementById('caQuantity').value) : null,
                    unit: document.getElementById('caUnit').value,
                    rate: document.getElementById('caRate').value ? parseFloat(document.getElementById('caRate').value) : null,
                    burdenPercent: parseFloat(document.getElementById('caBurden').value) || 0,
                    notes: document.getElementById('caNotes').value,
                    created_at: cost ? cost.created_at : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                AppData.save('cost_allocations', record);
                Utils.showToast(isNew ? 'Cost entry added' : 'Cost entry updated', 'success');
                close();
                self._renderList();
            } catch (err) {
                console.error('Save failed:', err);
                Utils.showToast('Failed to save: ' + err.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Cost';
            }
        };
    }
};
