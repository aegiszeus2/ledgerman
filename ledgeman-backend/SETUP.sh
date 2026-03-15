#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Ledgeman — Auto Setup Script
#  Run this ONCE on a new machine to install everything.
#  Then use START-ALL.sh to launch.
# ═══════════════════════════════════════════════════════════════

set -e  # exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/ledgeman-backend"

echo ""
echo "🏗️  Ledgeman Setup"
echo "════════════════════════════════════════"

# ── 1. Check Python ───────────────────────────────────────────
echo ""
echo "▸ Checking Python 3..."
if ! command -v python3 &>/dev/null; then
    echo "  ✗ Python 3 not found."
    echo "  Install it from https://python.org/downloads and re-run this script."
    exit 1
fi
PYVER=$(python3 --version 2>&1)
echo "  ✓ $PYVER"

# ── 2. Check pip ──────────────────────────────────────────────
echo ""
echo "▸ Checking pip..."
if ! command -v pip3 &>/dev/null; then
    echo "  Installing pip..."
    python3 -m ensurepip --upgrade
fi
echo "  ✓ pip ready"

# ── 3. Install Python dependencies ───────────────────────────
echo ""
echo "▸ Installing Python packages (Flask, PyJWT, flask-cors)..."
pip3 install -r "$BACKEND_DIR/requirements.txt" --quiet
echo "  ✓ Packages installed"

# ── 4. Initialise database ────────────────────────────────────
echo ""
echo "▸ Initialising database..."
cd "$BACKEND_DIR"
python3 -c "from database import init_db; init_db()"
echo "  ✓ Database ready"

# ── 5. Generate super-admin key ───────────────────────────────
echo ""
echo "▸ Checking super-admin key..."
if [ -f "$BACKEND_DIR/.superadmin_key" ]; then
    KEY=$(cat "$BACKEND_DIR/.superadmin_key")
    echo "  ✓ Existing key found"
else
    python3 -c "
import secrets, os
key = secrets.token_hex(32)
path = os.path.join('$BACKEND_DIR', '.superadmin_key')
with open(path, 'w') as f:
    f.write(key)
print('  ✓ New key generated')
print('  KEY:', key)
"
fi

# ── 6. Make scripts executable ────────────────────────────────
chmod +x "$SCRIPT_DIR/START-ALL.sh" 2>/dev/null || true
chmod +x "$BACKEND_DIR/start.sh" 2>/dev/null || true

# ── Done ──────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "✅  Setup complete!"
echo ""
echo "Your super-admin key:"
cat "$BACKEND_DIR/.superadmin_key"
echo ""
echo ""
echo "Next steps:"
echo "  1. Run:  ./START-ALL.sh"
echo "  2. App opens at:    http://localhost:8765"
echo "  3. Backend runs at: http://localhost:5001"
echo "  4. LittleShield:    open ledgeman-admin/index.html in browser"
echo ""
