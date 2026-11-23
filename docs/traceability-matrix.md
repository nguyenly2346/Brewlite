# Ma trận truy vết yêu cầu (Traceability Matrix)

Quy ước mã sơ đồ: **UC-OV** = `diagrams/usecase-overview`, **UC-01-D** = `diagrams/usecase-place-and-pay`, **Activity-01** = `diagrams/activity-checkout`, **Sequence-01** = `diagrams/sequence-checkout`, **Class-01** = `diagrams/class-diagram`, **Deploy-01** = `architecture/deployment-diagram`.

Quy ước mã test:

| Mã test | Tệp | Loại | Nội dung |
| :--- | :--- | :--- | :--- |
| UT-T01 | `apps/api/test/task10-state-machine.spec.ts` | Unit | Máy trạng thái đơn: chuyển hợp lệ, chuyển sai, trạng thái kết thúc. |
| UT-T02 | `apps/api/test/task10-idempotency.spec.ts` | Unit (Prisma giả lập) | Thanh toán idempotent, điểm thưởng cộng một lần. |
| UT-T03 | `apps/api/test/task10-concurrency.spec.ts` | Unit (Prisma giả lập, chạy song song bằng `Promise.all`) | Đặt đơn đồng thời không vượt tồn kho (`Product.stock` + `version`), rollback khi một dòng hết hàng, hủy đơn hoàn kho. |
| E2E-T01 | `apps/api/test/checkout-flow.e2e.spec.ts` | E2E qua API thật | Menu → đăng nhập → tạo đơn → thanh toán → xác nhận đơn PAID. |
| E2E-T02 | `e2e/tests/checkout.spec.ts` | E2E trình duyệt (Playwright) | Menu → chọn size → giỏ → đăng nhập → thanh toán → xác nhận đơn PAID. |
| E2E-T03 | `e2e/tests/checkout.spec.ts` | E2E trình duyệt (Playwright) | Thanh toán lỗi → PAYMENT_FAILED, giữ nguyên giỏ, cho thử lại. |
| E2E-T05 | `e2e/tests/health.spec.ts` | E2E API (Playwright) | `/health` trả 200 và có header `X-Request-Id`. |
| UT-T04 | `apps/api/test/pricing-voucher-points.spec.ts` | Unit (Prisma giả lập) | Tính giá, voucher, điểm thưởng, thanh toán lỗi/thử lại, giữ chỗ tồn kho, validate DTO. |
| UT-T05 | `apps/api/test/task10-concurrency-stock.spec.ts` | Unit (Prisma giả lập) | Trừ kho nguyên liệu đồng thời không vượt tồn kho, không trừ lặp. |
| INT-T01 | `apps/api/test/task10-concurrency-postgres.integration.spec.ts` | Integration (PostgreSQL thật) | Đặt đồng thời không vượt tồn kho, rollback khi thiếu nguyên liệu. |
| E2E-T04 | `apps/api/test/api-security.e2e.spec.ts` | E2E qua API thật | Menu, khuyến mãi, tạo đơn, 401/403/400, thanh toán và idempotency. |
| UT-T10 | `apps/api/src/common/request-id.middleware.spec.ts` | Unit | Sinh/giữ `X-Request-Id`, loại id không an toàn. |
| SMK-T01 | `tests/smoke-test.sh` | Smoke | `GET /health` và `GET /products` đều trả 200. |

## 1. Yêu cầu chức năng

