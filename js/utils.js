// Utility functions for Ledgerman

const Utils = {
    // Format currency (CAD)
    formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    // Format date for display
    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
    },

    // Format datetime
    formatDateTime(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) +
            ' ' + d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
    },

    // Get today's date in YYYY-MM-DD
    today() {
        return new Date().toISOString().split('T')[0];
    },

    // Escape HTML to prevent XSS
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // JS-based sidebar tooltips — appends to body to avoid overflow clipping
    initTooltips() {
        let tip = document.getElementById('_ledgeTip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = '_ledgeTip';
            tip.style.cssText = 'position:fixed;z-index:99999;background:#1a1a2e;color:#e0e0e0;font-size:.78rem;font-weight:500;padding:5px 11px;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.5);pointer-events:none;opacity:0;transition:opacity .15s;white-space:nowrap';
            document.body.appendChild(tip);
        }
        document.querySelectorAll('[data-tooltip]').forEach(function(el) {
            el.addEventListener('mouseenter', function(e) {
                const label = el.getAttribute('data-tooltip').split('—')[0].trim();
                tip.textContent = label;
                const r = el.getBoundingClientRect();
                tip.style.left = (r.right + 10) + 'px';
                tip.style.top = (r.top + r.height / 2 - 14) + 'px';
                tip.style.opacity = '1';
            });
            el.addEventListener('mouseleave', function() {
                tip.style.opacity = '0';
            });
        });
    },

    // Show toast notification
    showToast(message, type = 'success') {
        // Ensure toast container exists
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        // Auto-remove after 3s
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Confirm dialog
    confirm(message) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay active';
            overlay.innerHTML = `
                <div class="modal" style="max-width:400px">
                    <div class="modal-header"><h3>Confirm</h3></div>
                    <div class="modal-body"><p>${Utils.escapeHtml(message)}</p></div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="confirmNo">Cancel</button>
                        <button class="btn btn-primary" id="confirmYes">Confirm</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            overlay.querySelector('#confirmYes').onclick = () => { overlay.remove(); resolve(true); };
            overlay.querySelector('#confirmNo').onclick = () => { overlay.remove(); resolve(false); };
        });
    },

    // Create element helper
    el(tag, attrs = {}, children = []) {
        const elem = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => {
            if (k === 'className') elem.className = v;
            else if (k === 'innerHTML') elem.innerHTML = v;
            else if (k === 'textContent') elem.textContent = v;
            else if (k.startsWith('on')) elem.addEventListener(k.substring(2).toLowerCase(), v);
            else if (k === 'dataset') Object.assign(elem.dataset, v);
            else elem.setAttribute(k, v);
        });
        children.forEach(c => {
            if (typeof c === 'string') elem.appendChild(document.createTextNode(c));
            else if (c) elem.appendChild(c);
        });
        return elem;
    },

    // Debounce
    debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    },

    // Create thumbnail from image blob
    async createThumbnail(blob, maxSize = 200) {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(resolve, 'image/jpeg', 0.7);
                URL.revokeObjectURL(url);
            };
            img.src = url;
        });
    },

    // Convert blob to data URL
    blobToDataUrl(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    },

    // Validate required fields in a form
    validateForm(formEl) {
        const invalids = formEl.querySelectorAll(':invalid');
        if (invalids.length > 0) {
            invalids[0].focus();
            formEl.classList.add('was-validated');
            return false;
        }
        return true;
    },

    // Get form data as object
    getFormData(formEl) {
        const fd = new FormData(formEl);
        const obj = {};
        fd.forEach((val, key) => { obj[key] = val; });
        return obj;
    },

    // Session management
    _sessionTimer: null,
    _sessionCallback: null,
    _sessionBoundReset: null,

    startSessionTimer(callback) {
        // Remove old listeners if any (prevents leak on re-login)
        this.stopSessionTimer();
        this._sessionCallback = callback;
        this._sessionBoundReset = () => this.resetSessionTimer();
        this.resetSessionTimer();
        ['click', 'keypress', 'mousemove', 'touchstart'].forEach(evt => {
            document.addEventListener(evt, this._sessionBoundReset, { passive: true });
        });
    },

    resetSessionTimer() {
        clearTimeout(this._sessionTimer);
        const timeout = (AppData.getSettings().sessionTimeout || 30) * 60 * 1000;
        this._sessionTimer = setTimeout(() => {
            if (this._sessionCallback) this._sessionCallback();
        }, timeout);
    },

    stopSessionTimer() {
        clearTimeout(this._sessionTimer);
        if (this._sessionBoundReset) {
            ['click', 'keypress', 'mousemove', 'touchstart'].forEach(evt => {
                document.removeEventListener(evt, this._sessionBoundReset);
            });
            this._sessionBoundReset = null;
        }
    },

    // Password strength validation
    validatePassword(pw) {
        const errors = [];
        if (pw.length < 12) errors.push('At least 12 characters');
        if (!/[A-Z]/.test(pw)) errors.push('At least one uppercase letter');
        if (!/[a-z]/.test(pw)) errors.push('At least one lowercase letter');
        if (!/[0-9]/.test(pw)) errors.push('At least one number');
        if (!/[^A-Za-z0-9]/.test(pw)) errors.push('At least one special character');
        return { valid: errors.length === 0, errors };
    },

    // Sanitize user input (strip dangerous characters for display)
    sanitizeInput(str) {
        if (!str) return '';
        return str.replace(/[<>'"]/g, '').trim();
    },
};

window.Utils = Utils;
