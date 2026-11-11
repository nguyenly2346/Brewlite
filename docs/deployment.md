# Hướng dẫn triển khai, CI/CD và Rollback

Nền tảng production đề xuất: **Render** (web, API, PostgreSQL) và **GHCR** (registry). Xem [ADR-007](architecture/adr/007-production-platform.md) và [deployment diagram](architecture/deployment-diagram.svg). Nếu nhóm dùng nền tảng khác, thay các mục "Render" bên dưới tương ứng.

## 1. Chạy local

```bash
cp .env.example .env
docker compose up --build
```

| Dịch vụ | URL |
| :--- | :--- |
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| Health | http://localhost:4000/health |
| PostgreSQL | localhost:5432 (user `brewlite`, db `brewlite_db`) |

Chạy test: `npm --prefix apps/api test` (unit) và `npm --prefix apps/api run test:e2e` (cần API và DB đang chạy).

## 2. Biến môi trường production

| Biến | Dịch vụ | Nguồn | Ghi chú |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | API | Render: Internal Database URL | Không dùng External URL. |
| `JWT_SECRET` | API | Render Environment (secret) | Chuỗi ngẫu nhiên dài, khác giá trị mẫu. |
| `PORT` | API | Render | `4000`. |
| `FRONTEND_URL` | API | Render | URL HTTPS của web. |
| `NEXT_PUBLIC_API_URL` | Web | Build arg / Environment | URL HTTPS của API; được nhúng lúc build. |

GitHub Secrets cần có: `PROD_API_URL`, token đẩy registry, deploy hook của hai service Render (tên cụ thể tùy cấu hình). Không đưa secret vào repository hay log CI.

## 3. Pipeline CI (`.github/workflows/ci.yml`)

Chạy khi mở pull request và khi push: Checkout → Node 20 → cài dependency → `prisma generate` + `prisma db push` trên Postgres service → unit test → build API → build web.

Thiết lập branch protection cho `main`: bắt buộc job CI xanh trước khi merge.

## 4. Pipeline CD đích (Task 5.3)

```
Push main / Tag vX.Y.Z → Lint + Test → Build Docker image → Push GHCR → Deploy → Smoke test
```

| Bước | Mô tả |
| :-: | :--- |
| 1 | Chạy lại quality gate (lint, test, build). |
| 2 | Build `brewlite-api` và `brewlite-web`, tag bằng commit SHA hoặc `vX.Y.Z`. |
| 3 | Đẩy image lên `ghcr.io/<org>/brewlite-*`. |
| 4 | Deploy qua deploy hook/API của Render bằng secret của CI. |
| 5 | Chạy migration: `npx prisma migrate deploy` (trước khi API nhận request). |
| 6 | Smoke test: `./tests/smoke-test.sh https://<api-url>`. |
| 7 | Smoke test thất bại → job dừng, đỏ; thực hiện rollback (mục 6). |

**Hiện trạng `cd.yml`:** mới build image bằng `docker compose build` và in thông báo; chưa đẩy registry, chưa deploy, chưa chạy `smoke-test.sh`. Cần hoàn thiện các bước 3–6 trước khi nộp.

**Hiện trạng migration:** `apps/api/Dockerfile` chạy `prisma db push --accept-data-loss` khi khởi động, có thể xóa dữ liệu khi schema đổi. Production nên dùng `prisma migrate deploy` với thư mục `prisma/migrations`.

## 5. Health check và smoke test

- `GET /health` → 200 `{"status":"ok","database":"up",...}`; 503 khi mất kết nối DB.
- Render: đặt Health Check Path của API là `/health`.
- Thủ công: `curl -i https://<api-url>/health` và `curl -i https://<api-url>/products`.

## 6. Rollback

| Tình huống | Cách xử lý |
| :--- | :--- |
| Smoke test thất bại sau deploy | Trên Render, mở service → Deploys → chọn bản ổn định gần nhất → Rollback; hoặc deploy lại image tag cũ (`vX.Y.Z` trước đó). |
| Lỗi do code | `git revert <commit>` trên `main` rồi để pipeline deploy lại; hoặc tạo tag mới từ commit tốt. |
| Lỗi do migration | Khôi phục từ backup/snapshot DB của Render trước khi chạy migration; sau đó deploy lại phiên bản cũ. Chụp snapshot trước mỗi lần có migration. |
| Lỗi secret/cấu hình | Sửa biến trong Render Environment và redeploy; không commit secret. |

Sau rollback, chạy lại `smoke-test.sh` và ghi lý do vào release notes.