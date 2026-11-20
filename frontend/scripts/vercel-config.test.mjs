import test from "node:test";
import assert from "node:assert/strict";
import { vercelConfig } from "./vercel-config.mjs";

test("API routes proxy before static files and SPA fallback", () => {
  const { routes } = vercelConfig("https://pizza-api.example.com/");
  function destination(path) {
    for (const route of routes) {
      if (!route.src) continue;
      const expression = new RegExp(`^${route.src}$`);
      if (expression.test(path)) return path.replace(expression, route.dest);
    }
  }
  assert.equal(destination("/api"), "https://pizza-api.example.com/api");
  for (const path of ["/api/products", "/api/auth/me", "/api/payments/ipn", "/api/unknown"]) {
    assert.equal(destination(path), `https://pizza-api.example.com${path}`);
  }
  assert.equal(destination("/orders/PH-123"), "/index.html");
  assert.equal(destination("/apiary"), "/index.html");
  assert.deepEqual(routes[2], { handle: "filesystem" });
});

test("deployment refuses missing or invalid backend configuration", () => {
  for (const origin of [undefined, "", "not-a-url", "http://example.com", "https://example.com/api", "https://user:password@example.com", "https://example.com?key=value", "https://example.com#fragment"]) {
    assert.throws(() => vercelConfig(origin), /API_ORIGIN/);
  }
});
