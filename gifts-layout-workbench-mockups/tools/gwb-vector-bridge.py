#!/usr/bin/env python3
# Local Windows companion for Gifts Layout Workbench.
# 127.0.0.1 only; never execute commands or paths supplied by the web client.
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

PORT = 14762
MAX_BYTES = 40 * 1024 * 1024
TOKEN = secrets.token_urlsafe(32)
SESSIONS = {}
LOCK = threading.Lock()
ROOT = Path(os.environ.get("LOCALAPPDATA") or tempfile.gettempdir()) / "GWBVectorBridge"
ROOT.mkdir(parents=True, exist_ok=True)
ALLOWED = {".pdf", ".svg", ".ai"}

def origin_allowed(origin):
    parsed = urlparse(origin)
    host = (parsed.hostname or "").lower()
    return parsed.scheme in ("https", "http") and (
        (parsed.scheme == "https" and (host == "gifts.ru" or host.endswith(".gifts.ru") or host == "tohaa28.github.io"))
        or (parsed.scheme == "http" and host in ("127.0.0.1", "localhost"))
    )

def application(editor):
    if editor == "default":
        return None
    if editor not in ("corel", "illustrator"):
        raise ValueError("Invalid editor")
    candidates = ["CorelDRW.exe"] if editor == "corel" else ["Illustrator.exe"]
    try:
        import winreg
        for exe in candidates:
            for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
                for folder in (r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths",):
                    try:
                        with winreg.OpenKey(hive, folder + "\\" + exe) as key:
                            path = winreg.QueryValue(key, None)
                            if path and Path(path).is_file():
                                return path
                    except OSError:
                        pass
    except ImportError:
        pass
    for exe in candidates:
        found = shutil.which(exe)
        if found:
            return found
    roots = [os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)")]
    for base in filter(None, roots):
        for pattern in (("Corel/CorelDRAW Graphics Suite */Programs64/CorelDRW.exe",
                          "Corel/CorelDRAW Graphics Suite */Programs/CorelDRW.exe") if editor == "corel"
                        else ("Adobe/Adobe Illustrator */Support Files/Contents/Windows/Illustrator.exe",)):
            for path in Path(base).glob(pattern):
                if path.is_file():
                    return str(path)
    raise FileNotFoundError(("CorelDRAW" if editor == "corel" else "Adobe Illustrator") +
                            " не найден. Запустите редактор вручную или используйте «Вернуть изменённый файл».")

def secure_file_name(raw):
    name = Path(unquote(raw).replace("\\", "/")).name
    name = re.sub(r"[^a-zA-Zа-яА-ЯёЁ0-9 ._()-]", "_", name)[:100]
    if Path(name).suffix.lower() not in ALLOWED:
        raise ValueError("Only SVG, PDF, and PDF-compatible AI files are supported")
    return name

def digest(data):
    return hashlib.sha256(data).hexdigest()

class Handler(BaseHTTPRequestHandler):
    server_version = "GWBVectorBridge/1.0"
    def log_message(self, fmt, *args):
        # Do not log uploaded vector artwork, authorization nonce or source paths.
        return
    def origin_ok(self):
        return origin_allowed(self.headers.get("Origin", ""))
    def response(self, status, value=None, raw=None, kind="application/json"):
        self.send_response(status)
        origin = self.headers.get("Origin", "")
        if self.origin_ok():
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", kind)
        data = raw if raw is not None else json.dumps(value or {}, ensure_ascii=False).encode("utf8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass
    def reject(self, reason="Forbidden", code=403):
        self.response(code, {"error": reason})
    def authorize(self):
        if not self.origin_ok():
            self.reject("Disallowed origin")
            return False
        if self.headers.get("X-GWB-Nonce") != TOKEN:
            self.reject("Missing session nonce")
            return False
        return True
    def do_OPTIONS(self):
        if not self.origin_ok():
            return self.reject("Disallowed origin")
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin"))
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "X-GWB-Nonce, X-GWB-File-Name, Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Length", "0")
        self.end_headers()
    def session_parts(self):
        m = re.fullmatch(r"/api/sessions/([a-f0-9]{32})/(status|file|launch)", urlparse(self.path).path)
        if not m:
            return None, None
        with LOCK:
            return SESSIONS.get(m.group(1)), m.group(2)
    def do_GET(self):
        if not self.origin_ok():
            return self.reject()
        if urlparse(self.path).path == "/api/status":
            return self.response(200, {"ready": True, "nonce": TOKEN, "version": 1})
        if not self.authorize():
            return
        session, action = self.session_parts()
        if session is None or action not in ("status", "file"):
            return self.reject("Unknown editing session", 404)
        path = session["path"]
        try:
            info = path.stat()
            state = (info.st_size, info.st_mtime_ns)
            if state != session["observed"]:
                session["observed"] = state
                session["stable_since"] = time.monotonic()
            stable = time.monotonic() - session["stable_since"] > 1.0
            if action == "status":
                if stable and 0 < info.st_size <= MAX_BYTES:
                    revision = digest(path.read_bytes())
                    session["revision"] = revision
                return self.response(200, {"changed": session["revision"] != session["initial"],
                                           "revision": session["revision"]})
            if not stable or info.st_size <= 0 or info.st_size > MAX_BYTES:
                return self.reject("Save is still in progress or file is too large", 409)
            raw = path.read_bytes()
            if digest(raw) == session["initial"]:
                return self.reject("File unchanged", 409)
            return self.response(200, raw=raw, kind="application/octet-stream")
        except OSError:
            return self.reject("Edited file unavailable", 409)
    def do_POST(self):
        if not self.authorize():
            return
        path = urlparse(self.path).path
        try:
            amount = int(self.headers.get("Content-Length", "-1"))
        except ValueError:
            return self.reject("Invalid file length", 400)
        if amount < 0 or amount > MAX_BYTES:
            return self.reject("Upload too large", 413)
        if path == "/api/sessions":
            try:
                name = secure_file_name(self.headers.get("X-GWB-File-Name", ""))
                if amount == 0:
                    return self.reject("Empty file", 400)
                raw = self.rfile.read(amount)
                if len(raw) != amount:
                    return self.reject("Incomplete upload", 400)
                sid = secrets.token_hex(16)
                folder = ROOT / sid
                folder.mkdir(mode=0o700, exist_ok=False)
                file_path = folder / name
                file_path.write_bytes(raw)
                initial = digest(raw)
                meta = file_path.stat()
                with LOCK:
                    SESSIONS[sid] = {"path": file_path, "initial": initial,
                                     "revision": initial, "observed": (meta.st_size, meta.st_mtime_ns),
                                     "stable_since": time.monotonic()}
                return self.response(200, {"id": sid, "revision": initial})
            except (ValueError, OSError) as error:
                return self.reject(str(error), 400)
        session, action = self.session_parts()
        if session is None or action != "launch":
            return self.reject("Unknown editing session", 404)
        if amount > 2048:
            return self.reject("Invalid launch request", 400)
        try:
            data = json.loads(self.rfile.read(amount).decode("utf8"))
            editor = data.get("editor")
            exe = application(editor)
            if exe:
                subprocess.Popen([exe, str(session["path"])], close_fds=True)
            elif os.name == "nt":
                os.startfile(str(session["path"]))
            else:
                raise OSError("Default vector editor is available only on Windows.")
            return self.response(200, {"started": True, "editor": editor})
        except (ValueError, OSError, FileNotFoundError) as error:
            return self.reject(str(error), 422)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--serve", action="store_true")
    args = ap.parse_args()
    if os.name != "nt":
        print("This bridge is intended for Windows. No application was launched.")
        return 1
    if not args.serve:
        ap.print_help()
        return 1
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("GWB Vector Bridge ready on 127.0.0.1:", PORT, flush=True)
    try:
        httpd.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
