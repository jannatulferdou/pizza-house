import { T } from "../../../app/Locale";
import { useState } from "react";
import type { AdminSummary } from "@pizza-house/shared/types";
import { money } from "@pizza-house/shared/commerce";
const dayKey = (value: string) => new Date(new Date(value).getTime() + 6 * 3600000).toISOString().slice(0, 10);
export function Reports({ data }: {
    data: AdminSummary;
}) {
    const [from, setFrom] = useState(""), [to, setTo] = useState("");
    const sales = data.orders.filter(o => o.status === "delivered" && o.paymentStatus === "paid").map(o => ({ ...o, day: dayKey(o.history.find(h => h.status === "delivered")?.at || o.createdAt) })).filter(o => (!from || o.day >= from) && (!to || o.day <= to));
    const daily = new Map<string, {
        count: number;
        total: number;
    }>();
    const popular = new Map<string, {
        name: string;
        qty: number;
        gross: number;
    }>();
    for (const order of sales) {
        const d = daily.get(order.day) || { count: 0, total: 0 };
        d.count++;
        d.total += order.total;
        daily.set(order.day, d);
        for (const item of order.items) {
            const p = popular.get(item.id) || { name: data.products.find(p => p.id === item.id)?.name || item.name, qty: 0, gross: 0 };
            p.qty += item.qty;
            p.gross += item.price * item.qty;
            popular.set(item.id, p);
        }
    }
    const lowStock = data.products.filter(p => p.active && p.stock <= 5);
    return <section className="form-stack"><h2><T space>{"Sales & inventory reports"}</T></h2><p><T space>{"Completed, paid orders by completion date in Bangladesh time. Collected totals include delivery and deduct offers and loyalty points. Product sales below are before discounts."}</T></p><div className="form-grid"><label><T space>{"From"}</T><input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label><T space>{"To"}</T><input type="date" min={from} value={to} onChange={e => setTo(e.target.value)}/></label></div>
    <div className="extras-grid"><article className="panel"><h3><T space>{"Collected sales"}</T></h3><strong className="points-value"><T>{money(sales.reduce((n, o) => n + o.total, 0))}</T></strong><p><T>{sales.length}</T><T space>{"completed orders"}</T></p></article><article className="panel"><h3><T space>{"Low-stock alerts"}</T></h3><T>{lowStock.length ? lowStock.map(p => <p key={p.id}><b><T>{p.name}</T></b> · <T>{p.stock}</T><T space>{"available"}</T></p>) : <p><T space>{"No active products below 6 units."}</T></p>}</T></article></div>
    <div className="extras-grid"><section className="panel"><h3><T space>{"Daily sales"}</T></h3><T>{!daily.size ? <p><T space>{"No completed sales in this period."}</T></p> : <div className="report-scroll"><table><thead><tr><th><T space>{"Date"}</T></th><th><T space>{"Orders"}</T></th><th><T space>{"Collected"}</T></th></tr></thead><tbody><T>{[...daily].sort(([a], [b]) => b.localeCompare(a)).map(([day, d]) => <tr key={day}><td><T>{day}</T></td><td><T>{d.count}</T></td><td><T>{money(d.total)}</T></td></tr>)}</T></tbody></table></div>}</T></section><section className="panel"><h3><T space>{"Best-selling meals"}</T></h3><T>{!popular.size ? <p><T space>{"No completed sales in this period."}</T></p> : <div className="report-scroll"><table><thead><tr><th><T space>{"Meal"}</T></th><th><T space>{"Quantity"}</T></th><th><T space>{"Gross food sales"}</T></th></tr></thead><tbody><T>{[...popular].sort(([, a], [, b]) => b.qty - a.qty).map(([id, p]) => <tr key={id}><td><T>{p.name}</T></td><td><T>{p.qty}</T></td><td><T>{money(p.gross)}</T></td></tr>)}</T></tbody></table></div>}</T></section></div>
  </section>;
}
