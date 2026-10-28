# Khởi động worker: các live nền (giám sát, ảnh, máy chủ nhận file, cập nhật công cụ, đo băng thông)
# + vòng hỏi máy chủ chính.
import os
import sys
import threading
import time

from . import config, http_server, state, streams, system, thumbs, tools
from .sync import apply_server_settings, reconcile, sync


def main():
    try:   # một số VPS không dùng UTF-8 → in tiếng Việt có dấu làm sập worker
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    config.check_or_exit()
    config.install_user_agent()
    print("AB Live worker %s - may %s -> %s (du lieu: %s)" % (config.AGENT_VERSION, config.MACHINE, config.URL, config.BASE))
    streams.kill_orphan_ffmpeg()

    background = [system.measure_upload, streams.supervisor_loop, thumbs.thumbnail_loop, http_server.serve_forever]
    background.append(tools.auto_update_loop if os.environ.get("RISE_LIVE_AUTO_UPDATE", "1") != "0" else tools.read_versions)
    for fn in background:
        threading.Thread(target=fn, daemon=True).start()

    poll, failures = 10, 0
    while True:
        try:
            desired = sync()
            apply_server_settings(desired)
            reconcile(desired)
            poll = int(desired.get("pollSeconds") or 10)
            if failures:
                print("noi lai may chu OK")
            failures = 0
        except Exception as e:
            failures += 1
            print("sync loi (lan %d lien tiep):" % failures, str(e)[:200])
        # Hụt thì thử lại nhanh vài lần để không bị máy chủ coi là mất liên lạc vì lỡ 1 gói tin.
        time.sleep(config.SYNC_RETRY_SEC if 0 < failures <= config.SYNC_RETRY_MAX else max(3, poll))


if __name__ == "__main__":
    main()
