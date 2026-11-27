#!/usr/bin/env python3
"""Serve this folder and open Windows 12 in your browser."""
import http.server
import os
import socketserver
import sys
import webbrowser

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

with socketserver.TCPServer(("", PORT), http.server.SimpleHTTPRequestHandler) as httpd:
    url = "http://localhost:%d/index.html" % PORT
    print("Windows 12 is running at", url)
    print("Press Ctrl+C to stop.")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
