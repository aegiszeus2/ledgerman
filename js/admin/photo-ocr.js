// Admin Photo OCR Module
// View and manually manage OCR text extraction records; link to expense records.

window.AdminPhotoOcr = {
    _filterProject: 'All',
    _filterStatus: 'All',

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
        const allRecords = AppData.getAll ? AppData.getAll('photo_ocr_records') : [];

        const totalCount = allRecords.length;
        const pendingCount = allRecords.filter(r => r.status === 'Pending').length;
        const linkedCount = allRecords.filter(r => r.status === 'Linked' || (r.linkedExpenseId && r.linkedExpenseId.trim())).length;

        const statuses = ['All', 'Pending', 'Reviewed', 'Linked', 'Archived'];

        const filtered = allRecords.filter(r => {
            const projMatch = self._filterProject === 'All' || r.projectId === self._filterProject;
            const statusMatch = self._filterStatus === 'All' || r.status === self._filterStatus;
            return projMatch && statusMatch;
        }).sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));

        const projectMap = {};
        projects.forEach(p => { projectMap[p.id] = p.name; });

        const statusColors = {
            Pending: '#fd7e14',
            Reviewed: '#0d6efd',
            Linked: '#198754',
            Archived: '#6c757d'
        };

        function statusBadge(status) {
            const color = statusColors[status] || '#6c757d';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${color};color:white">${esc(status || 'Pending')}</span>`;
        }

        function fmtAmount(val) {
            const n = parseFloat(val);
            return isNaN(n) ? '—' : '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h2 style="margin:0">Photo OCR</h2>
                    <button class="btn-primary" id="ocrAddBtn">+ New OCR Record</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Extract and manage text from receipt and document photos.</p>
            </div>

            <!-- Info Banner -->
            <div style="padding:12px 16px;background:rgba(13,110,253,.1);border:1px solid rgba(13,110,253,.35);border-radius:8px;margin-bottom:20px;font-size:.9rem;color:var(--text-primary)">
                <strong style="color:#4d9fff">OCR Text Extraction:</strong> Upload a photo or enter extracted text manually. Automatic AI OCR is available when enabled. Link extracted data to expense records.
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Total Records</div>
                    <div style="font-size:1.7rem;font-weight:700;color:var(--text-primary)">${totalCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid ${pendingCount > 0 ? '#fd7e14' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Pending Review</div>
                    <div style="font-size:1.7rem;font-weight:700;color:${pendingCount > 0 ? '#fd7e14' : 'var(--text-primary)'}">${pendingCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Linked to Expenses</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#198754">${linkedCount}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                    <select id="ocrFilterProject" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Status</label>
                    <select id="ocrFilterStatus" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse;font-size:.9rem">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Date</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Project</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Description</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Status</th>
                            <th style="padding:11px 14px;text-align:right;border-bottom:2px solid var(--border)">Amount</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Vendor</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Linked Expense</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(r => {
                            const proj = projectMap[r.projectId] || (r.projectId || '—');
                            return `<tr style="border-bottom:1px solid var(--border)">
                                <td style="padding:10px 14px;white-space:nowrap">${esc(r.date || '—')}</td>
                                <td style="padding:10px 14px">${esc(proj)}</td>
                                <td style="padding:10px 14px">
                                    <strong>${esc(r.photoDescription || '—')}</strong>
                                    ${r.ocrText ? `<div style="font-size:.78rem;color:var(--text2);margin-top:2px;max-width:220px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(r.ocrText.slice(0, 80))}${r.ocrText.length > 80 ? '…' : ''}</div>` : ''}
                                </td>
                                <td style="padding:10px 14px;text-align:center">${statusBadge(r.status)}</td>
                                <td style="padding:10px 14px;text-align:right">${fmtAmount(r.extractedAmount)}</td>
                                <td style="padding:10px 14px">${esc(r.extractedVendor || '—')}</td>
                                <td style="padding:10px 14px">
                                    ${r.linkedExpenseId ? `<span style="font-size:.82rem;font-family:monospace;color:#4d9fff">${esc(r.linkedExpenseId)}</span>` : '<span style="color:var(--text2);font-size:.82rem">—</span>'}
                                </td>
                                <td style="padding:10px 14px;text-align:center;white-space:nowrap">
                                    <button class="btn-secondary btn-sm" data-id="${esc(r.id)}" data-action="edit" style="font-size:.75rem">Edit</button>
                                    <button class="btn-secondary btn-sm" data-id="${esc(r.id)}" data-action="delete" style="font-size:.75rem;margin-left:4px">Delete</button>
                                </td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="8" style="padding:36px;text-align:center;color:var(--text2)">No OCR records found${allRecords.length > 0 ? ' matching your filters' : '. Create a new record to get started.'}.</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('ocrFilterProject').onchange = e => { self._filterProject = e.target.value; self._renderList(); };
        document.getElementById('ocrFilterStatus').onchange = e => { self._filterStatus = e.target.value; self._renderList(); };
        document.getElementById('ocrAddBtn').onclick = () => self._showForm(null);

        container.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = () => self._showForm(btn.dataset.id);
        });
        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this OCR record? This action cannot be undone.')) {
                    AppData.remove('photo_ocr_records', btn.dataset.id);
                    Utils.showToast('OCR record deleted', 'success');
                    self._renderList();
                }
            };
        });
    },

    _showForm(recordId) {
        const self = this;
        const container = self._container;
        const esc = Utils.escapeHtml;
        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allRecords = AppData.getAll ? AppData.getAll('photo_ocr_records') : [];
        const rec = recordId ? allRecords.find(r => r.id === recordId) : null;
        const isNew = !rec;

        const today = new Date().toISOString().slice(0, 10);
        const statuses = ['Pending', 'Reviewed', 'Linked', 'Archived'];

        function val(field, fallback) {
            return rec ? (rec[field] != null ? rec[field] : (fallback || '')) : (fallback || '');
        }

        container.innerHTML = `
            <div style="max-width:640px;margin:0 auto">
                <h2 style="margin-bottom:20px">${isNew ? 'New OCR Record' : 'Edit OCR Record'}</h2>
                <form id="ocrForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px">

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Project</label>
                            <select id="ocrProject" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                <option value="">-- No Project --</option>
                                ${projects.map(p => `<option value="${p.id}" ${val('projectId') === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Date *</label>
                            <input type="date" id="ocrDate" value="${esc(val('date', today))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Photo Description *</label>
                        <input type="text" id="ocrDesc" value="${esc(val('photoDescription'))}" placeholder="e.g. Home Depot receipt — lumber, May 2026"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">OCR Text</label>
                        <textarea id="ocrText" placeholder="Enter extracted text from receipt/document..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:130px;resize:vertical;font-family:monospace">${esc(val('ocrText'))}</textarea>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Extracted Amount ($)</label>
                            <input type="number" id="ocrAmount" step="0.01" min="0" value="${val('extractedAmount')}" placeholder="e.g. 245.99"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Extracted Vendor</label>
                            <input type="text" id="ocrVendor" value="${esc(val('extractedVendor'))}" placeholder="e.g. Home Depot #1234"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Link to Expense (Expense ID or Invoice Ref, optional)</label>
                        <input type="text" id="ocrLinkedExpense" value="${esc(val('linkedExpenseId'))}" placeholder="e.g. exp_1234567890 or INV-2026-042"
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Status</label>
                        <select id="ocrStatus" style="width:220px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                            ${statuses.map(s => `<option value="${s}" ${val('status', 'Pending') === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>

                    <div style="margin-bottom:20px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Notes</label>
                        <textarea id="ocrNotes" placeholder="Additional notes..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:60px;resize:vertical">${esc(val('notes'))}</textarea>
                    </div>

                    <!-- Note -->
                    <div style="padding:10px 14px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;font-size:.82rem;color:var(--text2);margin-bottom:20px">
                        Automatic OCR extraction requires an active AI/OCR integration. Manual text entry is always available.
                    </div>

                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="ocrCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">${isNew ? 'Create Record' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('ocrCancelBtn').onclick = () => self._renderList();

        document.getElementById('ocrForm').onsubmit = e => {
            e.preventDefault();
            const now = new Date().toISOString();
            const amountRaw = document.getElementById('ocrAmount').value;
            const linkedExpense = document.getElementById('ocrLinkedExpense').value.trim();
            const statusVal = document.getElementById('ocrStatus').value;

            // Auto-promote to Linked if an expense ID is entered and status is Pending/Reviewed
            const resolvedStatus = (linkedExpense && (statusVal === 'Pending' || statusVal === 'Reviewed')) ? 'Linked' : statusVal;

            const record = {
                id: rec ? rec.id : ('ocr_' + Date.now()),
                photoId: rec ? (rec.photoId || null) : null,
                projectId: document.getElementById('ocrProject').value || null,
                date: document.getElementById('ocrDate').value,
                photoDescription: document.getElementById('ocrDesc').value.trim(),
                ocrText: document.getElementById('ocrText').value.trim(),
                extractedAmount: amountRaw !== '' ? parseFloat(amountRaw) : null,
                extractedVendor: document.getElementById('ocrVendor').value.trim(),
                linkedExpenseId: linkedExpense || null,
                status: resolvedStatus,
                notes: document.getElementById('ocrNotes').value.trim(),
                created_at: rec ? rec.created_at : now,
                updated_at: now
            };

            AppData.save('photo_ocr_records', record);
            Utils.showToast(isNew ? 'OCR record created' : 'OCR record updated', 'success');
            self._renderList();
        };
    }
};
