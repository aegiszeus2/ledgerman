// Main Application Controller
(function() {
    const App = {
        currentUser: null,     // { type: 'admin'|'worker', name: string, id?: string }
        currentView: null,
        currentProjectId: null, // for project detail views

        init() {
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
                            <h2>Worker Login</h2>
                            <p>Submit time entries and photos</p>
                        </div>
                        <div class="login-option" id="adminLoginBtn">
                            <div class="login-option-icon">⚙️</div>
                            <h2>Admin Login</h2>
                            <p>Manage projects, invoices & team</p>
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
                        </form>
                    </div>
                </div>
            `;
            document.getElementById('workerPin').focus();
            document.getElementById('backToLogin').onclick = () => this.showLogin();
            document.getElementById('workerLoginForm').onsubmit = (e) => {
                e.preventDefault();
                const pin = document.getElementById('workerPin').value;
                const worker = AppData.getWorkerByPin(pin);
                if (worker) {
                    this.currentUser = { type: 'worker', name: worker.name, id: worker.id };
                    AppData.addAuditLog(worker.name, 'Worker Login', '');
                    this.startWorkerPortal(worker);
                } else {
                    const err = document.getElementById('workerLoginError');
                    err.textContent = 'Invalid PIN. Please try again.';
                    err.style.display = 'block';
                    document.getElementById('workerPin').value = '';
                    document.getElementById('workerPin').focus();
                }
            };
        },

        showAdminLogin() {
            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-card">
                        <h2>Admin Login</h2>
                        <p class="text-muted">Enter admin password</p>
                        <form id="adminLoginForm">
                            <div class="form-group">
                                <input type="password" class="form-control" id="adminPassword"
                                    placeholder="Password" required autocomplete="off">
                            </div>
                            <div class="form-error" id="adminLoginError" style="display:none"></div>
                            <button type="submit" class="btn btn-primary btn-block">Login</button>
                            <button type="button" class="btn btn-secondary btn-block mt-1" id="backToLogin">Back</button>
                        </form>
                    </div>
                </div>
            `;
            document.getElementById('adminPassword').focus();
            document.getElementById('backToLogin').onclick = () => this.showLogin();
            document.getElementById('adminLoginForm').onsubmit = (e) => {
                e.preventDefault();
                const pw = document.getElementById('adminPassword').value;
                if (pw === AppData.getAdminPassword()) {
                    this.currentUser = { type: 'admin', name: 'Admin' };
                    AppData.addAuditLog('Admin', 'Admin Login', '');
                    this.startAdminPanel();
                } else {
                    // Also check if an approver worker
                    const workers = AppData.getWorkers().filter(w => w.role === 'Approver' && w.status === 'Active');
                    const approver = workers.find(w => w.pin === pw);
                    if (approver) {
                        this.currentUser = { type: 'admin', name: approver.name, id: approver.id };
                        AppData.addAuditLog(approver.name, 'Approver Login', '');
                        this.startAdminPanel();
                    } else {
                        const err = document.getElementById('adminLoginError');
                        err.textContent = 'Invalid password. Please try again.';
                        err.style.display = 'block';
                        document.getElementById('adminPassword').value = '';
                        document.getElementById('adminPassword').focus();
                    }
                }
            };
        },

        // ============ FIRST RUN ============

        showWelcome() {
            const app = document.getElementById('app');
            app.innerHTML = `
                <div class="login-screen">
                    <div class="login-card" style="max-width:500px">
                        <h1 style="margin-bottom:0.5rem">Welcome to Ledgerman</h1>
                        <p class="text-muted" style="margin-bottom:2rem">Let's set up your company. This will only take a few minutes.</p>
                        <button class="btn btn-primary btn-block" id="startSetup">Let's Get Started</button>
                    </div>
                </div>
            `;
            document.getElementById('startSetup').onclick = () => {
                this.currentUser = { type: 'admin', name: 'Admin' };
                AppData.markSetupDone();
                this.startAdminPanel();
                // Navigate to settings with wizard mode
                setTimeout(() => {
                    this.navigate('settings', { wizard: true });
                }, 100);
            };
        },

        // ============ ADMIN PANEL ============

        startAdminPanel() {
            Utils.startSessionTimer(() => this.logout());
            const app = document.getElementById('app');
            app.className = 'admin-mode';
            app.innerHTML = `
                <div class="admin-sidebar" id="adminSidebar">
                    <div class="sidebar-header">
                        <div class="sidebar-logo" id="sidebarLogo"></div>
                        <h3>${AppData.getCompanyName()}</h3>
                        <div class="sidebar-product-name">Ledgerman</div>
                    </div>
                    <nav class="sidebar-nav">
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
                <div class="admin-main">
                    <header class="admin-header">
                        <button class="btn btn-icon sidebar-toggle" id="sidebarToggle">☰</button>
                        <div class="admin-header-right">
                            <span class="admin-user">Logged in as: <strong>${Utils.escapeHtml(this.currentUser.name)}</strong></span>
                            <button class="btn btn-secondary btn-sm" id="adminLogout">Logout</button>
                        </div>
                    </header>
                    <main class="admin-content" id="adminContent">
                    </main>
                </div>
            `;

            // Load logo
            AppData.getLogo().then(logo => {
                if (logo && logo.blob) {
                    const url = URL.createObjectURL(logo.blob);
                    document.getElementById('sidebarLogo').innerHTML = `<img src="${url}" alt="Logo">`;
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

            // Sidebar toggle for mobile
            document.getElementById('sidebarToggle').onclick = () => {
                document.getElementById('adminSidebar').classList.toggle('open');
            };

            // Close sidebar on content click (mobile)
            document.querySelector('.admin-main').onclick = (e) => {
                if (e.target.closest('.sidebar-toggle')) return;
                document.getElementById('adminSidebar').classList.remove('open');
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
            this.currentView = route;
            const content = document.getElementById('adminContent');
            if (!content) return;

            // Update active nav
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.route === route);
            });

            // Close mobile sidebar
            const sidebar = document.getElementById('adminSidebar');
            if (sidebar) sidebar.classList.remove('open');

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
