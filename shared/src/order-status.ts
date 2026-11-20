import type { OrderStatus } from "./types.js";

/** Shared with the admin UI; authorization and payment checks stay on the server. */
export const orderTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};
