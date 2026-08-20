<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Rocket } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { myUtilityPracticeSessionSubscription } from "~/graphql/utilityGraphql";
import { useAuthStore } from "~/stores/AuthStore";
import type { UtilityPracticeSession } from "~/types/utility";

const session = ref<UtilityPracticeSession | null>(null);
let sub: { unsubscribe: () => void } | null = null;

const me = computed(() => useAuthStore().me);

function unsubscribe() {
  sub?.unsubscribe();
  sub = null;
}

// A reservation the player is still holding, on whatever page they wander to.
// Subscribed rather than fetched: booking one happens in a dialog this has no
// way of hearing about, and the chip has to appear anyway.
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
        console.error("[utility] practice nav subscription error:", error);
        session.value = null;
      },
    });
}

watch(() => me.value?.steam_id, subscribe, { immediate: true });
onBeforeUnmount(unsubscribe);

const booting = computed(() => session.value?.status !== "Ready");
</script>

<template>
  <NuxtLink
    v-if="session"
    :to="`/utility/${session.map_name}`"
    class="relative inline-flex h-7 items-center gap-1.5 rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] px-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.15)]"
    :aria-label="$t('pages.utility.practice.nav_label')"
  >
    <span v-if="booting" class="relative flex h-1.5 w-1.5" aria-hidden="true">
      <span
        class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
      ></span>
      <span
        class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
      ></span>
    </span>
    <Rocket class="h-3.5 w-3.5" />
    <span class="hidden sm:inline">
      {{ $t("pages.utility.practice.nav_label") }}
    </span>
    <span class="hidden md:inline opacity-70">{{ session.map_name }}</span>
  </NuxtLink>
</template>
