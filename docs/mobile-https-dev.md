# Testing the camera page on a real phone

`/matches/:id/camera` cannot be tested from `localhost`. Three separate browser
rules stand in the way, and each one fails differently:

- **`getUserMedia` only exists on a
  [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).**
  Otherwise `navigator.mediaDevices` is `undefined` and the camera never opens.
- **The session cookie is `Secure`, and scoped to `.5stack.gg`**
  (`api/src/utilities/getCookieOptions.ts`). Otherwise the phone is not signed
  in, and the route requires a login.
- **The API only answers CORS preflights from origins it was told about**
  (`api/src/main.ts`). Otherwise the WHIP `POST` fails as `unreachable` before
  it is ever sent.

`localhost` is a secure origin only on the machine running it — a phone typing
in your laptop's LAN address gets none of the above. And a LAN address or a
`*.ts.net` name is not a `5stack.gg` subdomain, so the session cookie becomes
third-party, which Safari blocks outright.

So the dev server has to be reachable **over TLS, on a `5stack.gg` subdomain**.
A Cloudflare tunnel is the shortest way there.

## Running it

One variable, in `web/.env`:

```sh
NUXT_DEV_TUNNEL_HOST=dev.5stack.gg
```

Then `yarn dev` as normal. `modules/dev-tunnel.ts` picks it up and does the
rest: creates the tunnel and its DNS record if they do not exist, starts
`cloudflared` against whatever port Nuxt actually bound (it walks forward from
3000 when that one is taken) and stops it again on exit, adds the hostname to
`vite.server.allowedHosts` (Vite answers an unexpected `Host` header with a bare
"Blocked request"), repoints HMR at `wss://…:443` since TLS is terminated at the
tunnel, and sets `deviceDomain`.

That last one is what the QR codes are built from — `cameraPlayerJoinUrl` in
`composables/useCameraApi.ts` and `CallPhoneQr.vue`, both absolute because a
phone cannot resolve whatever origin the tab that drew the QR is on. Left at the
deployed value they send the phone to production, which is the one failure that
looks like the page simply working.

It is deliberately **not** `webDomain`. That one names where the API's own
web-domain routes are served from — `/auth/steam`, `/discord-invite`, see
`base/api/ingress.yaml` under `host: $(WEB_DOMAIN)` — and the tunnel serves the
Nuxt dev server, which has none of them. Point it at the tunnel and the login
link is answered with the SPA shell, the route middleware finds no session and
bounces to `/login`: a login button that appears to do nothing. It is also
compared against the literal `"5stack.gg"` in `LeftNav.vue` and
`GameServerNodeRow.vue` to tell a hosted panel from a self-hosted one.

`NUXT_PUBLIC_API_DOMAIN` stays pointed at a deployed API. Nothing about the
camera flow needs it local — the API only proxies SDP.

### Stop Cloudflare caching the tunnel

Do this once, in the dashboard. A tunnel only works on a **proxied** record, and
Cloudflare caches `.js` at the edge by default — while Vite marks its optimized
dependency bundles `immutable, max-age=31536000`. The edge pins one and hands it
to every browser and device that asks, so as soon as the dependency graph
changes underneath it the page loads two copies of Vue:

```
Cannot read properties of null (reading 'ce')
  at renderSlot (…/@vue/runtime-core/…?v=f137781b)      ← fresh
  at renderComponentRoot (…/@vue/runtime-core/…?v=1120b562)  ← from the edge
```

`renderSlot` reads a module-scoped `currentRenderingInstance`; with two copies
of the module the one it consults was never assigned. It survives restarting the
dev server, `rm -rf .nuxt`, clearing the browser cache and switching browsers,
because none of those are where the stale copy lives — the dev server answers
that URL with a 404.

**dash.cloudflare.com → 5stack.gg → Caching → Cache Rules → Create rule:**
_If_ hostname equals `dev.5stack.gg`, _then_ Cache eligibility → **Bypass
cache**. A bypass rule stops the edge consulting the cache at all, so it also
neutralises whatever is already stored — no purge needed, and production is
untouched. (Caching → Configuration → **Development Mode** is a one-click
equivalent, but it is zone-wide and expires after three hours.)

`modules/dev-tunnel.ts` also forces `Cache-Control: no-store` on every dev
response so nothing new gets stored, and warns at startup if the edge is still
answering from cache.

### The two steps it cannot do for you

**Log in to Cloudflare.** A browser round trip, so it just tells you:

```sh
brew install cloudflared        # if missing
cloudflared tunnel login        # then pick the 5stack.gg zone
```

**Let the API accept the new origin.** Nothing to configure if the tunnel host
is a subdomain of the API's own domain — `api/src/utilities/isAllowedOrigin.ts`
allows anything inside the session cookie's scope, which a subdomain of
`WEB_DOMAIN` already is. But the *deployed* API has to be running a build that
contains it, so that change has to ship before a tunnel on `dev.5stack.gg`
works.

For a host outside that domain — a `trycloudflare.com` or ngrok name — name it
explicitly. The API reads `EXTRA_CORS_ORIGINS` (comma separated, full origins
including the scheme) from the `api-config` ConfigMap the deployment already
mounts with `envFrom`, so in 5stack-panel, in the overlay you deploy from:

```sh
# overlays/<your-overlay>/config/api-config.env
EXTRA_CORS_ORIGINS=https://cuddly-otter.trycloudflare.com
```

then re-apply and let the API restart.

The module checks all of this with a real preflight on startup and says which
case you are in, rather than leaving you with the bare "Failed to fetch" the
browser gives for a rejected origin.

## Checking it worked

On the phone, open `https://dev.5stack.gg`, sign in, then join a lobby party
and open a match's camera setup. Scan the QR from the desktop, or just navigate
to `/matches/<id>/camera`.

- **"Your camera needs a secure connection"** — the page is on `http`. The
  tunnel is not in front of it.
- **Stuck on _Connecting_, then an ICE error** — signalling worked and the media
  path did not. MediaMTX advertises `MTX_WEBRTCADDITIONALHOSTS` and needs
  UDP/8189 open to the phone; a mobile network behind CGNAT needs the coturn
  overlay deployed with `TURN_DOMAIN` set, or there is no relay to fall back on.
- **`could not reach https://api.5stack.gg/...`** — the preflight was blocked.
  `EXTRA_CORS_ORIGINS` is missing or the API has not restarted since it was set.

## Why not the alternatives

- **mkcert + `devServer.https` on the LAN IP.** No external services, but the
  root CA has to be installed and trusted on every phone, it is wifi-only, and
  the origin is not a `5stack.gg` subdomain — so iOS Safari drops the session
  cookie and you never get past the login.
- **`tailscale serve`.** Real certificate, no CA to install, works off-LAN, but
  the origin is `<host>.<tailnet>.ts.net` — same third-party cookie problem.
