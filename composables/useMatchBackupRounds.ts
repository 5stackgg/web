import { computed, onUnmounted, ref, watch, type Ref } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { matchBackupRoundsSubscription } from "~/graphql/matchBackupRoundsGraphql";

type BackupRound = { round: number; has_backup_file: boolean };

// Single shared websocket per match_map_id. MatchTabs and MatchAdminBottomBar
// both need restorable rounds for the same current map; ref-counting here keeps
// it to one v_match_map_backup_rounds subscription instead of two identical ones.
const entries = new Map<
  string,
  { refs: number; rounds: Ref<BackupRound[]>; sub: { unsubscribe: () => void } }
>();

function acquire(id: string) {
  let entry = entries.get(id);
  if (!entry) {
    const rounds = ref<BackupRound[]>([]);
    // provideApolloClient runs globally in plugins/apollo.client.ts, so this
    // resolves outside component setup (MatchTabs uses the imperative form).
    const sub = useApolloClient()
      .client.subscribe({
        query: matchBackupRoundsSubscription,
        variables: { matchMapId: id },
      })
      .subscribe({
        next: ({ data }: any) => {
          rounds.value = data?.v_match_map_backup_rounds ?? [];
        },
      });
    entry = { refs: 0, rounds, sub };
    entries.set(id, entry);
  }
  entry.refs += 1;
  return entry;
}

function release(id: string) {
  const entry = entries.get(id);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    entry.sub.unsubscribe();
    entries.delete(id);
  }
}

// Imperative form for Options API consumers (MatchTabs). Returns a reactive
// rounds ref that tracks the given map id, plus a stop() for teardown.
export function trackMatchBackupRounds(getId: () => string | undefined) {
  const rounds = ref<BackupRound[]>([]);
  let activeId: string | null = null;
  let mirror: (() => void) | null = null;

  const stopWatch = watch(
    getId,
    (id) => {
      if (activeId) {
        mirror?.();
        mirror = null;
        release(activeId);
        activeId = null;
      }
      if (!id) {
        rounds.value = [];
        return;
      }
      const entry = acquire(id);
      activeId = id;
      rounds.value = entry.rounds.value;
      mirror = watch(entry.rounds, (v) => (rounds.value = v));
    },
    { immediate: true },
  );

  function stop() {
    stopWatch();
    mirror?.();
    if (activeId) {
      release(activeId);
      activeId = null;
    }
  }

  return { rounds, stop };
}

export function useMatchBackupRounds(matchMapId: Ref<string | undefined>) {
  const { rounds, stop } = trackMatchBackupRounds(() => matchMapId.value);
  onUnmounted(stop);
  return { backupRounds: computed(() => rounds.value) };
}
