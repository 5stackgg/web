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

// A stream someone may be watching is re-checked this often, hidden tab or
// not: it is how long a player who joins the streamer's match can keep
// watching them before the api's 404 cuts the picture.
const PLAYING_REFRESH_MS = 20_000;

export function twitchApiUrl(path: string) {
  return `https://${useRuntimeConfig().public.apiDomain}/twitch${path}`;
}

export function twitchChannelUrl(login: string) {
  return `https://www.twitch.tv/${encodeURIComponent(login)}`;
}

export function twitchLinkUrl(redirect: string) {
  return `https://${useRuntimeConfig().public.webDomain}/auth/twitch?redirect=${encodeURIComponent(redirect)}`;
}

// Only a 404 means "nothing to show" -- the api's anti-ghosting answer. An
// outage keeps the last known state rather than flapping everything away.
function isNotFound(error: unknown) {
  const failure = error as {
    statusCode?: number;
    status?: number;
    response?: { status?: number };
  } | null;

  return (
    (failure?.statusCode ?? failure?.status ?? failure?.response?.status) ===
    404
  );
}

function sameIdSet(left: string[], right: string[]) {
  const known = new Set(left);
  const next = new Set(right);

  return known.size === next.size && [...next].every((id) => known.has(id));
}

// A new key drops what the old key loaded before asking, so one profile's
// stream never shows on the next.
function useVisiblePoll(options: {
  key: () => string | null;
  load: (key: string, isCurrent: () => boolean) => Promise<void>;
  everyMs: () => number;
  reset: () => void;
  keepAlive?: () => boolean;
}) {
  const visibility = useDocumentVisibility();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;
  let running = false;

  const active = () =>
    visibility.value === "visible" || !!options.keepAlive?.();

  function cancel() {
    generation++;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedule(current: string) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      void tick(current);
    }, options.everyMs());
  }

  async function tick(current: string) {
    cancel();
    const mine = generation;
    await options.load(current, () => mine === generation);
    if (mine !== generation || !active()) {
      return;
    }
    schedule(current);
  }

  watch(
    [options.key, visibility, () => !!options.keepAlive?.()] as const,
    ([current], previous) => {
      const changedKey = current !== previous?.[0];
      if (changedKey) {
        options.reset();
      }
      if (!current || !active()) {
        cancel();
        running = false;
        return;
      }
      if (changedKey || !running) {
        running = true;
        void tick(current);
        return;
      }
      if (timer) {
        schedule(current);
      }
    },
    { immediate: true },
  );

  onScopeDispose(cancel);

  return {
    refresh() {
      const current = options.key();
      if (current && active()) {
        return tick(current);
      }
      return Promise.resolve();
    },
  };
}

export function useTwitchPlayer(
  steamId: MaybeRefOrGetter<string | null | undefined>,
  { playing }: { playing?: MaybeRefOrGetter<boolean> } = {},
) {
  const settings = useApplicationSettingsStore();
  const stream = shallowRef<TwitchPlayer | null>(null);

  useVisiblePoll({
    key: () => (settings.supportsTwitch && toValue(steamId)) || null,
    keepAlive: () => !!toValue(playing),
    everyMs: () =>
      toValue(playing) ? PLAYING_REFRESH_MS : STATUS_REFRESH_MS,
    async load(id, isCurrent) {
      try {
        const player = await $fetch<TwitchPlayer>(
          twitchApiUrl(`/players/${encodeURIComponent(id)}`),
          { credentials: "include" },
        );
        if (isCurrent()) {
          stream.value = player?.login ? player : null;
        }
      } catch (error) {
        if (isCurrent() && isNotFound(error)) {
          stream.value = null;
        }
      }
    },
    reset() {
      stream.value = null;
    },
  });

  return { stream };
}

