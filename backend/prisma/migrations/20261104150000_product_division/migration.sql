-- CreateEnum
CREATE TYPE "Division" AS ENUM ('electronics', 'electrical', 'industrial');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "division" "Division" NOT NULL DEFAULT 'industrial';

-- Sort the starter catalogue into its divisions
UPDATE "Product" SET "division" = 'electronics' WHERE "sku" IN ('CP2E-S30DT1-D', 'NB7W-TW01B-V1', 'CP1W-MAB221', 'E2B-M12KS04-WP-B1', 'E5CC-RX2ASM-800', 'FL-SWITCH-1005N', 'E3FA-DP15', 'VS0-70QE', '90077-00007VS-102QS', 'DM-18TN');
UPDATE "Product" SET "division" = 'electrical' WHERE "sku" IN ('GD27-0R7G-S2-B', '751107', 'S8FS-C35024J', 'S82Y-FSC530DIN', 'CS94106BOOO', 'SS94141OOSO', 'ETHERNET-CABLE', 'MY2N-GS-DC24', 'PYFZ-08-E');

-- CreateIndex
CREATE INDEX "Product_division_isActive_idx" ON "Product"("division", "isActive");
