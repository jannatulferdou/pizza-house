import { T } from "../../app/Locale";
import { useLocation } from "react-router-dom";
import { ShoppingBag, ArrowUpRight } from "lucide-react";
import { useStore } from "../../app/StoreProvider";
import { configuredPrice } from "@pizza-house/shared/pizza-options";
import { money } from "@pizza-house/shared/commerce";
export function MobileCartBar() {
    const { cart, products, cartOpen, setCartOpen } = useStore();
    const { pathname } = useLocation();
    if (!cart.length ||
        cartOpen ||
        (pathname !== "/" && !pathname.startsWith("/products/")))
        return null;
    const total = cart.reduce((sum, line) => {
        const product = products.find((p) => p.id === line.id);
        return (sum + (product ? configuredPrice(product, line.options) * line.qty : 0));
    }, 0);
    return (<div className="mobile-cart-bar">
      <span>
        <ShoppingBag size={18}/>
        <T>{cart.reduce((sum, line) => sum + line.qty, 0)}</T><T space>{"items"}</T><T space>{" "}</T>
        <b><T>{money(total)}</T></b>
      </span>
      <button onClick={() => setCartOpen(true)}><T space>{"Bag & checkout"}</T><ArrowUpRight size={17}/>
      </button>
    </div>);
}
