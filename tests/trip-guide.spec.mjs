import { expect, test } from "@playwright/test";

const syncUrl = "https://nate-nini-trip-sync.butter-count.workers.dev";

function emptyRemote() {
  return {
    rev: 0,
    swaps: {},
    transport: {},
    planTimes: {},
    done: {},
    doneMeta: {},
    notes: {},
    checks: {},
    pack: {},
    budget: {},
    activity: [],
    order: { fri: [], sat: [], sun: [] },
    orderMeta: {},
    nearDismiss: {},
    clocks: {
      done: {},
      swaps: {},
      transport: {},
      planTimes: {},
      order: {},
      notes: {},
      checks: {},
      pack: {},
      budget: {},
      nearDismiss: {},
    },
    updatedAt: null,
    updatedBy: null,
  };
}

async function preparePage(page) {
  let remote = emptyRemote();
  await page.route(`${syncUrl}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "PUT") {
      remote = JSON.parse(request.postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, rev: remote.rev }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(remote),
    });
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("nate-nini-test-initialized")) {
      localStorage.setItem("nate-nini-who", "Nate");
      localStorage.removeItem("nate-nini-theme");
      localStorage.removeItem("nate-nini-toronto-2026-v4");
      localStorage.setItem("nate-nini-test-initialized", "1");
    }
  });
}

async function openGuide(page, path = "/") {
  await preparePage(page);
  await page.goto(path);
  await expect(page.locator("body")).toHaveClass(/has-who/);
  await expect(page.locator(".hero h1")).toContainText("Nate & Nini Bear");
  await expect(page.locator("#syncStatus")).toBeVisible();
}

test("loads both entry paths with the same trip shell", async ({ page }) => {
  for (const path of ["/", "/trip-guide.html"]) {
    await openGuide(page, path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".dock")).toBeVisible();
    await expect(page.locator("#stickyNow")).toBeVisible();
    await expect(page.locator("#panel-fri")).toHaveClass(/active/);
  }
});

test("switches and persists the selected theme", async ({ page }) => {
  await openGuide(page);
  await page.locator('.dock .tab[data-panel="tools"]').click();
  await expect(page.locator("#panel-tools")).toHaveClass(/active/);
  await page.locator("#themeSelect").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("#themeSelect")).toHaveValue("light");
});

test("keeps stop actions focused while secondary tools stay available", async ({ page }) => {
  await openGuide(page);
  const firstCard = page.locator("#panel-fri .card").first();
  await expect(firstCard.locator(".primary-actions .toggle-done")).toHaveText("Done");
  await expect(firstCard.locator(".primary-actions .btn-primary")).toHaveText("Maps");
  await firstCard.locator(".toggle-done").click();
  await expect(firstCard.locator(".toggle-done")).toHaveText("Undo");
  await firstCard.locator(".card-details summary").click();
  await expect(firstCard.locator(".transport-toggle")).toBeVisible();
  await expect(firstCard.locator(".notes")).toBeVisible();
});

test("opens place details and switches day panels", async ({ page }) => {
  await openGuide(page);
  await page.locator("#panel-fri .place-title").first().click();
  await expect(page.locator("#placeSheet")).toBeVisible();
  await expect(page.locator("#placeTitle")).toContainText("Enterprise");
  await page.locator("#placeClose").click();
  await expect(page.locator("#placeSheet")).toBeHidden();
  await page.locator('.dock .tab[data-panel="sat"]').click();
  await expect(page.locator("#panel-sat")).toHaveClass(/active/);
  await expect(page.locator("#panel-fri")).not.toHaveClass(/active/);
});

test("shows a desktop rail and keeps the full tool panel reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await openGuide(page);
  await expect(page.locator(".desktop-rail")).toBeVisible();
  await page.locator(".desktop-rail [data-open-panel='tools']").click();
  await expect(page.locator("#panel-tools")).toHaveClass(/active/);
});

test("keeps local actions usable when sync is offline", async ({ page }) => {
  await openGuide(page);
  await page.unroute(`${syncUrl}/**`);
  await page.context().setOffline(true);
  const firstDone = page.locator("#panel-fri .toggle-done").first();
  await firstDone.click();
  await expect(firstDone).toHaveText("Undo");
  await expect(page.locator("#syncStatus")).toContainText("Sync", { timeout: 5_000 });
});
