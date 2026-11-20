import test from "node:test";
import assert from "node:assert/strict";
import { mergeCart } from "@pizza-house/shared/commerce";
import { seedProducts } from "../modules/products/seed.js";
import type { CartLine, Product } from "@pizza-house/shared/types";

test("reorder merges matching variants without changing the original cart or losing other items", () => {
  const options = { size: "large", crust: "thin", toppings: ["olives"] } as const;
  const current: CartLine[] = [{ id: "pizza", qty: 1, options: { ...options, toppings: [...options.toppings] } }, { id: "fries", qty: 1 }];
  const snapshot = structuredClone(current);
  const result = mergeCart(current, [{ ...current[0], qty: 2 }, { id: "pizza", qty: 1 }], seedProducts);
  assert.equal(result.length, 3);
  assert.equal(result[0].qty, 3);
  assert.equal(result[1].id, "fries");
  assert.equal(result[2].options, undefined);
  assert.deepEqual(current, snapshot);
});

test("reorder rejects unavailable items and combined combo stock without partially changing the bag", () => {
  const pizza = seedProducts.find(p => p.id === "pizza")!;
  const combo: Product = { ...pizza, id: "test-combo", category: "Combos", bundle: [{ id: "pizza", qty: 2 }], stock: 1 };
  const menu = [...seedProducts.map(p => p.id === "pizza" ? { ...p, stock: 2 } : p), combo];
  const current = [{ id: "pizza", qty: 1 }];
  assert.throws(() => mergeCart(current, [{ id: combo.id, qty: 1 }], menu), /insufficient stock/);
  assert.throws(() => mergeCart(current, [{ id: "removed-meal", qty: 1 }], menu), /no longer available/);
  assert.deepEqual(current, [{ id: "pizza", qty: 1 }]);
});
