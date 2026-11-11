# BrewLite — Mô tả kiến trúc tổng quan (Task 3.1)

Phiên bản 1.0 · Nhóm 19 · Kiến trúc phân lớp (layered), triển khai dạng modular monolith trong monorepo.

## 1. Bối cảnh hệ thống (C4 – mức 1)

| Thành phần | Vai trò |
| :--- | :--- |
| Khách hàng | Xem menu, đặt đơn, thanh toán, theo dõi đơn trên điện thoại/PWA. |
| Barista/Admin | Cập nhật trạng thái đơn, quản lý sản phẩm, kho, công thức, xem thống kê. |
| Cổng thanh toán | **Mô phỏng** (mock) ngay trong NestJS API; không gọi cổng thật (FR-17 là Won't). |

## 2. Container (C4 – mức 2)

| Container | Công nghệ | Cổng | Trách nhiệm | Mã nguồn |
| :--- | :--- | :-: | :--- | :--- |
| **Web (Frontend)** | Next.js 14 (App Router), React 18, Tailwind, Zustand; mobile-first, `manifest.json` | 3000 | Giao diện khách hàng và admin; giữ giỏ hàng/JWT ở phía client; gọi REST API. | `apps/web` |
| **API (Backend)** | NestJS 10, Prisma 5, class-validator, Passport-JWT | 4000 | Nghiệp vụ, xác thực/phân quyền, máy trạng thái đơn, thanh toán mô phỏng, health check. | `apps/api` |
| **Database** | PostgreSQL 16 | 5432 | Lưu user, sản phẩm, đơn, thanh toán, điểm thưởng, kho/BOM. | `apps/api/prisma` |
| **Container Registry** | GHCR (GitHub Container Registry) | — | Lưu image `brewlite-web`, `brewlite-api` gắn tag theo commit SHA/`vX.Y.Z`. | `.github/workflows/cd.yml` |
| **CI/CD** | GitHub Actions | — | Lint, test, build, đóng gói image, deploy, smoke test. | `.github/workflows` |

Mỗi container trong [deployment-diagram](deployment-diagram.svg) tương ứng một dòng ở bảng trên và một thư mục/tệp mã nguồn.

## 3. Các tầng và module (C4 – mức 3)

```
Browser/PWA ──HTTPS──► Next.js (Presentation)
                          │ REST/JSON + Bearer JWT
                          ▼
                 NestJS API
   ┌─────────────────────────────────────────────┐
   │ Controller  (route, guard, DTO validation)   │
   │ Service     (nghiệp vụ, transaction)         │
   │ PrismaService (truy cập dữ liệu)             │
   └─────────────────────────────────────────────┘
                          │ TCP 5432
                          ▼
                    PostgreSQL
```

| Module NestJS | Endpoint chính | Ghi chú |
| :--- | :--- | :--- |
| `auth` | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | bcrypt, JWT, `JwtAuthGuard`. |
| `products` | `GET /products`, `GET /products/:id`, `POST/PATCH/DELETE /products` | Ghi chỉ dành cho `ADMIN` (`RolesGuard`). |
| `promotions` | `GET /promotions`, `POST /promotions/apply` | Mã giảm theo % có trần. |
| `orders` | `POST /orders`, `GET /orders/me`, `GET /orders/:id`, `PATCH /orders/:id/status` | Máy trạng thái trong `order-state-machine.ts`. |
| `payments` | `POST /payments` | Thanh toán mô phỏng, idempotent theo `Idempotency-Key`. |
| `admin` | `GET /admin/stats`, `GET /admin/orders`, `/admin/inventory`, `/admin/ingredients`, `/admin/recipes` | Chỉ `ADMIN`. |
| `health` | `GET /health` | Kiểm tra `SELECT 1`; 200 `{status:"ok",database:"up"}` hoặc 503. |
| `prisma` | — | Module dùng chung cung cấp `PrismaService`. |

## 4. Dữ liệu và migration

- Mô hình dữ liệu: `apps/api/prisma/schema.prisma` (16 bảng); class diagram domain bám theo mô hình này.
- Migration khởi tạo: `apps/api/prisma/migrations/20261020000000_init/migration.sql`; seed: `apps/api/prisma/seed.ts` và `brewlite_database.sql`.
- Local: `docker compose up` nạp `brewlite_database.sql` vào DB rỗng và API chạy seed khi khởi động.

## 5. Cấu hình, logging và health check

| Chủ đề | Hiện trạng | Hướng cải thiện |
| :--- | :--- | :--- |
| Cấu hình | Biến môi trường: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`; mẫu ở `.env.example`. | Production nạp secret từ nền tảng/GitHub Secrets, không đặt trong repo. |
| Logging | Dùng logger mặc định của NestJS ra stdout/stderr; nền tảng thu log. | Thêm log có cấu trúc và request-id. |
| Health check | `GET /health` kiểm tra kết nối DB; dùng làm health check của nền tảng và smoke test. | — |
| Validation | `ValidationPipe` (whitelist, transform) ở backend; kiểm tra form ở frontend. | Bật `forbidNonWhitelisted`. |

## 6. Lý do chọn kiến trúc, ưu điểm, hạn chế, trade-off

| Quyết định | Ưu điểm | Hạn chế / Trade-off | ADR |
| :--- | :--- | :--- | :--- |
| Monorepo `apps/web` + `apps/api` + `docs` | Một repo, một PR cho thay đổi xuyên frontend/backend; dễ truy vết. | CI phải chạy cả hai app; repo lớn dần. | [001](adr/001-monorepo.md) |
| NestJS modular monolith | Đơn giản, deploy một container, vẫn tách module theo domain (NFR-12). | Chưa scale từng module độc lập. | [002](adr/002-nestjs-modular-monolith.md) |
| PostgreSQL + Prisma | Giao dịch ACID cho tạo đơn/thanh toán (NFR-06); schema có kiểu rõ ràng. | Prisma thêm bước generate; migration cần quy trình an toàn. | [003](adr/003-postgresql-prisma.md) |
| JWT + RBAC | Stateless, phù hợp mobile/PWA. | Khó thu hồi token trước hạn. | [004](adr/004-jwt-rbac.md) |
| Thanh toán mô phỏng + idempotency key | Kiểm thử được luồng lỗi/thử lại không cần cổng thật. | Không phản ánh độ trễ/lỗi thật của cổng. | [005](adr/005-mock-payment-idempotency.md) |
| Docker + GitHub Actions CI/CD | Môi trường tái tạo được; quality gate tự động. | Build image mất thời gian; cần quản lý secret. | [006](adr/006-docker-ci-cd.md) |
| Nền tảng production Render + GHCR | Chạy container sẵn, Postgres managed, mạng nội bộ, health check. | Gói miễn phí có cold start; phụ thuộc nhà cung cấp. | [007](adr/007-production-platform.md) |
