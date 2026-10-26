// Khối lệnh cài / cập nhật worker trên VPS Ubuntu (dán nguyên khối vào SSH). THUẦN — nhận tham số, trả chuỗi.
// Worker là MỘT file .pyz (gói Python nén, chạy thẳng bằng python3) do máy chủ phát tại /worker/rise-live-worker.pyz.
export interface InstallParams {
  serverUrl: string;
  machineId: string;
  token: string;
  uploadToken?: string;
  uploadPort?: number;
  uploadHost?: string;  // tên miền nhận file HTTPS (nếu có) → tự dựng Caddy
}

export function installScript(p: InstallParams): string {
  const port = p.uploadPort || 8099;
  const caddy = p.uploadHost ? `
# --- HTTPS nhận file tải thẳng (Caddy) cho ${p.uploadHost} → cổng ${port} ---
apt install -y debian-keyring debian-archive-keyring apt-transport-https gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
apt update && apt install -y caddy
printf '%s {\\n    reverse_proxy localhost:${port}\\n}\\n' "${p.uploadHost}" >/etc/caddy/Caddyfile
command -v ufw >/dev/null 2>&1 && { ufw allow 80/tcp; ufw allow 443/tcp; }
systemctl restart caddy
` : "";
  return `RISE_LIVE_URL="${p.serverUrl}"
RISE_LIVE_MACHINE="${p.machineId}"
RISE_LIVE_TOKEN="${p.token}"
RISE_LIVE_UPLOAD_TOKEN="${p.uploadToken ?? ""}"

apt update && apt install -y python3 python3-pip ffmpeg curl speedtest-cli
mkdir -p /opt/rise-live /var/lib/rise-live
curl -fsSL "$RISE_LIVE_URL/worker/requirements.txt" -o /opt/rise-live/requirements.txt || printf 'yt-dlp\\ngdown\\n' >/opt/rise-live/requirements.txt
pip3 install -U -r /opt/rise-live/requirements.txt || pip3 install -U --break-system-packages -r /opt/rise-live/requirements.txt || echo 'CANH BAO: cai yt-dlp/gdown that bai'
curl -fsSL "$RISE_LIVE_URL/worker/rise-live-worker.pyz" -o /opt/rise-live/rise-live-worker.pyz
cat >/opt/rise-live/worker.env <<EOF
RISE_LIVE_URL=$RISE_LIVE_URL
RISE_LIVE_MACHINE=$RISE_LIVE_MACHINE
RISE_LIVE_TOKEN=$RISE_LIVE_TOKEN
RISE_LIVE_UPLOAD_TOKEN=$RISE_LIVE_UPLOAD_TOKEN
RISE_LIVE_UPLOAD_PORT=${port}
RISE_LIVE_DATA_DIR=/var/lib/rise-live
PYTHONIOENCODING=utf-8
EOF
chmod 600 /opt/rise-live/worker.env
cat >/etc/systemd/system/rise-live.service <<'EOF'
[Unit]
Description=AB Live Worker
After=network-online.target
Wants=network-online.target
[Service]
EnvironmentFile=/opt/rise-live/worker.env
ExecStart=/usr/bin/python3 /opt/rise-live/rise-live-worker.pyz
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
command -v ufw >/dev/null 2>&1 && ufw allow ${port}/tcp || true
systemctl daemon-reload && systemctl enable rise-live && systemctl restart rise-live
sleep 2 && systemctl status rise-live --no-pager | head -15
for t in ffmpeg ffprobe yt-dlp gdown; do command -v $t >/dev/null 2>&1 && echo "  OK    $t" || echo "  THIEU $t"; done
${caddy}`;
}
