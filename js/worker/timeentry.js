// Worker Time Entry Module
// Supports: Manual entry (start/end time) OR live Clock In / Clock Out
// Hours are always rounded to the nearest 15 minutes

window.WorkerTimeEntry = {
    render(container, worker, projectId, prefillData) {
        var self = this;
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

        var subtasks      = AppData.getSubtasks(projectId);
        var selectedPhotos = [];
        var isWizardMode  = !AppData.getData('worker_wizard_done_' + worker.id);
        var defaults      = prefillData || {};

        // Only treat as a real resubmit/prefill if it has actual time/description data
        // (params always contains projectId, so we can't use plain truthiness)
        var hasPrefill    = !!(prefillData && (prefillData.startTime || prefillData.description || prefillData.subtaskId));

        // Detect active clock-in session for this worker+project
        var clockKey      = 'clockin_' + worker.id + '_' + projectId;
        var activeClock   = AppData.getData(clockKey); // { time: 'HH:MM', date: 'YYYY-MM-DD' }

        // Default mode: clockin if active session, manual if resubmit, otherwise clockin by default
        var mode = hasPrefill ? 'manual' : (activeClock ? 'clockin' : 'clockin');

        // ── Helper: round minutes to nearest 15 ─────────────────────────
        function roundToNearest15(totalMinutes) {
            return Math.round(totalMinutes / 15) * 15;
        }

        function timeToMins(t) {
            var parts = t.split(':');
            return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }

        function minsToTimeStr(totalMins) {
            var h = Math.floor(totalMins / 60) % 24;
            var m = totalMins % 60;
            return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        }

        function calcRoundedHours(startTime, endTime) {
            if (!startTime || !endTime) return null;
            var diff = timeToMins(endTime) - timeToMins(startTime);
            if (diff <= 0) return null;
            return roundToNearest15(diff) / 60;
        }

        function formatHours(hrs) {
            if (hrs === null) return '';
            var h = Math.floor(hrs);
            var m = Math.round((hrs - h) * 60);
            if (h === 0) return m + ' min';
            if (m === 0) return h + ' hr';
            return h + ' hr ' + m + ' min';
        }

        function nowTimeStr() {
            var d = new Date();
            return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        }

        function formatTimeAmPm(t) {
            if (!t) return '';
            var parts = t.split(':');
            var h = parseInt(parts[0], 10);
            var m = parts[1];
            var ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return h + ':' + m + ' ' + ampm;
        }

        // ── Build page ───────────────────────────────────────────────────
        container.innerHTML = '';

        // Header
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px';
        header.innerHTML =
            '<button class="btn btn-secondary btn-sm" id="teBack" style="min-height:44px;padding:0 16px">&larr; Back</button>' +
            '<div style="flex:1;min-width:0">' +
                '<div style="font-weight:700;font-size:1.05rem;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(project.name) + '</div>' +
                '<div style="color:var(--text2);font-size:.82rem;margin-top:1px">Log time entry</div>' +
            '</div>';
        container.appendChild(header);
        header.querySelector('#teBack').addEventListener('click', function() {
            window.App.navigateWorker('home');
        });

        // First-time wizard banner
        if (isWizardMode && !prefillData) {
            var banner = document.createElement('div');
            banner.className = 'card';
            banner.style.cssText = 'border-color:var(--success);background:rgba(46,204,113,.08);margin-bottom:12px';
            banner.innerHTML =
                '<div style="display:flex;align-items:center;gap:12px">' +
                    '<span style="font-size:1.3rem">&#9432;</span>' +
                    '<div style="flex:1;font-size:.88rem;color:var(--text2)">Clock in when you start, clock out when done — or use <strong>Manual Entry</strong> to log past hours.</div>' +
                    '<button class="btn btn-secondary btn-sm" id="dismissWizard" style="white-space:nowrap">Got it</button>' +
                '</div>';
            container.appendChild(banner);
            banner.querySelector('#dismissWizard').addEventListener('click', function() {
                AppData.setData('worker_wizard_done_' + worker.id, true);
                banner.remove();
            });
        }

        // Mode toggle tabs (hidden when prefill / resubmit)
        if (!hasPrefill) {
            var modeBar = document.createElement('div');
            modeBar.style.cssText = 'display:flex;gap:0;margin-bottom:16px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden';
            modeBar.innerHTML =
                '<button id="modeClockin" style="flex:1;padding:12px;border:none;font-size:.95rem;font-weight:600;cursor:pointer;transition:background .15s">⏱ Clock In / Out</button>' +
                '<button id="modeManual"  style="flex:1;padding:12px;border:none;font-size:.95rem;font-weight:600;cursor:pointer;transition:background .15s;border-left:1px solid var(--border)">✏️ Manual Entry</button>';
            container.appendChild(modeBar);

            function highlightMode() {
                var ci = modeBar.querySelector('#modeClockin');
                var mn = modeBar.querySelector('#modeManual');
                if (mode === 'clockin') {
                    ci.style.background = 'var(--primary)';   ci.style.color = '#fff';
                    mn.style.background = 'var(--bg2)';        mn.style.color = 'var(--text)';
                } else {
                    mn.style.background = 'var(--primary)';   mn.style.color = '#fff';
                    ci.style.background = 'var(--bg2)';        ci.style.color = 'var(--text)';
                }
            }
            highlightMode();

            modeBar.querySelector('#modeClockin').addEventListener('click', function() {
                if (mode === 'clockin') return;
                mode = 'clockin';
                highlightMode();
                renderContent();
            });
            modeBar.querySelector('#modeManual').addEventListener('click', function() {
                if (mode === 'manual') return;
                mode = 'manual';
                highlightMode();
                renderContent();
            });
        }

        // Content area — re-rendered on mode switch
        var contentArea = document.createElement('div');
        contentArea.id = 'teContentArea';
        container.appendChild(contentArea);

        // ── Clock In / Out mode ──────────────────────────────────────────
        function renderClockinMode() {
            while (contentArea.firstChild) {
                contentArea.removeChild(contentArea.firstChild);
            }

            if (!activeClock) {
                // Not clocked in yet
                var now = nowTimeStr();
                var card = document.createElement('div');
                card.className = 'card';
                card.style.cssText = 'text-align:center;padding:40px 20px';
                card.innerHTML =
                    '<div style="font-size:3rem;margin-bottom:8px">⏱</div>' +
                    '<p style="color:var(--text2);margin-bottom:4px">Current time</p>' +
                    '<div id="liveClockDisplay" style="font-size:2.5rem;font-weight:700;letter-spacing:2px;margin-bottom:24px">' + formatTimeAmPm(now) + '</div>' +
                    '<button id="clockInBtn" style="background:var(--success);color:#fff;border:none;border-radius:var(--radius);padding:18px 48px;font-size:1.2rem;font-weight:700;cursor:pointer;min-width:200px;box-shadow:0 4px 14px rgba(46,204,113,.3)">Clock In</button>' +
                    '<p style="color:var(--text2);font-size:.82rem;margin-top:16px">Tap when your shift starts. We\'ll track your time.</p>';
                contentArea.appendChild(card);

                // Live clock update
                var clockTimer = setInterval(function() {
                    var el = document.getElementById('liveClockDisplay');
                    if (el) el.textContent = formatTimeAmPm(nowTimeStr());
                    else clearInterval(clockTimer);
                }, 10000);

                card.querySelector('#clockInBtn').addEventListener('click', function() {
                    var t = nowTimeStr();
                    var d = Utils.today();
                    activeClock = { time: t, date: d };
                    AppData.setData(clockKey, activeClock);
                    clearInterval(clockTimer);
                    renderClockinMode();
                });

            } else {
                // Currently clocked in — show elapsed time + clock out
                var clockedDate  = activeClock.date;
                var clockedTime  = activeClock.time;
                var clockedMins  = timeToMins(clockedTime);

                var elapsedCard = document.createElement('div');
                elapsedCard.className = 'card';
                elapsedCard.style.cssText = 'text-align:center;padding:32px 20px;border-color:var(--success);background:rgba(46,204,113,.05)';
                elapsedCard.innerHTML =
                    '<div style="font-size:1.5rem;margin-bottom:4px">🟢</div>' +
                    '<p style="color:var(--success);font-weight:600;margin-bottom:2px">Clocked in</p>' +
                    '<p style="color:var(--text2);font-size:.85rem;margin-bottom:12px">Since ' + formatTimeAmPm(clockedTime) + ' on ' + Utils.formatDate(clockedDate) + '</p>' +
                    '<div id="elapsedDisplay" style="font-size:2.2rem;font-weight:700;margin-bottom:24px;letter-spacing:1px">—</div>' +
                    '<button id="clockOutBtn" style="background:var(--accent);color:#fff;border:none;border-radius:var(--radius);padding:18px 48px;font-size:1.2rem;font-weight:700;cursor:pointer;min-width:200px;box-shadow:0 4px 14px rgba(233,69,96,.3)">Clock Out</button>' +
                    '<p style="color:var(--text2);font-size:.82rem;margin-top:16px">Tap when your shift ends to log your hours.</p>';
                contentArea.appendChild(elapsedCard);

                // Elapsed timer
                function updateElapsed() {
                    var el = document.getElementById('elapsedDisplay');
                    if (!el) return;
                    var nowMins   = timeToMins(nowTimeStr());
                    var elapsed   = nowMins - clockedMins;
                    if (elapsed < 0) elapsed += 24 * 60; // overnight
                    var rounded   = roundToNearest15(elapsed);
                    var h = Math.floor(rounded / 60);
                    var m = rounded % 60;
                    el.textContent = h + 'h ' + String(m).padStart(2, '0') + 'm';
                }
                updateElapsed();
                var elapsedTimer = setInterval(updateElapsed, 30000);

                elapsedCard.querySelector('#clockOutBtn').addEventListener('click', function() {
                    clearInterval(elapsedTimer);
                    var endTime   = nowTimeStr();
                    var startTime = clockedTime;

                    // Round the end time to nearest 15 min
                    var endMins     = timeToMins(endTime);
                    var roundedEnd  = roundToNearest15(endMins);
                    var roundedStart = roundToNearest15(timeToMins(startTime));
                    var roundedEndStr   = minsToTimeStr(roundedEnd);
                    var roundedStartStr = minsToTimeStr(roundedStart);

                    // Clear active clock
                    AppData.setData(clockKey, null);
                    activeClock = null;

                    // Switch to the complete-entry form pre-filled with clock times
                    renderCompleteForm(clockedDate, roundedStartStr, roundedEndStr);
                });
            }
        }

        // ── Manual Entry mode ────────────────────────────────────────────
        function renderManualMode() {
            while (contentArea.firstChild) {
                contentArea.removeChild(contentArea.firstChild);
            }
            var startTime = defaults.startTime || '';
            var endTime   = defaults.endTime   || '';
            renderCompleteForm(
                defaults.date || Utils.today(),
                startTime,
                endTime
            );
        }

        // ── Complete-entry form (shared by both modes after clock-out) ───
        function renderCompleteForm(defaultDate, defaultStart, defaultEnd) {
            // CRITICAL: Clear contentArea completely and atomically
            contentArea.innerHTML = '';

            var workerRate = parseFloat(worker.defaultRate) || 0;
            var selectedExpenses = []; // Reset expense list for this form

            var form = document.createElement('form');
            form.className = 'time-entry-form';
            form.id = 'timeEntryForm';
            form.noValidate = true;

            // Build form HTML in one string to avoid potential issues with repeated +=
            var formHTML = '';

            // Date
            formHTML +=
                '<div class="form-group">' +
                    '<label class="form-label" for="teDate">Date</label>' +
                    '<input class="form-control" type="date" id="teDate" name="date" value="' + esc(defaultDate) + '" required>' +
                '</div>';

            // Subtask
            if (subtasks.length > 0) {
                var stOptions = '<option value="">— No specific subtask —</option>';
                subtasks.forEach(function(st) {
                    stOptions += '<option value="' + esc(st.id) + '" data-unit="' + esc(st.unitOfMeasure || '') + '"' +
                        (st.id === (defaults.subtaskId || '') ? ' selected' : '') + '>' + esc(st.name) + '</option>';
                });
                formHTML +=
                    '<div class="form-group">' +
                        '<label class="form-label" for="teSubtask">Subtask</label>' +
                        '<select class="form-control" id="teSubtask" name="subtask">' + stOptions + '</select>' +
                    '</div>';
            }

            // Start / End time (SINGLE occurrence only)
            formHTML +=
                '<div class="form-group">' +
                    '<label class="form-label">Start &amp; End Time</label>' +
                    '<div class="time-input-group">' +
                        '<input class="form-control" type="time" id="teStartTime" name="startTime" value="' + esc(defaultStart) + '" style="flex:1">' +
                        '<span class="time-separator">→</span>' +
                        '<input class="form-control" type="time" id="teEndTime" name="endTime" value="' + esc(defaultEnd) + '" style="flex:1">' +
                    '</div>' +
                '</div>' +
                '<div class="hours-display" id="hoursDisplay" style="display:none">' +
                    '<div class="hours-value" id="hoursValue">0.00</div>' +
                    '<div class="hours-label">hours (rounded to nearest 15 min)</div>' +
                '</div>';

            // Hidden rate
            formHTML += '<input type="hidden" id="teRate" value="' + esc(String(workerRate)) + '">';

            // Description (SINGLE occurrence only)
            formHTML +=
                '<div class="form-group">' +
                    '<label class="form-label" for="teDescription">Description of Work <span style="font-weight:400;color:var(--text2)">(required)</span></label>' +
                    '<textarea class="form-control" id="teDescription" name="description" rows="4" placeholder="Describe the work you performed today…" style="resize:vertical" required>' + esc(defaults.description || '') + '</textarea>' +
                '</div>';

            // Units
            formHTML +=
                '<div id="unitsSection" style="display:none">' +
                    '<div class="form-group">' +
                        '<label class="form-label" for="teUnits">Units Completed <span id="unitLabel" style="color:var(--amber);font-weight:400"></span></label>' +
                        '<input class="form-control" type="number" id="teUnits" name="units" step="0.01" min="0" placeholder="e.g. 10" value="' + esc(String(defaults.unitsCompleted || '')) + '">' +
                    '</div>' +
                '</div>';

            // Expenses (SINGLE input section)
            formHTML +=
                '<div class="form-group">' +
                    '<label class="form-label">Expenses <span style="font-weight:400;color:var(--text2)">(optional)</span></label>' +
                    '<div id="expenseList" style="margin-bottom:12px"></div>' +
                    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                        '<input class="form-control" type="text" id="teExpenseDesc" placeholder="Expense description (e.g. Gas, Tools)" style="flex:1;min-width:150px">' +
                        '<input class="form-control" type="number" id="teExpenseAmount" placeholder="$0.00" step="0.01" min="0" style="width:100px">' +
                        '<button type="button" class="btn btn-secondary" id="teExpenseFileBtn" style="padding:10px 16px;white-space:nowrap">📎 Attach</button>' +
                        '<button type="button" class="btn btn-secondary" id="addExpenseBtn" style="padding:10px 16px;white-space:nowrap">Add</button>' +
                    '</div>' +
                    '<input type="file" id="teExpenseInput" style="display:none">' +
                '</div>';

            // Photos
            formHTML +=
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

            // Submit
            formHTML +=
                '<button type="submit" class="submit-btn-large" id="teSubmitBtn">&#10003; Submit Time Entry</button>';

            // Set form HTML all at once
            form.innerHTML = formHTML;
            contentArea.innerHTML = ''; // Double-clear before appending
            contentArea.appendChild(form);

            // ── Wire events ──────────────────────────────────────────────

            var startInput   = form.querySelector('#teStartTime');
            var endInput     = form.querySelector('#teEndTime');
            var hoursDisplay = form.querySelector('#hoursDisplay');
            var hoursValue   = form.querySelector('#hoursValue');

            function calcHoursDisplay() {
                var hrs = calcRoundedHours(startInput.value, endInput.value);
                if (hrs === null) {
                    hoursDisplay.style.display = 'none';
                    return;
                }
                hoursValue.textContent = hrs.toFixed(2) + ' (' + formatHours(hrs) + ')';
                hoursDisplay.style.display = '';
            }
            startInput.addEventListener('change', calcHoursDisplay);
            endInput.addEventListener('change', calcHoursDisplay);
            calcHoursDisplay();

            // Subtask → units
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
            if (subtaskSelect) { subtaskSelect.addEventListener('change', updateUnits); updateUnits(); }

            // Expenses — with file attachment support
            var currentExpenseFile = null; // Track current file being attached

            form.querySelector('#teExpenseFileBtn').addEventListener('click', function(e) {
                e.preventDefault();
                form.querySelector('#teExpenseInput').click();
            });

            form.querySelector('#teExpenseInput').addEventListener('change', function() {
                if (this.files.length > 0) {
                    currentExpenseFile = this.files[0];
                    Utils.showToast('📎 ' + currentExpenseFile.name + ' attached', 'success');
                }
                this.value = '';
            });

            form.querySelector('#addExpenseBtn').addEventListener('click', function() {
                var desc = form.querySelector('#teExpenseDesc').value.trim();
                var amt = parseFloat(form.querySelector('#teExpenseAmount').value);
                if (!desc || isNaN(amt) || amt <= 0) {
                    Utils.showToast('Enter expense description and valid amount', 'error');
                    return;
                }
                selectedExpenses.push({ description: desc, amount: amt, file: currentExpenseFile });
                form.querySelector('#teExpenseDesc').value = '';
                form.querySelector('#teExpenseAmount').value = '';
                currentExpenseFile = null;
                renderExpenseList();
            });

            function renderExpenseList() {
                var list = form.querySelector('#expenseList');
                list.innerHTML = '';
                var total = 0;
                selectedExpenses.forEach(function(exp, idx) {
                    total += exp.amount;
                    var item = document.createElement('div');
                    item.style.cssText = 'padding:8px;background:rgba(245,158,11,.1);border-radius:6px;margin-bottom:6px';

                    var itemContent = '<div style="display:flex;justify-content:space-between;align-items:center">' +
                        '<span>' + esc(exp.description) + ': $' + exp.amount.toFixed(2) + (exp.file ? ' 📎' : '') + '</span>' +
                        '<button type="button" class="btn btn-sm" style="padding:4px 8px;color:var(--accent)" data-idx="' + idx + '">Remove</button>' +
                        '</div>';

                    if (exp.file) {
                        itemContent += '<div style="font-size:0.8rem;color:var(--text2);margin-top:4px">Attachment: ' + esc(exp.file.name) + '</div>';
                    }

                    item.innerHTML = itemContent;
                    item.querySelector('button').addEventListener('click', function(e) {
                        e.preventDefault();
                        selectedExpenses.splice(parseInt(this.dataset.idx), 1);
                        renderExpenseList();
                    });
                    list.appendChild(item);
                });
                if (total > 0) {
                    var totalDiv = document.createElement('div');
                    totalDiv.style.cssText = 'padding:8px;font-weight:600;text-align:right;border-top:1px solid var(--border)';
                    totalDiv.textContent = 'Total: $' + total.toFixed(2);
                    list.appendChild(totalDiv);
                }
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
                        selectedPhotos.splice(parseInt(this.dataset.idx, 10), 1);
                        renderPreviews();
                    });
                    area.appendChild(item);
                });
            }

            // ── Submit ───────────────────────────────────────────────────
            form.addEventListener('submit', async function(e) {
                e.preventDefault();

                var dateValue   = form.querySelector('#teDate').value;
                var startTime   = startInput.value;
                var endTime     = endInput.value;
                var hoursWorked = calcRoundedHours(startTime, endTime);
                var descValue   = form.querySelector('#teDescription').value.trim();
                var unitsValue  = parseFloat(form.querySelector('#teUnits') ? form.querySelector('#teUnits').value : 0) || null;
                var subtaskId   = subtaskSelect ? subtaskSelect.value : '';
                var subtaskName = '', unitOfMeasure = '';
                if (subtaskId && subtaskSelect) {
                    var selOpt = subtaskSelect.options[subtaskSelect.selectedIndex];
                    subtaskName = selOpt ? selOpt.textContent.trim() : '';
                    unitOfMeasure = selOpt ? (selOpt.getAttribute('data-unit') || '') : '';
                }

                if (!dateValue) { Utils.showToast('Please select a date.', 'error'); form.querySelector('#teDate').focus(); return; }
                if (!startTime || !endTime) { Utils.showToast('Please enter start and end time.', 'error'); startInput.focus(); return; }
                if (!hoursWorked || hoursWorked <= 0) { Utils.showToast('End time must be after start time.', 'error'); endInput.focus(); return; }
                if (!descValue) { Utils.showToast('Please describe the work performed.', 'error'); form.querySelector('#teDescription').focus(); return; }

                var submitBtn = form.querySelector('#teSubmitBtn');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Submitting…';

                try {
                    var submissionId = AppData.generateId();
                    var photoIds = [];

                    // Upload photos
                    for (var p = 0; p < selectedPhotos.length; p++) {
                        var photo = selectedPhotos[p];
                        await AppData.savePhoto({
                            id: photo.id,
                            projectId: projectId,
                            workerId: worker.id,
                            submissionId: submissionId,
                            date: dateValue,
                            blob: photo.file,
                            thumbnail: null,
                            filename: photo.file.name || 'photo.jpg'
                        });
                        photoIds.push(photo.id);
                    }

                    // Process expenses and upload attachments
                    var processedExpenses = [];
                    for (var e = 0; e < selectedExpenses.length; e++) {
                        var exp = selectedExpenses[e];
                        var expObj = { description: exp.description, amount: exp.amount, attachmentId: null };

                        // Upload expense attachment if present
                        if (exp.file) {
                            var expFileId = AppData.generateId();
                            await AppData.savePhoto({
                                id: expFileId,
                                projectId: projectId,
                                workerId: worker.id,
                                submissionId: submissionId,
                                date: dateValue,
                                blob: exp.file,
                                filename: exp.file.name || 'attachment'
                            });
                            expObj.attachmentId = expFileId;
                        }
                        processedExpenses.push(expObj);
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
                        rate: workerRate || null,
                        flatRate: null,
                        description: descValue,
                        unitsCompleted: unitsValue,
                        unitOfMeasure: unitOfMeasure,
                        photoIds: photoIds,
                        expenses: processedExpenses,
                        status: 'Pending',
                        submittedAt: new Date().toISOString(),
                        rejectionReason: null,
                        entryMethod: mode === 'clockin' ? 'Clock In/Out' : 'Manual Entry'
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
        }

        // ── Render initial content ───────────────────────────────────────
        function renderContent() {
            if (mode === 'clockin') {
                renderClockinMode();
            } else {
                renderManualMode();
            }
        }
        renderContent();

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
