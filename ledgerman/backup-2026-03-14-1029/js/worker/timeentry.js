// Worker Time Entry Module
window.WorkerTimeEntry = {
    render(container, worker, projectId, prefillData) {
        var esc = Utils.escapeHtml;
        var project = AppData.getProject(projectId);
        if (!project) {
            container.innerHTML =
                '<div class="card" style="text-align:center;padding:40px">' +
                    '<h3>Project Not Found</h3>' +
                    '<p style="color:var(--text2);margin-top:8px">This project may have been removed.</p>' +
                    '<button class="btn-primary" style="margin-top:16px" id="teBackHome">Back to Home</button>' +
                '</div>';
            container.querySelector('#teBackHome').addEventListener('click', function() {
                window.App.navigateWorker('home');
            });
            return;
        }

        var subtasks = AppData.getSubtasks(projectId);
        var selectedPhotos = [];
        var isWizardMode = !AppData.getData('worker_wizard_done_' + worker.id);

        // Pre-fill defaults
        var defaults = prefillData || {};
        var defaultDate      = defaults.date        || Utils.today();
        var defaultSubtaskId = defaults.subtaskId   || '';
        var defaultStartTime = defaults.startTime   || '';
        var defaultEndTime   = defaults.endTime     || '';
        var defaultDesc      = defaults.description || '';
        var defaultUnits     = defaults.unitsCompleted || '';
        // Rate always comes from worker profile — never from worker input
        var workerRate = parseFloat(worker.defaultRate) || 0;

        container.innerHTML = '';

        // ── Header ──────────────────────────────────────────────────────
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px';
        header.innerHTML =
            '<button class="btn btn-secondary btn-sm" id="teBack" style="min-height:44px;padding:0 16px">&larr; Back</button>' +
            '<div style="flex:1;min-width:0">' +
                '<div style="font-weight:700;font-size:1.05rem;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(project.name) + '</div>' +
                '<div style="color:var(--text2);font-size:.82rem;margin-top:1px">Log time entry</div>' +
            '</div>';
        container.appendChild(header);
        container.querySelector('#teBack').addEventListener('click', function() {
            window.App.navigateWorker('home');
        });

        // ── First-time wizard banner ─────────────────────────────────────
        if (isWizardMode) {
            var banner = document.createElement('div');
            banner.className = 'card';
            banner.id = 'wizardBanner';
            banner.style.cssText = 'border-color:var(--success);background:rgba(46,204,113,.08);margin-bottom:12px';
            banner.innerHTML =
                '<div style="display:flex;align-items:center;gap:12px">' +
                    '<span style="font-size:1.3rem">&#9432;</span>' +
                    '<div style="flex:1;font-size:.88rem;color:var(--text2)">Fill in each field top to bottom, then tap <strong style="color:var(--text)">Submit</strong>.</div>' +
                    '<button class="btn btn-secondary btn-sm" id="dismissWizard" style="white-space:nowrap">Got it</button>' +
                '</div>';
            container.appendChild(banner);
            banner.querySelector('#dismissWizard').addEventListener('click', function() {
                AppData.setData('worker_wizard_done_' + worker.id, true);
                banner.remove();
            });
        }

        // ── Form ─────────────────────────────────────────────────────────
        var form = document.createElement('form');
        form.className = 'time-entry-form';
        form.id = 'timeEntryForm';
        form.noValidate = true;

        // 1. Date
        form.innerHTML += '' +
            '<div class="form-group">' +
                '<label class="form-label" for="teDate">Date</label>' +
                '<input class="form-control" type="date" id="teDate" name="date" value="' + esc(defaultDate) + '" required>' +
            '</div>';

        // 2. Subtask (if any exist)
        if (subtasks.length > 0) {
            var stOptions = '<option value="">— No specific subtask —</option>';
            subtasks.forEach(function(st) {
                stOptions += '<option value="' + esc(st.id) + '" data-unit="' + esc(st.unitOfMeasure || '') + '"' +
                    (st.id === defaultSubtaskId ? ' selected' : '') + '>' + esc(st.name) + '</option>';
            });
            form.innerHTML += '' +
                '<div class="form-group">' +
                    '<label class="form-label" for="teSubtask">Subtask</label>' +
                    '<select class="form-control" id="teSubtask" name="subtask">' + stOptions + '</select>' +
                '</div>';
        }

        // 3. Start & End time + auto-calculated hours display
        form.innerHTML += '' +
            '<div class="form-group">' +
                '<label class="form-label">Start &amp; End Time</label>' +
                '<div class="time-input-group">' +
                    '<input class="form-control" type="time" id="teStartTime" name="startTime" value="' + esc(defaultStartTime) + '" style="flex:1">' +
                    '<span class="time-separator">→</span>' +
                    '<input class="form-control" type="time" id="teEndTime" name="endTime" value="' + esc(defaultEndTime) + '" style="flex:1">' +
                '</div>' +
            '</div>' +
            '<div class="hours-display" id="hoursDisplay" style="display:none">' +
                '<div class="hours-value" id="hoursValue">0.00</div>' +
                '<div class="hours-label">hours calculated</div>' +
            '</div>';

        // Hidden fields — rate type always Hourly, rate from admin
        form.innerHTML += '<input type="hidden" id="teRate" value="' + esc(String(workerRate)) + '">';

        // 5. Description
        form.innerHTML += '' +
            '<div class="form-group">' +
                '<label class="form-label" for="teDescription">Description of Work <span style="font-weight:400;color:var(--text2)">(required)</span></label>' +
                '<textarea class="form-control" id="teDescription" name="description" rows="4" placeholder="Describe the work you performed today…" style="resize:vertical" required>' + esc(defaultDesc) + '</textarea>' +
            '</div>';

        // 6. Units completed — shown only when subtask has a unit of measure
        form.innerHTML += '' +
            '<div id="unitsSection" style="display:none">' +
                '<div class="form-group">' +
                    '<label class="form-label" for="teUnits">Units Completed <span id="unitLabel" style="color:var(--amber);font-weight:400"></span></label>' +
                    '<input class="form-control" type="number" id="teUnits" name="units" step="0.01" min="0" placeholder="e.g. 10" value="' + esc(String(defaultUnits)) + '">' +
                '</div>' +
            '</div>';

        // 7. Photos
        form.innerHTML += '' +
            '<div class="form-group">' +
                '<label class="form-label">Photos <span style="font-weight:400;color:var(--text2)">(optional)</span></label>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                    '<button type="button" class="camera-btn" id="teCameraBtn">&#128247; Camera</button>' +
                    '<button type="button" class="camera-btn" id="teFileBtn">&#128206; File</button>' +
                '</div>' +
                '<input type="file" id="teCameraInput" accept="image/*" capture="environment" style="display:none">' +
                '<input type="file" id="teFileInput" accept="image/*" multiple style="display:none">' +
                '<div class="photo-preview-grid" id="photoPreviewArea"></div>' +
            '</div>';

        // 8. Submit
        form.innerHTML += '' +
            '<button type="submit" class="submit-btn-large" id="teSubmitBtn">' +
                '&#10003; Submit Time Entry' +
            '</button>';

        container.appendChild(form);

        // ── Wire up events ───────────────────────────────────────────────

        // Start/end time → auto-calculate hours
        var startInput   = form.querySelector('#teStartTime');
        var endInput     = form.querySelector('#teEndTime');
        var hoursDisplay = form.querySelector('#hoursDisplay');
        var hoursValue   = form.querySelector('#hoursValue');

        function calcHours() {
            var start = startInput.value;
            var end   = endInput.value;
            if (!start || !end) { hoursDisplay.style.display = 'none'; return; }
            var startMins = timeToMins(start);
            var endMins   = timeToMins(end);
            var diff = endMins - startMins;
            if (diff <= 0) { hoursDisplay.style.display = 'none'; return; }
            var hrs = (diff / 60).toFixed(2);
            hoursValue.textContent = hrs;
            hoursDisplay.style.display = '';
        }
        function timeToMins(t) {
            var parts = t.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
        startInput.addEventListener('change', calcHours);
        endInput.addEventListener('change', calcHours);
        calcHours(); // run on load in case of prefill

        // Subtask → units section
        var subtaskSelect = form.querySelector('#teSubtask');
        var unitsSection  = form.querySelector('#unitsSection');
        var unitLabel     = form.querySelector('#unitLabel');

        function updateUnits() {
            if (!subtaskSelect) { unitsSection.style.display = 'none'; return; }
            var opt  = subtaskSelect.options[subtaskSelect.selectedIndex];
            var unit = opt ? opt.getAttribute('data-unit') : '';
            unitsSection.style.display = unit ? '' : 'none';
            if (unitLabel) unitLabel.textContent = unit ? '(' + unit + ')' : '';
        }
        if (subtaskSelect) {
            subtaskSelect.addEventListener('change', updateUnits);
            updateUnits();
        }

        // Photos
        form.querySelector('#teCameraBtn').addEventListener('click', function() { form.querySelector('#teCameraInput').click(); });
        form.querySelector('#teFileBtn').addEventListener('click', function() { form.querySelector('#teFileInput').click(); });
        form.querySelector('#teCameraInput').addEventListener('change', function() { handlePhotos(this.files); this.value = ''; });
        form.querySelector('#teFileInput').addEventListener('change', function() { handlePhotos(this.files); this.value = ''; });

        function handlePhotos(files) {
            for (var i = 0; i < files.length; i++) {
                (function(file) {
                    var id = AppData.generateId();
                    var reader = new FileReader();
                    reader.onload = function(e) {
                        selectedPhotos.push({ id: id, file: file, thumbnailUrl: e.target.result });
                        renderPreviews();
                    };
                    reader.readAsDataURL(file);
                })(files[i]);
            }
        }

        function renderPreviews() {
            var area = form.querySelector('#photoPreviewArea');
            area.innerHTML = '';
            selectedPhotos.forEach(function(photo, idx) {
                var item = document.createElement('div');
                item.className = 'photo-preview-item';
                item.innerHTML =
                    '<img src="' + photo.thumbnailUrl + '" alt="Photo">' +
                    '<button type="button" class="remove-photo" data-idx="' + idx + '">&times;</button>';
                item.querySelector('.remove-photo').addEventListener('click', function() {
                    selectedPhotos.splice(parseInt(this.dataset.idx), 1);
                    renderPreviews();
                });
                area.appendChild(item);
            });
        }

        // ── Form submission ──────────────────────────────────────────────
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            var dateValue   = form.querySelector('#teDate').value;
            var startTime   = startInput ? startInput.value : '';
            var endTime     = endInput ? endInput.value : '';
            var hoursWorked = null;
            if (startTime && endTime) {
                var diff = timeToMins(endTime) - timeToMins(startTime);
                hoursWorked = diff > 0 ? parseFloat((diff / 60).toFixed(2)) : null;
            }
            var rateValue     = workerRate || null;
            var descValue     = form.querySelector('#teDescription').value.trim();
            var unitsValue    = parseFloat(form.querySelector('#teUnits') ? form.querySelector('#teUnits').value : 0) || null;
            var subtaskId     = subtaskSelect ? subtaskSelect.value : '';
            var subtaskName   = '';
            var unitOfMeasure = '';
            if (subtaskId && subtaskSelect) {
                var selOpt = subtaskSelect.options[subtaskSelect.selectedIndex];
                subtaskName = selOpt ? selOpt.textContent.trim() : '';
                unitOfMeasure = selOpt ? (selOpt.getAttribute('data-unit') || '') : '';
            }

            // Validation
            if (!dateValue) {
                Utils.showToast('Please select a date.', 'error');
                form.querySelector('#teDate').focus();
                return;
            }
            if (!startTime || !endTime) {
                Utils.showToast('Please enter start and end time.', 'error');
                startInput.focus();
                return;
            }
            if (!hoursWorked || hoursWorked <= 0) {
                Utils.showToast('End time must be after start time.', 'error');
                endInput.focus();
                return;
            }
            if (!descValue) {
                Utils.showToast('Please describe the work performed.', 'error');
                form.querySelector('#teDescription').focus();
                return;
            }

            // Disable button
            var submitBtn = form.querySelector('#teSubmitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting…';

            try {
                var submissionId = AppData.generateId();
                var photoIds = [];

                for (var p = 0; p < selectedPhotos.length; p++) {
                    var photo = selectedPhotos[p];
                    var thumb = await Utils.createThumbnail(photo.file);
                    await AppData.savePhoto({
                        id: photo.id,
                        projectId: projectId,
                        workerId: worker.id,
                        submissionId: submissionId,
                        date: dateValue,
                        blob: photo.file,
                        thumbnail: thumb,
                        filename: photo.file.name || 'photo.jpg'
                    });
                    photoIds.push(photo.id);
                }

                var submission = {
                    id: submissionId,
                    workerId: worker.id,
                    workerName: worker.name,
                    projectId: projectId,
                    date: dateValue,
                    startTime: startTime,
                    endTime: endTime,
                    subtaskId: subtaskId || null,
                    subtaskName: subtaskName || '',
                    rateType: 'Hourly',
                    hours: hoursWorked,
                    rate: rateValue,
                    flatRate: null,
                    description: descValue,
                    unitsCompleted: unitsValue,
                    unitOfMeasure: unitOfMeasure,
                    photoIds: photoIds,
                    status: 'Pending',
                    submittedAt: new Date().toISOString(),
                    rejectionReason: null
                };

                AppData.saveSubmission(submission);
                if (isWizardMode) AppData.setData('worker_wizard_done_' + worker.id, true);
                showSuccess();

            } catch (err) {
                console.error('Submission error:', err);
                Utils.showToast('Error submitting. Please try again.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = '✓ Submit Time Entry';
            }
        });

        // ── Success screen ───────────────────────────────────────────────
        function showSuccess() {
            container.innerHTML = '';
            var card = document.createElement('div');
            card.className = 'card';
            card.style.cssText = 'text-align:center;padding:48px 20px';
            card.innerHTML =
                '<div style="font-size:3.5rem;margin-bottom:12px">✓</div>' +
                '<h2 style="color:var(--success);margin-bottom:8px">Submitted!</h2>' +
                '<p style="color:var(--text2);margin-bottom:28px">Your entry is pending approval.</p>' +
                '<div style="display:flex;flex-direction:column;gap:10px;max-width:280px;margin:0 auto">' +
                    '<button class="submit-btn-large" id="teAnother">Log Another Entry</button>' +
                    '<button class="btn btn-secondary" id="teHome" style="min-height:48px">Back to Home</button>' +
                '</div>';
            container.appendChild(card);
            card.querySelector('#teAnother').addEventListener('click', function() {
                window.WorkerTimeEntry.render(container, worker, projectId);
            });
            card.querySelector('#teHome').addEventListener('click', function() {
                window.App.navigateWorker('home');
            });
        }
    }
};
