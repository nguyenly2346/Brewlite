# BrewLite — Bối cảnh, Stakeholder và Phạm vi (Task 1.1)

## 1. Vấn đề nghiệp vụ

Tại các quầy cà phê, giờ cao điểm thường phát sinh hàng chờ dài: khách phải xếp hàng để gọi món, trả tiền mặt/quẹt thẻ, rồi chờ nhân viên ghi đơn thủ công. Hậu quả: mất thời gian, nhầm đơn, khó kiểm soát tồn kho nguyên liệu và doanh thu.

**BrewLite** là ứng dụng web (mobile-first/PWA) cho phép khách tự xem menu, tùy chọn đồ uống, đặt đơn, **thanh toán không tiền mặt** và theo dõi trạng thái đơn. Quầy/quản lý nhận đơn có trạng thái rõ ràng, kho nguyên liệu tự trừ theo công thức pha chế.

**Product Vision:** *"BrewLite giúp khách hàng đặt và thanh toán đồ uống không dùng tiền mặt chỉ trong vài chạm, giảm thời gian xếp hàng và nhận đơn nhanh tại quầy."*

## 2. Bảng Stakeholder

| Stakeholder | Vai trò | Mục tiêu | Kỳ vọng |
| :--- | :--- | :--- | :--- |
| Khách hàng | Người dùng chính (role `CUSTOMER`) | Đặt đồ uống nhanh, tùy chọn size/topping/đường/đá, thanh toán không tiền mặt, theo dõi đơn, tích điểm | Giao diện đơn giản trên điện thoại; không bị trừ tiền hai lần; biết rõ trạng thái đơn |
| Nhân viên quầy / Barista | Tiếp nhận & pha chế (dùng tài khoản `ADMIN`) | Nhận đơn đã thanh toán, cập nhật PREPARING → READY → COMPLETED | Danh sách đơn rõ ràng, không chuyển trạng thái sai |
| Quản lý cửa hàng / Product Owner | Quản trị (role `ADMIN`) | Theo dõi doanh thu, quản lý sản phẩm, kho, khuyến mãi; ưu tiên backlog; nghiệm thu Increment | Số liệu chính xác, kho không âm, kiểm soát được khuyến mãi |
| Giảng viên / khách hàng nghiệm thu | Đánh giá | Kiểm tra quy trình, sản phẩm, mức đáp ứng tiêu chí chấp nhận | Tài liệu đầy đủ, truy vết được, chạy được theo README |
| Nhóm phát triển (Nhóm 19) | Phân tích, thiết kế, lập trình, kiểm thử, bàn giao | Hoàn thành MVP đúng hạn, chất lượng, có CI/CD | Yêu cầu rõ ràng, kiểm chứng được |
| Đơn vị thanh toán | Cổng Ví/Thẻ (mô phỏng bằng Mock Payment Service) | Nhận yêu cầu thanh toán, trả kết quả thành công/thất bại | Yêu cầu hợp lệ, không gửi trùng giao dịch (Idempotency-Key) |

## 3. Phạm vi

### 3.1 In-scope (MVP)

- Xem menu, tìm/lọc sản phẩm; xem chi tiết sản phẩm; chọn size (S/M/L), topping, mức đường, mức đá, ghi chú.
- Giỏ hàng (thêm/sửa/xóa, tự tính tổng, lưu phía client).
- Đăng ký, đăng nhập (JWT), phân quyền `CUSTOMER` / `ADMIN`.
- Tạo đơn hàng (PENDING) có kiểm soát tồn kho đồng thời (transaction + optimistic locking).
- Áp mã khuyến mãi; dùng và tích điểm thưởng (loyalty).
- Thanh toán không tiền mặt mô phỏng: Ví điện tử / Thẻ ngân hàng, idempotent bằng `Idempotency-Key`; thành công → PAID, thất bại → PAYMENT_FAILED (có thể thử lại).
- Màn hình xác nhận đơn (mã đơn, trạng thái) và lịch sử đơn.
- Quản lý trạng thái đơn theo máy trạng thái (Admin/Barista).
- Cổng Admin: thống kê doanh thu, danh sách đơn, quản lý sản phẩm, kho nguyên liệu, công thức pha chế (BOM).
- Health check `GET /health`; chạy bằng Docker Compose; CI/CD GitHub Actions.

