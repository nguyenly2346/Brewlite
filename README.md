# BrewLite — Hệ Thống Đặt Cà Phê Không Tiền Mặt & Quản Trị Quầy Barista

Dự án bài tập lớn môn **Công nghệ phần mềm**  
Đơn vị thực hiện: **Nhóm 19** — Khoa Công nghệ Thông tin, Trường Đại học Sài Gòn (SGU)

---

## 1. Giới thiệu dự án

BrewLite là ứng dụng web đặt cà phê và thanh toán không tiếp xúc (Cashless & Contactless Ordering). Hệ thống giải quyết bài toán giảm thiểu thời gian xếp hàng tại quầy trong giờ cao điểm, loại bỏ việc dùng tiền mặt và số hóa quy trình vận hành quầy pha chế:

- Khách hàng tự xem thực đơn, tùy chọn cỡ ly (S/M/L), mức đường, mức đá, topping và ghi chú riêng cho Barista.
- Thanh toán điện tử qua Ví điện tử hoặc Thẻ ngân hàng với cơ chế chống trừ tiền trùng lặp (Idempotent Payment).
- Quầy Barista tiếp nhận đơn theo máy trạng thái (State Machine), tự động trừ kho nguyên liệu thô theo công thức định lượng (BOM) và theo dõi tiến độ trên màn hình KDS.
- Cổng quản trị Admin theo dõi doanh thu, phân bổ trạng thái đơn hàng, quản lý kho nguyên liệu và công thức pha chế.

---

## 2. Công nghệ sử dụng

- **Frontend (`apps/web/`)**: Next.js 14 (App Router), TypeScript, TailwindCSS, Zustand (quản lý giỏ hàng và phiên làm việc), Lucide Icons.
- **Backend (`apps/api/`)**: NestJS, TypeScript, class-validator, class-transformer, Passport JWT, Jest.
- **Cơ sở dữ liệu**: PostgreSQL 16 quản lý qua Prisma ORM (16 bảng quan hệ).
- **Môi trường & Đóng gói**: Docker, Docker Compose.
- **Thanh toán**: VNPay Sandbox (QR và thẻ test), kiểm chữ ký HMAC-SHA512; ngrok để công khai backend khi cần nhận kết quả từ VNPay hoặc quét QR bằng điện thoại.

---

## 3. Yêu cầu môi trường cài đặt

Trước khi bắt đầu, máy tính cần cài sẵn các phần mềm sau (nếu chưa có):

1. **Docker Desktop** (Bắt buộc để chạy nhanh toàn bộ hệ thống):
   - Tải về tại: https://www.docker.com/products/docker-desktop/
   - Cài đặt xong, hãy mở ứng dụng Docker Desktop lên và chờ biểu tượng ở góc thanh taskbar chuyển sang trạng thái hoạt động (màu xanh).
2. **Node.js phiên bản LTS (v20 trở lên)** (Cần thiết nếu muốn chạy code trực tiếp trên máy mà không dùng Docker):
   - Tải về tại: https://nodejs.org/
   - Cài đặt mặc định bằng cách bấm Next cho đến khi hoàn tất.
3. **Git** (Dùng để clone mã nguồn nếu lấy từ GitHub):
   - Tải về tại: https://git-scm.com/
4. **Trình duyệt web**: Google Chrome, Microsoft Edge hoặc bất kỳ trình duyệt hiện đại nào.

---

## 4. Hướng dẫn chạy từ đầu cho máy mới (Dùng Docker Desktop)

Đây là cách đơn giản và chuẩn xác nhất để chạy toàn bộ hệ thống gồm Database, Backend và Frontend chỉ với một câu lệnh.

### Bước 1: Mở thư mục dự án trong Terminal

1. Giải nén mã nguồn hoặc clone repository về máy tính của bạn.
2. Mở cửa sổ dòng lệnh tại thư mục gốc `brewlite` (nơi chứa file `docker-compose.yml`):
   - **Trên Windows**: Mở thư mục `brewlite`, nhấp chuột vào thanh địa chỉ thư mục ở trên cùng, gõ `cmd` hoặc `powershell` rồi nhấn `Enter`.
   - **Trên macOS / Linux**: Mở ứng dụng Terminal và chuyển vào thư mục dự án bằng lệnh:
     ```bash
     cd /duong-dan-toi-thu-muc/brewlite
     ```

### Bước 2: Dọn dẹp phiên bản cũ (Nếu đã từng chạy trước đó)

