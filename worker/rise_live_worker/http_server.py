# Máy chủ HTTP nhỏ của worker (cổng RISE_LIVE_UPLOAD_PORT, mặc định 8099), xác thực bằng RISE_LIVE_UPLOAD_TOKEN:
#   PUT  /upload?token&name&email&preset — trình duyệt tải thẳng file video lên máy này
#   GET  /asset?id&token                  — máy khác kéo file đã sẵn sàng (chép VPS→VPS)
#   GET  /thumb?id&token                  — ảnh đang phát
import http.server
import json
import os
import traceback
import urllib.parse
import uuid

from . import config, state
from .media import probe_media


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"   # tự xử "Expect: 100-continue" khi tải file lớn

    def log_message(self, *args):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")

    def _reply(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception:
            pass

    def _authorized(self, q):
        return bool(config.UPLOAD_TOKEN) and q.get("token", [""])[0] == config.UPLOAD_TOKEN

    def do_OPTIONS(self):   # CORS preflight cho trình duyệt (trang Rise Live khác host)
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Allow-Methods", "PUT, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_PUT(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if not self._authorized(q):
            return self._reply(401, {"ok": False, "error": "unauthorized"})
        aid = uuid.uuid4().hex
        dest = os.path.join(config.ASSETS, aid + ".mp4")
        try:
            length = int(self.headers.get("Content-Length") or 0)
            os.makedirs(config.ASSETS, exist_ok=True)
            with state.lock:   # đánh dấu "đang làm" TRƯỚC khi ghi → reconcile không xoá nhầm
                state.asset_local[aid] = {"status": "uploading", "path": dest, "working": True}
            remaining = length
            with open(dest, "wb") as f:
                while remaining > 0:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        break
                    f.write(chunk)
                    remaining -= len(chunk)
            if length and remaining > 0:
                raise IOError("nhan thieu du lieu (con %d/%d byte) - ket noi bi ngat" % (remaining, length))
            size_mb = round(os.path.getsize(dest) / 1e6, 1)
            w, h, dur = probe_media(dest)
            info = {"sizeMb": size_mb, "width": w, "height": h, "durationSec": dur}
            with state.lock:
                state.asset_local[aid] = {"status": "ready", "path": dest, "working": False, **info}
                state.pending_uploads.append({"id": aid, "name": q.get("name", ["video"])[0][:120], "uploaderEmail": q.get("email", [""])[0].lower(),
                                              "presetId": q.get("preset", [""])[0], **info})
            print("TAI LEN OK: %s (%s MB)" % (aid, size_mb))
            self._reply(200, {"ok": True, "id": aid})
        except Exception as e:
            print("TAI LEN LOI:", repr(e))
            traceback.print_exc()
            with state.lock:
                state.asset_local.pop(aid, None)
            try:
                os.remove(dest)
            except Exception:
                pass
            self._reply(500, {"ok": False, "error": str(e)[:200]})

    def _send_file(self, path, ctype, cache="no-cache"):
        size = os.path.getsize(path)
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", cache)
        self._cors()
        self.end_headers()
        with open(path, "rb") as f:
            while True:
                chunk = f.read(1024 * 1024)
                if not chunk:
                    break
                self.wfile.write(chunk)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        route = u.path.rstrip("/")
        if route not in ("/asset", "/thumb"):
            return self._reply(404, {"ok": False, "error": "not found"})
        if not self._authorized(q):
            return self._reply(401, {"ok": False, "error": "unauthorized"})
        item = os.path.basename(q.get("id", [""])[0])   # basename: chống đi ngược thư mục
        try:
            if route == "/asset":
                path, loc = os.path.join(config.ASSETS, item + ".mp4"), state.asset_local.get(item)
                if not item or not os.path.exists(path) or not (loc and loc.get("status") == "ready"):
                    return self._reply(404, {"ok": False, "error": "asset not ready"})
                return self._send_file(path, "video/mp4")
            path = os.path.join(config.THUMBS, item + ".jpg")
            if not item or not os.path.exists(path):
                return self._reply(404, {"ok": False, "error": "no thumb"})
            return self._send_file(path, "image/jpeg")
        except Exception:
            pass


def serve_forever():
    try:
        http.server.ThreadingHTTPServer(("0.0.0.0", config.UPLOAD_PORT), Handler).serve_forever()
    except Exception as e:
        print("may chu nhan file (cong %d) loi:" % config.UPLOAD_PORT, str(e)[:120])
