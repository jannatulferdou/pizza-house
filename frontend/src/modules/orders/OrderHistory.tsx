import { T } from "../../app/Locale";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../../shared/api";
import { money, statusLabel } from "@pizza-house/shared/commerce";
import type { Order } from "@pizza-house/shared/types";
import { EmptyState, ErrorMessage, Loading } from "../../components/Feedback";
import { ReorderButton } from "./ReorderButton";
/** Mount with the account ID as its key so history never carries across accounts. */
export function OrderHistory() {
    const [orders, setOrders] = useState<Order[] | null>(null);
    const [error, setError] = useState("");
    const [refresh, setRefresh] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const retry = useCallback(() => setRefresh((value) => value + 1), []);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError("");
        void api<Order[]>("/orders", { signal: controller.signal })
            .then((data) => {
            if (!controller.signal.aborted)
                setOrders(data);
        })
            .catch((err) => {
            if (!controller.signal.aborted)
                setError(errorMessage(err));
        })
            .finally(() => {
            if (!controller.signal.aborted)
                setLoading(false);
        });
        return () => controller.abort();
    }, [refresh]);
    const visible = orders?.filter((order) => filter === "all"
        ? true
        : filter === "active"
            ? !["delivered", "cancelled"].includes(order.status)
            : order.status === filter);
    return (<section aria-label="Order history">
      <div className="section-toolbar">
        <h2 className="subheading"><T space>{"Your orders"}</T></h2>
        <div className="button-row">
          <label><T space>{"Show"}</T><T space>{" "}</T>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all"><T space>{"All orders"}</T></option>
              <option value="active"><T space>{"In progress"}</T></option>
              <option value="delivered"><T space>{"Delivered"}</T></option>
              <option value="cancelled"><T space>{"Cancelled"}</T></option>
            </select>
          </label>
          <button className="pill" onClick={retry} disabled={loading}>
            <T>{loading ? "Refreshing…" : "Refresh orders"}</T>
          </button>
        </div>
      </div>
      <ErrorMessage message={error}/>
      <T>{loading && orders === null && <Loading />}</T>
      <T>{visible?.length ? (<div className="order-list">
          <T>{visible.map((order) => (<div className="order-history-entry" key={order.id}><Link className="order-card" to={`/orders/${order.id}`}>
              <div>
                <b><T>{order.id}</T></b>
                <p><T>{new Date(order.createdAt).toLocaleString()}</T></p>
                <span>
                  <T>{order.items
        .map((item) => `${item.qty} × ${item.name}`)
        .join(", ")}</T>
                </span>
              </div>
              <div>
                <span className={`status-badge status-${order.status}`}>
                  <T>{statusLabel(order.status)}</T>
                </span>
                <b><T>{money(order.total)}</T></b>
                <small><T space>{"View order \u2197"}</T></small>
              </div>
            </Link><ReorderButton order={order} /></div>))}</T>
        </div>) : orders?.length ? (<p className="panel" role="status"><T space>{"No orders match this filter."}</T></p>) : orders !== null ? (<EmptyState title="Your first good mood awaits." text="Orders you place will appear here."/>) : null}</T>
    </section>);
}