Nếu trên máy của bạn đã từng chạy container cũ, hãy chạy lệnh sau để xóa sạch dữ liệu cũ và tránh xung đột cổng:

```bash
docker compose down -v
```

### Bước 3: Khởi động toàn bộ hệ thống

Chạy lệnh sau để Docker tự động tải image PostgreSQL, build Backend, build Frontend và nạp dữ liệu mẫu:

```bash
docker compose up --build -d
```

Quá trình này mất khoảng 2 đến 4 phút trong lần đầu tiên tùy thuộc vào tốc độ mạng của bạn. Khi terminal hiển thị trạng thái `Started` cho cả 3 container (`brewlite-db`, `brewlite-backend`, `brewlite-frontend`), hệ thống đã sẵn sàng.

### Bước 4: Truy cập các cổng dịch vụ

Mở trình duyệt web và truy cập các địa chỉ tương ứng:

| Dịch vụ | Địa chỉ truy cập | Mục đích |
| :--- | :--- | :--- |
| **Giao diện Chính** | `http://localhost:3000` | Xem menu, chọn size, topping, đường đá, đặt món và thanh toán |
| **Backend API Health** | `http://localhost:4000/health` | Kiểm tra trạng thái máy chủ NestJS và kết nối Database |
| **Prisma Studio (Xem DB)** | `http://localhost:5555` | Xem và chỉnh sửa trực tiếp các bảng dữ liệu qua giao diện web |

---

## 4b. Thanh toán VNPay Sandbox (tùy chọn)

Mặc định hệ thống dùng thanh toán giả lập (`PAYMENT_PROVIDER=mock`), không cần cấu hình gì thêm. Phần này hướng dẫn bật thanh toán qua **VNPay Sandbox**: ở trang checkout có nút "Thanh toán qua VNPay", cửa sổ mã QR đếm ngược 10 phút, trang tự hỏi lại trạng thái đơn mỗi 3 giây và tự chuyển sang thành công khi thanh toán xong.

### Bước 1: Lấy khóa VNPay Sandbox

Đăng ký merchant môi trường test tại `https://pay.vnpaytest.vn/dev-registration`. VNPay gửi email gồm **Terminal Code** (`vnp_TmnCode`), **Secret Key** (`vnp_HashSecret`), **URL thanh toán test** (`vnp_Url`) và thẻ test. Ô IPN URL trong form đăng ký là bắt buộc, có thể điền tạm một địa chỉ https bất kỳ (xem mục "IPN" bên dưới).

### Bước 2: Tạo file `.env` ở thư mục gốc

Tạo file tên đúng là `.env` (cạnh `docker-compose.yml`). File này không được đưa lên GitHub.

```env
PAYMENT_PROVIDER=vnpay
VNPAY_TMN_CODE=merchant_sandbox_cua_ban
VNPAY_HASH_SECRET=hash_secret_sandbox_cua_ban
VNPAY_PAY_URL=https://sandbox.vnpaytest.vn/paymentv2/vpcpay.html
API_PUBLIC_URL=http://localhost:4000
```

Không dùng dấu nháy và không để khoảng trắng quanh dấu `=`. Đặt `PAYMENT_PROVIDER=vnpay` mà thiếu khóa thì backend không khởi động. Khi bật `vnpay`, endpoint thanh toán giả lập bị đóng.

### Bước 3: Chạy hệ thống

```bash
docker compose up --build -d
```

Kiểm tra backend đã ở chế độ VNPay: mở `http://localhost:4000/payments/config`, kết quả phải có `"provider":"vnpay"`. Migration `add_vnpay_payment` tự chạy khi backend khởi động.

### Bước 4: Thanh toán thử

1. Vào `http://localhost:3000`, đăng nhập tài khoản khách hàng, thêm món vào giỏ và sang trang checkout.
2. Bấm "Thanh toán qua VNPay", sau đó bấm "Mở trang thanh toán VNPay" để thanh toán ngay trên máy tính.
3. Chọn "Thẻ nội địa và tài khoản ngân hàng", chọn ngân hàng NCB và nhập thẻ test (theo email của VNPay, thông tin có thể được VNPay thay đổi):

| Thông tin | Giá trị |
| :--- | :--- |
| Ngân hàng | NCB |
| Số thẻ | `9704198526191432198` |
| Tên chủ thẻ | `NGUYEN VAN A` |
| Ngày phát hành | `07/15` |
| Mật khẩu OTP | `123456` |

4. Thanh toán xong, VNPay chuyển về `/payments/vnpay/return`, backend kiểm chữ ký rồi chuyển khách về trang đơn hàng. Trạng thái đơn chuyển sang đã thanh toán và điểm thưởng được cộng.

