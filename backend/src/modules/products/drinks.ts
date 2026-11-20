import type { Product } from "@pizza-house/shared/types";

// Sample menu additions. Applied once so later merchant edits remain intact.
const drinkDefaults = {
  category: "Drinks",
  serving: "330 ml",
  diet: "Plant based",
  allergens: "Prepared in a shared kitchen",
  storage: "Keep chilled",
  shelfLife: "Consume on the day of delivery",
  stock: 50,
  active: true,
  rating: 0,
  reviewCount: 0,
} satisfies Partial<Product>;

export const additionalDrinks: Product[] = [
  {
    ...drinkDefaults,
    id: "orange-drink",
    name: "Orange cooler",
    description: "Bright orange juice over ice. A citrus refreshment for any meal.",
    price: 150,
    ingredients: "Orange juice, water, sugar, ice",
    image: "/images/orange-cooler.jpg",
  },
  {
    ...drinkDefaults,
    id: "watermelon-drink",
    name: "Watermelon cooler",
    description: "Sweet watermelon with a splash of lime, served ice cold.",
    price: 160,
    ingredients: "Watermelon juice, lime juice, water, sugar, ice",
    image: "/images/watermelon-cooler.jpg",
  },
  {
    ...drinkDefaults,
    id: "iced-tea-drink",
    name: "Classic iced tea",
    description: "Lightly sweetened black tea poured over ice. Contains caffeine.",
    price: 130,
    ingredients: "Water, black tea, sugar, ice",
    image: "/images/iced-tea.jpg",
  },
];
