import { T } from "../../app/Locale";
import { cartKey } from "@pizza-house/shared/pizza-options";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Package, Truck } from "lucide-react";
import { useStore } from "../../app/StoreProvider";
import { api, errorMessage } from "../../shared/api";
import { money, statusLabel } from "@pizza-house/shared/commerce";
import type { Order } from "@pizza-house/shared/types";
import { EmptyState, ErrorMessage, Loading } from "../../components/Feedback";
import { ReorderButton } from "./ReorderButton";
export default function OrderPage() {
    const { id } = useParams();
    const { user } = useStore();
    return <OrderDetails key={`${user?.id ?? "guest"}:${id}`}/>;
}
function OrderDetails() {
    const { id } = useParams(), { user, refreshProducts } = useStore();
    const [order, setOrder] = useState<Order | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [cancelPrompt, setCancelPrompt] = useState(false);
    const load = useCallback(async () => {
        try {
            setOrder(await api<Order>(`/orders/${id}`));
            setError("");
        }
        catch (err) {
            setError(errorMessage(err));
        }
    }, [id]);
    useEffect(() => {
        if (!user)
            return;
        let active = true;
        const update = async () => {
            try {
                const data = await api<Order>(`/orders/${id}`);
                if (active) {
                    setOrder(data);
                    setError("");
                }
            }
            catch (err) {
                if (active)
                    setError(errorMessage(err));
            }
        };
        void update();
        const timer = setInterval(() => {
            if (!document.hidden)
                void update();
        }, 15000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [id, user]);
    if (!user)
        return (<EmptyState title="Your order is private." text="Sign in with the account used to place this order." to={`/account?next=${encodeURIComponent(`/orders/${id}`)}`} action="Sign in"/>);
    if (!order)
        return (<div className="shop-page">
        <T>{error ? (<>
            <ErrorMessage message={error}/>
            <button className="pill" onClick={() => void load()}><T space>{"Try again"}</T></button>
          </>) : (<Loading />)}</T>
      </div>);
    const cancel = async () => {
        setBusy(true);
        setError("");
        try {
            setOrder(await api<Order>(`/orders/${id}/cancel`, { method: "POST" }));
            setCancelPrompt(false);
            await refreshProducts();
        }
        catch (err) {
            setError(errorMessage(err));
        }
        finally {
            setBusy(false);
        }
    };
    const steps = ["confirmed", "preparing", "out_for_delivery", "delivered"];
    return (<div className="shop-page">
      <Link className="back-link" to="/orders"><T space>{"\u2190 All your orders"}</T></Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow"><T>{order.id}</T></span>
          <h1>
            <T>{order.status === "cancelled"
        ? "Until next time."
        : order.status === "delivered"
            ? "Good food. Delivered."
            : order.status === "pending_payment"
                ? "One more step."
                : "Good mood incoming."}</T>
          </h1>
          <p><T space>{"Placed"}</T><T>{new Date(order.createdAt).toLocaleString()}</T></p>
        </div>
        <span className={`status-badge status-${order.status}`}>
          <T>{statusLabel(order.status)}</T>
        </span>
      </div>
      <ErrorMessage message={error}/>
      <div className="section-toolbar"><p><T>{order.fulfillment === "pickup" ? "Pickup" : "Delivery"}</T><T>{order.scheduledAt ? ` · Scheduled: ${new Date(order.scheduledAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} (Bangladesh time)` : " · As soon as possible"}</T></p><ReorderButton order={order}/></div>
      <T>{order.status === "pending_payment" && (<p className="alert">
          <T>{order.paymentStatus === "review"
        ? "Your payment is awaiting verification. Contact the shop before placing another order."
        : "Payment has not been confirmed. If you have already paid, keep this order open while the provider verifies it. Otherwise cancel below before ordering again."}</T>
        </p>)}</T>
      <T>{order.paymentStatus === "refund_required" && (<p className="alert"><T space>{"A refund needs attention. Contact the shop with this order number; no automatic refund has been issued."}</T></p>)}</T>
      <T>{order.status !== "cancelled" && (<ol className="tracking-steps">
          <T>{steps.map((step, index) => {
        const done = steps.indexOf(order.status) >= index;
        const event = order.history.find((h) => h.status === step);
        return (<li key={step} className={done ? "done" : ""}>
                <span>
                  <T>{done ? (<Check size={18}/>) : index === 2 ? (<Truck size={18}/>) : (<Package size={18}/>)}</T>
                </span>
                <b><T>{order.fulfillment === "pickup" && step === "out_for_delivery" ? "Ready for pickup" : order.fulfillment === "pickup" && step === "delivered" ? "Collected" : statusLabel(step)}</T></b>
                <small>
                  <T>{event
            ? new Date(event.at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            })
            : "Waiting"}</T>
                </small>
              </li>);
    })}</T>
        </ol>)}</T>
      <div className="checkout-layout">
        <section className="panel">
          <h2 className="subheading"><T space>{"Your order"}</T></h2>
          <T>{order.items.map((i) => (<div className="summary-item" key={cartKey(i)}>
              <img src={i.image} alt=""/>
              <Link to={`/products/${i.id}`}>
                <T>{i.qty}</T> × <T>{i.name}</T>
              </Link>
              <b><T>{money(i.price * i.qty)}</T></b>
            </div>))}</T>
          <dl className="totals">
            <div>
              <dt><T space>{"Subtotal"}</T></dt>
              <dd><T>{money(order.subtotal)}</T></dd>
            </div>
            <div>
              <dt><T space>{"Discount"}</T><T>{order.coupon}</T></dt>
              <dd>−<T>{money(order.discount)}</T></dd>
            </div>
            <div>
              <dt><T space>{"Delivery"}</T></dt>
              <dd><T>{money(order.deliveryFee)}</T></dd>
            </div>
            <div className="grand-total">
              <dt><T space>{"Total"}</T></dt>
              <dd><T>{money(order.total)}</T></dd>
            </div>
            <T>{!!order.loyaltyDiscount && <div><dt><T space>{"Loyalty savings (included)"}</T></dt><dd>−<T>{money(order.loyaltyDiscount)}</T></dd></div>}</T>
          </dl>
        </section>
        <aside className="panel form-stack">
          <h2 className="subheading"><T>{order.fulfillment === "pickup" ? "Pickup details" : "Delivery details"}</T></h2>
          <p>
            <b><T>{order.address.name}</T></b>
            <br />
            <T>{order.address.street}</T>
            <br />
            <T>{order.zone.name}</T>
            <br />
            <T>{order.address.phone}</T>
          </p>
          <T>{order.address.notes && <p><T space>{"Instructions:"}</T><T>{order.address.notes}</T></p>}</T>
          <p>
            <b><T space>{"Estimated delivery"}</T></b>
            <br />
            <T>{order.scheduledAt ? `Scheduled for ${new Date(order.scheduledAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} (Bangladesh time)` : `${order.zone.eta} after confirmation`}</T>
          </p>
          <p>
            <b><T space>{"Payment"}</T></b>
            <br />
            <T>{order.paymentMethod === "cod"
        ? order.fulfillment === "pickup" ? "Cash at pickup" : "Cash on delivery"
        : statusLabel(order.paymentMethod)}</T><T space>{" "}</T>
            · <T>{statusLabel(order.paymentStatus)}</T>
          </p>
          <small><T space>{"Status refreshes every 15 seconds."}</T></small>
          <button className="pill" onClick={() => void load()}><T space>{"Refresh status"}</T></button>
          <T>{["pending_payment", "confirmed"].includes(order.status) &&
        (cancelPrompt ? (<div className="alert">
                <p><T space>{"Cancel this order? Any collected online payment requires a refund from the shop."}</T></p>
                <div className="button-row">
                  <button className="pill danger" disabled={busy} onClick={() => void cancel()}><T space>{"Yes, cancel order"}</T></button>
                  <button className="text-button" onClick={() => setCancelPrompt(false)}><T space>{"Keep order"}</T></button>
                </div>
              </div>) : (<button className="text-button danger-text" onClick={() => setCancelPrompt(true)}><T space>{"Cancel order"}</T></button>))}</T>
          <Link to="/help" className="text-button"><T space>{"Need a hand? Contact us \u2197"}</T></Link>
        </aside>
      </div>
    </div>);
}
