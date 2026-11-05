-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('none', 'percent', 'amount');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'dispatched', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "InboxStatus" AS ENUM ('new', 'read', 'archived');

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "brand" VARCHAR(80) NOT NULL DEFAULT '',
    "category" VARCHAR(80) NOT NULL DEFAULT 'Automation Components',
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "hsnCode" VARCHAR(12) NOT NULL DEFAULT '',
    "unit" VARCHAR(20) NOT NULL DEFAULT 'Nos',
    "imageUrl" VARCHAR(500) NOT NULL DEFAULT '',
    "price" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "discountType" "DiscountType" NOT NULL DEFAULT 'none',
    "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOrder" (
    "id" UUID NOT NULL,
    "orderNumber" VARCHAR(40) NOT NULL,
    "customerName" VARCHAR(120) NOT NULL,
    "customerEmail" VARCHAR(160) NOT NULL,
    "customerPhone" VARCHAR(20) NOT NULL,
    "customerCompany" VARCHAR(160) NOT NULL DEFAULT '',
    "customerGstin" VARCHAR(15) NOT NULL DEFAULT '',
    "customerAddress" VARCHAR(500) NOT NULL DEFAULT '',
    "customerNotes" VARCHAR(1000) NOT NULL DEFAULT '',
    "taxableTotal" DECIMAL(14,2) NOT NULL,
    "taxTotal" DECIMAL(14,2) NOT NULL,
    "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID,
    "sku" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "hsnCode" VARCHAR(12) NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "listPriceInclTax" DECIMAL(12,2) NOT NULL,
    "discountPerUnit" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "taxableAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaSubmission" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(20) NOT NULL DEFAULT '',
    "company" VARCHAR(160) NOT NULL DEFAULT '',
    "stage" VARCHAR(60) NOT NULL,
    "services" TEXT[],
    "quantity" VARCHAR(60) NOT NULL DEFAULT '',
    "timeline" VARCHAR(60) NOT NULL DEFAULT '',
    "description" VARCHAR(4000) NOT NULL,
    "ndaRequested" BOOLEAN NOT NULL DEFAULT false,
    "status" "InboxStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(20) NOT NULL DEFAULT '',
    "company" VARCHAR(160) NOT NULL DEFAULT '',
    "subject" VARCHAR(160) NOT NULL DEFAULT '',
    "message" VARCHAR(4000) NOT NULL,
    "status" "InboxStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "name" VARCHAR(120) NOT NULL DEFAULT 'Administrator',
    "passwordHash" VARCHAR(100) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_isActive_category_name_idx" ON "Product"("isActive", "category", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOrder_orderNumber_key" ON "ProductOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "ProductOrder_status_createdAt_idx" ON "ProductOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "IdeaSubmission_status_createdAt_idx" ON "IdeaSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_status_createdAt_idx" ON "ContactMessage"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
