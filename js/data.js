// Ledgerman — Data layer v2
// API mode: in-memory cache hydrated from backend, async API writes, JWT auth
// Legacy mode: falls back to localStorage/IndexedDB (no backend / offline)

// ─── API Config ────────────────────────────────────────────────────────────
const API_BASE = (window.LEDGERMAN_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://ledgerman-backend.onrender.com'));

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
    try {
        const res = await fetch(API_BASE + path, Object.assign({}, options, { headers: headers }));
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
async function syncFromServer() {
    try {
        const data = await _apiFetch('/api/sync');
        _cache = {
            workers:     data.workers     || [],
            projects:    data.projects    || [],
            tasks:       data.tasks       || [],
            clients:     data.clients     || [],
            subtasks:    data.subtasks    || [],
            expenses:    data.expenses    || [],
            submissions: data.submissions || [],
            invoices:    data.invoices    || [],
            payments:    data.payments    || [],
            vendors:     data.vendors     || [],
            invites:     data.invites     || [],
            auditLog:    data.auditLog    || [],
            settings:    data.settings    || {},
        };
        // Mirror to localStorage as offline backup
        ['workers','projects','tasks','clients','subtasks','expenses','submissions',
         'invoices','payments','vendors','invites','auditLog'].forEach(function(key) {
            setData(key, _cache[key]);
        });
        setData('settings', _cache.settings);
        console.log('[Ledgerman] Synced from server. Workers:', _cache.workers.length,
            'Projects:', _cache.projects.length, 'Tasks:', _cache.tasks.length, 'Submissions:', _cache.submissions.length);
        return _cache;
    } catch (e) {
        console.warn('[Ledgerman] Sync failed — using localStorage fallback:', e.message);
        // Fall back to localStorage
        _cache = {
            workers:     getData('workers')     || [],
            projects:    getData('projects')    || [],
            clients:     getData('clients')     || [],
            subtasks:    getData('subtasks')    || [],
            expenses:    getData('expenses')    || [],
            submissions: getData('submissions') || [],
            invoices:    getData('invoices')    || [],
            payments:    getData('payments')    || [],
            vendors:     getData('vendors')     || [],
            invites:     getData('invites')     || [],
            auditLog:    getData('auditLog')    || [],
            settings:    getData('settings')    || {},
        };
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
        }).catch(function(e) { console.warn('[API] saveWorker:', e.message); });
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

// ─── Invoices ──────────────────────────────────────────────────────────────
function getInvoices(projectId) { return projectId ? getAll('invoices').filter(function(i) { return i.projectId === projectId; }) : getAll('invoices'); }
function getInvoice(id) { return getById('invoices', id); }
function saveInvoice(i) { return save('invoices', i); }

// ─── Payments ──────────────────────────────────────────────────────────────
function getPayments(invoiceId) { return invoiceId ? getAll('payments').filter(function(p) { return p.invoiceId === invoiceId; }) : getAll('payments'); }
function savePayment(p) { return save('payments', p); }

// ─── Invoice number ────────────────────────────────────────────────────────
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
    // Push to API (use /api/audit convenience endpoint)
    if (isApiMode() && getJwt()) {
        _apiFetch('/api/audit', {
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
        _apiFetch('/api/photos/' + id, { method: 'DELETE' })
            .catch(function(e) { console.warn('[API] deletePhoto:', e.message); });
    }
}

async function saveLogo(blob) {
    var db = await openDB();
    return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE_PHOTOS, 'readwrite');
        tx.objectStore(STORE_PHOTOS).put({ id: 'company_logo', blob: blob, type: 'logo' });
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
    });
}

async function getLogo() { return getPhoto('company_logo'); }

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
    apiRegister, apiLoginAdmin, apiLinkDevice, apiLoginWorker, apiLoginWorkerByName, apiLoginWorkerByNameAndPin, apiVerify2FA,
    apiCreateInvite, apiGetInvite, apiUseInvite,
    syncFromServer, isCacheLoaded,
    // Photos (IndexedDB)
    savePhoto, getPhotosByProject, getPhotosBySubmission, getPhoto, deletePhoto,
    saveLogo, getLogo, getAllPhotos, openDB,
    // Raw helpers
    getData, setData, generateId, getAll, getById, save, remove,
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
    // Backup
    exportAllData, importAllData, getLastBackupDate, setLastBackupDate, shouldRemindBackup
};
