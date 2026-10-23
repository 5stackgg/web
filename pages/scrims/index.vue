<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ChevronDown, Check, Lock } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import DeferredLoading from "~/components/common/DeferredLoading.vue";
import ScrimBoard from "~/components/scrims/ScrimBoard.vue";
import ScrimRequests from "~/components/scrims/ScrimRequests.vue";
import ScrimListing from "~/components/scrims/ScrimListing.vue";
import ScrimNowButton from "~/components/scrims/ScrimNowButton.vue";
import ScrimTeamSheet from "~/components/scrims/ScrimTeamSheet.vue";
import {
  awaitingTeam,
  scrimOpponent,
  useMyScrimTeams,
  useScrimClock,
  useScrimMaps,
  useScrimPostings,
  useScrimTeamRequests,
} from "~/composables/useScrimFinder";
import teamAvatarSrc from "~/utilities/teamAvatar";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import { signInWithSteam } from "~/utilities/loginLinks";
import { useAuthStore } from "~/stores/AuthStore";
import { dayLabel, timeLabel } from "~/utilities/scrimFormat";
import {
  filterTriggerBase,
  filterTriggerIdle,
} from "~/utilities/tacticalClasses";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const now = useScrimClock();
const { postings, loaded } = useScrimPostings();
const { mapsById } = useScrimMaps();
const { teams, memberTeamIds, activeTeam, setActiveTeam } = useMyScrimTeams();
const { requests, booked } = useScrimTeamRequests(() => activeTeam.value?.id);

const enabled = computed(() => useApplicationSettingsStore().scrimFinderEnabled);

// The finder is for finding opponents; teams you're on are managed from the
// Your listing tab instead.
const others = computed(() =>
  postings.value.filter((posting) => !memberTeamIds.value.includes(posting.team_id)),
);

const TABS = ["board", "requests", "listing"] as const;
type Tab = (typeof TABS)[number];
const tab = computed<Tab>(() => {
  const value = String(route.query.tab ?? "");
  return activeTeam.value && (TABS as readonly string[]).includes(value)
    ? (value as Tab)
    : "board";
});
function setTab(value: Tab) {
  const query = { ...route.query };
  if (value === "board") delete query.tab;
  else query.tab = value;
  void router.replace({ query });
}

// Sections stay mounted after their first visit, so switching back is
// instant instead of refetching and re-skeletoning.
const visited = ref<Tab[]>([]);
watch(
  tab,
  (value) => {
    if (!visited.value.includes(value)) visited.value.push(value);
  },
  { immediate: true },
);

// A section's first frame can take longer than a CSS fade (the listing lays
// out its whole week), which would eat the fade. The section stays hidden
// through that frame and fades in on the next one.
const panels = ref<HTMLElement | null>(null);
watch(tab, async () => {
  await nextTick();
  const panel = panels.value?.querySelector<HTMLElement>(
    '[role="tabpanel"][data-state="active"]',
  );
  if (!panel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  panel.style.opacity = "0";
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      panel.style.opacity = "";
      panel.animate(
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    }),
  );
});

const needsYou = computed(
  () => requests.value.filter((request) => activeTeam.value && awaitingTeam(request, activeTeam.value.id)).length,
);
const bookedWith = computed(() =>
  booked.value && activeTeam.value ? scrimOpponent(booked.value, activeTeam.value.id) : null,
);

