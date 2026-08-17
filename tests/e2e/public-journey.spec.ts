import { expect, test } from "@playwright/test";

function ordinal(text: string | null): number {
  const match = text?.match(/第\s*(\d+)\s*组/);
  if (!match?.[1]) throw new Error(`Could not read Ballot ordinal from: ${text}`);
  return Number(match[1]);
}

test("votes, keeps the result visible, advances explicitly, and treats reload as Skip", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  await expect(page.getByRole("heading", { name: "二选一投票箱" })).toBeVisible();

  const groupLabel = page.locator(".vote-intro .eyebrow");
  const firstOrdinal = ordinal(await groupLabel.textContent());
  await page.locator("details").first().locator("summary").click();
  await expect(page.getByText(/数据待同步|数据更新于/).first()).toBeVisible();

  await page.locator('button[aria-keyshortcuts="1"]').click();
  await expect(
    page.getByRole("heading", { name: /已跳过|这一票已计入社区榜|选择已记录，但本次不计榜/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "下一组" })).toBeVisible();
  await page.waitForTimeout(400);
  expect(ordinal(await groupLabel.textContent())).toBe(firstOrdinal);

  await page.getByRole("button", { name: "下一组" }).click();
  await expect.poll(async () => ordinal(await groupLabel.textContent())).toBe(firstOrdinal + 1);

  const beforeReload = ordinal(await groupLabel.textContent());
  await page.reload();
  await expect(page.getByRole("heading", { name: "二选一投票箱" })).toBeVisible();
  await expect.poll(async () => ordinal(await groupLabel.textContent())).toBe(beforeReload + 1);
});

test("supports ranking search, player details, informational pages, and persisted theme", async ({
  page,
}) => {
  await page.goto("/ranking");
  await expect(page.getByRole("heading", { name: "社区榜单", exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(4);

  await page.getByPlaceholder("搜索选手或战队").fill("Ace");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: /Ace/ }).click();
  await expect(page.getByRole("heading", { name: "Ace" })).toBeVisible();
  await expect(page.getByText("数据待同步", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "关于" }).click();
  await expect(page.getByRole("heading", { name: "数据看专业榜，争论留给社区。" })).toBeVisible();
  await expect(page.getByRole("link", { name: "隐私", exact: true })).toHaveCount(0);
  const privacyResponse = await page.goto("/privacy");
  expect(privacyResponse?.status()).toBe(404);
  await page.goto("/about");

  await page.evaluate(() => window.localStorage.removeItem("csr-theme"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "切换到深色主题" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
