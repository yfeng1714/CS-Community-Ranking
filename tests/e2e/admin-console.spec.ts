import { expect, test } from "@playwright/test";

test("logs in and performs an audited Candidate Pool pairing toggle", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel("Username").fill("e2e-owner");
  await page.getByLabel("Password").fill("playwright-only-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Control room" })).toBeVisible();
  await expect(page.getByText("Score integrity")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pool update workflow" })).toBeVisible();
  await expect(page.getByText("Exact next action")).toBeVisible();

  const row = page.locator("#pool").getByRole("row").filter({ hasText: "Ace" });
  const reason = row.getByPlaceholder("Why is this change needed?");
  await reason.fill("Playwright verifies the audited pairing control");
  const initialButton = row.getByRole("button", { name: /Disable|Enable/ });
  const initialLabel = await initialButton.textContent();
  await initialButton.click();
  await expect(row.getByText("Saved and audited.")).toBeVisible();
  await expect(
    row.getByRole("button", { name: initialLabel === "Disable" ? "Enable" : "Disable" }),
  ).toBeVisible();

  await row
    .getByPlaceholder("Why is this change needed?")
    .fill("Restore the E2E fixture after verification");
  await row
    .getByRole("button", { name: initialLabel === "Disable" ? "Enable" : "Disable" })
    .click();
  await expect(row.getByText("Saved and audited.")).toBeVisible();
});
