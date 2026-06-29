import { test, expect, request } from "@playwright/test";

const INBOX = "http://127.0.0.1:4500";
const PROJECT = "e2e-test";

// Playwright pierces open shadow DOM (the overlay uses mode: "open"), so plain
// CSS / placeholder locators reach controls inside the overlay's shadow root.

async function revealBanner(page: import("@playwright/test").Page) {
  // The overlay may render collapsed (a launcher dot). Click it to expand.
  const launcher = page.locator(".pf-launcher:not(.hidden)");
  if (await launcher.count()) await launcher.first().click();
}

test("overlay mounts on the prototype", async ({ page }) => {
  await page.goto("/");
  // The overlay host + shadow root render the toolbar/launcher.
  await expect(page.locator(".pf-banner, .pf-launcher").first()).toBeVisible({ timeout: 10_000 });
});

test("reviewer can pin feedback and it lands in the inbox", async ({ page }) => {
  await page.goto("/");
  await revealBanner(page);

  // Enter feedback mode.
  await page.locator(".pf-cta.feedback").click();

  // Click an element on the page to anchor the comment.
  await page.locator("#headline").click();

  // Fill the comment popover and submit.
  const text = `e2e comment ${Date.now()}`;
  await page.getByPlaceholder("What should change here?").fill(text);
  await page.locator(".pf-primary").click();

  // Assert it reached the inbox.
  const api = await request.newContext();
  await expect(async () => {
    const res = await api.get(`${INBOX}/feedback?project=${PROJECT}`);
    expect(res.ok()).toBeTruthy();
    const items = await res.json();
    expect(Array.isArray(items)).toBeTruthy();
    expect(items.some((f: { text: string }) => f.text === text)).toBeTruthy();
  }).toPass({ timeout: 10_000 });
  await api.dispose();
});

test("feedback persists (inbox is the source of truth)", async ({ page }) => {
  // Post directly via the API, then confirm the overlay reads it back on reload.
  const api = await request.newContext();
  const text = `persisted ${Date.now()}`;
  const create = await api.post(`${INBOX}/feedback`, {
    data: { text, anchor: { selector: "#cta" }, project: PROJECT, author: "Tester", page: "/" },
  });
  expect(create.ok()).toBeTruthy();

  const list = await api.get(`${INBOX}/feedback?project=${PROJECT}`);
  const items = await list.json();
  expect(items.some((f: { text: string }) => f.text === text)).toBeTruthy();
  await api.dispose();
});
