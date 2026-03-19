// EmailJS Service for Ledgerman
// Handles: email-based 2FA codes, password reset links
// Config stored in AppData settings: emailjs_serviceId, emailjs_templateId, emailjs_publicKey

window.EmailService = {
    _initialized: false,
    _pendingCodes: {}, // { recipientEmail: { code, expiresAt } }

    init() {
        const settings = AppData.getSettings();
        if (settings.emailjs_publicKey && window.emailjs) {
            emailjs.init(settings.emailjs_publicKey);
            this._initialized = true;
        }
    },

    isConfigured() {
        const s = AppData.getSettings();
        return !!(s.emailjs_serviceId && s.emailjs_templateId && s.emailjs_publicKey);
    },

    // Generate a 6-digit code, store it with 10-min expiry
    generateCode(email) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        this._pendingCodes[email] = {
            code: code,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
        };
        return code;
    },

    verifyCode(email, inputCode) {
        const entry = this._pendingCodes[email];
        if (!entry) return { valid: false, error: 'No code sent to this email.' };
        if (Date.now() > entry.expiresAt) {
            delete this._pendingCodes[email];
            return { valid: false, error: 'Code expired. Please request a new one.' };
        }
        if (entry.code !== inputCode.replace(/\s/g, '')) {
            return { valid: false, error: 'Invalid code. Please try again.' };
        }
        delete this._pendingCodes[email];
        return { valid: true };
    },

    // Send a 2FA verification code via email
    async send2FACode(recipientEmail, recipientName) {
        if (!this.isConfigured()) throw new Error('Email service not configured. Go to Settings \u2192 Email Service.');
        if (!this._initialized) this.init();

        const code = this.generateCode(recipientEmail);
        const settings = AppData.getSettings();
        const companyName = AppData.getCompanyName();

        try {
            await emailjs.send(settings.emailjs_serviceId, settings.emailjs_templateId, {
                to_email: recipientEmail,
                to_name: recipientName || 'Team Member',
                from_name: companyName,
                subject: companyName + ' \u2014 Verification Code',
                message: 'Your verification code is: ' + code + '\n\nThis code expires in 10 minutes. If you did not request this, please ignore this email.'
            });
            return { sent: true };
        } catch (err) {
            console.error('[EmailService] Send failed:', err);
            throw new Error('Failed to send email. Check your EmailJS configuration.');
        }
    },

    // Send a password reset code via email
    async sendPasswordReset(recipientEmail, recipientName) {
        if (!this.isConfigured()) throw new Error('Email service not configured.');
        if (!this._initialized) this.init();

        const code = this.generateCode(recipientEmail);
        const settings = AppData.getSettings();
        const companyName = AppData.getCompanyName();

        try {
            await emailjs.send(settings.emailjs_serviceId, settings.emailjs_templateId, {
                to_email: recipientEmail,
                to_name: recipientName || 'Admin',
                from_name: companyName,
                subject: companyName + ' \u2014 Password Reset',
                message: 'Your password reset code is: ' + code + '\n\nThis code expires in 10 minutes. If you did not request this, ignore this email.'
            });
            return { sent: true };
        } catch (err) {
            console.error('[EmailService] Reset send failed:', err);
            throw new Error('Failed to send reset email.');
        }
    }
};
