import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, request } from "node:http";
import { fileURLToPath } from "node:url";

// Run after build:backend. Exercises the compiled production entrypoint through
// a reverse proxy with the same browser origin/cookie contract used on Vercel.
test("compiled backend supports production login through a frontend proxy", { timeout: 60_000 }, async () => {
  const child = spawn(process.execPath, ["dist/production.js"], {
    cwd: fileURLToPath(new URL("../backend/", import.meta.url)),
    env: {
      ...process.env,
      NODE_ENV: "production", DATABASE_PATH: ":memory:",
      HOST: "127.0.0.1", PORT: "0", TRUST_PROXY: "1",
      APP_URL: "https://shop.example.test",
      ADMIN_EMAIL: "", ADMIN_PASSWORD: "", SHOP_BRANCHES: "",
      EMAIL_WEBHOOK_URL: "", SMS_WEBHOOK_URL: "",
      SSLCOMMERZ_STORE_ID: "", SSLCOMMERZ_STORE_PASSWORD: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let proxy;
  try {
    const backend = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error("Production backend startup timed out")), 30_000);
      const fail = error => { clearTimeout(timer); reject(error); };
      child.once("error", fail);
      child.once("exit", code => fail(new Error(`Production backend exited with ${code} before startup`)));
      child.stdout.on("data", chunk => {
        output += chunk;
        const match = output.match(/Pizza House API: (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    let errors = "";
    child.stderr.on("data", chunk => { errors += chunk; });
    proxy = createServer((incoming, outgoing) => {
      const upstream = request(`${backend}${incoming.url}`, {
        method: incoming.method,
        headers: { ...incoming.headers, host: new URL(backend).host, "x-forwarded-for": "192.0.2.10" },
      }, response => {
        outgoing.writeHead(response.statusCode, response.headers);
        response.pipe(outgoing);
      });
      upstream.on("error", () => { outgoing.writeHead(502); outgoing.end(); });
      incoming.pipe(upstream);
    });
    proxy.listen(0, "127.0.0.1");
    await once(proxy, "listening");
    const origin = `http://127.0.0.1:${proxy.address().port}`;
    for (const path of ["/health", "/config", "/products", "/products?search=pizza", "/auth/me"]) {
      const response = await fetch(`${origin}/api${path}`);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get("content-type"), /application\/json/);
      await response.json();
    }
    const signup = await fetch(`${origin}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://shop.example.test", "sec-fetch-site": "same-origin" },
      body: JSON.stringify({ name: "Deployment test", email: "deployment@example.test", password: "deployment-test-password" }),
    });
    assert.equal(signup.status, 200);
    const setCookie = signup.headers.get("set-cookie");
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /Secure/);
    assert.match(setCookie, /SameSite=Lax/);
    assert.doesNotMatch(setCookie, /Domain=/i);
    const cookie = setCookie.split(";")[0];
    const session = await fetch(`${origin}/api/auth/me`, { headers: { cookie } });
    assert.equal((await session.json()).user.email, "deployment@example.test");
    const forbidden = await fetch(`${origin}/api/auth/logout`, {
      method: "POST", headers: { cookie, "content-type": "application/json", origin: "https://evil.example.test" }, body: "{}",
    });
    assert.equal(forbidden.status, 403);
    const missing = await fetch(`${origin}/api/not-found`);
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("content-type"), /application\/json/);
    assert.equal((await fetch(`${backend}/account`)).status, 404);
    assert.doesNotMatch(errors, /ERR_ERL|ValidationError/);
  } finally {
    if (proxy) {
      proxy.closeAllConnections();
      await new Promise(resolve => proxy.close(resolve));
    }
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  }
});
