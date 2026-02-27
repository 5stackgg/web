# 5Stack Web

A Nuxt 3 (Vue 3) SPA for managing competitive CS2 matches and tournaments. Uses Yarn 4 (Berry) with corepack.

## Cursor Cloud specific instructions

### Quick reference

- **Dev server**: `yarn dev` — starts on `http://localhost:3000` (binds `0.0.0.0`)
- **TypeScript check**: `npx vue-tsc --noEmit` — pre-existing type errors exist in the codebase; exit code 2 is expected
- **Install deps**: `yarn install` — runs `nuxt prepare` via the `postinstall` hook
- **Translation check**: `yarn check-translations`
- **Build**: `yarn build`

### Environment

- Requires Node.js 22 (see `.nvmrc`) and Yarn 4.11.0 via corepack
- Copy `.env-example` to `.env` for local development. The default values point at the production `5stack.gg` domains. No backend services are needed for the web frontend to start and render pages.
- This is a client-side SPA (`ssr: false`). The backend (Hasura GraphQL, WebSocket server, Steam auth) is external and not part of this repo. The app loads and is fully interactive without a local backend; data-dependent pages will show empty states or errors when backend is unreachable.

### Gotchas

- No ESLint config or test framework is present in this repo. The only static analysis available is `vue-tsc` type checking.
- The `codegen` script requires a running Hasura instance and `HASURA_GRAPHQL_ADMIN_SECRET` in `.env` — skip it for local UI development.
- Yarn 4 Berry uses `nodeLinker: node-modules` (see `.yarnrc.yml`), so `node_modules/` is a regular directory, not PnP.
