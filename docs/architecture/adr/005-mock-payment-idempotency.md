# ADR-005: Thanh toán mô phỏng và idempotency key

- **Trạng thái:** Chấp nhận
- **Ngày:** 2026-10

## Bối cảnh
FR-07 yêu cầu thanh toán Ví/Thẻ mô phỏng; FR-08 yêu cầu không xử lý hai lần khi client gửi lại. Cổng thật (FR-17) nằm ngoài phạm vi.

## Quyết định
`POST /payments` nhận header `Idempotency-Key` (bắt buộc, thiếu trả 400) và `method` ∈ {WALLET, CARD}. Payment lưu `idempotencyKey` duy nhất. Gửi lại cùng key trả lại kết quả cũ với `idempotentReplay = true`. Cập nhật payment, đơn và điểm thưởng trong một transaction.

## Hệ quả
- (+) Thử lại an toàn; điểm thưởng chỉ cộng một lần; kiểm thử được cả nhánh thất bại.
- (−) Không phản ánh độ trễ, webhook hay lỗi thực của cổng thanh toán thật.
