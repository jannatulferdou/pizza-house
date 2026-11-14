import { T } from "../../app/Locale";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, errorMessage } from "../../shared/api";
import { useStore } from "../../app/StoreProvider";
import { ErrorMessage } from "../../components/Feedback";
export default function RecoveryPage() {
    const [params] = useSearchParams();
    const [token] = useState(() => window.location.hash.slice(1));
    useEffect(() => { if (token) window.history.replaceState(null, "", window.location.pathname + window.location.search); }, [token]);
    const kind = params.get("kind") === "verify" ? "verify" : "reset";
    const { setUser, refreshProfile } = useStore();
    const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [done, setDone] = useState(false);
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setBusy(true);
        setError("");
        const data = new FormData(e.currentTarget);
        try {
            const result = await api<{
                message: string;
            }>(token ? "/recovery/complete" : "/recovery/forgot", { method: "POST", body: JSON.stringify(token ? { token, kind, password: data.get("password") || undefined } : { email: data.get("email") }) });
            setMessage(result.message);
            setDone(true);
            if (token && kind === "reset")
                setUser(null);
            if (token && kind === "verify")
                await refreshProfile();
        }
        catch (err) {
            setError(errorMessage(err));
        }
        finally {
            setBusy(false);
        }
    }
    return <div className="shop-page recovery-page"><form className="panel form-stack" onSubmit={submit}><h1><T>{kind === "verify" ? "Verify your email" : token ? "Choose a new password" : "Forgot password?"}</T></h1><p><T>{token ? "Confirm below to finish your request." : "We will email you a link to reset your password."}</T></p><T>{!done && (!token ? <label><T space>{"Email address"}</T><input name="email" type="email" required maxLength={254} autoComplete="email"/></label> : kind === "reset" ? <label><T space>{"New password"}</T><input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password"/></label> : null)}</T><ErrorMessage message={error}/><T>{message && <p role="status"><T>{message}</T></p>}</T><T>{!done && <button className="pill dark" disabled={busy}><T>{busy ? "Please wait…" : token ? "Confirm" : "Send reset link"}</T></button>}</T><Link to="/account"><T space>{"Back to my account"}</T></Link></form></div>;
}
