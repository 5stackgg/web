# Building a 5stack Custom Page (plugin)

Custom Pages let you run your own web app **inside the 5stack panel** — same
sidebar, header, theme, and login — without being part of 5stack itself. Your
app is a Vue [Module Federation](https://module-federation.io/) remote that the
panel loads at runtime and mounts in a native route (`/apps/<slug>`).

- **No iframe** — your component runs in the panel's Vue app.
- **Reuses 5stack auth** — you get the logged-in user; your backend trusts
  forward-auth headers instead of running its own Steam login.
- **Native look** — via the shared `@5stack/ui` design system.

The [hello-world sample](https://github.com/5stackgg/5stack-plugin-hello-world)
is the smallest complete example; the
[inventory plugin](https://github.com/lukepolo/5stack-inventory-plugin) is a
fuller one with a backend + database.

## 1. The manifest — `5stack-plugin.json`

Serve this file at your app's root (put it in `public/` so Vite copies it to
`dist/5stack-plugin.json`). An admin pastes your URL into **Settings →
Application → Custom Pages → Detect**, and the panel auto-fills everything from
it.

```json
{
  "$schema": "https://5stack.gg/schemas/plugin.json",
  "name": "Hello World",
  "slug": "hello",
  "icon": "sparkles",
  "remoteEntry": "/assets/remoteEntry.js",
  "scope": "hello",
  "module": "./App",
  "requiredRole": null
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | ✓ | Menu title. |
| `slug` | ✓ | URL segment → `/apps/<slug>`. Lowercase, `a-z0-9-`. |
| `icon` |  | A [lucide](https://lucide.dev) icon name, an image/SVG **URL** (absolute or relative to the manifest), or an **inline `<svg>`** string. Use `currentColor` in inline SVG so it themes with the nav. |
| `remoteEntry` | ✓ | Federation `remoteEntry.js` URL. Absolute, or relative to the manifest. |
| `scope` | ✓ | Your Federation container name (`name` in the federation plugin). |
| `module` | ✓ | Exposed module path, e.g. `./App`. |
| `requiredRole` |  | `null` = public, or a role (`user`, `moderator`, `administrator`, …). |

> Detect fetches the manifest **server-side** (through the 5stack API), so your
> manifest does not need any CORS headers. Your `remoteEntry.js`, however, is
> imported by the browser cross-origin and does need CORS
> (`Access-Control-Allow-Origin: <panel origin>`).

## 2. Expose your app as a Federation remote

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import federation from "@originjs/vite-plugin-federation";
import cssInjectedByJs from "vite-plugin-css-injected-by-js";

export default defineConfig({
  plugins: [
    vue(),
    cssInjectedByJs(), // Federation shares JS, not CSS — inject yours on load
    federation({
      name: "hello",
      filename: "remoteEntry.js",
      exposes: { "./App": "./src/App.vue" },
      shared: {
        vue: { singleton: true, requiredVersion: false },
        "reka-ui": { singleton: true, requiredVersion: false },
        "@5stack/ui": { singleton: true, requiredVersion: false },
        // ...only what you import; each must be installed
      },
    }),
  ],
  build: { target: "esnext", cssCodeSplit: false },
});
```

**Version lockstep:** pin `vue`, `reka-ui`, `pinia`, `@5stack/ui` to the same
versions the panel uses, or Federation loads a second copy and reactivity /
component context break. Only list a package in `shared` if you actually import
it (Federation builds an entry for each).

## 3. Receive the user

The panel passes the authenticated user in as a prop:

```vue
<script setup lang="ts">
defineProps<{ user?: { steam_id: string; name: string; role: string } | null }>();
</script>
```

If you have a backend, don't parse the cookie or run Steam auth. Put your
service behind 5stack forward-auth and read the identity headers:

```
nginx.ingress.kubernetes.io/auth-url: "http://api.5stack.svc.cluster.local:5585/custom-pages/authorize"
nginx.ingress.kubernetes.io/auth-response-headers: "X-5stack-Steam-Id,X-5stack-Role,X-5stack-Name"
```

Your backend then trusts `X-5stack-Steam-Id` / `X-5stack-Role` / `X-5stack-Name`.

## 4. Match the look

Depend on `@5stack/ui` (published on npm). Use its Tailwind preset + tokens:

```js
// tailwind.config.js
module.exports = {
  presets: [require("@5stack/ui/tailwind-plugin-preset")],
  content: ["./index.html", "./src/**/*.{vue,ts}"],
};
```

```css
/* src/style.css — scopes every rule to your plugin root so nothing
   leaks onto the panel's chrome */
@import "@5stack/ui/plugin.css";
```

```ts
import { cn } from "@5stack/ui";
```

Put `data-5stack-plugin` on your root element — the preset scopes all utilities
to it. See [Styling](/plugins/styling) for why.

## 5. Deploy & register

1. Build (`vite build`) and host the `dist/` output somewhere the panel can
   reach (its own subdomain is simplest — the session cookie is same-site).
2. In the panel: **Settings → Application → Custom Pages → Add**, paste your
   base URL, hit **Detect**, toggle **Enabled**, save. Enable the **Custom
   Pages** master switch.

That's it — your app appears in the sidebar at `/apps/<slug>`, rendered
natively.
