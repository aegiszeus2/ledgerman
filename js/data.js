// Ledgerman — Data layer v2
// API mode: in-memory cache hydrated from backend, async API writes, JWT auth
// Legacy mode: falls back to localStorage/IndexedDB (no backend / offline)

// ─── API Config ────────────────────────────────────────────────────────────
const API_BASE = (window.LEDGERMAN_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://app.ledgerman.org'));

// ─── In-Memory Cache ───────────────────────────────────────────────────────
// null = not loaded; populated after syncFromServer()
let _cache = null;

// ─── IndexedDB Setup (photos unchanged) ────────────────────────────────────
const DB_NAME = 'ledgeman_db';
const DB_VERSION = 1;
const STORE_PHOTOS = 'photos';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
                const store = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
                store.createIndex('projectId', 'projectId', { unique: false });
                store.createIndex('workerId', 'workerId', { unique: false });
                store.createIndex('submissionId', 'submissionId', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ─── JWT / CompanyId Storage ───────────────────────────────────────────────
// sessionStorage: persists during the browser session (tab stays logged in on refresh)
// but clears when the browser/tab is closed — no cross-session pre-population of company
function getJwt() { return sessionStorage.getItem('ledgeman_jwt') || ''; }
function setJwt(token) {
    if (token) sessionStorage.setItem('ledgeman_jwt', token);
    else sessionStorage.removeItem('ledgeman_jwt');
}
function getCompanyId() { return sessionStorage.getItem('ledgeman_companyId') || ''; }
function setCompanyId(id) {
    if (id) sessionStorage.setItem('ledgeman_companyId', id);
    else sessionStorage.removeItem('ledgeman_companyId');
}
function isApiMode() { return !!(getCompanyId()); }

// ─── Persistent Storage (Keep Me Signed In) ────────────────────────────────
function savePersistentLogin(type, credentials) {
    // type: 'admin' or 'worker'
    // credentials: { companyName, [workerName], [pin/password], jwt, companyId }
    try {
        localStorage.setItem('ledgeman_persistent_login', JSON.stringify({ type, credentials, timestamp: Date.now() }));
    } catch(e) {
        console.warn('[Ledgerman] Failed to save persistent login:', e.message);
    }
}

function getPersistentLogin() {
    try {
        const saved = localStorage.getItem('ledgeman_persistent_login');
        return saved ? JSON.parse(saved) : null;
    } catch(e) {
        console.warn('[Ledgerman] Failed to load persistent login:', e.message);
        return null;
    }
}

function clearPersistentLogin() {
    try {
        localStorage.removeItem('ledgeman_persistent_login');
    } catch(e) {
        console.warn('[Ledgerman] Failed to clear persistent login:', e.message);
    }
}

// ─── API Fetch Helper ──────────────────────────────────────────────────────
async function _apiFetch(path, options) {
    options = options || {};
    const jwt = getJwt();
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (jwt) headers['Authorization'] = 'Bearer ' + jwt;

    // Add timeout: 15s for sync, 30s for others
    const timeout = path === '/api/sync' ? 15000 : 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(API_BASE + path, Object.assign({}, options, { headers: headers, signal: controller.signal }));
        clearTimeout(timeoutId);

        if (!res.ok) {
            let errMsg = 'HTTP ' + res.status;
            try { const j = await res.json(); errMsg = j.error || errMsg; } catch(e) {}
            throw new Error(errMsg);
        }
        try {
            return await res.json();
        } catch(e) {
            console.error('[Ledgerman] Failed to parse JSON response from', path, ':', e.message);
            throw new Error('Failed to parse server response: ' + e.message);
        }
    } catch(e) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
            console.error('[Ledgerman] Request timeout on', path, '(timeout: ' + timeout + 'ms)');
            throw new Error('Server request timed out - check your connection or try again');
        }
        if (e instanceof TypeError) {
            console.error('[Ledgerman] Network error on', path, ':', e.message);
            throw new Error('Network error - check your connection. Details: ' + e.message);
        }
        throw e;
    }
}

// ─── Auth API ──────────────────────────────────────────────────────────────
async function apiRegister(companyName, password) {
    const data = await _apiFetch('/api/companies/register', {
        method: 'POST',
        body: JSON.stringify({ name: companyName, adminPassword: password })
    });
    setJwt(data.token);
    setCompanyId(data.companyId);
    return data;
}

