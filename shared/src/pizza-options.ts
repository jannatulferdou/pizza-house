import type { CartLine, PizzaConfiguration, Product } from "./types.js";

export const pizzaSizes = [
  { id: "regular", label: "12-inch", price: 0 },
  { id: "large", label: "14-inch", price: 180 },
] as const;
export const pizzaCrusts = [
  { id: "classic", label: "Classic crust", price: 0 },
  { id: "thin", label: "Thin & crisp", price: 0 },
  { id: "cheese", label: "Cheese-stuffed", price: 90 },
] as const;
export const pizzaToppings = [
  { id: "mozzarella", label: "Extra mozzarella", price: 70, allergen: "Milk" },
  { id: "mushrooms", label: "Mushrooms", price: 50, allergen: "" },
  { id: "olives", label: "Black olives", price: 40, allergen: "" },
  {
    id: "pepperoni",
    label: "Beef pepperoni",
    price: 90,
    allergen: "Contains beef",
  },
] as const;
export const defaultPizza: PizzaConfiguration = {
  size: "regular",
  crust: "classic",
  toppings: [],
};

/** Canonical options are shared by local storage, cart identity and server pricing. */
export function normalizeOptions(
  value: unknown,
): PizzaConfiguration | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object")
    throw new Error("Invalid pizza options.");
  const options = value as PizzaConfiguration;
  if (
    !pizzaSizes.some((s) => s.id === options.size) ||
    !pizzaCrusts.some((c) => c.id === options.crust) ||
    !Array.isArray(options.toppings) ||
    options.toppings.length > 4 ||
    options.toppings.some(
      (t) => !pizzaToppings.some((option) => option.id === t),
    ) ||
    new Set(options.toppings).size !== options.toppings.length
  )
    throw new Error("Invalid pizza options.");
  const toppings = [...options.toppings].sort();
  if (
    options.size === "regular" &&
    options.crust === "classic" &&
    !toppings.length
  )
    return undefined;
  return { size: options.size, crust: options.crust, toppings };
}
export function cartKey(line: Pick<CartLine, "id" | "options">): string {
  const options = normalizeOptions(line.options);
  return options
    ? JSON.stringify([line.id, options.size, options.crust, options.toppings])
    : line.id;
}
export function configuredPrice(
  product: Product,
  configuration?: PizzaConfiguration,
): number {
  const options = normalizeOptions(configuration);
  if (!options) return product.price;
  if (product.category !== "Pizzas")
    throw new Error("Only pizzas can be customized.");
  return (
    product.price +
    pizzaSizes.find((s) => s.id === options.size)!.price +
    pizzaCrusts.find((c) => c.id === options.crust)!.price +
    options.toppings.reduce(
      (total, id) => total + pizzaToppings.find((t) => t.id === id)!.price,
      0,
    )
  );
}
export function configurationLabel(options?: PizzaConfiguration): string {
  if (!options) return "";
  return [
    pizzaSizes.find((s) => s.id === options.size)!.label,
    pizzaCrusts.find((c) => c.id === options.crust)!.label,
    ...options.toppings.map(
      (id) => pizzaToppings.find((t) => t.id === id)!.label,
    ),
  ].join(" · ");
}
