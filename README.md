# vue-vuetify-app

Scaffolded with Vuetify CLI.

## ❗️ Documentation

- Primary docs: https://vuetifyjs.com/
- Getting started guide: https://vuetifyjs.com/en/getting-started/installation/
- Community support: https://community.vuetifyjs.com/
- Issue tracker: https://issues.vuetifyjs.com/

## 🧱 Stack

- Framework: Vue 3 + Vite
- UI Library: Vuetify
- Language: TypeScript
- State: Pinia
- Package manager: npm

## 🖥️ What's in it

Three example screens, each exercising a different part of the backend:

| Page        | What it demonstrates                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `/records`  | flat CRUD against a single table                                                                                      |
| `/calendar` | a month view over dated rows                                                                                          |
| `/orders`   | a parent with nested line items, per-row validation errors, login and permissions, and a CSV export from the same URL |

## 🧭 Start Here

- Main entry: `src/main.ts`
- Main app component: `src/App.vue`
- Main styles: `src/styles/`
- Plugin setup: `src/plugins/`
- Runtime config: `src/config/env.ts`

## 📁 Project Structure

- `src/main.ts` — application entry point
- `src/App.vue` — root component
- `src/components/` — reusable Vue components
- `src/pages/` — one component per screen (`records`, `calendar`, `orders`)
- `src/router/index.ts` — routes, registered **by hand**; adding a page here is not optional
- `src/config/env.ts` — typed accessors for runtime config (e.g. `apiBaseUrl`)
- `src/stores/` — Pinia stores
- `src/plugins/` — plugin registration and setup
- `src/styles/` — global styles and theme settings
- `public/` — static public files
- `.env` — committed default config values (dev API URL, container start mode)
- `Dockerfile` / `docker-compose.yml` / `docker-entrypoint.sh` — container setup

## ✨ Enabled Features

- Pinia
- ESLint
- Vue Router

## ⚙️ Configuration

The app reads config from `.env` via Vite's `import.meta.env`. Two files are involved:

