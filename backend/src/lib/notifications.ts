import { db } from "./database.js";

export function deliveryEnabled(channel: "email" | "sms") {
  if (!process.env.NOTIFICATION_WEBHOOK_TOKEN) return false;
  try {
    const url = new URL(process.env[`${channel.toUpperCase()}_WEBHOOK_URL`] || "");
    return url.protocol === "https:" || (process.env.NODE_ENV === "test" && url.protocol === "http:" && url.hostname === "127.0.0.1");
  } catch { return false; }
}
let running = false;
/** Persistent, at-least-once delivery. The receiver must deduplicate Idempotency-Key. */
export async function flushNotifications() {
  if (running) return;
  running = true;
  try {
    db.prepare("DELETE FROM auth_tokens WHERE expires <= ?").run(Date.now());
    const rows = db.prepare("SELECT * FROM outbox WHERE sent = 0 AND attempts < 8 AND next_attempt <= ? ORDER BY rowid LIMIT 20").all(Date.now());
    for (const row of rows) {
      const payload = JSON.parse(String(row.payload));
      if (payload.expiresAt && payload.expiresAt <= Date.now()) {
        db.prepare("UPDATE outbox SET sent = 1, payload = '{}' WHERE id = ?").run(row.id);
        continue;
      }
      const channel = String(row.channel) as "email" | "sms";
      if (!deliveryEnabled(channel)) continue;
      const url = new URL(process.env[`${channel.toUpperCase()}_WEBHOOK_URL`]!);
      if (url.protocol !== "https:" && !(process.env.NODE_ENV === "test" && url.hostname === "127.0.0.1")) continue;
      try {
        const response = await fetch(url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000), headers: {
          "Content-Type": "application/json", Authorization: `Bearer ${process.env.NOTIFICATION_WEBHOOK_TOKEN}`, "Idempotency-Key": String(row.id),
        }, body: JSON.stringify({ id: row.id, channel, ...payload }) });
        if (!response.ok) throw new Error("Notification delivery failed");
        db.prepare("UPDATE outbox SET sent = 1, payload = '{}' WHERE id = ?").run(row.id);
      } catch {
        db.prepare("UPDATE outbox SET attempts = attempts + 1, next_attempt = ? WHERE id = ?").run(Date.now() + Math.min(3600_000, 30_000 * 2 ** Number(row.attempts)), row.id);
      }
    }
  } finally { running = false; }
}
