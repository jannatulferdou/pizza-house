import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { Address, Order, Product, Quote, User } from "@pizza-house/shared/types";

// Every run uses a fresh in-memory database, never the shop's local data.
process.env.DATABASE_PATH = ":memory:";
process.env.NODE_ENV = "test";
process.env.ADMIN_EMAIL = "manager@example.test";
process.env.ADMIN_PASSWORD = "local-test-manager-password";
delete process.env.SSLCOMMERZ_STORE_ID;
delete process.env.SSLCOMMERZ_STORE_PASSWORD;
const { app } = await import("../app.js");
const { bootstrapAdmin } = await import("../modules/auth/auth.js");
const { db, getProducts, getOrder, getOrders } =
  await import("../lib/database.js");
const { createOrder, changeOrderStatus } =
  await import("../modules/orders/service.js");
const { acceptValidatedPayment } = await import("../modules/payments/gateway.js");
let server: Server,
  base: string,
  customerCookie: string,
  otherCookie: string,
  adminCookie: string,
  customer: User;
const address: Address = {
  name: "Test Customer",
  phone: "01712345678",
  street: "House 12, Road 4, Dhanmondi",
  zoneId: "dhanmondi",
  notes: "",
};
async function request<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = "",
  headers: Record<string, string> = {},
) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  return {
    response,
    data: (await response.json()) as T,
    cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
before(async () => {
  await bootstrapAdmin();
  server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const port = (server.address() as { port: number }).port;
  base = `http://127.0.0.1:${port}`;
  const signup = await request<{ user: User }>("/auth/register", "POST", {
    name: "Test Customer",
    email: "buyer@example.test",
    password: "customer-password-123",
    role: "admin",
  });
  assert.equal(signup.response.status, 200);
  customerCookie = signup.cookie;
  customer = signup.data.user;
  assert.equal(customer.role, "customer");
  otherCookie = (
    await request("/auth/register", "POST", {
      name: "Other Customer",
      email: "other@example.test",
      password: "customer-password-456",
    })
  ).cookie;
  adminCookie = (
    await request("/auth/login", "POST", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
  ).cookie;
});
after(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  db.close();
});

test("sessions are HTTP-only; customers cannot grant themselves admin or read admin data", async () => {
  const login = await request("/auth/login", "POST", {
    email: "buyer@example.test",
    password: "customer-password-123",
  });
  assert.match(login.response.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(login.response.headers.get("set-cookie")!, /SameSite=Lax/);
  assert.equal(
    (await request("/admin", "GET", undefined, customerCookie)).response.status,
    403,
  );
  assert.equal((await request("/orders")).response.status, 401);
  assert.equal(
    (
      await request("/auth/login", "POST", {
        email: "buyer@example.test",
        password: "wrong-password-123",
      })
    ).response.status,
    401,
  );
  const me = await request<{ user: User }>(
    "/auth/me",
    "GET",
    undefined,
    customerCookie,
  );
  assert.deepEqual(Object.keys(me.data.user).sort(), [
    "email",
    "id",
    "name",
    "role",
  ]);
});
test("cross-site writes are rejected before authentication", async () => {
  const result = await request("/orders", "POST", {}, customerCookie, {
    Origin: "https://attacker.example",
  });
  assert.equal(result.response.status, 403);
});
test("quote uses server prices, aggregates duplicate lines, and applies coupons and delivery", async () => {
  const result = await request<Quote>(
    "/orders/quote",
    "POST",
    {
      items: [
        { id: "pizza", qty: 1, price: 1 },
        { id: "pizza", qty: 1 },
      ],
      zoneId: "dhanmondi",
      coupon: "house10",
    },
    customerCookie,
  );
  assert.equal(result.response.status, 200);
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.subtotal, 1080);
  assert.equal(result.data.discount, 108);
  assert.equal(result.data.total, 1032);
  for (const input of [
    { items: [{ id: "pizza", qty: -1 }], zoneId: "dhanmondi" },
    { items: [{ id: "pizza", qty: 1 }], zoneId: "unknown" },
    {
      items: [{ id: "pizza", qty: 1 }],
      zoneId: "dhanmondi",
      coupon: "HOUSE10",
    },
    {
      items: [{ id: "pizza", qty: 1 }],
      zoneId: "dhanmondi",
      coupon: "INVALID",
    },
    {
      items: [
        { id: "pizza", qty: 20 },
        { id: "pizza", qty: 20 },
      ],
      zoneId: "dhanmondi",
    },
  ])
    assert.equal(
      (await request("/orders/quote", "POST", input, customerCookie)).response
        .status,
      400,
    );
});
test("customized quotes canonicalize toppings, preserve variants and ignore client prices", async () => {
  const result = await request<Quote>(
    "/orders/quote",
    "POST",
    {
      items: [
        { id: "pizza", qty: 1 },
        {
          id: "pizza",
          qty: 1,
          options: {
            size: "large",
            crust: "cheese",
            toppings: ["olives", "mozzarella"],
          },
          price: 1,
        },
        {
          id: "pizza",
          qty: 2,
          options: {
            size: "large",
            crust: "cheese",
            toppings: ["mozzarella", "olives"],
          },
        },
      ],
      zoneId: "dhanmondi",
    },
    customerCookie,
  );
  assert.equal(result.response.status, 200);
  assert.equal(result.data.items.length, 2);
  assert.equal(result.data.items[1].price, 920);
  assert.equal(result.data.items[1].qty, 3);
  assert.deepEqual(result.data.items[1].options?.toppings, [
    "mozzarella",
    "olives",
  ]);
  assert.match(
    result.data.items[1].name,
    /14-inch.*Cheese-stuffed.*Black olives/,
  );
  assert.equal(result.data.total, 3360);
  for (const item of [
    {
      id: "pizza",
      qty: 1,
      options: { size: "huge", crust: "classic", toppings: [] },
    },
    {
      id: "pizza",
      qty: 1,
      options: { size: "regular", crust: "classic", toppings: ["truffle"] },
    },
    {
      id: "pizza",
      qty: 1,
      options: {
        size: "regular",
        crust: "classic",
        toppings: ["olives", "olives"],
      },
    },
    {
      id: "burger",
      qty: 1,
      options: { size: "large", crust: "cheese", toppings: [] },
    },
  ])
    assert.equal(
      (
        await request(
          "/orders/quote",
          "POST",
          { items: [item], zoneId: "dhanmondi" },
          customerCookie,
        )
      ).response.status,
      400,
    );
  const stock = getProducts().find((p) => p.id === "pizza")!.stock;
  assert.equal(
    (
      await request(
        "/orders/quote",
        "POST",
        {
          items: [
            { id: "pizza", qty: stock },
            {
              id: "pizza",
              qty: 1,
              options: { size: "large", crust: "classic", toppings: [] },
            },
          ],
          zoneId: "dhanmondi",
        },
        customerCookie,
      )
    ).response.status,
    400,
  );
});

test("customized orders persist choices, reserve shared stock and restore it once on cancellation", async () => {
  const stock = getProducts().find((p) => p.id === "pizza")!.stock;
  const input = {
    items: [
      { id: "pizza", qty: 1 },
      {
        id: "pizza",
        qty: 2,
        options: { size: "large", crust: "cheese", toppings: ["olives"] },
      },
    ],
    address,
    paymentMethod: "cod",
    idempotencyKey: randomUUID(),
    expectedTotal: 2300,
  };
  const first = await request<{ order: Order }>(
    "/orders",
    "POST",
    input,
    customerCookie,
  );
  assert.equal(first.response.status, 201);
  assert.equal(first.data.order.items[1].price, 850);
  assert.equal(first.data.order.items[1].options?.crust, "cheese");
  assert.equal(getProducts().find((p) => p.id === "pizza")!.stock, stock - 3);
  const retry = await request<{ order: Order }>(
    "/orders",
    "POST",
    input,
    customerCookie,
  );
  assert.equal(retry.data.order.id, first.data.order.id);
  assert.equal(getProducts().find((p) => p.id === "pizza")!.stock, stock - 3);
  changeOrderStatus(first.data.order.id, "cancelled");
  changeOrderStatus(first.data.order.id, "cancelled");
  assert.equal(getProducts().find((p) => p.id === "pizza")!.stock, stock);
  const invalidTotal = await request(
    "/orders",
    "POST",
    { ...input, idempotencyKey: randomUUID(), expectedTotal: 600 },
    customerCookie,
  );
  assert.equal(invalidTotal.response.status, 409);
  assert.equal(getProducts().find((p) => p.id === "pizza")!.stock, stock);
});

test("COD checkout reserves stock once and duplicate retries return the same order", async () => {
  const stock = getProducts().find((p) => p.id === "pizza")!.stock;
  const input = {
    items: [{ id: "pizza", qty: 2 }],
    coupon: "HOUSE10",
    address,
    paymentMethod: "cod",
    idempotencyKey: randomUUID(),
    expectedTotal: 1032,
  };
  const first = await request<{ order: Order }>(
    "/orders",
    "POST",
    input,
    customerCookie,
  );
  const retry = await request<{ order: Order }>(
    "/orders",
    "POST",
    input,
    customerCookie,
  );
  assert.equal(first.response.status, 201);
  assert.equal(retry.response.status, 200);
  assert.equal(first.data.order.id, retry.data.order.id);
  assert.equal(first.data.order.status, "confirmed");
  assert.equal(first.data.order.paymentStatus, "unpaid");
  assert.equal(getProducts().find((p) => p.id === "pizza")!.stock, stock - 2);
  assert.equal(
    (
      await request(
        `/orders/${first.data.order.id}`,
        "GET",
        undefined,
        otherCookie,
      )
    ).response.status,
    404,
  );
  assert.equal(
    (
      await request(
        `/orders/${first.data.order.id}/cancel`,
        "POST",
        undefined,
        otherCookie,
      )
    ).response.status,
    404,
  );
  assert.equal(
    (
      await request(
        `/orders/${first.data.order.id}/cancel`,
        "POST",
        undefined,
        customerCookie,
      )
    ).response.status,
    200,
  );
  assert.equal(getProducts().find((p) => p.id === "pizza")!.stock, stock);
  assert.equal(
    (
      await request(
        `/orders/${first.data.order.id}/cancel`,
        "POST",
        undefined,
        customerCookie,
      )
    ).response.status,
    409,
  );
});
test("insufficient stock or a changed total cannot partially create an order", async () => {
  const stock = getProducts().find((p) => p.id === "pizza")!.stock,
    count = getOrders().length;
  const result = await request(
    "/orders",
    "POST",
    {
      items: [
        { id: "pizza", qty: 1 },
        { id: "fries", qty: 99 },
      ],
      coupon: "",
      address,
      paymentMethod: "cod",
      idempotencyKey: randomUUID(),
      expectedTotal: 1000,
    },
    customerCookie,
  );
  assert.equal(result.response.status, 400);
  assert.equal(getProducts().find((p) => p.id === "pizza")!.stock, stock);
  assert.equal(getOrders().length, count);
  const stale = await request(
    "/orders",
    "POST",
    {
      items: [{ id: "pizza", qty: 1 }],
      coupon: "",
      address,
      paymentMethod: "cod",
      idempotencyKey: randomUUID(),
      expectedTotal: 1,
    },
    customerCookie,
  );
  assert.equal(stale.response.status, 409);
  assert.equal(getOrders().length, count);
});
test("admin fulfillment validates transitions and only delivered buyers can review", async () => {
  const input = {
    items: [{ id: "burger", qty: 1 }],
    coupon: "",
    address,
    paymentMethod: "cod",
    idempotencyKey: randomUUID(),
    expectedTotal: 540,
  };
  const created = await request<{ order: Order }>(
    "/orders",
    "POST",
    input,
    customerCookie,
  );
  const id = created.data.order.id;
  const review = {
    rating: 5,
    comment: "The burger was delicious and arrived warm.",
  };
  assert.equal(
    (await request("/products/burger/reviews", "POST", review, customerCookie))
      .response.status,
    403,
  );
  assert.equal(
    (
      await request(
        `/admin/orders/${id}`,
        "PATCH",
        { status: "delivered" },
        adminCookie,
      )
    ).response.status,
    409,
  );
  assert.equal(
    (
      await request(
        `/admin/orders/${id}`,
        "PATCH",
        { status: "preparing" },
        customerCookie,
      )
    ).response.status,
    403,
  );
  for (const status of ["preparing", "out_for_delivery", "delivered"])
    assert.equal(
      (await request(`/admin/orders/${id}`, "PATCH", { status }, adminCookie))
        .response.status,
      200,
    );
  assert.equal(getOrder(id)!.paymentStatus, "paid");
  assert.equal(
    (await request("/products/burger/reviews", "POST", review, customerCookie))
      .response.status,
    201,
  );
  assert.equal(
    (
      await request(
        "/products/burger/reviews",
        "POST",
        { ...review, rating: 4 },
        customerCookie,
      )
    ).response.status,
    201,
  );
  const products = await request<Product[]>("/products");
  assert.equal(products.data.find((p) => p.id === "burger")!.reviewCount, 1);
  assert.equal(products.data.find((p) => p.id === "burger")!.rating, 4);
  const reviews = await request<Record<string, unknown>[]>(
    "/products/burger/reviews",
  );
  assert.equal("userId" in reviews.data[0], false);
});
test("online checkout stays disabled without merchant credentials", async () => {
  const result = await request(
    "/orders",
    "POST",
    {
      items: [{ id: "pizza", qty: 1 }],
      coupon: "",
      address,
      paymentMethod: "bkash",
      idempotencyKey: randomUUID(),
      expectedTotal: 600,
    },
    customerCookie,
  );
  assert.equal(result.response.status, 503);
});
test("verified online payments check amount, currency and risk; callbacks are idempotent", () => {
  const order = createOrder(
    {
      items: [{ id: "pizza", qty: 1 }],
      coupon: "",
      address,
      paymentMethod: "card",
      idempotencyKey: randomUUID(),
      expectedTotal: 600,
    },
    customer,
  ).order;
  const valid = {
    status: "VALID",
    tran_id: order.id,
    amount: 600,
    currency: "BDT",
    risk_level: "0",
  };
  assert.throws(
    () => acceptValidatedPayment({ ...valid, amount: 1 }),
    /verification/,
  );
  assert.throws(
    () => acceptValidatedPayment({ ...valid, currency: "USD" }),
    /verification/,
  );
  assert.throws(
    () => acceptValidatedPayment({ ...valid, status: "INVALID_TRANSACTION" }),
    /verification/,
  );
  assert.equal(getOrder(order.id)!.status, "pending_payment");
  assert.equal(acceptValidatedPayment(valid).status, "confirmed");
  assert.equal(
    acceptValidatedPayment({ ...valid, status: "VALIDATED" }).history.length,
    2,
  );
  const cancelled = changeOrderStatus(order.id, "cancelled");
  assert.equal(cancelled.paymentStatus, "refund_required");
  assert.equal(acceptValidatedPayment(valid).status, "cancelled");
});
test("high-risk payments cannot be fulfilled, and late payments require a refund", () => {
  const make = () =>
    createOrder(
      {
        items: [{ id: "fries", qty: 1 }],
        coupon: "",
        address,
        paymentMethod: "nagad",
        idempotencyKey: randomUUID(),
        expectedTotal: 240,
      },
      customer,
    ).order;
  const risky = make();
  assert.equal(
    acceptValidatedPayment({
      status: "VALID",
      tran_id: risky.id,
      amount: 240,
      currency: "BDT",
      risk_level: 1,
    }).paymentStatus,
    "review",
  );
  assert.throws(() => changeOrderStatus(risky.id, "preparing"));
  const late = make();
  changeOrderStatus(late.id, "cancelled");
  const stock = getProducts().find((p) => p.id === "fries")!.stock;
  const verified = acceptValidatedPayment({
    status: "VALID",
    tran_id: late.id,
    amount: 240,
    currency: "BDT",
    risk_level: 0,
  });
  assert.equal(verified.status, "cancelled");
  assert.equal(verified.paymentStatus, "refund_required");
  assert.equal(getProducts().find((p) => p.id === "fries")!.stock, stock);
});
test("admin can manage products and offers while invalid stock is rejected", async () => {
  assert.equal(
    (
      await request(
        "/admin/products/pizza",
        "PATCH",
        { stock: -1 },
        adminCookie,
      )
    ).response.status,
    400,
  );
  assert.equal(
    (
      await request(
        "/admin/products/pizza",
        "PATCH",
        { stock: 12 },
        customerCookie,
      )
    ).response.status,
    403,
  );
  assert.equal(
    (
      await request(
        "/admin/products/pizza",
        "PATCH",
        { stock: 12, active: false },
        adminCookie,
      )
    ).response.status,
    200,
  );
  assert.equal(
    (await request<Product[]>("/products")).data.some((p) => p.id === "pizza"),
    false,
  );
  assert.equal(
    (
      await request(
        "/admin/coupons",
        "PUT",
        { code: "TEST20", percent: 20, minimum: 100, active: true },
        adminCookie,
      )
    ).response.status,
    200,
  );
  assert.equal(
    (
      await request(
        "/admin/coupons",
        "PUT",
        { code: "TESTBAD", percent: 101, minimum: 0, active: true },
        adminCookie,
      )
    ).response.status,
    400,
  );
});
test("logout invalidates the server session", async () => {
  assert.equal(
    (await request("/auth/logout", "POST", undefined, otherCookie)).response
      .status,
    200,
  );
  assert.equal(
    (await request("/orders", "GET", undefined, otherCookie)).response.status,
    401,
  );
});

test("hosted checkout validates provider callbacks before confirming an online order", async () => {
  const originalFetch = globalThis.fetch;
  process.env.SSLCOMMERZ_STORE_ID = "test-merchant";
  process.env.SSLCOMMERZ_STORE_PASSWORD = "test-merchant-password";
  let transactionId = "";
  globalThis.fetch = async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (!url.hostname.endsWith("sslcommerz.com"))
      return originalFetch(input, options);
    if (url.pathname.endsWith("api.php")) {
      const body = options?.body as URLSearchParams;
      assert.equal(body.get("total_amount"), "240");
      assert.equal(body.get("currency"), "BDT");
      assert.match(body.get("ipn_url")!, /\/api\/payments\/ipn$/);
      transactionId = body.get("tran_id")!;
      return Response.json({
        status: "SUCCESS",
        GatewayPageURL: "https://sandbox.sslcommerz.com/EasyCheckOut/test",
      });
    }
    assert.equal(url.searchParams.get("store_id"), "test-merchant");
    return Response.json({
      status:
        url.searchParams.get("val_id") === "verified-id"
          ? "VALID"
          : "INVALID_TRANSACTION",
      tran_id: transactionId,
      amount: "240.00",
      currency: "BDT",
      risk_level: "0",
    });
  };
  try {
    const result = await request<{ order: Order; paymentUrl: string }>(
      "/orders",
      "POST",
      {
        items: [{ id: "fries", qty: 1 }],
        coupon: "",
        address,
        paymentMethod: "bkash",
        idempotencyKey: randomUUID(),
        expectedTotal: 240,
      },
      customerCookie,
    );
    assert.equal(result.response.status, 201);
    assert.equal(result.data.order.status, "pending_payment");
    assert.equal(
      result.data.paymentUrl,
      "https://sandbox.sslcommerz.com/EasyCheckOut/test",
    );
    assert.equal(
      (await request("/payments/ipn", "POST", { val_id: "forged-id" })).response
        .status,
      400,
    );
    assert.equal(getOrder(transactionId)!.status, "pending_payment");
    assert.equal(
      (await request("/payments/ipn", "POST", { val_id: "verified-id" }))
        .response.status,
      200,
    );
    assert.equal(getOrder(transactionId)!.paymentStatus, "paid");
    assert.equal(
      (await request("/payments/ipn", "POST", { val_id: "verified-id" }))
        .response.status,
      200,
    );
    assert.equal(getOrder(transactionId)!.history.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.SSLCOMMERZ_STORE_ID;
    delete process.env.SSLCOMMERZ_STORE_PASSWORD;
  }
});
