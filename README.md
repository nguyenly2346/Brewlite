<<<<<<< HEAD
# ☕ BrewLite — Đặt cà phê không tiền mặt

Bài tập lớn môn **Công nghệ Phần mềm** — **Nhóm 19**, Khoa CNTT, Đại học Sài Gòn (SGU).

Luồng nghiệp vụ: `Xem menu → Chọn size/topping → Giỏ hàng → Đặt đơn → Thanh toán (Ví/Thẻ mô phỏng) → Theo dõi đơn`

## Công nghệ

| Thành phần | Công nghệ |
| :--- | :--- |
| Frontend (`apps/web`) | Next.js 14 (App Router), TypeScript, TailwindCSS, Zustand |
| Backend (`apps/api`) | NestJS, Passport JWT, class-validator, Jest |
| Database | PostgreSQL 16 + Prisma ORM |
| DevOps | Docker Compose, GitHub Actions |

## Chạy nhanh bằng Docker

Yêu cầu: Docker Desktop đang chạy.

```bash
docker compose down -v          # dọn bản cũ (nếu có)
docker compose up --build -d    # build + chạy db, backend, frontend
```

| Dịch vụ | URL |
| :--- | :--- |
| Web | http://localhost:3000 |
| API health | http://localhost:4000/health |

Tài khoản mẫu (mật khẩu `BrewLite@123`): `khachhang@brewlite.vn` (15.000 điểm), `admin@brewlite.vn`, `barista@brewlite.vn`
Mã khuyến mãi: `BREWLITE10` (-10%, tối đa 20k, đơn ≥ 40k), `CHAOBANMOI` (-20%, tối đa 30k, đơn ≥ 80k)

## Chạy thủ công (không Docker cho app)

```bash
docker compose up -d db
cd apps/api && npm install && npx prisma db push && npm run seed && npm run start:dev   # :4000
cd apps/web && npm install && npm run dev                                                # :3000
```

Xem DB: `cd apps/api && npx prisma@5 studio` → http://localhost:5555

## Kiểm thử

```bash
cd apps/api
npm test            # unit test (state machine, idempotency, tồn kho đồng thời)
npm run test:e2e    # E2E, cần API đang chạy ở :4000 (hoặc NEXT_PUBLIC_API_URL)
bash tests/smoke-test.sh http://localhost:4000   # từ thư mục gốc
```

## API chính

| Endpoint | Chức năng |
| :--- | :--- |
| `GET /products`, `GET /products/:id` | Menu / chi tiết |
| `POST /auth/register`, `POST /auth/login` | Đăng ký / đăng nhập (JWT) |
| `POST /orders`, `GET /orders/me`, `GET /orders/:id` | Tạo đơn (PENDING) / lịch sử / chi tiết |
| `PATCH /orders/:id/status` | Cập nhật trạng thái (Admin) |
| `POST /payments` | Thanh toán, idempotent qua header `Idempotency-Key` |
| `POST /promotions/apply` | Áp mã khuyến mãi |
| `GET /admin/stats`, `/admin/orders`, `/admin/inventory` | Quản trị |
| `GET /health` | Health check (kèm kiểm tra DB) |

---

# ✅ Checklist yêu cầu

> `[x]` = đã có trong repo · `[ ]` = chưa có / chưa thể chứng minh từ repo.

## Assignment 2 — Requirements to Deployment

### Task 1 — Khai thác và đặc tả yêu cầu
- [x] 1.1 [`docs/requirements/context-and-scope.md`](docs/requirements/context-and-scope.md) (stakeholder, in-scope, out-of-scope, giả định, ràng buộc, rủi ro)
- [x] 1.2 SRS rút gọn: [`docs/requirements/srs.md`](docs/requirements/srs.md) (FR-xx, NFR-xx, MoSCoW, tiêu chí chấp nhận)
- [x] 1.2 Use-case diagram tổng quát: [`usecase-overview`](docs/diagrams/usecase-overview.svg)
- [x] 1.3 Đặc tả use-case "Đặt và thanh toán đơn hàng": [`use-case-place-and-pay-order.md`](docs/requirements/use-case-place-and-pay-order.md) + [diagram](docs/diagrams/usecase-place-and-pay.svg)

### Task 2 — Mô hình hóa hệ thống
- [x] 2.1 Activity diagram (swimlane; hết hàng, chưa đăng nhập, thanh toán thất bại): [`activity-checkout`](docs/diagrams/activity-checkout.svg)
- [x] 2.2 Sequence diagram [`sequence-checkout.puml`](docs/diagrams/sequence-checkout.puml) + [`.svg`](docs/diagrams/sequence-checkout.svg) (JWT, transaction, alt thanh toán, idempotency)
- [x] 2.3 Class diagram (User, Product, Order, OrderItem, Payment, Promotion, LoyaltyTransaction, enum trạng thái): [`class-diagram`](docs/diagrams/class-diagram.svg)

