# Ảnh đang phát: mỗi THUMB_SCAN_SEC chụp 1 khung đúng vị trí đang phát + dò MÀN ĐEN (tại VPS, không tốn máy chủ);
# chỉ ĐẨY ảnh lên máy chủ thưa hơn (thumbPushSec do máy chủ chỉnh).
import base64
import json
import os
import subprocess
import time
import urllib.request

from . import config, state


def _post_thumb(sid, path):
    try:
        with open(path, "rb") as f:
            data = f.read()
        if not data or len(data) > 650000:
            return
        payload = {"machineId": config.MACHINE, "streamId": sid, "jpgB64": base64.b64encode(data).decode()}
        req = urllib.request.Request(config.URL + "/api/live/agent-thumb", data=json.dumps(payload).encode(), method="POST",
                                     headers={"Content-Type": "application/json", "x-rise-live-token": config.TOKEN})
        with urllib.request.urlopen(req, timeout=20) as r:
            r.read()
    except Exception:
        pass


def _current_position(v):
    """(file đang phát, giây trong file) theo thời gian đã chạy và thứ tự danh sách phát."""
    order = [(p, d) for (p, d) in (v.get("order") or []) if os.path.exists(p)]
    if not order:
        return None, 0.0
    total = sum(d for _, d in order if d > 1)
    if total <= 1:
        return order[0][0], 0.0
    t, acc = (time.time() - v["started"]) % total, 0.0
    for p, d in order:
        if d <= 1:
            continue
        if t < acc + d:
            return p, t - acc
        acc += d
    return order[0][0], 0.0


def thumbnail_loop():
    while True:
        try:
            for sid, v in list(state.stream_procs.items()):
                if v["proc"].poll() is not None:
                    continue
                path, pos = _current_position(v)
                if not path:
                    continue
                out = os.path.join(config.THUMBS, sid + ".jpg")
                r = subprocess.run(["nice", "-n", "19", "ffmpeg", "-y", "-ss", str(round(pos, 1)), "-i", path,
                                    "-frames:v", "1", "-vf", "blackframe,scale=360:-2", "-q:v", "6", out],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=30)
                if b"blackframe" in (r.stderr or b""):
                    v["blackSince"] = v.get("blackSince") or time.time()
                else:
                    v["blackSince"] = None
                every = max(60, int(state.thumb.get("push") or config.THUMB_PUSH_DEFAULT))
                if os.path.exists(out) and time.time() - float(state.thumb_last_push.get(sid) or 0) >= every:
                    _post_thumb(sid, out)
                    state.thumb_last_push[sid] = time.time()
        except Exception as e:
            print("anh xem truoc loi:", str(e)[:120])
        time.sleep(config.THUMB_SCAN_SEC)
