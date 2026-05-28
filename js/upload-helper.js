/**
 * upload-helper.js — Shared drag-and-drop upload utility for LedgerMan.
 *
 * Usage:
 *   UploadHelper.initDragDrop(opts)
 *
 * opts:
 *   zone            {Element}  The drop zone element (required)
 *   input           {Element}  The <input type="file"> (required)
 *   onFiles         {Function} Called with Array<File> on valid selection (required)
 *   multiple        {Boolean}  Allow multiple files — default: false
 *   accept          {String}   Accepted types, e.g. ".pdf" or "image/*,.pdf"
 *   maxFileSizeMB   {Number}   Max file size per file in MB — optional
 *   listenToInput   {Boolean}  Add change listener to input — default: true
 *                              Set false when module already has its own change handler.
 *   addZoneClass    {Boolean}  Add .lm-upload-zone class + inject label content — default: true
 *                              Set false when the zone already has its own styling/content.
 *   label           {String}   Override default label text
 *   hint            {String}   Hint text, e.g. "PDF only, max 50 MB"
 */
window.UploadHelper = (function () {

    function initDragDrop(opts) {
        var zone          = opts.zone;
        var input         = opts.input;
        var onFiles       = opts.onFiles;
        var multiple      = opts.multiple === true;
        var accept        = opts.accept        || null;
        var maxMB         = opts.maxFileSizeMB || null;
        var maxBytes      = maxMB ? maxMB * 1024 * 1024 : null;
        var listenToInput = (opts.listenToInput !== false);
        var addZoneClass  = (opts.addZoneClass  !== false);
        var label = opts.label || ('Drag ' + (multiple ? 'files' : 'a file') + ' here or click to upload');
        var hint  = opts.hint  || null;

        if (!zone || !input || typeof onFiles !== 'function') {
            console.warn('[UploadHelper] initDragDrop: zone, input, and onFiles are all required.');
            return;
        }

        // ── Style the zone ─────────────────────────────────────────────────────
        if (addZoneClass) {
            zone.classList.add('lm-upload-zone');
            zone.setAttribute('tabindex', '0');
            zone.setAttribute('role', 'button');
            zone.setAttribute('aria-label', label);

            if (!zone.dataset.lmInit) {
                zone.dataset.lmInit = '1';
                zone.innerHTML =
                    '<div class="lm-dz-icon">📂</div>' +
                    '<div class="lm-dz-label">' + _esc(label) + '</div>' +
                    (hint ? '<div class="lm-dz-hint">' + _esc(hint) + '</div>' : '');
            }
        } else {
            // Minimal: just make it keyboard-accessible if needed
            if (!zone.getAttribute('tabindex')) zone.setAttribute('tabindex', '0');
        }

        // ── Drag event handlers ────────────────────────────────────────────────
        zone.addEventListener('dragenter', function (e) {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.add('lm-dz-hover');
        });
        zone.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            zone.classList.add('lm-dz-hover');
        });
        zone.addEventListener('dragleave', function (e) {
            e.preventDefault();
            e.stopPropagation();
            // Only remove highlight if leaving the zone entirely (not entering a child)
            if (!zone.contains(e.relatedTarget)) {
                zone.classList.remove('lm-dz-hover');
            }
        });
        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('lm-dz-hover');
            var dt = e.dataTransfer;
            if (!dt || !dt.files || dt.files.length === 0) return;
            _process(Array.from(dt.files), multiple, accept, maxBytes, maxMB, onFiles);
        });

        // ── Click / keyboard: open file picker ────────────────────────────────
        zone.addEventListener('click', function () { input.click(); });
        zone.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                input.click();
            }
        });

        // ── Optional: input change listener ───────────────────────────────────
        if (listenToInput) {
            input.addEventListener('change', function () {
                if (!this.files || this.files.length === 0) return;
                _process(Array.from(this.files), multiple, accept, maxBytes, maxMB, onFiles);
                this.value = '';   // reset so same file can be re-selected
            });
        }
    }

    // ── Internal file-validation helper ───────────────────────────────────────
    function _process(files, multiple, accept, maxBytes, maxMB, onFiles) {
        if (!multiple) files = files.slice(0, 1);

        var valid    = [];
        var rejected = [];

        for (var i = 0; i < files.length; i++) {
            var file = files[i];

            // File-type check
            if (accept) {
                var allowed = accept.split(',').map(function (t) { return t.trim().toLowerCase(); });
                var name    = file.name.toLowerCase();
                var mime    = (file.type || '').toLowerCase();
                var ok = allowed.some(function (t) {
                    if (t.charAt(0) === '.') {
                        // Extension match (e.g. ".pdf")
                        return name.slice(-t.length) === t;
                    }
                    if (t.slice(-2) === '/*') {
                        // MIME wildcard (e.g. "image/*")
                        return mime.indexOf(t.slice(0, -2)) === 0;
                    }
                    // Exact MIME type
                    return mime === t;
                });
                if (!ok) { rejected.push(file.name + ' (wrong type)'); continue; }
            }

            // File-size check
            if (maxBytes !== null && file.size > maxBytes) {
                rejected.push(file.name + ' (exceeds ' + maxMB + ' MB)');
                continue;
            }

            valid.push(file);
        }

        if (rejected.length) {
            var msg = '⚠ Skipped: ' + rejected.join(', ');
            if (window.Utils && typeof Utils.showToast === 'function') {
                Utils.showToast(msg, 'error');
            } else {
                console.warn('[UploadHelper]', msg);
            }
        }

        if (valid.length > 0) onFiles(valid);
    }

    function _esc(s) {
        if (window.Utils && typeof Utils.escapeHtml === 'function') return Utils.escapeHtml(String(s));
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    return { initDragDrop: initDragDrop };

}());
