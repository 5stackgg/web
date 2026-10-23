<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { FlaskConical, RotateCcw } from "lucide-vue-next";
import DraftRoom from "~/components/draft-games/DraftRoom.vue";
import LineupOverview from "~/components/match/LineupOverview.vue";
import MatchHeader from "~/components/match/MatchHeader.vue";
import MatchHeaderVeto from "~/components/match/MatchHeaderVeto.vue";
import MatchInfo from "~/components/match/MatchInfo.vue";
import QuickMatchConnect from "~/components/match/QuickMatchConnect.vue";
import MatchMapSlots from "~/components/match/MatchMapSlots.vue";
import MatchMapVeto from "~/components/match/MatchMapVeto.vue";
import MatchRegionVeto from "~/components/match/MatchRegionVeto.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { PageTransition } from "~/components/ui/transitions";
import { useAuthStore } from "~/stores/AuthStore";
import { useVetoHandoff, vetoHandoffPhase } from "~/composables/useVetoHandoff";
import {
  handOffScorebug,
  useScorebugHandoff,
} from "~/composables/useScorebugHandoff";
import { e_match_status_enum } from "~/generated/zeus";
import { DRAFT_VETO_HOLD_MS, vetoBoardUp } from "~/utilities/vetoStage";
import {
  DEMO_DRAFT_BANS,
  DEMO_DRAFT_CHAT,
  DEMO_DRAFT_PICKS,
  DEMO_DRAFT_PLAYERS,
  DEMO_DRAFT_STEPS,
  demoDraftMatch,
  demoDraftPicks,
  demoDraftRoom,
  type DemoDraftStep,
} from "~/utilities/demoDraft";

// Stand-ins for people and machines: each captain's pick, the api making the
// match, the players checking in, each captain's ban, the server booting.
// Everything else is the app's own: the draft room holds the finished veto for
// DRAFT_VETO_HOLD_MS before it hands over, and every animation after that is
// the match page's.
const PICK_MS = 2400;
const CREATE_MS = 900;
const CHECK_IN_STEP_MS = 280;
const CHECK_IN_MS = 2400;
const BAN_MS = 1600;
const BOOT_MS = 6000;

const otherTabs = [
  "match.tabs.rounds",
  "match.tabs.economy",
  "match.tabs.utility",
];

// Signed in, you sit on Team 1, so you see what a player sees.
const viewer = computed(() => {
  const me = useAuthStore().me;
  return me
    ? {
        steam_id: me.steam_id,
        name: me.name,
        avatar_url: me.avatar_url,
        custom_avatar_url: me.custom_avatar_url,
        country: me.country,
      }
    : null;
});

const step = ref<DemoDraftStep>("picks");
const picked = ref(0);
const checkIns = ref<number | null>(null);
const everyoneIn = ref(false);
const bans = ref(0);
const turnAt = ref(Date.now());
const startedAt = ref(Date.now());

const room = computed(() =>
  demoDraftRoom(viewer.value, startedAt.value, {
    picked: picked.value,
    turnAt: turnAt.value,
    matchMade: step.value !== "picks",
  }),
);
// The draft has no match until its last pick.
const match = computed(() =>
  step.value === "picks"
    ? undefined
    : demoDraftMatch({
        step: step.value,
        everyoneIn: everyoneIn.value,
        checkIns: checkIns.value,
        bans: bans.value,
        turnAt: turnAt.value,
        startedAt: startedAt.value,
        viewer: viewer.value,
      }),
);
const picks = computed(() => demoDraftPicks(bans.value));

// The two pages, as the router shows them.
const onMatchPage = computed(
  () => step.value === "booting" || step.value === "ready",
);

// The match page's own readings of the start stage.
const vetoStageUp = computed(
  () =>
    vetoBoardUp(match.value) || vetoHandoffPhase(match.value?.id) === "stage",
);
const vetoArriving = computed(
  () => vetoHandoffPhase(match.value?.id) === "arriving",
);
const bootInSlot = computed(
  () =>
    !!match.value?.is_in_lineup &&
    match.value.status === e_match_status_enum.Live,
);

let timers: ReturnType<typeof setTimeout>[] = [];
const stop = () => {
  timers.forEach(clearTimeout);
  timers = [];
};
const later = (ms: number, run: () => void) => {
  timers.push(setTimeout(run, ms));
};

// How long a step you jump to shows the end of the step before it.
const JUMP_LEAD_MS = 1500;

// The step being jumped to, while the end of the one before it shows.
const pending = ref<DemoDraftStep | null>(null);
const shownStep = computed(() => pending.value ?? step.value);
// Bumped on every jump, so the setup starts afresh instead of animating back.
const run = ref(0);

const arrive = (next: DemoDraftStep) => {
  pending.value = null;
  step.value = next;
};

