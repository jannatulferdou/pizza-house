import { T } from "../../app/Locale";
import { useState } from "react";
import { useStore } from "../../app/StoreProvider";
import type { Order } from "../../shared/types";
export function ReorderButton({ order }: {
    order: Order;
}) {
    const { addMany } = useStore();
    const [busy, setBusy] = useState(false);
    return <button className="pill" disabled={busy} onClick={async () => { setBusy(true); try {
        await addMany(order.items.map(({ id, qty, options }) => ({ id, qty, options })));
    }
    finally {
        setBusy(false);
    } }}><T>{busy ? "Checking availability…" : "Order again"}</T></button>;
}
