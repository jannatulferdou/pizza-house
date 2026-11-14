import { T } from "../../app/Locale";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Minus, Plus } from "lucide-react";
import { Dialog } from "../../components/Dialog";
import { useStore } from "../../app/StoreProvider";
import { money } from "../../shared/commerce";
import { configuredPrice, defaultPizza } from "../../shared/pizza-options";
import type { PizzaConfiguration, Product } from "../../shared/types";
import { ConfiguredPhoto, PizzaOptions } from "./PizzaOptions";
export function ProductQuickView({ product, onClose, }: {
    product: Product;
    onClose: () => void;
}) {
    const [options, setOptions] = useState<PizzaConfiguration>(defaultPizza);
    const [quantity, setQuantity] = useState(1);
    const { add } = useStore();
    const pizza = product.category === "Pizzas";
    const price = configuredPrice(product, pizza ? options : undefined);
    return (<Dialog title={product.name} onClose={onClose} className="quick-view-dialog">
      <div className="quick-view-grid">
        <div className="quick-view-art">
          <T>{pizza ? (<ConfiguredPhoto src={product.image} name={product.name} value={options}/>) : (<img src={product.image} alt={product.name}/>)}</T>
          <span className="eyebrow">
            <T>{product.category}</T> / <T>{product.diet}</T>
          </span>
          <p><T>{product.description}</T></p>
          <dl>
            <dt><T space>{"Ingredients"}</T></dt>
            <dd><T>{product.ingredients}</T></dd>
            <dt><T space>{"Allergens"}</T></dt>
            <dd><T>{product.allergens}</T></dd>
          </dl>
          <Link className="text-link" to={`/products/${product.id}`} onClick={onClose}><T space>{"Full details & reviews"}</T><ArrowUpRight size={14}/>
          </Link>
        </div>
        <div>
          <T>{pizza ? (<PizzaOptions value={options} onChange={setOptions}/>) : (<p className="quick-serving"><T>{product.serving}</T></p>)}</T>
          <div className="quick-view-buy">
            <div className="quantity">
              <button aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((q) => q - 1)}>
                <Minus size={15}/>
              </button>
              <span aria-live="polite"><T>{quantity}</T></span>
              <button aria-label="Increase quantity" disabled={quantity >= Math.min(99, product.stock)} onClick={() => setQuantity((q) => q + 1)}>
                <Plus size={15}/>
              </button>
            </div>
            <span className="live-price" aria-live="polite">
              <T>{money(price * quantity)}</T>
            </span>
          </div>
          <button className="pill dark quick-add" disabled={!product.stock} onClick={() => {
            if (add(product.id, quantity, pizza ? options : undefined))
                onClose();
        }}>
            <T>{product.stock ? "Add your favorite to bag" : "Sold out"}</T>
            <ArrowUpRight size={18}/>
          </button>
        </div>
      </div>
    </Dialog>);
}
