// Ledgerman — Data layer
// localStorage for structured data, IndexedDB for photos/binaries

const DB_NAME = 'ledgeman_db';
const DB_VERSION = 1;
const STORE_PHOTOS = 'photos';

// IndexedDB setup
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

// Photo operations
async function savePhoto(photoData) {
    // photoData: { id, projectId, workerId, submissionId, date, blob, thumbnail, filename }
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readwrite');
        tx.objectStore(STORE_PHOTOS).put(photoData);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getPhotosByProject(projectId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readonly');
        const idx = tx.objectStore(STORE_PHOTOS).index('projectId');
        const req = idx.getAll(projectId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getPhotosBySubmission(submissionId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readonly');
        const idx = tx.objectStore(STORE_PHOTOS).index('submissionId');
        const req = idx.getAll(submissionId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getPhoto(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readonly');
        const req = tx.objectStore(STORE_PHOTOS).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function deletePhoto(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readwrite');
        tx.objectStore(STORE_PHOTOS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function saveLogo(blob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readwrite');
        tx.objectStore(STORE_PHOTOS).put({ id: 'company_logo', blob, type: 'logo' });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getLogo() {
    return getPhoto('company_logo');
}

async function getAllPhotos() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PHOTOS, 'readonly');
        const req = tx.objectStore(STORE_PHOTOS).getAll();
        req.onsuccess = () => resolve(req.result.filter(p => p.type !== 'logo'));
        req.onerror = () => reject(req.error);
    });
}

// localStorage helpers
function getData(key) {
    try {
        const raw = localStorage.getItem('ledgeman_' + key);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function setData(key, value) {
    localStorage.setItem('ledgeman_' + key, JSON.stringify(value));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Entity CRUD helpers
function getAll(entity) { return getData(entity) || []; }
function getById(entity, id) { return getAll(entity).find(e => e.id === id); }
function save(entity, item) {
    const items = getAll(entity);
    const idx = items.findIndex(e => e.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);
    setData(entity, items);
    return item;
}
function remove(entity, id) {
    setData(entity, getAll(entity).filter(e => e.id !== id));
}

// Company settings
function getSettings() {
    return getData('settings') || {
        companyName: '',
        address: '', city: '', province: 'Ontario', postalCode: '',
        phone: '', email: '',
        hstNumber: '',
        invoicePrefix: 'INV',        // configurable — e.g. "BCL", "INV", "ABC"
        defaultPaymentTerms: 'Net 30',
        defaultInvoiceNotes: '',
        defaultHstRate: 13,
        sessionTimeout: 30,
        setupComplete: false
    };
}
function saveSettings(settings) { setData('settings', settings); }

// Convenience — returns company name or "My Company" if not yet configured
function getCompanyName() {
    return getSettings().companyName || 'My Company';
}

// Workers
function getWorkers() { return getAll('workers'); }
function getWorker(id) { return getById('workers', id); }
function saveWorker(w) { return save('workers', w); }
function deleteWorker(id) { remove('workers', id); }
function getWorkerByPin(pin) { return getWorkers().find(w => w.pin === pin && w.status === 'Active'); }

// Clients
function getClients() { return getAll('clients'); }
function getClient(id) { return getById('clients', id); }
function saveClient(c) { return save('clients', c); }
function deleteClient(id) { remove('clients', id); }

// Projects
function getProjects() { return getAll('projects'); }
function getProject(id) { return getById('projects', id); }
function saveProject(p) { return save('projects', p); }
function deleteProject(id) { remove('projects', id); }

// Subtasks
function getSubtasks(projectId) { return getAll('subtasks').filter(s => s.projectId === projectId); }
function getSubtask(id) { return getById('subtasks', id); }
function saveSubtask(s) { return save('subtasks', s); }
function deleteSubtask(id) { remove('subtasks', id); }

// Expenses
function getExpenses(projectId) { return projectId ? getAll('expenses').filter(e => e.projectId === projectId) : getAll('expenses'); }
function getExpense(id) { return getById('expenses', id); }
function saveExpense(e) { return save('expenses', e); }
function deleteExpense(id) { remove('expenses', id); }

// Worker Submissions (time entries pending approval)
function getSubmissions() { return getAll('submissions'); }
function getSubmission(id) { return getById('submissions', id); }
function saveSubmission(s) { return save('submissions', s); }
function deleteSubmission(id) { remove('submissions', id); }
function getPendingSubmissions() { return getSubmissions().filter(s => s.status === 'Pending'); }
function getWorkerSubmissions(workerId) { return getSubmissions().filter(s => s.workerId === workerId); }

// Invoices
function getInvoices(projectId) { return projectId ? getAll('invoices').filter(i => i.projectId === projectId) : getAll('invoices'); }
function getInvoice(id) { return getById('invoices', id); }
function saveInvoice(i) { return save('invoices', i); }

// Payments
function getPayments(invoiceId) { return invoiceId ? getAll('payments').filter(p => p.invoiceId === invoiceId) : getAll('payments'); }
function savePayment(p) { return save('payments', p); }

// Invoice number generation: PREFIX-YYYY-NNNN (prefix from settings, default INV)
function getNextInvoiceNumber() {
    const year = new Date().getFullYear();
    const prefix = (getSettings().invoicePrefix || 'INV').toUpperCase();
    const invoices = getInvoices();
    const yearInvoices = invoices.filter(i => i.invoiceNumber && i.invoiceNumber.includes(`-${year}-`));
    const maxNum = yearInvoices.reduce((max, i) => {
        const parts = i.invoiceNumber.split('-');
        const num = parseInt(parts[parts.length - 1]);
        return (!isNaN(num) && num > max) ? num : max;
    }, 0);
    return `${prefix}-${year}-${String(maxNum + 1).padStart(4, '0')}`;
}

// Audit log
function addAuditLog(user, action, details) {
    const logs = getAll('auditLog');
    logs.push({
        id: generateId(),
        timestamp: new Date().toISOString(),
        user: user,
        action: action,
        details: details || ''
    });
    setData('auditLog', logs);
}
function getAuditLog() { return getAll('auditLog'); }

// Admin password
function getAdminPassword() { return getData('adminPassword') || 'admin123'; }
function setAdminPassword(pw) { setData('adminPassword', pw); }

// First run check
function isFirstRun() { return !getData('setupDone'); }
function markSetupDone() { setData('setupDone', true); }

// Backup/Restore
async function exportAllData() {
    const data = {
        version: 1,
        exportDate: new Date().toISOString(),
        settings: getSettings(),
        adminPassword: getAdminPassword(),
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
    // Photos from IndexedDB
    try {
        const allPhotos = await getAllPhotos();
        const logo = await getLogo();
        data.photos = allPhotos.map(p => ({
            ...p,
            blob: null, // Can't serialize blobs directly to JSON easily without base64
            blobBase64: null
        }));
        // For full backup, we'd need to convert blobs - will handle with base64
        const photoPromises = allPhotos.map(async (p) => {
            if (p.blob) {
                const reader = new FileReader();
                return new Promise(resolve => {
                    reader.onloadend = () => resolve({ ...p, blobBase64: reader.result, blob: undefined });
                    reader.readAsDataURL(p.blob instanceof Blob ? p.blob : new Blob([p.blob]));
                });
            }
            return { ...p, blob: undefined };
        });
        data.photos = await Promise.all(photoPromises);
        if (logo && logo.blob) {
            const reader = new FileReader();
            data.logo = await new Promise(resolve => {
                reader.onloadend = () => resolve({ blobBase64: reader.result });
                reader.readAsDataURL(logo.blob instanceof Blob ? logo.blob : new Blob([logo.blob]));
            });
        }
    } catch(e) {
        console.warn('Could not export photos:', e);
        data.photos = [];
    }
    return data;
}

async function importAllData(data) {
    if (data.version !== 1) throw new Error('Incompatible backup version');
    if (data.settings) saveSettings(data.settings);
    if (data.adminPassword) setAdminPassword(data.adminPassword);
    if (data.workers) setData('workers', data.workers);
    if (data.clients) setData('clients', data.clients);
    if (data.projects) setData('projects', data.projects);
    if (data.subtasks) setData('subtasks', data.subtasks);
    if (data.expenses) setData('expenses', data.expenses);
    if (data.submissions) setData('submissions', data.submissions);
    if (data.invoices) setData('invoices', data.invoices);
    if (data.payments) setData('payments', data.payments);
    if (data.auditLog) setData('auditLog', data.auditLog);
    if (data.setupDone) setData('setupDone', data.setupDone);
    // Restore photos
    if (data.photos) {
        for (const photo of data.photos) {
            if (photo.blobBase64) {
                const resp = await fetch(photo.blobBase64);
                const blob = await resp.blob();
                await savePhoto({ ...photo, blob, blobBase64: undefined });
            }
        }
    }
    if (data.logo && data.logo.blobBase64) {
        const resp = await fetch(data.logo.blobBase64);
        const blob = await resp.blob();
        await saveLogo(blob);
    }
}

// Last backup date tracking
function getLastBackupDate() { return getData('lastBackupDate'); }
function setLastBackupDate() { setData('lastBackupDate', new Date().toISOString()); }
function shouldRemindBackup() {
    const last = getLastBackupDate();
    if (!last) return true;
    const diff = Date.now() - new Date(last).getTime();
    return diff > 30 * 24 * 60 * 60 * 1000; // 30 days
}

// Export all functions
window.AppData = {
    // IndexedDB
    savePhoto, getPhotosByProject, getPhotosBySubmission, getPhoto, deletePhoto,
    saveLogo, getLogo, getAllPhotos, openDB,
    // localStorage helpers
    getData, setData, generateId, getAll, getById, save, remove,
    // Settings
    getSettings, saveSettings, getCompanyName,
    // Workers
    getWorkers, getWorker, saveWorker, deleteWorker, getWorkerByPin,
    // Clients
    getClients, getClient, saveClient, deleteClient,
    // Projects
    getProjects, getProject, saveProject, deleteProject,
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
    // Admin
    getAdminPassword, setAdminPassword,
    // Setup
    isFirstRun, markSetupDone,
    // Backup
    exportAllData, importAllData, getLastBackupDate, setLastBackupDate, shouldRemindBackup
};
