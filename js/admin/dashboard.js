// Admin Dashboard Module
window.AdminDashboard = {
    render(container) {
        const projects = AppData.getProjects();
        const activeJobs = projects.filter(p => p.status === 'Active');
        const pending = AppData.getPendingSubmissions();
        const invoices = AppData.getInvoices();
        const payments = AppData.getPayments();
        const auditLog = AppData.getAuditLog();
        const settings = AppData.getSettings();

        // Calculate outstanding invoices total
        let outstandingTotal = 0;
        let overdueCount = 0;
        const today = new Date();
        for (const inv of invoices) {
            const invPayments = payments.filter(p => p.invoiceId === inv.id);
            const paid = invPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
            const balance = (parseFloat(inv.total) || 0) - paid;
            if (balance > 0.01) {
                outstandingTotal += balance;
                if (inv.status === 'Overdue' || (inv.dueDate && new Date(inv.dueDate) < today && inv.status !== 'Paid')) {
                    overdueCount++;
                }
            }
        }

        const recentLogs = auditLog.slice(-10).reverse();
        const showBackupReminder = AppData.shouldRemindBackup();

        container.innerHTML = `
            ${showBackupReminder ? `
            <div class="card" style="border-color:var(--warn);background:rgba(243,156,18,.1)">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                    <span style="font-size:1.4rem">&#9888;</span>
                    <div style="flex:1">
                        <strong style="color:var(--warn)">Backup Reminder</strong>
                        <p style="font-size:.85rem;color:var(--text2);margin-top:4px">It has been more than 30 days since your last data backup. Regular backups protect against data loss.</p>
                    </div>
                    <button class="btn-primary btn-sm" id="dashBackupBtn">Back Up Now</button>
                </div>
            </div>` : ''}

            <h2 style="margin-bottom:16px">Dashboard</h2>

            <div class="dashboard-stats">
                <div class="stat-card stat-revenue">
                    <div class="stat-value" style="color:var(--amber)">${activeJobs.length}</div>
                    <div class="stat-label">Active Jobs</div>
                </div>
                <div class="stat-card stat-pending">
                    <div class="stat-value" style="color:var(--warning)">
                        ${pending.length}
                        ${pending.length > 0 ? `<span class="nav-badge" style="display:inline;vertical-align:super;margin-left:4px">${pending.length}</span>` : ''}
                    </div>
                    <div class="stat-label">Pending Approvals</div>
                </div>
                <div class="stat-card stat-approved">
                    <div class="stat-value" style="color:var(--success)">${Utils.formatCurrency(outstandingTotal)}</div>
                    <div class="stat-label">Outstanding Invoices</div>
                </div>
                <div class="stat-card stat-overdue">
                    <div class="stat-value" style="color:${overdueCount > 0 ? 'var(--danger)' : 'var(--text-primary)'}">${overdueCount}</div>
                    <div class="stat-label">Overdue Payments</div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">Quick Actions</div>
                <div class="card-body">
                    <div class="quick-actions">
                        <button class="btn btn-primary" id="dashNewProject">+ New Project</button>
                        <button class="btn btn-secondary" id="dashApprovals" style="${pending.length > 0 ? 'background:var(--warning);color:#000' : ''}">
                            Pending Approvals${pending.length > 0 ? ' (' + pending.length + ')' : ''}
                        </button>
                        <button class="btn btn-secondary" id="dashNewInvoice">New Invoice</button>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">Recent Activity</div>
                <div class="card-body">
                ${recentLogs.length === 0
                    ? '<p style="color:var(--text-muted);font-size:.9rem">No recent activity recorded.</p>'
                    : `<table class="table">
                        <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
                        <tbody>
                            ${recentLogs.map(log => `<tr>
                                <td style="font-size:.8rem;white-space:nowrap">${Utils.escapeHtml(Utils.formatDateTime(log.timestamp))}</td>
                                <td>${Utils.escapeHtml(log.user || 'System')}</td>
                                <td>${Utils.escapeHtml(log.action)}</td>
                                <td style="font-size:.85rem;color:var(--text-muted)">${Utils.escapeHtml(log.details || '')}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>`
                }
                </div>
            </div>
        `;

        // Bind quick action buttons
        container.querySelector('#dashNewProject').addEventListener('click', function() {
            window.App.navigate('projects');
        });
        container.querySelector('#dashApprovals').addEventListener('click', function() {
            window.App.navigate('approvals');
        });
        container.querySelector('#dashNewInvoice').addEventListener('click', function() {
            window.App.navigate('invoices');
        });

        const backupBtn = container.querySelector('#dashBackupBtn');
        if (backupBtn) {
            backupBtn.addEventListener('click', function() {
                window.App.navigate('settings');
            });
        }
    }
};
