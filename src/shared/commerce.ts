import type { CartLine, Coupon, DeliveryZone, Product, Quote } from "./types";

import {
  cartKey,
  configuredPrice,
  configurationLabel,
  normalizeOptions,
} from "./pizza-options";
export const deliveryZones: DeliveryZone[] = [
  { id: "dhanmondi", name: "Dhanmondi", fee: 60, eta: "35–50 minutes" },
  { id: "gulshan", name: "Gulshan & Banani", fee: 80, eta: "40–60 minutes" },
  { id: "mirpur", name: "Mirpur", fee: 80, eta: "40–60 minutes" },
  { id: "uttara", name: "Uttara", fee: 100, eta: "50–70 minutes" },
];
export const money = (amount: number) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(amount);
export const statusLabel = (status: string) =>
  status.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

/** Always calculate against authoritative server products, never prices sent by a browser. */
export function quoteCart(
  lines: CartLine[],
  products: Product[],
  zoneId: string,
  code: string,
  coupons: Coupon[],
): Quote {
  const zone = zoneId === "pickup" ? { id: "pickup", name: "Pickup", fee: 0, eta: "20–30 minutes" } : deliveryZones.find((z) => z.id === zoneId);
  if (!zone) throw new Error("Choose a supported delivery area.");
  if (!lines.length || lines.length > 50)
    throw new Error("Your bag must contain 1–50 different products.");
  const quantities = new Map<string, number>();
  const variants = new Map<string, CartLine>();
  for (const line of lines) {
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99)
      throw new Error("Invalid quantity.");
    quantities.set(line.id, (quantities.get(line.id) ?? 0) + line.qty);
    const options = normalizeOptions(line.options);
    const key = cartKey({ id: line.id, options });
    const previous = variants.get(key);
    variants.set(key, {
      id: line.id,
      qty: (previous?.qty ?? 0) + line.qty,
      ...(options ? { options } : {}),
    });
  }
  const items = [...variants.values()].map(({ id, qty, options }) => {
    const product = products.find((p) => p.id === id && p.active);
    if (!product)
      throw new Error("An item in your bag is no longer available.");
    if (quantities.get(id)! > 99 || quantities.get(id)! > product.stock)
      throw new Error(
        `${product.name}: only ${Math.min(99, product.stock)} available.`,
      );
    return {
      id,
      qty,
      name: product.name + (options ? ` — ${configurationLabel(options)}` : ""),
      image: product.image,
      price: configuredPrice(product, options),
      ...(options ? { options } : {}),
    };
  });
  for (const [id, qty] of stockRequirements(lines, products)) {
    const product = products.find(p => p.id === id && p.active);
    if (!product || qty > product.stock) throw new Error(`${product?.name || "Combo component"}: insufficient stock for this bag.`);
  }
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const coupon = code.trim().toUpperCase();
  const offer = coupons.find((c) => c.code === coupon && c.active);
  if (coupon && (!offer || subtotal < offer.minimum))
    throw new Error(
      offer
        ? `This offer needs a subtotal of ${money(offer.minimum)}.`
        : "This offer code is not available.",
    );
  const discount = offer ? Math.floor((subtotal * offer.percent) / 100) : 0;
  return {
    items,
    subtotal,
    discount,
    deliveryFee: zone.fee,
    total: subtotal - discount + zone.fee,
    coupon,
    zone,
  };
}

export function stockRequirements(lines: Pick<CartLine, "id" | "qty">[], products: Product[]) {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    const product = products.find(p => p.id === line.id);
    for (const part of product?.bundle?.length ? product.bundle : [{ id: line.id, qty: 1 }])
      quantities.set(part.id, (quantities.get(part.id) || 0) + part.qty * line.qty);
  }
  return quantities;
}

/** Reorders are all-or-nothing and use current prices and component availability. */
export function mergeCart(current: CartLine[], additions: CartLine[], products: Product[]): CartLine[] {
  const combined = current.map(line => ({ ...line }));
  for (const line of additions) {
    const options = normalizeOptions(line.options);
    const index = combined.findIndex(item => cartKey(item) === cartKey({ ...line, options }));
    if (index >= 0) combined[index] = { ...combined[index], qty: combined[index].qty + line.qty };
    else combined.push({ id: line.id, qty: line.qty, ...(options ? { options } : {}) });
  }
  quoteCart(combined, products, "pickup", "", []);
  return combined;
}
