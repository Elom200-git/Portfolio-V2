#!/usr/bin/env python3
"""Serveur de test : fichiers statiques + /api/track et /api/analytics mockés.

Usage : python api/test_server.py [port]
Ne remplace pas les fonctions Vercel : sert uniquement aux tests Playwright.
"""
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADMIN_PASS = "test-pass-123"

PVS = [3, 7, 5, 12, 8, 15, 9, 4, 11, 6, 14, 10, 7, 5,
       9, 13, 6, 8, 12, 16, 10, 5, 7, 11, 9, 6, 13, 8, 15, 12]


def make_series(days=30):
    t = int(time.time())
    return [time.strftime("%Y-%m-%d", time.gmtime(t - k * 86400))
            for k in range(days - 1, -1, -1)]


def handle_track(self):
    # Le site public fait un fetch POST silencieux ; on répond 204.
    self.send_response(204)
    self.end_headers()


def handle_analytics(self):
    qs = parse_qs(urlparse(self.path).query)
    try:
        days = min(90, max(1, int(qs.get("days", ["30"])[0])))
    except ValueError:
        days = 30
    if self.headers.get("x-admin-pass") != ADMIN_PASS:
        self._send(401, json.dumps({"error": "unauthorized"}), "application/json")
        return
    dates = make_series(days)
    series = [{"date": d, "pv": PVS[k % len(PVS)]} for k, d in enumerate(dates)]
    total_pv = sum(x["pv"] for x in series)
    last7 = sum(x["pv"] for x in series[-7:])
    prev7 = sum(x["pv"] for x in series[-14:-7])
    payload = {
        "days": days,
        "series": series,
        "totalPv": total_pv,
        "last7": last7,
        "prev7": prev7,
        "totalAll": 812,
        "topPages": [
            {"page": "/", "views": 341},
            {"page": "/projets.html", "views": 128},
            {"page": "/certifications.html", "views": 97},
        ],
        "topSrc": [
            {"source": "linkedin.com", "views": 210},
            {"source": "google.com", "views": 164},
            {"source": "(direct)", "views": 121},
        ],
    }
    self._send(200, json.dumps(payload), "application/json")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body="", ctype="text/html; charset=utf-8", extra=None):
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def _file(self, rel):
        path = os.path.normpath(os.path.join(ROOT, rel.lstrip("/")))
        if not path.startswith(ROOT) or not os.path.isfile(path):
            self._send(404, "Not found")
            return
        ext = {"html": "text/html; charset=utf-8", "css": "text/css",
               "js": "application/javascript", "json": "application/json",
               "svg": "image/svg+xml", "png": "image/png", "jpg": "image/jpeg",
               "webp": "image/webp", "ico": "image/x-icon",
               "woff2": "font/woff2"}.get(path.rsplit(".", 1)[-1], "application/octet-stream")
        with open(path, "rb") as f:
            self._send(200, f.read().decode("utf-8", "replace"), ext)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/analytics":
            handle_analytics(self)
        elif parsed.path.startswith("/api/"):
            self._send(404, "{}", "application/json")
        else:
            rel = parsed.path
            if rel == "/" or rel.endswith("/"):
                rel += "index.html"
            self._file(rel)

    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/track":
            length = int(self.headers.get("Content-Length") or 0)
            if length:
                self.rfile.read(length)
            handle_track(self)
        else:
            self._send(404, "{}", "application/json")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8788
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("Test server on http://127.0.0.1:%d (ADMIN_PASS=%s)" % (port, ADMIN_PASS), flush=True)
    srv.serve_forever()
