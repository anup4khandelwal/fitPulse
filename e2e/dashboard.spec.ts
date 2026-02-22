import { expect, test } from "@playwright/test";

test("dashboard renders key sections", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Daily Health Calendar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sleep Insights" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recovery Signals" })).toBeVisible();
});

test("settings page renders", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Fitbit Connection")).toBeVisible();
});
