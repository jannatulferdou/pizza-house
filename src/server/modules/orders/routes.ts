import { Router } from "express";
import { z } from "zod";
import { getOrder, getOrders } from "../../lib/database";
import { requireUser } from "../auth/auth";
import { HttpError } from "../../lib/errors";
import { initiatePayment, onlinePaymentsEnabled } from "../payments/gateway";
import {
  cartSchema,
  checkoutSchema,
  createOrder,
  makeQuote,
  changeOrderStatus,
} from "./service";
export const ordersRouter = Router();
ordersRouter.use(requireUser);
ordersRouter.get("/", (req, res) => res.json(getOrders(req.user!.id)));
ordersRouter.post("/quote", (req, res) => {
  const input = cartSchema
    .extend({ zoneId: z.string().max(40) })
    .parse(req.body);
  res.json(makeQuote(input, input.zoneId, req.user!.id));
});
ordersRouter.post("/", async (req, res) => {
  const input = checkoutSchema.parse(req.body);
  if (input.paymentMethod !== "cod" && !onlinePaymentsEnabled())
    throw new HttpError(
      503,
      "Online payment is not configured. Choose cash on delivery.",
    );
  const { order, existing } = createOrder(input, req.user!);
  let paymentUrl: string | undefined;
  if (!existing && order.status === "pending_payment") {
    try {
      paymentUrl = await initiatePayment(order, req.user!);
    } catch {
      // A provider timeout may already have opened a payment session. Keep the
      // reservation until the customer explicitly cancels or a verified IPN arrives.
      res
        .status(201)
        .json({
          order,
          paymentError:
            "Could not open the payment provider. Your order is pending; cancel it from your order page before placing a new order.",
        });
      return;
    }
  }
  res.status(existing ? 200 : 201).json({ order, paymentUrl });
});
ordersRouter.get("/:id", (req, res) => {
  const order = getOrder(String(req.params.id));
  if (!order || order.userId !== req.user!.id)
    throw new HttpError(404, "Order not found.");
  res.json(order);
});
ordersRouter.post("/:id/cancel", (req, res) => {
  const order = getOrder(String(req.params.id));
  if (!order || order.userId !== req.user!.id)
    throw new HttpError(404, "Order not found.");
  if (!["pending_payment", "confirmed"].includes(order.status))
    throw new HttpError(
      409,
      "This order can no longer be cancelled online. Please contact the shop.",
    );
  res.json(changeOrderStatus(order.id, "cancelled"));
});
