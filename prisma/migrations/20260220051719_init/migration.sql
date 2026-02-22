-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fitbitUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FitbitAuth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FitbitAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailySummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "activeMinutes" INTEGER NOT NULL DEFAULT 0,
    "caloriesOut" INTEGER,
    CONSTRAINT "DailySummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailySleep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "minutesAsleep" INTEGER NOT NULL DEFAULT 0,
    "timeInBed" INTEGER NOT NULL DEFAULT 0,
    "efficiency" INTEGER NOT NULL DEFAULT 0,
    "deepMinutes" INTEGER,
    "remMinutes" INTEGER,
    "lightMinutes" INTEGER,
    "wakeMinutes" INTEGER,
    "sleepStart" DATETIME,
    "sleepEnd" DATETIME,
    CONSTRAINT "DailySleep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyHeartZones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "zone2Minutes" INTEGER NOT NULL DEFAULT 0,
    "cardioMinutes" INTEGER,
    "peakMinutes" INTEGER,
    "outOfRangeMinutes" INTEGER,
    "restingHeartRate" INTEGER,
    CONSTRAINT "DailyHeartZones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "activityName" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "calories" INTEGER,
    "distance" REAL,
    "steps" INTEGER,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_fitbitUserId_key" ON "User"("fitbitUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FitbitAuth_userId_key" ON "FitbitAuth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailySummary_userId_date_key" ON "DailySummary"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailySleep_userId_date_key" ON "DailySleep"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyHeartZones_userId_date_key" ON "DailyHeartZones"("userId", "date");
