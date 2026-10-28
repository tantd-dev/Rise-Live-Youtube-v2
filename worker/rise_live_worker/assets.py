# Chuẩn bị video trên máy: xếp hàng → tải (Drive / chép VPS→VPS) → chuẩn hoá bằng ffmpeg → sẵn sàng.
# Ghi ra file .part rồi đổi tên NGUYÊN TỬ khi xong → mất điện giữa chừng không để lại file hỏng.
import os
import shutil
import time
import urllib.parse

from . import config, state
from .downloads import download_drive, http_pull
from .media import probe_media, sh


def _set(aid, **fields):
    with state.lock:
        v = state.asset_local.get(aid) or {}
        v.update(fields)
        state.asset_local[aid] = v


def _free_gb():
    try:
        return shutil.disk_usage(config.BASE).free / (1024 ** 3)
    except Exception:
        return None


def _mark_ready(aid, path, speed=None):
    w, h, dur = probe_media(path)
    with state.lock:
        state.asset_local[aid] = {"status": "ready", "path": path, "sizeMb": round(os.path.getsize(path) / 1e6, 1),
                                  "working": False, "width": w, "height": h, "durationSec": dur, "dlMbPerMin": speed}


def prepare(asset):
    """Chạy trong thread riêng. Giới hạn số video tải cùng lúc; báo vị trí xếp hàng."""
    aid = asset["id"]
    _set(aid, status="waiting", working=True)
    with state.dl_queue_lock:
        state.dl_waiting.append(aid)
    try:
        while not state.dl_sem.acquire(timeout=5):
            with state.dl_queue_lock:
                ahead = state.dl_waiting.index(aid) if aid in state.dl_waiting else 0
            _set(aid, status="waiting", working=True, queueAhead=ahead)
    finally:
        with state.dl_queue_lock:
            if aid in state.dl_waiting:
                state.dl_waiting.remove(aid)
    try:
        _prepare_run(asset)
    except Exception as e:
        with state.lock:
            state.asset_local[aid] = {"status": "error", "error": str(e)[:280], "working": False}
    finally:
        state.dl_sem.release()


def _prepare_run(asset):
    aid, preset, fid = asset["id"], asset.get("preset") or {}, asset.get("driveFileId", "")
    out = os.path.join(config.ASSETS, aid + ".mp4")
    raw = os.path.join(config.RAW, aid + ".src")
    started = time.time()

    def progress(got, total):
        _set(aid, status="downloading", working=True, downloadedMb=round(got / 1e6, 1),
             totalMb=round(total / 1e6, 1) if total else 0, progressPct=max(0, min(100, int(got * 100 / total))) if total else None, queueAhead=None)

    def mb_per_min(path):
        try:
            return round((os.path.getsize(path) / 1e6) / (max(0.001, time.time() - started) / 60.0), 1)
        except Exception:
            return None

    with state.lock:
        state.asset_local[aid] = {"status": "downloading", "working": True}
    # free = _free_gb()
    # if free is not None and free < config.SSD_MIN_FREE_GB:
    #     raise RuntimeError("O cung chi con %.0fGB - chan tai video moi de bao ve luong dang phat. Xoa bot video." % free)

    # 1) Chép thẳng từ VPS khác (giữ nguyên chất lượng, không qua Drive).
    cf = asset.get("copyFrom") or {}
    if cf.get("url") and cf.get("assetId"):
        src = "%s/asset?id=%s&token=%s" % (str(cf["url"]).rstrip("/"), urllib.parse.quote(str(cf["assetId"])), urllib.parse.quote(config.UPLOAD_TOKEN))
        tmp = out + ".copy"
        ok, err = http_pull(src, tmp, progress)
        if ok:
            os.replace(tmp, out)
            _mark_ready(aid, out, mb_per_min(out))
            print("CHEP VPS->VPS OK:", aid)
            return
        # Chép TAY hỏng → báo rõ. Chép do máy chủ tự chọn (optional) hỏng → lui về tải Drive.
        if not (cf.get("optional") and fid):
            raise RuntimeError("Chep tu may nguon that bai (%s). Kiem may nguon con song + cong %d, hoac them lai bang link Drive / tai thang." % (err, config.UPLOAD_PORT))
        print("Chep VPS->VPS that bai (%s) -> lui ve tai Drive" % err)
        started = time.time()

    # 2) Tải từ Google Drive.
    if not fid:
        raise RuntimeError("Khong doc duoc file id Google Drive")
    ok, err = download_drive(fid, raw, progress)
    if not ok:
        raise RuntimeError("Tai Drive that bai: " + (err or "khong ro"))
    speed = mb_per_min(raw)

    # 3) Chuẩn hoá. "Giữ nguyên gốc" = chỉ copy hình + chuẩn audio AAC (gần như không tốn CPU).
    #    Nén lại thì xếp hàng (MAX_ENCODE) và chạy ưu tiên thấp để không làm giật live đang phát.
    part = out + ".part"
    ab = int(preset.get("audioBitrateKbps", 256))
    nice = ["nice", "-n", "19"]
    if preset.get("keepOriginal") or not preset:
        args = nice + ["ffmpeg", "-y", "-i", raw, "-c:v", "copy", "-c:a", "aac", "-b:a", "%dk" % ab, "-ar", "44100", "-movflags", "+faststart", "-f", "mp4", part]
        _set(aid, status="normalizing", progressPct=None)
        r = sh(args, timeout=14400)
    else:
        fps, vb = int(preset.get("fps", 30)), int(preset.get("videoBitrateKbps", 6000))
        gop = str(fps * 2)
        args = nice + ["ffmpeg", "-y", "-i", raw, "-threads", "4",
                       "-vf", "scale=%d:%d" % (int(preset.get("width", 1920)), int(preset.get("height", 1080))),
                       "-r", str(fps), "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high", "-pix_fmt", "yuv420p",
                       "-b:v", "%dk" % vb, "-minrate", "%dk" % int(vb * 0.83), "-maxrate", "%dk" % int(vb * 1.17), "-bufsize", "%dk" % (vb * 2),
                       "-g", gop, "-keyint_min", gop, "-sc_threshold", "0",
                       "-c:a", "aac", "-b:a", "%dk" % ab, "-ar", "44100", "-movflags", "+faststart", "-f", "mp4", part]
        _set(aid, status="queued", progressPct=None)
        with state.encode_sem:
            _set(aid, status="normalizing")
            r = sh(args, timeout=14400)
    if r.returncode != 0 or not os.path.exists(part):
        try:
            os.remove(part)
        except Exception:
            pass
        raise RuntimeError("Chuan hoa that bai: " + (r.stderr or "")[-200:])
    os.replace(part, out)
    try:
        os.remove(raw)
    except Exception:
        pass
    _mark_ready(aid, out, speed)
