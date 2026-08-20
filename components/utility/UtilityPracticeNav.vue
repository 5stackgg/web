<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Rocket } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { myUtilityPracticeSessionQuery } from "~/graphql/utilityGraphql";
import { useAuthStore } from "~/stores/AuthStore";
import type { UtilityPracticeSession } from "~/types/utility";

const session = ref<UtilityPracticeSession | null>(null);

const me = computed(() => useAuthStore().me);
// A reservation the player is still holding, on whatever page they wander to.
// Without this the only trace of a booked server is the modal that booked it.
async function refresh() {
  const steamId = me.value?.steam_id;

  if (!steamId) {
    session.value = null;
    return;
  }

  try {
    const { data } = await getGraphqlClient().query({
      query: myUtilityPracticeSessionQuery,
      variables: { steam_id: steamId, statuses: ["Starting", "Ready"] },
      fetchPolicy: "network-only",
    });
    session.value = ((data as any)?.utility_practice_sessions ?? [])[0] ?? null;
  } catch (error) {
    console.error("[utility] practice nav lookup failed:", error);
    session.value = null;
  }
}

onMounted(refresh);
watch(() => me.value?.steam_id, refresh);

const label = computed(() =>
  session.value?.status === "Ready" ? "ready" : "booting",
);
</script>

<template>
  <NuxtLink
    v-if="session"
    :to="`/utility/${session.map_name}`"
    class="relative inline-flex h-7 items-center gap-1.5 rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] px-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.15)]"
    :aria-label="$t('pages.utility.practice.nav_label')"
  >
    <span
      v-if="label === 'booting'"
      class="relative flex h-1.5 w-1.5"
      aria-hidden="true"
    >
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
