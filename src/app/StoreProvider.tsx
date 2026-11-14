import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { api, errorMessage } from "../shared/api";
import { mergeCart } from "../shared/commerce";
import type {
  CartLine,
  PizzaConfiguration,
  Product,
  ShopConfig,
  User,
  CustomerProfile,
} from "../shared/types";
import {
  cartKey,
  configuredPrice,
  normalizeOptions,
} from "../shared/pizza-options";

interface Store {
  profile: CustomerProfile | null;
  refreshProfile: () => Promise<void>;
  profileError: string;
  addMany: (lines: CartLine[]) => Promise<boolean>;
  products: Product[];
  config: ShopConfig | null;
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  cart: CartLine[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  add: (
    id: string,
    quantity?: number,
    options?: PizzaConfiguration,
    openBag?: boolean,
  ) => boolean;
  change: (id: string, quantity: number) => void;
  clearCart: () => void;
  notice: string;
  setNotice: (notice: string) => void;
}
const StoreContext = createContext<Store | null>(null);
function readCart(): CartLine[] {
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem("pizza-house-cart") || "[]",
    );
    if (!Array.isArray(raw)) return [];
    const unique = new Map<string, CartLine>();
    for (const row of raw) {
      if (
        row &&
        typeof row.id === "string" &&
        Number.isInteger(row.qty) &&
        row.qty > 0
      ) {
        try {
          const options = normalizeOptions(row.options);
          const key = cartKey({ id: row.id, options });
          unique.set(key, {
            id: row.id,
            qty: Math.min(99, (unique.get(key)?.qty ?? 0) + row.qty),
            ...(options ? { options } : {}),
          });
        } catch {
          /* Discard an invalid saved line without losing the rest of the bag. */
        }
      }
    }
    return [...unique.values()].slice(0, 50);
  } catch {
    return [];
  }
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]),
    [config, setConfig] = useState<ShopConfig | null>(null),
    [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [cart, setCartState] = useState<CartLine[]>(readCart),
    [cartOpen, setCartOpen] = useState(false);
  const cartRef = useRef(cart);
  const setCart = (value: CartLine[] | ((current: CartLine[]) => CartLine[])) => {
    const next = typeof value === "function" ? value(cartRef.current) : value;
    cartRef.current = next;
    setCartState(next);
  };
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [profileOwner, setProfileOwner] = useState<string>();
  const [profileError, setProfileError] = useState("");
  const userRef = useRef(user?.id);
  userRef.current = user?.id;
  const refreshProfile = useCallback(async () => {
    const owner = userRef.current;
    if (!owner) return;
    try {
      const value = await api<CustomerProfile>("/customer");
      if (owner === userRef.current) { setProfile(value); setProfileOwner(owner); setProfileError(""); }
    } catch (err) { if (owner === userRef.current) setProfileError(errorMessage(err)); }
  }, []);
  useEffect(() => {
    setProfile(null); setProfileError("");
    if (!user?.id) return;
    void refreshProfile();
    const timer = setInterval(() => { if (!document.hidden) void refreshProfile(); }, 30_000);
    return () => clearInterval(timer);
  }, [user?.id, refreshProfile]);
  const refreshProducts = useCallback(async () => {
    setProducts(await api<Product[]>("/products"));
  }, []);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [menu, settings, session] = await Promise.all([
        api<Product[]>("/products"),
        api<ShopConfig>("/config"),
        api<{ user: User | null }>("/auth/me"),
      ]);
      setProducts(menu);
      setConfig(settings);
      setUser(session.user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    try {
      localStorage.setItem("pizza-house-cart", JSON.stringify(cart));
    } catch {
      setNotice(
        "Your browser cannot save the bag. Keep this tab open until checkout.",
      );
    }
  }, [cart]);
  const add = (
    id: string,
    quantity = 1,
    configuration?: PizzaConfiguration,
    openBag = true,
  ) => {
    const product = products.find((p) => p.id === id);
    if (!product || !product.active || product.stock < 1) {
      setNotice("This product is currently sold out.");
      return false;
    }
    let options: PizzaConfiguration | undefined;
    try {
      options = normalizeOptions(configuration);
      configuredPrice(product, options);
    } catch {
      setNotice("Please choose valid pizza options.");
      return false;
    }
    const key = cartKey({ id, options });
    const existingQuantity = cart
      .filter((line) => line.id === id)
      .reduce((sum, line) => sum + line.qty, 0);
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      existingQuantity + quantity > Math.min(99, product.stock)
    ) {
      setNotice(
        `Only ${Math.max(0, Math.min(99, product.stock) - existingQuantity)} more available to add.`,
      );
      return false;
    }
    if (cart.length >= 50 && !cart.some((line) => cartKey(line) === key)) {
      setNotice("Your bag can hold up to 50 different items.");
      return false;
    }
    setCart((current) => {
      const previous = current.find((line) => cartKey(line) === key);
      const total = current
        .filter((line) => line.id === id)
        .reduce((sum, line) => sum + line.qty, 0);
      if (
        total + quantity > Math.min(99, product.stock) ||
        (!previous && current.length >= 50)
      )
        return current;
      const qty = (previous?.qty ?? 0) + quantity;
      return previous
        ? current.map((line) =>
            cartKey(line) === key ? { ...line, qty } : line,
          )
        : [...current, { id, qty, ...(options ? { options } : {}) }];
    });
    setNotice(`${quantity} × ${product.name} added to your bag.`);
    if (openBag) setCartOpen(true);
    return true;
  };
  const change = (key: string, qty: number) => {
    if (!Number.isInteger(qty)) return;
    setCart((current) =>
      current
        .map((line) => {
          if (cartKey(line) !== key) return line;
          const stock = products.find((p) => p.id === line.id)?.stock ?? 0;
          const others = current
            .filter((other) => other.id === line.id && cartKey(other) !== key)
            .reduce((sum, other) => sum + other.qty, 0);
          return {
            ...line,
            qty: Math.max(0, Math.min(qty, 99 - others, stock - others)),
          };
        })
        .filter((line) => line.qty > 0),
    );
  };
  return (
    <StoreContext.Provider
      value={{
        profile: profileOwner === user?.id ? profile : null, refreshProfile, profileError,
        addMany: async (lines) => {
          try {
            const menu = await api<Product[]>("/products");
            setProducts(menu);
            // Merge after fetching, against the latest bag, so in-flight edits survive.
            const combined = mergeCart(cartRef.current, lines, menu);
            setCart(combined); setCartOpen(true);
            setNotice("Added to your bag at current prices. Review before checkout.");
            return true;
          } catch (err) { setNotice(errorMessage(err)); return false; }
        },
        products,
        config,
        user,
        setUser,
        loading,
        error,
        reload,
        refreshProducts,
        cart,
        cartOpen,
        setCartOpen,
        add,
        change,
        clearCart: () => setCart([]),
        notice,
        setNotice,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("StoreProvider is missing.");
  return store;
}
