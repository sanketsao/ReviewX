import { test, expect, request } from "@playwright/test";

// Post-publish smoke checks: confirm the extension is actually live on each
// registry. These hit the public internet — skip them when offline / in a
// hermetic CI by setting SKIP_LIVE=1.
const skip = process.env.SKIP_LIVE === "1";

test.describe("published listings", () => {
  test.skip(skip, "live network checks disabled (SKIP_LIVE=1)");

  test("OpenVSX serves reviewsx.prototype-review", async () => {
    const api = await request.newContext();
    const res = await api.get("https://open-vsx.org/api/reviewsx/prototype-review");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.namespace).toBe("reviewsx");
    expect(data.name).toBe("prototype-review");
    await api.dispose();
  });

  test("VS Code Marketplace item page exists", async () => {
    const api = await request.newContext();
    const res = await api.get(
      "https://marketplace.visualstudio.com/items?itemName=Reviewsx.prototype-review"
    );
    // 200 = the listing exists and renders.
    expect(res.status()).toBe(200);
    await api.dispose();
  });

  test("hosted inbox is healthy", async () => {
    const api = await request.newContext();
    const res = await api.get("https://inbox.reviewsx.app/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    await api.dispose();
  });
});
