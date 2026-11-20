# Pizza House

A modular TypeScript food storefront with React, Vite, an Express API and persistent SQLite storage. The original Three.js pizza experience and all 15 menu products are retained.

Separate npm workspaces live in [frontend](./frontend), [backend](./backend), and [shared](./shared). See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel frontend settings, backend hosting, environment variables and persistent storage.

## Run locally

Requires Node.js 22.13 or newer.

1. Run `npm install` (use `npm.cmd` in PowerShell if script execution is disabled).
2. Copy `backend/.env.example` to `backend/.env`. Set an admin email and a unique password of at least 10 characters **before the first start** to create a manager account. There is no default administrator password. Existing accounts are never automatically promoted or overwritten.
3. Run `npm run dev`. This starts the web app at http://127.0.0.1:5173 and the API at http://127.0.0.1:3001. Vite proxies /api requests.
4. Open /account to register or sign in. Administrators can open /admin.

The initial menu, stock and HOUSE10 offer are seeded once. Accounts, sessions, products, orders and reviews persist in `data/pizza-house.sqlite`. Back up the database before production changes. Do not commit the data directory or .env.

## Structure

- [frontend/src/app](./frontend/src/app): application routes, shared store, authentication state and persistent cart.
- [frontend/src/modules](./frontend/src/modules): home/3D scene, catalog, cart, checkout, account, orders, admin and information pages.
- [frontend/src/modules/admin/components](./frontend/src/modules/admin/components): independent product and offer editors, composed by the admin page.
- [frontend/src/modules/orders/OrderHistory.tsx](./frontend/src/modules/orders/OrderHistory.tsx): reusable order history with filters, refresh and retry, shared by account and orders pages.
- [frontend/src/components](./frontend/src/components): accessible dialog, layout and feedback components.
- [shared/src](./shared/src): shared TypeScript contracts and pricing rules. The browser API client is in [frontend/src/shared/api.ts](./frontend/src/shared/api.ts).
- [shared/src/order-status.ts](./shared/src/order-status.ts): one set of order transitions used by the admin UI and API; the server additionally enforces authorization and payment checks.
- [backend/frontend/src/modules](./backend/frontend/src/modules): authentication, products/reviews, ordering, payments and admin endpoints.
- [backend/src/lib](./backend/src/lib): database and error handling.
- [backend/src/tests](./backend/src/tests): API and transaction tests using an isolated in-memory database.
- [frontend/src/styles](./frontend/src/styles): responsive storefront and management interface styles.

## Features

- Search, category and price filters, sorting, product details, portions, ingredients, allergens, storage information and stock availability.
- Cart quantities saved in browser localStorage, keyboard-accessible drawer, checkout with a delivery address and a server-calculated total.
- Sample Bangladesh prices in BDT, four sample Dhaka delivery zones and configurable discount codes. These are demonstration prices, not a currency conversion or actual restaurant rates.
- Registration, sign-in, sign-out, HTTP-only cookie sessions, scrypt password hashes and server-enforced customer/admin permissions.
- Persistent order history and tracking with 15-second refresh; customer cancellation before preparation; stock reservation and restoration in transactions.
- Dedicated `/orders` page, linked from navigation, contact and order details. Filter history by in-progress, delivered or cancelled orders, and refresh without signing in again. Account and product/order detail state resets when the signed-in account or selected item changes.
- Verified-purchase reviews after delivery, one editable review per customer/product. No fabricated reviews.
- Admin product creation/editing, stock updates, product visibility, offers, order processing and collected-sales statistics.
- About, contact, delivery, FAQ, draft refund and privacy pages. Configure SHOP_EMAIL, SHOP_PHONE and SHOP_WHATSAPP to show real contact links.

## Payments

Cash on delivery works locally. Online methods remain disabled until SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD are configured on the server. Keep SSLCOMMERZ_SANDBOX=true for testing.