- **`.env`** — committed, non-secret defaults. Already set up with sensible values for local development.
- **`.env.local`** — optional, gitignored (see `.gitignore`'s `*.local` rule). Create this file to override values for your machine (e.g. a different API host, or credentials) without touching the committed `.env`. It always wins over `.env`.

### Pointing the app at your REST API

The backend base URL is controlled by `VITE_API_BASE_URL` in `.env`:

```
VITE_API_BASE_URL=/api
```

**Relative on purpose.** The PHP session cookie is `SameSite=Strict`, so a browser will not send it to a different origin — an absolute `http://localhost:8080/api` means logging in appears to succeed and every request afterwards comes back as the guest. Both the Vite dev server and the production nginx config proxy `/api` through to the PHP app, so the browser only ever sees one origin and no CORS is involved at all.

The dev proxy targets `host.docker.internal:8080`, because inside the app's container `localhost` is that container. Running the dev server directly on your machine instead:

```sh
API_PROXY_TARGET=http://localhost:8080 npm run dev
```

Only variables prefixed with `VITE_` are exposed to browser code — this is a Vite security feature, so arbitrary environment variables (secrets, host paths, etc.) never leak into the client bundle by accident.

That value is read in one place, [src/config/env.ts](src/config/env.ts):

```ts
export const apiBaseUrl = requireEnv('VITE_API_BASE_URL')
```

Import `apiBaseUrl` anywhere you need to call the API instead of hardcoding a URL — see the example `fetchFromApi` action in [src/stores/app.ts](src/stores/app.ts). To point the app at a different backend, change `VITE_API_BASE_URL` in `.env` (or override it in `.env.local`) and restart/reload — see below.

### REST API contract (Records CRUD)

The Records page (`/records`, via [src/stores/records.ts](src/stores/records.ts)) expects the backend
(`api/controllers/RestController.php` in the PHP webapp) to implement this JSON contract:

| Method   | Path               | Request body  | Response                    |
| -------- | ------------------ | ------------- | --------------------------- |
| `GET`    | `/api/index`       | —             | JSON array of records       |
| `GET`    | `/api/read/{id}`   | —             | single record JSON          |
| `POST`   | `/api/create`      | record fields | any 2xx (list is refetched) |
| `PUT`    | `/api/update/{id}` | record fields | any 2xx (list is refetched) |
| `DELETE` | `/api/delete/{id}` | —             | any 2xx (list is refetched) |

A record looks like:

```json
{
  "id": 1,
  "name": "Don Myers",
  "phone": "555-1234",
  "in_office": false,
  "out_until": "2026-07-22 14:30:00"
}
```

- `id` is server-assigned; create/update request bodies contain the other four fields only.
- `in_office` is a JSON boolean.
- `out_until` is a `YYYY-MM-DD HH:MM:SS` datetime string, or `null` when no return time is set.
- The app and the API are the same origin from the browser's point of view, because `/api` is
  proxied (see above), so there is no CORS preflight to answer.

**Note:** Vite bakes `VITE_*` variables into the JS bundle wherever they're used. In dev mode this is re-read every time the dev server (re)starts. In production mode, the value is fixed at `npm run build` time — since the Docker image runs that build at container _start_ (see below), changing `.env` and restarting the container is enough; you don't need to rebuild the image.

### REST API contract (Orders)

The Orders page (`/orders`, via [src/stores/orders.ts](src/stores/orders.ts)) is the one that
exercises the harder parts: a parent record with a variable number of child rows, per-row
validation errors, permissions, and content negotiation.

| Method   | Path               | Request body | Response                                 |
| -------- | ------------------ | ------------ | ---------------------------------------- |
| `GET`    | `/api/orders`      | —            | JSON array of orders — or CSV, see below |
| `GET`    | `/api/orders/{id}` | —            | single order JSON                        |
| `POST`   | `/api/orders`      | `OrderInput` | `201 {"id": n}`                          |
| `PUT`    | `/api/orders/{id}` | `OrderInput` | `200 {"success": true}`                  |
| `DELETE` | `/api/orders/{id}` | —            | `204`                                    |

An order carries its line items:

```json
{
  "id": 1,
  "customer_id": 1,
  "ordered_on": "2026-07-28",
  "notes": "Leave at the side door.",
  "lines": [
    {
      "id": 1,
      "sku": "APL-001",
      "description": "Apple seeds, 1lb bag",
      "qty": 3,
      "unit_price": 4.5,
      "line_total": 13.5
    }
  ]
}
```

#### Validation errors name the row

This is the part worth knowing. A `422` keys line errors by the **index the client sent**, so each
row can show its own messages rather than one "something is wrong" over the whole table:

```json
{
  "errors": {
    "lines": { "1": { "sku": ["SKU is required"], "qty": ["Quantity must be greater than 0"] } }
  }
}
```

`errors.lines` is either that per-row map, or a flat list of messages about the list itself
(`["Lines is required"]`) when there are no rows to blame. The store sorts one from the other, so
the page only ever sees `fields` and `lines`.

#### Reading is open, writing is not

`POST` and `DELETE` require a session with the matching permission:

| Status | Meaning                                                  |
| ------ | -------------------------------------------------------- |
| `401`  | not logged in — the login dialog can fix it              |
| `403`  | logged in, but without `orders.create` / `orders.delete` |

Session endpoints are `POST /api/login`, `POST /api/logout` and `GET /api/me`
([src/stores/auth.ts](src/stores/auth.ts)). `/api/me` always answers `200` — "nobody" is the guest
user, not an error. The permissions it returns decide which buttons render; they are never the
check, since the browser can lie about them and every guarded endpoint re-checks server-side.

The example login is `admin@example.com` / `orange123` — a published demo credential, not a secret.

#### CSV from the same URL

`GET /api/orders` with `Accept: text/csv` returns the same collection as a spreadsheet. It has to be
fetched rather than linked, because a plain `<a>` cannot set an `Accept` header — see `downloadCsv`
in [src/pages/orders.vue](src/pages/orders.vue).

### Types are generated from the backend

`RecordItem`, `CalendarEvent`, `Order`, `LineItem` and their `…Input` variants are **not** written by
hand here. They come from [`@projectorangebox/api-types`](https://github.com/ProjectOrangeBox/api-types),
generated from the PHP `Dto` classes that validate these payloads, and published automatically by the
backend's CI. The stores re-export them, so pages import from the store as before:

```ts
import type { OrderInput } from '@projectorangebox/api-types'
```

To pick up a backend schema change, `npm update @projectorangebox/api-types`.

### Choosing dev vs. production mode

`APP_ENV` in `.env` controls which mode [docker-entrypoint.sh](docker-entrypoint.sh) starts the container in:

| `APP_ENV` value         | What happens                                                                    |
| ----------------------- | ------------------------------------------------------------------------------- |
| `development` (default) | Runs `npm run dev -- --host`. Vite dev server with HMR, source is live-mounted. |
| `production`            | Runs `npm run build`, then serves the compiled `dist/` via nginx.               |

Both modes listen on container port `3000`, mapped to `http://localhost:3000` on the host either way — no need to remember different ports per mode.

## 🐳 Docker

This project ships one Docker image that behaves as either a dev server or a production server, decided at container start by `APP_ENV` (see above). All commands below are run from the project root.

### Build

```bash
docker compose build
```

Rebuilds the image — needed after changing `package.json`, the `Dockerfile`, or `docker-entrypoint.sh`. Not needed for everyday source edits (those are live-mounted).

### Start

```bash
docker compose up
```

Add `-d` to run in the background:

```bash
docker compose up -d
```

To start in production mode instead of the `.env` default, override `APP_ENV` for this invocation only:

```bash
APP_ENV=production docker compose up
```

### Stop

```bash
docker compose down
```

Stops and removes the container (and its network). Your source files and `.env` are untouched since they live on the host, not inside the container.

### Reload

Dev mode already hot-reloads on file save — no action needed for normal edits.

To pick up a change to `.env` (e.g. a new `APP_ENV` or `VITE_API_BASE_URL`) or to force a clean restart:

```bash
docker compose restart
```

If you changed `package.json` or the `Dockerfile`, rebuild first:

```bash
docker compose up -d --build
```

### Logs

```bash
docker compose logs -f
```

## 💻 Running without Docker

```bash
npm install
npm run dev
```

## 🏗️ Build

```bash
npm run build
```

## 🧪 Available Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run build-only`
- `npm run type-check`
- `npm run lint`
- `npm run lint:fix`
- `npm run format` — format all files with Prettier
- `npm run format:check` — check formatting without writing
- `npm run test` — run the Vitest suite once
- `npm run test:watch` — run Vitest in watch mode
- `npm run test:coverage` — run Vitest with coverage reporting

CI (`.github/workflows/ci.yml`) runs lint, format:check, type-check, test, and build on every push and pull request to `master`.

## 💪 Support Vuetify Development

This project uses Vuetify - an MIT licensed Open Source project. We are glad to welcome contributors and any support for ongoing development:

- Contribute to Vuetify and ecosystem projects: https://github.com/vuetifyjs
- Request enterprise support: https://support.vuetifyjs.com/
- Sponsor on GitHub: https://github.com/sponsors/vuetifyjs
- Support on Open Collective: https://opencollective.com/vuetify
