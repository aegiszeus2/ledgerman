// Admin Equipment Module
// Manages company equipment: cost rates, charge-out rates, and status.
// Equipment logs (utilization per time entry) are stored as 'equipmentLogs' entities.

window.AdminEquipment = {
    _filter: '',

    render(container, params) {
        const self = this;
        self._container = container;
        self._renderList();
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const equipment = AppData.getEquipment();
        const filter = self._filter.toLowerCase();
        const filtered = filter
            ? equipment.filter(function(e) {
                return (e.name || '').toLowerCase().includes(filter) ||
                    (e.type || '').toLowerCase().includes(filter) ||
                    (e.status || '').toLowerCase().includes(filter);
            })
            : equipment;

        const esc = Utils.escapeHtml;

        function fmtRate(val) {
            var n = parseFloat(val);
            return isNaN(n) ? '—' : '$' + n.toFixed(2);
        }

        function statusBadge(status) {
            var cls = (status === 'Active') ? 'color:var(--success);background:rgba(46,204,113,.12)' : 'color:var(--text2);background:var(--bg2)';
            return '<span style="font-size:.75rem;font-weight:600;padding:2px 8px;border-radius:20px;' + cls + '">' + esc(status || 'Active') + '</span>';
        }

        // Compute total hours per equipment from logs
        const allLogs = AppData.getEquipmentLogs ? AppData.getEquipmentLogs() : [];
        const hoursById = {};
        allLogs.forEach(function(l) {
            if (l.equipmentId) hoursById[l.equipmentId] = (hoursById[l.equipmentId] || 0) + (parseFloat(l.hours) || 0);
        });

        var rows = filtered.length === 0
            ? '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text2)">' +
              (equipment.length === 0
                ? 'No equipment yet. Click <strong>+ Add Equipment</strong> to get started.'
                : 'No equipment matches your search.') +
              '</td></tr>'
            : filtered.map(function(e) {
                var cost = parseFloat(e.costRate) || 0;
                var charge = parseFloat(e.chargeOutRate) || 0;
                var margin = charge - cost;
                var marginStr = (cost > 0 || charge > 0)
                    ? '<span style="color:' + (margin >= 0 ? 'var(--success)' : 'var(--accent)') + '">' +
                      (margin >= 0 ? '+' : '') + '$' + margin.toFixed(2) + '/hr</span>'
                    : '—';
                var totalHours = hoursById[e.id] || 0;
                var interval = e.serviceIntervalHours ? parseInt(e.serviceIntervalHours) : null;
                var serviceStr = '—';
                var serviceAlert = false;
                if (interval) {
                    var pct = Math.min(100, Math.round(totalHours / interval * 100));
                    serviceAlert = totalHours >= interval;
                    serviceStr = (serviceAlert
                        ? '<span style="color:var(--accent);font-weight:700">⚠ ' + totalHours.toFixed(1) + '/' + interval + ' hrs</span>'
                        : '<span style="color:' + (pct >= 80 ? 'var(--amber,#f59e0b)' : 'var(--text2)') + '">' + totalHours.toFixed(1) + '/' + interval + ' hrs (' + pct + '%)</span>');
                }
                return '<tr>' +
                    '<td style="font-weight:500">' + esc(e.name || '') + (serviceAlert ? ' <span style="color:var(--accent);font-size:.75rem">⚠ SERVICE DUE</span>' : '') + '</td>' +
                    '<td style="color:var(--text2)">' + esc(e.type || '—') + '</td>' +
                    '<td>' + statusBadge(e.status) + '</td>' +
                    '<td>' + fmtRate(e.costRate) + '</td>' +
                    '<td>' + fmtRate(e.chargeOutRate) + '</td>' +
                    '<td>' + marginStr + '</td>' +
                    '<td>' + serviceStr + '</td>' +
                    '<td style="white-space:nowrap">' +
                        (serviceAlert ? '<button class="btn btn-sm reset-service" data-id="' + esc(e.id) + '" style="color:var(--success);margin-right:4px;border:1px solid var(--success)">✓ Reset</button>' : '') +
                        '<button class="btn btn-secondary btn-sm edit-equipment" data-id="' + esc(e.id) + '" style="margin-right:4px">Edit</button>' +
                        '<button class="btn btn-sm delete-equipment" data-id="' + esc(e.id) + '" style="color:var(--accent)">Delete</button>' +
                    '</td>' +
                '</tr>';
            }).join('');

        container.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">' +
                '<h2>Equipment Management</h2>' +
                '<div style="display:flex;gap:8px">' +
                    '<button class="btn-secondary btn-sm" id="eqExportCsvBtn">Export CSV</button>' +
                    '<button class="btn-primary" id="addEquipmentBtn">+ Add Equipment</button>' +
                '</div>' +
            '</div>' +

            '<div style="margin-bottom:12px">' +
                '<input class="form-control" id="equipmentSearch" type="search" placeholder="Search equipment…" value="' + esc(self._filter) + '" style="max-width:320px">' +
            '</div>' +

            '<div style="overflow-x:auto">' +
                '<table style="width:100%;border-collapse:collapse;font-size:.9rem">' +
                    '<thead>' +
                        '<tr style="border-bottom:2px solid var(--border);text-align:left">' +
                            '<th style="padding:8px 12px 8px 0">Name</th>' +
                            '<th style="padding:8px 12px">Type</th>' +
                            '<th style="padding:8px 12px">Status</th>' +
                            '<th style="padding:8px 12px">Cost Rate</th>' +
                            '<th style="padding:8px 12px">Charge-Out Rate</th>' +
                            '<th style="padding:8px 12px">Margin</th>' +
                            '<th style="padding:8px 12px">Service Hours</th>' +
                            '<th style="padding:8px 12px">Actions</th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tbody>' + rows + '</tbody>' +
                '</table>' +
            '</div>' +

            '<div style="margin-top:16px;padding:12px;background:var(--bg2);border-radius:var(--radius);font-size:.8rem;color:var(--text2)">' +
                '<strong>Cost Rate</strong> — what the equipment costs you to operate ($/hr). ' +
                '<strong>Charge-Out Rate</strong> — what you bill the client for equipment use ($/hr). ' +
                'Workers log equipment hours on time entries; costs and revenue are tracked per project.' +
            '</div>';

        // CSV export
        container.querySelector('#eqExportCsvBtn').addEventListener('click', function() {
            var rows = [['Name', 'Type', 'Status', 'Cost Rate ($/hr)', 'Charge-Out Rate ($/hr)', 'Notes'].join(',')];
            filtered.forEach(function(e) {
                rows.push([
                    e.name || '', e.type || '', e.status || 'Active',
                    e.costRate || '0', e.chargeOutRate || '0', e.notes || ''
                ].map(function(v) {
                    var s = String(v);
                    return (s.includes(',') || s.includes('"') || s.includes('\n'))
                        ? '"' + s.replace(/"/g, '""') + '"' : s;
                }).join(','));
            });
            var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'ledgerman-equipment-' + new Date().toISOString().slice(0, 10) + '.csv';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        });

        container.querySelector('#addEquipmentBtn').addEventListener('click', function() {
            self._showModal(null);
        });

        container.querySelector('#equipmentSearch').addEventListener('input', Utils.debounce(function(e) {
            self._filter = e.target.value;
            self._renderList();
        }, 250));

        container.querySelectorAll('.edit-equipment').forEach(function(btn) {
            btn.addEventListener('click', function() { self._showModal(btn.dataset.id); });
        });

        container.querySelectorAll('.delete-equipment').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var item = AppData.getEquipmentItem(btn.dataset.id);
                if (!item) return;
                var confirmed = await Utils.confirm('Delete "' + item.name + '"? This cannot be undone.');
                if (!confirmed) return;
                AppData.deleteEquipment(btn.dataset.id);
                var username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'Equipment Deleted', item.name);
                Utils.showToast('Equipment deleted');
                self._renderList();
            });
        });

        // Reset service — clears accumulated hour logs and alert flag for this equipment
        container.querySelectorAll('.reset-service').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var item = AppData.getEquipmentItem(btn.dataset.id);
                if (!item) return;
                var confirmed = await Utils.confirm('Mark "' + item.name + '" as serviced? This resets the hour counter and clears the service alert.');
                if (!confirmed) return;
                // Delete all equipmentLogs for this equipment to reset counter
                var logs = AppData.getEquipmentLogs ? AppData.getEquipmentLogs() : [];
                logs.filter(function(l) { return l.equipmentId === item.id; })
                    .forEach(function(l) { if (AppData.deleteEquipmentLog) AppData.deleteEquipmentLog(l.id); });
                // Reset alert flag
                item.alertSent = false;
                item.lastServicedAt = new Date().toISOString();
                try {
                    await AppData.saveEquipmentAsync(item);
                } catch (e) {
                    Utils.showToast('Failed to save service reset: ' + e.message, 'error');
                    return;
                }
                // Dismiss any open notifications for this equipment
                var notifs = AppData.getNotifications ? AppData.getNotifications() : [];
                notifs.filter(function(n) { return n.equipmentId === item.id && !n.resolved; })
                    .forEach(function(n) { n.resolved = true; if (AppData.saveNotification) AppData.saveNotification(n); });
                var username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'Equipment Serviced', item.name + ' — hour counter reset');
                Utils.showToast('✓ Service logged. Hour counter reset for ' + item.name);
                self._renderList();
            });
        });
    },

    _showModal(editId) {
        const self = this;
        const item = editId ? AppData.getEquipmentItem(editId) : null;
        const isEdit = !!item;
        const esc = Utils.escapeHtml;

        const TYPES = [
            'Excavator', 'Backhoe', 'Loader', 'Bulldozer', 'Grader', 'Compactor',
            'Crane', 'Drill', 'Generator', 'Pump', 'Truck', 'Trailer',
            'Skid Steer', 'Telehandler', 'Forklift', 'Other'
        ];

        function opt(val, label, selected) {
            return '<option value="' + esc(val) + '"' + (selected ? ' selected' : '') + '>' + esc(label) + '</option>';
        }

        const bodyHtml =
            '<form id="equipmentModalForm" novalidate>' +

                '<div style="font-size:.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px">Equipment Details</div>' +
                '<div class="form-row" style="margin-bottom:12px">' +
                    '<div class="form-group">' +
                        '<label>Equipment Name *</label>' +
                        '<input class="form-control" name="name" value="' + esc(item ? item.name : '') + '" placeholder="e.g. CAT 320 Excavator" required>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Type</label>' +
                        '<select class="form-control" name="type">' +
                            '<option value="">— Select type —</option>' +
                            TYPES.map(function(t) { return opt(t, t, item && item.type === t); }).join('') +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<div class="form-row" style="margin-bottom:12px">' +
                    '<div class="form-group">' +
                        '<label>Status</label>' +
                        '<select class="form-control" name="status">' +
                            opt('Active',   'Active',   !item || item.status === 'Active') +
                            opt('Inactive', 'Inactive', item && item.status === 'Inactive') +
                        '</select>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Unit</label>' +
                        '<select class="form-control" name="unit">' +
                            opt('hr',  'Hourly ($/hr)', !item || item.unit === 'hr' || !item.unit) +
                            opt('day', 'Daily ($/day)', item && item.unit === 'day') +
                        '</select>' +
                    '</div>' +
                '</div>' +

                '<div style="font-size:.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin:12px 0 4px;border-top:1px solid var(--border);padding-top:12px">Rates</div>' +
                '<div class="form-row" style="margin-bottom:4px">' +
                    '<div class="form-group">' +
                        '<label>Cost Rate *</label>' +
                        '<input class="form-control" type="number" name="costRate" step="0.01" min="0" value="' + (item ? item.costRate || '' : '') + '" placeholder="0.00" required>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Charge-Out Rate *</label>' +
                        '<input class="form-control" type="number" name="chargeOutRate" step="0.01" min="0" value="' + (item ? item.chargeOutRate || '' : '') + '" placeholder="0.00" required>' +
                    '</div>' +
                '</div>' +
                '<p style="font-size:.75rem;color:var(--text2);margin:0 0 16px">' +
                    '<strong>Cost Rate</strong> — what operating this equipment costs you internally.<br>' +
                    '<strong>Charge-Out Rate</strong> — what you bill the client per unit of use.' +
                '</p>' +

                '<div style="font-size:.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin:12px 0 4px;border-top:1px solid var(--border);padding-top:12px">Service Interval</div>' +
                '<div class="form-row" style="margin-bottom:4px">' +
                    '<div class="form-group">' +
                        '<label>Service Interval (hours)</label>' +
                        '<input class="form-control" type="number" name="serviceIntervalHours" step="1" min="0" value="' + (item && item.serviceIntervalHours ? item.serviceIntervalHours : '') + '" placeholder="e.g. 250">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Assigned Supervisor</label>' +
                        '<select class="form-control" name="supervisorId">' +
                            '<option value="">— None —</option>' +
                            AppData.getWorkers().filter(function(w) { return w.role === 'Supervisor' || w.role === 'Approver'; }).map(function(w) {
                                return opt(w.id, w.name + ' (' + w.role + ')', item && item.supervisorId === w.id);
                            }).join('') +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<p style="font-size:.75rem;color:var(--text2);margin:0 0 16px">' +
                    '<strong>Service Interval</strong> — total hours before a service alert is sent to the admin and assigned supervisor via email.<br>' +
                    'Leave blank to disable automatic service alerts.' +
                '</p>' +

                '<div style="font-size:.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px;border-top:1px solid var(--border);padding-top:12px">Notes</div>' +
                '<div class="form-group" style="margin-bottom:0">' +
                    '<textarea class="form-control" name="notes" rows="2" placeholder="Serial number, license plate, maintenance notes…">' + esc(item ? item.notes || '' : '') + '</textarea>' +
                '</div>' +

            '</form>';

        const modal = UI.modal(
            isEdit ? 'Edit Equipment' : 'Add Equipment',
            bodyHtml,
            { width: '560px', submitLabel: (isEdit ? 'Update' : 'Add') + ' Equipment' }
        );
        const q = s => modal.q(s);

        q('#equipmentModalForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            var fd = Utils.getFormData(this);

            if (!fd.name || !fd.name.trim()) {
                Utils.showToast('Equipment name is required', 'error'); return;
            }
            if (fd.costRate === '' || isNaN(parseFloat(fd.costRate)) || parseFloat(fd.costRate) < 0) {
                Utils.showToast('Enter a valid cost rate (0 or more)', 'error'); return;
            }
            if (fd.chargeOutRate === '' || isNaN(parseFloat(fd.chargeOutRate)) || parseFloat(fd.chargeOutRate) < 0) {
                Utils.showToast('Enter a valid charge-out rate (0 or more)', 'error'); return;
            }

            var equipmentData = {
                id:                   isEdit ? item.id : AppData.generateId(),
                name:                 fd.name.trim(),
                type:                 fd.type || '',
                status:               fd.status || 'Active',
                unit:                 fd.unit || 'hr',
                costRate:             parseFloat(fd.costRate) || 0,
                chargeOutRate:        parseFloat(fd.chargeOutRate) || 0,
                serviceIntervalHours: fd.serviceIntervalHours ? parseInt(fd.serviceIntervalHours) : null,
                supervisorId:         fd.supervisorId || null,
                alertSent:            isEdit ? (item.alertSent || false) : false,
                notes:                (fd.notes || '').trim(),
                updatedAt:            new Date().toISOString(),
                createdAt:            isEdit ? (item.createdAt || new Date().toISOString()) : new Date().toISOString()
            };

            const restore = UI.btnLoading(modal.submitBtn, 'Saving…');
            try {
                await AppData.saveEntityAsync('equipment', equipmentData);
            } catch(err) {
                restore();
                Utils.showToast('Save failed: ' + err.message, 'error');
                return;
            }
            var username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, isEdit ? 'Equipment Updated' : 'Equipment Added', equipmentData.name);
            Utils.showToast(isEdit ? 'Equipment updated' : 'Equipment added');
            modal.close();
            self._renderList();
        });

        if (modal.submitBtn) modal.submitBtn.addEventListener('click', () => q('#equipmentModalForm').requestSubmit());
    }
};
