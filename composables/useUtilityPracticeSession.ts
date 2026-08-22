import { computed, effectScope, ref, watch } from "vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { myUtilityPracticeSessionSubscription } from "~/graphql/utilityGraphql";
import { useAuthStore } from "~/stores/AuthStore";
import type { UtilityPracticeSession } from "~/types/utility";

/**
 * The practice server this player is holding, shared by everything that needs
 * to know about it.
 *
 * Module scope and ONE subscription: the top bar and the utility page both ask
 * the same question, and two subscriptions would mean two answers that can
 * disagree about whether a server is still up -- which matters, because both
 * offer to stop it.
 */
const session = ref<UtilityPracticeSession | null>(null);
let sub: { unsubscribe: () => void } | null = null;
let watching = false;

function unsubscribe() {
  sub?.unsubscribe();
  sub = null;
}

function subscribe(steamId?: string | null) {
  unsubscribe();
  session.value = null;

  if (!steamId) {
    return;
  }

  sub = getGraphqlClient()
    .subscribe({
      query: myUtilityPracticeSessionSubscription,
      variables: { steam_id: steamId, statuses: ["Starting", "Ready"] },
    })
    .subscribe({
      next: ({ data }: { data: any }) => {
        session.value = (data?.utility_practice_sessions ?? [])[0] ?? null;
      },
      error: (error: unknown) => {
        console.error("[utility] practice session subscription error:", error);
        session.value = null;
      },
    });
}

export function useUtilityPracticeSession() {
  // DETACHED scope. A watcher created inside a component's setup dies with
  // that component -- so whichever surface happened to call first would take
  // the subscription down with it when it unmounted, and every other surface
  // would sit on a session that never updates again.
  if (!watching) {
    watching = true;

    effectScope(true).run(() => {
      watch(
        () => useAuthStore().me?.steam_id,
        subscribe,
        { immediate: true },
      );
    });
  }

  return {
    session: computed(() => session.value),
    booting: computed(
      () => !!session.value && session.value.status !== "Ready",
    ),
    canManage: computed(() => session.value?.can_manage === true),
  };
}
