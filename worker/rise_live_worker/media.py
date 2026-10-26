# Chạy lệnh ngoài + đọc thông tin video bằng ffprobe.
import json
import re
import subprocess
import time


def sh(args, timeout=None):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)


def probe_media(path):
    """(width, height, duration giây) — lỗi thì (0, 0, 0)."""
    try:
        r = sh(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                "-show_entries", "format=duration", "-of", "json", path], timeout=30)
        j = json.loads(r.stdout or "{}")
        st = (j.get("streams") or [{}])[0]
        return int(st.get("width") or 0), int(st.get("height") or 0), round(float((j.get("format") or {}).get("duration") or 0))
    except Exception:
        return 0, 0, 0


_YT_PROGRESS = re.compile(r"\[download\]\s+([\d.]+)%\s+of\s+~?\s*([\d.]+)\s*(KiB|MiB|GiB)", re.I)
_UNIT = {"kib": 1024.0, "mib": 1024.0 ** 2, "gib": 1024.0 ** 3}


class _Result:
    def __init__(self, returncode, stdout, stderr):
        self.returncode, self.stdout, self.stderr = returncode, stdout, stderr


def sh_ytdlp(args, timeout=3600, on_progress=None):
    """Chạy yt-dlp và đọc dòng tiến độ của nó → on_progress(byte đã tải, tổng byte)."""
    if not on_progress:
        return sh(args, timeout=timeout)
    p = subprocess.Popen([*args, "--newline"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
    deadline = time.time() + timeout
    tail = []
    try:
        for line in p.stdout:
            tail = (tail + [line])[-40:]
            m = _YT_PROGRESS.search(line)
            if m:
                total = float(m.group(2)) * _UNIT[m.group(3).lower()]
                on_progress(int(total * float(m.group(1)) / 100.0), int(total))
            if time.time() > deadline:
                p.kill()
                break
    except Exception:
        pass
    err = p.stderr.read() if p.stderr else ""
    p.wait()
    return _Result(p.returncode, "".join(tail), err or "")
