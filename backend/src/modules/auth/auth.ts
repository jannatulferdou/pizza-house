import { Router, type RequestHandler } from "express";
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { db } from "../../lib/database.js";
import { HttpError } from "../../lib/errors.js";
import type { User } from "@pizza-house/shared/types";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
const derive = promisify(scrypt);
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const sessionDays = 7;
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(10, "Use at least 10 characters for your password.")
    .max(128),
});
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${((await derive(password, salt, 64)) as Buffer).toString("hex")}`;
}
async function matches(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const actual = (await derive(password, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
function cookieToken(header?: string) {
  return (
    header
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("ph_session="))
      ?.slice(11) ?? ""
  );
}
export const sessionMiddleware: RequestHandler = (req, _res, next) => {
  const token = cookieToken(req.headers.cookie);
  if (token) {
    const row = db
      .prepare(
        "SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires > ?",
      )
      .get(digest(token), Date.now());
    if (row) req.user = row as unknown as User;
  }
  next();
};
export const requireUser: RequestHandler = (req, _res, next) =>
  req.user ? next() : next(new HttpError(401, "Please sign in to continue."));
export const requireAdmin: RequestHandler = (req, _res, next) =>
  req.user?.role === "admin"
    ? next()
    : next(new HttpError(403, "Administrator access required."));
export const authRouter = Router();
authRouter.use(
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again in 15 minutes." },
  }),
);
authRouter.get("/me", (req, res) => res.json({ user: req.user ?? null }));
function createSession(user: User, res: import("express").Response) {
  db.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(
    digest(token),
    user.id,
    Date.now() + sessionDays * 86_400_000,
  );
  res.cookie("ph_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionDays * 86_400_000,
    path: "/",
  });
  res.json({ user });
}
authRouter.post("/register", async (req, res) => {
  const input = credentials
    .extend({ name: z.string().trim().min(2).max(80) })
    .parse(req.body);
  const password = await hashPassword(input.password);
  // Check after the asynchronous hash so simultaneous requests cannot race the unique constraint.
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(input.email))
    throw new HttpError(409, "An account with this email already exists.");
  const user: User = {
    id: randomUUID(),
    name: input.name,
    email: input.email,
    role: "customer",
  };
  db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)").run(
    user.id,
    user.name,
    user.email,
    password,
    user.role,
  );
  createSession(user, res);
});
authRouter.post("/login", async (req, res) => {
  const input = credentials.parse(req.body);
  const row = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(input.email) as (User & { password: string }) | undefined;
  // Perform the same expensive operation for unknown emails.
  const valid = await matches(
    input.password,
    row?.password ?? `${"0".repeat(32)}:${"0".repeat(128)}`,
  );
  if (!row || !valid)
    throw new HttpError(401, "Email or password is incorrect.");
  createSession(
    { id: row.id, name: row.name, email: row.email, role: row.role },
    res,
  );
});
authRouter.post("/logout", (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(
    digest(cookieToken(req.headers.cookie)),
  );
  res.clearCookie("ph_session", { path: "/" }).json({ ok: true });
});
export async function bootstrapAdmin() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
  const input = credentials.parse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(input.email))
    return;
  db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)").run(
    randomUUID(),
    "House manager",
    input.email,
    await hashPassword(input.password),
    "admin",
  );
}
