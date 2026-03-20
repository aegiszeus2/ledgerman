// TOTP — Time-based One-Time Password (RFC 6238 / HOTP RFC 4226)
// Pure WebCrypto implementation — no external dependencies

window.TOTP = {

    // Generate a random base32 secret (20 bytes / 160 bits)
    generateSecret() {
        const bytes = new Uint8Array(20);
        crypto.getRandomValues(bytes);
        return this._base32Encode(bytes);
    },

    // Build otpauth:// URL for Google Authenticator / Authy QR scanning
    getOtpAuthUrl(secret, accountName, issuer) {
        issuer = issuer || AppData.getCompanyName() || 'Ledgerman';
        const label = encodeURIComponent(issuer + ':' + accountName);
        return 'otpauth://totp/' + label +
            '?secret=' + secret +
            '&issuer=' + encodeURIComponent(issuer) +
            '&algorithm=SHA1&digits=6&period=30';
    },

    // Verify a 6-digit token string. Checks current window ± 1 step for clock drift.
    async verifyToken(secret, token) {
        const cleanToken = (token || '').replace(/\s/g, '');
        const counter = Math.floor(Date.now() / 1000 / 30);
        for (let offset = -1; offset <= 1; offset++) {
            const expected = await this._generateToken(secret, counter + offset);
            if (expected === cleanToken) return true;
        }
        return false;
    },

    // Internal: generate a 6-digit HOTP token for a given counter value
    async _generateToken(secret, counter) {
        const keyBytes = this._base32Decode(secret);

        // Encode counter as 8-byte big-endian
        const counterBytes = new Uint8Array(8);
        let c = counter;
        for (let i = 7; i >= 0; i--) {
            counterBytes[i] = c & 0xff;
            c = Math.floor(c / 256);
        }

        // HMAC-SHA1
        const key = await crypto.subtle.importKey(
            'raw', keyBytes,
            { name: 'HMAC', hash: 'SHA-1' },
            false, ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, counterBytes);
        const hmac = new Uint8Array(sig);

        // Dynamic truncation (RFC 4226 §5.3)
        const offset = hmac[19] & 0x0f;
        const code = ((hmac[offset]     & 0x7f) << 24) |
                     ((hmac[offset + 1] & 0xff) << 16) |
                     ((hmac[offset + 2] & 0xff) << 8)  |
                      (hmac[offset + 3] & 0xff);

        return String(code % 1000000).padStart(6, '0');
    },

    // Base32 encode (RFC 4648) — A-Z 2-7
    _base32Encode(bytes) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let result = '';
        let bits = 0;
        let value = 0;
        for (const byte of bytes) {
            value = (value << 8) | byte;
            bits += 8;
            while (bits >= 5) {
                result += chars[(value >>> (bits - 5)) & 31];
                bits -= 5;
            }
        }
        if (bits > 0) result += chars[(value << (5 - bits)) & 31];
        return result;
    },

    // Base32 decode — tolerates lowercase and padding
    _base32Decode(base32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        const str = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
        let bits = 0;
        let value = 0;
        const output = [];
        for (const char of str) {
            const idx = chars.indexOf(char);
            if (idx === -1) continue;
            value = (value << 5) | idx;
            bits += 5;
            if (bits >= 8) {
                output.push((value >>> (bits - 8)) & 0xff);
                bits -= 8;
            }
        }
        return new Uint8Array(output);
    }
};
