import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { gql } from "@apollo/client/core";
import { toast } from "~/components/ui/toast";

export type RecomputeEloStatus = {
  running: boolean;
  canceled: boolean;
  started_at: string | null;
  finished_at: string | null;
  total: number;
  completed: number;
  failed: number;
  current_match_id: string | null;
};

const START_MUTATION = gql`
  mutation RecomputePlayerElo {
    recomputePlayerElo {
      success
      running
    }
  }
`;

const CANCEL_MUTATION = gql`
  mutation CancelRecomputePlayerElo {
    cancelRecomputePlayerElo {
      success
    }
  }
`;

const STATUS_MUTATION = gql`
  mutation RecomputePlayerEloStatus {
    recomputePlayerEloStatus {
      running
      canceled
      started_at
      finished_at
      total
      completed
      failed
      current_match_id
    }
  }
`;

const starting = ref(false);
const canceling = ref(false);
const loading = ref(false);
const loaded = ref(false);
const status = ref<RecomputeEloStatus | null>(null);

const running = computed(() => !!status.value?.running);
const progress = computed(() => {
  const s = status.value;
  if (!s || s.total === 0) {
    return 0;
  }
  return Math.min(100, Math.round((s.completed / s.total) * 100));
});

const eta = computed(() => {
  const s = status.value;
  if (!s || !s.running || !s.started_at || s.completed <= 0) {
    return null;
  }
  const elapsed = Date.now() - new Date(s.started_at).getTime();
  const remaining = s.total - s.completed;
  if (elapsed <= 0 || remaining <= 0) {
    return null;
  }
  const rate = s.completed / elapsed;
  if (rate <= 0) {
    return null;
  }
  return formatDuration(remaining / rate);
});

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

type Translate = (key: string, named?: Record<string, unknown>) => string;

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let client: ReturnType<typeof useApolloClient>["client"] | null = null;
let t: Translate | null = null;

function tr(key: string, named?: Record<string, unknown>): string {
  return t ? (named ? t(key, named) : t(key)) : key;
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

async function refreshStatus(): Promise<RecomputeEloStatus | null> {
  if (!client) {
    return null;
  }
  const { data } = await client.mutate({
    mutation: STATUS_MUTATION,
    fetchPolicy: "no-cache",
  });
  const next = ((data as any)?.recomputePlayerEloStatus ??
    null) as RecomputeEloStatus | null;
  status.value = next;
  loaded.value = true;
  return next;
}

function notifyComplete(s: RecomputeEloStatus) {
  toast({
    title: s.canceled
      ? tr("pages.settings.application.players.recompute_elo_canceled_title")
      : tr("pages.settings.application.players.recompute_elo_complete_title"),
    description: tr(
      "pages.settings.application.players.recompute_elo_complete_desc",
      { completed: s.completed, total: s.total, failed: s.failed },
    ),
  });
}

function poll() {
  stopPolling();
  pollTimer = setTimeout(async () => {
    const next = await refreshStatus().catch(() => null);
    if (next?.running) {
      poll();
      return;
    }
    if (next) {
      notifyComplete(next);
    }
  }, 3000);
}

async function startRecompute() {
  if (running.value || starting.value) {
    return;
  }
  starting.value = true;
  try {
    await client?.mutate({ mutation: START_MUTATION });
    toast({
      title: tr("pages.settings.application.players.recompute_elo_queued"),
    });
    await refreshStatus();
    poll();
  } catch (error) {
    toast({
      title: (error as Error)?.message ?? "recompute failed",
      variant: "destructive",
    });
  } finally {
    starting.value = false;
  }
}

async function cancelRecompute() {
  if (!running.value || canceling.value) {
    return;
  }
  canceling.value = true;
  try {
    await client?.mutate({ mutation: CANCEL_MUTATION });
    toast({
      title: tr("pages.settings.application.players.cancel_requested"),
    });
    await refreshStatus();
  } catch (error) {
    toast({
      title: (error as Error)?.message ?? "cancel failed",
      variant: "destructive",
    });
  } finally {
    canceling.value = false;
  }
}

async function ensureLoaded() {
  if (loaded.value) {
    return;
  }
  loading.value = true;
  try {
    const next = await refreshStatus();
    if (next?.running) {
      poll();
    }
  } catch {
    status.value = status.value ?? null;
  } finally {
    loading.value = false;
  }
}

export function useRecomputeElo() {
  if (!client) {
    client = useApolloClient().client;
  }
  if (!t) {
    t = useI18n().t as unknown as Translate;
  }
  return {
    status,
    running,
    progress,
    eta,
    starting,
    canceling,
    loading,
    startRecompute,
    cancelRecompute,
    ensureLoaded,
  };
}
