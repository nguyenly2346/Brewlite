# ADR-003: PostgreSQL và Prisma ORM

- **Trạng thái:** Chấp nhận
- **Ngày:** 2026-10

## Bối cảnh
Đơn hàng, thanh toán, điểm thưởng và kho cần tính toàn vẹn (NFR-06). Đề bài bắt buộc PostgreSQL.

## Quyết định
Dùng PostgreSQL 16 làm CSDL và Prisma 5 làm ORM. Schema ở `apps/api/prisma/schema.prisma`; migration ở `prisma/migrations`; seed ở `prisma/seed.ts` và `brewlite_database.sql`.

## Hệ quả
- (+) Transaction ACID cho tạo đơn, thanh toán, cộng/trừ điểm, trừ kho.
- (+) Kiểu dữ liệu và enum (`OrderStatus`, `PaymentStatus`, …) được sinh thành type TypeScript.
- (−) Cần bước `prisma generate` trong build và Docker.
- (−) Schema đổi phải thêm migration mới (`prisma migrate dev`); API áp dụng bằng `prisma migrate deploy` khi khởi động (xem `docs/deployment.md`).