### Task 3 — Thiết kế kiến trúc
- [ ] 3.1 Mô tả kiến trúc (C4 hoặc phân lớp) + trade-off
- [ ] 3.1 ADR trong `docs/architecture/adr/`
- [ ] 3.2 Deployment diagram (UML) phản ánh nền tảng thực tế

### Task 4 — Sprint 1
- [x] 4.1 Cấu trúc `apps/web`, `apps/api`
- [x] 4.1 Thư mục `docs/`
- [x] 4.1 `README.md`, `.gitignore`, `.env.example`
- [ ] 4.1 Chiến lược branch & pull request (tài liệu hóa)
- [ ] 4.1 Issue board / Product Backlog Sprint 1 & 2
- [ ] 4.1 Quy ước commit + Definition of Done (tài liệu hóa)
- [ ] 4.2 Toàn bộ tạo phẩm Task 1–3 nằm trong `docs/`, thay đổi qua commit/PR
- [x] 4.3 `GET /products`, `GET /products/:id`
- [x] 4.3 Màn hình menu mobile-first (Next.js)
- [x] 4.3 Trạng thái loading / empty / error
- [x] 4.3 Dữ liệu mẫu / database seed
- [x] 4.3 Kiểm thử API (logic nghiệp vụ, Jest)
- [ ] 4.3 Kiểm thử component/luồng chính phía frontend
- [x] 4.4 CI tự động khi mở PR: Install → Unit Test → Build
- [ ] 4.4 CI có bước **Lint** (web có script `lint` nhưng chưa cài ESLint, CI chưa gọi)
- [ ] 4.4 Branch protection: chặn merge khi lint/test/build lỗi
- [ ] 4.4 Minh chứng: link PR, log pipeline thành công và pipeline lỗi

### Task 5 — Sprint 2, CI/CD và Delivery

**5.1 Hoàn thiện MVP**
- [x] Chi tiết sản phẩm, size, topping
- [x] Giỏ hàng (thêm/sửa/xóa, tính tổng, lưu bằng Zustand persist)
- [x] Đăng ký, đăng nhập, JWT (bcrypt, guard bảo vệ route)
- [x] Tạo đơn hàng `POST /orders` (PENDING)
- [x] Thanh toán Ví/Thẻ mô phỏng `POST /payments`
- [x] Xác nhận đơn, trạng thái, lịch sử đơn
- [x] Validate & xử lý lỗi ở cả frontend và backend

**5.2 Tích hợp và kiểm thử**
- [x] Unit test nghiệp vụ quan trọng (state machine, idempotency, tồn kho đồng thời)
- [ ] Integration test API tạo đơn/thanh toán (chạy với DB thật; hiện test task10 dùng mock)
- [x] Ít nhất 1 E2E: menu → đăng nhập → tạo đơn → thanh toán → PAID (`checkout-flow.e2e.spec.ts`)
- [ ] E2E chạy tự động trong CI (hiện CI bỏ qua file này)
- [ ] Migration có thể tái tạo DB (hiện có `migrations/…_init` nhưng Docker/CI dùng `prisma db push`, không dùng `migrate deploy`)
- [x] Seed có thể tái tạo DB
- [x] `docker-compose.yml` chạy web + API + database
- [x] Health endpoint `GET /health`

**5.3 CI/CD**
- [x] Quality gate: test + build
- [ ] Quality gate: lint
- [x] Build Docker image
- [ ] Tag image bằng commit SHA / semantic version
- [ ] Push image lên container registry
- [ ] Deploy production bằng secret của CI (`cd.yml` hiện chỉ build, chưa deploy)
- [ ] Chạy migration an toàn khi deploy
- [ ] Smoke test sau deploy trong pipeline (có `tests/smoke-test.sh` nhưng CD chưa gọi)
- [ ] Dừng pipeline + cách rollback khi deploy lỗi

**5.4 Triển khai và bàn giao**
- [ ] URL frontend production (HTTPS)
- [ ] URL API + health check production
- [ ] Database production không public (compose hiện mở cổng `5432`)
- [ ] Secret không nằm trong repo/log CI (hiện `JWT_SECRET` và mật khẩu DB được hard-code trong `docker-compose.yml`, `ci.yml`, `.env.example`)
- [ ] Release/tag phiên bản + release notes
- [ ] README có hướng dẫn **deploy** và **rollback** (đã có local + test + build)
- [ ] Video/demo luồng end-to-end
- [ ] Sprint Review & Sprint Retrospective

### Truy vết & checklist nộp bài
- [ ] `docs/traceability-matrix.md`
- [ ] `docs/deployment.md`
- [ ] Link repo + quyền truy cập cho giảng viên
- [ ] SRS, đặc tả use-case, ma trận truy vết
- [ ] Đủ 4 sơ đồ: activity, sequence, class, deployment
- [x] Source code frontend, backend
- [ ] Migration chuẩn
- [ ] Unit + integration + E2E test đầy đủ
- [ ] Pipeline CI/CD chạy thành công
- [ ] URL production, API, health check
- [ ] Release notes, README, hướng dẫn rollback
- [ ] Video/demo + Sprint Retrospective

