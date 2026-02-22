-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WeeklyGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "zone2TargetMinutes" INTEGER NOT NULL DEFAULT 180,
    "avgSleepTargetHours" REAL NOT NULL DEFAULT 7,
    "avgStepsTarget" INTEGER NOT NULL DEFAULT 8500,
    "sleepScoreMode" TEXT NOT NULL DEFAULT 'fitbit',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WeeklyGoal" ("avgSleepTargetHours", "avgStepsTarget", "id", "updatedAt", "userId", "zone2TargetMinutes") SELECT "avgSleepTargetHours", "avgStepsTarget", "id", "updatedAt", "userId", "zone2TargetMinutes" FROM "WeeklyGoal";
DROP TABLE "WeeklyGoal";
ALTER TABLE "new_WeeklyGoal" RENAME TO "WeeklyGoal";
CREATE UNIQUE INDEX "WeeklyGoal_userId_key" ON "WeeklyGoal"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
