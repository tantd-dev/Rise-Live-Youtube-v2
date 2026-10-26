# Chạy / dừng / giám sát tiến trình ffmpeg của từng luồng (copy-codec, không nén lại → gần như không tốn CPU).
#  · ffmpeg chết → giám sát bật lại NGAY (đọc tiến độ thấy ống đóng là đánh thức), ghi sự cố kèm số giây mất sóng.
#  · Treo (đồng hồ ffmpeg đứng yên) → giết để bật lại.
#  · Chớp tắt liên tục → tạm ngừng theo bậc thang chờ, rồi tự thử lại (lỗi mạng/VPS tự lành).
#  · Lỗi nguồn/file (file hỏng, không đọc được) → DỪNG HẲN, chờ người sửa (bật lại vô ích).
#  · Live Pub rớt quá PUB_GRACE_SEC → coi như YouTube đã đóng buổi, dừng.
import os
import random
import subprocess
import threading
import time

from . import config, state

_SOURCE_ERRORS = ["no such file", "invalid data", "moov atom", "error opening", "does not contain",
                  "invalid argument", "could not find codec", "unable to", "khong doc", "file video"]


def _iso(t=None):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t if t is not None else time.time()))


_NETWORK_HINTS = ["output", "connection", "refused", "broken pipe", "timed out", "rtmp", "network", "reset by peer", "i/o error"]


def is_source_error(reason):
    """Lỗi file NGUỒN (dừng hẳn). Lỗi phía ĐẦU RA / mạng (vd "Error opening output files: Connection refused")
    là lỗi tạm thời → không tính, để bộ ngắt chớp tắt tự thử lại."""
    r = (reason or "").lower()
    if any(k in r for k in _NETWORK_HINTS):
        return False
    return any(k in r for k in _SOURCE_ERRORS)


def _last_error_line(path):
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 4000))
            lines = [x.strip() for x in f.read().decode("utf-8", "ignore").splitlines() if x.strip()]
        return lines[-1][:180] if lines else ""
    except Exception:
        return ""


def _last_alive(cur):
    return max(float(cur.get("progAt") or 0), float(cur.get("lastAlive") or 0)) or time.time()


def _forget_breaker(sid):
    for d in (state.restart_halted, state.restart_wait, state.restart_step, state.restart_history, state.pub_grace, state.last_reason):
        d.pop(sid, None)
    state.stopped_for_human.discard(sid)


def _ready_items(s):
    """(đường dẫn, thời lượng) các video ĐÃ sẵn sàng của luồng, đúng thứ tự."""
    ids = s.get("assetIds") or ([s.get("assetId")] if s.get("assetId") else [])
    items = []
    for aid in ids:
        path, a = os.path.join(config.ASSETS, str(aid) + ".mp4"), state.asset_local.get(aid)
        if a and a.get("status") == "ready" and os.path.exists(path):
            items.append((path, float(a.get("durationSec") or 0)))
    return items


def _halt_if_flapping(sid, now):
    """Đếm lần bật lại; chớp tắt quá nhiều → tạm ngừng theo bậc thang. True = đã tạm ngừng."""
    hist = [t for t in state.restart_history.get(sid, []) if now - t < config.RESTART_WINDOW] + [now]
    state.restart_history[sid] = hist
    if len(hist) <= config.RESTART_MAX:
        return False
    step = state.restart_step.get(sid, 0)
    wait = config.RETRY_LADDER[min(step, len(config.RETRY_LADDER) - 1)]
    state.restart_halted[sid], state.restart_wait[sid] = now, wait
    state.restart_step[sid] = min(step + 1, len(config.RETRY_LADDER) - 1)
    print("luong %s chop tat qua nhieu -> tam ngung %ds roi tu thu lai" % (sid, wait))
    return True


