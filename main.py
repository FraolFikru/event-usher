"""
Event Usher – CBE Payment Scanner
Simple Python HTTP server (no external web framework needed).

Run:  python main.py
Then open on phone: http://<your-laptop-ip>:8080
"""

import json
import base64
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from ocr_parser import process_receipt

PORT = 8080
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


class UsherHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_POST(self):
        if self.path == "/api/ocr":
            self.handle_ocr()
        else:
            self.send_error(404, "Not Found")

    def handle_ocr(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body.decode("utf-8"))
            image_b64 = data.get("image", "")
            if "," in image_b64:
                image_b64 = image_b64.split(",", 1)[1]

            image_bytes = base64.b64decode(image_b64)
            result = process_receipt(image_bytes)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode("utf-8"))

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        # Quieter logs
        print(f"[{self.log_date_time_string()}] {args[0]}")


def run():
    server = HTTPServer(("0.0.0.0", PORT), UsherHandler)
    print("=" * 50)
    print("  Event Usher – CBE Scanner is running")
    print(f"  Local:   http://127.0.0.1:{PORT}")
    print(f"  Phone:   http://<your-laptop-ip>:{PORT}")
    print("=" * 50)
    print("Press Ctrl+C to stop\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")


if __name__ == "__main__":
    run()