The SSLCommerz hosted checkout integration covers mobile wallets and cards supported by the merchant account. The customer's chosen bKash/Nagad/card option is recorded as a preference; the actual method is selected on the provider page. No wallet PIN, OTP or card number is collected in this app.

Use a publicly reachable HTTPS APP_URL for provider callbacks, with /api routed to the same API. Success and IPN notifications are validated server-to-server against transaction ID, amount, currency and risk status. The implementation follows the [official SSLCommerz integration documentation](https://developer.sslcommerz.com/doc/v4/index.html).

Order creation is idempotent. Unsigned failure/cancellation callbacks cannot change payment state. If opening the provider fails or times out, the order stays pending because the provider may have accepted the request. The customer or administrator can cancel pending orders to release stock. There is no automatic expiration: operators must review abandoned pending orders. A verified payment arriving after cancellation is flagged for a refund. Refunds and high-risk payment reviews require merchant action; this app does not automatically issue refunds or resolve risk holds. Live gateway behavior cannot be verified without merchant credentials and public callback access.

## Checks and deployment

- `npm run typecheck`: strict TypeScript checks across client and server.
- `npm test`: isolated tests covering authentication, CSRF/origin checks, authorization, ownership, coupons, inventory transactions, duplicate checkout, order transitions, reviews and payment verification.
- `npm run build`: build the shared package, compiled backend and frontend. Use `npm run build:frontend` or `npm run build:backend` to build one app.
- `npm run lint`: optional source linting.
- `npm run preview`: preview the built client; run the API separately with `npm run dev:api`.
- `npm start`: run the compiled backend only. Requires `npm run build:backend` first, `APP_URL=https://your-frontend-domain` and persistent SQLite storage. The production server binds to `0.0.0.0` by default. The frontend is deployed separately and proxies `/api` to this backend. Production runs on Node without tsx.

The storefront is a working local application with sample business content. Before accepting actual orders, verify recipes, allergens, availability, delivery zones, contact details and policies, then complete merchant onboarding and sandbox/live payment verification. Email verification, password recovery and notification delivery are available through configured notification adapters. Automated refunds are not implemented. Authentication rate limits are process-local; this SQLite deployment is intended for a single server process. The SQLite API in Node 22 prints an experimental-feature notice.

The 3D scene remains lazy-loaded, honors reduced motion, limits pixel ratio, and stops rendering outside the viewport. Its existing Three.js/GSAP bundle triggers Vite's size advisory; it is separate from checkout and account pages.
ScrollTrigger's pin wrapper is restored in layout-effect cleanup before React removes the home page, so navigating from the animated scene to checkout does not leave React removing an already-reparented element.

## Visual assets

The Drinks category also includes Orange cooler (BDT 150), Watermelon cooler (BDT 160), and Classic iced tea (BDT 130), each with a sample 330 ml serving and initial stock of 50. Their TypeScript menu definitions are in [drinks.ts](./backend/frontend/src/modules/products/drinks.ts). The `soft-drinks-v1` migration adds them once to both existing and new databases, preserving later admin edits. They use the existing catalog, cart, checkout, inventory and combo-component flows. Names, descriptions and ingredients include Bangla translations. These recipes and prices are editable sample menu content; the iced tea contains caffeine.

Real drink stock photos are hosted locally under [frontend/public/images](./frontend/public/images), under the [Pexels license](https://www.pexels.com/license/). They illustrate the drinks rather than documenting food prepared by this shop:

- Orange cooler: [Polina Tankilevitch / Pexels](https://www.pexels.com/photo/person-holding-glass-with-orange-juice-4443515/).
- Watermelon cooler: [Karen Laårk Boshoff / Pexels](https://www.pexels.com/photo/a-glass-of-red-juice-with-straws-and-a-slice-of-watermelon-on-the-rim-8281944/).
- Classic iced tea: [Ebru DOĞAN / Pexels](https://www.pexels.com/photo/glass-of-iced-tea-18263138/).

Photography is illustrative and served locally. Original Unsplash photo IDs: 1579751626657-72bc17010498, 1568901346375-23c9450c58cd, 1573080496219-bb080dd4f877, 1558138838-76294be30005. Fonts use Google Fonts with local sans-serif fallbacks.

## Original pizza menu imagery

All 13 pizzas have individual AI-created concept photographs matched to their listed ingredients, generated with the built-in image_gen tool. These are fictional food illustrations rather than photographs of real restaurant dishes. The shared prompt specifies a whole pizza on an ivory plate and limestone background, a 55-degree overhead view, warm upper-left daylight, and pizza-specific toppings. Full per-image prompts are recorded in [menu-image-prompts.json](./menu-image-prompts.json). Optimized 900-pixel JPEGs are in [frontend/public/images](./frontend/public/images), named pizza-{menu-id}.jpg, and are shared by menu cards and cart thumbnails.

## Verification notes

Strict TypeScript checking, the production build and all 20 isolated API/payment/customer-feature tests pass. Browser checks with an in-memory database covered home-to-checkout navigation with the 3D pin active, registration, mobile cash-on-delivery checkout, order tracking, cancellation, and order-history filters/refresh. The 390-pixel checkout was checked for horizontal overflow. Admin workflows are covered by API tests; exhaustive visual/browser QA is not complete. Actual gateway calls require merchant credentials; payment transport tests use a mocked provider.

The dependency audit reports 12 moderate development-tool findings through the existing ESLint/minimatch dependency tree. No production dependencies were listed in that report. No forced dependency downgrade or major-version override was applied.

## Customer features and operations

- **Combos and drinks:** existing databases receive a lemon cooler and a pizza-night combo once. The combo includes a margherita, fries and two drinks for BDT 840 (sample price). Manage components in the admin product editor. Availability comes from component stock; carts aggregate standalone items and combo components together. Orders snapshot the reserved components so later recipe edits cannot corrupt cancellation stock restoration. Combo descriptions and allergen details remain the merchant's responsibility.
- **Reorder:** order history and order details can add a previous meal to the current bag, preserving pizza options. Current prices and availability are checked; unavailable orders are rejected with a message rather than silently dropping items.
- **Account:** up to ten saved addresses, favourites, notification preferences and the latest fifty order notifications are stored per customer. Checkout can load a saved address. Address edit/delete and favourites never cross account boundaries.
- **Loyalty:** each completed, paid order earns one point for every BDT 20 of food after discounts, excluding delivery. Each redeemed point deducts BDT 1, capped at 20% of the food total after any coupon. Points are reserved atomically when ordering, returned once on cancellation, and earned once on completion. Historical orders placed before this feature do not earn points retroactively.
- **Pickup and scheduled orders:** configure actual branches through `SHOP_BRANCHES` in [backend/.env.example](./backend/.env.example). Without branch configuration, pickup stays disabled and the locations page explicitly says details have not been published. Delivery remains available in the sample delivery zones. Configured branch hours apply to delivery as well as pickup. Hours use Bangladesh time (UTC+6), Sunday=0 through Saturday=6; only same-day opening hours are supported. Pickup has no delivery charge and uses “Ready for pickup” / “Collected” labels. Scheduling accepts one hour to seven days ahead, during opening hours. Stock is reserved immediately; staff start preparation manually, at most thirty minutes before the scheduled time. Scheduled times are requested fulfilment times, not delivery guarantees.
- **Language:** the header switches English/Bengali presentation text and remembers the selection locally. Main navigation, menu controls, account, checkout, order tracking, reports, FAQs, policy copy and recovery confirmations have Bengali translations. Merchant-entered product descriptions, addresses and some dynamic/provider messages retain their source language. Translation strings live in [translations.ts](./frontend/src/app/translations.ts).
- **Reports:** admin reports show paid, completed sales by completion date in Bangladesh time, best-selling products and active products with five or fewer units available. Collected sales include delivery and deduct coupons/points. Product-level gross sales are shown before order discounts; combos count as the sold combo, not additional sales of their components.

### Email, SMS and recovery setup

Set `EMAIL_WEBHOOK_URL`, `SMS_WEBHOOK_URL` and `NOTIFICATION_WEBHOOK_TOKEN` to connect your own HTTPS email/SMS adapters. URLs must use HTTPS; localhost HTTP is accepted only by isolated tests. These endpoints are adapters you operate, not arbitrary provider APIs. The app does not assume a particular vendor's payload format. An adapter must authenticate the Bearer token, deduplicate the `Idempotency-Key` header, and map this JSON into your provider's send API:

```json
{
  "id": "unique-event-id",
  "channel": "email",
  "to": "customer@example.com",
  "subject": "Pizza House order update",
  "text": "Order PH-EXAMPLE: preparing.",
  "orderId": "PH-EXAMPLE",
  "expiresAt": 1800000000000
}
```

For SMS, `channel` is `sms` and `to` is the customer's opted-in mobile number. Recovery/verification emails omit `orderId`. Only send the supplied text; never log token-bearing email contents. `expiresAt` is a Unix timestamp in milliseconds. The adapter should acknowledge a request only after it has durably accepted it, return a successful HTTP status for duplicate accepted IDs, and reject unauthorized requests.

The persistent outbox runs every fifteen seconds, attempts delivery up to eight times with exponential backoff, and clears message contents after successful delivery. Expired messages are discarded; recovery messages expire after thirty minutes and order messages after twenty-four hours. A provider may accept a request before a network timeout, so deduplication by the adapter is required. Exhausted deliveries remain in the database for operator investigation. In-account notifications work without an external adapter. Customers explicitly choose email/SMS updates; order email requires email verification. The saved SMS number is customer supplied; mobile-number verification is not implemented.

“Forgot password” queues a thirty-minute single-use link with a random token. Only its hash is stored in the token table; the outbox temporarily contains the link until delivery. Reset responses do not reveal whether an email exists. Completing a reset invalidates all sessions for that account. The account page offers an email-verification link. Without an email adapter, recovery clearly reports that delivery is unavailable. No reset token is returned by the public API. Live email, SMS and payment delivery require merchant/provider configuration and were not exercised against real services.

### Additional verification

The customer-feature test suite uses a separate in-memory SQLite database and mocked outbound delivery. It covers account isolation, address validation, favourites, combo reservations and recipe-change cancellation, pickup, invalid schedules, preparation timing, loyalty idempotency, notification retry, email verification and password recovery. Browser checks with a temporary in-memory shop covered saved-address autofill, favourites, language persistence after reload, scheduled pickup checkout, reorder, admin fulfilment and report totals. Checkout and reports were checked at a 390-pixel viewport; the report navigation overflow found during that check was corrected. The lemon cooler uses a locally hosted real stock photograph by İbrahim Hakkı Uçman from [Pexels](https://www.pexels.com/photo/lemon-juice-on-a-clear-glass-with-drinking-straw-4134388/), available under the [Pexels license](https://www.pexels.com/license/). The file is [lemon-cooler.jpg](./frontend/public/images/lemon-cooler.jpg). Existing databases replace only the original lemon-cooler illustration path, preserving product edits and inventory. This is reference photography, not a photograph taken at this shop.

Latest follow-up: all 23 server/shared-logic tests pass, including regression coverage for preserving existing cart variants on reorder and rejecting duplicate combo components. Reorder merges into the latest bag after fetching availability, and checkout immediately refreshes the customer's loyalty balance. A first test run encountered a local HTTP transport failure; the complete rerun passed. The integrated browser could not be opened for this follow-up, so the earlier browser checks above were not repeated.
