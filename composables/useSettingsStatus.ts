import { computed, onMounted, toValue, type MaybeRefOrGetter } from "vue";
import type { SettingsJob } from "~/composables/useSettingsNav";
import { useRecomputeElo } from "~/composables/useRecomputeElo";
import { useReindexPlayers } from "~/composables/useReindexPlayers";
import { useReparseAllDemos } from "~/composables/useReparseAllDemos";

export type SettingsStatusChip =
  { tone: "job"; job: SettingsJob; pct: number } | { tone: "attention" };

export type SettingsItemStatus = {
  chip: SettingsStatusChip | null;
  attention: boolean;
};

export type SettingsStatusItem = {
  path: string;
  requires?: string;
  jobs?: SettingsJob[];
};

export type SettingsStatusContext = {
  settings: Array<{ name: string; value: string | null }> | null | undefined;
  /** Until the settings arrive the setup check is a guess, so none is shown. */
  loaded: boolean;
  /** A running job's percent; absent or null when it isn't running. */
  jobs: Partial<Record<SettingsJob, number | null>>;
};

/**
 * What the settings rail says about one section. The chip only speaks up when
 * there is something to know: a running job, then missing setup. The attention
 * flag feeds the rail's Attention filter on its own, so a section with a
 * running job still counts as needing a look.
 */
export function settingsItemStatus(
  item: SettingsStatusItem,
  context: SettingsStatusContext,
): SettingsItemStatus {
  const value = (name: string) =>
    context.settings?.find((setting) => setting.name === name)?.value;

  const attention =
    context.loaded && !!item.requires && value(item.requires) !== "true";
  const job = item.jobs?.find((key) => typeof context.jobs[key] === "number");

  let chip: SettingsStatusChip | null = null;
  if (job) {
    chip = { tone: "job", job, pct: context.jobs[job] as number };
  } else if (attention) {
    chip = { tone: "attention" };
  }

  return { chip, attention };
}

/** Live status for every settings section, keyed by its path. */
export function useSettingsStatus(
  items: MaybeRefOrGetter<SettingsStatusItem[]>,
) {
  const store = useApplicationSettingsStore();
  const elo = useRecomputeElo();
  const reindex = useReindexPlayers();
  const reparse = useReparseAllDemos();

  onMounted(() => {
    void elo.ensureLoaded();
    void reindex.ensureLoaded();
    void reparse.ensureLoaded();
  });

  const jobs = computed<Partial<Record<SettingsJob, number | null>>>(() => ({
    elo: elo.running.value ? elo.progress.value : null,
    reindex: reindex.running.value ? reindex.progress.value : null,
    reparse: reparse.running.value ? reparse.progress.value : null,
  }));

  return computed<Record<string, SettingsItemStatus>>(() =>
    Object.fromEntries(
      toValue(items).map((item) => [
        item.path,
        settingsItemStatus(item, {
          settings: store.settings,
          loaded: store.settingsLoaded,
          jobs: jobs.value,
        }),
      ]),
    ),
  );
}
