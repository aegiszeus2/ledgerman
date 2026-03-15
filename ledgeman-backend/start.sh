#!/bin/bash
# Ledgeman backend startup script
# Starts the Flask API server on port 5001.
cd "$(dirname "$0")"
python3 server.py
