-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contactDetails" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contactDetails" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refNo" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "followupDate" DATETIME,
    "notes" TEXT,
    "customerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quotationId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit" TEXT,
    "sellPrice" REAL NOT NULL,
    CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerPO" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refNo" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "notes" TEXT,
    "pdfAttached" TEXT,
    "quotationId" TEXT,
    "customerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerPO_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerPO_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerPOItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cpoId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit" TEXT,
    "sellPrice" REAL NOT NULL,
    CONSTRAINT "CustomerPOItem_cpoId_fkey" FOREIGN KEY ("cpoId") REFERENCES "CustomerPO" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierPO" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refNo" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "notes" TEXT,
    "cpoId" TEXT,
    "supplierId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupplierPO_cpoId_fkey" FOREIGN KEY ("cpoId") REFERENCES "CustomerPO" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupplierPO_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierPOItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "spoId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit" TEXT,
    "buyPrice" REAL,
    CONSTRAINT "SupplierPOItem_spoId_fkey" FOREIGN KEY ("spoId") REFERENCES "SupplierPO" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "spoId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatusHistory_spoId_fkey" FOREIGN KEY ("spoId") REFERENCES "SupplierPO" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_refNo_key" ON "Quotation"("refNo");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPO_refNo_key" ON "CustomerPO"("refNo");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPO_refNo_key" ON "SupplierPO"("refNo");
