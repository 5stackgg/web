import { defineNuxtModule, useLogger } from "@nuxt/kit";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Everything `NUXT_DEV_TUNNEL_HOST=dev.5stack.gg yarn dev` has to be true for,
// done here rather than in a runbook. Opening the camera page on a real phone
// needs a secure origin -- `getUserMedia` does not exist without one, and
// `localhost` is only secure on the machine running it -- and it needs that
// origin to be a subdomain of the panel's own domain, or the session cookie is
// third-party and Safari drops it. A named Cloudflare tunnel is both.
//
// See docs/mobile-https-dev.md for what this is doing and why.

const CLOUDFLARED_DIR = join(homedir(), ".cloudflared");

type Check = { ok: boolean; fix?: string };

type NodeResponse = {
  setHeader: (name: string, value: unknown) => unknown;
};

export default defineNuxtModule({
  meta: { name: "dev-tunnel" },

  setup(_options, nuxt) {
    const host = process.env.NUXT_DEV_TUNNEL_HOST?.trim();

    if (!host || !nuxt.options.dev) {
      return;
    }

    const logger = useLogger("dev-tunnel");

    // Only the QR codes, never webDomain. That one names where the API's own
    // web-domain routes are served from -- /auth/steam, /discord-invite, see
    // base/api/ingress.yaml -- and the tunnel serves the Nuxt dev server, which
    // has none of them: pointing it here answers the login link with the SPA
    // shell, and the route middleware bounces straight back to /login. It is
    // also compared against the literal "5stack.gg" in a couple of places to
    // tell a hosted panel from a self-hosted one.
    //
    // Written back to the environment rather than only onto the resolved config
    // so it lands before Nitro reads NUXT_PUBLIC_*.
    process.env.NUXT_PUBLIC_DEVICE_DOMAIN = host;
    nuxt.options.runtimeConfig.public.deviceDomain = host;

    nuxt.options.vite.server = {
      ...nuxt.options.vite.server,
      // Vite answers a Host header it was not told to expect with a bare
      // "Blocked request", which is every request arriving through a tunnel.
      allowedHosts: [host],
      // TLS is terminated at the tunnel and this server is plain http, so the
      // injected client would otherwise dial ws:// on the dev port -- blocked
      // as mixed content, with nothing listening there anyway.
      hmr: { protocol: "wss", host, clientPort: 443 },
    };

    // A tunnel only works on a proxied record, and Cloudflare caches .js at the
    // edge by default -- while Vite marks optimized deps `immutable` with a
    // one-year max-age. Left alone, the edge pins a dep bundle and hands it to
    // every browser and device that asks, so the moment the dependency graph
    // changes underneath it the page is loading two copies of Vue: one fresh,
    // one from a URL the dev server now answers with a 404. It presents as
    // `currentRenderingInstance` being null inside renderSlot, and it survives
    // restarting the dev server, clearing the browser cache and switching
    // browsers, because none of those are where the stale copy lives.
    //
    // Set before Vite's own middlewares run, and then pinned: the dep handler
    // sets that immutable header itself, and this has to be the value that
    // reaches the edge.
    nuxt.options.vite.plugins ??= [];
    nuxt.options.vite.plugins.push({
      name: "5stack:dev-tunnel-no-store",
      configureServer(server: {
        middlewares: {
          use: (
            fn: (req: unknown, res: NodeResponse, next: () => void) => void,
          ) => void;
        };
      }) {
        server.middlewares.use((_req, res, next) => {
          const setHeader = res.setHeader.bind(res);

          setHeader("Cache-Control", "no-store");

          res.setHeader = ((name: string, value: unknown) =>
            name.toLowerCase() === "cache-control"
              ? setHeader(name, "no-store")
              : setHeader(name, value)) as NodeResponse["setHeader"];

          next();
        });
      },
    });

    // One tunnel per hostname. Deriving the name means changing the host does
    // not quietly keep routing the old DNS record at this machine.
    const tunnel = host.replace(/[^a-z0-9]+/gi, "-");

    let child: ChildProcess | null = null;

    function run(args: Array<string>) {
      return spawnSync("cloudflared", args, { encoding: "utf8" });
    }

    function checkInstalled(): Check {
      if (run(["--version"]).status === 0) {
        return { ok: true };
      }

      return { ok: false, fix: "brew install cloudflared" };
    }

    // `tunnel login` is a browser round trip, so it is the one step that cannot
    // be done for them. It leaves this certificate behind when it succeeds.
    function checkLoggedIn(): Check {
      if (existsSync(join(CLOUDFLARED_DIR, "cert.pem"))) {
        return { ok: true };
      }

      return {
        ok: false,
        fix: "cloudflared tunnel login   # then pick the 5stack.gg zone",
      };
    }

    function ensureTunnel(): Check {
      const listed = run(["tunnel", "list", "--output", "json"]);

      if (listed.status !== 0) {
        return { ok: false, fix: listed.stderr.trim() };
      }

      try {
        const existing = JSON.parse(listed.stdout || "[]") as Array<{
          name: string;
        }>;

        if (existing.some((entry) => entry.name === tunnel)) {
          return { ok: true };
        }
      } catch {
        // Fall through and try to create it; a duplicate is reported clearly.
      }

      logger.info(`creating tunnel ${tunnel}`);
      const created = run(["tunnel", "create", tunnel]);

      return created.status === 0
        ? { ok: true }
        : { ok: false, fix: created.stderr.trim() };
    }

    // Idempotent in practice but not in its exit code: pointing an existing
    // record at the same tunnel is still an error, and it is the normal case
    // on every run after the first.
    function ensureDnsRoute(): Check {
      const routed = run(["tunnel", "route", "dns", tunnel, host]);

      if (routed.status === 0) {
        return { ok: true };
      }

      const message = `${routed.stderr}${routed.stdout}`;

      if (/already (exists|configured)|record with that host/i.test(message)) {
        return { ok: true };
      }

      return { ok: false, fix: message.trim() };
    }

    // The panel's API is deployed elsewhere and keeps its own allow list, so
    // this origin has to be on it. Checked with a real preflight rather than
    // assumed, because the failure it produces in the browser is a bare
    // "Failed to fetch" that names neither CORS nor the origin it rejected.
    async function checkApiCors(): Promise<Check> {
      const apiDomain = process.env.NUXT_PUBLIC_API_DOMAIN;

      if (!apiDomain || apiDomain === host) {
        return { ok: true };
      }

      let allowed: string | null = null;

      try {
        const response = await fetch(`https://${apiDomain}/me`, {
          headers: { Origin: `https://${host}` },
        });

        allowed = response.headers.get("access-control-allow-origin");
      } catch (error) {
        return {
          ok: false,
          fix: `could not reach https://${apiDomain}: ${(error as Error).message}`,
        };
      }

      if (allowed === `https://${host}`) {
        return { ok: true };
      }

      // A subdomain of the API's own domain needs no configuration at all --
      // it is inside the session cookie's scope, which is what the API allows
      // (api/src/utilities/isAllowedOrigin.ts). Being refused means the
      // deployed build predates that, so say so rather than sending them to
      // set a variable that will turn out not to have been the problem.
      const sharesDomain = host
        .toLowerCase()
        .endsWith(`.${apiDomain.toLowerCase().split(".").slice(-2).join(".")}`);

      return {
        ok: false,
        fix: [
          `https://${apiDomain} does not allow https://${host}.`,
          ...(sharesDomain
            ? [
                `It is a subdomain of the API's own domain, so no config is`,
                `needed -- the deployed API just has to be running a build with`,
                `api/src/utilities/isAllowedOrigin.ts.`,
              ]
            : [
                `It is outside the API's domain, so add`,
                `EXTRA_CORS_ORIGINS=https://${host} to the api-config env of the`,
                `overlay you deploy from, then re-apply and restart the API.`,
              ]),
        ].join("\n           "),
      };
    }

    // Whether the edge is still holding assets from before no-store was in
    // place. Nothing here can evict those -- only a purge can -- and until one
    // happens the page loads a mix of fresh modules and whatever Cloudflare
    // pinned, which is a broken app with a stack trace that points at Vue.
    async function checkEdgeCache(): Promise<Check> {
      let status: string | null = null;

      try {
        const response = await fetch(`https://${host}/_nuxt/@vite/client`, {
          headers: { "Cache-Control": "no-cache" },
        });

        status = response.headers.get("cf-cache-status");
      } catch {
        // The tunnel may not have finished coming up; not worth a warning.
        return { ok: true };
      }

      if (!status || status === "DYNAMIC" || status === "BYPASS") {
        return { ok: true };
      }

      return {
        ok: false,
        fix: [
          `Cloudflare is caching this dev server (cf-cache-status: ${status}).`,
          `It will serve stale modules to every browser and phone, which shows`,
          `up as "Cannot read properties of null (reading 'ce')".`,
          `Purge it once: dash.cloudflare.com -> 5stack.gg -> Caching -> Purge`,
          `Everything. Then add a Cache Rule (hostname equals ${host} ->`,
          `Bypass cache) so it stays out of the way.`,
        ].join("\n           "),
      };
    }

    function stop() {
      child?.kill("SIGTERM");
      child = null;
    }

    // listhen's Listener carries `url` and an AddressInfo, but no `port` of its
    // own -- and the port is not knowable from config, since Nuxt walks forward
    // from 3000 whenever that one is taken.
    function portOf(listener: { url: string; address: unknown }) {
      const fromUrl = Number(new URL(listener.url).port);

      if (fromUrl) {
        return fromUrl;
      }

      const address = listener.address as { port?: number } | null;

      return address?.port;
    }

    nuxt.hook("listen", async (_server, listener) => {
      const port = portOf(listener);

      if (!port) {
        logger.error(
          `could not work out the dev server port from ${listener.url}`,
        );
        return;
      }

      for (const [label, check] of [
        ["cloudflared", checkInstalled()],
        ["login", checkLoggedIn()],
      ] as Array<[string, Check]>) {
        if (!check.ok) {
          logger.error(`${label}: not ready\n           ${check.fix}`);
          return;
        }
      }

      for (const [label, check] of [
        ["tunnel", ensureTunnel()],
        ["dns", ensureDnsRoute()],
      ] as Array<[string, Check]>) {
        if (!check.ok) {
          logger.error(`${label}: ${check.fix}`);
          return;
        }
      }

      child = spawn(
        "cloudflared",
        ["tunnel", "run", "--url", `http://localhost:${port}`, tunnel],
        { stdio: ["ignore", "ignore", "pipe"] },
      );

      // cloudflared logs everything to stderr, including success, so only the
      // lines worth waking someone up for are forwarded.
      child.stderr?.on("data", (chunk: Buffer) => {
        const text = String(chunk);

        if (/ERR|error=/.test(text)) {
          logger.warn(text.trim());
        }
      });

      child.on("exit", (code) => {
        if (code) {
          logger.error(`cloudflared exited (${code})`);
        }
      });

      logger.success(`https://${host} -> localhost:${port}`);

      for (const [label, check] of [
        ["api cors", await checkApiCors()],
        ["edge cache", await checkEdgeCache()],
      ] as Array<[string, Check]>) {
        if (!check.ok) {
          logger.warn(`${label}: ${check.fix}`);
        }
      }
    });

    nuxt.hook("close", stop);
    process.once("exit", stop);
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  },
});
