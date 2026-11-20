import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { CustomerProfile, Order, Quote, User } from "@pizza-house/shared/types";
process.env.DATABASE_PATH = ":memory:";
process.env.NODE_ENV = "test";
delete process.env.EMAIL_WEBHOOK_URL;
delete process.env.SMS_WEBHOOK_URL;
delete process.env.NOTIFICATION_WEBHOOK_TOKEN;
delete process.env.SHOP_BRANCHES;
const { app } = await import("../app.js");
const { db, getProducts, saveProduct } = await import("../lib/database.js");
const { changeOrderStatus } = await import("../modules/orders/service.js");
const { flushNotifications } = await import("../lib/notifications.js");
let server: Server, base: string, cookie: string, other: string, user: User;
const address = { name: "Feature Buyer", phone: "01712345678", street: "House 12, Road 4, Dhaka", zoneId: "dhanmondi", notes: "" };
async function request<T = Record<string, unknown>>(path: string, method = "GET", body?: unknown, session = cookie) {
  const response = await fetch(`${base}/api${path}`, { method, headers: { "Content-Type": "application/json", Cookie: session || "" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json() as T, cookie: response.headers.get("set-cookie")?.split(";")[0] || "" };
}
before(async () => {
  server = await new Promise<Server>(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const signup = await request<{ user: User }>("/auth/register", "POST", { name: "Feature Buyer", email: "features@example.test", password: "feature-password-123" });
  cookie = signup.cookie; user = signup.data.user;
  other = (await request("/auth/register", "POST", { name: "Other Buyer", email: "other@example.test", password: "other-password-123" })).cookie;
});
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); db.close(); });
async function create(extra: Record<string, unknown> = {}) {
  const body = { items: [{ id: "pizza", qty: 2 }], coupon: "", address, paymentMethod: "cod", idempotencyKey: randomUUID(), ...extra };
  const quote = await request<Quote>("/orders/quote", "POST", { ...body, zoneId: address.zoneId });
  assert.equal(quote.status, 200, JSON.stringify(quote.data));
  return request<{ order: Order }>("/orders", "POST", { ...body, expectedTotal: quote.data.total });
}

test("saved addresses and favourites are persistent and private to each account", async () => {
  assert.equal((await request("/customer", "GET", undefined, "")).status, 401);
  const result = await request<CustomerProfile>("/customer/addresses", "POST", { ...address, label: "Home" });
  assert.equal(result.status, 200);
  const id = result.data.addresses[0].id;
  assert.equal((await request<CustomerProfile>("/customer", "GET", undefined, other)).data.addresses.length, 0);
  assert.equal((await request("/customer/addresses", "POST", { ...address, id, label: "Stolen" }, other)).status, 404);
  await request(`/customer/addresses/${id}`, "DELETE", undefined, other);
  assert.equal((await request<CustomerProfile>("/customer")).data.addresses.length, 1);
  await request("/customer/addresses", "POST", { ...address, id, label: "Office" });
  assert.equal((await request<CustomerProfile>("/customer")).data.addresses[0].label, "Office");
  assert.equal((await request("/customer/addresses", "POST", { ...address, zoneId: "unknown", label: "Invalid" })).status, 400);
  await request("/customer/favourites/pizza", "PUT", { saved: true });
  await request("/customer/favourites/pizza", "PUT", { saved: true });
  assert.deepEqual((await request<CustomerProfile>("/customer")).data.favourites, ["pizza"]);
  assert.deepEqual((await request<CustomerProfile>("/customer", "GET", undefined, other)).data.favourites, []);
  await request("/customer/favourites/pizza", "PUT", { saved: false });
  assert.equal((await request("/customer/favourites/missing", "PUT", { saved: true })).status, 404);
});

