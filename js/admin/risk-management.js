// Admin Risk Management — Risk Register
// Track project risks by probability, impact, and mitigation
window.AdminRiskManagement = {
    _filterProject: 'All',
    _filterStatus: 'All',
    _filterCategory: 'All',
    _editingId: null,

    render(container) {
        const self = this;
        self._container = container;
        self._renderList();
    },

    _renderList() {
        const self = this;
        const container = self._container;

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allItems = AppData.getAll ? AppData.getAll('risk_items') : [];
        const items = Array.isArray(allItems) ? allItems : [];

        const categories = ['Schedule', 'Cost', 'Safety', 'Quality', 'Scope', 'Resource', 'Environmental', 'Contractual', 'Other'];
        const statuses = ['Identified', 'Monitoring', 'Mitigating', 'Closed', 'Realized'];

        function riskLevel(rating) {
            if (rating >= 10) return 'High';
            if (rating >= 5) return 'Medium';
            return 'Low';
        }

        // Filter
        const filtered = items.filter(item => {
            const projMatch = self._filterProject === 'All' || item.projectId === self._filterProject;
            const statMatch = self._filterStatus === 'All' || item.status === self._filterStatus;
            const catMatch = self._filterCategory === 'All' || item.category === self._filterCategory;
            return projMatch && statMatch && catMatch;
        });

        // Sort by risk rating descending
        const sorted = filtered.slice().sort((a, b) => {
            const ra = (parseFloat(a.probability) || 1) * (parseFloat(a.impact) || 1);
            const rb = (parseFloat(b.probability) || 1) * (parseFloat(b.impact) || 1);
            return rb - ra;
        });

        // Summary counts
        const totalRisks = items.length;
        const highRisks = items.filter(i => ((parseFloat(i.probability)||1)*(parseFloat(i.impact)||1)) >= 10).length;
        const medRisks  = items.filter(i => { const r = (parseFloat(i.probability)||1)*(parseFloat(i.impact)||1); return r >= 5 && r < 10; }).length;
        const lowRisks  = items.filter(i => ((parseFloat(i.probability)||1)*(parseFloat(i.impact)||1)) < 5).length;
        const closedRisks = items.filter(i => i.status === 'Closed').length;

        // Risk matrix counts (3x3: Low/Medium/High probability vs Low/Medium/High impact)
        function probBand(p) { if (p <= 2) return 0; if (p <= 3) return 1; return 2; }
        function impBand(i) { if (i <= 2) return 0; if (i <= 3) return 1; return 2; }
        const matrixCounts = [[0,0,0],[0,0,0],[0,0,0]];
        items.filter(i => i.status !== 'Closed').forEach(i => {
            const pb = probBand(parseFloat(i.probability)||1);
            const ib = impBand(parseFloat(i.impact)||1);
            matrixCounts[2 - pb][ib]++;
        });
        const matrixColors = [
            ['#fd7e14','#dc3545','#dc3545'],
            ['#198754','#fd7e14','#dc3545'],
            ['#198754','#198754','#fd7e14']
        ];
        const matrixLabels = [['Low','Low','Low'],['Low','Med','High'],['Med','High','High']];

        function ratingBadge(rating) {
            const r = parseFloat(rating) || 0;
            const color = r >= 10 ? '#dc3545' : r >= 5 ? '#fd7e14' : '#198754';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${color};color:white">${r}</span>`;
        }

        function statusBadge(status) {
            const colors = { Identified: '#0d6efd', Monitoring: '#fd7e14', Mitigating: '#6f42c1', Closed: '#198754', Realized: '#dc3545' };
            const color = colors[status] || '#6c757d';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${color};color:white">${Utils.escapeHtml(status||'')}</span>`;
        }

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h2 style="margin:0">Risk Register</h2>
                    <button class="btn-primary" id="addRiskBtn">+ Add Risk</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Identify, assess, and track project risks to reduce exposure</p>
            </div>

            <!-- Risk Matrix -->
            <div style="margin-bottom:24px;padding:16px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                <div style="font-weight:600;margin-bottom:10px;font-size:.95rem">Risk Matrix (Active Risks)</div>
                <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">
                    <div>
                        <div style="font-size:.75rem;color:var(--text2);margin-bottom:4px;text-align:center">Probability ↑ / Impact →</div>
                        <table style="border-collapse:collapse;font-size:.8rem">
                            <thead>
                                <tr>
                                    <th style="padding:4px 8px;color:var(--text2)"></th>
                                    <th style="padding:4px 8px;text-align:center;color:var(--text2)">Low Impact</th>
                                    <th style="padding:4px 8px;text-align:center;color:var(--text2)">Med Impact</th>
                                    <th style="padding:4px 8px;text-align:center;color:var(--text2)">High Impact</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${['High Prob','Med Prob','Low Prob'].map((label,row) => `
                                    <tr>
                                        <td style="padding:4px 8px;color:var(--text2);white-space:nowrap">${label}</td>
                                        ${[0,1,2].map(col => `
                                            <td style="padding:4px 8px;text-align:center;background:${matrixColors[row][col]};color:white;border-radius:4px;min-width:50px;font-weight:600">
                                                ${matrixCounts[row][col]}
                                            </td>
                                        `).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
                        <div style="display:flex;align-items:center;gap:6px"><span style="width:14px;height:14px;background:#dc3545;border-radius:3px;display:inline-block"></span><span style="font-size:.8rem">High (10–25)</span></div>
                        <div style="display:flex;align-items:center;gap:6px"><span style="width:14px;height:14px;background:#fd7e14;border-radius:3px;display:inline-block"></span><span style="font-size:.8rem">Medium (5–9)</span></div>
                        <div style="display:flex;align-items:center;gap:6px"><span style="width:14px;height:14px;background:#198754;border-radius:3px;display:inline-block"></span><span style="font-size:.8rem">Low (1–4)</span></div>
                    </div>
                </div>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Total Risks</div>
                    <div style="font-size:1.7rem;font-weight:700;color:var(--text-primary)">${totalRisks}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid #dc3545">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">High Risk</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#dc3545">${highRisks}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid #fd7e14">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Medium Risk</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#fd7e14">${medRisks}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid #198754">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Low Risk</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#198754">${lowRisks}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Closed</div>
                    <div style="font-size:1.7rem;font-weight:700;color:var(--text-primary)">${closedRisks}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-end">
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                    <select id="riskProjectFilter" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Status</label>
                    <select id="riskStatusFilter" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All" ${self._filterStatus === 'All' ? 'selected' : ''}>All Statuses</option>
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Category</label>
                    <select id="riskCategoryFilter" style="padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All" ${self._filterCategory === 'All' ? 'selected' : ''}>All Categories</option>
                        ${categories.map(c => `<option value="${c}" ${self._filterCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:11px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.85rem;white-space:nowrap">Project</th>
                            <th style="padding:11px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.85rem">Title</th>
                            <th style="padding:11px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.85rem">Category</th>
                            <th style="padding:11px 12px;text-align:center;border-bottom:2px solid var(--border);font-size:.85rem;white-space:nowrap">Prob (1-5)</th>
                            <th style="padding:11px 12px;text-align:center;border-bottom:2px solid var(--border);font-size:.85rem;white-space:nowrap">Impact (1-5)</th>
                            <th style="padding:11px 12px;text-align:center;border-bottom:2px solid var(--border);font-size:.85rem">Rating</th>
                            <th style="padding:11px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.85rem">Owner</th>
                            <th style="padding:11px 12px;text-align:center;border-bottom:2px solid var(--border);font-size:.85rem">Status</th>
                            <th style="padding:11px 12px;text-align:left;border-bottom:2px solid var(--border);font-size:.85rem;white-space:nowrap">Review Date</th>
                            <th style="padding:11px 12px;text-align:center;border-bottom:2px solid var(--border);font-size:.85rem">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.length > 0 ? sorted.map(item => {
                            const proj = projects.find(p => p.id === item.projectId);
                            const prob = parseFloat(item.probability) || 1;
                            const imp  = parseFloat(item.impact) || 1;
                            const rating = prob * imp;
                            return `
                                <tr style="border-bottom:1px solid var(--border)" class="risk-row">
                                    <td style="padding:10px 12px;font-size:.88rem">${Utils.escapeHtml(proj ? proj.name : 'Unknown')}</td>
                                    <td style="padding:10px 12px">
                                        <strong style="font-size:.9rem">${Utils.escapeHtml(item.title || '')}</strong>
                                        ${item.description ? `<div style="font-size:.78rem;color:var(--text2);margin-top:2px">${Utils.escapeHtml(item.description.substring(0,80))}${item.description.length > 80 ? '…' : ''}</div>` : ''}
                                    </td>
                                    <td style="padding:10px 12px;font-size:.88rem">${Utils.escapeHtml(item.category || '')}</td>
                                    <td style="padding:10px 12px;text-align:center;font-size:.9rem;font-weight:600">${prob}</td>
                                    <td style="padding:10px 12px;text-align:center;font-size:.9rem;font-weight:600">${imp}</td>
                                    <td style="padding:10px 12px;text-align:center">${ratingBadge(rating)}</td>
                                    <td style="padding:10px 12px;font-size:.88rem">${Utils.escapeHtml(item.owner || '—')}</td>
                                    <td style="padding:10px 12px;text-align:center">${statusBadge(item.status || 'Identified')}</td>
                                    <td style="padding:10px 12px;font-size:.85rem;color:var(--text2)">${item.reviewDate ? item.reviewDate : '—'}</td>
                                    <td style="padding:10px 12px;text-align:center;white-space:nowrap">
                                        <button class="btn-secondary btn-sm" data-id="${item.id}" data-action="edit" style="margin-right:4px">Edit</button>
                                        <button class="btn-secondary btn-sm" data-id="${item.id}" data-action="delete">Delete</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="10" style="padding:36px;text-align:center;color:var(--text2)">
                                    No risk items found. Click "+ Add Risk" to register a new risk.
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        `;

        // Event bindings
        document.getElementById('riskProjectFilter').onchange = e => { self._filterProject = e.target.value; self._renderList(); };
        document.getElementById('riskStatusFilter').onchange  = e => { self._filterStatus  = e.target.value; self._renderList(); };
        document.getElementById('riskCategoryFilter').onchange = e => { self._filterCategory = e.target.value; self._renderList(); };

        document.getElementById('addRiskBtn').onclick = () => self._showForm(null);

        container.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = () => self._showForm(btn.dataset.id);
        });

        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this risk item? This cannot be undone.')) {
                    try {
                        AppData.remove('risk_items', btn.dataset.id);
                        Utils.showToast('Risk deleted', 'success');
                        self._renderList();
                    } catch(err) {
                        console.error('Delete failed:', err);
                        Utils.showToast('Failed to delete risk', 'error');
                    }
                }
            };
        });
    },

    _showForm(itemId) {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allItems = AppData.getAll ? AppData.getAll('risk_items') : [];
        const item = itemId ? (Array.isArray(allItems) ? allItems.find(i => i.id === itemId) : null) : null;

        const isNew = !item;
        const id = item ? item.id : ('risk_' + Date.now());

        const categories = ['Schedule', 'Cost', 'Safety', 'Quality', 'Scope', 'Resource', 'Environmental', 'Contractual', 'Other'];
        const statuses = ['Identified', 'Monitoring', 'Mitigating', 'Closed', 'Realized'];

        const fv = (field, def) => item ? (item[field] !== undefined && item[field] !== null ? item[field] : def) : def;

        container.innerHTML = `
            <div style="max-width:680px;margin:0 auto">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
                    <button class="btn-secondary btn-sm" id="riskBackBtn">← Back</button>
                    <h2 style="margin:0">${isNew ? 'Add New Risk' : 'Edit Risk'}</h2>
                </div>

                <form id="riskForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                        <div style="grid-column:1/-1">
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Project *</label>
                            <select id="riskProjectId" required style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                <option value="">— Select Project —</option>
                                ${projects.map(p => `<option value="${p.id}" ${fv('projectId','') === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div style="grid-column:1/-1">
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Title *</label>
                            <input type="text" id="riskTitle" placeholder="Brief risk title" required value="${Utils.escapeHtml(fv('title',''))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div style="grid-column:1/-1">
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Description</label>
                            <textarea id="riskDescription" rows="3" placeholder="Detailed description of the risk..."
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;resize:vertical">${Utils.escapeHtml(fv('description',''))}</textarea>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Category</label>
                            <select id="riskCategory" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                ${categories.map(c => `<option value="${c}" ${fv('category','Schedule') === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Status</label>
                            <select id="riskStatus" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                                ${statuses.map(s => `<option value="${s}" ${fv('status','Identified') === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Probability (1=Very Low, 5=Almost Certain)</label>
                            <input type="number" id="riskProbability" min="1" max="5" step="1" value="${fv('probability',1)}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Impact (1=Negligible, 5=Catastrophic)</label>
                            <input type="number" id="riskImpact" min="1" max="5" step="1" value="${fv('impact',1)}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div style="grid-column:1/-1">
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Risk Rating (auto-calculated)</label>
                            <div id="riskRatingDisplay" style="padding:10px 14px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);font-size:1rem;font-weight:700;color:var(--text-primary)">
                                ${(parseFloat(fv('probability',1)) * parseFloat(fv('impact',1)))}
                            </div>
                        </div>
                        <div style="grid-column:1/-1">
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Mitigation Plan</label>
                            <textarea id="riskMitigationPlan" rows="3" placeholder="Steps to reduce probability or impact..."
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;resize:vertical">${Utils.escapeHtml(fv('mitigationPlan',''))}</textarea>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Owner</label>
                            <input type="text" id="riskOwner" placeholder="Responsible person or team" value="${Utils.escapeHtml(fv('owner',''))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Review Date</label>
                            <input type="date" id="riskReviewDate" value="${fv('reviewDate','')}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Closed Date</label>
                            <input type="date" id="riskClosedDate" value="${fv('closedDate','')}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div style="grid-column:1/-1">
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Notes</label>
                            <textarea id="riskNotes" rows="2" placeholder="Additional notes..."
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;resize:vertical">${Utils.escapeHtml(fv('notes',''))}</textarea>
                        </div>
                    </div>

                    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--border)">
                        <button type="button" id="riskCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">${isNew ? 'Create Risk' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('riskBackBtn').onclick = () => self._renderList();
        document.getElementById('riskCancelBtn').onclick = () => self._renderList();

        // Live risk rating calculation
        function updateRating() {
            const p = parseFloat(document.getElementById('riskProbability').value) || 1;
            const i = parseFloat(document.getElementById('riskImpact').value) || 1;
            const rating = p * i;
            const el = document.getElementById('riskRatingDisplay');
            const color = rating >= 10 ? '#dc3545' : rating >= 5 ? '#fd7e14' : '#198754';
            el.textContent = rating;
            el.style.color = color;
        }
        document.getElementById('riskProbability').oninput = updateRating;
        document.getElementById('riskImpact').oninput = updateRating;
        updateRating();

        document.getElementById('riskForm').onsubmit = e => {
            e.preventDefault();
            const submitBtn = document.querySelector('#riskForm [type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

            try {
                const prob = Math.min(5, Math.max(1, parseFloat(document.getElementById('riskProbability').value) || 1));
                const imp  = Math.min(5, Math.max(1, parseFloat(document.getElementById('riskImpact').value) || 1));
                const newItem = {
                    id,
                    projectId:       document.getElementById('riskProjectId').value,
                    title:           document.getElementById('riskTitle').value,
                    description:     document.getElementById('riskDescription').value,
                    category:        document.getElementById('riskCategory').value,
                    probability:     prob,
                    impact:          imp,
                    riskRating:      prob * imp,
                    mitigationPlan:  document.getElementById('riskMitigationPlan').value,
                    owner:           document.getElementById('riskOwner').value,
                    status:          document.getElementById('riskStatus').value,
                    reviewDate:      document.getElementById('riskReviewDate').value,
                    closedDate:      document.getElementById('riskClosedDate').value,
                    notes:           document.getElementById('riskNotes').value,
                    created_at: item ? item.created_at : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                AppData.save('risk_items', newItem);
                Utils.showToast(isNew ? 'Risk created' : 'Risk updated', 'success');
                self._renderList();
            } catch(err) {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = isNew ? 'Create Risk' : 'Save Changes'; }
                console.error('Save failed:', err);
                Utils.showToast('Failed to save: ' + err.message, 'error');
            }
        };
    }
};
