// Loaded into the generated Workbox service worker via nuxt.config.ts's
// `pwa.workbox.importScripts`. Handles the two events that only ever fire on
// the service-worker thread -- which is exactly why notifications can arrive
// with the app closed at all.
//
// Plain JS, no imports: this file is served as-is from public/ and is not part
// of the build pipeline. Bump the ?v= in nuxt.config.ts when it changes.
/* eslint-disable no-undef */

// The API says where its GraphQL endpoint is, but the worker only trusts it
// if it is https and on the same site it is itself served from -- the same
// site the auth cookie is scoped to, so nowhere else could use it anyway.
const trustedGraphqlUrl = (candidate) => {
  if (typeof candidate !== "string") {
    return null;
  }

  let url;

  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") {
    return null;
  }

  const site = (host) => host.split(".").slice(-2).join(".");

  return site(url.hostname) === site(self.location.hostname) ? url.href : null;
};

// Notification buttons come with a ready-made operation each; the worker only
// has to show them and, on a tap, post the one that was tapped.
const actionsOf = (payload) => {
  const limit =
    typeof Notification !== "undefined" &&
    Number.isInteger(Notification.maxActions)
      ? Notification.maxActions
      : 2;

  return (Array.isArray(payload.actions) ? payload.actions : [])
    .filter(
      (action) =>
        action &&
        typeof action.action === "string" &&
        typeof action.title === "string" &&
        action.operation &&
        typeof action.operation.query === "string",
    )
    .slice(0, limit);
};

const setAppBadge = async (unread) => {
  if (!("setAppBadge" in navigator) || !Number.isInteger(unread)) {
    return;
  }

  try {
    if (unread > 0) {
      await navigator.setAppBadge(unread);
    } else {
      await navigator.clearAppBadge();
    }
  } catch {
    // Badging is best-effort; a platform that refuses it still got the push.
  }
};

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "5stack", body: event.data ? event.data.text() : "" };
  }

  const actions = actionsOf(payload);

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title || "5stack", {
        body: payload.body || "",
        icon: payload.icon || "/favicon/192.png",
        badge: "/favicon/64.png",
        // A hero image where the platform draws one (Android, desktop
        // Chrome); iOS drops it on the floor.
        image: payload.image || undefined,
        actions: actions.map(({ action, title }) => ({ action, title })),
        // Lets the OS replace an earlier notification for the same conversation
        // or match instead of stacking one per message.
        tag: payload.tag,
        // ...and makes that replacement alert again. A tagged notification is
        // silent by default when it lands on top of one already showing, so
        // without this the summary that closes a burst arrives unannounced.
        // Ignored unless `tag` is set, and throws in Chrome without one.
        renotify: payload.renotify !== false && Boolean(payload.tag),
        data: {
          url: payload.url || "/",
          threadKey: payload.threadKey || payload.tag,
          count: payload.count || 1,
          actions,
          graphqlUrl: trustedGraphqlUrl(payload.graphqlUrl),
        },
      }),
      setAppBadge(payload.unread),
    ]),
  );
});

// Runs the tapped button's operation with the player's own cookie -- the same
// request the bell makes for the same button. Resolves to whether it worked,
// so a failure can fall back to opening the app where it can be done by hand.
const runAction = async (notification, actionId) => {
  const { actions, graphqlUrl } = notification.data || {};
  const action = (actions || []).find(({ action }) => action === actionId);

  if (!action || !graphqlUrl) {
    return false;
  }

  try {
    const response = await fetch(graphqlUrl, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action.operation),
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();

    return !(Array.isArray(result.errors) && result.errors.length > 0);
  } catch {
    return false;
  }
};

// The type -> route mapping lives in the app's router, so rather than
// duplicating it here in plain JS with no shared source of truth, the API sends
// the destination on the payload. An already-open tab is handed the url and
// navigates client-side; otherwise the app opens straight to it.
const openApp = async (url) => {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of clients) {
    if ("focus" in client) {
      client.postMessage({ type: "push-notification-click", url });
      return client.focus();
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(url);
  }
};

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Always an in-app path. `//evil.test/x` starts with a slash and is a fully
  // qualified URL to somewhere else, which openWindow would happily follow.
  const destination = event.notification.data?.url || "/";
  const url =
    destination.startsWith("/") && !destination.startsWith("//")
      ? destination
      : "/";

  event.waitUntil(
    (async () => {
      if (event.action && (await runAction(event.notification, event.action))) {
        return;
      }

      return openApp(url);
    })(),
  );
});