test("combos charge their bundle price, aggregate shared stock and restore original components once", async () => {
  const before = getProducts();
  const quote = await request<Quote>("/orders/quote", "POST", { items: [{ id: "pizza-combo", qty: 1 }], zoneId: "dhanmondi" });
  assert.equal(quote.data.subtotal, 840);
  const created = await create({ items: [{ id: "pizza-combo", qty: 1 }, { id: "pizza", qty: 1 }] });
  assert.equal(created.status, 201);
  const stock = (id: string) => getProducts().find(p => p.id === id)!.stock;
  assert.equal(stock("pizza"), before.find(p => p.id === "pizza")!.stock - 2);
  assert.equal(stock("lemon-drink"), before.find(p => p.id === "lemon-drink")!.stock - 2);
  const combo = getProducts().find(p => p.id === "pizza-combo")!;
  saveProduct({ ...combo, bundle: [{ id: "burger", qty: 1 }] });
  changeOrderStatus(created.data.order.id, "cancelled");
  changeOrderStatus(created.data.order.id, "cancelled");
  assert.equal(stock("pizza"), before.find(p => p.id === "pizza")!.stock);
  assert.equal(stock("lemon-drink"), before.find(p => p.id === "lemon-drink")!.stock);
  saveProduct(combo);
  const pizza = getProducts().find(p => p.id === "pizza")!;
  saveProduct({ ...pizza, stock: 1 });
  const denied = await request("/orders/quote", "POST", { items: [{ id: "pizza-combo", qty: 1 }, { id: "pizza", qty: 1 }], zoneId: "dhanmondi" });
  assert.equal(denied.status, 400);
  saveProduct(pizza);
});

test("admin cannot add duplicate components that overstate combo availability", async () => {
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
  try {
    const response = await request("/admin/products/pizza-combo", "PATCH", {
      bundle: [{ id: "pizza", qty: 1 }, { id: "pizza", qty: 2 }],
    });
    assert.equal(response.status, 400);
    assert.match(String(response.data.error), /must appear once/);
    assert.equal(getProducts().find(p => p.id === "pizza-combo")!.bundle!.length, 3);
  } finally {
    db.prepare("UPDATE users SET role = 'customer' WHERE id = ?").run(user.id);
  }
});

test("pickup requires a real branch, has no delivery fee, and scheduling enforces time and opening hours", async () => {
  assert.equal((await request("/orders/quote", "POST", { items: [{ id: "pizza", qty: 1 }], zoneId: "pickup" })).status, 400);
  assert.equal((await request("/orders/quote", "POST", { items: [{ id: "pizza", qty: 1 }], zoneId: "dhanmondi", fulfillment: "pickup" })).status, 400);
  process.env.SHOP_BRANCHES = JSON.stringify([{ id: "main", name: "Test kitchen", address: "12 Test Road, Dhaka", opens: "10:00", closes: "22:00", days: [0,1,2,3,4,5,6], timeZone: "Asia/Dhaka", pickup: true }]);
  const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0,10);
  const scheduledAt = new Date(`${tomorrow}T12:00:00+06:00`).toISOString();
  const result = await create({ fulfillment: "pickup", branchId: "main", scheduledAt, address: { ...address, street: "" } });
  assert.equal(result.status, 201);
  assert.equal(result.data.order.deliveryFee, 0);
  assert.equal(result.data.order.scheduledAt, scheduledAt);
  assert.equal(result.data.order.address.street, "12 Test Road, Dhaka");
  assert.throws(() => changeOrderStatus(result.data.order.id, "preparing"), /30 minutes/);
  for (const time of [new Date().toISOString(), new Date(Date.now() + 9*86_400_000).toISOString(), new Date(`${tomorrow}T02:00:00+06:00`).toISOString()]) {
    assert.equal((await request("/orders/quote", "POST", { items: [{ id: "pizza", qty: 1 }], zoneId: "dhanmondi", scheduledAt: time })).status, 400);
  }
  changeOrderStatus(result.data.order.id, "cancelled");
  delete process.env.SHOP_BRANCHES;
});

test("loyalty earnings, redemption and cancellation are transactional and idempotent", async () => {
  const completed = await create();
  for (const status of ["preparing", "out_for_delivery", "delivered"] as const) changeOrderStatus(completed.data.order.id, status);
  changeOrderStatus(completed.data.order.id, "delivered");
  const earned = (await request<CustomerProfile>("/customer")).data.points;
  assert.equal(earned, 54);
  const idempotencyKey = randomUUID();
  const redeemed = await create({ redeemPoints: 30, idempotencyKey });
  assert.equal(redeemed.status, 201);
  assert.equal(redeemed.data.order.total, 1110);
  assert.equal((await request<CustomerProfile>("/customer")).data.points, 24);
  const retry = await request<{ order: Order }>("/orders", "POST", { items: [{ id: "pizza", qty: 2 }], address, paymentMethod: "cod", expectedTotal: 1110, redeemPoints: 30, idempotencyKey });
  assert.equal(retry.status, 200);
  assert.equal(retry.data.order.id, redeemed.data.order.id);
  assert.equal((await request<CustomerProfile>("/customer")).data.points, 24);
  assert.equal((await request("/orders/quote", "POST", { items: [{ id: "pizza", qty: 1 }], zoneId: "dhanmondi", redeemPoints: 25 })).status, 400);
  changeOrderStatus(redeemed.data.order.id, "cancelled");
  changeOrderStatus(redeemed.data.order.id, "cancelled");
  assert.equal((await request<CustomerProfile>("/customer")).data.points, earned);
  assert.equal((await request("/orders/quote", "POST", { items: [{ id: "lemon-drink", qty: 1 }], zoneId: "dhanmondi", redeemPoints: 25 })).status, 400);
});

