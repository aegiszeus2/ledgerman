// Admin Dashboard Module
window.AdminDashboard = {

    // First-run / empty state — shown when the account is brand new
    _renderFirstRun(container, firstName) {
        const workers  = AppData.getWorkers  ? AppData.getWorkers()  : [];
        const projects = AppData.getProjects ? AppData.getProjects() : [];

        // Steps — derive completion from live data
        const steps = [
            {
                title:  'Add your first worker',
                desc:   'Create a worker account and set a PIN so they can log in on site.',
                time:   '2 min',
                done:   workers.length > 0,
                action: "window.App.navigate('users')",
                btn:    'Add Worker',
            },
            {
                title:  'Create a project',
                desc:   'Give the job a name, client, and start date.',
                time:   '2 min',
                done:   projects.length > 0,
                action: "window.App.navigate('projects')",
                btn:    'New Project',
            },
            {
                title:  'Log the first timecard',
                desc:   'Have a worker clock in, or enter time manually as the PM.',
                time:   '3 min',
                done:   false,
                action: null,
                btn:    null,
            },
            {
                title:  'Approve it',
                desc:   'Review and approve the entry from the Approvals page.',
                time:   '1 min',
                done:   false,
                action: "window.App.navigate('approvals')",
                btn:    'Go to Approvals',
            },
            {
                title:  'Send your first invoice',
                desc:   'Create a client invoice and mark it sent.',
                time:   '5 min',
                done:   false,
                action: "window.App.navigate('invoices')",
                btn:    'New Invoice',
            },
        ];

        const doneCount = steps.filter(s => s.done).length;
        const pct = Math.round((doneCount / steps.length) * 100);
        const activeIdx = steps.findIndex(s => !s.done);

        const stepsHtml = steps.map((s, i) => {
            const state = s.done ? 'done' : (i === activeIdx ? 'active' : 'todo');
            const numBg = state === 'done'   ? 'var(--success)'  :
                          state === 'active' ? 'var(--amber)'    : 'var(--bg-surface-hover)';
            const numColor = state === 'todo' ? 'var(--text-muted)' : 'var(--text-inverse)';
            const numContent = state === 'done' ? '✓' : (i + 1);

            return `<div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--border-color-soft);${i === steps.length-1 ? 'border-bottom:none' : ''}">
                <div style="width:28px;height:28px;border-radius:50%;background:${numBg};color:${numColor};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:1px">${numContent}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:14px;color:var(--text-primary)">${s.title}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${s.desc}</div>
                    <div style="font-size:11px;color:var(--text-subtle);margin-top:4px">~${s.time}</div>
                    ${state === 'active' && s.action
                        ? `<button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="${s.action}">${s.btn}</button>`
                        : ''}
                </div>
            </div>`;
        }).join('');

        container.innerHTML = `
            <div style="margin-bottom:24px">
                <div class="eyebrow gold" style="margin-bottom:6px">WELCOME TO LEDGERMAN</div>
                <h1 style="margin:0 0 6px">Let's get your first job on the books.</h1>
                <p style="color:var(--text-muted);margin:0;font-size:14px">About 20 minutes from first login to your first approved timecard.</p>
            </div>

            <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:20px;align-items:start">

                <div class="card">
                    <div class="card-header" style="display:flex;align-items:center;justify-content:space-between">
                        <h3 style="margin:0">Setup checklist</h3>
                        <div style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text-muted)">
                            <div style="width:100px;height:4px;background:var(--bg-surface);border-radius:999px;overflow:hidden">
                                <div style="height:100%;width:${pct}%;background:var(--amber);border-radius:999px;transition:width .4s ease"></div>
                            </div>
                            <span class="mono">${doneCount} / ${steps.length}</span>
                        </div>
                    </div>
                    <div class="card-body" style="padding:0 18px">
                        ${stepsHtml}
                    </div>
                </div>

                <div style="display:flex;flex-direction:column;gap:16px">
                    <div class="card callout">
                        <div class="card-body">
                            <div class="eyebrow" style="margin-bottom:8px">What you get</div>
                            <div style="display:flex;flex-direction:column;gap:10px">
                                <div style="display:flex;gap:10px;align-items:flex-start">
                                    <span style="color:var(--success);font-size:16px;margin-top:1px">✓</span>
                                    <div>
                                        <div style="font-weight:600;font-size:13px">One-tap time capture</div>
                                        <div style="font-size:12px;color:var(--text-muted)">Workers clock in from their phone — no paper, no guessing.</div>
                                    </div>
                                </div>
                                <div style="display:flex;gap:10px;align-items:flex-start">
                                    <span style="color:var(--success);font-size:16px;margin-top:1px">✓</span>
                                    <div>
                                        <div style="font-weight:600;font-size:13px">Instant cost view</div>
                                        <div style="font-size:12px;color:var(--text-muted)">Labour cost per project updates the moment time is approved.</div>
                                    </div>
                                </div>
                                <div style="display:flex;gap:10px;align-items:flex-start">
                                    <span style="color:var(--success);font-size:16px;margin-top:1px">✓</span>
                                    <div>
                                        <div style="font-weight:600;font-size:13px">Invoice in seconds</div>
                                        <div style="font-size:12px;color:var(--text-muted)">Approved hours flow straight to invoices — no double entry.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style="text-align:center;padding:8px 0">
                        <button class="btn btn-quiet btn-sm" onclick="window.App.navigate('projects')" style="font-size:12px">
                            Skip setup — go to Projects →
                        </button>
                    </div>
                </div>

            </div>
        `;
    },

    render(container) {
        const projects = AppData.getProjects();
        const activeJobs = projects.filter(p => p.status === 'Active');
        const pending = AppData.getPendingSubmissions();
        const invoices = AppData.getInvoices();
        const payments = AppData.getPayments();
        const auditLog = AppData.getAuditLog();
        const settings = AppData.getSettings();

        // First-run gate — show setup checklist for brand-new accounts
        const workers = AppData.getWorkers ? AppData.getWorkers() : [];
        const currentUser = window.App && window.App.currentUser;
        const fullNameFR = (currentUser && currentUser.name) ? currentUser.name : 'Admin';
        const firstNameFR = Utils.escapeHtml(fullNameFR.split(' ')[0]);
        if (workers.length === 0 && projects.length <= 1) {
            this._renderFirstRun(container, firstNameFR);
            return;
        }

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

        // Derive greeting (currentUser already declared above)
        const fullName = (currentUser && currentUser.name) ? currentUser.name : 'Admin';
        const firstName = Utils.escapeHtml(fullName.split(' ')[0]);
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : 'Good afternoon';

        // Today label
        const todayLabel = Utils.formatDate(new Date().toISOString().slice(0, 10));

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

            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
                <h1 style="margin:0">${greeting}, ${firstName}.</h1>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <button class="btn-secondary btn-sm" style="pointer-events:none">${todayLabel}</button>
                    <button class="btn-primary btn-sm" id="dashApprovals">
                        Approve ${pending.length} entr${pending.length === 1 ? 'y' : 'ies'}
                    </button>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
                <div class="card" id="dashApprovalsTile" style="cursor:pointer">
                    <div class="card-body" style="padding:16px">
                        <div class="eyebrow">PENDING APPROVALS</div>
                        <div class="hero-num${pending.length > 0 ? ' gold' : ''}">${pending.length}</div>
                        <div class="muted" style="font-size:.82rem;margin-top:4px">Awaiting your review</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-body" style="padding:16px">
                        <div class="eyebrow">ACTIVE PROJECTS</div>
                        <div class="hero-num${activeJobs.length > 0 ? ' gold' : ''}">${activeJobs.length}</div>
                        <div class="muted" style="font-size:.82rem;margin-top:4px">Jobs in progress</div>
                    </div>
                </div>
                <div class="card" id="dashInvoiceTile" style="cursor:pointer">
                    <div class="card-body" style="padding:16px">
                        <div class="eyebrow">OUTSTANDING INVOICES</div>
                        <div class="hero-num${outstandingTotal > 0 ? ' gold' : ''}">${Utils.formatCurrency(outstandingTotal)}</div>
                        <div class="muted" style="font-size:.82rem;margin-top:4px">${overdueCount > 0 ? overdueCount + ' overdue' : 'All current'}</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-body" style="padding:16px">
                        <div class="eyebrow">RECENT ACTIVITY</div>
                        <div class="hero-num">${recentLogs.length}</div>
                        <div class="muted" style="font-size:.82rem;margin-top:4px">Last 10 actions</div>
                    </div>
                </div>
            </div>

            <div style="display:flex;gap:8px;margin-bottom:20px">
                <button class="btn-secondary" id="dashNewProject">+ New Project</button>
                <button class="btn-secondary" id="dashNewInvoice">New Invoice</button>
                <button class="btn-secondary" id="dashBackupExtraBtn" style="display:${showBackupReminder ? 'none' : 'inline-flex'}">Export Backup</button>
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

        // Attention-strip tile click targets
        const approvalsTile = container.querySelector('#dashApprovalsTile');
        if (approvalsTile) {
            approvalsTile.addEventListener('click', function() {
                window.App.navigate('approvals');
            });
        }
        const invoiceTile = container.querySelector('#dashInvoiceTile');
        if (invoiceTile) {
            invoiceTile.addEventListener('click', function() {
                window.App.navigate('invoices');
            });
        }
        const backupExtraBtn = container.querySelector('#dashBackupExtraBtn');
        if (backupExtraBtn) {
            backupExtraBtn.addEventListener('click', function() {
                window.App.navigate('settings');
            });
        }
    }
};