Nếu thanh toán thất bại hoặc khách hủy trên VNPay, đơn chuyển sang `PAYMENT_FAILED` và vẫn có thể thanh toán lại hoặc hủy. Khi mã QR hết hạn, đơn vẫn được giữ và có nút tạo QR mới.

### Quét QR bằng điện thoại (cần ngrok)

Điện thoại không truy cập được `localhost` của máy tính, nên sau khi trả tiền sẽ không quay về được backend. Muốn quét QR bằng điện thoại, cần công khai backend bằng ngrok:

1. Tạo tài khoản ngrok miễn phí. Lấy **Authtoken** tại `https://dashboard.ngrok.com/get-started/your-authtoken` và tạo domain miễn phí ở mục **Domains** (dạng `ten-gi-do.ngrok-free.dev`).
2. Thêm vào `.env` và sửa `API_PUBLIC_URL` thành địa chỉ ngrok (mỗi biến chỉ xuất hiện một lần):

```env
NGROK_AUTHTOKEN=<authtoken của bạn>
NGROK_DOMAIN=ten-gi-do.ngrok-free.dev
API_PUBLIC_URL=https://ten-gi-do.ngrok-free.dev
COMPOSE_PROFILES=tunnel
```

3. Chạy `docker compose up --build -d`. Service `ngrok` trong `docker-compose.yml` chỉ chạy khi có `COMPOSE_PROFILES=tunnel`, nên người không dùng ngrok vẫn chạy compose bình thường.
4. Kiểm tra tunnel: mở `https://ten-gi-do.ngrok-free.dev/payments/config` (lần đầu bấm **Visit Site**), kết quả phải có `"provider":"vnpay"`.
5. Tạo **QR mới** ở trang checkout (QR cũ vẫn chứa địa chỉ cũ), quét bằng điện thoại và thanh toán bằng thẻ test. Trang checkout trên máy tính tự chuyển sang thành công.

Backend vẫn chạy ở `http://localhost:4000` nên Postman và giao diện web gọi API như bình thường. `API_PUBLIC_URL` chỉ là địa chỉ backend cung cấp cho VNPay để chuyển khách về và gọi IPN. Cần giữ Docker chạy trong suốt quá trình kiểm thử, tắt máy thì tunnel dừng.

### IPN (server gọi server)

Backend có hai đường: `/payments/vnpay/return` (chuyển khách về website, HTTP 303) và `/payments/vnpay/ipn`. Cả hai dùng chung một hàm kiểm chữ ký và chỉ ghi nhận đúng một lần, nên IPN gửi lại không tích điểm hai lần. Nếu IPN URL đăng ký với VNPay không trỏ vào backend, kết quả vẫn được ghi nhận khi khách quay về qua Return; nếu khách đóng trình duyệt giữa chừng thì đơn chưa được cập nhật. Muốn VNPay gọi IPN thật, đặt IPN URL trong trang quản trị merchant sandbox thành `https://<domain ngrok>/payments/vnpay/ipn`.

### Giới hạn hiện tại

- Chưa hoàn tiền thật qua VNPay (hủy đơn đã thanh toán vẫn là thông báo mô phỏng).
- Chưa tự hủy đơn `PENDING` quá hạn giữ món.
- Chưa truy vấn lại giao dịch khi lỡ IPN.
- Nếu tiền đã về nhưng đơn đã hủy, đơn không bị khôi phục; giao dịch được ghi `SUCCESS` kèm ghi chú để hoàn tiền thủ công.

Chi tiết kỹ thuật xem thêm tại [`docs/vnpay-sandbox.md`](docs/vnpay-sandbox.md).

---

## 5. Tài khoản mẫu và dữ liệu thử nghiệm

Hệ thống đã nạp sẵn tài khoản và dữ liệu trong Database để phục vụ chấm bài và kiểm thử:

### Tài khoản đăng nhập
- **Khách hàng**: `khachhang@brewlite.vn` / Mật khẩu: `BrewLite@123` (Có sẵn 15.000 điểm thưởng thành viên).
- **Quản trị viên (Admin)**: `admin@brewlite.vn` / Mật khẩu: `BrewLite@123` (Toàn quyền quản trị quầy và kho).
- **Barista (Admin)**: `barista@brewlite.vn` / Mật khẩu: `BrewLite@123`.