const boot = () => later(BOOT_MS, () => arrive("ready"));

// The draft room's own hand-off, scorebug and all.
const handingOff = useScorebugHandoff();
const handOver = () => {
  void handOffScorebug(() => {
    arrive("booting");
    return nextTick();
  });
  boot();
};

// Each captain bans in turn; the last ban closes the veto, the draft room
// holds it, then sends everyone to the match page.
const ban = () =>
  later(BAN_MS, () => {
    bans.value += 1;
    turnAt.value = Date.now();
    if (bans.value < DEMO_DRAFT_BANS) {
      ban();
      return;
    }
    later(DRAFT_VETO_HOLD_MS, handOver);
  });

// The last check-in starts the veto at once.
const startVeto = () => {
  everyoneIn.value = true;
  turnAt.value = Date.now();
  arrive("veto");
  ban();
};

// The match is made with you checking in first; the others follow, the last
// one a while after.
const checkIn = () =>
  later(
    checkIns.value === DEMO_DRAFT_PLAYERS - 1 ? CHECK_IN_MS : CHECK_IN_STEP_MS,
    () => {
      checkIns.value = (checkIns.value ?? 0) + 1;
      if (checkIns.value < DEMO_DRAFT_PLAYERS) {
        checkIn();
        return;
      }
      startVeto();
    },
  );

const makeMatch = () =>
  later(CREATE_MS, () => {
    checkIns.value = 1;
    arrive("check_in");
    checkIn();
  });

// Each captain picks in turn on a fresh clock; the last pick has the api make
// the match.
const landPick = () => {
  picked.value += 1;
  turnAt.value = Date.now();
  if (picked.value < DEMO_DRAFT_PICKS) {
    later(PICK_MS, landPick);
    return;
  }
  makeMatch();
};

// A step you pick starts from the end of the one before it, so the move into
// it plays: check-in from the last pick, the veto from the last check-in, the
// match page from the finished veto in the draft room, server ready from the
// start stage booting.
const play = (target: DemoDraftStep) => {
  stop();
  // A jump mid-handoff must not leave the next run waiting on it.
  useVetoHandoff().value = null;
  run.value += 1;
  startedAt.value = Date.now();
  turnAt.value = Date.now();
  everyoneIn.value = false;
  checkIns.value = null;
  picked.value = DEMO_DRAFT_PICKS;
  pending.value = target === "picks" ? null : target;
  if (target === "picks" || target === "check_in") {
    bans.value = 0;
    step.value = "picks";
    picked.value = target === "picks" ? 0 : DEMO_DRAFT_PICKS - 1;
    later(target === "picks" ? PICK_MS : JUMP_LEAD_MS, landPick);
  } else if (target === "veto") {
    bans.value = 0;
    step.value = "check_in";
    checkIns.value = DEMO_DRAFT_PLAYERS - 1;
    later(JUMP_LEAD_MS, startVeto);
  } else if (target === "booting") {
    bans.value = DEMO_DRAFT_BANS;
    step.value = "veto";
    later(JUMP_LEAD_MS, handOver);
  } else {
    bans.value = DEMO_DRAFT_BANS;
    step.value = "booting";
    later(JUMP_LEAD_MS, () => arrive("ready"));
  }
};

onMounted(() => play("picks"));
onBeforeUnmount(stop);

const segment =
  "inline-flex items-center whitespace-nowrap rounded px-2.5 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] transition-colors duration-150";
</script>

