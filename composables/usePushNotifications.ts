import { ref, computed } from "vue";

// Web Push subscribe/unsubscribe against the API's PushNotificationsController.
//
// Deliberately separate from stores/NotificationStore.ts, which only ever deals
// with the in-app bell. This is the one place that touches the service worker's
// PushManager, and permission is only ever requested from a real click --
// iOS silently and permanently ignores a prompt that wasn't triggered by a user
// gesture, so an automatic request burns the one chance to ask.

const supported = ref(false);
const permission = ref<NotificationPermission | "unsupported">("unsupported");
const subscribed = ref(false);
const busy = ref(false);

function pushApiUrl(path: string): string {
  return `https://${useRuntimeConfig().public.apiDomain}/notifications/push${path}`;
}

// PushManager wants the VAPID key as raw bytes, not the base64url string the
// backend hands out.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;

  return registration.pushManager.getSubscription();
}

export function usePushNotifications() {
  const isDenied = computed(() => permission.value === "denied");

  async function refresh() {
    supported.value = isPushSupported();

    if (!supported.value) {
      permission.value = "unsupported";
      return;
    }

    permission.value = Notification.permission;
    subscribed.value = Boolean(await getExistingSubscription());
  }

  // Must be called straight from a click handler. Nothing may be awaited before
  // requestPermission(), or the prompt is no longer attributable to the gesture
  // that triggered it.
  async function subscribe(): Promise<boolean> {
    if (!isPushSupported() || busy.value) {
      return false;
    }

    busy.value = true;

    try {
      const granted = await Notification.requestPermission();
      permission.value = granted;

      if (granted !== "granted") {
        return false;
      }

      const { publicKey } = await $fetch<{ publicKey: string | null }>(
        pushApiUrl("/vapid-public-key"),
      );

      if (!publicKey) {
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      await $fetch(pushApiUrl("/subscribe"), {
        method: "POST",
        credentials: "include",
        body: { subscription: subscription.toJSON() },
      });

      subscribed.value = true;

      return true;
    } finally {
      busy.value = false;
    }
  }

  async function unsubscribe(): Promise<void> {
    if (busy.value) {
      return;
    }

    busy.value = true;

    try {
      const subscription = await getExistingSubscription();

      if (!subscription) {
        subscribed.value = false;
        return;
      }

      // Drop the server row first: a browser-side unsubscribe that outruns it
      // leaves an endpoint we keep pushing to until the push service 410s.
      await $fetch(pushApiUrl("/subscribe"), {
        method: "DELETE",
        credentials: "include",
        body: { endpoint: subscription.endpoint },
      }).catch(() => undefined);

      await subscription.unsubscribe();
      subscribed.value = false;
    } finally {
      busy.value = false;
    }
  }

  return {
    supported,
    permission,
    subscribed,
    busy,
    isDenied,
    refresh,
    subscribe,
    unsubscribe,
  };
}
