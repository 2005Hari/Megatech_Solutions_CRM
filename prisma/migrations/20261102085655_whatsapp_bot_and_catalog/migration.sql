-- CreateEnum
CREATE TYPE "BotRequirementStatus" AS ENUM ('RECEIVED', 'IGNORED_UNAUTHORIZED', 'PARSED', 'QUOTATION_CREATED', 'FAILED');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "catalogKey" TEXT NOT NULL,
    "brand" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultUnit" TEXT NOT NULL DEFAULT 'Nos',
    "defaultRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultCost" DOUBLE PRECISION,
    "sacCode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppSender" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppSender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotRequirementLog" (
    "id" TEXT NOT NULL,
    "fromPhone" TEXT NOT NULL,
    "rawMessage" TEXT NOT NULL,
    "status" "BotRequirementStatus" NOT NULL,
    "customerHint" TEXT,
    "matchedCustomerId" TEXT,
    "quotationId" TEXT,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "unmatchedItems" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotRequirementLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_catalogKey_key" ON "Product"("catalogKey");

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "Product"("active");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppSender_phoneNumber_key" ON "WhatsAppSender"("phoneNumber");

-- CreateIndex
CREATE INDEX "BotRequirementLog_fromPhone_idx" ON "BotRequirementLog"("fromPhone");

-- CreateIndex
CREATE INDEX "BotRequirementLog_createdAt_idx" ON "BotRequirementLog"("createdAt");
