// AP/AR Tracking — LedgerMan Admin Module
window.AdminApArTracking = {
    _container: null,
    _activeTab: 'All',
    _filterStatus: 'All',

    render(container, params) {
        const self = this;
        self._container = container;
        if (params && params.tab) self._activeTab = params.tab;
        self._renderList();
    },

    _statusColor(status) {
        return {
            'Draft': '#6c757d',
            'Open': '#0d6efd',
            'Partially Paid': '#fd7e14',
            'Paid': '#198754',
            'Overdue': '#dc3545',
            'Void': '#adb5bd'
        }[status] || '#6c757d';
    },

    _formatCurrency(n) {
        return '$' + parseFloat(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    _isOverdue(entry) {
        if (!entry.dueDate) return false;
        if (entry.status === 'Paid' || entry.status === 'Void') return false;
        return new Date(entry.dueDate) < new Date(new Date().toDateString());
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const allEntries = AppData.getAll('ap_ar_entries');
        const today = new Date(new Date().toDateString());

        const tabs = ['All', 'Accounts Payable (AP)', 'Accounts Receivable (AR)'];

        const tabFilter = (entry) => {
            if (self._activeTab === 'Accounts Payable (AP)') return entry.type === 'AP';
            if (self._activeTab === 'Accounts Receivable (AR)') return entry.type === 'AR';
            return true;
        };

        const statusFilter = (entry) => {
            if (self._filterStatus === 'All') return true;
            return entry.status === self._filterStatus;
        };

        const filtered = allEntries.filter(e => tabFilter(e) && statusFilter(e));

        // Summary stats
        const totalReceivable = allEntries.filter(e => e.type === 'AR' && (e.status === 'Open' || e.status === 'Partially Paid'))
            .reduce((s, e) => s + (parseFloat(e.amount) || 0) - (parseFloat(e.paidAmount) || 0), 0);
        const totalPayable = allEntries.filter(e => e.type === 'AP' && (e.status === 'Open' || e.status === 'Partially Paid'))
            .reduce((s, e) => s + (parseFloat(e.amount) || 0) - (parseFloat(e.paidAmount) || 0), 0);
        const overdueCount = allEntries.filter(e => self._isOverdue(e)).length;

        const statuses = ['All', 'Draft', 'Open', 'Partially Paid', 'Paid', 'Overdue', 'Void'];

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
                    <h2 style="margin:0">AP/AR Tracking</h2>
                    <button class="btn-primary" id="aparNewBtn">+ Add Entry</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Manage accounts payable and receivable across all projects</p>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid #198754">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;margin-bottom:6px">Total Receivable (AR)</div>
                    <div style="font-size:1.5rem;font-weight:700;color:#198754">${self._formatCurrency(totalReceivable)}</div>
                    <div style="font-size:.75rem;color:var(--text2);margin-top:4px">Open + Partially Paid</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid #fd7e14">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;margin-bottom:6px">Total Payable (AP)</div>
                    <div style="font-size:1.5rem;font-weight:700;color:#fd7e14">${self._formatCurrency(totalPayable)}</div>
                    <div style="font-size:.75rem;color:var(--text2);margin-top:4px">Open + Partially Paid</div>
                </div>
                <div style="padding:16px;background:var(--card);border-radius:8px;border:1px solid ${overdueCount > 0 ? '#dc3545' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;margin-bottom:6px">Overdue Count</div>
                    <div style="font-size:1.8rem;font-weight:700;color:${overdueCount > 0 ? '#dc3545' : 'var(--text-primary)'}">${overdueCount}</div>
                </div>
            </div>

            <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px">
                ${tabs.map(tab => `
                    <button class="aparTab" data-tab="${tab}" style="padding:8px 16px;background:none;border:none;border-bottom:2px solid ${self._activeTab === tab ? 'var(--primary)' : 'transparent'};color:${self._activeTab === tab ? 'var(--primary)' : 'var(--text2)'};font-weight:${self._activeTab === tab ? '600' : '400'};cursor:pointer;margin-bottom:-2px;font-size:.9rem;transition:color .15s">
                        ${Utils.escapeHtml(tab)}
                    </button>
                `).join('')}
            </div>

            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
                <div>
                    <label style="display:block;font-size:.82rem;color:var(--text2);margin-bottom:4px">Status</label>
                    <select id="aparStatusFilter" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:12px;text-align:center;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Type</th>
                            <th style="padding:12px;text-align:left;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Vendor / Customer</th>
                            <th style="padding:12px;text-align:left;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Invoice #</th>
                            <th style="padding:12px;text-align:left;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Project</th>
                            <th style="padding:12px;text-align:right;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Amount</th>
                            <th style="padding:12px;text-align:right;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Paid</th>
                            <th style="padding:12px;text-align:right;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Balance Due</th>
                            <th style="padding:12px;text-align:left;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Due Date</th>
                            <th style="padding:12px;text-align:center;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Status</th>
                            <th style="padding:12px;text-align:center;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length === 0 ? `
                            <tr><td colspan="10" style="padding:40px;text-align:center;color:var(--text2)">
                                No entries found. Click "+ Add Entry" to get started.
                            </td></tr>
                        ` : filtered.map(entry => {
                            const proj = projects.find(p => p.id === entry.projectId);
                            const amount = parseFloat(entry.amount) || 0;
                            const paid = parseFloat(entry.paidAmount) || 0;
                            const balance = Math.max(0, amount - paid);
                            const overdue = self._isOverdue(entry);
                            const typeColor = entry.type === 'AP' ? '#fd7e14' : '#198754';
                            const rowStyle = overdue ? 'border-left:3px solid #dc3545' : 'border-left:3px solid transparent';
                            return `
                                <tr style="${rowStyle};border-bottom:1px solid var(--border)">
                                    <td style="padding:12px;text-align:center">
                                        <span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${typeColor};color:white">${Utils.escapeHtml(entry.type || 'AP')}</span>
                                    </td>
                                    <td style="padding:12px">
                                        <strong>${Utils.escapeHtml(entry.vendorOrCustomer || '—')}</strong>
                                        ${entry.description ? `<div style="font-size:.8rem;color:var(--text2);margin-top:2px">${Utils.escapeHtml(entry.description)}</div>` : ''}
                                    </td>
                                    <td style="padding:12px;font-size:.88rem">${Utils.escapeHtml(entry.invoiceNumber || '—')}</td>
                                    <td style="padding:12px;font-size:.88rem">${Utils.escapeHtml(proj ? proj.name : '—')}</td>
                                    <td style="padding:12px;text-align:right;font-weight:600">${self._formatCurrency(amount)}</td>
                                    <td style="padding:12px;text-align:right;color:#198754">${self._formatCurrency(paid)}</td>
                                    <td style="padding:12px;text-align:right;font-weight:600;color:${balance > 0 ? '#fd7e14' : 'var(--text2)'}">${self._formatCurrency(balance)}</td>
                                    <td style="padding:12px;font-size:.88rem${overdue ? ';color:#dc3545;font-weight:600' : ''}">
                                        ${entry.dueDate ? Utils.escapeHtml(entry.dueDate) : '—'}
                                        ${overdue ? ' <span style="font-size:.7rem">OVERDUE</span>' : ''}
                                    </td>
                                    <td style="padding:12px;text-align:center">
                                        <span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${self._statusColor(entry.status)};color:white">
                                            ${Utils.escapeHtml(entry.status || 'Open')}
                                        </span>
                                    </td>
                                    <td style="padding:12px;text-align:center;white-space:nowrap">
                                        <button class="btn-secondary btn-sm" data-id="${entry.id}" data-action="edit">Edit</button>
                                        <button class="btn-secondary btn-sm" data-id="${entry.id}" data-action="delete" style="margin-left:4px">Delete</button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('aparNewBtn').onclick = () => self._showForm(null);
        document.getElementById('aparStatusFilter').onchange = e => { self._filterStatus = e.target.value; self._renderList(); };

        container.querySelectorAll('.aparTab').forEach(btn => {
            btn.onclick = () => { self._activeTab = btn.dataset.tab; self._filterStatus = 'All'; self._renderList(); };
        });
        container.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = () => self._showForm(btn.dataset.id);
        });
        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this AP/AR entry? This cannot be undone.')) {
                    AppData.remove('ap_ar_entries', btn.dataset.id);
                    Utils.showToast('Entry deleted', 'success');
                    self._renderList();
                }
            };
        });
    },

    _showForm(entryId) {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const allEntries = AppData.getAll('ap_ar_entries');
        const entry = entryId ? allEntries.find(e => e.id === entryId) : null;
        const isNew = !entry;
        const id = entry ? entry.id : ('apar_' + Date.now());

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';
        overlay.innerHTML = `
            <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;width:100%;max-width:580px;max-height:90vh;overflow-y:auto;padding:24px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                    <h3 style="margin:0">${isNew ? 'Add AP/AR Entry' : 'Edit Entry'}</h3>
                    <button id="aparFormClose" style="background:none;border:none;color:var(--text2);font-size:1.4rem;cursor:pointer;line-height:1">&times;</button>
                </div>
                <form id="aparForm">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Type *</label>
                            <select id="aparType" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                                <option value="AP" ${(entry ? entry.type : 'AP') === 'AP' ? 'selected' : ''}>AP — Accounts Payable</option>
                                <option value="AR" ${(entry ? entry.type : '') === 'AR' ? 'selected' : ''}>AR — Accounts Receivable</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Project</label>
                            <select id="aparProject" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                <option value="">— None —</option>
                                ${projects.map(p => `<option value="${p.id}" ${(entry && entry.projectId === p.id) ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div style="margin-bottom:14px">
                        <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Vendor / Customer *</label>
                        <input type="text" id="aparVendor" value="${entry ? Utils.escapeHtml(entry.vendorOrCustomer || '') : ''}"
                            placeholder="e.g., ABC Supplies Inc." required
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Invoice #</label>
                            <input type="text" id="aparInvoiceNum" value="${entry ? Utils.escapeHtml(entry.invoiceNumber || '') : ''}"
                                placeholder="INV-0001"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Status</label>
                            <select id="aparStatus" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                ${['Draft','Open','Partially Paid','Paid','Overdue','Void'].map(s => `<option value="${s}" ${(entry ? entry.status : 'Open') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div style="margin-bottom:14px">
                        <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Description</label>
                        <input type="text" id="aparDesc" value="${entry ? Utils.escapeHtml(entry.description || '') : ''}"
                            placeholder="Invoice description…"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Amount ($) *</label>
                            <input type="number" id="aparAmount" value="${entry ? (parseFloat(entry.amount) || 0).toFixed(2) : '0.00'}"
                                min="0" step="0.01" required
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Paid Amount ($)</label>
                            <input type="number" id="aparPaidAmount" value="${entry ? (parseFloat(entry.paidAmount) || 0).toFixed(2) : '0.00'}"
                                min="0" step="0.01"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Due Date</label>
                            <input type="date" id="aparDueDate" value="${entry ? (entry.dueDate || '') : ''}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                        <div>
                            <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Paid Date</label>
                            <input type="date" id="aparPaidDate" value="${entry ? (entry.paidDate || '') : ''}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        </div>
                    </div>
                    <div style="margin-bottom:20px">
                        <label style="display:block;font-size:.85rem;font-weight:500;margin-bottom:6px">Notes</label>
                        <textarea id="aparNotes" rows="3" placeholder="Additional notes…"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;resize:vertical">${entry ? Utils.escapeHtml(entry.notes || '') : ''}</textarea>
                    </div>
                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="aparFormCancel" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary" id="aparSaveBtn">Save Entry</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => document.body.removeChild(overlay);
        document.getElementById('aparFormClose').onclick = close;
        document.getElementById('aparFormCancel').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };

        document.getElementById('aparForm').onsubmit = (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('aparSaveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
            try {
                const record = {
                    id: id,
                    type: document.getElementById('aparType').value,
                    projectId: document.getElementById('aparProject').value,
                    vendorOrCustomer: document.getElementById('aparVendor').value,
                    invoiceNumber: document.getElementById('aparInvoiceNum').value,
                    description: document.getElementById('aparDesc').value,
                    amount: parseFloat(document.getElementById('aparAmount').value) || 0,
                    dueDate: document.getElementById('aparDueDate').value,
                    paidDate: document.getElementById('aparPaidDate').value,
                    status: document.getElementById('aparStatus').value,
                    paidAmount: parseFloat(document.getElementById('aparPaidAmount').value) || 0,
                    notes: document.getElementById('aparNotes').value,
                    created_at: entry ? entry.created_at : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                AppData.save('ap_ar_entries', record);
                Utils.showToast(isNew ? 'Entry created' : 'Entry updated', 'success');
                close();
                self._renderList();
            } catch (err) {
                console.error('Save failed:', err);
                Utils.showToast('Failed to save: ' + err.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Entry';
            }
        };
    }
};
