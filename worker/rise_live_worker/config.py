# Cấu hình worker: biến môi trường, thư mục dữ liệu, các ngưỡng. Mọi module đọc từ đây.
import os
import sys

AGENT_VERSION = "v2.0"

URL = os.environ.get("RISE_LIVE_URL", "").strip().rstrip("/")
TOKEN = os.environ.get("RISE_LIVE_TOKEN", "").strip()
MACHINE = os.environ.get("RISE_LIVE_MACHINE", "").strip()
UPLOAD_TOKEN = os.environ.get("RISE_LIVE_UPLOAD_TOKEN", "").strip()   # vé RIÊNG cho tải lên / chép VPS→VPS
UPLOAD_PORT = int(os.environ.get("RISE_LIVE_UPLOAD_PORT") or 8099)

# Thư mục dữ liệu (video, ảnh, nhật ký ffmpeg…). VPS: /var/lib/rise-live; chạy thử: <repo>/.worker-data
BASE = os.path.abspath(os.environ.get("RISE_LIVE_DATA_DIR") or os.path.join(os.getcwd(), ".worker-data"))
ASSETS = os.path.join(BASE, "assets")       # <assetId>.mp4 đã sẵn sàng phát
RAW = os.path.join(BASE, "raw")             # file gốc vừa tải, chờ chuẩn hoá
THUMBS = os.path.join(BASE, "thumbs")       # <streamId>.jpg ảnh đang phát
LOGS = os.path.join(BASE, "logs")           # <streamId>.err — dòng lỗi ffmpeg (đọc lý do rớt)
PLAYLISTS = os.path.join(BASE, "playlists")  # danh sách phát (concat) khi luồng có nhiều video

MAX_PARALLEL_DOWNLOADS = max(1, int(os.environ.get("RISE_LIVE_MAX_PARALLEL_DOWNLOADS") or 2))
try:
    MAX_ENCODE = max(1, int(os.environ.get("RISE_LIVE_MAX_ENCODE") or max(1, (os.cpu_count() or 4) // 8)))
except ValueError:
    MAX_ENCODE = 1

# Tự khởi động lại luồng: chớp tắt > RESTART_MAX lần trong RESTART_WINDOW giây → tạm ngừng theo BẬC thang
# chờ (20s → 40s → 60s → 120s → 300s lặp mãi). Chạy ổn định > STABLE_RESET_SEC → về bậc đầu.
RESTART_WINDOW = 120
RESTART_MAX = 5
RETRY_LADDER = [20, 40, 60, 120, 300]
STABLE_RESET_SEC = 300
STALL_SEC = 25                 # đồng hồ ffmpeg đứng yên quá lâu → coi là treo, giết để bật lại
PUB_GRACE_SEC = 90             # Live Pub rớt: cho nối lại trong khung này, quá thì coi như buổi đã kết thúc
SSD_MIN_FREE_GB = 15           # dưới mức này → chặn tải video mới (bảo vệ luồng đang phát)

# Gọi máy chủ: chờ tối đa 15s; hụt thì thử lại nhanh 5s (tối đa 3 lần) để không bị coi là "mất liên lạc".
SYNC_TIMEOUT = 15
SYNC_RETRY_SEC = 5
SYNC_RETRY_MAX = 3

THUMB_SCAN_SEC = 60            # chụp ảnh + dò màn đen (tại VPS, không tốn máy chủ)
THUMB_PUSH_DEFAULT = 300       # đẩy ảnh lên máy chủ (máy chủ chỉnh được qua thumbPushSec)


def check_or_exit():
    if not (URL and TOKEN and MACHINE):
        print("Thieu RISE_LIVE_URL / RISE_LIVE_TOKEN / RISE_LIVE_MACHINE")
        sys.exit(1)
    for d in (ASSETS, RAW, THUMBS, LOGS, PLAYLISTS):
        os.makedirs(d, exist_ok=True)
