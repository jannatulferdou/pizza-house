import { T } from "../../app/Locale";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../../app/StoreProvider";
import { api, errorMessage } from "../../shared/api";
import { OrderHistory } from "../orders/OrderHistory";
import type { User } from "@pizza-house/shared/types";
import { ErrorMessage } from "../../components/Feedback";
import { CustomerExtras } from "./CustomerExtras";
export default function AccountPage() {
    const { user, setUser } = useStore();
    const [register, setRegister] = useState(false), [error, setError] = useState(""), [busy, setBusy] = useState(false);
    const [params] = useSearchParams(), navigate = useNavigate();
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        try {
            const result = await api<{
                user: User;
            }>(`/auth/${register ? "register" : "login"}`, {
                method: "POST",
                body: JSON.stringify({
                    name: data.get("name"),
                    email: data.get("email"),
                    password: data.get("password"),
                }),
            });
            setUser(result.user);
            const next = params.get("next");
            if (next && /^\/(?!\/)/.test(next) && !next.includes("\\"))
                navigate(next);
        }
        catch (err) {
            setError(errorMessage(err));
        }
        finally {
            setBusy(false);
        }
    };
    const logout = async () => {
        setBusy(true);
        setError("");
        try {
            await api("/auth/logout", { method: "POST" });
            setUser(null);
        }
        catch (err) {
            setError(errorMessage(err));
        }
        finally {
            setBusy(false);
        }
    };
    if (!user)
        return (<div className="shop-page auth-layout">
        <div>
          <span className="eyebrow"><T space>{"A PLACE AT OUR TABLE"}</T></span>
          <h1><T space>{"Your favorites."}</T><br /><T space>{"All in one place."}</T></h1>
          <p><T space>{"Save your orders, follow your delivery and share your thoughts after every meal."}</T></p>
          <img src="/images/pizza-pizza.jpg" alt="Our house margherita on an ivory plate"/>
        </div>
        <form className="panel form-stack" onSubmit={submit}>
          <span className="eyebrow"><T space>{"WELCOME TO THE HOUSE"}</T></span>
          <h2><T>{register ? "Make yourself at home." : "Good to see you."}</T></h2>
          <T>{register && (<label><T space>{"Your name"}</T><input name="name" autoComplete="name" minLength={2} maxLength={80} required/>
            </label>)}</T>
          <label><T space>{"Email address"}</T><input name="email" type="email" autoComplete="email" maxLength={254} required/>
          </label>
          <label><T space>{"Password"}</T><input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={10} maxLength={128} required/>
            <small><T space>{"At least 10 characters."}</T></small>
          </label>
          <ErrorMessage message={error}/>
          <T>{!register && <Link to="/recover"><T space>{"Forgot password?"}</T></Link>}</T>
          <button className="pill dark" disabled={busy}>
            <T>{busy
            ? "Please wait…"
            : register
                ? "Create account ↗"
                : "Sign in ↗"}</T>
          </button>
          <button className="text-button" type="button" onClick={() => {
                setRegister(!register);
                setError("");
            }}>
            <T>{register
            ? "Already have an account? Sign in"
            : "New here? Create an account"}</T>
          </button>
          <small><T space>{"By continuing, you agree to our"}</T><T space>{" "}</T>
            <Link to="/policies"><T space>{"store policies"}</T></Link>.
          </small>
        </form>
      </div>);
    return (<div className="shop-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow"><T space>{"YOUR HOUSE ACCOUNT"}</T></span>
          <h1><T space>{"Hello,"}</T><T>{user.name.split(" ")[0]}</T>.</h1>
          <p><T>{user.email}</T></p>
        </div>
        <div className="button-row">
          <T>{user.role === "admin" && (<Link className="pill" to="/admin"><T space>{"Open admin \u2197"}</T></Link>)}</T>
          <button className="pill" disabled={busy} onClick={() => void logout()}><T space>{"Sign out"}</T></button>
        </div>
      </div>
      <ErrorMessage message={error}/>
      <T>{params.get("payment") && (<p className="alert"><T space>{"Your payment attempt has returned. Open the order to check its verified payment status."}</T></p>)}</T>
      <OrderHistory key={user.id}/>
      <CustomerExtras key={`extras:${user.id}`}/>
    </div>);
}