### 3.2 Phạm vi mở rộng (ngoài MVP, có thể làm sau)

- Màn hình KDS riêng cho Barista, thông báo đẩy khi đơn READY.
- PWA đầy đủ (service worker, offline).
- Quản lý nhà cung cấp/đơn nhập hàng (đã có mô hình dữ liệu `Supplier`, `PurchaseOrder`).
- Báo cáo nâng cao, nhật ký kiểm toán (`AuditLog`).

### 3.3 Out-of-scope (không thực hiện)

- Tích hợp cổng thanh toán thật (Momo/VNPay/Stripe) và xử lý tiền thật, hoàn tiền.
- Giao hàng tận nơi, theo dõi shipper.
- Ứng dụng native iOS/Android.
- Đa chi nhánh, đa ngôn ngữ, đa tiền tệ.
- Thanh toán tiền mặt.

## 4. Giả định

| Mã | Giả định |
| :--- | :--- |
| A-01 | Khách có điện thoại/trình duyệt hiện đại và kết nối Internet khi đặt đơn. |
| A-02 | Cổng thanh toán là mô phỏng; kết quả thất bại được kích hoạt bằng tùy chọn mô phỏng lỗi. |
| A-03 | Mỗi đơn nhận tại quầy (`PICKUP_COUNTER`), không giao hàng. |
| A-04 | Giá tính bằng VND, số nguyên. Phụ thu size: S +0đ, M +6.000đ, L +12.000đ. |
| A-05 | 1 điểm thưởng = giảm 1đ; mỗi đơn PAID cộng 5% tổng tiền thanh toán thành điểm. |
| A-06 | Nhân viên quầy dùng tài khoản có quyền `ADMIN` trong MVP. |
| A-07 | Một cửa hàng duy nhất, một kho nguyên liệu. |

## 5. Ràng buộc

| Mã | Ràng buộc |
| :--- | :--- |
| C-01 | Công nghệ bắt buộc: Next.js (frontend), NestJS (backend), PostgreSQL (CSDL). |
| C-02 | Frontend theo hướng mobile-first/PWA. |
| C-03 | Đóng gói bằng Docker; phải chạy được web + API + DB bằng `docker-compose`. |
| C-04 | Quản lý mã nguồn bằng Git, CI/CD bằng GitHub Actions. |
| C-05 | Thời gian: hoàn thành trong Học kỳ I 2026–2027, theo 5 task tuần tự của Assignment 2. |
| C-06 | Chỉ dùng dữ liệu mẫu/seed, không dùng dữ liệu thật của khách hàng. |

## 6. Rủi ro ban đầu

| Mã | Rủi ro | Khả năng | Ảnh hưởng | Giảm thiểu |
| :--- | :--- | :-: | :-: | :--- |
| R-01 | Nhiều khách đặt cùng lúc làm bán vượt tồn kho | Trung bình | Cao | Transaction + optimistic locking (`version`), retry, test đồng thời |
| R-02 | Khách bấm thanh toán nhiều lần / mạng lỗi gửi lại → trừ tiền trùng | Cao | Cao | `Idempotency-Key` duy nhất mỗi giao dịch |
| R-03 | Chuyển trạng thái đơn sai (ví dụ COMPLETED → PAID) | Trung bình | Cao | State machine `assertTransition` + unit test |
| R-04 | Lộ secret/mật khẩu trong repository | Trung bình | Cao | Dùng biến môi trường, `.env` không commit, secret của CI |
| R-05 | Triển khai production không kịp / lỗi cấu hình | Trung bình | Cao | Docker hóa sớm, CI/CD, smoke test, rollback |
| R-06 | Thiếu tài liệu, tài liệu lệch với code | Trung bình | Trung bình | Mọi thay đổi qua PR; ma trận truy vết |
| R-07 | Thành viên không đồng đều tiến độ | Trung bình | Trung bình | Scrum: Daily Scrum, burndown, Sprint Review |
