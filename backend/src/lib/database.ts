import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedProducts } from "../modules/products/seed.js";
import { additionalDrinks } from "../modules/products/drinks.js";
import type { Coupon, Order, Product, Review } from "@pizza-house/shared/types";

// Keep the original repository-level database when running source or built JS.
const path = process.env.DATABASE_PATH || fileURLToPath(new URL("../../../data/pizza-house.sqlite", import.meta.url));
if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
export const db = new DatabaseSync(path);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer');
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS coupons (code TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), request_key TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(user_id, request_key));
  CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), user_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL, UNIQUE(product_id, user_id));
  CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS reviews_product ON reviews(product_id);
  CREATE TABLE IF NOT EXISTS customer_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id), data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS loyalty (event TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), amount INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS auth_tokens (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS verified_emails (user_id TEXT PRIMARY KEY REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), order_id TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, channel TEXT NOT NULL, payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0);
`);
if (!db.prepare("SELECT id FROM products LIMIT 1").get()) {
  for (const product of seedProducts)
    db.prepare("INSERT INTO products VALUES (?, ?)").run(
      product.id,
      JSON.stringify(product),
    );
  const offer: Coupon = {
    code: "HOUSE10",
    percent: 10,
    minimum: 800,
    active: true,
  };
  db.prepare("INSERT OR IGNORE INTO coupons VALUES (?, ?)").run(
    offer.code,
    JSON.stringify(offer),
  );
}
// Add new demo products once, also for databases created before combos existed.
const extras: Product[] = [
  { id: "lemon-drink", name: "Lemon cooler", category: "Drinks", description: "A refreshing lemon drink, served chilled.", price: 120, ingredients: "Water, lemon juice, sugar", serving: "330 ml", diet: "Plant based", image: "/images/lemon-cooler.jpg", allergens: "Prepared in a shared kitchen", storage: "Keep chilled", shelfLife: "Consume on the day of delivery", stock: 50, active: true, rating: 0, reviewCount: 0 },
  { id: "pizza-combo", name: "Pizza night combo", category: "Combos", description: "A house margherita, golden fries and two lemon coolers. Bundle price: BDT 840.", price: 840, ingredients: "House margherita, fries, 2 lemon coolers", serving: "Serves 2", diet: "Vegetarian", image: "/images/pizza-pizza.jpg", allergens: "Contains wheat and dairy; shared kitchen", storage: "Enjoy hot; keep drinks chilled", shelfLife: "Consume on the day of delivery", stock: 0, active: true, rating: 0, reviewCount: 0, bundle: [{ id: "pizza", qty: 1 }, { id: "fries", qty: 1 }, { id: "lemon-drink", qty: 2 }] },
];
db.exec("CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY)");
if (!db.prepare("SELECT id FROM migrations WHERE id = 'customer-extras-v1'").get()) {
  transaction(() => {
    for (const product of extras) db.prepare("INSERT OR IGNORE INTO products VALUES (?,?)").run(product.id, JSON.stringify(product));
    db.prepare("INSERT INTO migrations VALUES ('customer-extras-v1')").run();
  });
}
// Upgrade the original illustration without overwriting merchant-selected images.
if (!db.prepare("SELECT id FROM migrations WHERE id = 'lemon-cooler-photo-v1'").get()) {
  transaction(() => {
    db.prepare(
      "UPDATE products SET data = json_set(data, '$.image', ?) WHERE id = ? AND json_extract(data, '$.image') = ?",
    ).run("/images/lemon-cooler.jpg", "lemon-drink", "/images/lemon-cooler.svg");
    db.prepare("INSERT INTO migrations VALUES ('lemon-cooler-photo-v1')").run();
  });
}
if (!db.prepare("SELECT id FROM migrations WHERE id = 'soft-drinks-v1'").get()) {
  transaction(() => {
    const insert = db.prepare("INSERT OR IGNORE INTO products VALUES (?, ?)");
    for (const product of additionalDrinks)
      insert.run(product.id, JSON.stringify(product));
    db.prepare("INSERT INTO migrations VALUES ('soft-drinks-v1')").run();
  });
}
export function transaction<T>(work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function getProducts(): Product[] {
  const products = db
    .prepare("SELECT data FROM products")
    .all()
    .map((row) => JSON.parse(String(row.data)) as Product);
  const reviews = getReviews();
  return products.map((p) => {
    const ratings = reviews.filter((r) => r.productId === p.id);
    return {
      ...p,
      ...(p.bundle?.length ? { stock: Math.min(...p.bundle.map(part => {
        const component = products.find(product => product.id === part.id && product.active && !product.bundle?.length);
        return component ? Math.floor(component.stock / part.qty) : 0;
      })) } : {}),
      reviewCount: ratings.length,
      rating: ratings.length
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0,
    };
  });
}
export function saveProduct(product: Product) {
  db.prepare(
    "INSERT INTO products VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
  ).run(product.id, JSON.stringify(product));
}
export function getCoupons(): Coupon[] {
  return db
    .prepare("SELECT data FROM coupons")
    .all()
    .map((row) => JSON.parse(String(row.data)) as Coupon);
}
export function getReviews(): Review[] {
  return db
    .prepare("SELECT data FROM reviews ORDER BY rowid DESC")
    .all()
    .map((row) => JSON.parse(String(row.data)) as Review);
}
export function getOrders(userId?: string): Order[] {
  const rows = userId
    ? db
        .prepare(
          "SELECT data FROM orders WHERE user_id = ? ORDER BY rowid DESC",
        )
        .all(userId)
    : db.prepare("SELECT data FROM orders ORDER BY rowid DESC").all();
  return rows.map((row) => JSON.parse(String(row.data)) as Order);
}
export function getOrder(id: string): Order | undefined {
  const row = db.prepare("SELECT data FROM orders WHERE id = ?").get(id);
  return row ? (JSON.parse(String(row.data)) as Order) : undefined;
}
export function saveOrder(order: Order) {
  const previous = getOrder(order.id);
  db.prepare("UPDATE orders SET data = ? WHERE id = ?").run(
    JSON.stringify(order),
    order.id,
  );
  if (previous?.status !== order.status) recordOrderNotification(order);
}

export function recordOrderNotification(order: Order) {
  const id = `${order.id}:${order.status}`;
  const status = order.fulfillment === "pickup" && order.status === "out_for_delivery" ? "ready for pickup" : order.status.replaceAll("_", " ");
  const message = `Order ${order.id}: ${status}.`;
  const inserted = db.prepare("INSERT OR IGNORE INTO notifications (id,user_id,order_id,message,created_at) VALUES (?,?,?,?,?)").run(id, order.userId, order.id, message, new Date().toISOString());
  if (!inserted.changes) return;
  const row = db.prepare("SELECT data FROM customer_profiles WHERE user_id = ?").get(order.userId);
  const preferences = row ? JSON.parse(String(row.data)).preferences : {};
  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(order.userId)!;
  for (const channel of ["email", "sms"] as const) {
    if (!preferences?.[channel]) continue;
    const to = channel === "email" ? String(user.email) : preferences.phone;
    if (channel === "email" && !db.prepare("SELECT user_id FROM verified_emails WHERE user_id = ?").get(order.userId)) continue;
    if (!to) continue;
    db.prepare("INSERT OR IGNORE INTO outbox (id,channel,payload) VALUES (?,?,?)").run(`${id}:${channel}`, channel, JSON.stringify({ to, expiresAt: Date.now() + 86_400_000, subject: "Pizza House order update", text: message, orderId: order.id }));
  }
}
