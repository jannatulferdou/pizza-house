import { T } from "../../../app/Locale";
import { useState, type FormEvent } from "react";
import { errorMessage } from "../../../shared/api";
import type { Coupon } from "../../../shared/types";
import { ErrorMessage } from "../../../components/Feedback";
export function OfferEditor({ coupon, save, }: {
    coupon?: Coupon;
    save: (coupon: Coupon) => Promise<void>;
}) {
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setError("");
        try {
            await save({
                code: String(data.get("code")),
                percent: Number(data.get("percent")),
                minimum: Number(data.get("minimum")),
                active: data.get("active") === "on",
            });
            if (!coupon)
                form.reset();
        }
        catch (err) {
            setError(errorMessage(err));
        }
        finally {
            setBusy(false);
        }
    };
    return (<form className="panel form-stack" onSubmit={submit}>
      <h3><T>{coupon ? coupon.code : "Create an offer"}</T></h3>
      <label><T space>{"Code"}</T><input name="code" defaultValue={coupon?.code ?? ""} readOnly={Boolean(coupon)} pattern="[A-Za-z0-9]{3,30}" required maxLength={30}/>
      </label>
      <div className="form-grid">
        <label><T space>{"Discount %"}</T><input name="percent" type="number" min="1" max="80" defaultValue={coupon?.percent ?? 10} required/>
        </label>
        <label><T space>{"Minimum subtotal (\u09F3)"}</T><input name="minimum" type="number" min="0" max="100000" defaultValue={coupon?.minimum ?? 0} required/>
        </label>
      </div>
      <label className="checkbox-label">
        <input name="active" type="checkbox" defaultChecked={coupon?.active ?? true}/><T space>{"Offer is active"}</T></label>
      <ErrorMessage message={error}/>
      <button className="pill" disabled={busy}>
        <T>{busy ? "Saving…" : "Save offer"}</T>
      </button>
    </form>);
}