def ensure_stream(s):
    """Bảo đảm luồng đang chạy (gọi từ reconcile và giám sát)."""
    sid = s["id"]
    items = _ready_items(s)
    if not items:
        return   # chưa có video sẵn sàng
    with state.stream_lock:
        cur = state.stream_procs.get(sid)
        if cur and cur["proc"].poll() is None:
            state.pub_grace.pop(sid, None)
            if time.time() - cur.get("started", 0) > config.STABLE_RESET_SEC:   # chạy ổn định = đã hồi phục thật
                state.stopped_for_human.discard(sid)
                state.last_reason.pop(sid, None)
                state.restart_step.pop(sid, None)
            return
        if sid in state.stopped_for_human:
            return
        if sid in state.restart_halted:
            if time.time() - state.restart_halted[sid] < state.restart_wait.get(sid, config.RETRY_LADDER[-1]):
                return
            for d in (state.restart_halted, state.restart_wait, state.restart_history):
                d.pop(sid, None)
            print("luong %s: het thoi gian cho -> thu lai" % sid)

        errpath = os.path.join(config.LOGS, sid + ".err")
        pending_dead, pending_reason = None, ""
        if cur is not None:
            now = time.time()
            if _halt_if_flapping(sid, now):
                return
            try:
                if cur["proc"].poll() is None:
                    cur["proc"].kill()
                if cur.get("errf"):
                    cur["errf"].close()
            except Exception:
                pass
            pending_dead = cur.get("deadAt") or now
            pending_reason = "luong bi treo (dong ho ffmpeg dung yen) - tu khoi dong lai" if cur.get("stallKill") else _last_error_line(errpath)
            if pending_reason:
                state.last_reason[sid] = pending_reason
            if pending_reason and is_source_error(pending_reason):
                _forget_breaker(sid)
                state.last_reason[sid] = pending_reason
                state.stopped_for_human.add(sid)
                print("luong %s LOI NGUON/FILE (%s) -> dung han" % (sid, pending_reason[:80]))
                return
            if str(s.get("mode", "")) == "live-pub":
                first = state.pub_grace.get(sid)
                if first is None:
                    state.pub_grace[sid] = now
                elif now - first >= config.PUB_GRACE_SEC:
                    reason = state.last_reason.get(sid) or "Live Pub rot tin hieu qua %ds - coi nhu buoi phat da ket thuc" % config.PUB_GRACE_SEC
                    _forget_breaker(sid)
                    state.last_reason[sid] = reason
                    state.stopped_for_human.add(sid)
                    return

        url = "%s/%s" % (s.get("rtmpBase", ""), s.get("streamKey", ""))
        if len(items) == 1:
            input_args, order = ["-stream_loop", "-1", "-i", items[0][0]], items
        else:
            order = items[:]
            if s.get("playMode") == "random":
                random.shuffle(order)
            plpath = os.path.join(config.PLAYLISTS, sid + ".txt")
            with open(plpath, "w") as pf:
                for p, _ in order:
                    pf.write("file '%s'\n" % p.replace("'", "'\\''"))
            input_args = ["-stream_loop", "-1", "-f", "concat", "-safe", "0", "-i", plpath]
        errf = open(errpath, "w")
        proc = subprocess.Popen(["ffmpeg", "-nostdin", "-loglevel", "error", "-re", *input_args, "-c", "copy", "-progress", "pipe:1", "-f", "flv", url],
                                stdout=subprocess.PIPE, stderr=errf)
        entry = {"proc": proc, "restarts": (cur["restarts"] + 1) if cur else 0, "started": time.time(), "deadAt": None,
                 "errf": errf, "order": order, "lastAlive": time.time(), "pendingDeadAt": pending_dead, "pendingReason": pending_reason,
                 "progAt": time.time(), "progUs": -1, "firstProgAt": None, "blackSince": None, "stallKill": False,
                 "bitrateKbps": None, "speed": None}
        state.stream_procs[sid] = entry
        threading.Thread(target=_progress_reader, args=(proc, entry), daemon=True).start()


def _progress_reader(proc, entry):
    """Đọc `-progress` của ffmpeg: đồng hồ (phát hiện treo), bitrate, speed. Ống đóng = ffmpeg chết → đánh thức giám sát."""
    try:
        for raw in proc.stdout:
            line = raw.decode("utf-8", "ignore").strip()
            key, _, val = line.partition("=")
            if key == "out_time_us":
                try:
                    us = int(val)
                except ValueError:
                    continue
                if us > entry["progUs"]:
                    entry["progUs"], entry["progAt"] = us, time.time()
                    if entry["firstProgAt"] is None:
                        entry["firstProgAt"] = time.time()
            elif key == "bitrate":
                try:
                    entry["bitrateKbps"] = round(float(val.strip().replace("kbits/s", "")), 1)
                except ValueError:
                    entry["bitrateKbps"] = None
            elif key == "speed":
                try:
                    entry["speed"] = round(float(val.strip().rstrip("x")), 2)
                except ValueError:
                    entry["speed"] = None
    except Exception:
        pass
    state.wake_event.set()