<template>
  <div class="flex flex-col gap-4 md:gap-6">
    <div
      class="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-dashed border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.05)] px-4 py-3"
    >
      <span
        class="inline-flex items-center gap-1.5 rounded border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-2 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
      >
        <FlaskConical class="size-3" />
        {{ $t("faq.demo.badge") }}
      </span>
      <!-- Two lines held for every step, so a shorter caption doesn't move
           the page under it. -->
      <p
        class="flex min-h-10 min-w-0 flex-[1_1_20rem] items-center text-sm text-muted-foreground"
      >
        {{ $t(`faq.demo_draft.steps.${shownStep}.caption`) }}
      </p>
      <div
        class="inline-flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-background/60 p-0.5"
        role="group"
        :aria-label="$t('faq.demo_draft.step_label')"
      >
        <button
          v-for="option in DEMO_DRAFT_STEPS"
          :key="option"
          type="button"
          :aria-pressed="shownStep === option"
          :class="[
            segment,
            shownStep === option
              ? 'bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
              : 'text-muted-foreground hover:text-foreground',
          ]"
          @click="play(option)"
        >
          {{ $t(`faq.demo_draft.steps.${option}.label`) }}
        </button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="gap-1.5 [&_svg]:size-3.5"
        @click="play('picks')"
      >
        <RotateCcw />
        {{ $t("faq.demo_draft.replay") }}
      </Button>
    </div>

    <!-- The route change from the draft room to the match page. -->
    <Transition
      name="page"
      :mode="handingOff ? 'default' : 'out-in'"
      :css="!handingOff"
    >
      <!-- pages/draft-room/[id].vue -->
      <div v-if="!onMatchPage" :key="`draft-room-${run}`">
        <PageTransition>
          <DraftRoom :room="room" :match="match" :veto-picks="picks">
            <template #chat>
              <ul
                class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3 text-sm"
              >
                <li
                  v-for="(line, index) in DEMO_DRAFT_CHAT"
                  :key="index"
                  class="leading-snug"
                >
                  <span
                    class="font-semibold"
                    :class="
                      line.lineup === 1
                        ? 'text-[hsl(var(--tac-amber))]'
                        : 'text-[hsl(var(--tac-blue))]'
                    "
                  >
                    {{ line.name }}
                  </span>
                  {{ " " }}
                  <span class="text-foreground/85">{{ line.text }}</span>
                </li>
              </ul>
              <div
                class="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground"
              >
                {{ $t("faq.demo.chat_readonly") }}
              </div>
            </template>
            <template #voice><span></span></template>
          </DraftRoom>
        </PageTransition>
      </div>

      <!-- pages/matches/[id]/index.vue -->
      <div
        v-else
        :key="`match-page-${run}`"
        class="flex flex-col gap-4 md:gap-6"
      >
        <!-- The route's fade is the page's one arrival, as on the real page. -->
        <section
          class="relative isolate overflow-hidden rounded-2xl bg-muted/20 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-white/[0.07]"
        >
          <MatchHeader :match="match">
            <template #actions><span></span></template>
            <template #veto>
              <MatchHeaderVeto :match="match" :picks="picks" />
            </template>
          </MatchHeader>
          <QuickMatchConnect
            variant="bar"
            :match="match"
            :hide-booting="!bootInSlot && (vetoStageUp || vetoArriving)"
          />
        </section>

        <div
          class="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-[minmax(320px,_400px)_minmax(0,1fr)] lg:gap-8"
        >
          <div class="grid min-w-0 grid-cols-1 gap-y-4 md:gap-y-6">
            <MatchInfo :match="match" hide-connect />

            <div
              class="overflow-hidden rounded-xl border border-border/60 bg-card/30"
            >
              <div
                class="border-b border-border/60 px-4 py-2.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ $t("faq.demo.chat_label") }}
              </div>
              <ul class="flex flex-col gap-2 px-4 py-3 text-sm">
                <li
                  v-for="(line, index) in DEMO_DRAFT_CHAT"
                  :key="index"
                  class="leading-snug"
                >
                  <span
                    class="font-semibold"
                    :class="
                      line.lineup === 1
                        ? 'text-[hsl(var(--tac-amber))]'
                        : 'text-[hsl(var(--tac-blue))]'
                    "
                  >
                    {{ line.name }}
                  </span>
                  {{ " " }}
                  <span class="text-foreground/85">{{ line.text }}</span>
                </li>
              </ul>
              <div
                class="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground"
              >
                {{ $t("faq.demo.chat_readonly") }}
              </div>
            </div>

            <MatchMapSlots
              :match="match"
              :folded="vetoStageUp"
              :arriving="vetoArriving"
            />
          </div>

          <div class="min-w-0">
            <PageTransition :appear="false">
              <MatchRegionVeto :match="match" class="pb-6" />
            </PageTransition>

            <PageTransition :appear="false">
              <MatchMapVeto
                :match="match"
                :match-id="match.id"
                :boot-status="!bootInSlot"
                :picks="picks"
                class="pb-6"
              />
            </PageTransition>

            <Tabs model-value="scoreboard">
              <div class="mb-4 min-w-0 overflow-x-auto">
                <TabsList variant="underline" class="h-auto flex-nowrap">
                  <TabsTrigger value="scoreboard">
                    {{ $t("match.tabs.scoreboard") }}
                  </TabsTrigger>
                  <FiveStackToolTip
                    v-for="label in otherTabs"
                    :key="label"
                    as-child
                    side="top"
                  >
                    <template #trigger>
                      <span
                        class="cursor-default select-none whitespace-nowrap px-3 py-1.5 text-sm font-medium text-muted-foreground/40"
                      >
                        {{ $t(label) }}
                      </span>
                    </template>
                    {{ $t("faq.demo.not_in_demo") }}
                  </FiveStackToolTip>
                </TabsList>
              </div>
              <Card class="overflow-x-auto overscroll-x-none bg-card/20">
                <CardContent class="p-1 sm:p-2" inert>
                  <LineupOverview
                    :match="match"
                    :lineup="match.lineup_1"
                    :combine-with="match.lineup_2"
                  />
                </CardContent>
              </Card>
            </Tabs>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
