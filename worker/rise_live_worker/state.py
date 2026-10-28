# Trạng thái dùng chung giữa các live xử lý (thread) của worker.
import threading
import time

from . import config

lock = threading.Lock()              # bảo vệ asset_local + pending_uploads
stream_lock = threading.Lock()       # nối tiếp bật/dừng ffmpeg giữa giám sát và reconcile

# assetId -> {"status","path","sizeMb","durationSec","width","height","error","working", tiến độ…}
asset_local = {}
pending_uploads = []                 # video tải thẳng lên, chờ máy chủ đăng ký

# streamId -> bản ghi tiến trình ffmpeg (xem streams.ensure_stream)
stream_procs = {}
desired_live = {}                    # streamId -> dict live ĐANG PHẢI phát
recently_stopped = set()             # vừa dừng → báo "stopped" 1 lần cho máy chủ
incidents = []                       # sự cố tự phục hồi chưa gửi

# Bộ ngắt chớp tắt
restart_history = {}                 # sid -> [mốc restart gần đây]
restart_halted = {}                  # sid -> mốc bị tạm ngừng
restart_step = {}                    # sid -> bậc thang chờ hiện tại
restart_wait = {}                    # sid -> số giây phải chờ của đợt hiện tại
stopped_for_human = set()            # dừng hẳn vì lỗi nguồn/file — chờ người sửa
pub_grace = {}                       # sid Live Pub -> mốc bắt đầu rớt
last_reason = {}                     # sid -> lý do rớt gần nhất

wake_event = threading.Event()       # ffmpeg vừa chết → đánh thức giám sát ngay

# Tự dừng khi cô lập (lease): mất liên lạc máy chủ quá grace giây → dừng live có leaseEnabled.
lease = {"last_ok": time.time(), "grace": 60, "enabled": {}, "fenced": set()}

thumb = {"push": config.THUMB_PUSH_DEFAULT}
thumb_last_push = {}

tools = {"ytdlp": "", "gdown": False, "updateError": ""}
net = {"upload_mbps": None, "last_tx": None}

# Xếp hàng tải / nén
dl_sem = threading.Semaphore(config.MAX_PARALLEL_DOWNLOADS)
dl_waiting = []
dl_queue_lock = threading.Lock()
encode_sem = threading.Semaphore(config.MAX_ENCODE)