const sheetOpen = ref(false);
const sheetPosting = ref<any>(null);
const sheetAt = ref<number | null>(null);
function openPosting(posting: any, at: number | null = null) {
  sheetPosting.value = posting;
  sheetAt.value = at;
  sheetOpen.value = true;
}
function openOpponent(opponent: any) {
  const posting = postings.value.find((item) => item.team_id === opponent?.id);
  if (posting) {
    openPosting(posting);
  } else if (opponent?.id) {
    void router.push(`/teams/${opponent.id}`);
  }
}
const teamSwitchOpen = ref(false);
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.scrims.title") }}</h1>

  <PageTransition v-if="!enabled">
    <SectionEmpty
      :title="$t('pages.scrims.title')"
      :description="$t('pages.scrims.disabled_message')"
    />
  </PageTransition>

  <Tabs
    v-else
    :model-value="tab"
    :unmount-on-hide="false"
    class="space-y-4"
    @update:model-value="(value) => setTab(value as Tab)"
  >
    <PageTransition v-if="activeTeam" class="block">
      <div class="flex flex-col-reverse gap-x-4 gap-y-2 border-b border-border sm:flex-row sm:items-end">
        <TabsList
          variant="underline"
          class="flex-1 justify-start gap-5 overflow-x-auto"
          :aria-label="$t('pages.scrims.title')"
        >
          <TabsTrigger
            v-for="item in TABS"
            :key="item"
            :value="item"
            class="gap-2 py-2.5"
          >
            {{ $t(`scrims.tabs.${item}`) }}
            <span
              v-if="item === 'requests' && needsYou"
              class="inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[hsl(var(--tac-amber))] px-1 text-[0.7rem] font-bold text-[hsl(var(--tac-amber-foreground))]"
            >
              {{ needsYou }}
            </span>
            <span
              v-if="item === 'listing' && !activeTeam.scrim_settings?.enabled"
              class="text-xs font-normal text-muted-foreground"
            >
              {{ $t("scrims.listing.closed") }}
            </span>
          </TabsTrigger>
        </TabsList>
        <div class="flex items-center gap-2 pb-2 sm:pb-1.5">
          <Popover v-if="teams.length > 1" v-model:open="teamSwitchOpen">
            <PopoverTrigger as-child>
              <button type="button" :class="[filterTriggerBase, filterTriggerIdle]" :aria-label="$t('scrims.team_switch')">
                <Avatar shape="square" class="h-5 w-5 rounded">
                  <AvatarImage v-if="teamAvatarSrc(activeTeam)" :src="teamAvatarSrc(activeTeam)!" :alt="activeTeam.name" />
                  <AvatarFallback class="rounded text-[0.5rem] font-semibold uppercase">
                    {{ activeTeam.name.slice(0, 2) }}
                  </AvatarFallback>
                </Avatar>
                <span class="max-w-[10rem] truncate">{{ activeTeam.name }}</span>
                <ChevronDown class="h-3 w-3 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" class="w-60 p-1.5">
              <p class="px-2 pb-1.5 pt-1 text-xs text-muted-foreground">{{ $t("scrims.team_switch") }}</p>
              <button
                v-for="item in teams"
                :key="item.id"
                type="button"
                class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
                @click="setActiveTeam(item.id); teamSwitchOpen = false"
              >
                <span class="flex-1 truncate">{{ item.name }}</span>
                <Check v-if="item.id === activeTeam.id" class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]" />
              </button>
            </PopoverContent>
          </Popover>
          <ScrimNowButton :team="activeTeam" :now="now" :booked="!!booked" />
        </div>
      </div>
    </PageTransition>

    <PageTransition
      v-if="booked && bookedWith && tab !== 'requests'"
      :step="1"
    >
      <div
        class="flex flex-wrap items-center gap-3 rounded-lg border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] px-4 py-3 text-sm"
      >
        <Lock class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]" />
        <span class="min-w-[14rem] flex-1 [text-wrap:pretty]">
          <b class="font-semibold">
            {{
              $t("scrims.booked.banner", {
                team: activeTeam.name,
                opponent: bookedWith.name,
                when: $t("scrims.when", {
                  day: dayLabel(new Date(booked.proposed_scheduled_at).getTime(), now, { inline: true }),
                  time: timeLabel(new Date(booked.proposed_scheduled_at).getTime()),
                }),
              })
            }}
          </b>
          {{ $t("scrims.booked.lock") }}
        </span>
        <Button as-child size="sm" variant="outline">
          <NuxtLink :to="`/matches/${booked.match_id}`">{{ $t("scrims.requests.view_match") }}</NuxtLink>
        </Button>
      </div>
    </PageTransition>

    <PageTransition :step="1" class="block">
      <div ref="panels">
        <TabsContent value="requests" class="mt-0">
          <ScrimRequests
            v-if="activeTeam && visited.includes('requests')"
            :team="activeTeam"
            @open="openOpponent"
          />
        </TabsContent>
        <TabsContent value="listing" class="mt-0">
          <ScrimListing
            v-if="activeTeam && visited.includes('listing')"
            :team="activeTeam"
            preview
          />
        </TabsContent>
        <TabsContent value="board" class="mt-0 space-y-4">
          <div
            v-if="!activeTeam"
            class="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/40 px-4 py-3 text-sm"
          >
            <span class="min-w-[14rem] flex-1 text-muted-foreground">
              {{ auth.me ? $t("scrims.cta.player") : $t("scrims.cta.guest") }}
            </span>
            <Button v-if="auth.me" as-child size="sm" variant="outline">
              <NuxtLink to="/teams/create">{{ $t("scrims.cta.create_team") }}</NuxtLink>
            </Button>
            <Button v-else size="sm" class="tac-amber-cta gap-1.5" @click="signInWithSteam">
              <SteamIcon class="h-3.5 w-3.5" />
              {{ $t("scrims.cta.sign_in") }}
            </Button>
          </div>
          <DeferredLoading :loading="!loaded" v-slot="{ skeleton }">
            <FadeSwap>
              <div v-if="skeleton" key="loading" class="space-y-4" aria-busy="true">
                <Skeleton class="h-8 w-full rounded-md" />
                <Skeleton class="h-4 w-24 rounded-sm" />
                <Skeleton v-for="i in 4" :key="i" class="h-[3.75rem] w-full rounded-lg" />
              </div>
              <ScrimBoard
                v-else
                key="board"
                :postings="others"
                :my-team="activeTeam"
                :requests="requests"
                :maps-by-id="mapsById"
                :now="now"
                @open="openPosting"
                @edit-listing="setTab('listing')"
              />
            </FadeSwap>
          </DeferredLoading>
        </TabsContent>
      </div>
    </PageTransition>

    <ScrimTeamSheet
      v-model:open="sheetOpen"
      :posting="sheetPosting"
      :at="sheetAt"
      @edit-listing="setTab('listing')"
    />
  </Tabs>
</template>