async function apiLoginAdmin(companyName, password) {
    const data = await _apiFetch('/api/auth/admin', {
        method: 'POST',
        body: JSON.stringify({ companyName: companyName, password: password })
    });
    setJwt(data.token);
    // Extract companyId from JWT payload so isApiMode() returns true for admin sessions
    if (data.token) {
        try {
            const payload = JSON.parse(atob(data.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload.companyId) setCompanyId(payload.companyId);
        } catch (e) { /* malformed token — ignore */ }
    }
    return data;
}

async function apiLinkDevice(companyId, password) {
    const data = await _apiFetch('/api/auth/admin', {
        method: 'POST',
        body: JSON.stringify({ companyId: companyId, password: password })
    });
    setJwt(data.token);
    setCompanyId(companyId);
    return data;
}

async function apiLoginWorker(pin) {
    const companyId = getCompanyId();
    if (!companyId) throw new Error('No company registered on this device');
    const data = await _apiFetch('/api/auth/worker', {
        method: 'POST',
        body: JSON.stringify({ companyId: companyId, pin: pin })
    });
    if (data.token) setJwt(data.token);
    return data; // { token, worker } OR { twoFARequired: true, workerId, workerName }
}

async function apiLoginWorkerByName(companyName, pin) {
    const data = await _apiFetch('/api/auth/worker', {
        method: 'POST',
        body: JSON.stringify({ companyName: companyName, pin: pin })
    });
    if (data.token) setJwt(data.token);
    // Store the companyId returned so session is linked
    if (data.worker && data.worker.company_id) setCompanyId(data.worker.company_id);
    return data; // { token, worker } OR { twoFARequired: true, workerId, workerName }
}


async function apiLoginWorkerByNameAndPin(companyName, workerName, pin) {
    const data = await _apiFetch('/api/auth/worker', {
        method: 'POST',
        body: JSON.stringify({ companyName: companyName, workerName: workerName, pin: pin })
    });
    if (data.token) setJwt(data.token);
    // Store the companyId returned so session is linked
    if (data.worker && data.worker.company_id) setCompanyId(data.worker.company_id);
    return data; // { token, worker } OR { twoFARequired: true, workerId, workerName }
}
async function apiVerify2FA(workerId, totpCode) {
    const companyId = getCompanyId();
    const data = await _apiFetch('/api/auth/worker/verify2fa', {
        method: 'POST',
        body: JSON.stringify({ companyId: companyId, workerId: workerId, totpCode: totpCode })
    });
    if (data.token) setJwt(data.token);
    return data;
}

async function apiCreateInvite(workerId, workerName) {
    return _apiFetch('/api/invites', {
        method: 'POST',
        body: JSON.stringify({ workerId: workerId, workerName: workerName })
    });
}

async function apiGetInvite(token) {
    return _apiFetch('/api/invites/' + token);
}

async function apiUseInvite(token, inviteData) {
    const data = await _apiFetch('/api/invites/' + token + '/use', {
        method: 'PUT',
        body: JSON.stringify(inviteData)
    });
    if (data.token) setJwt(data.token);
    if (data.worker && (data.worker.company_id || data.worker.companyId)) {
        setCompanyId(data.worker.company_id || data.worker.companyId);
    }
    return data;
}

// ─── Sync from Server ──────────────────────────────────────────────────────
// Entities synced from server + mirrored to localStorage
var _SYNC_ENTITY_KEYS = [
    'workers','projects','tasks','clients','subtasks','expenses','submissions',
    'invoices','payments','vendors','invites','estimates','auditLog','daily_reports',
    'punch_items','equipment','equipmentLogs','notifications','budget_versions','budget_items'
];

async function syncFromServer() {
    // Capture pre-sync localStorage for orphan recovery (items saved locally before refresh
    // but async POST hadn't completed — rescues them after server says they're missing)
    var _preSyncLocal = {};
    _SYNC_ENTITY_KEYS.forEach(function(k) { _preSyncLocal[k] = getData(k) || []; });

    try {
        const data = await _apiFetch('/api/sync');
        _cache = {
            workers:          data.workers          || [],
            projects:         data.projects         || [],
            tasks:            data.tasks            || [],
            clients:          data.clients          || [],
            subtasks:         data.subtasks         || [],
            expenses:         data.expenses         || [],
            submissions:      data.submissions      || [],
            invoices:         data.invoices         || [],
            payments:         data.payments         || [],
            vendors:          data.vendors          || [],
            invites:          data.invites          || [],
            estimates:        data.estimates        || [],
            auditLog:         data.auditLog         || [],
            daily_reports:    data.daily_reports    || [],
            punch_items:      data.punch_items      || [],
            equipment:        data.equipment        || [],
            equipmentLogs:    data.equipmentLogs    || [],
            notifications:    data.notifications    || [],
            budget_versions:  data.budget_versions  || [],
            budget_items:     data.budget_items     || [],
            settings:         data.settings         || {},
        };
        // Mirror to localStorage as offline backup
        _SYNC_ENTITY_KEYS.forEach(function(key) { setData(key, _cache[key]); });
        setData('settings', _cache.settings);
        console.log('[Ledgerman] Synced from server. Workers:', _cache.workers.length,
            'Projects:', _cache.projects.length, 'Tasks:', _cache.tasks.length, 'Submissions:', _cache.submissions.length);

        // ── Orphan recovery ──────────────────────────────────────────────────
        // If an item was saved locally but the server confirms it's missing (async race),
        // add it back to cache immediately and re-push to backend.
        if (isApiMode() && getJwt()) {
            var _orphanTypes = ['projects','tasks','clients','subtasks','expenses',
                'invoices','payments','vendors','estimates','daily_reports','punch_items',
                'equipment','equipmentLogs','budget_versions','budget_items'];
            _orphanTypes.forEach(function(key) {
                var serverIds = new Set((_cache[key] || []).map(function(i) { return i.id; }));
                (_preSyncLocal[key] || []).forEach(function(localItem) {
                    if (localItem && localItem.id && !serverIds.has(localItem.id)) {
                        console.log('[Ledgerman] Recovering orphaned ' + key + ' item:', localItem.id);
                        if (_cache[key]) { _cache[key].push(localItem); setData(key, _cache[key]); }
                        _apiFetch('/api/' + key, { method: 'POST', body: JSON.stringify(localItem) })
                            .catch(function(e) {
                                console.warn('[Ledgerman] Orphan recovery failed ' + key + ':', e.message);
                            });
                    }
                });
            });
        }

        return _cache;
    } catch (e) {
        console.warn('[Ledgerman] Sync failed — using localStorage fallback:', e.message);
        // Fall back to localStorage (populate all keys including tasks which was previously missing)
        _cache = {};
        _SYNC_ENTITY_KEYS.forEach(function(k) { _cache[k] = getData(k) || []; });
        _cache.settings = getData('settings') || {};
        return _cache;
    }
}

function isCacheLoaded() { return _cache !== null; }

// ─── localStorage Helpers ──────────────────────────────────────────────────
function getData(key) {
    try {
        const raw = localStorage.getItem('ledgeman_' + key);
        return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
}

function setData(key, value) {
    localStorage.setItem('ledgeman_' + key, JSON.stringify(value));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ─── Cache-Aware List Helpers ──────────────────────────────────────────────
function _getList(key) {
    if (_cache) return _cache[key] || [];
    return getData(key) || [];
}

function _setList(key, arr) {
    if (_cache) _cache[key] = arr;
    setData(key, arr); // always mirror to localStorage
}

// Legacy raw helpers (still used by backup/restore and some modules)
function getAll(entity) { return _getList(entity); }
function getById(entity, id) { return _getList(entity).find(function(e) { return e.id === id; }); }

function save(entity, item) {
    var items = _getList(entity);
    var idx = items.findIndex(function(e) { return e.id === item.id; });
    if (idx >= 0) items[idx] = item;
    else items.push(item);
    _setList(entity, items);
    // Push to API async (generic entity endpoint — handles upsert server-side)
    if (isApiMode() && getJwt() && entity !== 'auditLog') {
        _apiFetch('/api/' + entity, {
            method: 'POST',
            body: JSON.stringify(item)
        }).catch(function(e) {
            console.warn('[API] save ' + entity + ':', e.message);
            // Show error to user instead of silent failure
            var entityLabel = entity.charAt(0).toUpperCase() + entity.slice(1);
            Utils.showToast('Error saving ' + entityLabel + ': ' + e.message, 'error');
        });
    }
    return item;
}

function remove(entity, id) {
    _setList(entity, _getList(entity).filter(function(e) { return e.id !== id; }));
    if (isApiMode() && getJwt()) {
        _apiFetch('/api/' + entity + '/' + id, { method: 'DELETE' })
            .catch(function(e) {
                console.warn('[API] delete ' + entity + '/' + id + ':', e.message);
                // Show error to user instead of silent failure
                var entityLabel = entity.charAt(0).toUpperCase() + entity.slice(1);
                Utils.showToast('Error deleting ' + entityLabel + ': ' + e.message, 'error');
            });
    }
}

/**
 * saveEntityAsync(entity, item)
 * Confirmed-persistence save for entities that use the generic /api/<entity> endpoint.
 * - In API mode: awaits the server POST. On success, updates local cache. On failure, throws.
 *   The caller must NOT close the form until this resolves.
 * - In offline mode: falls through to synchronous save() immediately.
 */
async function saveEntityAsync(entity, item) {
    if (isApiMode() && getJwt() && entity !== 'auditLog') {
        // Server write FIRST — only update cache on confirmed success
        let resp;
        try {
            resp = await _apiFetch('/api/' + entity, {
                method: 'POST',
                body: JSON.stringify(item)
            });
        } catch (e) {
            throw new Error(e.message || 'Server unreachable');
        }
        if (resp && resp.error) {
            throw new Error(resp.error);
        }
        // Confirmed — now update local cache
        var items = _getList(entity);
        var idx = items.findIndex(function(x) { return x.id === item.id; });
        if (idx >= 0) items[idx] = item;
        else items.push(item);
        _setList(entity, items);
        return item;
    }
    // Offline fallback — synchronous local save
    return save(entity, item);
}

/**
 * saveWorkerAsync(w)
 * Confirmed-persistence save for workers (dedicated /api/workers endpoint).
 * Same contract as saveEntityAsync: awaits server, updates cache on success, throws on failure.
 */
async function saveWorkerAsync(w) {
    var normalized = _normalizeWorker(w);
    if (isApiMode() && getJwt()) {
        var items = _getList('workers');
        var isNew = items.findIndex(function(x) { return x.id === normalized.id; }) < 0;
        let resp;
        try {
            resp = await _apiFetch('/api/workers' + (isNew ? '' : '/' + normalized.id), {
                method: isNew ? 'POST' : 'PUT',
                body: JSON.stringify(normalized)
            });
        } catch (e) {
            throw new Error(e.message || 'Server unreachable');
        }
        if (resp && resp.error) {
            throw new Error(resp.error);
        }
        // Confirmed — update cache
        if (isNew) items.push(normalized);
        else { var idx2 = items.findIndex(function(x) { return x.id === normalized.id; }); if (idx2 >= 0) items[idx2] = normalized; }
        _setList('workers', items);
        return normalized;
    }
    // Offline fallback
    return saveWorker(w);
}

// ─── Settings ──────────────────────────────────────────────────────────────
function getSettings() {
    if (_cache && _cache.settings && Object.keys(_cache.settings).length > 0) {
        return _cache.settings;
    }
    return getData('settings') || {
        companyName: '', address: '', city: '', province: 'Ontario', postalCode: '',
        phone: '', email: '', hstNumber: '', invoicePrefix: 'INV',
        defaultPaymentTerms: 'Net 30', defaultInvoiceNotes: '',
        defaultHstRate: 13, sessionTimeout: 30, setupComplete: false
    };
}

function saveSettings(settings) {
    if (_cache) _cache.settings = settings;
    setData('settings', settings);
    if (isApiMode() && getJwt()) {
        _apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(settings) })
            .catch(function(e) { console.warn('[API] saveSettings:', e.message); });
    }
}

function getCompanyName() {
    return getSettings().companyName || 'My Company';
}

async function saveSettingsAsync(settings) {
    if (isApiMode() && getJwt()) {
        let resp;
        try {
            resp = await _apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
        } catch (e) {
            throw new Error(e.message || 'Server unreachable');
        }
        if (resp && resp.error) throw new Error(resp.error);
    }
    if (_cache) _cache.settings = settings;
    setData('settings', settings);
    return settings;
}

// ─── Worker key normaliser (API returns snake_case) ────────────────────────
function _normalizeWorker(w) {
    if (!w) return w;
    return Object.assign({}, w, {
        defaultRate:  w.defaultRate  !== undefined ? w.defaultRate  : (w.default_rate   || 0),
        twoFAEnabled: w.twoFAEnabled !== undefined ? w.twoFAEnabled : !!(w.two_fa_enabled),
        totpSecret:   w.totpSecret   !== undefined ? w.totpSecret   : (w.totp_secret    || ''),
        createdAt:    w.createdAt    !== undefined ? w.createdAt    : (w.created_at      || ''),
    });
}

// ─── Workers ───────────────────────────────────────────────────────────────
function getWorkers() { return _getList('workers').map(_normalizeWorker); }
function getWorker(id) {
    var w = _getList('workers').find(function(w) { return w.id === id; });
    return w ? _normalizeWorker(w) : null;
}

function saveWorker(w) {
    var normalized = _normalizeWorker(w);
    var items = _getList('workers');
    var idx = items.findIndex(function(x) { return x.id === normalized.id; });
    if (idx >= 0) items[idx] = normalized;
    else items.push(normalized);
    _setList('workers', items);
    // Push to API (POST creates/upserts, PUT updates existing)
    if (isApiMode() && getJwt()) {
        var isNew = idx < 0;
        _apiFetch('/api/workers' + (isNew ? '' : '/' + normalized.id), {
            method: isNew ? 'POST' : 'PUT',
            body: JSON.stringify(normalized)
        }).catch(function(e) {
            console.warn('[API] saveWorker:', e.message);
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('Worker save failed: ' + e.message, 'error');
            }
        });
    }
    return normalized;
}

