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
                    '<button id="clockInBtn" class="btn-primary btn-tap btn-block" style="min-height:56px">Clock In</button>' +
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
                    '<button id="clockOutBtn" class="btn-danger btn-tap btn-block" style="min-height:56px">Clock Out</button>' +
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

        // ── Draft persistence helpers ────────────────────────────────────
        // Draft key scoped per worker + project to prevent cross-contamination.
        // File blobs cannot be serialized; only metadata (name) is preserved.
        // Workers are informed they need to re-attach receipt files.
        var draftKey = 'timeentry_draft_' + worker.id + '_' + projectId;
        var DRAFT_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours
        var draftDirty = false;
        var draftSaveTimer = null;

        function saveDraft() {
            try {
                var f = document.getElementById('timeEntryForm');
                if (!f) return;
                var draft = {
                    date:              (f.querySelector('#teDate')         || {}).value || '',
                    startTime:         (f.querySelector('#teStartTime')    || {}).value || '',
                    endTime:           (f.querySelector('#teEndTime')      || {}).value || '',
                    description:       (f.querySelector('#teDescription')  || {}).value || '',
                    subtaskId:         (f.querySelector('#teSubtask')      || {}).value || '',
                    units:             (f.querySelector('#teUnits')        || {}).value || '',
                    impactCodeId:      (f.querySelector('#teImpactCode')   || {}).value || '',
                    impactHours:       (f.querySelector('#teImpactHours')  || {}).value || '',
                    impactBillable:    (f.querySelector('#teImpactBillable')|| {}).value || '',
                    impactDescription: (f.querySelector('#teImpactDesc')   || {}).value || '',
                    equipmentNote:     (f.querySelector('#teEquipmentNote')|| {}).value || '',
                    // Serialize expense metadata only (no file blobs)
                    expenses:  selectedExpenses.map(function(e) {
                        return { description: e.description, amount: e.amount, fileName: e.file ? e.file.name : null };
                    }),
                    equipment:  selectedEquipment.map(function(e) {
                        return { equipmentId: e.equipmentId, equipmentName: e.equipmentName, hours: e.hours };
                    }),
                    draftSavedAt: new Date().toISOString()
                };
                AppData.setData(draftKey, draft);
                draftDirty = false;
            } catch(err) { /* silent — draft save is best-effort */ }
        }

        function clearDraft() {
            try { AppData.setData(draftKey, null); } catch(e) {}
        }

        function scheduleDraftSave() {
            draftDirty = true;
            clearTimeout(draftSaveTimer);
            draftSaveTimer = setTimeout(saveDraft, 600);
        }

        // ── Complete-entry form (shared by both modes after clock-out) ───
        function renderCompleteForm(defaultDate, defaultStart, defaultEnd) {
            // CRITICAL: Clear contentArea completely and atomically
            contentArea.innerHTML = '';

            var selectedExpenses = []; // Reset expense list for this form
            var selectedEquipment = []; // Reset equipment list for this form
            var impactCodes = []; // Loaded async below

            // ── Draft restore ────────────────────────────────────────────
            var existingDraft = AppData.getData(draftKey);
            var restoredFromDraft = false;
            var draftHadFiles = false;
            if (existingDraft && existingDraft.draftSavedAt) {
                var age = Date.now() - new Date(existingDraft.draftSavedAt).getTime();
                if (age < DRAFT_MAX_AGE_MS) {
                    // Use draft values as defaults (overrides clock-out prefill only when
                    // the draft has actual content — avoids empty draft clobbering clock data)
                    if (existingDraft.date)      defaultDate  = existingDraft.date;
                    if (existingDraft.startTime) defaultStart = existingDraft.startTime;
                    if (existingDraft.endTime)   defaultEnd   = existingDraft.endTime;
                    // Restore in-memory expense/equipment lists (without file blobs)
                    if (existingDraft.expenses && existingDraft.expenses.length > 0) {
                        existingDraft.expenses.forEach(function(e) {
                            selectedExpenses.push({ description: e.description, amount: e.amount, file: null });
                            if (e.fileName) draftHadFiles = true;
                        });
                    }
                    if (existingDraft.equipment && existingDraft.equipment.length > 0) {
                        existingDraft.equipment.forEach(function(e) {
                            selectedEquipment.push({ equipmentId: e.equipmentId, equipmentName: e.equipmentName, hours: e.hours });
                        });
                    }
                    restoredFromDraft = true;
                } else {
                    clearDraft(); // Stale draft — discard
                }
            }

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

            // Work Item
            if (subtasks.length > 0) {
                var stOptions = '<option value="">— No specific work item —</option>';
                subtasks.forEach(function(st) {
                    stOptions += '<option value="' + esc(st.id) + '" data-unit="' + esc(st.unitOfMeasure || '') + '"' +
                        (st.id === (defaults.subtaskId || '') ? ' selected' : '') + '>' + esc(st.name) + '</option>';
                });
                formHTML +=
                    '<div class="form-group">' +
                        '<label class="form-label eyebrow" for="teSubtask">TASK</label>' +
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
                    '<div class="hero-num gold" id="hoursValue">0.00</div>' +
                    '<div class="hours-label">hours (rounded to nearest 15 min)</div>' +
                '</div>';

            // Description (SINGLE occurrence only)
            formHTML +=
                '<div class="form-group">' +
                    '<label class="form-label eyebrow" for="teDescription">NOTES <span style="font-weight:400;color:var(--text2);text-transform:none;letter-spacing:0">(required)</span></label>' +
                    '<textarea class="form-control" id="teDescription" name="description" rows="4" placeholder="Describe the work you performed today…" style="resize:vertical" required>' + esc(defaults.description || '') + '</textarea>' +
                '</div>';

            // Impact Code (optional — loaded async)
            formHTML +=
                '<div class="form-group" id="impactCodeSection">' +
                    '<label class="form-label" for="teImpactCode">Impact Code <span style="font-weight:400;color:var(--text2)">(optional — non-productive time)</span></label>' +
                    '<select class="form-control" id="teImpactCode">' +
                        '<option value="">— None —</option>' +
                    '</select>' +
                '</div>' +
                '<div id="impactDetailsSection" style="display:none">' +
                    '<div class="form-group">' +
                        '<label class="form-label" for="teImpactHours">Impact Hours <span style="color:var(--accent)">*</span></label>' +
                        '<input class="form-control" type="number" id="teImpactHours" step="0.25" min="0.25" placeholder="e.g. 2.0">' +
                        '<div style="font-size:.78rem;color:var(--text2);margin-top:3px" id="teImpactHoursHint"></div>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="form-label" for="teImpactBillable">Impact Billable Status</label>' +
                        '<select class="form-control" id="teImpactBillable">' +
                            '<option value="Non-Billable">Non-Billable</option>' +
                            '<option value="Billable">Billable</option>' +
                            '<option value="Disputed">Disputed</option>' +
                            '<option value="To Be Reviewed">To Be Reviewed</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="form-group" id="impactDescGroup">' +
                        '<label class="form-label" for="teImpactDesc">Impact Description <span id="teImpactDescReq" style="color:var(--text2);font-weight:400">(optional)</span></label>' +
                        '<textarea class="form-control" id="teImpactDesc" rows="2" placeholder="Describe the impact event…"></textarea>' +
                    '</div>' +
                '</div>';

            // Units
            formHTML +=
                '<div id="unitsSection" style="display:none">' +
                    '<div class="form-group">' +
                        '<label class="form-label" for="teUnits">Units Completed <span id="unitLabel" style="color:var(--amber);font-weight:400"></span></label>' +
                        '<input class="form-control" type="number" id="teUnits" name="units" step="0.01" min="0" placeholder="e.g. 10" value="' + esc(String(defaults.unitsCompleted || '')) + '">' +
                    '</div>' +
                '</div>';

            // Expenses — multi-file support, persistent attachment status
            formHTML +=
                '<div class="form-group">' +
                    '<label class="form-label">Expenses <span style="font-weight:400;color:var(--text2)">(optional)</span></label>' +
                    '<div id="expenseList" style="margin-bottom:12px"></div>' +
                    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                        '<input class="form-control" type="text" id="teExpenseDesc" placeholder="Expense description (e.g. Gas, Tools)" style="flex:1;min-width:150px">' +
                        '<input class="form-control" type="number" id="teExpenseAmount" placeholder="$0.00" step="0.01" min="0" style="width:100px">' +
                        '<button type="button" class="btn btn-secondary" id="teExpenseFileBtn" style="padding:10px 16px;white-space:nowrap" aria-label="Attach receipt or document">📎 Attach</button>' +
                        '<button type="button" class="btn btn-secondary" id="addExpenseBtn" style="padding:10px 16px;white-space:nowrap">Add</button>' +
                    '</div>' +
                    '<div id="teExpenseFileStatus" style="display:none;font-size:.82rem;font-weight:600;color:var(--success);padding:5px 6px;margin-top:4px;background:rgba(46,204,113,.08);border-radius:5px;border:1px solid rgba(46,204,113,.25)"></div>' +
                    '<div id="teExpenseDropZone" style="margin-top:6px;"></div>' +
                    '<input type="file" id="teExpenseInput" accept="image/*,.pdf,.doc,.docx,.heic,.heif" multiple style="display:none">' +
                '</div>';

            // Equipment — always render; workers select from admin-created list only.
            // If equipment not in list, worker can leave a note (stored on submission, not as equipment record).
            var activeEquipment = (AppData.getEquipment ? AppData.getEquipment() : []).filter(function(eq) { return eq.status === 'Active'; });
            var eqSelectHtml = '';
            if (activeEquipment.length > 0) {
                var eqOptions = '<option value="">— Select equipment —</option>' +
                    activeEquipment.map(function(eq) {
                        return '<option value="' + esc(eq.id) + '" data-name="' + esc(eq.name) + '">' +
                            esc(eq.name) + (eq.type ? ' (' + esc(eq.type) + ')' : '') + '</option>';
                    }).join('');
                eqSelectHtml =
                    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
                        '<select class="form-control" id="teEquipmentSelect" style="flex:1;min-width:160px">' + eqOptions + '</select>' +
                        '<input class="form-control" type="number" id="teEquipmentHours" placeholder="Hours" step="0.25" min="0.25" style="width:90px">' +
                        '<button type="button" class="btn btn-secondary" id="addEquipmentEntryBtn" style="padding:10px 16px;white-space:nowrap">Add</button>' +
                    '</div>';
            } else {
                eqSelectHtml = '<p style="color:var(--text2);font-size:.85rem;margin:0 0 8px">No equipment has been set up by your company yet. Use the note below to flag it for your admin.</p>';
            }
            formHTML +=
                '<div class="form-group">' +
                    '<label class="form-label">Equipment Used <span style="font-weight:400;color:var(--text2)">(optional)</span></label>' +
                    '<div id="equipmentEntryList" style="margin-bottom:8px"></div>' +
                    eqSelectHtml +
                    '<div style="margin-top:6px">' +
                        '<label class="form-label" style="font-size:.8rem;color:var(--text2);margin-bottom:3px">Equipment not in list? Note for admin:</label>' +
                        '<input class="form-control" type="text" id="teEquipmentNote" placeholder="e.g. Used excavator — not listed yet" style="font-size:.9rem">' +
                    '</div>' +
                '</div>';

            // Photos — single input, no capture="environment" (causes iPhone black screen)
            // accept="image/*" without capture shows iOS native sheet: Take Photo / Photo Library / Files
            formHTML +=
                '<div class="form-group">' +
                    '<label class="form-label eyebrow">ATTACH PHOTO <span style="font-weight:400;color:var(--text2);text-transform:none;letter-spacing:0">(optional)</span></label>' +
                    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                        '<button type="button" class="camera-btn" id="teAddPhotosBtn" aria-label="Add photos">&#128247; Add Photos</button>' +
                    '</div>' +
                    '<input type="file" id="tePhotoInput" accept="image/*" multiple style="display:none">' +
                    '<div id="tePhotoDropZone" style="margin-top:6px;"></div>' +
                    '<div class="photo-preview-grid" id="photoPreviewArea"></div>' +
                '</div>';

            // Submit
            formHTML +=
                '<button type="submit" class="btn-primary btn-tap btn-block" id="teSubmitBtn" style="min-height:56px">&#10003; Submit for Approval</button>';

            // Set form HTML all at once
            form.innerHTML = formHTML;
            contentArea.innerHTML = ''; // Double-clear before appending
            contentArea.appendChild(form);

            // ── Draft restore banner ─────────────────────────────────────
            if (restoredFromDraft) {
                var banner = document.createElement('div');
                banner.id = 'teDraftBanner';
                banner.style.cssText = 'background:rgba(52,152,219,.1);border:1px solid rgba(52,152,219,.35);border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:.85rem;display:flex;justify-content:space-between;align-items:flex-start;gap:12px';
                var savedTime = existingDraft.draftSavedAt ? new Date(existingDraft.draftSavedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
                var bannerMsg = '📋 Draft restored from ' + savedTime + '.';
                if (draftHadFiles) bannerMsg += ' Re-attach receipt files — files cannot be saved in drafts.';
                banner.innerHTML =
                    '<span>' + bannerMsg + '</span>' +
                    '<button type="button" id="teDraftDiscard" style="background:none;border:none;color:var(--accent);font-size:.8rem;font-weight:600;cursor:pointer;white-space:nowrap;padding:0">Discard draft</button>';
                form.insertBefore(banner, form.firstChild);
                // Restore text field values from draft
                var dv = existingDraft;
                if (dv.description  && form.querySelector('#teDescription'))   form.querySelector('#teDescription').value   = dv.description;
                if (dv.subtaskId    && form.querySelector('#teSubtask'))        form.querySelector('#teSubtask').value        = dv.subtaskId;
                if (dv.units        && form.querySelector('#teUnits'))          form.querySelector('#teUnits').value          = dv.units;
                if (dv.equipmentNote && form.querySelector('#teEquipmentNote')) form.querySelector('#teEquipmentNote').value  = dv.equipmentNote;
                if (dv.impactCodeId) {
                    var icSel = form.querySelector('#teImpactCode');
                    if (icSel) {
                        // Impact codes loaded async — store for deferred restore
                        form.dataset.restoreImpactCode    = dv.impactCodeId;
                        form.dataset.restoreImpactHours   = dv.impactHours   || '';
                        form.dataset.restoreImpactBillable= dv.impactBillable|| '';
                        form.dataset.restoreImpactDesc    = dv.impactDescription || '';
                    }
                }
                banner.querySelector('#teDraftDiscard').onclick = function() {
                    clearDraft();
                    selectedExpenses  = [];
                    selectedEquipment = [];
                    banner.remove();
                    renderExpenseList();
                    renderEquipmentList();
                    // Reset text fields
                    ['#teDescription','#teSubtask','#teUnits','#teEquipmentNote',
                     '#teImpactCode','#teImpactHours','#teImpactDesc'].forEach(function(id) {
                        var el = form.querySelector(id);
                        if (el) el.value = '';
                    });
                    Utils.showToast('Draft discarded', 'info');
                };
            }

            // ── Wire events ──────────────────────────────────────────────

            var startInput   = form.querySelector('#teStartTime');
            var endInput     = form.querySelector('#teEndTime');
            var hoursDisplay = form.querySelector('#hoursDisplay');
            var hoursValue   = form.querySelector('#hoursValue');

            // Impact code async load
            (async function() {
                try {
                    var jwt = AppData.getJwt ? AppData.getJwt() : '';
                    var res = await fetch(AppData.API_BASE + '/api/impact-codes?active=true', {
                        headers: { 'Authorization': 'Bearer ' + jwt }
                    });
                    if (!res.ok) return;
                    impactCodes = await res.json();
                    var sel = form.querySelector('#teImpactCode');
                    if (!sel) return;
                    impactCodes.forEach(function(ic) {
                        var opt = document.createElement('option');
                        opt.value = ic.id;
                        opt.textContent = (ic.code ? '[' + ic.code + '] ' : '') + ic.name + ' — ' + ic.category;
                        opt.dataset.billable = ic.defaultBillableStatus || 'Non-Billable';
                        sel.appendChild(opt);
                    });
                    // Restore impact code from draft (deferred until options are loaded)
                    var ri = form.dataset.restoreImpactCode;
                    if (ri) {
                        sel.value = ri;
                        if (sel.value === ri) { // option exists
                            sel.dispatchEvent(new Event('change')); // show detail section
                            setTimeout(function() {
                                var hEl = form.querySelector('#teImpactHours');
                                var bEl = form.querySelector('#teImpactBillable');
                                var dEl = form.querySelector('#teImpactDesc');
                                if (hEl && form.dataset.restoreImpactHours)    hEl.value = form.dataset.restoreImpactHours;
                                if (dEl && form.dataset.restoreImpactDesc)     dEl.value = form.dataset.restoreImpactDesc;
                                if (bEl && form.dataset.restoreImpactBillable) {
                                    bEl.value = form.dataset.restoreImpactBillable;
                                    bEl.dispatchEvent(new Event('change'));
                                }
                            }, 0);
                        }
                    }
                } catch (e2) { /* silent — impact code is optional */ }
            })();

            // ── Draft auto-save: wire blur on key fields ─────────────────
            ['#teDate','#teStartTime','#teEndTime','#teDescription','#teSubtask',
             '#teUnits','#teImpactCode','#teImpactHours','#teImpactBillable','#teImpactDesc','#teEquipmentNote']
            .forEach(function(id) {
                var el = form.querySelector(id);
                if (el) el.addEventListener('change', scheduleDraftSave);
            });
            // Text area saves on input (debounced)
            var descEl = form.querySelector('#teDescription');
            if (descEl) descEl.addEventListener('input', scheduleDraftSave);

            // ── Render lists from restored draft data ────────────────────
            if (restoredFromDraft) {
                renderExpenseList();
                renderEquipmentList();
            }

            // Impact code toggle
            form.querySelector('#teImpactCode').addEventListener('change', function() {
                var detailSection = form.querySelector('#impactDetailsSection');
                if (!this.value) {
                    detailSection.style.display = 'none';
                    return;
                }
                detailSection.style.display = '';
                // Set default billable from code
                var opt = this.options[this.selectedIndex];
                var billableSel = form.querySelector('#teImpactBillable');
                if (opt && opt.dataset.billable) {
                    for (var i = 0; i < billableSel.options.length; i++) {
                        if (billableSel.options[i].value === opt.dataset.billable) {
                            billableSel.selectedIndex = i; break;
                        }
                    }
                }
                updateImpactDescRequired();
                updateImpactHoursHint();
            });

            // Billable status → description required flag
            form.querySelector('#teImpactBillable').addEventListener('change', updateImpactDescRequired);

            function updateImpactDescRequired() {
                var billable = form.querySelector('#teImpactBillable').value;
                var reqSpan  = form.querySelector('#teImpactDescReq');
                if (reqSpan) {
                    if (billable === 'Billable' || billable === 'Disputed') {
                        reqSpan.textContent = '(required)';
                        reqSpan.style.color = 'var(--accent)';
                    } else {
                        reqSpan.textContent = '(optional)';
                        reqSpan.style.color = 'var(--text2)';
                    }
                }
            }

            function updateImpactHoursHint() {
                var hrs  = calcRoundedHours(startInput.value, endInput.value);
                var hint = form.querySelector('#teImpactHoursHint');
                if (hint && hrs > 0) {
                    hint.textContent = 'Max: ' + hrs.toFixed(2) + ' hrs (total shift hours)';
                }
            }
            startInput.addEventListener('change', updateImpactHoursHint);
            endInput.addEventListener('change', updateImpactHoursHint);

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

            // Expenses — multi-file support with persistent status indicator
            var pendingExpenseFiles = []; // Files queued for the next Add action

            function updateExpenseFileStatus() {
                var statusEl = form.querySelector('#teExpenseFileStatus');
                if (!statusEl) return;
                if (pendingExpenseFiles.length === 0) {
                    statusEl.style.display = 'none';
                    statusEl.textContent = '';
                } else if (pendingExpenseFiles.length === 1) {
                    statusEl.textContent = '📎 ' + pendingExpenseFiles[0].name + ' — ready to attach (click Add)';
                    statusEl.style.display = 'block';
                } else {
                    statusEl.textContent = '📎 ' + pendingExpenseFiles.length + ' files selected — one expense line will be created per file when you click Add';
                    statusEl.style.display = 'block';
                }
            }

            form.querySelector('#teExpenseFileBtn').addEventListener('click', function(e) {
                e.preventDefault();
                form.querySelector('#teExpenseInput').click();
            });

            form.querySelector('#teExpenseInput').addEventListener('change', function() {
                if (this.files.length > 0) {
                    pendingExpenseFiles = Array.from(this.files);
                    updateExpenseFileStatus();
                    if (pendingExpenseFiles.length === 1) {
                        Utils.showToast('📎 ' + pendingExpenseFiles[0].name + ' ready — click Add to attach', 'success');
                    } else {
                        Utils.showToast('📎 ' + pendingExpenseFiles.length + ' files selected — click Add to attach', 'success');
                    }
                }
                this.value = ''; // Reset so same file can be re-selected
            });

            // Expense drag-and-drop zone (desktop enhancement — 📎 Attach button remains primary on mobile)
            if (window.UploadHelper) {
                UploadHelper.initDragDrop({
                    zone:          form.querySelector('#teExpenseDropZone'),
                    input:         form.querySelector('#teExpenseInput'),
                    accept:        'image/*,.pdf,.doc,.docx,.heic,.heif',
                    multiple:      true,
                    maxFileSizeMB: 20,
                    listenToInput: false,
                    onFiles: function(files) {
                        pendingExpenseFiles = files;
                        updateExpenseFileStatus();
                        var n = files.length;
                        Utils.showToast('📎 ' + n + (n === 1 ? ' file' : ' files') + ' dropped — click Add to attach', 'success');
                    },
                    label: 'Drag receipts or documents here',
                    hint:  'Or tap \u{1F4CE} Attach above • images, PDF, DOC',
                });
            }

            form.querySelector('#addExpenseBtn').addEventListener('click', function() {
                var desc = form.querySelector('#teExpenseDesc').value.trim();
                var amt  = parseFloat(form.querySelector('#teExpenseAmount').value);
                if (!desc || isNaN(amt) || amt <= 0) {
                    Utils.showToast('Enter expense description and valid amount', 'error');
                    return;
                }
                if (pendingExpenseFiles.length > 1) {
                    // Multi-file: auto-create one expense line per file
                    pendingExpenseFiles.forEach(function(file, i) {
                        selectedExpenses.push({
                            description: desc + ' (' + (i + 1) + ')',
                            amount: amt,
                            file: file
                        });
                    });
                    Utils.showToast(pendingExpenseFiles.length + ' expense lines added', 'success');
                } else {
                    selectedExpenses.push({
                        description: desc,
                        amount: amt,
                        file: pendingExpenseFiles.length === 1 ? pendingExpenseFiles[0] : null
                    });
                }
                form.querySelector('#teExpenseDesc').value  = '';
                form.querySelector('#teExpenseAmount').value = '';
                pendingExpenseFiles = [];
                updateExpenseFileStatus();
                renderExpenseList();
                saveDraft();
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
                        saveDraft();
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

            // Equipment entry handlers — always wired (section always rendered)
            function renderEquipmentList() {
                var list = form.querySelector('#equipmentEntryList');
                if (!list) return;
                list.innerHTML = '';
                selectedEquipment.forEach(function(entry, idx) {
                    var div = document.createElement('div');
                    div.style.cssText = 'padding:8px;background:rgba(52,152,219,.08);border:1px solid rgba(52,152,219,.2);border-radius:6px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center';
                    div.innerHTML =
                        '<div>' +
                            '<strong>' + esc(entry.equipmentName) + '</strong>' +
                            '<span style="color:var(--text2);font-size:.85rem;margin-left:8px">' + entry.hours + ' hr</span>' +
                        '</div>' +
                        '<button type="button" class="btn btn-sm" style="padding:4px 8px;color:var(--accent)" data-idx="' + idx + '">Remove</button>';
                    div.querySelector('button').addEventListener('click', function() {
                        selectedEquipment.splice(parseInt(this.dataset.idx), 1);
                        renderEquipmentList();
                        saveDraft();
                    });
                    list.appendChild(div);
                });
            }

            var addEqBtn = form.querySelector('#addEquipmentEntryBtn');
            if (addEqBtn) {
                addEqBtn.addEventListener('click', function() {
                    var sel = form.querySelector('#teEquipmentSelect');
                    var hrs = parseFloat(form.querySelector('#teEquipmentHours').value);
                    if (!sel.value) { Utils.showToast('Select equipment first', 'error'); return; }
                    if (isNaN(hrs) || hrs <= 0) { Utils.showToast('Enter valid hours greater than 0 (e.g. 0.5, 2)', 'error'); return; }
                    var opt = sel.options[sel.selectedIndex];
                    selectedEquipment.push({
                        equipmentId:   sel.value,
                        equipmentName: opt.dataset.name || opt.textContent,
                        hours:         hrs
                    });
                    sel.value = '';
                    form.querySelector('#teEquipmentHours').value = '';
                    renderEquipmentList();
                    saveDraft();
                });
            }

            // Equipment note — save draft on change
            var eqNoteInput = form.querySelector('#teEquipmentNote');
            if (eqNoteInput) {
                eqNoteInput.addEventListener('input', function() { draftDirty = true; });
            }

            // Photos — single input triggers iOS native sheet (Take Photo / Photo Library / Files)
            form.querySelector('#teAddPhotosBtn').addEventListener('click', function() { form.querySelector('#tePhotoInput').click(); });
            form.querySelector('#tePhotoInput').addEventListener('change', function() { handlePhotos(this.files); this.value = ''; });

            // Photo drag-and-drop zone (desktop enhancement — Add Photos button remains primary on mobile)
            if (window.UploadHelper) {
                UploadHelper.initDragDrop({
                    zone:          form.querySelector('#tePhotoDropZone'),
                    input:         form.querySelector('#tePhotoInput'),
                    accept:        'image/*',
                    multiple:      true,
                    maxFileSizeMB: 10,
                    listenToInput: false,
                    onFiles:       function(files) { handlePhotos(files); },
                    label:         'Drag photos here',
                    hint:          'Or tap \u{1F4F7} Add Photos above • images only, max 10 MB each',
                });
            }

            function handlePhotos(files) {
                var MAX_PHOTOS = 10;
                var MAX_MB     = 10;
                var MAX_BYTES  = MAX_MB * 1024 * 1024;
                var oversized  = [];
                var accepted   = [];
                for (var i = 0; i < files.length; i++) {
                    if (files[i].size > MAX_BYTES) {
                        oversized.push(files[i].name);
                    } else {
                        accepted.push(files[i]);
                    }
                }
                if (oversized.length > 0) {
                    Utils.showToast('Photo(s) too large (max ' + MAX_MB + ' MB each): ' + oversized.join(', '), 'error');
                }
                var remaining = MAX_PHOTOS - selectedPhotos.length;
                if (accepted.length > remaining) {
                    Utils.showToast('Max ' + MAX_PHOTOS + ' photos per entry. Only the first ' + remaining + ' added.', 'error');
                    accepted = accepted.slice(0, remaining);
                }
                for (var j = 0; j < accepted.length; j++) {
                    (function(file) {
                        var id = AppData.generateId();
                        var reader = new FileReader();
                        reader.onload = function(e) {
                            selectedPhotos.push({ id: id, file: file, thumbnailUrl: e.target.result });
                            renderPreviews();
                        };
                        reader.readAsDataURL(file);
                    })(accepted[j]);
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

                var impactCodeId      = form.querySelector('#teImpactCode').value;
                var impactHours       = impactCodeId ? parseFloat(form.querySelector('#teImpactHours').value) : 0;
                var impactBillable    = impactCodeId ? form.querySelector('#teImpactBillable').value : '';
                var impactDescription = impactCodeId ? (form.querySelector('#teImpactDesc').value || '').trim() : '';

                if (!dateValue) { Utils.showToast('Please select a date.', 'error'); form.querySelector('#teDate').focus(); return; }
                if (!startTime || !endTime) { Utils.showToast('Please enter start and end time.', 'error'); startInput.focus(); return; }
                if (!hoursWorked || hoursWorked <= 0) { Utils.showToast('End time must be after start time.', 'error'); endInput.focus(); return; }
                if (!descValue) { Utils.showToast('Please describe the work performed.', 'error'); form.querySelector('#teDescription').focus(); return; }

                // Impact code validation
                if (impactCodeId) {
                    if (!impactHours || impactHours <= 0) {
                        Utils.showToast('Impact hours must be greater than 0.', 'error');
                        form.querySelector('#teImpactHours').focus(); return;
                    }
                    if (impactHours > hoursWorked) {
                        Utils.showToast('Impact hours cannot exceed total shift hours (' + hoursWorked.toFixed(2) + ').', 'error');
                        form.querySelector('#teImpactHours').focus(); return;
                    }
                    if ((impactBillable === 'Billable' || impactBillable === 'Disputed') && !impactDescription) {
                        Utils.showToast('Impact description is required for Billable or Disputed status.', 'error');
                        form.querySelector('#teImpactDesc').focus(); return;
                    }
                }

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
                        flatRate: null,
                        description: descValue,
                        unitsCompleted: unitsValue,
                        unitOfMeasure: unitOfMeasure,
                        photoIds: photoIds,
                        expenses: processedExpenses,
                        status: 'Pending',
                        submittedAt: new Date().toISOString(),
                        rejectionReason: null,
                        entryMethod: mode === 'clockin' ? 'Clock In/Out' : 'Manual Entry',
                        equipmentEntries: selectedEquipment.map(function(e) {
                            return {
                                equipmentId:   e.equipmentId,
                                equipmentName: e.equipmentName,
                                hours:         e.hours
                                // costRate and chargeOutRate intentionally omitted —
                                // rates are resolved from the equipment master record, not submitted by workers
                            };
                        }),
                        // Impact code fields
                        impactCodeId:         impactCodeId || null,
                        impactHours:          impactCodeId ? impactHours : null,
                        impactBillableStatus: impactCodeId ? impactBillable : null,
                        impactDescription:    impactCodeId ? impactDescription : null,
                        // Equipment note — admin-facing only; no equipment record created
                        equipmentNote:        (form.querySelector('#teEquipmentNote') || {}).value ? form.querySelector('#teEquipmentNote').value.trim() : '',
                    };

                    AppData.saveSubmission(submission);

                    // Save individual equipment log records (for project costing rollup)
                    if (AppData.saveEquipmentLog && selectedEquipment.length > 0) {
                        selectedEquipment.forEach(function(e) {
                            AppData.saveEquipmentLog({
                                id:            AppData.generateId(),
                                submissionId:  submissionId,
                                equipmentId:   e.equipmentId,
                                equipmentName: e.equipmentName,
                                projectId:     projectId,
                                workerId:      worker.id,
                                workerName:    worker.name,
                                date:          dateValue,
                                hours:         e.hours,
                                // costRate, chargeOutRate, cost, revenue intentionally omitted —
                                // resolved from equipment master by admin costing reports
                                createdAt:     new Date().toISOString()
                            });
                        });

                        // Check service interval thresholds for each piece of equipment logged
                        if (AppData.getEquipmentItem && AppData.getEquipmentLogs) {
                            // Get unique equipment IDs from this submission
                            var eqIds = [...new Set(selectedEquipment.map(function(e) { return e.equipmentId; }))];
                            eqIds.forEach(function(eqId) {
                                var eqItem = AppData.getEquipmentItem(eqId);
                                if (!eqItem || !eqItem.serviceIntervalHours || eqItem.alertSent) return;

                                // Compute total cumulative hours across ALL logs for this equipment
                                var totalHours = AppData.getEquipmentLogs()
                                    .filter(function(l) { return l.equipmentId === eqId; })
                                    .reduce(function(sum, l) { return sum + (parseFloat(l.hours) || 0); }, 0);

                                if (totalHours >= eqItem.serviceIntervalHours) {
                                    // Mark alertSent so we don't fire again until after service reset
                                    eqItem.alertSent = true;
                                    AppData.saveEquipment(eqItem);

                                    // Fire alert to backend (creates notification + sends email)
                                    fetch(AppData.API_BASE + '/api/service-alert', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': 'Bearer ' + (AppData.getJwt ? AppData.getJwt() : '')
                                        },
                                        body: JSON.stringify({
                                            equipmentId:   eqId,
                                            equipmentName: eqItem.name,
                                            totalHours:    totalHours,
                                            intervalHours: eqItem.serviceIntervalHours,
                                            supervisorId:  eqItem.supervisorId || null
                                        })
                                    }).then(function(res) { return res.json(); }).then(function(resp) {
                                        if (resp && resp.ok) {
                                            // Sync the new notification into local state
                                            if (AppData.saveNotification && resp.notificationId) {
                                                AppData.saveNotification({
                                                    id:            resp.notificationId,
                                                    type:          'service_due',
                                                    title:         'Service Due: ' + eqItem.name,
                                                    message:       eqItem.name + ' has reached ' + totalHours.toFixed(1) + ' of ' + eqItem.serviceIntervalHours + ' hrs service interval.',
                                                    equipmentId:   eqId,
                                                    equipmentName: eqItem.name,
                                                    resolved:      false,
                                                    emailSent:     resp.emailSent || false,
                                                    createdAt:     new Date().toISOString()
                                                });
                                                if (window.AdminNotifications) AdminNotifications._updateBadge();
                                            }
                                        }
                                    }).catch(function(err) { console.warn('service-alert post failed:', err); });
                                }
                            });
                        }
                    }

                    if (isWizardMode) AppData.setData('worker_wizard_done_' + worker.id, true);
                    clearDraft(); // Clear draft on successful submit
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

        // ── Draft save on app-switch / tab-hide (mobile critical) ────────
        // These fire when the worker switches apps, locks screen, or gets a call.
        // Only save if the form is currently rendered (mode has progressed to complete-entry).
        function _onPageHide() {
            if (document.getElementById('timeEntryForm')) saveDraft();
        }
        document.addEventListener('visibilitychange', _onPageHide);
        window.addEventListener('pagehide', _onPageHide);

        // Cleanup listeners when this module's container is replaced
        var _mutationObs = new MutationObserver(function() {
            if (!container.contains(document.getElementById('timeEntryForm'))) {
                document.removeEventListener('visibilitychange', _onPageHide);
                window.removeEventListener('pagehide', _onPageHide);
                _mutationObs.disconnect();
            }
        });
        _mutationObs.observe(container, { childList: true, subtree: false });

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
                    '<button class="btn-primary btn-tap btn-block" id="teAnother" style="min-height:56px">Log Another Entry</button>' +
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
