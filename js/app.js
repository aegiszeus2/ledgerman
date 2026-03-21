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

            // Check for invite link first (#invite/TOKEN)
            const hash = window.location.hash;
            if (hash.startsWith('#invite/')) {
                const token = hash.slice(8);
                WorkerInvite.show(token);
                return;
            }

            // Check for signup link (#signup)
            if (hash === '#signup') {
                this.showWelcome();
                return;
            }

            // Check first run
            if (AppData.isFirstRun()) {
                this.showWelcome();
            } else {
                // Check backup reminder
                if (AppData.shouldRemindBackup()) {
                    this._pendingBackupReminder = true;
                }
                this.showLogin();
            }
        },

        // ============ LOGIN SCREENS ============

        showLogin() {
            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-header">
                        <div class="login-logo" id="loginLogo"></div>
                        <h1>${AppData.getCompanyName()}</h1>
                        <p class="text-muted">Powered by <strong>Ledgerman</strong></p>
                    </div>
                    <div class="login-options">
                        <div class="login-option" id="workerLoginBtn">
                            <div class="login-option-icon">👷</div>
                            <div><h2>Worker Login</h2>
                            <p>Submit time entries and photos</p></div>
                        </div>
                        <div class="login-option" id="adminLoginBtn">
                            <div class="login-option-icon">⚙️</div>
                            <div><h2>Admin Login</h2>
                            <p>Manage projects, invoices & team</p></div>
                        </div>
                        <div class="login-option" id="createCompanyBtn" style="border:2px dashed var(--border);background:transparent;cursor:pointer;transition:all 0.2s">
                            <div class="login-option-icon" style="font-size:1.8rem">➕</div>
                            <div><h2>Create Company</h2>
                            <p>Set up a new Ledgerman account</p></div>
                        </div>
                    </div>
                </div>
            `;
            // Load logo if exists
            AppData.getLogo().then(logo => {
                if (logo && logo.blob) {
                    const url = URL.createObjectURL(logo.blob);
                    document.getElementById('loginLogo').innerHTML = `<img src="${url}" alt="Logo" style="max-height:80px;">`;
                }
            }).catch(() => {});

            document.getElementById('workerLoginBtn').onclick = () => this.showWorkerLogin();
            document.getElementById('adminLoginBtn').onclick = () => this.showAdminLogin();
            document.getElementById('createCompanyBtn').onclick = () => this.showWelcome();

            // Hover effect for create company
            document.getElementById('createCompanyBtn').onmouseover = function() {
                this.style.background = 'var(--bg2)';
                this.style.borderColor = 'var(--primary)';
            };
            document.getElementById('createCompanyBtn').onmouseout = function() {
                this.style.background = 'transparent';
                this.style.borderColor = 'var(--border)';
            };
        },

        showWorkerLogin() {
            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-card">
                        <h2>Worker Login</h2>
                        <p class="text-muted">Enter your PIN to continue</p>
                        <form id="workerLoginForm">
                            <div class="form-group">
                                <input type="password" class="form-control pin-input" id="workerPin"
                                    placeholder="Enter PIN" maxlength="6" inputmode="numeric"
                                    pattern="[0-9]{4,6}" required autocomplete="off">
                            </div>
                            <div class="form-error" id="workerLoginError" style="display:none"></div>
                            <button type="submit" class="btn btn-primary btn-block">Login</button>
                            <button type="button" class="btn btn-secondary btn-block mt-1" id="backToLogin">Back</button>
                            <button type="button" class="btn btn-link btn-block mt-1" id="forgotPin" style="color:var(--primary);font-size:.875rem">Forgot PIN?</button>
                        </form>
                    </div>
                </div>
            `;
            document.getElementById('workerPin').focus();
            document.getElementById('backToLogin').onclick = () => this.showLogin();
            document.getElementById('forgotPin').onclick = () => this._showPinReset();
            document.getElementById('workerLoginForm').onsubmit = async (e) => {
                e.preventDefault();
                const pin = document.getElementById('workerPin').value;
                const errEl = document.getElementById('workerLoginError');
                errEl.style.display = 'none';

                if (Date.now() < this._loginLockoutUntil) {
                    const secs = Math.ceil((this._loginLockoutUntil - Date.now()) / 1000);
                    errEl.textContent = 'Too many attempts. Try again in ' + secs + ' seconds.';
                    errEl.style.display = 'block';
                    return;
                }

                if (AppData.isApiMode()) {
                    // API mode — validate PIN server-side
                    const loginBtn = document.querySelector('#workerLoginForm button[type="submit"]');
                    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'Logging in…'; }
                    try {
                        const data = await AppData.apiLoginWorker(pin);
                        if (data.twoFARequired) {
                            // Server says 2FA needed — go to verification step
                            this._show2FAStep({ id: data.workerId, name: data.workerName });
                        } else {
                            await AppData.syncFromServer();
                            const worker = AppData.getWorker(data.worker.id);
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
                        errEl.textContent = 'Invalid PIN. Please try again.';
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
                            this._showEmail2FAStep(worker);
                        } else if (worker.twoFAEnabled && worker.totpSecret) {
                            this._show2FAStep(worker);
                        } else {
                            this._completeWorkerLogin(worker);
                        }
                    } else {
                        this._loginAttempts++;
                        if (window.LedgermanAnalytics) LedgermanAnalytics.logLoginFailure('worker');
                        if (this._loginAttempts >= 5) {
                            this._loginLockoutUntil = Date.now() + 60000; // 1 minute lockout
                            this._loginAttempts = 0;
                        }
                        errEl.textContent = 'Invalid PIN. Please try again.';
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
                                    <input type="password" class="form-control" id="resetNewPw" required minlength="12">
                                    <p style="font-size:.75rem;color:var(--text2);margin-top:4px">Min 12 chars, mixed case, number, special character</p>
                                </div>
                                <div class="form-group" style="margin-bottom:12px">
                                    <label>Confirm New Password</label>
                                    <input type="password" class="form-control" id="resetConfirmPw" required minlength="12">
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
            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-card">
                        <h2>Admin Login</h2>
                        <p class="text-muted">Enter company name and password</p>
                        <form id="adminLoginForm">
                            <div class="form-group">
                                <input type="text" class="form-control" id="adminCompanyName"
                                    placeholder="Company Name" required autocomplete="off">
                            </div>
                            <div class="form-group">
                                <input type="password" class="form-control" id="adminPassword"
                                    placeholder="Password" required autocomplete="off">
                            </div>
                            <div class="form-error" id="adminLoginError" style="display:none"></div>
                            <button type="submit" class="btn btn-primary btn-block" id="adminLoginBtn">Login</button>
                            <button type="button" class="btn btn-secondary btn-block mt-1" id="backToLogin">Back</button>
                            <button type="button" class="btn btn-link btn-block mt-1" id="forgotPassword" style="color:var(--primary);font-size:.875rem">Forgot Password?</button>
                        </form>
                    </div>
                </div>
            `;
            document.getElementById('adminCompanyName').focus();
            document.getElementById('backToLogin').onclick = () => this.showLogin();
            document.getElementById('forgotPassword').onclick = () => this._showPasswordReset();
            document.getElementById('adminLoginForm').onsubmit = async (e) => {
                e.preventDefault();
                const companyName = document.getElementById('adminCompanyName').value;
                const pw = document.getElementById('adminPassword').value;
                const errEl = document.getElementById('adminLoginError');
                const btn = document.getElementById('adminLoginBtn');
                errEl.style.display = 'none';

                if (Date.now() < this._loginLockoutUntil) {
                    const secs = Math.ceil((this._loginLockoutUntil - Date.now()) / 1000);
                    errEl.textContent = 'Too many attempts. Try again in ' + secs + ' seconds.';
                    errEl.style.display = 'block';
                    return;
                }

                if (AppData.isApiMode()) {
                    // API mode — async login
                    btn.disabled = true; btn.textContent = 'Logging in…';
                    try {
                        await AppData.apiLoginAdmin(companyName, pw);
                        await AppData.syncFromServer();
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
                    // Legacy localStorage mode
                    if (pw === AppData.getAdminPassword()) {
                        this.currentUser = { type: 'admin', name: 'Admin' };
                        AppData.addAuditLog('Admin', 'Admin Login', '');
                        this.startAdminPanel();
                    } else {
                        const workers = AppData.getWorkers().filter(w => w.role === 'Approver' && w.status === 'Active');
                        const approver = workers.find(w => w.pin === pw);
                        if (approver) {
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

        showWelcome() {
            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-card" style="max-width:500px;display:flex;flex-direction:column;height:100%">
                        <div style="overflow-y:auto;flex:1;padding-bottom:20px">
                            <div style="margin-bottom:12px">
                                <img src="../LedgemanLogo.jpg" alt="Ledgerman" style="max-width:260px;width:100%;height:auto;border-radius:6px">
                            </div>
                            <p class="text-muted" style="margin-bottom:1.5rem">Automated Construction Intelligence — by PMs for PMs.</p>

                            <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--border)">
                                <button type="button" class="btn-tab-lg active" id="tabNew" style="flex:1;padding:10px;background:none;border:none;border-bottom:2px solid var(--primary);margin-bottom:-2px;color:var(--primary);font-weight:600;cursor:pointer">New Company</button>
                                <button type="button" class="btn-tab-lg" id="tabExisting" style="flex:1;padding:10px;background:none;border:none;color:var(--text2);cursor:pointer">Link Existing</button>
                            </div>

                            <!-- NEW COMPANY -->
                            <form id="registerForm">
                                <div class="form-group">
                                    <label>Company Name</label>
                                    <input type="text" class="form-control" id="regName" placeholder="e.g. Belfort Construction" required>
                                </div>
                                <div class="form-group">
                                    <label>Admin Password</label>
                                    <input type="password" class="form-control" id="regPw" placeholder="Choose a strong password" required>
                                </div>
                                <div class="form-group">
                                    <label>Confirm Password</label>
                                    <input type="password" class="form-control" id="regPw2" placeholder="Re-enter password" required>
                                </div>
                                <div class="form-error" id="regError" style="display:none"></div>
                            </form>

                            <!-- LINK EXISTING (hidden by default) -->
                            <form id="linkForm" style="display:none">
                                <p class="text-muted" style="font-size:.875rem;margin-bottom:16px">
                                    Enter your Company ID to connect this device to an existing Ledgerman company.
                                </p>
                                <div class="form-group">
                                    <label>Company ID</label>
                                    <input type="text" class="form-control" id="linkId" placeholder="e.g. m8f3k2xyz" required>
                                </div>
                                <div class="form-group">
                                    <label>Admin Password</label>
                                    <input type="password" class="form-control" id="linkPw" placeholder="Admin password" required>
                                </div>
                                <div class="form-error" id="linkError" style="display:none"></div>
                            </form>
                        </div>

                        <!-- FIXED FOOTER WITH BUTTONS -->
                        <div style="border-top:1px solid var(--border);padding-top:16px;display:flex;gap:8px;flex-direction:column">
                            <button type="submit" class="btn btn-primary btn-block" id="regBtn" form="registerForm">Create Company</button>
                            <button type="submit" class="btn btn-primary btn-block" id="linkBtn" form="linkForm" style="display:none">Link This Device</button>
                        </div>
                    </div>
                </div>
            `;

            const logoImg = document.querySelector('.login-card img[alt="Ledgerman"]');
            if (logoImg) {
                logoImg.addEventListener('error', function() {
                    const fallback = document.createElement('div');
                    fallback.style.fontSize = '2.5rem';
                    fallback.textContent = '🏗️';
                    this.replaceWith(fallback);
                });
            }

            // Tab switching
            const tabNew = document.getElementById('tabNew');
            const tabEx  = document.getElementById('tabExisting');
            tabNew.onclick = () => {
                document.getElementById('registerForm').style.display = 'block';
                document.getElementById('linkForm').style.display = 'none';
                document.getElementById('regBtn').style.display = 'block';
                document.getElementById('linkBtn').style.display = 'none';
                tabNew.style.cssText += ';color:var(--primary);font-weight:600;border-bottom:2px solid var(--primary);margin-bottom:-2px';
                tabEx.style.cssText  += ';color:var(--text2);border-bottom:none;margin-bottom:0';
            };
            tabEx.onclick = () => {
                document.getElementById('registerForm').style.display = 'none';
                document.getElementById('linkForm').style.display = 'block';
                document.getElementById('regBtn').style.display = 'none';
                document.getElementById('linkBtn').style.display = 'block';
                tabEx.style.cssText  += ';color:var(--primary);font-weight:600;border-bottom:2px solid var(--primary);margin-bottom:-2px';
                tabNew.style.cssText += ';color:var(--text2);border-bottom:none;margin-bottom:0';
            };

            // Register new company
            document.getElementById('registerForm').onsubmit = async (e) => {
                e.preventDefault();
                const name = document.getElementById('regName').value.trim();
                const pw   = document.getElementById('regPw').value;
                const pw2  = document.getElementById('regPw2').value;
                const errEl = document.getElementById('regError');
                errEl.style.display = 'none';
                if (pw !== pw2) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; return; }
                const pwCheck = Utils.validatePassword(pw);
                if (!pwCheck.valid) { errEl.textContent = 'Password requirements: ' + pwCheck.errors.join(', '); errEl.style.display = 'block'; return; }
                const btn = document.getElementById('regBtn');
                btn.disabled = true; btn.textContent = 'Creating…';
                try {
                    console.log('[Ledgerman] Starting company registration for:', name);
                    const registerResult = await AppData.apiRegister(name, pw);
                    console.log('[Ledgerman] Registration successful, received companyId:', registerResult.companyId);

                    console.log('[Ledgerman] Syncing data from server...');
                    await AppData.syncFromServer();
                    console.log('[Ledgerman] Sync complete');

                    AppData.markSetupDone();
                    this.currentUser = { type: 'admin', name: 'Admin' };
                    AppData.addAuditLog('Admin', 'Company Registered', name);
                    console.log('[Ledgerman] Starting admin panel...');
                    this.startAdminPanel();
                    setTimeout(() => {
                        console.log('[Ledgerman] Navigating to settings...');
                        this.navigate('settings', { wizard: true });
                    }, 100);
                } catch(err) {
                    btn.disabled = false; btn.textContent = 'Create Company';
                    const errorMsg = (err && err.message) ? err.message : String(err);
                    console.error('[Ledgerman] Registration error:', errorMsg, err);
                    errEl.textContent = 'Registration failed: ' + errorMsg;
                    errEl.style.display = 'block';
                }
            };

            // Link existing company
            document.getElementById('linkForm').onsubmit = async (e) => {
                e.preventDefault();
                const companyId = document.getElementById('linkId').value.trim();
                const pw = document.getElementById('linkPw').value;
                const errEl = document.getElementById('linkError');
                errEl.style.display = 'none';
                const btn = document.getElementById('linkBtn');
                btn.disabled = true; btn.textContent = 'Linking…';
                try {
                    console.log('[Ledgerman] Linking device to company:', companyId);
                    await AppData.apiLinkDevice(companyId, pw);
                    console.log('[Ledgerman] Link successful, syncing data...');
                    await AppData.syncFromServer();
                    AppData.markSetupDone();
                    this.currentUser = { type: 'admin', name: 'Admin' };
                    AppData.addAuditLog('Admin', 'Device Linked', companyId);
                    console.log('[Ledgerman] Device linked, starting admin panel...');
                    this.startAdminPanel();
                } catch(err) {
                    btn.disabled = false; btn.textContent = 'Link This Device';
                    const errorMsg = (err && err.message) ? err.message : String(err);
                    console.error('[Ledgerman] Link error:', errorMsg, err);
                    errEl.textContent = 'Could not link: ' + errorMsg;
                    errEl.style.display = 'block';
                }
            };
        },

        // ============ ADMIN PANEL ============

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
                    <nav>
                        <a class="nav-item active" data-route="dashboard" data-tooltip="Dashboard — overview & quick actions">
                            <span class="nav-icon">📊</span><span class="nav-label">Dashboard</span>
                        </a>
                        <a class="nav-item" data-route="projects" data-tooltip="Projects — manage active jobs">
                            <span class="nav-icon">🏗️</span><span class="nav-label">Projects</span>
                        </a>
                        <a class="nav-item" data-route="approvals" data-tooltip="Approvals — review worker time submissions">
                            <span class="nav-icon">✅</span><span class="nav-label">Approvals</span>
                            <span class="nav-badge" id="approvalBadge" style="display:none"></span>
                        </a>
                        <a class="nav-item" data-route="invoices" data-tooltip="Invoices — create & track client invoices">
                            <span class="nav-icon">📄</span><span class="nav-label">Invoices</span>
                        </a>
                        <a class="nav-item" data-route="expenses-review" data-tooltip="Expenses — review worker-submitted costs">
                            <span class="nav-icon">💰</span><span class="nav-label">Expenses</span>
                        </a>
                        <a class="nav-item" data-route="vendors" data-tooltip="Vendors — suppliers & subcontractors">
                            <span class="nav-icon">🏢</span><span class="nav-label">Vendors</span>
                        </a>
                        <a class="nav-item" data-route="clients" data-tooltip="Clients — your client address book">
                            <span class="nav-icon">👥</span><span class="nav-label">Clients</span>
                        </a>
                        <a class="nav-item" data-route="users" data-tooltip="Workers — manage team & PINs">
                            <span class="nav-icon">👷</span><span class="nav-label">Workers</span>
                        </a>
                        <a class="nav-item" data-route="photos" data-tooltip="Photos — job site photo log">
                            <span class="nav-icon">📸</span><span class="nav-label">Photos</span>
                        </a>
                        <a class="nav-item" data-route="reports" data-tooltip="Reports — cost, labour & invoice summaries">
                            <span class="nav-icon">📈</span><span class="nav-label">Reports</span>
                        </a>
                        <a class="nav-item" data-route="settings" data-tooltip="Settings — company info, password & backups">
                            <span class="nav-icon">⚙️</span><span class="nav-label">Settings</span>
                        </a>
                        <a class="nav-item" data-route="help" data-tooltip="Help — how to use Ledgerman">
                            <span class="nav-icon">❓</span><span class="nav-label">Help</span>
                        </a>
                    </nav>
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
                default:
                    content.innerHTML = '<div class="empty-state"><h2>Page not found</h2></div>';
            }

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
                case 'help':
                    if (window.WorkerHelp) WorkerHelp.render(content);
                    break;
                default:
                    content.innerHTML = '<div class="empty-state"><h2>Page not found</h2></div>';
            }

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
            Utils.stopSessionTimer();
            const app = document.getElementById('app');
            app.className = '';
            this.showLogin();
        }
    };

    window.App = App;

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });
})();
