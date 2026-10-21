<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  ref,
  watch,
} from "vue";
import { FlaskConical, RotateCcw } from "lucide-vue-next";
import DemoAdminDock from "~/components/faq/demo/DemoAdminDock.vue";
import DemoFixFlows from "~/components/faq/demo/DemoFixFlows.vue";
import MatchVetoFixDialog from "~/components/match/veto/MatchVetoFixDialog.vue";
import DemoMapCard from "~/components/faq/demo/DemoMapCard.vue";
import DemoMatchHeader from "~/components/faq/demo/DemoMatchHeader.vue";
import DemoScoreboard from "~/components/faq/demo/DemoScoreboard.vue";
import DemoVetoBoard from "~/components/faq/demo/DemoVetoBoard.vue";
import FaqHelpGlyph from "~/components/faq/FaqHelpGlyph.vue";
import MatchRoundsTab from "~/components/match/rounds/MatchRoundsTab.vue";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { HeightSwap, PageTransition } from "~/components/ui/transitions";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { useDemoMatch, type DemoStep } from "~/composables/useDemoMatch";
import {
  DEMO_CHAT,
  DEMO_DISCONNECTED,
  DEMO_LINEUPS,
  demoMirageRounds,
  type DemoMapSlot,
} from "~/utilities/demoMatch";
import { scoreBefore } from "~/utilities/rewind";

const demo = useDemoMatch();
const { t } = useI18n();

const steps: { value: DemoStep; label: string }[] = [
  { value: "veto", label: "match.admin_bar.steps.veto" },
  { value: "live", label: "match.admin_bar.steps.live" },
  { value: "finished", label: "match.admin_bar.steps.finished" },
];

const otherTabs = [
  "match.tabs.economy",
  "match.tabs.clutches",
  "match.tabs.head_to_head",
  "match.tabs.utility",
];

const roundsData = computed(() =>
  demo.step.value === "finished"
    ? demo.finishedRounds.value
    : demo.rounds.value,
);

const liveScore = computed(() =>
  scoreBefore(demo.rounds.value, demo.live.value),
);

const tabsEl = ref<HTMLElement | null>(null);

watch(demo.focusRounds, async () => {
  await nextTick();
  tabsEl.value?.scrollIntoView({ behavior: "smooth", block: "start" });
});

const mirageRounds = demoMirageRounds();

const mapSlots = computed<(DemoMapSlot | null)[]>(() => {
  const step = demo.step.value;
  if (step === "veto") {
    const slots: (DemoMapSlot | null)[] = demo.vetoSteps.value
      .slice(0, demo.vetoDone.value)
      .filter((pick) => pick.type === "Pick" || pick.type === "Decider")
      .map((pick) => ({
        map: pick.map,
        pickedBy: pick.type === "Pick" ? pick.lineup : null,
        status: "Scheduled",
      }));
    while (slots.length < 3) {
      slots.push(null);
    }
    return slots;
  }
  const mirage: DemoMapSlot = {
    map: "de_mirage",
    pickedBy: 1,
    status: "Finished",
    score: [13, 9],
    rounds: mirageRounds,
  };
  const data = roundsData.value;
  const ancient: DemoMapSlot = {
    map: "de_ancient",
    pickedBy: 2,
    status:
      step === "finished" ? "Finished" : demo.paused.value ? "Paused" : "Live",
    score: step === "finished" ? [13, 10] : liveScore.value,
    rounds: data.rounds.filter(
      (row) => !row.undone && (data.finished || row.round < data.live_round),
    ),
    current: step === "live",
  };
  if (step === "finished") {
    return [mirage, ancient];
  }
  return [
    mirage,
    ancient,
    { map: "de_dust2", pickedBy: null, status: "Scheduled" },
  ];
});

const series = computed<[number, number]>(() =>
  demo.step.value === "finished"
    ? [2, 0]
    : demo.step.value === "live"
      ? [1, 0]
      : [0, 0],
);

function openRounds() {
  demo.startRewind();
}

const dockReady = ref(false);
let dockFrame = 0;
onMounted(() => {
  const wait = () => {
    if (document.getElementById("main-bottom-dock")) {
      dockReady.value = true;
    } else {
      dockFrame = requestAnimationFrame(wait);
    }
  };
  wait();
});
onBeforeUnmount(() => cancelAnimationFrame(dockFrame));

