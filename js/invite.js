// Worker Invite Setup — Phase 2
// Validates invite via backend API, falls back to localStorage if offline.
// Handles: PIN setup + optional 2FA (TOTP) + email collection.

window.WorkerInvite = {
    _token: null,
    _inviteData: null, // { inviteId, workerId, workerName, companyId }

    show(token) {
        const self = this;
        self._token = token;

        // Always try API first — invite validation is a public endpoint,
        // so it works even if the worker has no companyId in localStorage yet.
        AppData.apiGetInvite(token)
            .then(function(data) {
                self._inviteData = data;
                // Set companyId so isApiMode() returns true during form submission
                if (data.companyId) AppData.setCompanyId(data.companyId);
                self._renderSetup(data.workerName);
            })
            .catch(function(err) {
                // API failed — fall back to localStorage (offline / legacy mode)
                const invite = AppData.getInvite(token);
                if (!invite || invite.used) {
                    self._showInvalid(err.message || 'This invite link is invalid or has already been used.');
                    return;
                }
                const created = new Date(invite.createdAt);
                if (Date.now() - created.getTime() > 7 * 24 * 60 * 60 * 1000) {
                    self._showInvalid('This invite link has expired. Ask your admin for a new one.');
                    return;
                }
                const worker = AppData.getWorker(invite.workerId);
                if (!worker) {
                    self._showInvalid('Worker account not found. Please contact your admin.');
                    return;
                }
                self._inviteData = { workerId: invite.workerId, workerName: worker.name, companyId: '' };
                self._renderSetup(worker.name);
            });
    },

    _showInvalid(message) {
        document.getElementById('app').innerHTML =
            '<div class="login-screen">' +
                '<div class="login-card">' +
                    '<div style="font-size:2.5rem;margin-bottom:12px">🔗</div>' +
                    '<h2>Invalid Invite</h2>' +
                    '<p class="text-muted">' + (message || 'This invite link is not valid.') + '</p>' +
                    '<button class="btn btn-primary btn-block" id="inviteGoLogin">Go to Login</button>' +
                '</div>' +
            '</div>';
        document.getElementById('inviteGoLogin').addEventListener('click', function() {
            window.location.hash = '';
            window.App.showLogin();
        });
    },

    _renderSetup(workerName) {
        const self = this;

        document.getElementById('app').innerHTML =
            '<div class="login-screen">' +
                '<div class="login-card" style="max-width:440px">' +
                    '<div style="font-size:2.5rem;margin-bottom:8px">👷</div>' +
                    '<h2>Welcome, ' + Utils.escapeHtml(workerName) + '!</h2>' +
                    '<p class="text-muted" style="margin-bottom:24px">Set up your account to start submitting work.</p>' +

                    '<form id="inviteSetupForm" novalidate>' +

                        '<div class="form-group" style="margin-bottom:14px">' +
                            '<label>Choose a PIN <span style="font-size:.8rem;color:var(--text2)">(4–6 digits)</span></label>' +
                            '<div style="position:relative">' +
                                '<input type="password" class="form-control pin-input" id="invitePin"' +
                                '   placeholder="Enter PIN" maxlength="6" inputmode="numeric"' +
                                '   pattern="[0-9]{4,6}" required autocomplete="new-password"' +
                                '   style="padding-right:56px">' +
                                '<button type="button" id="toggleInvitePin" class="btn-ghost btn-sm"' +
                                '   onclick="(function(){var i=document.getElementById(\'invitePin\');i.type=i.type===\'password\'?\'text\':\'password\';this.textContent=i.type===\'password\'?\'Show\':\'Hide\';}).call(this)"' +
                                '   style="position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:.75rem">Show</button>' +
                            '</div>' +
                        '</div>' +

                        '<div class="form-group" style="margin-bottom:20px">' +
                            '<label>Confirm PIN</label>' +
                            '<input type="password" class="form-control pin-input" id="invitePinConfirm"' +
                                'placeholder="Re-enter PIN" maxlength="6" inputmode="numeric"' +
                                'pattern="[0-9]{4,6}" required autocomplete="new-password">' +
                        '</div>' +

                        '<div class="form-group" style="margin-bottom:20px">' +
                            '<label>Your Email Address <span style="font-size:.8rem;color:var(--text2)">(for notifications)</span></label>' +
                            '<input type="email" class="form-control" id="inviteEmail"' +
                                'placeholder="your@email.com" autocomplete="email">' +
                        '</div>' +

                        '<div style="border-top:1px solid var(--border);padding-top:16px;margin-bottom:16px">' +
                            '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:.95rem">' +
                                '<input type="checkbox" id="enable2FA" style="width:18px;height:18px">' +
                                '<span>' +
                                    '<strong>Enable 2-Factor Authentication</strong><br>' +
                                    '<span style="font-size:.8rem;color:var(--text2)">Requires Google Authenticator or Authy app</span>' +
                                '</span>' +
                            '</label>' +
                        '</div>' +

                        '<div id="twoFASetup" style="display:none;margin-bottom:20px">' +
                            '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px">' +
                                '<p style="margin:0 0 12px;font-size:.9rem"><strong>Step 1.</strong> Scan this QR code with your authenticator app:</p>' +
                                '<div id="qrContainer" style="text-align:center;margin-bottom:12px;min-height:196px;display:flex;align-items:center;justify-content:center">' +
                                    '<div style="color:var(--text2);font-size:.85rem">Generating…</div>' +
                                '</div>' +
                                '<p style="font-size:.8rem;color:var(--text2);margin:0 0 4px">Can\'t scan? Enter this key manually:</p>' +
                                '<code id="totpSecretDisplay" style="display:block;font-size:.85rem;background:var(--bg);padding:6px 10px;border-radius:4px;word-break:break-all;letter-spacing:1px;cursor:pointer" title="Click to copy"></code>' +
                                '<p style="font-size:.85rem;margin:14px 0 4px"><strong>Step 2.</strong> Enter the 6-digit code to verify:</p>' +
                                '<input type="text" class="form-control" id="verifyTotpCode"' +
                                '   placeholder="000 000" maxlength="7" inputmode="numeric"' +
                                '   style="letter-spacing:6px;text-align:center;font-size:1.3rem">' +
                            '</div>' +
                        '</div>' +

                        '<div class="form-error" id="inviteError" style="display:none;margin-bottom:12px"></div>' +
                        '<button type="submit" class="btn btn-primary btn-block" id="inviteSubmitBtn" style="padding:14px">Set Up Account</button>' +

                    '</form>' +
                '</div>' +
            '</div>';

        // Toggle PIN visibility
        document.getElementById('toggleInvitePin').addEventListener('click', function() {
            const inp = document.getElementById('invitePin');
            inp.type = inp.type === 'password' ? 'text' : 'password';
            this.textContent = inp.type === 'password' ? 'Show' : 'Hide';
        });
        document.getElementById('toggleInvitePinConfirm').addEventListener('click', function() {
            const inp = document.getElementById('invitePinConfirm');
            inp.type = inp.type === 'password' ? 'text' : 'password';
            this.textContent = inp.type === 'password' ? 'Show' : 'Hide';
        });

        // 2FA toggle
        let totpSecret = null;
        document.getElementById('enable2FA').addEventListener('change', async function() {
            const div = document.getElementById('twoFASetup');
            if (this.checked) {
                div.style.display = 'block';
                if (!totpSecret) {
                    totpSecret = TOTP.generateSecret();
                    const issuer = AppData.getCompanyName() || 'Ledgerman';
                    const otpUrl = TOTP.getOtpAuthUrl(totpSecret, workerName, issuer);
                    const qrApiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=' + encodeURIComponent(otpUrl);
                    document.getElementById('totpSecretDisplay').textContent = totpSecret;
                    document.getElementById('qrContainer').innerHTML =
                        '<img src="' + qrApiUrl + '" alt="QR Code"' +
                        ' style="width:192px;height:192px;border-radius:8px;border:4px solid #fff"' +
                        ' onerror="this.style.display=\'none\'">';
                    document.getElementById('totpSecretDisplay').addEventListener('click', function() {
                        navigator.clipboard.writeText(totpSecret).then(function() {
                            Utils.showToast('Secret key copied!');
                        }).catch(function() {});
                    });
                }
            } else {
                div.style.display = 'none';
            }
        });

        // Form submit
        document.getElementById('inviteSetupForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const pin = document.getElementById('invitePin').value;
            const pinConfirm = document.getElementById('invitePinConfirm').value;
            const use2FA = document.getElementById('enable2FA').checked;
            const email = (document.getElementById('inviteEmail').value || '').trim();
            const errEl = document.getElementById('inviteError');
            const submitBtn = document.getElementById('inviteSubmitBtn');
            errEl.style.display = 'none';

            // Validate PIN
            if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
                errEl.textContent = 'PIN must be 4–6 digits.';
                errEl.style.display = 'block';
                return;
            }
            if (pin !== pinConfirm) {
                errEl.textContent = 'PINs do not match.';
                errEl.style.display = 'block';
                return;
            }

            // Validate TOTP if 2FA enabled
            if (use2FA) {
                if (!totpSecret) {
                    errEl.textContent = 'Please enable 2FA and scan the QR code before continuing.';
                    errEl.style.display = 'block';
                    return;
                }
                const code = (document.getElementById('verifyTotpCode').value || '').replace(/\s/g, '');
                if (code.length !== 6 || !/^\d+$/.test(code)) {
                    errEl.textContent = 'Enter the 6-digit code from your authenticator app.';
                    errEl.style.display = 'block';
                    return;
                }
                const valid = await TOTP.verifyToken(totpSecret, code);
                if (!valid) {
                    errEl.textContent = 'Code is incorrect or expired. Make sure your phone\'s time is accurate.';
                    errEl.style.display = 'block';
                    return;
                }
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Setting up…';

            if (AppData.isApiMode()) {
                // API mode: use_invite endpoint sets PIN + 2FA + email on server
                try {
                    const result = await AppData.apiUseInvite(self._token, {
                        pin: pin,
                        twoFAEnabled: use2FA,
                        totpSecret: use2FA ? totpSecret : '',
                        email: email
                    });
                    // Sync to load full data
                    await AppData.syncFromServer();
                    const worker = AppData.getWorker(result.worker.id) || result.worker;
                    history.replaceState(null, '', window.location.pathname + window.location.search);
                    AppData.addAuditLog(worker.name || workerName, 'Invite Accepted', workerName + (use2FA ? ' — 2FA enabled' : ''));
                    Utils.showToast('Account set up successfully!');
                    window.App.currentUser = { type: 'worker', name: worker.name || workerName, id: worker.id };
                    window.App.startWorkerPortal(worker);
                } catch(err) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Set Up Account';
                    errEl.textContent = 'Setup failed: ' + (err.message || 'Please try again.');
                    errEl.style.display = 'block';
                }
            } else {
                // Legacy localStorage mode
                const worker = AppData.getWorker(self._inviteData.workerId);
                if (!worker) {
                    errEl.textContent = 'Worker not found. Please contact your admin.';
                    errEl.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Set Up Account';
                    return;
                }
                // Check PIN uniqueness
                const dup = AppData.getWorkers().find(function(w) { return w.pin === pin && w.id !== worker.id; });
                if (dup) {
                    errEl.textContent = 'This PIN is already taken. Please choose a different one.';
                    errEl.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Set Up Account';
                    return;
                }
                worker.pin = pin;
                worker.twoFAEnabled = use2FA;
                if (email) worker.email = email;
                if (use2FA) worker.totpSecret = totpSecret;
                else delete worker.totpSecret;
                AppData.saveWorker(worker);
                const invite = AppData.getInvite(self._token);
                if (invite) { invite.used = true; invite.usedAt = new Date().toISOString(); AppData.saveInvite(invite); }
                history.replaceState(null, '', window.location.pathname + window.location.search);
                AppData.addAuditLog(worker.name, 'Invite Accepted', worker.name + (use2FA ? ' — 2FA enabled' : ''));
                Utils.showToast('Account set up successfully!');
                window.App.currentUser = { type: 'worker', name: worker.name, id: worker.id };
                window.App.startWorkerPortal(worker);
            }
        });
    }
};
