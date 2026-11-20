# Deploy the frontend and backend separately

This repository uses three npm workspaces:

- [frontend](./frontend): React/Vite storefront, assets and Vercel routing.
- [backend](./backend): Express API, authentication, SQLite and notification worker.
- [shared](./shared): TypeScript contracts and pricing/order logic used by both.

Keep all three folders in the same Git repository. They have separate packages and deployment commands, but each app needs the shared workspace and root lockfile. Do not upload just one folder as a standalone repository.

## Local development

Use Node 22.13 or newer. Run commands from the repository root:

```sh
npm ci
cp backend/.env.example backend/.env
npm run dev
```

On PowerShell, use `Copy-Item backend/.env.example backend/.env` and `npm.cmd` if script execution is disabled. If you already have a root `.env`, move its settings to `backend/.env`; relative database paths are now resolved from `backend/`.

The frontend is at http://127.0.0.1:5173 and proxies `/api` to http://127.0.0.1:3001. Optionally copy [frontend/.env.example](./frontend/.env.example) to `frontend/.env` to change the development proxy target. Existing data remains in the repository's `data/pizza-house.sqlite`; the example backend config uses `../data/pizza-house.sqlite`.

| Root command | Purpose |
| --- | --- |
| `npm run dev:web` | Start only the frontend |
| `npm run dev:api` | Start only the backend |
| `npm run build:frontend` | Build shared code and the frontend into `frontend/dist` |
| `npm run build:backend` | Build shared code and the backend into `backend/dist` |
| `npm run build` | Build both apps |
| `npm start` | Run the compiled backend in production mode |
| `npm run preview` | Preview frontend build, with API running separately |
| `npm run typecheck` | Check all workspaces including backend tests |
| `npm test` | Run API/business tests and deployment routing tests |
| `npm run test:deployment` | Build and smoke-test the production backend through a local reverse proxy |

## 1. Deploy the backend (Render example)

The backend needs a continuously running Node process and a persistent disk. It uses local SQLite and a notification timer, so do not deploy it as a Vercel Function. Use one backend instance with this database.

[render.yaml](./render.yaml) provides a Render Blueprint with a disk. Creating it provisions a **paid** service and disk; check the plan shown by Render before creating it. No hosted service is created by the local code changes.

For manual setup, create a **Web Service**, connect this repository, and use:

| Setting | Value |
| --- | --- |
| Root Directory | Leave empty (repository root, so `shared` is available) |
| Runtime | Node |
| Build Command | `npm ci --include=dev && npm run build:backend` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Disk mount path | `/var/data` |
| Number of instances | 1 |

Set backend environment variables:

```dotenv
NODE_ENV=production
NODE_VERSION=22.13.1
HOST=0.0.0.0
TRUST_PROXY=1
APP_URL=https://YOUR-PUBLIC-FRONTEND-DOMAIN
DATABASE_PATH=/var/data/pizza-house.sqlite
ADMIN_EMAIL=YOUR-ADMIN-EMAIL
ADMIN_PASSWORD=YOUR-UNIQUE-PASSWORD
```

`APP_URL` is the public **frontend** origin, not the dashboard URL and not the backend URL. For Vercel, copy the site's actual production domain from the project Domains settings. Use a password of at least 10 characters. The host supplies `PORT`; the server reads it automatically. `TRUST_PROXY=1` trusts the final hosting proxy; on another provider, configure the hop count to match its network. Do not set it to trust arbitrary incoming forwarding headers.

Configure shop, payment and notification settings from [backend/.env.example](./backend/.env.example) on the backend only. Never put credentials in frontend variables or Git.

Open `https://YOUR-BACKEND-DOMAIN/api/health`; it should return `{"ok":true}`. `/api/products` and `/api/config` should return JSON. `/` on the backend does not serve the storefront.

Only files under the disk mount persist on Render. To retain existing shop data, back up the existing SQLite database and migrate it safely to the mounted path before accepting traffic. Without a migration, the new backend starts with seeded sample products and no existing accounts/orders. Do not copy a live SQLite database without accounting for its WAL files.

## 2. Deploy the frontend on Vercel

In the existing Vercel project, connect the same repository and configure:

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Include source files outside Root Directory | Enabled (shared workspace and root lockfile are required) |
| Framework Preset | Other |
| Install Command | `cd .. && npm ci --include=dev` |
| Build Command | `npm run build:vercel` |
| Output Directory | `.vercel/output` |
| Node.js Version | 22.x |

[frontend/vercel.json](./frontend/vercel.json) supplies the install/build/output settings. Remove conflicting old Vite project overrides. Add this **Vercel build environment variable**, then redeploy:

```dotenv
API_ORIGIN=https://YOUR-BACKEND-DOMAIN
```

Use just the backend HTTPS origin: no `/api` suffix, path, query or credentials. This variable is read by the build script, not shipped as a `VITE_*` browser setting. A missing/invalid value fails the build instead of publishing a frontend with broken API routes.

The build creates Vercel Build Output API v3 static assets and routing rules:

1. `/api` and `/api/*` proxy to the backend, preserving API paths and query strings.
2. Existing frontend assets are served normally.
3. Other paths serve `index.html`, so refreshing `/account`, `/orders` or a product page works.

The browser keeps using relative `/api` requests. Cookies stay on the frontend domain, and the backend's allowed-origin checks still use `APP_URL`. No cross-site cookie/CORS configuration is needed for this arrangement. The production frontend domain must match `APP_URL`; preview domains are not automatically authorized to submit requests. For preview testing, use a separate test backend with its own data and matching `APP_URL`.

Payments and recovery links also use `APP_URL`, so they return to the frontend and reach the API through the same proxy. Keep the public production site accessible for payment callbacks.

## 3. Verify after deployment

Through the **frontend** domain, check `/api/health`, `/api/config`, `/api/products`, and `/api/auth/me` (the last returns `{"user":null}` before login). These must return JSON rather than an HTML page or 404.

Register/sign in, refresh the page, place a test cash-on-delivery order, and confirm it appears in order history. Refresh a nested page directly. Restart the backend and verify the test account/order remains. A page loading successfully alone does not verify the backend or persistence.

## References

- [Vercel Build Output API routing](https://vercel.com/docs/build-output-api/configuration)
- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [SQLite on Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)
- [Render Node deployment](https://render.com/docs/deploy-node-express-app)
- [Render persistent disks](https://render.com/docs/disks)
