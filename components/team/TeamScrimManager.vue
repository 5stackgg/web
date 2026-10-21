<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { ArrowRight } from "lucide-vue-next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import ScrimRequests from "~/components/scrims/ScrimRequests.vue";
import ScrimListing from "~/components/scrims/ScrimListing.vue";
import { awaitingTeam, useScrimTeamRequests } from "~/composables/useScrimFinder";
import { $ } from "~/generated/zeus";
import { generateSubscription } from "~/graphql/graphqlGen";
import { scrimMyTeamFields } from "~/graphql/scrimFields";

const props = defineProps<{ teamId: string; initialTab?: string }>();

const { client } = useApolloClient();
const team = ref<any | null>(null);
const teamQuery = generateSubscription({
  teams_by_pk: [{ id: $("teamId", "uuid!") }, scrimMyTeamFields],
} as any);
let sub: { unsubscribe: () => void } | null = null;
watch(
  () => props.teamId,
  (teamId) => {
    sub?.unsubscribe();
    if (!teamId || typeof window === "undefined") return;
    sub = client.subscribe({ query: teamQuery, variables: { teamId } }).subscribe({
      next: ({ data }: any) => {
        team.value = data?.teams_by_pk ?? null;
      },
    });
  },
  { immediate: true },
);
onBeforeUnmount(() => sub?.unsubscribe());

const { requests } = useScrimTeamRequests(() => props.teamId);
const pendingCount = computed(
  () => requests.value.filter((request) => awaitingTeam(request, props.teamId)).length,
);

const tab = ref(props.initialTab === "listing" ? "listing" : "requests");
watch(tab, (value) => {
  // History, not a router navigation, so the sub-tab is shareable without
  // re-rendering the page.
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (value === "requests") url.searchParams.delete("scrimTab");
  else url.searchParams.set("scrimTab", value);
  window.history.replaceState(window.history.state, "", url.toString());
});
</script>

<template>
  <section class="relative">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted-foreground">{{ $t("scrims.team_tab.description") }}</p>
      <NuxtLink
        to="/scrims"
        class="inline-flex items-center gap-1 text-sm text-[hsl(var(--tac-amber))] hover:underline"
      >
        {{ $t("scrims.team_tab.find") }}
        <ArrowRight class="h-3.5 w-3.5" />
      </NuxtLink>
    </div>

    <Tabs v-model="tab" class="relative mt-4">
      <TabsList variant="underline" class="w-full justify-start overflow-x-auto border-b border-border pb-px">
        <TabsTrigger value="requests" class="gap-2">
          {{ $t("scrims.tabs.requests") }}
          <span
            v-if="pendingCount > 0"
            class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--tac-amber))] px-1 text-[0.65rem] font-bold text-[hsl(var(--tac-amber-foreground))]"
          >
            {{ pendingCount }}
          </span>
        </TabsTrigger>
        <TabsTrigger value="listing">{{ $t("scrims.tabs.listing") }}</TabsTrigger>
      </TabsList>

      <TabsContent value="requests" class="mt-5 focus-visible:outline-none">
        <ScrimRequests v-if="team" :team="team" @open="(opponent) => $router.push(`/teams/${opponent.id}`)" />
      </TabsContent>
      <TabsContent value="listing" class="mt-5 focus-visible:outline-none">
        <ScrimListing v-if="team" :team="team" />
      </TabsContent>
    </Tabs>
  </section>
</template>
