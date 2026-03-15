"""
database.py — Ledgeman SQLite setup and connection helpers
Initialises all tables on first run and provides a simple get_db() helper.
"""

import sqlite3
import os

# Database path — override with DATABASE_PATH env var for cloud deployments (persistent disk)
DB_PATH = os.environ.get('DATABASE_PATH', os.path.join(os.path.dirname(__file__), 'ledgeman.db'))


def get_db():
    """Open (or reuse) a SQLite connection with row_factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row          # rows accessible as dicts
    conn.execute("PRAGMA journal_mode=WAL") # better concurrency
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create all tables if they do not already exist."""
    conn = get_db()
    cur = conn.cursor()

    # ── companies ──────────────────────────────────────────────────────────────
    # Each company is an isolated tenant. admin_password is stored as plain text
    # (acceptable for an MVP; swap for bcrypt in production).
    cur.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            admin_password  TEXT NOT NULL,
            created_at      TEXT NOT NULL,
            settings_json   TEXT DEFAULT '{}'
        )
    """)

    # ── workers ────────────────────────────────────────────────────────────────
    # role: 'Worker' | 'Approver'
    # status: 'Active' | 'Inactive'
    # two_fa_enabled: 0 | 1
    cur.execute("""
        CREATE TABLE IF NOT EXISTS workers (
            id              TEXT NOT NULL,
            company_id      TEXT NOT NULL,
            name            TEXT NOT NULL,
            role            TEXT NOT NULL DEFAULT 'Worker',
            pin             TEXT NOT NULL,
            email           TEXT DEFAULT '',
            status          TEXT NOT NULL DEFAULT 'Active',
            default_rate    REAL DEFAULT 0,
            two_fa_enabled  INTEGER DEFAULT 0,
            totp_secret     TEXT DEFAULT '',
            created_at      TEXT NOT NULL,
            PRIMARY KEY (id, company_id),
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)

    # ── entities ───────────────────────────────────────────────────────────────
    # Generic JSON store — one table for: projects, clients, subtasks, expenses,
    # submissions, invoices, payments, vendors, invites, audit_log.
    # entity_type is the discriminator (matches the localStorage key names used
    # in the frontend data layer).
    cur.execute("""
        CREATE TABLE IF NOT EXISTS entities (
            id          TEXT NOT NULL,
            company_id  TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            data_json   TEXT NOT NULL DEFAULT '{}',
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL,
            PRIMARY KEY (id, company_id),
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)

    # Index for the most common query pattern: "all entities of type X for company Y"
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_entities_company_type
        ON entities (company_id, entity_type)
    """)

    # ── photos ─────────────────────────────────────────────────────────────────
    # Full base64 blob stored in SQLite (fine for moderate volumes; move to
    # object storage for high-volume production use).
    cur.execute("""
        CREATE TABLE IF NOT EXISTS photos (
            id              TEXT NOT NULL,
            company_id      TEXT NOT NULL,
            worker_id       TEXT DEFAULT '',
            submission_id   TEXT DEFAULT '',
            project_id      TEXT DEFAULT '',
            date            TEXT DEFAULT '',
            filename        TEXT DEFAULT '',
            blob_b64        TEXT DEFAULT '',
            thumbnail_b64   TEXT DEFAULT '',
            created_at      TEXT NOT NULL,
            PRIMARY KEY (id, company_id),
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_photos_project
        ON photos (company_id, project_id)
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_photos_submission
        ON photos (company_id, submission_id)
    """)

    # ── settings ───────────────────────────────────────────────────────────────
    # One row per company; upserted on every save.
    cur.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            company_id  TEXT PRIMARY KEY,
            data_json   TEXT NOT NULL DEFAULT '{}',
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)

    conn.commit()
    conn.close()
    print(f"[DB] Initialised → {DB_PATH}")
