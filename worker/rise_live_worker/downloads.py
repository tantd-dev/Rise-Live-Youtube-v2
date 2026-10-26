# Tải video: Google Drive (tự tải → yt-dlp → gdown) và kéo file VPS→VPS.
# on_progress(byte đã tải, tổng byte) để giao diện thấy % thay vì "chờ xử lý" đứng im.
import http.cookiejar
import os
import re
import shutil
import time
import urllib.parse
import urllib.request

from .media import sh, sh_ytdlp

_UA = "Mozilla/5.0 (X11; Linux x86_64) RiseLiveWorker"   # Google Drive: giữ UA dạng trình duyệt


def _stream_to_file(resp, dest, on_progress, timeout):
    total = int(resp.headers.get("Content-Length") or 0)
    got, last_report, deadline = 0, 0.0, time.time() + timeout
    with open(dest, "wb") as f:
        while True:
            if time.time() > deadline:
                raise TimeoutError("tai qua lau (qua %ds)" % timeout)
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
            got += len(chunk)
            if on_progress and time.time() - last_report >= 2:
                last_report = time.time()
                on_progress(got, total)
    return got, total


def _drive_direct(fid, raw, on_progress=None, timeout=3600):
    """Tự tải file Drive công khai, tự xử trang xác nhận "virus scan" của file lớn. Trả (ok, lỗi)."""
    try:
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        opener.addheaders = [("User-Agent", _UA)]
        url = "https://drive.google.com/uc?export=download&id=%s" % fid
        for _ in range(3):   # gốc → trang xác nhận → file
            r = opener.open(url, timeout=120)
            if "text/html" not in (r.headers.get("Content-Type") or "").lower():
                tmp = raw + ".part"
                got, _total = _stream_to_file(r, tmp, on_progress, timeout)
                if got <= 0:
                    os.remove(tmp)
                    return False, "file rong"
                os.replace(tmp, raw)
                return True, ""
            html = r.read(200000).decode("utf-8", "ignore")
            low = html.lower()
            if "quota exceeded" in low or "too many users have viewed" in low:
                return False, ("Google KHOA HAN MUC TAI file nay (tai qua nhieu lan trong ngay) - khong phai loi quyen. "
                               "Tao BAN SAO file tren Drive roi dan link ban sao, hoac cho ~24 gio, hoac tai thang tu may tinh.")
            if ("access denied" in low or "request access" in low or "you need access" in low) and "virus scan" not in low:
                return False, "File CHUA MO QUYEN: Drive -> Chia se -> 'Bat ky ai co duong lien ket' (Nguoi xem)."
            form = re.search(r'<form[^>]*id="download-form"[^>]*>.*?</form>', html, re.I | re.S)
            action = re.search(r'action="([^"]+)"', form.group(0) if form else html)
            if not action:
                return False, "Google tra ve trang la (khong thay nut tai) - thu lai sau, hoac tai thang tu may tinh"
            params = {}
            for tag in re.findall(r"<input[^>]*>", html, re.I):
                name, val = re.search(r'name="([^"]*)"', tag), re.search(r'value="([^"]*)"', tag)
                if name and name.group(1) and name.group(1) != "submit":
                    params[name.group(1)] = val.group(1) if val else ""
            base = action.group(1).replace("&amp;", "&")
            url = base + ("&" if "?" in base else "?") + urllib.parse.urlencode(params)
        return False, "qua nhieu vong xac nhan"
    except Exception as e:
        return False, str(e)[-200:]


def download_drive(fid, raw, on_progress=None):
    """Thử lần lượt: tự tải → yt-dlp → gdown. Trả (ok, lỗi cuối cùng)."""
    ok, last = _drive_direct(fid, raw, on_progress)
    if ok:
        return True, ""
    tmpdir = raw + ".ytdl"
    try:
        shutil.rmtree(tmpdir, ignore_errors=True)
        os.makedirs(tmpdir, exist_ok=True)
        r = sh_ytdlp(["yt-dlp", "--no-playlist", "--no-part", "-o", os.path.join(tmpdir, "f.%(ext)s"),
                      "https://drive.google.com/file/d/%s/view" % fid], on_progress=on_progress)
        got = [os.path.join(tmpdir, x) for x in os.listdir(tmpdir)]
        got = [f for f in got if os.path.isfile(f) and os.path.getsize(f) > 0]
        if r.returncode == 0 and got:
            os.replace(max(got, key=os.path.getsize), raw)
            return True, ""
        last = (r.stderr or "")[-200:] or last
    except FileNotFoundError:
        last = "yt-dlp chua cai"
    except Exception as e:
        last = str(e)[-200:]
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
    for cmd in (["gdown", fid, "-O", raw], ["gdown", "https://drive.google.com/uc?id=%s&export=download" % fid, "-O", raw, "--no-cookies"]):
        try:
            r = sh(cmd, timeout=3600)
            if r.returncode == 0 and os.path.exists(raw) and os.path.getsize(raw) > 0:
                return True, ""
            last = (r.stderr or "")[-200:] or last
        except FileNotFoundError:
            last = "gdown chua cai"
        except Exception as e:
            last = str(e)[-200:]
    return False, last


def http_pull(url, dest, on_progress=None):
    """Kéo file đã chuẩn từ VPS khác; thiếu byte → bỏ file, báo lỗi. Trả (ok, lỗi)."""
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=120) as r:
            got, total = _stream_to_file(r, dest, on_progress, 4 * 3600)
        if (total and got < total) or got == 0:
            os.remove(dest)
            return False, "nhan thieu (%d/%d byte)" % (got, total) if got else "file rong"
        return True, ""
    except Exception as e:
        try:
            os.remove(dest)
        except Exception:
            pass
        return False, str(e)[:200]
