#!/bin/bash
# Ledgerman — one-click launcher
# Double-click this file to start the server and open in Firefox

PORT=8765
APP_DIR="$(dirname "$0")/app"

# Kill any existing server on the port
fuser -k ${PORT}/tcp 2>/dev/null
sleep 0.5

# Start no-cache server
python3 -c "
import http.server, socketserver, os
os.chdir('$APP_DIR')
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store,no-cache,must-revalidate')
        self.send_header('Pragma','no-cache')
        super().end_headers()
    def log_message(self,*a): pass
with socketserver.TCPServer(('',${PORT}),H) as s:
    s.serve_forever()
" &

# Wait for server to be ready
for i in {1..10}; do
    sleep 0.5
    curl -s -o /dev/null http://localhost:${PORT} && break
done

# Open in Firefox
firefox "http://localhost:${PORT}" &

echo "Ledgerman running at http://localhost:${PORT}"