*(Tài khoản Quản trị chỉ vào giao diện `/admin`, không đặt hàng; muốn thử mua hàng hãy dùng tài khoản khách hàng hoặc tạo thêm ở trang Quản lý tài khoản. Trang đăng nhập `/login` không còn nút điền nhanh, hãy tự nhập email và mật khẩu ở trên vào form).*

> Biến `JWT_SECRET` là bắt buộc khi chạy production (đã đặt sẵn trong `docker-compose.yml` cho local). Chạy thủ công không đặt biến này thì hệ thống dùng secret ngẫu nhiên cho mỗi lần chạy.

### Mã khuyến mãi thử nghiệm
- `BREWLITE10`: Giảm 10%, tối đa 20.000đ cho đơn hàng từ 40.000đ.
- `CHAOBANMOI`: Giảm 20%, tối đa 30.000đ cho đơn hàng từ 80.000đ.

---

## 6. Hướng dẫn xem và quản lý Cơ sở dữ liệu

Nếu bạn muốn mở giao diện trực quan dạng bảng để xem hoặc sửa dữ liệu trong PostgreSQL tương tự phpMyAdmin:

1. Mở một cửa sổ dòng lệnh tại thư mục `backend`:
   ```bash
   cd apps/api
   npx prisma@5 studio
   ```
2. Trình duyệt sẽ tự động mở trang `http://localhost:5555`.
3. Bạn có thể chọn từng bảng (`User`, `Product`, `Ingredient`, `Recipe`, `Order`, `Payment`...) để xem chi tiết, sửa trực tiếp trên ô và nhấn `Save changes`.

---

## 7. Hướng dẫn chạy thủ công từng phần (Không qua Docker)

Nếu máy tính của bạn gặp sự cố với Docker hoặc bạn muốn chỉnh sửa code và xem cập nhật ngay lập tức:

### Bước 1: Khởi động riêng Database
Giữ lại container Database chạy nền:
```bash
docker compose up -d db
```

### Bước 2: Chạy Backend (`apps/api/`)
Mở cửa sổ dòng lệnh thứ nhất:
```bash
cd apps/api
npm install
npx prisma migrate deploy
npm run start:dev
```
Backend sẽ khởi động trên cổng `http://localhost:4000`.

### Bước 3: Chạy Frontend (`apps/web/`)
Mở cửa sổ dòng lệnh thứ hai:
```bash
cd apps/web
npm install
npm run dev
```
Frontend sẽ khởi động trên cổng `http://localhost:3000`.

---

## 8. Chạy kiểm thử tự động Backend (Jest - Task 10)

Hệ thống đã viết đầy đủ 3 bộ kiểm thử chứng minh đúng yêu cầu Task 10 của đề bài:
1. `task10-state-machine.spec.ts`: Kiểm tra các nhánh chuyển trạng thái hợp lệ và chặn chuyển sai.
2. `task10-idempotency.spec.ts`: Kiểm tra thanh toán lặp với cùng một Idempotency-Key không bị trừ tiền hay cộng điểm 2 lần.
3. `task10-concurrency.spec.ts`: Kiểm tra nhiều khách đặt đồng thời (`Promise.all`) không bán vượt tồn kho `Product.stock` (optimistic locking bằng `version` + retry), đơn nhiều dòng được rollback, hủy đơn hoàn lại tồn kho.

Để chạy kiểm thử, mở terminal tại thư mục `backend` và gõ:

```bash
cd apps/api
npx prisma migrate deploy   # áp dụng migration (gồm cột Product.stock)
npm test            # tự chạy prisma generate trước (script pretest)
```

---

## 8b. Kiểm thử E2E trình duyệt (Playwright)

Bộ test nằm trong thư mục `e2e/` (độc lập với `apps/`), chạy trên viewport điện thoại.

```bash
docker compose up -d --build   # dựng db + backend + frontend
npm run e2e:install                   # lần đầu: cài dependency và trình duyệt Chromium
npm run e2e:web                       # chạy test; báo cáo ở e2e/playwright-report
```

Chạy với môi trường khác: `E2E_BASE_URL=https://<web> E2E_API_URL=https://<api> npm run e2e:web`.
Trên GitHub, workflow `.github/workflows/e2e.yml` chạy bộ test này cho mỗi pull request và lưu báo cáo thành artifact.

### Request id và log

Mọi response của API có header `X-Request-Id` (giữ nguyên giá trị client gửi nếu hợp lệ, nếu không thì tự sinh UUID).
Log dạng `[requestId] METHOD /path status duration`. Khi báo lỗi, gửi kèm request id để truy log.

### Quy ước commit

