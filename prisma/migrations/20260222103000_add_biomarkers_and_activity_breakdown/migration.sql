-- AlterTable
ALTER TABLE "DailySummary" ADD COLUMN "sedentaryMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DailySummary" ADD COLUMN "lightlyActiveMins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DailySummary" ADD COLUMN "fairlyActiveMins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DailySummary" ADD COLUMN "veryActiveMins" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DailyRecovery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "cardioFitnessScore" REAL,
    "vo2Max" REAL,
    "hrvRmssd" REAL,
    "hrvDeepRmssd" REAL,
    "breathingRate" REAL,
    "spo2Avg" REAL,
    "spo2Min" REAL,
    "spo2Max" REAL,
    "skinTempC" REAL,
    "coreTempC" REAL,
    CONSTRAINT "DailyRecovery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyRecovery_userId_date_key" ON "DailyRecovery"("userId", "date");
