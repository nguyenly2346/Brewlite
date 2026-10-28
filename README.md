# BrewLite — Đặt cà phê không tiền mặt

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
- [ ] 1.1 `docs/requirements/context-and-scope.md` (stakeholder, in-scope, out-of-scope, giả định, ràng buộc)
- [ ] 1.2 SRS rút gọn: FR-xx, NFR-xx, MoSCoW, tiêu chí chấp nhận
- [ ] 1.2 Use-case diagram tổng quát
- [ ] 1.3 Đặc tả use-case "Đặt và thanh toán đơn hàng" (actor, trigger, pre/post-condition, luồng chính/thay thế/ngoại lệ, liên kết mã yêu cầu)

### Task 2 — Mô hình hóa hệ thống
- [ ] 2.1 Activity diagram (swimlane; hết hàng, chưa đăng nhập, thanh toán thất bại)
- [ ] 2.2 Sequence diagram `docs/diagrams/sequence-checkout.puml` + `.svg` (JWT, transaction, alt thanh toán, idempotency)
- [ ] 2.3 Class diagram (User, Product, Order, OrderItem, Payment, Promotion, LoyaltyTransaction, enum trạng thái)

### Task 3 — Thiết kế kiến trúc
- [ ] 3.1 Mô tả kiến trúc (C4 hoặc phân lớp) + trade-off
- [ ] 3.1 ADR trong `docs/architecture/adr/`
- [ ] 3.2 Deployment diagram (UML) phản ánh nền tảng thực tế

### Task 4 — Sprint 1
- [x] 4.1 Cấu trúc `apps/web`, `apps/api`
- [ ] 4.1 Thư mục `docs/`
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
