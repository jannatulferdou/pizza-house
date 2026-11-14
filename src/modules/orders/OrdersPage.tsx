import { T } from "../../app/Locale";
import { Link } from "react-router-dom";
import { useStore } from "../../app/StoreProvider";
import { EmptyState } from "../../components/Feedback";
import { OrderHistory } from "./OrderHistory";
export default function OrdersPage() {
    const { user } = useStore();
    if (!user)
        return (<EmptyState title="Your orders, in one place." text="Sign in to view your order history and track deliveries." to="/account?next=%2Forders" action="Sign in"/>);
    return (<div className="shop-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow"><T space>{"FROM OUR HOUSE TO YOURS"}</T></span>
          <h1><T space>{"Follow every favorite."}</T></h1>
          <p><T space>{"Track your delivery or revisit a meal you loved."}</T></p>
        </div>
        <Link className="pill" to="/account"><T space>{"My account \u2197"}</T></Link>
      </div>
      <OrderHistory key={user.id}/>
    </div>);
}
