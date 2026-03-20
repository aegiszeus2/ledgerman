// Admin Vendors Module
window.AdminVendors = {
    _container: null,

    // ── Vendor CRUD helpers (localStorage: belfort_vendors) ──────────────────
    _getVendors() {
        return AppData.getData('vendors') || [];
    },
    _saveVendor(vendor) {
        var list = this._getVendors();
        var idx = list.findIndex(function(v) { return v.id === vendor.id; });
        if (idx >= 0) list[idx] = vendor;
        else list.push(vendor);
        AppData.setData('vendors', list);
    },
    _deleteVendor(id) {
        AppData.setData('vendors', this._getVendors().filter(function(v) { return v.id !== id; }));
    },
    _getVendorExpenses(vendorId) {
        return AppData.getExpenses().filter(function(e) {
            return e.vendorId === vendorId;
        });
    },

    // ── Entry points ─────────────────────────────────────────────────────────
    render(container, params) {
        this._container = container;
        this._renderList();
    },

    renderDetail(container, vendorId) {
        this._container = container;
        this._renderDetail(vendorId);
    },

    // ── List View ─────────────────────────────────────────────────────────────
    _renderList() {
        var self = this;
        var esc = Utils.escapeHtml;
        var vendors = self._getVendors();
        var projects = AppData.getProjects();
        var projectMap = {};
        projects.forEach(function(p) { projectMap[p.id] = p.name; });

        var html = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">' +
            '<h2>Vendors</h2>' +
            '<button class="btn btn-primary btn-sm" id="vendorAddBtn">+ Add Vendor</button>' +
            '</div>';

        if (vendors.length === 0) {
            html += '<div class="card"><div class="empty-state"><h3>No Vendors Yet</h3><p>Add vendors to track expenses by supplier, subcontractor, or equipment rental company.</p></div></div>';
        } else {
            html += '<div style="overflow-x:auto"><table class="table" id="vendorTable">' +
                '<thead><tr>' +
                '<th>Name</th><th>Category</th><th>Phone</th><th>Email</th><th>Expenses</th><th>Total Spent</th><th>Actions</th>' +
                '</tr></thead><tbody>';

            vendors.forEach(function(v) {
                var exps = self._getVendorExpenses(v.id);
                var total = exps.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
                html += '<tr>' +
                    '<td><a href="#" class="vendor-name-link" data-id="' + v.id + '" style="color:var(--amber);font-weight:600">' + esc(v.name) + '</a></td>' +
                    '<td><span class="vendor-category-badge">' + esc(v.category || 'Other') + '</span></td>' +
                    '<td>' + esc(v.phone || '—') + '</td>' +
                    '<td>' + esc(v.email || '—') + '</td>' +
                    '<td>' + exps.length + '</td>' +
                    '<td style="font-weight:600">' + Utils.formatCurrency(total) + '</td>' +
                    '<td style="white-space:nowrap">' +
                    '<button class="btn btn-secondary btn-sm vendor-expand-btn" data-id="' + v.id + '">▶ Expand</button> ' +
                    '<button class="btn btn-secondary btn-sm vendor-edit-btn" data-id="' + v.id + '">Edit</button> ' +
                    '<button class="btn btn-danger btn-sm vendor-del-btn" data-id="' + v.id + '">Delete</button>' +
                    '</td>' +
                    '</tr>' +
                    '<tr class="vendor-exp-row" id="vexp-' + v.id + '" style="display:none">' +
                    '<td colspan="7" style="padding:0"></td>' +
                    '</tr>';
            });

            html += '</tbody></table></div>';
        }

        self._container.innerHTML = html;

        // Add vendor
        var addBtn = self._container.querySelector('#vendorAddBtn');
        if (addBtn) addBtn.addEventListener('click', function() { self._showVendorForm(null); });

        // Vendor name link → detail view
        self._container.querySelectorAll('.vendor-name-link').forEach(function(a) {
            a.addEventListener('click', function(e) {
                e.preventDefault();
                window.App.navigate('vendor-detail', { vendorId: a.dataset.id });
            });
        });

        // Edit
        self._container.querySelectorAll('.vendor-edit-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var vendor = self._getVendors().find(function(v) { return v.id === btn.dataset.id; });
                if (vendor) self._showVendorForm(vendor);
            });
        });

        // Delete
        self._container.querySelectorAll('.vendor-del-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var confirmed = await Utils.confirm('Delete this vendor? Expenses linked to this vendor will keep the vendor name but lose the vendor ID link.');
                if (!confirmed) return;
                self._deleteVendor(btn.dataset.id);
                Utils.showToast('Vendor deleted');
                self._renderList();
            });
        });

        // Expand expenses inline
        self._container.querySelectorAll('.vendor-expand-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = btn.dataset.id;
                var row = self._container.querySelector('#vexp-' + id);
                if (!row) return;
                if (row.style.display === 'none') {
                    row.style.display = '';
                    btn.textContent = '▼ Collapse';
                    self._renderVendorExpansion(row.querySelector('td'), id, projectMap);
                } else {
                    row.style.display = 'none';
                    btn.textContent = '▶ Expand';
                }
            });
        });
    },

    _renderVendorExpansion(cell, vendorId, projectMap) {
        var self = this;
        var esc = Utils.escapeHtml;
        var expenses = self._getVendorExpenses(vendorId);
        var vendor = self._getVendors().find(function(v) { return v.id === vendorId; });

        if (expenses.length === 0) {
            cell.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-style:italic">No expenses linked to this vendor yet.</div>';
            // Add Expense button
            cell.innerHTML += '<div style="padding:8px 16px"><button class="btn btn-secondary btn-sm vendor-add-exp-btn" data-id="' + vendorId + '">+ Add Expense for this Vendor</button></div>';
        } else {
            // Group by project
            var byProject = {};
            expenses.forEach(function(e) {
                var pname = projectMap[e.projectId] || 'Unknown';
                if (!byProject[pname]) byProject[pname] = [];
                byProject[pname].push(e);
            });

            var html = '<div style="padding:12px 16px">';
            Object.keys(byProject).forEach(function(pname) {
                var items = byProject[pname];
                var ptotal = items.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
                html += '<div class="vendor-expenses-group">' +
                    '<h5>' + esc(pname) + ' — Subtotal: ' + Utils.formatCurrency(ptotal) + '</h5>' +
                    '<table class="table" style="font-size:.8rem">' +
                    '<thead><tr><th>Date</th><th>Category</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>' +
                    '<tbody>' +
                    items.map(function(e) {
                        return '<tr>' +
                            '<td>' + Utils.formatDate(e.date) + '</td>' +
                            '<td>' + esc(e.category || '—') + '</td>' +
                            '<td>' + esc(e.description) + '</td>' +
                            '<td style="text-align:right">' + Utils.formatCurrency(e.amount) + '</td>' +
                            '</tr>';
                    }).join('') +
                    '</tbody></table></div>';
            });
            html += '<div style="margin-top:8px"><button class="btn btn-secondary btn-sm vendor-add-exp-btn" data-id="' + vendorId + '">+ Add Expense for this Vendor</button></div>';
            html += '</div>';
            cell.innerHTML = html;
        }

        // Add expense pre-filled with vendor
        cell.querySelectorAll('.vendor-add-exp-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._showAddExpenseForVendor(btn.dataset.id);
            });
        });
    },

    _showAddExpenseForVendor(vendorId) {
        var self = this;
        var esc = Utils.escapeHtml;
        var projects = AppData.getProjects();
        if (projects.length === 0) {
            Utils.showToast('Create a project first.', 'error');
            return;
        }
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = '<div class="modal" style="max-width:400px">' +
            '<div class="modal-header"><h3>Select Project & Type</h3></div>' +
            '<div class="modal-body">' +
            '<div class="form-group"><label class="form-label">Project</label>' +
            '<select class="form-control" id="vapProject">' +
            projects.map(function(p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="form-group"><label class="form-label">Type</label>' +
            '<select class="form-control" id="vapType">' +
            '<option value="Labor">Labor</option>' +
            '<option value="Equipment">Equipment</option>' +
            '<option value="Material" selected>Material</option>' +
            '</select></div>' +
            '</div>' +
            '<div class="modal-footer">' +
            '<button class="btn btn-secondary vap-cancel">Cancel</button>' +
            '<button class="btn btn-primary" id="vapProceed">Continue</button>' +
            '</div></div>';
        document.body.appendChild(overlay);
        overlay.querySelector('.vap-cancel').onclick = function() { overlay.remove(); };
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('#vapProceed').onclick = function() {
            var projectId = overlay.querySelector('#vapProject').value;
            var type = overlay.querySelector('#vapType').value;
            overlay.remove();
            if (window.AdminExpenses) {
                AdminExpenses._projectId = projectId;
                AdminExpenses._container = self._container;
                // Pre-fill the vendor after form opens
                AdminExpenses._showExpenseForm(type, { vendorId: vendorId, vendorName: '' });
                // The form will pre-select the vendor via existingVendorId
                var origRender = AdminExpenses._renderExpenses.bind(AdminExpenses);
                AdminExpenses._renderExpenses = function() {
                    AdminExpenses._renderExpenses = origRender;
                    self._renderList();
                };
            }
        };
    },

    // ── Detail View ───────────────────────────────────────────────────────────
    _renderDetail(vendorId) {
        var self = this;
        var esc = Utils.escapeHtml;
        var vendor = self._getVendors().find(function(v) { return v.id === vendorId; });
        if (!vendor) {
            self._container.innerHTML = '<div class="empty-state"><h3>Vendor not found</h3>' +
                '<button class="btn btn-secondary mt-2" id="vendorBackBtn">← Back to Vendors</button></div>';
            self._container.querySelector('#vendorBackBtn').onclick = function() {
                window.App.navigate('vendors');
            };
            return;
        }

        var expenses = self._getVendorExpenses(vendorId);
        var projects = AppData.getProjects();
        var projectMap = {};
        projects.forEach(function(p) { projectMap[p.id] = p.name; });

        // Stats
        var totalAll = expenses.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
        var now = new Date();
        var yearStr = now.getFullYear() + '';
        var monthStr = yearStr + '-' + String(now.getMonth() + 1).padStart(2, '0');
        var totalYear = expenses.filter(function(e) { return e.date && e.date.startsWith(yearStr); })
            .reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
        var totalMonth = expenses.filter(function(e) { return e.date && e.date.startsWith(monthStr); })
            .reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);

        var html = '<div style="margin-bottom:16px;display:flex;align-items:center;gap:12px">' +
            '<button class="btn btn-secondary btn-sm" id="vendorDetailBack">← Vendors</button>' +
            '<h2 style="margin:0">' + esc(vendor.name) + '</h2>' +
            '</div>';

        // Info card
        html += '<div class="card" style="margin-bottom:16px">' +
            '<div class="card-header"><span>Vendor Info</span><button class="btn btn-secondary btn-sm" id="vendorEditInfo">Edit</button></div>' +
            '<div class="card-body">' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">' +
            '<div><label style="font-size:.75rem;text-transform:uppercase;color:var(--text-muted)">Category</label><div style="font-weight:600">' + esc(vendor.category || '—') + '</div></div>' +
            '<div><label style="font-size:.75rem;text-transform:uppercase;color:var(--text-muted)">Phone</label><div>' + esc(vendor.phone || '—') + '</div></div>' +
            '<div><label style="font-size:.75rem;text-transform:uppercase;color:var(--text-muted)">Email</label><div>' + esc(vendor.email || '—') + '</div></div>' +
            '</div>' +
            (vendor.notes ? '<div style="margin-top:12px;font-size:.875rem;color:var(--text-secondary)"><strong>Notes:</strong> ' + esc(vendor.notes) + '</div>' : '') +
            '</div></div>';

        // Stats
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px">' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(totalAll) + '</div><div class="stat-label">Total Spent</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(totalYear) + '</div><div class="stat-label">This Year</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(totalMonth) + '</div><div class="stat-label">This Month</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + expenses.length + '</div><div class="stat-label">Transactions</div></div>' +
            '</div>';

        // Expenses grouped by project, then date
        html += '<div class="card" style="margin-bottom:16px">' +
            '<div class="card-header"><span>Expenses</span><button class="btn btn-primary btn-sm" id="vendorDetailAddExp">+ Add Expense</button></div>' +
            '<div class="card-body" id="vendorDetailExps">';

        if (expenses.length === 0) {
            html += '<div class="empty-state"><p>No expenses linked to this vendor.</p></div>';
        } else {
            // Group by project
            var byProject = {};
            expenses.forEach(function(e) {
                var pname = projectMap[e.projectId] || 'Unknown';
                if (!byProject[pname]) byProject[pname] = [];
                byProject[pname].push(e);
            });
            Object.keys(byProject).forEach(function(pname) {
                var items = byProject[pname].slice().sort(function(a, b) { return (a.date || '') > (b.date || '') ? -1 : 1; });
                var ptotal = items.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
                html += '<h4 style="color:var(--amber);margin:12px 0 6px">' + esc(pname) + ' — ' + Utils.formatCurrency(ptotal) + '</h4>' +
                    '<table class="table" style="font-size:.85rem;margin-bottom:12px">' +
                    '<thead><tr><th>Date</th><th>Category</th><th>Description</th><th style="text-align:right">Amount</th><th>Billable</th><th>Invoiced</th></tr></thead>' +
                    '<tbody>' +
                    items.map(function(e) {
                        return '<tr>' +
                            '<td>' + Utils.formatDate(e.date) + '</td>' +
                            '<td>' + esc(e.category || '—') + '</td>' +
                            '<td>' + esc(e.description) + '</td>' +
                            '<td style="text-align:right">' + Utils.formatCurrency(e.amount) + '</td>' +
                            '<td>' + (e.billable ? '✅' : '❌') + '</td>' +
                            '<td>' + (e.invoiceStatus === 'Already Invoiced' ? '✅' : '—') + '</td>' +
                            '</tr>';
                    }).join('') +
                    '</tbody></table>';
            });
        }
        html += '</div></div>';

        // Receipts
        var expensesWithReceipts = expenses.filter(function(e) { return e.receiptPhotoId; });
        html += '<div class="card" style="margin-bottom:16px">' +
            '<div class="card-header"><span>Receipts & Backup (' + expensesWithReceipts.length + ')</span></div>' +
            '<div class="card-body" id="vendorReceipts">';
        if (expensesWithReceipts.length === 0) {
            html += '<p style="color:var(--text-muted);font-size:.875rem">No receipts linked to this vendor\'s expenses.</p>';
        } else {
            html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
            expensesWithReceipts.forEach(function(e) {
                html += '<div style="font-size:.8rem;background:var(--bg-surface);padding:6px 10px;border-radius:var(--radius);border:1px solid var(--border-color)">' +
                    Utils.formatDate(e.date) + ' — ' + Utils.escapeHtml(e.description) + '</div>';
            });
            html += '</div>';
        }
        html += '</div></div>';

        // Generate summary button
        html += '<div style="margin-top:8px">' +
            '<button class="btn btn-secondary" id="vendorGenSummary">🖨️ Generate Vendor Summary</button>' +
            '</div>';

        self._container.innerHTML = html;

        // Back
        self._container.querySelector('#vendorDetailBack').onclick = function() {
            window.App.navigate('vendors');
        };

        // Edit info
        self._container.querySelector('#vendorEditInfo').onclick = function() {
            self._showVendorForm(vendor, function() {
                self._renderDetail(vendorId);
            });
        };

        // Add expense
        self._container.querySelector('#vendorDetailAddExp').onclick = function() {
            self._showAddExpenseForVendor(vendorId);
        };

        // Generate summary
        self._container.querySelector('#vendorGenSummary').onclick = function() {
            self._generateSummary(vendor, expenses, projectMap);
        };
    },

    // ── Vendor Form Modal ─────────────────────────────────────────────────────
    _showVendorForm(existing, onSave) {
        var self = this;
        var esc = Utils.escapeHtml;
        var isEdit = !!existing;

        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = '<div class="modal" style="max-width:500px">' +
            '<div class="modal-header"><h3>' + (isEdit ? 'Edit Vendor' : 'Add Vendor') + '</h3></div>' +
            '<div class="modal-body">' +
            '<form id="vendorForm" novalidate>' +
            '<div class="form-group"><label class="form-label">Name *</label>' +
            '<input class="form-control" name="name" value="' + esc(existing ? existing.name : '') + '" required placeholder="Vendor name"></div>' +

            '<div class="form-group"><label class="form-label">Category</label>' +
            '<select class="form-control" name="category">' +
            ['Materials', 'Equipment', 'Subcontractor', 'Other'].map(function(c) {
                return '<option value="' + c + '"' + (existing && existing.category === c ? ' selected' : '') + '>' + c + '</option>';
            }).join('') +
            '</select></div>' +

            '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Phone</label>' +
            '<input class="form-control" name="phone" type="tel" value="' + esc(existing ? existing.phone || '' : '') + '" placeholder="(416) 555-0100"></div>' +
            '<div class="form-group"><label class="form-label">Email</label>' +
            '<input class="form-control" name="email" type="email" value="' + esc(existing ? existing.email || '' : '') + '" placeholder="vendor@example.com"></div>' +
            '</div>' +

            '<div class="form-group"><label class="form-label">Notes</label>' +
            '<textarea class="form-control" name="notes" rows="2" placeholder="Internal notes">' + esc(existing ? existing.notes || '' : '') + '</textarea></div>' +
            '</form>' +
            '</div>' +
            '<div class="modal-footer">' +
            '<button class="btn btn-secondary vendor-form-cancel">Cancel</button>' +
            '<button class="btn btn-primary" id="vendorFormSave">' + (isEdit ? 'Update' : 'Add') + ' Vendor</button>' +
            '</div></div>';

        document.body.appendChild(overlay);
        overlay.querySelector('.vendor-form-cancel').onclick = function() { overlay.remove(); };
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

        overlay.querySelector('#vendorFormSave').onclick = function() {
            var form = overlay.querySelector('#vendorForm');
            var fd = Utils.getFormData(form);
            if (!fd.name || !fd.name.trim()) {
                Utils.showToast('Vendor name is required.', 'error');
                return;
            }
            var vendor = {
                id: isEdit ? existing.id : AppData.generateId(),
                name: fd.name.trim(),
                category: fd.category || 'Other',
                phone: (fd.phone || '').trim(),
                email: (fd.email || '').trim(),
                notes: (fd.notes || '').trim(),
                createdAt: isEdit ? (existing.createdAt || new Date().toISOString()) : new Date().toISOString()
            };
            self._saveVendor(vendor);
            var username = (window.App && window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, isEdit ? 'Vendor Updated' : 'Vendor Added', vendor.name);
            Utils.showToast(isEdit ? 'Vendor updated' : 'Vendor added');
            overlay.remove();
            if (typeof onSave === 'function') {
                onSave(vendor);
            } else {
                self._renderList();
            }
        };
    },

    // ── Vendor Summary Print ──────────────────────────────────────────────────
    _generateSummary(vendor, expenses, projectMap) {
        var esc = Utils.escapeHtml;
        var settings = AppData.getSettings();
        var totalAll = expenses.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);

        // Group by project
        var byProject = {};
        expenses.forEach(function(e) {
            var pname = projectMap[e.projectId] || 'Unknown';
            if (!byProject[pname]) byProject[pname] = [];
            byProject[pname].push(e);
        });

        var rows = '';
        Object.keys(byProject).forEach(function(pname) {
            var items = byProject[pname].slice().sort(function(a, b) { return (a.date || '') > (b.date || '') ? 1 : -1; });
            var ptotal = items.reduce(function(s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
            rows += '<tr><td colspan="4" style="background:#f1f5f9;font-weight:700;color:#1a2744">' + esc(pname) + '</td></tr>';
            items.forEach(function(e) {
                rows += '<tr>' +
                    '<td>' + (e.date || '') + '</td>' +
                    '<td>' + esc(e.category || '') + '</td>' +
                    '<td>' + esc(e.description) + '</td>' +
                    '<td style="text-align:right">' + Utils.formatCurrency(e.amount) + '</td>' +
                    '</tr>';
            });
            rows += '<tr><td colspan="3" style="text-align:right;font-weight:600">Project Subtotal:</td>' +
                '<td style="text-align:right;font-weight:600">' + Utils.formatCurrency(ptotal) + '</td></tr>';
        });

        var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
            '<title>Vendor Summary — ' + esc(vendor.name) + '</title>' +
            '<style>body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a2e;padding:24px}' +
            'h1{font-size:18px;margin-bottom:4px}h2{font-size:14px;color:#1a2744;margin-top:20px}' +
            'table{width:100%;border-collapse:collapse;margin-top:8px}' +
            'th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left}' +
            'th{background:#f1f5f9;font-weight:700}' +
            '.total-row{font-size:14px;font-weight:700;background:#1a2744;color:#fff}' +
            '@media print{body{padding:8px}}' +
            '</style></head><body>' +
            '<h1>' + esc(settings.companyName || 'My Company') + '</h1>' +
            '<p style="color:#64748b;margin:0">Vendor Expense Summary</p>' +
            '<hr style="margin:12px 0">' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
            '<div><strong>Vendor:</strong> ' + esc(vendor.name) + '<br>' +
            '<strong>Category:</strong> ' + esc(vendor.category || '') + '<br>' +
            (vendor.phone ? '<strong>Phone:</strong> ' + esc(vendor.phone) + '<br>' : '') +
            (vendor.email ? '<strong>Email:</strong> ' + esc(vendor.email) + '<br>' : '') +
            '</div>' +
            '<div><strong>Generated:</strong> ' + new Date().toLocaleDateString('en-CA') + '<br>' +
            '<strong>Total Transactions:</strong> ' + expenses.length + '<br>' +
            '</div></div>' +
            '<h2>Expense Detail by Project</h2>' +
            '<table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '<tfoot><tr class="total-row"><td colspan="3" style="text-align:right">TOTAL</td>' +
            '<td style="text-align:right">' + Utils.formatCurrency(totalAll) + '</td></tr></tfoot>' +
            '</table>' +
            '<script>window.print();<\/script>' +
            '</body></html>';

        var win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
        } else {
            Utils.showToast('Popup blocked — allow popups to print vendor summary.', 'error');
        }
    }
};
