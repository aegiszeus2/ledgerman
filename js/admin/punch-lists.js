// Admin Punch Lists & Sign-off Module — Tier 3
// Deficiency tracking: identify issues on projects, track progress, sign off when resolved
window.AdminPunchLists = {
    _filterProject: 'All',
    _filterStatus: 'All',
    _sortBy: 'priority',
    _editingId: null,

    render(container, params) {
        const self = this;
        self._container = container;

        if (params && params.projectId) {
            self._renderProject(params.projectId);
        } else {
            self._renderList();
        }
    },

    _renderList() {
        const self = this;
        const container = self._container;

        const projects = AppData.getProjects();
        const allItems = AppData.getAll ? AppData.getAll('punch_items') : [];
        const items = allItems.length > 0 ? allItems : [];

        // Get status counts
        const statuses = ['All', 'Open', 'In Progress', 'Resolved', 'Signed Off'];
        const statusCounts = {};
        statuses.forEach(s => {
            statusCounts[s] = s === 'All' ? items.length : items.filter(i => i.status === s).length;
        });

        // Filter and sort
        const filtered = items.filter(item => {
            let projectMatch = self._filterProject === 'All' || item.projectId === self._filterProject;
            let statusMatch = self._filterStatus === 'All' || item.status === self._filterStatus;
            return projectMatch && statusMatch;
        });

        const sorted = filtered.sort((a, b) => {
            if (self._sortBy === 'priority') {
                const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
                return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
            } else if (self._sortBy === 'status') {
                const statusOrder = { 'Open': 0, 'In Progress': 1, 'Resolved': 2, 'Signed Off': 3 };
                return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
            }
            return new Date(b.created_at) - new Date(a.created_at);
        });

        const openCount = items.filter(i => ['Open', 'In Progress'].includes(i.status)).length;

        container.innerHTML = `
            <div style="margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <h2>Punch Lists & Deficiencies</h2>
                    <div style="display:flex;gap:8px">
                        <button class="btn-secondary btn-sm" id="punchListsExportCsvBtn">Export CSV</button>
                        <button class="btn-secondary btn-sm" id="punchListsPrintBtn">Print / PDF</button>
                        <button class="btn-primary" id="addItemBtn">+ Add Deficiency</button>
                    </div>
                </div>
                <p style="color:#b0c4de;margin:0">Track project deficiencies from identification to sign-off completion</p>
            </div>

            <!-- Summary Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">
                <div style="padding:12px;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border-color)">
                    <div style="color:#999;font-size:0.8em;text-transform:uppercase;margin-bottom:4px">Total Items</div>
                    <div style="font-size:1.6em;font-weight:bold;color:var(--text-secondary)">${items.length}</div>
                </div>
                <div style="padding:12px;background:var(--bg-surface);border-radius:8px;border:1px solid #e74c3c">
                    <div style="color:#999;font-size:0.8em;text-transform:uppercase;margin-bottom:4px">Open/In Progress</div>
                    <div style="font-size:1.6em;font-weight:bold;color:#e74c3c">${openCount}</div>
                </div>
                <div style="padding:12px;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border-color)">
                    <div style="color:#999;font-size:0.8em;text-transform:uppercase;margin-bottom:4px">Signed Off</div>
                    <div style="font-size:1.6em;font-weight:bold;color:#2ecc71">${items.filter(i => i.status === 'Signed Off').length}</div>
                </div>
            </div>

            <!-- Filters -->
            <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
                <div>
                    <label style="font-size:0.85em;color:#b0c4de;display:block;margin-bottom:4px">Project:</label>
                    <select id="projectFilter" style="padding:6px 8px;border-radius:4px;border:1px solid #ddd;font-size:0.9em">
                        <option value="All">All Projects</option>
                        ${projects.map(p => `<option value="${p.id}" ${self._filterProject === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:0.85em;color:#b0c4de;display:block;margin-bottom:4px">Status:</label>
                    <select id="statusFilter" style="padding:6px 8px;border-radius:4px;border:1px solid #ddd;font-size:0.9em">
                        ${statuses.map(s => `<option value="${s}" ${self._filterStatus === s ? 'selected' : ''}>${s} (${statusCounts[s]})</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:0.85em;color:#b0c4de;display:block;margin-bottom:4px">Sort:</label>
                    <select id="sortBySelect" style="padding:6px 8px;border-radius:4px;border:1px solid #ddd;font-size:0.9em">
                        <option value="priority" ${self._sortBy === 'priority' ? 'selected' : ''}>Priority (High→Low)</option>
                        <option value="status" ${self._sortBy === 'status' ? 'selected' : ''}>Status</option>
                        <option value="date" ${self._sortBy === 'date' ? 'selected' : ''}>Date (Newest)</option>
                    </select>
                </div>
            </div>

            <!-- Items Table -->
            <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border-color)">
                <table class="table" style="width:100%;margin:0;border-collapse:collapse">
                    <thead style="background:var(--bg-tertiary)">
                        <tr>
                            <th style="padding:12px;text-align:left;border-bottom:2px solid #e0e0e0">Description</th>
                            <th style="padding:12px;text-align:left;border-bottom:2px solid #e0e0e0">Project</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #e0e0e0">Priority</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #e0e0e0">Status</th>
                            <th style="padding:12px;text-align:center;border-bottom:2px solid #e0e0e0">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.length > 0 ? sorted.map(item => {
                            const project = AppData.getProject(item.projectId);
                            const priorityColor = {
                                'Critical': '#e74c3c',
                                'High': '#f39c12',
                                'Medium': '#3498db',
                                'Low': '#95a5a6'
                            }[item.priority] || '#95a5a6';

                            const statusColor = {
                                'Open': '#e74c3c',
                                'In Progress': '#f39c12',
                                'Resolved': '#3498db',
                                'Signed Off': '#2ecc71'
                            }[item.status] || '#333';

                            return `
                                <tr style="border-bottom:1px solid #e0e0e0">
                                    <td style="padding:12px">
                                        <strong>${Utils.escapeHtml(item.description || 'Unnamed Item')}</strong>
                                        ${item.notes ? `<div style="font-size:0.85em;color:#94a9c4;margin-top:4px">${Utils.escapeHtml(item.notes)}</div>` : ''}
                                        ${item.photoId ? `<div style="margin-top:4px"><span style="font-size:0.8em;color:#3498db">📷 Photo attached</span></div>` : ''}
                                    </td>
                                    <td style="padding:12px">
                                        ${Utils.escapeHtml(project ? project.name : 'Unknown')}
                                    </td>
                                    <td style="padding:12px;text-align:center">
                                        <span style="padding:4px 8px;border-radius:4px;font-size:0.8em;background:${priorityColor};color:white">
                                            ${item.priority || 'Medium'}
                                        </span>
                                    </td>
                                    <td style="padding:12px;text-align:center">
                                        <span style="padding:4px 8px;border-radius:4px;font-size:0.8em;background:${statusColor};color:white">
                                            ${item.status || 'Open'}
                                        </span>
                                    </td>
                                    <td style="padding:12px;text-align:center;font-size:0.85em">
                                        <button class="btn-secondary btn-sm" data-item-id="${item.id}" data-action="edit" style="font-size:0.75em">Edit</button>
                                        ${item.photoId ? `<button class="btn-secondary btn-sm" data-item-id="${item.id}" data-photo-id="${item.photoId}" data-action="viewphoto" style="font-size:0.75em;margin-left:4px">📷</button>` : ''}
                                        <button class="btn-secondary btn-sm" data-item-id="${item.id}" data-action="delete" style="font-size:0.75em;margin-left:4px">Delete</button>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="5" style="padding:32px;text-align:center;color:#94a9c4">
                                    No deficiencies recorded. Create new items to track project issues.
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>

            <!-- Info -->
            <div style="margin-top:20px;padding:12px;background:#e8f4f8;border-radius:6px;border-left:4px solid #3498db;font-size:0.9em">
                <strong>💡 Workflow:</strong> Open → In Progress (work being done) → Resolved (work complete) → Signed Off (superintendent approval)
            </div>
        `;

        // CSV helpers
        function csvEscape(val) {
            if (val === null || val === undefined) return '';
            var s = String(val);
            if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
                return '"' + s.replace(/"/g, '""') + '"';
            return s;
        }
        function csvRow(fields) { return fields.map(csvEscape).join(','); }
        function downloadCsv(content, name) {
            var today = new Date().toISOString().slice(0,10);
            var blob = new Blob([content], {type:'text/csv'});
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = 'ledgerman-' + name + '-' + today + '.csv';
            document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
        }

        document.getElementById('punchListsExportCsvBtn').onclick = () => {
            var rows = [csvRow(['Project','Description','Priority','Status','Reported Date'])];
            sorted.forEach(item => {
                const project = AppData.getProject(item.projectId);
                rows.push(csvRow([
                    project ? project.name : '',
                    item.description || '',
                    item.priority || '',
                    item.status || '',
                    item.created_at ? item.created_at.slice(0,10) : ''
                ]));
            });
            downloadCsv(rows.join('\n'), 'punch-lists');
        };

        document.getElementById('punchListsPrintBtn').onclick = () => {
            if (!document.getElementById('punchListsPrintStyle')) {
                var s = document.createElement('style');
                s.id = 'punchListsPrintStyle';
                s.textContent = '@media print { .admin-nav,.worker-nav,#adminSidebar,.btn-primary,.btn-secondary,.tab-btn,#pageHelpBtn { display:none!important; } body { font-size:11pt; } .card { box-shadow:none; border:1px solid #ddd; } }';
                document.head.appendChild(s);
            }
            window.print();
        };

        // Event handlers
        document.getElementById('projectFilter').onchange = (e) => {
            self._filterProject = e.target.value;
            self._renderList();
        };

        document.getElementById('statusFilter').onchange = (e) => {
            self._filterStatus = e.target.value;
            self._renderList();
        };

        document.getElementById('sortBySelect').onchange = (e) => {
            self._sortBy = e.target.value;
            self._renderList();
        };

        document.getElementById('addItemBtn').onclick = () => {
            self._showEditForm(null);
        };

        document.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                self._showEditForm(btn.dataset.itemId);
            };
        });

        document.querySelectorAll('[data-action="viewphoto"]').forEach(btn => {
            btn.onclick = async (e) => {
                e.preventDefault();
                const photoId = btn.dataset.photoId;
                if (!photoId) return;
                try {
                    const photo = await AppData.getPhoto(photoId);
                    if (!photo || !photo.blob) { Utils.showToast('Photo not found', 'error'); return; }
                    const url = URL.createObjectURL(photo.blob);
                    const overlay = document.createElement('div');
                    overlay.className = 'modal-overlay active';
                    overlay.style.cssText = 'display:flex;z-index:9999';
                    overlay.innerHTML = `
                        <div class="modal" style="max-width:90vw;max-height:90vh;padding:0;overflow:hidden;background:#000;position:relative">
                            <button style="position:absolute;top:8px;right:8px;z-index:10;color:#fff;background:rgba(0,0,0,0.6);border:none;border-radius:50%;width:36px;height:36px;font-size:1.4rem;cursor:pointer;display:flex;align-items:center;justify-content:center">&times;</button>
                            <img src="${url}" style="max-width:90vw;max-height:80vh;display:block;object-fit:contain" alt="Photo">
                        </div>
                    `;
                    document.body.appendChild(overlay);
                    overlay.querySelector('button').onclick = () => { URL.revokeObjectURL(url); document.body.removeChild(overlay); };
                    overlay.onclick = (ev) => { if (ev.target === overlay) { URL.revokeObjectURL(url); document.body.removeChild(overlay); } };
                } catch(err) {
                    Utils.showToast('Failed to load photo', 'error');
                }
            };
        });

        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.onclick = async (e) => {
                e.preventDefault();
                if (confirm('Delete this deficiency item?')) {
                    try {
                        AppData.remove('punch_items', btn.dataset.itemId);
                        Utils.showToast('Item deleted', 'success');
                        self._renderList();
                    } catch(err) {
                        console.error('Delete failed:', err);
                        Utils.showToast('Failed to delete item', 'error');
                    }
                }
            };
        });
    },

    _showEditForm(itemId) {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const allItems = AppData.getAll ? AppData.getAll('punch_items') : [];
        const item = itemId ? allItems.find(i => i.id === itemId) : null;

        const isNew = !item;
        const id = item ? item.id : ('punch_' + Date.now());
        const description = item ? item.description : '';
        const notes = item ? item.notes : '';
        const priority = item ? item.priority : 'Medium';
        const status = item ? item.status : 'Open';
        const projectId = item ? item.projectId : (projects.length > 0 ? projects[0].id : '');
        const photoId = item ? (item.photoId || null) : null;
        let punchDroppedFile = null;  // stores file from drag-drop (input.files[0] used for click path)

        // Load existing photo if editing
        let existingPhotoUrl = null;
        if (photoId) {
            AppData.getPhoto(photoId).then(function(photo) {
                if (photo && photo.blob) {
                    existingPhotoUrl = URL.createObjectURL(photo.blob);
                    const preview = document.getElementById('punchPhotoPreview');
                    if (preview) {
                        preview.innerHTML = `<img src="${existingPhotoUrl}" style="max-width:100%;max-height:180px;border-radius:6px;border:1px solid #ddd" alt="Attached photo"><br><small style="color:#94a9c4">Current photo — upload new to replace</small>`;
                    }
                }
            }).catch(function() {});
        }

        container.innerHTML = `
            <div style="max-width:600px;margin:0 auto">
                <h2 style="margin-bottom:20px">${isNew ? 'New Deficiency' : 'Edit Deficiency'}</h2>

                <form id="punchForm" style="border:1px solid var(--border-color);border-radius:8px;padding:16px;background:var(--bg-surface)">
                    <div style="margin-bottom:16px">
                        <label style="display:block;font-weight:500;margin-bottom:6px">Project *</label>
                        <select id="projectSelect" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px" required>
                            ${projects.map(p => `<option value="${p.id}" ${projectId === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>

                    <div style="margin-bottom:16px">
                        <label style="display:block;font-weight:500;margin-bottom:6px">Description *</label>
                        <input type="text" id="descriptionInput" placeholder="e.g., Paint siding, replace damaged shingles"
                               value="${Utils.escapeHtml(description)}"
                               style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:1em" required />
                    </div>

                    <div style="margin-bottom:16px">
                        <label style="display:block;font-weight:500;margin-bottom:6px">Notes</label>
                        <textarea id="notesInput" placeholder="Additional details, responsible party, etc."
                                  style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:1em;min-height:80px;font-family:monospace">${Utils.escapeHtml(notes)}</textarea>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px">Priority</label>
                            <select id="prioritySelect" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
                                <option value="Low" ${priority === 'Low' ? 'selected' : ''}>Low</option>
                                <option value="Medium" ${priority === 'Medium' ? 'selected' : ''}>Medium</option>
                                <option value="High" ${priority === 'High' ? 'selected' : ''}>High</option>
                                <option value="Critical" ${priority === 'Critical' ? 'selected' : ''}>Critical</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-weight:500;margin-bottom:6px">Status</label>
                            <select id="statusSelect" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px">
                                <option value="Open" ${status === 'Open' ? 'selected' : ''}>Open</option>
                                <option value="In Progress" ${status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                <option value="Resolved" ${status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                                <option value="Signed Off" ${status === 'Signed Off' ? 'selected' : ''}>Signed Off</option>
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom:16px">
                        <label style="display:block;font-weight:500;margin-bottom:6px">📷 Photo</label>
                        <div id="punchPhotoPreview" style="margin-bottom:8px">${photoId ? '<em style="color:#94a9c4;font-size:0.85em">Loading existing photo…</em>' : ''}</div>
                        <div id="punchPhotoDropZone" style="margin-bottom:6px;"></div>
                        <input type="file" id="punchPhotoInput" accept="image/*" capture="environment"
                               style="width:100%;padding:6px;border:1px solid var(--border-color);border-radius:4px;font-size:0.9em;background:var(--bg-input)" />
                        <div style="font-size:0.8em;color:#94a9c4;margin-top:4px">Take a photo or select from gallery. Max 10 MB.</div>
                    </div>

                    <div style="display:flex;gap:8px;justify-content:space-between">
                        <button type="button" id="cancelBtn" class="btn-secondary">Cancel</button>
                        <button type="submit" class="btn-primary">Save Item</button>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('cancelBtn').onclick = () => self._renderList();

        // Helper: show photo preview in the punch form
        function showPunchPreview(file) {
            const preview = document.getElementById('punchPhotoPreview');
            const url = URL.createObjectURL(file);
            preview.innerHTML = `<img src="${url}" style="max-width:100%;max-height:180px;border-radius:6px;border:1px solid #ddd" alt="Preview">`;
        }

        // Live preview when file is picked via click/camera
        document.getElementById('punchPhotoInput').addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            punchDroppedFile = null;  // clear any previously dropped file
            showPunchPreview(file);
        });

        // Drag-and-drop zone (desktop enhancement — camera input remains primary on mobile)
        if (window.UploadHelper) {
            UploadHelper.initDragDrop({
                zone:          document.getElementById('punchPhotoDropZone'),
                input:         document.getElementById('punchPhotoInput'),
                accept:        'image/*',
                multiple:      false,
                maxFileSizeMB: 10,
                listenToInput: false,
                onFiles: function(files) {
                    punchDroppedFile = files[0];
                    showPunchPreview(punchDroppedFile);
                },
                label: 'Drag photo here',
                hint:  'Or use camera input below • images only, max 10 MB',
            });
        }

        document.getElementById('punchForm').onsubmit = async (e) => {
            e.preventDefault();

            const submitBtn = document.querySelector('#punchForm [type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

            try {
                // Handle photo upload (punchDroppedFile covers drag-drop; fileInput.files[0] covers click/camera)
                let savedPhotoId = photoId; // keep existing if no new file
                const fileInput = document.getElementById('punchPhotoInput');
                const file = punchDroppedFile || (fileInput && fileInput.files[0]);
                if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                        throw new Error('Photo exceeds 10 MB limit');
                    }
                    // Compress/thumbnail: draw to canvas at max 400px
                    const thumbBlob = await new Promise(function(resolve) {
                        const img = new Image();
                        const objUrl = URL.createObjectURL(file);
                        img.onload = function() {
                            URL.revokeObjectURL(objUrl);
                            const MAX = 400;
                            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                            const canvas = document.createElement('canvas');
                            canvas.width = Math.round(img.width * scale);
                            canvas.height = Math.round(img.height * scale);
                            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                            canvas.toBlob(resolve, 'image/jpeg', 0.75);
                        };
                        img.src = objUrl;
                    });

                    const newPhotoId = AppData.generateId();
                    await AppData.savePhoto({
                        id: newPhotoId,
                        projectId: document.getElementById('projectSelect').value,
                        workerId: '',
                        submissionId: 'punch_' + id,
                        date: new Date().toISOString().slice(0, 10),
                        filename: file.name,
                        blob: file,
                        thumbnail: thumbBlob,
                        description: document.getElementById('descriptionInput').value
                    });
                    savedPhotoId = newPhotoId;
                }

                const newItem = {
                    id: id,
                    projectId: document.getElementById('projectSelect').value,
                    description: document.getElementById('descriptionInput').value,
                    notes: document.getElementById('notesInput').value,
                    priority: document.getElementById('prioritySelect').value,
                    status: document.getElementById('statusSelect').value,
                    photoId: savedPhotoId || undefined,
                    created_at: item ? item.created_at : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                await AppData.saveEntityAsync('punch_items', newItem);
                Utils.showToast(isNew ? 'Deficiency created' : 'Deficiency updated', 'success');
                self._renderList();
            } catch(err) {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Item'; }
                console.error('Save failed:', err);
                Utils.showToast('Failed to save: ' + err.message, 'error');
            }
        };
    }
};
