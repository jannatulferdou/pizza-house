import { T } from "../../app/Locale";
import { Link, useLocation } from "react-router-dom";
import { Mail, MapPin, Phone, Truck } from "lucide-react";
import { useStore } from "../../app/StoreProvider";
import { money } from "../../shared/commerce";
import { Branches } from "./Branches";
export default function InformationPage() {
    const { pathname } = useLocation(), { config } = useStore();
    if (pathname === "/delivery")
        return (<div className="shop-page info-page">
        <span className="eyebrow"><T space>{"FROM OUR OVEN TO YOUR DOOR"}</T></span>
        <h1><T space>{"A good mood."}</T><br /><T space>{"Delivered."}</T></h1>
        <p><T space>{"Choose your area at checkout. The delivery charge is included in your final total before you place the order."}</T></p>
        <div className="zone-grid">
          <T>{config?.zones.map((z) => (<article className="panel" key={z.id}>
              <MapPin />
              <h2><T>{z.name}</T></h2>
              <b><T>{money(z.fee)}</T><T space>{"delivery"}</T></b>
              <p>
                <Truck size={16}/> <T>{z.eta}</T>
              </p>
            </article>))}</T>
        </div>
        <Branches />
        <div className="panel">
          <h3><T space>{"Before you order"}</T></h3>
          <p><T space>{"These are sample Dhaka delivery areas for this concept store. Times are estimates after confirmation and may vary with traffic and kitchen capacity. Areas outside this list are not available at checkout."}</T></p>
          <Link className="pill dark" to="/#menu"><T space>{"See the menu \u2197"}</T></Link>
        </div>
      </div>);
    if (pathname === "/about")
        return (<div className="shop-page info-page">
        <span className="eyebrow"><T space>{"MAKE YOURSELF AT HOME"}</T></span>
        <h1><T space>{"A full table."}</T><br /><T space>{"A happy place."}</T></h1>
        <div className="about-grid">
          <img src="/images/kitchen.jpg" alt="Pizza, fresh basil and tomatoes"/>
          <div>
            <h2><T space>{"Food worth gathering for."}</T></h2>
            <p><T space>{"The last slice. The shared fries. The conversations that run a little longer. That\u2019s the feeling behind Pizza House."}</T></p>
            <p><T space>{"Explore our house pizzas, burgers and sides. Each product includes ingredients, allergen information, portion details and availability so you can choose your meal."}</T></p>
            <p><T space>{"This is a fictional storefront with sample recipes and AI-created pizza illustrations. Restaurant details and recipes need verification before opening for real orders."}</T></p>
            <Link className="pill dark" to="/#menu"><T space>{"Bring something good to the table \u2197"}</T></Link>
          </div>
        </div>
      </div>);
    if (pathname === "/policies")
        return (<div className="shop-page info-page prose">
        <span className="eyebrow"><T space>{"THE HOUSE DETAILS"}</T></span>
        <h1><T space>{"Clear from the start."}</T></h1>
        <p className="alert"><T space>{"Draft policies for this concept store. The merchant must review and complete these before accepting real orders."}</T></p>
        <section>
          <h2><T space>{"Orders & cancellation"}</T></h2>
          <p><T space>{"You can cancel a confirmed order before preparation begins, or cancel an order awaiting payment, from your order page. After preparation starts, contact the shop for assistance."}</T></p>
        </section>
        <section>
          <h2><T space>{"Refunds & problems with food"}</T></h2>
          <p><T space>{"Contact the shop with your order number if items are missing, incorrect or arrive in an unacceptable condition. Cancelling an order that has been paid online marks it for refund review. The shop must process that refund through its payment provider; cancellation does not automatically return funds."}</T></p>
        </section>
        <section>
          <h2><T space>{"Food & allergens"}</T></h2>
          <p><T space>{"Review the ingredients and allergen information on each product. Our sample menu describes a shared kitchen, so cross-contact is possible. For allergies or specific dietary needs, contact the kitchen before placing an order."}</T></p>
        </section>
        <section>
          <h2><T space>{"Privacy"}</T></h2><p><T>Saved addresses, favourites, loyalty transactions and notification preferences are also stored in your account. If you enable order updates, your email or phone and order status are sent through the configured notification service. Password recovery emails contain a single-use link that expires after thirty minutes.</T></p>
          <p><T space>{"Account details, hashed passwords, order information, delivery addresses and reviews are stored on the shop server. Your browser stores your bag and a checkout retry identifier. An HTTP-only session cookie keeps you signed in for up to seven days. Reviews display your account name, rating and comment publicly."}</T></p>
          <p><T space>{"Online checkout sends the order amount and required contact and delivery details to SSLCommerz. Card and mobile-wallet credentials are entered on the provider\u2019s page, and are not stored by this shop. Fonts are loaded from Google Fonts."}</T></p>
          <p><T space>{"Contact the shop to request access to or deletion of your account information. Merchant contact details and a data retention policy must be configured before launch."}</T></p>
        </section>
        <Link className="pill" to="/help"><T space>{"Contact & help \u2197"}</T></Link>
      </div>);
    const questions = [
        [
            "How do I order?",
            "Add food to your bag and sign in. Choose delivery or an available pickup branch, use a saved address, and select now or a later time. Review the total before ordering.",
        ],
        [
            "Which payments are accepted?",
            "Cash on delivery is available. bKash, Nagad and card checkout become available when the merchant enables online payments. You choose an available payment method on the secure provider page.",
        ],
        [
            "How do I track my order?",
            "Open My orders in your account. Your order page updates as the shop confirms, prepares and sends out your meal.",
        ],
        [
            "Can I change or cancel an order?",
            "Cancel from the order page before preparation begins. To change an order, cancel it and place a new one. Contact the shop for any order already in preparation.",
        ],
        [
            "How do offers work?",
            "Enter a published offer code at checkout. Discounts apply to the food subtotal, with minimum spend shown on the offer. Only one code applies per order.",
        ],
        [
            "How can I leave a review?",
            "Once your order is delivered, open the product and submit a rating and review. You can update your review by submitting again.",
        ],
        [
            "Do you have allergen information?",
            "Each product page lists ingredients and allergens. For specific dietary needs, contact the kitchen before ordering.",
        ],
    ];
    const contact = config?.contact;
    return (<div className="shop-page info-page">
      <span className="eyebrow"><T space>{"WE\u2019RE HERE TO HELP"}</T></span>
      <h1><T space>{"A little help."}</T><br /><T space>{"A better meal."}</T></h1>
      <div className="reviews-layout">
        <section className="faq-list">
          <T>{questions.map(([q, a]) => (<details key={q}>
              <summary><T>{q}</T></summary>
              <p><T>{a}</T></p>
            </details>))}</T>
        </section>
        <aside className="panel form-stack">
          <h2 className="subheading"><T space>{"Talk to the house"}</T></h2>
          <p><T space>{"For help with an order, include your order number so the shop can find it."}</T></p>
          <T>{contact?.email && (<a className="contact-link" href={`mailto:${contact.email}`}>
              <Mail size={18}/>
              <T>{contact.email}</T>
            </a>)}</T>
          <T>{contact?.phone && (<a className="contact-link" href={`tel:${contact.phone}`}>
              <Phone size={18}/>
              <T>{contact.phone}</T>
            </a>)}</T>
          <T>{contact?.whatsapp && (<a className="pill" href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><T space>{"Chat on WhatsApp \u2197"}</T></a>)}</T>
          <T>{!contact?.email && !contact?.phone && !contact?.whatsapp && (<p className="alert"><T space>{"Contact details have not been added to this concept store yet."}</T></p>)}</T>
          <Link className="pill dark" to="/orders"><T space>{"View my orders \u2197"}</T></Link>
          <Link to="/policies"><T space>{"Refund & privacy policies \u2197"}</T></Link>
        </aside>
      </div>
    </div>);
}
