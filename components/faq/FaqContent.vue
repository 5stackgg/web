<script setup lang="ts">
import { computed, onMounted, provide, toRef } from "vue";
import { ArrowRight, ArrowUpRight, MoreVertical } from "lucide-vue-next";
import DemoAdminDock from "~/components/faq/demo/DemoAdminDock.vue";
import FaqFigure from "~/components/faq/FaqFigure.vue";
import FaqLink from "~/components/faq/FaqLink.vue";
import FaqLookup from "~/components/faq/FaqLookup.vue";
import FaqPartHead from "~/components/faq/FaqPartHead.vue";
import FaqSection from "~/components/faq/FaqSection.vue";
import FaqSub from "~/components/faq/FaqSub.vue";
import FaqTerm from "~/components/faq/FaqTerm.vue";
import FaqText from "~/components/faq/FaqText.vue";
import FaqWay from "~/components/faq/FaqWay.vue";
import { FAQ_CONTEXT } from "~/components/faq/faqContext";
import MatchFixProblemMenu from "~/components/match/MatchFixProblemMenu.vue";
import RewindBar from "~/components/match/rounds/RewindBar.vue";
import RoundSnapshotTable from "~/components/match/rounds/RoundSnapshotTable.vue";
import RoundsRewindStrip from "~/components/match/rounds/RoundsRewindStrip.vue";
import RoundsUndoneTray from "~/components/match/rounds/RoundsUndoneTray.vue";
import VetoRewindTimeline from "~/components/match/veto/VetoRewindTimeline.vue";
import { demoFixMenu } from "~/composables/useDemoMatch";
import { useFaqOutline } from "~/composables/useFaq";
import {
  e_match_map_status_enum,
  e_match_status_enum,
  e_sides_enum,
} from "~/generated/zeus";
import {
  DEMO_DISCONNECTED,
  DEMO_LINEUPS,
  DEMO_VETO,
  demoRewindRounds,
} from "~/utilities/demoMatch";
import { playersAtStartOf } from "~/utilities/rewind";

const props = defineProps<{
  only?: string | null;
  go?: (anchor: string) => void;
}>();

const emit = defineEmits<{ ready: [] }>();

const { t } = useI18n();
const outline = useFaqOutline();

onMounted(() => emit("ready"));

