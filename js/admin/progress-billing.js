// Progress Billing / Schedule of Values — LedgerMan Admin Module
window.AdminProgressBilling = {
    _container: null,
    _filterProject: 'All',
    _filterStatus: 'All',
    _editingId: null,

    render(container, params) {
        const self = this;
        self._container = container;
        if (params && params.editId) {
            self._renderEditView(params.editId);
        } else if (params && params.newApp) {
            self._renderEditView(null);
        } else {
            self._renderList();
        }
    },

    _statusColor(status) {
        return {
            'Draft': '#6c757d',
            'Submitted': '#0d6efd',
            'Certified': '#198754',
            'Paid': '#084298',
            'Rejected': '#dc3545'
        }[status] || '#6c757d';
    },

    _formatCurrency(n) {
        return '$' + parseFloat(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    _calcLineItem(li) {
        const prev = parseFloat(li.previousPercent) || 0;
        const thisPeriod = parseFloat(li.thisPeriodPercent) || 0;
        const total = Math.min(100, prev + thisPeriod);
        const sv = parseFloat(li.scheduledValue) || 0;
        const balance = sv * (1 - total / 100);
        return Object.assign({}, li, {
            totalPercentComplete: total,
            balanceToFinish: balance
        });
    },

    _getAppNumber(projectId, excludeId) {
        const apps = AppData.getAll('billing_applications').filter(a =>
            a.projectId === projectId && a.id !== excludeId
        );
        return apps.length + 1;
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const allApps = AppData.getAll('billing_applications');

        const filtered = allApps.filter(a => {
            const pm = self._filterProject === 'All' || a.projectId === self._filterProject;
            const sm = self._filterStatus === 'All' || a.status === self._filterStatus;
            return pm && sm;
        });

        const certifiedCount = allApps.filter(a => a.status === 'Certified').length;
        const totalBilled = allApps.reduce((sum, a) => {
            const items = (a.lineItems || []).map(li => self._calcLineItem(li));
            const completedVal = items.reduce((s, li) => s + (parseFloat(li.scheduledValue) || 0) * (li.totalPercentComplete / 100), 0);
            return sum + completedVal;
        }, 0);

        const statuses = ['All', 'Draft', 'Submitted', 'Certified', 'Paid', 'Rejected'];

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
                    <h2 style="margin:0">Progress Billing / SOV</h2>
                    <button class="btn-primary" id="pbNewBtn">+ New Application</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Schedule of Values billing applications by project</p>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;margin-bottom:6px">Total Applications</div>
                    <div style="font-size:1.8rem;font-weight:700;color:var(--text-primary)">${allApps.length}</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid #198754">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;margin-bottom:6px">Certified</div>
                    <div style="font-size:1.8rem;font-weight:700;color:#198754">${certifiedCount}</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;margin-bottom:6px">Total Billed</div>
                    <div style="font-size:1.5rem;font-weight:700;color:var(--primary)">${self._formatCurrency(totalBilled)}</div>
                </div>
            </div>

            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
                <div>
                    <label style="display:block;font-size:.82rem;color:var(--text2);margin-bottom:4px">Project</label>
                    <select id="pbProjectFilter" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:.82rem;color:var(--text2);margin-bottom:4px">Status</label>
                    <select id="pbStatusFilter" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:12px;text-align:left;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">App #</th>
                            <th style="padding:12px;text-align:left;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Project</th>
                            <th style="padding:12px;text-align:left;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Period</th>
                            <th style="padding:12px;text-align:center;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Retainage%</th>
                            <th style="padding:12px;text-align:center;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Status</th>
                            <th style="padding:12px;text-align:right;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Scheduled Value</th>
                            <th style="padding:12px;text-align:right;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Completed to Date</th>
                            <th style="padding:12px;text-align:center;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length === 0 ? `
                            <tr><td colspan="8" style="padding:40px;text-align:center;color:var(--text2)">
                                No billing applications found. Click "+ New Application" to create one.
                            </td></tr>
                        ` : filtered.sort((a, b) => (b.applicationNumber || 0) - (a.applicationNumber || 0)).map(app => {
                            const proj = projects.find(p => p.id === app.projectId);
                            const items = (app.lineItems || []).map(li => self._calcLineItem(li));
                            const totalSV = items.reduce((s, li) => s + (parseFloat(li.scheduledValue) || 0), 0);
                            const completedVal = items.reduce((s, li) => s + (parseFloat(li.scheduledValue) || 0) * (li.totalPercentComplete / 100), 0);
                            const periodStr = (app.billingPeriodStart && app.billingPeriodEnd)
                                ? `${app.billingPeriodStart} — ${app.billingPeriodEnd}`
                                : (app.billingPeriodStart || '—');
                            return `
                                <tr style="border-bottom:1px solid var(--border)">
                                    <td style="padding:12px;font-weight:600">#${app.applicationNumber || '?'}</td>
                                    <td style="padding:12px">${Utils.escapeHtml(proj ? proj.name : 'Unknown')}</td>
                                    <td style="padding:12px;font-size:.85rem;color:var(--text2)">${Utils.escapeHtml(periodStr)}</td>
                                    <td style="padding:12px;text-align:center">${parseFloat(app.retainagePercent || 10).toFixed(1)}%</td>
                                    <td style="padding:12px;text-align:center">
                                        <span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${self._statusColor(app.status)};color:white">
                                            ${Utils.escapeHtml(app.status || 'Draft')}
                                        </span>
                                    </td>
                                    <td style="padding:12px;text-align:right">${self._formatCurrency(totalSV)}</td>
                                    <td style="padding:12px;text-align:right">${self._formatCurrency(completedVal)}</td>
                                    <td style="padding:12px;text-align:center;white-space:nowrap">
                                        <button class="btn-secondary btn-sm" data-id="${app.id}" data-action="edit">Edit</button>
                                        <button class="btn-secondary btn-sm" data-id="${app.id}" data-action="delete" style="margin-left:4px">Delete</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('pbNewBtn').onclick = () => self._renderEditView(null);
        document.getElementById('pbProjectFilter').onchange = e => { self._filterProject = e.target.value; self._renderList(); };
        document.getElementById('pbStatusFilter').onchange = e => { self._filterStatus = e.target.value; self._renderList(); };

        container.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = () => self._renderEditView(btn.dataset.id);
        });
        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this billing application? This cannot be undone.')) {
                    AppData.remove('billing_applications', btn.dataset.id);
                    Utils.showToast('Application deleted', 'success');
                    self._renderList();
                }
            };
        });
    },

    _renderEditView(appId) {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const allApps = AppData.getAll('billing_applications');
        const app = appId ? allApps.find(a => a.id === appId) : null;
        const isNew = !app;

        const id = app ? app.id : ('billing_' + Date.now());
        const appNum = app ? (app.applicationNumber || 1) : self._getAppNumber(app ? app.projectId : '');
        let lineItems = app ? (app.lineItems || []) : [];
        if (lineItems.length === 0) {
            lineItems = [{ id: 'li_' + Date.now(), description: '', scheduledValue: 0, previousPercent: 0, thisPeriodPercent: 0 }];
        }
        lineItems = lineItems.map(li => self._calcLineItem(li));

        const defaultProjectId = app ? app.projectId : (projects.length > 0 ? projects[0].id : '');
        const proj = projects.find(p => p.id === defaultProjectId);
        const headerTitle = isNew ? 'New Billing Application' : `Billing Application #${appNum} — ${proj ? Utils.escapeHtml(proj.name) : 'Unknown Project'}`;

        const renderLineItemsTable = (items) => {
            const calcItems = items.map(li => self._calcLineItem(li));
            const totalSV = calcItems.reduce((s, li) => s + (parseFloat(li.scheduledValue) || 0), 0);
            const totalCompleted = calcItems.reduce((s, li) => s + (parseFloat(li.scheduledValue) || 0) * (li.totalPercentComplete / 100), 0);
            const totalBalance = calcItems.reduce((s, li) => s + (li.balanceToFinish || 0), 0);

            return `
                <div style="overflow-x:auto">
                    <table style="width:100%;border-collapse:collapse;font-size:.88rem" id="pbLineItemsTable">
                        <thead>
                            <tr style="background:var(--card)">
                                <th style="padding:10px;text-align:left;border-bottom:1px solid var(--border)">Description</th>
                                <th style="padding:10px;text-align:right;border-bottom:1px solid var(--border);min-width:120px">Scheduled Value ($)</th>
                                <th style="padding:10px;text-align:right;border-bottom:1px solid var(--border);min-width:100px">Prev % Complete</th>
                                <th style="padding:10px;text-align:right;border-bottom:1px solid var(--border);min-width:100px">This Period %</th>
                                <th style="padding:10px;text-align:right;border-bottom:1px solid var(--border);min-width:100px">Total % Complete</th>
                                <th style="padding:10px;text-align:right;border-bottom:1px solid var(--border);min-width:130px">Balance to Finish</th>
                                <th style="padding:10px;text-align:center;border-bottom:1px solid var(--border);min-width:50px"></th>
                            </tr>
                        </thead>
                        <tbody id="pbLineItemsBody">
                            ${calcItems.map((li, idx) => `
                                <tr data-li-idx="${idx}" style="border-bottom:1px solid var(--border)">
                                    <td style="padding:8px">
                                        <input type="text" class="li-desc" data-idx="${idx}" value="${Utils.escapeHtml(li.description || '')}"
                                            placeholder="Description…"
                                            style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem">
                                    </td>
                                    <td style="padding:8px">
                                        <input type="number" class="li-sv" data-idx="${idx}" value="${parseFloat(li.scheduledValue || 0).toFixed(2)}"
                                            min="0" step="0.01"
                                            style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem;text-align:right">
                                    </td>
                                    <td style="padding:8px">
                                        <input type="number" class="li-prev" data-idx="${idx}" value="${parseFloat(li.previousPercent || 0).toFixed(1)}"
                                            min="0" max="100" step="0.1"
                                            style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem;text-align:right">
                                    </td>
                                    <td style="padding:8px">
                                        <input type="number" class="li-this" data-idx="${idx}" value="${parseFloat(li.thisPeriodPercent || 0).toFixed(1)}"
                                            min="0" max="100" step="0.1"
                                            style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);font-size:.88rem;text-align:right">
                                    </td>
                                    <td style="padding:8px;text-align:right;font-weight:600;color:var(--primary)" class="li-total-pct" data-idx="${idx}">
                                        ${li.totalPercentComplete.toFixed(1)}%
                                    </td>
                                    <td style="padding:8px;text-align:right" class="li-balance" data-idx="${idx}">
                                        ${self._formatCurrency(li.balanceToFinish)}
                                    </td>
                                    <td style="padding:8px;text-align:center">
                                        <button type="button" class="btn-secondary btn-sm li-remove-btn" data-idx="${idx}" style="padding:2px 8px;color:#dc3545;border-color:#dc3545">✕</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="background:var(--card);font-weight:700">
                                <td style="padding:10px">TOTALS</td>
                                <td style="padding:10px;text-align:right" id="pbTotalSV">${self._formatCurrency(totalSV)}</td>
                                <td style="padding:10px"></td>
                                <td style="padding:10px"></td>
                                <td style="padding:10px;text-align:right" id="pbTotalPct">
                                    ${totalSV > 0 ? (totalCompleted / totalSV * 100).toFixed(1) + '%' : '0.0%'}
                                </td>
                                <td style="padding:10px;text-align:right" id="pbTotalBalance">${self._formatCurrency(totalBalance)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <button type="button" id="pbAddLineBtn" class="btn-secondary btn-sm" style="margin-top:10px">+ Add Line Item</button>
            `;
        };

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                    <button class="btn-secondary btn-sm" id="pbBackBtn">← Back</button>
                    <h2 style="margin:0">${headerTitle}</h2>
                </div>
            </div>

            <form id="pbEditForm">
                <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px;margin-bottom:20px">
                    <h3 style="margin:0 0 16px 0;font-size:1rem;color:var(--text2);text-transform:uppercase;letter-spacing:.05em">Application Details</h3>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Project *</label>
                            <select id="pbProjectSel" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                                ${projects.map(p => `<option value="${p.id}" ${defaultProjectId === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Period Start</label>
                            <input type="date" id="pbPeriodStart" value="${app ? (app.billingPeriodStart || '') : ''}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Period End</label>
                            <input type="date" id="pbPeriodEnd" value="${app ? (app.billingPeriodEnd || '') : ''}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Retainage %</label>
                            <input type="number" id="pbRetainage" value="${app ? (app.retainagePercent !== undefined ? app.retainagePercent : 10) : 10}"
                                min="0" max="100" step="0.5"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Status</label>
                            <select id="pbStatus" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                ${['Draft','Submitted','Certified','Paid','Rejected'].map(s => `<option value="${s}" ${(app ? app.status : 'Draft') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div style="margin-top:16px">
                        <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Notes</label>
                        <textarea id="pbNotes" rows="3" placeholder="Application notes…"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;resize:vertical">${app ? Utils.escapeHtml(app.notes || '') : ''}</textarea>
                    </div>
                </div>

                <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px;margin-bottom:20px">
                    <h3 style="margin:0 0 16px 0;font-size:1rem;color:var(--text2);text-transform:uppercase;letter-spacing:.05em">Schedule of Values — Line Items</h3>
                    <div id="pbLineItemsWrapper">
                        ${renderLineItemsTable(lineItems)}
                    </div>
                </div>

                <div style="display:flex;gap:10px;justify-content:flex-end">
                    <button type="button" id="pbCancelBtn2" class="btn-secondary">Cancel</button>
                    <button type="submit" class="btn-primary" id="pbSaveBtn">Save Application</button>
                </div>
            </form>
        `;

        // State for line items (mutable)
        let currentLineItems = lineItems.slice();

        const refreshTable = () => {
            document.getElementById('pbLineItemsWrapper').innerHTML = renderLineItemsTable(currentLineItems);
            bindTableEvents();
        };

        const bindTableEvents = () => {
            document.getElementById('pbAddLineBtn').onclick = () => {
                currentLineItems.push({ id: 'li_' + Date.now(), description: '', scheduledValue: 0, previousPercent: 0, thisPeriodPercent: 0 });
                refreshTable();
            };

            container.querySelectorAll('.li-remove-btn').forEach(btn => {
                btn.onclick = () => {
                    const idx = parseInt(btn.dataset.idx);
                    currentLineItems.splice(idx, 1);
                    if (currentLineItems.length === 0) {
                        currentLineItems.push({ id: 'li_' + Date.now(), description: '', scheduledValue: 0, previousPercent: 0, thisPeriodPercent: 0 });
                    }
                    refreshTable();
                };
            });

            const recalcRow = (idx) => {
                const sv = parseFloat(container.querySelector(`.li-sv[data-idx="${idx}"]`).value) || 0;
                const prev = parseFloat(container.querySelector(`.li-prev[data-idx="${idx}"]`).value) || 0;
                const thisPeriod = parseFloat(container.querySelector(`.li-this[data-idx="${idx}"]`).value) || 0;
                const total = Math.min(100, prev + thisPeriod);
                const balance = sv * (1 - total / 100);
                const totalPctEl = container.querySelector(`.li-total-pct[data-idx="${idx}"]`);
                const balanceEl = container.querySelector(`.li-balance[data-idx="${idx}"]`);
                if (totalPctEl) totalPctEl.textContent = total.toFixed(1) + '%';
                if (balanceEl) balanceEl.textContent = self._formatCurrency(balance);

                // Update footer totals
                let totalSV = 0, totalCompleted = 0, totalBalance = 0;
                container.querySelectorAll('.li-sv').forEach((inp, i) => {
                    const s = parseFloat(inp.value) || 0;
                    const p = parseFloat(container.querySelectorAll('.li-prev')[i].value) || 0;
                    const t = parseFloat(container.querySelectorAll('.li-this')[i].value) || 0;
                    const tot = Math.min(100, p + t);
                    totalSV += s;
                    totalCompleted += s * tot / 100;
                    totalBalance += s * (1 - tot / 100);
                });
                const totalSVEl = document.getElementById('pbTotalSV');
                const totalPctEl2 = document.getElementById('pbTotalPct');
                const totalBalEl = document.getElementById('pbTotalBalance');
                if (totalSVEl) totalSVEl.textContent = self._formatCurrency(totalSV);
                if (totalPctEl2) totalPctEl2.textContent = totalSV > 0 ? (totalCompleted / totalSV * 100).toFixed(1) + '%' : '0.0%';
                if (totalBalEl) totalBalEl.textContent = self._formatCurrency(totalBalance);
            };

            container.querySelectorAll('.li-sv, .li-prev, .li-this').forEach(inp => {
                inp.oninput = () => recalcRow(parseInt(inp.dataset.idx));
            });

            // Sync currentLineItems descriptions on input
            container.querySelectorAll('.li-desc').forEach(inp => {
                inp.oninput = () => { currentLineItems[parseInt(inp.dataset.idx)].description = inp.value; };
            });
        };

        bindTableEvents();

        document.getElementById('pbBackBtn').onclick = () => self._renderList();
        document.getElementById('pbCancelBtn2').onclick = () => self._renderList();

        document.getElementById('pbEditForm').onsubmit = (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('pbSaveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';

            try {
                // Collect line items from DOM
                const liDescs = container.querySelectorAll('.li-desc');
                const liSVs = container.querySelectorAll('.li-sv');
                const liPrevs = container.querySelectorAll('.li-prev');
                const liThis = container.querySelectorAll('.li-this');

                const savedLineItems = Array.from(liDescs).map((inp, i) => {
                    const sv = parseFloat(liSVs[i].value) || 0;
                    const prev = parseFloat(liPrevs[i].value) || 0;
                    const thisPeriod = parseFloat(liThis[i].value) || 0;
                    const total = Math.min(100, prev + thisPeriod);
                    return {
                        id: currentLineItems[i] ? currentLineItems[i].id : ('li_' + Date.now() + '_' + i),
                        description: inp.value,
                        scheduledValue: sv,
                        previousPercent: prev,
                        thisPeriodPercent: thisPeriod,
                        totalPercentComplete: total,
                        balanceToFinish: sv * (1 - total / 100)
                    };
                });

                const projectId = document.getElementById('pbProjectSel').value;
                const appNumber = app ? (app.applicationNumber || 1) : self._getAppNumber(projectId, id);

                const record = {
                    id: id,
                    projectId: projectId,
                    applicationNumber: appNumber,
                    billingPeriodStart: document.getElementById('pbPeriodStart').value,
                    billingPeriodEnd: document.getElementById('pbPeriodEnd').value,
                    retainagePercent: parseFloat(document.getElementById('pbRetainage').value) || 10,
                    status: document.getElementById('pbStatus').value,
                    notes: document.getElementById('pbNotes').value,
                    lineItems: savedLineItems,
                    created_at: app ? app.created_at : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                AppData.save('billing_applications', record);
                Utils.showToast(isNew ? 'Application created' : 'Application updated', 'success');
                self._renderList();
            } catch (err) {
                console.error('Save failed:', err);
                Utils.showToast('Failed to save: ' + err.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Application';
            }
        };
    }
};