function deleteWorker(id) {
    _setList('workers', _getList('workers').filter(function(w) { return w.id !== id; }));
    if (isApiMode() && getJwt()) {
        _apiFetch('/api/workers/' + id, { method: 'DELETE' })
            .catch(function(e) { console.warn('[API] deleteWorker:', e.message); });
    }
}

// NOTE: In API mode, PINs are NOT in the cache (stripped by server for security).
// Worker login goes through apiLoginWorker() instead. This is legacy-mode fallback only.
function getWorkerByPin(pin) {
    return _getList('workers').map(_normalizeWorker).find(function(w) {
        return w.pin === pin && w.status === 'Active';
    });
}

// ─── Clients ───────────────────────────────────────────────────────────────
function getClients() { return getAll('clients'); }
function getClient(id) { return getById('clients', id); }
function saveClient(c) { return save('clients', c); }
function deleteClient(id) { remove('clients', id); }

// ─── Projects ──────────────────────────────────────────────────────────────
function getProjects() { return getAll('projects'); }
function getProject(id) { return getById('projects', id); }
function saveProject(p) { return save('projects', p); }
function deleteProject(id) { remove('projects', id); }

// ─── Tasks ─────────────────────────────────────────────────────────────────
function getTasks(projectId) { return projectId ? getAll('tasks').filter(function(t) { return t.projectId === projectId; }) : getAll('tasks'); }
function getTask(id) { return getById('tasks', id); }
function saveTask(t) { return save('tasks', t); }
function deleteTask(id) { remove('tasks', id); }

