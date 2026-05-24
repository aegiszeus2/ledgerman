// Admin Quality Assurance Module
// Manage QA inspections with checklist items and deficiency tracking.

window.AdminQualityAssurance = {
    _filterProject: 'All',
    _filterStatus: 'All',
    _filterType: 'All',

    // Default checklist items per inspection type
    _defaultChecklists: {
        'General':     ['Site safety', 'Materials on site', 'Work area clean', 'PPE compliance', 'Documentation current'],
        'Structural':  ['Foundation integrity', 'Framing alignment', 'Load-bearing elements', 'Anchor bolts / connections', 'Inspection stamps current'],
        'Electrical':  ['Panel labelling', 'Wire gauge compliance', 'GFCI installations', 'Junction box covers', 'Grounding verified'],
        'Plumbing':    ['Pipe support spacing', 'Pressure test completed', 'Drain slope correct', 'Venting installed', 'Shut-off valves accessible'],
        'Roofing':     ['Underlayment installed', 'Flashing sealed', 'Drainage adequate', 'Fasteners correct spacing', 'Ridge cap complete'],
        'Finishing':   ['Drywall seams smooth', 'Paint coverage even', 'Trim / casing installed', 'Flooring transitions', 'Hardware installed'],
        'Final':       ['All deficiencies resolved', 'Utilities commissioned', 'Site cleaned', 'Permit documentation complete', 'Client walkthrough done'],
        'Other':       ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5']
    },

    render(container) {
        const self = this;
        self._container = container;
        self._renderList();
    },

    _renderList() {
        const self = this;
        const container = self._container;
        const esc = Utils.escapeHtml;

        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allInspections = AppData.getAll ? AppData.getAll('qa_inspections') : [];

        const totalCount = allInspections.length;
        const passedCount = allInspections.filter(i => i.status === 'Passed').length;
        const failedCount = allInspections.filter(i => i.status === 'Failed').length;
        const openCount = allInspections.filter(i => i.status === 'Open').length;
        const caCount = allInspections.filter(i => i.status === 'Corrective Action Required').length;

        const inspectionTypes = ['All', 'General', 'Structural', 'Electrical', 'Plumbing', 'Roofing', 'Finishing', 'Final', 'Other'];
        const statuses = ['All', 'Open', 'Passed', 'Failed', 'Corrective Action Required', 'Closed'];

        const filtered = allInspections.filter(i => {
            const projMatch = self._filterProject === 'All' || i.projectId === self._filterProject;
            const statusMatch = self._filterStatus === 'All' || i.status === self._filterStatus;
            const typeMatch = self._filterType === 'All' || i.inspectionType === self._filterType;
            return projMatch && statusMatch && typeMatch;
        }).sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));

        const projectMap = {};
        projects.forEach(p => { projectMap[p.id] = p.name; });

        const statusColors = {
            Open: '#0d6efd',
            Passed: '#198754',
            Failed: '#dc3545',
            'Corrective Action Required': '#fd7e14',
            Closed: '#495057'
        };

        function statusBadge(status) {
            const color = statusColors[status] || '#6c757d';
            return `<span style="padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:600;background:${color};color:white">${esc(status || '—')}</span>`;
        }

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h2 style="margin:0">Quality Assurance</h2>
                    <button class="btn-primary" id="qaAddBtn">+ New Inspection</button>
                </div>
                <p style="color:var(--text2);margin:0;font-size:.9rem">Track site inspections, checklists, and corrective actions.</p>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Total</div>
                    <div style="font-size:1.7rem;font-weight:700;color:var(--text-primary)">${totalCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Passed</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#198754">${passedCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid ${failedCount > 0 ? '#dc3545' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Failed</div>
                    <div style="font-size:1.7rem;font-weight:700;color:${failedCount > 0 ? '#dc3545' : 'var(--text-primary)'}">${failedCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid var(--border)">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Open</div>
                    <div style="font-size:1.7rem;font-weight:700;color:#0d6efd">${openCount}</div>
                </div>
                <div style="padding:14px;background:var(--card);border-radius:8px;border:1px solid ${caCount > 0 ? '#fd7e14' : 'var(--border)'}">
                    <div style="color:var(--text2);font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Corrective Action</div>
                    <div style="font-size:1.7rem;font-weight:700;color:${caCount > 0 ? '#fd7e14' : 'var(--text-primary)'}">${caCount}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Project</label>
                    <select id="qaFilterProject" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Status</label>
                    <select id="qaFilterStatus" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:.82rem;color:var(--text2);display:block;margin-bottom:4px">Inspection Type</label>
                    <select id="qaFilterType" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                        ${inspectionTypes.map(t => `<option value="${t}" ${self._filterType === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
                <table style="width:100%;border-collapse:collapse;font-size:.9rem">
                    <thead>
                        <tr style="background:var(--card)">
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Date</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Project</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Type</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Location</th>
                            <th style="padding:11px 14px;text-align:left;border-bottom:2px solid var(--border)">Inspector</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Status</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Deficiencies?</th>
                            <th style="padding:11px 14px;text-align:center;border-bottom:2px solid var(--border)">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(i => {
                            const proj = projectMap[i.projectId] || (i.projectId || '—');
                            const hasDeficiencies = !!(i.deficiencies && i.deficiencies.trim());
                            return `<tr style="border-bottom:1px solid var(--border)">
                                <td style="padding:10px 14px;white-space:nowrap">${esc(i.date || '—')}</td>
                                <td style="padding:10px 14px">${esc(proj)}</td>
                                <td style="padding:10px 14px">${esc(i.inspectionType || '—')}</td>
                                <td style="padding:10px 14px">${esc(i.location || '—')}</td>
                                <td style="padding:10px 14px">${esc(i.inspector || '—')}</td>
                                <td style="padding:10px 14px;text-align:center">${statusBadge(i.status)}</td>
                                <td style="padding:10px 14px;text-align:center">${hasDeficiencies ? '<span style="color:#fd7e14;font-weight:600;font-size:.85rem">Yes</span>' : '<span style="color:var(--text2);font-size:.85rem">—</span>'}</td>
                                <td style="padding:10px 14px;text-align:center;white-space:nowrap">
                                    <button class="btn-secondary btn-sm" data-id="${esc(i.id)}" data-action="edit" style="font-size:.75rem">Edit</button>
                                    <button class="btn-secondary btn-sm" data-id="${esc(i.id)}" data-action="delete" style="font-size:.75rem;margin-left:4px">Delete</button>
                                </td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="8" style="padding:36px;text-align:center;color:var(--text2)">No inspections found${allInspections.length > 0 ? ' matching your filters' : '. Create your first inspection to get started.'}.</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('qaFilterProject').onchange = e => { self._filterProject = e.target.value; self._renderList(); };
        document.getElementById('qaFilterStatus').onchange = e => { self._filterStatus = e.target.value; self._renderList(); };
        document.getElementById('qaFilterType').onchange = e => { self._filterType = e.target.value; self._renderList(); };
        document.getElementById('qaAddBtn').onclick = () => self._showForm(null);

        container.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = () => self._showForm(btn.dataset.id);
        });
        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = () => {
                if (confirm('Delete this inspection record? This action cannot be undone.')) {
                    AppData.remove('qa_inspections', btn.dataset.id);
                    Utils.showToast('Inspection deleted', 'success');
                    self._renderList();
                }
            };
        });
    },

    _getDefaultChecklist(type) {
        const self = this;
        const items = self._defaultChecklists[type] || self._defaultChecklists['General'];
        return items.map(item => ({ item: item, result: 'N/A', notes: '' }));
    },

    _renderChecklistTable(checklistItems) {
        const esc = Utils.escapeHtml;
        if (!checklistItems || checklistItems.length === 0) {
            return '<div style="color:var(--text2);font-size:.9rem;padding:8px 0">No checklist items.</div>';
        }
        return `
            <table style="width:100%;border-collapse:collapse;font-size:.87rem">
                <thead>
                    <tr style="background:var(--bg-primary)">
                        <th style="padding:8px 10px;text-align:left;border-bottom:1px solid var(--border);font-weight:600">Item</th>
                        <th style="padding:8px 10px;text-align:center;border-bottom:1px solid var(--border);font-weight:600;width:160px">Result</th>
                        <th style="padding:8px 10px;text-align:left;border-bottom:1px solid var(--border);font-weight:600">Notes</th>
                    </tr>
                </thead>
                <tbody id="checklistTableBody">
                    ${checklistItems.map((ci, idx) => `
                        <tr style="border-bottom:1px solid var(--border)" data-cl-idx="${idx}">
                            <td style="padding:7px 10px">
                                <input type="text" class="cl-item-text" data-idx="${idx}" value="${esc(ci.item || '')}"
                                    style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);font-size:.85rem" />
                            </td>
                            <td style="padding:7px 10px;text-align:center">
                                <label style="margin-right:6px;cursor:pointer"><input type="radio" name="cl_result_${idx}" class="cl-result" data-idx="${idx}" value="Pass" ${ci.result === 'Pass' ? 'checked' : ''} /> Pass</label>
                                <label style="margin-right:6px;cursor:pointer"><input type="radio" name="cl_result_${idx}" class="cl-result" data-idx="${idx}" value="Fail" ${ci.result === 'Fail' ? 'checked' : ''} /> Fail</label>
                                <label style="cursor:pointer"><input type="radio" name="cl_result_${idx}" class="cl-result" data-idx="${idx}" value="N/A" ${ci.result === 'N/A' || !ci.result ? 'checked' : ''} /> N/A</label>
                            </td>
                            <td style="padding:7px 10px">
                                <input type="text" class="cl-notes" data-idx="${idx}" value="${esc(ci.notes || '')}"
                                    placeholder="Notes..."
                                    style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);font-size:.85rem" />
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    _readChecklist() {
        const items = [];
        const tbody = document.getElementById('checklistTableBody');
        if (!tbody) return items;
        const rows = tbody.querySelectorAll('tr[data-cl-idx]');
        rows.forEach(row => {
            const idx = row.dataset.clIdx;
            const itemText = row.querySelector('.cl-item-text') ? row.querySelector('.cl-item-text').value.trim() : '';
            const resultRadio = row.querySelector('.cl-result:checked');
            const result = resultRadio ? resultRadio.value : 'N/A';
            const notesEl = row.querySelector('.cl-notes');
            const notes = notesEl ? notesEl.value.trim() : '';
            if (itemText) items.push({ item: itemText, result: result, notes: notes });
        });
        return items;
    },

    _showForm(inspId) {
        const self = this;
        const container = self._container;
        const esc = Utils.escapeHtml;
        const projects = AppData.getProjects ? AppData.getProjects() : [];
        const allInspections = AppData.getAll ? AppData.getAll('qa_inspections') : [];
        const insp = inspId ? allInspections.find(i => i.id === inspId) : null;
        const isNew = !insp;

        const today = new Date().toISOString().slice(0, 10);
        const inspectionTypes = ['General', 'Structural', 'Electrical', 'Plumbing', 'Roofing', 'Finishing', 'Final', 'Other'];
        const statuses = ['Open', 'Passed', 'Failed', 'Corrective Action Required', 'Closed'];

        function val(field, fallback) {
            return insp ? (insp[field] != null ? insp[field] : (fallback || '')) : (fallback || '');
        }

        // Initial checklist: from record or defaults for current type
        let initialType = val('inspectionType', 'General');
        let initialChecklist;
        try {
            initialChecklist = insp && insp.checklistItems
                ? (typeof insp.checklistItems === 'string' ? JSON.parse(insp.checklistItems) : insp.checklistItems)
                : self._getDefaultChecklist(initialType);
        } catch(e) {
            initialChecklist = self._getDefaultChecklist(initialType);
        }

        container.innerHTML = `
            <div style="max-width:720px;margin:0 auto">
                <h2 style="margin-bottom:20px">${isNew ? 'New Inspection' : 'Edit Inspection'}</h2>
                <form id="qaForm" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px">

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Project *</label>
                            <select id="qaProject" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                                <option value="">-- Select Project --</option>
                                ${projects.map(p => `<option value="${p.id}" ${val('projectId') === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Inspection Type *</label>
                            <select id="qaType" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required>
                                ${inspectionTypes.map(t => `<option value="${t}" ${initialType === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Date *</label>
                            <input type="date" id="qaDate" value="${esc(val('date', today))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Location *</label>
                            <input type="text" id="qaLocation" value="${esc(val('location'))}" placeholder="e.g. Level 2, Unit 3B, Mechanical Room"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Inspector *</label>
                            <input type="text" id="qaInspector" value="${esc(val('inspector'))}" placeholder="Name of inspector"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" required />
                        </div>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Status</label>
                        <select id="qaStatus" style="width:280px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem">
                            ${statuses.map(s => `<option value="${s}" ${val('status', 'Open') === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Checklist -->
                    <div style="margin-bottom:16px">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                            <label style="font-weight:600;font-size:.95rem">Inspection Checklist</label>
                            <button type="button" id="qaResetChecklist" class="btn-secondary btn-sm" style="font-size:.78rem">Reset to Defaults</button>
                        </div>
                        <div id="qaChecklistContainer" style="border:1px solid var(--border);border-radius:6px;overflow:hidden">
                            ${self._renderChecklistTable(initialChecklist)}
                        </div>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Deficiencies</label>
                        <textarea id="qaDeficiencies" placeholder="List any deficiencies found during this inspection..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:80px;resize:vertical">${esc(val('deficiencies'))}</textarea>
                    </div>

                    <div style="margin-bottom:14px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Corrective Action</label>
                        <textarea id="qaCorrectiveAction" placeholder="Describe corrective actions required or taken..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:70px;resize:vertical">${esc(val('correctiveAction'))}</textarea>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Responsible Party</label>
                            <input type="text" id="qaResponsibleParty" value="${esc(val('responsibleParty'))}" placeholder="Name or company"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Due Date</label>
                            <input type="date" id="qaDueDate" value="${esc(val('dueDate'))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Closed Date</label>
                            <input type="date" id="qaClosedDate" value="${esc(val('closedDate'))}"
                                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem" />
                        </div>
                    </div>

                    <div style="margin-bottom:20px">
                        <label style="display:block;font-weight:500;margin-bottom:6px;font-size:.9rem">Notes</label>
                        <textarea id="qaNotes" placeholder="Additional notes..."
                            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:.9rem;min-height:60px;resize:vertical">${esc(val('notes'))}</textarea>
                    </div>

                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" id="qaCancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">${isNew ? 'Create Inspection' : 'Save Changes'}</button>
                    </div>
                </form>
            </div>
        `;

        // Reset checklist when type changes
        document.getElementById('qaType').onchange = function() {
            const newType = this.value;
            const newChecklist = self._getDefaultChecklist(newType);
            document.getElementById('qaChecklistContainer').innerHTML = self._renderChecklistTable(newChecklist);
        };

        document.getElementById('qaResetChecklist').onclick = () => {
            const currentType = document.getElementById('qaType').value;
            const defaults = self._getDefaultChecklist(currentType);
            document.getElementById('qaChecklistContainer').innerHTML = self._renderChecklistTable(defaults);
        };

        document.getElementById('qaCancelBtn').onclick = () => self._renderList();

        document.getElementById('qaForm').onsubmit = e => {
            e.preventDefault();
            const projVal = document.getElementById('qaProject').value;
            if (!projVal) { Utils.showToast('Please select a project', 'error'); return; }

            const now = new Date().toISOString();
            const checklistItems = self._readChecklist();

            const record = {
                id: insp ? insp.id : ('qa_' + Date.now()),
                projectId: projVal,
                inspectionType: document.getElementById('qaType').value,
                location: document.getElementById('qaLocation').value.trim(),
                inspector: document.getElementById('qaInspector').value.trim(),
                date: document.getElementById('qaDate').value,
                status: document.getElementById('qaStatus').value,
                checklistItems: JSON.stringify(checklistItems),
                deficiencies: document.getElementById('qaDeficiencies').value.trim(),
                correctiveAction: document.getElementById('qaCorrectiveAction').value.trim(),
                responsibleParty: document.getElementById('qaResponsibleParty').value.trim(),
                dueDate: document.getElementById('qaDueDate').value || null,
                closedDate: document.getElementById('qaClosedDate').value || null,
                notes: document.getElementById('qaNotes').value.trim(),
                created_at: insp ? insp.created_at : now,
                updated_at: now
            };

            AppData.save('qa_inspections', record);
            Utils.showToast(isNew ? 'Inspection created' : 'Inspection updated', 'success');
            self._renderList();
        };
    }
};
