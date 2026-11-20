import { T } from "../../../app/Locale";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "../../../shared/api";
import { statusLabel } from "@pizza-house/shared/commerce";
import type { Product } from "@pizza-house/shared/types";
import { Dialog } from "../../../components/Dialog";
import { ErrorMessage } from "../../../components/Feedback";
import { useStore } from "../../../app/StoreProvider";
const emptyProduct = {
    name: "",
    description: "",
    price: 300,
    stock: 30,
    category: "Pizzas",
    ingredients: "",
    serving: "One 12-inch pizza",
    diet: "Vegetarian",
    image: "/images/pizza-pizza.jpg",
    allergens: "",
    storage: "",
    shelfLife: "",
    active: true,
};
export function ProductEditor({ product, onSave, onClose, }: {
    product: Product | null;
    onSave: () => Promise<void>;
    onClose: () => void;
}) {
    const [error, setError] = useState(""), [busy, setBusy] = useState(false);
    const value = product ?? emptyProduct;
    const { products } = useStore();
    const [category, setCategory] = useState(value.category);
    const [bundle, setBundle] = useState(product?.bundle || []);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        const input = {
            ...Object.fromEntries(data),
            price: Number(data.get("price")),
            stock: Number(data.get("stock")),
            active: data.get("active") === "on",
            category, bundle: category === "Combos" ? bundle : [],
        };
        try {
            await api(`/admin/products${product ? `/${product.id}` : ""}`, {
                method: product ? "PATCH" : "POST",
                body: JSON.stringify(input),
            });
            await onSave();
            onClose();
        }
        catch (err) {
            setError(errorMessage(err));
        }
        finally {
            setBusy(false);
        }
    };
    return (<Dialog title={product ? "Edit your favorite" : "Add a new favorite"} onClose={onClose}>
      <form className="form-stack editor-form" onSubmit={submit}>
        <label><T space>{"Product name"}</T><input name="name" defaultValue={value.name} required minLength={2} maxLength={100}/>
        </label>
        <label><T space>{"Description"}</T><textarea name="description" defaultValue={value.description} required minLength={5} maxLength={500}/>
        </label>
        <div className="form-grid">
          <label><T space>{"Price (\u09F3)"}</T><input name="price" type="number" min="1" max="100000" step="1" defaultValue={value.price} required/>
          </label>
          <label><T space>{"Available stock"}</T><input name="stock" type="number" min="0" max="100000" step="1" defaultValue={value.stock} required/>
          </label>
          <label><T space>{"Category"}</T><select name="category" value={category} onChange={e => setCategory(e.target.value)}>
              <T>{["Pizzas", "Burgers", "Sides", "Drinks", "Combos"].map((c) => (<option key={c} value={c}><T>{c}</T></option>))}</T>
            </select>
          </label>
          <label><T space>{"Diet"}</T><input name="diet" defaultValue={value.diet} maxLength={100}/>
          </label>
        </div>
        <T>{category === "Combos" && <fieldset className="form-stack"><legend><T space>{"Combo components"}</T></legend><p><T space>{"Availability comes from component stock. Add the ingredients and allergens of every component to this listing."}</T></p><T>{bundle.map((part, index) => <div className="form-grid" key={index}><label><T space>{"Meal"}</T><select value={part.id} onChange={e => setBundle(bundle.map((p, i) => i === index ? { ...p, id: e.target.value } : p))} required><option value=""><T space>{"Choose a meal"}</T></option><T>{products.filter(p => p.category !== "Combos" && p.id !== product?.id).map(p => <option key={p.id} value={p.id}><T>{p.name}</T></option>)}</T></select></label><label><T space>{"Quantity"}</T><input type="number" min={1} max={20} value={part.qty} required onChange={e => setBundle(bundle.map((p, i) => i === index ? { ...p, qty: Number(e.target.value) } : p))}/></label><button type="button" className="text-button" onClick={() => setBundle(bundle.filter((_, i) => i !== index))}><T space>{"Remove component"}</T></button></div>)}</T><button type="button" className="pill" disabled={bundle.length >= 10} onClick={() => setBundle([...bundle, { id: "", qty: 1 }])}><T space>{"Add component"}</T></button></fieldset>}</T>
        <label><T space>{"Serving / portion"}</T><input name="serving" defaultValue={value.serving} minLength={2} maxLength={100} required/>
        </label>
        <label><T space>{"Ingredients"}</T><textarea name="ingredients" defaultValue={value.ingredients} required minLength={2} maxLength={500}/>
        </label>
        <label><T space>{"Allergens"}</T><textarea name="allergens" defaultValue={value.allergens} required minLength={2} maxLength={500}/>
        </label>
        <label><T space>{"Storage guidance"}</T><textarea name="storage" defaultValue={value.storage} required minLength={2} maxLength={500}/>
        </label>
        <label><T space>{"Freshness / shelf life"}</T><textarea name="shelfLife" defaultValue={value.shelfLife} required minLength={2} maxLength={500}/>
        </label>
        <label><T space>{"Product image"}</T><select name="image" defaultValue={value.image}><option value="/images/lemon-cooler.jpg">Lemon cooler photo</option>
            <T>{[
        "pizza-pizza",
        "pizza-pepperoni",
        "pizza-bbq-chicken",
        "pizza-four-cheese",
        "pizza-veggie",
        "pizza-mushroom",
        "pizza-hawaiian",
        "pizza-meat-feast",
        "pizza-chicken-tikka",
        "pizza-spicy-beef",
        "pizza-mediterranean",
        "pizza-pesto",
        "pizza-vegan",
        "burger",
        "fries",
        "kitchen",
        "orange-cooler",
        "watermelon-cooler",
        "iced-tea",
    ].map((name) => (<option key={name} value={`/images/${name}.jpg`}>
                <T>{statusLabel(name.replaceAll("-", " "))}</T>
              </option>))}</T>
          </select>
        </label>
        <label className="checkbox-label">
          <input name="active" type="checkbox" defaultChecked={value.active}/><T space>{"Available on the menu"}</T></label>
        <ErrorMessage message={error}/>
        <button className="pill dark" disabled={busy}>
          <T>{busy ? "Saving…" : "Save product"}</T>
        </button>
      </form>
    </Dialog>);
}