// ─── Subtasks ──────────────────────────────────────────────────────────────
function getSubtasks(projectId) { return getAll('subtasks').filter(function(s) { return s.projectId === projectId; }); }
function getSubtask(id) { return getById('subtasks', id); }
function saveSubtask(s) { return save('subtasks', s); }
function deleteSubtask(id) { remove('subtasks', id); }

// ─── Expenses ──────────────────────────────────────────────────────────────
function getExpenses(projectId) { return projectId ? getAll('expenses').filter(function(e) { return e.projectId === projectId; }) : getAll('expenses'); }
function getExpense(id) { return getById('expenses', id); }
function saveExpense(e) { return save('expenses', e); }
function deleteExpense(id) { remove('expenses', id); }

// ─── Submissions ───────────────────────────────────────────────────────────
function getSubmissions() { return getAll('submissions'); }
function getSubmission(id) { return getById('submissions', id); }
function saveSubmission(s) { return save('submissions', s); }
function deleteSubmission(id) { remove('submissions', id); }
function getPendingSubmissions() { return getSubmissions().filter(function(s) { return s.status === 'Pending'; }); }
function getWorkerSubmissions(workerId) { return getSubmissions().filter(function(s) { return s.workerId === workerId; }); }
// ─── Estimates ─────────────────────────────────────────────────────────────
function getEstimates() { return getAll('estimates'); }
function getEstimate(id) { return getById('estimates', id); }
function saveEstimate(e) { return save('estimates', e); }
async function saveEstimateAsync(e) { return saveEntityAsync('estimates', e); }
function deleteEstimate(id) { remove('estimates', id); }

