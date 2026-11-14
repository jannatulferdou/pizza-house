import { T } from "../../app/Locale";
import { Link } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useStore } from "../../app/StoreProvider";
import { Dialog } from "../../components/Dialog";
import { money } from "../../shared/commerce";
import { cartKey, configurationLabel, configuredPrice, } from "../../shared/pizza-options";
export function CartDrawer() {
    const { cart, products, cartOpen, setCartOpen, change } = useStore();
    if (!cartOpen)
        return null;
    const total = cart.reduce((sum, line) => {
        const product = products.find((p) => p.id === line.id);
        return (sum + (product ? configuredPrice(product, line.options) : 0) * line.qty);
    }, 0);
    const unavailable = cart.some((line) => {
        const p = products.find((p) => p.id === line.id);
        return (!p ||
            p.stock <
                cart
                    .filter((item) => item.id === line.id)
                    .reduce((sum, item) => sum + item.qty, 0));
    });
    return (<Dialog side title={`Your bag (${cart.reduce((sum, i) => sum + i.qty, 0)})`} onClose={() => setCartOpen(false)}>
      <T>{cart.length ? (<>
          <div className="cart-items">
            <T>{cart.map((line) => {
        const product = products.find((p) => p.id === line.id);
        const key = cartKey(line);
        const price = product
            ? configuredPrice(product, line.options)
            : 0;
        const totalQuantity = cart
            .filter((item) => item.id === line.id)
            .reduce((sum, item) => sum + item.qty, 0);
        return (<article className="cart-item" key={key}>
                  <T>{product && <img src={product.image} alt={product.name}/>}</T>
                  <div>
                    <h3><T>{product?.name ?? "Unavailable product"}</T></h3>
                    <T>{line.options && (<p className="cart-configuration">
                        <T>{configurationLabel(line.options)}</T>
                      </p>)}</T>
                    <p><T>{product ? money(price) : "Remove this item"}</T><T space>{"each"}</T></p>
                    <div className="quantity">
                      <button aria-label={`Remove one ${product?.name ?? "item"}`} onClick={() => change(key, line.qty - 1)}>
                        <Minus size={14}/>
                      </button>
                      <span key={line.qty} className="quantity-value" aria-live="polite">
                        <T>{line.qty}</T>
                      </span>
                      <button aria-label={`Add one ${product?.name ?? "item"}`} disabled={!product ||
                totalQuantity >= Math.min(99, product.stock)} onClick={() => change(key, line.qty + 1)}>
                        <Plus size={14}/>
                      </button>
                    </div>
                    <T>{product && product.stock < totalQuantity && (<p className="field-error"><T space>{"Only"}</T><T>{product.stock}</T><T space>{"available."}</T></p>)}</T>
                  </div>
                  <div className="cart-line-end">
                    <b><T>{money(price * line.qty)}</T></b>
                    <button aria-label={`Remove ${product?.name ?? "unavailable item"}`} onClick={() => change(key, 0)}>
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </article>);
    })}</T>
          </div>
          <div className="cart-total">
            <p>
              <span><T space>{"Subtotal"}</T></span>
              <b><T>{money(total)}</T></b>
            </p>
            <small><T space>{"Delivery calculated at checkout. Apply your offer code there."}</T></small>
            <T>{unavailable ? (<p className="alert error"><T space>{"Adjust unavailable items before checkout."}</T></p>) : (<Link className="pill dark" to="/checkout" onClick={() => setCartOpen(false)}><T space>{"Continue to checkout \u2197"}</T></Link>)}</T>
            <button className="text-button" onClick={() => setCartOpen(false)}><T space>{"Keep exploring"}</T></button>
          </div>
        </>) : (<div className="empty-state">
          <h3><T space>{"A little room for something good."}</T></h3>
          <p><T space>{"Your next favorite is waiting."}</T></p>
          <Link className="pill dark" to="/#menu" onClick={() => setCartOpen(false)}><T space>{"Explore the menu \u2197"}</T></Link>
        </div>)}</T>
    </Dialog>);
}
