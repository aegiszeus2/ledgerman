// Admin Settings Module
window.AdminSettings = {
    _wizardMode: false,
    _wizardStep: 0,
    _logoPreviewUrl: null,

    render(container, params) {
        const self = this;
        const settings = AppData.getSettings();
        params = params || {};
        const esc = Utils.escapeHtml;

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px">
                <h2>Company Settings</h2>
                <button class="btn-secondary btn-sm" id="settingsWizardBtn">Walk me through it</button>
            </div>

            <div id="settingsWizardOverlay" class="hidden"></div>

            <form id="settingsForm" novalidate>
                <div class="card" id="settingsStep1">
                  <div class="card-body">
                    <h3 class="section-title">Company Information</h3>
                    <div class="form-group" style="margin-bottom:12px">
                        <label>Company Name *</label>
                        <input class="form-control" name="companyName" value="${esc(settings.companyName)}" required>
                    </div>
                    <div class="form-group" style="margin-bottom:12px">
                        <label>Address</label>
                        <input class="form-control" name="address" value="${esc(settings.address)}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>City</label>
                            <input class="form-control" name="city" value="${esc(settings.city)}">
                        </div>
                        <div class="form-group">
                            <label>Province</label>
                            <input class="form-control" name="province" value="${esc(settings.province || 'Ontario')}">
                        </div>
                        <div class="form-group">
                            <label>Postal Code</label>
                            <input class="form-control" name="postalCode" value="${esc(settings.postalCode)}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Phone</label>
                            <input class="form-control" name="phone" value="${esc(settings.phone)}" type="tel">
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input class="form-control" name="email" value="${esc(settings.email)}" type="email">
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:12px">
                        <label>HST/GST Number</label>
                        <input class="form-control" name="hstNumber" value="${esc(settings.hstNumber)}">
                    </div>
                  </div>
                </div>

                <div class="card" id="settingsStep2">
                  <div class="card-body">
                    <h3 class="section-title">Company Logo</h3>
                    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
                        <div id="logoPreview" style="width:120px;height:120px;border:2px dashed var(--border);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;overflow:hidden">
                            <span style="color:var(--text2);font-size:.8rem">No logo</span>
                        </div>
                        <div>
                            <input type="file" id="logoInput" accept="image/*" style="display:none">
                            <button type="button" class="btn-secondary btn-sm" id="logoUploadBtn">Upload Logo</button>
                            <button type="button" class="btn-ghost btn-sm" id="logoRemoveBtn" style="display:none">Remove</button>
                            <p style="font-size:.75rem;color:var(--text2);margin-top:4px">PNG or JPG, max 2MB</p>
                        </div>
                    </div>
                  </div>
                </div>

                <div class="card" id="settingsStep3">
                  <div class="card-body">
                    <h3 class="section-title">Invoice Defaults</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Invoice Prefix</label>
                            <input class="form-control" name="invoicePrefix" value="${esc(settings.invoicePrefix || 'INV')}" placeholder="e.g. INV, BCL" maxlength="6">
                        </div>
                        <div class="form-group">
                            <label>Default Payment Terms</label>
                            <input class="form-control" name="defaultPaymentTerms" value="${esc(settings.defaultPaymentTerms || 'Net 30')}">
                        </div>
                        <div class="form-group">
                            <label>Default HST Rate (%)</label>
                            <input class="form-control" name="defaultHstRate" type="number" step="0.01" min="0" max="100" value="${settings.defaultHstRate != null ? settings.defaultHstRate : 13}">
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:12px">
                        <label>Default Invoice Notes</label>
                        <textarea class="form-control" name="defaultInvoiceNotes" rows="3">${esc(settings.defaultInvoiceNotes || '')}</textarea>
                    </div>
                  </div>
                </div>

                <div class="card" id="settingsStep4">
                  <div class="card-body">
                    <h3 class="section-title">Session &amp; Security</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Session Timeout (minutes)</label>
                            <input class="form-control" name="sessionTimeout" type="number" min="5" max="480" value="${settings.sessionTimeout || 30}">
                        </div>
                    </div>
                  </div>
                </div>

                <div class="card" id="settingsStep4b">
                  <div class="card-body">
                    <h3 class="section-title">Email Service (EmailJS)</h3>
                    <p style="font-size:.85rem;color:var(--text2);margin-bottom:12px">
                        Required for email-based 2FA and password reset. Get a free account at
                        <a href="https://www.emailjs.com" target="_blank" rel="noopener" style="color:var(--primary)">emailjs.com</a>
                        (200 emails/month free).
                    </p>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Service ID</label>
                            <input class="form-control" name="emailjs_serviceId" value="${esc(settings.emailjs_serviceId || '')}" placeholder="e.g. service_abc123">
                        </div>
                        <div class="form-group">
                            <label>Template ID</label>
                            <input class="form-control" name="emailjs_templateId" value="${esc(settings.emailjs_templateId || '')}" placeholder="e.g. template_xyz789">
                        </div>
                        <div class="form-group">
                            <label>Public Key</label>
                            <input class="form-control" name="emailjs_publicKey" value="${esc(settings.emailjs_publicKey || '')}" placeholder="e.g. user_AbCdEf123">
                        </div>
                    </div>
                    <p style="font-size:.75rem;color:var(--text2);margin-top:4px">
                        ${EmailService.isConfigured() ? '<span style="color:var(--success)">✓ Email service configured</span>' : '<span style="color:var(--warn)">⚠ Not configured — email 2FA and password reset unavailable</span>'}
                    </p>
                  </div>
                </div>

                <div class="form-actions" id="settingsSaveRow">
                    <button type="submit" class="btn btn-primary">Save Settings</button>
                </div>
            </form>

            <div class="card" id="settingsStep5">
              <div class="card-body">
                <h3 class="section-title">Change Admin Password</h3>
                <form id="passwordForm" novalidate>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Current Password</label>
                            <div style="position:relative"><input class="form-control" type="password" id="pwCurrent" required style="padding-right:40px"><button type="button" class="password-toggle" data-toggle="pwCurrent" style="position:absolute;right:8px;top:50%;transform:translateY(-50%)">Show</button></div>
                        </div>
                        <div class="form-group">
                            <label>New Password</label>
                            <div style="position:relative"><input class="form-control" type="password" id="pwNew" required minlength="12" style="padding-right:40px"><button type="button" class="password-toggle" data-toggle="pwNew" style="position:absolute;right:8px;top:50%;transform:translateY(-50%)">Show</button></div>
                            <p style="font-size:.75rem;color:var(--text2);margin-top:4px">Min 12 chars, mixed case, number, and special character</p>
                        </div>
                        <div class="form-group">
                            <label>Confirm New Password</label>
                            <div style="position:relative"><input class="form-control" type="password" id="pwConfirm" required minlength="12" style="padding-right:40px"><button type="button" class="password-toggle" data-toggle="pwConfirm" style="position:absolute;right:8px;top:50%;transform:translateY(-50%)">Show</button></div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Change Password</button>
                    </div>
                </form>
              </div>
            </div>

            <div class="card" id="settingsStep6">
              <div class="card-body">
                <h3 class="section-title">Portal Analytics</h3>
                <div id="analyticsReport">
                    <p style="font-size:.85rem;color:var(--text2);margin-bottom:12px">
                        Analytics tracks page views, session duration, and friction points (rage clicks, form errors, JS errors) — only with user consent.
                    </p>
                </div>
              </div>
            </div>

            <div class="card" id="settingsModules">
              <div class="card-body">
                <h3 class="section-title">Feature Modules</h3>
                <p style="font-size:.85rem;color:var(--text2);margin-bottom:16px">
                    Enable or disable features for your company. Changes take effect immediately — the sidebar updates on next page load.
                </p>
                <div id="modulesContainer"></div>
              </div>
            </div>

            <div class="card" id="settingsStep7">
              <div class="card-body">
                <h3 class="section-title">Data Backup &amp; Restore</h3>
                <p style="font-size:.85rem;color:var(--text2);margin-bottom:12px">
                    Last backup: ${AppData.getLastBackupDate() ? Utils.formatDateTime(AppData.getLastBackupDate()) : 'Never'}
                </p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
                    <button type="button" class="btn btn-primary" id="exportBtn">Export JSON Backup</button>
                    <button type="button" class="btn btn-secondary" id="importBtn">Import JSON Backup</button>
                    <input type="file" id="importInput" accept=".json" style="display:none">
                </div>
                <div style="background:rgba(233,69,96,.1);border:1px solid var(--accent);border-radius:var(--radius);padding:12px;font-size:.85rem">
                    <strong style="color:var(--accent)">Warning:</strong> Importing a backup will replace ALL current data. Make sure to export a backup first if you want to preserve your existing data.
                </div>
              </div>
            </div>
        `;

        // Load logo preview
        AppData.getLogo().then(function(logoData) {
            if (logoData && logoData.blob) {
                const url = URL.createObjectURL(logoData.blob instanceof Blob ? logoData.blob : new Blob([logoData.blob]));
                self._logoPreviewUrl = url;
                const preview = container.querySelector('#logoPreview');
                preview.innerHTML = '<img src="' + url + '" style="max-width:100%;max-height:100%;object-fit:contain">';
                container.querySelector('#logoRemoveBtn').style.display = '';
            }
        });

        // Settings form submit

        // Password visibility toggle
        const toggleButtons = container.querySelectorAll('.password-toggle');
        toggleButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const fieldId = this.getAttribute('data-toggle');
                const field = container.querySelector('#' + fieldId);
                if (field) {
                    if (field.type === 'password') {
                        field.type = 'text';
                        this.textContent = 'Hide';
                    } else {
                        field.type = 'password';
                        this.textContent = 'Show';
                    }
                }
            });
        });
        container.querySelector('#settingsForm').addEventListener('submit', function(e) {
            e.preventDefault();
            if (!Utils.validateForm(this)) return;
            const fd = Utils.getFormData(this);
            fd.defaultHstRate = parseFloat(fd.defaultHstRate) || 13;
            fd.sessionTimeout = parseInt(fd.sessionTimeout) || 30;
            fd.setupComplete = true;
            AppData.saveSettings(fd);
            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, 'Settings Updated', 'Company settings saved');
            Utils.showToast('Settings saved successfully');
            // Re-init email service after settings change
            if (window.EmailService) EmailService.init();
        });

        // Render analytics report
        if (window.LedgemanAnalytics) {
            const report = LedgemanAnalytics.getReport();
            const reportEl = container.querySelector('#analyticsReport');
            if (report && reportEl) {
                let topPagesHtml = '';
                if (report.topPages.length > 0) {
                    topPagesHtml = '<div style="margin-top:12px"><strong style="font-size:.85rem">Top Pages:</strong>' +
                        '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">' +
                        report.topPages.map(function(p) {
                            return '<span style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px 10px;font-size:.8rem">' +
                                Utils.escapeHtml(p[0]) + ' <strong>(' + p[1] + ')</strong></span>';
                        }).join('') + '</div></div>';
                }
                let frictionHtml = '';
                if (report.totalFrictionEvents > 0) {
                    frictionHtml = '<div style="margin-top:12px"><strong style="font-size:.85rem">Friction Events:</strong>' +
                        '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">' +
                        Object.entries(report.frictionSummary).map(function(entry) {
                            const colors = { rage_click: 'var(--accent)', login_failure: 'var(--warn)', js_error: 'var(--accent)', form_validation_fail: 'var(--warn)' };
                            return '<span style="background:var(--bg2);border:1px solid ' + (colors[entry[0]] || 'var(--border)') + ';border-radius:var(--radius-sm);padding:4px 10px;font-size:.8rem">' +
                                entry[0].replace(/_/g, ' ') + ' <strong>(' + entry[1] + ')</strong></span>';
                        }).join('') + '</div></div>';
                }
                reportEl.innerHTML += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:12px">' +
                    '<div style="text-align:center;padding:12px;background:var(--bg2);border-radius:var(--radius)"><div style="font-size:1.5rem;font-weight:700;color:var(--primary)">' + report.totalSessions + '</div><div style="font-size:.75rem;color:var(--text2)">Total Sessions</div></div>' +
                    '<div style="text-align:center;padding:12px;background:var(--bg2);border-radius:var(--radius)"><div style="font-size:1.5rem;font-weight:700;color:var(--primary)">' + report.last7Days + '</div><div style="font-size:.75rem;color:var(--text2)">Last 7 Days</div></div>' +
                    '<div style="text-align:center;padding:12px;background:var(--bg2);border-radius:var(--radius)"><div style="font-size:1.5rem;font-weight:700;color:var(--primary)">' + report.avgSessionDuration + 'm</div><div style="font-size:.75rem;color:var(--text2)">Avg Duration</div></div>' +
                    '<div style="text-align:center;padding:12px;background:var(--bg2);border-radius:var(--radius)"><div style="font-size:1.5rem;font-weight:700;color:' + (report.totalFrictionEvents > 0 ? 'var(--accent)' : 'var(--success)') + '">' + report.totalFrictionEvents + '</div><div style="font-size:.75rem;color:var(--text2)">Friction Events</div></div>' +
                    '</div>' + topPagesHtml + frictionHtml;
            }
        }

        // Logo upload
        container.querySelector('#logoUploadBtn').addEventListener('click', function() {
            container.querySelector('#logoInput').click();
        });
        container.querySelector('#logoInput').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                Utils.showToast('Logo file must be under 2MB', 'error');
                return;
            }
            AppData.saveLogo(file).then(function() {
                const url = URL.createObjectURL(file);
                if (self._logoPreviewUrl) URL.revokeObjectURL(self._logoPreviewUrl);
                self._logoPreviewUrl = url;
                container.querySelector('#logoPreview').innerHTML = '<img src="' + url + '" style="max-width:100%;max-height:100%;object-fit:contain">';
                container.querySelector('#logoRemoveBtn').style.display = '';
                Utils.showToast('Logo uploaded');
            });
        });
        container.querySelector('#logoRemoveBtn').addEventListener('click', function() {
            AppData.deletePhoto('company_logo').then(function() {
                container.querySelector('#logoPreview').innerHTML = '<span style="color:var(--text2);font-size:.8rem">No logo</span>';
                container.querySelector('#logoRemoveBtn').style.display = 'none';
                if (self._logoPreviewUrl) URL.revokeObjectURL(self._logoPreviewUrl);
                self._logoPreviewUrl = null;
                Utils.showToast('Logo removed');
            });
        });

        // Password form
        container.querySelector('#passwordForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const current = container.querySelector('#pwCurrent').value;
            const newPw = container.querySelector('#pwNew').value;
            const confirm = container.querySelector('#pwConfirm').value;
            if (current !== AppData.getAdminPassword()) {
                Utils.showToast('Current password is incorrect', 'error');
                return;
            }
            if (newPw !== confirm) {
                Utils.showToast('New passwords do not match', 'error');
                return;
            }
            const pwCheck = Utils.validatePassword(newPw);
            if (!pwCheck.valid) {
                Utils.showToast('Password requirements: ' + pwCheck.errors.join(', '), 'error');
                return;
            }
            AppData.setAdminPassword(newPw);
            const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
            AppData.addAuditLog(username, 'Password Changed', 'Admin password was changed');
            Utils.showToast('Password changed successfully');
            container.querySelector('#pwCurrent').value = '';
            container.querySelector('#pwNew').value = '';
            container.querySelector('#pwConfirm').value = '';
        });

        // Export
        container.querySelector('#exportBtn').addEventListener('click', async function() {
            try {
                const data = await AppData.exportAllData();
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'ledgerman-backup-' + Utils.today() + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                AppData.setLastBackupDate();
                const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'Data Exported', 'Full backup exported');
                Utils.showToast('Backup exported successfully');
            } catch (err) {
                Utils.showToast('Export failed: ' + err.message, 'error');
            }
        });

        // Import
        container.querySelector('#importBtn').addEventListener('click', function() {
            container.querySelector('#importInput').click();
        });
        container.querySelector('#importInput').addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const confirmed = await Utils.confirm('Importing a backup will REPLACE ALL current data. Are you sure you want to continue?');
            if (!confirmed) {
                e.target.value = '';
                return;
            }
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                await AppData.importAllData(data);
                const username = (window.App.currentUser && window.App.currentUser.name) || 'Admin';
                AppData.addAuditLog(username, 'Data Imported', 'Backup restored from file');
                Utils.showToast('Data imported successfully. Reloading...');
                setTimeout(function() { location.reload(); }, 1500);
            } catch (err) {
                Utils.showToast('Import failed: ' + err.message, 'error');
            }
            e.target.value = '';
        });

        // Wizard mode
        container.querySelector('#settingsWizardBtn').addEventListener('click', function() {
            self._startWizard(container);
        });

        // Auto-start wizard if requested (e.g. first-run setup)
        if (params.wizard) {
            setTimeout(function() { self._startWizard(container); }, 300);
        }

        // Render module toggles
        self._renderModules(container);
    },

    _MODULE_DEFS: [
        // ── Project Management ──────────────────────────────────────────────
        { key: 'task_assignment',   name: 'Task Assignment',           category: 'Project Management', desc: 'Assign tasks to workers, track progress and completion',                       built: true  },
        { key: 'budget_tracking',   name: 'Budget Tracking',           category: 'Project Management', desc: 'Per-project budgets, variance alerts, cost progress bars',                    built: true  },
        { key: 'gantt_chart',       name: 'Project Timeline (Gantt)',  category: 'Project Management', desc: 'Visual project schedule with task bars and milestones',                       built: true  },
        { key: 'change_orders',     name: 'Change Orders',             category: 'Project Management', desc: 'Track scope changes, client approvals, and budget impacts',                   built: false },
        { key: 'rfis',              name: 'RFIs',                      category: 'Project Management', desc: 'Request for Information log — route, respond, and track design questions',   built: false },
        { key: 'submittals',        name: 'Submittals',                category: 'Project Management', desc: 'Submittal log, review workflow, and spec compliance tracking',               built: false },
        { key: 'scope_management',  name: 'Scope Management',          category: 'Project Management', desc: 'Change requests, scope creep tracking, and approval workflows',              built: true  },
        { key: 'risk_management',   name: 'Risk Management',           category: 'Project Management', desc: 'Risk register, mitigation tracking, and impact scoring',                     built: true  },
        { key: 'resource_planning', name: 'Resource Planning',         category: 'Project Management', desc: 'Team assignments, capacity planning, and skill-based allocation',            built: true  },
        // ── Accounting ─────────────────────────────────────────────────────
        { key: 'invoicing',         name: 'Invoice Generation',        category: 'Accounting',         desc: 'Create and manage client invoices',                                          built: true  },
        { key: 'bid_estimates',     name: 'Bid Estimates',             category: 'Accounting',         desc: 'Estimate templates with costs, markups, and project conversion',             built: true  },
        { key: 'ap_ar_tracking',    name: 'AP/AR Tracking',            category: 'Accounting',         desc: 'Vendor payments, customer invoicing, and payment history',                   built: true  },
        { key: 'cost_allocation',   name: 'Cost Allocation',           category: 'Accounting',         desc: 'Labour costs by project/phase, equipment tracking, burden allocation',       built: true  },
        { key: 'financial_tracking',name: 'Financial Tracking',        category: 'Accounting',         desc: 'Budget vs. actual analysis, cost forecasting, and margin tracking',          built: true  },
        { key: 'progress_billing',  name: 'Progress Billing / SOV',    category: 'Accounting',         desc: 'Schedule of Values, draw requests, and certified progress billing',          built: false },
        { key: 'certified_payroll', name: 'Certified Payroll',         category: 'Accounting',         desc: 'Union and prevailing wage tracking with certified payroll reports',          built: false },
        // ── Field Operations ───────────────────────────────────────────────
        { key: 'daily_reports',     name: 'Daily Reports',             category: 'Field Operations',   desc: 'Crew daily summaries, site conditions, and sign-off workflow',               built: true  },
        { key: 'punch_lists',       name: 'Punch Lists',               category: 'Field Operations',   desc: 'Deficiency tracking, priority levels, and resolution sign-off',              built: true  },
        { key: 'photo_ocr',         name: 'Photo OCR',                 category: 'Field Operations',   desc: 'OCR scanning on field photos and receipts',                                  built: true  },
        { key: 'gps_tracking',      name: 'GPS Tracking',              category: 'Field Operations',   desc: 'GPS coordinates on clock-in/out for crew location tracking',                 built: false },
        { key: 'subcontractor_mgmt',name: 'Subcontractor Management',  category: 'Field Operations',   desc: 'Subcontracts, insurance tracking, and compliance document management',       built: false },
        // ── Quality & Safety ───────────────────────────────────────────────
        { key: 'quality_assurance', name: 'Quality Assurance',         category: 'Quality & Safety',   desc: 'Quality gates, inspection checklists, and defect tracking',                  built: true  },
        { key: 'safety',            name: 'Safety & Incidents',        category: 'Quality & Safety',   desc: 'Incident reporting, toolbox talks, JSAs, and WSIB/OSHA compliance',         built: false },
        // ── Reporting & Security ───────────────────────────────────────────
        { key: 'advanced_reporting',name: 'Advanced Reporting',        category: 'Reporting',          desc: 'Custom analytics, exports, and data visualization dashboards',               built: true  },
        { key: 'two_fa',            name: 'Two-Factor Authentication', category: 'Security',           desc: 'Enable 2FA for worker and admin login',                                      built: true  },
    ],

    _renderModules(container) {
        const self = this;
        const settings = AppData.getSettings();
        const savedModules = settings.modules || {};
        const el = container.querySelector('#modulesContainer');
        if (!el) return;

        // Group by category
        const groups = {};
        self._MODULE_DEFS.forEach(function(mod) {
            if (!groups[mod.category]) groups[mod.category] = [];
            groups[mod.category].push(mod);
        });

        // Default enabled state: use saved value, fallback to built=true → false, built=false → false
        function isEnabled(key) {
            if (savedModules[key] !== undefined) return savedModules[key];
            const def = self._MODULE_DEFS.find(function(m) { return m.key === key; });
            return def ? false : false; // all default to off unless saved
        }

        let html = '';
        Object.keys(groups).forEach(function(cat) {
            html += '<div style="margin-bottom:20px">';
            html += '<div style="font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text2);margin-bottom:10px">' + Utils.escapeHtml(cat) + '</div>';
            groups[cat].forEach(function(mod) {
                const enabled = isEnabled(mod.key);
                const soon = !mod.built;
                html += '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">';
                // Toggle
                html += '<label class="module-toggle" style="position:relative;display:inline-block;width:40px;height:22px;flex-shrink:0">';
                html += '<input type="checkbox" data-module-key="' + mod.key + '" ' + (enabled ? 'checked' : '') + (soon ? ' disabled' : '') + ' style="opacity:0;width:0;height:0">';
                html += '<span style="position:absolute;cursor:' + (soon ? 'not-allowed' : 'pointer') + ';top:0;left:0;right:0;bottom:0;background:' + (enabled ? 'var(--primary)' : 'var(--border)') + ';border-radius:22px;transition:.2s" class="module-slider" data-key="' + mod.key + '"></span>';
                html += '<span style="position:absolute;content:\'\';height:16px;width:16px;left:' + (enabled ? '21px' : '3px') + ';bottom:3px;background:white;border-radius:50%;transition:.2s" class="module-knob" data-key="' + mod.key + '"></span>';
                html += '</label>';
                // Text
                html += '<div style="flex:1;min-width:0">';
                html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
                html += '<span style="font-size:.875rem;font-weight:500' + (soon ? ';color:var(--text2)' : '') + '">' + Utils.escapeHtml(mod.name) + '</span>';
                if (soon) html += '<span style="font-size:.7rem;background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:1px 8px;color:var(--text2)">Coming Soon</span>';
                html += '</div>';
                html += '<div style="font-size:.78rem;color:var(--text2);margin-top:2px">' + Utils.escapeHtml(mod.desc) + '</div>';
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
        });

        el.innerHTML = html;

        // Toggle interaction
        el.querySelectorAll('input[data-module-key]').forEach(function(checkbox) {
            checkbox.addEventListener('change', function() {
                const key = this.getAttribute('data-module-key');
                const val = this.checked;
                // Update slider + knob visuals
                const slider = el.querySelector('.module-slider[data-key="' + key + '"]');
                const knob   = el.querySelector('.module-knob[data-key="' + key + '"]');
                if (slider) slider.style.background = val ? 'var(--primary)' : 'var(--border)';
                if (knob)   knob.style.left = val ? '21px' : '3px';
                // Persist
                const current = AppData.getSettings();
                const modules = Object.assign({}, current.modules || {});
                modules[key] = val;
                AppData.saveSettings(Object.assign({}, current, { modules: modules }));
                Utils.showToast((val ? 'Enabled' : 'Disabled') + ': ' + key.replace(/_/g, ' '));
            });
        });
    },

    _startWizard(container) {
        const steps = [
            { el: '#settingsStep1', title: 'Step 1: Company Information', desc: 'Enter your company name, address, and contact details. These will appear on all invoices.' },
            { el: '#settingsStep2', title: 'Step 2: Company Logo', desc: 'Upload your company logo. It will be displayed on invoices and reports.' },
            { el: '#settingsStep3', title: 'Step 3: Invoice Defaults', desc: 'Set your default payment terms, HST rate, and any standard invoice notes.' },
            { el: '#settingsStep4', title: 'Step 4: Session Settings', desc: 'Configure how long an idle session lasts before automatic logout.' },
            { el: '#settingsStep4b', title: 'Step 5: Email Service', desc: 'Configure EmailJS so workers can reset PINs and receive 2FA codes via email. Free tier: 200 emails/month.' },
            { el: '#settingsSaveRow', title: 'Step 6: Save', desc: 'Click Save Settings to store your company configuration.' },
            { el: '#settingsStep5', title: 'Step 7: Security', desc: 'Change the admin password. Use a strong password with 12+ characters, mixed case, numbers, and symbols.' },
            { el: '#settingsStep6', title: 'Step 8: Analytics', desc: 'View portal usage analytics — page views, session duration, and friction points like rage clicks and form errors.' },
            { el: '#settingsStep7', title: 'Step 9: Backups', desc: 'Use Export to save your data to a file. Import restores from a backup file.' }
        ];
        let step = 0;

        function showStep() {
            // Remove old highlights
            container.querySelectorAll('.wizard-highlight').forEach(function(el) {
                el.classList.remove('wizard-highlight');
                el.style.outline = '';
                el.style.outlineOffset = '';
            });
            // Remove old overlay (appended to body, not container)
            const old = document.getElementById('settingsWizardOverlay');
            if (old) old.remove();

            if (step >= steps.length) {
                Utils.showToast('Settings walkthrough complete!');
                return;
            }

            const target = container.querySelector(steps[step].el);
            if (target) {
                target.style.outline = '2px solid var(--accent)';
                target.style.outlineOffset = '4px';
                target.classList.add('wizard-highlight');
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            const overlay = document.createElement('div');
            overlay.id = 'settingsWizardOverlay';
            overlay.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--card);border:2px solid var(--accent);border-radius:var(--radius);padding:20px;z-index:200;max-width:500px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.4)';
            overlay.innerHTML = '<h3 style="color:var(--accent);margin-bottom:8px">' + Utils.escapeHtml(steps[step].title) + '</h3>' +
                '<p style="font-size:.9rem;color:var(--text2);margin-bottom:16px">' + Utils.escapeHtml(steps[step].desc) + '</p>' +
                '<div style="display:flex;gap:8px;justify-content:space-between">' +
                '<button class="btn-ghost btn-sm" id="wizardClose">Close</button>' +
                '<div style="display:flex;gap:8px">' +
                (step > 0 ? '<button class="btn-secondary btn-sm" id="wizardPrev">Previous</button>' : '') +
                '<button class="btn-primary btn-sm" id="wizardNext">' + (step < steps.length - 1 ? 'Next' : 'Finish') + '</button>' +
                '</div></div>';
            document.body.appendChild(overlay);

            overlay.querySelector('#wizardNext').addEventListener('click', function() { step++; showStep(); });
            if (overlay.querySelector('#wizardPrev')) {
                overlay.querySelector('#wizardPrev').addEventListener('click', function() { step--; showStep(); });
            }
            overlay.querySelector('#wizardClose').addEventListener('click', function() {
                overlay.remove();
                container.querySelectorAll('.wizard-highlight').forEach(function(el) {
                    el.classList.remove('wizard-highlight');
                    el.style.outline = '';
                    el.style.outlineOffset = '';
                });
            });
        }

        showStep();
    }
};
