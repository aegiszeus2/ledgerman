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

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
                <div class="card" style="text-align:center">
                    <div style="font-size:2rem;font-weight:700;color:var(--accent)">${activeJobs.length}</div>
                    <div style="font-size:.85rem;color:var(--text2)">Active Jobs</div>
                </div>
                <div class="card" style="text-align:center">
                    <div style="font-size:2rem;font-weight:700;color:var(--warn)">
                        ${pending.length}
                        ${pending.length > 0 ? `<span style="background:var(--accent);color:#fff;font-size:.7rem;padding:2px 8px;border-radius:12px;vertical-align:super;margin-left:4px">${pending.length}</span>` : ''}
                    </div>
                    <div style="font-size:.85rem;color:var(--text2)">Pending Approvals</div>
                </div>
                <div class="card" style="text-align:center">
                    <div style="font-size:2rem;font-weight:700;color:var(--success)">${Utils.formatCurrency(outstandingTotal)}</div>
                    <div style="font-size:.85rem;color:var(--text2)">Outstanding Invoices</div>
                </div>
                <div class="card" style="text-align:center">
                    <div style="font-size:2rem;font-weight:700;color:${overdueCount > 0 ? 'var(--accent)' : 'var(--text)'}">${overdueCount}</div>
                    <div style="font-size:.85rem;color:var(--text2)">Overdue Payments</div>
                </div>
            </div>

            <div class="card">
                <h3 class="section-title">Quick Actions</h3>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn-primary" id="dashNewProject">+ New Project</button>
                    <button class="btn-secondary" id="dashApprovals" style="${pending.length > 0 ? 'background:var(--warn);color:#000' : ''}">
                        Pending Approvals${pending.length > 0 ? ' (' + pending.length + ')' : ''}
                    </button>
                    <button class="btn-secondary" id="dashNewInvoice">New Invoice</button>
                </div>
            </div>

            <div class="card">
                <h3 class="section-title">Recent Activity</h3>
                ${recentLogs.length === 0
                    ? '<p style="color:var(--text2);font-size:.9rem">No recent activity recorded.</p>'
                    : `<table>
                        <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
                        <tbody>
                            ${recentLogs.map(log => `<tr>
                                <td style="font-size:.8rem;white-space:nowrap">${Utils.escapeHtml(Utils.formatDateTime(log.timestamp))}</td>
                                <td>${Utils.escapeHtml(log.user || 'System')}</td>
                                <td>${Utils.escapeHtml(log.action)}</td>
                                <td style="font-size:.85rem;color:var(--text2)">${Utils.escapeHtml(log.details || '')}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>`
                }
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
