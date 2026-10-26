# AB Live V2

Hệ phát trực tiếp 24/7 lên YouTube từ nhiều VPS — viết lại từ AB Live cũ, tách theo từng mảng nghiệp vụ
để dễ đọc, dễ mở rộng và triển khai từng phần.

```
LỚP ĐIỀU KHIỂN (Next.js + Firestore)          MỖI VPS (worker Python)
 giao diện · quyết định luồng nào chạy ở đâu  ◄── hỏi/đáp ~20s ──  tự tải video (Drive / chép VPS→VPS)
 nhận nhịp tim · cảnh báo · tự cứu                                 chạy FFmpeg copy-codec → YouTube RTMP
```

Worker **chủ động hỏi** máy chủ (POST `/api/live/agent`) nên VPS không cần mở cổng vào, không cần IP tĩnh.
Giao thức giữ nguyên như bản cũ → worker cũ (r2.x) vẫn nói chuyện được với máy chủ V2.

## Chạy trên máy

Các lệnh `npm run …` chạy được ngay trong **PowerShell** (Windows) lẫn trong WSL/Linux:
- `emulator` và `dev` chạy trên Windows (cần Node 20+, Java 11+).
- `worker` chỉ chạy trên Linux: gõ trong PowerShell thì script **tự gọi vào WSL bản `Ubuntu`** (không dùng bản WSL
  mặc định — trên máy này là `docker-desktop`, không có bash), và tự đổi `localhost` thành địa chỉ Windows nhìn từ WSL.
  Đổi bản WSL bằng `RISE_LIVE_WSL_DISTRO`. Trong Ubuntu cần `python3`, `ffmpeg`, `yt-dlp`, `gdown`.
- Cổng đã bị chiếm (thường do **bản AB Live cũ** đang chạy trong WSL ở 3000/8080/4000/8099) → script báo rõ và dừng.
  Tắt bản cũ, hoặc đổi cổng: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8180`, `RISE_LIVE_EMULATOR_UI_PORT=4100` trong
  `.env.local`; app: `$env:PORT=3100; npm run dev` (nhớ sửa `APP_BASE_URL` / `RISE_LIVE_URL` theo);
  worker: `RISE_LIVE_UPLOAD_PORT=8199`.
- Worker không gọi được app trên Windows (`timed out`) → cho phép Node.js qua Windows Firewall, hoặc chạy cả 3 trong WSL.

```bash
npm install
cp .env.example .env.local   # đã có .env.local thì giữ nguyên — tên biến y như bản cũ
```

Thứ tự chạy, mỗi lệnh một terminal:

```bash
npm run emulator   # 1. Firestore emulator (cổng theo FIRESTORE_EMULATOR_HOST, UI :4000), lưu .emulator-data khi Ctrl+C
```

```bash
npm run dev        # 2. http://localhost:3000 → "Đăng nhập thử" (ALLOW_DEV_LOGIN=1)
```

Trong giao diện: **Máy live → + Thêm máy** (IP `127.0.0.1` khi chạy thử) → hộp "Cài worker" hiện **mã máy** + vé riêng.
Chép 2 dòng `RISE_LIVE_MACHINE=…` / `RISE_LIVE_TOKEN=…` vào `.env.local`, rồi:

```bash
npm run worker     # 3. worker (từ PowerShell sẽ tự chạy trong WSL Ubuntu) — máy chuyển 🟢 Online sau vài giây
```

Sau đó: **Kho video** thêm video (link Google Drive, hoặc tải thẳng nếu có `RISE_LIVE_UPLOAD_TOKEN`) → chờ "Sẵn sàng"
→ **Luồng phát → + Tạo luồng**: chọn máy, video, dán **khoá luồng** + **link xem** (`youtube.com/watch?v=…`) từ
YouTube Studio. RTMP YouTube (`rtmp://a.rtmp.youtube.com/live2`) đã đặt sẵn.

Lỗi worker hay gặp: `HTTP 404` = sai `RISE_LIVE_MACHINE` (máy chưa đăng ký) · `HTTP 401` = sai vé.
Chạy thử không cần YouTube: đặt `RISE_LIVE_RTMP_BASE=rtmp://127.0.0.1:1935/live2` cho **máy chủ** rồi mở một
"máy nhận" cục bộ: `ffmpeg -listen 1 -i rtmp://127.0.0.1:1935/live2/<khoá> -f null -`.

## Cấu trúc

