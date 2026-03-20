// Admin Users (Workers) Module
window.AdminUsers = {
    _filter: '',
    _wizardMode: false,

    render(container, params) {
        const self = this;
        self._container = container;
        params = params || {};
        const workers = AppData.getWorkers();
        if (params.wizard || workers.length === 0) {
            self._wizardMode = true;
            self._startWizard();
        } else {
            self._wizardMode = false;
        }
        self._renderList();
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const workers = AppData.getWorkers();
        const filter = self._filter.toLowerCase();
        const filtered = filter
            ? workers.filter(function(w) {
                return (w.name || '').toLowerCase().includes(filter) ||
                    (w.role || '').toLowerCase().includes(filter) ||
                    (w.status || '').toLowerCase().includes(filter);
            })
            : workers;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                <h2>Worker Management</h2>
                <div style="display:flex;gap:8px">
                    <button class="btn-secondary btn-sm" id="workerWizardBtn">Walk me through it</button>
                    <button class="btn-primary" id="addWorkerBtn">+ Add Worker</button>
                </div>
            </div>

            <div class="card" style="margin-bottom:16px">
                <input type="text" id="workerSearch" placeholder="Search workers by name, role, or status..." value="${Utils.escapeHtml(self._filter)}" style="max-width:400px">
            </div>

            <div class="card">
                ${filtered.length === 0
                    ? '<div class="empty"><h3>No Workers Found</h3><p>' + (workers.length === 0 ? 'Add your first worker to get started.' : 'No workers match your search.') + '</p></div>'
                    : `<table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Role</th>
                                <th>PIN</th>
                                <th>Status</th>
                                <th class="amount">Default Rate</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(function(w) {
                                const statusClass = w.status === 'Active' ? 'active-s' : 'completed-s';
                                return '<tr>' +
                                    '<td><strong>' + Utils.escapeHtml(w.name) + '</strong></td>' +
                                    '<td>' + Utils.escapeHtml(w.role || 'Worker') + '</td>' +
                                    '<td style="white-space:nowrap">' +
                                        '<span class="pin-masked" data-id="' + w.id + '">' + '\u2022'.repeat((w.pin || '').length || 4) + '</span>' +
                                        '<span class="pin-revealed" data-id="' + w.id + '" style="display:none">' + Utils.escapeHtml(w.pin || '') + '</span>' +
                                        ' <button class="btn-ghost btn-sm reveal-pin" data-id="' + w.id + '" title="Reveal PIN" style="font-size:.75rem;padding:2px 6px">Show</button>' +
                                    '</td>' +
                                    '<td><span class="pstatus ' + statusClass + '">' + Utils.escapeHtml(w.status || 'Active') + '</span></td>' +
                                    '<td class="amount">' + (w.defaultRate ? Utils.formatCurrency(w.defaultRate) + '/hr' : '-') + '</td>' +
                                    '<td style="white-space:nowrap">' +
                                        '<button class="btn-ghost btn-sm edit-worker" data-id="' + w.id + '">Edit</button>' +
                                        '<button class="btn-ghost btn-sm reset-pin-worker" data-id="' + w.id + '" style="color:var(--warn)">Reset PIN</button>' +
                                        '<button class="btn-ghost btn-sm delete-worker" data-id="' + w.id + '" style="color:var(--accent)">Delete</button>' +
                                    '</td>' +
                                '</tr>';
                            }).join('')}
                        </tbody>
                    </table>`
                }
            </div>
        `;

        container.querySelector('#addWorkerBtn').addEventListener('click', function() {
            self._showModal(null);
        });

        container.querySelector('#workerWizardBtn').addEventListener('click', function() {
            self._startWizard();
        });

        container.querySelector('#workerSearch').addEventListener('input', Utils.debounce(function(e) {
            self._filter = e.target.value;
            self._renderList();
        }, 250));

        // Reveal PIN buttons
        container.querySelectorAll('.reveal-pin').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const id = btn.dataset.id;
                const masked = container.querySelector('.pin-masked[data-id="' + id + '"]');
                const revealed = container.querySelector('.pin-revealed[data-id="' + id + '"]');
                if (revealed.style.display === 'none') {
                    masked.style.display = 'none';
                    revealed.style.display = 'inline';
                    btn.textContent = 'Hide';
                } else {
                    masked.style.display = 'inline';
                    revealed.style.display = 'none';
                    btn.textContent = 'Show';
                }
            });
        });

        container.querySelectorAll('.edit-worker').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._showModal(btn.dataset.id);
            });
        });

        container.querySelectorAll('.reset-pin-worker').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                const worker = AppData.getWorker(btn.dataset.id);
                if (!worker) return;
                const confirmed = await Utils.confirm('Reset PIN for "' + worker.name + '"? A new random PIN will be generated.');
                if (!confirmed) return;
                const newPin = String(Math.floor(1000 + Math.random() * 9000));
                worker.pin = newPin;
                AppData.saveWorker(worker);
                const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'PIN Reset', 'Worker: ' + worker.name);
                Utils.showToast('PIN reset to: ' + newPin);
                self._renderList();
            });
        });

        container.querySelectorAll('.delete-worker').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                const worker = AppData.getWorker(btn.dataset.id);
                if (!worker) return;
                const confirmed = await Utils.confirm('Delete worker "' + worker.name + '"? This cannot be undone.');
                if (!confirmed) return;
                AppData.deleteWorker(btn.dataset.id);
                const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'Worker Deleted', worker.name);
                Utils.showToast('Worker deleted');
                self._renderList();
            });
        });
    },

    _showModal(editId) {
        const self = this;
        const worker = editId ? AppData.getWorker(editId) : null;
        const isEdit = !!worker;
        const esc = Utils.escapeHtml;
        const projects = AppData.getProjects();
        const assignedProjects = [];
        if (isEdit) {
            projects.forEach(function(p) {
                if (p.assignedWorkers && p.assignedWorkers.includes(worker.id)) {
                    assignedProjects.push(p.id);
                }
            });
        }

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="modal" style="max-width:600px;max-height:90vh;overflow-y:auto">
                <h3>${isEdit ? 'Edit Worker' : 'Add Worker'}</h3>
                <form id="workerModalForm" novalidate>
                    <div class="form-group" style="margin-bottom:12px">
                        <label>Worker Name *</label>
                        <input name="name" value="${esc(worker ? worker.name : '')}" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Role *</label>
                            <select name="role">
                                <option value="Worker" ${(!worker || worker.role === 'Worker') ? 'selected' : ''}>Worker</option>
                                <option value="Approver" ${worker && worker.role === 'Approver' ? 'selected' : ''}>Approver</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select name="status">
                                <option value="Active" ${(!worker || worker.status === 'Active') ? 'selected' : ''}>Active</option>
                                <option value="Inactive" ${worker && worker.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>PIN (4-6 digits) *</label>
                            <div style="position:relative">
                                <input name="pin" id="workerPinInput" type="password" pattern="[0-9]{4,6}" minlength="4" maxlength="6" inputmode="numeric" value="${esc(worker ? worker.pin : '')}" required style="padding-right:50px">
                                <button type="button" id="togglePinVisibility" class="btn-ghost btn-sm" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:.75rem">Show</button>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Default Hourly Rate ($)</label>
                            <input type="number" name="defaultRate" step="0.01" min="0" value="${worker ? worker.defaultRate || '' : ''}" placeholder="Optional">
                        </div>
                    </div>
                    ${projects.length > 0 ? `
                    <div class="form-group" style="margin-bottom:12px">
                        <label>Assign to Projects</label>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
                            ${projects.map(function(p) {
                                const checked = assignedProjects.includes(p.id) ? ' checked' : '';
                                return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:.9rem">' +
                                    '<input type="checkbox" class="project-checkbox" value="' + p.id + '"' + checked + '> ' +
                                    esc(p.name) +
                                '</label>';
                            }).join('')}
                        </div>
                    </div>` : ''}
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Add'} Worker</button>
                        <button type="button" class="btn-secondary modal-close">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(overlay);

        // Toggle PIN visibility
        overlay.querySelector('#togglePinVisibility').addEventListener('click', function() {
            const pinInput = overlay.querySelector('#workerPinInput');
            if (pinInput.type === 'password') {
                pinInput.type = 'text';
                this.textContent = 'Hide';
            } else {
                pinInput.type = 'password';
                this.textContent = 'Show';
            }
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });
        overlay.querySelector('.modal-close').addEventListener('click', function() {
            overlay.remove();
        });

        overlay.querySelector('#workerModalForm').addEventListener('submit', function(e) {
            e.preventDefault();
            if (!Utils.validateForm(this)) return;
            const fd = Utils.getFormData(this);
            if (!fd.name.trim()) {
                Utils.showToast('Worker name is required', 'error');
                return;
            }
            if (!fd.pin || fd.pin.length < 4 || fd.pin.length > 6 || !/^\d+$/.test(fd.pin)) {
                Utils.showToast('PIN must be 4-6 digits', 'error');
                return;
            }
            // Check for duplicate PIN
            const existingPinWorker = AppData.getWorkers().find(function(w) {
                return w.pin === fd.pin && (!isEdit || w.id !== worker.id);
            });
            if (existingPinWorker) {
                Utils.showToast('This PIN is already used by ' + existingPinWorker.name, 'error');
                return;
            }

            const workerData = {
                id: isEdit ? worker.id : AppData.generateId(),
                name: fd.name.trim(),
                role: fd.role || 'Worker',
                pin: fd.pin,
                status: fd.status || 'Active',
                defaultRate: parseFloat(fd.defaultRate) || 0
            };
            AppData.saveWorker(workerData);

            // Update project assignments
            const selectedProjects = [];
            overlay.querySelectorAll('.project-checkbox:checked').forEach(function(cb) {
                selectedProjects.push(cb.value);
            });
            const allProjects = AppData.getProjects();
            allProjects.forEach(function(p) {
                const assigned = p.assignedWorkers || [];
                const isAssigned = assigned.includes(workerData.id);
                const shouldBeAssigned = selectedProjects.includes(p.id);
                if (shouldBeAssigned && !isAssigned) {
                    p.assignedWorkers = assigned.concat([workerData.id]);
                    AppData.saveProject(p);
                } else if (!shouldBeAssigned && isAssigned) {
                    p.assignedWorkers = assigned.filter(function(wid) { return wid !== workerData.id; });
                    AppData.saveProject(p);
                }
            });

            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, isEdit ? 'Worker Updated' : 'Worker Added', workerData.name + ' (' + workerData.role + ')');
            Utils.showToast(isEdit ? 'Worker updated' : 'Worker added');
            overlay.remove();
            self._renderList();
        });
    },

    _startWizard() {
        const self = this;
        const projects = AppData.getProjects();
        const esc = Utils.escapeHtml;
        let step = 0;
        const totalSteps = 3;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay._wizData = {};

        function renderStep() {
            let html = '<div class="modal" style="max-width:550px"><h3>Add Worker - Step ' + (step + 1) + ' of ' + totalSteps + '</h3>';
            html += '<div style="background:var(--border);height:4px;border-radius:2px;margin-bottom:16px"><div style="background:var(--accent);height:100%;border-radius:2px;width:' + ((step + 1) / totalSteps * 100) + '%"></div></div>';

            if (step === 0) {
                html += '<p style="color:var(--text2);margin-bottom:12px">What is the worker\'s name and role?</p>' +
                    '<div class="form-group" style="margin-bottom:12px"><label>Worker Name *</label><input id="wiz-name" value="' + esc(overlay._wizData.name || '') + '" required></div>' +
                    '<div class="form-group" style="margin-bottom:12px"><label>Role</label><select id="wiz-role">' +
                    '<option value="Worker"' + (overlay._wizData.role !== 'Approver' ? ' selected' : '') + '>Worker</option>' +
                    '<option value="Approver"' + (overlay._wizData.role === 'Approver' ? ' selected' : '') + '>Approver</option></select></div>';
            } else if (step === 1) {
                html += '<p style="color:var(--text2);margin-bottom:12px">Set a PIN for this worker to log in with. This should be 4 to 6 digits.</p>' +
                    '<div class="form-group" style="margin-bottom:12px"><label>PIN (4-6 digits) *</label>' +
                    '<div style="position:relative"><input id="wiz-pin" type="password" pattern="[0-9]{4,6}" minlength="4" maxlength="6" inputmode="numeric" value="' + esc(overlay._wizData.pin || '') + '" style="padding-right:50px">' +
                    '<button type="button" id="wiz-toggle-pin" class="btn-ghost btn-sm" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:.75rem">Show</button></div></div>' +
                    '<div class="form-group" style="margin-bottom:12px"><label>Default Hourly Rate ($)</label>' +
                    '<input type="number" id="wiz-rate" step="0.01" min="0" value="' + (overlay._wizData.defaultRate || '') + '" placeholder="Optional"></div>';
            } else if (step === 2) {
                html += '<p style="color:var(--text2);margin-bottom:12px">Assign this worker to projects (optional).</p>';
                if (projects.length === 0) {
                    html += '<p style="color:var(--text2)">No projects created yet. You can assign projects later.</p>';
                } else {
                    html += '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
                        projects.map(function(p) {
                            const checked = overlay._wizData.projects && overlay._wizData.projects.includes(p.id) ? ' checked' : '';
                            return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" class="wiz-project" value="' + p.id + '"' + checked + '> ' + esc(p.name) + '</label>';
                        }).join('') + '</div>';
                }
            }

            html += '<div class="form-actions" style="justify-content:space-between"><div>';
            if (step > 0) html += '<button class="btn-secondary" id="wizPrev">Previous</button>';
            html += '</div><div style="display:flex;gap:8px">';
            html += '<button class="btn-ghost" id="wizCancel">Cancel</button>';
            html += '<button class="btn-primary" id="wizNext">' + (step < totalSteps - 1 ? 'Next' : 'Add Worker') + '</button>';
            html += '</div></div></div>';

            overlay.innerHTML = html;
            var modal = overlay.querySelector('.modal');
            if (modal) { modal.style.transition = 'none'; modal.style.transform = 'none'; }
            bindEvents();
        }

        function bindEvents() {
            overlay.querySelector('#wizCancel').addEventListener('click', function() { overlay.remove(); });
            if (overlay.querySelector('#wizPrev')) {
                overlay.querySelector('#wizPrev').addEventListener('click', function() {
                    saveCurrentStep();
                    step--;
                    renderStep();
                });
            }
            // PIN toggle
            var toggleBtn = overlay.querySelector('#wiz-toggle-pin');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', function() {
                    var pinInput = overlay.querySelector('#wiz-pin');
                    if (pinInput.type === 'password') {
                        pinInput.type = 'text';
                        toggleBtn.textContent = 'Hide';
                    } else {
                        pinInput.type = 'password';
                        toggleBtn.textContent = 'Show';
                    }
                });
            }

            overlay.querySelector('#wizNext').addEventListener('click', function() {
                if (step === 0) {
                    var name = overlay.querySelector('#wiz-name').value.trim();
                    if (!name) { Utils.showToast('Worker name is required', 'error'); return; }
                }
                if (step === 1) {
                    var pin = overlay.querySelector('#wiz-pin').value;
                    if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
                        Utils.showToast('PIN must be 4-6 digits', 'error');
                        return;
                    }
                    var existing = AppData.getWorkers().find(function(w) { return w.pin === pin; });
                    if (existing) {
                        Utils.showToast('This PIN is already in use by ' + existing.name, 'error');
                        return;
                    }
                }
                saveCurrentStep();
                if (step < totalSteps - 1) {
                    step++;
                    renderStep();
                } else {
                    // Create worker
                    var d = overlay._wizData;
                    var workerData = {
                        id: AppData.generateId(),
                        name: d.name,
                        role: d.role || 'Worker',
                        pin: d.pin,
                        status: 'Active',
                        defaultRate: parseFloat(d.defaultRate) || 0
                    };
                    AppData.saveWorker(workerData);

                    // Assign to projects
                    var selectedProjects = d.projects || [];
                    selectedProjects.forEach(function(pid) {
                        var project = AppData.getProject(pid);
                        if (project) {
                            var assigned = project.assignedWorkers || [];
                            if (!assigned.includes(workerData.id)) {
                                project.assignedWorkers = assigned.concat([workerData.id]);
                                AppData.saveProject(project);
                            }
                        }
                    });

                    var username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                    AppData.addAuditLog(username, 'Worker Added', workerData.name + ' (' + workerData.role + ') (via wizard)');
                    Utils.showToast('Worker added!');
                    overlay.remove();
                    self._renderList();
                }
            });
        }

        function saveCurrentStep() {
            if (step === 0) {
                overlay._wizData.name = overlay.querySelector('#wiz-name').value.trim();
                overlay._wizData.role = overlay.querySelector('#wiz-role').value;
            } else if (step === 1) {
                overlay._wizData.pin = overlay.querySelector('#wiz-pin').value;
                overlay._wizData.defaultRate = overlay.querySelector('#wiz-rate').value;
            } else if (step === 2) {
                overlay._wizData.projects = [];
                overlay.querySelectorAll('.wiz-project:checked').forEach(function(cb) {
                    overlay._wizData.projects.push(cb.value);
                });
            }
        }

        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
        renderStep();
    }
};
