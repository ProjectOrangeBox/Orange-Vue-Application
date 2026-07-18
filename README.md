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
VITE_API_BASE_URL=http://localhost:8000/api
```

Only variables prefixed with `VITE_` are exposed to browser code — this is a Vite security feature, so arbitrary environment variables (secrets, host paths, etc.) never leak into the client bundle by accident.

That value is read in one place, [src/config/env.ts](src/config/env.ts):

```ts
export const apiBaseUrl = requireEnv('VITE_API_BASE_URL')
```

Import `apiBaseUrl` anywhere you need to call the API instead of hardcoding a URL — see the example `fetchFromApi` action in [src/stores/app.ts](src/stores/app.ts). To point the app at a different backend, change `VITE_API_BASE_URL` in `.env` (or override it in `.env.local`) and restart/reload — see below.

**Note:** Vite bakes `VITE_*` variables into the JS bundle wherever they're used. In dev mode this is re-read every time the dev server (re)starts. In production mode, the value is fixed at `npm run build` time — since the Docker image runs that build at container *start* (see below), changing `.env` and restarting the container is enough; you don't need to rebuild the image.

### Choosing dev vs. production mode

`APP_ENV` in `.env` controls which mode [docker-entrypoint.sh](docker-entrypoint.sh) starts the container in:

| `APP_ENV` value | What happens |
|---|---|
| `development` (default) | Runs `npm run dev -- --host`. Vite dev server with HMR, source is live-mounted. |
| `production` | Runs `npm run build`, then serves the compiled `dist/` via nginx. |

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

## 💪 Support Vuetify Development

This project uses Vuetify - an MIT licensed Open Source project. We are glad to welcome contributors and any support for ongoing development:

- Contribute to Vuetify and ecosystem projects: https://github.com/vuetifyjs
- Request enterprise support: https://support.vuetifyjs.com/
- Sponsor on GitHub: https://github.com/sponsors/vuetifyjs
- Support on Open Collective: https://opencollective.com/vuetify
