# Công cụ tải (yt-dlp, gdown): tự cập nhật lúc khởi động + mỗi ngày, và KHAI phiên bản/lỗi về máy chủ
# (hỏng im lặng là bài học cũ: máy chạy yt-dlp bản rất cũ, tải Drive chậm hàng chục lần mà không ai biết).
import os
import shutil
import subprocess
import sys
import time
import urllib.request

from . import config, state
from .media import sh


def read_versions():
    try:
        r = sh(["yt-dlp", "--version"], timeout=30)
        state.tools["ytdlp"] = (r.stdout or "").strip().splitlines()[0][:40] if r.returncode == 0 else ""
    except Exception:
        state.tools["ytdlp"] = ""
    state.tools["gdown"] = bool(shutil.which("gdown"))


def _pip_command():
    """pipx (nếu yt-dlp cài qua pipx) → pip3 → python3 -m pip. None nếu không có cách nào."""
    pipx = shutil.which("pipx") or os.path.expanduser("~/.local/bin/pipx")
    if os.path.isfile(pipx):
        return [pipx, "runpip", "yt-dlp"]
    if shutil.which("pip3"):
        return ["pip3"]
    try:
        if subprocess.run([sys.executable or "python3", "-m", "pip", "--version"], capture_output=True, timeout=30).returncode == 0:
            return [sys.executable or "python3", "-m", "pip"]
    except Exception:
        pass
    return None


def _requirements_args():
    req = os.path.join(config.BASE, "requirements.txt")
    try:
        urllib.request.urlretrieve(config.URL + "/worker/requirements.txt", req)
        return ["-r", req]
    except Exception:
        return ["yt-dlp", "gdown"]


def auto_update_loop():
    while True:
        read_versions()
        pip = _pip_command()
        if not pip:
            state.tools["updateError"] = "May khong co pip3 nen khong tu cap nhat duoc yt-dlp/gdown. SSH vao may chay: apt-get install -y python3-pip"
        else:
            err = ""
            for extra in ([], ["--break-system-packages"]):
                try:
                    r = subprocess.run([*pip, "install", "-U", *extra, *_requirements_args()], capture_output=True, text=True, timeout=600)
                    if r.returncode == 0:
                        err = ""
                        break
                    err = (r.stderr or r.stdout or "").strip()[-200:] or "pip bao loi khong ro"
                except Exception as e:
                    err = str(e)[-200:]
            state.tools["updateError"] = ("Tu cap nhat yt-dlp/gdown that bai: " + err) if err else ""
            read_versions()
        if not state.tools["ytdlp"]:
            state.tools["updateError"] = (state.tools["updateError"] + " · " if state.tools["updateError"] else "") + "May chua co yt-dlp — tai video tu Drive se cham hoac hong."
        if state.tools["updateError"]:
            print("CANH BAO:", state.tools["updateError"])
        time.sleep(24 * 3600)
