import { T } from "../../app/Locale";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Star } from "lucide-react";
import { useStore } from "../../app/StoreProvider";
import { api, errorMessage } from "../../shared/api";
import { money } from "@pizza-house/shared/commerce";
import type { Review, PizzaConfiguration } from "@pizza-house/shared/types";
import { configuredPrice, defaultPizza } from "@pizza-house/shared/pizza-options";
import { ConfiguredPhoto, PizzaOptions } from "./PizzaOptions";
import { EmptyState, ErrorMessage } from "../../components/Feedback";
import { FavouriteButton } from "../account/CustomerExtras";
export default function ProductPage() {
    const { id } = useParams();
    const { user } = useStore();
    return <ProductDetails key={`${user?.id ?? "guest"}:${id}`}/>;
}
function ProductDetails() {
    const { id } = useParams(), { products, add, user, refreshProducts } = useStore();
    const product = products.find((p) => p.id === id);
    const [options, setOptions] = useState<PizzaConfiguration>(defaultPizza);
    const [quantity, setQuantity] = useState(1), [reviews, setReviews] = useState<Review[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        setQuantity(1);
        setError("");
        setSaved(false);
        void api<Review[]>(`/products/${id}/reviews`, { signal: controller.signal })
            .then(setReviews)
            .catch((err) => {
            if (!controller.signal.aborted)
                setError(errorMessage(err));
        });
        return () => controller.abort();
    }, [id]);
    if (!product)
        return (<EmptyState title="This favorite is unavailable." text="Choose something else from our menu."/>);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setError("");
        setSaved(false);
        try {
            await api(`/products/${id}/reviews`, {
                method: "POST",
                body: JSON.stringify({
                    rating: Number(data.get("rating")),
                    comment: data.get("comment"),
                }),
            });
            setReviews(await api<Review[]>(`/products/${id}/reviews`));
            await refreshProducts();
            form.reset();
            setSaved(true);
        }
        catch (err) {
            setError(errorMessage(err));
        }
        finally {
            setBusy(false);
        }
    };
    return (<div className="shop-page">
      <Link className="back-link" to="/#menu"><T space>{"\u2190 Back to the menu"}</T></Link>
      <section className="product-detail">
        <T>{product.category === "Pizzas" ? (<div className="detail-photo">
            <ConfiguredPhoto src={product.image} name={product.name} value={options}/>
          </div>) : (<img className="detail-photo" src={product.image} alt={product.name}/>)}</T>
        <div>
          <span className="eyebrow">
            <T>{product.category}</T> / <T>{product.diet}</T>
          </span>
          <h1><T>{product.name}</T></h1>
          <FavouriteButton id={product.id} />
          <p><T>{product.description}</T></p>
          <div className="detail-price">
            <T>{money(configuredPrice(product, product.category === "Pizzas" ? options : undefined))}</T><T space>{" "}</T>
            <small>
              <T>{product.category === "Pizzas"
        ? options.size === "large"
            ? "One 14-inch pizza"
            : "One 12-inch pizza"
        : product.serving}</T>
            </small>
          </div>
          <div className="rating">
            <Star size={16}/>
            <T>{product.reviewCount
        ? `${product.rating.toFixed(1)} · ${product.reviewCount} reviews`
        : "Be the first to review after delivery"}</T>
          </div>
          <dl className="product-facts">
            <div>
              <dt><T space>{"Ingredients"}</T></dt>
              <dd><T>{product.ingredients}</T></dd>
            </div>
            <div>
              <dt><T space>{"Allergens"}</T></dt>
              <dd><T>{product.allergens}</T></dd>
            </div>
            <div>
              <dt><T space>{"Storage"}</T></dt>
              <dd><T>{product.storage}</T></dd>
            </div>
            <div>
              <dt><T space>{"Freshness & shelf life"}</T></dt>
              <dd><T>{product.shelfLife}</T></dd>
            </div>
          </dl>
          <p>
            <T>{product.stock
        ? `${product.stock} available today`
        : "Currently sold out"}</T>
          </p>
          <T>{product.category === "Pizzas" && (<PizzaOptions value={options} onChange={setOptions}/>)}</T>
          <div className="order-actions">
            <label className="qty-field"><T space>{"Quantity"}</T><input type="number" min="1" max={Math.max(1, Math.min(99, product.stock))} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(99, product.stock, Number(e.target.value) || 1)))}/>
            </label>
            <button className="pill dark" disabled={!product.stock} onClick={() => add(product.id, quantity, product.category === "Pizzas" ? options : undefined)}><T space>{"Add to bag \u2014"}</T><T space>{" "}</T>
              <T>{money(configuredPrice(product, product.category === "Pizzas" ? options : undefined) * quantity)}</T><T space>{" "}</T>
              ↗
            </button>
          </div>
        </div>
      </section>
      <section className="reviews-section">
        <span className="eyebrow"><T space>{"FROM OUR TABLE"}</T></span>
        <h2><T space>{"Real orders. Honest thoughts."}</T></h2>
        <div className="reviews-layout">
          <div>
            <T>{reviews.length ? (reviews.map((review) => (<article className="review-card" key={review.id}>
                  <div>
                    <b><T>{review.name}</T></b>
                    <span className="rating">
                      <T>{"★".repeat(review.rating)}</T>
                      <T>{"☆".repeat(5 - review.rating)}</T>
                    </span>
                  </div>
                  <small><T space>{"Verified purchase \u00B7"}</T><T space>{" "}</T>
                    <T>{new Date(review.createdAt).toLocaleDateString()}</T>
                  </small>
                  <p><T>{review.comment}</T></p>
                </article>))) : (<p><T space>{"No reviews yet. Reviews come from customers with delivered orders."}</T></p>)}</T>
          </div>
          <form className="panel form-stack" onSubmit={submit}>
            <h3><T space>{"Share your experience"}</T></h3>
            <p><T space>{"After delivery, leave one review per product. Submitting again updates your review."}</T></p>
            <T>{user ? (<>
                <label><T space>{"Your rating"}</T><select name="rating" defaultValue="5">
                    <T>{[5, 4, 3, 2, 1].map((n) => (<option key={n} value={n}>
                        <T>{n}</T><T space>{"star"}</T><T>{n > 1 ? "s" : ""}</T>
                      </option>))}</T>
                  </select>
                </label>
                <label><T space>{"Your review"}</T><textarea name="comment" required minLength={10} maxLength={1000} rows={4} placeholder="How was your meal?"/>
                </label>
                <button className="pill dark" disabled={busy}>
                  <T>{busy ? "Saving…" : "Post review"}</T>
                </button>
              </>) : (<Link className="pill dark" to={`/account?next=${encodeURIComponent(`/products/${id}`)}`}><T space>{"Sign in to review"}</T></Link>)}</T>
            <ErrorMessage message={error}/>
            <T>{saved && (<p className="alert success" role="status"><T space>{"Your review has been saved."}</T></p>)}</T>
          </form>
        </div>
      </section>
    </div>);
}
