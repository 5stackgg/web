import { ref } from "vue";

// Per-player notification preferences for both delivery channels.
//
// Not a Pinia store on purpose: NotificationStore consumes this to filter the
// bell, and a store consuming a store here would be a circular import.
//
// The key list and every default come from the backend
// (src/notifications/preferences/notification-categories.ts). Nothing here
// hardcodes a category, so adding one server-side needs no frontend change
// beyond a label.

export type NotificationChannel = "push" | "in_app";

export type NotificationPreference = {
  key: string;
  enabled: boolean;
  defaultEnabled: boolean;
  adminOnly?: boolean;
};

const preferences = ref<Record<NotificationChannel, NotificationPreference[]>>({
  push: [],
  in_app: [],
});
const loaded = ref(false);
const loading = ref(false);

function preferencesApiUrl(path: string): string {
  return `https://${useRuntimeConfig().public.apiDomain}/notifications/preferences${path}`;
}

export function useNotificationPreferences() {
  async function load(channel?: NotificationChannel) {
    const channels: NotificationChannel[] = channel
      ? [channel]
      : ["push", "in_app"];

    loading.value = true;

    try {
      for (const target of channels) {
        const { preferences: rows } = await $fetch<{
          preferences: NotificationPreference[];
        }>(preferencesApiUrl(`/${target}`), { credentials: "include" });

        preferences.value[target] = rows;
      }

      loaded.value = true;
    } catch {
      // A failed load must not hide notifications -- isAlertTypeEnabled below
      // defaults to showing everything.
    } finally {
      loading.value = false;
    }
  }

  async function set(
    channel: NotificationChannel,
    key: string,
    enabled: boolean,
  ) {
    const rows = preferences.value[channel];
    const row = rows.find((entry) => entry.key === key);
    const previous = row?.enabled;

    if (row) {
      row.enabled = enabled;
    }

    try {
      await $fetch(preferencesApiUrl(`/${channel}/${key}`), {
        method: "PUT",
        credentials: "include",
        body: { enabled },
      });
    } catch (error) {
      if (row && previous !== undefined) {
        row.enabled = previous;
      }
      throw error;
    }
  }

  // Defaults to true whenever preferences haven't loaded, or for a type the
  // backend hasn't told us about. The bell showing something a player muted is
  // recoverable; silently hiding notifications is not.
  function isAlertTypeEnabled(type: string): boolean {
    if (!loaded.value) {
      return true;
    }

    const row = preferences.value.in_app.find((entry) => entry.key === type);

    return row ? row.enabled : true;
  }

  function reset() {
    preferences.value = { push: [], in_app: [] };
    loaded.value = false;
  }

  return {
    preferences,
    loaded,
    loading,
    load,
    set,
    isAlertTypeEnabled,
    reset,
  };
}
