-- Bổ sung tồn kho theo sản phẩm (phục vụ kiểm soát đặt đồng thời, Task 10.3)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stock" INTEGER NOT NULL DEFAULT 100;

DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_non_negative" CHECK ("stock" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
