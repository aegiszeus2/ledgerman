// Ledgerman Analytics — Cookie Consent, Page Analytics, Friction Monitoring
// All data stored in localStorage under 'ledgeman_analytics'

window.LedgemanAnalytics = {
    _consentGiven: false,
    _sessionStart: null,
    _pageViews: [],
    _frictionEvents: [],
    _rageClickThreshold: 3,    // clicks within 1 second
    _rageClickWindow: 1000,    // ms
    _recentClicks: [],

    // ============ COOKIE CONSENT ============

    init() {
        this._consentGiven = localStorage.getItem('ledgeman_cookie_consent') === 'true';
        if (!this._consentGiven) {
            this.showConsentBanner();
        } else {
            this.startTracking();
        }
    },

    showConsentBanner() {
        // Don't show if already consented
        if (this._consentGiven) return;

        const banner = document.createElement('div');
        banner.id = 'cookieConsentBanner';
        banner.className = 'cookie-banner';
        banner.innerHTML =
            '<div class="cookie-banner-content">' +
                '<p>We use cookies to improve your experience and monitor app performance. ' +
                'No data is shared with third parties.</p>' +
                '<div class="cookie-banner-actions">' +
                    '<button class="btn btn-primary btn-sm" id="cookieAccept">Accept</button>' +
                    '<button class="btn btn-secondary btn-sm" id="cookieDecline">Decline</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(banner);

        document.getElementById('cookieAccept').addEventListener('click', () => {
            this._consentGiven = true;
            localStorage.setItem('ledgeman_cookie_consent', 'true');
            banner.classList.add('cookie-banner-hidden');
            setTimeout(() => banner.remove(), 300);
            this.startTracking();
        });

        document.getElementById('cookieDecline').addEventListener('click', () => {
            localStorage.setItem('ledgeman_cookie_consent', 'false');
            banner.classList.add('cookie-banner-hidden');
            setTimeout(() => banner.remove(), 300);
        });
    },

    // ============ TRACKING ============

    startTracking() {
        if (!this._consentGiven) return;
        this._sessionStart = Date.now();

        // Track page views
        this._trackPageViews();

        // Track friction events
        this._trackFriction();

        // Save on unload
        window.addEventListener('beforeunload', () => this._saveSession());
    },

    _trackPageViews() {
        // Intercept navigation to track page views
        const self = this;
        const originalNavigate = window.App && window.App.navigate;
        if (originalNavigate) {
            window.App.navigate = function(route, params) {
                self.logPageView(route);
                return originalNavigate.call(this, route, params);
            };
        }
        const originalNavWorker = window.App && window.App.navigateWorker;
        if (originalNavWorker) {
            window.App.navigateWorker = function(route, worker, params) {
                self.logPageView('worker/' + route);
                return originalNavWorker.call(this, route, worker, params);
            };
        }
    },

    logPageView(route) {
        if (!this._consentGiven) return;
        this._pageViews.push({
            route: route,
            timestamp: Date.now(),
            sessionTime: Date.now() - this._sessionStart
        });
    },

    // ============ FRICTION MONITORING ============

    _trackFriction() {
        const self = this;

        // Track failed form submissions
        document.addEventListener('submit', function(e) {
            const form = e.target;
            const invalids = form.querySelectorAll(':invalid');
            if (invalids.length > 0) {
                self.logFriction('form_validation_fail', {
                    formId: form.id || 'unknown',
                    invalidCount: invalids.length,
                    fields: Array.from(invalids).map(el => el.name || el.id || el.type).slice(0, 5)
                });
            }
        }, true);

        // Track rage clicks (3+ clicks in 1 second on same area)
        document.addEventListener('click', function(e) {
            const now = Date.now();
            self._recentClicks.push({ time: now, x: e.clientX, y: e.clientY });

            // Clean old clicks
            self._recentClicks = self._recentClicks.filter(c => now - c.time < self._rageClickWindow);

            if (self._recentClicks.length >= self._rageClickThreshold) {
                // Check if clicks are in same ~50px area
                const first = self._recentClicks[0];
                const allNear = self._recentClicks.every(c =>
                    Math.abs(c.x - first.x) < 50 && Math.abs(c.y - first.y) < 50
                );
                if (allNear) {
                    self.logFriction('rage_click', {
                        element: e.target.tagName + (e.target.className ? '.' + e.target.className.split(' ')[0] : ''),
                        clickCount: self._recentClicks.length
                    });
                    self._recentClicks = []; // reset after logging
                }
            }
        }, true);

        // Track JS errors
        window.addEventListener('error', function(e) {
            self.logFriction('js_error', {
                message: e.message,
                source: e.filename,
                line: e.lineno
            });
        });

        // Track unhandled promise rejections
        window.addEventListener('unhandledrejection', function(e) {
            self.logFriction('promise_rejection', {
                message: e.reason ? (e.reason.message || String(e.reason)) : 'Unknown'
            });
        });
    },

    logFriction(type, data) {
        if (!this._consentGiven) return;
        this._frictionEvents.push({
            type: type,
            data: data || {},
            timestamp: Date.now(),
            route: window.App ? window.App.currentView : 'unknown'
        });
    },

    // Track login failures specifically
    logLoginFailure(userType) {
        this.logFriction('login_failure', { userType: userType });
    },

    // ============ DATA PERSISTENCE ============

    _saveSession() {
        if (!this._consentGiven) return;
        const existing = this._loadData();
        const session = {
            start: this._sessionStart,
            end: Date.now(),
            duration: Date.now() - this._sessionStart,
            pageViews: this._pageViews,
            frictionEvents: this._frictionEvents
        };
        existing.sessions.push(session);

        // Keep only last 30 days of data
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        existing.sessions = existing.sessions.filter(s => s.start > cutoff);

        localStorage.setItem('ledgeman_analytics', JSON.stringify(existing));
    },

    _loadData() {
        try {
            const raw = localStorage.getItem('ledgeman_analytics');
            return raw ? JSON.parse(raw) : { sessions: [] };
        } catch (e) {
            return { sessions: [] };
        }
    },

    // ============ REPORTING (for admin dashboard) ============

    getReport() {
        const data = this._loadData();
        const sessions = data.sessions;
        if (sessions.length === 0) return null;

        const totalSessions = sessions.length;
        const avgDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / totalSessions;
        const allPageViews = sessions.flatMap(s => s.pageViews || []);
        const allFriction = sessions.flatMap(s => s.frictionEvents || []);

        // Most visited pages
        const pageCounts = {};
        allPageViews.forEach(pv => {
            pageCounts[pv.route] = (pageCounts[pv.route] || 0) + 1;
        });

        // Friction summary
        const frictionCounts = {};
        allFriction.forEach(f => {
            frictionCounts[f.type] = (frictionCounts[f.type] || 0) + 1;
        });

        return {
            totalSessions,
            avgSessionDuration: Math.round(avgDuration / 1000 / 60), // minutes
            totalPageViews: allPageViews.length,
            topPages: Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
            frictionSummary: frictionCounts,
            totalFrictionEvents: allFriction.length,
            last7Days: sessions.filter(s => s.start > Date.now() - 7 * 24 * 60 * 60 * 1000).length
        };
    }
};