// ─── Equipment ─────────────────────────────────────────────────────────────
function getEquipment() { return getAll('equipment'); }
function getEquipmentItem(id) { return getById('equipment', id); }
function saveEquipment(e) { return save('equipment', e); }
async function saveEquipmentAsync(e) { return saveEntityAsync('equipment', e); }
function deleteEquipment(id) { remove('equipment', id); }

// ─── Equipment Logs ────────────────────────────────────────────────────────
// Each log entry records equipment used during a time submission.
// Fields: submissionId, equipmentId, equipmentName, projectId, workerId, date, hours, costRate, chargeOutRate, cost, revenue
function getEquipmentLogs(projectId) {
    return projectId
        ? getAll('equipmentLogs').filter(function(l) { return l.projectId === projectId; })
        : getAll('equipmentLogs');
}
function getEquipmentLog(id) { return getById('equipmentLogs', id); }
function saveEquipmentLog(l) { return save('equipmentLogs', l); }
function deleteEquipmentLog(id) { remove('equipmentLogs', id); }

// ─── Notifications ────────────────────────────────────────────────────────
// Service alerts and system notifications.
// Fields: id, type, title, message, equipmentId, equipmentName, resolved, emailSent, createdAt
function getNotifications() { return getAll('notifications'); }
function getNotification(id) { return getById('notifications', id); }
function saveNotification(n) { return save('notifications', n); }
function deleteNotification(id) { remove('notifications', id); }


// ─── Invoices ──────────────────────────────────────────────────────────────
function getInvoices(projectId) { return projectId ? getAll('invoices').filter(function(i) { return i.projectId === projectId; }) : getAll('invoices'); }
function getInvoice(id) { return getById('invoices', id); }
function saveInvoice(i) { return save('invoices', i); }

// ─── Payments ──────────────────────────────────────────────────────────────
function getPayments(invoiceId) { return invoiceId ? getAll('payments').filter(function(p) { return p.invoiceId === invoiceId; }) : getAll('payments'); }
function savePayment(p) { return save('payments', p); }

// ─── Invoice number ────────────────────────────────────────────────────────
// ─── Project Number ────────────────────────────────────────────────────────
// Auto-generates YYYY-NNNN based on the year and existing project numbers.
function getNextProjectNumber(year) {
    year = year || new Date().getFullYear();
    var prefix = String(year) + '-';
    var maxNum = getProjects().reduce(function(max, p) {
        if (p.projectNumber && p.projectNumber.startsWith(prefix)) {
            var num = parseInt(p.projectNumber.slice(prefix.length));
            if (!isNaN(num) && num > max) return num;
        }
        return max;
    }, 0);
    return prefix + String(maxNum + 1).padStart(4, '0');
}

function getNextInvoiceNumber() {
    var year = new Date().getFullYear();
    var prefix = (getSettings().invoicePrefix || 'INV').toUpperCase();
    var invoices = getInvoices();
    var yearInvoices = invoices.filter(function(i) { return i.invoiceNumber && i.invoiceNumber.includes('-' + year + '-'); });
    var maxNum = yearInvoices.reduce(function(max, i) {
        var parts = i.invoiceNumber.split('-');
        var num = parseInt(parts[parts.length - 1]);
        return (!isNaN(num) && num > max) ? num : max;
    }, 0);
    return prefix + '-' + year + '-' + String(maxNum + 1).padStart(4, '0');
}

