// Admin Notifications Module
// Shows service alerts and other system notifications for admin and supervisors.

window.AdminNotifications = {
    render(container) {
        const self = this;
        self._container = container;
        self._renderList();
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const esc = Utils.escapeHtml;
        const notifications = (AppData.getNotifications ? AppData.getNotifications() : [])
            .slice()
            .sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

        const unresolved = notifications.filter(function(n) { return !n.resolved; });
        const resolved   = notifications.filter(function(n) { return n.resolved; });

        function typeIcon(type) {
            if (type === 'service_due')  return '🔧';
            if (type === 'service_overdue') return '⚠️';
            return '🔔';
        }

        function renderCard(n) {
            var age = n.createdAt ? Utils.formatDate(n.createdAt.slice(0, 10)) : '';
            var eqItem = n.equipmentId && AppData.getEquipmentItem ? AppData.getEquipmentItem(n.equipmentId) : null;
            var totalHours = 0;
            if (eqItem && AppData.getEquipmentLogs) {
                AppData.getEquipmentLogs().filter(function(l) { return l.equipmentId === eqItem.id; })
                    .forEach(function(l) { totalHours += parseFloat(l.hours) || 0; });
            }

            return '<div class="card" style="margin-bottom:10px;border-left:3px solid ' + (n.resolved ? 'var(--border)' : 'var(--accent)') + ';opacity:' + (n.resolved ? '0.6' : '1') + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">' +
                    '<div style="display:flex;gap:12px;align-items:flex-start">' +
                        '<span style="font-size:1.4rem;line-height:1">' + typeIcon(n.type) + '</span>' +
                        '<div>' +
                            '<div style="font-weight:600;margin-bottom:2px">' + esc(n.title || 'Notification') + '</div>' +
                            '<div style="color:var(--text2);font-size:.88rem;margin-bottom:4px">' + esc(n.message || '') + '</div>' +
                            (eqItem && !n.resolved ? '<div style="font-size:.8rem;color:var(--text2)">Cumulative hours: <strong>' + totalHours.toFixed(1) + '</strong> / ' + (eqItem.serviceIntervalHours || '?') + ' hr interval</div>' : '') +
                            '<div style="font-size:.75rem;color:var(--text2);margin-top:4px">' + age + (n.emailSent ? ' · Email sent ✓' : '') + '</div>' +
                        '</div>' +
                    '</div>' +
                    (!n.resolved
                        ? '<div style="display:flex;gap:6px;flex-shrink:0">' +
                            (n.equipmentId
                                ? '<button class="btn btn-sm resolve-service" data-id="' + esc(n.id) + '" data-eqid="' + esc(n.equipmentId) + '" style="border:1px solid var(--success);color:var(--success);white-space:nowrap">✓ Mark Serviced</button>'
                                : '') +
                            '<button class="btn btn-sm dismiss-notif" data-id="' + esc(n.id) + '" style="color:var(--text2)">Dismiss</button>' +
                          '</div>'
                        : '<span style="font-size:.75rem;color:var(--text2);white-space:nowrap">Resolved</span>'
                    ) +
                '</div>' +
            '</div>';
        }

        container.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">' +
                '<h2>Notifications' + (unresolved.length > 0 ? ' <span style="font-size:.85rem;background:var(--accent);color:#fff;border-radius:20px;padding:2px 8px;vertical-align:middle">' + unresolved.length + '</span>' : '') + '</h2>' +
                (unresolved.length > 0 ? '<button class="btn-secondary btn-sm" id="dismissAllBtn">Dismiss All</button>' : '') +
            '</div>' +

            (unresolved.length === 0 && resolved.length === 0
                ? '<div class="card" style="text-align:center;padding:40px;color:var(--text2)">No notifications yet. Service alerts will appear here when equipment reaches its service interval.</div>'
                : (unresolved.length > 0
                    ? '<div style="font-size:.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Action Required</div>' +
                      unresolved.map(renderCard).join('')
                    : '') +
                  (resolved.length > 0
                    ? '<div style="font-size:.75rem;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin:16px 0 8px">Resolved</div>' +
                      resolved.slice(0, 10).map(renderCard).join('')
                    : ''));

        // Dismiss all
        var dismissAllBtn = container.querySelector('#dismissAllBtn');
        if (dismissAllBtn) {
            dismissAllBtn.addEventListener('click', async function() {
                var confirmed = await Utils.confirm('Dismiss all unresolved notifications?');
                if (!confirmed) return;
                unresolved.forEach(function(n) {
                    n.resolved = true;
                    if (AppData.saveNotification) AppData.saveNotification(n);
                });
                AdminNotifications._updateBadge();
                self._renderList();
            });
        }

        // Dismiss single
        container.querySelectorAll('.dismiss-notif').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var n = AppData.getNotification ? AppData.getNotification(btn.dataset.id) : null;
                if (!n) return;
                n.resolved = true;
                if (AppData.saveNotification) AppData.saveNotification(n);
                AdminNotifications._updateBadge();
                self._renderList();
            });
        });

        // Mark serviced (resets equipment logs + resolves notification)
        container.querySelectorAll('.resolve-service').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var n = AppData.getNotification ? AppData.getNotification(btn.dataset.id) : null;
                var eqId = btn.dataset.eqid;
                var eqItem = eqId && AppData.getEquipmentItem ? AppData.getEquipmentItem(eqId) : null;
                if (!eqItem) return;
                var confirmed = await Utils.confirm('Mark "' + eqItem.name + '" as serviced? This resets the hour counter.');
                if (!confirmed) return;
                // Reset equipment logs for this equipment
                var logs = AppData.getEquipmentLogs ? AppData.getEquipmentLogs() : [];
                logs.filter(function(l) { return l.equipmentId === eqId; })
                    .forEach(function(l) { if (AppData.deleteEquipmentLog) AppData.deleteEquipmentLog(l.id); });
                eqItem.alertSent = false;
                eqItem.lastServicedAt = new Date().toISOString();
                AppData.saveEquipment(eqItem);
                // Resolve all notifications for this equipment
                (AppData.getNotifications ? AppData.getNotifications() : [])
                    .filter(function(x) { return x.equipmentId === eqId && !x.resolved; })
                    .forEach(function(x) { x.resolved = true; if (AppData.saveNotification) AppData.saveNotification(x); });
                var username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'Equipment Serviced', eqItem.name + ' — hour counter reset via notification');
                Utils.showToast('✓ Service logged. Hour counter reset for ' + eqItem.name);
                AdminNotifications._updateBadge();
                self._renderList();
            });
        });
    },

    // Update the nav badge count
    _updateBadge() {
        var count = (AppData.getNotifications ? AppData.getNotifications() : []).filter(function(n) { return !n.resolved; }).length;
        var badge = document.getElementById('notifBadge');
        if (badge) {
            badge.textContent = count > 0 ? count : '';
            badge.style.display = count > 0 ? '' : 'none';
        }
    }
};
