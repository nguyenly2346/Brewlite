# Thanh toán VNPay Sandbox

Brewlite hỗ trợ hai cổng thanh toán, chọn bằng biến môi trường `PAYMENT_PROVIDER` của backend:

| Giá trị | Hành vi |
| --- | --- |
| `mock` (mặc định khi không đặt) | Giả lập như trước: bấm xác nhận là đơn thành `PAID`. Dùng cho test và CI. |
| `vnpay` | Thanh toán thật qua VNPay Sandbox: hiện mã QR, khách thanh toán trên trang VNPay, VNPay báo kết quả về backend. Endpoint mock `POST /payments` bị đóng (403). |

Giá trị khác hai giá trị trên làm backend không khởi động, thiếu `VNPAY_TMN_CODE`/`VNPAY_HASH_SECRET` khi dùng `vnpay` cũng vậy.

## Biến môi trường (backend)

```
PAYMENT_PROVIDER=vnpay
VNPAY_TMN_CODE=<terminal code sandbox>
VNPAY_HASH_SECRET=<hash secret sandbox>   # giữ bí mật, không commit
API_PUBLIC_URL=http://localhost:4000      # origin backend mà trình duyệt/VNPay gọi tới được, KHÔNG kèm đường dẫn
FRONTEND_URL=http://localhost:3000        # origin website để chuyển khách về sau khi thanh toán
VNPAY_QR_TTL_MINUTES=10                   # thời hạn mã QR (1-60)
# VNPAY_PAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html  (mặc định)
```

Backend chạy ở cổng `4000` như cũ; không cần cổng khác.

## Chạy thử

1. Điền biến trên vào `apps/api/.env` (hoặc file `.env` cạnh `docker-compose.yml` nếu chạy Docker), khởi động lại backend.
2. Đăng nhập khách, thêm món, vào thanh toán. Nút thanh toán đổi thành "Thanh toán qua VNPay".
3. Cửa sổ QR hiện ra. Quét bằng điện thoại hoặc bấm "Mở trang thanh toán VNPay" để thanh toán ngay trên máy.
4. Thanh toán xong, VNPay chuyển trình duyệt về `API_PUBLIC_URL/payments/vnpay/return`, backend xác thực rồi chuyển hướng 303 về trang đơn hàng.

### Khi nào cần tunnel (ngrok, cloudflared...)

- **Chỉ thanh toán trên cùng máy đang chạy backend**: `API_PUBLIC_URL=http://localhost:4000` là đủ cho luồng Return.
- **Quét QR bằng điện thoại**: điện thoại phải mở được `API_PUBLIC_URL` sau khi thanh toán xong, nên cần tunnel tới cổng 4000 (ví dụ `ngrok http 4000`) và đặt `API_PUBLIC_URL` thành địa chỉ https của tunnel. Đổi địa chỉ tunnel thì cập nhật lại env.
- **IPN** (VNPay gọi server-to-server): cần địa chỉ công khai `https://<domain>/payments/vnpay/ipn`, đăng ký ở phía quản lý merchant sandbox. Không có IPN thì kết quả vẫn được ghi nhận qua Return khi khách quay về, nhưng nếu khách đóng trình duyệt giữa chừng thì đơn sẽ chưa cập nhật.

## Luồng và quy tắc xử lý

- `POST /payments/vnpay/create` (cần đăng nhập): tạo bản ghi `Payment` trạng thái `PENDING` và URL VNPay đã ký. Gọi lại khi mã còn hạn thì trả lại đúng mã đó. Số tiền phải từ 5.000đ.
- `GET /payments/vnpay/ipn` và `GET /payments/vnpay/return` dùng chung một hàm xử lý: kiểm tra chữ ký HMAC-SHA512, tìm giao dịch theo `vnp_TxnRef`, đối chiếu số tiền, rồi chỉ ghi nhận **đúng một lần** (cập nhật có điều kiện `PENDING` → `SUCCESS`/`FAILED`). IPN gửi lại hoặc Return đến sau IPN không tích điểm lần hai.
- Thành công: đơn `PAID`, tích 5% điểm như luồng cũ. Thất bại hoặc khách hủy trên VNPay: giao dịch `FAILED`, đơn `PAYMENT_FAILED` (vẫn thanh toán lại hoặc hủy được).
- QR hết hạn **không** làm đơn thất bại: đơn giữ nguyên, khách bấm "Tạo mã QR mới".
- Tiền đã về nhưng đơn đã hủy hoặc đã được trả bằng giao dịch khác: giao dịch ghi `SUCCESS` kèm ghi chú đối soát, đơn không bị đổi trạng thái, cần hoàn tiền thủ công (hoàn tiền qua API VNPay chưa được làm).
- Mã phản hồi IPN: `00` ok, `01` không thấy giao dịch, `02` đã xác nhận trước đó, `04` sai số tiền, `97` sai chữ ký, `99` lỗi (VNPay sẽ gửi lại).

## Dữ liệu thử nghiệm

Dùng thẻ/tài khoản test do VNPay công bố trong tài liệu sandbox (thẻ NCB nội địa, OTP thử). Thông tin này do VNPay quản lý và có thể đổi, hãy lấy bản mới nhất ở trang tài liệu sandbox của VNPay hoặc email cấp merchant.

## Chưa làm

- Tự động hủy đơn `PENDING` sau thời gian giữ món (tồn kho vẫn giữ cho tới khi khách hủy, như luồng cũ).
- Hoàn tiền thật qua VNPay khi hủy đơn đã thanh toán (hiện vẫn là thông báo mô phỏng).
- Truy vấn lại giao dịch (querydr) khi lỡ IPN.
