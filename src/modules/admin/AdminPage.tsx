import { T } from "../../app/Locale";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Package, Users, Wallet } from "lucide-react";
import { useStore } from "../../app/StoreProvider";
import { api, errorMessage } from "../../shared/api";
import { money, statusLabel } from "../../shared/commerce";
import { orderTransitions as nextStatuses } from "../../shared/order-status";
import type { AdminSummary, Coupon, Product } from "../../shared/types";
import { EmptyState, ErrorMessage, Loading } from "../../components/Feedback";
import { ProductEditor } from "./components/ProductEditor";
import { OfferEditor } from "./components/OfferEditor";
import { Reports } from "./components/Reports";
export default function AdminPage() {
    const { user, refreshProducts, reload } = useStore();
    const [data, setData] = useState<AdminSummary | null>(null), [error, setError] = useState(""), [tab, setTab] = useState("orders"), [filter, setFilter] = useState("all"), [editor, setEditor] = useState<Product | null | undefined>(undefined), [busy, setBusy] = useState("");
    const load = useCallback(async () => {
        setData(await api<AdminSummary>("/admin"));
    }, []);
    useEffect(() => {
        if (user?.role === "admin")
            void load().catch((err) => setError(errorMessage(err)));
    }, [user, load]);
    if (!user)
        return (<EmptyState title="The house office." text="Sign in with your administrator account to manage the shop." to="/account?next=%2Fadmin" action="Sign in"/>);
    if (user.role !== "admin")
        return (<EmptyState title="Staff access only." text="This account does not have administrator access." to="/account" action="Back to my account"/>);
    if (!data)
        return (<div className="shop-page">
        <T>{error ? (<>
            <ErrorMessage message={error}/>
            <button className="pill" onClick={() => void load().catch((err) => setError(errorMessage(err)))}><T space>{"Try again"}</T></button>
          </>) : (<Loading />)}</T>
      </div>);
    const updateOrder = async (id: string, status: string) => {
        setBusy(id);
        setError("");
        try {
            await api(`/admin/orders/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            });
            await load();
            await refreshProducts();
        }
        catch (err) {
            setError(errorMessage(err));
        }
        finally {
            setBusy("");
        }
    };
    const saveOffer = async (coupon: Coupon) => {
        await api("/admin/coupons", {
            method: "PUT",
            body: JSON.stringify(coupon),
        });
        await load();
        await reload();
    };
    const filtered = data.orders.filter((o) => filter === "all" || o.status === filter);
    return (<div className="shop-page admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow"><T space>{"THE HOUSE OFFICE"}</T></span>
          <h1><T space>{"A little behind the scenes."}</T></h1>
          <p><T space>{"Manage the menu, keep orders moving, and see how the house is doing."}</T></p>
        </div>
        <button className="pill" onClick={() => void load().catch((err) => setError(errorMessage(err)))}><T space>{"Refresh"}</T></button>
      </div>
      <div className="stats-grid">
        <T>{[
        {
            name: "Collected sales · delivered",
            value: money(data.revenue),
            icon: Wallet,
        },
        { name: "Total orders", value: data.orders.length, icon: Package },
        { name: "Customers", value: data.customers, icon: Users },
        {
            name: "Active products",
            value: data.products.filter((p) => p.active).length,
            icon: BarChart3,
        },
    ].map(({ name, value, icon: Icon }) => (<article className="panel stat-card" key={name}>
            <Icon size={20}/>
            <b><T>{value}</T></b>
            <span><T>{name}</T></span>
          </article>))}</T>
      </div>
      <ErrorMessage message={error}/>
      <T>{data.orders.some((o) => ["review", "refund_required"].includes(o.paymentStatus)) && (<p className="alert"><T space>{"Some payments need verification or a refund. Review these in the payment provider\u2019s merchant dashboard. Refunds are not issued automatically."}</T></p>)}</T>
      <div className="tab-bar" role="group" aria-label="Admin sections">
        <T>{["orders", "products", "offers", "reports"].map((t) => (<button className={tab === t ? "active" : ""} aria-pressed={tab === t} key={t} onClick={() => setTab(t)}>
            <T>{statusLabel(t)}</T>
          </button>))}</T>
      </div>
      <T>{tab === "orders" && (<section>
          <div className="section-toolbar">
            <h2 className="subheading"><T space>{"Orders"}</T></h2>
            <label><T space>{"Status"}</T><T space>{" "}</T>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all"><T space>{"All orders"}</T></option>
                <T>{Object.keys(nextStatuses).map((status) => (<option key={status} value={status}>
                    <T>{statusLabel(status)}</T>
                  </option>))}</T>
              </select>
            </label>
          </div>
          <T>{!filtered.length && (<p className="panel"><T space>{"No orders in this view yet."}</T></p>)}</T>
          <div className="admin-order-list">
            <T>{filtered.map((order) => (<article className="panel admin-order" key={order.id}>
                <div className="section-toolbar">
                  <div>
                    <b><T>{order.id}</T></b>
                    <p><T>{new Date(order.createdAt).toLocaleString()}</T></p>
                  </div>
                  <span className={`status-badge status-${order.status}`}>
                    <T>{statusLabel(order.status)}</T>
                  </span>
                </div>
                <div className="form-grid">
                  <div>
                    <p>
                      <b><T>{order.address.name}</T></b> · <T>{order.address.phone}</T>
                      <br />
                      <T>{order.address.street}</T> · <T>{order.zone.name}</T>
                    </p>
                    <T>{order.address.notes && <p><T space>{"Note:"}</T><T>{order.address.notes}</T></p>}</T>
                    <p><T>{order.fulfillment === "pickup" ? "Pickup" : "Delivery"}</T><T>{order.scheduledAt && ` · ${new Date(order.scheduledAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} (Bangladesh time)`}</T></p>
                  </div>
                  <div>
                    <b><T>{money(order.total)}</T></b>
                    <p>
                      <T>{order.paymentMethod.toUpperCase()}</T> ·<T space>{" "}</T>
                      <T>{statusLabel(order.paymentStatus)}</T>
                    </p>
                  </div>
                </div>
                <p>
                  <T>{order.items.map((i) => `${i.qty} × ${i.name}`).join(" · ")}</T>
                </p>
                <T>{nextStatuses[order.status].length > 0 && (<form className="admin-status-form" onSubmit={(e) => {
            e.preventDefault();
            const status = String(new FormData(e.currentTarget).get("status"));
            void updateOrder(order.id, status);
        }}>
                    <label><T space>{"Next status"}</T><select name="status" defaultValue="" required>
                        <option value="" disabled><T space>{"Choose a status"}</T></option>
                        <T>{nextStatuses[order.status].map((s) => (<option key={s} value={s}>
                            <T>{order.fulfillment === "pickup" && s === "out_for_delivery" ? "Ready for pickup" : order.fulfillment === "pickup" && s === "delivered" ? "Collected" : statusLabel(s)}</T>
                          </option>))}</T>
                      </select>
                    </label>
                    <button className="pill dark" disabled={busy === order.id}>
                      <T>{busy === order.id ? "Updating…" : "Update order"}</T>
                    </button>
                  </form>)}</T>
              </article>))}</T>
          </div>
        </section>)}</T>
      <T>{tab === "products" && (<section>
          <div className="section-toolbar">
            <h2 className="subheading"><T space>{"Menu & inventory"}</T></h2>
            <button className="pill dark" onClick={() => setEditor(null)}><T space>{"Add product +"}</T></button>
          </div>
          <div className="admin-products">
            <T>{data.products.map((p) => (<article className="panel admin-product" key={p.id}>
                <img src={p.image} alt=""/>
                <div>
                  <b><T>{p.name}</T></b>
                  <p>
                    <T>{money(p.price)}</T> · <T>{p.stock}</T><T space>{"in stock"}</T></p>
                  <small><T>{p.active ? "On the menu" : "Hidden from menu"}</T></small>
                </div>
                <button className="pill" onClick={() => setEditor(p)}><T space>{"Edit"}</T></button>
              </article>))}</T>
          </div>
        </section>)}</T>
      <T>{tab === "offers" && (<section>
          <h2 className="subheading"><T space>{"A little extra good"}</T></h2>
          <div className="offers-grid">
            <T>{data.coupons.map((coupon) => (<OfferEditor key={coupon.code} coupon={coupon} save={saveOffer}/>))}</T>
            <OfferEditor save={saveOffer}/>
          </div>
        </section>)}</T>
      <T>{editor !== undefined && (<ProductEditor product={editor} onClose={() => setEditor(undefined)} onSave={async () => {
            await load();
            await refreshProducts();
        }}/>)}</T>
      <T>{tab === "reports" && <Reports data={data}/>}</T>
      <Link className="back-link" to="/#menu"><T space>{"\u2190 Back to the storefront"}</T></Link>
    </div>);
}
