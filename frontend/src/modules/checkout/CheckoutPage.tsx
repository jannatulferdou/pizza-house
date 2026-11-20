import { T } from "../../app/Locale";
import { cartKey } from "@pizza-house/shared/pizza-options";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Banknote, CreditCard, Smartphone, Truck } from "lucide-react";
import { useStore } from "../../app/StoreProvider";
import { api, errorMessage } from "../../shared/api";
import { money } from "@pizza-house/shared/commerce";
import type { Order, PaymentMethod, Quote } from "@pizza-house/shared/types";
import { EmptyState, ErrorMessage } from "../../components/Feedback";
function requestKey(fingerprint: string) {
    try {
        const old = JSON.parse(sessionStorage.getItem("ph-checkout-attempt") || "null") as {
            fingerprint: string;
            key: string;
        } | null;
        if (old?.fingerprint === fingerprint)
            return old.key;
        const key = crypto.randomUUID();
        sessionStorage.setItem("ph-checkout-attempt", JSON.stringify({ fingerprint, key }));
        return key;
    }
    catch {
        return crypto.randomUUID();
    }
}
export default function CheckoutPage() {
    const { user, cart, clearCart, config, refreshProducts, refreshProfile, setNotice, profile } = useStore(), navigate = useNavigate();
    const [zone, setZone] = useState(config?.zones[0]?.id ?? ""), [coupon, setCoupon] = useState(""), [applied, setApplied] = useState("");
    const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
    const [branchId, setBranchId] = useState(config?.branches.find(b => b.pickup)?.id || "");
    const [schedule, setSchedule] = useState("");
    const [later, setLater] = useState(false);
    const [redeemPoints, setRedeemPoints] = useState(0);
    const [addressId, setAddressId] = useState("");
    const savedAddress = profile?.addresses.find(a => a.id === addressId);
    const scheduledAt = later && schedule && Number.isFinite(new Date(`${schedule}+06:00`).getTime()) ? new Date(`${schedule}+06:00`).toISOString() : "";
    const [method, setMethod] = useState<PaymentMethod>("cod"), [quote, setQuote] = useState<Quote | null>(null), [quoteError, setQuoteError] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [quoting, setQuoting] = useState(false);
    const submitting = useRef(false), attempt = useRef<{
        fingerprint: string;
        key: string;
    } | null>(null);
    useEffect(() => {
        if (!user || !cart.length)
            return;
        const controller = new AbortController();
        setQuoting(true);
        setQuote(null);
        setQuoteError("");
        void api<Quote>("/orders/quote", {
            method: "POST",
            body: JSON.stringify({ items: cart, zoneId: zone, coupon: applied, fulfillment, branchId: fulfillment === "pickup" ? branchId : undefined, scheduledAt, redeemPoints }),
            signal: controller.signal,
        })
            .then(setQuote)
            .catch((err) => {
            if (!controller.signal.aborted)
                setQuoteError(errorMessage(err));
        })
            .finally(() => {
            if (!controller.signal.aborted)
                setQuoting(false);
        });
        return () => controller.abort();
    }, [user, cart, zone, applied, fulfillment, branchId, scheduledAt, redeemPoints]);
    if (!cart.length)
        return (<EmptyState title="Your bag is waiting." text="Add something delicious before checking out."/>);
    if (!user)
        return (<EmptyState title="One seat reserved for you." text="Sign in or create an account to place and track your order." to="/account?next=%2Fcheckout" action="Sign in to checkout"/>);
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (submitting.current || !quote || quoting)
            return;
        submitting.current = true;
        setBusy(true);
        setError("");
        const data = new FormData(event.currentTarget);
        const address = {
            name: String(data.get("name")),
            phone: String(data.get("phone")).trim(),
            street: fulfillment === "pickup" ? "" : String(data.get("street") || ""),
            zoneId: zone,
            notes: String(data.get("notes") || ""),
        };
        const body = {
            items: cart,
            address,
            paymentMethod: method,
            coupon: applied,
            expectedTotal: quote.total,
            fulfillment, branchId: fulfillment === "pickup" ? branchId : undefined, scheduledAt, redeemPoints,
        };
        const fingerprint = JSON.stringify(body);
        if (attempt.current?.fingerprint !== fingerprint)
            attempt.current = { fingerprint, key: requestKey(fingerprint) };
        try {
            const result = await api<{
                order: Order;
                paymentUrl?: string;
                paymentError?: string;
            }>("/orders", {
                method: "POST",
                body: JSON.stringify({ ...body, idempotencyKey: attempt.current.key }),
            });
            clearCart();
            try {
                sessionStorage.removeItem("ph-checkout-attempt");
            }
            catch {
                /* Browser storage is optional. */
            }
            void refreshProducts().catch(() => undefined);
            void refreshProfile();
            if (result.paymentError)
                setNotice(result.paymentError);
            if (result.paymentUrl) {
                window.location.assign(result.paymentUrl);
                return;
            }
            navigate(`/orders/${result.order.id}`);
        }
        catch (err) {
            setError(errorMessage(err));
        }
        finally {
            submitting.current = false;
            setBusy(false);
        }
    };
    return (<div className="shop-page">
      <Link className="back-link" to="/#menu"><T space>{"\u2190 Keep exploring"}</T></Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow"><T space>{"GOOD MOOD, ON ITS WAY"}</T></span>
          <h1><T space>{"Make it yours."}</T></h1>
          <p><T space>{"A few details, then leave the cooking to us."}</T></p>
        </div>
      </div>
      <form className="checkout-layout" onSubmit={submit}>
        <div className="form-stack">
          <section className="panel form-stack">
            <h2 className="subheading"><T space>{"01 / Where to?"}</T></h2>
            <div className="form-grid"><label><T space>{"Order type"}</T><select value={fulfillment} onChange={e => setFulfillment(e.target.value as "delivery" | "pickup")}><option value="delivery"><T space>{"Delivery"}</T></option><option value="pickup" disabled={!config?.branches.some(b => b.pickup)}><T space>{"Pickup"}</T></option></select></label>
            <T>{fulfillment === "pickup" && <label><T space>{"Pickup branch"}</T><select value={branchId} onChange={e => setBranchId(e.target.value)} required><T>{config?.branches.filter(b => b.pickup).map(b => <option key={b.id} value={b.id}><T>{b.name}</T></option>)}</T></select></label>}</T></div>
            <T>{fulfillment === "pickup" && <p><T>{config?.branches.find(b => b.id === branchId)?.address}</T></p>}</T>
            <label><T space>{"When would you like it?"}</T><select value={later ? "later" : "now"} onChange={e => setLater(e.target.value === "later")}><option value="now"><T space>{"As soon as possible"}</T></option><option value="later"><T space>{"Schedule for later"}</T></option></select></label>
            <T>{later && <label><T space>{"Preferred time (Bangladesh time, UTC+6)"}</T><input type="datetime-local" value={schedule} onChange={e => setSchedule(e.target.value)} required/><small><T space>{"Between one hour and seven days ahead, during shop opening hours."}</T></small></label>}</T>
            <T>{fulfillment === "delivery" && <label><T space>{"Saved address"}</T><select value={addressId} onChange={e => { const id = e.target.value; setAddressId(id); const address = profile?.addresses.find(a => a.id === id); if (address)
        setZone(address.zoneId); }}><option value=""><T space>{"Enter a new address"}</T></option><T>{profile?.addresses.map(a => <option key={a.id} value={a.id}><T>{a.label}</T> — <T>{a.street}</T></option>)}</T></select><Link to="/account"><T space>{"Manage saved addresses"}</T></Link></label>}</T>
            <fieldset className="address-fields form-stack" key={`${addressId}:${fulfillment}`}>
            <div className="form-grid">
              <label><T space>{"Full name"}</T><input name="name" autoComplete="name" defaultValue={savedAddress?.name || user.name} required minLength={2} maxLength={80}/>
              </label>
              <label><T space>{"Mobile number"}</T><input name="phone" defaultValue={savedAddress?.phone || profile?.preferences.phone} type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" pattern="(\+?88)?01[3-9][0-9]{8}" required maxLength={14}/>
              </label>
            </div>
            <T>{fulfillment === "delivery" && <><label><T space>{"Delivery area"}</T><select value={zone} onChange={(e) => setZone(e.target.value)} required>
                <T>{config?.zones.map((z) => (<option key={z.id} value={z.id}>
                    <T>{z.name}</T> — <T>{money(z.fee)}</T>
                  </option>))}</T>
              </select>
            </label>
            <label><T space>{"House, road & full address"}</T><textarea name="street" defaultValue={savedAddress?.street} autoComplete="street-address" required minLength={10} maxLength={300} rows={3} placeholder="House number, road, building and nearby landmark"/>
            </label></>}</T>
            <label><T space>{"Delivery instructions"}</T><small><T space>{"(optional)"}</T></small>
              <textarea name="notes" defaultValue={savedAddress?.notes} rows={2} maxLength={500} placeholder="Anything your rider should know?"/>
            </label>
            </fieldset>
            <p className="inline-note">
              <Truck size={17}/>
              <T>{fulfillment === "pickup" ? "Collect from your selected branch. We will update your order when it is ready." : `${config?.zones.find((z) => z.id === zone)?.eta} after confirmation. An estimate, not a guaranteed arrival.`}</T>
            </p>
          </section>
          <section className="panel form-stack">
            <h2 className="subheading"><T space>{"02 / How would you like to pay?"}</T></h2>
            <T>{([
        { id: "cod", name: fulfillment === "pickup" ? "Cash at pickup" : "Cash on delivery", icon: Banknote },
        { id: "bkash", name: "bKash", icon: Smartphone },
        { id: "nagad", name: "Nagad", icon: Smartphone },
        { id: "card", name: "Debit / credit card", icon: CreditCard },
    ] as const).map(({ id, name, icon: Icon }) => (<label className={`payment-option ${method === id ? "selected" : ""}`} key={id}>
                <input type="radio" name="payment" checked={method === id} onChange={() => setMethod(id)} disabled={id !== "cod" && !config?.onlinePayments}/>
                <Icon size={21}/>
                <span>
                  <T>{name}</T>
                  <small>
                    <T>{id === "cod"
        ? fulfillment === "pickup" ? "Pay at the counter when collecting" : "Pay your rider when your meal arrives"
        : config?.onlinePayments
            ? "Choose your method on secure hosted checkout"
            : "Currently unavailable"}</T>
                  </small>
                </span>
              </label>))}</T>
            <T>{method !== "cod" && (<p className="inline-note">
                <T>{config?.sandbox
        ? "Sandbox checkout: test payments only."
        : "Payment opens on SSLCommerz."}</T><T space>{" "}</T><T space>{"Available wallets and cards depend on the merchant account."}</T></p>)}</T>
          </section>
        </div>
        <aside className="panel checkout-summary">
          <h2 className="subheading"><T space>{"Your good stuff"}</T></h2>
          <T>{quote?.items.map((i) => (<div className="summary-item" key={cartKey(i)}>
              <img src={i.image} alt=""/>
              <span>
                <T>{i.qty}</T> × <T>{i.name}</T>
              </span>
              <b><T>{money(i.price * i.qty)}</T></b>
            </div>))}</T>
          <div className="coupon-row">
            <label><T space>{"Offer code"}</T><input value={coupon} maxLength={30} onChange={(e) => setCoupon(e.target.value)} placeholder="HOUSE10"/>
            </label>
            <button className="pill" type="button" disabled={busy} onClick={() => setApplied(coupon.trim().toUpperCase())}><T space>{"Apply"}</T></button>
          </div>
          <T>{applied && (<button className="text-button" type="button" onClick={() => {
            setApplied("");
            setCoupon("");
        }}><T space>{"Remove"}</T><T>{applied}</T>
            </button>)}</T>
          <ErrorMessage message={quoteError}/>
          <label className="loyalty-checkout"><T space>{"Use loyalty points ("}</T><T>{profile?.points || 0}</T><T space>{"available)"}</T><input type="number" min={0} max={profile?.points || 0} step={1} value={redeemPoints} onChange={e => setRedeemPoints(Math.max(0, Math.floor(Number(e.target.value) || 0)))}/><small><T space>{"1 point = \u09F31. Up to 20% of discounted food total."}</T></small></label>
          <T>{quoting && <p role="status"><T space>{"Calculating your total\u2026"}</T></p>}</T>
          <T>{quote && (<dl className="totals">
              <div>
                <dt><T space>{"Food subtotal"}</T></dt>
                <dd><T>{money(quote.subtotal)}</T></dd>
              </div>
              <T>{quote.discount > 0 && (<div className="discount">
                  <dt><T space>{"Offer \u00B7"}</T><T>{quote.coupon}</T></dt>
                  <dd>−<T>{money(quote.discount)}</T></dd>
                </div>)}</T>
              <div>
                <dt><T space>{"Delivery"}</T></dt>
                <dd><T>{money(quote.deliveryFee)}</T></dd>
              </div>
              <T>{!!quote.loyaltyDiscount && <div className="discount"><dt><T space>{"Loyalty savings"}</T></dt><dd>−<T>{money(quote.loyaltyDiscount)}</T></dd></div>}</T>
              <div className="grand-total">
                <dt><T space>{"Total"}</T></dt>
                <dd><T>{money(quote.total)}</T></dd>
              </div>
            </dl>)}</T>
          <label className="checkbox-label">
            <input type="checkbox" required/>
            <span><T space>{"I have checked the allergens and agree to the"}</T><T space>{" "}</T>
              <Link to="/policies" target="_blank" rel="noreferrer"><T space>{"store policies"}</T></Link>
              .
            </span>
          </label>
          <ErrorMessage message={error}/>
          <button className="pill dark full-width" disabled={busy || quoting || !quote || (later && !scheduledAt)}>
            <T>{busy
        ? "Placing your order…"
        : method === "cod"
            ? "Place order ↗"
            : "Continue to secure payment ↗"}</T>
          </button>
          <p className="small-note"><T space>{"Your order and delivery progress will appear in your account."}</T></p>
        </aside>
      </form>
    </div>);
}