| Mã yêu cầu | Use-case / User Story | Thiết kế / Sơ đồ | Code / API | Test |
| :--- | :--- | :--- | :--- | :--- |
| **FR-01** | UC-02 Xem menu | UC-OV, Activity-01, Class-01 | `GET /products` · `apps/web/src/app/(user)/menu/page.tsx` | E2E-T01, SMK-T01 |
| **FR-02** | UC-02 Chi tiết sản phẩm | UC-OV, Class-01 | `GET /products/:id` · `(user)/products/[id]/page.tsx` | E2E-T02, E2E-T04 |
| **FR-03** | UC-03 Quản lý giỏ hàng | UC-OV, Activity-01 | `apps/web/src/store/useCartStore.ts` · `(user)/cart/page.tsx` | E2E-T02 |
| **FR-04** | UC-04 Đăng ký / Đăng nhập | UC-OV, Sequence-01, Class-01 (`User`) | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` · `login/page.tsx`, `register/page.tsx` | E2E-T01 (đăng nhập) |
| **FR-05** | UC-01 Đặt đơn | UC-01-D, Activity-01, Sequence-01, Class-01 (`Order`, `OrderItem`) | `POST /orders` · `(user)/checkout/page.tsx` | E2E-T01, E2E-T02, UT-T04, E2E-T04 |
| **FR-06** | UC-01, UC-08 Kiểm soát nguyên liệu | Sequence-01, Class-01 | `PATCH /orders/:id/status` (trừ kho theo BOM khi PREPARING) · `orders.service.ts` | UT-T05, INT-T01 |
| **FR-07** | UC-01 Thanh toán | UC-01-D, Activity-01, Sequence-01, Class-01 (`Payment`) | `POST /payments` · `payments.service.ts` | E2E-T01, UT-T02, E2E-T02, E2E-T03, UT-T04, E2E-T04 |
| **FR-08** | UC-01 Thanh toán idempotent | Sequence-01 | `POST /payments` + header `Idempotency-Key` | UT-T02, E2E-T04 |
| **FR-09** | UC-06 Xác nhận và lịch sử đơn | UC-OV, Activity-01 | `GET /orders/me`, `GET /orders/:id` · `(user)/orders/page.tsx`, `orders/[id]/page.tsx` | E2E-T01 (xác nhận đơn), E2E-T04 |
| **FR-10** | UC-07 Cập nhật trạng thái đơn | UC-OV, Class-01 (`OrderStatus`) | `PATCH /orders/:id/status` · `orders/order-state-machine.ts` | UT-T01, E2E-T04 |
| **FR-11** | UC-05 Áp mã khuyến mãi | UC-OV, Class-01 (`Promotion`) | `GET /promotions`, `POST /promotions/apply` · `(user)/promotions/page.tsx` | UT-T04, E2E-T04 |
| **FR-12** | UC-05 Điểm thưởng | Class-01 (`LoyaltyTransaction`) | `POST /orders` (`pointsUsed`), `POST /payments` (cộng 5%) | UT-T02, UT-T04 |
| **FR-13** | UC-07 Hủy đơn, hoàn điểm | Class-01 | `PATCH /orders/:id/status` → `CANCELLED` | UT-T01 (chuyển trạng thái), UT-T04 (hoàn điểm khi hủy) |
| **FR-14** | UC-08 Quản lý sản phẩm, xem đơn | UC-OV | `POST/PATCH/DELETE /products`, `GET /admin/orders` · `admin/products/page.tsx`, `admin/orders/page.tsx` | Chưa có test tự động, E2E-T04 (chặn 403 với CUSTOMER ở `PATCH /orders/:id/status`) |
| **FR-15** | UC-08 Kho và công thức (BOM) | UC-OV, Class-01 | `/admin/inventory`, `/admin/ingredients`, `/admin/recipes` · `admin/inventory/page.tsx` | UT-T05, INT-T01 |
| **FR-16** | UC-09 Xem thống kê | UC-OV | `GET /admin/stats` · `admin/page.tsx` | Chưa có test tự động |
| **FR-17** | — (Won't) | — | — | — |
| **FR-18** | — (Won't) | — | — | — |

## 2. Yêu cầu phi chức năng

| Mã yêu cầu | Thiết kế / Sơ đồ | Code / Cấu hình | Test / Minh chứng |
| :--- | :--- | :--- | :--- |
| **NFR-01** Hiệu năng | — | Endpoint `products`, `orders`, `payments` | Chưa đo tự động (cần bổ sung vào smoke/E2E) |
| **NFR-02** Băm mật khẩu | Class-01 (`passwordHash`) | `auth.service.ts` (bcrypt) | Kiểm tra thủ công cột `passwordHash` bắt đầu `$2` |
| **NFR-03** JWT + RBAC | Sequence-01 | `common/guards.ts`, `auth/jwt.strategy.ts` | E2E-T01 (JWT hợp lệ), E2E-T04 (401/403) |
| **NFR-04** Validate đầu vào | Sequence-01 | `ValidationPipe` ở `main.ts`, `*.dto.ts` | UT-T04 (DTO), E2E-T04 (400) |
| **NFR-05** Secret, DB không public | Deploy-01 | `.env.example`, GitHub Secrets, Render Environment | Rà soát thủ công |
| **NFR-06** Toàn vẹn dữ liệu | Sequence-01 | Prisma `$transaction` trong `orders.service.ts`, `payments.service.ts` | UT-T02, UT-T03, INT-T01 |
| **NFR-07** Mobile-first | Deploy-01 (PWA) | `apps/web` (Tailwind), `public/manifest.json` | Kiểm tra thủ công ở 360 px |
| **NFR-08** Health check | Deploy-01 | `GET /health` · `health.controller.ts` | SMK-T01 |
| **NFR-09** `docker compose up` | Deploy-01 | `docker-compose.yml`, `apps/*/Dockerfile` | Chạy thủ công theo README |
| **NFR-10** CI/CD | Deploy-01 | `.github/workflows/ci.yml`, `cd.yml` | Lịch sử GitHub Actions |
| **NFR-11** Kiểm thử | — | `npm test`, `npm run test:e2e` | UT-T01, UT-T02, E2E-T01 |
| **NFR-12** Module theo domain | Class-01 | `apps/api/src/*` | Rà soát cấu trúc thư mục |
| **NFR-13** PWA đầy đủ (Could) | Deploy-01 | Mới có `manifest.json`, chưa có service worker | — |

## 3. Điểm cần đồng bộ trước khi nộp

| # | Vấn đề | Cần làm |
| :-: | :--- | :--- |
| 1 | Tồn kho theo sản phẩm (`Product.stock`, `version`) đã có trong schema/SQL và `createOrder` trừ kho bằng optimistic locking; kho nguyên liệu vẫn trừ theo BOM khi PREPARING (FR-06/FR-15). | Đã đồng bộ với `sequence-checkout.puml`, `class-diagram.puml` và test UT-T03. |
| 2 | FR-03, FR-14 (CRUD sản phẩm), FR-16, NFR-01 chưa có test tự động. | Ghi rõ là kiểm thử thủ công (giỏ hàng ở E2E-T02; hiệu năng đo bằng tay).
| 3 | Integration test với DB thật. | Đã có INT-T01, chạy cùng bộ test trên PostgreSQL của CI. |