const segment =
  "inline-flex items-center rounded px-2.5 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.16em] transition-colors duration-150";
</script>

<template>
  <div class="flex flex-col gap-4 md:gap-6">
    <PageTransition>
      <div
        class="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-dashed border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.05)] px-4 py-3"
      >
        <span
          class="inline-flex items-center gap-1.5 rounded border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-2 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
        >
          <FlaskConical class="size-3" />
          {{ $t("faq.demo.badge") }}
        </span>
        <p class="min-w-0 flex-[1_1_20rem] text-sm text-muted-foreground">
          {{ $t("faq.demo.intro") }}
        </p>
        <div
          class="inline-flex items-center gap-0.5 rounded-md border border-border bg-background/60 p-0.5"
          role="group"
          :aria-label="$t('faq.demo.step_label')"
        >
          <button
            v-for="option in steps"
            :key="option.value"
            type="button"
            :aria-pressed="demo.step.value === option.value"
            :class="[
              segment,
              demo.step.value === option.value
                ? 'bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
                : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="demo.step.value = option.value"
          >
            {{ $t(option.label) }}
          </button>
        </div>
        <label
          v-if="demo.step.value === 'live'"
          class="inline-flex cursor-pointer items-center gap-2 text-xs"
        >
          <Switch v-model="demo.connected.value" />
          {{ $t("faq.demo.reconnects", { name: DEMO_DISCONNECTED }) }}
        </label>
        <Button
          variant="ghost"
          size="sm"
          class="gap-1.5 [&_svg]:size-3.5"
          @click="demo.reset()"
        >
          <RotateCcw />
          {{ $t("faq.demo.reset") }}
        </Button>
      </div>
    </PageTransition>

    <PageTransition :delay="80">
      <DemoMatchHeader
        :step="demo.step.value"
        :paused="demo.paused.value"
        :live-score="liveScore"
      />
    </PageTransition>

    <div
      class="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-[minmax(320px,_400px)_minmax(0,1fr)] lg:gap-8"
    >
      <div class="grid min-w-0 grid-cols-1 gap-y-4 md:gap-y-6">
        <PageTransition :delay="120">
          <div
            class="flex flex-col gap-3 rounded-xl border border-white/10 bg-background/80 p-4 backdrop-blur-sm"
          >
            <div class="flex items-center gap-2">
              <span
                class="size-2 rounded-full"
                :class="
                  demo.step.value === 'veto'
                    ? 'bg-muted-foreground/50'
                    : 'bg-success'
                "
              />
              <span
                class="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ $t("faq.demo.server_label") }}
              </span>
              <span class="ml-auto text-xs text-muted-foreground">US East</span>
            </div>
            <code
              v-if="demo.step.value !== 'veto'"
              class="rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-foreground/85"
            >
              connect 203.0.113.10:27015
            </code>
            <p v-else class="text-xs text-muted-foreground">
              {{ $t("faq.demo.server_pending") }}
            </p>
          </div>
        </PageTransition>

        <PageTransition :delay="180">
          <div
            class="overflow-hidden rounded-xl border border-border/60 bg-card/30"
          >
            <div
              class="border-b border-border/60 px-4 py-2.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              {{ $t("faq.demo.chat_label") }}
            </div>
            <TransitionGroup
              tag="ul"
              class="flex flex-col gap-2 px-4 py-3 text-sm"
              enter-active-class="transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
              enter-from-class="opacity-0 translate-y-1"
            >
              <li
                v-for="(line, index) in DEMO_CHAT[demo.step.value]"
                :key="`${demo.step.value}-${index}`"
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
            </TransitionGroup>
            <div
              class="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground"
            >
              {{ $t("faq.demo.chat_readonly") }}
            </div>
          </div>
        </PageTransition>

        <PageTransition :delay="240">
          <TransitionGroup
            tag="div"
            class="flex flex-col gap-3"
            leave-active-class="transition-opacity duration-150 ease-in motion-reduce:transition-none"
            leave-to-class="opacity-0"
          >
            <div
              v-for="(slot, index) in mapSlots"
              :key="index"
              class="grid grid-cols-[minmax(0,1fr)]"
            >
              <HeightSwap>
                <div v-if="slot" :key="slot.map">
                  <DemoMapCard
                    :slot="slot"
                    :can-restore="slot.current"
                    @restore="openRounds"
                  />
                </div>
                <div
                  v-else
                  key="tbd"
                  class="overflow-hidden rounded-xl border-2 border-dashed border-border/60"
                >
                  <div
                    class="flex aspect-[16/5] items-center justify-center bg-muted/40 text-muted-foreground"
                  >
                    <div class="flex flex-col items-center gap-1">
                      <span
                        class="text-sm font-semibold uppercase tracking-wide"
                      >
                        {{ $t("match.map_number", { count: index + 1 }) }}
                      </span>
                      <span class="text-xs">{{ $t("match.map_tbd") }}</span>
                    </div>
                  </div>
                  <div
                    class="border-t border-border/30 bg-muted/40 px-3 py-2.5"
                  >
                    <div class="flex items-center justify-center">
                      <span class="text-xs text-muted-foreground">—</span>
                    </div>
                  </div>
                </div>
              </HeightSwap>
            </div>
          </TransitionGroup>
        </PageTransition>
      </div>

      <PageTransition :delay="160" class="min-w-0">
        <HeightSwap>
          <div v-if="demo.step.value === 'veto'" key="veto">
            <DemoVetoBoard
              v-model:acting="demo.actingForTeam.value"
              :steps="demo.vetoSteps.value"
              :done="demo.vetoDone.value"
              :current="demo.vetoCurrent.value"
              :clock="demo.clock.value"
              @choose="(map, side) => demo.chooseForTeam(map, side)"
            />
          </div>
          <div v-else key="match" ref="tabsEl" class="scroll-mt-4">
            <Tabs v-model="demo.tab.value">
              <div class="mb-4 flex items-center gap-3">
                <div class="min-w-0 flex-1 overflow-x-auto">
                  <TabsList variant="underline" class="h-auto flex-nowrap">
                    <TabsTrigger value="scoreboard">
                      {{ $t("match.tabs.scoreboard") }}
                    </TabsTrigger>
                    <TabsTrigger value="rounds">
                      {{ $t("match.tabs.rounds") }}
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
              </div>
              <TabsContent value="scoreboard">
                <DemoScoreboard :data="roundsData" />
              </TabsContent>
              <TabsContent value="rounds">
                <MatchRoundsTab
                  v-model:rewinding="demo.rewinding.value"
                  v-model:target="demo.target.value"
                  :data="roundsData"
                  :lineup1="DEMO_LINEUPS[1].name"
                  :lineup2="DEMO_LINEUPS[2].name"
                  :map-number="2"
                  :can-rewind="demo.step.value === 'live'"
                  :blocked-reason="t('match.recovery.fix.restore_over')"
                  :paused="demo.paused.value"
                  :finished="demo.step.value === 'finished'"
                  :live-kills="demo.liveKills.value"
                  :live-damage="demo.liveDamage.value"
                  @restore="demo.restore($event)"
                >
                  <template #aside>
                    <FaqHelpGlyph section="restore" />
                  </template>
                </MatchRoundsTab>
              </TabsContent>
            </Tabs>
          </div>
        </HeightSwap>
      </PageTransition>
    </div>

    <DemoFixFlows v-model:flow="demo.flow.value" :series="series" />

    <MatchVetoFixDialog
      v-model:open="demo.vetoFixOpen.value"
      :best-of="3"
      :steps="demo.vetoSteps.value"
      :done="demo.vetoDone.value"
      :lineup1="DEMO_LINEUPS[1].name"
      :lineup2="DEMO_LINEUPS[2].name"
      :initial-step="demo.vetoFixStep.value"
      @confirm="demo.rewindVeto($event)"
    />

    <Teleport v-if="dockReady" to="#main-bottom-dock">
      <DemoAdminDock
        v-model:open="demo.fixOpen.value"
        :match="demo.fakeMatch.value"
        :paused="demo.paused.value"
        :items="demo.fixItems.value"
        @select="demo.selectFix($event)"
        @resume="demo.resume()"
      />
    </Teleport>
  </div>
</template>
