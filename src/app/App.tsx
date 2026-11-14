import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { StoreProvider, useStore } from "./StoreProvider";
import { T } from "./Locale";
import { Footer, Header, Notice, ScrollToPage } from "../components/Layout";
import { EmptyState, ErrorMessage, Loading } from "../components/Feedback";
import { CartDrawer } from "../modules/cart/CartDrawer";
import { MobileCartBar } from "../modules/cart/MobileCartBar";
import "../App.css";
import "../styles/shop.css";
import "../styles/enhancements.css";
const Home = lazy(() => import("../modules/home/Home"));
const ProductPage = lazy(() => import("../modules/catalog/ProductPage"));
const AccountPage = lazy(() => import("../modules/account/AccountPage"));
const RecoveryPage = lazy(() => import("../modules/account/RecoveryPage"));
const CheckoutPage = lazy(() => import("../modules/checkout/CheckoutPage"));
const OrderPage = lazy(() => import("../modules/orders/OrderPage"));
const OrdersPage = lazy(() => import("../modules/orders/OrdersPage"));
const AdminPage = lazy(() => import("../modules/admin/AdminPage"));
const InformationPage = lazy(
  () => import("../modules/information/InformationPage"),
);
function Shop() {
  const { loading, error, reload } = useStore();
  return (
    <>
      <a className="skip-link" href="#main-content">
        <T>Skip to content</T>
      </a>
      <Header />
      <ScrollToPage />
      <main id="main-content">
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="shop-page">
            <ErrorMessage message={error} />
            <p><T>We couldn’t reach the shop. Please try again in a moment.</T></p>
            <button className="pill dark" onClick={() => void reload()}>
              <T>Try again</T>
            </button>
          </div>
        ) : (
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products/:id" element={<ProductPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/recover" element={<RecoveryPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/orders/:id" element={<OrderPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/admin" element={<AdminPage />} />
              {["about", "delivery", "help", "policies"].map((path) => (
                <Route
                  key={path}
                  path={`/${path}`}
                  element={<InformationPage />}
                />
              ))}
              <Route
                path="*"
                element={
                  <EmptyState
                    title="This table is empty."
                    text="We couldn’t find the page you’re looking for."
                  />
                }
              />
            </Routes>
          </Suspense>
        )}
      </main>
      <Footer />
      <CartDrawer />
      <MobileCartBar />
      <Notice />
    </>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <Shop />
      </StoreProvider>
    </BrowserRouter>
  );
}
