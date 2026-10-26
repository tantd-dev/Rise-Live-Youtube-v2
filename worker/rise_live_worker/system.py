# Số liệu máy gửi kèm mỗi nhịp: CPU, RAM, ổ đĩa, tải, băng thông đẩy (đo 1 lần) và đang dùng.
import json
import os
import shutil
import subprocess
import time

from . import state


def _tx_bytes():
    """Tổng byte đã GỬI RA trên các card mạng (bỏ loopback)."""
    total = 0
    try:
        with open("/proc/net/dev") as f:
            for line in f.readlines()[2:]:
                p = line.replace(":", " ").split()
                if p and p[0] != "lo":
                    total += int(p[9])
    except Exception:
        pass
    return total


def measure_upload():
    """Đo tốc độ đẩy 1 lần lúc khởi động (Ookla speedtest, lui về speedtest-cli). Best-effort."""
    try:
        r = subprocess.run(["speedtest", "--accept-license", "--accept-gdpr", "-f", "json"], capture_output=True, text=True, timeout=180)
        bw = float(json.loads(r.stdout or "{}").get("upload", {}).get("bandwidth", 0)) if r.returncode == 0 else 0
        if bw > 0:
            state.net["upload_mbps"] = round(bw * 8 / 1e6)
            return
    except Exception:
        pass
    try:
        r = subprocess.run(["speedtest-cli", "--simple"], capture_output=True, text=True, timeout=120)
        for line in (r.stdout or "").splitlines():
            if line.strip().startswith("Upload"):
                state.net["upload_mbps"] = round(float(line.split()[1]))
                return
    except Exception:
        pass


def heartbeat():
    hb = {"vcpu": os.cpu_count() or 0}
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal"):
                    hb["ramGb"] = round(int(line.split()[1]) / 1024 / 1024, 1)
                    break
    except Exception:
        pass
    try:
        total, _used, free = shutil.disk_usage("/")
        hb["diskGb"], hb["diskFreeGb"] = round(total / 1e9), round(free / 1e9)
    except Exception:
        pass
    try:
        hb["loadAvg"] = round(os.getloadavg()[0], 2)
    except Exception:
        pass
    if state.net["upload_mbps"]:
        hb["uploadMbps"] = state.net["upload_mbps"]
    cur, now = _tx_bytes(), time.time()
    last = state.net["last_tx"]
    if last and now > last[1] and cur >= last[0]:
        hb["txMbps"] = round((cur - last[0]) / (now - last[1]) * 8 / 1e6, 1)
    state.net["last_tx"] = (cur, now)
    if state.tools.get("ytdlp"):
        hb["ytdlpVersion"] = state.tools["ytdlp"]
    hb["gdownOk"] = bool(state.tools.get("gdown"))
    hb["toolError"] = str(state.tools.get("updateError") or "")[:300]
    return hb
