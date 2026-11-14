import { T } from "../../app/Locale";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../app/StoreProvider";
import { api, errorMessage } from "../../shared/api";
import type { SavedAddress } from "../../shared/types";
import { ErrorMessage } from "../../components/Feedback";
export function FavouriteButton({ id }: {
    id: string;
}) {
    const { user, profile, refreshProfile, setNotice } = useStore();
    const [busy, setBusy] = useState(false);
    const saved = profile?.favourites.includes(id) || false;
    if (!user)
        return <Link className="text-button" to="/account"><T space>{"\u2661 Save favourite"}</T></Link>;
    return <button className="text-button favourite-button" disabled={busy || !profile} aria-pressed={saved} onClick={async () => {
            setBusy(true);
            try {
                await api(`/customer/favourites/${id}`, { method: "PUT", body: JSON.stringify({ saved: !saved }) });
                await refreshProfile();
            }
            catch (err) {
                setNotice(errorMessage(err));
            }
            finally {
                setBusy(false);
            }
        }}><T>{saved ? "♥ Saved favourite" : "♡ Save favourite"}</T></button>;
}
export function CustomerExtras() {
    const { profile, profileError, refreshProfile, products, add, user, config } = useStore();
    const [editing, setEditing] = useState<SavedAddress | null | undefined>(undefined);
    const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
    async function mutate(path: string, method: string, body?: unknown) {
        setBusy(true);
        setError("");
        setMessage("");
        try {
            await api(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
            await refreshProfile();
            return true;
        }
        catch (err) {
            setError(errorMessage(err));
            return false;
        }
        finally {
            setBusy(false);
        }
    }
    async function saveAddress(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        if (await mutate("/customer/addresses", "POST", { ...data, id: editing?.id }))
            setEditing(undefined);
    }
    if (!profile)
        return <section className="panel"><ErrorMessage message={profileError}/><p><T>{profileError ? "Account details could not be loaded." : "Loading account details…"}</T></p><button className="pill" onClick={() => void refreshProfile()}><T space>{"Refresh account"}</T></button></section>;
    return <div className="customer-extras form-stack">
    <ErrorMessage message={error || profileError}/><T>{message && <p role="status" className="alert"><T>{message}</T></p>}</T>
    <div className="extras-grid">
      <section className="panel form-stack"><span className="eyebrow"><T space>{"HOUSE REWARDS"}</T></span><h2><T space>{"Loyalty points"}</T></h2><strong className="points-value"><T>{profile.points}</T></strong><p><T space>{"Earn 1 point per \u09F320 of paid food on completed orders. Each point takes \u09F31 off your next order, up to 20% of its discounted food total."}</T></p><Link className="pill" to="/#menu"><T space>{"Find your next favourite"}</T></Link></section>
      <section className="panel form-stack"><h2><T space>{"Email & notifications"}</T></h2><p><T>{user?.email}</T></p><p><T>{profile.emailVerified ? "Email verified ✓" : "Verify your email to receive order emails."}</T></p>
        <T>{!profile.emailVerified && <button className="pill" disabled={busy || !config?.notifications.email} onClick={async () => { if (await mutate("/recovery/request-verification", "POST"))
        setMessage("Verification link queued. Check your email."); }}><T space>{"Send verification link"}</T></button>}</T>
        <T>{!config?.notifications.email && <p className="small-note"><T space>{"Email delivery is not configured yet."}</T></p>}</T>
        <form className="form-stack" key={JSON.stringify(profile.preferences)} onSubmit={async (e) => { e.preventDefault(); const data = new FormData(e.currentTarget); if (await mutate("/customer/preferences", "PUT", { email: data.has("email"), sms: data.has("sms"), phone: String(data.get("phone") || "") }))
        setMessage("Notification preferences saved."); }}>
          <label className="checkbox-label"><input name="email" type="checkbox" defaultChecked={profile.preferences.email}/><T space>{"Email order updates"}</T></label>
          <label className="checkbox-label"><input name="sms" type="checkbox" defaultChecked={profile.preferences.sms}/><T space>{"SMS order updates"}</T></label>
          <label><T space>{"Mobile number"}</T><input name="phone" type="tel" pattern="(\+?88)?01[3-9][0-9]{8}" maxLength={14} defaultValue={profile.preferences.phone} placeholder="01XXXXXXXXX"/></label>
          <T>{!config?.notifications.sms && <small><T space>{"SMS delivery is not configured yet. Updates remain available in your account."}</T></small>}</T>
          <button className="pill" disabled={busy}><T space>{"Save preferences"}</T></button>
        </form>
      </section>
    </div>
    <section className="panel form-stack"><div className="section-toolbar"><h2><T space>{"Saved addresses"}</T></h2><button className="pill" onClick={() => setEditing(null)}><T space>{"Add address"}</T></button></div>
      <T>{!profile.addresses.length && <p><T space>{"Save Home or Office for faster checkout."}</T></p>}</T>
      <div className="extras-grid"><T>{profile.addresses.map(a => <article className="address-card" key={a.id}><b><T>{a.label}</T></b><p><T>{a.name}</T> · <T>{a.phone}</T></p><p><T>{a.street}</T></p><p><T>{config?.zones.find(z => z.id === a.zoneId)?.name}</T></p><div className="button-row"><button className="text-button" onClick={() => setEditing(a)}><T space>{"Edit"}</T></button><button className="text-button" disabled={busy} onClick={() => void mutate(`/customer/addresses/${a.id}`, "DELETE")}><T space>{"Remove"}</T></button></div></article>)}</T></div>
      <T>{editing !== undefined && <form className="form-stack address-editor" key={editing?.id || "new"} onSubmit={saveAddress}>
        <div className="form-grid"><label><T space>{"Label"}</T><input name="label" required maxLength={40} placeholder="Home / Office" defaultValue={editing?.label}/></label><label><T space>{"Full name"}</T><input name="name" required minLength={2} maxLength={80} defaultValue={editing?.name || user?.name}/></label><label><T space>{"Mobile number"}</T><input name="phone" type="tel" required pattern="(\+?88)?01[3-9][0-9]{8}" maxLength={14} defaultValue={editing?.phone}/></label><label><T space>{"Delivery area"}</T><select name="zoneId" defaultValue={editing?.zoneId}><T>{config?.zones.map(z => <option key={z.id} value={z.id}><T>{z.name}</T></option>)}</T></select></label></div>
        <label><T space>{"House, road & full address"}</T><textarea name="street" required minLength={10} maxLength={300} defaultValue={editing?.street}/></label><label><T space>{"Delivery instructions"}</T><textarea name="notes" maxLength={500} defaultValue={editing?.notes}/></label>
        <div className="button-row"><button className="pill dark" disabled={busy}><T space>{"Save address"}</T></button><button className="pill" type="button" onClick={() => setEditing(undefined)}><T space>{"Cancel"}</T></button></div>
      </form>}</T>
    </section>
    <section className="panel form-stack"><h2><T space>{"Your favourites"}</T></h2><T>{!profile.favourites.length && <p><T space>{"Tap the heart on any meal to save it here."}</T></p>}</T><div className="extras-grid"><T>{profile.favourites.map(id => { const p = products.find(p => p.id === id); return <article className="address-card" key={id}><T>{p ? <><Link to={`/products/${id}`}><b><T>{p.name}</T></b></Link><p><T>{p.description}</T></p><button className="pill" disabled={!p.stock} onClick={() => add(id)}><T space>{"Add to bag"}</T></button></> : <p><T space>{"This meal is currently unavailable."}</T></p>}</T><FavouriteButton id={id}/></article>; })}</T></div></section>
    <section className="panel form-stack"><div className="section-toolbar"><h2><T space>{"Order notifications"}</T></h2><button className="pill" disabled={busy || !profile.notifications.some(n => !n.read)} onClick={() => void mutate("/customer/notifications/read", "POST")}><T space>{"Mark all read"}</T></button></div><T>{!profile.notifications.length && <p><T space>{"Your order updates will appear here."}</T></p>}</T><div className="notification-list"><T>{profile.notifications.map(n => <Link className={n.read ? "notification" : "notification unread"} key={n.id} to={`/orders/${n.orderId}`}><span><T>{n.message}</T></span><small><T>{new Date(n.createdAt).toLocaleString()}</T></small></Link>)}</T></div></section>
  </div>;
}
