-- CreateTable
CREATE TABLE "WeeklyGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "zone2TargetMinutes" INTEGER NOT NULL DEFAULT 180,
    "avgSleepTargetHours" REAL NOT NULL DEFAULT 7,
    "avgStepsTarget" INTEGER NOT NULL DEFAULT 8500,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyGoal_userId_key" ON "WeeklyGoal"("userId");
