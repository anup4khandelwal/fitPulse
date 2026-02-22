-- CreateTable
CREATE TABLE "AlertPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "minSleepHours" REAL NOT NULL DEFAULT 6.5,
    "minAvgSteps" INTEGER NOT NULL DEFAULT 7000,
    "minZone2Days" INTEGER NOT NULL DEFAULT 3,
    "maxRestingHrDelta" REAL NOT NULL DEFAULT 4,
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AlertPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "AlertEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertPreference_userId_key" ON "AlertPreference"("userId");

-- CreateIndex
CREATE INDEX "AlertEvent_userId_createdAt_idx" ON "AlertEvent"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_userId_dayKey_type_key" ON "AlertEvent"("userId", "dayKey", "type");
