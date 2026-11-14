import { Router } from "express";
import { z } from "zod";
import { getOrder, saveOrder, transaction } from "../../lib/database";
import { HttpError } from "../../lib/errors";
import type { Order, User } from "../../../shared/types";

export const onlinePaymentsEnabled = () =>
  Boolean(
    process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD,
  );
const sandbox = () => process.env.SSLCOMMERZ_SANDBOX !== "false";
const gatewayBase = () =>
  sandbox()
    ? "https://sandbox.sslcommerz.com"
    : "https://securepay.sslcommerz.com";
export const publicOrigin = () =>
  new URL(process.env.APP_URL || "http://localhost:5173").origin;
const merchant = () => ({
  store_id: process.env.SSLCOMMERZ_STORE_ID!,
  store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
});
export async function initiatePayment(
  order: Order,
  user: User,
): Promise<string> {
  if (!onlinePaymentsEnabled())
    throw new HttpError(
      503,
      "Online payment is not configured. Choose cash on delivery.",
    );
  const origin = publicOrigin();
  const body = new URLSearchParams({
    ...merchant(),
    total_amount: String(order.total),
    currency: "BDT",
    tran_id: order.id,
    success_url: `${origin}/api/payments/success`,
    fail_url: `${origin}/api/payments/fail`,
    cancel_url: `${origin}/api/payments/cancel`,
    ipn_url: `${origin}/api/payments/ipn`,
    cus_name: order.address.name,
    cus_email: user.email,
    cus_add1: order.address.street,
    cus_city: "Dhaka",
    cus_country: "Bangladesh",
    cus_phone: order.address.phone,
    shipping_method: "YES",
    ship_name: order.address.name,
    ship_add1: order.address.street,
    ship_city: "Dhaka",
    ship_postcode: "1200",
    ship_country: "Bangladesh",
    num_of_item: String(order.items.reduce((n, i) => n + i.qty, 0)),
    product_name: order.items
      .map((i) => i.name)
      .join(", ")
      .slice(0, 250),
    product_category: "Food",
    product_profile: "physical-goods",
  });
  const response = await fetch(`${gatewayBase()}/gwprocess/v4/api.php`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new HttpError(502, "Payment provider is unavailable.");
  const result = z
    .object({ status: z.string(), GatewayPageURL: z.url().optional() })
    .parse(await response.json());
  if (result.status !== "SUCCESS" || !result.GatewayPageURL)
    throw new HttpError(502, "The payment provider could not open checkout.");
  const url = new URL(result.GatewayPageURL);
  if (
    url.protocol !== "https:" ||
    !(
      url.hostname === "sslcommerz.com" ||
      url.hostname.endsWith(".sslcommerz.com")
    )
  )
    throw new HttpError(502, "Invalid payment destination.");
  return url.href;
}
export interface ValidatedPayment {
  status: string;
  tran_id: string;
  amount: string | number;
  currency: string;
  risk_level?: string | number;
}
export function acceptValidatedPayment(result: ValidatedPayment): Order {
  return transaction(() => {
    const order = getOrder(result.tran_id);
    if (
      !order ||
      order.paymentMethod === "cod" ||
      !["VALID", "VALIDATED"].includes(result.status) ||
      result.currency !== "BDT" ||
      Math.round(Number(result.amount) * 100) !== order.total * 100
    )
      throw new HttpError(400, "Payment verification failed.");
    if (["paid", "review", "refund_required"].includes(order.paymentStatus))
      return order;
    if (order.status === "cancelled") order.paymentStatus = "refund_required";
    else {
      order.paymentStatus =
        String(result.risk_level) === "0" ? "paid" : "review";
      if (order.paymentStatus === "paid") {
        order.status = "confirmed";
        order.history.push({
          status: "confirmed",
          at: new Date().toISOString(),
        });
      }
    }
    saveOrder(order);
    return order;
  });
}
export const paymentsRouter = Router();
paymentsRouter.post("/:outcome", async (req, res) => {
  const outcome = String(req.params.outcome);
  if (!["success", "fail", "cancel", "ipn"].includes(outcome))
    throw new HttpError(404, "Unknown callback.");
  if (!onlinePaymentsEnabled())
    throw new HttpError(503, "Payment service is unavailable.");
  let order: Order | undefined;
  if (req.body?.val_id) {
    const valId = z.string().max(100).parse(req.body.val_id);
    const url = new URL(
      `${gatewayBase()}/validator/api/validationserverAPI.php`,
    );
    url.search = new URLSearchParams({
      ...merchant(),
      val_id: valId,
      format: "json",
      v: "1",
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new HttpError(502, "Could not verify payment.");
    const result = z
      .object({
        status: z.string(),
        tran_id: z.string(),
        amount: z.union([z.string(), z.number()]),
        currency: z.string(),
        risk_level: z.union([z.string(), z.number()]).optional(),
      })
      .parse(await response.json());
    order = acceptValidatedPayment(result);
  } else if (outcome === "success" || outcome === "ipn")
    throw new HttpError(400, "Missing payment validation ID.");
  // Unsigned cancel/fail callbacks cannot alter an order or release stock.
  // The owner can cancel a pending order; verified late payments require a refund.
  if (outcome === "ipn") {
    res.json({ ok: true });
    return;
  }
  res.redirect(
    303,
    `${publicOrigin()}${order ? `/orders/${order.id}` : "/account"}?payment=${encodeURIComponent(outcome)}`,
  );
});
