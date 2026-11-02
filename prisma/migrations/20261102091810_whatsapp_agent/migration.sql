/*
  Warnings:

  - You are about to drop the `BotRequirementLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "BotActionStatus" AS ENUM ('IGNORED_UNAUTHORIZED', 'OK', 'FAILED');

-- DropTable
DROP TABLE "BotRequirementLog";

-- DropEnum
DROP TYPE "BotRequirementStatus";

-- CreateTable
CREATE TABLE "BotConversation" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "messages" TEXT NOT NULL DEFAULT '[]',
    "pendingConfirmation" TEXT,
    "pendingExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotActionLog" (
    "id" TEXT NOT NULL,
    "fromPhone" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "status" "BotActionStatus" NOT NULL,
    "toolCalls" TEXT,
    "replyText" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotConversation_phoneNumber_key" ON "BotConversation"("phoneNumber");

-- CreateIndex
CREATE INDEX "BotActionLog_fromPhone_idx" ON "BotActionLog"("fromPhone");

-- CreateIndex
CREATE INDEX "BotActionLog_createdAt_idx" ON "BotActionLog"("createdAt");
