import { T } from "../app/Locale";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ShoppingBag, UserRound, X } from "lucide-react";
import { useEffect } from "react";
import { useStore } from "../app/StoreProvider";
import { LanguageSwitch } from "../app/Locale";
export function Header() {
    const { cart, setCartOpen, user } = useStore();
    return (<header className="site-header">
      <Link className="brand" to="/" aria-label="Pizza House home">
        <span className="brand-icon">P<span>H</span>
        </span>
        <span><T space>{"PIZZA HOUSE"}</T><small><T space>{"GOOD FOOD. GREAT COMPANY."}</T></small>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        <Link to="/#menu"><T space>{"Our menu"}</T></Link>
        <NavLink to="/delivery"><T space>{"Delivery"}</T></NavLink>
        <NavLink to="/help"><T space>{"Help & contact"}</T></NavLink>
        <T>{user && <NavLink to="/orders"><T space>{"My orders"}</T></NavLink>}</T>
        <T>{user?.role === "admin" && <NavLink to="/admin"><T space>{"Admin"}</T></NavLink>}</T>
      </nav>
      <div className="header-actions">
        <LanguageSwitch />
        <Link className="account-link" to="/account" aria-label={user ? "My account and orders" : "Sign in"}>
          <UserRound size={18}/>
          <span><T>{user ? user.name.split(" ")[0] : "Sign in"}</T></span>
        </Link>
        <button className="bag" onClick={() => setCartOpen(true)}><T space>{"Your bag"}</T><ShoppingBag size={17}/>
          <span><T>{cart.reduce((sum, i) => sum + i.qty, 0)}</T></span>
        </button>
      </div>
    </header>);
}
export function Footer() {
    return (<footer>
      <Link className="footer-wordmark" to="/"><T space>{"PIZZA HOUSE"}</T><span>®</span>
      </Link>
      <div className="footer-links">
        <Link to="/about"><T space>{"Our house"}</T></Link>
        <Link to="/delivery"><T space>{"Delivery areas"}</T></Link>
        <Link to="/help"><T space>{"FAQ & contact"}</T></Link>
        <Link to="/policies"><T space>{"Refund & privacy"}</T></Link>
        <Link to="/orders"><T space>{"My orders"}</T></Link>
      </div>
      <div>
        <span><T space>{"GOOD FOOD. GREAT COMPANY."}</T></span>
        <span><T space>{"Concept store \u00B7 Sample menu & delivery areas"}</T></span>
        <Link to="/"><T space>{"Back to the top \u2191"}</T></Link>
      </div>
    </footer>);
}
export function ScrollToPage() {
    const { pathname, hash } = useLocation();
    useEffect(() => {
        if (!hash) {
            window.scrollTo({ top: 0 });
            return;
        }
        let attempts = 0;
        const timer = setInterval(() => {
            const target = document.getElementById(hash.slice(1));
            if (target) {
                target.scrollIntoView();
                clearInterval(timer);
            }
            else if (++attempts > 30)
                clearInterval(timer);
        }, 100);
        return () => clearInterval(timer);
    }, [pathname, hash]);
    return null;
}
export function Notice() {
    const { notice, setNotice } = useStore();
    return notice ? (<div className="toast" role="status">
      <T>{notice}</T>
      <button onClick={() => setNotice("")} aria-label="Dismiss message">
        <X size={16}/>
      </button>
    </div>) : null;
}
