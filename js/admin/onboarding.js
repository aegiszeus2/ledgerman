// Ledgerman Onboarding Guide
window.LedgermanOnboarding = {

    _noviceSteps: [
        {
            icon: '👋',
            title: 'Welcome to Ledgerman',
            subtitle: 'Your construction management platform',
            body: 'Ledgerman helps you run your construction business from your phone or computer. Track projects, manage workers, approve time, and invoice clients — all in one place. This guide will walk you through the essentials in under 5 minutes.',
            action: null
        },
        {
            icon: '📊',
            title: 'Your Dashboard',
            subtitle: 'The command centre',
            body: 'Your dashboard shows everything at a glance: active jobs, pending time approvals, outstanding invoices, and overdue payments. Use <strong>Quick Actions</strong> to jump straight to your most common tasks — creating a project, reviewing approvals, or sending an invoice.',
            action: { label: 'View Dashboard', route: 'dashboard' }
        },
        {
            icon: '🏗️',
            title: 'Create Your First Project',
            subtitle: 'Set up a job in 60 seconds',
            body: 'Go to <strong>Projects</strong> and click <em>+ New Project</em>. Enter the job name, client, and start date. Each project tracks its own budget, labour, expenses, photos, and invoices separately — so you always know exactly where you stand on every job.',
            action: { label: 'Go to Projects', route: 'projects' }
        },
        {
            icon: '👷',
            title: 'Add Your Workers',
            subtitle: 'Invite your crew',
            body: 'Go to <strong>Workers</strong> to add each team member. Set their name, hourly rate, and role. Once added, you can send them a secure invite link — they set their own PIN and log in from their phone. No app download required.',
            action: { label: 'Manage Workers', route: 'users' }
        },
        {
            icon: '📱',
            title: 'Workers Log Their Time',
            subtitle: 'Simple mobile time entry',
            body: 'Workers open Ledgerman on their phone, select a project, and log their time — either by clocking in/out in real time or entering hours manually. They can attach photos and expense receipts right from the field. All entries land in your approval queue.',
            action: null
        },
        {
            icon: '✅',
            title: 'Approve Time Entries',
            subtitle: 'Review before it counts',
            body: 'Every worker submission comes to <strong>Approvals</strong> for your review. See the worker\'s name, project, hours worked, and description. Approve it to convert it into a billable labour expense, or reject it with a reason — the worker can then correct and resubmit.',
            action: { label: 'Go to Approvals', route: 'approvals' }
        },
        {
            icon: '💰',
            title: 'Track Expenses',
            subtitle: 'Know your costs in real time',
            body: 'Labour, materials, subcontractors, equipment — every cost is tracked per project in <strong>Expenses</strong>. Approved time entries automatically become labour expenses. You can also log costs manually and mark them billable or non-billable for invoicing.',
            action: { label: 'View Expenses', route: 'expenses-review' }
        },
        {
            icon: '📄',
            title: 'Invoice Your Clients',
            subtitle: 'Get paid faster',
            body: 'When work is complete, go to <strong>Invoices</strong> and click <em>+ New Invoice</em>. Ledgerman pulls in all your approved billable expenses so you can build an invoice in seconds. Send it as a PDF, track payment status, and log when you\'re paid.',
            action: { label: 'Go to Invoices', route: 'invoices' }
        },
        {
            icon: '📸',
            title: 'Photo Documentation',
            subtitle: 'Visual job site record',
            body: 'Workers can attach photos directly to their time entries from the field. You can also browse all job site photos in the <strong>Photos</strong> module, filtered by project and date. A timestamped photo record protects you on disputes and change orders.',
            action: { label: 'View Photos', route: 'photos' }
        },
        {
            icon: '🎉',
            title: "You're Ready",
            subtitle: 'Start managing your first project',
            body: 'That\'s the core of Ledgerman. Create a project, invite your workers, let them log time, approve it, and invoice your client. Everything is saved securely and syncs across devices. Tap <strong>Advanced Guide</strong> below to explore the full platform — or jump straight in. — or jump straight in.',
            action: { label: 'Create First Project', route: 'projects' },
            switchToAdvanced: true
        }
    ],

    _advancedSteps: [
        {
            icon: '🚀',
            title: 'Advanced Project Management',
            subtitle: 'The full Ledgerman platform',
            body: 'This guide covers the complete feature set — everything you need to run a multi-crew, multi-project construction operation. Built for PMs who need real accountability, real data, and real control.',
            action: null
        },
        {
            icon: '🏗️',
            title: 'Multi-Project Management',
            subtitle: 'Run concurrent jobs without the chaos',
            body: 'Each project is fully isolated — its own budget, crew, expenses, invoices, and documents. Switch between active jobs instantly. Archive completed projects to keep your workspace clean. Use project status (Active / On Hold / Complete) to manage your pipeline.',
            action: { label: 'Go to Projects', route: 'projects' }
        },
        {
            icon: '👷',
            title: 'Worker Management & Invites',
            subtitle: 'Full crew control',
            body: 'Set per-worker hourly rates, roles, and module access. Send secure one-time invite links — workers claim their account with a PIN and optionally enable 2FA. View submission history per worker, see approval rates, and manage access without sharing your admin credentials.',
            action: { label: 'Manage Workers', route: 'users' }
        },
        {
            icon: '✅',
            title: 'Time Approval Workflow',
            subtitle: 'Controlled labour accounting',
            body: 'Pending → Approved → Billable Expense — that\'s the chain. Approved time auto-generates a labour cost record. You can unapprove entries to correct errors, reject with written reasons, or bulk-approve full days. Every action is audit-logged with timestamp and reviewer.',
            action: { label: 'Go to Approvals', route: 'approvals' }
        },
        {
            icon: '💰',
            title: 'Full Expense Management',
            subtitle: 'Labour, materials, subs — all tracked',
            body: 'Log any cost type: labour (from approvals), materials, equipment, subcontractors. Mark as billable or non-billable, attach to change orders, and see running totals per project. All expenses feed directly into your invoices and cost reports.',
            action: { label: 'View Expenses', route: 'expenses-review' }
        },
        {
            icon: '📄',
            title: 'Invoicing & Payment Tracking',
            subtitle: 'Professional invoices, full payment history',
            body: 'Pull approved billable expenses into an invoice with one click. Set payment terms (Net 30, etc.), add HST, apply discounts, and generate a PDF. Track status: Draft → Sent → Partially Paid → Paid. Log payments and see outstanding balances per client.',
            action: { label: 'Go to Invoices', route: 'invoices' }
        },
        {
            icon: '💹',
            title: 'Bid Estimates',
            subtitle: 'Quote jobs before committing',
            body: 'Build detailed project estimates before breaking ground. Break down labour, materials, equipment, and markup by line item. Convert an approved estimate directly into a live project — no re-entry. Compare estimated vs. actual costs as the job progresses.',
            action: { label: 'View Estimates', route: 'estimates' }
        },
        {
            icon: '🏢',
            title: 'Vendors & Subcontractors',
            subtitle: 'Your supplier address book',
            body: 'Maintain a full vendor directory — company name, contact, trade, payment terms, and notes. Attach vendors to expense line items for accurate cost sourcing. Track which subs are on which jobs and their billing history.',
            action: { label: 'Manage Vendors', route: 'vendors' }
        },
        {
            icon: '👥',
            title: 'Client Management',
            subtitle: 'Full client address book',
            body: 'Store client contacts, addresses, and notes. Invoices are linked directly to client records — so you have full billing history per client at a glance. Supports multiple projects per client for repeat customers like developers or property managers.',
            action: { label: 'Manage Clients', route: 'clients' }
        },
        {
            icon: '☑️',
            title: 'Task Assignment',
            subtitle: 'Assign and track specific work items',
            body: 'Break projects into tasks and assign them to specific workers. Set due dates, priority levels, and completion status. Workers see their assigned tasks when logging time, ensuring hours are always tied to the right scope item. Perfect for deficiency tracking and closeout.',
            action: { label: 'Task Assignment', route: 'task-assignment' }
        },
        {
            icon: '📊',
            title: 'Budget Tracking',
            subtitle: 'Estimated vs. actual — always visible',
            body: 'Set budgets by cost category at the project level. As labour and expenses are logged, Ledgerman tracks spend against budget in real time. Get early warning before you\'re over budget — not after. Export budget vs. actual reports for owner billing and project reviews.',
            action: { label: 'Budget Tracking', route: 'budget-tracking' }
        },
        {
            icon: '📋',
            title: 'Supervisor Daily Reports',
            subtitle: 'End-of-day crew summaries',
            body: 'Supervisors complete structured daily reports: crew present, work completed, delays, weather, equipment used, and safety notes. Reports are timestamped and stored per project. Use them for owner reporting, dispute resolution, and schedule tracking.',
            action: { label: 'Daily Reports', route: 'daily-reports' }
        },
        {
            icon: '📌',
            title: 'Punch Lists',
            subtitle: 'Deficiency tracking to closeout',
            body: 'Create punch list items at project closeout — or any time a deficiency is found. Assign each item to a worker, set priority and due date, attach photos, and track status (Open / In Progress / Complete). Clear documentation for holdback release and warranty.',
            action: { label: 'Punch Lists', route: 'punch-lists' }
        },
        {
            icon: '📅',
            title: 'Project Timeline (Gantt)',
            subtitle: 'Visual schedule management',
            body: 'Build and manage project schedules with a Gantt chart. Set task durations, dependencies, and milestones. Visualize critical path, track schedule variance, and share timeline updates with owners and subs. Keep the whole team on the same page.',
            action: { label: 'View Timeline', route: 'gantt-chart' }
        },
        {
            icon: '📈',
            title: 'Reports & Analytics',
            subtitle: 'Data-driven project decisions',
            body: 'Generate cost reports, labour summaries, invoice aging, and expense breakdowns — by project, by worker, by date range. Export to CSV for your accountant. Identify your most profitable job types, your highest-cost workers, and your payment trends over time.',
            action: { label: 'View Reports', route: 'reports' }
        },
        {
            icon: '⚙️',
            title: 'Settings & Customization',
            subtitle: 'Configure Ledgerman for your operation',
            body: 'Set your company name, logo, HST number, invoice prefix, and default payment terms. Enable or disable modules based on your subscription tier. Configure session timeouts, backup schedules, and notification preferences. Make Ledgerman fit your workflow — not the other way around.',
            action: { label: 'Go to Settings', route: 'settings' }
        },
        {
            icon: '🏆',
            title: 'You Have the Full Picture',
            subtitle: 'Built for serious construction management',
            body: 'Ledgerman gives you the full stack: estimates, projects, crews, time, expenses, invoices, schedules, and reports. Every dollar tracked, every hour logged, every client invoiced — all in one platform designed for the field. Time to put it to work.',
            action: { label: 'Go to Dashboard', route: 'dashboard' },
            switchToNovice: true
        }
    ],

    show() {
        const self = this;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10000';
        overlay.innerHTML = `
            <div style="background:var(--bg-secondary);border-radius:16px;max-width:520px;width:92%;box-shadow:0 24px 80px rgba(0,0,0,.22);overflow:hidden;color:var(--text-primary)">
                <div style="background:linear-gradient(135deg,#1a1a2e 0%,#2d2d5e 100%);padding:32px;text-align:center">
                    <div style="font-size:2.8rem;margin-bottom:12px">🏗️</div>
                    <h2 style="color:#fff;margin:0 0 8px;font-size:1.4rem">Welcome to Ledgerman</h2>
                    <p style="color:rgba(255,255,255,.7);margin:0;font-size:.95rem">Choose your guide level to get started</p>
                </div>
                <div style="padding:28px">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
                        <button id="onboardNoviceBtn" style="border:2px solid var(--border-color);border-radius:12px;padding:20px 14px;background:var(--bg-surface);color:var(--text-primary);cursor:pointer;text-align:center;transition:all .2s">
                            <div style="font-size:2rem;margin-bottom:8px">🌱</div>
                            <div style="font-weight:700;color:var(--text-primary);font-size:.95rem;margin-bottom:4px">Basic PM</div>
                            <div style="font-size:.8rem;color:var(--text-muted);line-height:1.4">New to Ledgerman? Learn the essentials — projects, workers, time, and invoicing in 10 steps.</div>
                        </button>
                        <button id="onboardAdvancedBtn" style="border:2px solid var(--border-color);border-radius:12px;padding:20px 14px;background:var(--bg-surface);color:var(--text-primary);cursor:pointer;text-align:center;transition:all .2s">
                            <div style="font-size:2rem;margin-bottom:8px">⚡</div>
                            <div style="font-weight:700;color:var(--text-primary);font-size:.95rem;margin-bottom:4px">Advanced PM</div>
                            <div style="font-size:.8rem;color:var(--text-muted);line-height:1.4">Experienced PM? Explore the full platform — budgets, Gantt, punch lists, reports and more.</div>
                        </button>
                    </div>
                    <button id="onboardSkipBtn" style="width:100%;padding:10px;border:none;background:none;color:var(--text-muted);font-size:.85rem;cursor:pointer">Skip for now</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#onboardNoviceBtn').addEventListener('mouseenter', function() {
            this.style.borderColor = 'var(--amber)'; this.style.background = 'var(--bg-surface-hover)';
        });
        overlay.querySelector('#onboardNoviceBtn').addEventListener('mouseleave', function() {
            this.style.borderColor = 'var(--border-color)'; this.style.background = 'var(--bg-surface)';
        });
        overlay.querySelector('#onboardAdvancedBtn').addEventListener('mouseenter', function() {
            this.style.borderColor = 'var(--amber)'; this.style.background = 'var(--bg-surface-hover)';
        });
        overlay.querySelector('#onboardAdvancedBtn').addEventListener('mouseleave', function() {
            this.style.borderColor = 'var(--border-color)'; this.style.background = 'var(--bg-surface)';
        });

        overlay.querySelector('#onboardNoviceBtn').addEventListener('click', function() {
            overlay.remove();
            self._runTour(self._noviceSteps, 'novice', 0);
        });
        overlay.querySelector('#onboardAdvancedBtn').addEventListener('click', function() {
            overlay.remove();
            self._runTour(self._advancedSteps, 'advanced', 0);
        });
        overlay.querySelector('#onboardSkipBtn').addEventListener('click', function() {
            overlay.remove();
        });
    },

    _runTour(steps, level, index) {
        const self = this;
        const step = steps[index];
        const total = steps.length;
        const isFirst = index === 0;
        const isLast = index === total - 1;
        const progressPct = Math.round(((index + 1) / total) * 100);

        const levelColor = level === 'novice' ? '#10b981' : '#6366f1';
        const levelLabel = level === 'novice' ? '🌱 Basic Guide' : '⚡ Advanced Guide';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:10000';

        let actionBtnHtml = '';
        if (step.action) {
            actionBtnHtml = `<button id="tourActionBtn" style="display:inline-flex;align-items:center;gap:6px;background:${levelColor};color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:.9rem;font-weight:600;cursor:pointer">${step.action.label} →</button>`;
        }

        let switchBtnHtml = '';
        if (step.switchToAdvanced) {
            switchBtnHtml = `<button id="tourSwitchBtn" style="margin-top:8px;width:100%;padding:10px;border:2px solid #6366f1;background:none;border-radius:8px;color:#6366f1;font-weight:600;font-size:.88rem;cursor:pointer">⚡ Switch to Advanced Guide</button>`;
        } else if (step.switchToNovice) {
            switchBtnHtml = `<button id="tourSwitchBtn" style="margin-top:8px;width:100%;padding:10px;border:2px solid var(--success);background:none;border-radius:8px;color:var(--success);font-weight:600;font-size:.88rem;cursor:pointer">🌱 View Basic Guide</button>`;
        }

        overlay.innerHTML = `
            <div style="background:var(--bg-secondary);border-radius:16px;max-width:520px;width:92%;box-shadow:0 24px 80px rgba(0,0,0,.22);overflow:hidden;display:flex;flex-direction:column;color:var(--text-primary)">

                <!-- Progress bar -->
                <div style="height:4px;background:var(--bg-surface)">
                    <div style="height:100%;width:${progressPct}%;background:${levelColor};transition:width .3s"></div>
                </div>

                <!-- Header -->
                <div style="padding:18px 22px 0;display:flex;justify-content:space-between;align-items:center">
                    <span style="font-size:.75rem;font-weight:600;color:${levelColor};letter-spacing:.4px;text-transform:uppercase">${levelLabel}</span>
                    <span style="font-size:.75rem;color:var(--text-muted)">${index + 1} of ${total}</span>
                </div>

                <!-- Step content -->
                <div style="padding:20px 24px 24px;flex:1">
                    <div style="text-align:center;margin-bottom:18px">
                        <div style="font-size:3rem;margin-bottom:10px">${step.icon}</div>
                        <h3 style="margin:0 0 4px;color:var(--text-primary);font-size:1.2rem">${step.title}</h3>
                        <div style="font-size:.85rem;color:${levelColor};font-weight:600">${step.subtitle}</div>
                    </div>
                    <p style="color:var(--text-secondary);font-size:.92rem;line-height:1.65;margin:0 0 20px;text-align:center">${step.body}</p>
                    ${actionBtnHtml ? '<div style="text-align:center;margin-bottom:10px">' + actionBtnHtml + '</div>' : ''}
                    ${switchBtnHtml}
                </div>

                <!-- Navigation -->
                <div style="padding:14px 22px;border-top:1px solid var(--border-color-soft);display:flex;justify-content:space-between;align-items:center;gap:10px">
                    <button id="tourPrevBtn" style="padding:9px 18px;border:1px solid var(--border-color);background:var(--bg-surface);border-radius:8px;font-size:.88rem;cursor:pointer;color:var(--text-secondary);${isFirst ? 'opacity:.35;pointer-events:none' : ''}">← Back</button>
                    <div style="display:flex;gap:5px">
                        ${steps.map((_, i) => `<div style="width:${i === index ? 18 : 7}px;height:7px;border-radius:4px;background:${i === index ? levelColor : 'var(--border-color)'};transition:all .25s"></div>`).join('')}
                    </div>
                    ${isLast
                        ? `<button id="tourDoneBtn" style="padding:9px 18px;background:${levelColor};color:#fff;border:none;border-radius:8px;font-size:.88rem;font-weight:600;cursor:pointer">Done ✓</button>`
                        : `<button id="tourNextBtn" style="padding:9px 18px;background:${levelColor};color:#fff;border:none;border-radius:8px;font-size:.88rem;font-weight:600;cursor:pointer">Next →</button>`
                    }
                </div>

            </div>
        `;
        document.body.appendChild(overlay);

        // Navigation handlers
        const prevBtn = overlay.querySelector('#tourPrevBtn');
        if (prevBtn && !isFirst) {
            prevBtn.addEventListener('click', function() {
                overlay.remove();
                self._runTour(steps, level, index - 1);
            });
        }

        const nextBtn = overlay.querySelector('#tourNextBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                overlay.remove();
                self._runTour(steps, level, index + 1);
            });
        }

        const doneBtn = overlay.querySelector('#tourDoneBtn');
        if (doneBtn) {
            doneBtn.addEventListener('click', function() { overlay.remove(); });
        }

        const actionBtn = overlay.querySelector('#tourActionBtn');
        if (actionBtn && step.action) {
            actionBtn.addEventListener('click', function() {
                overlay.remove();
                if (window.App && window.App.navigate) {
                    window.App.navigate(step.action.route);
                }
            });
        }

        const switchBtn = overlay.querySelector('#tourSwitchBtn');
        if (switchBtn) {
            switchBtn.addEventListener('click', function() {
                overlay.remove();
                if (step.switchToAdvanced) {
                    self._runTour(self._advancedSteps, 'advanced', 0);
                } else {
                    self._runTour(self._noviceSteps, 'novice', 0);
                }
            });
        }
    }
};
