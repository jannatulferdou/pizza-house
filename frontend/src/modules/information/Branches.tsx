import { T } from "../../app/Locale";
import { useStore } from "../../app/StoreProvider";
export function Branches() {
    const { config } = useStore();
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return <section className="panel form-stack"><h2><T space>{"Branches & opening hours"}</T></h2><T>{!config?.branches.length ? <p><T space>{"Branch locations and opening hours have not been published yet. Contact the shop for details."}</T></p> : <div className="extras-grid"><T>{config.branches.map(b => <article className="address-card" key={b.id}><h3><T>{b.name}</T></h3><p><T>{b.address}</T></p><p><T>{b.days.map(d => days[d]).join(" · ")}</T></p><p><T>{b.opens}</T>–<T>{b.closes}</T><T space>{"\u00B7 Bangladesh time (UTC+6)"}</T></p><p><T>{b.pickup ? "Pickup available" : "Delivery only"}</T></p><a className="pill" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`} target="_blank" rel="noreferrer"><T space>{"Open map \u2197"}</T></a></article>)}</T></div>}</T></section>;
}