// ─── Invites ───────────────────────────────────────────────────────────────
function getInvites() { return getAll('invites'); }
function getInvite(token) { return getInvites().find(function(i) { return i.token === token; }); }
function saveInvite(invite) { return save('invites', invite); }
function deleteInvite(token) { _setList('invites', getInvites().filter(function(i) { return i.token !== token; })); }

// ─── Budget Versions ───────────────────────────────────────────────────────
// Budget version = a snapshot of a project budget (draft → approved baseline → revised)
// Fields: id, projectId, version (int), status ('draft'|'approved'|'superseded'),
//         name, totalBudget, createdAt, approvedAt, approvedBy, notes
function getBudgetVersions(projectId) {
    var all = getAll('budget_versions');
    return projectId ? all.filter(function(v) { return v.projectId === projectId; }) : all;
}
function getBudgetVersion(id) { return getById('budget_versions', id); }
function saveBudgetVersion(v) { return save('budget_versions', v); }
async function saveBudgetVersionAsync(v) { return saveEntityAsync('budget_versions', v); }
function deleteBudgetVersion(id) { remove('budget_versions', id); }

// ─── Budget Items ──────────────────────────────────────────────────────────
// Individual line items within a budget version (work items / cost breakdown)
// Fields: id, projectId, budgetVersionId, costCode, division, description,
//         category ('Labour'|'Material'|'Equipment'|'Subcontract'|'Other'),
//         quantity, unit, unitCost, total, notes, createdAt, updatedAt
function getBudgetItems(budgetVersionId) {
    var all = getAll('budget_items');
    return budgetVersionId ? all.filter(function(i) { return i.budgetVersionId === budgetVersionId; }) : all;
}
function getBudgetItem(id) { return getById('budget_items', id); }
function saveBudgetItem(item) { return save('budget_items', item); }
async function saveBudgetItemAsync(item) { return saveEntityAsync('budget_items', item); }
function deleteBudgetItem(id) { remove('budget_items', id); }

// ─── Submission Admin Edit ──────────────────────────────────────────────────
/**
 * editSubmissionAsync(submissionId, fields, reason, requireReApproval)
 * Calls the dedicated admin-edit endpoint — records field-level diff + audit trail.
 * Admin role required (enforced server-side). Throws on failure.
 */
async function editSubmissionAsync(submissionId, fields, reason, requireReApproval) {
    const body = Object.assign({}, fields, {
        reason: reason || '',
        requireReApproval: !!requireReApproval
    });
    const resp = await _apiFetch('/api/submissions/' + submissionId + '/admin-edit', {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
    if (!resp || resp.error) {
        throw new Error(resp && resp.error ? resp.error : 'Failed to edit submission');
    }
    // Update local cache
    var cached = getData('submissions');
    var idx = cached.findIndex(function(s) { return s.id === submissionId; });
    if (idx >= 0) cached[idx] = resp;
    else cached.push(resp);
    setData('submissions', cached);
    return resp;
}

// ─── Audit Log ─────────────────────────────────────────────────────────────
function addAuditLog(user, action, details) {
    var entry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        user: user,
        action: action,
        details: details || ''
    };
    var logs = _getList('auditLog');
    logs.push(entry);
    _setList('auditLog', logs);
    // Push to API (use /api/auditLog endpoint — matches VALID_ENTITY_TYPES on server)
    if (isApiMode() && getJwt()) {
        _apiFetch('/api/auditLog', {
            method: 'POST',
            body: JSON.stringify({ user: user, action: action, details: details || '' })
        }).catch(function(e) { console.warn('[API] addAuditLog:', e.message); });
    }
}

function getAuditLog() { return _getList('auditLog'); }

// ─── Admin Password (legacy — server manages passwords in API mode) ─────────
function getAdminPassword() { return getData('adminPassword') || null; }
function setAdminPassword(pw) { setData('adminPassword', pw); }

// ─── First Run / Setup ─────────────────────────────────────────────────────
function isFirstRun() {
    // API mode: first run if no companyId stored on this device
    if (localStorage.getItem('ledgeman_companyId')) return false;
    // Legacy mode: first run if no setupDone flag
    return !getData('setupDone');
}
function markSetupDone() { setData('setupDone', true); }

// ─── Photos (IndexedDB + API mirror) ───────────────────────────────────────
async function _blobToBase64(blob) {
    if (!blob) return '';
    if (typeof blob === 'string') return blob; // already base64/dataURL
    return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onloadend = function() { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(blob instanceof Blob ? blob : new Blob([blob]));
    });
}

function _base64ToBlob(dataUrl) {
    // Handles full data URLs (data:image/png;base64,...) or raw base64
    var parts = dataUrl.split(',');
    var mimeMatch = parts[0].match(/:(.*?);/);
    var mime = mimeMatch ? mimeMatch[1] : 'image/png';
    var raw = atob(parts[1] || parts[0]);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type: mime });
}

