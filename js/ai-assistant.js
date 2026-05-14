/**
 * Ledgerman AI Assistant PM  (Phase 2 — hardened, complete)
 * ──────────────────────────────────────────────────────────
 * AIAssistant       — admin floating chat widget
 * WorkerAIAssistant — field-worker floating chat widget (limited scope)
 *
 * Both are auto-initialised based on user role + module permissions.
 * Chat history is persisted in sessionStorage across page navigations.
 */

// ── Shared utilities ──────────────────────────────────────────────────────────

(function () {
    'use strict';

    /** Lightweight markdown renderer shared by both widgets. */
    window._aiRenderText = function (text) {
        if (!text) return '';
        var esc = window.Utils && Utils.escapeHtml
            ? Utils.escapeHtml
            : function (s) {
                return String(s)
                    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
            };

        var lines  = text.split('\n');
        var out    = [];
        var inList = false;
        var listType = '';

        function closeList() {
            if (inList) { out.push(listType === 'ol' ? '</ol>' : '</ul>'); inList = false; listType = ''; }
        }

        lines.forEach(function (line) {
            var escaped = esc(line)
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+?)\*/g,  '<em>$1</em>')
                .replace(/`([^`]+?)`/g,    '<code style="background:#f0f4f0;padding:1px 4px;border-radius:3px;font-size:.85em">$1</code>');

            if (/^[-•]\s/.test(line)) {
                if (!inList || listType !== 'ul') { closeList(); out.push('<ul style="margin:5px 0 5px 16px;padding:0;list-style:disc">'); inList = true; listType = 'ul'; }
                out.push('<li style="margin-bottom:2px">' + escaped.replace(/^[-•]\s+/, '') + '</li>');
            } else if (/^\d+\.\s/.test(line)) {
                if (!inList || listType !== 'ol') { closeList(); out.push('<ol style="margin:5px 0 5px 16px;padding:0">'); inList = true; listType = 'ol'; }
                out.push('<li style="margin-bottom:2px">' + escaped.replace(/^\d+\.\s+/, '') + '</li>');
            } else {
                closeList();
                if (escaped.trim() === '') {
                    out.push('<div style="height:5px"></div>');
                } else if (/^#{1,3}\s/.test(line)) {
                    var lvl   = (line.match(/^(#{1,3})/) || ['','#'])[1].length;
                    var sizes = ['1rem','0.95rem','0.9rem'];
                    out.push('<div style="font-weight:700;font-size:' + (sizes[lvl-1]||'0.9rem') + ';margin:6px 0 2px">'
                             + escaped.replace(/^#{1,3}\s+/, '') + '</div>');
                } else {
                    out.push('<div>' + escaped + '</div>');
                }
            }
        });
        closeList();
        return out.join('');
    };

    /** Map HTTP status / error type to a human-friendly message. */
    window._aiErrorMessage = function (status, errorText) {
        if (status === 401) return '🔒 Session expired — please log in again.';
        if (status === 403) {
            if (errorText && errorText.includes('module_disabled'))
                return '⚠️ AI assistant is not enabled for your account. Contact your administrator.';
            return '⚠️ Access denied.';
        }
        if (status === 429) return '⏳ Too many requests — wait a moment and try again.';
        if (status === 504 || (errorText && errorText.toLowerCase().includes('timeout')))
            return '⏱️ Request timed out — try a shorter question.';
        if (status === 502 || status === 503)
            return '🔧 AI service temporarily unavailable — your questions still work, but responses may be limited.';
        if (status === 0 || (errorText && errorText.toLowerCase().includes('network')))
            return '📡 No connection — check your internet and try again.';
        return '⚠️ ' + (errorText || 'Something went wrong. Please try again.');
    };

    /** Inject shared keyframe animation once. */
    window._aiInjectStyles = function () {
        if (document.getElementById('aiAssistantStyles')) return;
        var s = document.createElement('style');
        s.id = 'aiAssistantStyles';
        s.textContent = [
            '@keyframes aiDot{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}',
            '@keyframes aiFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
        ].join('');
        document.head.appendChild(s);
    };
}());


// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN AI PROJECT MANAGER
// ══════════════════════════════════════════════════════════════════════════════

window.AIAssistant = (function () {
    'use strict';

    var STORAGE_KEY = 'ledgerman_ai_history';
    var MAX_HISTORY = 20;   // messages kept in sessionStorage
    var SEND_HISTORY = 12;  // messages sent to backend per request

    var _history = [];
    var _open    = false;
    var _pending = false;
    var _relayUrl = null;   // null = not fetched yet; '' = unavailable

    // ── ID generator ──────────────────────────────────────────────────────────
    function _genId(prefix) {
        return (prefix || 'ai') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }

    // ── Session storage persistence ───────────────────────────────────────────
    function _loadHistory() {
        try {
            var raw = sessionStorage.getItem(STORAGE_KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {}
        return [];
    }

    function _saveHistory() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(_history.slice(-MAX_HISTORY)));
        } catch (e) {}
    }

    function _clearStoredHistory() {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }

    // ── Build context snapshot ────────────────────────────────────────────────
    function _buildContext() {
        var ctx   = {};
        var today = new Date().toISOString().slice(0, 10);

        try {
            ctx.projects = (AppData.getProjects() || []).map(function (p) {
                return {
                    id:            p.id,
                    projectNumber: p.projectNumber,
                    name:          p.name,
                    status:        p.status,
                    client:        p.clientName || p.client,
                    budget:        p.budget || 0,
                    startDate:     p.startDate,
                    endDate:       p.endDate,
                };
            });
        } catch (e) { ctx.projects = []; }

        try {
            ctx.workers = (AppData.getWorkers() || [])
                .filter(function (w) { return w.status === 'Active'; })
                .map(function (w) {
                    return { id: w.id, name: w.name, role: w.role };
                    // NOTE: payRate/costRate intentionally omitted from context sent to Claude
                    // to minimise accidental financial data in AI logs
                });
        } catch (e) { ctx.workers = []; }

        try {
            ctx.tasks = (AppData.getTasks() || []).map(function (t) {
                var due = t.due_date || t.dueDate || '';
                return {
                    id:                      t.id,
                    title:                   t.title || t.name,
                    projectId:               t.projectId,
                    status:                  t.status,
                    assigned_to_worker_name: t.assigned_to_worker_name,
                    due_date:                due,
                    overdue:                 due && due < today && (t.status||'').toLowerCase() !== 'done',
                };
            });
        } catch (e) { ctx.tasks = []; }

        try {
            ctx.workItems = (AppData.getSubtasks ? AppData.getSubtasks() : []).map(function (wi) {
                return {
                    id:            wi.id,
                    name:          wi.name,
                    projectId:     wi.projectId,
                    unitOfMeasure: wi.unitOfMeasure,
                    budgetedQty:   wi.budgetedQty,
                    budgetedCost:  wi.budgetedCost,
                };
            });
        } catch (e) { ctx.workItems = []; }

        try {
            ctx.equipment = (AppData.getEquipment ? AppData.getEquipment() : []).map(function (eq) {
                return { id: eq.id, name: eq.name, type: eq.type };
                // costRate/chargeOutRate intentionally omitted from Claude context
            });
        } catch (e) { ctx.equipment = []; }

        return ctx;
    }

    // ── Execute structured actions returned by AI ─────────────────────────────
    function _executeActions(actions) {
        if (!actions || !actions.length) return [];
        var results = [];

        actions.forEach(function (action) {
            var type = action.type;
            var data = action.data || {};
            try {
                if (type === 'create_project') {
                    var proj = Object.assign({
                        id: _genId('proj'), entity_type: 'projects', status: 'Active',
                        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
                    }, data);
                    AppData.saveProject(proj);
                    results.push({ type: type, label: '✅ Project created: ' + proj.name });

                } else if (type === 'update_project') {
                    var ex = AppData.getProject(data.id);
                    if (ex) {
                        AppData.saveProject(Object.assign({}, ex, data, { updated_at: new Date().toISOString() }));
                        results.push({ type: type, label: '✏️ Project updated: ' + (data.name || ex.name) });
                    }

                } else if (type === 'create_task') {
                    var task = Object.assign({
                        id: _genId('task'), entity_type: 'tasks', status: 'To Do',
                        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
                    }, data);
                    AppData.saveTask(task);
                    results.push({ type: type, label: '✅ Task created: ' + (task.title || task.name) });

                } else if (type === 'update_task') {
                    var exT = AppData.getTask(data.id);
                    if (exT) {
                        AppData.saveTask(Object.assign({}, exT, data, { updated_at: new Date().toISOString() }));
                        results.push({ type: type, label: '✏️ Task updated: ' + (data.title || exT.title || exT.name) });
                    }

                } else if (type === 'create_worker') {
                    var worker = Object.assign({
                        id: _genId('wkr'), entity_type: 'workers', role: 'Worker',
                        status: 'Active', twoFAEnabled: false,
                        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
                    }, data);
                    AppData.saveWorker(worker);
                    results.push({ type: type, label: '✅ Worker added: ' + worker.name });

                } else if (type === 'update_worker') {
                    var exW = AppData.getWorker(data.id);
                    if (exW) {
                        AppData.saveWorker(Object.assign({}, exW, data, { updated_at: new Date().toISOString() }));
                        results.push({ type: type, label: '✏️ Worker updated: ' + (data.name || exW.name) });
                    }

                } else if (type === 'create_work_item') {
                    var wi = Object.assign({
                        id: _genId('wi'), entity_type: 'subtasks', changeOrder: false,
                        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
                    }, data);
                    AppData.saveSubtask(wi);
                    results.push({ type: type, label: '✅ Work item: ' + wi.name });

                } else if (type === 'update_work_item') {
                    var exWi = AppData.getSubtask ? AppData.getSubtask(data.id) : null;
                    if (exWi) {
                        AppData.saveSubtask(Object.assign({}, exWi, data, { updated_at: new Date().toISOString() }));
                        results.push({ type: type, label: '✏️ Work item updated' });
                    }

                } else if (type === 'create_expense') {
                    if (AppData.saveExpense) {
                        var exp = Object.assign({
                            id: _genId('exp'), entity_type: 'expenses', status: 'Pending',
                            date: new Date().toISOString().slice(0, 10),
                            created_at: new Date().toISOString(), updated_at: new Date().toISOString()
                        }, data);
                        AppData.saveExpense(exp);
                        results.push({ type: type, label: '✅ Expense added: $' + (exp.amount || '?') });
                    }

                } else if (type === 'navigate_to') {
                    var mod = data.module;
                    if (mod && window.App && App.navigate) {
                        setTimeout(function () { App.navigate(mod); }, 300);
                        results.push({ type: type, label: '→ ' + mod });
                    }

                } else if (type === 'navigate_project') {
                    var pId = data.projectId, tab = data.tab || 'tasks';
                    if (pId && window.App && App.navigate) {
                        setTimeout(function () { App.navigate('projects', { projectId: pId, tab: tab }); }, 300);
                        results.push({ type: type, label: '→ ' + (data.projectName || pId) });
                    }
                }
            } catch (err) {
                console.error('[AIAssistant] Action failed:', type, err);
                results.push({ type: type, label: '⚠️ Failed: ' + type });
            }
        });

        // Trigger soft view refresh after any data write
        var didWrite = actions.some(function (a) {
            return a.type !== 'navigate_to' && a.type !== 'navigate_project';
        });
        if (didWrite && window.App && App.navigate && App.currentView) {
            setTimeout(function () { App.navigate(App.currentView); }, 500);
        }

        return results;
    }

    // ── Fetch relay URL from backend ──────────────────────────────────────────
    function _fetchRelayUrl(cb) {
        if (_relayUrl !== null) { cb(_relayUrl); return; }
        var token   = sessionStorage.getItem('ledgeman_jwt') || '';
        var apiBase = (window.AppData && AppData.API_BASE) ||
            (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://app.ledgerman.org');

        fetch(apiBase + '/api/ai/config', {
            headers: { 'Authorization': 'Bearer ' + token },
            signal:  AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
        })
        .then(function (r) { return r.json(); })
        .then(function (d) { _relayUrl = (d.relay_url || '').replace(/\/$/, ''); cb(_relayUrl); })
        .catch(function () { _relayUrl = ''; cb(''); });
    }

    // ── Send message with retry + structured error handling ───────────────────
    function _send(msgText, _retryCount) {
        if (_pending) return;
        msgText = (msgText || '').trim();
        if (!msgText) return;
        _retryCount = _retryCount || 0;

        _addMessage('user', msgText);
        _history.push({ role: 'user', content: msgText });
        _saveHistory();
        _clearInput();
        _setThinking(true);
        _pending = true;

        var token   = sessionStorage.getItem('ledgeman_jwt') || '';
        var apiBase = (window.AppData && AppData.API_BASE) ||
            (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://app.ledgerman.org');

        var ctrl    = new AbortController();
        var timeout = setTimeout(function () { ctrl.abort(); }, 35000);

        fetch(apiBase + '/api/ai/chat', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body:    JSON.stringify({
                message: msgText,
                history: _history.slice(-(SEND_HISTORY + 1), -1),  // exclude the just-pushed user msg
                context: _buildContext(),
            }),
            signal:  ctrl.signal,
        })
        .then(function (res) {
            clearTimeout(timeout);
            var status = res.status;
            return res.json().then(function (data) { return { status: status, data: data }; });
        })
        .then(function (r) {
            _pending = false;
            _setThinking(false);

            if (r.status >= 400) {
                var errTxt = r.data.error || '';
                var code   = r.data.code  || '';
                // Retry once on 502/503 (transient provider errors)
                if ((r.status === 502 || r.status === 503) && _retryCount === 0) {
                    _history.pop(); // remove the user message we just added
                    _saveHistory();
                    _removeLastUserMessage();
                    _pending = false;
                    _setThinking(false);
                    setTimeout(function () { _send(msgText, 1); }, 1500);
                    _addMessage('assistant', '⏳ Retrying…');
                    return;
                }
                _addMessage('assistant', window._aiErrorMessage(r.status, errTxt + ' ' + code));
                return;
            }

            var data = r.data;
            var actionResults = _executeActions(data.actions || []);

            var reply = data.message || '';
            if (data.needs_info && data.needs_info.length) {
                reply += '\n\n*Still need:* ' + data.needs_info.join(', ');
            }

            _addMessage('assistant', reply, actionResults);
            _history.push({ role: 'assistant', content: data.message || '' });
            _saveHistory();
        })
        .catch(function (err) {
            clearTimeout(timeout);
            _pending = false;
            _setThinking(false);

            // AbortController fires 'AbortError'
            if (err.name === 'AbortError') {
                if (_retryCount === 0) {
                    _history.pop();
                    _saveHistory();
                    _removeLastUserMessage();
                    setTimeout(function () { _send(msgText, 1); }, 1000);
                    _addMessage('assistant', '⏳ Slow response — retrying…');
                    return;
                }
                _addMessage('assistant', window._aiErrorMessage(504, 'timeout'));
                return;
            }

            var isNetwork = err.message && (
                err.message.toLowerCase().includes('failed to fetch') ||
                err.message.toLowerCase().includes('network')
            );
            _addMessage('assistant', window._aiErrorMessage(isNetwork ? 0 : 502, err.message));
        });
    }

    // ── DOM helpers ───────────────────────────────────────────────────────────
    function _addMessage(role, text, actionResults) {
        var el = document.getElementById('aiChatMessages');
        if (!el) return;

        var div = document.createElement('div');
        div.style.cssText = 'margin-bottom:12px;display:flex;flex-direction:column;animation:aiFadeIn .2s ease;' +
            (role === 'user' ? 'align-items:flex-end' : 'align-items:flex-start');

        var bubble = document.createElement('div');
        bubble.style.cssText = 'max-width:86%;padding:10px 13px;border-radius:14px;font-size:.875rem;line-height:1.5;word-break:break-word;' +
            (role === 'user'
                ? 'background:var(--primary,#1a6b3a);color:#fff;border-bottom-right-radius:4px'
                : 'background:var(--surface2,#f0f4f0);color:var(--text1,#1a1a1a);border-bottom-left-radius:4px');
        bubble.innerHTML = window._aiRenderText(text);
        div.appendChild(bubble);

        // Action badges
        if (actionResults && actionResults.length && role === 'assistant') {
            var badges = document.createElement('div');
            badges.style.cssText = 'margin-top:4px;display:flex;flex-wrap:wrap;gap:4px';
            actionResults.forEach(function (r) {
                var badge = document.createElement('span');
                badge.textContent = r.label;
                badge.style.cssText = 'font-size:.7rem;padding:2px 7px;border-radius:10px;background:var(--success-bg,#e6f4ea);color:var(--success,#1a6b3a);font-weight:500';
                badges.appendChild(badge);
            });
            div.appendChild(badges);
        }

        el.appendChild(div);
        el.scrollTop = el.scrollHeight;
    }

    function _removeLastUserMessage() {
        var el = document.getElementById('aiChatMessages');
        if (!el) return;
        // Remove the last child with user alignment
        var children = el.children;
        for (var i = children.length - 1; i >= 0; i--) {
            if (children[i].style.alignItems === 'flex-end') {
                el.removeChild(children[i]);
                break;
            }
        }
    }

    function _setThinking(on) {
        var el  = document.getElementById('aiThinkingIndicator');
        var btn = document.getElementById('aiSendBtn');
        if (el)  el.style.display = on ? 'flex' : 'none';
        if (btn) btn.disabled = on;
    }

    function _clearInput() {
        var el = document.getElementById('aiChatInput');
        if (el) { el.value = ''; el.style.height = 'auto'; }
    }

    // ── Build UI panel ────────────────────────────────────────────────────────
    function _buildUI() {
        if (document.getElementById('aiAssistantWidget')) return;
        window._aiInjectStyles();

        // Chat panel
        var panel = document.createElement('div');
        panel.id  = 'aiAssistantWidget';
        panel.style.cssText = [
            'position:fixed', 'bottom:148px', 'right:24px', 'z-index:8999',
            'width:380px', 'max-width:calc(100vw - 32px)',
            'height:520px', 'max-height:calc(100vh - 160px)',
            'display:none', 'flex-direction:column',
            'background:var(--surface,#fff)', 'border-radius:16px',
            'box-shadow:0 8px 40px rgba(0,0,0,.2)', 'border:1px solid var(--border,#dde4e0)',
            'overflow:hidden', 'font-family:inherit',
        ].join(';');

        panel.innerHTML = [
            // Header
            '<div style="background:var(--primary,#1a6b3a);color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">',
            '  <div style="display:flex;align-items:center;gap:8px">',
            '    <div style="width:8px;height:8px;border-radius:50%;background:#4ade80"></div>',
            '    <strong style="font-size:.95rem">Assistant PM</strong>',
            '  </div>',
            '  <div style="display:flex;gap:8px;align-items:center">',
            '    <button id="aiClearBtn" title="Clear chat" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:.75rem;font-family:inherit">Clear</button>',
            '    <button id="aiCloseBtn" title="Close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1.3rem;line-height:1;padding:2px 4px">&times;</button>',
            '  </div>',
            '</div>',
            // Messages
            '<div id="aiChatMessages" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;scroll-behavior:smooth;-webkit-overflow-scrolling:touch"></div>',
            // Thinking indicator
            '<div id="aiThinkingIndicator" style="display:none;padding:4px 16px 8px;align-items:center;gap:6px;flex-shrink:0">',
            '  <div style="display:flex;gap:4px;align-items:center">',
            '    <span style="width:6px;height:6px;border-radius:50%;background:var(--primary,#1a6b3a);animation:aiDot 1.2s infinite .0s both;display:inline-block"></span>',
            '    <span style="width:6px;height:6px;border-radius:50%;background:var(--primary,#1a6b3a);animation:aiDot 1.2s infinite .2s both;display:inline-block"></span>',
            '    <span style="width:6px;height:6px;border-radius:50%;background:var(--primary,#1a6b3a);animation:aiDot 1.2s infinite .4s both;display:inline-block"></span>',
            '  </div>',
            '  <span style="font-size:.78rem;color:var(--text2,#6b7280)">Thinking…</span>',
            '</div>',
            // Mic button
            '<div style="padding:8px 12px 0;border-top:1px solid var(--border,#dde4e0);flex-shrink:0">',
            '  <button id="aiMicBtn" style="width:100%;padding:9px;border-radius:10px;border:2px solid var(--primary,#1a6b3a);background:var(--surface,#fff);color:var(--primary,#1a6b3a);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;font-size:.85rem;font-weight:600;font-family:inherit;transition:background .15s,color .15s">',
            '    <svg id="aiMicIcon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
            '    <span id="aiMicLabel">Tap to speak</span>',
            '  </button>',
            '</div>',
            // Text input
            '<div style="padding:8px 12px 10px;display:flex;gap:6px;align-items:flex-end;flex-shrink:0">',
            '  <textarea id="aiChatInput" rows="1" placeholder="Or type here…"',
            '    style="flex:1;resize:none;border:1px solid var(--border,#dde4e0);border-radius:10px;',
            '    padding:9px 12px;font-size:.875rem;font-family:inherit;line-height:1.4;outline:none;',
            '    max-height:120px;overflow-y:auto;background:var(--surface,#fff);color:var(--text1,#1a1a1a);',
            '    -webkit-appearance:none"></textarea>',
            '  <button id="aiSendBtn" style="flex-shrink:0;width:38px;height:38px;border-radius:50%;',
            '    background:var(--primary,#1a6b3a);border:none;color:#fff;cursor:pointer;',
            '    display:flex;align-items:center;justify-content:center;transition:opacity .15s">',
            '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
            '  </button>',
            '</div>',
        ].join('');

        document.body.appendChild(panel);

        // ── Wire up text input ──────────────────────────────────────────────
        var inputEl = document.getElementById('aiChatInput');
        document.getElementById('aiCloseBtn').addEventListener('click', _close);
        document.getElementById('aiClearBtn').addEventListener('click', _clearChat);
        document.getElementById('aiSendBtn').addEventListener('click', function () {
            if (inputEl) _send(inputEl.value);
        });
        inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _send(inputEl.value); }
        });
        inputEl.addEventListener('input', function () {
            inputEl.style.height = 'auto';
            inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
        });

        // ── Mic / voice-to-text ─────────────────────────────────────────────
        var _mr = null, _chunks = [], _recording = false;
        var micBtn = document.getElementById('aiMicBtn');
        var micLbl = document.getElementById('aiMicLabel');

        micBtn.addEventListener('click', function () {
            if (_recording) { _mr.stop(); return; }
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                _addMessage('assistant', '⚠️ Microphone not supported in this browser.');
                return;
            }
            navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
                _chunks = [];
                _mr = new MediaRecorder(stream);
                _mr.ondataavailable = function (e) { if (e.data && e.data.size > 0) _chunks.push(e.data); };
                _mr.onstop = function () {
                    stream.getTracks().forEach(function (t) { t.stop(); });
                    _recording = false;
                    micBtn.style.cssText = micBtn.style.cssText.replace(/background:[^;]+;/g, '').replace(/color:[^;]+;/g, '');
                    micBtn.style.background = 'var(--surface,#fff)';
                    micBtn.style.color = 'var(--primary,#1a6b3a)';
                    micLbl.textContent = 'Tap to speak';
                    inputEl.placeholder = 'Transcribing…';

                    var mime = _mr.mimeType || 'audio/webm';
                    var blob = new Blob(_chunks, { type: mime });

                    _fetchRelayUrl(function (relayUrl) {
                        var url = relayUrl ? relayUrl + '/transcribe' : 'http://localhost:9999/transcribe';
                        fetch(url, { method: 'POST', headers: { 'Content-Type': mime }, body: blob })
                        .then(function (r) { return r.json(); })
                        .then(function (d) {
                            inputEl.placeholder = 'Or type here…';
                            if (d.transcript) {
                                inputEl.value = d.transcript;
                                inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
                                inputEl.focus();
                            } else {
                                _addMessage('assistant', '⚠️ Could not transcribe. Please type your message.');
                            }
                        })
                        .catch(function () {
                            inputEl.placeholder = 'Or type here…';
                            _addMessage('assistant', '⚠️ Transcription service unreachable.');
                        });
                    });
                };
                _mr.start();
                _recording = true;
                micBtn.style.background = '#dc2626';
                micBtn.style.color = '#fff';
                micLbl.textContent = 'Recording… tap to stop';
            }).catch(function (err) {
                _addMessage('assistant', '⚠️ Mic access denied: ' + err.message);
            });
        });

        // ── Welcome message (analytics-aware, uses persisted history) ───────
        if (_history.length > 0) {
            // Restore persisted messages
            _history.forEach(function (h) { _addMessage(h.role, h.content); });
            _addMessage('assistant', '_(Chat restored from your session)_');
        } else {
            _addWelcome();
        }
    }

    function _addWelcome() {
        var lines = ['Hi! I\'m your **Assistant PM**. Here\'s a live snapshot:\n'];
        try {
            var today    = new Date().toISOString().slice(0, 10);
            var projects = (AppData.getProjects() || []).filter(function (p) { return p.status === 'Active'; });
            var workers  = (AppData.getWorkers() || []).filter(function (w) { return w.status === 'Active'; });
            var allTasks = AppData.getTasks() || [];
            var open     = allTasks.filter(function (t) { return (t.status||'').toLowerCase() !== 'done' && (t.status||'').toLowerCase() !== 'completed'; });
            var overdue  = open.filter(function (t) { return (t.due_date||t.dueDate||'') && (t.due_date||t.dueDate||'') < today; });

            if (projects.length)
                lines.push('**Active projects (' + projects.length + '):** ' + projects.slice(0,3).map(function(p){return p.name;}).join(', ') + (projects.length > 3 ? '…' : ''));
            if (workers.length)
                lines.push('**Active crew:** ' + workers.length);
            if (overdue.length)
                lines.push('⚠️ **' + overdue.length + ' overdue task(s)** — say *"show overdue tasks"*');
            else if (open.length)
                lines.push('**Open tasks:** ' + open.length);

            lines.push('\nTry asking:');
            if (projects.length) lines.push('- *"What\'s overdue on ' + projects[0].name + '?"*');
            if (workers.length && projects.length) lines.push('- *"Assign a task to ' + workers[0].name + '"*');
            lines.push('- *"Show all open tasks"*');
            lines.push('- *"Project summary"*');
        } catch (e) {
            lines.push('Tell me what you need — create tasks, check project status, assign workers.');
        }
        _addMessage('assistant', lines.join('\n'));
    }

    // ── Panel controls ────────────────────────────────────────────────────────
    function _toggle() { _open ? _close() : _open_(); }

    function _open_() {
        _open = true;
        // Load persisted history on first open
        if (_history.length === 0) _history = _loadHistory();
        _buildUI();
        var panel = document.getElementById('aiAssistantWidget');
        if (panel) {
            panel.style.display = 'flex';
            setTimeout(function () {
                var inp = document.getElementById('aiChatInput');
                if (inp) inp.focus();
            }, 100);
        }
    }

    function _close() {
        _open = false;
        var panel = document.getElementById('aiAssistantWidget');
        if (panel) panel.style.display = 'none';
    }

    function _clearChat() {
        _history = [];
        _clearStoredHistory();
        var el = document.getElementById('aiChatMessages');
        if (el) el.innerHTML = '';
        _addWelcome();
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        init: function () {
            if (document.getElementById('aiAssistantFab')) return;
            window._aiInjectStyles();
            var fab = document.createElement('button');
            fab.id    = 'aiAssistantFab';
            fab.title = 'AI Assistant PM';
            fab.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span style="font-size:.8rem;font-weight:600;margin-left:5px">AI PM</span>';
            fab.style.cssText = [
                'position:fixed', 'bottom:80px', 'right:24px', 'z-index:9000',
                'display:flex', 'align-items:center', 'padding:10px 16px',
                'border-radius:24px', 'border:none', 'cursor:pointer',
                'background:var(--primary,#1a6b3a)', 'color:#fff',
                'box-shadow:0 4px 16px rgba(0,0,0,.25)', 'font-family:inherit',
                'transition:transform .15s,box-shadow .15s',
            ].join(';');
            fab.addEventListener('mouseenter', function () {
                fab.style.transform = 'scale(1.05)';
                fab.style.boxShadow = '0 6px 24px rgba(0,0,0,.3)';
            });
            fab.addEventListener('mouseleave', function () {
                fab.style.transform = '';
                fab.style.boxShadow = '0 4px 16px rgba(0,0,0,.25)';
            });
            fab.addEventListener('click', _toggle);
            document.body.appendChild(fab);
        },
        open:  _open_,
        close: _close,
        send:  _send,
    };
}());


// ══════════════════════════════════════════════════════════════════════════════
//  WORKER AI ASSISTANT — limited, field-worker-safe
// ══════════════════════════════════════════════════════════════════════════════

window.WorkerAIAssistant = (function () {
    'use strict';

    var STORAGE_KEY = 'ledgerman_wai_history';
    var _history = [];
    var _open    = false;
    var _pending = false;

    function _loadHistory() {
        try { var r = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(r) ? r : []; } catch (e) { return []; }
    }
    function _saveHistory() {
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(_history.slice(-12))); } catch (e) {}
    }

    // ── Send message ──────────────────────────────────────────────────────────
    function _send(msgText, _retryCount) {
        if (_pending) return;
        msgText = (msgText || '').trim();
        if (!msgText) return;
        _retryCount = _retryCount || 0;

        _addMessage('user', msgText);
        _history.push({ role: 'user', content: msgText });
        _saveHistory();
        _clearInput();
        _setThinking(true);
        _pending = true;

        var token   = sessionStorage.getItem('ledgeman_jwt') || '';
        var apiBase = (window.AppData && AppData.API_BASE) ||
            (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://app.ledgerman.org');

        var ctrl    = new AbortController();
        var timeout = setTimeout(function () { ctrl.abort(); }, 25000);

        fetch(apiBase + '/api/ai/worker-chat', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body:    JSON.stringify({
                message: msgText,
                history: _history.slice(-9, -1),
            }),
            signal: ctrl.signal,
        })
        .then(function (res) {
            clearTimeout(timeout);
            var status = res.status;
            return res.json().then(function (d) { return { status: status, data: d }; });
        })
        .then(function (r) {
            _pending = false;
            _setThinking(false);

            if (r.status >= 400) {
                if ((r.status === 502 || r.status === 503) && _retryCount === 0) {
                    _history.pop(); _saveHistory();
                    _pending = false;
                    setTimeout(function () { _send(msgText, 1); }, 2000);
                    _addMessage('assistant', '⏳ Retrying…');
                    return;
                }
                _addMessage('assistant', window._aiErrorMessage(r.status, (r.data||{}).error || ''));
                return;
            }

            var data = r.data;
            // Only honour navigate_to actions
            (data.actions || []).forEach(function (a) {
                if (a.type === 'navigate_to' && a.data && a.data.module && window.App) {
                    var fn = App.navigateTo || App.navigate;
                    if (fn) setTimeout(function () { fn.call(App, a.data.module); }, 300);
                }
            });

            _addMessage('assistant', data.message || '');
            _history.push({ role: 'assistant', content: data.message || '' });
            _saveHistory();
        })
        .catch(function (err) {
            clearTimeout(timeout);
            _pending = false;
            _setThinking(false);
            if (err.name === 'AbortError' && _retryCount === 0) {
                _history.pop(); _saveHistory();
                setTimeout(function () { _send(msgText, 1); }, 1000);
                _addMessage('assistant', '⏳ Slow response — retrying…');
                return;
            }
            _addMessage('assistant', window._aiErrorMessage(
                err.name === 'AbortError' ? 504 : 0, err.message
            ));
        });
    }

    function _clearInput() {
        var el = document.getElementById('waiChatInput');
        if (el) { el.value = ''; el.style.height = 'auto'; }
    }
    function _setThinking(on) {
        var el  = document.getElementById('waiThinkingIndicator');
        var btn = document.getElementById('waiSendBtn');
        if (el)  el.style.display = on ? 'flex' : 'none';
        if (btn) btn.disabled = on;
    }

    function _addMessage(role, text) {
        var el = document.getElementById('waiChatMessages');
        if (!el) return;
        var div = document.createElement('div');
        div.style.cssText = 'margin-bottom:10px;display:flex;flex-direction:column;animation:aiFadeIn .2s ease;' +
            (role === 'user' ? 'align-items:flex-end' : 'align-items:flex-start');
        var bubble = document.createElement('div');
        bubble.style.cssText = 'max-width:88%;padding:9px 12px;border-radius:14px;font-size:.875rem;line-height:1.5;word-break:break-word;' +
            (role === 'user'
                ? 'background:var(--primary,#1a6b3a);color:#fff;border-bottom-right-radius:4px'
                : 'background:var(--surface2,#f0f4f0);color:var(--text1,#1a1a1a);border-bottom-left-radius:4px');
        bubble.innerHTML = window._aiRenderText(text);
        div.appendChild(bubble);
        el.appendChild(div);
        el.scrollTop = el.scrollHeight;
    }

    function _buildPanel() {
        if (document.getElementById('waiAssistantWidget')) return;
        window._aiInjectStyles();

        var panel = document.createElement('div');
        panel.id  = 'waiAssistantWidget';
        panel.style.cssText = [
            'position:fixed', 'bottom:80px', 'right:24px', 'z-index:8999',
            'width:320px', 'max-width:calc(100vw - 32px)',
            'height:460px', 'max-height:calc(100vh - 100px)',
            'display:none', 'flex-direction:column',
            'background:var(--surface,#fff)', 'border-radius:16px',
            'box-shadow:0 8px 40px rgba(0,0,0,.2)', 'border:1px solid var(--border,#dde4e0)',
            'overflow:hidden', 'font-family:inherit',
        ].join(';');

        panel.innerHTML = [
            '<div style="background:var(--primary,#1a6b3a);color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">',
            '  <div style="display:flex;align-items:center;gap:8px">',
            '    <div style="width:7px;height:7px;border-radius:50%;background:#4ade80"></div>',
            '    <strong style="font-size:.9rem">Field Assistant</strong>',
            '  </div>',
            '  <button id="waiCloseBtn" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1.3rem;line-height:1;padding:2px 4px">&times;</button>',
            '</div>',
            '<div id="waiChatMessages" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;scroll-behavior:smooth;-webkit-overflow-scrolling:touch"></div>',
            '<div id="waiThinkingIndicator" style="display:none;padding:4px 14px 6px;align-items:center;gap:5px;flex-shrink:0">',
            '  <span style="width:6px;height:6px;border-radius:50%;background:var(--primary,#1a6b3a);animation:aiDot 1.2s infinite .0s both;display:inline-block"></span>',
            '  <span style="width:6px;height:6px;border-radius:50%;background:var(--primary,#1a6b3a);animation:aiDot 1.2s infinite .2s both;display:inline-block"></span>',
            '  <span style="width:6px;height:6px;border-radius:50%;background:var(--primary,#1a6b3a);animation:aiDot 1.2s infinite .4s both;display:inline-block"></span>',
            '  <span style="font-size:.75rem;color:var(--text2,#6b7280);margin-left:3px">Thinking…</span>',
            '</div>',
            '<div style="padding:8px 12px 10px;display:flex;gap:6px;align-items:flex-end;border-top:1px solid var(--border,#dde4e0);flex-shrink:0">',
            '  <textarea id="waiChatInput" rows="1" placeholder="Ask me anything…"',
            '    style="flex:1;resize:none;border:1px solid var(--border,#dde4e0);border-radius:10px;',
            '    padding:8px 11px;font-size:.875rem;font-family:inherit;line-height:1.4;outline:none;',
            '    max-height:100px;overflow-y:auto;background:var(--surface,#fff);color:var(--text1,#1a1a1a);',
            '    -webkit-appearance:none"></textarea>',
            '  <button id="waiSendBtn" style="flex-shrink:0;width:36px;height:36px;border-radius:50%;',
            '    background:var(--primary,#1a6b3a);border:none;color:#fff;cursor:pointer;',
            '    display:flex;align-items:center;justify-content:center">',
            '    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
            '  </button>',
            '</div>',
        ].join('');

        document.body.appendChild(panel);

        document.getElementById('waiCloseBtn').addEventListener('click', _close);
        var inputEl = document.getElementById('waiChatInput');
        document.getElementById('waiSendBtn').addEventListener('click', function () {
            if (inputEl) _send(inputEl.value);
        });
        inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _send(inputEl.value); }
        });
        inputEl.addEventListener('input', function () {
            inputEl.style.height = 'auto';
            inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
        });
    }

    function _open_() {
        _open = true;
        if (_history.length === 0) _history = _loadHistory();
        _buildPanel();
        var panel = document.getElementById('waiAssistantWidget');
        if (panel) {
            panel.style.display = 'flex';
            if (_history.length === 0) {
                _addMessage('assistant',
                    'Hi! I\'m your **Field Assistant**. I can help you with:\n' +
                    '- **Your tasks** and assignments\n' +
                    '- **Timecard logging**\n' +
                    '- **Work descriptions** and field reports\n\n' +
                    'What do you need?'
                );
            } else {
                _history.forEach(function (h) { _addMessage(h.role, h.content); });
            }
            setTimeout(function () { var inp = document.getElementById('waiChatInput'); if (inp) inp.focus(); }, 100);
        }
    }

    function _close() {
        _open = false;
        var panel = document.getElementById('waiAssistantWidget');
        if (panel) panel.style.display = 'none';
    }

    return {
        init: function () {
            if (document.getElementById('waiAssistantFab')) return;
            window._aiInjectStyles();
            var fab = document.createElement('button');
            fab.id    = 'waiAssistantFab';
            fab.title = 'Field Assistant';
            fab.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span style="font-size:.8rem;font-weight:600;margin-left:5px">Help</span>';
            fab.style.cssText = [
                'position:fixed', 'bottom:80px', 'right:24px', 'z-index:9000',
                'display:flex', 'align-items:center', 'padding:9px 14px',
                'border-radius:24px', 'border:none', 'cursor:pointer',
                'background:var(--primary,#1a6b3a)', 'color:#fff',
                'box-shadow:0 4px 16px rgba(0,0,0,.25)', 'font-family:inherit',
                'transition:transform .15s',
            ].join(';');
            fab.addEventListener('mouseenter', function () { fab.style.transform = 'scale(1.05)'; });
            fab.addEventListener('mouseleave', function () { fab.style.transform = ''; });
            fab.addEventListener('click', function () { _open ? _close() : _open_(); });
            document.body.appendChild(fab);
        },
        open:  _open_,
        close: _close,
    };
}());


// ══════════════════════════════════════════════════════════════════════════════
//  AUTO-INIT — role-aware, module-permission-aware
// ══════════════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    var _configFetched = false;
    var _moduleFlags   = { ai_assistant: true, worker_ai: true }; // default: enabled

    function _removeAdminFab() {
        ['aiAssistantFab', 'aiAssistantWidget'].forEach(function (id) {
            var el = document.getElementById(id); if (el) el.remove();
        });
    }
    function _removeWorkerFab() {
        ['waiAssistantFab', 'waiAssistantWidget'].forEach(function (id) {
            var el = document.getElementById(id); if (el) el.remove();
        });
    }

    function _fetchModuleFlags(token, apiBase, cb) {
        if (_configFetched) { cb(_moduleFlags); return; }
        fetch(apiBase + '/api/ai/config', {
            headers: { 'Authorization': 'Bearer ' + token },
            signal:  AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
        })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (d) {
            _configFetched = true;
            if (typeof d.ai_assistant !== 'undefined') _moduleFlags.ai_assistant = !!d.ai_assistant;
            if (typeof d.worker_ai   !== 'undefined') _moduleFlags.worker_ai    = !!d.worker_ai;
            cb(_moduleFlags);
        })
        .catch(function () {
            _configFetched = true; // don't retry on network failure
            cb(_moduleFlags);      // fall back to defaults (show buttons)
        });
    }

    function _checkUser() {
        var user    = window.App && App.currentUser;
        var token   = sessionStorage.getItem('ledgeman_jwt') || '';
        var apiBase = (window.AppData && AppData.API_BASE) ||
            (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://app.ledgerman.org');

        if (!user) { setTimeout(_checkUser, 1500); return; }

        if (user.type === 'worker') {
            _removeAdminFab();
            _fetchModuleFlags(token, apiBase, function (flags) {
                if (!flags.worker_ai) { _removeWorkerFab(); }
                else if (window.WorkerAIAssistant && !document.getElementById('waiAssistantFab')) {
                    WorkerAIAssistant.init();
                }
            });
            setTimeout(_checkUser, 4000);
            return;
        }

        // Admin
        _removeWorkerFab();
        _fetchModuleFlags(token, apiBase, function (flags) {
            // Also check tenant-side settings.modules toggle (legacy — some companies set this)
            var m = window.AppData && AppData.getSettings ? AppData.getSettings().modules : null;
            var tenantOff = m && m['ai_assistant'] === false;
            if (!flags.ai_assistant || tenantOff) {
                _removeAdminFab();
            } else if (window.AIAssistant && !document.getElementById('aiAssistantFab')) {
                AIAssistant.init();
            }
        });

        setTimeout(_checkUser, 4000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(_checkUser, 1500); });
    } else {
        setTimeout(_checkUser, 1500);
    }
}());