Dùng Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`). Sau `npm install` ở thư mục gốc,
hook husky + commitlint tự kiểm tra commit message.

---

## 9. Xử lý sự cố thường gặp

- **Lỗi cổng 5432 hoặc 3000 bị chiếm dụng**:  
  Nếu máy bạn đang chạy PostgreSQL hoặc ứng dụng khác ở cổng 5432, hãy tắt dịch vụ đó hoặc đổi cổng ánh xạ trong `docker-compose.yml`.
- **Lỗi không kết nối được Docker daemon**:  
  Đảm bảo ứng dụng Docker Desktop đã được bật trước khi gõ lệnh `docker compose`.
- **Lỗi build do bộ nhớ cache cũ**:  
  Chạy lệnh `docker compose build --no-cache` để buộc Docker tải và biên dịch lại toàn bộ từ đầu.
- **Dừng toàn bộ hệ thống khi dùng xong**:  
  ```bash
  docker compose down
  ```
  Lệnh `docker compose down -v` xóa cả volume dữ liệu PostgreSQL, chỉ dùng khi muốn xóa sạch dữ liệu.
- **Trang checkout không hiện nút hoặc mã QR VNPay**:  
  Backend đang ở chế độ mock. Mở `http://localhost:4000/payments/config`, nếu kết quả là `"provider":"mock"` thì kiểm tra file `.env` ở thư mục gốc (không phải `.env.example`), chạy `docker compose up -d --force-recreate backend` rồi nhấn Ctrl+F5 trên trình duyệt.
- **Trang VNPay báo "The terminal (website) not found"**:  
  `VNPAY_TMN_CODE` hoặc `VNPAY_PAY_URL` sai. Kiểm tra bằng `docker compose exec backend printenv VNPAY_TMN_CODE` và `docker compose exec backend printenv VNPAY_PAY_URL`. Sau khi sửa `.env`, chạy lại backend và tạo **QR mới** vì QR cũ đã chứa link cũ.
- **Quét QR bằng điện thoại xong báo không truy cập được trang web**:  
  `API_PUBLIC_URL` đang là `localhost`. Dùng ngrok theo hướng dẫn ở mục 4b, hoặc bấm "Mở trang thanh toán VNPay" để thanh toán ngay trên máy tính.
- **Ngrok báo `ERR_NGROK_105`**:  
  `NGROK_AUTHTOKEN` sai hoặc thừa ký tự. Copy lại token bằng nút Copy trên dashboard ngrok, dán vào `.env` (không dấu nháy, không khoảng trắng) rồi chạy `docker compose up -d --force-recreate ngrok`.
- **Lệnh `docker compose logs ngrok` không in gì**:  
  Bình thường nếu container ở trạng thái `Up`. Kiểm tra tunnel bằng cách mở `https://<domain ngrok>/payments/config`. Muốn xem log, thêm `--log=stdout` vào dòng `command` của service `ngrok`.

---

## 10. Build, triển khai và rollback

Build thủ công:

```bash
npm --prefix apps/api run build     # NestJS -> apps/api/dist
npm --prefix apps/web run build     # Next.js -> apps/web/.next
```

CI (`.github/workflows/ci.yml`) chạy khi mở pull request: cài dependency, lint, unit/integration test, build. Pipeline CD (`.github/workflows/cd.yml`) chạy khi push lên `main` hoặc tag `vX.Y.Z`:

```
Quality gate → Build image (tag = commit SHA) → Push GHCR → Migrate + Deploy + Smoke test (container thật) → Deploy production → Smoke test production
```

Secret nằm trong GitHub Secrets (`RENDER_DEPLOY_HOOK_URL`, `PROD_API_URL`) và Environment của nền tảng (`DATABASE_URL`, `JWT_SECRET`), không nằm trong repository hay log CI. Migration chạy bằng `prisma migrate deploy` (xem `apps/api/docker-entrypoint.sh`).

Khi triển khai thất bại (smoke test đỏ), pipeline dừng. Rollback: trên nền tảng chọn lại bản deploy ổn định gần nhất, hoặc `git revert <commit>` trên `main` để pipeline deploy lại, hoặc deploy lại image tag cũ (`vX.Y.Z` trước đó). Lỗi do migration thì khôi phục snapshot database trước khi deploy lại. Chi tiết từng tình huống ở [`docs/deployment.md`](docs/deployment.md).

Bản triển khai production dùng `docker-compose.cd.yml` và mặc định vẫn là thanh toán giả lập (`mock`) cho đến khi truyền các biến VNPay vào môi trường triển khai.
