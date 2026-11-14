import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, getOrders, getProducts, getReviews } from "../../lib/database";
import { HttpError } from "../../lib/errors";
import { requireUser } from "../auth/auth";
import type { Review } from "../../../shared/types";
export const productsRouter = Router();
productsRouter.get("/", (_req, res) =>
  res.json(getProducts().filter((p) => p.active)),
);
productsRouter.get("/:id/reviews", (req, res) =>
  res.json(
    getReviews()
      .filter((r) => r.productId === req.params.id)
      .map(({ userId: _userId, ...review }) => review),
  ),
);
productsRouter.post("/:id/reviews", requireUser, (req, res) => {
  const input = z
    .object({
      rating: z.number().int().min(1).max(5),
      comment: z
        .string()
        .trim()
        .min(10, "Please write at least 10 characters.")
        .max(1000),
    })
    .parse(req.body);
  const productId = String(req.params.id);
  if (!getProducts().some((p) => p.id === productId && p.active))
    throw new HttpError(404, "Product not found.");
  if (
    !getOrders(req.user!.id).some(
      (o) =>
        o.status === "delivered" && o.items.some((i) => i.id === productId),
    )
  )
    throw new HttpError(
      403,
      "You can review this product after your order is delivered.",
    );
  const review: Review = {
    ...input,
    id: randomUUID(),
    productId,
    userId: req.user!.id,
    name: req.user!.name,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO reviews VALUES (?, ?, ?, ?) ON CONFLICT(product_id, user_id) DO UPDATE SET data = excluded.data",
  ).run(review.id, productId, review.userId, JSON.stringify(review));
  res.status(201).json({ ok: true });
});
