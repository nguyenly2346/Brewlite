-- Thanh toán thật qua VNPay Sandbox: thêm phương thức VNPAY, trạng thái PENDING (đang chờ khách quét/thanh toán)
-- và các cột lưu mã giao dịch phía cổng. Chỉ thêm mới, không đổi dữ liệu cũ.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'VNPAY';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PENDING';

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "txnRef" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentUrl" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "gatewayCode" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_txnRef_key" ON "Payment"("txnRef");
