// Admin Subcontractor Management Module
// Track subcontractors, their trades, insurance/WSIB expiries, and contract values.

window.AdminSubcontractorMgmt = {
    _filterProject: 'All',
    _filterStatus: 'All',
    _filterTrade: 'All',

    render(container) {
        const self = this;
        self._container = container;
        self._renderList();
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const esc = Utils.escapeHtml;

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allSubs = AppData.getAll ? AppData.getAll('subcontractors') : [];

        const today = new Date().toISOString().slice(0, 10);
        const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        // Summary counts
        const totalCount = allSubs.length;
        const activeCount = allSubs.filter(s => s.status === 'Active').length;
        const insExpiring = allSubs.filter(s => s.insuranceExpiry && s.insuranceExpiry >= today && s.insuranceExpiry <= in30).length;
        const wsibExpiring = allSubs.filter(s => s.wsibExpiry && s.wsibExpiry >= today && s.wsibExpiry <= in30).length;

        // Derive unique trades for filter
        const tradeSet = new Set();
        allSubs.forEach(s => { if (s.trade) tradeSet.add(s.trade); });
        const tradeOptions = Array.from(tradeSet).sort();

        // Apply filters
        const filtered = allSubs.filter(s => {
            const projMatch = self._filterProject === 'All' || s.projectId === self._filterProject;
            const statusMatch = self._filterStatus === 'All' || s.status === self._filterStatus;
            const tradeMatch = self._filterTrade === 'All' || s.trade === self._filterTrade;
            return projMatch && statusMatch && tradeMatch;
        }).sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));

        const projectMap = {};
        projects.forEach(p => { projectMap[p.id] = p.name; });

        const statuses = ['Active', 'Pending', 'Expired', 'Suspended', 'Closed'];
        const statusColors = { Active: '#198754', Pending: '#fd7e14', Expired: '#dc3545', Suspended: '#6c757d', Closed: '#495057' };

        function statusBadge(status) {
            const color = statusColors[status] || '#6c757d';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${color};color:white">${esc(status || '—')}</span>`;
        }

        function fmtCurrency(val) {
            const n = parseFloat(val);
            return isNaN(n) ? '—' : '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        function expiryStyle(dateStr) {
            if (!dateStr) return 'color:var(--text2)';
            if (dateStr < today) return 'color:#dc3545;font-weight:700';
            if (dateStr <= in30) return 'color:#fd7e14;font-weight:700';
            return '';
        }

        function expiryLabel(dateStr) {
            if (!dateStr) return '—';
            if (dateStr < today) return `${esc(dateStr)} ⚠ Expired`;
            if (dateStr <= in30) return `${esc(dateStr)} ⚠ Soon`;
            return esc(dateStr);
        }

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h2 style="margin:0">Subcontractor Management</h2>
                    <button class="btn-primary" id="subAddBtn">+ Add Subcontractor</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Manage subcontractors, compliance documents, and contract details.</p>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Total Subs</div>
                    <div style="font-size:1.7rem;font-weight:700;color:var(--text-primary)">${totalCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Active</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#198754">${activeCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid ${insExpiring > 0 ? '#fd7e14' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Insurance Expiring ${insExpiring > 0 ? '⚠' : ''}</div>
                    <div style="font-size:1.7rem;font-weight:700;color:${insExpiring > 0 ? '#fd7e14' : 'var(--text-primary)'}">${insExpiring}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid ${wsibExpiring > 0 ? '#fd7e14' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">WSIB Expiring ${wsibExpiring > 0 ? '⚠' : ''}</div>
                    <div style="font-size:1.7rem;font-weight:700;color:${wsibExpiring > 0 ? '#fd7e14' : 'var(--text-primary)'}">${wsibExpiring}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                    <select id="subFilterProject" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Status</label>
                    <select id="subFilterStatus" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Statuses</option>
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Trade</label>
                    <select id="subFilterTrade" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Trades</option>
                        ${tradeOptions.map(t => `<option value="${esc(t)}" ${self._filterTrade === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse;font-size:.9rem">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Company</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Contact</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Trade</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Project</th>
                            <th style="padding:11px 14px;text-align:right;border-bottom:2px solid var(--border)">Contract Value</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Status</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Insurance Expiry</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">WSIB Expiry</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(s => {
                            const projName = projectMap[s.projectId] || (s.projectId ? s.projectId : '—');
                            return `<tr style="border-bottom:1px solid var(--border)">
                                <td style="padding:10px 14px">
                                    <strong>${esc(s.companyName || '—')}</strong>
                                    ${s.phone ? `<div style="font-size:.8rem;color:var(--text2)">${esc(s.phone)}</div>` : ''}
                                </td>
                                <td style="padding:10px 14px">
                                    ${esc(s.contactName || '—')}
                                    ${s.email ? `<div style="font-size:.8rem;color:var(--text2)">${esc(s.email)}</div>` : ''}
                                </td>
                                <td style="padding:10px 14px">${esc(s.trade || '—')}</td>
                                <td style="padding:10px 14px">${esc(projName)}</td>
                                <td style="padding:10px 14px;text-align:right">${fmtCurrency(s.contractValue)}</td>
                                <td style="padding:10px 14px;text-align:center">${statusBadge(s.status)}</td>
                                <td style="padding:10px 14px;font-size:.85rem;${expiryStyle(s.insuranceExpiry)}">${expiryLabel(s.insuranceExpiry)}</td>
                                <td style="padding:10px 14px;font-size:.85rem;${expiryStyle(s.wsibExpiry)}">${expiryLabel(s.wsibExpiry)}</td>
                                <td style="padding:10px 14px;text-align:center;white-space:nowrap">
                                    <button class="btn-secondary btn-sm" data-id="${esc(s.id)}" data-action="edit" style="font-size:.75rem">Edit</button>
                                    <button class="btn-secondary btn-sm" data-id="${esc(s.id)}" data-action="delete" style="font-size:.75rem;margin-left:4px">Delete</button>
                                </td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="9" style="padding:36px;text-align:center;color:var(--text2)">No subcontractors found${allSubs.length > 0 ? ' matching your filters' : '. Add your first subcontractor to get started.'}.</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('subFilterProject').onchange = e => { self._filterProject = e.target.value; self._renderList(); };
        document.getElementById('subFilterStatus').onchange = e => { self._filterStatus = e.target.value; self._renderList(); };
        document.getElementById('subFilterTrade').onchange = e => { self._filterTrade = e.target.value; self._renderList(); };

        document.getElementById('subAddBtn').onclick = () => self._showForm(null);

        container.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = () => self._showForm(btn.dataset.id);
        });

        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this subcontractor? This action cannot be undone.')) {
                    AppData.remove('subcontractors', btn.dataset.id);
                    Utils.showToast('Subcontractor deleted', 'success');
                    self._renderList();
                }
            };
        });
    },

    _showForm(subId) {
        const self = this;
        const container = self._container;
        const esc = Utils.escapeHtml;
        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allSubs = AppData.getAll ? AppData.getAll('subcontractors') : [];
        const sub = subId ? allSubs.find(s => s.id === subId) : null;
        const isNew = !sub;

        const statuses = ['Active', 'Pending', 'Expired', 'Suspended', 'Closed'];

        function val(field, fallback) {
            return sub ? (sub[field] != null ? sub[field] : (fallback || '')) : (fallback || '');
        }

        container.innerHTML = `
            <div style="max-width:660px;margin:0 auto">
                <h2 style="margin-bottom:20px">${isNew ? 'Add Subcontractor' : 'Edit Subcontractor'}</h2>
                <form id="subForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px">

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Company Name *</label>
                            <input type="text" id="subCompanyName" value="${esc(val('companyName'))}" placeholder="e.g. ABC Electric Inc."
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Contact Name</label>
                            <input type="text" id="subContactName" value="${esc(val('contactName'))}" placeholder="e.g. John Smith"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Phone</label>
                            <input type="tel" id="subPhone" value="${esc(val('phone'))}" placeholder="e.g. (416) 555-0100"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Email</label>
                            <input type="email" id="subEmail" value="${esc(val('email'))}" placeholder="e.g. contact@abcelectric.com"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Trade</label>
                            <input type="text" id="subTrade" value="${esc(val('trade'))}" placeholder="e.g. Electrical, Plumbing, Roofing"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Status</label>
                            <select id="subStatus" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                ${statuses.map(s => `<option value="${s}" ${val('status', 'Active') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Scope of Work</label>
                        <textarea id="subScope" placeholder="Describe the work scope for this subcontractor..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:70px;resize:vertical">${esc(val('scope'))}</textarea>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Project (optional)</label>
                            <select id="subProject" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                <option value="">-- No Specific Project --</option>
                                ${projects.map(p => `<option value="${p.id}" ${val('projectId') === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Contract Value (optional)</label>
                            <input type="number" id="subContractValue" step="0.01" min="0" value="${val('contractValue')}"
                                placeholder="e.g. 45000"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Insurance Expiry (expiry date)</label>
                            <input type="date" id="subInsuranceExpiry" value="${esc(val('insuranceExpiry'))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">WSIB Expiry (expiry date)</label>
                            <input type="date" id="subWsibExpiry" value="${esc(val('wsibExpiry'))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                    </div>

                    <div style="margin-bottom:20px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Notes</label>
                        <textarea id="subNotes" placeholder="Additional notes..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:70px;resize:vertical">${esc(val('notes'))}</textarea>
                    </div>

                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="subCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">${isNew ? 'Add Subcontractor' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('subCancelBtn').onclick = () => self._renderList();

        document.getElementById('subForm').onsubmit = e => {
            e.preventDefault();
            const now = new Date().toISOString();
            const cvRaw = document.getElementById('subContractValue').value;
            const record = {
                id: sub ? sub.id : ('sub_' + Date.now()),
                companyName: document.getElementById('subCompanyName').value.trim(),
                contactName: document.getElementById('subContactName').value.trim(),
                phone: document.getElementById('subPhone').value.trim(),
                email: document.getElementById('subEmail').value.trim(),
                trade: document.getElementById('subTrade').value.trim(),
                scope: document.getElementById('subScope').value.trim(),
                projectId: document.getElementById('subProject').value || null,
                contractValue: cvRaw !== '' ? parseFloat(cvRaw) : null,
                status: document.getElementById('subStatus').value,
                insuranceExpiry: document.getElementById('subInsuranceExpiry').value || null,
                wsibExpiry: document.getElementById('subWsibExpiry').value || null,
                notes: document.getElementById('subNotes').value.trim(),
                created_at: sub ? sub.created_at : now,
                updated_at: now
            };

            AppData.save('subcontractors', record);
            Utils.showToast(isNew ? 'Subcontractor added' : 'Subcontractor updated', 'success');
            self._renderList();
        };
    }
};
