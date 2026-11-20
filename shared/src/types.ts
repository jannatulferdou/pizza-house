export type Category = "Pizzas" | "Burgers" | "Sides" | "Drinks" | "Combos";
export type PlateFinish = "Ivory" | "Charcoal" | "Terracotta";
export interface Product {
  id: string;
  name: string;
  category: Category;
  description: string;
  price: number;
  ingredients: string;
  serving: string;
  diet: string;
  image: string;
  allergens: string;
  storage: string;
  shelfLife: string;
  stock: number;
  active: boolean;
  rating: number;
  reviewCount: number;
  bundle?: { id: string; qty: number }[];
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: "customer" | "admin";
}
export interface CartLine {
  id: string;
  qty: number;
  options?: PizzaConfiguration;
}
export interface PizzaConfiguration {
  size: "regular" | "large";
  crust: "classic" | "thin" | "cheese";
  toppings: ("mozzarella" | "mushrooms" | "olives" | "pepperoni")[];
}
export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  eta: string;
}
export interface Coupon {
  code: string;
  percent: number;
  minimum: number;
  active: boolean;
}
export interface Address {
  name: string;
  phone: string;
  street: string;
  zoneId: string;
  notes: string;
}
export type PaymentMethod = "cod" | "bkash" | "nagad" | "card";
export type OrderStatus =
  | "pending_payment"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
export type PaymentStatus =
  "unpaid" | "pending" | "paid" | "failed" | "review" | "refund_required";
export interface OrderItem {
  id: string;
  name: string;
  image: string;
  price: number;
  qty: number;
  options?: PizzaConfiguration;
}
export interface Quote {
  loyaltyDiscount?: number;
  redeemPoints?: number;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  coupon: string;
  zone: DeliveryZone;
}
export interface Order extends Quote {
  fulfillment?: "delivery" | "pickup";
  branchId?: string;
  scheduledAt?: string;
  reservedStock?: { id: string; qty: number }[];
  id: string;
  userId: string;
  address: Address;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  createdAt: string;
  history: { status: OrderStatus; at: string }[];
}
export interface Review {
  id: string;
  productId: string;
  userId: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
}
export interface ShopConfig {
  branches: Branch[];
  notifications: { email: boolean; sms: boolean };
  zones: DeliveryZone[];
  onlinePayments: boolean;
  sandbox: boolean;
  contact: { email: string; phone: string; whatsapp: string };
  offers: Coupon[];
}
export interface CheckoutInput {
  fulfillment?: "delivery" | "pickup";
  branchId?: string;
  scheduledAt?: string;
  redeemPoints?: number;
  items: CartLine[];
  address: Address;
  paymentMethod: PaymentMethod;
  coupon: string;
  idempotencyKey: string;
  expectedTotal: number;
}
export interface AdminSummary {
  orders: Order[];
  products: Product[];
  coupons: Coupon[];
  revenue: number;
  customers: number;
}
export interface Branch {
  id: string;
  name: string;
  address: string;
  opens: string;
  closes: string;
  days: number[];
  timeZone: string;
  pickup: boolean;
}
export interface SavedAddress extends Address { id: string; label: string }
export interface CustomerProfile {
  addresses: SavedAddress[];
  favourites: string[];
  points: number;
  emailVerified: boolean;
  preferences: { email: boolean; sms: boolean; phone: string };
  notifications: { id: string; message: string; orderId: string; createdAt: string; read: boolean }[];
}
