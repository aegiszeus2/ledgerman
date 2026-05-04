// Admin Bid Estimates Module
window.AdminEstimates = {
    _statusFilter: 'All',
    _viewingEstimateId: null,

    render(container, params) {
        const self = this;
        self._container = container;
        if (params && params.estimateId) {
            self._viewingEstimateId = params.estimateId;
        }
        if (self._viewingEstimateId) {
            self._renderDetail();
        } else {
            self._renderList();
        }
    },

    renderDetail(container, estimateId, params) {
        this._container = container;
        this._viewingEstimateId = estimateId;
        this._renderDetail();
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const estimates = AppData.getEstimates();
        const filter = self._statusFilter;
        const filtered = filter === 'All' ? estimates : estimates.filter(e => e.status === filter);
        const statuses = ['All', 'draft', 'sent', 'approved'];

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                <h2>Bid Estimates</h2>
                <button class="btn-primary" id="addEstimateBtn">+ New Estimate</button>
            </div>

            <div class="tabs" style="margin-bottom:16px">
                ${statuses.map(s => {
                    const count = s === 'All' ? estimates.length : estimates.filter(e => e.status === s).length;
                    return `<button class="tab-btn${filter === s ? ' active' : ''}" data-status="${s}">${s === 'draft' ? 'Draft' : s === 'sent' ? 'Sent' : s === 'approved' ? 'Approved' : s} (${count})</button>`;
                }).join('')}
            </div>

            <div class="card">
                ${filtered.length === 0
                    ? '<div class="empty"><h3>No Estimates</h3><p>Create your first estimate to get started.</p></div>'
                    : `<table>
                        <thead><tr>
                            <th>Client</th>
                            <th>Description</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr></thead>
                        <tbody>${filtered.map(e => {
                            const statusClass = e.status === 'draft' ? 'draft-s' : (e.status === 'sent' ? 'sent-s' : 'approved-s');
                            return `<tr style="cursor:pointer" class="estimate-row" data-id="${e.id}">
                                <td><strong>${Utils.escapeHtml(e.clientName || 'Unnamed')}</strong></td>
                                <td>${Utils.escapeHtml(e.description || '—')}</td>
                                <td>$${(e.total || 0).toFixed(2)}</td>
                                <td><span class="pstatus ${statusClass}">${e.status}</span></td>
                                <td>${Utils.formatDate(e.created_at)}</td>
                                <td style="white-space:nowrap">
                                    <button class="btn-ghost btn-sm edit-estimate" data-id="${e.id}">Edit</button>
                                    <button class="btn-ghost btn-sm delete-estimate" data-id="${e.id}" style="color:var(--accent)">Delete</button>
                                </td>
                            </tr>`;
                        }).join('')}</tbody>
                    </table>`
                }
            </div>
        `;

        // Tab filtering
        container.querySelectorAll('.tab-btn[data-status]').forEach(tab => {
            tab.addEventListener('click', () => {
                self._statusFilter = tab.dataset.status;
                self._renderList();
            });
        });

        // Add new estimate
        container.querySelector('#addEstimateBtn').addEventListener('click', () => {
            self._showEstimateForm(null);
        });

        // Click row to view detail
        container.querySelectorAll('.estimate-row').forEach(row => {
            row.addEventListener('click', e => {
                if (e.target.closest('.edit-estimate') || e.target.closest('.delete-estimate')) return;
                self._viewingEstimateId = row.dataset.id;
                self._renderDetail();
            });
        });

        // Edit button
        container.querySelectorAll('.edit-estimate').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                self._showEstimateForm(btn.dataset.id);
            });
        });

        // Delete button
        container.querySelectorAll('.delete-estimate').forEach(btn => {
            btn.addEventListener('click', async e => {
                e.stopPropagation();
                const estimate = AppData.getEstimate(btn.dataset.id);
                if (!estimate) return;
                if (!await Utils.confirm(`Delete estimate for "${estimate.clientName || 'Unnamed'}"?`)) return;
                AppData.deleteEstimate(btn.dataset.id);
                Utils.showToast('Estimate deleted');
                self._renderList();
            });
        });
    },

    _renderDetail() {
        const self = this;
        const container = self._container;
        const estimate = AppData.getEstimate(self._viewingEstimateId);

        if (!estimate) {
            container.innerHTML = '<p class="text-muted">Estimate not found.</p>';
            return;
        }

        const esc = Utils.escapeHtml;
        const items = estimate.items || [];
        const total = estimate.total || 0;
        const subtotal = estimate.subtotal || 0;
        const tax = estimate.tax || 0;
        const canModify = estimate.status === 'draft';

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
                <h2>${esc(estimate.clientName || 'Unnamed Estimate')}</h2>
                <div style="display:flex;gap:8px">
                    <button class="btn-secondary btn-sm" id="backBtn">← Back</button>
                    ${canModify ? `<button class="btn-primary" id="editEstimateBtn">Edit Info</button>` : ''}
                    ${estimate.status === 'draft' ? `<button class="btn-success" id="sendEstimateBtn">Send</button>` : ''}
                    ${estimate.status === 'sent' ? `<button class="btn-success" id="approveEstimateBtn">Approve</button>` : ''}
                    ${estimate.status === 'approved' ? `<button class="btn-success" id="createProjectBtn">Create Project</button>` : ''}
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">
                <div class="card" style="padding:12px">
                    <p class="text-muted" style="margin:0;font-size:0.875rem">Status</p>
                    <p style="margin:0;font-size:1.25rem;font-weight:bold">${estimate.status}</p>
                </div>
                <div class="card" style="padding:12px">
                    <p class="text-muted" style="margin:0;font-size:0.875rem">Subtotal</p>
                    <p style="margin:0;font-size:1.25rem;font-weight:bold">$${subtotal.toFixed(2)}</p>
                </div>
                <div class="card" style="padding:12px">
                    <p class="text-muted" style="margin:0;font-size:0.875rem">Tax (${estimate.taxRate || 0}%)</p>
                    <p style="margin:0;font-size:1.25rem;font-weight:bold">$${tax.toFixed(2)}</p>
                </div>
                <div class="card" style="padding:12px;background:var(--primary-light)">
                    <p class="text-muted" style="margin:0;font-size:0.875rem">Total</p>
                    <p style="margin:0;font-size:1.25rem;font-weight:bold">$${total.toFixed(2)}</p>
                </div>
            </div>

            ${estimate.description ? `<div class="card" style="margin-bottom:16px"><p>${esc(estimate.description)}</p></div>` : ''}

            <div class="card">
                <h3 style="margin-top:0">Items & Costs</h3>
                <div id="itemsContainer" style="min-height:300px">
                    ${items.length === 0 ? '<p class="text-muted">No items yet.</p>' : ''}
                    ${items.map((item, idx) => self._renderItem(item, idx, canModify)).join('')}
                </div>
                ${canModify ? `<button class="btn-secondary" id="addItemBtn" style="margin-top:12px">+ Add Item</button>` : ''}
            </div>
        `;

        // Back button
        container.querySelector('#backBtn').addEventListener('click', () => {
            self._viewingEstimateId = null;
            self._renderList();
        });

        if (canModify) {
            container.querySelector('#editEstimateBtn').addEventListener('click', () => {
                self._showEstimateForm(self._viewingEstimateId);
            });

            container.querySelector('#addItemBtn').addEventListener('click', () => {
                self._showItemForm(self._viewingEstimateId, null);
            });
        }

        if (estimate.status === 'draft') {
            container.querySelector('#sendEstimateBtn').addEventListener('click', async () => {
                if (!await Utils.confirm('Send this estimate to the client?')) return;
                await self._sendEstimate(estimate.id);
                self._renderDetail();
            });
        }

        if (estimate.status === 'sent') {
            container.querySelector('#approveEstimateBtn').addEventListener('click', async () => {
                if (!await Utils.confirm('Approve this estimate?')) return;
                await self._approveEstimate(estimate.id);
                self._renderDetail();
            });
        }

        if (estimate.status === 'approved') {
            container.querySelector('#createProjectBtn').addEventListener('click', async () => {
                if (!await Utils.confirm('Create a project from this estimate?')) return;
                await self._createProjectFromEstimate(estimate.id);
            });
        }

        // Setup edit/delete handlers for items
        container.querySelectorAll('.item-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.dataset.itemId;
                self._showItemForm(self._viewingEstimateId, itemId);
            });
        });

        container.querySelectorAll('.item-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const itemId = btn.dataset.itemId;
                if (!await Utils.confirm('Delete this item?')) return;
                self._deleteItem(self._viewingEstimateId, itemId);
            });
        });

        container.querySelectorAll('.cost-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const itemId = btn.dataset.itemId;
                const subtaskId = btn.dataset.subtaskId;
                const costId = btn.dataset.costId;
                if (!await Utils.confirm('Delete this cost?')) return;
                self._deleteCost(self._viewingEstimateId, itemId, subtaskId, costId);
            });
        });

        container.querySelectorAll('.add-cost-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.dataset.itemId;
                const subtaskId = btn.dataset.subtaskId;
                self._showCostForm(self._viewingEstimateId, itemId, subtaskId, null);
            });
        });

        container.querySelectorAll('.cost-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.dataset.itemId;
                const subtaskId = btn.dataset.subtaskId;
                const costId = btn.dataset.costId;
                self._showCostForm(self._viewingEstimateId, itemId, subtaskId, costId);
            });
        });
    },

    _renderItem(item, idx, canModify) {
        const self = this;
        const esc = Utils.escapeHtml;
        const subtasks = item.subtasks || [];
        const itemTotal = (item.costs || []).reduce((sum, c) => sum + (c.amount || 0), 0) +
                         (subtasks || []).reduce((sum, st) => sum + ((st.costs || []).reduce((s, c) => s + (c.amount || 0), 0)), 0);

        return `
            <div class="item-container" data-item-id="${item.id}" style="margin-bottom:16px;padding:12px;border:1px solid var(--border);border-radius:4px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h4 style="margin:0">${esc(item.description || 'Item ' + (idx + 1))}</h4>
                    ${canModify ? `
                        <div style="display:flex;gap:8px">
                            <button class="btn-ghost btn-sm item-edit-btn" data-item-id="${item.id}">Edit</button>
                            <button class="btn-ghost btn-sm item-delete-btn" data-item-id="${item.id}" style="color:var(--accent)">Delete</button>
                        </div>
                    ` : ''}
                </div>

                <div style="background:var(--bg-light);padding:8px;border-radius:4px;margin-bottom:8px">
                    <p style="margin:0;font-size:0.875rem"><strong>Item Total: $${itemTotal.toFixed(2)}</strong></p>
                </div>

                <h5 style="margin:12px 0 8px 0">Costs</h5>
                ${(item.costs || []).length === 0 ? '<p class="text-muted" style="font-size:0.875rem">No costs yet.</p>' : ''}
                ${(item.costs || []).map(cost => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px;background:var(--bg-light);margin-bottom:4px;border-radius:3px;font-size:0.875rem">
                        <span>
                            <strong>${cost.costType}</strong> — ${cost.quantity} ${cost.unitOfMeasure} × $${cost.rate.toFixed(2)} = $${cost.amount.toFixed(2)}
                            <br><span class="text-muted">${esc(cost.description)}</span>
                        </span>
                        ${canModify ? `
                            <div style="display:flex;gap:4px">
                                <button class="btn-ghost btn-xs cost-edit-btn" data-item-id="${item.id}" data-subtask-id="" data-cost-id="${cost.id}">Edit</button>
                                <button class="btn-ghost btn-xs cost-delete-btn" data-item-id="${item.id}" data-subtask-id="" data-cost-id="${cost.id}" style="color:var(--accent)">Delete</button>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
                ${canModify ? `<button class="btn-secondary btn-xs add-cost-btn" data-item-id="${item.id}" data-subtask-id="" style="margin-top:6px">+ Cost</button>` : ''}

                ${subtasks.length > 0 ? `
                    <h5 style="margin:12px 0 8px 0">Subtasks</h5>
                    ${subtasks.map((st, stIdx) => {
                        const subtaskTotal = (st.costs || []).reduce((sum, c) => sum + (c.amount || 0), 0);
                        return `
                            <div style="margin-bottom:12px;padding:8px;background:var(--bg-light);border-radius:3px;border-left:3px solid var(--primary)">
                                <div style="display:flex;justify-content:space-between;align-items:center">
                                    <div>
                                        <p style="margin:0 0 4px 0;font-weight:bold">${esc(st.description || 'Subtask ' + (stIdx + 1))}</p>
                                        <p style="margin:0;font-size:0.85rem;color:var(--primary)">Subtotal: $${subtaskTotal.toFixed(2)}</p>
                                    </div>
                                </div>
                                <div style="margin-top:6px">
                                    ${(st.costs || []).map(cost => `
                                        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px;font-size:0.8rem">
                                            <span>${cost.costType} — ${cost.quantity} ${cost.unitOfMeasure} × $${cost.rate.toFixed(2)} = $${cost.amount.toFixed(2)}</span>
                                            ${canModify ? `
                                                <div style="display:flex;gap:2px">
                                                    <button class="btn-ghost btn-xs cost-edit-btn" data-item-id="${item.id}" data-subtask-id="${st.id}" data-cost-id="${cost.id}">E</button>
                                                    <button class="btn-ghost btn-xs cost-delete-btn" data-item-id="${item.id}" data-subtask-id="${st.id}" data-cost-id="${cost.id}" style="color:var(--accent)">×</button>
                                                </div>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                    ${canModify ? `<button class="btn-secondary btn-xs add-cost-btn" data-item-id="${item.id}" data-subtask-id="${st.id}" style="margin-top:4px">+ Cost</button>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                ` : ''}
            </div>
        `;
    },

    _showEstimateForm(editId) {
        const self = this;
        const estimate = editId ? AppData.getEstimate(editId) : null;
        const isEdit = !!estimate;
        const esc = Utils.escapeHtml;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:600px">
                <div class="modal-header">
                    <h3 style="margin:0">${isEdit ? 'Edit Estimate' : 'New Estimate'}</h3>
                </div>
                <div class="modal-body">
                    <form id="estimateForm">
                        <div class="form-group">
                            <label>Client Name *</label>
                            <input name="clientName" value="${esc(estimate ? estimate.clientName : '')}" required>
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea name="description" style="resize:vertical;height:80px">${esc(estimate ? estimate.description : '')}</textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Tax Rate (%)</label>
                                <input type="number" name="taxRate" min="0" max="100" step="0.01" value="${estimate ? (estimate.taxRate || 0) : '13'}">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="cancelBtn">Cancel</button>
                    <button class="btn-primary" id="saveBtn">${isEdit ? 'Update' : 'Create'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const form = overlay.querySelector('#estimateForm');
        overlay.querySelector('#cancelBtn').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#saveBtn').addEventListener('click', async () => {
            const formData = new FormData(form);
            const clientName = formData.get('clientName').trim();
            const description = formData.get('description').trim();
            const taxRate = parseFloat(formData.get('taxRate')) || 0;

            if (!clientName) {
                Utils.showToast('Client name is required', 'error');
                return;
            }

            const newEstimate = {
                id: estimate ? estimate.id : AppData.generateId(),
                clientName: clientName,
                description: description,
                taxRate: taxRate,
                status: estimate ? estimate.status : 'draft',
                items: estimate ? estimate.items : [],
                subtotal: estimate ? estimate.subtotal : 0,
                tax: estimate ? estimate.tax : 0,
                total: estimate ? estimate.total : 0,
                created_at: estimate ? estimate.created_at : new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const saveBtn = overlay.querySelector('#saveBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
            try {
                await AppData.saveEstimateAsync(newEstimate);
            } catch (e) {
                Utils.showToast('Failed to save estimate: ' + e.message, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = isEdit ? 'Update' : 'Create';
                return;
            }
            overlay.remove();
            Utils.showToast(isEdit ? 'Estimate updated' : 'Estimate created');
            if (!isEdit) {
                self._viewingEstimateId = newEstimate.id;
            }
            self._renderDetail();
        });
    },

    _showItemForm(estimateId, itemId) {
        const self = this;
        const estimate = AppData.getEstimate(estimateId);
        const items = estimate.items || [];
        const item = itemId ? items.find(i => i.id === itemId) : null;
        const isEdit = !!item;
        const esc = Utils.escapeHtml;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:500px">
                <div class="modal-header">
                    <h3 style="margin:0">${isEdit ? 'Edit Item' : 'New Item'}</h3>
                </div>
                <div class="modal-body">
                    <form id="itemForm">
                        <div class="form-group">
                            <label>Item Description *</label>
                            <input name="description" value="${esc(item ? item.description : '')}" required>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="cancelBtn">Cancel</button>
                    <button class="btn-primary" id="saveBtn">${isEdit ? 'Update' : 'Create'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const form = overlay.querySelector('#itemForm');
        overlay.querySelector('#cancelBtn').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#saveBtn').addEventListener('click', async () => {
            const formData = new FormData(form);
            const description = formData.get('description').trim();

            if (!description) {
                Utils.showToast('Description is required', 'error');
                return;
            }

            const newItem = {
                id: item ? item.id : AppData.generateId(),
                description: description,
                costs: item ? item.costs : [],
                subtasks: item ? item.subtasks : []
            };

            if (isEdit) {
                const idx = items.findIndex(i => i.id === itemId);
                if (idx >= 0) items[idx] = newItem;
            } else {
                items.push(newItem);
            }

            estimate.items = items;
            self._recalculateTotals(estimate);
            try {
                await AppData.saveEstimateAsync(estimate);
            } catch (e) {
                Utils.showToast('Failed to save item: ' + e.message, 'error');
                return;
            }
            overlay.remove();
            Utils.showToast(isEdit ? 'Item updated' : 'Item added');
            self._renderDetail();
        });
    },

    _showCostForm(estimateId, itemId, subtaskId, costId) {
        const self = this;
        const estimate = AppData.getEstimate(estimateId);
        const items = estimate.items || [];
        const item = items.find(i => i.id === itemId);

        let costs, cost, parentLabel;
        if (subtaskId) {
            const subtasks = item.subtasks || [];
            const subtask = subtasks.find(s => s.id === subtaskId);
            costs = subtask.costs || [];
            cost = costId ? costs.find(c => c.id === costId) : null;
            parentLabel = 'Subtask';
        } else {
            costs = item.costs || [];
            cost = costId ? costs.find(c => c.id === costId) : null;
            parentLabel = 'Item';
        }

        const isEdit = !!cost;
        const esc = Utils.escapeHtml;
        const costTypes = ['labor', 'equipment', 'material', 'subcontractor', 'miscellaneous'];

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:600px">
                <div class="modal-header">
                    <h3 style="margin:0">${isEdit ? 'Edit Cost' : 'New Cost'} (${parentLabel})</h3>
                </div>
                <div class="modal-body">
                    <form id="costForm">
                        <div class="form-group">
                            <label>Cost Type *</label>
                            <select name="costType" required>
                                <option value="">-- Select --</option>
                                ${costTypes.map(t => `<option value="${t}" ${cost && cost.costType === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Description *</label>
                            <input name="description" value="${esc(cost ? cost.description : '')}" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Quantity *</label>
                                <input type="number" name="quantity" min="0" step="0.01" value="${cost ? cost.quantity : 1}" required>
                            </div>
                            <div class="form-group">
                                <label>Unit of Measure *</label>
                                <input name="unitOfMeasure" value="${esc(cost ? cost.unitOfMeasure : 'hours')}" placeholder="hours, days, units, sqft, etc." required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Rate ($) *</label>
                            <input type="number" name="rate" min="0" step="0.01" value="${cost ? cost.rate : 0}" required>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="cancelBtn">Cancel</button>
                    <button class="btn-primary" id="saveBtn">${isEdit ? 'Update' : 'Create'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const form = overlay.querySelector('#costForm');
        overlay.querySelector('#cancelBtn').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#saveBtn').addEventListener('click', async () => {
            const formData = new FormData(form);
            const costType = formData.get('costType').trim();
            const description = formData.get('description').trim();
            const quantity = parseFloat(formData.get('quantity')) || 0;
            const unitOfMeasure = formData.get('unitOfMeasure').trim();
            const rate = parseFloat(formData.get('rate')) || 0;

            if (!costType || !description || !unitOfMeasure) {
                Utils.showToast('All fields are required', 'error');
                return;
            }

            const amount = quantity * rate;
            const newCost = {
                id: cost ? cost.id : AppData.generateId(),
                costType: costType,
                description: description,
                quantity: quantity,
                unitOfMeasure: unitOfMeasure,
                rate: rate,
                amount: amount
            };

            if (isEdit) {
                const idx = costs.findIndex(c => c.id === costId);
                if (idx >= 0) costs[idx] = newCost;
            } else {
                costs.push(newCost);
            }

            if (subtaskId) {
                const subtasks = item.subtasks || [];
                const subtask = subtasks.find(s => s.id === subtaskId);
                subtask.costs = costs;
            } else {
                item.costs = costs;
            }

            self._recalculateTotals(estimate);
            try {
                await AppData.saveEstimateAsync(estimate);
            } catch (e) {
                Utils.showToast('Failed to save cost: ' + e.message, 'error');
                return;
            }
            overlay.remove();
            Utils.showToast(isEdit ? 'Cost updated' : 'Cost added');
            self._renderDetail();
        });
    },

    _recalculateTotals(estimate) {
        const items = estimate.items || [];
        let subtotal = 0;

        items.forEach(item => {
            // Item costs
            (item.costs || []).forEach(cost => {
                subtotal += cost.amount || 0;
            });
            // Subtask costs
            (item.subtasks || []).forEach(st => {
                (st.costs || []).forEach(cost => {
                    subtotal += cost.amount || 0;
                });
            });
        });

        const taxRate = estimate.taxRate || 0;
        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;

        estimate.subtotal = subtotal;
        estimate.tax = tax;
        estimate.total = total;
    },

    async _deleteItem(estimateId, itemId) {
        const estimate = AppData.getEstimate(estimateId);
        estimate.items = (estimate.items || []).filter(i => i.id !== itemId);
        this._recalculateTotals(estimate);
        try {
            await AppData.saveEstimateAsync(estimate);
        } catch (e) {
            Utils.showToast('Failed to delete item: ' + e.message, 'error');
            return;
        }
        Utils.showToast('Item deleted');
        this._renderDetail();
    },

    async _deleteCost(estimateId, itemId, subtaskId, costId) {
        const estimate = AppData.getEstimate(estimateId);
        const item = (estimate.items || []).find(i => i.id === itemId);
        if (!item) return;

        if (subtaskId) {
            const subtask = (item.subtasks || []).find(s => s.id === subtaskId);
            if (subtask) {
                subtask.costs = (subtask.costs || []).filter(c => c.id !== costId);
            }
        } else {
            item.costs = (item.costs || []).filter(c => c.id !== costId);
        }

        this._recalculateTotals(estimate);
        try {
            await AppData.saveEstimateAsync(estimate);
        } catch (e) {
            Utils.showToast('Failed to delete cost: ' + e.message, 'error');
            return;
        }
        Utils.showToast('Cost deleted');
        this._renderDetail();
    },

    async _sendEstimate(estimateId) {
        const estimate = AppData.getEstimate(estimateId);
        if (estimate) {
            estimate.status = 'sent';
            try { await AppData.saveEstimateAsync(estimate); } catch (e) { Utils.showToast('Failed: ' + e.message, 'error'); return; }
            Utils.showToast('Estimate sent');
        }
    },

    async _approveEstimate(estimateId) {
        const estimate = AppData.getEstimate(estimateId);
        if (estimate) {
            estimate.status = 'approved';
            try { await AppData.saveEstimateAsync(estimate); } catch (e) { Utils.showToast('Failed: ' + e.message, 'error'); return; }
            Utils.showToast('Estimate approved');
        }
    },

    async _createProjectFromEstimate(estimateId) {
        try {
            const estimate = AppData.getEstimate(estimateId);
            if (estimate) {
                const newProject = {
                    id: AppData.generateId(),
                    name: estimate.clientName + ' — ' + (estimate.description || 'Project'),
                    clientName: estimate.clientName,
                    status: 'Active',
                    budget: estimate.subtotal || 0,
                    created_at: new Date().toISOString()
                };
                await AppData.saveEntityAsync('projects', newProject);
                Utils.showToast('Project created from estimate');
                this._viewingEstimateId = null;
            }
            this._renderList();
        } catch (err) {
            Utils.showToast('Error creating project: ' + err.message, 'error');
        }
    }
};
