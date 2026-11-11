# ADR-007: Nền tảng production — Render và GHCR

- **Trạng thái:** Đề xuất (cần nhóm xác nhận nền tảng thực tế trước khi nộp)
- **Ngày:** 2026-11

## Bối cảnh
Đề bài yêu cầu deployment diagram phản ánh đúng nền tảng thực tế, DB không public, có health check và rollback.

## Quyết định
- Web và API chạy thành hai **Render Web Service** từ image Docker; DB là **Render PostgreSQL** truy cập bằng Internal URL, có persistent disk.
- Image lưu ở **GHCR**, tag theo commit SHA hoặc `vX.Y.Z`.
- Secret (`JWT_SECRET`, `DATABASE_URL`) đặt trong Environment của Render và GitHub Secrets.
- Health check path của API: `/health`.

## Phương án đã xét
Railway, Fly.io, VPS tự quản: tương đương về chức năng; chọn Render vì hỗ trợ sẵn Docker, Postgres managed, mạng nội bộ và rollback về deploy cũ qua giao diện.

## Hệ quả
- (+) Ít việc vận hành; DB không lộ ra Internet.
- (−) Gói miễn phí có cold start và giới hạn tài nguyên.
- (−) Nếu nhóm dùng nền tảng khác, phải cập nhật ADR này, `deployment-diagram.puml/.svg` và `docs/deployment.md`.
