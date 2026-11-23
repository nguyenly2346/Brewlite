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

GitHub Secrets cần có: `RENDER_DEPLOY_HOOK_URL`, `PROD_API_URL` (`GITHUB_TOKEN` có sẵn để đẩy GHCR). Không đưa secret vào repository hay log CI.

## 3. Pipeline CI (`.github/workflows/ci.yml`)

Chạy khi mở pull request và khi push lên nhánh làm việc: Checkout → Node 20 → cài dependency → `prisma generate` + `prisma migrate deploy` trên Postgres service → lint → unit/integration test → build API → build web. Pipeline CD gọi lại workflow này làm quality gate.

Thiết lập branch protection cho `main`: bắt buộc job CI xanh trước khi merge.

## 4. Pipeline CD (`.github/workflows/cd.yml`)

```
Push main / Tag vX.Y.Z → Quality gate → Build image (tag SHA) → Push GHCR → Migrate + Deploy + Smoke (container thật) → Gắn tag latest/semver → Deploy Render → Smoke test production
```

| Bước | Job | Mô tả |
| :-: | :--- | :--- |
| 1 | `quality-gate` | Gọi `ci.yml`: lint, test, build. Lỗi thì pipeline dừng. |
| 2-3 | `build-push` | Build `brewlite-api` và `brewlite-web`, tag bằng commit SHA (`sha-xxxxxxx`), đẩy lên `ghcr.io/<owner>/brewlite-*`. |
| 4-5 | `verify` | Dựng DB và container thật từ image vừa đẩy, chạy `prisma migrate deploy`, khởi động API và web. |
| 6 | `verify` | Smoke test `./tests/smoke-test.sh http://localhost:4000` và kiểm tra web. |
| - | `release` | Chỉ khi `verify` xanh: gắn tag `latest` (và `X.Y.Z` nếu push tag `vX.Y.Z`) cho image đã kiểm tra. |
| 4 | `deploy` | Gọi deploy hook Render bằng secret `RENDER_DEPLOY_HOOK_URL`, chờ `/health` của production. |
| 6-7 | `deploy` | Chạy `smoke-test.sh` trên `PROD_API_URL`; thất bại thì job đỏ và pipeline dừng, rollback theo mục 6. |

**Migration:** `apps/api/docker-entrypoint.sh` chạy `prisma migrate deploy` khi API khởi động (DB rỗng được tạo từ `prisma/migrations`, đã gồm dữ liệu mẫu). Database cũ tạo bằng `db push` (lỗi P3005) được đánh dấu migration khởi tạo là đã áp dụng rồi chạy tiếp. Job `verify` cũng chạy `migrate deploy` trên DB trống trước khi deploy.

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