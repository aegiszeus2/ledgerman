/**
 * Ledgerman AI Assistant PM
 * Floating chat widget — natural language → AppData actions
 */
window.AIAssistant = (function () {
    'use strict';

    var _history = [];      // [{role, content}]
    var _open = false;
    var _pending = false;
    var _relayUrl = '';     // Cached tunnel URL for transcription (fetched on first open)

    // ── IDs ──────────────────────────────────────────────────────────────────
    function _genId(prefix) {
        return (prefix || 'ai') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }

    // ── Build context snapshot to send with each message ────────────────────
    function _buildContext() {
        var ctx = {};

        // Projects
        try {
            ctx.projects = (AppData.getProjects() || []).map(function (p) {
                return { id: p.id, projectNumber: p.projectNumber, name: p.name, status: p.status,
                         client: p.clientName || p.client, budget: p.budget || 0,
                         startDate: p.startDate, endDate: p.endDate };
            });
        } catch (e) { ctx.projects = []; }

        // Workers (active only)
        try {
            ctx.workers = (AppData.getWorkers() || []).filter(function (w) { return w.status === 'Active'; }).map(function (w) {
                return { id: w.id, name: w.name, role: w.role, payRate: w.payRate, costRate: w.costRate };
            });
        } catch (e) { ctx.workers = []; }

        // Tasks
        try {
            ctx.tasks = (AppData.getTasks() || []).map(function (t) {
                return { id: t.id, title: t.title || t.name, projectId: t.projectId,
                         status: t.status, assigned_to_worker_name: t.assigned_to_worker_name,
                         due_date: t.due_date || t.dueDate };
            });
        } catch (e) { ctx.tasks = []; }

        // Work items
        try {
            ctx.workItems = (AppData.getSubtasks ? AppData.getSubtasks() : []).map(function (wi) {
                return { id: wi.id, name: wi.name, projectId: wi.projectId,
                         unitOfMeasure: wi.unitOfMeasure, budgetedQty: wi.budgetedQty,
                         budgetedCost: wi.budgetedCost };
            });
        } catch (e) { ctx.workItems = []; }

        // Equipment
        try {
            ctx.equipment = (AppData.getEquipment ? AppData.getEquipment() : []).map(function (eq) {
                return { id: eq.id, name: eq.name, type: eq.type,
                         costRate: eq.costRate, chargeOutRate: eq.chargeOutRate,
                         serviceIntervalHours: eq.serviceIntervalHours };
            });
        } catch (e) { ctx.equipment = []; }

        return ctx;
    }

    // ── Execute actions returned by the AI ──────────────────────────────────
    function _executeActions(actions) {
        if (!actions || !actions.length) return;
        var results = [];

        actions.forEach(function (action) {
            var type = action.type;
            var data = action.data || {};

            try {
                if (type === 'create_project') {
                    var proj = Object.assign({
                        id: _genId('proj'),
                        entity_type: 'projects',
                        status: 'Active',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, data);
                    AppData.saveProject(proj);
                    results.push('Created project: ' + proj.name);

                } else if (type === 'update_project') {
                    var existing = AppData.getProject(data.id);
                    if (existing) {
                        AppData.saveProject(Object.assign({}, existing, data, { updated_at: new Date().toISOString() }));
                        results.push('Updated project: ' + (data.name || existing.name));
                    }

                } else if (type === 'create_task') {
                    var task = Object.assign({
                        id: _genId('task'),
                        entity_type: 'tasks',
                        status: 'To Do',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, data);
                    AppData.saveTask(task);
                    results.push('Created task: ' + (task.title || task.name));

                } else if (type === 'update_task') {
                    var exTask = AppData.getTask(data.id);
                    if (exTask) {
                        AppData.saveTask(Object.assign({}, exTask, data, { updated_at: new Date().toISOString() }));
                        results.push('Updated task: ' + (data.title || exTask.title || exTask.name));
                    }

                } else if (type === 'create_worker') {
                    var worker = Object.assign({
                        id: _genId('worker'),
                        entity_type: 'workers',
                        role: 'Worker',
                        status: 'Active',
                        twoFAEnabled: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, data);
                    AppData.saveWorker(worker);
                    results.push('Created worker: ' + worker.name);

                } else if (type === 'update_worker') {
                    var exWorker = AppData.getWorker(data.id);
                    if (exWorker) {
                        AppData.saveWorker(Object.assign({}, exWorker, data, { updated_at: new Date().toISOString() }));
                        results.push('Updated worker: ' + (data.name || exWorker.name));
                    }

                } else if (type === 'create_work_item') {
                    var wi = Object.assign({
                        id: _genId('wi'),
                        entity_type: 'subtasks',
                        changeOrder: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, data);
                    AppData.saveSubtask(wi);
                    results.push('Created work item: ' + wi.name);

                } else if (type === 'update_work_item') {
                    var exWi = AppData.getSubtask ? AppData.getSubtask(data.id) : null;
                    if (exWi) {
                        AppData.saveSubtask(Object.assign({}, exWi, data, { updated_at: new Date().toISOString() }));
                        results.push('Updated work item: ' + (data.name || exWi.name));
                    }

                } else if (type === 'navigate_to') {
                    var mod = data.module;
                    if (mod && window.App && App.navigate) {
                        setTimeout(function () { App.navigate(mod); }, 300);
                        results.push('Navigating to: ' + mod);
                    }

                } else if (type === 'navigate_project') {
                    var pId = data.projectId;
                    var tab = data.tab || 'tasks';
                    if (pId && window.App && App.navigate) {
                        setTimeout(function () { App.navigate('projects', { projectId: pId, tab: tab }); }, 300);
                        results.push('Opening project: ' + (data.projectName || pId));
                    }

                } else if (type === 'create_expense') {
                    var exp = Object.assign({
                        id: _genId('exp'),
                        entity_type: 'expenses',
                        status: 'Pending',
                        date: new Date().toISOString().slice(0, 10),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, data);
                    if (AppData.saveExpense) {
                        AppData.saveExpense(exp);
                        results.push('Created expense: ' + exp.description + ' ($' + exp.amount + ')');
                    } else {
                        results.push('Expense module not available — navigate to Expenses to add manually.');
                    }
                }
            } catch (err) {
                console.error('[AIAssistant] Action failed:', type, err);
                results.push('Failed: ' + type + ' — ' + err.message);
            }
        });

        // Trigger a soft refresh of the current view if records were created/updated
        var didWrite = actions.some(function (a) { return a.type !== 'navigate_to'; });
        if (didWrite && window.App && App.navigate && App.currentView) {
            setTimeout(function () { App.navigate(App.currentView); }, 400);
        }

        return results;
    }

    // ── Fetch relay URL (tunnel) from backend — needed for HTTPS transcription ──
    function _fetchRelayUrl(cb) {
        if (_relayUrl) { cb(_relayUrl); return; }
        var token = sessionStorage.getItem('ledgeman_jwt') || '';
        var apiBase = (window.AppData && AppData.API_BASE) || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://ledgerman-backend.onrender.com');
        fetch(apiBase + '/api/ai/config', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function (r) { return r.json(); })
        .then(function (d) {
            _relayUrl = (d.relay_url || '').replace(/\/$/, '');
            cb(_relayUrl);
        })
        .catch(function () { cb(''); });
    }

    // ── Send message to backend ──────────────────────────────────────────────
    function _send(msgText) {
        if (_pending) return;
        msgText = msgText.trim();
        if (!msgText) return;

        _addMessage('user', msgText);
        _history.push({ role: 'user', content: msgText });
        _clearInput();
        _setThinking(true);
        _pending = true;

        var token = sessionStorage.getItem('ledgeman_jwt') || '';
        var apiBase = (window.AppData && AppData.API_BASE) || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://ledgerman-backend.onrender.com');

        fetch(apiBase + '/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                message: msgText,
                history: _history.slice(-12),
                context: _buildContext()
            })
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            _pending = false;
            _setThinking(false);

            if (data.error) {
                _addMessage('assistant', '⚠️ ' + data.error + (data.detail ? '\n' + data.detail : ''));
                return;
            }

            // Execute actions
            var actionResults = _executeActions(data.actions || []);

            // Build reply
            var reply = data.message || '';
            if (data.needs_info && data.needs_info.length) {
                reply += '\n\n*Still need:* ' + data.needs_info.join(', ');
            }

            _addMessage('assistant', reply, data.actions || []);
            _history.push({ role: 'assistant', content: data.message || '' });
        })
        .catch(function (err) {
            _pending = false;
            _setThinking(false);
            _addMessage('assistant', '⚠️ Connection error: ' + err.message);
        });
    }

    // ── DOM helpers ──────────────────────────────────────────────────────────
    function _addMessage(role, text, actions) {
        var messagesEl = document.getElementById('aiChatMessages');
        if (!messagesEl) return;

        var div = document.createElement('div');
        div.style.cssText = 'margin-bottom:12px;display:flex;flex-direction:column;' +
            (role === 'user' ? 'align-items:flex-end' : 'align-items:flex-start');

        var bubble = document.createElement('div');
        bubble.style.cssText = 'max-width:85%;padding:10px 13px;border-radius:14px;font-size:.875rem;line-height:1.5;white-space:pre-wrap;word-break:break-word;' +
            (role === 'user'
                ? 'background:var(--primary,#1a6b3a);color:#fff;border-bottom-right-radius:4px'
                : 'background:var(--surface2,#f0f4f0);color:var(--text1,#1a1a1a);border-bottom-left-radius:4px');

        // Render markdown-lite: bold, italic
        bubble.innerHTML = _renderText(text);

        div.appendChild(bubble);

        // Action badges
        if (actions && actions.length && role === 'assistant') {
            var badges = document.createElement('div');
            badges.style.cssText = 'margin-top:5px;display:flex;flex-wrap:wrap;gap:4px';
            actions.forEach(function (a) {
                var badge = document.createElement('span');
                var label = {
                    create_project:   '✅ Project created',
                    update_project:   '✏️ Project updated',
                    create_task:      '✅ Task created',
                    update_task:      '✏️ Task updated',
                    create_worker:    '✅ Worker added',
                    update_worker:    '✏️ Worker updated',
                    create_work_item: '✅ Work item created',
                    update_work_item: '✏️ Work item updated',
                    create_expense:   '✅ Expense added',
                    navigate_to:      '→ Navigating',
                    navigate_project: '→ Opening project'
                }[a.type] || a.type;
                badge.textContent = label;
                badge.style.cssText = 'font-size:.72rem;padding:2px 8px;border-radius:10px;background:var(--success-bg,#e6f4ea);color:var(--success,#1a6b3a);font-weight:500';
                badges.appendChild(badge);
            });
            div.appendChild(badges);
        }

        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function _renderText(text) {
        if (!text) return '';
        var esc = Utils && Utils.escapeHtml ? Utils.escapeHtml : function (s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };

        // Process line by line
        var lines = text.split('\n');
        var out = [];
        var inList = false;

        lines.forEach(function (line) {
            var escaped = esc(line);
            // Apply inline formatting
            escaped = escaped
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>');

            // Bullet list items: "- text" or "• text"
            if (/^[-•]\s/.test(line)) {
                if (!inList) { out.push('<ul style="margin:6px 0 6px 16px;padding:0;list-style:disc">'); inList = true; }
                out.push('<li style="margin-bottom:3px">' + escaped.replace(/^[-•]\s+/, '') + '</li>');
            // Numbered list: "1. text"
            } else if (/^\d+\.\s/.test(line)) {
                if (!inList) { out.push('<ol style="margin:6px 0 6px 16px;padding:0">'); inList = true; }
                out.push('<li style="margin-bottom:3px">' + escaped.replace(/^\d+\.\s+/, '') + '</li>');
            } else {
                if (inList) { out.push(inList === 'ol' ? '</ol>' : '</ul>'); inList = false; }
                if (escaped === '') {
                    out.push('<div style="height:6px"></div>');
                } else {
                    out.push('<div>' + escaped + '</div>');
                }
            }
        });

        if (inList) out.push('</ul>');
        return out.join('');
    }

    function _setThinking(on) {
        var el = document.getElementById('aiThinkingIndicator');
        if (el) el.style.display = on ? 'flex' : 'none';
        var btn = document.getElementById('aiSendBtn');
        if (btn) btn.disabled = on;
    }

    function _clearInput() {
        var el = document.getElementById('aiChatInput');
        if (el) { el.value = ''; el.style.height = 'auto'; }
    }

    // ── Build UI ─────────────────────────────────────────────────────────────
    function _buildUI() {
        if (document.getElementById('aiAssistantWidget')) return;

        // FAB button
        var fab = document.createElement('button');
        fab.id = 'aiAssistantFab';
        fab.title = 'AI Assistant PM';
        fab.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span style="font-size:.8rem;font-weight:600;margin-left:5px">AI PM</span>';
        fab.style.cssText = [
            'position:fixed', 'bottom:80px', 'right:24px', 'z-index:9000',
            'display:flex', 'align-items:center', 'padding:10px 16px',
            'border-radius:24px', 'border:none', 'cursor:pointer',
            'background:var(--primary,#1a6b3a)', 'color:#fff',
            'box-shadow:0 4px 16px rgba(0,0,0,.25)', 'font-family:inherit',
            'transition:transform .15s,box-shadow .15s'
        ].join(';');
        fab.addEventListener('mouseenter', function () { fab.style.transform = 'scale(1.05)'; fab.style.boxShadow = '0 6px 24px rgba(0,0,0,.3)'; });
        fab.addEventListener('mouseleave', function () { fab.style.transform = ''; fab.style.boxShadow = '0 4px 16px rgba(0,0,0,.25)'; });
        fab.addEventListener('click', _toggle);
        document.body.appendChild(fab);

        // Chat panel
        var panel = document.createElement('div');
        panel.id = 'aiAssistantWidget';
        panel.style.cssText = [
            'position:fixed', 'bottom:148px', 'right:24px', 'z-index:8999',
            'width:380px', 'max-width:calc(100vw - 32px)',
            'height:520px', 'max-height:calc(100vh - 160px)',
            'display:none', 'flex-direction:column',
            'background:var(--surface,#fff)', 'border-radius:16px',
            'box-shadow:0 8px 40px rgba(0,0,0,.2)', 'border:1px solid var(--border,#dde4e0)',
            'overflow:hidden', 'font-family:inherit'
        ].join(';');

        panel.innerHTML = [
            /* header */
            '<div style="background:var(--primary,#1a6b3a);color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">',
            '  <div style="display:flex;align-items:center;gap:8px">',
            '    <div style="width:8px;height:8px;border-radius:50%;background:#4ade80"></div>',
            '    <strong style="font-size:.95rem">Assistant PM</strong>',
            '  </div>',
            '  <div style="display:flex;gap:8px;align-items:center">',
            '    <button id="aiClearBtn" title="Clear chat" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:.75rem">Clear</button>',
            '    <button id="aiCloseBtn" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1.2rem;line-height:1;padding:2px 4px">&times;</button>',
            '  </div>',
            '</div>',
            /* messages */
            '<div id="aiChatMessages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:0;scroll-behavior:smooth">',
            '</div>',
            /* thinking indicator */
            '<div id="aiThinkingIndicator" style="display:none;padding:0 16px 8px;align-items:center;gap:6px">',
            '  <div style="display:flex;gap:4px;align-items:center">',
            '    <span style="width:7px;height:7px;border-radius:50%;background:var(--primary,#1a6b3a);animation:aiDot 1.2s infinite .0s both;display:inline-block"></span>',
            '    <span style="width:7px;height:7px;border-radius:50%;background:var(--primary,#1a6b3a);animation:aiDot 1.2s infinite .2s both;display:inline-block"></span>',
            '    <span style="width:7px;height:7px;border-radius:50%;background:var(--primary,#1a6b3a);animation:aiDot 1.2s infinite .4s both;display:inline-block"></span>',
            '  </div>',
            '  <span style="font-size:.78rem;color:var(--text2,#6b7280)">Thinking...</span>',
            '</div>',
            /* voice button row */
            '<div style="padding:8px 12px 0;border-top:1px solid var(--border,#dde4e0);flex-shrink:0">',
            '  <button id="aiMicBtn" style="width:100%;padding:9px;border-radius:10px;border:2px solid var(--primary,#1a6b3a);background:#fff;color:var(--primary,#1a6b3a);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;font-size:.85rem;font-weight:600;font-family:inherit;transition:background .15s,color .15s">',
            '    <svg id="aiMicIcon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
            '    <span id="aiMicLabel">Tap to speak</span>',
            '  </button>',
            '</div>',
            /* text input row */
            '<div style="padding:8px 12px 10px;display:flex;gap:6px;align-items:flex-end;flex-shrink:0">',
            '  <textarea id="aiChatInput" rows="1" placeholder="Or type here..." style="flex:1;resize:none;border:1px solid var(--border,#dde4e0);border-radius:10px;padding:9px 12px;font-size:.875rem;font-family:inherit;line-height:1.4;outline:none;max-height:120px;overflow-y:auto;background:var(--surface,#fff);color:var(--text1,#1a1a1a)"></textarea>',
            '  <button id="aiSendBtn" style="flex-shrink:0;width:38px;height:38px;border-radius:50%;background:var(--primary,#1a6b3a);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .15s">',
            '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
            '  </button>',
            '</div>'
        ].join('');

        document.body.appendChild(panel);

        // Inject dot animation keyframes
        if (!document.getElementById('aiAssistantStyles')) {
            var style = document.createElement('style');
            style.id = 'aiAssistantStyles';
            style.textContent = '@keyframes aiDot{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}';
            document.head.appendChild(style);
        }

        // Wire up events
        document.getElementById('aiCloseBtn').addEventListener('click', _close);
        document.getElementById('aiClearBtn').addEventListener('click', _clearChat);
        document.getElementById('aiSendBtn').addEventListener('click', function () {
            var input = document.getElementById('aiChatInput');
            if (input) _send(input.value);
        });

        var inputEl = document.getElementById('aiChatInput');
        inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                _send(inputEl.value);
            }
        });
        inputEl.addEventListener('input', function () {
            inputEl.style.height = 'auto';
            inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
        });

        // ── Mic / voice-to-text ──────────────────────────────────────────────
        var _mediaRecorder = null;
        var _audioChunks = [];
        var _recording = false;

        var micBtn = document.getElementById('aiMicBtn');
        var micIcon = document.getElementById('aiMicIcon');

        micBtn.addEventListener('click', function () {
            if (_recording) {
                // Stop recording
                _mediaRecorder.stop();
            } else {
                // Start recording
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    _addMessage('assistant', '⚠️ Microphone not supported in this browser.');
                    return;
                }
                navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
                    _audioChunks = [];
                    _mediaRecorder = new MediaRecorder(stream);

                    _mediaRecorder.ondataavailable = function (e) {
                        if (e.data && e.data.size > 0) _audioChunks.push(e.data);
                    };

                    _mediaRecorder.onstop = function () {
                        // Stop all tracks to release mic
                        stream.getTracks().forEach(function (t) { t.stop(); });

                        // Reset mic button appearance
                        _recording = false;
                        micBtn.style.background = '#fff';
                        micBtn.style.color = 'var(--primary,#1a6b3a)';
                        micBtn.style.border = '2px solid var(--primary,#1a6b3a)';
                        micBtn.title = 'Voice input';
                        var micLbl = document.getElementById('aiMicLabel');
                        if (micLbl) micLbl.textContent = 'Tap to speak';

                        // Show transcribing state
                        var inp = document.getElementById('aiChatInput');
                        if (inp) inp.placeholder = 'Transcribing...';

                        var mimeType = _mediaRecorder.mimeType || 'audio/webm';
                        var blob = new Blob(_audioChunks, { type: mimeType });

                        _fetchRelayUrl(function (relayUrl) {
                        var transcribeUrl = relayUrl
                            ? relayUrl + '/transcribe'
                            : 'http://localhost:9999/transcribe';

                        fetch(transcribeUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': mimeType },
                            body: blob
                        })
                        .then(function (r) { return r.json(); })
                        .then(function (d) {
                            if (inp) inp.placeholder = 'Type or speak...';
                            if (d.transcript) {
                                if (inp) {
                                    inp.value = d.transcript;
                                    inp.style.height = 'auto';
                                    inp.style.height = Math.min(inp.scrollHeight, 120) + 'px';
                                    inp.focus();
                                }
                            } else {
                                _addMessage('assistant', '⚠️ Could not transcribe audio. Try again.');
                            }
                        })
                        .catch(function () {
                            if (inp) inp.placeholder = 'Type or speak...';
                            _addMessage('assistant', '⚠️ Transcription service unreachable.');
                        });
                        }); // end _fetchRelayUrl
                    };

                    _mediaRecorder.start();
                    _recording = true;

                    // Visual: mic button turns red while recording
                    micBtn.style.background = '#dc2626';
                    micBtn.style.color = '#fff';
                    micBtn.style.border = '2px solid #dc2626';
                    micBtn.title = 'Tap to stop recording';
                    var micLbl2 = document.getElementById('aiMicLabel');
                    if (micLbl2) micLbl2.textContent = 'Recording… tap to stop';

                }).catch(function (err) {
                    _addMessage('assistant', '⚠️ Mic access denied: ' + err.message);
                });
            }
        });

        // Dynamic context-aware welcome
        (function () {
            var lines = ['Hi! I\'m your Assistant PM. Here\'s what I can see right now:\n'];
            try {
                var projs = (AppData.getProjects() || []).filter(function(p){ return p.status === 'Active'; });
                if (projs.length) {
                    lines.push('**Active projects (' + projs.length + '):** ' + projs.slice(0, 3).map(function(p){ return p.name; }).join(', ') + (projs.length > 3 ? '…' : ''));
                }
                var workers = (AppData.getWorkers() || []).filter(function(w){ return w.status === 'Active'; });
                if (workers.length) {
                    lines.push('**Workers:** ' + workers.length + ' active');
                }
                var tasks = (AppData.getTasks() || []);
                var openTasks = tasks.filter(function(t){ return (t.status||'').toLowerCase() !== 'done' && (t.status||'').toLowerCase() !== 'completed'; });
                var today = new Date().toISOString().slice(0,10);
                var overdue = openTasks.filter(function(t){ return (t.due_date||t.dueDate||'') < today && (t.due_date||t.dueDate||''); });
                if (overdue.length) {
                    lines.push('⚠️ **' + overdue.length + ' overdue task(s)** — say "show overdue tasks" to see them');
                } else if (openTasks.length) {
                    lines.push('**Open tasks:** ' + openTasks.length);
                }
            } catch(e) {}

            lines.push('\nTell me what you need or ask a question — for example:');
            try {
                var ps = (AppData.getProjects() || []).filter(function(p){ return p.status==='Active'; });
                var ws = (AppData.getWorkers() || []).filter(function(w){ return w.status==='Active'; });
                if (ps.length) lines.push('- "How much have I spent on ' + ps[0].name + '?"');
                if (ps.length) lines.push('- "What\'s the budget remaining on ' + ps[0].name + '?"');
                if (ws.length && ps.length) lines.push('- "Assign a task to ' + ws[0].name + ' on ' + ps[0].name + '"');
            } catch(e) {}
            lines.push('- "Show me all open tasks"');
            lines.push('- "Create a new project"');

            _addMessage('assistant', lines.join('\n'));
        })();
    }

    // ── Panel controls ───────────────────────────────────────────────────────
    function _toggle() {
        _open ? _close() : _open_();
    }

    function _open_() {
        _open = true;
        _buildUI();
        var panel = document.getElementById('aiAssistantWidget');
        if (panel) { panel.style.display = 'flex'; setTimeout(function () { var inp = document.getElementById('aiChatInput'); if (inp) inp.focus(); }, 100); }
    }

    function _close() {
        _open = false;
        var panel = document.getElementById('aiAssistantWidget');
        if (panel) panel.style.display = 'none';
    }

    function _clearChat() {
        _history = [];
        var messagesEl = document.getElementById('aiChatMessages');
        if (messagesEl) messagesEl.innerHTML = '';
        _addMessage('assistant', 'Chat cleared. What would you like to do?');
    }

    // ── Public API ───────────────────────────────────────────────────────────
    return {
        init: function () {
            // Build the FAB immediately; panel built on first open
            var fab = document.createElement('button');
            fab.id = 'aiAssistantFab';
            fab.title = 'AI Assistant PM';
            fab.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span style="font-size:.8rem;font-weight:600;margin-left:5px">AI PM</span>';
            fab.style.cssText = [
                'position:fixed', 'bottom:80px', 'right:24px', 'z-index:9000',
                'display:flex', 'align-items:center', 'padding:10px 16px',
                'border-radius:24px', 'border:none', 'cursor:pointer',
                'background:var(--primary,#1a6b3a)', 'color:#fff',
                'box-shadow:0 4px 16px rgba(0,0,0,.25)', 'font-family:inherit',
                'transition:transform .15s,box-shadow .15s'
            ].join(';');
            fab.addEventListener('mouseenter', function () { fab.style.transform = 'scale(1.05)'; fab.style.boxShadow = '0 6px 24px rgba(0,0,0,.3)'; });
            fab.addEventListener('mouseleave', function () { fab.style.transform = ''; fab.style.boxShadow = '0 4px 16px rgba(0,0,0,.25)'; });
            fab.addEventListener('click', _toggle);
            document.body.appendChild(fab);
        },
        open: _open_,
        close: _close,
        send: _send
    };
}());

// Auto-init — show FAB only for admin, hide/remove for workers
(function () {
    function _removeFab() {
        var fab = document.getElementById('aiAssistantFab');
        if (fab) fab.remove();
        var panel = document.getElementById('aiAssistantWidget');
        if (panel) panel.remove();
    }

    function _checkUser() {
        var user = window.App && App.currentUser;

        // Not logged in yet — keep waiting
        if (!user) {
            setTimeout(_checkUser, 1500);
            return;
        }

        // Worker portal — remove button and stop
        if (user.type === 'worker') {
            _removeFab();
            // Keep polling in case user logs out and admin logs back in
            setTimeout(_checkUser, 3000);
            return;
        }

        // Admin — check module flag
        var modules = window.AppData && AppData.getSettings ? AppData.getSettings().modules : null;
        if (modules && modules['ai_assistant'] === false) {
            _removeFab();
            setTimeout(_checkUser, 3000);
            return;
        }

        // Admin with module enabled — show FAB
        if (window.AIAssistant && !document.getElementById('aiAssistantFab')) {
            AIAssistant.init();
        }

        // Keep polling to catch logout → worker login
        setTimeout(_checkUser, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(_checkUser, 1500); });
    } else {
        setTimeout(_checkUser, 1500);
    }
}());
