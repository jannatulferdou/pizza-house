import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  db,
  getCoupons,
  getOrders,
  getProducts,
  saveProduct,
} from "../../lib/database";
import { requireAdmin } from "../auth/auth";
import { changeOrderStatus } from "../orders/service";
import { HttpError } from "../../lib/errors";
const imagePath = z
  .string()
  .regex(
    /^\/images\/[a-z0-9-]+\.(?:jpg|png|webp|svg)$/i,
    "Use a local /images/ filename.",
  );
const productSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.enum(["Pizzas", "Burgers", "Sides", "Drinks", "Combos"]),
  bundle: z.array(z.object({ id: z.string().max(80), qty: z.number().int().min(1).max(20) })).max(10).optional(),
  description: z.string().trim().min(5).max(500),
  price: z.number().int().min(1).max(100_000),
  ingredients: z.string().trim().min(2).max(500),
  serving: z.string().trim().min(2).max(100),
  diet: z.string().max(100),
  image: imagePath,
  allergens: z.string().trim().min(2).max(500),
  storage: z.string().trim().min(2).max(500),
  shelfLife: z.string().trim().min(2).max(500),
  stock: z.number().int().min(0).max(100_000),
  active: z.boolean(),
});
export const adminRouter = Router();
function validateBundle(product: { id: string; category: string; bundle?: {id: string; qty: number}[] }) {
  if (product.bundle && new Set(product.bundle.map(part => part.id)).size !== product.bundle.length) throw new HttpError(400, "Each combo component must appear once. Increase its quantity instead.");
  if (product.category === "Combos" && !product.bundle?.length) throw new HttpError(400, "A combo needs components.");
  if (product.category !== "Combos" && product.bundle?.length) throw new HttpError(400, "Only combos can have components.");
  if (product.bundle?.some(part => part.id === product.id || !getProducts().some(p => p.id === part.id && p.active && p.category !== "Combos"))) throw new HttpError(400, "Choose active, non-combo products as components.");
  if (product.bundle?.length && getProducts().some(p => p.bundle?.some(part => part.id === product.id))) throw new HttpError(400, "This product is already a combo component.");
}
adminRouter.use(requireAdmin);
adminRouter.get("/", (_req, res) => {
  const orders = getOrders();
  res.json({
    orders,
    products: getProducts(),
    coupons: getCoupons(),
    revenue: orders
      .filter((o) => o.status === "delivered" && o.paymentStatus === "paid")
      .reduce((sum, o) => sum + o.total, 0),
    customers: Number(
      db
        .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'")
        .get()!.n,
    ),
  });
});
adminRouter.post("/products", (req, res) => {
  const input = productSchema.parse(req.body);
  const product = { ...input, id: randomUUID(), rating: 0, reviewCount: 0 };
  validateBundle(product);
  saveProduct(product);
  res.status(201).json(product);
});
adminRouter.patch("/products/:id", (req, res) => {
  const product = getProducts().find((p) => p.id === req.params.id);
  if (!product) throw new HttpError(404, "Product not found.");
  const next = { ...product, ...productSchema.partial().parse(req.body) };
  validateBundle(next);
  saveProduct(next);
  res.json(next);
});
adminRouter.put("/coupons", (req, res) => {
  const coupon = z
    .object({
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]{3,30}$/),
      percent: z.number().int().min(1).max(80),
      minimum: z.number().int().min(0).max(100_000),
      active: z.boolean(),
    })
    .parse(req.body);
  db.prepare(
    "INSERT INTO coupons VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET data = excluded.data",
  ).run(coupon.code, JSON.stringify(coupon));
  res.json(coupon);
});
adminRouter.patch("/orders/:id", (req, res) => {
  const { status } = z
    .object({
      status: z.enum([
        "confirmed",
        "preparing",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ]),
    })
    .parse(req.body);
  res.json(changeOrderStatus(String(req.params.id), status));
});
