#!/usr/bin/env bash
# Chạy worker thử trên Ubuntu / WSL2 (worker chỉ chạy trên Linux).
#   1) Giao diện → Máy live → Thêm máy → "Cài worker" → chép RISE_LIVE_MACHINE + RISE_LIVE_TOKEN vào .env.local
#   2) npm run worker
# Thiếu RISE_LIVE_TOKEN thì dùng RISE_LIVE_WORKER_TOKEN (vé chung). Thiếu RISE_LIVE_URL → http://localhost:3000.
# KHÔNG dùng sudo (sudo-rs trên Ubuntu mới làm mất biến môi trường). Dữ liệu worker: .worker-data/
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
source "$HERE/scripts/load-env.sh"
load_env_local "$HERE/.env.local"

export RISE_LIVE_TOKEN="${RISE_LIVE_TOKEN:-${RISE_LIVE_WORKER_TOKEN:-}}"
export RISE_LIVE_URL="${RISE_LIVE_URL:-http://localhost:3000}"
RISE_LIVE_URL="${RISE_LIVE_URL%/}"
case "$RISE_LIVE_URL" in
  *://*/*) echo "RISE_LIVE_URL='$RISE_LIVE_URL' có đường dẫn phía sau — chỉ để gốc máy chủ, vd http://localhost:3000"; exit 1;;
esac
export RISE_LIVE_DATA_DIR="${RISE_LIVE_DATA_DIR:-$HERE/.worker-data}"
: "${RISE_LIVE_MACHINE:?Thiếu RISE_LIVE_MACHINE (mã máy trong giao diện — ghi vào .env.local)}"
: "${RISE_LIVE_TOKEN:?Thiếu RISE_LIVE_TOKEN (hoặc RISE_LIVE_WORKER_TOKEN) trong .env.local}"

for c in python3 ffmpeg ffprobe; do
  command -v "$c" >/dev/null || { echo "Thiếu '$c'. Cài: sudo apt update && sudo apt install -y python3 python3-pip ffmpeg"; exit 1; }
done
command -v yt-dlp >/dev/null || echo "Cảnh báo: chưa có yt-dlp (cần khi tải từ Google Drive): pip3 install -U -r $HERE/worker/requirements.txt"

echo "Worker → $RISE_LIVE_URL (máy: $RISE_LIVE_MACHINE, dữ liệu: $RISE_LIVE_DATA_DIR)"
exec python3 "$HERE/worker"
