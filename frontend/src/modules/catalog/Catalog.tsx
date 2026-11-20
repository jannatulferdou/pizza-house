import { T } from "../../app/Locale";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Star } from "lucide-react";
import { useStore } from "../../app/StoreProvider";
import { money } from "@pizza-house/shared/commerce";
import type { Product } from "@pizza-house/shared/types";
import { ProductQuickView } from "./ProductQuickView";
import { FavouriteButton } from "../account/CustomerExtras";
export function Catalog() {
    const { products, add } = useStore();
    const [quickView, setQuickView] = useState<Product | null>(null);
    const [added, setAdded] = useState<string | null>(null);
    const [category, setCategory] = useState("All"), [search, setSearch] = useState(""), [sort, setSort] = useState("featured"), [maxPrice, setMaxPrice] = useState("");
    const categories = [
        "All",
        "Pizzas",
        "Vegetarian",
        "Meat pizzas",
        "Burgers & fries",
        "Drinks",
        "Combos",
    ];
    const visible = useMemo(() => {
        const result = products.filter((p) => (category === "All" ||
            (category === "Pizzas" && p.category === "Pizzas") ||
            (category === "Vegetarian" &&
                ["Vegetarian", "Plant based"].includes(p.diet)) ||
            (category === "Meat pizzas" &&
                p.category === "Pizzas" &&
                p.diet.startsWith("Contains")) ||
            (category === "Burgers & fries" && ["Burgers", "Sides"].includes(p.category)) ||
            (category === "Drinks" && p.category === "Drinks") ||
            (category === "Combos" && p.category === "Combos")) &&
            `${p.name} ${p.ingredients}`
                .toLowerCase()
                .includes(search.trim().toLowerCase()) &&
            (!maxPrice || p.price <= Number(maxPrice)));
        if (sort === "low")
            result.sort((a, b) => a.price - b.price);
        if (sort === "high")
            result.sort((a, b) => b.price - a.price);
        if (sort === "rated")
            result.sort((a, b) => b.rating - a.rating);
        return result;
    }, [products, category, search, sort, maxPrice]);
    return (<section className="menu-section" id="menu">
      <div className="section-heading">
        <div>
          <span className="eyebrow"><T space>{"02 / MEET YOUR FAVORITES"}</T></span>
          <h2><T space>{"All the right cravings."}</T></h2>
        </div>
        <p><T space>{"Pizzas. Burgers. Golden fries."}</T><br /><T space>{"Find your kind of favorite."}</T></p>
      </div>
      <div className="menu-tools">
        <div className="menu-filters" role="group" aria-label="Filter menu">
          <T>{categories.map((c) => (<button key={c} aria-pressed={category === c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>
              <T>{c}</T>
            </button>))}</T>
        </div>
        <label className="menu-search">
          <span className="sr-only"><T space>{"Search menu by name or ingredient"}</T></span>
          <input type="search" placeholder="Find a pizza or ingredient…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        </label>
      </div>
      <div className="catalog-controls">
        <p className="menu-count" aria-live="polite">
          <T>{visible.length}</T><T space>{"favorites to explore"}</T></p>
        <label><T space>{"Up to \u09F3"}</T><T space>{" "}</T>
          <input aria-label="Maximum price in taka" type="number" min="0" step="10" placeholder="Any price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}/>
        </label>
        <label><T space>{"Sort"}</T><T space>{" "}</T>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured"><T space>{"Featured"}</T></option>
            <option value="low"><T space>{"Price: low to high"}</T></option>
            <option value="high"><T space>{"Price: high to low"}</T></option>
            <option value="rated"><T space>{"Top rated"}</T></option>
          </select>
        </label>
      </div>
      <div className="menu-grid">
        <T>{visible.map((p, index) => (<article className="food-card" key={p.id}>
            <div className={`food-image ${p.category === "Pizzas" ? "pizza-image" : ""}`}>
              <Link to={`/products/${p.id}`} aria-label={`View ${p.name}`}>
                <img src={p.image} alt={p.name} loading="lazy"/>
              </Link>
              <span className="food-number">
                <T>{String(index + 1).padStart(2, "0")}</T>
              </span>
              <button aria-label={`Add ${p.name} to bag`} disabled={!p.stock} className={added === p.id ? "just-added" : ""} onClick={() => {
            if (add(p.id, 1, undefined, false))
                setAdded(p.id);
        }}>
                <T>{added === p.id ? (<span aria-label="Added">✓</span>) : (<Plus size={22}/>)}</T>
              </button>
            </div>
            <span className="eyebrow"><T>{p.category}</T></span>
            <FavouriteButton id={p.id}/>
            <div className="food-title">
              <h3>
                <Link to={`/products/${p.id}`}><T>{p.name}</T></Link>
              </h3>
              <span><T>{money(p.price)}</T></span>
            </div>
            <p><T>{p.description}</T></p>
            <p className="menu-ingredients"><T>{p.ingredients}</T></p>
            <div className="menu-meta">
              <span><T>{p.serving}</T></span>
              <span><T>{p.diet}</T></span>
            </div>
            <div className="product-bottom">
              <span className="rating">
                <Star size={13}/>
                <T>{p.reviewCount
        ? `${p.rating.toFixed(1)} (${p.reviewCount})`
        : "No reviews yet"}</T>
              </span>
              <Link to={`/products/${p.id}`}>
                <T>{p.stock ? "Details & allergens ↗" : "Sold out · Details ↗"}</T>
              </Link>
            </div>
            <button className="quick-view-trigger" onClick={() => setQuickView(p)} aria-haspopup="dialog">
              <T>{p.category === "Pizzas"
        ? "Quick view & customize"
        : "Quick view"}</T><T space>{" "}</T>
              <span>↗</span>
            </button>
          </article>))}</T>
      </div>
      <T>{!visible.length && (<div className="menu-empty">
          <h3><T space>{"No favorites found."}</T></h3>
          <p><T space>{"Try another ingredient or price range."}</T></p>
          <button className="pill" onClick={() => {
            setSearch("");
            setCategory("All");
            setMaxPrice("");
        }}><T space>{"Show the full menu"}</T></button>
        </div>)}</T>
      <p className="demo-note"><T space>{"Sample menu and prices. Pizza images are AI-created concept illustrations. Check ingredients and allergens before ordering."}</T></p>
      <T>{quickView && (<ProductQuickView key={quickView.id} product={products.find((p) => p.id === quickView.id) ?? quickView} onClose={() => setQuickView(null)}/>)}</T>
    </section>);
}
