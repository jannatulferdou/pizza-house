import { Router } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { db, transaction } from "../../lib/database";
import { HttpError } from "../../lib/errors";
import { deliveryEnabled } from "../../lib/notifications";
import { hashPassword, requireUser } from "./auth";
import { publicOrigin } from "../payments/gateway";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function issue(userId: string, email: string, kind: "reset" | "verify") {
  const token = randomBytes(32).toString("hex");
  transaction(() => {
    db.prepare("DELETE FROM auth_tokens WHERE user_id = ? AND kind = ?").run(userId, kind);
    db.prepare("INSERT INTO auth_tokens VALUES (?,?,?,?)").run(digest(token), userId, kind, Date.now() + 30 * 60_000);
    const url = `${publicOrigin()}/recover?kind=${kind}#${token}`;
    db.prepare("INSERT INTO outbox (id,channel,payload) VALUES (?,'email',?)").run(randomUUID(), JSON.stringify({ to: email, expiresAt: Date.now() + 30 * 60_000, subject: kind === "reset" ? "Reset your Pizza House password" : "Verify your Pizza House email", text: `Open ${url}\nThis link expires in 30 minutes. If you did not request this, ignore it.` }));
  });
}
export const recoveryRouter = Router();
recoveryRouter.use(rateLimit({ windowMs: 15 * 60_000, limit: 15, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many requests. Try again in 15 minutes." } }));
recoveryRouter.post("/forgot", (req, res) => {
  const { email } = z.object({ email: z.email().max(254).transform(v => v.toLowerCase().trim()) }).parse(req.body);
  if (!deliveryEnabled("email")) throw new HttpError(503, "Email delivery is not configured. Please contact the shop.");
  const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (row) issue(String(row.id), email, "reset");
  res.json({ message: "If this email has an account, a reset link will arrive shortly." });
});
recoveryRouter.post("/request-verification", requireUser, (req, res) => {
  if (!deliveryEnabled("email")) throw new HttpError(503, "Email delivery is not configured. Please contact the shop.");
  issue(req.user!.id, req.user!.email, "verify");
  res.json({ message: "Verification link queued. Check your email." });
});
recoveryRouter.post("/complete", async (req, res) => {
  const input = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), kind: z.enum(["reset", "verify"]), password: z.string().min(10).max(128).optional() }).parse(req.body);
  if (input.kind === "reset" && !input.password) throw new HttpError(400, "A new password is required.");
  const hash = digest(input.token);
  const password = input.kind === "reset" ? await hashPassword(input.password!) : "";
  transaction(() => {
    const row = db.prepare("SELECT * FROM auth_tokens WHERE hash = ? AND kind = ? AND expires > ?").get(hash, input.kind, Date.now());
    if (!row) throw new HttpError(400, "This link has expired or already been used. Request a new one.");
    if (input.kind === "reset") {
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(password, row.user_id);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.user_id);
    } else db.prepare("INSERT OR IGNORE INTO verified_emails VALUES (?)").run(row.user_id);
    db.prepare("DELETE FROM auth_tokens WHERE user_id = ? AND kind = ?").run(row.user_id, input.kind);
  });
  if (input.kind === "reset") res.clearCookie("ph_session", { path: "/" });
  res.json({ message: input.kind === "reset" ? "Password updated. Please sign in again." : "Email verified." });
});
