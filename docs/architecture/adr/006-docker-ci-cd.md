# ADR-006: Docker hóa và CI/CD bằng GitHub Actions

- **Trạng thái:** Chấp nhận
- **Ngày:** 2026-10

## Bối cảnh
NFR-09 yêu cầu chạy toàn hệ thống bằng một lệnh; NFR-10 yêu cầu CI/CD tự động có rollback.

## Quyết định
- Mỗi app có `Dockerfile` (Node 20 Alpine); `docker-compose.yml` chạy `db`, `backend`, `frontend` ở local.
- `ci.yml` chạy khi mở PR/push: cài đặt, tạo Prisma client, test, build backend và frontend.
- `cd.yml` chạy khi push `main` hoặc tag `v*.*.*`: build image, gắn tag, đẩy registry, deploy, smoke test (`tests/smoke-test.sh`).

## Hệ quả
- (+) Môi trường tái tạo được; lỗi chặn pipeline.
- (−) Cần bật branch protection để PR không merge khi CI đỏ.
- (−) Cần quản lý secret trong GitHub Secrets và giữ chúng ngoài log.