def stop_stream(sid):
    """Dừng hẳn + quên bản ghi (lần bật sau là phiên mới, không tính là sự cố)."""
    with state.stream_lock:
        _forget_breaker(sid)
        cur = state.stream_procs.pop(sid, None)
        if not cur:
            return
        try:
            if cur["proc"].poll() is None:
                cur["proc"].terminate()
                cur["proc"].wait(timeout=5)
        except Exception:
            try:
                cur["proc"].kill()
            except Exception:
                pass
        try:
            if cur.get("errf"):
                cur["errf"].close()
        except Exception:
            pass
        state.recently_stopped.add(sid)


def supervisor_loop():
    """Mỗi ≤2 giây (hoặc ngay khi ffmpeg chết): bật lại luồng chết, giết luồng treo, ghi sự cố, tự dừng khi cô lập."""
    while True:
        try:
            isolated = time.time() - state.lease["last_ok"]
            if isolated > state.lease["grace"]:
                for sid in list(state.desired_live.keys()):
                    if not state.lease["enabled"].get(sid):
                        continue   # luồng thường: giữ phát dù mất liên lạc máy chủ
                    if sid not in state.lease["fenced"]:
                        print("TU DUNG luong %s: mat lien lac may chu %ds -> tranh phat trung" % (sid, int(isolated)))
                        state.lease["fenced"].add(sid)
                    stop_stream(sid)
                    state.desired_live.pop(sid, None)
            for sid, s in list(state.desired_live.items()):
                cur = state.stream_procs.get(sid)
                if cur is None:
                    continue
                now = time.time()
                if cur["proc"].poll() is None:
                    cur["lastAlive"] = now
                    if cur.get("pendingDeadAt") is not None and cur.get("firstProgAt") is not None:
                        state.incidents.append({"streamId": sid, "kind": "restart", "at": _iso(),
                                                "downSec": max(0.1, round(cur["firstProgAt"] - cur["pendingDeadAt"], 1)),
                                                "reason": cur.get("pendingReason", "")})
                        cur["pendingDeadAt"] = None
                    if now - cur["started"] > 15 and now - cur.get("progAt", cur["started"]) > config.STALL_SEC:
                        cur["stallKill"], cur["deadAt"] = True, _last_alive(cur)
                        try:
                            cur["proc"].kill()
                        except Exception:
                            pass
                    continue
                if sid not in state.desired_live:
                    continue
                if cur.get("deadAt") is None:
                    cur["deadAt"] = _last_alive(cur)
                ensure_stream(s)
        except Exception as e:
            print("giam sat loi:", str(e)[:120])
        state.wake_event.wait(2)
        state.wake_event.clear()


def report():
    """Trạng thái từng luồng gửi về máy chủ."""
    out = []
    now = time.time()
    for sid, v in list(state.stream_procs.items()):
        alive = v["proc"].poll() is None
        health = ("good" if now - v["started"] > 8 else "starting") if alive else ("error" if sid in state.desired_live else "idle")
        out.append({"id": sid, "status": "live" if alive else "stopped", "health": health, "restarts": v["restarts"],
                    "uptimeSec": int(now - v["started"]) if alive else 0,
                    "black": bool(alive and v.get("blackSince") and now - v["blackSince"] >= 60),
                    "bitrateKbps": v.get("bitrateKbps") if alive else None, "speed": v.get("speed") if alive else None,
                    "restartHalted": sid in state.restart_halted, "needsHuman": sid in state.stopped_for_human,
                    "haltReason": state.last_reason.get(sid) or None})
    for sid in list(state.recently_stopped):
        out.append({"id": sid, "status": "stopped", "health": "idle", "restarts": 0, "uptimeSec": 0})
        state.recently_stopped.discard(sid)
    return out


def kill_orphan_ffmpeg():
    """Lúc khởi động: dọn ffmpeg đẩy RTMP còn sót của lần chạy trước (worker phải là người quản duy nhất).
    Chỉ giết tiến trình phát file trong THƯ MỤC DỮ LIỆU của worker này — không đụng ffmpeg của chương trình khác."""
    killed = 0
    try:
        for pid in filter(str.isdigit, os.listdir("/proc")):
            try:
                with open("/proc/%s/cmdline" % pid, "rb") as f:
                    cmd = f.read().replace(b"\0", b" ").decode("utf-8", "ignore")
            except Exception:
                continue
            if "ffmpeg" in cmd and "rtmp" in cmd and config.BASE in cmd:
                try:
                    os.kill(int(pid), 9)
                    killed += 1
                except Exception:
                    pass
    except Exception as e:
        print("don ffmpeg mo coi loi:", str(e)[:120])
    if killed:
        print("da don %d ffmpeg con sot tu lan chay truoc" % killed)
        time.sleep(1)
