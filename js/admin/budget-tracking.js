// Admin Budget Tracking — Full Work Item Management System
// Supports: line-item budgets, versioning (draft→approved→revision), AI text parser, CSV import
window.AdminBudgetTracking = {

    // ── State ──────────────────────────────────────────────────────────────
    _view: 'list',          // 'list' | 'project' | 'version'
    _projectId: null,
    _budgetVersionId: null,
    _sortBy: 'name',
    _filterStatus: 'All',

    // ── CSI MasterFormat Divisions ─────────────────────────────────────────
    DIVISIONS: [
        { code: '01', name: 'General Requirements' },
        { code: '02', name: 'Existing Conditions' },
        { code: '03', name: 'Concrete' },
        { code: '04', name: 'Masonry' },
        { code: '05', name: 'Metals' },
        { code: '06', name: 'Wood & Plastics' },
        { code: '07', name: 'Thermal & Moisture Protection' },
        { code: '08', name: 'Openings' },
        { code: '09', name: 'Finishes' },
        { code: '10', name: 'Specialties' },
        { code: '11', name: 'Equipment' },
        { code: '12', name: 'Furnishings' },
        { code: '21', name: 'Fire Suppression' },
        { code: '22', name: 'Plumbing' },
        { code: '23', name: 'HVAC' },
        { code: '26', name: 'Electrical' },
        { code: '31', name: 'Earthwork' },
        { code: '32', name: 'Exterior Improvements' },
        { code: '33', name: 'Utilities' },
        { code: '34', name: 'Transportation' },
        { code: '35', name: 'Waterway & Marine' },
    ],

    CATEGORIES: ['Labour', 'Material', 'Equipment', 'Subcontract', 'Other'],

    UNITS: ['LS', 'EA', 'hr', 'm²', 'm³', 'lm', 'm', 'tonne', 'kg', 't', 'day', 'wk', 'allow'],

    CATEGORY_COLORS: {
        Labour:      '#3498db',
        Material:    '#2ecc71',
        Equipment:   '#f39c12',
        Subcontract: '#9b59b6',
        Other:       '#95a5a6',
    },

    // ── Entry Point ────────────────────────────────────────────────────────
    render(container) {
        this._container = container;
        if (this._view === 'version' && this._budgetVersionId) {
            this._renderVersionDetail();
        } else if (this._view === 'project' && this._projectId) {
            this._renderProjectDetail();
        } else {
            this._renderProjectList();
        }
    },

    // ══════════════════════════════════════════════════════════════════════
    //  VIEW 1: PROJECT BUDGET LIST
    // ══════════════════════════════════════════════════════════════════════
    _renderProjectList() {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const expenses = AppData.getExpenses();
        const budgetVersions = AppData.getBudgetVersions ? AppData.getBudgetVersions() : [];
        const budgetItems = AppData.getBudgetItems ? AppData.getBudgetItems() : [];

        // Build per-project budget data
        const budgetData = projects.map(project => {
            // Find approved (or latest draft) budget version for this project
            const versions = budgetVersions.filter(v => v.projectId === project.id);
            const approved = versions.find(v => v.status === 'approved');
            const activeVersion = approved || (versions.length > 0 ? versions[versions.length - 1] : null);

            // Budgeted total from work items (or fallback to project.budget field)
            let budgeted = 0;
            if (activeVersion) {
                const items = budgetItems.filter(i => i.budgetVersionId === activeVersion.id);
                budgeted = items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
            } else {
                budgeted = parseFloat(project.budget) || 0;
            }

            // Actual spend from expenses
            const projectExpenses = expenses.filter(e => e.projectId === project.id);
            const spent = projectExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

            const variance = budgeted - spent;
            const percentSpent = budgeted > 0 ? ((spent / budgeted) * 100).toFixed(1) : (spent > 0 ? '∞' : '0');

            return {
                id: project.id,
                name: project.name,
                status: project.status || 'Active',
                budgeted,
                spent,
                variance,
                percentSpent,
                hasLineItems: !!activeVersion,
                activeVersion,
                versionCount: versions.length,
                hasDraft: versions.some(v => v.status === 'draft'),
            };
        });

        const filtered = self._filterStatus === 'All'
            ? budgetData
            : budgetData.filter(d => d.status === self._filterStatus);

        const sorted = [...filtered].sort((a, b) => {
            switch (self._sortBy) {
                case 'budget':       return b.budgeted - a.budgeted;
                case 'spent':        return b.spent - a.spent;
                case 'variance':     return b.variance - a.variance;
                case 'percentSpent': return parseFloat(b.percentSpent) - parseFloat(a.percentSpent);
                default:             return a.name.localeCompare(b.name);
            }
        });

        const statuses = ['All', 'Active', 'Completed', 'On Hold'];
        const totalBudget = budgetData.reduce((s, d) => s + d.budgeted, 0);
        const totalSpent  = budgetData.reduce((s, d) => s + d.spent, 0);
        const totalVariance = totalBudget - totalSpent;

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
                    <h2>Budget Tracking</h2>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <button class="btn-secondary btn-sm" id="budgetExportCsvBtn">Export CSV</button>
                        <button class="btn-secondary btn-sm" id="budgetPrintBtn">Print / PDF</button>
                        <button class="btn-secondary btn-sm" id="refreshBudgetBtn">↻ Refresh</button>
                    </div>
                </div>
                <p style="color:#b0c4de;margin:0;font-size:.9em">Click a project to manage line-item budgets, import from CSV, or generate with AI.</p>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:24px">
                ${self._summaryCard('Total Budget', '$' + self._fmt(totalBudget), projects.length + ' projects', '#333')}
                ${self._summaryCard('Total Spent', '$' + self._fmt(totalSpent), (totalBudget > 0 ? ((totalSpent/totalBudget)*100).toFixed(1) : 0) + '% of budget', '#e74c3c')}
                ${self._summaryCard('Remaining', (totalVariance >= 0 ? '+' : '') + '$' + self._fmt(Math.abs(totalVariance)), totalVariance >= 0 ? 'Under budget' : 'Over budget', totalVariance >= 0 ? '#2ecc71' : '#e74c3c')}
                ${self._summaryCard('With Line Items', budgetData.filter(d => d.hasLineItems).length + ' / ' + projects.length, 'projects budgeted', '#3498db')}
            </div>

            <!-- Filters + Sort -->
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
                ${statuses.map(s => `
                    <button class="tab-btn ${self._filterStatus === s ? 'active' : ''}" data-status="${s}" style="padding:5px 10px;font-size:.85em">
                        ${s} (${s === 'All' ? budgetData.length : budgetData.filter(d => d.status === s).length})
                    </button>
                `).join('')}
                <select id="sortBySelect" style="margin-left:auto;padding:5px 8px;border-radius:4px;border:1px solid #ddd;font-size:.85em">
                    <option value="name" ${self._sortBy==='name'?'selected':''}>Sort: Name</option>
                    <option value="budget" ${self._sortBy==='budget'?'selected':''}>Sort: Budget ↓</option>
                    <option value="spent" ${self._sortBy==='spent'?'selected':''}>Sort: Spent ↓</option>
                    <option value="variance" ${self._sortBy==='variance'?'selected':''}>Sort: Variance ↓</option>
                    <option value="percentSpent" ${self._sortBy==='percentSpent'?'selected':''}>Sort: % Spent ↓</option>
                </select>
            </div>

            <!-- Project Budget Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid #e0e0e0">
                <table class="table" style="width:100%;margin:0;border-collapse:collapse">
                    <thead style="background:var(--bg-tertiary)">
                        <tr>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid #e0e0e0">Project</th>
                            <th style="padding:11px 14px;text-align:right;border-bottom:2px solid #e0e0e0">Budgeted</th>
                            <th style="padding:11px 14px;text-align:right;border-bottom:2px solid #e0e0e0">Spent</th>
                            <th style="padding:11px 14px;text-align:right;border-bottom:2px solid #e0e0e0">Remaining</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid #e0e0e0">% Spent</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid #e0e0e0">Budget</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid #e0e0e0">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.length > 0 ? sorted.map(d => {
                            const pct = parseFloat(d.percentSpent);
                            const barW = Math.min(100, isNaN(pct) ? 0 : pct);
                            const barColor = pct >= 100 ? '#e74c3c' : pct >= 80 ? '#f39c12' : '#2ecc71';
                            return `
                            <tr class="project-budget-row" data-id="${d.id}" style="border-bottom:1px solid #eee;cursor:pointer;transition:background .15s">
                                <td style="padding:12px 14px">
                                    <strong>${Utils.escapeHtml(d.name)}</strong>
                                    <div style="font-size:.8em;color:#999;margin-top:2px">${d.status}</div>
                                </td>
                                <td style="padding:12px 14px;text-align:right">$${self._fmt(d.budgeted)}</td>
                                <td style="padding:12px 14px;text-align:right;color:#e74c3c">$${self._fmt(d.spent)}</td>
                                <td style="padding:12px 14px;text-align:right;color:${d.variance >= 0 ? '#2ecc71' : '#e74c3c'};font-weight:500">
                                    ${d.variance >= 0 ? '+' : '-'}$${self._fmt(Math.abs(d.variance))}
                                </td>
                                <td style="padding:12px 14px;text-align:center">
                                    <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
                                        <div style="width:70px;height:5px;background:#eee;border-radius:3px;overflow:hidden">
                                            <div style="width:${barW}%;height:100%;background:${barColor};border-radius:3px"></div>
                                        </div>
                                        <span style="font-size:.8em;font-weight:600">${d.percentSpent}%</span>
                                    </div>
                                </td>
                                <td style="padding:12px 14px;text-align:center">
                                    ${d.hasLineItems
                                        ? `<span style="padding:3px 8px;border-radius:10px;font-size:.78em;background:#e8f5e9;color:#2e7d32">
                                               ${d.versionCount} version${d.versionCount !== 1 ? 's' : ''}
                                           </span>`
                                        : `<span style="padding:3px 8px;border-radius:10px;font-size:.78em;background:var(--warning-bg);color:var(--warning)">No budget</span>`
                                    }
                                </td>
                                <td style="padding:12px 14px;text-align:center">
                                    <button class="btn-primary btn-sm manage-budget-btn" data-id="${d.id}" style="font-size:.8em;padding:4px 10px">Manage</button>
                                </td>
                            </tr>
                            `;
                        }).join('') : `
                            <tr><td colspan="7" style="padding:30px;text-align:center;color:#aaa">No projects found</td></tr>
                        `}
                    </tbody>
                </table>
            </div>

            <div style="margin-top:16px;padding:10px 14px;background:#e8f4f8;border-radius:6px;border-left:4px solid #3498db;font-size:.85em">
                <strong>💡 Tip:</strong> Click <strong>Manage</strong> on any project to create a line-item budget, import from CSV, or generate work items using AI.
            </div>
        `;

        // Bind filters
        container.querySelectorAll('[data-status]').forEach(btn => {
            btn.addEventListener('click', () => { self._filterStatus = btn.dataset.status; self.render(container); });
        });
        document.getElementById('sortBySelect').onchange = e => { self._sortBy = e.target.value; self.render(container); };

        // Manage button / row click
        container.querySelectorAll('.manage-budget-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                self._view = 'project';
                self._projectId = btn.dataset.id;
                self.render(container);
            });
        });
        container.querySelectorAll('.project-budget-row').forEach(row => {
            row.addEventListener('click', e => {
                if (e.target.closest('.manage-budget-btn')) return;
                self._view = 'project';
                self._projectId = row.dataset.id;
                self.render(container);
            });
        });

        document.getElementById('refreshBudgetBtn').onclick = async () => {
            const btn = document.getElementById('refreshBudgetBtn');
            btn.disabled = true; btn.textContent = '↻ Refreshing…';
            await AppData.syncFromServer();
            self.render(container);
        };

        document.getElementById('budgetExportCsvBtn').onclick = () => self._exportSummaryCsv(sorted);
        document.getElementById('budgetPrintBtn').onclick = () => {
            if (!document.getElementById('budgetPrintStyle')) {
                const s = document.createElement('style');
                s.id = 'budgetPrintStyle';
                s.textContent = '@media print { .admin-nav,.worker-nav,#adminSidebar,.btn-primary,.btn-secondary,.tab-btn,#pageHelpBtn{display:none!important} body{font-size:11pt} }';
                document.head.appendChild(s);
            }
            window.print();
        };
    },

    // ══════════════════════════════════════════════════════════════════════
    //  VIEW 2: PROJECT BUDGET DETAIL (version list)
    // ══════════════════════════════════════════════════════════════════════
    _renderProjectDetail() {
        const self = this;
        const container = self._container;
        const project = AppData.getProject(self._projectId);
        if (!project) { self._view = 'list'; self._projectId = null; self.render(container); return; }

        const versions = (AppData.getBudgetVersions ? AppData.getBudgetVersions(self._projectId) : [])
            .sort((a, b) => (b.version || 0) - (a.version || 0));
        const budgetItems = AppData.getBudgetItems ? AppData.getBudgetItems() : [];

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <!-- Breadcrumb -->
                <div style="font-size:.85em;color:#94a9c4;margin-bottom:10px">
                    <span class="breadcrumb-back" style="cursor:pointer;color:#3498db">← Budget Tracking</span>
                    <span style="margin:0 6px">/</span>
                    <span>${Utils.escapeHtml(project.name)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                    <h2>${Utils.escapeHtml(project.name)} — Budget Versions</h2>
                    <button class="btn-primary" id="createDraftBtn">+ New Budget Draft</button>
                </div>
                <p style="color:#b0c4de;font-size:.9em;margin-top:6px">
                    Create and manage budget versions. <strong>Approve</strong> a version to lock it as the baseline.
                    <strong>Revise</strong> it later to track scope changes.
                </p>
            </div>

            ${versions.length === 0 ? `
                <div class="card" style="text-align:center;padding:48px 24px">
                    <div style="font-size:2.5em;margin-bottom:12px">📋</div>
                    <h3 style="color:#444;margin-bottom:8px">No budget yet</h3>
                    <p style="color:#999;margin-bottom:20px">Create a draft to start adding work items.</p>
                    <button class="btn-primary" id="createDraftBtn2">+ Create First Budget Draft</button>
                </div>
            ` : `
                <div style="display:flex;flex-direction:column;gap:12px">
                    ${versions.map(v => {
                        const items = budgetItems.filter(i => i.budgetVersionId === v.id);
                        const total = items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
                        const statusColors = { draft: '#f39c12', approved: '#2ecc71', superseded: '#aaa' };
                        const statusBg    = { draft: '#fff8e1', approved: '#e8f5e9', superseded: '#f5f5f5' };
                        return `
                        <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:8px;padding:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
                            <div style="flex:1;min-width:180px">
                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                                    <span style="font-weight:600;font-size:1em">${Utils.escapeHtml(v.name || 'Budget v' + v.version)}</span>
                                    <span style="padding:2px 8px;border-radius:10px;font-size:.78em;background:${statusBg[v.status]||'var(--bg-surface)'};color:${statusColors[v.status]||'var(--text-muted)'};font-weight:600">${v.status}</span>
                                </div>
                                <div style="font-size:.82em;color:#999">
                                    ${items.length} line item${items.length !== 1 ? 's' : ''} · Total: <strong style="color:var(--text-secondary)">$${self._fmt(total)}</strong>
                                    ${v.approvedAt ? ' · Approved ' + Utils.formatDate(v.approvedAt) : ''}
                                    ${v.notes ? ' · ' + Utils.escapeHtml(v.notes) : ''}
                                </div>
                            </div>
                            <div style="display:flex;gap:8px;flex-wrap:wrap">
                                <button class="btn-primary btn-sm view-version-btn" data-id="${v.id}" style="font-size:.82em">View / Edit</button>
                                ${v.status === 'draft' ? `
                                    <button class="btn-secondary btn-sm approve-version-btn" data-id="${v.id}" style="font-size:.82em;border-color:#2ecc71;color:#2ecc71">✓ Approve</button>
                                    <button class="btn-secondary btn-sm delete-version-btn" data-id="${v.id}" style="font-size:.82em;border-color:#e74c3c;color:#e74c3c">Delete</button>
                                ` : ''}
                                ${v.status === 'approved' ? `
                                    <button class="btn-secondary btn-sm revise-version-btn" data-id="${v.id}" style="font-size:.82em">Create Revision</button>
                                ` : ''}
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            `}
        `;

        container.querySelector('.breadcrumb-back').onclick = () => { self._view = 'list'; self.render(container); };

        container.querySelectorAll('#createDraftBtn, #createDraftBtn2').forEach(btn => {
            if (btn) btn.onclick = () => self._createDraftVersion();
        });

        container.querySelectorAll('.view-version-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                self._view = 'version';
                self._budgetVersionId = btn.dataset.id;
                self.render(container);
            });
        });

        container.querySelectorAll('.approve-version-btn').forEach(btn => {
            btn.addEventListener('click', () => self._approveVersion(btn.dataset.id));
        });

        container.querySelectorAll('.revise-version-btn').forEach(btn => {
            btn.addEventListener('click', () => self._createRevision(btn.dataset.id));
        });

        container.querySelectorAll('.delete-version-btn').forEach(btn => {
            btn.addEventListener('click', () => self._deleteVersion(btn.dataset.id));
        });
    },

    // ══════════════════════════════════════════════════════════════════════
    //  VIEW 3: BUDGET VERSION DETAIL (work items table)
    // ══════════════════════════════════════════════════════════════════════
    _renderVersionDetail() {
        const self = this;
        const container = self._container;
        const ver = AppData.getBudgetVersion ? AppData.getBudgetVersion(self._budgetVersionId) : null;
        if (!ver) { self._view = 'project'; self.render(container); return; }
        const project = AppData.getProject(ver.projectId);
        const items = (AppData.getBudgetItems ? AppData.getBudgetItems(self._budgetVersionId) : [])
            .sort((a, b) => (a.costCode || '').localeCompare(b.costCode || '') || (a.description || '').localeCompare(b.description || ''));

        const isLocked = ver.status === 'approved' || ver.status === 'superseded';
        const total = items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);

        // Group by category for summary
        const catTotals = {};
        self.CATEGORIES.forEach(c => { catTotals[c] = 0; });
        items.forEach(i => { catTotals[i.category || 'Other'] = (catTotals[i.category || 'Other'] || 0) + (parseFloat(i.total) || 0); });

        container.innerHTML = `
            <div style="margin-bottom:16px">
                <!-- Breadcrumb -->
                <div style="font-size:.85em;color:#94a9c4;margin-bottom:10px">
                    <span class="breadcrumb-list" style="cursor:pointer;color:#3498db">← Budget Tracking</span>
                    <span style="margin:0 6px">/</span>
                    <span class="breadcrumb-project" style="cursor:pointer;color:#3498db">${Utils.escapeHtml(project ? project.name : '...')}</span>
                    <span style="margin:0 6px">/</span>
                    <span>${Utils.escapeHtml(ver.name || 'Budget v' + ver.version)}</span>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
                    <div>
                        <h2 style="margin-bottom:4px">${Utils.escapeHtml(ver.name || 'Budget v' + ver.version)}
                            <span style="margin-left:8px;padding:3px 10px;border-radius:10px;font-size:.7em;vertical-align:middle;
                                background:${ver.status==='approved'?'#e8f5e9':ver.status==='draft'?'#fff8e1':'#f5f5f5'};
                                color:${ver.status==='approved'?'#2e7d32':ver.status==='draft'?'#e65100':'#666'}">${ver.status}</span>
                        </h2>
                        <p style="color:#b0c4de;font-size:.88em;margin:0">${project ? Utils.escapeHtml(project.name) : ''} · ${items.length} items · Total: <strong style="color:#fff">$${self._fmt(total)}</strong></p>
                    </div>
                    ${!isLocked ? `
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <button class="btn-secondary btn-sm" id="importCsvBtn">📂 Import CSV</button>
                        <button class="btn-secondary btn-sm" id="aiImportBtn">🤖 AI Generate</button>
                        <button class="btn-primary btn-sm" id="addItemBtn">+ Add Item</button>
                        <button class="btn-secondary btn-sm" style="border-color:#2ecc71;color:#2ecc71" id="approveVersionBtn">✓ Approve Budget</button>
                    </div>
                    ` : `
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <button class="btn-secondary btn-sm" id="exportItemsCsvBtn">Export CSV</button>
                        ${ver.status === 'approved' ? `<button class="btn-secondary btn-sm" id="createRevisionBtn">Create Revision</button>` : ''}
                    </div>
                    `}
                </div>
            </div>

            <!-- Category Summary Bar -->
            ${total > 0 ? `
            <div style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:8px;padding:14px;margin-bottom:16px">
                <div style="font-size:.82em;color:var(--text-muted);margin-bottom:8px;font-weight:600">BREAKDOWN BY CATEGORY</div>
                <div style="display:flex;gap:16px;flex-wrap:wrap">
                    ${self.CATEGORIES.filter(c => catTotals[c] > 0).map(c => {
                        const pct = (catTotals[c] / total * 100).toFixed(1);
                        return `<div style="display:flex;align-items:center;gap:6px;font-size:.85em">
                            <div style="width:10px;height:10px;border-radius:50%;background:${self.CATEGORY_COLORS[c]}"></div>
                            <span>${c}</span>
                            <strong>$${self._fmt(catTotals[c])}</strong>
                            <span style="color:#999">(${pct}%)</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Work Items Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid #e0e0e0;margin-bottom:16px">
                <table class="table" style="width:100%;margin:0;border-collapse:collapse;font-size:.88em">
                    <thead style="background:var(--bg-tertiary)">
                        <tr>
                            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd;white-space:nowrap">Cost Code</th>
                            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #ddd">Description</th>
                            <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #ddd">Category</th>
                            <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #ddd">Qty</th>
                            <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #ddd">Unit</th>
                            <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #ddd">Unit Cost</th>
                            <th style="padding:10px 12px;text-align:right;border-bottom:2px solid #ddd;font-weight:700">Total</th>
                            ${!isLocked ? `<th style="padding:10px 12px;text-align:center;border-bottom:2px solid #ddd">Actions</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${items.length > 0 ? items.map(item => {
                            const catColor = self.CATEGORY_COLORS[item.category] || '#aaa';
                            return `
                            <tr style="border-bottom:1px solid #eee" data-item-id="${item.id}">
                                <td style="padding:9px 12px;color:#94a9c4;font-size:.82em;white-space:nowrap">
                                    ${item.costCode ? Utils.escapeHtml(item.costCode) : '—'}
                                </td>
                                <td style="padding:9px 12px">
                                    <div style="font-weight:500">${Utils.escapeHtml(item.description || '—')}</div>
                                    ${item.division ? `<div style="font-size:.78em;color:#999">Div. ${item.division}</div>` : ''}
                                    ${item.notes ? `<div style="font-size:.78em;color:#b0c4de;font-style:italic">${Utils.escapeHtml(item.notes)}</div>` : ''}
                                </td>
                                <td style="padding:9px 12px;text-align:center">
                                    <span style="padding:2px 7px;border-radius:10px;font-size:.78em;background:${catColor}20;color:${catColor};font-weight:600">${item.category || 'Other'}</span>
                                </td>
                                <td style="padding:9px 12px;text-align:right">${self._fmtNum(item.quantity)}</td>
                                <td style="padding:9px 12px;text-align:center;color:#94a9c4">${item.unit || 'LS'}</td>
                                <td style="padding:9px 12px;text-align:right">$${self._fmt(parseFloat(item.unitCost)||0)}</td>
                                <td style="padding:9px 12px;text-align:right;font-weight:600">$${self._fmt(parseFloat(item.total)||0)}</td>
                                ${!isLocked ? `
                                <td style="padding:9px 12px;text-align:center;white-space:nowrap">
                                    <button class="btn-ghost btn-sm edit-item-btn" data-id="${item.id}" style="font-size:.8em">Edit</button>
                                    <button class="btn-ghost btn-sm delete-item-btn" data-id="${item.id}" style="font-size:.8em;color:#e74c3c">Del</button>
                                </td>
                                ` : ''}
                            </tr>
                            `;
                        }).join('') : `
                            <tr><td colspan="${isLocked ? 7 : 8}" style="padding:32px;text-align:center;color:#aaa">
                                ${isLocked ? 'No items in this version.' : 'No items yet. Add items manually, import CSV, or use AI Generate.'}
                            </td></tr>
                        `}
                    </tbody>
                    ${items.length > 0 ? `
                    <tfoot style="background:var(--bg-surface);font-weight:700">
                        <tr>
                            <td colspan="${isLocked ? 6 : 6}" style="padding:10px 12px;text-align:right;border-top:2px solid #ddd">TOTAL</td>
                            <td style="padding:10px 12px;text-align:right;border-top:2px solid #ddd;font-size:1.05em">$${self._fmt(total)}</td>
                            ${!isLocked ? `<td style="border-top:2px solid #ddd"></td>` : ''}
                        </tr>
                    </tfoot>
                    ` : ''}
                </table>
            </div>

            ${isLocked ? `<div style="padding:10px 14px;background:#e8f5e9;border-radius:6px;border-left:4px solid #2ecc71;font-size:.85em">
                🔒 This budget version is <strong>${ver.status}</strong> and locked for editing.
                ${ver.status === 'approved' ? ' Use "Create Revision" to make changes while preserving the baseline.' : ''}
            </div>` : ''}
        `;

        // Breadcrumb navigation
        container.querySelector('.breadcrumb-list').onclick = () => { self._view = 'list'; self._projectId = null; self.render(container); };
        container.querySelector('.breadcrumb-project').onclick = () => { self._view = 'project'; self._budgetVersionId = null; self.render(container); };

        if (!isLocked) {
            document.getElementById('addItemBtn').onclick = () => self._showItemModal(null);
            document.getElementById('aiImportBtn').onclick = () => self._showAIImport();
            document.getElementById('importCsvBtn').onclick = () => self._showCsvImport();
            document.getElementById('approveVersionBtn').onclick = () => self._approveVersion(ver.id);
            container.querySelectorAll('.edit-item-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const item = AppData.getBudgetItem(btn.dataset.id);
                    if (item) self._showItemModal(item);
                });
            });
            container.querySelectorAll('.delete-item-btn').forEach(btn => {
                btn.addEventListener('click', () => self._deleteItem(btn.dataset.id));
            });
        } else {
            const exportBtn = document.getElementById('exportItemsCsvBtn');
            if (exportBtn) exportBtn.onclick = () => self._exportItemsCsv(items, ver);
            const reviseBtn = document.getElementById('createRevisionBtn');
            if (reviseBtn) reviseBtn.onclick = () => self._createRevision(ver.id);
        }
    },

    // ══════════════════════════════════════════════════════════════════════
    //  BUDGET VERSION MANAGEMENT
    // ══════════════════════════════════════════════════════════════════════
    async _createDraftVersion() {
        const self = this;
        const projectId = self._projectId;
        const versions = AppData.getBudgetVersions ? AppData.getBudgetVersions(projectId) : [];
        if (versions.some(v => v.status === 'draft')) {
            Utils.showToast('A draft version already exists. Edit or approve it first.', 'error');
            return;
        }
        const versionNum = versions.length + 1;
        const ver = {
            id: AppData.generateId ? AppData.generateId() : (Date.now().toString(36) + Math.random().toString(36).substr(2,9)),
            projectId,
            version: versionNum,
            status: 'draft',
            name: 'Budget v' + versionNum,
            totalBudget: 0,
            createdAt: new Date().toISOString(),
            approvedAt: null,
            approvedBy: null,
            notes: '',
        };
        try {
            await AppData.saveBudgetVersionAsync(ver);
        } catch (e) {
            Utils.showToast('Failed to create budget version: ' + e.message, 'error');
            return;
        }
        AppData.addAuditLog('Admin', 'budget_version_created', 'Created draft budget v' + versionNum + ' for project ' + projectId);
        self._budgetVersionId = ver.id;
        self._view = 'version';
        self.render(self._container);
    },

    async _approveVersion(versionId) {
        const self = this;
        const ver = AppData.getBudgetVersion(versionId);
        if (!ver) return;
        const items = AppData.getBudgetItems ? AppData.getBudgetItems(versionId) : [];
        if (items.length === 0) {
            Utils.showToast('Cannot approve an empty budget. Add at least one work item.', 'error');
            return;
        }
        if (!confirm('Approve this budget? It will be locked for editing and become the approved baseline.')) return;
        ver.status = 'approved';
        ver.approvedAt = new Date().toISOString();
        ver.approvedBy = 'Admin';
        ver.totalBudget = items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
        try {
            await AppData.saveBudgetVersionAsync(ver);
        } catch (e) {
            Utils.showToast('Failed to approve budget: ' + e.message, 'error');
            return;
        }
        AppData.addAuditLog('Admin', 'budget_approved', 'Approved budget v' + ver.version + ' ($' + ver.totalBudget.toFixed(2) + ') for project ' + ver.projectId);
        Utils.showToast('Budget approved and locked as baseline.', 'success');
        self._view = 'project';
        self._budgetVersionId = null;
        self.render(self._container);
    },

    async _createRevision(sourceVersionId) {
        const self = this;
        const source = AppData.getBudgetVersion(sourceVersionId);
        if (!source) return;
        const projectId = source.projectId;
        const versions = AppData.getBudgetVersions ? AppData.getBudgetVersions(projectId) : [];
        if (versions.some(v => v.status === 'draft')) {
            Utils.showToast('A draft revision already exists.', 'error');
            return;
        }
        if (!confirm('Create a revision from this approved budget? A new draft will be created with the same items.')) return;

        const newVersion = versions.length + 1;
        const newVer = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2,9),
            projectId,
            version: newVersion,
            status: 'draft',
            name: 'Budget v' + newVersion + ' (Revision)',
            totalBudget: 0,
            createdAt: new Date().toISOString(),
            approvedAt: null,
            approvedBy: null,
            notes: 'Revised from v' + source.version,
        };
        try {
            await AppData.saveBudgetVersionAsync(newVer);
        } catch (e) {
            Utils.showToast('Failed to create revision: ' + e.message, 'error');
            return;
        }

        // Copy all items from source
        const sourceItems = AppData.getBudgetItems ? AppData.getBudgetItems(sourceVersionId) : [];
        for (const item of sourceItems) {
            const newItem = Object.assign({}, item, {
                id: Date.now().toString(36) + Math.random().toString(36).substr(2,9),
                budgetVersionId: newVer.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            try {
                await AppData.saveBudgetItemAsync(newItem);
            } catch (e) {
                Utils.showToast('Error copying item: ' + e.message, 'error');
            }
        }

        AppData.addAuditLog('Admin', 'budget_revision_created', 'Created revision v' + newVersion + ' from v' + source.version);
        Utils.showToast('Revision created. ' + sourceItems.length + ' items copied.', 'success');
        self._budgetVersionId = newVer.id;
        self._view = 'version';
        self.render(self._container);
    },

    _deleteVersion(versionId) {
        const self = this;
        const ver = AppData.getBudgetVersion(versionId);
        if (!ver) return;
        if (!confirm('Delete this draft budget and all its items? This cannot be undone.')) return;
        const items = AppData.getBudgetItems ? AppData.getBudgetItems(versionId) : [];
        items.forEach(i => AppData.deleteBudgetItem(i.id));
        AppData.deleteBudgetVersion(versionId);
        AppData.addAuditLog('Admin', 'budget_version_deleted', 'Deleted draft budget v' + ver.version);
        Utils.showToast('Budget version deleted.', 'success');
        self._view = 'project';
        self._budgetVersionId = null;
        self.render(self._container);
    },

    // ══════════════════════════════════════════════════════════════════════
    //  WORK ITEM MODAL (Add / Edit)
    // ══════════════════════════════════════════════════════════════════════
    _showItemModal(existingItem) {
        const self = this;
        const isNew = !existingItem;
        const item = existingItem || {};

        const bodyHtml = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                    <label style="font-size:.85em;font-weight:600;display:block;margin-bottom:4px">Cost Code <span style="color:#999;font-weight:normal">(optional)</span></label>
                    <input id="fi_costCode" type="text" value="${item.costCode || ''}" placeholder="e.g. 03-3000" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;font-size:.9em">
                </div>
                <div>
                    <label style="font-size:.85em;font-weight:600;display:block;margin-bottom:4px">Division</label>
                    <select id="fi_division" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;font-size:.9em">
                        <option value="">— Select —</option>
                        ${self.DIVISIONS.map(d => `<option value="${d.code}" ${item.division === d.code ? 'selected' : ''}>${d.code} – ${d.name}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div style="margin-top:12px">
                <label style="font-size:.85em;font-weight:600;display:block;margin-bottom:4px">Description <span style="color:#e74c3c">*</span></label>
                <input id="fi_description" type="text" value="${Utils.escapeHtml(item.description || '')}" placeholder="Work item description" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;font-size:.9em">
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
                <div>
                    <label style="font-size:.85em;font-weight:600;display:block;margin-bottom:4px">Category</label>
                    <select id="fi_category" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;font-size:.9em">
                        ${self.CATEGORIES.map(c => `<option value="${c}" ${(item.category || 'Labour') === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.85em;font-weight:600;display:block;margin-bottom:4px">Unit</label>
                    <select id="fi_unit" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;font-size:.9em">
                        ${self.UNITS.map(u => `<option value="${u}" ${(item.unit || 'LS') === u ? 'selected' : ''}>${u}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-top:12px">
                <div>
                    <label style="font-size:.85em;font-weight:600;display:block;margin-bottom:4px">Quantity <span style="color:#e74c3c">*</span></label>
                    <input id="fi_qty" type="number" min="0" step="any" value="${item.quantity !== undefined ? item.quantity : 1}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;font-size:.9em">
                </div>
                <div>
                    <label style="font-size:.85em;font-weight:600;display:block;margin-bottom:4px">Unit Cost ($) <span style="color:#e74c3c">*</span></label>
                    <input id="fi_unitCost" type="number" min="0" step="any" value="${item.unitCost !== undefined ? item.unitCost : ''}" placeholder="0.00" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;font-size:.9em">
                </div>
                <div>
                    <label style="font-size:.85em;font-weight:600;display:block;margin-bottom:4px">Total ($)</label>
                    <input id="fi_total" type="number" min="0" step="any" value="${item.total !== undefined ? parseFloat(item.total).toFixed(2) : ''}" placeholder="Auto-calc" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:6px;box-sizing:border-box;font-size:.9em;background:var(--bg-input);color:var(--text-primary)">
                    <div style="font-size:.75em;color:#999;margin-top:2px">Leave blank to auto-calculate</div>
                </div>
            </div>

            <div style="margin-top:12px">
                <label style="font-size:.85em;font-weight:600;display:block;margin-bottom:4px">Notes <span style="color:#999;font-weight:normal">(optional)</span></label>
                <input id="fi_notes" type="text" value="${Utils.escapeHtml(item.notes || '')}" placeholder="Additional notes" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;font-size:.9em">
            </div>

            <div id="fi_error" style="display:none;margin-top:12px;padding:8px 12px;background:var(--danger-bg);border-radius:6px;color:var(--danger);font-size:.85em"></div>
        `;

        const modal = UI.modal(isNew ? 'Add Work Item' : 'Edit Work Item', bodyHtml, {
            width: '520px',
            submitLabel: isNew ? 'Add Item' : 'Save Changes',
            scrollBody: true,
        });
        const q = s => modal.q(s);

        // Auto-calc total when qty or unitCost changes
        const qtyEl     = q('#fi_qty');
        const ucEl      = q('#fi_unitCost');
        const totalEl   = q('#fi_total');
        const calcTotal = () => {
            const qty = parseFloat(qtyEl.value);
            const u   = parseFloat(ucEl.value);
            if (!isNaN(qty) && !isNaN(u)) totalEl.value = (qty * u).toFixed(2);
        };
        qtyEl.addEventListener('input', calcTotal);
        ucEl.addEventListener('input', calcTotal);

        // Auto-fill division from cost code
        q('#fi_costCode').addEventListener('blur', function() {
            const code = this.value.trim();
            if (code.length >= 2) {
                const divCode = code.split('-')[0].padStart(2, '0');
                const divEl = q('#fi_division');
                if (self.DIVISIONS.find(d => d.code === divCode)) divEl.value = divCode;
            }
        });

        modal.submitBtn.addEventListener('click', async () => {
            const errorEl  = q('#fi_error');
            const desc     = q('#fi_description').value.trim();
            const qty      = parseFloat(q('#fi_qty').value);
            const unitCost = parseFloat(q('#fi_unitCost').value);
            const totalOverride = q('#fi_total').value;
            const total    = totalOverride !== '' ? parseFloat(totalOverride) : qty * unitCost;

            // Validation
            const errors = self._validateItem({ description: desc, quantity: qty, unitCost, total, costCode: q('#fi_costCode').value });
            if (errors.length > 0) {
                errorEl.textContent = errors[0];
                errorEl.style.display = 'block';
                return;
            }

            const saved = {
                id: item.id || (Date.now().toString(36) + Math.random().toString(36).substr(2,9)),
                projectId: AppData.getBudgetVersion(self._budgetVersionId).projectId,
                budgetVersionId: self._budgetVersionId,
                costCode:    q('#fi_costCode').value.trim(),
                division:    q('#fi_division').value,
                description: desc,
                category:    q('#fi_category').value,
                quantity:    qty,
                unit:        q('#fi_unit').value,
                unitCost,
                total:       isNaN(total) ? qty * unitCost : total,
                notes:       q('#fi_notes').value.trim(),
                createdAt:   item.createdAt || new Date().toISOString(),
                updatedAt:   new Date().toISOString(),
            };
            const restore = UI.btnLoading(modal.submitBtn, 'Saving…');
            try {
                await AppData.saveBudgetItemAsync(saved);
            } catch (e) {
                Utils.showToast('Failed to save item: ' + e.message, 'error');
                restore();
                return;
            }
            AppData.addAuditLog('Admin', isNew ? 'budget_item_added' : 'budget_item_edited', desc + ' $' + saved.total.toFixed(2));
            modal.close();
            self.render(self._container);
        });
    },

    _deleteItem(itemId) {
        if (!confirm('Delete this work item?')) return;
        AppData.deleteBudgetItem(itemId);
        AppData.addAuditLog('Admin', 'budget_item_deleted', itemId);
        this.render(this._container);
    },

    // ══════════════════════════════════════════════════════════════════════
    //  AI TEXT PARSER
    // ══════════════════════════════════════════════════════════════════════
    // Ollama relay endpoint — only reachable when on the same machine as LittleShield
    OLLAMA_RELAY: 'http://localhost:9999/ollama/budget-items',

    _showAIImport() {
        const self = this;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';

        overlay.innerHTML = `
            <div style="background:var(--bg-secondary);border-radius:10px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;padding:24px;box-sizing:border-box">
                <h3 style="margin-bottom:6px">🤖 AI Budget Generator</h3>
                <div id="ai_mode_badge" style="margin-bottom:12px">
                    <span style="padding:3px 10px;border-radius:10px;font-size:.78em;background:#e8f5e9;color:#2e7d32">Checking Ollama…</span>
                </div>
                <p style="color:var(--text-muted);font-size:.88em;margin-bottom:14px">
                    Paste a contract section, email, scope description, or work item list.
                    AI will extract structured line items. <strong>Review and edit before committing.</strong>
                </p>
                <textarea id="ai_input" placeholder="Paste contract text, email, or scope of work here…" style="width:100%;height:200px;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:.88em;resize:vertical;box-sizing:border-box;font-family:inherit"></textarea>
                <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px">
                    <button class="btn-secondary" id="ai_cancel">Cancel</button>
                    <button class="btn-primary" id="ai_parse">Extract Items →</button>
                </div>
                <div id="ai_status" style="display:none;margin-top:12px;text-align:center;color:var(--text-muted);font-size:.88em">
                    <div style="display:inline-block;width:16px;height:16px;border:2px solid #3498db;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite;vertical-align:middle;margin-right:8px"></div>
                    <span id="ai_status_text">Sending to Ollama…</span>
                </div>
                <div id="ai_preview" style="display:none;margin-top:20px"></div>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        `;

        document.body.appendChild(overlay);

        // Check if Ollama relay is reachable
        let ollamaAvailable = false;
        fetch(self.OLLAMA_RELAY, { method: 'OPTIONS', signal: AbortSignal.timeout(2000) })
            .then(() => {
                ollamaAvailable = true;
                overlay.querySelector('#ai_mode_badge').innerHTML =
                    '<span style="padding:3px 10px;border-radius:10px;font-size:.78em;background:#e8f5e9;color:#2e7d32">🟢 Ollama (llama3.1:8b) — understands prose, contracts, emails</span>';
            })
            .catch(() => {
                overlay.querySelector('#ai_mode_badge').innerHTML =
                    '<span style="padding:3px 10px;border-radius:10px;font-size:.78em;background:var(--warning-bg);color:var(--warning)">🟡 Basic parser (Ollama offline) — structured text only</span>';
            });

        overlay.querySelector('#ai_cancel').onclick = () => document.body.removeChild(overlay);

        overlay.querySelector('#ai_parse').onclick = async () => {
            const text = overlay.querySelector('#ai_input').value.trim();
            if (!text) return;
            const previewEl = overlay.querySelector('#ai_preview');
            const statusEl  = overlay.querySelector('#ai_status');
            previewEl.style.display = 'none';

            if (ollamaAvailable) {
                // Try Ollama
                statusEl.style.display = 'block';
                overlay.querySelector('#ai_parse').disabled = true;
                overlay.querySelector('#ai_status_text').textContent = 'Sending to Ollama (llama3.1:8b)…';
                try {
                    const res = await fetch(self.OLLAMA_RELAY, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text }),
                        signal: AbortSignal.timeout(90000),
                    });
                    statusEl.style.display = 'none';
                    overlay.querySelector('#ai_parse').disabled = false;
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        previewEl.innerHTML = `<div style="color:#e74c3c;font-size:.88em">Ollama error: ${err.error || res.status}. Falling back to basic parser.</div>`;
                        previewEl.style.display = 'block';
                        setTimeout(() => {
                            const fallback = self._parseAIText(text);
                            self._renderPreviewTable(fallback.length ? fallback : [], previewEl, overlay, 'basic parser');
                        }, 1500);
                        return;
                    }
                    const data = await res.json();
                    const items = data.items || [];
                    if (items.length === 0) {
                        previewEl.innerHTML = '<div style="color:#e74c3c;font-size:.88em">Ollama found no work items in this text. Try rephrasing or use CSV import.</div>';
                        previewEl.style.display = 'block';
                        return;
                    }
                    self._renderPreviewTable(items, previewEl, overlay, 'Ollama');
                } catch (err) {
                    statusEl.style.display = 'none';
                    overlay.querySelector('#ai_parse').disabled = false;
                    // Timeout or network error — fall back
                    previewEl.innerHTML = `<div style="color:#f39c12;font-size:.88em">Ollama timed out. Falling back to basic parser…</div>`;
                    previewEl.style.display = 'block';
                    setTimeout(() => {
                        const fallback = self._parseAIText(text);
                        self._renderPreviewTable(fallback.length ? fallback : [], previewEl, overlay, 'basic parser');
                    }, 800);
                }
            } else {
                // Regex fallback
                const parsed = self._parseAIText(text);
                if (parsed.length === 0) {
                    previewEl.innerHTML = '<div style="color:#e74c3c;font-size:.88em">Could not parse items. Try structured text (e.g. "Excavation 800 m³ @ $28.50") or use CSV import.</div>';
                    previewEl.style.display = 'block';
                    return;
                }
                self._renderPreviewTable(parsed, previewEl, overlay, 'basic parser');
            }
        };

        overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
    },

    _parseAIText(text) {
        const self = this;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
        const results = [];

        const unitMap = {
            'm2': 'm²', 'sqm': 'm²', 'sq.m': 'm²', 'sq m': 'm²',
            'm3': 'm³', 'cum': 'm³', 'cu.m': 'm³',
            'lm': 'lm', 'lin.m': 'lm', 'linm': 'lm', 'linear m': 'lm',
            'hr': 'hr', 'hrs': 'hr', 'hour': 'hr', 'hours': 'hr',
            'wk': 'wk', 'week': 'wk', 'weeks': 'wk',
            'day': 'day', 'days': 'day',
            'tonne': 'tonne', 'tonnes': 'tonne', 'ton': 'tonne', 'tons': 'tonne', 't': 'tonne',
            'kg': 'kg', 'kgs': 'kg',
            'ea': 'EA', 'each': 'EA', 'no.': 'EA',
            'ls': 'LS', 'lump sum': 'LS', 'lumpsum': 'LS', 'allow': 'allow',
            'm': 'm',
        };

        const divisionKeywords = {
            '01': ['mobilization','demob','management','supervision','overhead','temporary','layout','survey','testing','pm','project management','general'],
            '02': ['demolition','removal','salvage','abatement','existing','strip','clearing','grubbing'],
            '03': ['concrete','footing','foundation','slab','curb','sidewalk','precast','cast-in-place','formwork','rebar','reinforcing'],
            '04': ['masonry','brick','block','stone'],
            '05': ['steel','metal','structural','beam','column','anchor'],
            '06': ['wood','lumber','timber','carpentry','framing'],
            '07': ['waterproof','insulation','membrane','roofing','sealant'],
            '08': ['door','window','glazing','frame'],
            '09': ['drywall','paint','flooring','ceiling','tile','finish'],
            '23': ['hvac','mechanical','ventilation','heating','cooling','duct'],
            '22': ['plumbing','pipe','drain','sewer','water'],
            '26': ['electrical','conduit','cable','panel','lighting','power'],
            '31': ['earthwork','excavation','backfill','grading','compaction','cut','fill','topsoil','granular','subgrade'],
            '32': ['asphalt','paving','pavement','curb','gutter','sidewalk','landscaping','seeding','sod','fence','guardrail'],
            '33': ['utilities','watermain','storm','sanitary','culvert','manhole','catchbasin'],
        };

        const categoryKeywords = {
            Labour:      ['labour','labor','crew','worker','foreman','operator','driver','supervisor','management'],
            Equipment:   ['equipment','excavator','grader','roller','compactor','truck','loader','crane','machine'],
            Subcontract: ['subcontract','sub-contract','sub ','contractor','supply & install','supply and install'],
            Material:    ['supply','material','granular','asphalt','concrete','aggregate','stone','sand','gravel','pipe','rebar','lumber'],
        };

        for (const line of lines) {
            // Skip header lines
            if (/^(description|item|scope|work item|cost code|qty|quantity|unit|total|amount|\$|#)/i.test(line)) continue;

            // Patterns to extract: description, quantity, unit, unit cost
            // Try: "Description NNN unit @ $NNN" or "Description NNN unit $NNN"
            const patterns = [
                // "excavation 800 m³ @ $28.50/m³" or "... @ $28.50"
                /^(.+?)\s+([\d,]+\.?\d*)\s*(m²|m³|m2|m3|lm|hr|hrs|wk|weeks?|days?|tonnes?|tons?|ea|each|ls|lump sum|allow|m\b|kg)\s*[@x]\s*\$?([\d,]+\.?\d*)/i,
                // "Description — allow $8500 LS"  (lump sum with dollar first)
                /^(.+?)\s+[\-—]\s+(?:allow\s+)?\$?([\d,]+\.?\d*)\s*(ls|lump sum|allow)\s*/i,
                // "Description $8500"  (just a dollar amount, assume LS)
                /^(.+?)\s+[\-—]?\s*\$?([\d,]+\.?\d*)\s*$/,
                // "Description: 100 m² at $50"
                /^(.+?):\s*([\d,]+\.?\d*)\s*(m²|m³|m2|m3|lm|hr|hrs|wk|weeks?|days?|tonnes?|tons?|ea|each|ls|allow|m\b|kg)\s+(?:at|@|\$)\s*\$?([\d,]+\.?\d*)/i,
            ];

            let matched = false;
            for (const pat of patterns) {
                const m = line.match(pat);
                if (!m) continue;

                let description = m[1].replace(/[-—|,;:]+$/, '').trim();
                // Remove cost code prefix if present (e.g. "03-3000 Concrete Slab")
                const codeMatch = description.match(/^(\d{2}[-\s]\d{4})\s+/);
                let costCode = '';
                if (codeMatch) { costCode = codeMatch[1]; description = description.slice(codeMatch[0].length).trim(); }

                let qty, unit, unitCost, total;

                if (m.length === 3) {
                    // Just dollar amount (lump sum pattern)
                    qty = 1; unit = 'LS'; unitCost = parseFloat(m[2].replace(/,/g,'')); total = unitCost;
                } else if (m.length === 4) {
                    // Two-group: qty+unit + price
                    const rawQty = parseFloat(m[2].replace(/,/g,''));
                    const rawUnit = (m[3]||'LS').toLowerCase().replace(/\s+/g,'');
                    unit = unitMap[rawUnit] || m[3].trim();
                    qty = rawQty; unitCost = 0; total = rawQty; // dollar-first pattern
                } else {
                    qty = parseFloat(m[2].replace(/,/g,''));
                    const rawUnit = (m[3]||'LS').toLowerCase().replace(/\s+/g,'');
                    unit = unitMap[rawUnit] || m[3].trim();
                    unitCost = parseFloat((m[4]||'0').replace(/,/g,''));
                    total = qty * unitCost;
                }

                if (isNaN(qty) || qty < 0) qty = 1;
                if (isNaN(unitCost)) unitCost = 0;
                if (isNaN(total)) total = qty * unitCost;

                // Infer division from description
                let division = '';
                const descLower = description.toLowerCase();
                for (const [div, kws] of Object.entries(divisionKeywords)) {
                    if (kws.some(kw => descLower.includes(kw))) { division = div; break; }
                }

                // Infer category
                let category = 'Other';
                for (const [cat, kws] of Object.entries(categoryKeywords)) {
                    if (kws.some(kw => descLower.includes(kw))) { category = cat; break; }
                }
                if (category === 'Other' && ['m²','m³','lm','tonne','kg','m'].includes(unit)) category = 'Material';
                if (category === 'Other' && ['hr','day','wk'].includes(unit)) category = 'Labour';

                if (description.length < 3) { matched = false; continue; }
                results.push({ description, costCode, division, category, quantity: qty, unit, unitCost, total, _valid: true });
                matched = true;
                break;
            }

            // Fallback: any line with a dollar amount becomes LS item
            if (!matched) {
                const dollarMatch = line.match(/\$?([\d,]+\.?\d{0,2})(?:\s*(k|K))?\s*(?:ls|lump|allow)?/);
                if (dollarMatch && parseFloat(dollarMatch[1].replace(/,/g,'')) > 0) {
                    const desc = line.replace(/[\$\d,\.]+\s*(k|K)?\s*(ls|lump sum|allow|lump)?/gi, '').replace(/[-—]+$/, '').trim();
                    if (desc.length >= 3) {
                        let amt = parseFloat(dollarMatch[1].replace(/,/g,''));
                        if (dollarMatch[2]) amt *= 1000; // 'k' suffix
                        results.push({ description: desc, costCode: '', division: '', category: 'Other', quantity: 1, unit: 'LS', unitCost: amt, total: amt, _valid: true });
                    }
                }
            }
        }

        return results;
    },

    _renderPreviewTable(items, container, overlay, source) {
        const self = this;
        let editableItems = items.map((item, idx) => Object.assign({}, item, { _idx: idx }));

        const renderTable = () => {
            const total = editableItems.reduce((s, i) => s + (parseFloat(i.total)||0), 0);
            container.innerHTML = `
                <hr style="margin:16px 0">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                    <div style="font-weight:600;font-size:.95em">${editableItems.length} items · Total: $${self._fmt(total)}
                        ${source ? `<span style="margin-left:8px;font-size:.78em;font-weight:400;color:#999">via ${source}</span>` : ''}
                    </div>
                    <div style="font-size:.82em;color:#999">Edit cells inline before committing</div>
                </div>
                <div style="overflow-x:auto;border:1px solid #e0e0e0;border-radius:6px;margin-bottom:14px">
                    <table style="width:100%;border-collapse:collapse;font-size:.82em">
                        <thead style="background:var(--bg-tertiary)">
                            <tr>
                                <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #ddd">Description</th>
                                <th style="padding:8px 10px;text-align:center;border-bottom:1px solid #ddd">Cat</th>
                                <th style="padding:8px 10px;text-align:right;border-bottom:1px solid #ddd">Qty</th>
                                <th style="padding:8px 10px;text-align:center;border-bottom:1px solid #ddd">Unit</th>
                                <th style="padding:8px 10px;text-align:right;border-bottom:1px solid #ddd">Unit Cost</th>
                                <th style="padding:8px 10px;text-align:right;border-bottom:1px solid #ddd">Total</th>
                                <th style="padding:8px 10px;text-align:center;border-bottom:1px solid #ddd">✕</th>
                            </tr>
                        </thead>
                        <tbody>
                        ${editableItems.map((item, i) => {
                            const catColor = self.CATEGORY_COLORS[item.category] || '#aaa';
                            return `<tr data-preview-idx="${i}" style="border-bottom:1px solid #f0f0f0">
                                <td style="padding:6px 8px"><input class="pi_desc" data-idx="${i}" value="${Utils.escapeHtml(item.description)}" style="width:100%;border:1px solid transparent;padding:3px 4px;border-radius:4px;font-size:inherit" oninput="this.style.border='1px solid #ddd'"></td>
                                <td style="padding:6px 8px;text-align:center">
                                    <select class="pi_cat" data-idx="${i}" style="border:1px solid #ddd;border-radius:4px;padding:2px 4px;font-size:.9em">
                                        ${self.CATEGORIES.map(c=>`<option value="${c}" ${item.category===c?'selected':''}>${c}</option>`).join('')}
                                    </select>
                                </td>
                                <td style="padding:6px 8px;text-align:right"><input class="pi_qty" data-idx="${i}" type="number" value="${item.quantity}" style="width:60px;border:1px solid #ddd;padding:3px 4px;border-radius:4px;text-align:right;font-size:inherit"></td>
                                <td style="padding:6px 8px;text-align:center">
                                    <select class="pi_unit" data-idx="${i}" style="border:1px solid #ddd;border-radius:4px;padding:2px 4px;font-size:.9em">
                                        ${self.UNITS.map(u=>`<option value="${u}" ${item.unit===u?'selected':''}>${u}</option>`).join('')}
                                    </select>
                                </td>
                                <td style="padding:6px 8px;text-align:right"><input class="pi_uc" data-idx="${i}" type="number" step="any" value="${parseFloat(item.unitCost).toFixed(2)}" style="width:80px;border:1px solid #ddd;padding:3px 4px;border-radius:4px;text-align:right;font-size:inherit"></td>
                                <td style="padding:6px 8px;text-align:right;font-weight:600">$${self._fmt(parseFloat(item.total)||0)}</td>
                                <td style="padding:6px 8px;text-align:center"><button class="pi_remove" data-idx="${i}" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:1.1em">✕</button></td>
                            </tr>`;
                        }).join('')}
                        </tbody>
                    </table>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:10px">
                    <button class="btn-secondary" id="ai_cancel2">Cancel</button>
                    <button class="btn-primary" id="ai_commit">Add ${editableItems.length} Items to Budget</button>
                </div>
            `;
            container.style.display = 'block';

            // Live recalc total on qty/unitCost change
            container.querySelectorAll('.pi_qty, .pi_uc').forEach(inp => {
                inp.addEventListener('input', () => {
                    const idx = parseInt(inp.dataset.idx);
                    const row = container.querySelector(`tr[data-preview-idx="${idx}"]`);
                    const qty = parseFloat(row.querySelector('.pi_qty').value) || 0;
                    const uc  = parseFloat(row.querySelector('.pi_uc').value) || 0;
                    editableItems[idx].quantity = qty;
                    editableItems[idx].unitCost = uc;
                    editableItems[idx].total = qty * uc;
                    row.querySelectorAll('td')[5].textContent = '$' + self._fmt(editableItems[idx].total);
                });
            });
            container.querySelectorAll('.pi_desc').forEach(inp => {
                inp.addEventListener('input', () => { editableItems[parseInt(inp.dataset.idx)].description = inp.value; });
            });
            container.querySelectorAll('.pi_cat').forEach(sel => {
                sel.addEventListener('change', () => { editableItems[parseInt(sel.dataset.idx)].category = sel.value; });
            });
            container.querySelectorAll('.pi_unit').forEach(sel => {
                sel.addEventListener('change', () => { editableItems[parseInt(sel.dataset.idx)].unit = sel.value; });
            });
            container.querySelectorAll('.pi_remove').forEach(btn => {
                btn.addEventListener('click', () => {
                    editableItems.splice(parseInt(btn.dataset.idx), 1);
                    editableItems.forEach((it, i) => { it._idx = i; });
                    renderTable();
                });
            });

            document.getElementById('ai_cancel2').onclick = () => document.body.removeChild(overlay);
            document.getElementById('ai_commit').onclick = async () => {
                const ver = AppData.getBudgetVersion(self._budgetVersionId);
                if (!ver) return;
                const commitBtn = document.getElementById('ai_commit');
                if (commitBtn) { commitBtn.disabled = true; commitBtn.textContent = 'Saving…'; }
                let saved = 0;
                for (const item of editableItems) {
                    if (!item.description.trim()) continue;
                    const newItem = {
                        id: Date.now().toString(36) + Math.random().toString(36).substr(2,9) + saved,
                        projectId: ver.projectId,
                        budgetVersionId: self._budgetVersionId,
                        costCode: item.costCode || '',
                        division: item.division || '',
                        description: item.description.trim(),
                        category: item.category || 'Other',
                        quantity: parseFloat(item.quantity) || 1,
                        unit: item.unit || 'LS',
                        unitCost: parseFloat(item.unitCost) || 0,
                        total: parseFloat(item.total) || 0,
                        notes: '',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    };
                    try {
                        await AppData.saveBudgetItemAsync(newItem);
                        saved++;
                    } catch (e) {
                        Utils.showToast('Error saving item "' + newItem.description + '": ' + e.message, 'error');
                    }
                }
                AppData.addAuditLog('Admin', 'budget_ai_import', saved + ' items imported via AI parser');
                document.body.removeChild(overlay);
                Utils.showToast(saved + ' work items added.', 'success');
                self.render(self._container);
            };
        };

        renderTable();
    },

    // ══════════════════════════════════════════════════════════════════════
    //  CSV IMPORT
    // ══════════════════════════════════════════════════════════════════════
    _showCsvImport() {
        const self = this;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';

        overlay.innerHTML = `
            <div style="background:var(--bg-secondary);border-radius:10px;width:100%;max-width:580px;max-height:90vh;overflow-y:auto;padding:24px;box-sizing:border-box">
                <h3 style="margin-bottom:8px">📂 Import from CSV</h3>
                <p style="color:var(--text-muted);font-size:.88em;margin-bottom:16px">Upload a CSV file with budget work items. <a id="downloadTplBtn" href="#" style="color:#3498db">Download template</a></p>
                <div style="padding:12px;background:var(--bg-surface);border-radius:6px;font-size:.82em;color:var(--text-secondary);margin-bottom:16px">
                    <strong>Expected columns:</strong> cost_code, division, description*, category, quantity*, unit, unit_cost*, total, notes<br>
                    <span style="color:#999">* required · total auto-calculated if blank · category: Labour/Material/Equipment/Subcontract/Other</span>
                </div>
                <div id="csv_drop_zone" style="margin-bottom:8px;"></div>
                <input type="file" id="csv_file" accept=".csv,.txt" style="display:none">
                <div id="csv_status" style="margin-top:10px;font-size:.85em;color:var(--text-muted)"></div>
                <div id="csv_preview" style="display:none;margin-top:16px"></div>
                <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
                    <button class="btn-secondary" id="csv_cancel">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.querySelector('#downloadTplBtn').onclick = e => { e.preventDefault(); self._downloadCsvTemplate(); };
        overlay.querySelector('#csv_cancel').onclick = () => document.body.removeChild(overlay);

        // Shared handler for both click-select and drag-drop CSV files
        function processCsvFile(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = e => {
                const statusEl = overlay.querySelector('#csv_status');
                const previewEl = overlay.querySelector('#csv_preview');
                try {
                    const parsed = self._parseCsv(e.target.result);
                    const validated = self._validateCsvItems(parsed);
                    statusEl.innerHTML = `<span style="color:#2e7d32">✓ ${validated.valid.length} valid items</span>` +
                        (validated.errors.length ? ` · <span style="color:#e74c3c">${validated.errors.length} errors</span>` : '');
                    self._renderPreviewTable(validated.valid, previewEl, overlay);
                } catch(err) {
                    statusEl.innerHTML = `<span style="color:#e74c3c">Error: ${err.message}</span>`;
                }
            };
            reader.readAsText(file);
        }

        overlay.querySelector('#csv_file').onchange = function() {
            processCsvFile(this.files[0]);
        };

        // Drag-and-drop zone
        if (window.UploadHelper) {
            UploadHelper.initDragDrop({
                zone:          overlay.querySelector('#csv_drop_zone'),
                input:         overlay.querySelector('#csv_file'),
                accept:        '.csv,.txt',
                multiple:      false,
                listenToInput: false,
                onFiles:       function(files) { processCsvFile(files[0]); },
                label:         'Drag a CSV file here to import',
                hint:          'Or click to browse • .csv or .txt only',
            });
        }

        overlay.addEventListener('click', e => { if (e.target === overlay) document.body.removeChild(overlay); });
    },

    _downloadCsvTemplate() {
        const headers = 'cost_code,division,description,category,quantity,unit,unit_cost,total,notes';
        const examples = [
            '03-3000,03,Concrete footing — 0.6m wide,Material,45,m³,185.00,,',
            '31-2000,31,Excavation — bulk earthworks,Equipment,850,m³,22.50,,',
            '32-1213,32,Granular A base course,Material,120,tonne,45.00,,',
            '32-1216,32,Asphalt paving — 50mm HL4,Subcontract,1200,m²,38.00,,',
            '01-5100,01,Project management & supervision,Labour,12,wk,2200.00,,',
            ',01,Traffic control — allow,Other,1,LS,8500.00,,',
        ];
        const csv = headers + '\n' + examples.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'ledgerman-budget-template.csv';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    },

    _parseCsv(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) throw new Error('File appears empty or has only headers');

        // Detect separator
        const sep = lines[0].includes('\t') ? '\t' : ',';

        const parseLine = line => {
            const result = [];
            let inQuotes = false, cur = '';
            for (let i = 0; i < line.length; i++) {
                const c = line[i];
                if (c === '"') { inQuotes = !inQuotes; continue; }
                if (c === sep && !inQuotes) { result.push(cur.trim()); cur = ''; continue; }
                cur += c;
            }
            result.push(cur.trim());
            return result;
        };

        const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z_]/g,''));
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const cols = parseLine(lines[i]);
            if (cols.every(c => !c)) continue;
            const row = {};
            headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });
            rows.push(row);
        }

        return rows;
    },

    _validateCsvItems(rows) {
        const self = this;
        const valid = [], errors = [];
        const unitMap = { 'm2': 'm²', 'm3': 'm³', 'sqm': 'm²', 'cum': 'm³' };
        const validCats = new Set(self.CATEGORIES.map(c => c.toLowerCase()));

        rows.forEach((row, i) => {
            const lineNum = i + 2;
            const errs = [];

            const description = row.description || row.Description || '';
            if (!description.trim()) { errors.push(`Row ${lineNum}: description is required`); return; }

            const qty = parseFloat(row.quantity || row.qty || '1');
            if (isNaN(qty) || qty < 0) errs.push(`Row ${lineNum}: invalid quantity`);

            const unitCost = parseFloat(row.unit_cost || row.unitcost || row.unit_cost || '0');
            if (isNaN(unitCost)) errs.push(`Row ${lineNum}: invalid unit_cost`);

            if (errs.length > 0) { errors.push(...errs); return; }

            const rawUnit = (row.unit || 'LS').trim();
            const unit = unitMap[rawUnit.toLowerCase()] || rawUnit || 'LS';
            const rawCat = (row.category || '').trim();
            const category = self.CATEGORIES.find(c => c.toLowerCase() === rawCat.toLowerCase()) || 'Other';
            const totalRaw = parseFloat(row.total || '');
            const total = !isNaN(totalRaw) && totalRaw > 0 ? totalRaw : qty * unitCost;

            valid.push({
                description:   description.trim(),
                costCode:      (row.cost_code || row.costcode || '').trim(),
                division:      (row.division || '').trim().padStart(2, '0').replace(/^0+$/, ''),
                category,
                quantity:      qty,
                unit,
                unitCost,
                total,
                notes:         (row.notes || '').trim(),
                _valid:        true,
            });
        });

        return { valid, errors };
    },

    // ══════════════════════════════════════════════════════════════════════
    //  VALIDATION LAYER
    // ══════════════════════════════════════════════════════════════════════
    _validateItem(item) {
        const errors = [];
        if (!item.description || !item.description.trim()) errors.push('Description is required.');
        if (isNaN(item.quantity) || item.quantity < 0) errors.push('Quantity must be a positive number.');
        if (isNaN(item.unitCost) || item.unitCost < 0) errors.push('Unit cost must be 0 or greater.');
        if (item.costCode && !/^[\d]{2}[-\s][\d]{4}$/.test(item.costCode.trim()) && !/^\d{6}$/.test(item.costCode.trim())) {
            // Soft warning — not blocking (cost codes can be custom)
        }
        return errors;
    },

    // ══════════════════════════════════════════════════════════════════════
    //  EXPORT
    // ══════════════════════════════════════════════════════════════════════
    _exportSummaryCsv(sorted) {
        const rows = [['Project', 'Status', 'Budgeted', 'Spent', 'Remaining', '% Spent']];
        sorted.forEach(d => rows.push([d.name, d.status, d.budgeted.toFixed(2), d.spent.toFixed(2), d.variance.toFixed(2), d.percentSpent + '%']));
        this._downloadCsv(rows.map(r => r.map(v => this._csvEsc(v)).join(',')).join('\n'), 'budget-summary');
    },

    _exportItemsCsv(items, ver) {
        const rows = [['Cost Code', 'Division', 'Description', 'Category', 'Quantity', 'Unit', 'Unit Cost', 'Total', 'Notes']];
        items.forEach(i => rows.push([i.costCode||'', i.division||'', i.description, i.category, i.quantity, i.unit, (parseFloat(i.unitCost)||0).toFixed(2), (parseFloat(i.total)||0).toFixed(2), i.notes||'']));
        this._downloadCsv(rows.map(r => r.map(v => this._csvEsc(v)).join(',')).join('\n'), 'budget-' + (ver.name || 'v' + ver.version).replace(/\s+/g,'-').toLowerCase());
    },

    _csvEsc(val) {
        const s = String(val === null || val === undefined ? '' : val);
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
    },

    _downloadCsv(content, name) {
        const today = new Date().toISOString().slice(0,10);
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'ledgerman-' + name + '-' + today + '.csv';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    },

    // ══════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ══════════════════════════════════════════════════════════════════════
    _fmt(n) {
        const num = parseFloat(n) || 0;
        return num.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    _fmtNum(n) {
        const num = parseFloat(n);
        if (isNaN(num)) return '—';
        return num % 1 === 0 ? num.toLocaleString('en-CA') : num.toFixed(2);
    },

    _summaryCard(label, value, sub, color) {
        return `<div style="padding:16px;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border-color)">
            <div style="color:#999;font-size:.82em;text-transform:uppercase;margin-bottom:6px">${label}</div>
            <div style="font-size:1.5em;font-weight:bold;color:${color}">${value}</div>
            <div style="font-size:.82em;color:#999;margin-top:4px">${sub}</div>
        </div>`;
    },
};

// ── Expose CRUD to AppData namespace (forward-compatible) ──────────────────
if (typeof AppData !== 'undefined') {
    AppData.getBudgetVersions  = AppData.getBudgetVersions  || function(pid) { return typeof getBudgetVersions  === 'function' ? getBudgetVersions(pid)  : []; };
    AppData.getBudgetVersion   = AppData.getBudgetVersion   || function(id)  { return typeof getBudgetVersion   === 'function' ? getBudgetVersion(id)    : null; };
    AppData.saveBudgetVersion      = AppData.saveBudgetVersion      || function(v)   { return typeof saveBudgetVersion      === 'function' ? saveBudgetVersion(v)      : null; };
    AppData.saveBudgetVersionAsync = AppData.saveBudgetVersionAsync || function(v)   { return typeof saveBudgetVersionAsync === 'function' ? saveBudgetVersionAsync(v) : Promise.resolve(null); };
    AppData.deleteBudgetVersion    = AppData.deleteBudgetVersion    || function(id)  { return typeof deleteBudgetVersion    === 'function' ? deleteBudgetVersion(id)  : null; };
    AppData.getBudgetItems         = AppData.getBudgetItems         || function(vid) { return typeof getBudgetItems         === 'function' ? getBudgetItems(vid)      : []; };
    AppData.getBudgetItem          = AppData.getBudgetItem          || function(id)  { return typeof getBudgetItem          === 'function' ? getBudgetItem(id)        : null; };
    AppData.saveBudgetItem         = AppData.saveBudgetItem         || function(i)   { return typeof saveBudgetItem         === 'function' ? saveBudgetItem(i)        : null; };
    AppData.saveBudgetItemAsync    = AppData.saveBudgetItemAsync    || function(i)   { return typeof saveBudgetItemAsync    === 'function' ? saveBudgetItemAsync(i)   : Promise.resolve(null); };
    AppData.deleteBudgetItem       = AppData.deleteBudgetItem       || function(id)  { return typeof deleteBudgetItem       === 'function' ? deleteBudgetItem(id)     : null; };
    AppData.generateId             = AppData.generateId             || function()    { return Date.now().toString(36) + Math.random().toString(36).substr(2,9); };
}
