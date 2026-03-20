// Worker Time Entry Module
window.WorkerTimeEntry = {
    render(container, worker, projectId, prefillData) {
        var esc = Utils.escapeHtml;
        var project = AppData.getProject(projectId);
        if (!project) {
            container.innerHTML = '<div class="card" style="text-align:center;padding:40px"><h3>Project Not Found</h3><p style="color:var(--text2);margin-top:8px">This project may have been removed.</p><button class="btn-primary" style="margin-top:16px" id="teBackHome">Back to Home</button></div>';
            container.querySelector('#teBackHome').addEventListener('click', function() {
                window.App.navigateWorker('home');
            });
            return;
        }

        var subtasks = AppData.getSubtasks(projectId);
        var selectedPhotos = []; // Array of { id, file, thumbnailUrl }
        var isWizardMode = !AppData.getData('worker_wizard_done_' + worker.id);

        // Pre-fill defaults
        var defaults = prefillData || {};
        var defaultDate = defaults.date || Utils.today();
        var defaultSubtaskId = defaults.subtaskId || '';
        var defaultRateType = defaults.rateType || 'Hourly';
        var defaultHours = defaults.hours || '';
        var defaultRate = defaults.rate || worker.defaultRate || '';
        var defaultFlatRate = defaults.flatRate || '';
        var defaultDescription = defaults.description || '';
        var defaultUnits = defaults.unitsCompleted || '';

        container.innerHTML = '';

        // Header
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap';
        header.innerHTML =
            '<button class="btn-secondary btn-sm" id="teBack" style="padding:8px 16px;font-size:.95rem">&larr; Back</button>' +
            '<div style="flex:1;min-width:0">' +
                '<h2 style="font-size:1.15rem">' + esc(project.name) + '</h2>' +
                '<p style="color:var(--text2);font-size:.85rem">Submit Time Entry</p>' +
            '</div>';
        container.appendChild(header);

        // Wizard banner
        if (isWizardMode) {
            var wizardBanner = document.createElement('div');
            wizardBanner.className = 'card';
            wizardBanner.id = 'wizardBanner';
            wizardBanner.style.cssText = 'border-color:var(--success);background:rgba(46,204,113,.1);padding:16px';
            wizardBanner.innerHTML =
                '<div style="display:flex;align-items:center;gap:12px">' +
                    '<span style="font-size:1.2rem">&#9432;</span>' +
                    '<div style="flex:1">' +
                        '<strong style="color:var(--success)">First Time? Follow the steps below.</strong>' +
                        '<p style="font-size:.85rem;color:var(--text2);margin-top:2px">Fill in each field from top to bottom, then tap Submit.</p>' +
                    '</div>' +
                    '<button class="btn-sm btn-secondary" id="dismissWizard">Got it</button>' +
                '</div>';
            container.appendChild(wizardBanner);
        }

        // Form card
        var formCard = document.createElement('div');
        formCard.className = 'card';
        formCard.innerHTML = buildFormHTML();
        container.appendChild(formCard);

        function buildFormHTML() {
            var subtaskOptions = '<option value="">-- No subtask --</option>';
            subtasks.forEach(function(st) {
                var sel = (st.id === defaultSubtaskId) ? ' selected' : '';
                subtaskOptions += '<option value="' + esc(st.id) + '" data-unit="' + esc(st.unitOfMeasure || '') + '"' + sel + '>' + esc(st.name) + '</option>';
            });

            var hourlyChecked = (defaultRateType === 'Hourly') ? ' checked' : '';
            var flatChecked = (defaultRateType === 'Flat') ? ' checked' : '';

            return '' +
                '<form id="timeEntryForm" novalidate>' +

                // Step 1: Date
                (isWizardMode ? '<div style="font-size:.8rem;color:var(--success);font-weight:600;margin-bottom:4px">Step 1: Select the date</div>' : '') +
                '<div class="form-group" style="margin-bottom:16px">' +
                    '<label for="teDate">Date</label>' +
                    '<input type="date" id="teDate" name="date" value="' + esc(defaultDate) + '" style="padding:12px;font-size:1rem" required>' +
                '</div>' +

                // Step 2: Subtask
                (subtasks.length > 0 ? (
                    (isWizardMode ? '<div style="font-size:.8rem;color:var(--success);font-weight:600;margin-bottom:4px">Step 2: Select a subtask (optional)</div>' : '') +
                    '<div class="form-group" style="margin-bottom:16px">' +
                        '<label for="teSubtask">Subtask</label>' +
                        '<select id="teSubtask" name="subtask" style="padding:12px;font-size:1rem">' + subtaskOptions + '</select>' +
                    '</div>'
                ) : '') +

                // Step 3: Rate type
                (isWizardMode ? '<div style="font-size:.8rem;color:var(--success);font-weight:600;margin-bottom:4px">Step ' + (subtasks.length > 0 ? '3' : '2') + ': Choose rate type</div>' : '') +
                '<div class="form-group" style="margin-bottom:16px">' +
                    '<label>Rate Type</label>' +
                    '<div style="display:flex;gap:8px;margin-top:4px">' +
                        '<label style="flex:1;display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--bg);border:2px solid var(--border);border-radius:var(--radius);cursor:pointer;font-size:1rem;color:var(--text)" id="rateTypeHourlyLabel">' +
                            '<input type="radio" name="rateType" value="Hourly" id="rateTypeHourly" style="width:auto;min-width:20px;height:20px"' + hourlyChecked + '>' +
                            ' Hourly' +
                        '</label>' +
                        '<label style="flex:1;display:flex;align-items:center;gap:8px;padding:12px 16px;background:var(--bg);border:2px solid var(--border);border-radius:var(--radius);cursor:pointer;font-size:1rem;color:var(--text)" id="rateTypeFlatLabel">' +
                            '<input type="radio" name="rateType" value="Flat" id="rateTypeFlat" style="width:auto;min-width:20px;height:20px"' + flatChecked + '>' +
                            ' Flat Rate' +
                        '</label>' +
                    '</div>' +
                '</div>' +

                // Hourly fields
                '<div id="hourlyFields" style="' + (defaultRateType === 'Flat' ? 'display:none;' : '') + 'margin-bottom:16px">' +
                    '<div class="form-row">' +
                        '<div class="form-group">' +
                            '<label for="teHours">Hours Worked</label>' +
                            '<input type="number" id="teHours" name="hours" step="0.25" min="0" max="24" placeholder="e.g. 8" value="' + esc(String(defaultHours)) + '" style="padding:12px;font-size:1rem">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label for="teRate">Hourly Rate ($)</label>' +
                            '<input type="number" id="teRate" name="rate" step="0.01" min="0" placeholder="e.g. 35.00" value="' + esc(String(defaultRate)) + '" style="padding:12px;font-size:1rem">' +
                        '</div>' +
                    '</div>' +
                '</div>' +

                // Flat rate field
                '<div id="flatFields" style="' + (defaultRateType === 'Hourly' ? 'display:none;' : '') + 'margin-bottom:16px">' +
                    '<div class="form-group">' +
                        '<label for="teFlatRate">Flat Rate Amount ($)</label>' +
                        '<input type="number" id="teFlatRate" name="flatRate" step="0.01" min="0" placeholder="e.g. 500.00" value="' + esc(String(defaultFlatRate)) + '" style="padding:12px;font-size:1rem">' +
                    '</div>' +
                '</div>' +

                // Description
                (isWizardMode ? '<div style="font-size:.8rem;color:var(--success);font-weight:600;margin-bottom:4px">Step ' + (subtasks.length > 0 ? '4' : '3') + ': Describe your work</div>' : '') +
                '<div class="form-group" style="margin-bottom:16px">' +
                    '<label for="teDescription">Description of Work (required - this goes on the invoice)</label>' +
                    '<textarea id="teDescription" name="description" rows="4" placeholder="Describe the work you performed today..." style="padding:12px;font-size:1rem;resize:vertical" required>' + esc(defaultDescription) + '</textarea>' +
                '</div>' +

                // Units completed (shown only when subtask has unitOfMeasure)
                '<div id="unitsSection" style="display:none;margin-bottom:16px">' +
                    '<div class="form-group">' +
                        '<label for="teUnits">Units Completed <span id="unitLabel" style="color:var(--accent)"></span></label>' +
                        '<input type="number" id="teUnits" name="units" step="0.01" min="0" placeholder="e.g. 10" value="' + esc(String(defaultUnits)) + '" style="padding:12px;font-size:1rem">' +
                    '</div>' +
                '</div>' +

                // Photo upload
                (isWizardMode ? '<div style="font-size:.8rem;color:var(--success);font-weight:600;margin-bottom:4px">Step ' + (subtasks.length > 0 ? '5' : '4') + ': Add photos (optional)</div>' : '') +
                '<div class="form-group" style="margin-bottom:16px">' +
                    '<label>Photos</label>' +
                    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">' +
                        '<button type="button" class="btn-secondary" id="teCameraBtn" style="padding:12px 20px;font-size:.95rem">&#128247; Take Photo</button>' +
                        '<button type="button" class="btn-secondary" id="teFileBtn" style="padding:12px 20px;font-size:.95rem">&#128206; Choose File</button>' +
                    '</div>' +
                    '<input type="file" id="teCameraInput" accept="image/*" capture="environment" style="display:none">' +
                    '<input type="file" id="teFileInput" accept="image/*" multiple style="display:none">' +
                    '<div id="photoPreviewArea" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"></div>' +
                '</div>' +

                // Submit
                '<div style="margin-top:24px">' +
                    '<button type="submit" class="btn-primary" style="width:100%;padding:16px;font-size:1.1rem;font-weight:700">Submit Time Entry</button>' +
                '</div>' +

                '</form>';
        }

        // Bind events
        container.querySelector('#teBack').addEventListener('click', function() {
            window.App.navigateWorker('home');
        });

        // Dismiss wizard
        var dismissBtn = container.querySelector('#dismissWizard');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', function() {
                AppData.setData('worker_wizard_done_' + worker.id, true);
                var banner = container.querySelector('#wizardBanner');
                if (banner) banner.remove();
            });
        }

        // Rate type toggle
        var hourlyRadio = container.querySelector('#rateTypeHourly');
        var flatRadio = container.querySelector('#rateTypeFlat');
        var hourlyFields = container.querySelector('#hourlyFields');
        var flatFields = container.querySelector('#flatFields');
        var hourlyLabel = container.querySelector('#rateTypeHourlyLabel');
        var flatLabel = container.querySelector('#rateTypeFlatLabel');

        function updateRateTypeUI() {
            if (hourlyRadio.checked) {
                hourlyFields.style.display = '';
                flatFields.style.display = 'none';
                hourlyLabel.style.borderColor = 'var(--accent)';
                flatLabel.style.borderColor = 'var(--border)';
            } else {
                hourlyFields.style.display = 'none';
                flatFields.style.display = '';
                hourlyLabel.style.borderColor = 'var(--border)';
                flatLabel.style.borderColor = 'var(--accent)';
            }
        }
        hourlyRadio.addEventListener('change', updateRateTypeUI);
        flatRadio.addEventListener('change', updateRateTypeUI);
        updateRateTypeUI();

        // Subtask change - units section
        var subtaskSelect = container.querySelector('#teSubtask');
        var unitsSection = container.querySelector('#unitsSection');
        var unitLabel = container.querySelector('#unitLabel');

        function updateUnitsVisibility() {
            if (!subtaskSelect) { unitsSection.style.display = 'none'; return; }
            var selectedOption = subtaskSelect.options[subtaskSelect.selectedIndex];
            var unit = selectedOption ? selectedOption.getAttribute('data-unit') : '';
            if (unit) {
                unitsSection.style.display = '';
                unitLabel.textContent = '(' + unit + ')';
            } else {
                unitsSection.style.display = 'none';
                unitLabel.textContent = '';
            }
        }
        if (subtaskSelect) {
            subtaskSelect.addEventListener('change', updateUnitsVisibility);
            updateUnitsVisibility();
        }

        // Photo handling
        var cameraBtn = container.querySelector('#teCameraBtn');
        var fileBtn = container.querySelector('#teFileBtn');
        var cameraInput = container.querySelector('#teCameraInput');
        var fileInput = container.querySelector('#teFileInput');
        var previewArea = container.querySelector('#photoPreviewArea');

        cameraBtn.addEventListener('click', function() { cameraInput.click(); });
        fileBtn.addEventListener('click', function() { fileInput.click(); });

        cameraInput.addEventListener('change', function() { handlePhotos(this.files); this.value = ''; });
        fileInput.addEventListener('change', function() { handlePhotos(this.files); this.value = ''; });

        function handlePhotos(files) {
            for (var i = 0; i < files.length; i++) {
                (function(file) {
                    var photoId = AppData.generateId();
                    var reader = new FileReader();
                    reader.onload = function(e) {
                        var photoObj = {
                            id: photoId,
                            file: file,
                            thumbnailUrl: e.target.result
                        };
                        selectedPhotos.push(photoObj);
                        renderPhotoPreview();
                    };
                    reader.readAsDataURL(file);
                })(files[i]);
            }
        }

        function renderPhotoPreview() {
            previewArea.innerHTML = '';
            selectedPhotos.forEach(function(photo, index) {
                var thumb = document.createElement('div');
                thumb.style.cssText = 'position:relative;width:80px;height:80px;border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);flex-shrink:0';
                thumb.innerHTML =
                    '<img src="' + photo.thumbnailUrl + '" style="width:100%;height:100%;object-fit:cover" alt="Photo">' +
                    '<button type="button" style="position:absolute;top:2px;right:2px;background:var(--accent);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1" data-index="' + index + '">&times;</button>';
                thumb.querySelector('button').addEventListener('click', function() {
                    var idx = parseInt(this.getAttribute('data-index'));
                    selectedPhotos.splice(idx, 1);
                    renderPhotoPreview();
                });
                previewArea.appendChild(thumb);
            });
        }

        // Form submission
        var form = container.querySelector('#timeEntryForm');
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            var dateValue = container.querySelector('#teDate').value;
            var subtaskId = subtaskSelect ? subtaskSelect.value : '';
            var subtaskName = '';
            var unitOfMeasure = '';
            if (subtaskId && subtaskSelect) {
                var opt = subtaskSelect.options[subtaskSelect.selectedIndex];
                subtaskName = opt ? opt.textContent : '';
                unitOfMeasure = opt ? (opt.getAttribute('data-unit') || '') : '';
            }
            var rateType = hourlyRadio.checked ? 'Hourly' : 'Flat';
            var hoursValue = parseFloat(container.querySelector('#teHours').value) || null;
            var rateValue = parseFloat(container.querySelector('#teRate').value) || null;
            var flatRateValue = parseFloat(container.querySelector('#teFlatRate').value) || null;
            var descriptionValue = container.querySelector('#teDescription').value.trim();
            var unitsValue = parseFloat(container.querySelector('#teUnits').value) || null;

            // Validation
            if (!descriptionValue) {
                Utils.showToast('Please describe the work you performed.', 'error');
                container.querySelector('#teDescription').focus();
                return;
            }
            if (!dateValue) {
                Utils.showToast('Please select a date.', 'error');
                container.querySelector('#teDate').focus();
                return;
            }
            if (rateType === 'Hourly' && (!hoursValue || hoursValue <= 0)) {
                Utils.showToast('Please enter hours worked.', 'error');
                container.querySelector('#teHours').focus();
                return;
            }
            if (rateType === 'Hourly' && (!rateValue || rateValue <= 0)) {
                Utils.showToast('Please enter an hourly rate.', 'error');
                container.querySelector('#teRate').focus();
                return;
            }
            if (rateType === 'Flat' && (!flatRateValue || flatRateValue <= 0)) {
                Utils.showToast('Please enter a flat rate amount.', 'error');
                container.querySelector('#teFlatRate').focus();
                return;
            }

            // Disable submit button
            var submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                // Save photos to IndexedDB
                var photoIds = [];
                var submissionId = AppData.generateId();

                for (var p = 0; p < selectedPhotos.length; p++) {
                    var photo = selectedPhotos[p];
                    var thumbnail = await Utils.createThumbnail(photo.file);
                    await AppData.savePhoto({
                        id: photo.id,
                        projectId: projectId,
                        workerId: worker.id,
                        submissionId: submissionId,
                        date: dateValue,
                        blob: photo.file,
                        thumbnail: thumbnail,
                        filename: photo.file.name || 'photo.jpg'
                    });
                    photoIds.push(photo.id);
                }

                // Create submission object
                var submission = {
                    id: submissionId,
                    workerId: worker.id,
                    workerName: worker.name,
                    projectId: projectId,
                    date: dateValue,
                    subtaskId: subtaskId || null,
                    subtaskName: subtaskName || '',
                    rateType: rateType,
                    hours: rateType === 'Hourly' ? hoursValue : null,
                    rate: rateType === 'Hourly' ? rateValue : null,
                    flatRate: rateType === 'Flat' ? flatRateValue : null,
                    description: descriptionValue,
                    unitsCompleted: unitsValue,
                    unitOfMeasure: unitOfMeasure,
                    photoIds: photoIds,
                    status: 'Pending',
                    submittedAt: new Date().toISOString(),
                    rejectionReason: null
                };

                AppData.saveSubmission(submission);

                // Mark wizard as done after first successful submit
                if (isWizardMode) {
                    AppData.setData('worker_wizard_done_' + worker.id, true);
                }

                // Show success
                showSuccess(submissionId);

            } catch (err) {
                console.error('Submission error:', err);
                Utils.showToast('Error submitting entry. Please try again.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Time Entry';
            }
        });

        function showSuccess(submissionId) {
            container.innerHTML = '';
            var successCard = document.createElement('div');
            successCard.className = 'card';
            successCard.style.cssText = 'text-align:center;padding:40px 20px';
            successCard.innerHTML =
                '<div style="font-size:3rem;margin-bottom:16px">&#10003;</div>' +
                '<h2 style="color:var(--success);margin-bottom:8px">Time Entry Submitted</h2>' +
                '<p style="color:var(--text2);margin-bottom:24px">Your submission is pending approval.</p>' +
                '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">' +
                    '<button class="btn-primary" id="teSubmitAnother" style="padding:14px 24px;font-size:1rem">Submit Another</button>' +
                    '<button class="btn-secondary" id="teGoHome" style="padding:14px 24px;font-size:1rem">Back to Home</button>' +
                '</div>';
            container.appendChild(successCard);

            container.querySelector('#teSubmitAnother').addEventListener('click', function() {
                window.WorkerTimeEntry.render(container, worker, projectId);
            });
            container.querySelector('#teGoHome').addEventListener('click', function() {
                window.App.navigateWorker('home');
            });
        }
    }
};
