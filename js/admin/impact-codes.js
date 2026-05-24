// Admin Impact Codes Module
// Manages the company's catalogue of impact / non-productive-time cause codes.
window.AdminImpactCodes = (function() {
    'use strict';

    var _container = null;
    var _codes     = [];
    var _categoryFilter = '';

    var CATEGORIES = [
        'Owner / Client',
        'Stakeholder / Third Party',
        'Utility',
        'Environmental',
        'Weather',
        'Access',
        'Permit / Approval',
        'Design / Engineering',
        'Internal',
        'Other',
    ];

    var BILLABLE_STATUSES = [
        'Non-Billable',
        'Billable',
        'Disputed',
        'To Be Reviewed',
    ];

    // ── Internal API helper ────────────────────────────────────────────────────
    async function _api(path, options) {
        var jwt = AppData.getJwt();
        var headers = { 'Content-Type': 'application/json' };
        if (jwt) headers['Authorization'] = 'Bearer ' + jwt;
        var controller = new AbortController();
        var tid = setTimeout(function() { controller.abort(); }, 30000);
        try {
            var res = await fetch(AppData.API_BASE + path,
                Object.assign({}, options, { headers: headers, signal: controller.signal }));
            clearTimeout(tid);
            if (!res.ok) {
                var msg = 'HTTP ' + res.status;
                try { var j = await res.json(); msg = j.error || msg; } catch (e2) {}
                throw new Error(msg);
            }
            return res.json();
        } catch (e) {
            clearTimeout(tid);
            if (e.name === 'AbortError') throw new Error('Request timed out');
            throw e;
        }
    }

    function _esc(str) {
        return Utils.escapeHtml ? Utils.escapeHtml(str) : String(str || '').replace(/[&<>"']/g, function(c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    // ── Load & render ─────────────────────────────────────────────────────────
    async function _load() {
        try {
            _codes = await _api('/api/impact-codes');
        } catch (e) {
            Utils.showToast('Failed to load impact codes: ' + e.message, 'error');
            _codes = [];
        }
    }

    function _filtered() {
        if (!_categoryFilter) return _codes;
        return _codes.filter(function(c) { return c.category === _categoryFilter; });
    }

    function _badgeColor(category) {
        var map = {
            'Owner / Client':          '#3498db',
            'Stakeholder / Third Party':'#9b59b6',
            'Utility':                  '#e67e22',
            'Environmental':            '#27ae60',
            'Weather':                  '#16a085',
            'Access':                   '#f39c12',
            'Permit / Approval':        '#8e44ad',
            'Design / Engineering':     '#2980b9',
            'Internal':                 '#c0392b',
            'Other':                    '#7f8c8d',
        };
        return map[category] || '#7f8c8d';
    }

    function _render() {
        if (!_container) return;
        var filtered = _filtered();
        var esc = _esc;

        var catOptions = '<option value="">All Categories</option>' +
            CATEGORIES.map(function(c) {
                return '<option value="' + esc(c) + '"' + (_categoryFilter === c ? ' selected' : '') + '>' + esc(c) + '</option>';
            }).join('');

        var rows = filtered.map(function(code) {
            var color = _badgeColor(code.category);
            var activeBadge = code.active
                ? '<span style="background:rgba(46,204,113,.2);color:var(--success,#27ae60);font-size:.7rem;padding:2px 8px;border-radius:10px">Active</span>'
                : '<span style="background:rgba(233,69,96,.2);color:var(--accent,#e74c3c);font-size:.7rem;padding:2px 8px;border-radius:10px">Inactive</span>';
            return '<tr>' +
                '<td><strong>' + esc(code.code || '—') + '</strong></td>' +
                '<td>' + esc(code.name) + '</td>' +
                '<td><span style="background:' + color + '22;color:' + color + ';font-size:.72rem;padding:2px 10px;border-radius:10px;white-space:nowrap">' + esc(code.category) + '</span></td>' +
                '<td style="font-size:.82rem;color:var(--text2)">' + esc(code.defaultBillableStatus) + '</td>' +
                '<td>' + activeBadge + '</td>' +
                '<td style="white-space:nowrap">' +
                    '<button class="btn btn-secondary btn-sm edit-ic-btn" data-id="' + esc(code.id) + '" style="margin-right:4px">Edit</button>' +
                    (code.active
                        ? '<button class="btn btn-sm deactivate-ic-btn" data-id="' + esc(code.id) + '" style="color:var(--accent,#e74c3c)">Deactivate</button>'
                        : '<button class="btn btn-sm reactivate-ic-btn" data-id="' + esc(code.id) + '" style="color:var(--success,#27ae60)">Reactivate</button>') +
                '</td>' +
            '</tr>';
        }).join('');

        var emptyRow = filtered.length === 0
            ? '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text2)">No impact codes found. Add one above.</td></tr>'
            : '';

        _container.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">' +
                '<h2>Impact Codes</h2>' +
                '<button class="btn btn-primary btn-sm" id="newIcBtn">+ New Impact Code</button>' +
            '</div>' +
            '<div class="card" style="margin-bottom:16px;padding:12px 16px">' +
                '<label style="font-size:.85rem;font-weight:600;margin-right:8px">Filter by Category:</label>' +
                '<select id="icCategoryFilter" style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:.85rem">' +
                    catOptions +
                '</select>' +
            '</div>' +
            '<div class="card" style="overflow-x:auto">' +
                '<table>' +
                    '<thead><tr>' +
                        '<th>Code</th><th>Name</th><th>Category</th><th>Default Billable</th><th>Status</th><th>Actions</th>' +
                    '</tr></thead>' +
                    '<tbody>' + rows + emptyRow + '</tbody>' +
                '</table>' +
            '</div>';

        // Wire filter
        _container.querySelector('#icCategoryFilter').addEventListener('change', function() {
            _categoryFilter = this.value;
            _render();
        });

        // Wire new button
        _container.querySelector('#newIcBtn').addEventListener('click', function() {
            _showModal(null);
        });

        // Wire edit buttons
        _container.querySelectorAll('.edit-ic-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var code = _codes.find(function(c) { return c.id === btn.dataset.id; });
                if (code) _showModal(code);
            });
        });

        // Wire deactivate buttons
        _container.querySelectorAll('.deactivate-ic-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var code = _codes.find(function(c) { return c.id === btn.dataset.id; });
                if (!code) return;
                var ok = await Utils.confirm('Deactivate "' + code.name + '"? It will no longer appear in new timecards.');
                if (!ok) return;
                try {
                    await _api('/api/impact-codes/' + code.id, { method: 'DELETE' });
                    Utils.showToast(code.name + ' deactivated', 'success');
                    await _load();
                    _render();
                } catch (e) {
                    Utils.showToast('Failed: ' + e.message, 'error');
                }
            });
        });

        // Wire reactivate buttons
        _container.querySelectorAll('.reactivate-ic-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var code = _codes.find(function(c) { return c.id === btn.dataset.id; });
                if (!code) return;
                try {
                    await _api('/api/impact-codes/' + code.id, {
                        method: 'PUT',
                        body: JSON.stringify({ active: true }),
                    });
                    Utils.showToast(code.name + ' reactivated', 'success');
                    await _load();
                    _render();
                } catch (e) {
                    Utils.showToast('Failed: ' + e.message, 'error');
                }
            });
        });
    }

    // ── Modal ─────────────────────────────────────────────────────────────────
    function _showModal(existing) {
        var isEdit = !!existing;
        var esc    = _esc;

        var catOptions = CATEGORIES.map(function(c) {
            return '<option value="' + esc(c) + '"' + (existing && existing.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
        }).join('');

        var billableOptions = BILLABLE_STATUSES.map(function(s) {
            return '<option value="' + esc(s) + '"' + (existing && existing.defaultBillableStatus === s ? ' selected' : '') + '>' + esc(s) + '</option>';
        }).join('');

        var bodyHtml =
            '<div class="form-group">' +
                '<label class="form-label">Short Code <span style="color:var(--text2);font-weight:400">(e.g. OD, UC)</span></label>' +
                '<input class="form-control" type="text" id="icCode" maxlength="10" value="' + esc(existing ? existing.code : '') + '" placeholder="e.g. OD">' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="form-label">Name <span style="color:var(--accent)">*</span></label>' +
                '<input class="form-control" type="text" id="icName" value="' + esc(existing ? existing.name : '') + '" required>' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="form-label">Description</label>' +
                '<textarea class="form-control" id="icDescription" rows="2">' + esc(existing ? existing.description : '') + '</textarea>' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="form-label">Category <span style="color:var(--accent)">*</span></label>' +
                '<select class="form-control" id="icCategory">' + catOptions + '</select>' +
            '</div>' +
            '<div class="form-group">' +
                '<label class="form-label">Default Billable Status</label>' +
                '<select class="form-control" id="icBillableStatus">' + billableOptions + '</select>' +
            '</div>' +
            (isEdit ? '<div class="form-group" style="display:flex;align-items:center;gap:8px">' +
                '<input type="checkbox" id="icActive"' + (existing.active ? ' checked' : '') + '>' +
                '<label for="icActive" style="margin:0;cursor:pointer">Active</label>' +
            '</div>' : '') +
            '<div id="icErrMsg" style="color:var(--accent);font-size:.85rem;margin-bottom:8px;display:none"></div>';

        var modal = UI.modal(
            isEdit ? 'Edit Impact Code' : 'New Impact Code',
            bodyHtml,
            { width: '480px', submitLabel: isEdit ? 'Save Changes' : 'Create' }
        );
        var q = function(s) { return modal.q(s); };

        modal.submitBtn.addEventListener('click', async function() {
            var errEl = q('#icErrMsg');
            errEl.style.display = 'none';

            var name     = (q('#icName').value || '').trim();
            var category = q('#icCategory').value;
            if (!name)     { errEl.textContent = 'Name is required.';     errEl.style.display = 'block'; return; }
            if (!category) { errEl.textContent = 'Category is required.'; errEl.style.display = 'block'; return; }

            var payload = {
                code:                  (q('#icCode').value || '').trim(),
                name:                  name,
                description:           (q('#icDescription').value || '').trim(),
                category:              category,
                defaultBillableStatus: q('#icBillableStatus').value,
            };
            if (isEdit) {
                payload.active = q('#icActive').checked;
            }

            var restore = UI.btnLoading(modal.submitBtn, 'Saving…');
            try {
                if (isEdit) {
                    await _api('/api/impact-codes/' + existing.id, {
                        method: 'PUT',
                        body:   JSON.stringify(payload),
                    });
                    Utils.showToast('Impact code updated', 'success');
                } else {
                    await _api('/api/impact-codes', {
                        method: 'POST',
                        body:   JSON.stringify(payload),
                    });
                    Utils.showToast('Impact code created', 'success');
                }
                modal.close();
                await _load();
                _render();
            } catch (e) {
                errEl.textContent   = 'Failed: ' + e.message;
                errEl.style.display = 'block';
                restore();
            }
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        render: async function(container) {
            _container = container;
            _container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2)">Loading impact codes…</div>';
            await _load();
            _render();
        },
    };
})();
