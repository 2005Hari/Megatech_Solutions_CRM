-- CreateEnum
CREATE TYPE "QuotationType" AS ENUM ('PRODUCT', 'SERVICE', 'MIXED');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultUnit" TEXT NOT NULL DEFAULT 'Nos',
    "defaultRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sacCode" TEXT,
    "gstPct" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "followupDate" TIMESTAMP(3),
    "notes" TEXT,
    "salutation" TEXT,
    "subject" TEXT,
    "type" "QuotationType" NOT NULL DEFAULT 'PRODUCT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "parentQuotationId" TEXT,
    "includeGst" BOOLEAN NOT NULL DEFAULT true,
    "gstPct" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "includeFreight" BOOLEAN NOT NULL DEFAULT true,
    "freightAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "terms" TEXT,
    "customerId" TEXT,
    "customerAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "sectionId" TEXT,
    "type" "ItemType" NOT NULL DEFAULT 'PRODUCT',
    "order" INTEGER NOT NULL DEFAULT 0,
    "brand" TEXT,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit" TEXT,
    "sellPrice" DOUBLE PRECISION NOT NULL,
    "estimatedCost" DOUBLE PRECISION,
    "laborCost" DOUBLE PRECISION,
    "materialCost" DOUBLE PRECISION,
    "transportCost" DOUBLE PRECISION,
    "otherCost" DOUBLE PRECISION,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationSection" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPO" (
    "id" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Open',
    "notes" TEXT,
    "pdfAttached" TEXT,
    "quotationId" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPO_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPOItem" (
    "id" TEXT NOT NULL,
    "cpoId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit" TEXT,
    "sellPrice" DOUBLE PRECISION NOT NULL,
    "estimatedCost" DOUBLE PRECISION,

    CONSTRAINT "CustomerPOItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPO" (
    "id" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "notes" TEXT,
    "cpoId" TEXT,
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPO_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPOItem" (
    "id" TEXT NOT NULL,
    "spoId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit" TEXT,
    "buyPrice" DOUBLE PRECISION,
    "cpoItemId" TEXT,

    CONSTRAINT "SupplierPOItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL,
    "spoId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_refNo_key" ON "Quotation"("refNo");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE INDEX "Quotation_customerId_idx" ON "Quotation"("customerId");

-- CreateIndex
CREATE INDEX "Quotation_parentQuotationId_idx" ON "Quotation"("parentQuotationId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPO_refNo_key" ON "CustomerPO"("refNo");

-- CreateIndex
CREATE INDEX "CustomerPO_status_idx" ON "CustomerPO"("status");

-- CreateIndex
CREATE INDEX "CustomerPO_quotationId_idx" ON "CustomerPO"("quotationId");

-- CreateIndex
CREATE INDEX "CustomerPO_customerId_idx" ON "CustomerPO"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPO_refNo_key" ON "SupplierPO"("refNo");

-- CreateIndex
CREATE INDEX "SupplierPO_status_idx" ON "SupplierPO"("status");

-- CreateIndex
CREATE INDEX "SupplierPO_cpoId_idx" ON "SupplierPO"("cpoId");

-- CreateIndex
CREATE INDEX "SupplierPO_supplierId_idx" ON "SupplierPO"("supplierId");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_parentQuotationId_fkey" FOREIGN KEY ("parentQuotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "QuotationSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationSection" ADD CONSTRAINT "QuotationSection_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPO" ADD CONSTRAINT "CustomerPO_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPO" ADD CONSTRAINT "CustomerPO_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPOItem" ADD CONSTRAINT "CustomerPOItem_cpoId_fkey" FOREIGN KEY ("cpoId") REFERENCES "CustomerPO"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPO" ADD CONSTRAINT "SupplierPO_cpoId_fkey" FOREIGN KEY ("cpoId") REFERENCES "CustomerPO"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPO" ADD CONSTRAINT "SupplierPO_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPOItem" ADD CONSTRAINT "SupplierPOItem_spoId_fkey" FOREIGN KEY ("spoId") REFERENCES "SupplierPO"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPOItem" ADD CONSTRAINT "SupplierPOItem_cpoItemId_fkey" FOREIGN KEY ("cpoItemId") REFERENCES "CustomerPOItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_spoId_fkey" FOREIGN KEY ("spoId") REFERENCES "SupplierPO"("id") ON DELETE CASCADE ON UPDATE CASCADE;

