/**
 * js/ui.js — Ledgerman Shared UI Component Library
 *
 * Reusable UI primitives for admin and worker modules.
 * Depends on: Utils (utils.js must load first).
 *
 * Exported global: window.UI
 */

/* global Utils */
const UI = {

    // ── Modal ──────────────────────────────────────────────────────────────────
    /**
     * Open a modal dialog and return handles to it.
     *
     * @param {string} title        Modal heading text (auto-escaped).
     * @param {string} body         HTML string for the modal body.
     * @param {object} [opts]
     *   @param {string}  opts.width         Max-width, e.g. '560px'  (default '560px')
     *   @param {string}  opts.submitLabel   Primary button label      (default 'Save')
     *   @param {string}  opts.cancelLabel   Cancel button label       (default 'Cancel')
     *   @param {boolean} opts.danger        Red primary button        (default false)
     *   @param {boolean} opts.noFooter      Omit footer entirely      (default false)
     *   @param {boolean} opts.scrollBody    Scrollable body region    (default false)
     * @returns {{ overlay: HTMLElement, close: function, q: function, submitBtn: HTMLElement|null }}
     *   overlay   — The root overlay element.
     *   close()   — Removes the overlay from the DOM.
     *   q(sel)    — overlay.querySelector(sel) shorthand.
     *   submitBtn — The ._ui-submit button, or null when noFooter is true.
     */
    modal(title, body, opts = {}) {
        const {
            width       = '560px',
            submitLabel = 'Save',
            cancelLabel = 'Cancel',
            danger      = false,
            noFooter    = false,
            scrollBody  = false,
        } = opts;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';

        const bodyStyle = scrollBody ? ' style="overflow-y:auto;max-height:60vh"' : '';
        const submitCls = danger ? 'btn btn-danger' : 'btn btn-primary';

        overlay.innerHTML = `
            <div class="modal" style="max-width:${width}" role="dialog" aria-modal="true">
                <div class="modal-header">
                    <h3 style="margin:0">${Utils.escapeHtml(title)}</h3>
                </div>
                <div class="modal-body"${bodyStyle}>${body}</div>
                ${noFooter ? '' : `
                <div class="modal-footer">
                    <button type="button" class="btn btn-quiet _ui-cancel">${Utils.escapeHtml(cancelLabel)}</button>
                    <button type="button" class="${submitCls} _ui-submit">${Utils.escapeHtml(submitLabel)}</button>
                </div>`}
            </div>
        `;

        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        const q = (sel) => overlay.querySelector(sel);

        // Backdrop click
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        // Cancel button
        const cancelBtn = q('._ui-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', close);

        return { overlay, close, q, submitBtn: q('._ui-submit') };
    },


    // ── Empty state ────────────────────────────────────────────────────────────
    /**
     * Render an empty-state placeholder block.
     *
     * @param {string} title      Heading, e.g. 'No Clients Yet'
     * @param {string} [subtitle] Supporting text.
     * @returns {string} HTML string — wrap in a .card if needed.
     */
    emptyState(title, subtitle = '') {
        const sub = subtitle
            ? `<p>${Utils.escapeHtml(subtitle)}</p>`
            : '';
        return `<div class="empty-state"><h3>${Utils.escapeHtml(title)}</h3>${sub}</div>`;
    },


    // ── Status badge ───────────────────────────────────────────────────────────
    /**
     * Render a coloured status badge.
     *
     * @param {string} status    The status string to display.
     * @param {object} [colorMap] Override map of status → colour keyword.
     *   Supported colours: green | amber | red | blue | grey
     *   Built-in defaults handle common construction-app statuses.
     * @returns {string} HTML string — a <span class="status-badge status-{colour}">.
     */
    statusBadge(status, colorMap = {}) {
        const DEFAULTS = {
            'Active':      'green',
            'Completed':   'green',
            'Approved':    'green',
            'Paid':        'green',
            'Submitted':   'amber',
            'Pending':     'amber',
            'Draft':       'amber',
            'Review':      'amber',
            'In Progress': 'blue',
            'On Hold':     'grey',
            'Inactive':    'grey',
            'Cancelled':   'grey',
            'Rejected':    'red',
            'Overdue':     'red',
            'Failed':      'red',
        };
        const colour = colorMap[status] || DEFAULTS[status] || 'grey';
        return `<span class="status-badge status-${colour}">${Utils.escapeHtml(status || '')}</span>`;
    },


    // ── Page header ────────────────────────────────────────────────────────────
    /**
     * Render a standard page header row (title on the left, action buttons on the right).
     *
     * @param {string} title   Page title text.
     * @param {Array}  [actions] Array of button descriptor objects:
     *   { id, label, cls, style, hidden }
     *   - id:     string  HTML id attribute
     *   - label:  string  Button text (auto-escaped)
     *   - cls:    string  CSS class(es), default 'btn btn-primary'
     *   - style:  string  Inline style string
     *   - hidden: bool    Render but hide (display:none)
     * @returns {string} HTML string.
     */
    pageHeader(title, actions = []) {
        const btns = actions.map(a => {
            const cls   = a.cls   || 'btn btn-primary';
            const id    = a.id    ? ` id="${a.id}"` : '';
            const style = (a.style || '') + (a.hidden ? ';display:none' : '');
            const styleAttr = style ? ` style="${style}"` : '';
            return `<button class="${cls}"${id}${styleAttr}>${Utils.escapeHtml(a.label)}</button>`;
        }).join('');

        return `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
            <h2 style="margin:0">${Utils.escapeHtml(title)}</h2>
            ${btns ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${btns}</div>` : ''}
        </div>`;
    },


    // ── Loading spinner ────────────────────────────────────────────────────────
    /**
     * Render a centred loading spinner.
     * Requires a .spinner CSS rule (already present in main.css).
     * @returns {string} HTML string.
     */
    spinner() {
        return '<div style="display:flex;justify-content:center;padding:48px 0">' +
               '<div class="spinner" aria-label="Loading…"></div></div>';
    },


    // ── Set loading state on a button ──────────────────────────────────────────
    /**
     * Disable a button and show a loading label; returns a restore function.
     *
     * @param {HTMLElement} btn
     * @param {string} [loadingLabel]  Text while loading (default 'Saving…')
     * @returns {function} restore()   Call to re-enable the button.
     */
    btnLoading(btn, loadingLabel = 'Saving…') {
        if (!btn) return () => {};
        const orig = btn.textContent;
        btn.disabled    = true;
        btn.textContent = loadingLabel;
        return () => {
            btn.disabled    = false;
            btn.textContent = orig;
        };
    },
};

window.UI = UI;
