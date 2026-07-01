import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { gql } from "@apollo/client/core";
import { toast } from "~/components/ui/toast";

export type SeasonBackfillStatus = {
  running: boolean;
  canceled: boolean;
  started_at: string | null;
  finished_at: string | null;
  season_id: string | null;
  total: number;
  completed: number;
  failed: number;
  current_match_id: string | null;
};

const START_MUTATION = gql`
  mutation BackfillSeasonElo($season_id: String!) {
    backfillSeasonElo(season_id: $season_id) {
      success
      running
    }
  }
`;

const CANCEL_MUTATION = gql`
  mutation CancelBackfillSeasonElo {
    cancelBackfillSeasonElo {
      success
    }
  }
`;

const STATUS_MUTATION = gql`
  mutation BackfillSeasonEloStatus {
    backfillSeasonEloStatus {
      running
      canceled
      started_at
      finished_at
      season_id
      total
      completed
      failed
      current_match_id
    }
  }
`;

const starting = ref(false);
const canceling = ref(false);
const loaded = ref(false);
const status = ref<SeasonBackfillStatus | null>(null);

const running = computed(() => !!status.value?.running);
const progress = computed(() => {
  const s = status.value;
  if (!s || s.total === 0) {
    return 0;
  }
  return Math.min(100, Math.round((s.completed / s.total) * 100));
});

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

async function refreshStatus(): Promise<SeasonBackfillStatus | null> {
  if (!client) {
    return null;
  }
  const { data } = await client.mutate({
    mutation: STATUS_MUTATION,
    fetchPolicy: "no-cache",
  });
  const next = ((data as any)?.backfillSeasonEloStatus ??
    null) as SeasonBackfillStatus | null;
  status.value = next;
  loaded.value = true;
  return next;
}

function notifyComplete(s: SeasonBackfillStatus) {
  toast({
    title: s.canceled
      ? tr("pages.seasons.backfill_canceled_title")
      : tr("pages.seasons.backfill_complete_title"),
    description: tr("pages.seasons.backfill_complete_desc", {
      completed: s.completed,
      total: s.total,
      failed: s.failed,
    }),
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

async function startBackfill(seasonId: string) {
  if (running.value || starting.value) {
    return;
  }
  starting.value = true;
  try {
    await client?.mutate({
      mutation: START_MUTATION,
      variables: { season_id: seasonId },
    });
    toast({ title: tr("pages.seasons.backfill_queued") });
    await refreshStatus();
    poll();
  } catch (error) {
    toast({
      title: (error as Error)?.message ?? "backfill failed",
      variant: "destructive",
    });
  } finally {
    starting.value = false;
  }
}

async function cancelBackfill() {
  if (!running.value || canceling.value) {
    return;
  }
  canceling.value = true;
  try {
    await client?.mutate({ mutation: CANCEL_MUTATION });
    toast({ title: tr("pages.seasons.backfill_cancel_requested") });
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
    if (running.value) {
      poll();
    }
    return;
  }
  try {
    const next = await refreshStatus();
    if (next?.running) {
      poll();
    }
  } catch {
    status.value = status.value ?? null;
  }
}

export function useSeasonBackfill() {
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
    starting,
    canceling,
    startBackfill,
    cancelBackfill,
    ensureLoaded,
    refreshStatus,
    poll,
  };
}