```
app/                      chỉ là lớp mỏng: trang + route API (mỗi route gọi đúng 1 service)
  api/dashboard           GET ảnh chụp toàn cảnh cho giao diện
  api/machines|assets|streams/...   REST theo miền (POST/PATCH/PUT/DELETE)
  api/live/agent          API cho worker (giữ đường dẫn bản cũ) · api/live/agent-thumb
  api/cron/[job]          failover | alerts | youtube — cho Cloud Scheduler (x-cron-secret)
  worker/[file]           phát rise-live-worker.pyz + requirements.txt cho VPS tải
features/<miền>/          mỗi miền một thư mục, cùng một nếp:
  types.ts, rules.ts …    THUẦN (không Firestore) — dùng chung cho giao diện và máy chủ
  server/                 service đọc/ghi Firestore — chỉ máy chủ import
  ui/                     thành phần React của miền đó
    machines   VPS, vé worker, khối lệnh cài, sức chứa băng thông
    assets     kho video, link Drive, preset, tải thẳng, sao chép VPS→VPS
    streams    luồng, lịch phát, khoá luồng, bật/dừng, sửa
    youtube    link xem + kiểm buổi live bằng API key
    failover   chuyển máy 2 pha, tự cứu khi máy chết, công tắc tắt khẩn
    alerts     tính cảnh báo + email (Resend)
    incidents  nhật ký sự cố
    worker-api giao thức worker + xử lý 1 nhịp hỏi/đáp
    thumbs     ảnh đang phát · dashboard  tổng quan · users  đăng nhập, vai trò · jobs  việc nền
lib/server/               hạ tầng dùng chung: firestore, env (MỌI biến môi trường), http, audit, zip
lib/client/               api(), định dạng ngày giờ
components/               khung app (AppContext, LiveApp) + UI cơ bản (Card, Pill, Modal…)
worker/                   worker Python — gói riêng, triển khai riêng
  __main__.py             điểm vào (python3 worker  hoặc  python3 rise-live-worker.pyz)
  rise_live_worker/       config · state · sync (hỏi/đáp + khớp trạng thái) · streams (ffmpeg + giám sát)
                          assets (tải/chuẩn hoá) · downloads · thumbs · http_server (:8099) · system · tools
scripts/                  run-emulator.mjs · check-dev-port.mjs · run-worker.mjs (→ run-worker.sh trên Linux) · create-user.ts
instrumentation.ts        bộ hẹn giờ nội bộ: tự cứu 30s · cảnh báo 60s · YouTube 5 phút
```

Thêm tính năng mới: tạo `features/<tên>/` (types/rules thuần → server/service → ui/), thêm route mỏng trong
`app/api/<tên>/`, thêm tab trong `components/app/LiveApp.tsx` nếu cần. Biến môi trường mới khai trong `lib/server/env.ts`.

## Phân quyền

Vai trò lưu ở `users/<email>.liveRole`: **admin** (máy, người dùng, cài đặt + mọi thứ) · **operator** (luồng, video) ·
**viewer** (chỉ xem). Bản ghi cũ có `role: "admin"` hoặc quyền `riseLive` được hiểu tương ứng admin/operator.
Tài khoản đầu tiên khi triển khai thật: `npm run create-user -- email@x.vn 'mat-khau' admin "Họ tên"`.

## Triển khai

- **Máy chủ**: `npm run build && npm start` (Cloud Run / VPS). Firestore thật: bỏ `FIRESTORE_EMULATOR_HOST`, đặt
  `GOOGLE_CLOUD_PROJECT` + Application Default Credentials. Đặt `APP_BASE_URL` = tên miền công khai (VPS gọi về đó).
  Nhiều bản sao → `RISE_LIVE_INTERNAL_CRON=0` và cho Cloud Scheduler gọi `POST /api/cron/failover` (mỗi phút),
  `/api/cron/alerts`, `/api/cron/youtube` với header `x-cron-secret: $REPORT_REMINDER_SECRET`.
- **Mỗi VPS**: Máy live → Cài worker → dán khối lệnh vào SSH (cài python3/ffmpeg/yt-dlp/gdown, tải
  `/worker/rise-live-worker.pyz`, tạo dịch vụ systemd `rise-live`). Chạy lại khối = cập nhật worker.
  Worker **không** tự cập nhật — sửa worker xong phải chạy lại khối trên từng VPS và đối chiếu cột phiên bản.

> ⚠ Đừng trỏ worker thử vào máy chủ đang chạy thật: worker sẽ nhận và đẩy luồng thật.

## So với bản cũ — đã giữ / đã bỏ

Giữ: máy (thêm/sửa/bảo trì/ngắt/xoá, mã máy + vé riêng, khối cài), kho video (Drive, tải thẳng, chép VPS→VPS,
tiến độ tải, đối chiếu file thiếu), luồng (24/7 & Pub, bật tay & hẹn giờ, danh sách phát, sửa/bật/dừng/xoá,
che khoá + xem khoá, link xem, Pub→24/7, nền đen chủ ý, cờ YouTube chặn), sức chứa băng thông 70%, chặn trùng khoá,
chuyển máy 2 pha + hoàn tác, tự cứu + lease + công tắc tắt khẩn, cảnh báo + email, nhật ký sự cố, ảnh đang phát,
toàn bộ cơ chế worker (bậc thang thử lại, lỗi nguồn dừng hẳn, ân hạn Live Pub, phát hiện treo, màn đen, tốc độ).

Chưa làm / cố ý bỏ (có thể thêm sau theo nếp `features/`):
- Nối YouTube qua **OAuth** (tạo/chuyển trạng thái buổi phát, lấy khoá tự động) — V2 dùng khoá dán tay + **API key** để theo dõi.
- Gắn luồng với **kênh** của Rise Work (`channels`), phân quyền theo đơn vị/đội và gói quyền chi tiết — thay bằng 3 vai trò.
- Tự nhân bản video dự phòng cho luồng ưu tiên, dọn bản dự phòng mồ côi, ước tính chi phí, bảng N+1 sức chứa cụm.
- Kênh realtime SSE (giao diện tự làm mới 4–15 giây), chuông/thông báo điện thoại, lưu ảnh lên GCS, các script đo `rl-*.ts`.
- Worker: bỏ "nhận lại luồng đang phát" (bản cũ cũng đã tắt); khi khởi động chỉ dọn ffmpeg của **chính** thư mục dữ liệu worker.
