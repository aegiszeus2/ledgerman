#!/bin/bash
# Pre-deploy validation: ensure every AppData.X() call in app.js is exported in data.js
# Run before any deploy from the app/ directory. Exit 1 if missing exports found.

APP_JS="js/app.js"
DATA_JS="js/data.js"

if [[ ! -f "$APP_JS" || ! -f "$DATA_JS" ]]; then
    echo "❌ Run this from the app/ directory"
    exit 1
fi

# All AppData.func calls used in app.js
CALLED=$(grep -oP "AppData\.\K[a-zA-Z_]\w*" "$APP_JS" | sort -u)

# All names that appear inside the window.AppData = { ... } block
# Extract the block then pull out bare identifiers (word chars followed by comma, whitespace, or closing brace)
EXPORTED=$(python3 - <<'PYEOF'
import re, sys

with open("js/data.js") as f:
    src = f.read()

# Find the window.AppData = { ... }; block
m = re.search(r'window\.AppData\s*=\s*\{(.+?)\};', src, re.DOTALL)
if not m:
    sys.exit("ERROR: could not find window.AppData block")

block = m.group(1)
# Extract bare identifiers: word boundaries, not preceded by dot (not method calls)
names = re.findall(r'(?<![.\w])([a-zA-Z_]\w*)(?=\s*[,\n}])', block)
# Filter out comment noise
names = [n for n in names if not n.startswith('//')]
for n in sorted(set(names)):
    print(n)
PYEOF
)

if [[ $? -ne 0 ]]; then
    echo "❌ Failed to parse data.js export block"
    exit 1
fi

MISSING=()
while IFS= read -r func; do
    if [[ -z "$func" ]]; then continue; fi
    if ! echo "$EXPORTED" | grep -qx "$func"; then
        MISSING+=("$func")
    fi
done <<< "$CALLED"

if [[ ${#MISSING[@]} -eq 0 ]]; then
    TOTAL=$(echo "$CALLED" | grep -c .)
    echo "✅ All AppData exports present ($TOTAL functions verified)"
    exit 0
else
    echo "❌ MISSING from AppData export block in data.js:"
    for f in "${MISSING[@]}"; do
        echo "   - $f"
    done
    echo ""
    echo "Fix: add these to the window.AppData = { ... } block in data.js before deploying"
    exit 1
fi