test("notifications stay private and retry delivery with a stable idempotency key", async () => {
  assert.equal((await request("/customer/preferences", "PUT", { email: true, sms: true, phone: "" })).status, 400);
  await request("/customer/preferences", "PUT", { email: false, sms: true, phone: address.phone });
  process.env.SMS_WEBHOOK_URL = "http://127.0.0.1/notifications";
  process.env.NOTIFICATION_WEBHOOK_TOKEN = "test-secret";
  const created = await create();
  changeOrderStatus(created.data.order.id, "preparing");
  changeOrderStatus(created.data.order.id, "preparing");
  const own = (await request<CustomerProfile>("/customer")).data.notifications.filter(n => n.orderId === created.data.order.id);
  assert.equal(own.length, 2);
  assert.equal((await request<CustomerProfile>("/customer", "GET", undefined, other)).data.notifications.length, 0);
  await request("/customer/notifications/read", "POST");
  assert.ok((await request<CustomerProfile>("/customer")).data.notifications.every(n => n.read));
  const original = globalThis.fetch;
  const keys: string[] = [];
  globalThis.fetch = async (_input, init) => { keys.push((init!.headers as Record<string,string>)["Idempotency-Key"]); return new Response("", { status: 503 }); };
  try {
    await flushNotifications();
    assert.equal(Number(db.prepare("SELECT attempts FROM outbox WHERE id = ?").get(keys[0])!.attempts), 1);
    db.prepare("UPDATE outbox SET next_attempt = 0").run();
    globalThis.fetch = async (_input, init) => { const headers = init!.headers as Record<string,string>; assert.ok(keys.includes(headers["Idempotency-Key"])); assert.equal(headers.Authorization, "Bearer test-secret"); return new Response("", { status: 200 }); };
    await flushNotifications();
    assert.equal(Number(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE sent = 0").get()!.n), 0);
  } finally { globalThis.fetch = original; }
  changeOrderStatus(created.data.order.id, "cancelled");
});

test("verification and reset links expire, are single-use and invalidate sessions after a reset", async () => {
  assert.equal((await request("/recovery/forgot", "POST", { email: user.email })).status, 503);
  process.env.EMAIL_WEBHOOK_URL = "http://127.0.0.1/email";
  process.env.NOTIFICATION_WEBHOOK_TOKEN = "test-secret";
  await request("/recovery/request-verification", "POST");
  function latestToken() {
    const row = db.prepare("SELECT payload FROM outbox WHERE channel = 'email' ORDER BY rowid DESC LIMIT 1").get()!;
    return (JSON.parse(String(row.payload)).text as string).match(/#([a-f0-9]{64})/)![1];
  }
  const verification = latestToken();
  assert.equal((await request("/recovery/complete", "POST", { kind: "verify", token: verification })).status, 200);
  assert.equal((await request<CustomerProfile>("/customer")).data.emailVerified, true);
  assert.equal((await request("/recovery/complete", "POST", { kind: "verify", token: verification })).status, 400);
  const known = await request("/recovery/forgot", "POST", { email: user.email });
  const unknown = await request("/recovery/forgot", "POST", { email: "nobody@example.test" });
  assert.deepEqual(known.data, unknown.data);
  const expired = latestToken();
  db.prepare("UPDATE auth_tokens SET expires = 0 WHERE kind = 'reset'").run();
  assert.equal((await request("/recovery/complete", "POST", { kind: "reset", token: expired, password: "new-password-123" })).status, 400);
  await request("/recovery/forgot", "POST", { email: user.email });
  const token = latestToken();
  assert.equal((await request("/recovery/complete", "POST", { kind: "reset", token, password: "new-password-123" })).status, 200);
  assert.equal((await request("/customer")).status, 401);
  assert.equal((await request("/recovery/complete", "POST", { kind: "reset", token, password: "another-password" })).status, 400);
  const login = await request("/auth/login", "POST", { email: user.email, password: "new-password-123" });
  assert.equal(login.status, 200);
  cookie = login.cookie;
});
