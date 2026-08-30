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
}, testInfo) => {
  await page.goto("/ranking");
  await expect(page.getByRole("heading", { name: "社区榜单", exact: true })).toBeVisible();
  await expect(page.getByText("入榜选手")).toBeVisible();
  await expect(page.getByText("总计票数")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "高分在前" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const highest = (await page.locator("tbody tr").first().locator("strong").textContent()) ?? "";
  await page.getByRole("button", { name: "低分在前" }).click();
  await expect(page.locator("tbody tr").last().locator("strong")).toHaveText(highest);
  await page.getByRole("button", { name: "高分在前" }).click();
  await expect(page.locator("tbody tr").first().locator("strong")).toHaveText(highest);

  await page.getByPlaceholder("搜索选手或战队").fill("Ace");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: /Ace/ }).click();
  await expect(page.getByRole("heading", { name: "Ace" })).toBeVisible();
  await expect(page.getByText("数据待同步", { exact: true })).toBeVisible();

  await expect(page.getByRole("link", { name: "当期赛事 - BLAST S2" })).toBeVisible();
  await expect(page.getByRole("link", { name: "往期赛事" })).toBeVisible();
  await page.getByRole("link", { name: "当期赛事 - BLAST S2" }).click();
  await expect(page.getByRole("heading", { name: "BLAST Open Porto 2026" })).toBeVisible();
  await expect(page.getByText("当前赛事不影响社区总榜的+1/−1")).toBeVisible();
  const mapsHeader = page.locator(".event-mvp-table th", { hasText: "Maps" });
  const standingHeader = page.locator(".event-mvp-table th", { hasText: "成绩" });
  if (testInfo.project.name === "mobile-chromium") {
    await expect(mapsHeader).toBeHidden();
    await expect(standingHeader).toBeHidden();
  } else {
    await expect(mapsHeader).toBeVisible();
    await expect(standingHeader).toBeVisible();
  }
  await expect(
    page.locator(".event-mvp-table tbody tr").first().locator(".ranking-table__rank"),
  ).toHaveText("#1");
  await page.getByRole("button", { name: "投票 +1" }).first().click();
  await expect(page.getByRole("button", { name: "今日已投" })).toBeVisible();

  await page.getByRole("link", { name: "往期赛事", exact: true }).click();
  await expect(page.getByRole("heading", { name: "往期赛事", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Esports World Cup 2026/ }).click();
  await expect(page.getByRole("heading", { name: "Esports World Cup 2026" })).toBeVisible();
  await expect(page.getByRole("button", { name: "投票已结束" }).first()).toBeVisible();

  await page.getByRole("link", { name: "关于" }).click();
  await expect(page.getByRole("link", { name: "世界第一可爱睦子米" })).toBeVisible();
  await expect(page.getByRole("link", { name: "GitHub" })).toBeVisible();
  await expect(page.getByText("作者与开源")).toBeVisible();
  await expect(page.getByText("灵感与数据")).toBeVisible();
  await expect(page.getByRole("heading", { name: "作者", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "灵感来源", exact: true })).toHaveCount(0);
  await expect(page.getByText("先决定谁有资格出现，不替社区决定谁更强。")).toHaveCount(0);
  await expect(page.getByText("计票与节奏")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "明日方舟六星干员强度投票箱" })).toHaveAttribute(
    "href",
    "https://vote.ltsc.vip/",
  );
  await expect(page.getByRole("link", { name: "弗一把" })).toHaveAttribute(
    "href",
    "https://shnlfriberg.online/",
  );
  await expect(page.getByRole("link", { name: "HLTV" })).toHaveAttribute(
    "href",
    "https://www.hltv.org/",
  );
  await expect(page.locator(".rule-strip span").first()).toHaveText("01");
  await expect(page.getByText("这不是客观真理")).toHaveCount(0);
  await expect(page.getByText("社区意见，不是客观真理。")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "规则与候选池" })).toHaveCount(0);
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
