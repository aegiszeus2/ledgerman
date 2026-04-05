// Main Application Controller
(function() {
    const App = {
        currentUser: null,     // { type: 'admin'|'worker', name: string, id?: string }
        currentView: null,
        currentProjectId: null, // for project detail views
        _loginAttempts: 0,
        _loginLockoutUntil: 0,

        init() {
            // Initialize analytics (cookie consent + friction monitoring)
            if (window.LedgermanAnalytics) {
                LedgermanAnalytics.init();
            }

            // Initialize email service
            if (window.EmailService) {
                EmailService.init();
            }

            // Check for emergency clear (#clear-session) — clears all storage and shows login
            const hash = window.location.hash;
            if (hash === '#clear-session') {
                AppData.clearPersistentLogin();
                AppData.setJwt('');
                window.location.hash = '';
                this.showLogin();
                return;
            }

            // Check for invite link first (#invite/TOKEN)
            if (hash.startsWith('#invite/')) {
                const token = hash.slice(8);
                WorkerInvite.show(token);
                return;
            }

            // Check for persistent login (Keep Me Signed In)
            const persistentLogin = AppData.getPersistentLogin();
            if (persistentLogin && persistentLogin.credentials) {
                this._restorePersistentLogin(persistentLogin);
                return;
            }

            // Signup flow removed — invitations now use pre-filled login only

            // Always show the main login screen — clean slate every session.
            // "Create Company" is a button on the login screen for new signups.
            if (AppData.shouldRemindBackup()) {
                this._pendingBackupReminder = true;
            }
            this.showLogin();
        },

        async _restorePersistentLogin(persistentLogin) {
            const type = persistentLogin.type;
            const creds = persistentLogin.credentials;
            const app = document.getElementById('app');

            // Show loading screen
            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-card">
                        <div style="font-size:2rem;margin-bottom:8px">⏳</div>
                        <h2>Restoring Session</h2>
                        <p class="text-muted">One moment…</p>
                    </div>
                </div>
            `;

            // 15-second timeout for persistent login restoration (prevents mobile hangs)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Session restoration timeout')), 15000)
            );

            try {
                if (type === 'admin') {
                    // Restore admin JWT and try to sync
                    if (creds.jwt) AppData.setJwt(creds.jwt);
                    if (creds.companyId) AppData.setCompanyId(creds.companyId);

                    try {
                        await Promise.race([AppData.syncFromServer(), timeoutPromise]);
                        this.currentUser = { type: 'admin', name: 'Admin' };
                        this.startAdminPanel();
                        return;
                    } catch(err) {
                        // JWT expired or invalid OR timeout — clear and show login
                        console.log('[Ledgerman] Persistent admin JWT invalid or timeout, showing login');
                        AppData.clearPersistentLogin();
                        AppData.setJwt('');
                        this.showAdminLogin();
                    }
                } else if (type === 'worker') {
                    // Restore worker JWT and try to sync
                    if (creds.jwt) AppData.setJwt(creds.jwt);
                    if (creds.companyId) AppData.setCompanyId(creds.companyId);

                    try {
                        const data = await Promise.race([AppData.apiLoginWorkerByNameAndPin(creds.companyName, creds.workerName, creds.pin), timeoutPromise]);
                        await Promise.race([AppData.syncFromServer(), timeoutPromise]);
                        const worker = AppData.getWorker(data.worker.id) || data.worker;
                        this._completeWorkerLogin(worker, 'Restored from persistent login');
                        return;
                    } catch(err) {
                        // Credentials invalid OR timeout — clear and show login
                        console.log('[Ledgerman] Persistent worker credentials invalid or timeout, showing login');
                        AppData.clearPersistentLogin();
                        AppData.setJwt('');
                        this.showWorkerLogin();
                    }
                } else {
                    // Unknown type — clear and show login to prevent stuck loading screen
                    console.warn('[Ledgerman] Unknown persistent login type:', type);
                    AppData.clearPersistentLogin();
                    this.showLogin();
                }
            } catch(err) {
                console.error('[Ledgerman] Error restoring persistent login:', err);
                AppData.clearPersistentLogin();
                this.showLogin();
            }
        },

        showLogin() {
            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-header">
                        <div class="login-logo" id="loginLogo"></div>
                        <h1>Ledgerman</h1>
                        <p class="text-muted">Construction Management</p>
                    </div>
                    <div class="login-options">
                        <div class="login-option" id="workerLoginBtn">
                            <div class="login-option-icon">👷</div>
                            <div><h2>Worker Login</h2>
                            <p>Enter your company name and PIN</p></div>
                        </div>
                        <div class="login-option" id="adminLoginBtn">
                            <div class="login-option-icon">⚙️</div>
                            <div><h2>Admin Login</h2>
                            <p>Enter company name &amp; password</p></div>
                        </div>
                    </div>
                </div>
            `;
            // Load logo — static asset
            document.getElementById('loginLogo').innerHTML = `<img src="assets/images/logo.jpg" alt="Ledgerman Logo" style="max-height:80px;">`;

            document.getElementById('workerLoginBtn').onclick = () => this.showWorkerLogin();
            document.getElementById('adminLoginBtn').onclick = () => this.showAdminLogin();
        },

        showWorkerLogin() {
            const app = document.getElementById('app');

            // Parse pre-filled credentials from URL (for invitations)
            const params = new URLSearchParams(window.location.search);
            const prefilledCompany = params.get('company') || '';
            const prefilledName = params.get('name') || '';
            const prefilledPin = params.get('pin') || '';

            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-card">
                        <h2>Worker Login</h2>
                        <p class="text-muted">Enter your company name, name, and PIN</p>
                        <form id="workerLoginForm">
                            <div class="form-group">
                                <input type="text" class="form-control" id="workerCompanyName"
                                    placeholder="Company Name" value="${Utils.escapeHtml(prefilledCompany)}" required autocomplete="off">
                            </div>
                            <div class="form-group">
                                <input type="text" class="form-control" id="workerName"
                                    placeholder="Employee Name" value="${Utils.escapeHtml(prefilledName)}" required autocomplete="off">
                            </div>
                            <div class="form-group">
                                <div style="position:relative"><input type="password" class="form-control pin-input" id="workerPin" placeholder="Enter PIN" maxlength="6" inputmode="numeric" pattern="[0-9]{4,6}" value="${Utils.escapeHtml(prefilledPin)}" required autocomplete="off" style="padding-right:40px"><button type="button" class="password-toggle" data-toggle="workerPin" style="position:absolute;right:8px;top:50%;transform:translateY(-50%)">Show</button></div>
                            </div>
                            <div class="form-group" style="display:flex;align-items:center;margin-bottom:16px">
                                <input type="checkbox" id="workerKeepMeSignedIn" style="margin-right:8px;cursor:pointer">
                                <label for="workerKeepMeSignedIn" style="cursor:pointer;font-size:.9rem">Keep me signed in</label>
                            </div>
                            <div class="form-error" id="workerLoginError" style="display:none"></div>
                            <button type="submit" class="btn btn-primary btn-block">Login</button>
                            <button type="button" class="btn btn-secondary btn-block mt-1" id="backToLogin">Back</button>
                            <button type="button" class="btn btn-link btn-block mt-1" id="forgotPin" style="color:var(--primary);font-size:.875rem">Forgot PIN?</button>
                        </form>
                    </div>
                </div>
            `;

            // Auto-submit if all credentials are pre-filled
            if (prefilledCompany && prefilledName && prefilledPin) {
                setTimeout(() => {
                    document.getElementById('workerLoginForm').dispatchEvent(new Event('submit'));
                }, 100);
            } else {
                document.getElementById('workerCompanyName').focus();
            }
            document.getElementById('backToLogin').onclick = () => this.showLogin();
            document.getElementById('forgotPin').onclick = () => this._showPinReset();
            document.getElementById('workerLoginForm').onsubmit = async (e) => {
                e.preventDefault();
                const companyName = document.getElementById('workerCompanyName').value.trim();
                const workerName = document.getElementById('workerName').value.trim();
                const pin = document.getElementById('workerPin').value.trim();
                const keepMeSignedIn = document.getElementById('workerKeepMeSignedIn').checked;
                const errEl = document.getElementById('workerLoginError');
                errEl.style.display = 'none';

                if (Date.now() < this._loginLockoutUntil) {
                    const secs = Math.ceil((this._loginLockoutUntil - Date.now()) / 1000);
                    errEl.textContent = 'Too many attempts. Try again in ' + secs + ' seconds.';
                    errEl.style.display = 'block';
                    return;
                }

                if (AppData.isApiMode() || companyName) {
                    // API mode — validate company name + worker name + PIN server-side
                    const loginBtn = document.querySelector('#workerLoginForm button[type="submit"]');
                    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'Logging in…'; }
                    try {
                        const data = await AppData.apiLoginWorkerByNameAndPin(companyName, workerName, pin);
                        if (data.twoFARequired) {
                            // Server says 2FA needed — store for later and go to verification step
                            this._worker2FAData = { companyName, workerName, pin, keepMeSignedIn, workerId: data.workerId, workerName: data.workerName };
                            this._show2FAStep({ id: data.workerId, name: data.workerName });
                        } else {
                            await AppData.syncFromServer();
                            const worker = AppData.getWorker(data.worker.id);
                            // Save persistent login if checkbox is checked
                            if (keepMeSignedIn) {
                                AppData.savePersistentLogin('worker', {
                                    companyName: companyName,
                                    workerName: workerName,
                                    pin: pin,
                                    jwt: AppData.getJwt(),
                                    companyId: AppData.getCompanyId()
                                });
                            }
                            this._completeWorkerLogin(worker || data.worker);
                        }
                    } catch(err) {
                        if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Login'; }
                        this._loginAttempts++;
                        if (window.LedgermanAnalytics) LedgermanAnalytics.logLoginFailure('worker');
                        if (this._loginAttempts >= 5) {
                            this._loginLockoutUntil = Date.now() + 60000; // 1 minute lockout
                            this._loginAttempts = 0;
                        }
                        errEl.textContent = err.message || 'Invalid PIN or worker not found.';
                        errEl.style.display = 'block';
                        document.getElementById('workerPin').value = '';
                        document.getElementById('workerPin').focus();
                    }
                } else {
                    // Legacy localStorage mode
                    const worker = AppData.getWorkerByPin(pin);
                    if (worker) {
                        // Check if email 2FA is enabled (preferred over TOTP)
                        if (worker.email2FAEnabled && worker.email) {
                            this._worker2FAData = { companyName, workerName, pin, keepMeSignedIn };
                            this._showEmail2FAStep(worker);
                        } else if (worker.twoFAEnabled && worker.totpSecret) {
                            this._worker2FAData = { companyName, workerName, pin, keepMeSignedIn };
                            this._show2FAStep(worker);
                        } else {
                            if (keepMeSignedIn) {
                                AppData.savePersistentLogin('worker', {
                                    companyName: companyName,
                                    workerName: workerName,
                                    pin: pin
                                });
                            }
                            this._completeWorkerLogin(worker);
                        }
                    } else {
                        this._loginAttempts++;
                        if (window.LedgermanAnalytics) LedgermanAnalytics.logLoginFailure('worker');
                        if (this._loginAttempts >= 5) {
                            this._loginLockoutUntil = Date.now() + 60000; // 1 minute lockout
                            this._loginAttempts = 0;
                        }
                        errEl.textContent = err.message || 'Invalid PIN or worker not found.';
                        errEl.style.display = 'block';
                        document.getElementById('workerPin').value = '';
                        document.getElementById('workerPin').focus();
                    }
                }
            };
        },

        _show2FAStep(worker) {
            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-card">
                        <div style="font-size:2rem;margin-bottom:8px">🔐</div>
                        <h2>Two-Factor Auth</h2>
                        <p class="text-muted">Hi ${Utils.escapeHtml(worker.name)} — enter the 6-digit code from your authenticator app.</p>
                        <form id="twoFAForm">
                            <div class="form-group" style="margin-bottom:12px">
                                <input type="text" class="form-control" id="totpInput"
                                    placeholder="000 000" maxlength="7" inputmode="numeric"
                                    autocomplete="one-time-code"
                                    style="letter-spacing:6px;text-align:center;font-size:1.4rem;padding:14px">
                            </div>
                            <div class="form-error" id="twoFAError" style="display:none"></div>
                            <button type="submit" class="btn btn-primary btn-block">Verify</button>
                            <button type="button" class="btn btn-secondary btn-block mt-1" id="backToPin">Back</button>
                        </form>
                    </div>
                </div>
            `;
            document.getElementById('totpInput').focus();
            document.getElementById('backToPin').onclick = () => this.showWorkerLogin();
            document.getElementById('twoFAForm').onsubmit = async (e) => {
                e.preventDefault();
                const code = (document.getElementById('totpInput').value || '').replace(/\s/g, '');
                const errEl = document.getElementById('twoFAError');
                errEl.style.display = 'none';

                if (AppData.isApiMode()) {
                    // API verifies TOTP server-side
                    const verifyBtn = document.querySelector('#twoFAForm button[type="submit"]');
                    if (verifyBtn) { verifyBtn.disabled = true; verifyBtn.textContent = 'Verifying…'; }
                    try {
                        await AppData.apiVerify2FA(worker.id, code);
                        await AppData.syncFromServer();
                        const fullWorker = AppData.getWorker(worker.id) || worker;
                        // Save persistent login if checkbox was checked
                        if (this._worker2FAData && this._worker2FAData.keepMeSignedIn) {
                            AppData.savePersistentLogin('worker', {
                                companyName: this._worker2FAData.companyName,
                                workerName: this._worker2FAData.workerName,
                                pin: this._worker2FAData.pin,
                                jwt: AppData.getJwt(),
                                companyId: AppData.getCompanyId()
                            });
                        }
                        this._worker2FAData = null;
                        this._completeWorkerLogin(fullWorker, '2FA verified');
                    } catch(err) {
                        if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.textContent = 'Verify'; }
                        errEl.textContent = 'Invalid code. Please try again — make sure your phone clock is accurate.';
                        errEl.style.display = 'block';
                        document.getElementById('totpInput').value = '';
                        document.getElementById('totpInput').focus();
                    }
                } else {
                    // Legacy — verify client-side
                    const valid = await TOTP.verifyToken(worker.totpSecret, code);
                    if (valid) {
                        // Save persistent login if checkbox was checked
                        if (this._worker2FAData && this._worker2FAData.keepMeSignedIn) {
                            AppData.savePersistentLogin('worker', {
                                companyName: this._worker2FAData.companyName,
                                workerName: this._worker2FAData.workerName,
                                pin: this._worker2FAData.pin
                            });
                        }
                        this._worker2FAData = null;
                        this._completeWorkerLogin(worker, '2FA verified');
                    } else {
                        errEl.textContent = 'Invalid code. Please try again — make sure your phone clock is accurate.';
                        errEl.style.display = 'block';
                        document.getElementById('totpInput').value = '';
                        document.getElementById('totpInput').focus();
                    }
                }
            };
        },

        // ============ EMAIL-BASED 2FA ============

        _showEmail2FAStep(worker) {
            const app = document.getElementById('app');

            // Send the code immediately
            const sendCode = async () => {
                try {
                    await EmailService.send2FACode(worker.email, worker.name);
                    Utils.showToast('Verification code sent to ' + worker.email);
                } catch (err) {
                    Utils.showToast(err.message, 'error');
                }
            };
            sendCode();

            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-card">
                        <div style="font-size:2rem;margin-bottom:8px">📧</div>
                        <h2>Email Verification</h2>
                        <p class="text-muted">Hi ${Utils.escapeHtml(worker.name)} — we sent a 6-digit code to <strong>${Utils.escapeHtml(worker.email)}</strong>.</p>
                        <form id="email2FAForm">
                            <div class="form-group" style="margin-bottom:12px">
                                <input type="text" class="form-control" id="emailCodeInput"
                                    placeholder="000 000" maxlength="7" inputmode="numeric"
                                    autocomplete="one-time-code"
                                    style="letter-spacing:6px;text-align:center;font-size:1.4rem;padding:14px">
                            </div>
                            <div class="form-error" id="email2FAError" style="display:none"></div>
                            <button type="submit" class="btn btn-primary btn-block">Verify</button>
                            <button type="button" class="btn btn-secondary btn-block mt-1" id="resendCode">Resend Code</button>
                            <button type="button" class="btn btn-ghost btn-block mt-1" id="backToPin">Back</button>
                        </form>
                    </div>
                </div>
            `;
            document.getElementById('emailCodeInput').focus();
            document.getElementById('backToPin').onclick = () => this.showWorkerLogin();
            document.getElementById('resendCode').onclick = async () => {
                const btn = document.getElementById('resendCode');
                btn.disabled = true; btn.textContent = 'Sending…';
                try {
                    await EmailService.send2FACode(worker.email, worker.name);
                    Utils.showToast('New code sent!');
                } catch (err) {
                    Utils.showToast(err.message, 'error');
                }
                btn.disabled = false; btn.textContent = 'Resend Code';
            };
            document.getElementById('email2FAForm').onsubmit = (e) => {
                e.preventDefault();
                const code = (document.getElementById('emailCodeInput').value || '').replace(/\s/g, '');
                const errEl = document.getElementById('email2FAError');
                errEl.style.display = 'none';

                const result = EmailService.verifyCode(worker.email, code);
                if (result.valid) {
                    // Save persistent login if checkbox was checked
                    if (this._worker2FAData && this._worker2FAData.keepMeSignedIn) {
                        AppData.savePersistentLogin('worker', {
                            companyName: this._worker2FAData.companyName,
                            workerName: this._worker2FAData.workerName,
                            pin: this._worker2FAData.pin
                        });
                    }
                    this._worker2FAData = null;
                    this._completeWorkerLogin(worker, 'Email 2FA verified');
                } else {
                    errEl.textContent = result.error;
                    errEl.style.display = 'block';
                    document.getElementById('emailCodeInput').value = '';
                    document.getElementById('emailCodeInput').focus();
                }
            };
        },

        // ============ PASSWORD RESET (ADMIN) ============

        _showPasswordReset() {
            const settings = AppData.getSettings();
            const adminEmail = settings.email;

            if (!EmailService.isConfigured()) {
                Utils.showToast('Email service not configured. Contact your administrator.', 'error');
                return;
            }
            if (!adminEmail) {
                Utils.showToast('No company email set in Settings. Cannot send reset code.', 'error');
                return;
            }

            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-card">
                        <div style="font-size:2rem;margin-bottom:8px">🔑</div>
                        <h2>Reset Admin Password</h2>
                        <p class="text-muted">We'll send a verification code to the company email on file.</p>
                        <div id="resetStep1">
                            <p style="font-size:.9rem;margin-bottom:16px">Code will be sent to: <strong>${Utils.escapeHtml(adminEmail)}</strong></p>
                            <button class="btn btn-primary btn-block" id="sendResetCode">Send Reset Code</button>
                            <button class="btn btn-secondary btn-block mt-1" id="backToLogin">Back to Login</button>
                        </div>
                        <div id="resetStep2" style="display:none">
                            <form id="resetCodeForm">
                                <div class="form-group" style="margin-bottom:12px">
                                    <label>Verification Code</label>
                                    <input type="text" class="form-control" id="resetCodeInput"
                                        placeholder="000 000" maxlength="7" inputmode="numeric"
                                        style="letter-spacing:6px;text-align:center;font-size:1.4rem;padding:14px">
                                </div>
                                <div class="form-group" style="margin-bottom:12px">
                                    <label>New Password</label>
                                    <div style="position:relative"><input type="password" class="form-control" id="resetNewPw" required minlength="12" style="padding-right:40px"><button type="button" class="password-toggle" data-toggle="resetNewPw" style="position:absolute;right:8px;top:50%;transform:translateY(-50%)">Show</button></div>
                                    <p style="font-size:.75rem;color:var(--text2);margin-top:4px">Min 12 chars, mixed case, number, special character</p>
                                </div>
                                <div class="form-group" style="margin-bottom:12px">
                                    <label>Confirm New Password</label>
                                    <div style="position:relative"><input type="password" class="form-control" id="resetConfirmPw" required minlength="12" style="padding-right:40px"><button type="button" class="password-toggle" data-toggle="resetConfirmPw" style="position:absolute;right:8px;top:50%;transform:translateY(-50%)">Show</button></div>
                                </div>
                                <div class="form-error" id="resetError" style="display:none"></div>
                                <button type="submit" class="btn btn-primary btn-block">Reset Password</button>
                                <button type="button" class="btn btn-ghost btn-block mt-1" id="resendResetCode">Resend Code</button>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('backToLogin').onclick = () => this.showAdminLogin();

            document.getElementById('sendResetCode').onclick = async () => {
                const btn = document.getElementById('sendResetCode');
                btn.disabled = true; btn.textContent = 'Sending…';
                try {
                    await EmailService.sendPasswordReset(adminEmail, 'Admin');
                    document.getElementById('resetStep1').style.display = 'none';
                    document.getElementById('resetStep2').style.display = 'block';
                    document.getElementById('resetCodeInput').focus();
                    Utils.showToast('Reset code sent to ' + adminEmail);
                } catch (err) {
                    btn.disabled = false; btn.textContent = 'Send Reset Code';
                    Utils.showToast(err.message, 'error');
                }
            };

            const resendBtn = document.getElementById('resendResetCode');
            if (resendBtn) {
                resendBtn.onclick = async () => {
                    resendBtn.disabled = true; resendBtn.textContent = 'Sending…';
                    try {
                        await EmailService.sendPasswordReset(adminEmail, 'Admin');
                        Utils.showToast('New code sent!');
                    } catch (err) {
                        Utils.showToast(err.message, 'error');
                    }
                    resendBtn.disabled = false; resendBtn.textContent = 'Resend Code';
                };
            }

            document.getElementById('resetCodeForm').onsubmit = (e) => {
                e.preventDefault();
                const code = (document.getElementById('resetCodeInput').value || '').replace(/\s/g, '');
                const newPw = document.getElementById('resetNewPw').value;
                const confirmPw = document.getElementById('resetConfirmPw').value;
                const errEl = document.getElementById('resetError');
                errEl.style.display = 'none';

                // Verify code
                const result = EmailService.verifyCode(adminEmail, code);
                if (!result.valid) {
                    errEl.textContent = result.error;
                    errEl.style.display = 'block';
                    return;
                }

                // Validate password strength
                const pwCheck = Utils.validatePassword(newPw);
                if (!pwCheck.valid) {
                    errEl.textContent = 'Password requirements: ' + pwCheck.errors.join(', ');
                    errEl.style.display = 'block';
                    return;
                }
                if (newPw !== confirmPw) {
                    errEl.textContent = 'Passwords do not match.';
                    errEl.style.display = 'block';
                    return;
                }

                // Set new password
                AppData.setAdminPassword(newPw);
                AppData.addAuditLog('System', 'Password Reset', 'Admin password reset via email');
                Utils.showToast('Password reset successfully! Please log in.');
                this.showAdminLogin();
            };
        },

        // ============ PIN RESET (WORKER) ============

        _showPinReset() {
            if (!EmailService.isConfigured()) {
                Utils.showToast('Email service not configured. Contact your admin to reset your PIN.', 'error');
                return;
            }

            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-card">
                        <div style="font-size:2rem;margin-bottom:8px">🔑</div>
                        <h2>Reset PIN</h2>
                        <p class="text-muted">Enter the email address on your account. We'll send a verification code.</p>
                        <div id="pinResetStep1">
                            <form id="pinResetEmailForm">
                                <div class="form-group" style="margin-bottom:12px">
                                    <input type="email" class="form-control" id="pinResetEmail"
                                        placeholder="your@email.com" required autocomplete="email">
                                </div>
                                <div class="form-error" id="pinResetError1" style="display:none"></div>
                                <button type="submit" class="btn btn-primary btn-block">Send Code</button>
                                <button type="button" class="btn btn-secondary btn-block mt-1" id="backToWorkerLogin">Back</button>
                            </form>
                        </div>
                        <div id="pinResetStep2" style="display:none">
                            <form id="pinResetCodeForm">
                                <div class="form-group" style="margin-bottom:12px">
                                    <label>Verification Code</label>
                                    <input type="text" class="form-control" id="pinResetCodeInput"
                                        placeholder="000 000" maxlength="7" inputmode="numeric"
                                        style="letter-spacing:6px;text-align:center;font-size:1.4rem;padding:14px">
                                </div>
                                <div class="form-group" style="margin-bottom:12px">
                                    <label>New PIN (4-6 digits)</label>
                                    <input type="password" class="form-control" id="pinResetNewPin"
                                        pattern="[0-9]{4,6}" minlength="4" maxlength="6"
                                        inputmode="numeric" required placeholder="Enter new PIN">
                                </div>
                                <div class="form-error" id="pinResetError2" style="display:none"></div>
                                <button type="submit" class="btn btn-primary btn-block">Reset PIN</button>
                                <button type="button" class="btn btn-ghost btn-block mt-1" id="resendPinCode">Resend Code</button>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            let _resetWorker = null;

            document.getElementById('backToWorkerLogin').onclick = () => this.showWorkerLogin();

            document.getElementById('pinResetEmailForm').onsubmit = async (e) => {
                e.preventDefault();
                const email = document.getElementById('pinResetEmail').value.trim();
                const errEl = document.getElementById('pinResetError1');
                errEl.style.display = 'none';

                // Find worker by email
                const workers = AppData.getWorkers();
                const worker = workers.find(w => w.email && w.email.toLowerCase() === email.toLowerCase() && w.status === 'Active');
                if (!worker) {
                    errEl.textContent = 'No active account found with this email.';
                    errEl.style.display = 'block';
                    return;
                }

                _resetWorker = worker;
                const btn = e.target.querySelector('button[type="submit"]');
                btn.disabled = true; btn.textContent = 'Sending…';
                try {
                    await EmailService.sendPasswordReset(email, worker.name);
                    document.getElementById('pinResetStep1').style.display = 'none';
                    document.getElementById('pinResetStep2').style.display = 'block';
                    document.getElementById('pinResetCodeInput').focus();
                    Utils.showToast('Code sent to ' + email);
                } catch (err) {
                    btn.disabled = false; btn.textContent = 'Send Code';
                    errEl.textContent = err.message;
                    errEl.style.display = 'block';
                }
            };

            document.getElementById('resendPinCode').onclick = async () => {
                if (!_resetWorker) return;
                const btn = document.getElementById('resendPinCode');
                btn.disabled = true; btn.textContent = 'Sending…';
                try {
                    await EmailService.sendPasswordReset(_resetWorker.email, _resetWorker.name);
                    Utils.showToast('New code sent!');
                } catch (err) {
                    Utils.showToast(err.message, 'error');
                }
                btn.disabled = false; btn.textContent = 'Resend Code';
            };

            document.getElementById('pinResetCodeForm').onsubmit = (e) => {
                e.preventDefault();
                const code = (document.getElementById('pinResetCodeInput').value || '').replace(/\s/g, '');
                const newPin = document.getElementById('pinResetNewPin').value;
                const errEl = document.getElementById('pinResetError2');
                errEl.style.display = 'none';

                if (!_resetWorker) {
                    errEl.textContent = 'Session expired. Please start over.';
                    errEl.style.display = 'block';
                    return;
                }

                // Verify code
                const result = EmailService.verifyCode(_resetWorker.email, code);
                if (!result.valid) {
                    errEl.textContent = result.error;
                    errEl.style.display = 'block';
                    return;
                }

                // Validate new PIN
                if (!newPin || newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
                    errEl.textContent = 'PIN must be 4-6 digits.';
                    errEl.style.display = 'block';
                    return;
                }

                // Check for duplicate PIN
                const existingPinWorker = AppData.getWorkers().find(w =>
                    w.pin === newPin && w.id !== _resetWorker.id
                );
                if (existingPinWorker) {
                    errEl.textContent = 'This PIN is already in use. Choose a different one.';
                    errEl.style.display = 'block';
                    return;
                }

                // Set new PIN
                _resetWorker.pin = newPin;
                AppData.saveWorker(_resetWorker);
                AppData.addAuditLog(_resetWorker.name, 'PIN Reset', 'Self-service PIN reset via email');
                Utils.showToast('PIN reset successfully! Please log in.');
                this.showWorkerLogin();
            };
        },

        // Called after PIN (+ optional 2FA) are verified
        _completeWorkerLogin(worker, auditNote) {
            this.currentUser = { type: 'worker', name: worker.name, id: worker.id };
            AppData.addAuditLog(worker.name, 'Worker Login', auditNote || '');
            // First-time login — ask for email if not on file
            if (!worker.email) {
                this._showEmailPrompt(worker);
            } else {
                this.startWorkerPortal(worker);
            }
        },

        _showEmailPrompt(worker) {
            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-card">
                        <div style="font-size:2rem;margin-bottom:8px">✉️</div>
                        <h2>One Last Thing</h2>
                        <p class="text-muted" style="margin-bottom:20px">What&rsquo;s your email address? We&rsquo;ll use it to send you updates and notifications about your work.</p>
                        <form id="emailPromptForm">
                            <div class="form-group" style="margin-bottom:16px">
                                <input type="email" class="form-control" id="workerEmail"
                                    placeholder="your@email.com" autocomplete="email"
                                    style="font-size:1rem;padding:12px">
                            </div>
                            <div class="form-error" id="emailPromptError" style="display:none"></div>
                            <button type="submit" class="btn btn-primary btn-block">Save & Continue</button>
                            <button type="button" class="btn btn-secondary btn-block mt-1" id="skipEmail">Skip for now</button>
                        </form>
                    </div>
                </div>
            `;
            document.getElementById('workerEmail').focus();

            const proceed = () => {
                const w = AppData.getWorker(worker.id);
                this.startWorkerPortal(w || worker);
            };

            document.getElementById('skipEmail').onclick = proceed;

            document.getElementById('emailPromptForm').onsubmit = (e) => {
                e.preventDefault();
                const email = document.getElementById('workerEmail').value.trim();
                if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    const err = document.getElementById('emailPromptError');
                    err.textContent = 'Please enter a valid email address.';
                    err.style.display = 'block';
                    return;
                }
                if (email) {
                    const w = AppData.getWorker(worker.id);
                    if (w) {
                        w.email = email;
                        AppData.saveWorker(w);
                        AppData.addAuditLog(w.name, 'Email Added', email);
                    }
                }
                proceed();
            };
        },

        showAdminLogin() {
            const app = document.getElementById('app');

            // Parse pre-filled credentials from URL (for invitations)
            const params = new URLSearchParams(window.location.search);
            const prefilledCompany = params.get('company') || '';
            const prefilledPassword = params.get('password') || '';

            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-card">
                        <h2>Admin Login</h2>
                        <p class="text-muted">Enter company name and password</p>
                        <form id="adminLoginForm">
                            <div class="form-group">
                                <input type="text" class="form-control" id="adminCompanyName"
                                    placeholder="Company Name" value="${Utils.escapeHtml(prefilledCompany)}" required autocomplete="off">
                            </div>
                            <div class="form-group">
                                <input type="password" class="form-control" id="adminPassword"
                                    placeholder="Password" value="${Utils.escapeHtml(prefilledPassword)}" required autocomplete="off">
                            </div>
                            <div class="form-group" style="display:flex;align-items:center;margin-bottom:16px">
                                <input type="checkbox" id="adminKeepMeSignedIn" style="margin-right:8px;cursor:pointer">
                                <label for="adminKeepMeSignedIn" style="cursor:pointer;font-size:.9rem">Keep me signed in</label>
                            </div>
                            <div class="form-error" id="adminLoginError" style="display:none"></div>
                            <button type="submit" class="btn btn-primary btn-block" id="adminLoginBtn">Login</button>
                            <button type="button" class="btn btn-secondary btn-block mt-1" id="backToLogin">Back</button>
                            <button type="button" class="btn btn-link btn-block mt-1" id="forgotPassword" style="color:var(--primary);font-size:.875rem">Forgot Password?</button>
                        </form>
                    </div>
                </div>
            `;

            // Auto-submit if both credentials are pre-filled
            if (prefilledCompany && prefilledPassword) {
                setTimeout(() => {
                    document.getElementById('adminLoginForm').dispatchEvent(new Event('submit'));
                }, 100);
            } else {
                document.getElementById('adminCompanyName').focus();
            }
            document.getElementById('backToLogin').onclick = () => this.showLogin();
            document.getElementById('forgotPassword').onclick = () => this._showPasswordReset();
            document.getElementById('adminLoginForm').onsubmit = async (e) => {
                e.preventDefault();
                const companyName = document.getElementById('adminCompanyName').value.trim();
                const pw = document.getElementById('adminPassword').value.trim();
                const keepMeSignedIn = document.getElementById('adminKeepMeSignedIn').checked;
                const errEl = document.getElementById('adminLoginError');
                const btn = document.getElementById('adminLoginBtn');
                errEl.style.display = 'none';

                if (Date.now() < this._loginLockoutUntil) {
                    const secs = Math.ceil((this._loginLockoutUntil - Date.now()) / 1000);
                    errEl.textContent = 'Too many attempts. Try again in ' + secs + ' seconds.';
                    errEl.style.display = 'block';
                    return;
                }

                // Always try API first if company name is provided
                if (companyName) {
                    btn.disabled = true; btn.textContent = 'Logging in…';
                    try {
                        await AppData.apiLoginAdmin(companyName, pw);
                        await AppData.syncFromServer();
                        // Save persistent login if checkbox is checked
                        if (keepMeSignedIn) {
                            AppData.savePersistentLogin('admin', {
                                companyName: companyName,
                                password: pw,
                                jwt: AppData.getJwt(),
                                companyId: AppData.getCompanyId()
                            });
                        }
                        this.currentUser = { type: 'admin', name: 'Admin' };
                        AppData.addAuditLog('Admin', 'Admin Login', '');
                        this.startAdminPanel();
                    } catch(err) {
                        btn.disabled = false; btn.textContent = 'Login';
                        this._loginAttempts++;
                        if (window.LedgermanAnalytics) LedgermanAnalytics.logLoginFailure('admin');
                        if (this._loginAttempts >= 5) {
                            this._loginLockoutUntil = Date.now() + 60000; // 1 minute lockout
                            this._loginAttempts = 0;
                        }
                        errEl.textContent = err.message || 'Invalid password.';
                        errEl.style.display = 'block';
                        document.getElementById('adminPassword').value = '';
                        document.getElementById('adminPassword').focus();
                    }
                } else if (AppData.isApiMode()) {
                    // Fallback: If no company name and already in API mode, try with stored company ID
                    btn.disabled = true; btn.textContent = 'Logging in…';
                    try {
                        await AppData.apiLinkDevice(AppData.getCompanyId(), pw);
                        await AppData.syncFromServer();
                        // Save persistent login if checkbox is checked
                        if (keepMeSignedIn) {
                            AppData.savePersistentLogin('admin', {
                                companyName: companyName || AppData.getCompanyName(),
                                password: pw,
                                jwt: AppData.getJwt(),
                                companyId: AppData.getCompanyId()
                            });
                        }
                        this.currentUser = { type: 'admin', name: 'Admin' };
                        AppData.addAuditLog('Admin', 'Admin Login', '');
                        this.startAdminPanel();
                    } catch(err) {
                        btn.disabled = false; btn.textContent = 'Login';
                        this._loginAttempts++;
                        if (window.LedgermanAnalytics) LedgermanAnalytics.logLoginFailure('admin');
                        if (this._loginAttempts >= 5) {
                            this._loginLockoutUntil = Date.now() + 60000; // 1 minute lockout
                            this._loginAttempts = 0;
                        }
                        errEl.textContent = err.message || 'Invalid password.';
                        errEl.style.display = 'block';
                        document.getElementById('adminPassword').value = '';
                        document.getElementById('adminPassword').focus();
                    }
                } else {
                    // Legacy localStorage mode (offline only)
                    if (pw === AppData.getAdminPassword()) {
                        if (keepMeSignedIn) {
                            AppData.savePersistentLogin('admin', {
                                companyName: companyName,
                                password: pw
                            });
                        }
                        this.currentUser = { type: 'admin', name: 'Admin' };
                        AppData.addAuditLog('Admin', 'Admin Login', '');
                        this.startAdminPanel();
                    } else {
                        const workers = AppData.getWorkers().filter(w => w.role === 'Approver' && w.status === 'Active');
                        const approver = workers.find(w => w.pin === pw);
                        if (approver) {
                            if (keepMeSignedIn) {
                                AppData.savePersistentLogin('admin', {
                                    companyName: companyName,
                                    password: pw
                                });
                            }
                            this.currentUser = { type: 'admin', name: approver.name, id: approver.id };
                            AppData.addAuditLog(approver.name, 'Approver Login', '');
                            this.startAdminPanel();
                        } else {
                            this._loginAttempts++;
                            if (window.LedgermanAnalytics) LedgermanAnalytics.logLoginFailure('admin');
                            if (this._loginAttempts >= 5) {
                                this._loginLockoutUntil = Date.now() + 60000; // 1 minute lockout
                                this._loginAttempts = 0;
                            }
                            errEl.textContent = 'Invalid password. Please try again.';
                            errEl.style.display = 'block';
                            document.getElementById('adminPassword').value = '';
                            document.getElementById('adminPassword').focus();
                        }
                    }
                }
            };
        },

        // ============ FIRST RUN ============

        // showWelcome() — REMOVED. Self-service signup/company linking is gone.
        // Invitations now use pre-filled login only via URL parameters.

        // ============ ADMIN PANEL ============

        _buildNavHtml() {
            const m = (AppData.getSettings().modules) || {};
            const on = (key, def) => (m[key] !== undefined ? m[key] : def);
            const item = (route, icon, label, tooltip, extra) =>
                `<a class="nav-item" data-route="${route}" data-tooltip="${tooltip}"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span>${extra || ''}</a>`;

            return [
                // ── Always-on core ─────────────────────────────────────────
                item('dashboard',      '📊', 'Dashboard',    'Dashboard — overview & quick actions'),
                item('projects',       '🏗️', 'Projects',     'Projects — manage active jobs'),
                item('approvals',      '✅', 'Approvals',    'Approvals — review worker time submissions', '<span class="nav-badge" id="approvalBadge" style="display:none"></span>'),
                // ── Module-gated accounting ────────────────────────────────
                on('invoicing',     true)  ? item('invoices',  '📄', 'Invoices',     'Invoices — create & track client invoices') : '',
                on('bid_estimates', false) ? item('estimates', '💹', 'Bid Estimates','Estimates — bid estimates and project costing') : '',
                // ── Always-on operations ───────────────────────────────────
                item('expenses-review','💰', 'Expenses',     'Expenses — review worker-submitted costs'),
                item('vendors',        '🏢', 'Vendors',      'Vendors — suppliers & subcontractors'),
                item('clients',        '👥', 'Clients',      'Clients — your client address book'),
                item('users',          '👷', 'Workers',      'Workers — manage team & PINs'),
                item('photos',         '📸', 'Photos',       'Photos — job site photo log'),
                item('reports',        '📈', 'Reports',      'Reports — cost, labour & invoice summaries'),
                // ── Module-gated Tier 3 ────────────────────────────────────
                on('task_assignment',  false) ? item('task-assignment', '☑️',  'Task Assignment',  'Task Assignment — assign tasks to workers') : '',
                on('budget_tracking',  false) ? item('budget-tracking', '💹',  'Budget Tracking',  'Budget Tracking — project budgets vs actual spending') : '',
                on('daily_reports',    false) ? item('daily-reports',   '📋',  'Supervisor Reports', 'Supervisor Reports — crew summaries and site conditions') : '',
                on('punch_lists',      false) ? item('punch-lists',     '📌',  'Punch Lists',      'Punch Lists — deficiency tracking and sign-off') : '',
                on('gantt_chart',      false) ? item('gantt-chart',     '📅',  'Project Timeline', 'Project Timeline — visual schedule of tasks and milestones') : '',
                // ── Always-on last ─────────────────────────────────────────
                item('settings', '⚙️', 'Settings', 'Settings — company info, modules, password & backups'),
                item('help',     '❓', 'Help',      'Help — how to use Ledgerman'),
            ].join('\n');
        },

        startAdminPanel() {
            Utils.startSessionTimer(() => this.logout());
            const app = document.getElementById('app');
            app.className = 'admin-mode';
            app.innerHTML = `
                <div class="admin-sidebar" id="adminSidebar">
                    <div class="sidebar-brand">
                        <div class="brand-icon" id="sidebarLogo">L</div>
                        <span class="brand-text">${AppData.getCompanyName()}</span>
                    </div>
                    <nav id="adminNav">${this._buildNavHtml()}</nav>
                </div>
                <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
                <div class="admin-main">
                    <header class="admin-header">
                        <div class="header-left">
                            <button class="btn btn-icon sidebar-toggle" id="sidebarToggle">☰</button>
                            <span class="header-title">${AppData.getCompanyName()}</span>
                        </div>
                        <div class="header-right">
                            <span class="user-name">Logged in as: <strong>${Utils.escapeHtml(this.currentUser.name)}</strong></span>
                            <button class="btn btn-secondary btn-sm" id="adminLogout">Logout</button>
                        </div>
                    </header>
                    <main class="admin-content" id="adminContent">
                    </main>
                </div>
            `;

            // Load logo into brand icon
            AppData.getLogo().then(logo => {
                if (logo && logo.blob) {
                    const url = URL.createObjectURL(logo.blob);
                    const el = document.getElementById('sidebarLogo');
                    el.innerHTML = `<img src="${url}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:var(--radius-sm)">`;
                    el.textContent = ''; // clear fallback letter
                }
            }).catch(() => {});

            // Update approval badge
            this.updateApprovalBadge();

            // Sidebar navigation
            document.querySelectorAll('.nav-item').forEach(item => {
                item.onclick = (e) => {
                    e.preventDefault();
                    this.navigate(item.dataset.route);
                };
            });

            // Init JS tooltips (CSS approach blocked by sidebar overflow)
            Utils.initTooltips();

            // Sidebar toggle for mobile
            document.getElementById('sidebarToggle').onclick = () => {
                const sidebar = document.getElementById('adminSidebar');
                const backdrop = document.getElementById('sidebarBackdrop');
                sidebar.classList.toggle('open');
                backdrop.classList.toggle('active', sidebar.classList.contains('open'));
            };

            // Close sidebar on backdrop click (mobile)
            document.getElementById('sidebarBackdrop').onclick = () => {
                document.getElementById('adminSidebar').classList.remove('open');
                document.getElementById('sidebarBackdrop').classList.remove('active');
            };

            // Logout
            document.getElementById('adminLogout').onclick = () => this.logout();

            // Navigate to dashboard
            this.navigate('dashboard');

            // Backup reminder
            if (this._pendingBackupReminder) {
                this._pendingBackupReminder = false;
                setTimeout(() => {
                    Utils.showToast('Reminder: It\'s been over 30 days since your last backup. Go to Settings to export your data.', 'warning');
                }, 2000);
            }
        },

        updateApprovalBadge() {
            const badge = document.getElementById('approvalBadge');
            if (!badge) return;
            const count = AppData.getPendingSubmissions().length;
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        },

        navigate(route, params = {}) {
            // Authwall: block navigation if not authenticated
            if (!this.currentUser) {
                this.showLogin();
                return;
            }

            this.currentView = route;
            const content = document.getElementById('adminContent');
            if (!content) return;

            // Update active nav
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.route === route);
            });

            // Close mobile sidebar + backdrop
            const sidebar = document.getElementById('adminSidebar');
            if (sidebar) sidebar.classList.remove('open');
            const backdrop = document.getElementById('sidebarBackdrop');
            if (backdrop) backdrop.classList.remove('active');

            // Route to module
            switch(route) {
                case 'dashboard':
                    if (window.AdminDashboard) AdminDashboard.render(content);
                    break;
                case 'settings':
                    if (window.AdminSettings) AdminSettings.render(content, params);
                    break;
                case 'clients':
                    if (window.AdminClients) AdminClients.render(content);
                    break;
                case 'projects':
                    if (window.AdminProjects) AdminProjects.render(content, params);
                    break;
                case 'project-detail':
                    this.currentProjectId = params.projectId;
                    if (window.AdminProjects) AdminProjects.renderDetail(content, params.projectId, params);
                    break;
                case 'expenses':
                    if (window.AdminExpenses) AdminExpenses.render(content, params.projectId);
                    break;
                case 'expenses-review':
                    if (window.AdminExpensesReview) AdminExpensesReview.render(content);
                    break;
                case 'vendors':
                    if (window.AdminVendors) AdminVendors.render(content, params);
                    break;
                case 'vendor-detail':
                    if (window.AdminVendors) AdminVendors.renderDetail(content, params.vendorId);
                    break;
                case 'approvals':
                    if (window.AdminApprovals) AdminApprovals.render(content);
                    break;
                case 'invoices':
                    if (window.AdminInvoices) AdminInvoices.render(content, params);
                    break;
                case 'invoice-detail':
                    if (window.AdminInvoices) AdminInvoices.renderDetail(content, params.invoiceId);
                    break;
                case 'invoice-create':
                    if (window.AdminInvoices) AdminInvoices.renderCreate(content, params);
                    break;
                case 'estimates':
                    if (window.AdminEstimates) AdminEstimates.render(content, params);
                    break;
                case 'estimate-detail':
                    if (window.AdminEstimates) AdminEstimates.renderDetail(content, params.estimateId, params);
                    break;
                case 'users':
                    if (window.AdminUsers) AdminUsers.render(content, params);
                    break;
                case 'photos':
                    if (window.AdminPhotos) AdminPhotos.render(content, params);
                    break;
                case 'reports':
                    if (window.AdminReports) AdminReports.render(content);
                    break;
                case 'help':
                    if (window.AdminHelp) AdminHelp.render(content);
                    break;
                case 'task-assignment':
                    if (window.AdminTaskAssignment) AdminTaskAssignment.render(content, params);
                    break;
                case 'budget-tracking':
                    if (window.AdminBudgetTracking) AdminBudgetTracking.render(content, params);
                    break;
                case 'daily-reports':
                    if (window.AdminDailyReports) AdminDailyReports.render(content, params);
                    break;
                case 'punch-lists':
                    if (window.AdminPunchLists) AdminPunchLists.render(content, params);
                    break;
                case 'gantt-chart':
                    if (window.AdminGanttChart) AdminGanttChart.render(content, params);
                    break;
                default:
                    content.innerHTML = '<div class="empty-state"><h2>Page not found</h2></div>';
            }

            // Inject "? How To" help button after every page render
            // setTimeout(300) ensures button fires after async module renders settle
            const _helpRoute = route;
            setTimeout(() => {
                if (App.currentView !== _helpRoute) return; // user navigated away
                const old = document.getElementById('pageHelpBtn');
                if (old) old.remove();
                if (_helpRoute !== 'help' && window.LedgermanHelp && window.LedgermanHelp[_helpRoute]) {
                    const helpBtn = document.createElement('button');
                    helpBtn.id = 'pageHelpBtn';
                    helpBtn.title = 'How to use this page';
                    helpBtn.innerHTML = '? How To';
                    helpBtn.style.cssText = [
                        'position:fixed',
                        'bottom:24px',
                        'right:24px',
                        'z-index:888',
                        'background:#1a3a5c',
                        'color:#ffffff',
                        'border:2px solid #ffffff',
                        'border-radius:20px',
                        'padding:9px 18px',
                        'font-size:.85rem',
                        'font-weight:700',
                        'cursor:pointer',
                        'box-shadow:0 4px 14px rgba(0,0,0,.4)',
                        'transition:opacity .2s'
                    ].join(';');
                    helpBtn.onmouseenter = () => helpBtn.style.opacity = '.85';
                    helpBtn.onmouseleave = () => helpBtn.style.opacity = '1';
                    helpBtn.onclick = () => Utils.showHelpModal(_helpRoute);
                    document.body.appendChild(helpBtn);
                }
            }, 300);

            // Scroll to top
            content.scrollTop = 0;

            // Update approval badge
            this.updateApprovalBadge();
        },

        // ============ WORKER PORTAL ============

        startWorkerPortal(worker) {
            Utils.startSessionTimer(() => this.logout());
            const app = document.getElementById('app');
            app.className = 'worker-mode';
            app.innerHTML = `
                <header class="worker-header">
                    <h3>${AppData.getCompanyName()}</h3>
                    <div class="worker-header-right">
                        <span class="worker-name">${Utils.escapeHtml(worker.name)}</span>
                        <button class="btn btn-secondary btn-sm" id="workerRefresh" title="Refresh data">↻ Refresh</button>
                        <button class="btn btn-secondary btn-sm" id="workerLogout">Logout</button>
                    </div>
                </header>
                <main class="worker-content" id="workerContent">
                </main>
                <nav class="worker-nav">
                    <a class="worker-nav-item active" data-route="home">
                        <span class="worker-nav-icon">🏠</span>
                        <span class="worker-nav-label">Home</span>
                    </a>
                    <a class="worker-nav-item" data-route="history">
                        <span class="worker-nav-icon">📋</span>
                        <span class="worker-nav-label">History</span>
                    </a>
                    <a class="worker-nav-item" data-route="tasks">
                        <span class="worker-nav-icon">✅</span>
                        <span class="worker-nav-label">Tasks</span>
                    </a>
                    <a class="worker-nav-item" data-route="help">
                        <span class="worker-nav-icon">❓</span>
                        <span class="worker-nav-label">Help</span>
                    </a>
                </nav>
            `;

            // Worker nav
            document.querySelectorAll('.worker-nav-item').forEach(item => {
                item.onclick = (e) => {
                    e.preventDefault();
                    this.navigateWorker(item.dataset.route, worker);
                };
            });

            document.getElementById('workerLogout').onclick = () => this.logout();
            const refreshWorkerBtn = document.getElementById('workerRefresh');
            if (refreshWorkerBtn) {
                refreshWorkerBtn.onclick = async () => {
                    refreshWorkerBtn.disabled = true;
                    refreshWorkerBtn.textContent = '⟳ Refreshing…';
                    try {
                        await AppData.syncFromServer();
                        this.navigateWorker(this.currentView, worker);
                    } catch(err) {
                        console.error('Refresh failed:', err);
                        alert('Failed to refresh data');
                    } finally {
                        refreshWorkerBtn.disabled = false;
                        refreshWorkerBtn.textContent = '↻ Refresh';
                    }
                };
            }

            this.navigateWorker('home', worker);
        },

        navigateWorker(route, workerOrProjectId = null, params = {}) {
            // Authwall: block navigation if not authenticated
            if (!this.currentUser || this.currentUser.type !== 'worker') {
                this.showLogin();
                return;
            }

            this.currentView = route;
            const content = document.getElementById('workerContent');
            if (!content) return;

            // Always resolve the real worker from session state.
            // Worker modules call navigateWorker with inconsistent args — some pass the worker
            // object, some pass a projectId string, some pass nothing. Normalize here so every
            // module always gets the correct worker object.
            const worker = this.getCurrentWorker()
                || (workerOrProjectId && typeof workerOrProjectId === 'object' ? workerOrProjectId : null);

            // If second arg is a string it's a projectId (legacy call from worker modules).
            // Merge it into params so modules receive it via params.projectId.
            if (typeof workerOrProjectId === 'string') {
                params = Object.assign({ projectId: workerOrProjectId }, params);
            }

            // Update active nav
            document.querySelectorAll('.worker-nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.route === route);
            });

            switch(route) {
                case 'home':
                    if (window.WorkerHome) WorkerHome.render(content, worker);
                    break;
                case 'timeentry':
                    // params doubles as prefill data (flat object with date, subtaskId, etc.)
                    if (window.WorkerTimeEntry) WorkerTimeEntry.render(content, worker, params.projectId, params);
                    break;
                case 'history':
                    if (window.WorkerHistory) WorkerHistory.render(content, worker);
                    break;
                case 'tasks':
                    if (window.WorkerTasks) WorkerTasks.render(content, worker, params);
                    break;
                case 'help':
                    if (window.WorkerHelp) WorkerHelp.render(content);
                    break;
                default:
                    content.innerHTML = '<div class="empty-state"><h2>Page not found</h2></div>';
            }

            // Inject "? How To" help button for worker pages
            // setTimeout(300) ensures button fires after async module renders settle
            const _wHelpRoute = route;
            setTimeout(() => {
                if (App.currentView !== _wHelpRoute) return; // user navigated away
                const old = document.getElementById('pageHelpBtn');
                if (old) old.remove();
                if (_wHelpRoute !== 'help' && window.LedgermanHelp && window.LedgermanHelp[_wHelpRoute]) {
                    const helpBtn = document.createElement('button');
                    helpBtn.id = 'pageHelpBtn';
                    helpBtn.innerHTML = '? How To';
                    helpBtn.style.cssText = [
                        'position:fixed',
                        'bottom:70px',
                        'right:16px',
                        'z-index:888',
                        'background:#1a3a5c',
                        'color:#ffffff',
                        'border:2px solid #ffffff',
                        'border-radius:20px',
                        'padding:9px 18px',
                        'font-size:.85rem',
                        'font-weight:700',
                        'cursor:pointer',
                        'box-shadow:0 4px 14px rgba(0,0,0,.4)'
                    ].join(';');
                    helpBtn.onclick = () => Utils.showHelpModal(_wHelpRoute);
                    document.body.appendChild(helpBtn);
                }
            }, 300);

            content.scrollTop = 0;
        },

        // Store current worker for navigation helper
        getCurrentWorker() {
            if (this.currentUser && this.currentUser.type === 'worker') {
                return AppData.getWorker(this.currentUser.id);
            }
            return null;
        },

        // ============ LOGOUT ============

        logout() {
            if (this.currentUser) {
                AppData.addAuditLog(this.currentUser.name, 'Logout', '');
            }
            this.currentUser = null;
            this.currentView = null;
            this.currentProjectId = null;
            AppData.setJwt(''); // clear JWT — require fresh login next time
            AppData.clearPersistentLogin(); // clear persistent login on logout
            Utils.stopSessionTimer();
            const app = document.getElementById('app');
            app.className = '';
            this.showLogin();
        }
    };

    window.App = App;

    // Global error handler — display errors visually so we can diagnose
    window.onerror = function(msg, src, line, col, err) {
        var app = document.getElementById('app');
        if (app) {
            app.innerHTML = '<div style="padding:2rem;color:#fff;background:#c0392b;font-family:monospace;font-size:14px">'
                + '<h2>JS Error — please screenshot this</h2>'
                + '<p><b>Message:</b> ' + msg + '</p>'
                + '<p><b>File:</b> ' + src + '</p>'
                + '<p><b>Line:</b> ' + line + ':' + col + '</p>'
                + '<p><b>Error:</b> ' + (err ? err.stack : 'none') + '</p>'
                + '</div>';
        }
        return false;
    };

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        try {
            App.init();
        } catch(e) {
            var app = document.getElementById('app');
            if (app) {
                app.innerHTML = '<div style="padding:2rem;color:#fff;background:#c0392b;font-family:monospace;font-size:14px">'
                    + '<h2>App.init() crashed — please screenshot this</h2>'
                    + '<p>' + e.message + '</p>'
                    + '<pre>' + e.stack + '</pre>'
                    + '</div>';
            }
        }
    });
})();
// v20260329-debug
