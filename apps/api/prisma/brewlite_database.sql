-- ============================================================
-- BREWLITE DATABASE (SCHEMA + INITIAL DATA)
-- PostgreSQL 16+
-- Single Source of Truth for backend/prisma/schema.prisma
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'PAYMENT_FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProductSize" AS ENUM ('S', 'M', 'L');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'CARD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('SUCCESS', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BarStation" AS ENUM ('ESPRESSO_BAR', 'COLD_BREW_BAR', 'TEA_MATCHA_BAR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryTxType" AS ENUM ('IMPORT', 'ORDER_DEDUCT', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. TABLES (16 TABLES)
-- ============================================================
CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  phone TEXT,
  role "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
  "totalSpent" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Category" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  station "BarStation" NOT NULL DEFAULT 'ESPRESSO_BAR',
  "displayOrder" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "Product" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "categoryId" TEXT,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  station "BarStation" NOT NULL DEFAULT 'ESPRESSO_BAR',
  price INTEGER NOT NULL,
  "imageUrl" TEXT NOT NULL,
  stock INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  "isAvailable" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId")
    REFERENCES "Category"(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ProductVariant" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "productId" TEXT NOT NULL,
  size "ProductSize" NOT NULL,
  "priceAdjustment" INTEGER NOT NULL,
  sku TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "Product"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ModifierGroup" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  "isRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  "isMultiple" BOOLEAN NOT NULL DEFAULT FALSE,
  "minSelect" INTEGER NOT NULL DEFAULT 0,
  "maxSelect" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "ModifierOption" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "modifierGroupId" TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "ModifierOption_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId")
    REFERENCES "ModifierGroup"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Topping" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  price INTEGER NOT NULL,
  "isAvailable" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "Promotion" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  "discountPercent" INTEGER NOT NULL,
  "maxDiscountAmount" INTEGER NOT NULL,
  "minOrderValue" INTEGER NOT NULL,
  "usageLimit" INTEGER NOT NULL DEFAULT 1000,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "expiresAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "Order" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderCode" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL,
  status "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "pickupMethod" TEXT NOT NULL DEFAULT 'PICKUP_COUNTER',
  "customerNote" TEXT,
  subtotal INTEGER NOT NULL,
  "discountAmount" INTEGER NOT NULL DEFAULT 0,
  "pointsUsed" INTEGER NOT NULL DEFAULT 0,
  "pointsDiscountAmount" INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  "promotionCode" TEXT,
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "OrderItem" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  size "ProductSize" NOT NULL,
  qty INTEGER NOT NULL,
  "sugarLevel" TEXT NOT NULL DEFAULT '100% đường',
  "iceLevel" TEXT NOT NULL DEFAULT 'Đá bình thường',
  "itemNote" TEXT,
  station "BarStation" NOT NULL DEFAULT 'ESPRESSO_BAR',
  toppings JSONB NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "lineTotal" INTEGER NOT NULL,
  "inventoryDeducted" BOOLEAN NOT NULL DEFAULT FALSE,
  "kdsStartedAt" TIMESTAMP(3),
  "kdsReadyAt" TIMESTAMP(3),
  "servedAt" TIMESTAMP(3),
  CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId")
    REFERENCES "Order"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "Product"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Payment" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  method "PaymentMethod" NOT NULL,
  status "PaymentStatus" NOT NULL,
  "transactionRef" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId")
    REFERENCES "Order"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LoyaltyTransaction" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  points INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'EARN',
  description TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyTransaction_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LoyaltyTransaction_orderId_fkey" FOREIGN KEY ("orderId")
    REFERENCES "Order"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Ingredient" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  "currentStock" DOUBLE PRECISION NOT NULL,
  "minThreshold" DOUBLE PRECISION NOT NULL,
  "costPerUnit" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Recipe" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "productId" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "quantityNeeded" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "Product"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Recipe_ingredientId_fkey" FOREIGN KEY ("ingredientId")
    REFERENCES "Ingredient"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "InventoryTransaction" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "ingredientId" TEXT NOT NULL,
  "orderId" TEXT,
  type "InventoryTxType" NOT NULL,
  "quantityChange" DOUBLE PRECISION NOT NULL,
  "balanceAfter" DOUBLE PRECISION NOT NULL,
  reason TEXT NOT NULL,
  "performedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryTransaction_ingredientId_fkey" FOREIGN KEY ("ingredientId")
    REFERENCES "Ingredient"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Supplier" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "poNumber" TEXT NOT NULL UNIQUE,
  "supplierId" TEXT NOT NULL,
  "totalAmount" INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  note TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId")
    REFERENCES "Supplier"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "purchaseOrderId" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "lineTotal" INTEGER NOT NULL,
  CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId")
    REFERENCES "PurchaseOrder"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PurchaseOrderItem_ingredientId_fkey" FOREIGN KEY ("ingredientId")
    REFERENCES "Ingredient"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT,
  action TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  details TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX IF NOT EXISTS "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX IF NOT EXISTS "ModifierOption_modifierGroupId_idx" ON "ModifierOption"("modifierGroupId");
CREATE INDEX IF NOT EXISTS "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"(status, "createdAt");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX IF NOT EXISTS "LoyaltyTransaction_userId_createdAt_idx" ON "LoyaltyTransaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Recipe_productId_idx" ON "Recipe"("productId");
CREATE INDEX IF NOT EXISTS "Recipe_ingredientId_idx" ON "Recipe"("ingredientId");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_ingredientId_createdAt_idx" ON "InventoryTransaction"("ingredientId", "createdAt");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_supplierId_createdAt_idx" ON "PurchaseOrder"("supplierId", "createdAt");
CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- ============================================================
-- 4. VALIDATION CONSTRAINTS
-- ============================================================
DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_price_nonnegative" CHECK (price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_nonnegative" CHECK (stock >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_qty_positive" CHECK (qty > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_nonnegative" CHECK (amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_discount_percent_range" CHECK ("discountPercent" BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. INITIAL DATABASE DATA (DML)
-- ============================================================

-- 5.1 Users (Password: BrewLite@123 hashed with bcrypt via pgcrypto)
INSERT INTO "User" (id, email, "passwordHash", "fullName", phone, role, "isActive", "loyaltyPoints", "totalSpent")
VALUES
  ('user-cust-1', 'khachhang@brewlite.vn', crypt('BrewLite@123', gen_salt('bf', 10)), 'Nguyễn Minh Khách', '0909123456', 'CUSTOMER', TRUE, 15000, 485000),
  ('user-admin-1', 'admin@brewlite.vn', crypt('BrewLite@123', gen_salt('bf', 10)), 'Quản Trị Viên BrewLite', '0909888999', 'ADMIN', TRUE, 0, 0),
  ('user-barista-1', 'barista@brewlite.vn', crypt('BrewLite@123', gen_salt('bf', 10)), 'Trần Bảo Barista', '0909777666', 'ADMIN', TRUE, 0, 0)
ON CONFLICT (email) DO NOTHING;

-- 5.2 Categories
INSERT INTO "Category" (id, name, station, "displayOrder", "isActive")
VALUES
  ('cat-1', 'Cà phê truyền thống', 'ESPRESSO_BAR', 1, TRUE),
  ('cat-2', 'Espresso & Máy', 'ESPRESSO_BAR', 2, TRUE),
  ('cat-3', 'Cold Brew', 'COLD_BREW_BAR', 3, TRUE),
  ('cat-4', 'Trà trái cây', 'TEA_MATCHA_BAR', 4, TRUE),
  ('cat-5', 'Matcha & Sữa', 'TEA_MATCHA_BAR', 5, TRUE)
ON CONFLICT (name) DO NOTHING;

-- 5.3 Modifier Groups & Options
INSERT INTO "ModifierGroup" (id, name, "isRequired", "isMultiple", "minSelect", "maxSelect")
VALUES
  ('mod-grp-sugar', 'Mức đường (Sugar Level)', TRUE, FALSE, 1, 1),
  ('mod-grp-ice', 'Mức đá (Ice Level)', TRUE, FALSE, 1, 1)
ON CONFLICT (name) DO NOTHING;

INSERT INTO "ModifierOption" (id, "modifierGroupId", name, price, "isActive")
VALUES
  ('mod-opt-sugar-100', 'mod-grp-sugar', '100% đường (Tiêu chuẩn)', 0, TRUE),
  ('mod-opt-sugar-70', 'mod-grp-sugar', '70% đường (Ít ngọt)', 0, TRUE),
  ('mod-opt-sugar-50', 'mod-grp-sugar', '50% đường (Vừa nhẹ)', 0, TRUE),
  ('mod-opt-sugar-30', 'mod-grp-sugar', '30% đường', 0, TRUE),
  ('mod-opt-sugar-0', 'mod-grp-sugar', 'Không đường (0%)', 0, TRUE),
  ('mod-opt-ice-100', 'mod-grp-ice', 'Đá bình thường', 0, TRUE),
  ('mod-opt-ice-less', 'mod-grp-ice', 'Ít đá', 0, TRUE),
  ('mod-opt-ice-sep', 'mod-grp-ice', 'Đá để riêng', 0, TRUE),
  ('mod-opt-ice-0', 'mod-grp-ice', 'Không đá', 0, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 5.4 Toppings
INSERT INTO "Topping" (id, name, price, "isAvailable")
VALUES
  ('top-1', 'Trân châu trắng giòn', 8000, TRUE),
  ('top-2', 'Kem phô mai Macchiato', 12000, TRUE),
  ('top-3', 'Thêm 1 Shot Espresso', 10000, TRUE),
  ('top-4', 'Thạch cà phê nguyên chất', 8000, TRUE)
ON CONFLICT (name) DO NOTHING;

-- 5.5 Ingredients (Kho nguyên liệu thô)
INSERT INTO "Ingredient" (id, code, name, unit, "currentStock", "minThreshold", "costPerUnit", "isActive")
VALUES
  ('ing-1', 'ING-ROBUSTA', 'Hạt Cà Phê Robusta Đắk Lắk Rang Mộc', 'g', 4500, 500, 350, TRUE),
  ('ing-2', 'ING-ARABICA', 'Hạt Cà Phê Arabica Cầu Đất Thượng Hạng', 'g', 3800, 500, 550, TRUE),
  ('ing-3', 'ING-MILK-FRESH', 'Sữa Tươi Thanh Trùng Dalatmilk', 'ml', 12000, 2000, 45, TRUE),
  ('ing-4', 'ING-MILK-COND', 'Sữa Đặc Ngọt Dịu Cao Cấp', 'ml', 5000, 800, 60, TRUE),
  ('ing-5', 'ING-SYRUP-CARAMEL', 'Sốt Caramel & Syrup Hạt Dẻ', 'ml', 1800, 300, 180, TRUE),
  ('ing-6', 'ING-ORANGE-LEMON', 'Cam Vàng Tươi & Sả Cây Tự Nhiên', 'g', 3200, 600, 90, TRUE),
  ('ing-7', 'ING-PEACH-TEA', 'Cốt Trà Đen & Đào Miếng Ngâm Giòn', 'g', 4200, 800, 110, TRUE),
  ('ing-8', 'ING-MATCHA-UJI', 'Bột Trà Xanh Matcha Uji Nhật Bản', 'g', 180, 250, 1200, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 5.6 Products (20 thức uống trong thực đơn)
INSERT INTO "Product" (id, "categoryId", code, name, description, category, station, price, "imageUrl", stock, version, "isAvailable")
VALUES
  ('prod-1', 'cat-1', 'CF-001', 'Cà Phê Sữa Đá Sài Gòn', 'Hương vị Robusta Đắk Lắk đậm đà pha phin truyền thống hòa quyện cùng sữa đặc ngọt dịu.', 'Cà phê truyền thống', 'ESPRESSO_BAR', 35000, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80', 50, 1, TRUE),
  ('prod-2', 'cat-1', 'CF-002', 'Bạc Xỉu Đá Hạt Dẻ', 'Sữa tươi béo ngậy kết hợp lớp bọt cà phê sánh mịn và hương syrup hạt dẻ thơm lừng.', 'Cà phê truyền thống', 'ESPRESSO_BAR', 39000, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80', 40, 1, TRUE),
  ('prod-3', 'cat-2', 'ES-001', 'Americano Đá Nguyên Bản', 'Chiết xuất 100% hạt Arabica Cầu Đất rang vừa, hậu vị thanh mát và hương hoa quả tự nhiên.', 'Espresso & Máy', 'ESPRESSO_BAR', 40000, 'https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=800&q=80', 45, 1, TRUE),
  ('prod-4', 'cat-2', 'ES-002', 'Cappuccino Kem Mịn', 'Sự cân bằng hoàn hảo giữa Espresso đậm vị, sữa tươi thanh trùng và lớp bọt sữa dày mịn.', 'Espresso & Máy', 'ESPRESSO_BAR', 45000, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=800&q=80', 35, 1, TRUE),
  ('prod-5', 'cat-2', 'ES-003', 'Caramel Macchiato', 'Espresso nồng nàn điểm xuyết sốt Caramel thượng hạng cùng lớp bọt sữa béo nhẹ.', 'Espresso & Máy', 'ESPRESSO_BAR', 52000, 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?auto=format&fit=crop&w=800&q=80', 30, 1, TRUE),
  ('prod-6', 'cat-3', 'CB-001', 'Cold Brew Cam Sả', 'Cà phê ủ lạnh suốt 18 giờ kết hợp nước cam vàng tươi mát và hương sả thanh khiết.', 'Cold Brew', 'COLD_BREW_BAR', 55000, 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=800&q=80', 20, 1, TRUE),
  ('prod-7', 'cat-4', 'TR-001', 'Trà Đào Cam Sả', 'Trà đen ủ lạnh đậm vị quyện cùng đào miếng giòn ngọt, cam vàng tươi và sả cây thơm dịu.', 'Trà trái cây', 'TEA_MATCHA_BAR', 45000, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80', 60, 1, TRUE),
  ('prod-8', 'cat-5', 'MC-001', 'Matcha Latte Kem Phô Mai', 'Bột trà xanh Uji Nhật Bản nguyên chất đánh bông cùng sữa tươi và lớp kem phô mai mặn dịu.', 'Matcha & Sữa', 'TEA_MATCHA_BAR', 55000, 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=800&q=80', 25, 1, TRUE),
  ('prod-9', 'cat-1', 'CF-003', 'Cà Phê Đen Đá Phin Mộc', 'Chiết xuất phin truyền thống từ 100% hạt Robusta Đắk Lắk rang đậm vừa, giữ trọn vị đắng thanh và hậu ngọt sâu.', 'Cà phê truyền thống', 'ESPRESSO_BAR', 29000, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80', 55, 1, TRUE),
  ('prod-10', 'cat-1', 'CF-004', 'Cà Phê Kem Muối Biển', 'Cà phê phin đậm đà phủ lớp kem phô mai đánh bông điểm chút muối biển mặn dịu, béo thơm cân bằng.', 'Cà phê truyền thống', 'ESPRESSO_BAR', 42000, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80', 40, 1, TRUE),
  ('prod-11', 'cat-1', 'CF-005', 'Cà Phê Sữa Tươi Sương Sáo', 'Sự kết hợp độc đáo giữa cà phê phin truyền thống, sữa tươi thanh trùng Dalatmilk và thạch sương sáo mát lành.', 'Cà phê truyền thống', 'ESPRESSO_BAR', 38000, 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=800&q=80', 35, 1, TRUE),
  ('prod-12', 'cat-2', 'ES-004', 'Caffè Latte Hạnh Nhân', 'Double shot Espresso Arabica Cầu Đất quyện cùng sữa tươi thanh trùng Dalatmilk và hương hạnh nhân nướng thanh lịch.', 'Espresso & Máy', 'ESPRESSO_BAR', 49000, 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=800&q=80', 38, 1, TRUE),
  ('prod-13', 'cat-2', 'ES-005', 'Mocha Đá Sô-cô-la Bỉ', 'Sự giao thoa quyến rũ giữa Espresso đậm vị, sốt sô-cô-la đen nguyên chất và sữa tươi mát lạnh.', 'Espresso & Máy', 'ESPRESSO_BAR', 54000, 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=800&q=80', 32, 1, TRUE),
  ('prod-14', 'cat-3', 'CB-002', 'Cold Brew Nguyên Bản 18 Giờ', 'Ủ lạnh 100% hạt Arabica Cầu Đất suốt 18 giờ, mang lại chất cà phê mượt mà và nốt hương trái cây nhiệt đới.', 'Cold Brew', 'COLD_BREW_BAR', 48000, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=80', 28, 1, TRUE),
  ('prod-15', 'cat-3', 'CB-003', 'Cold Brew Sữa Tươi Macchiato', 'Cốt Cold Brew êm mượt kết hợp sữa tươi Dalatmilk và lớp bọt kem phô mai Macchiato sánh mịn.', 'Cold Brew', 'COLD_BREW_BAR', 56000, 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80', 24, 1, TRUE),
  ('prod-16', 'cat-3', 'CB-004', 'Cold Brew Phúc Bồn Tử', 'Vị chua thanh tự nhiên của mứt phúc bồn tử tươi hòa quyện cùng nền cà phê ủ lạnh thanh mát, sảng khoái.', 'Cold Brew', 'COLD_BREW_BAR', 59000, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80', 22, 1, TRUE),
  ('prod-17', 'cat-4', 'TR-002', 'Trà Vải Hoa Hồng Nhiệt Đới', 'Cốt hồng trà ủ lạnh điểm hương hoa hồng dịu nhẹ, kết hợp trái vải ngâm giòn ngọt thanh mát.', 'Trà trái cây', 'TEA_MATCHA_BAR', 46000, 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80', 45, 1, TRUE),
  ('prod-18', 'cat-4', 'TR-003', 'Trà Ô Long Nhãn Sen Vàng', 'Trà Ô Long cao sơn thanh tao kết hợp nhãn nhục giòn ngọt và hạt sen bùi béo giải nhiệt.', 'Trà trái cây', 'TEA_MATCHA_BAR', 49000, 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80', 42, 1, TRUE),
  ('prod-19', 'cat-5', 'MC-002', 'Matcha Uji Đá Xay Kem Tươi', 'Bột trà xanh Uji Nhật Bản xay nhuyễn cùng sữa tươi thanh trùng, phủ lớp kem tươi béo mịn.', 'Matcha & Sữa', 'TEA_MATCHA_BAR', 62000, 'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=800&q=80', 30, 1, TRUE),
  ('prod-20', 'cat-5', 'MC-003', 'Hồng Trà Sữa Nướng Caramel', 'Hồng trà đậm vị ủ nóng cùng sữa tươi thanh trùng và sốt caramel nướng thơm dịu, ngọt vừa phải.', 'Matcha & Sữa', 'TEA_MATCHA_BAR', 44000, 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=800&q=80', 48, 1, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 5.7 Product Variants (S/M/L cho cả 20 sản phẩm)
INSERT INTO "ProductVariant" (id, "productId", size, "priceAdjustment", sku, "isActive")
SELECT
  p.id || '-' || v.size_label,
  p.id,
  v.size_val::"ProductSize",
  v.adj,
  p.code || '-' || v.size_label,
  TRUE
FROM "Product" p
CROSS JOIN (
  VALUES
    ('S', 'S', 0),
    ('M', 'M', 6000),
    ('L', 'L', 12000)
) AS v(size_label, size_val, adj)
ON CONFLICT (id) DO NOTHING;

-- 5.8 Recipes (Bảng định lượng công thức BOM)
INSERT INTO "Recipe" (id, "productId", "ingredientId", "quantityNeeded")
VALUES
  ('rec-1', 'prod-1', 'ing-1', 25),
  ('rec-2', 'prod-1', 'ing-4', 30),
  ('rec-3', 'prod-2', 'ing-1', 18),
  ('rec-4', 'prod-2', 'ing-3', 120),
  ('rec-5', 'prod-2', 'ing-5', 15),
  ('rec-6', 'prod-3', 'ing-2', 20),
  ('rec-7', 'prod-4', 'ing-2', 18),
  ('rec-8', 'prod-4', 'ing-3', 150),
  ('rec-9', 'prod-5', 'ing-2', 18),
  ('rec-10', 'prod-5', 'ing-3', 140),
  ('rec-11', 'prod-5', 'ing-5', 25),
  ('rec-12', 'prod-6', 'ing-2', 28),
  ('rec-13', 'prod-6', 'ing-6', 80),
  ('rec-14', 'prod-7', 'ing-7', 90),
  ('rec-15', 'prod-7', 'ing-6', 50),
  ('rec-16', 'prod-8', 'ing-8', 12),
  ('rec-17', 'prod-8', 'ing-3', 150),
  ('rec-18', 'prod-9', 'ing-1', 25),
  ('rec-19', 'prod-10', 'ing-1', 22),
  ('rec-20', 'prod-10', 'ing-4', 25),
  ('rec-21', 'prod-11', 'ing-1', 20),
  ('rec-22', 'prod-11', 'ing-3', 110),
  ('rec-23', 'prod-12', 'ing-2', 18),
  ('rec-24', 'prod-12', 'ing-3', 150),
  ('rec-25', 'prod-13', 'ing-2', 18),
  ('rec-26', 'prod-13', 'ing-3', 130),
  ('rec-27', 'prod-14', 'ing-2', 30),
  ('rec-28', 'prod-15', 'ing-2', 25),
  ('rec-29', 'prod-15', 'ing-3', 100),
  ('rec-30', 'prod-16', 'ing-2', 26),
  ('rec-31', 'prod-16', 'ing-6', 60),
  ('rec-32', 'prod-17', 'ing-7', 85),
  ('rec-33', 'prod-18', 'ing-7', 90),
  ('rec-34', 'prod-19', 'ing-8', 15),
  ('rec-35', 'prod-19', 'ing-3', 160),
  ('rec-36', 'prod-20', 'ing-7', 60),
  ('rec-37', 'prod-20', 'ing-3', 140),
  ('rec-38', 'prod-20', 'ing-5', 20)
ON CONFLICT (id) DO NOTHING;

-- 5.9 Suppliers, Purchase Orders & Inventory Transactions
INSERT INTO "Supplier" (id, name, phone, email, address, "isActive")
VALUES
  ('sup-1', 'Nông Trại Cầu Đất & Đắk Lắk Specialty Roastery', '02633888999', 'supply@caudatroastery.vn', 'Xã Xuân Trường, TP. Đà Lạt, Lâm Đồng', TRUE),
  ('sup-2', 'Công Ty CP Sữa Đà Lạt (Dalatmilk) & Nguyên Liệu Pha Chế', '02835123456', 'b2b@dalatmilk.vn', 'Quận 1, TP. Hồ Chí Minh', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "PurchaseOrder" (id, "poNumber", "supplierId", "totalAmount", status, note, "createdAt")
VALUES
  ('po-1', 'PO-202610-001', 'sup-1', 3665000, 'RECEIVED', 'Nhập lô hạt Arabica Cầu Đất và Robusta mới rang đầu tuần', CURRENT_TIMESTAMP - INTERVAL '3 days'),
  ('po-2', 'PO-202610-002', 'sup-2', 840000, 'RECEIVED', 'Nhập sữa tươi thanh trùng Dalatmilk và sữa đặc cao cấp', CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT ("poNumber") DO NOTHING;

INSERT INTO "PurchaseOrderItem" (id, "purchaseOrderId", "ingredientId", quantity, "unitPrice", "lineTotal")
VALUES
  ('poi-1', 'po-1', 'ing-1', 4500, 350, 1575000),
  ('poi-2', 'po-1', 'ing-2', 3800, 550, 2090000),
  ('poi-3', 'po-2', 'ing-3', 12000, 45, 540000),
  ('poi-4', 'po-2', 'ing-4', 5000, 60, 300000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "InventoryTransaction" (id, "ingredientId", "orderId", type, "quantityChange", "balanceAfter", reason, "performedBy", "createdAt")
VALUES
  ('itx-1', 'ing-1', NULL, 'IMPORT', 4500, 4500, 'Nhập kho đầu kỳ theo phiếu PO-202610-001', 'Quản Trị Viên BrewLite', CURRENT_TIMESTAMP - INTERVAL '3 days'),
  ('itx-2', 'ing-2', NULL, 'IMPORT', 3800, 3800, 'Nhập kho đầu kỳ theo phiếu PO-202610-001', 'Quản Trị Viên BrewLite', CURRENT_TIMESTAMP - INTERVAL '3 days'),
  ('itx-3', 'ing-8', NULL, 'ORDER_DEDUCT', -70, 180, 'Xuất kho pha chế Matcha Latte theo định lượng BOM', 'Hệ thống KDS Barista', CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- 5.10 Promotions (Mã khuyến mãi)
INSERT INTO "Promotion" (id, code, description, "discountPercent", "maxDiscountAmount", "minOrderValue", "usageLimit", "usedCount", "isActive", "expiresAt")
VALUES
  ('promo-1', 'BREWLITE10', 'Giảm 10%, tối đa 20.000đ cho đơn từ 40.000đ', 10, 20000, 40000, 500, 12, TRUE, CURRENT_TIMESTAMP + INTERVAL '365 days'),
  ('promo-2', 'CHAOBANMOI', 'Giảm 20%, tối đa 30.000đ cho đơn từ 80.000đ', 20, 30000, 80000, 300, 5, TRUE, CURRENT_TIMESTAMP + INTERVAL '365 days')
ON CONFLICT (code) DO NOTHING;

-- 5.11 Sample Orders, OrderItems, Payments & LoyaltyTransactions
INSERT INTO "Order" (id, "orderCode", "userId", status, "pickupMethod", subtotal, "discountAmount", "pointsUsed", "pointsDiscountAmount", total, "promotionCode", "createdAt", "updatedAt")
VALUES
  ('ord-1037', '#1037', 'user-cust-1', 'COMPLETED', 'PICKUP_COUNTER', 98000, 0, 0, 0, 98000, NULL, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days'),
  ('ord-1038', '#1038', 'user-cust-1', 'COMPLETED', 'PICKUP_COUNTER', 76000, 7600, 0, 0, 68400, 'BREWLITE10', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days'),
  ('ord-1039', '#1039', 'user-cust-1', 'COMPLETED', 'PICKUP_COUNTER', 122000, 24400, 0, 0, 97600, 'CHAOBANMOI', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days'),
  ('ord-1040', '#1040', 'user-cust-1', 'READY', 'TAKEAWAY_BAG', 130000, 13000, 0, 0, 117000, 'BREWLITE10', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('ord-1041', '#1041', 'user-cust-1', 'PREPARING', 'PICKUP_COUNTER', 56000, 0, 0, 0, 56000, NULL, CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  ('ord-1042', '#1042', 'user-cust-1', 'PAID', 'PICKUP_COUNTER', 86000, 8600, 0, 0, 77400, 'BREWLITE10', CURRENT_TIMESTAMP - INTERVAL '15 minutes', CURRENT_TIMESTAMP - INTERVAL '15 minutes')
ON CONFLICT ("orderCode") DO NOTHING;

INSERT INTO "OrderItem" (id, "orderId", "productId", "productName", size, qty, "sugarLevel", "iceLevel", station, toppings, "unitPrice", "lineTotal", "inventoryDeducted", "kdsStartedAt")
VALUES
  ('oi-1037', 'ord-1037', 'prod-1', 'Cà Phê Sữa Đá Sài Gòn', 'M', 2, '70% đường', 'Đá bình thường', 'ESPRESSO_BAR', '[{"id":"top-1","name":"Trân châu trắng giòn","price":8000}]'::jsonb, 49000, 98000, TRUE, CURRENT_TIMESTAMP - INTERVAL '5 days'),
  ('oi-1038', 'ord-1038', 'prod-5', 'Caramel Macchiato', 'L', 1, '100% đường', 'Ít đá', 'ESPRESSO_BAR', '[{"id":"top-2","name":"Kem phô mai Macchiato","price":12000}]'::jsonb, 76000, 76000, TRUE, CURRENT_TIMESTAMP - INTERVAL '4 days'),
  ('oi-1039', 'ord-1039', 'prod-6', 'Cold Brew Cam Sả', 'M', 2, '50% đường', 'Đá bình thường', 'COLD_BREW_BAR', '[]'::jsonb, 61000, 122000, TRUE, CURRENT_TIMESTAMP - INTERVAL '2 days'),
  ('oi-1040', 'ord-1040', 'prod-7', 'Trà Đào Cam Sả', 'L', 2, '70% đường', 'Đá để riêng', 'TEA_MATCHA_BAR', '[{"id":"top-1","name":"Trân châu trắng giòn","price":8000}]'::jsonb, 65000, 130000, TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('oi-1041', 'ord-1041', 'prod-3', 'Americano Đá Nguyên Bản', 'M', 1, 'Không đường (0%)', 'Đá bình thường', 'ESPRESSO_BAR', '[{"id":"top-3","name":"Thêm 1 Shot Espresso","price":10000}]'::jsonb, 56000, 56000, TRUE, CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  ('oi-1042', 'ord-1042', 'prod-2', 'Bạc Xỉu Đá Hạt Dẻ', 'S', 2, '70% đường', 'Ít đá', 'ESPRESSO_BAR', '[{"id":"top-4","name":"Thạch cà phê nguyên chất","price":8000}]'::jsonb, 43000, 86000, FALSE, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Payment" (id, "orderId", "idempotencyKey", amount, method, status, "transactionRef", "createdAt")
VALUES
  ('pay-1037', 'ord-1037', 'seed-idem-#1037', 98000, 'WALLET', 'SUCCESS', 'TXN-1037', CURRENT_TIMESTAMP - INTERVAL '5 days'),
  ('pay-1038', 'ord-1038', 'seed-idem-#1038', 68400, 'CARD', 'SUCCESS', 'TXN-1038', CURRENT_TIMESTAMP - INTERVAL '4 days'),
  ('pay-1039', 'ord-1039', 'seed-idem-#1039', 97600, 'WALLET', 'SUCCESS', 'TXN-1039', CURRENT_TIMESTAMP - INTERVAL '2 days'),
  ('pay-1040', 'ord-1040', 'seed-idem-#1040', 117000, 'WALLET', 'SUCCESS', 'TXN-1040', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('pay-1041', 'ord-1041', 'seed-idem-#1041', 56000, 'CARD', 'SUCCESS', 'TXN-1041', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  ('pay-1042', 'ord-1042', 'seed-idem-#1042', 77400, 'WALLET', 'SUCCESS', 'TXN-1042', CURRENT_TIMESTAMP - INTERVAL '15 minutes')
ON CONFLICT ("idempotencyKey") DO NOTHING;

INSERT INTO "LoyaltyTransaction" (id, "userId", "orderId", points, "balanceAfter", type, description, "createdAt")
VALUES
  ('loy-1037', 'user-cust-1', 'ord-1037', 4900, 15000, 'EARN', 'Tích điểm hoàn 5% đơn hàng #1037', CURRENT_TIMESTAMP - INTERVAL '5 days'),
  ('loy-1038', 'user-cust-1', 'ord-1038', 3420, 15000, 'EARN', 'Tích điểm hoàn 5% đơn hàng #1038', CURRENT_TIMESTAMP - INTERVAL '4 days'),
  ('loy-1039', 'user-cust-1', 'ord-1039', 4880, 15000, 'EARN', 'Tích điểm hoàn 5% đơn hàng #1039', CURRENT_TIMESTAMP - INTERVAL '2 days'),
  ('loy-1040', 'user-cust-1', 'ord-1040', 5850, 15000, 'EARN', 'Tích điểm hoàn 5% đơn hàng #1040', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('loy-1041', 'user-cust-1', 'ord-1041', 2800, 15000, 'EARN', 'Tích điểm hoàn 5% đơn hàng #1041', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
  ('loy-1042', 'user-cust-1', 'ord-1042', 3870, 15000, 'EARN', 'Tích điểm hoàn 5% đơn hàng #1042', CURRENT_TIMESTAMP - INTERVAL '15 minutes')
ON CONFLICT (id) DO NOTHING;

-- 5.12 AuditLog
INSERT INTO "AuditLog" (id, "userId", action, "entityType", "entityId", details)
VALUES
  ('audit-init-1', 'user-admin-1', 'SYSTEM_SQL_INIT', 'DATABASE', 'BREWLITE-SQL', 'Khởi tạo cơ sở dữ liệu BrewLite từ file brewlite_database.sql')
ON CONFLICT (id) DO NOTHING;