async function savePhoto(photoData) {
    // 1. Save to IndexedDB
    var db = await openDB();
    await new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_PHOTOS, 'readwrite');
        tx.objectStore(STORE_PHOTOS).put(photoData);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
    });
    // 2. Push to API async (don't block)
    if (isApiMode() && getJwt()) {
        (async function() {
            try {
                var blobB64 = await _blobToBase64(photoData.blob);
                var thumbB64 = await _blobToBase64(photoData.thumbnail);
                await _apiFetch('/api/photos', {
                    method: 'POST',
                    body: JSON.stringify({
                        id: photoData.id,
                        projectId:    photoData.projectId    || '',
                        workerId:     photoData.workerId     || '',
                        submissionId: photoData.submissionId || '',
                        date:         photoData.date         || '',
                        filename:     photoData.filename     || '',
                        blobB64:      blobB64,
                        thumbnailB64: thumbB64,
                    })
                });
            } catch(e) {
                console.warn('[API] photo upload failed:', e.message);
            }
        })();
    }
}

async function getPhotosByProject(projectId) {
    var db = await openDB();
    return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_PHOTOS, 'readonly');
        var idx = tx.objectStore(STORE_PHOTOS).index('projectId');
        var req = idx.getAll(projectId);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
    });
}

async function getPhotosBySubmission(submissionId) {
    var db = await openDB();
    return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_PHOTOS, 'readonly');
        var idx = tx.objectStore(STORE_PHOTOS).index('submissionId');
        var req = idx.getAll(submissionId);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
    });
}

async function getPhoto(id) {
    var db = await openDB();
    return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_PHOTOS, 'readonly');
        var req = tx.objectStore(STORE_PHOTOS).get(id);
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
    });
}

async function deletePhoto(id) {
    var db = await openDB();
    await new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_PHOTOS, 'readwrite');
        tx.objectStore(STORE_PHOTOS).delete(id);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
    });
    if (isApiMode() && getJwt()) {
        if (id === 'company_logo') {
            _apiFetch('/api/logo', { method: 'DELETE' })
                .catch(function(e) { console.warn('[API] deleteLogo:', e.message); });
        } else {
            _apiFetch('/api/photos/' + id, { method: 'DELETE' })
                .catch(function(e) { console.warn('[API] deletePhoto:', e.message); });
        }
    }
}

async function saveLogo(blob) {
    // Save to IndexedDB for immediate use
    var db = await openDB();
    await new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_PHOTOS, 'readwrite');
        tx.objectStore(STORE_PHOTOS).put({ id: 'company_logo', blob: blob, type: 'logo' });
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
    });
    // Also upload to server so it persists across sessions and devices
    if (isApiMode() && getJwt()) {
        try {
            var b64 = await _blobToBase64(blob);
            await _apiFetch('/api/logo', { method: 'PUT', body: JSON.stringify({ data: b64 }) });
        } catch(e) {
            console.warn('[Logo] Server upload failed:', e.message);
        }
    }
}

async function getLogo() {
    // Try IndexedDB first (fastest)
    var local = await getPhoto('company_logo');
    if (local && local.blob) return local;
    // Fall back to server
    if (isApiMode() && getJwt()) {
        try {
            var resp = await _apiFetch('/api/logo');
            if (resp && resp.data) {
                var blob = _base64ToBlob(resp.data);
                // Cache in IndexedDB
                var db2 = await openDB();
                await new Promise(function(resolve) {
                    var tx = db2.transaction(STORE_PHOTOS, 'readwrite');
                    tx.objectStore(STORE_PHOTOS).put({ id: 'company_logo', blob: blob, type: 'logo' });
                    tx.oncomplete = resolve;
                });
                return { id: 'company_logo', blob: blob, type: 'logo' };
            }
        } catch(e) {
            // No logo on server
        }
    }
    return null;
}

async function getAllPhotos() {
    var db = await openDB();
    return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_PHOTOS, 'readonly');
        var req = tx.objectStore(STORE_PHOTOS).getAll();
        req.onsuccess = function() { resolve(req.result.filter(function(p) { return p.type !== 'logo'; })); };
        req.onerror = function() { reject(req.error); };
    });
}

// ─── Backup / Restore ──────────────────────────────────────────────────────
async function exportAllData() {
    var data = {
        version: 1,
        exportDate: new Date().toISOString(),
        settings: getSettings(),
        // adminPassword intentionally excluded from exports for security
        workers: getWorkers(),
        clients: getClients(),
        projects: getProjects(),
        subtasks: getAll('subtasks'),
        expenses: getAll('expenses'),
        submissions: getSubmissions(),
        invoices: getAll('invoices'),
        payments: getAll('payments'),
        auditLog: getAuditLog(),
        setupDone: getData('setupDone')
    };
    try {
        var allPhotos = await getAllPhotos();
        var photoPromises = allPhotos.map(async function(p) {
            if (p.blob) {
                var blobB64 = await _blobToBase64(p.blob);
                return Object.assign({}, p, { blobBase64: blobB64, blob: undefined });
            }
            return Object.assign({}, p, { blob: undefined });
        });
        data.photos = await Promise.all(photoPromises);
        var logo = await getLogo();
        if (logo && logo.blob) {
            data.logo = { blobBase64: await _blobToBase64(logo.blob) };
        }
    } catch(e) {
        console.warn('Could not export photos:', e);
        data.photos = [];
    }
    return data;
}

