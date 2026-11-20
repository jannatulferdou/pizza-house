import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { authRouter, sessionMiddleware } from "./modules/auth/auth.js";
import { productsRouter } from "./modules/products/routes.js";
import { ordersRouter } from "./modules/orders/routes.js";
import { adminRouter } from "./modules/admin/routes.js";
import {
  onlinePaymentsEnabled,
  paymentsRouter,
  publicOrigin,
} from "./modules/payments/gateway.js";
import { errorHandler, HttpError } from "./lib/errors.js";
import { getCoupons } from "./lib/database.js";
import { deliveryZones } from "@pizza-house/shared/commerce";
import { branches } from "./lib/branches.js";
import { deliveryEnabled } from "./lib/notifications.js";
import { customerRouter } from "./modules/customer/routes.js";
import { recoveryRouter } from "./modules/auth/recovery.js";

export const app = express();
app.disable("x-powered-by");
// Only trust the known number of reverse proxies in front of this service.
// Leave unset for a direct connection; never trust arbitrary forwarded headers.
const proxyHops = Number(process.env.TRUST_PROXY || 0);
if (!Number.isInteger(proxyHops) || proxyHops < 0)
  throw new Error("TRUST_PROXY must be a non-negative integer proxy hop count.");
app.set("trust proxy", proxyHops);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "img-src": ["'self'", "data:", "blob:"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        "upgrade-insecure-requests":
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: 240,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again shortly." },
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use("/api/payments", paymentsRouter);
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (!req.is("application/json")) {
      next(new HttpError(415, "JSON request required."));
      return;
    }
    const origin = req.headers.origin;
    const localOrigins =
      process.env.NODE_ENV === "production"
        ? []
        : ["http://localhost:5173", "http://127.0.0.1:5173"];
    if (
      req.headers["sec-fetch-site"] === "cross-site" ||
      (origin && ![publicOrigin(), ...localOrigins].includes(origin))
    ) {
      next(new HttpError(403, "Request origin is not allowed."));
      return;
    }
  }
  next();
});
app.use(sessionMiddleware);
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/config", (_req, res) =>
  res.json({
    zones: deliveryZones,
    branches: branches(),
    notifications: { email: deliveryEnabled("email"), sms: deliveryEnabled("sms") },
    onlinePayments: onlinePaymentsEnabled(),
    sandbox: process.env.SSLCOMMERZ_SANDBOX !== "false",
    contact: {
      email: process.env.SHOP_EMAIL || "",
      phone: process.env.SHOP_PHONE || "",
      whatsapp: process.env.SHOP_WHATSAPP || "",
    },
    offers: getCoupons().filter((c) => c.active),
  }),
);
app.use("/api/auth", authRouter);
app.use("/api/recovery", recoveryRouter);
app.use("/api/customer", customerRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/admin", adminRouter);
app.use("/api", (_req, _res, next) =>
  next(new HttpError(404, "API endpoint not found.")),
);
app.use(errorHandler);