export function useTwitchLiveSteamIds() {
  const settings = useApplicationSettingsStore();
  const steamIds = shallowRef<string[]>([]);
  const loaded = ref(false);

  useVisiblePoll({
    key: () => (settings.supportsTwitch ? "live" : null),
    everyMs: () => STATUS_REFRESH_MS,
    async load(_, isCurrent) {
      try {
        const live = await $fetch<{ steam_ids: string[] }>(
          twitchApiUrl("/live"),
          { credentials: "include" },
        );
        if (!isCurrent()) {
          return;
        }
        const next = (live?.steam_ids ?? []).map(String);
        if (!sameIdSet(steamIds.value, next)) {
          steamIds.value = next;
        }
        loaded.value = true;
      } catch {
        if (isCurrent()) {
          loaded.value = true;
        }
      }
    },
    reset() {
      steamIds.value = [];
      loaded.value = false;
    },
  });

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

  // Any listed POV may be the one playing, and a Twitch embed plays on in a
  // hidden tab.
  const listed = () => streams.value.length > 0;

  useVisiblePoll({
    key: () => {
      const current = toValue(match);
      return settings.supportsTwitch &&
        current?.id &&
        current.status === e_match_status_enum.Live &&
        !current.is_in_lineup &&
        !current.is_coach
        ? current.id
        : null;
    },
    keepAlive: listed,
    everyMs: () => (listed() ? PLAYING_REFRESH_MS : MATCH_POV_REFRESH_MS),
    async load(id, isCurrent) {
      try {
        const result = await $fetch<{ streams: TwitchMatchStream[] }>(
          twitchApiUrl(`/matches/${encodeURIComponent(id)}/streams`),
          { credentials: "include" },
        );
        if (isCurrent()) {
          streams.value = result?.streams ?? [];
        }
      } catch (error) {
        if (isCurrent() && isNotFound(error)) {
          streams.value = [];
        }
      }
    },
    reset() {
      streams.value = [];
    },
  });

  return { streams };
}

// The floating player outlives the match page that polled its POV, so the
// POV is re-checked here and let go once the api stops returning it.
export function useTwitchPovGuard(
  stream: MaybeRefOrGetter<
    | {
        is_pov?: boolean;
        match_id?: string | null;
        steam_id?: string | null;
      }
    | null
    | undefined
  >,
  onGone: () => void,
) {
  useVisiblePoll({
    key: () => {
      const current = toValue(stream);
      return current?.is_pov && current.match_id && current.steam_id
        ? `${current.match_id}/${current.steam_id}`
        : null;
    },
    keepAlive: () => true,
    everyMs: () => PLAYING_REFRESH_MS,
    async load(key, isCurrent) {
      const [matchId, steamId] = key.split("/");
      try {
        const result = await $fetch<{ streams: TwitchMatchStream[] }>(
          twitchApiUrl(`/matches/${encodeURIComponent(matchId)}/streams`),
          { credentials: "include" },
        );
        const returned = (result?.streams ?? []).some(
          (pov) => String(pov.steam_id) === steamId,
        );
        if (isCurrent() && !returned) {
          onGone();
        }
      } catch (error) {
        if (isCurrent() && isNotFound(error)) {
          onGone();
        }
      }
    },
    reset() {},
  });
}

export function useTwitchAccount() {
  const settings = useApplicationSettingsStore();
  const auth = useAuthStore();
  const account = shallowRef<TwitchAccount | null>(null);
  const enabled = ref(false);
  const state = ref<"loading" | "ready" | "failed">("loading");

  const poll = useVisiblePoll({
    key: () => (settings.supportsTwitch && auth.me?.steam_id) || null,
    everyMs: () => STATUS_REFRESH_MS,
    async load(_, isCurrent) {
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
    reset() {
      account.value = null;
      enabled.value = false;
      state.value = "loading";
    },
  });

  async function unlink() {
    await $fetch(twitchApiUrl("/me"), {
      method: "DELETE",
      credentials: "include",
    });
    account.value = null;
    void poll.refresh();
  }

  return { account, enabled, state, unlink };
}