async function importAllData(data) {
    if (data.version !== 1) throw new Error('Incompatible backup version');
    if (data.settings)     saveSettings(data.settings);
    if (data.workers)      _setList('workers', data.workers);
    if (data.clients)      _setList('clients', data.clients);
    if (data.projects)     _setList('projects', data.projects);
    if (data.subtasks)     _setList('subtasks', data.subtasks);
    if (data.expenses)     _setList('expenses', data.expenses);
    if (data.submissions)  _setList('submissions', data.submissions);
    if (data.invoices)     _setList('invoices', data.invoices);
    if (data.payments)     _setList('payments', data.payments);
    if (data.auditLog)     _setList('auditLog', data.auditLog);
    if (data.setupDone)    setData('setupDone', data.setupDone);
    if (data.photos) {
        for (var i = 0; i < data.photos.length; i++) {
            var photo = data.photos[i];
            if (photo.blobBase64) {
                var resp = await fetch(photo.blobBase64);
                var blob = await resp.blob();
                await savePhoto(Object.assign({}, photo, { blob: blob, blobBase64: undefined }));
            }
        }
    }
    if (data.logo && data.logo.blobBase64) {
        var resp2 = await fetch(data.logo.blobBase64);
        var blob2 = await resp2.blob();
        await saveLogo(blob2);
    }
}

function getLastBackupDate() { return getData('lastBackupDate'); }
function setLastBackupDate() { setData('lastBackupDate', new Date().toISOString()); }
function shouldRemindBackup() {
    var last = getLastBackupDate();
    if (!last) return true;
    return (Date.now() - new Date(last).getTime()) > 30 * 24 * 60 * 60 * 1000;
}

// ─── Export ────────────────────────────────────────────────────────────────
window.AppData = {
    // API config
    API_BASE: API_BASE,
    // Auth / session
    getJwt, setJwt, getCompanyId, setCompanyId, isApiMode,
    getPersistentLogin, savePersistentLogin, clearPersistentLogin,
    apiRegister, apiLoginAdmin, apiLinkDevice, apiLoginWorker, apiLoginWorkerByName, apiLoginWorkerByNameAndPin, apiVerify2FA,
    apiCreateInvite, apiGetInvite, apiUseInvite,
    syncFromServer, isCacheLoaded,
    // Photos (IndexedDB)
    savePhoto, getPhotosByProject, getPhotosBySubmission, getPhoto, deletePhoto,
    saveLogo, getLogo, getAllPhotos, openDB,
    // Raw helpers
    getData, setData, generateId, getAll, getById, save, remove,
    saveEntityAsync, saveWorkerAsync, saveSettingsAsync,
    saveEstimateAsync, saveEquipmentAsync, saveBudgetVersionAsync, saveBudgetItemAsync,
    editSubmissionAsync,
    // Settings
    getSettings, saveSettings, getCompanyName,
    // Workers
    getWorkers, getWorker, saveWorker, deleteWorker, getWorkerByPin,
    // Clients
    getClients, getClient, saveClient, deleteClient,
    // Projects
    getProjects, getProject, saveProject, deleteProject,
    // Tasks
    getTasks, getTask, saveTask, deleteTask,
    // Subtasks
    getSubtasks, getSubtask, saveSubtask, deleteSubtask,
    // Expenses
    getExpenses, getExpense, saveExpense, deleteExpense,
    // Submissions
    getSubmissions, getSubmission, saveSubmission, deleteSubmission,
    getPendingSubmissions, getWorkerSubmissions,
    // Invoices
    getNextProjectNumber,
    getInvoices, getInvoice, saveInvoice, getNextInvoiceNumber,
    // Payments
    getPayments, savePayment,
    // Audit
    addAuditLog, getAuditLog,
    // Admin password (legacy)
    getAdminPassword, setAdminPassword,
    // Setup
    isFirstRun, markSetupDone,
    // Invites
    getInvites, getInvite, saveInvite, deleteInvite,
    // Estimates
    getEstimates, getEstimate, saveEstimate, deleteEstimate,
    // Equipment
    getEquipment, getEquipmentItem, saveEquipment, deleteEquipment,
    // Equipment Logs
    getEquipmentLogs, getEquipmentLog, saveEquipmentLog, deleteEquipmentLog,
    // Notifications
    getNotifications, getNotification, saveNotification, deleteNotification,
    // Budget Versions
    getBudgetVersions, getBudgetVersion, saveBudgetVersion, deleteBudgetVersion,
    // Budget Items
    getBudgetItems, getBudgetItem, saveBudgetItem, deleteBudgetItem,
    // Backup
    exportAllData, importAllData, getLastBackupDate, setLastBackupDate, shouldRemindBackup
};
