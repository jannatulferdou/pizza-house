import { z } from "zod";
import type { Branch } from "@pizza-house/shared/types";
import { HttpError } from "./errors.js";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const schema = z.array(z.object({
  id: z.string().min(1).max(40), name: z.string().min(1).max(100),
  address: z.string().min(10).max(300), opens: time, closes: time,
  days: z.array(z.number().int().min(0).max(6)).min(1),
  timeZone: z.literal("Asia/Dhaka"), pickup: z.boolean(),
})).max(30);

export function branches(): Branch[] {
  if (!process.env.SHOP_BRANCHES) return [];
  const result = schema.parse(JSON.parse(process.env.SHOP_BRANCHES));
  if (new Set(result.map(b => b.id)).size !== result.length || result.some(b => b.opens >= b.closes))
    throw new Error("Branches need unique IDs and same-day opening hours.");
  return result;
}
export function isOpen(branch: Branch, instant: Date) {
  // Bangladesh has a fixed UTC+06:00 offset.
  const local = new Date(instant.getTime() + 6 * 60 * 60_000);
  const hhmm = local.toISOString().slice(11, 16);
  return branch.days.includes(local.getUTCDay()) && hhmm >= branch.opens && hhmm < branch.closes;
}
export function validateFulfillment(input: { fulfillment?: string; branchId?: string; scheduledAt?: string }) {
  const list = branches();
  const branch = list.find(b => b.id === input.branchId);
  if (input.fulfillment === "pickup" && (!branch || !branch.pickup))
    throw new HttpError(400, "Choose an available pickup branch.");
  if (input.branchId && !branch) throw new HttpError(400, "Unknown branch.");
  const now = Date.now();
  const at = input.scheduledAt ? new Date(input.scheduledAt).getTime() : now;
  if (!Number.isFinite(at) || (input.scheduledAt && (at < now + 60 * 60_000 || at > now + 7 * 86_400_000)))
    throw new HttpError(400, "Schedule your order between one hour and seven days ahead.");
  if (list.length && !(branch ? [branch] : list).some(b => isOpen(b, new Date(at))))
    throw new HttpError(400, "The shop is closed at this time. Choose a time during opening hours.");
  return branch;
}
