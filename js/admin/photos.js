// Admin Photos Module
window.AdminPhotos = {
    _selectedProjectId: null,
    _photos: [],
    _loading: false,
    _objectUrls: [],

    render(container, params) {
        const self = this;
        self._container = container;
        params = params || {};
        if (params.projectId) self._selectedProjectId = params.projectId;
        self._cleanup();
        self._renderPage();
    },

    _cleanup() {
        const self = this;
        self._objectUrls.forEach(function(url) {
            try { URL.revokeObjectURL(url); } catch(e) { /* ignore */ }
        });
        self._objectUrls = [];
    },

    _renderPage() {
        const self = this;
        const container = self._container;
        const projects = AppData.getProjects();
        const esc = Utils.escapeHtml;

        const pad = function(n) { return String(n).padStart(2, '0'); };
        const now = new Date();
        const todayStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                <h2>Photo Gallery</h2>
                <button class="btn-secondary btn-sm" id="exportPhotosBtn" style="display:none">Export Photos</button>
            </div>
            <div class="card" style="margin-bottom:16px">
                <div class="form-group">
                    <label>Select Project</label>
                    <select id="photoProjectSelect">
                        <option value="">-- Select a project --</option>
                        ${projects.map(function(p) {
                            return '<option value="' + p.id + '"' + (self._selectedProjectId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>';
                        }).join('')}
                    </select>
                </div>
            </div>
            <div class="card" id="photoUploadCard" style="margin-bottom:16px;display:none">
                <h3 style="margin-bottom:12px">Upload Photos to this Project</h3>
                <div class="form-group">
                    <label>Label / note for this batch (applies to all selected photos)</label>
                    <input type="text" id="photoUploadBy" placeholder="e.g. Site inspection — J. Smith" maxlength="120">
                </div>
                <div class="form-group">
                    <label>Photo date</label>
                    <input type="date" id="photoUploadDate" value="${todayStr}">
                </div>
                <button class="btn-primary btn-sm" id="uploadPhotosBtn">Select photos to upload…</button>
                <input type="file" id="photoUploadInput" accept="image/*" multiple style="display:none">
                <div id="photoUploadStatus" style="margin-top:8px;color:var(--text2);font-size:.9rem"></div>
            </div>
            <div id="photoGalleryBody"></div>
        `;

        container.querySelector('#photoProjectSelect').addEventListener('change', function() {
            self._selectedProjectId = this.value || null;
            self._updateUploadVisibility();
            self._loadPhotos();
        });

        container.querySelector('#exportPhotosBtn').addEventListener('click', function() {
            self._exportPhotos();
        });

        container.querySelector('#uploadPhotosBtn').addEventListener('click', function() {
            container.querySelector('#photoUploadInput').click();
        });

        container.querySelector('#photoUploadInput').addEventListener('change', function() {
            self._uploadPhotos(this.files);
        });

        self._updateUploadVisibility();

        if (self._selectedProjectId) {
            self._loadPhotos();
        } else {
            container.querySelector('#photoGalleryBody').innerHTML =
                '<div class="card"><div class="empty"><h3>Select a Project</h3><p>Choose a project from the dropdown above to view its photos.</p></div></div>';
        }
    },

    _updateUploadVisibility() {
        const card = this._container.querySelector('#photoUploadCard');
        if (card) card.style.display = this._selectedProjectId ? '' : 'none';
    },

    _uploadPhotos(fileList) {
        const self = this;
        const container = self._container;
        const files = Array.prototype.slice.call(fileList || []);
        if (!files.length) return;
        if (!self._selectedProjectId) { Utils.showToast('Select a project first.', 'error'); return; }

        const MAX_MB = 15;
        const label = (container.querySelector('#photoUploadBy').value || '').trim();
        const pad = function(n) { return String(n).padStart(2, '0'); };
        const now = new Date();
        const dateVal = container.querySelector('#photoUploadDate').value ||
            (now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()));
        const statusEl = container.querySelector('#photoUploadStatus');
        const input = container.querySelector('#photoUploadInput');

        const images = files.filter(function(f) { return /^image\//.test(f.type); });
        const oversized = images.filter(function(f) { return f.size > MAX_MB * 1024 * 1024; });
        const accepted = images.filter(function(f) { return f.size <= MAX_MB * 1024 * 1024; });
        if (oversized.length) Utils.showToast(oversized.length + ' photo(s) skipped (over ' + MAX_MB + ' MB).', 'error');
        if (!accepted.length) { Utils.showToast('No valid images to upload.', 'error'); if (input) input.value = ''; return; }

        statusEl.textContent = 'Uploading ' + accepted.length + ' photo(s)…';

        (async function() {
            let done = 0, failed = 0;
            for (let i = 0; i < accepted.length; i++) {
                const file = accepted[i];
                try {
                    await AppData.savePhoto({
                        id: AppData.generateId(),
                        projectId: self._selectedProjectId,
                        workerId: '',
                        workerName: label || 'Admin Upload',
                        submissionId: '',
                        date: dateVal,
                        filename: file.name || 'photo.jpg',
                        blob: file,
                        thumbnail: file,
                        description: label
                    });
                    done++;
                } catch (e) {
                    failed++;
                    console.warn('[AdminPhotos] upload failed:', e);
                }
                statusEl.textContent = 'Uploaded ' + done + '/' + accepted.length + (failed ? ' (' + failed + ' failed)' : '') + '…';
            }
            statusEl.textContent = done + ' photo(s) uploaded' + (failed ? ', ' + failed + ' failed' : '') + '.';
            Utils.showToast(done + ' photo(s) uploaded to project.', failed ? 'error' : 'success');
            if (input) input.value = '';
            self._loadPhotos();
        })();
    },

    _loadPhotos() {
        const self = this;
        const container = self._container;
        const body = container.querySelector('#photoGalleryBody');
        const exportBtn = container.querySelector('#exportPhotosBtn');

        if (!self._selectedProjectId) {
            body.innerHTML = '<div class="card"><div class="empty"><h3>Select a Project</h3><p>Choose a project from the dropdown above to view its photos.</p></div></div>';
            exportBtn.style.display = 'none';
            return;
        }

        body.innerHTML = '<div class="card"><p style="color:var(--text2)">Loading photos...</p></div>';
        self._loading = true;

        AppData.getPhotosByProject(self._selectedProjectId).then(function(photos) {
            self._loading = false;
            self._photos = photos;
            self._cleanup();

            if (photos.length === 0) {
                body.innerHTML = '<div class="card"><div class="empty"><h3>No Photos</h3><p>No photos have been submitted for this project yet. Photos from worker time submissions will appear here.</p></div></div>';
                exportBtn.style.display = 'none';
                return;
            }

            exportBtn.style.display = '';

            // Compute date range
            const dates = photos.map(function(p) { return p.date || ''; }).filter(Boolean).sort();
            const dateRange = dates.length > 0
                ? Utils.formatDate(dates[0]) + ' to ' + Utils.formatDate(dates[dates.length - 1])
                : '';

            // Group photos by date, then by worker
            const byDate = {};
            photos.forEach(function(photo) {
                const date = photo.date || 'Unknown Date';
                if (!byDate[date]) byDate[date] = {};
                const workerId = photo.workerId || 'unknown';
                if (!byDate[date][workerId]) byDate[date][workerId] = [];
                byDate[date][workerId].push(photo);
            });

            const sortedDates = Object.keys(byDate).sort().reverse();

            let html = '<div class="card" style="margin-bottom:12px;padding:12px 16px">' +
                '<strong>' + photos.length + ' photo' + (photos.length !== 1 ? 's' : '') + '</strong>' +
                (dateRange ? ' &mdash; ' + dateRange : '') +
                '</div>';

            sortedDates.forEach(function(date) {
                html += '<div class="card" style="margin-bottom:12px">';
                html += '<h3 style="margin-bottom:12px">' + Utils.formatDate(date) + '</h3>';

                const workerGroups = byDate[date];
                Object.keys(workerGroups).forEach(function(workerId) {
                    const worker = AppData.getWorker(workerId);
                    const workerName = worker ? worker.name : (function() {
                        // Try to get name from photo metadata
                        var wPhotos = workerGroups[workerId];
                        return (wPhotos[0] && wPhotos[0].workerName) ? wPhotos[0].workerName : 'Unknown Worker';
                    })();
                    const workerPhotos = workerGroups[workerId];

                    html += '<h4 style="color:var(--text2);margin-bottom:8px;font-size:.9rem">' + Utils.escapeHtml(workerName) + '</h4>';
                    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:16px">';

                    workerPhotos.forEach(function(photo) {
                        const desc = photo.description || '';
                        html += '<div class="photo-thumb" data-photo-id="' + photo.id + '" style="cursor:pointer;border-radius:var(--radius);overflow:hidden;aspect-ratio:1;background:var(--bg);position:relative" title="' + Utils.escapeHtml(desc) + '">' +
                            '<img data-photo-load="' + photo.id + '" style="width:100%;height:100%;object-fit:cover" alt="Photo">' +
                        '</div>';
                    });

                    html += '</div>';
                });

                html += '</div>';
            });

            body.innerHTML = html;

            // Load photo thumbnails using URL.createObjectURL
            photos.forEach(function(photo) {
                const img = body.querySelector('[data-photo-load="' + photo.id + '"]');
                if (img && (photo.thumbnail || photo.blob)) {
                    const blobData = photo.thumbnail || photo.blob;
                    const blob = blobData instanceof Blob ? blobData : new Blob([blobData]);
                    const url = URL.createObjectURL(blob);
                    self._objectUrls.push(url);
                    img.src = url;
                }
            });

            // Click handlers for lightbox
            body.querySelectorAll('.photo-thumb').forEach(function(thumb) {
                thumb.addEventListener('click', function() {
                    const photoId = thumb.dataset.photoId;
                    const photo = photos.find(function(p) { return p.id === photoId; });
                    if (photo) self._showLightbox(photo);
                });
            });
        }).catch(function(err) {
            self._loading = false;
            body.innerHTML = '<div class="card"><p style="color:var(--accent)">Error loading photos: ' + Utils.escapeHtml(String(err)) + '</p></div>';
        });
    },

    _showLightbox(photo) {
        const self = this;
        const esc = Utils.escapeHtml;
        const worker = AppData.getWorker(photo.workerId);
        const workerName = worker ? worker.name : (photo.workerName || 'Unknown Worker');

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.style.display = 'flex';
        overlay.style.zIndex = '9999';
        overlay.innerHTML = `
            <div class="modal" style="max-width:90vw;max-height:90vh;padding:0;overflow:hidden;background:#000">
                <div style="position:relative">
                    <button class="btn-ghost lightbox-close" style="position:absolute;top:8px;right:8px;z-index:10;color:#fff;font-size:1.5rem;background:rgba(0,0,0,0.5);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center">&times;</button>
                    <div id="lightboxImageContainer" style="display:flex;align-items:center;justify-content:center;min-height:300px;background:#000">
                        <p style="color:#ccc">Loading...</p>
                    </div>
                    <div style="padding:12px 16px;background:var(--surface);color:var(--text)">
                        <p><strong>${esc(workerName)}</strong> &mdash; ${Utils.formatDate(photo.date)}</p>
                        ${photo.description ? '<p style="color:var(--text2);font-size:.9rem;margin-top:4px">' + esc(photo.description) + '</p>' : ''}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Load full-size image using URL.createObjectURL
        if (photo.blob) {
            const blob = photo.blob instanceof Blob ? photo.blob : new Blob([photo.blob]);
            const url = URL.createObjectURL(blob);
            self._objectUrls.push(url);
            const imgContainer = overlay.querySelector('#lightboxImageContainer');
            imgContainer.innerHTML = '<img src="' + url + '" style="max-width:90vw;max-height:70vh;object-fit:contain;display:block">';
        }

        overlay.querySelector('.lightbox-close').addEventListener('click', function() {
            overlay.remove();
        });
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });
    },

    async _exportPhotos() {
        const self = this;
        if (self._photos.length === 0) {
            Utils.showToast('No photos to export', 'error');
            return;
        }

        try {
            if (!('showDirectoryPicker' in window)) {
                throw new Error('not_supported');
            }

            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            const project = AppData.getProject(self._selectedProjectId);
            const projectName = project ? project.name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'project';

            let exportCount = 0;
            for (let i = 0; i < self._photos.length; i++) {
                const photo = self._photos[i];
                if (!photo.blob) continue;

                const blob = photo.blob instanceof Blob ? photo.blob : new Blob([photo.blob]);
                const dateStr = (photo.date || 'unknown').replace(/[^0-9-]/g, '');
                const worker = AppData.getWorker(photo.workerId);
                const workerStr = worker ? worker.name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'unknown';
                const filename = photo.filename || (projectName + '_' + dateStr + '_' + workerStr + '_' + (i + 1) + '.jpg');

                try {
                    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    exportCount++;
                } catch (fileErr) {
                    console.warn('Failed to save file:', filename, fileErr);
                }
            }

            Utils.showToast('Exported ' + exportCount + ' photo' + (exportCount !== 1 ? 's' : '') + ' successfully');
        } catch (err) {
            if (err.message === 'not_supported') {
                Utils.showToast('Your browser does not support the File System Access API. Please use Chrome or Edge to export photos to a folder.', 'error');
            } else if (err.name === 'AbortError') {
                // User cancelled the directory picker
            } else {
                Utils.showToast('Export failed: ' + String(err.message || err), 'error');
            }
        }
    }
};
