"""
auth.py — JWT helpers and Flask route decorators for Ledgeman.

Token payload shape:
    {
        "companyId": "<id>",
        "role":      "admin" | "worker",
        "workerId":  "<id>" | None,   # None for admin tokens
        "name":      "<display name>",
        "exp":       <unix timestamp>
    }
"""

import os
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, g, jsonify

# ── Secret key ─────────────────────────────────────────────────────────────────
# Set JWT_SECRET in the environment for production.
# If not set, generate a random one (tokens won't survive restarts without env var).
_env_secret = os.environ.get('JWT_SECRET', '').strip()
if _env_secret:
    SECRET_KEY = _env_secret
else:
    import secrets as _secrets
    SECRET_KEY = _secrets.token_hex(32)
    print("[WARNING] JWT_SECRET not set — using random key. Tokens will not survive restarts.")
ALGORITHM  = 'HS256'


# ── Token creation ─────────────────────────────────────────────────────────────

def create_token(payload: dict, expires_hours: float = 24) -> str:
    """
    Sign and return a JWT.
    `payload` must NOT already contain 'exp' — it will be added here.
    """
    data = dict(payload)
    data['exp'] = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


# ── Token verification ─────────────────────────────────────────────────────────

def verify_token(token: str) -> dict | None:
    """
    Decode and validate a JWT.
    Returns the payload dict on success, or None if invalid / expired.
    """
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


# ── Internal helper ────────────────────────────────────────────────────────────

def _extract_token() -> str | None:
    """Pull the Bearer token from the Authorization header, or return None."""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]
    return None


# ── Decorators ─────────────────────────────────────────────────────────────────

def require_auth(f):
    """
    Decorator: verify JWT and store payload in flask.g.auth.
    Returns 401 if no token or token is invalid.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify({'error': 'Authorization token required'}), 401

        payload = verify_token(token)
        if payload is None:
            return jsonify({'error': 'Invalid or expired token'}), 401

        g.auth = payload
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    """
    Decorator: require a valid JWT AND role == 'admin'.
    Must be used *after* (i.e., stacked below) @require_auth, or standalone
    (it calls require_auth logic itself to keep stacking clean).
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify({'error': 'Authorization token required'}), 401

        payload = verify_token(token)
        if payload is None:
            return jsonify({'error': 'Invalid or expired token'}), 401

        if payload.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        g.auth = payload
        return f(*args, **kwargs)
    return decorated


def require_worker(f):
    """
    Decorator: require a valid JWT with role == 'worker' OR 'admin'.
    Admins can always access worker endpoints.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_token()
        if not token:
            return jsonify({'error': 'Authorization token required'}), 401

        payload = verify_token(token)
        if payload is None:
            return jsonify({'error': 'Invalid or expired token'}), 401

        if payload.get('role') not in ('worker', 'admin'):
            return jsonify({'error': 'Worker or admin access required'}), 403

        g.auth = payload
        return f(*args, **kwargs)
    return decorated
