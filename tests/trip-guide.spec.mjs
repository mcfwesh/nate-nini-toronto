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
      const key = "nate-nini-toronto-2026-v4";
      const state = {};
      state.panel = "fri";
      state.carryMarkers = { "fri->sat": "2026-08-08", "sat->sun": "2026-08-09" };
      state.carriedTo = {};
      state.carryUndo = null;
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem("nate-nini-test-initialized", "1");
    }
  });
}

async function openGuide(page, path = ".") {
  await preparePage(page);
  await page.goto(path);
  await expect(page.locator("body")).toHaveClass(/has-who/);
  await expect(page.locator(".hero h1")).toContainText("Nate & Nini Bear");
  await expect(page.locator("#syncStatus")).toBeVisible();
}

test("loads both entry paths with the same trip shell", async ({ page }) => {
  for (const path of [".", "trip-guide.html"]) {
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

test("replan remaining does not retime done anchor stops", async ({ page }) => {
  await openGuide(page);
  await page.evaluate(() => {
    const key = "nate-nini-toronto-2026-v4";
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    state.done = { f1: true, f2: true, f3: true };
    state.doneMeta = {
      f1: { who: "Nate", at: "2026-08-07T11:00:00.000Z" },
      f2: { who: "Nate", at: "2026-08-07T13:00:00.000Z" },
      f3: { who: "Nate", at: "2026-08-07T20:00:00.000Z" },
    };
    state.planTimes = { f3: "2:30 PM", f4: "4:00 PM", f5: "7:00 PM", f6: "9:30 PM" };
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator("#replanBtn")).toBeVisible();
  const anchorBefore = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("nate-nini-toronto-2026-v4") || "{}");
    return state.planTimes.f3;
  });
  await page.locator("#replanBtn").click();
  const anchorAfter = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("nate-nini-toronto-2026-v4") || "{}");
    return state.planTimes.f3;
  });
  expect(anchorAfter).toBe(anchorBefore);
  await expect(page.locator("#panel-fri .card[data-slot='f4'] .time-pill")).not.toHaveText("2:30 PM");
});

test("opens next-day carry preview without mutating live order", async ({ page }) => {
  await openGuide(page);
  await page.evaluate(() => {
    const key = "nate-nini-toronto-2026-v4";
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    state.done = { f1: true, f2: true };
    state.doneMeta = {
      f1: { who: "Nate", at: "2026-08-07T11:00:00.000Z" },
      f2: { who: "Nate", at: "2026-08-07T13:00:00.000Z" },
    };
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  const satOrderBefore = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("nate-nini-toronto-2026-v4") || "{}");
    return JSON.stringify(state.order?.sat || []);
  });
  await expect(page.locator("#previewNextDayBtn")).toBeVisible();
  await page.locator("#previewNextDayBtn").click();
  await expect(page.locator("#carryPreviewSheet")).toBeVisible();
  await expect(page.locator("#carryPreviewList")).toContainText("Harbourfront");
  await page.locator("#carryPreviewClose").click();
  await expect(page.locator("#carryPreviewSheet")).toBeHidden();
  const satOrderAfter = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("nate-nini-toronto-2026-v4") || "{}");
    return JSON.stringify(state.order?.sat || []);
  });
  expect(satOrderAfter).toBe(satOrderBefore);
});

test("runs fri to sat midnight carry once when due", async ({ page }) => {
  await preparePage(page);
  await page.addInitScript(() => {
    const key = "nate-nini-toronto-2026-v4";
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    state.carryMarkers = {};
    state.carriedTo = {};
    state.carryUndo = null;
    state.done = { f1: true, f2: true };
    state.doneMeta = {
      f1: { who: "Nate", at: "2026-08-07T11:00:00.000Z" },
      f2: { who: "Nate", at: "2026-08-07T13:00:00.000Z" },
    };
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.goto(".");
  await expect(page.locator("body")).toHaveClass(/has-who/);
  const carried = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("nate-nini-toronto-2026-v4") || "{}");
    return {
      f3: state.carriedTo?.f3,
      marker: state.carryMarkers?.["fri->sat"],
      friCount: document.querySelectorAll("#panel-fri .card").length,
      satHasHarbour: document.querySelector("#panel-sat")?.textContent?.includes("Harbourfront"),
    };
  });
  expect(carried.f3).toBe("sat");
  expect(carried.marker).toBe("2026-08-08");
  expect(carried.friCount).toBe(2);
  expect(carried.satHasHarbour).toBeTruthy();
});

test("supports undo carry until a carried stop is marked done", async ({ page }) => {
  await openGuide(page);
  await page.evaluate(() => {
    const key = "nate-nini-toronto-2026-v4";
    const state = JSON.parse(localStorage.getItem(key) || "{}");
    state.done = { f1: true, f2: true };
    state.order = { fri: ["f1", "f2"], sat: [], sun: [] };
    state.carriedTo = { f3: "sat", f4: "sat", f5: "sat", f6: "sat" };
    state.order.sat = ["s1", "f3", "s2", "f4", "s3", "f5", "s4", "f6", "s5"];
    state.carryUndo = {
      fromDay: "fri",
      toDay: "sat",
      carriedIds: ["f3", "f4", "f5", "f6"],
      order: { fri: ["f1", "f2"], sat: ["s1", "s2", "s3", "s4", "s5"], sun: [] },
      planTimes: {},
      carriedTo: {},
      carryMarkers: { "fri->sat": "2026-08-08", "sat->sun": "2026-08-09" },
    };
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator("#undoCarryBtn")).toBeVisible();
  await page.locator("#undoCarryBtn").click();
  await expect.poll(async () => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("nate-nini-toronto-2026-v4") || "{}");
    return state.carryUndo;
  })).toBeNull();
  await expect(page.locator("#undoCarryBtn")).toBeHidden();
  const carriedTo = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("nate-nini-toronto-2026-v4") || "{}");
    return state.carriedTo || {};
  });
  expect(carriedTo.f3).toBeFalsy();
});
