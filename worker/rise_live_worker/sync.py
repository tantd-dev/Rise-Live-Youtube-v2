# Nhịp hỏi/đáp với máy chủ (POST /api/live/agent) + khớp trạng thái máy theo DANH SÁCH MONG MUỐN nhận về.
import json
import os
import threading
import time
import urllib.error
import urllib.request

from . import config, state, streams, system
from .assets import prepare
from .media import probe_media

_ASSET_FIELDS = ("status", "sizeMb", "durationSec", "width", "height", "error", "progressPct", "downloadedMb", "totalMb", "queueAhead", "dlMbPerMin")


def sync():
    """Gửi báo cáo, nhận danh sách mong muốn. Ném lỗi nếu máy chủ trả lỗi (404 = sai mã máy, 401 = sai vé)."""
    with state.lock:
        assets = [{"id": k, "normalizedPath": v.get("path"), **{f: v.get(f) for f in _ASSET_FIELDS}} for k, v in state.asset_local.items()]
        uploads = list(state.pending_uploads)
    incidents = state.incidents[:]
    payload = {"machineId": config.MACHINE, "agentVersion": config.AGENT_VERSION, "heartbeat": system.heartbeat(),
               "assets": assets, "streams": streams.report(), "uploaded": uploads, "incidents": incidents}
    req = urllib.request.Request(config.URL + "/api/live/agent", data=json.dumps(payload).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "x-rise-live-token": config.TOKEN})
    try:
        with urllib.request.urlopen(req, timeout=config.SYNC_TIMEOUT) as resp:
            out = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")[:200]
        hint = {404: " (may chua dang ky - kiem RISE_LIVE_MACHINE)", 401: " (sai ve - kiem RISE_LIVE_TOKEN)"}.get(e.code, "")
        if e.code == 403 and "error code" in detail:   # trang lỗi của Cloudflare, không phải của app
            hint = " (Cloudflare chan - worker cung VPS thi dat RISE_LIVE_URL=http://127.0.0.1:3000; hoac tat Browser Integrity Check / bat 'DNS only')"
        raise RuntimeError("HTTP %d%s %s" % (e.code, hint, detail))
    if uploads:   # máy chủ đã đăng ký → bỏ khỏi hàng chờ
        ids = {u["id"] for u in uploads}
        with state.lock:
            state.pending_uploads[:] = [u for u in state.pending_uploads if u["id"] not in ids]
    if incidents:
        del state.incidents[:len(incidents)]
    return out


def reconcile(desired):
    # 1) Video: chuẩn bị cái chưa có; nhận lại file đã có trên ổ (sau khi worker khởi động lại).
    for a in desired.get("assets", []):
        aid, loc = a["id"], state.asset_local.get(a["id"])
        if a.get("status") == "ready" and not loc:
            path = os.path.join(config.ASSETS, aid + ".mp4")
            if os.path.exists(path):
                w, h, dur = probe_media(path)
                with state.lock:
                    state.asset_local[aid] = {"status": "ready", "path": path, "sizeMb": round(os.path.getsize(path) / 1e6, 1),
                                              "working": False, "width": w, "height": h, "durationSec": dur}
                continue
        if (not loc or loc.get("status") in (None, "pending")) and not (loc and loc.get("working")):
            threading.Thread(target=prepare, args=(a,), daemon=True).start()

    # 2) Dọn ổ: video không còn trong hệ thống (đã xoá) → xoá file. Giữ file vừa tải lên đang chờ đăng ký.
    with state.lock:
        keep = {a["id"] for a in desired.get("assets", [])} | {u["id"] for u in state.pending_uploads}
        for aid in list(state.asset_local):
            if aid not in keep and not state.asset_local[aid].get("working"):
                state.asset_local.pop(aid, None)
        working = {k for k, v in state.asset_local.items() if v.get("working")}
    try:
        for fn in os.listdir(config.ASSETS):
            if fn.endswith(".mp4") and fn[:-4] not in keep and fn[:-4] not in working:
                os.remove(os.path.join(config.ASSETS, fn))
    except Exception:
        pass

    # 3) Luồng: bật cái cần phát, dừng cái còn lại; luồng đã bị xoá → dừng + quên.
    present, live_ids = set(), set()
    for s in desired.get("streams", []):
        present.add(s["id"])
        if s.get("desiredState") == "live":
            state.desired_live[s["id"]] = s
            live_ids.add(s["id"])
            streams.ensure_stream(s)
        else:
            streams.stop_stream(s["id"])
            state.desired_live.pop(s["id"], None)
    for sid in list(state.desired_live):
        if sid not in live_ids:
            state.desired_live.pop(sid, None)
    for sid in list(state.stream_procs):
        if sid not in present:
            streams.stop_stream(sid)
            state.recently_stopped.discard(sid)
    try:
        for fn in os.listdir(config.THUMBS):
            if fn.endswith(".jpg") and fn[:-4] not in present:
                os.remove(os.path.join(config.THUMBS, fn))
    except Exception:
        pass


def apply_server_settings(desired):
    """Ghi nhận liên lạc thành công + cấu hình máy chủ gửi kèm (lease, nhịp đẩy ảnh)."""
    state.lease["last_ok"] = time.time()
    state.lease["grace"] = int(desired.get("leaseGraceSec") or 60)
    state.lease["enabled"] = {s["id"]: bool(s.get("leaseEnabled")) for s in desired.get("streams", [])}
    state.lease["fenced"].clear()
    try:
        state.thumb["push"] = int(desired.get("thumbPushSec") or config.THUMB_PUSH_DEFAULT)
    except (TypeError, ValueError):
        pass
