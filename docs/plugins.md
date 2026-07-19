# Building a 5stack Plugin

Plugins let you run your own web app **inside the 5stack panel** — same
sidebar, header, theme, and login — without being part of 5stack itself. Your
app is a Vue [Module Federation](https://module-federation.io/) remote that the
panel loads at runtime and mounts in a native route (`/apps/<slug>`).

- **No iframe** — your component runs in the panel's Vue app.
- **Reuses 5stack auth** — you get the logged-in user; your backend exchanges the
  existing session cookie for identity instead of running its own Steam login.
- **Native look** — via the shared `@5stack/ui` design system.

The [hello-world sample](https://github.com/5stackgg/5stack-plugin-hello-world)
is the smallest complete example; the
[inventory plugin](https://github.com/lukepolo/5stack-inventory-plugin) is a
fuller one with a backend + database.

## 1. The manifest — `5stack-plugin.json`

Serve this file at your app's root (put it in `public/` so Vite copies it to
`dist/5stack-plugin.json`). An admin pastes your URL into **Settings →
Application → Plugins → Detect**, and the panel auto-fills everything from
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
  "requiredRole": null,
  "deployments": ["example-plugin"]
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
| `deployments` |  | Kubernetes Deployment names in the `5stack` namespace to watch for image updates. See [Updates](#6-updates). |

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
import * as vueNs from "vue";

// Borrow the panel's Vue instead of bundling a second copy. Resolves bare
// `vue` to a tiny synchronous module that reads window.__5stack_shared__.
const VIRTUAL = "\0__5stack_shared__:";
const VUE_EXPORTS = Object.keys(vueNs).filter((n) => n !== "default");

function sharedGlobals() {
  return {
    name: "5stack-shared-globals",
    enforce: "pre" as const,
    resolveId: (id: string) => (id === "vue" ? `${VIRTUAL}vue` : null),
    load(id: string) {
      if (!id.startsWith(VIRTUAL)) return null;
      return [
        `const shared = globalThis.__5stack_shared__;`,
        `const m = shared && shared.vue;`,
        `if (!m) throw new Error("[5stack] panel did not publish a shared Vue");`,
        `export default m.default ?? m;`,
        ...VUE_EXPORTS.map((n) => `export const ${n} = m[${JSON.stringify(n)}];`),
      ].join("\n");
    },
  };
}

export default defineConfig({
  plugins: [
    sharedGlobals(),
    vue(),
    cssInjectedByJs(), // Federation shares JS, not CSS — inject yours on load
    federation({
      name: "hello",
      filename: "remoteEntry.js",
      exposes: { "./App": "./src/App.vue" },
      // No `shared` — see the warning below.
    }),
  ],
  optimizeDeps: { exclude: ["vue"] },
  build: { target: "esnext", cssCodeSplit: false },
});
```

> **Do not add `shared` to `federation()`.** It looks like the obvious way to
> share Vue, and it is how this guide used to read — but Federation implements
> sharing by rewriting every import of a shared package into
> `await importShared(...)`, which turns the importing chunk into an async
> module. Safari throws `Cannot access '<x>' before initialization` whenever
> several modules import the same top-level-await module concurrently
> ([WebKit 242740](https://bugs.webkit.org/show_bug.cgi?id=242740), fixed only
> in STP 243+, so shipping iOS Safari still has it). The panel hit exactly this:
> 308 of its 474 chunks had become async, and the app was unusable on iOS. See
> also [originjs/vite-plugin-federation#403](https://github.com/originjs/vite-plugin-federation/issues/403).

**Only `vue` is shared**, because it is the one package where a second copy
breaks anything — reactivity and component context. Everything else
(`reka-ui`, `lucide-vue-next`, `@5stack/ui`, …) you simply bundle: install it,
import it, done. Whatever you bundle that itself imports Vue resolves through
the same bridge, so there is still exactly one Vue instance in the page. Your
remote gets a bit larger; in exchange there is no version negotiation to get
wrong and no top-level await.

**Version lockstep still matters for `@5stack/ui`** — its components are built
against the panel's `reka-ui`/Tailwind tokens, so track the panel's version.
`vue` no longer needs pinning: you get the panel's instance whatever you have
installed locally (your local copy is used only for typings and to enumerate
export names at build time).

## 3. Receive the user

The panel passes the authenticated user in as a prop:

```vue
<script setup lang="ts">
defineProps<{ user?: { steam_id: string; name: string; role: string } | null }>();
</script>
```

If you have a backend, don't decode the cookie or run Steam auth. Every request
already carries the 5stack session cookie — forward it to the panel and get the
identity back as JSON:

```ts
const res = await fetch(
  "http://api.5stack.svc.cluster.local:5585/plugins/authorize",
  { headers: { cookie: request.headers.cookie ?? "" } },
);
// 200 -> { steam_id, role, name }   401 -> anonymous
```

Cache that for a few seconds keyed on the cookie. Your backend **must** be on a
subdomain of the panel's domain, or the cookie never arrives at all.

There is also an ingress-level forward-auth mode that injects the identity as
headers instead. It is faster but fails open if the Service is ever reachable
off-ingress — see [Backend & Auth](/plugins/backend) before choosing it.

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
2. In the panel: **Settings → Application → Plugins → Add**, paste your
   base URL, hit **Detect**, toggle **Enabled**, save. Enable the **Plugins** master switch.

That's it — your app appears in the sidebar at `/apps/<slug>`, rendered
natively.

## 6. Updates

List your Deployment names in `deployments` and the panel keeps them up to date
the same way it does its own services — the update appears in the header bell
alongside `api` and `web`, and the same **Update** button rolls it out.

```json
"deployments": ["inventory-frontend", "inventory-backend"]
```

Every minute the panel reads each Deployment, takes the image off its pod spec,
asks that image's registry what digest the tag points at now, and compares it to
the digest the running pod actually pulled. Note that it reads the image from
the **live Deployment**, not from this manifest — so switching registries or
renaming an image needs no manifest change. Only the names are declared here.

For that to work your Deployment must **pin a moving tag** and re-pull it:

```yaml
image: ghcr.io/you/your-plugin:latest
imagePullPolicy: Always
```

The tag never changes, so "updating" is just restarting the pod — which is
exactly what the panel does. A digest-pinned image (`@sha256:…`) is skipped:
it already names exact bytes, so it can never be out of date.

**Release channels come free.** The deployed tag *is* the channel — deploy
`:beta` and you are compared against beta digests. There is nothing to configure.

Caveats:

- **Names are validated.** First-party deployments (`api`, `web`, `hasura`,
  `redis`, …) are rejected — a plugin can't get the panel to restart the panel.
- **In-cluster only.** A Deployment that doesn't exist in the `5stack` namespace
  is skipped. Plugins hosted elsewhere don't get update detection, since the
  panel has nothing it could restart.
- **Public registries only.** Private registries need a pull token the panel
  doesn't have; those deployments are skipped with a warning in the API log.
- **Deployments only.** DaemonSets and StatefulSets aren't supported.
- Changing `deployments` later means hitting **Detect** again in the panel — the
  manifest is read at registration, not continuously.
