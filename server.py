#!/usr/bin/env python3
"""Simple HTTP server for tile game. Usage: python server.py [port]"""

import sys
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from threading import Timer

class JSHandler(SimpleHTTPRequestHandler):
    def guess_type(self, path):
        if path.endswith('.js'):
            return 'application/javascript'
        return super().guess_type(path)

def start_server(port=8000):
    try:
        server = HTTPServer(('localhost', port), JSHandler)
        url = f"http://localhost:{port}/index.html"

        print(f"Server running at {url}")
        print("Press Ctrl+C to stop")

        Timer(1.0, lambda: webbrowser.open(url)).start()
        server.serve_forever()

    except OSError:
        print(f"Port {port} in use. Try: python server.py {port + 1}")
    except KeyboardInterrupt:
        print("\nServer stopped")

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    start_server(port)