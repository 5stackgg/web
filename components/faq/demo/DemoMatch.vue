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
import DemoScoreboard from "~/components/faq/demo/DemoScoreboard.vue";
import FaqHelpGlyph from "~/components/faq/FaqHelpGlyph.vue";
import MatchHeader from "~/components/match/MatchHeader.vue";
import MatchHeaderVeto from "~/components/match/MatchHeaderVeto.vue";
import MatchInfo from "~/components/match/MatchInfo.vue";
import MatchMapSlots from "~/components/match/MatchMapSlots.vue";
import MatchPauseButton from "~/components/match/MatchPauseButton.vue";
import VetoBoard from "~/components/match/VetoBoard.vue";
import MatchVetoFixDialog from "~/components/match/veto/MatchVetoFixDialog.vue";
import MatchRoundsTab from "~/components/match/rounds/MatchRoundsTab.vue";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { HeightSwap, PageTransition } from "~/components/ui/transitions";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { useDemoMatch, type DemoStep } from "~/composables/useDemoMatch";
import { e_match_map_status_enum, e_match_status_enum } from "~/generated/zeus";
import {
  DEMO_CHAT,
  DEMO_DISCONNECTED,
  DEMO_LINEUPS,
} from "~/utilities/demoMatch";
import {
  mapVetoItems,
  mapVetoPicking,
  mapVetoTurn,
  vetoLineups,
} from "~/utilities/vetoLineups";
import { vetoBoardUp } from "~/utilities/vetoStage";

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

const match = computed(() => demo.match.value);

const currentMapStatus = computed(
  () => match.value.match_maps.find((map) => map.is_current_map)?.status,
);
const canPause = computed(
  () =>
    match.value.status === e_match_status_enum.Live &&
    currentMapStatus.value !== undefined &&
    [
      e_match_map_status_enum.Live,
      e_match_map_status_enum.Overtime,
      e_match_map_status_enum.Paused,
    ].includes(currentMapStatus.value),
);

const vetoDone = computed(() =>
  demo.vetoBoardSteps.value.every((step) => !!step.record),
);

const tabsEl = ref<HTMLElement | null>(null);

watch(demo.focusRounds, async () => {
  await nextTick();
  tabsEl.value?.scrollIntoView({ behavior: "smooth", block: "start" });
});

const series = computed<[number, number]>(() =>
  demo.step.value === "finished"
    ? [2, 0]
    : demo.step.value === "live"
      ? [1, 0]
      : [0, 0],
);

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
      <section
        class="relative isolate overflow-hidden rounded-2xl bg-muted/20 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-white/[0.07]"
      >
        <MatchHeader :match="match">
          <template #actions>
            <MatchPauseButton
              :show="canPause"
              :paused="currentMapStatus === e_match_map_status_enum.Paused"
              @toggle="demo.togglePause()"
            />
          </template>
          <template #veto>
            <MatchHeaderVeto :match="match" :picks="demo.picks.value" />
          </template>
        </MatchHeader>
      </section>
    </PageTransition>

    <div
      class="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-[minmax(320px,_400px)_minmax(0,1fr)] lg:gap-8"
    >
      <div class="grid min-w-0 grid-cols-1 gap-y-4 md:gap-y-6">
        <PageTransition :delay="100">
          <MatchInfo :match="match" />
        </PageTransition>

        <PageTransition :delay="200">
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

        <PageTransition :delay="200">
          <MatchMapSlots :match="match" :folded="vetoBoardUp(match)" />
        </PageTransition>
      </div>

      <PageTransition :delay="100" class="min-w-0">
        <HeightSwap>
          <div v-if="demo.step.value === 'veto'" key="veto" class="pb-6">
            <VetoBoard
              kind="map"
              :items="mapVetoItems(match)"
              :steps="demo.vetoBoardSteps.value"
              :lineups="vetoLineups(match, t)"
              :picking-lineup="mapVetoTurn(match)"
              :is-picking="mapVetoPicking(match, demo.vetoOverride.value)"
              :deadline="match.veto_pick_expires_at"
              :total="match.options.veto_pick_timeout"
              :best-of="match.options.best_of"
              @confirm="demo.vetoMove($event)"
            />
            <p v-if="vetoDone" class="mt-3 text-sm text-muted-foreground">
              {{ $t("faq.demo.veto_complete") }}
            </p>
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
                <DemoScoreboard :data="demo.roundsData.value" />
              </TabsContent>
              <TabsContent value="rounds">
                <MatchRoundsTab
                  v-model:rewinding="demo.rewinding.value"
                  v-model:target="demo.target.value"
                  :data="demo.roundsData.value"
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
        :match="match"
        :items="demo.fixItems.value"
        @select="demo.selectFix($event)"
        @pause="demo.togglePause()"
      />
    </Teleport>
  </div>
</template>
