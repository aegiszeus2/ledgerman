"""
server.py — Ledgerman Flask REST API
Port: 5001
Auth: JWT (Bearer token in Authorization header)
Multi-tenant: company_id always sourced from the JWT, never from the request body.
"""

import json
import os
import re
import hmac
import html as _html
import hashlib
import sqlite3
import secrets as _secrets
from datetime import datetime, timezone
from flask import Flask, request, g, jsonify
from flask_cors import CORS
import bcrypt
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from database import init_db, get_db
from auth import create_token, verify_token, require_auth, require_admin, require_worker

# ── App setup ──────────────────────────────────────────────────────────────────

app = Flask(__name__)

# CORS — restrict to known frontend origins
ALLOWED_ORIGINS = [
    'https://unrivaled-cassata-ee2ea9.netlify.app',
    'http://localhost:5001',
    'http://localhost:8080',
    'http://localhost:3000',
]
# Allow override via env var (comma-separated)
_extra_origins = os.environ.get('CORS_ORIGINS', '').strip()
if _extra_origins:
    ALLOWED_ORIGINS.extend([o.strip() for o in _extra_origins.split(',') if o.strip()])
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}}, supports_credentials=True)

# ── Rate Limiting ──────────────────────────────────────────────────────────────
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per minute"],
    storage_uri="memory://",
)

# ── Password Hashing ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Hash a password with bcrypt."""
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password(plain: str, stored: str) -> bool:
    """Check a password against stored hash. Handles plaintext migration."""
    if stored.startswith('$2b$') or stored.startswith('$2a$'):
        return bcrypt.checkpw(plain.encode('utf-8'), stored.encode('utf-8'))
    # Legacy plaintext comparison — caller should migrate after successful check
    return plain == stored

def _migrate_password(db, company_id: str, new_hash: str):
    """Upgrade a plaintext password to bcrypt in the DB."""
    db.execute("UPDATE companies SET admin_password = ? WHERE id = ?", (new_hash, company_id))
    db.commit()

# ── Input Sanitization ────────────────────────────────────────────────────────

def sanitize(value):
    """Recursively sanitize input: escape HTML in strings."""
    if isinstance(value, str):
        return _html.escape(value.strip())
    if isinstance(value, dict):
        return {k: sanitize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize(v) for v in value]
    return value

# ── Helpers ────────────────────────────────────────────────────────────────────