function scrollTo(anchor: string) {
  const target = document.getElementById(anchor);
  if (!target) {
    return;
  }
  history.replaceState(history.state, "", `#${anchor}`);
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

provide(FAQ_CONTEXT, {
  outline,
  only: toRef(() => props.only ?? null),
  go: (anchor: string) => (props.go ? props.go(anchor) : scrollTo(anchor)),
});

const qaParts = computed(() =>
  outline.value.filter((part) =>
    ["playing", "about", "hosting"].includes(part.id),
  ),
);

const live = demoRewindRounds({ connected: true });
const waiting = demoRewindRounds({ connected: false });
const previewPlayers = playersAtStartOf(live, 16).filter(
  (player) => player.lineup === 2,
);
const nowPlayers = playersAtStartOf(live, 17).filter(
  (player) => player.lineup === 2,
);
const k = DEMO_LINEUPS[1].name;
const i = DEMO_LINEUPS[2].name;

const fixLive = computed(() => demoFixMenu(t, { step: "live" }));
const fixVeto = computed(() =>
  demoFixMenu(t, {
    step: "veto",
    picks: DEMO_VETO.slice(0, 4),
    current: DEMO_VETO[4],
  }),
);

const liveMatch = (status: e_match_map_status_enum) => ({
  status: e_match_status_enum.Live,
  options: { map_veto: true },
  match_maps: [{ is_current_map: true, status }],
});

const lookupRows = computed(() => [
  {
    cells: [t("faq.content.wrong.crash.see"), t("faq.content.wrong.crash.why")],
    link: { to: "restore", label: t("faq.content.wrong.crash.fix") },
  },
  {
    cells: [
      t("faq.content.wrong.dropped.see"),
      t("faq.content.wrong.dropped.why"),
    ],
    link: { to: "restore-wait", label: t("faq.content.wrong.dropped.fix") },
  },
  {
    cells: [
      t("faq.content.wrong.map_over.see"),
      t("faq.content.wrong.map_over.why"),
    ],
    link: { to: "restart-map", label: t("faq.content.wrong.map_over.fix") },
  },
  {
    cells: [
      t("faq.content.wrong.veto_wrong.see"),
      t("faq.content.wrong.veto_wrong.why"),
    ],
    link: { to: "veto-fix", label: t("faq.content.wrong.veto_wrong.fix") },
  },
  {
    cells: [
      t("faq.content.wrong.veto_clock.see"),
      t("faq.content.wrong.veto_clock.why"),
    ],
    link: { to: "veto-more", label: t("faq.content.wrong.veto_clock.fix") },
  },
  {
    cells: [
      t("faq.content.wrong.server.see"),
      t("faq.content.wrong.server.why"),
    ],
    link: { to: "server", label: t("faq.content.wrong.server.fix") },
  },
  {
    cells: [
      t("faq.content.wrong.winner.see"),
      t("faq.content.wrong.winner.why"),
    ],
    link: { to: "results", label: t("faq.content.wrong.winner.fix") },
  },
  {
    cells: [t("faq.content.wrong.stats.see"), t("faq.content.wrong.stats.why")],
    link: { to: "results", label: t("faq.content.wrong.stats.fix") },
  },
  {
    cells: [
      t("faq.content.wrong.no_button.see"),
      t("faq.content.wrong.no_button.why"),
    ],
    link: { to: "fix-who", label: t("faq.content.wrong.no_button.fix") },
  },
  {
    cells: [
      t("faq.content.wrong.t_no_show.see"),
      t("faq.content.wrong.t_no_show.why"),
    ],
    link: { to: "t-check-in", label: t("faq.content.wrong.t_no_show.fix") },
  },
  {
    cells: [
      t("faq.content.wrong.t_result.see"),
      t("faq.content.wrong.t_result.why"),
    ],
    link: { to: "t-results", label: t("faq.content.wrong.t_result.fix") },
  },
  {
    cells: [
      t("faq.content.wrong.player.see"),
      t("faq.content.wrong.player.why"),
    ],
    link: { to: "call-support", label: t("faq.content.wrong.player.fix") },
  },
]);

const words = computed(() => [
  {
    cells: [
      t("faq.content.words.organizer.term"),
      t("faq.content.words.organizer.meaning"),
    ],
  },
  {
    cells: [
      t("faq.content.words.fix.term"),
      t("faq.content.words.fix.meaning"),
    ],
  },
  {
    cells: [
      t("faq.content.words.rounds_tab.term"),
      t("faq.content.words.rounds_tab.meaning"),
    ],
  },
  {
    cells: [
      t("faq.content.words.rewind.term"),
      t("faq.content.words.rewind.meaning"),
    ],
  },
  {
    cells: [
      t("faq.content.words.backup.term"),
      t("faq.content.words.backup.meaning"),
    ],
  },
  {
    cells: [
      t("faq.content.words.undone.term"),
      t("faq.content.words.undone.meaning"),
    ],
  },
  {
    cells: [
      t("faq.content.words.veto.term"),
      t("faq.content.words.veto.meaning"),
    ],
  },
]);

const restoreBar = computed(() => ({
  eyebrow: t("match.rewind.preview_chip", { round: 16 }),
  headline: t("match.rewind.back_headline", { round: 16 }),
  detail: t("match.rewind.back_detail", {
    span: t("match.rewind.round_n", { round: 16 }),
  }),
  stats: [
    t("match.rewind.kills_count", { count: 12 }),
    t("match.rewind.damage_count", { count: "1,512" }),
  ],
  confirm: t("match.rewind.restore_confirm", { round: 16 }),
}));

const vetoBar = computed(() => ({
  eyebrow: t("match.veto_rewind.eyebrow", { step: 3 }),
  headline: t("match.veto_rewind.bar_headline", {
    step: 3,
    again: t("match.veto_rewind.again_pick", { team: k }),
  }),
  detail: t("match.veto_rewind.bar_detail", {
    list: [
      t("match.veto_rewind.cleared_pick", { team: k, map: "Mirage" }),
      t("match.veto_rewind.cleared_side", { team: i, map: "Mirage" }),
    ].join(", "),
  }),
}));

const bullets =
  "flex max-w-2xl flex-col gap-2 text-sm leading-relaxed text-foreground/85 [&>li]:relative [&>li]:pl-4 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.6em] [&>li]:before:h-px [&>li]:before:w-2 [&>li]:before:bg-[hsl(var(--tac-amber)/0.7)]";

const linkClasses =
  "inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background/40 px-2 py-1 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-[hsl(var(--tac-amber))]";
</script>

<template>
  <div class="flex flex-col gap-5">
    <FaqPartHead id="start" />

    <FaqSection id="something-wrong">
      <FaqLookup
        :headings="[
          $t('faq.content.wrong.heading_see'),
          $t('faq.content.wrong.heading_why'),
          $t('faq.content.wrong.heading_fix'),
        ]"
        :rows="lookupRows"
      />
    </FaqSection>

    <FaqSection id="words">
      <FaqLookup
        :headings="[
          $t('faq.content.words.heading_term'),
          $t('faq.content.words.heading_meaning'),
        ]"
        :rows="words"
      />
    </FaqSection>

    <FaqPartHead id="running" />

    <FaqSection id="fix-a-problem">
      <FaqSub id="fix-where" first />
      <FaqWay :n="1" :title="$t('faq.content.fix.where_title')" stacked>
        <li>{{ $t("faq.content.fix.where_1") }}</li>
        <li>{{ $t("faq.content.fix.where_2") }}</li>
        <template #figure>
          <FaqFigure :where="$t('faq.content.figures.match_page_bottom')">
            <DemoAdminDock
              :match="liveMatch(e_match_map_status_enum.Live)"
              :items="fixLive"
              hot="fix"
              frozen
            />
          </FaqFigure>
        </template>
      </FaqWay>

      <FaqSub id="fix-steps" />
      <p class="max-w-2xl text-sm leading-relaxed text-foreground/85">
        {{ $t("faq.content.fix.steps_1") }}
      </p>
      <div class="grid gap-4 md:grid-cols-2">
        <FaqFigure
          :where="$t('faq.content.figures.fix_veto')"
          :caption="$t('faq.content.fix.steps_veto_caption')"
        >
          <div class="rounded-md border border-white/[0.09] bg-popover">
            <MatchFixProblemMenu
              :step-label="fixVeto.stepLabel"
              :now="fixVeto.now"
              :anytime="fixVeto.anytime"
              :later="fixVeto.later"
            />
          </div>
        </FaqFigure>
        <FaqFigure
          :where="$t('faq.content.figures.fix_live')"
          :caption="$t('faq.content.fix.steps_live_caption')"
        >
          <div class="rounded-md border border-white/[0.09] bg-popover">
            <MatchFixProblemMenu
              :step-label="fixLive.stepLabel"
              :now="fixLive.now"
              :anytime="fixLive.anytime"
              :later="fixLive.later"
            />
          </div>
        </FaqFigure>
      </div>

      <FaqSub id="fix-who" />
      <ul
        class="flex max-w-2xl flex-col gap-2 text-sm leading-relaxed text-foreground/85"
      >
        <li>{{ $t("faq.content.fix.who_1") }}</li>
        <li>
          {{ $t("faq.content.fix.who_2") }}
          <FaqLink to="call-support">{{
            $t("match.actions.call_support")
          }}</FaqLink
          >.
        </li>
        <li>{{ $t("faq.content.fix.who_3") }}</li>
      </ul>
    </FaqSection>

    <FaqSection id="restore">
      <FaqSub id="restore-how" first />
      <FaqWay :n="1" :title="$t('faq.content.restore.pick_title')" stacked>
        <li>{{ $t("faq.content.restore.pick_1") }}</li>
        <li>{{ $t("faq.content.restore.pick_2") }}</li>
        <li>
          <i18n-t
            keypath="faq.content.restore.pick_anywhere"
            tag="span"
            scope="global"
          >
            <template #fix
              ><FaqTerm>{{ $t("match.recovery.fix.title") }}</FaqTerm></template
            >
            <template #round
              ><FaqTerm>{{
                $t("match.recovery.fix.restore_title")
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <template #figure>
          <FaqFigure
            :where="$t('faq.content.figures.rounds_rewind')"
            :caption="$t('faq.content.restore.pick_caption')"
          >
            <RoundsRewindStrip
              :data="live"
              :lineup1="k"
              :lineup2="i"
              rewinding
              :target="16"
              hot="playhead"
            />
          </FaqFigure>
        </template>
      </FaqWay>

      <FaqWay :n="2" :title="$t('faq.content.restore.preview_title')" stacked>
        <li>{{ $t("faq.content.restore.preview_1") }}</li>
        <li>{{ $t("faq.content.restore.preview_2") }}</li>
        <template #figure>
          <FaqFigure
            :where="$t('faq.content.figures.rounds_rewind')"
            :caption="
              $t('faq.content.restore.preview_caption', {
                name: DEMO_DISCONNECTED,
              })
            "
          >
            <RoundSnapshotTable
              :name="i"
              :side="e_sides_enum.TERRORIST"
              :players="previewPlayers"
              :now="nowPlayers"
              :round="16"
              :offline="[DEMO_DISCONNECTED]"
            />
          </FaqFigure>
        </template>
      </FaqWay>

      <FaqWay :n="3" :title="$t('faq.content.restore.confirm_title')" stacked>
        <li>
          <i18n-t
            keypath="faq.content.restore.confirm_1"
            tag="span"
            scope="global"
          >
            <template #button
              ><FaqTerm>{{ restoreBar.confirm }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <li>{{ $t("faq.content.restore.confirm_2") }}</li>
        <template #figure>
          <FaqFigure :where="$t('faq.content.figures.rounds_bar')">
            <RewindBar
              :eyebrow="restoreBar.eyebrow"
              :headline="restoreBar.headline"
              :detail="restoreBar.detail"
              :stats="restoreBar.stats"
              :confirm-label="restoreBar.confirm"
              :footnote="$t('match.rewind.pauses_after')"
              ready
              hot="confirm"
            />
          </FaqFigure>
        </template>
      </FaqWay>

      <FaqWay :n="4" :title="$t('faq.content.restore.after_title')" stacked>
        <li>{{ $t("faq.content.restore.after_1") }}</li>
        <li>
          <i18n-t
            keypath="faq.content.restore.after_2"
            tag="span"
            scope="global"
          >
            <template #resume
              ><FaqTerm>{{ $t("faq.demo.resume") }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <template #figure>
          <FaqFigure :where="$t('faq.content.figures.match_page_bottom')">
            <DemoAdminDock
              :match="liveMatch(e_match_map_status_enum.Paused)"
              :items="fixLive"
              paused
              hot="resume"
              frozen
            />
          </FaqFigure>
        </template>
      </FaqWay>

      <FaqSub id="restore-which" />
      <FaqLookup
        :headings="[
          $t('faq.content.restore.which_heading_pick'),
          $t('faq.content.restore.which_heading_result'),
        ]"
        :rows="[
          {
            cells: [
              $t('faq.content.restore.which_live'),
              $t('faq.content.restore.which_live_result'),
            ],
          },
          {
            cells: [
              $t('faq.content.restore.which_earlier'),
              $t('faq.content.restore.which_earlier_result'),
            ],
          },
          {
            cells: [
              $t('faq.content.restore.which_first'),
              $t('faq.content.restore.which_first_result'),
            ],
            link: {
              to: 'restart-map',
              label: $t('faq.sections.restart_map.title'),
            },
          },
        ]"
      />
      <p class="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {{ $t("faq.content.restore.which_note") }}
      </p>

      <FaqSub id="restore-wait" />
      <FaqWay>
        <li>{{ $t("faq.content.restore.wait_1") }}</li>
        <li>
          {{ $t("faq.content.restore.wait_2", { name: DEMO_DISCONNECTED }) }}
        </li>
        <template #figure>
          <FaqFigure :where="$t('faq.content.figures.rounds_bar')">
            <RewindBar
              :eyebrow="restoreBar.eyebrow"
              :headline="restoreBar.headline"
              :confirm-label="restoreBar.confirm"
              :footnote="
                $t('match.rewind.unlocks_when', { names: DEMO_DISCONNECTED })
              "
              :waiting="{
                connected: waiting.connected_players,
                expected: waiting.expected_players,
                names: waiting.disconnected,
              }"
              hot="waiting"
            />
          </FaqFigure>
        </template>
      </FaqWay>

      <FaqSub id="restore-undo" />
      <FaqWay>
        <li>{{ $t("faq.content.restore.undo_1") }}</li>
        <li>
          <i18n-t
            keypath="faq.content.restore.undo_2"
            tag="span"
            scope="global"
          >
            <template #button
              ><FaqTerm>{{ $t("match.rewind.bring_back") }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <template #figure>
          <FaqFigure :where="$t('faq.content.figures.rounds_tab')">
            <RoundsUndoneTray
              :rounds="[16]"
              :live-round="16"
              can-bring-back
              hot
            />
          </FaqFigure>
        </template>
      </FaqWay>

      <FaqSub id="restore-limits" />
      <ul
        class="flex max-w-2xl flex-col gap-2 text-sm leading-relaxed text-foreground/85"
      >
        <li>{{ $t("faq.content.restore.limit_live") }}</li>
        <li>{{ $t("faq.content.restore.limit_over") }}</li>
        <li>{{ $t("faq.content.restore.limit_rush") }}</li>
        <li>{{ $t("faq.content.restore.limit_player") }}</li>
        <li>{{ $t("faq.content.restore.limit_economy") }}</li>
      </ul>
    </FaqSection>

    <FaqSection id="restart-map">
      <ul
        class="flex max-w-2xl flex-col gap-2 text-sm leading-relaxed text-foreground/85"
      >
        <li>
          <i18n-t
            keypath="faq.content.restart_map.how"
            tag="span"
            scope="global"
          >
            <template #fix
              ><FaqTerm>{{ $t("match.recovery.fix.title") }}</FaqTerm></template
            >
            <template #item
              ><FaqTerm>{{
                $t("match.recovery.fix.restart_map_title")
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <li>{{ $t("faq.content.restart_map.after") }}</li>
        <li>
          <i18n-t
            keypath="faq.content.restart_map.undo"
            tag="span"
            scope="global"
          >
            <template #link>
              <FaqLink to="restore-undo">{{
                $t("match.rewind.bring_back")
              }}</FaqLink>
            </template>
          </i18n-t>
        </li>
      </ul>
    </FaqSection>

    <FaqSection id="veto-fix">
      <FaqSub id="veto-how" first />
      <FaqWay :n="1" :title="$t('faq.content.veto.pick_title')">
        <li>
          <i18n-t keypath="faq.content.veto.pick_1" tag="span" scope="global">
            <template #fix
              ><FaqTerm>{{ $t("match.recovery.fix.title") }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <li>
          <i18n-t
            keypath="faq.content.veto.pick_undo"
            tag="span"
            scope="global"
          >
            <template #item
              ><FaqTerm>{{
                $t("match.fix_menu.undo_last_title")
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <li>
          <i18n-t
            keypath="faq.content.veto.pick_mispick"
            tag="span"
            scope="global"
          >
            <template #item
              ><FaqTerm>{{
                $t("match.fix_menu.mispick_title")
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <li>
          <i18n-t
            keypath="faq.content.veto.pick_redo"
            tag="span"
            scope="global"
          >
            <template #item
              ><FaqTerm>{{
                $t("match.fix_menu.redo_title")
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <template #figure>
          <FaqFigure :where="$t('faq.content.figures.fix_veto')">
            <div
              class="max-w-sm rounded-md border border-white/[0.09] bg-popover"
            >
              <MatchFixProblemMenu
                :step-label="fixVeto.stepLabel"
                :now="fixVeto.now"
                :anytime="[]"
                hot="mispick"
              />
            </div>
          </FaqFigure>
        </template>
      </FaqWay>

      <FaqWay :n="2" :title="$t('faq.content.veto.step_title')" stacked>
        <li>{{ $t("faq.content.veto.step_1") }}</li>
        <li>{{ $t("faq.content.veto.step_2") }}</li>
        <template #figure>
          <FaqFigure :where="$t('faq.content.figures.veto')">
            <VetoRewindTimeline
              :best-of="3"
              :steps="DEMO_VETO"
              :done="4"
              :lineup1="k"
              :lineup2="i"
              rewinding
              :target="3"
              hot="step"
            />
          </FaqFigure>
        </template>
      </FaqWay>

      <FaqWay :n="3" :title="$t('faq.content.veto.confirm_title')" stacked>
        <li>
          <i18n-t
            keypath="faq.content.veto.confirm_1"
            tag="span"
            scope="global"
          >
            <template #button
              ><FaqTerm>{{
                $t("match.veto_rewind.confirm")
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <li>{{ $t("faq.content.veto.confirm_2") }}</li>
        <template #figure>
          <FaqFigure :where="$t('faq.content.figures.veto')">
            <RewindBar
              :eyebrow="vetoBar.eyebrow"
              :headline="vetoBar.headline"
              :detail="vetoBar.detail"
              :confirm-label="$t('match.veto_rewind.confirm')"
              :footnote="$t('match.veto_rewind.footnote')"
              hot="confirm"
            />
          </FaqFigure>
        </template>
      </FaqWay>

      <FaqSub id="veto-why" />
      <p class="max-w-2xl text-sm leading-relaxed text-foreground/85">
        {{ $t("faq.content.veto.why_1") }}
      </p>
      <p class="max-w-2xl text-sm leading-relaxed text-foreground/85">
        {{ $t("faq.content.veto.why_2") }}
      </p>

      <FaqSub id="veto-more" />
      <ul
        class="flex max-w-2xl flex-col gap-2 text-sm leading-relaxed text-foreground/85"
      >
        <li>
          <i18n-t
            keypath="faq.content.veto.more_time"
            tag="span"
            scope="global"
          >
            <template #item
              ><FaqTerm>{{
                $t("match.fix_menu.time_title")
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <li>
          <i18n-t keypath="faq.content.veto.more_act" tag="span" scope="global">
            <template #item
              ><FaqTerm>{{
                $t("match.fix_menu.act_title", { team: i })
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <li>{{ $t("faq.content.veto.more_after") }}</li>
      </ul>
    </FaqSection>

    <FaqSection id="server">
      <ul
        class="flex max-w-2xl flex-col gap-2 text-sm leading-relaxed text-foreground/85"
      >
        <li>
          <i18n-t keypath="faq.content.server.reboot" tag="span" scope="global">
            <template #item
              ><FaqTerm>{{
                $t("match.recovery.fix.reboot_title")
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <li>{{ $t("faq.content.server.move") }}</li>
        <li>{{ $t("faq.content.server.crash") }}</li>
      </ul>
    </FaqSection>

    <FaqSection id="results">
      <ul
        class="flex max-w-2xl flex-col gap-2 text-sm leading-relaxed text-foreground/85"
      >
        <li>
          <i18n-t
            keypath="faq.content.results.winner"
            tag="span"
            scope="global"
          >
            <template #item
              ><FaqTerm>{{
                $t("match.recovery.fix.winner_title")
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <li>
          <i18n-t
            keypath="faq.content.results.forfeit"
            tag="span"
            scope="global"
          >
            <template #item
              ><FaqTerm>{{
                $t("match.recovery.fix.forfeit_title")
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <li>
          <i18n-t
            keypath="faq.content.results.reparse"
            tag="span"
            scope="global"
          >
            <template #item
              ><FaqTerm>{{
                $t("match.recovery.fix.reparse_title")
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
      </ul>
    </FaqSection>

    <FaqSection id="replay-match">
      <ul
        class="flex max-w-2xl flex-col gap-2 text-sm leading-relaxed text-foreground/85"
      >
        <li>
          <i18n-t
            keypath="faq.content.replay.restart"
            tag="span"
            scope="global"
          >
            <template #item
              ><FaqTerm>{{
                $t("match.recovery.fix.restart_title")
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <li>
          <i18n-t
            keypath="faq.content.replay.tournament"
            tag="span"
            scope="global"
          >
            <template #item
              ><FaqTerm>{{
                $t("match.recovery.fix.replay_title")
              }}</FaqTerm></template
            >
          </i18n-t>
        </li>
        <li>{{ $t("faq.content.replay.canceled") }}</li>
      </ul>
    </FaqSection>

    <FaqSection id="demo-match">
      <div class="flex flex-wrap items-center gap-4">
        <p class="max-w-xl flex-1 text-sm leading-relaxed text-foreground/85">
          {{ $t("faq.content.demo.body") }}
        </p>
        <NuxtLink
          to="/faq/demo-match"
          class="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] px-3 py-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.18)]"
        >
          {{ $t("faq.content.demo.open") }}
          <ArrowRight class="size-3.5" />
        </NuxtLink>
      </div>
    </FaqSection>

    <FaqPartHead id="tournaments" />

    <FaqSection id="t-join">
      <ul :class="bullets">
        <li><FaqText :text="$t('faq.content.tournament.join_1')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.join_2')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.join_3')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.join_4')" /></li>
      </ul>
    </FaqSection>

    <FaqSection id="t-roster">
      <ul :class="bullets">
        <li><FaqText :text="$t('faq.content.tournament.roster_1')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.roster_2')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.roster_3')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.roster_4')" /></li>
      </ul>
    </FaqSection>

    <FaqSection id="t-check-in">
      <ul :class="bullets">
        <li><FaqText :text="$t('faq.content.tournament.check_1')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.check_2')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.check_3')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.check_4')" /></li>
      </ul>
    </FaqSection>

    <FaqSection id="t-next-match">
      <ul :class="bullets">
        <li><FaqText :text="$t('faq.content.tournament.next_1')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.next_2')" /></li>
      </ul>
    </FaqSection>

    <FaqSection id="t-organizers">
      <ul :class="bullets">
        <li><FaqText :text="$t('faq.content.tournament.org_1')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.org_2')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.org_3')" /></li>
      </ul>
    </FaqSection>

    <FaqSection id="t-setup">
      <ul :class="bullets">
        <li><FaqText :text="$t('faq.content.tournament.setup_1')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.setup_2')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.setup_3')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.setup_4')" /></li>
      </ul>
    </FaqSection>

    <FaqSection id="t-start">
      <ul :class="bullets">
        <li><FaqText :text="$t('faq.content.tournament.start_1')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.start_2')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.start_3')" /></li>
      </ul>
    </FaqSection>

    <FaqSection id="t-scheduling">
      <ul :class="bullets">
        <li><FaqText :text="$t('faq.content.tournament.sched_1')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.sched_2')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.sched_3')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.sched_4')" /></li>
      </ul>
    </FaqSection>

    <FaqSection id="t-results">
      <ul :class="bullets">
        <li><FaqText :text="$t('faq.content.tournament.results_1')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.results_2')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.results_3')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.results_4')" /></li>
        <li><FaqText :text="$t('faq.content.tournament.results_5')" /></li>
      </ul>
    </FaqSection>

    <template v-for="part in qaParts" :key="part.id">
      <FaqPartHead :id="part.id" />
      <FaqSection
        v-for="section in part.sections"
        :id="section.id"
        :key="section.id"
      >
        <p class="max-w-3xl text-sm leading-relaxed text-foreground/85">
          {{ section.answer }}
        </p>
        <p
          v-if="section.id === 'call-support'"
          class="inline-flex w-fit items-center gap-2 rounded-md border border-border/70 bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground"
        >
          <MoreVertical class="size-3.5" />
          <span class="text-destructive">{{
            $t("match.actions.call_support")
          }}</span>
        </p>
        <div v-if="section.links?.length" class="flex flex-wrap gap-2">
          <a
            v-for="link in section.links"
            :key="link.href"
            :href="link.href"
            :target="link.href.startsWith('/') ? undefined : '_blank'"
            :rel="link.href.startsWith('/') ? undefined : 'noopener noreferrer'"
            :class="linkClasses"
          >
            {{ link.label }}
            <ArrowUpRight class="size-3" />
          </a>
        </div>
      </FaqSection>
    </template>
  </div>
</template>
