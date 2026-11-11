# ADR-002: Backend NestJS theo modular monolith

- **Trạng thái:** Chấp nhận
- **Ngày:** 2026-10

## Bối cảnh
Nhóm nhỏ, thời gian hai Sprint, cần backend dễ kiểm thử và triển khai. NFR-12 yêu cầu chia module theo domain.

## Quyết định
Một ứng dụng NestJS duy nhất, chia module: `auth`, `products`, `promotions`, `orders`, `payments`, `admin`, `health`, `prisma`. Mỗi module có controller, service và DTO riêng.

## Phương án đã xét
- Microservices: bị loại vì chi phí vận hành và triển khai quá lớn cho MVP.
- Express thuần: bị loại vì thiếu cấu trúc module, guard và pipeline validation sẵn có.

## Hệ quả
- (+) Một container API, dễ deploy và debug; ranh giới module rõ ràng.
- (+) Guard, pipe và DTO validation dùng chung.
- (−) Scale theo từng module không khả thi; một lỗi nặng có thể ảnh hưởng toàn API.
