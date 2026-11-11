# ADR-004: Xác thực JWT và phân quyền theo vai trò

- **Trạng thái:** Chấp nhận
- **Ngày:** 2026-10

## Bối cảnh
FR-04 yêu cầu đăng nhập email/mật khẩu và chỉ người đã đăng nhập mới đặt đơn; NFR-02/03 yêu cầu băm mật khẩu và RBAC.

## Quyết định
Mật khẩu băm bằng bcrypt. `POST /auth/login` phát `accessToken` JWT. Endpoint cần đăng nhập dùng `JwtAuthGuard`; endpoint quản trị dùng thêm `RolesGuard` với `@Roles(ADMIN)`. Vai trò: `CUSTOMER`, `ADMIN`.

## Hệ quả
- (+) Stateless, phù hợp mobile/PWA, không cần lưu session phía server.
- (−) Khó thu hồi token trước khi hết hạn; chưa có refresh token.
- (−) `JWT_SECRET` phải được cấp qua secret của nền tảng ở production, không dùng giá trị mặc định.
