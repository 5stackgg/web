import {
  onScopeDispose,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { useDocumentVisibility } from "@vueuse/core";
import { e_match_status_enum } from "~/generated/zeus";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";

export type TwitchStream = {
  login: string;
  display_name: string | null;
  is_live: boolean;
  title: string | null;
  game_name: string | null;
  viewer_count: number | null;
  started_at: string | null;
  thumbnail_url: string | null;
};

export type TwitchPlayer = TwitchStream & { steam_id: string };

export type TwitchAccount = TwitchStream & {
  twitch_user_id: string;
  checked_at: string | null;
  linked_at: string;
};

export type TwitchMe = { enabled: boolean; account: TwitchAccount | null };

export type TwitchMatchStream = {
  steam_id: string;
  name: string;
  avatar_url: string | null;
  match_lineup_id: string;
  login: string;
  display_name: string | null;
  title: string | null;
  viewer_count: number | null;
  started_at: string | null;
  thumbnail_url: string | null;
};

export const TWITCH_LINK_ERRORS = [
  "not_configured",
  "invalid_state",
  "denied",
  "already_linked",
  "twitch_unavailable",
] as const;

// The api re-checks every linked channel once a minute and leaves checked_at
// alone when Twitch fails to answer, so a status this old was not confirmed by
// the last few checks.
export const TWITCH_STATUS_STALE_MS = 3 * 60 * 1000;

const STATUS_REFRESH_MS = 60_000;
const MATCH_POV_REFRESH_MS = 45_000;

export function twitchApiUrl(path: string) {
  return `https://${useRuntimeConfig().public.apiDomain}/twitch${path}`;
}

export function twitchChannelUrl(login: string) {
  return `https://www.twitch.tv/${encodeURIComponent(login)}`;
}

export function twitchLinkUrl(redirect: string) {
  return `https://${useRuntimeConfig().public.webDomain}/auth/twitch?redirect=${encodeURIComponent(redirect)}`;
}

function sameIds(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((steamId, index) => steamId === right[index])
  );
}

// A new key drops what the old key loaded before asking, so one profile's
// stream never shows on the next.
function useVisiblePoll(
  key: () => string | null,
  load: (key: string, isCurrent: () => boolean) => Promise<void>,
  everyMs: number,
  reset: () => void,
) {
  const visibility = useDocumentVisibility();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;

  function cancel() {
    generation++;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function tick(current: string) {
    cancel();
    const mine = generation;
    await load(current, () => mine === generation);
    if (mine !== generation || visibility.value !== "visible") {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      void tick(current);
    }, everyMs);
  }

  watch(
    [key, visibility] as const,
    ([current, visible], previous) => {
      if (current !== previous?.[0]) {
        reset();
      }
      if (!current || visible !== "visible") {
        cancel();
        return;
      }
      void tick(current);
    },
    { immediate: true },
  );

  onScopeDispose(cancel);

  return {
    refresh() {
      const current = key();
      if (current && visibility.value === "visible") {
        return tick(current);
      }
      return Promise.resolve();
    },
  };
}

export function useTwitchPlayer(
  steamId: MaybeRefOrGetter<string | null | undefined>,
) {
  const settings = useApplicationSettingsStore();
  const stream = shallowRef<TwitchPlayer | null>(null);

  useVisiblePoll(
    () => (settings.supportsTwitch && toValue(steamId)) || null,
    async (id, isCurrent) => {
      try {
        const player = await $fetch<TwitchPlayer>(
          twitchApiUrl(`/players/${encodeURIComponent(id)}`),
          { credentials: "include" },
        );
        if (isCurrent()) {
          stream.value = player?.login ? player : null;
        }
      } catch {
        if (isCurrent()) {
          stream.value = null;
        }
      }
    },
    STATUS_REFRESH_MS,
    () => {
      stream.value = null;
    },
  );

  return { stream };
}

export function useTwitchLiveSteamIds() {
  const settings = useApplicationSettingsStore();
  const steamIds = shallowRef<string[]>([]);
  const loaded = ref(false);

  useVisiblePoll(
    () => (settings.supportsTwitch ? "live" : null),
    async (_, isCurrent) => {
      try {
        const live = await $fetch<{ steam_ids: string[] }>(
          twitchApiUrl("/live"),
          { credentials: "include" },
        );
        if (!isCurrent()) {
          return;
        }
        const next = (live?.steam_ids ?? []).map(String);
        if (!sameIds(steamIds.value, next)) {
          steamIds.value = next;
        }
        loaded.value = true;
      } catch {
        if (isCurrent()) {
          loaded.value = true;
        }
      }
    },
    STATUS_REFRESH_MS,
    () => {
      steamIds.value = [];
      loaded.value = false;
    },
  );

  return { steamIds, loaded };
}

export function useMatchTwitchPovs(
  match: MaybeRefOrGetter<
    | {
        id?: string | null;
        status?: string | null;
        is_in_lineup?: boolean | null;
        is_coach?: boolean | null;
      }
    | null
    | undefined
  >,
) {
  const settings = useApplicationSettingsStore();
  const streams = shallowRef<TwitchMatchStream[]>([]);

  useVisiblePoll(
    () => {
      const current = toValue(match);
      return settings.supportsTwitch &&
        current?.id &&
        current.status === e_match_status_enum.Live &&
        !current.is_in_lineup &&
        !current.is_coach
        ? current.id
        : null;
    },
    async (id, isCurrent) => {
      try {
        const result = await $fetch<{ streams: TwitchMatchStream[] }>(
          twitchApiUrl(`/matches/${encodeURIComponent(id)}/streams`),
          { credentials: "include" },
        );
        if (isCurrent()) {
          streams.value = result?.streams ?? [];
        }
      } catch {
        if (isCurrent()) {
          streams.value = [];
        }
      }
    },
    MATCH_POV_REFRESH_MS,
    () => {
      streams.value = [];
    },
  );

  return { streams };
}

export function useTwitchAccount() {
  const settings = useApplicationSettingsStore();
  const auth = useAuthStore();
  const account = shallowRef<TwitchAccount | null>(null);
  const enabled = ref(false);
  const state = ref<"loading" | "ready" | "failed">("loading");

  const poll = useVisiblePoll(
    () => (settings.supportsTwitch && auth.me?.steam_id) || null,
    async (_, isCurrent) => {
      try {
        const me = await $fetch<TwitchMe>(twitchApiUrl("/me"), {
          credentials: "include",
        });
        if (!isCurrent()) {
          return;
        }
        enabled.value = !!me?.enabled;
        account.value = me?.account ?? null;
        state.value = "ready";
      } catch {
        if (isCurrent() && state.value === "loading") {
          state.value = "failed";
        }
      }
    },
    STATUS_REFRESH_MS,
    () => {
      account.value = null;
      enabled.value = false;
      state.value = "loading";
    },
  );

  async function unlink() {
    await $fetch(twitchApiUrl("/me"), {
      method: "DELETE",
      credentials: "include",
    });
    account.value = null;
    void poll.refresh();
  }

  return { account, enabled, state, refresh: poll.refresh, unlink };
}
