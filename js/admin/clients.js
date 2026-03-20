// Admin Clients Module
window.AdminClients = {
    _filter: '',

    render(container) {
        const self = this;
        self._container = container;
        self._renderList();
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const clients = AppData.getClients();
        const filter = self._filter.toLowerCase();
        const filtered = filter
            ? clients.filter(function(c) {
                return (c.name || '').toLowerCase().includes(filter) ||
                    (c.contactPerson || '').toLowerCase().includes(filter) ||
                    (c.email || '').toLowerCase().includes(filter) ||
                    (c.phone || '').toLowerCase().includes(filter);
            })
            : clients;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                <h2>Client Address Book</h2>
                <button class="btn btn-primary" id="addClientBtn">+ Add Client</button>
            </div>

            <div class="card" style="margin-bottom:16px">
                <div class="card-body">
                    <input type="text" class="form-control" id="clientSearch" placeholder="Search clients by name, contact, email, or phone..." value="${Utils.escapeHtml(self._filter)}" style="max-width:400px">
                </div>
            </div>

            <div class="card">
                ${filtered.length === 0
                    ? '<div class="empty"><h3>No Clients Found</h3><p>' + (clients.length === 0 ? 'Add your first client to get started.' : 'No clients match your search.') + '</p></div>'
                    : `<table>
                        <thead>
                            <tr>
                                <th>Company / Name</th>
                                <th>Contact Person</th>
                                <th>Phone</th>
                                <th>Email</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(function(c) {
                                return '<tr>' +
                                    '<td><strong>' + Utils.escapeHtml(c.name) + '</strong></td>' +
                                    '<td>' + Utils.escapeHtml(c.contactPerson || '') + '</td>' +
                                    '<td>' + Utils.escapeHtml(c.phone || '') + '</td>' +
                                    '<td>' + Utils.escapeHtml(c.email || '') + '</td>' +
                                    '<td style="white-space:nowrap">' +
                                        '<button class="btn-ghost btn-sm edit-client" data-id="' + c.id + '">Edit</button>' +
                                        '<button class="btn-ghost btn-sm delete-client" data-id="' + c.id + '" style="color:var(--accent)">Delete</button>' +
                                    '</td>' +
                                '</tr>';
                            }).join('')}
                        </tbody>
                    </table>`
                }
            </div>
        `;

        container.querySelector('#addClientBtn').addEventListener('click', function() {
            self._showModal(null);
        });

        container.querySelector('#clientSearch').addEventListener('input', Utils.debounce(function(e) {
            self._filter = e.target.value;
            self._renderList();
        }, 250));

        container.querySelectorAll('.edit-client').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._showModal(btn.dataset.id);
            });
        });

        container.querySelectorAll('.delete-client').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                const client = AppData.getClient(btn.dataset.id);
                if (!client) return;
                const confirmed = await Utils.confirm('Delete client "' + client.name + '"? This cannot be undone.');
                if (!confirmed) return;
                AppData.deleteClient(btn.dataset.id);
                const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'Client Deleted', client.name);
                Utils.showToast('Client deleted');
                self._renderList();
            });
        });
    },

    _showModal(editId) {
        const self = this;
        const client = editId ? AppData.getClient(editId) : null;
        const isEdit = !!client;
        const esc = Utils.escapeHtml;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:600px">
                <div class="modal-header">
                    <h3 style="margin:0">${isEdit ? 'Edit Client' : 'Add Client'}</h3>
                </div>
                <div class="modal-body">
                    <form id="clientModalForm" novalidate>
                        <div class="form-group" style="margin-bottom:12px">
                            <label>Company / Client Name *</label>
                            <input class="form-control" name="name" value="${esc(client ? client.name : '')}" required>
                        </div>
                        <div class="form-group" style="margin-bottom:12px">
                            <label>Contact Person</label>
                            <input class="form-control" name="contactPerson" value="${esc(client ? client.contactPerson : '')}">
                        </div>
                        <div class="form-group" style="margin-bottom:12px">
                            <label>Address</label>
                            <input class="form-control" name="address" value="${esc(client ? client.address : '')}">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>City</label>
                                <input class="form-control" name="city" value="${esc(client ? client.city : '')}">
                            </div>
                            <div class="form-group">
                                <label>Province</label>
                                <input class="form-control" name="province" value="${esc(client ? client.province : 'Ontario')}">
                            </div>
                            <div class="form-group">
                                <label>Postal Code</label>
                                <input class="form-control" name="postalCode" value="${esc(client ? client.postalCode : '')}">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Phone</label>
                                <input class="form-control" name="phone" value="${esc(client ? client.phone : '')}" type="tel">
                            </div>
                            <div class="form-group">
                                <label>Email</label>
                                <input class="form-control" name="email" value="${esc(client ? client.email : '')}" type="email">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="submit" form="clientModalForm" class="btn btn-primary">${isEdit ? 'Update' : 'Add'} Client</button>
                    <button type="button" class="btn btn-secondary modal-close">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });
        overlay.querySelector('.modal-close').addEventListener('click', function() {
            overlay.remove();
        });

        overlay.querySelector('#clientModalForm').addEventListener('submit', function(e) {
            e.preventDefault();
            if (!Utils.validateForm(this)) return;
            const fd = Utils.getFormData(this);
            if (!fd.name.trim()) {
                Utils.showToast('Client name is required', 'error');
                return;
            }
            const clientData = {
                id: isEdit ? client.id : AppData.generateId(),
                name: fd.name.trim(),
                contactPerson: (fd.contactPerson || '').trim(),
                address: (fd.address || '').trim(),
                city: (fd.city || '').trim(),
                province: (fd.province || '').trim(),
                postalCode: (fd.postalCode || '').trim(),
                phone: (fd.phone || '').trim(),
                email: (fd.email || '').trim()
            };
            AppData.saveClient(clientData);
            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, isEdit ? 'Client Updated' : 'Client Added', clientData.name);
            Utils.showToast(isEdit ? 'Client updated' : 'Client added');
            overlay.remove();
            self._renderList();
        });
    }
};
