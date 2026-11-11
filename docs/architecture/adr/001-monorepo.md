# ADR-001: Dùng monorepo cho web, api và tài liệu

- **Trạng thái:** Chấp nhận
- **Ngày:** 2026-10

## Bối cảnh
BrewLite có frontend Next.js, backend NestJS và tài liệu yêu cầu/thiết kế. Đề bài yêu cầu cấu trúc `apps/web`, `apps/api`, `docs` và truy vết từ yêu cầu đến code và test.

## Quyết định
Dùng **một repository** với `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows`, `docker-compose.yml`.

## Hệ quả
- (+) Một pull request có thể sửa đồng thời API, UI và tài liệu; lịch sử thay đổi rõ ràng.
- (+) CI dùng chung một pipeline; truy vết yêu cầu → code → test nằm cùng nơi.
- (−) CI phải cài và build cả hai app, thời gian dài hơn.
- (−) Chưa dùng công cụ workspace (npm/pnpm workspaces); mỗi app có `package.json` riêng.
