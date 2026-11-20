import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  db,
  getCoupons,
  getOrder,
  getProducts,
  saveOrder,
  saveProduct,
  transaction,
  recordOrderNotification,
} from "../../lib/database.js";
import { HttpError } from "../../lib/errors.js";
import { quoteCart, stockRequirements } from "@pizza-house/shared/commerce";
import { validateFulfillment } from "../../lib/branches.js";
import { pointsBalance } from "../customer/routes.js";
import type { Order, OrderStatus, User } from "@pizza-house/shared/types";
import { orderTransitions } from "@pizza-house/shared/order-status";

export const cartSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().max(80),
        qty: z.number().int().min(1).max(99),
        options: z
          .object({
            size: z.enum(["regular", "large"]),
            crust: z.enum(["classic", "thin", "cheese"]),
            toppings: z
              .array(z.enum(["mozzarella", "mushrooms", "olives", "pepperoni"]))
              .max(4),
          })
          .strict()
          .optional(),
      }),
    )
    .min(1)
    .max(50),
  coupon: z.string().max(30).default(""),
  fulfillment: z.enum(["delivery", "pickup"]).optional(),
  branchId: z.string().max(40).optional(),
  scheduledAt: z.union([z.literal(""), z.iso.datetime()]).optional(),
  redeemPoints: z.number().int().min(0).max(100_000).optional(),
});
export const checkoutSchema = cartSchema.extend({
  address: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z
      .string()
      .regex(
        /^(?:\+?88)?01[3-9]\d{8}$/,
        "Enter a valid Bangladesh mobile number.",
      ),
    street: z
      .string()
      .trim()
      .min(0)
      .max(300),
    zoneId: z.string().max(40),
    notes: z.string().trim().max(500).default(""),
  }),
  paymentMethod: z.enum(["cod", "bkash", "nagad", "card"]),
  idempotencyKey: z.uuid(),
  expectedTotal: z.number().int().positive(),
});
export function makeQuote(input: z.infer<typeof cartSchema>, zoneId: string, userId?: string) {
  try {
    const branch = validateFulfillment(input);
    const quote = quoteCart(
      input.items,
      getProducts(),
      input.fulfillment === "pickup" ? "pickup" : zoneId === "pickup" ? "invalid" : zoneId,
      input.coupon,
      getCoupons(),
    );
    if (branch && input.fulfillment === "pickup") quote.zone.name = branch.name;
    const points = input.redeemPoints || 0;
    if (points && (!userId || points > pointsBalance(userId))) throw new Error("Not enough loyalty points.");
    const cap = Math.floor((quote.subtotal - quote.discount) * 0.2);
    if (points > cap) throw new Error(`Use at most ${cap} points for this order (20% of discounted food total).`);
    return { ...quote, redeemPoints: points, loyaltyDiscount: points, total: quote.total - points };
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "Invalid bag.",
    );
  }
}
export function createOrder(
  input: z.infer<typeof checkoutSchema>,
  user: User,
): { order: Order; existing: boolean } {
  return transaction(() => {
    const old = db
      .prepare("SELECT data FROM orders WHERE user_id = ? AND request_key = ?")
      .get(user.id, input.idempotencyKey);
    if (old)
      return { order: JSON.parse(String(old.data)) as Order, existing: true };
    const quote = makeQuote(input, input.address.zoneId, user.id);
    if (input.fulfillment !== "pickup" && input.address.street.trim().length < 10)
      throw new HttpError(400, "Please include house, road and area.");
    const branch = input.fulfillment === "pickup" ? validateFulfillment(input) : undefined;
    if (quote.total !== input.expectedTotal)
      throw new HttpError(
        409,
        "Prices or offers have changed. Refresh checkout and review the new total before ordering.",
      );
    const createdAt = new Date().toISOString();
    const status =
      input.paymentMethod === "cod" ? "confirmed" : "pending_payment";
    const order: Order = {
      ...quote,
      id: `PH-${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`,
      userId: user.id,
      address: branch ? { ...input.address, street: branch.address, zoneId: "pickup" } : input.address,
      fulfillment: input.fulfillment || "delivery",
      branchId: input.branchId,
      scheduledAt: input.scheduledAt || undefined,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentMethod === "cod" ? "unpaid" : "pending",
      status,
      createdAt,
      history: [{ status, at: createdAt }],
    };
    const products = getProducts();
    order.reservedStock = [...stockRequirements(quote.items, products)].map(([id, qty]) => ({ id, qty }));
    for (const item of order.reservedStock) {
      const product = products.find((p) => p.id === item.id)!;
      product.stock -= item.qty;
      saveProduct(product);
    }
    db.prepare("INSERT INTO orders VALUES (?, ?, ?, ?)").run(
      order.id,
      user.id,
      input.idempotencyKey,
      JSON.stringify(order),
    );
    if (quote.redeemPoints) db.prepare("INSERT INTO loyalty VALUES (?,?,?)").run(`${order.id}:redeem`, user.id, -quote.redeemPoints);
    recordOrderNotification(order);
    return { order, existing: false };
  });
}
export function changeOrderStatus(id: string, status: OrderStatus): Order {
  return transaction(() => {
    const order = getOrder(id);
    if (!order) throw new HttpError(404, "Order not found.");
    if (order.status === status) return order;
    if (!orderTransitions[order.status].includes(status))
      throw new HttpError(409, "That order status change is not allowed.");
    if (status === "preparing" && order.scheduledAt && new Date(order.scheduledAt).getTime() > Date.now() + 30 * 60_000)
      throw new HttpError(409, "Wait until 30 minutes before the scheduled time to start preparation.");
    if (
      status !== "cancelled" &&
      ["review", "pending", "refund_required"].includes(order.paymentStatus)
    )
      throw new HttpError(409, "Payment must be verified before fulfillment.");
    if (status === "cancelled") {
      const products = getProducts();
      for (const item of order.reservedStock || order.items) {
        const product = products.find((p) => p.id === item.id);
        if (product) {
          product.stock += item.qty;
          saveProduct(product);
        }
      }
      if (["paid", "review"].includes(order.paymentStatus))
        order.paymentStatus = "refund_required";
      else if (order.paymentStatus === "pending")
        order.paymentStatus = "failed";
      if (order.redeemPoints) db.prepare("INSERT OR IGNORE INTO loyalty VALUES (?,?,?)").run(`${order.id}:restore`, order.userId, order.redeemPoints);
    }
    if (status === "delivered" && order.paymentMethod === "cod")
      order.paymentStatus = "paid";
    if (status === "delivered" && order.paymentStatus === "paid")
      db.prepare("INSERT OR IGNORE INTO loyalty VALUES (?,?,?)").run(`${order.id}:earn`, order.userId, Math.floor((order.subtotal - order.discount - (order.loyaltyDiscount || 0)) / 20));
    order.status = status;
    order.history.push({ status, at: new Date().toISOString() });
    saveOrder(order);
    return order;
  });
}
