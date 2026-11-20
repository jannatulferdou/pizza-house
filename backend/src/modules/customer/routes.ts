import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, getProducts, transaction } from "../../lib/database.js";
import { requireUser } from "../auth/auth.js";
import { HttpError } from "../../lib/errors.js";
import type { CustomerProfile } from "@pizza-house/shared/types";

export const phoneSchema = z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/, "Enter a valid Bangladesh mobile number.");
export const addressSchema = z.object({ name: z.string().trim().min(2).max(80), phone: phoneSchema,
  street: z.string().trim().min(10).max(300), zoneId: z.enum(["dhanmondi", "gulshan", "mirpur", "uttara"]), notes: z.string().trim().max(500).default("") });
export function pointsBalance(userId: string) {
  return Number(db.prepare("SELECT COALESCE(SUM(amount),0) AS n FROM loyalty WHERE user_id = ?").get(userId)!.n);
}
export function profile(userId: string): CustomerProfile {
  const row = db.prepare("SELECT data FROM customer_profiles WHERE user_id = ?").get(userId);
  const stored = row ? JSON.parse(String(row.data)) : { addresses: [], favourites: [], preferences: { email: false, sms: false, phone: "" } };
  return { ...stored, points: pointsBalance(userId), emailVerified: Boolean(db.prepare("SELECT user_id FROM verified_emails WHERE user_id = ?").get(userId)),
    notifications: db.prepare("SELECT id, order_id AS orderId, message, created_at AS createdAt, read FROM notifications WHERE user_id = ? ORDER BY rowid DESC LIMIT 50").all(userId).map(n => ({ ...n, read: Boolean(n.read) })) };
}
function save(userId: string, value: CustomerProfile) {
  const { addresses, favourites, preferences } = value;
  db.prepare("INSERT INTO customer_profiles VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data").run(userId, JSON.stringify({ addresses, favourites, preferences }));
}
export const customerRouter = Router();
customerRouter.use(requireUser);
customerRouter.get("/", (req, res) => res.json(profile(req.user!.id)));
customerRouter.post("/addresses", (req, res) => {
  const input = addressSchema.extend({ label: z.string().trim().min(1).max(40), id: z.uuid().optional() }).parse(req.body);
  const value = profile(req.user!.id);
  if (input.id && !value.addresses.some(a => a.id === input.id)) throw new HttpError(404, "Address not found.");
  if (!input.id && value.addresses.length >= 10) throw new HttpError(400, "You can save up to 10 addresses.");
  const address = { ...input, id: input.id || randomUUID() };
  value.addresses = [...value.addresses.filter(a => a.id !== address.id), address];
  save(req.user!.id, value);
  res.json(profile(req.user!.id));
});
customerRouter.delete("/addresses/:id", (req, res) => {
  const value = profile(req.user!.id);
  value.addresses = value.addresses.filter(a => a.id !== req.params.id);
  save(req.user!.id, value); res.json(profile(req.user!.id));
});
customerRouter.put("/favourites/:id", (req, res) => {
  const { saved } = z.object({ saved: z.boolean() }).parse(req.body);
  const id = String(req.params.id);
  if (saved && !getProducts().some(p => p.id === id && p.active)) throw new HttpError(404, "Product not found.");
  const value = profile(req.user!.id);
  value.favourites = value.favourites.filter(p => p !== id);
  if (saved) {
    if (value.favourites.length >= 100) throw new HttpError(400, "You can save up to 100 favourites.");
    value.favourites.push(id);
  }
  save(req.user!.id, value); res.json(profile(req.user!.id));
});
customerRouter.put("/preferences", (req, res) => {
  const preferences = z.object({ email: z.boolean(), sms: z.boolean(), phone: z.union([z.literal(""), phoneSchema]) }).parse(req.body);
  if (preferences.sms && !preferences.phone) throw new HttpError(400, "Add a mobile number for SMS updates.");
  const value = profile(req.user!.id); value.preferences = preferences;
  save(req.user!.id, value); res.json(profile(req.user!.id));
});
customerRouter.post("/notifications/read", (req, res) => {
  transaction(() => db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(req.user!.id));
  res.json(profile(req.user!.id));
});