def now_iso() -> str:
    """UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


def generate_id() -> str:
    """Generate a short unique ID (timestamp-based hex + random bytes)."""
    import time, random, string
    ts = format(int(time.time() * 1000), 'x')
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))
    return ts + rand


# ── Super-admin key ───────────────────────────────────────────────────────────
_SUPERADMIN_KEY_FILE = os.path.join(os.path.dirname(__file__), '.superadmin_key')

def _get_superadmin_key() -> str:
    """Load super-admin key. Priority: SUPERADMIN_KEY env var → .superadmin_key file → generate new."""
    env_key = os.environ.get('SUPERADMIN_KEY', '').strip()
    if env_key:
        return env_key
    if os.path.exists(_SUPERADMIN_KEY_FILE):
        with open(_SUPERADMIN_KEY_FILE) as f:
            return f.read().strip()
    key = _secrets.token_hex(32)
    try:
        with open(_SUPERADMIN_KEY_FILE, 'w') as f:
            f.write(key)
    except OSError:
        pass  # read-only filesystem (cloud) — key only lives in memory this session
    return key

def _require_superadmin():
    """Return error response tuple if X-Superadmin-Key header is wrong, else None."""
    key = request.headers.get('X-Superadmin-Key', '')
    if not key or key != _get_superadmin_key():
        return jsonify({'error': 'Super-admin access denied'}), 403
    return None


def row_to_dict(row) -> dict:
    """Convert a sqlite3.Row to a plain dict."""
    return dict(row) if row else None


def parse_json_field(raw: str) -> any:
    """Safely parse a JSON string; return {} or [] on failure."""
    try:
        return json.loads(raw) if raw else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def entity_row_to_dict(row: dict) -> dict:
    """Flatten an entity row: merge data_json fields into the outer dict."""
    d = dict(row)
    data = parse_json_field(d.pop('data_json', '{}'))
    if isinstance(data, dict):
        data.update({
            'id':         d['id'],
            'createdAt':  d.get('created_at', ''),
            'updatedAt':  d.get('updated_at', ''),
        })
        return data
    return d


def require_fields(body: dict, *fields) -> str | None:
    """Return an error message if any required field is missing, else None."""
    missing = [f for f in fields if not body.get(f) and body.get(f) != 0]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    return None


# Valid entity types that can be managed via the generic /api/:entityType endpoint
VALID_ENTITY_TYPES = {
    'projects', 'clients', 'subtasks', 'expenses',
    'submissions', 'invoices', 'payments', 'vendors',
    'invites', 'auditLog'
}

# ── Health ──────────────────────────────────────────────────────────────────────

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'version': '1.0'}), 200


# ══════════════════════════════════════════════════════════════════════════════
#  COMPANY REGISTRATION & AUTH
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/companies/register', methods=['POST'])
@limiter.limit("5 per minute")
def register_company():
    """
    Register a new company (first-time setup).
    Body: { name, adminPassword }
    Returns: { token, companyId }
    """
    body = request.get_json(silent=True) or {}
    err = require_fields(body, 'name', 'adminPassword')
    if err:
        return jsonify({'error': err}), 400

    company_id = generate_id()
    ts = now_iso()
    hashed_pw = hash_password(body['adminPassword'])

    db = get_db()
    try:
        db.execute(
            "INSERT INTO companies (id, name, admin_password, created_at, settings_json) "
            "VALUES (?, ?, ?, ?, ?)",
            (company_id, sanitize(body['name'].strip()), hashed_pw, ts, '{}')
        )
        # Seed empty settings row
        db.execute(
            "INSERT INTO settings (company_id, data_json) VALUES (?, ?)",
            (company_id, json.dumps({
                'companyName':          body['name'].strip(),
                'address':              '',
                'city':                 '',
                'province':             'Ontario',
                'postalCode':           '',
                'phone':                '',
                'email':                '',
                'hstNumber':            '',
                'invoicePrefix':        'INV',
                'defaultPaymentTerms':  'Net 30',
                'defaultInvoiceNotes':  '',
                'defaultHstRate':       13,
                'sessionTimeout':       30,
                'setupComplete':        False,
            }))
        )
        db.commit()
    except Exception as e:
        db.close()
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500
    db.close()

    token = create_token({
        'companyId': company_id,
        'role':      'admin',
        'workerId':  None,
        'name':      'Admin',
    })

    return jsonify({'token': token, 'companyId': company_id}), 201


@app.route('/api/auth/admin', methods=['POST'])
@limiter.limit("10 per minute")
def auth_admin():
    """
    Admin login.
    Body: { companyId, password }
    Returns: { token }
    Also accepts an Approver worker's PIN as the password.
    """
    body = request.get_json(silent=True) or {}
    err = require_fields(body, 'companyId', 'password')
    if err:
        return jsonify({'error': err}), 400

    db = get_db()
    company = row_to_dict(
        db.execute("SELECT * FROM companies WHERE id = ?", (body['companyId'],)).fetchone()
    )
    if not company:
        db.close()
        return jsonify({'error': 'Company not found'}), 404

    # Check admin password (bcrypt or plaintext with auto-migration)
    if check_password(body['password'], company['admin_password']):
        # Auto-migrate plaintext → bcrypt
        if not company['admin_password'].startswith('$2b$'):
            _migrate_password(db, company['id'], hash_password(body['password']))
        db.close()
        token = create_token({
            'companyId': company['id'],
            'role':      'admin',
            'workerId':  None,
            'name':      'Admin',
        })
        return jsonify({'token': token}), 200

    # Check Approver worker PIN
    approver = row_to_dict(
        db.execute(
            "SELECT * FROM workers WHERE company_id = ? AND role = 'Approver' "
            "AND status = 'Active' AND pin = ?",
            (body['companyId'], body['password'])
        ).fetchone()
    )
    db.close()

    if approver:
        token = create_token({
            'companyId': approver['company_id'],
            'role':      'admin',
            'workerId':  approver['id'],
            'name':      approver['name'],
        })
        return jsonify({'token': token}), 200

    return jsonify({'error': 'Invalid password'}), 401


@app.route('/api/auth/worker', methods=['POST'])
@limiter.limit("10 per minute")
def auth_worker():
    """
    Worker PIN login.
    Body: { companyId, pin }
    Returns: { token, worker } if no 2FA, or { twoFARequired: true, workerId } if 2FA enabled.
    """
    body = request.get_json(silent=True) or {}
    err = require_fields(body, 'companyId', 'pin')
    if err:
        return jsonify({'error': err}), 400

    db = get_db()
    worker = row_to_dict(
        db.execute(
            "SELECT * FROM workers WHERE company_id = ? AND pin = ? AND status = 'Active'",
            (body['companyId'], body['pin'])
        ).fetchone()
    )
    db.close()

    if not worker:
        return jsonify({'error': 'Invalid PIN or worker not active'}), 401

    # If 2FA is enabled, do NOT issue a full token yet
    if worker.get('two_fa_enabled') and worker.get('totp_secret'):
        return jsonify({
            'twoFARequired': True,
            'workerId':      worker['id'],
            'workerName':    worker['name'],
        }), 200

    # No 2FA — issue token immediately
    token = create_token({
        'companyId': worker['company_id'],
        'role':      'worker',
        'workerId':  worker['id'],
        'name':      worker['name'],
    })

    # Return worker data (without sensitive fields)
    safe_worker = _safe_worker(worker)
    return jsonify({'token': token, 'worker': safe_worker}), 200


@app.route('/api/auth/worker/verify2fa', methods=['POST'])
@limiter.limit("10 per minute")
def auth_worker_verify_2fa():
    """
    Verify a TOTP code after PIN login.
    Body: { companyId, workerId, totpCode }
    Returns: { token }

    NOTE: TOTP verification is done server-side here.
    The algorithm matches the standard RFC 6238 TOTP spec (SHA-1, 30-second window,
    6-digit codes), which is what Google Authenticator / Authy produce.
    """
    body = request.get_json(silent=True) or {}
    err = require_fields(body, 'companyId', 'workerId', 'totpCode')
    if err:
        return jsonify({'error': err}), 400

    db = get_db()
    worker = row_to_dict(
        db.execute(
            "SELECT * FROM workers WHERE id = ? AND company_id = ? AND status = 'Active'",
            (body['workerId'], body['companyId'])
        ).fetchone()
    )
    db.close()

    if not worker:
        return jsonify({'error': 'Worker not found'}), 404

    if not worker.get('two_fa_enabled') or not worker.get('totp_secret'):
        return jsonify({'error': '2FA not enabled for this worker'}), 400

    # Verify TOTP
    code = (body['totpCode'] or '').replace(' ', '').strip()
    if not _verify_totp(worker['totp_secret'], code):
        return jsonify({'error': 'Invalid 2FA code'}), 401

    token = create_token({
        'companyId': worker['company_id'],
        'role':      'worker',
        'workerId':  worker['id'],
        'name':      worker['name'],
    })
    return jsonify({'token': token}), 200


def _verify_totp(secret_b32: str, code: str) -> bool:
    """
    Verify a 6-digit TOTP code against a base-32 secret.
    Allows a ±1 window (90 seconds) to account for clock drift.
    """
    import base64, struct, time

    try:
        # Pad the base32 secret if needed
        secret = secret_b32.upper().replace(' ', '')
        pad = (8 - len(secret) % 8) % 8
        key = base64.b32decode(secret + '=' * pad)
    except Exception:
        return False

    try:
        target = int(code)
    except (ValueError, TypeError):
        return False

    counter = int(time.time()) // 30

    for offset in (-1, 0, 1):
        msg = struct.pack('>Q', counter + offset)
        h   = hmac.new(key, msg, hashlib.sha1).digest()
        idx = h[-1] & 0x0F
        trunc = struct.unpack('>I', h[idx:idx+4])[0] & 0x7FFFFFFF
        if trunc % 1_000_000 == target:
            return True

    return False


def _safe_worker(worker: dict) -> dict:
    """Return a worker dict with sensitive fields removed."""
    return {k: v for k, v in worker.items()
            if k not in ('pin', 'totp_secret', 'admin_password')}


# ══════════════════════════════════════════════════════════════════════════════
#  SYNC — return all company data in one shot
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/sync', methods=['GET'])
@require_auth
def sync():
    """
    Return ALL data for the authenticated company in one payload.
    Called on login so the frontend can hydrate its local state.
    """
    company_id = g.auth['companyId']
    db = get_db()

    # Workers (without sensitive fields)
    workers_raw = db.execute(
        "SELECT * FROM workers WHERE company_id = ?", (company_id,)
    ).fetchall()
    workers = [_safe_worker(dict(r)) for r in workers_raw]

    # Settings
    settings_row = db.execute(
        "SELECT data_json FROM settings WHERE company_id = ?", (company_id,)
    ).fetchone()
    settings = parse_json_field(settings_row['data_json']) if settings_row else {}

    # Generic entities — fetch each type
    result = {
        'workers':     workers,
        'settings':    settings,
        'projects':    [],
        'clients':     [],
        'subtasks':    [],
        'expenses':    [],
        'submissions': [],
        'invoices':    [],
        'payments':    [],
        'vendors':     [],
        'auditLog':    [],
    }

    entity_map = {
        'projects':    'projects',
        'clients':     'clients',
        'subtasks':    'subtasks',
        'expenses':    'expenses',
        'submissions': 'submissions',
        'invoices':    'invoices',
        'payments':    'payments',
        'vendors':     'vendors',
        'auditLog':    'auditLog',
    }

    for etype, key in entity_map.items():
        rows = db.execute(
            "SELECT * FROM entities WHERE company_id = ? AND entity_type = ? ORDER BY created_at ASC",
            (company_id, etype)
        ).fetchall()
        result[key] = [entity_row_to_dict(dict(r)) for r in rows]

    db.close()
    return jsonify(result), 200


# ══════════════════════════════════════════════════════════════════════════════
#  SETTINGS
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/settings', methods=['GET'])
@require_auth
def get_settings():
    company_id = g.auth['companyId']
    db = get_db()
    row = db.execute(
        "SELECT data_json FROM settings WHERE company_id = ?", (company_id,)
    ).fetchone()
    db.close()
    return jsonify(parse_json_field(row['data_json']) if row else {}), 200


@app.route('/api/settings', methods=['PUT'])
@require_auth
def save_settings():
    company_id = g.auth['companyId']
    body = request.get_json(silent=True) or {}
    data_json = json.dumps(body)

    db = get_db()
    db.execute(
        "INSERT INTO settings (company_id, data_json) VALUES (?, ?) "
        "ON CONFLICT(company_id) DO UPDATE SET data_json = excluded.data_json",
        (company_id, data_json)
    )
    db.commit()
    db.close()
    return jsonify(body), 200


# ══════════════════════════════════════════════════════════════════════════════
#  WORKERS  (admin-only writes)
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/workers', methods=['GET'])
@require_auth
def list_workers():
    company_id = g.auth['companyId']
    db = get_db()
    rows = db.execute(
        "SELECT * FROM workers WHERE company_id = ? ORDER BY created_at ASC",
        (company_id,)
    ).fetchall()
    db.close()
    return jsonify([_safe_worker(dict(r)) for r in rows]), 200


@app.route('/api/workers', methods=['POST'])
@require_admin
def create_worker():
    company_id = g.auth['companyId']
    body = sanitize(request.get_json(silent=True) or {})
    err = require_fields(body, 'name', 'pin')
    if err:
        return jsonify({'error': err}), 400

    worker_id = body.get('id') or generate_id()
    ts = now_iso()

    db = get_db()
    try:
        db.execute(
            "INSERT INTO workers "
            "(id, company_id, name, role, pin, email, status, default_rate, "
            " two_fa_enabled, totp_secret, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                worker_id,
                company_id,
                body['name'].strip(),
                body.get('role', 'Worker'),
                body['pin'],
                body.get('email', ''),
                body.get('status', 'Active'),
                float(body.get('defaultRate', body.get('default_rate', 0))),
                1 if body.get('twoFAEnabled') or body.get('two_fa_enabled') else 0,
                body.get('totpSecret', body.get('totp_secret', '')),
                ts,
            )
        )
        db.commit()
    except sqlite3.IntegrityError as e:
        db.close()
        return jsonify({'error': f'Worker ID conflict: {str(e)}'}), 409
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 500

    worker = row_to_dict(
        db.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
    )
    db.close()
    return jsonify(_safe_worker(worker)), 201


@app.route('/api/workers/<worker_id>', methods=['PUT'])
@require_admin
def update_worker(worker_id):
    company_id = g.auth['companyId']
    body = request.get_json(silent=True) or {}

    db = get_db()
    existing = row_to_dict(
        db.execute(
            "SELECT * FROM workers WHERE id = ? AND company_id = ?",
            (worker_id, company_id)
        ).fetchone()
    )
    if not existing:
        db.close()
        return jsonify({'error': 'Worker not found'}), 404

    db.execute(
        "UPDATE workers SET "
        "name = ?, role = ?, pin = ?, email = ?, status = ?, "
        "default_rate = ?, two_fa_enabled = ?, totp_secret = ? "
        "WHERE id = ? AND company_id = ?",
        (
            body.get('name', existing['name']).strip(),
            body.get('role', existing['role']),
            body.get('pin', existing['pin']),
            body.get('email', existing['email'] or ''),
            body.get('status', existing['status']),
            float(body.get('defaultRate', body.get('default_rate', existing['default_rate']))),
            1 if body.get('twoFAEnabled', body.get('two_fa_enabled', existing['two_fa_enabled'])) else 0,
            body.get('totpSecret', body.get('totp_secret', existing['totp_secret'] or '')),
            worker_id,
            company_id,
        )
    )
    db.commit()

    updated = row_to_dict(
        db.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
    )
    db.close()
    return jsonify(_safe_worker(updated)), 200


@app.route('/api/workers/<worker_id>', methods=['DELETE'])
@require_admin
def delete_worker(worker_id):
    company_id = g.auth['companyId']
    db = get_db()
    result = db.execute(
        "DELETE FROM workers WHERE id = ? AND company_id = ?",
        (worker_id, company_id)
    )
    db.commit()
    db.close()

    if result.rowcount == 0:
        return jsonify({'error': 'Worker not found'}), 404
    return jsonify({'success': True}), 200


# ══════════════════════════════════════════════════════════════════════════════
#  GENERIC ENTITIES
#  Handles: projects, clients, subtasks, expenses, submissions,
#            invoices, payments, vendors
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/<entity_type>', methods=['GET'])
@require_auth
def list_entities(entity_type):
    if entity_type not in VALID_ENTITY_TYPES:
        return jsonify({'error': f'Unknown entity type: {entity_type}'}), 404

    company_id = g.auth['companyId']
    db = get_db()
    rows = db.execute(
        "SELECT * FROM entities WHERE company_id = ? AND entity_type = ? ORDER BY created_at ASC",
        (company_id, entity_type)
    ).fetchall()
    db.close()
    return jsonify([entity_row_to_dict(dict(r)) for r in rows]), 200


@app.route('/api/<entity_type>', methods=['POST'])
@require_auth
def create_entity(entity_type):
    if entity_type not in VALID_ENTITY_TYPES:
        return jsonify({'error': f'Unknown entity type: {entity_type}'}), 404

    company_id = g.auth['companyId']
    body = sanitize(request.get_json(silent=True) or {})

    # Use the client-supplied ID (frontend generates IDs) or create a new one
    entity_id = body.get('id') or generate_id()
    ts = now_iso()

    # Store the whole body as data_json; the 'id' field is kept in both places
    data = dict(body)
    data['id'] = entity_id  # ensure consistency

    db = get_db()
    try:
        db.execute(
            "INSERT INTO entities (id, company_id, entity_type, data_json, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (entity_id, company_id, entity_type, json.dumps(data), ts, ts)
        )
        db.commit()
    except sqlite3.IntegrityError:
        # ID already exists — treat as upsert
        db.execute(
            "UPDATE entities SET data_json = ?, updated_at = ? "
            "WHERE id = ? AND company_id = ?",
            (json.dumps(data), ts, entity_id, company_id)
        )
        db.commit()
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 500

    row = row_to_dict(
        db.execute("SELECT * FROM entities WHERE id = ? AND company_id = ?",
                   (entity_id, company_id)).fetchone()
    )
    db.close()
    return jsonify(entity_row_to_dict(row)), 201


@app.route('/api/<entity_type>/<entity_id>', methods=['PUT'])
@require_auth
def update_entity(entity_type, entity_id):
    if entity_type not in VALID_ENTITY_TYPES:
        return jsonify({'error': f'Unknown entity type: {entity_type}'}), 404

    company_id = g.auth['companyId']
    body = sanitize(request.get_json(silent=True) or {})
    ts = now_iso()

    db = get_db()
    existing = row_to_dict(
        db.execute(
            "SELECT * FROM entities WHERE id = ? AND company_id = ? AND entity_type = ?",
            (entity_id, company_id, entity_type)
        ).fetchone()
    )
    if not existing:
        db.close()
        return jsonify({'error': f'{entity_type} not found'}), 404

    data = dict(body)
    data['id'] = entity_id  # preserve ID

    db.execute(
        "UPDATE entities SET data_json = ?, updated_at = ? "
        "WHERE id = ? AND company_id = ?",
        (json.dumps(data), ts, entity_id, company_id)
    )
    db.commit()

    row = row_to_dict(
        db.execute("SELECT * FROM entities WHERE id = ? AND company_id = ?",
                   (entity_id, company_id)).fetchone()
    )
    db.close()
    return jsonify(entity_row_to_dict(row)), 200


@app.route('/api/<entity_type>/<entity_id>', methods=['DELETE'])
@require_auth
def delete_entity(entity_type, entity_id):
    if entity_type not in VALID_ENTITY_TYPES:
        return jsonify({'error': f'Unknown entity type: {entity_type}'}), 404

    company_id = g.auth['companyId']
    db = get_db()
    result = db.execute(
        "DELETE FROM entities WHERE id = ? AND company_id = ? AND entity_type = ?",
        (entity_id, company_id, entity_type)
    )
    db.commit()
    db.close()

    if result.rowcount == 0:
        return jsonify({'error': f'{entity_type} not found'}), 404
    return jsonify({'success': True}), 200


# ══════════════════════════════════════════════════════════════════════════════
#  PHOTOS
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/photos', methods=['POST'])
@require_auth
def upload_photo():
    """
    Store a photo.
    Body: { id, projectId, workerId, submissionId, date, filename, blobB64, thumbnailB64 }
    """
    company_id = g.auth['companyId']
    body = request.get_json(silent=True) or {}

    photo_id = body.get('id') or generate_id()
    ts = now_iso()

    db = get_db()
    try:
        db.execute(
            "INSERT INTO photos "
            "(id, company_id, worker_id, submission_id, project_id, date, "
            " filename, blob_b64, thumbnail_b64, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                photo_id,
                company_id,
                body.get('workerId', ''),
                body.get('submissionId', ''),
                body.get('projectId', ''),
                body.get('date', ''),
                body.get('filename', ''),
                body.get('blobB64', ''),
                body.get('thumbnailB64', ''),
                ts,
            )
        )
        db.commit()
    except sqlite3.IntegrityError:
        # Already exists — update
        db.execute(
            "UPDATE photos SET blob_b64 = ?, thumbnail_b64 = ? WHERE id = ? AND company_id = ?",
            (body.get('blobB64', ''), body.get('thumbnailB64', ''), photo_id, company_id)
        )
        db.commit()
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 500

    db.close()
    return jsonify({'id': photo_id, 'success': True}), 201


@app.route('/api/photos/project/<project_id>', methods=['GET'])
@require_auth
def photos_by_project(project_id):
    """Return photos for a project — thumbnails only (no full blob)."""
    company_id = g.auth['companyId']
    db = get_db()
    rows = db.execute(
        "SELECT id, company_id, worker_id, submission_id, project_id, "
        "date, filename, thumbnail_b64, created_at "
        "FROM photos WHERE company_id = ? AND project_id = ? ORDER BY created_at ASC",
        (company_id, project_id)
    ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows]), 200


@app.route('/api/photos/submission/<submission_id>', methods=['GET'])
@require_auth
def photos_by_submission(submission_id):
    """Return photos for a submission — thumbnails only."""
    company_id = g.auth['companyId']
    db = get_db()
    rows = db.execute(
        "SELECT id, company_id, worker_id, submission_id, project_id, "
        "date, filename, thumbnail_b64, created_at "
        "FROM photos WHERE company_id = ? AND submission_id = ? ORDER BY created_at ASC",
        (company_id, submission_id)
    ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows]), 200


@app.route('/api/photos/<photo_id>', methods=['GET'])
@require_auth
def get_photo(photo_id):
    """Return full photo including blob_b64 (camelCase for frontend)."""
    company_id = g.auth['companyId']
    db = get_db()
    row = row_to_dict(
        db.execute(
            "SELECT * FROM photos WHERE id = ? AND company_id = ?",
            (photo_id, company_id)
        ).fetchone()
    )
    db.close()
    if not row:
        return jsonify({'error': 'Photo not found'}), 404
    # Normalise to camelCase for the frontend
    return jsonify({
        'id':           row.get('id'),
        'projectId':    row.get('project_id'),
        'workerId':     row.get('worker_id'),
        'submissionId': row.get('submission_id'),
        'date':         row.get('date'),
        'filename':     row.get('filename'),
        'blobB64':      row.get('blob_b64', ''),
        'thumbnailB64': row.get('thumbnail_b64', ''),
        'createdAt':    row.get('created_at'),
    }), 200


@app.route('/api/photos/<photo_id>', methods=['DELETE'])
@require_auth
def delete_photo(photo_id):
    company_id = g.auth['companyId']
    db = get_db()
    result = db.execute(
        "DELETE FROM photos WHERE id = ? AND company_id = ?",
        (photo_id, company_id)
    )
    db.commit()
    db.close()
    if result.rowcount == 0:
        return jsonify({'error': 'Photo not found'}), 404
    return jsonify({'success': True}), 200


# ══════════════════════════════════════════════════════════════════════════════
#  INVITES
#  POST /api/invites           — create invite (admin, auth required)
#  GET  /api/invites/:token    — look up invite (PUBLIC — worker hasn't logged in yet)
#  PUT  /api/invites/:token/use — complete onboarding (PUBLIC)
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/invites', methods=['POST'])
@require_admin
def create_invite():
    """
    Admin creates a worker invite.
    Body: { workerId, workerName }  (or any custom fields)
    Returns: { token, inviteId }
    """
    company_id = g.auth['companyId']
    body = request.get_json(silent=True) or {}

    import secrets
    invite_token = secrets.token_urlsafe(32)
    invite_id = generate_id()
    ts = now_iso()

    data = dict(body)
    data.update({
        'id':          invite_id,
        'token':       invite_token,
        'companyId':   company_id,
        'used':        False,
        'createdAt':   ts,
    })

    db = get_db()
    try:
        db.execute(
            "INSERT INTO entities (id, company_id, entity_type, data_json, created_at, updated_at) "
            "VALUES (?, ?, 'invites', ?, ?, ?)",
            (invite_id, company_id, json.dumps(data), ts, ts)
        )
        db.commit()
    except Exception as e:
        db.close()
        return jsonify({'error': str(e)}), 500

    db.close()
    return jsonify({'token': invite_token, 'inviteId': invite_id}), 201


@app.route('/api/invites/<invite_token>', methods=['GET'])
def get_invite(invite_token):
    """
    Look up an invite by its token. PUBLIC — no auth required.
    Returns the invite data (with worker name) so the onboarding page can display it.
    """
    db = get_db()
    try:
        rows = db.execute(
            "SELECT * FROM entities WHERE entity_type = 'invites'"
        ).fetchall()

        invite_data = None
        for row in rows:
            d = parse_json_field(row['data_json'])
            if d.get('token') == invite_token:
                invite_data = d
                invite_data['id'] = row['id']
                break

        if not invite_data:
            return jsonify({'error': 'Invite not found'}), 404

        if invite_data.get('used'):
            return jsonify({'error': 'Invite has already been used'}), 410

        # Look up the worker name from the workers table (db still open)
        worker_id  = invite_data.get('workerId', '')
        company_id = invite_data.get('companyId', '')
        worker_name = ''
        if worker_id and company_id:
            w = db.execute(
                "SELECT name FROM workers WHERE id = ? AND company_id = ?",
                (worker_id, company_id)
            ).fetchone()
            if w:
                worker_name = w['name']

        return jsonify({
            'inviteId':   invite_data.get('id'),
            'workerName': worker_name,
            'workerId':   worker_id,
            'companyId':  company_id,
            'token':      invite_token,
        }), 200
    finally:
        db.close()


@app.route('/api/invites/<invite_token>/use', methods=['PUT'])
def use_invite(invite_token):
    """
    Worker completes onboarding using an invite link. PUBLIC — no auth.
    Body: { pin, twoFAEnabled, totpSecret, email }
    Returns: { token }  (a full worker JWT so they are immediately logged in)
    """
    body = request.get_json(silent=True) or {}
    err = require_fields(body, 'pin')
    if err:
        return jsonify({'error': err}), 400

    db = get_db()

    # Find the invite
    rows = db.execute(
        "SELECT * FROM entities WHERE entity_type = 'invites'"
    ).fetchall()

    invite_row = None
    invite_data = None
    for row in rows:
        d = parse_json_field(row['data_json'])
        if d.get('token') == invite_token:
            invite_row = dict(row)
            invite_data = d
            break

    if not invite_data:
        db.close()
        return jsonify({'error': 'Invite not found'}), 404

    if invite_data.get('used'):
        db.close()
        return jsonify({'error': 'Invite has already been used'}), 410

    company_id = invite_data.get('companyId')
    worker_id  = invite_data.get('workerId')

    if not company_id or not worker_id:
        db.close()
        return jsonify({'error': 'Invalid invite data'}), 400

    # Update the worker record with their chosen PIN / 2FA / email
    db.execute(
        "UPDATE workers SET pin = ?, two_fa_enabled = ?, totp_secret = ?, email = ? "
        "WHERE id = ? AND company_id = ?",
        (
            body['pin'],
            1 if body.get('twoFAEnabled') else 0,
            body.get('totpSecret', ''),
            body.get('email', ''),
            worker_id,
            company_id,
        )
    )

    # Mark invite as used
    invite_data['used'] = True
    ts = now_iso()
    db.execute(
        "UPDATE entities SET data_json = ?, updated_at = ? WHERE id = ? AND company_id = ?",
        (json.dumps(invite_data), ts, invite_row['id'], company_id)
    )

    db.commit()

    # Fetch updated worker for token
    worker = row_to_dict(
        db.execute("SELECT * FROM workers WHERE id = ? AND company_id = ?",
                   (worker_id, company_id)).fetchone()
    )
    db.close()

    if not worker:
        return jsonify({'error': 'Worker record not found after invite use'}), 500

    token = create_token({
        'companyId': company_id,
        'role':      'worker',
        'workerId':  worker['id'],
        'name':      worker['name'],
    })

    return jsonify({'token': token, 'worker': _safe_worker(worker)}), 200


# ══════════════════════════════════════════════════════════════════════════════
#  AUDIT LOG  (convenience wrappers over the generic entity endpoint)
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/audit', methods=['POST'])
@require_auth
def add_audit_log():
    """
    Append an audit log entry.
    Body: { user, action, details }
    """
    company_id = g.auth['companyId']
    body = request.get_json(silent=True) or {}
    err = require_fields(body, 'user', 'action')
    if err:
        return jsonify({'error': err}), 400

    log_id = generate_id()
    ts = now_iso()
    data = {
        'id':        log_id,
        'timestamp': ts,
        'user':      body['user'],
        'action':    body['action'],
        'details':   body.get('details', ''),
    }

    db = get_db()
    db.execute(
        "INSERT INTO entities (id, company_id, entity_type, data_json, created_at, updated_at) "
        "VALUES (?, ?, 'auditLog', ?, ?, ?)",
        (log_id, company_id, json.dumps(data), ts, ts)
    )
    db.commit()
    db.close()
    return jsonify(data), 201


@app.route('/api/audit', methods=['GET'])
@require_admin
def get_audit_log():
    """Return all audit log entries for the company (admin only)."""
    company_id = g.auth['companyId']
    db = get_db()
    rows = db.execute(
        "SELECT * FROM entities WHERE company_id = ? AND entity_type = 'auditLog' "
        "ORDER BY created_at DESC",
        (company_id,)
    ).fetchall()
    db.close()
    return jsonify([entity_row_to_dict(dict(r)) for r in rows]), 200


# ══════════════════════════════════════════════════════════════════════════════
#  SUPER-ADMIN  — Lucas's private management endpoints
#  Auth: X-Superadmin-Key header (key stored in .superadmin_key file)
# ══════════════════════════════════════════════════════════════════════════════


@app.route('/api/superadmin/auth', methods=['POST'])
def superadmin_auth():
    """Verify the super-admin key. Returns {valid: true} or 403."""
    err = _require_superadmin()
    if err: return err
    return jsonify({'valid': True, 'message': 'Authenticated'}), 200


@app.route('/api/superadmin/key', methods=['POST'])
def superadmin_verify_key():
    """Verify the super-admin key from request body. Frontend-friendly endpoint."""
    data = request.get_json() or {}
    key = data.get('key', '').strip()
    if not key or key != _get_superadmin_key():
        return jsonify({'valid': False, 'error': 'Invalid key'}), 401
    return jsonify({'valid': True}), 200


@app.route('/api/superadmin/stats', methods=['GET'])
def superadmin_stats():
    """System-wide stats: company count, worker count, project count, etc."""
    err = _require_superadmin()
    if err: return err

    db = get_db()
    try:
        company_count = db.execute("SELECT COUNT(*) as n FROM companies").fetchone()['n']
        worker_count  = db.execute("SELECT COUNT(*) as n FROM workers").fetchone()['n']

        proj_row = db.execute(
            "SELECT COUNT(*) as n FROM entities WHERE entity_type='projects'"
        ).fetchone()
        proj_count = proj_row['n'] if proj_row else 0

        sub_row = db.execute(
            "SELECT COUNT(*) as n FROM entities WHERE entity_type='submissions'"
        ).fetchone()
        sub_count = sub_row['n'] if sub_row else 0

        photo_count = db.execute("SELECT COUNT(*) as n FROM photos").fetchone()['n']

        # DB file size
        db_size_bytes = os.path.getsize(os.path.join(os.path.dirname(__file__), 'ledgeman.db')) if os.path.exists(os.path.join(os.path.dirname(__file__), 'ledgeman.db')) else 0

    finally:
        db.close()

    return jsonify({
        'companies':   company_count,
        'workers':     worker_count,
        'projects':    proj_count,
        'submissions': sub_count,
        'photos':      photo_count,
        'dbSizeKb':    round(db_size_bytes / 1024, 1),
        'serverTime':  now_iso(),
    }), 200


@app.route('/api/superadmin/companies', methods=['GET'])
def superadmin_companies():
    """List all companies with per-company stats."""
    err = _require_superadmin()
    if err: return err

    db = get_db()
    try:
        companies = [row_to_dict(r) for r in
                     db.execute("SELECT * FROM companies ORDER BY created_at DESC").fetchall()]

        result = []
        for c in companies:
            cid = c['id']
            worker_count = db.execute(
                "SELECT COUNT(*) as n FROM workers WHERE company_id=?", (cid,)
            ).fetchone()['n']
            proj_count = db.execute(
                "SELECT COUNT(*) as n FROM entities WHERE company_id=? AND entity_type='projects'", (cid,)
            ).fetchone()['n']
            sub_count = db.execute(
                "SELECT COUNT(*) as n FROM entities WHERE company_id=? AND entity_type='submissions'", (cid,)
            ).fetchone()['n']
            # Last activity = most recent entity updated_at
            last_row = db.execute(
                "SELECT MAX(updated_at) as last FROM entities WHERE company_id=?", (cid,)
            ).fetchone()
            last_activity = last_row['last'] if last_row and last_row['last'] else c['created_at']

            settings_row = db.execute(
                "SELECT data_json FROM settings WHERE company_id=?", (cid,)
            ).fetchone()
            settings = parse_json_field(settings_row['data_json']) if settings_row else {}

            result.append({
                'id':           cid,
                'name':         c['name'],
                'createdAt':    c['created_at'],
                'lastActivity': last_activity,
                'workers':      worker_count,
                'projects':     proj_count,
                'submissions':  sub_count,
                'email':        settings.get('email', ''),
                'phone':        settings.get('phone', ''),
                'plan':         'Pro',  # future: pull from subscription table
                'status':       'Active',
            })
    finally:
        db.close()

    return jsonify(result), 200


@app.route('/api/superadmin/companies/<company_id>', methods=['GET'])
def superadmin_company_detail(company_id):
    """Full detail for one company: workers, recent audit entries, settings."""
    err = _require_superadmin()
    if err: return err

    db = get_db()
    try:
        company = row_to_dict(
            db.execute("SELECT * FROM companies WHERE id=?", (company_id,)).fetchone()
        )
        if not company:
            return jsonify({'error': 'Company not found'}), 404

        workers = [_safe_worker(dict(r)) for r in
                   db.execute("SELECT * FROM workers WHERE company_id=? ORDER BY created_at ASC",
                              (company_id,)).fetchall()]

        settings_row = db.execute(
            "SELECT data_json FROM settings WHERE company_id=?", (company_id,)
        ).fetchone()
        settings = parse_json_field(settings_row['data_json']) if settings_row else {}

        audit_rows = db.execute(
            "SELECT * FROM entities WHERE company_id=? AND entity_type='auditLog' "
            "ORDER BY created_at DESC LIMIT 50",
            (company_id,)
        ).fetchall()
        audit = [entity_row_to_dict(dict(r)) for r in audit_rows]

        projects_count = db.execute(
            "SELECT COUNT(*) as n FROM entities WHERE company_id=? AND entity_type='projects'",
            (company_id,)
        ).fetchone()['n']

        submissions_count = db.execute(
            "SELECT COUNT(*) as n FROM entities WHERE company_id=? AND entity_type='submissions'",
            (company_id,)
        ).fetchone()['n']

        photos_count = db.execute(
            "SELECT COUNT(*) as n FROM photos WHERE company_id=?", (company_id,)
        ).fetchone()['n']

    finally:
        db.close()

    return jsonify({
        'id':          company['id'],
        'name':        company['name'],
        'createdAt':   company['created_at'],
        'settings':    settings,
        'workers':     workers,
        'auditLog':    audit,
        'stats': {
            'workers':     len(workers),
            'projects':    projects_count,
            'submissions': submissions_count,
            'photos':      photos_count,
        }
    }), 200


@app.route('/api/superadmin/companies/<company_id>', methods=['DELETE'])
def superadmin_delete_company(company_id):
    """Hard-delete a company and all its data."""
    err = _require_superadmin()
    if err: return err

    db = get_db()
    try:
        db.execute("DELETE FROM entities WHERE company_id=?", (company_id,))
        db.execute("DELETE FROM workers WHERE company_id=?", (company_id,))
        db.execute("DELETE FROM photos WHERE company_id=?", (company_id,))
        db.execute("DELETE FROM settings WHERE company_id=?", (company_id,))
        db.execute("DELETE FROM companies WHERE id=?", (company_id,))
        db.commit()
    finally:
        db.close()

    return jsonify({'success': True, 'deleted': company_id}), 200


@app.route('/api/superadmin/health', methods=['GET'])
def superadmin_health():
    """Detailed health check: DB connection, table counts, disk space."""
    err = _require_superadmin()
    if err: return err

    import shutil
    checks = []

    # DB connection
    try:
        db = get_db()
        db.execute("SELECT 1").fetchone()
        db.close()
        checks.append({'check': 'Database connection', 'status': 'ok', 'detail': 'SQLite responsive'})
    except Exception as e:
        checks.append({'check': 'Database connection', 'status': 'error', 'detail': str(e)})

    # DB file
    db_path = os.path.join(os.path.dirname(__file__), 'ledgeman.db')
    if os.path.exists(db_path):
        size_kb = round(os.path.getsize(db_path) / 1024, 1)
        checks.append({'check': 'Database file', 'status': 'ok', 'detail': f'{size_kb} KB'})
    else:
        checks.append({'check': 'Database file', 'status': 'error', 'detail': 'File not found'})

    # Disk space
    try:
        total, used, free = shutil.disk_usage(os.path.dirname(__file__))
        free_gb = round(free / (1024**3), 2)
        status = 'ok' if free_gb > 1 else 'warning'
        checks.append({'check': 'Disk space', 'status': status, 'detail': f'{free_gb} GB free'})
    except Exception as e:
        checks.append({'check': 'Disk space', 'status': 'warning', 'detail': str(e)})

    # Auth module
    try:
        _ = create_token({'companyId': 'test', 'role': 'admin', 'workerId': None, 'name': 'test'})
        checks.append({'check': 'JWT auth module', 'status': 'ok', 'detail': 'Token creation works'})
    except Exception as e:
        checks.append({'check': 'JWT auth module', 'status': 'error', 'detail': str(e)})

    overall = 'ok' if all(c['status'] == 'ok' for c in checks) else 'warning' if any(c['status'] == 'ok' for c in checks) else 'error'

    return jsonify({
        'status':    overall,
        'checks':    checks,
        'timestamp': now_iso(),
        'version':   '1.0',
    }), 200


@app.route('/api/superadmin/diagnostics/<company_id>', methods=['GET'])
def superadmin_diagnostics(company_id):
    """Run automated diagnostics on a specific company — LittleShield integration."""
    err = _require_superadmin()
    if err: return err

    db = get_db()
    issues = []
    recommendations = []

    try:
        company = row_to_dict(
            db.execute("SELECT * FROM companies WHERE id=?", (company_id,)).fetchone()
        )
        if not company:
            return jsonify({'error': 'Company not found'}), 404

        # Check: workers with no email
        no_email = db.execute(
            "SELECT COUNT(*) as n FROM workers WHERE company_id=? AND (email='' OR email IS NULL)",
            (company_id,)
        ).fetchone()['n']
        if no_email > 0:
            issues.append({'severity': 'info', 'message': f'{no_email} worker(s) have no email address on file.'})
            recommendations.append('Remind workers to add their email for notifications.')

        # Check: workers with no 2FA
        no_2fa = db.execute(
            "SELECT COUNT(*) as n FROM workers WHERE company_id=? AND two_fa_enabled=0 AND status='Active'",
            (company_id,)
        ).fetchone()['n']
        if no_2fa > 0:
            issues.append({'severity': 'info', 'message': f'{no_2fa} active worker(s) have 2FA disabled.'})
            recommendations.append('Encourage workers to enable 2FA for better account security.')

        # Check: pending submissions older than 7 days
        cutoff = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        pending_rows = db.execute(
            "SELECT data_json FROM entities WHERE company_id=? AND entity_type='submissions'",
            (company_id,)
        ).fetchall()
        old_pending = 0
        for row in pending_rows:
            d = parse_json_field(row['data_json'])
            if d.get('status') == 'Pending' and d.get('date'):
                try:
                    sub_date = datetime.fromisoformat(d['date'].replace('Z', '+00:00'))
                    if (cutoff - sub_date.replace(tzinfo=timezone.utc)).days > 7:
                        old_pending += 1
                except Exception:
                    pass
        if old_pending > 0:
            issues.append({'severity': 'warning', 'message': f'{old_pending} submission(s) have been pending for over 7 days.'})
            recommendations.append('Admin should review and approve/reject pending time submissions.')

        # Check: no projects
        proj_count = db.execute(
            "SELECT COUNT(*) as n FROM entities WHERE company_id=? AND entity_type='projects'",
            (company_id,)
        ).fetchone()['n']
        if proj_count == 0:
            issues.append({'severity': 'info', 'message': 'No projects have been created yet.'})
            recommendations.append('Help admin set up their first project.')

        # Check: settings completeness
        settings_row = db.execute("SELECT data_json FROM settings WHERE company_id=?", (company_id,)).fetchone()
        settings = parse_json_field(settings_row['data_json']) if settings_row else {}
        if not settings.get('setupComplete'):
            issues.append({'severity': 'warning', 'message': 'Company setup is not marked as complete.'})
            recommendations.append('Admin has not completed initial settings wizard.')
        if not settings.get('email'):
            issues.append({'severity': 'info', 'message': 'No company email address in settings.'})

    finally:
        db.close()

    score = max(0, 100 - len([i for i in issues if i['severity'] == 'warning']) * 15 - len([i for i in issues if i['severity'] == 'info']) * 5)

    return jsonify({
        'companyId':       company_id,
        'score':           score,
        'status':          'good' if score >= 80 else 'fair' if score >= 50 else 'needs_attention',
        'issues':          issues,
        'recommendations': recommendations,
        'checkedAt':       now_iso(),
    }), 200


# ══════════════════════════════════════════════════════════════════════════════
#  STARTUP
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5001))
    print(f"[Ledgerman] Starting API server on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
