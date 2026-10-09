#!/usr/bin/env python3
"""Mock du protocole REST Upstash (get / mget / scan / pipeline + EXPIRE).

Simule un Redis en mémoire pour tester api/track.js et api/analytics.js
sans compte Upstash. Usage : python api/mock_upstash.py [port]
"""
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

TOKEN = "mock-token-1"
STORE = {}  # key -> int


def glob_to_regex(pat):
    out = []
    for ch in pat:
        if ch == "*":
            out.append(".*")
        elif ch == "?":
            out.append(".")
        else:
            out.append(re.escape(ch))
    return "^" + "".join(out) + "$"


def cmd_incr(key, by=1):
    STORE[key] = STORE.get(key, 0) + int(by)
    return STORE[key]


def cmd_get(key):
    return STORE.get(key)


def cmd_mget(*keys):
    return [STORE.get(k) for k in keys]


def cmd_expire(key, _ttl):
    return 1 if key in STORE else 0


def cmd_scan(cursor, match=None, _count=None):
    # Mock mono-thread : curseur toujours 0, liste complète filtrée.
    rx = re.compile(glob_to_regex(unquote(match))) if match else None
    keys = [k for k in STORE if not rx or rx.match(k)]
    return [0, keys]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authed(self):
        return self.headers.get("Authorization") == f"Bearer {TOKEN}"

    def _run(self, name, args):
        if name == "get":
            return cmd_get(args[0])
        if name == "mget":
            return cmd_mget(*args)
        if name == "scan":
            # format REST Upstash : /scan/<cursor>/MATCH/<pattern>/COUNT/<n>
            d = dict(zip(args[1::2], args[2::2]))
            return cmd_scan(args[0], d.get("MATCH"), d.get("COUNT"))
        if name == "incr":
            return cmd_incr(args[0])
        if name == "expire":
            return cmd_expire(args[0], args[1])
        raise ValueError(f"commande inconnue: {name}")

    def do_GET(self):
        if not self._authed():
            self._json({"error": "unauthorized"}, 401)
            return
        parts = [unquote(p) for p in self.path.strip("/").split("/")]
        name, args = parts[0].lower(), parts[1:]
        try:
            self._json({"result": self._run(name, args)})
        except ValueError as e:
            self._json({"error": str(e)}, 400)

    def do_POST(self):
        if not self._authed():
            self._json({"error": "unauthorized"}, 401)
            return
        if self.path.strip("/") != "pipeline":
            self._json({"error": "endpoint inconnu"}, 404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        cmds = json.loads(self.rfile.read(length) or b"[]")
        out = []
        try:
            for c in cmds:
                out.append({"result": self._run(c[0].lower(), [str(a) for a in c[1:]])})
        except ValueError as e:
            self._json({"error": str(e)}, 400)
            return
        self._json({"result": out})

    def do_DELETE(self):
        STORE.clear()
        self._json({"result": "OK"})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Mock Upstash REST on http://127.0.0.1:{port} (TOKEN={TOKEN})", flush=True)
    srv.serve_forever()