## Đề gốc — 10 task Scrum

| # | Task | Trạng thái |
| :-: | :--- | :-: |
| 1 | Khởi tạo dự án và cấu trúc (monorepo, README, Git, `.env.example`) | [x] |
| 2 | API danh sách sản phẩm `GET /products` | [x] |
| 3 | Trang Menu (loading/empty state) | [x] |
| 4 | Chi tiết sản phẩm, chọn size/topping, tính giá | [x] |
| 5 | Giỏ hàng (thêm/sửa/xóa, tổng tiền, badge) | [x] |
| 6 | API tạo đơn `POST /orders` (validate, PENDING) | [x] |
| 7 | Đăng ký/Đăng nhập JWT (bcrypt, guard) | [x] |
| 8 | Thanh toán không tiền mặt `POST /payments` (PAID / PAYMENT_FAILED) | [x] |
| 9 | Xác nhận, lịch sử `GET /orders/me`, docker-compose, README | [x] |
| 9 | Demo end-to-end (video) | [ ] |
| 10 | Nghiệp vụ backend (4 mục bên dưới) | [x] |

**Task 10 — Nghiệp vụ backend**
- [x] Order State Machine: PENDING → PAID → PREPARING → READY → COMPLETED, chặn chuyển sai (`order-state-machine.ts`)
- [x] Thanh toán idempotent bằng `Idempotency-Key`
- [x] Chống bán quá tồn kho: transaction + optimistic locking (`version`), retry
- [x] Khuyến mãi + điểm thưởng: áp mã, cộng 5% điểm khi PAID, ghi `LoyaltyTransaction`
- [x] Test (a): chặn chuyển trạng thái sai — `task10-state-machine.spec.ts`
- [x] Test (b): gửi 2 lần cùng Idempotency-Key chỉ tạo 1 giao dịch — `task10-idempotency.spec.ts`
- [x] Test (c): 5 request đồng thời, tồn kho 2 → chỉ 2 thành công — `task10-concurrency-stock.spec.ts`

**Yêu cầu phi chức năng (đề gốc)**
- [x] Mật khẩu băm (bcrypt), JWT, validate đầu vào
- [x] Chạy trên trình duyệt web hiện đại, có `manifest.json` (PWA cơ bản)
- [ ] Đo và chứng minh API phản hồi < 500ms
- [ ] PWA đầy đủ (service worker / offline)

**Definition of Done (đề gốc)**
- [x] Code chạy được, build không lỗi
- [ ] Commit rõ ràng + review trong nhóm (cần minh chứng PR)
- [x] API có validate; UI có loading/lỗi cơ bản
- [x] README có hướng dẫn chạy

## Tính năng mở rộng ngoài đề
- [x] Tùy chọn đường, đá, ghi chú cho Barista
- [x] Trang quản trị Admin: doanh thu, đơn hàng, kho nguyên liệu
- [x] Công thức pha chế (BOM) tự trừ kho khi chuyển sang PREPARING
- [x] Dùng điểm thưởng để giảm giá khi đặt đơn
- [x] Health check kiểm tra kết nối DB

## Xử lý sự cố

- **Cổng 5432/3000/4000 bị chiếm**: tắt dịch vụ đang dùng hoặc đổi cổng trong `docker-compose.yml`.
- **Không kết nối được Docker**: mở Docker Desktop trước khi chạy `docker compose`.
- **Build lỗi cache**: `docker compose build --no-cache`.
- **Dừng hệ thống**: `docker compose down` (thêm `-v` để xóa dữ liệu).
=======
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

## 5. Tài khoản mẫu và dữ liệu thử nghiệm

Hệ thống đã nạp sẵn tài khoản và dữ liệu trong Database để phục vụ chấm bài và kiểm thử:

### Tài khoản đăng nhập
- **Khách hàng**: `khachhang@brewlite.vn` / Mật khẩu: `BrewLite@123` (Có sẵn 15.000 điểm thưởng thành viên).
- **Quản trị viên (Admin)**: `admin@brewlite.vn` / Mật khẩu: `BrewLite@123` (Toàn quyền quản trị quầy và kho).
- **Barista (Admin)**: `barista@brewlite.vn` / Mật khẩu: `BrewLite@123`.

*(Tại trang đăng nhập `/login`, bạn có thể bấm trực tiếp vào nút "Điền nhanh Khách hàng" hoặc "Điền nhanh Admin" để hệ thống tự điền thông tin).*

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
npx prisma db push
npm run seed
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
3. `task10-concurrency-stock.spec.ts`: Kiểm tra 5 yêu cầu mua đồng thời khi tồn kho chỉ còn 2 ly (chứng minh khóa lạc quan chặn đúng 3 yêu cầu và giữ tồn kho không âm).

Để chạy kiểm thử, mở terminal tại thư mục `backend` và gõ:

```bash
cd apps/api
npm test
```

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
>>>>>>> origin/ltk
