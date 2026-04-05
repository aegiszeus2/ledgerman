/**
 * Ledgerman AI Assistant PM
 * Floating chat widget — natural language → AppData actions
 */
window.AIAssistant = (function () {
    'use strict';

    var _history = [];      // [{role, content}]
    var _open = false;
    var _pending = false;

    // ── IDs ──────────────────────────────────────────────────────────────────
    function _genId(prefix) {
        return (prefix || 'ai') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }

    // ── Build context snapshot to send with each message ────────────────────
    function _buildContext() {
        var ctx = {};
        try {
            ctx.projects = (AppData.getProjects() || []).map(function (p) {
                return { id: p.id, name: p.name, status: p.status, client: p.client };
            });
        } catch (e) { ctx.projects = []; }
        try {
            ctx.workers = (AppData.getWorkers() || []).filter(function (w) { return w.status === 'Active'; }).map(function (w) {
                return { id: w.id, name: w.name, role: w.role, payRate: w.payRate, costRate: w.costRate };
            });
        } catch (e) { ctx.workers = []; }
        try {
            ctx.tasks = (AppData.getTasks() || []).map(function (t) {
                return { id: t.id, title: t.title || t.name, projectId: t.projectId, status: t.status, assigned_to_worker_name: t.assigned_to_worker_name };
            });
        } catch (e) { ctx.tasks = []; }
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

                } else if (type === 'navigate_to') {
                    var mod = data.module;
                    if (mod && window.App && App.navigate) {
                        setTimeout(function () { App.navigate(mod); }, 300);
                        results.push('Navigating to: ' + mod);
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
        var apiBase = AppData.API_BASE || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://ledgerman-backend.onrender.com');

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
                    create_project: '✅ Project created',
                    update_project: '✏️ Project updated',
                    create_task: '✅ Task created',
                    update_task: '✏️ Task updated',
                    create_worker: '✅ Worker added',
                    update_worker: '✏️ Worker updated',
                    create_work_item: '✅ Work item created',
                    navigate_to: '→ Navigating'
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
        return esc(text)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>');
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
            'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9000',
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
            'position:fixed', 'bottom:80px', 'right:24px', 'z-index:8999',
            'width:380px', 'max-width:calc(100vw - 32px)',
            'height:520px', 'max-height:calc(100vh - 100px)',
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
            /* input row */
            '<div style="padding:10px 12px;border-top:1px solid var(--border,#dde4e0);display:flex;gap:8px;align-items:flex-end;flex-shrink:0">',
            '  <textarea id="aiChatInput" rows="1" placeholder="Tell me what to do..." style="flex:1;resize:none;border:1px solid var(--border,#dde4e0);border-radius:10px;padding:9px 12px;font-size:.875rem;font-family:inherit;line-height:1.4;outline:none;max-height:120px;overflow-y:auto;background:var(--surface,#fff);color:var(--text1,#1a1a1a)"></textarea>',
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

        // Welcome message
        _addMessage('assistant', 'Hi! I\'m your Assistant PM. Tell me what you need:\n\n• "Create a project for Magna west entrance fence, contract value $85,000"\n• "Assign the site inspection task to Marco"\n• "Add a work item: clear and grub, 2500 m2, budgeted $18,000"\n• "Show me the Gantt chart"');
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
                'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9000',
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

// Auto-init after DOM ready — listen for login success via App.currentUser
(function () {
    function _maybeInit() {
        // Only show for admin users (not worker portal)
        var user = window.App && App.currentUser;
        if (!user || user.type === 'worker') {
            // Not logged in yet — retry after a short delay
            setTimeout(_maybeInit, 2000);
            return;
        }
        // Admin logged in — show the FAB
        if (window.AIAssistant && !document.getElementById('aiAssistantFab')) {
            AIAssistant.init();
        }
    }
    // Start checking after app has had time to init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(_maybeInit, 1500); });
    } else {
        setTimeout(_maybeInit, 1500);
    }
}());
