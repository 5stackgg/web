<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useMediaQuery, useResizeObserver } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { useSubscription } from "@vue/apollo-composable";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Lock,
  Play,
  Settings2,
  Signal,
  Globe,
  Network,
  Users,
  X,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "~/components/ui/sheet";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import PlayModeTile from "~/components/play/PlayModeTile.vue";
import PlaySeats from "~/components/play/PlaySeats.vue";
import QuickMatchConnect from "~/components/match/QuickMatchConnect.vue";
import MatchmakingSettings from "~/components/matchmaking/MatchmakingSettings.vue";
import { useQuickQueue } from "~/composables/useQuickQueue";
import { setActiveHub } from "~/composables/useHubState";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { TOURNAMENT_COOLDOWN_SUBSCRIPTION } from "~/graphql/tournamentCooldown";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, type e_match_types_enum } from "~/generated/zeus";
import { dateLocale } from "~/utilities/dateLocale";
import { loginLinks } from "~/utilities/loginLinks";
import { EXPECTED_PLAYERS } from "~/utilities/matchmakingPartySize";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  heroShape,
  heroState,
  roundedPing,
} from "~/components/play/matchmakingHero";

const { t } = useI18n();
const settings = useApplicationSettingsStore();
const auth = useAuthStore();
const matchmaking = useMatchmakingStore();
const { partySize, modes, queue, clock, modeTitle, join, leave } =
  useQuickQueue();
const { setRightSidebarOpen } = useRightSidebar();

const me = computed(() => auth.me);
const isGuest = computed(() => !me.value?.steam_id);
const party = computed(() => (isGuest.value ? 0 : partySize.value));

// The party itself lives in the header pill and the hub; here it is one line
// of context and who gets to press the button.
const lobby = computed(() => matchmaking.currentLobby as any);
const leader = computed(
  () => lobby.value?.players?.find((slot: any) => slot.captain)?.player,
);
const isMember = computed(
  () =>
    !!lobby.value &&
    !!leader.value &&
    String(leader.value.steam_id) !== String(me.value?.steam_id),
);

function expectedPlayers(type: e_match_types_enum) {
  return EXPECTED_PLAYERS[type] ?? 0;
}

function formatName(type: e_match_types_enum) {
  const perSide = expectedPlayers(type) / 2;
  return `${perSide}v${perSide}`;
}

// What the button queues: the tile the viewer picked if the party can still
// play it. Nothing is chosen for them unless only one mode fits.
const picked = ref<e_match_types_enum | null>(null);
const selectable = computed(() =>
  modes.value.filter((mode) => isGuest.value || mode.canQueue),
);
const selectedType = computed<e_match_types_enum | null>(() => {
  if (isMember.value) return null;
  const choice = selectable.value.find((mode) => mode.type === picked.value);
  if (choice) return choice.type;
  return selectable.value.length === 1 ? selectable.value[0].type : null;
});
// With nothing checked, Tab lands on the first mode it can pick, like a
// native radio set.
const tabStop = computed(
  () => selectedType.value ?? selectable.value[0]?.type ?? null,
);

const modeGrid = ref<HTMLElement | null>(null);

// One amber frame glides from tile to tile instead of each tile repainting its
// own border. It fades in where the first pick lands, keeps its last spot while
// fading out, and only glides between two picks (never on resize).
const frame = ref({ x: 0, y: 0, w: 0, h: 0 });
const frameShown = ref(false);
const frameGlides = ref(false);

function placeFrame(glide: boolean) {
  const index = modes.value.findIndex(
    (mode) => mode.type === selectedType.value,
  );
  const tile =
    index < 0
      ? null
      : modeGrid.value?.querySelectorAll<HTMLElement>('[role="radio"]')[index];
  if (!tile) {
    frameShown.value = false;
    return;
  }
  frameGlides.value = glide && frameShown.value;
  frame.value = {
    x: tile.offsetLeft,
    y: tile.offsetTop,
    w: tile.offsetWidth,
    h: tile.offsetHeight,
  };
  frameShown.value = true;
}

watch(selectedType, () => nextTick(() => placeFrame(true)));
onMounted(() => placeFrame(false));
useResizeObserver(modeGrid, () => placeFrame(false));

function pick(type: e_match_types_enum) {
  picked.value = type;
}

// Arrow keys move through the radio group, skipping modes the party can't
// play -- the same model as a native radio set.
function onModeKey(event: KeyboardEvent) {
  const forward = ["ArrowRight", "ArrowDown"].includes(event.key);
  const back = ["ArrowLeft", "ArrowUp"].includes(event.key);
  if ((!forward && !back) || isMember.value) return;
  event.preventDefault();
  const list = selectable.value;
  if (!list.length) return;
  const index = list.findIndex((mode) => mode.type === selectedType.value);
  const next =
    index < 0
      ? list[forward ? 0 : list.length - 1]
      : list[(index + (forward ? 1 : -1) + list.length) % list.length];
  pick(next.type);
  const position = modes.value.findIndex((mode) => mode.type === next.type);
  modeGrid.value
    ?.querySelectorAll<HTMLElement>('[role="radio"]')
    [position]?.focus();
}

// Regions: the ones a search would use, and the node-backed ones it skips
// (over the latency limit or unreachable), so the line explains itself.
type Region = { value: string; description?: string; is_lan?: boolean };

function regionName(region: Region) {
  return region.description || region.value;
}

const usedRegions = computed(() =>
  (matchmaking.preferredRegions as Region[]).map((region) => {
    const result = matchmaking.getRegionlatencyResult(region.value);
    return {
      value: region.value,
      name: regionName(region),
      ping: roundedPing(result?.latency),
    };
  }),
);

const skippedRegions = computed(() => {
  const used = new Set(usedRegions.value.map((region) => region.value));
  return (settings.availableRegions as any[])
    .filter(
      (region) => region.has_node && !region.is_lan && !used.has(region.value),
    )
    .map((region) => ({
      value: region.value,
      name: regionName(region),
      ping: roundedPing(
        matchmaking.getRegionlatencyResult(region.value)?.latency,
      ),
    }));
});

const noRegions = computed(
  () =>
    !isGuest.value &&
    (settings.availableRegions as any[]).some((region) => region.has_node) &&
    usedRegions.value.length === 0,
);

const maxLatency = computed(() => matchmaking.playerMaxAcceptableLatency);

// On a LAN the line is a switch: play there, or online (then the online
// regions follow it as usual). Never both.
const whereOptions = computed(() => {
  const lanPing = roundedPing(
    matchmaking.getRegionlatencyResult(matchmaking.lanRegions[0]?.value)
      ?.latency,
  );
  return [
    {
      value: "lan" as const,
      label: t("matchmaking.where.lan"),
      icon: Network,
      detail:
        lanPing === null
          ? null
          : t("pages.play.matchmaking.regions.ms", { ms: lanPing }),
      active: matchmaking.playWhere === "lan",
    },
    {
      value: "online" as const,
      label: t("matchmaking.where.online"),
      icon: Globe,
      detail:
        matchmaking.playWhere === "online"
          ? usedRegions.value
              .map((region) =>
                region.ping === null
                  ? region.name
                  : `${region.name} ${t("pages.play.matchmaking.regions.ms", { ms: region.ping })}`,
              )
              .join(" · ")
          : null,
      active: matchmaking.playWhere === "online",
    },
  ];
});
const whereOptionClasses =
  "inline-flex h-full min-w-0 items-center gap-1.5 rounded-sm px-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]";

// Sanctions. A tournament cooldown never blocks the queue, so it is reported
// beside the picker rather than in place of it.
function formatExpiry(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(dateLocale(), {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const { result: tournamentCooldownResult } = useSubscription(
  TOURNAMENT_COOLDOWN_SUBSCRIPTION,
  () => ({ steamId: me.value?.steam_id }),
  () => ({ enabled: !!me.value?.steam_id, context: { optional: true } }),
);

const tournamentCooldown = computed(
  () =>
    (tournamentCooldownResult.value as Record<string, any> | undefined)
      ?.players_by_pk?.tournament_cooldown,
);

const tournamentCooldownText = computed(() => {
  const value = tournamentCooldown.value;
  if (!value) return null;
  const time = String(value) === "infinity" ? "" : formatExpiry(value);
  return time
    ? t("matchmaking.tournament_banned_until", { time })
    : t("matchmaking.tournament_banned");
});

const sanctionText = computed(() => {
  if (me.value?.is_banned) {
    return me.value.banned_until
      ? t("matchmaking.banned_until", {
          time: formatExpiry(me.value.banned_until),
        })
      : t("matchmaking.banned");
  }
  if (me.value?.matchmaking_cooldown) {
    const time = formatExpiry(me.value.matchmaking_cooldown);
    return time
      ? t("matchmaking.temp_banned_until", { time })
      : t("matchmaking.temp_banned");
  }
  return null;
});

// The ready check is the global modal (MatchmakingConfirm); once its match is
// created the hero shows that match with its connect panel.
const confirmation = computed(
  () => (matchmaking.joinedMatchmakingQueues as any)?.confirmation,
);

const matchSubscription = typedGql("subscription")({
  matches_by_pk: [
    { id: $("matchId", "uuid!") },
    {
      id: true,
      status: true,
      server_id: true,
      server_type: true,
      server_error: true,
      is_in_lineup: true,
      is_organizer: true,
      is_server_online: true,
      connection_string: true,
      connection_link: true,
      tv_connection_string: true,
      options: { tv_delay: true, camera_required: true },
      e_match_status: { description: true },
      lineup_1: { name: true },
      lineup_2: { name: true },
      match_maps: [
        {},
        {
          is_current_map: true,
          lineup_1_score: true,
          lineup_2_score: true,
          map: { name: true, label: true },
        },
      ],
    },
  ],
});

const { result: matchResult } = useSubscription(
  matchSubscription,
  () => ({ matchId: confirmation.value?.matchId }),
  () => ({ enabled: !!confirmation.value?.matchId }),
);

const match = computed(() => (matchResult.value as any)?.matches_by_pk ?? null);
const currentMap = computed(
  () =>
    match.value?.match_maps?.find((map: any) => map.is_current_map) ??
    match.value?.match_maps?.[0],
);

const state = computed(() =>
  heroState({
    matchmakingAllowed: settings.matchmakingAllowed,
    matchmakingEnabled: settings.matchmakingEnabled,
    isGuest: isGuest.value,
    isBanned: !!me.value?.is_banned,
    hasCooldown: !!me.value?.matchmaking_cooldown,
    hasConfirmation: !!confirmation.value,
    hasMatch: !!confirmation.value?.matchId && !!match.value,
    isSearching: !!queue.value,
    noRegions: noRegions.value,
    isMember: isMember.value,
  }),
);
const shape = computed(() => heroShape(state.value));

// The search: the mode it's for, where, and how many are waiting with you.
const searchType = computed(
  () =>
    (queue.value?.type ??
      confirmation.value?.type ??
      selectedType.value) as e_match_types_enum | null,
);
const searchRegions = computed(() => {
  const values: string[] = queue.value?.regions ?? [];
  const byValue = new Map(
    (settings.availableRegions as Region[]).map((region) => [
      region.value,
      regionName(region),
    ]),
  );
  return values.map((value) => byValue.get(value) ?? value);
});
const searchInQueue = computed(
  () =>
    modes.value.find((mode) => mode.type === searchType.value)?.inQueue ?? 0,
);

const canControl = computed(() => !isMember.value);

const playersOnline = computed(
  () => (matchmaking.playersOnline as unknown[]).length,
);

function openParty() {
  setActiveHub("lobby");
  setRightSidebarOpen(true);
}

function signIn() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}

function findMatch(event: MouseEvent) {
  if (isGuest.value) {
    signIn();
    return;
  }
  if (selectedType.value) join(selectedType.value, event.currentTarget);
}

const settingsOpen = ref(false);
// Too tall for a popover on a phone (it flips up and clips): a sheet there.
const isPhone = useMediaQuery("(max-width: 767px)");

const primaryClasses =
  "h-11 min-w-[188px] gap-2 px-[22px] text-[15px] font-semibold bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)] max-sm:min-w-0 max-sm:flex-1";
const linkClasses =
  "relative inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted-foreground underline decoration-muted-foreground/40 underline-offset-[3px] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] after:absolute after:-inset-y-3 after:inset-x-0 after:content-[''] [@media(pointer:fine)]:after:hidden";
</script>

<template>
  <section
    v-if="state !== 'hidden'"
    aria-labelledby="play-matchmaking-label"
    class="rounded-lg border border-border bg-[linear-gradient(180deg,hsl(var(--muted)/0.22),hsl(var(--muted)/0.06))]"
  >
    <div
      class="flex items-center justify-between gap-3 px-[18px] pt-4 max-sm:px-3.5 max-sm:pt-3.5"
    >
      <h2
        id="play-matchmaking-label"
        :class="[tacticalSectionLabelClasses, '!mb-0']"
      >
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("pages.play.matchmaking.label") }}
      </h2>
      <div class="flex items-center gap-3">
        <span
          v-if="!isGuest && playersOnline > 0"
          class="inline-flex items-center gap-2 text-[12.5px] text-muted-foreground"
        >
          <span class="size-2 rounded-full bg-success"></span>
          <span>
            <b class="font-semibold tabular-nums text-foreground">{{
              playersOnline
            }}</b>
            {{ $t("pages.play.matchmaking.players_online", playersOnline) }}
          </span>
        </span>
      </div>
    </div>

    <HeightSwap>
      <!-- The picker: idle, guest, party member, and every sanction or
           region problem are the same tiles with a different footer. -->
      <div
        v-if="shape === 'picker'"
        key="picker"
        class="px-[18px] pb-[18px] pt-3.5 max-sm:px-3.5 max-sm:pb-3.5 max-sm:pt-3"
      >
        <Fold :open="!!tournamentCooldownText && state !== 'guest'">
          <p
            class="mb-3 flex items-start gap-2 text-[13px] text-muted-foreground"
          >
            <AlertTriangle class="mt-0.5 size-4 shrink-0" />
            {{ tournamentCooldownText }}
          </p>
        </Fold>

        <Fold
          :open="
            state === 'banned' || state === 'cooldown' || state === 'no-region'
          "
        >
          <div
            class="mb-3.5 flex items-start gap-3 rounded-lg border border-destructive/35 bg-destructive/[0.06] px-3.5 py-3"
          >
            <component
              :is="state === 'cooldown' ? Clock : AlertTriangle"
              class="mt-0.5 size-4 shrink-0 text-destructive"
            />
            <div class="grid gap-0.5 text-[13px]">
              <template v-if="state === 'no-region'">
                <b class="text-sm font-bold">{{
                  $t("pages.play.matchmaking.no_region.title", {
                    ms: maxLatency,
                  })
                }}</b>
                <span class="text-foreground/80">{{
                  $t("pages.play.matchmaking.no_region.body")
                }}</span>
              </template>
              <b v-else class="text-sm font-semibold">{{ sanctionText }}</b>
            </div>
          </div>
        </Fold>

        <div
          ref="modeGrid"
          role="radiogroup"
          :aria-label="$t('pages.play.matchmaking.mode_group')"
          class="relative grid gap-3 max-sm:gap-2"
          :class="[
            'grid-cols-2',
            modes.length >= 4
              ? 'xl:grid-cols-4'
              : modes.length === 3
                ? 'xl:grid-cols-3'
                : '',
            modes.length % 2 === 1 &&
              'max-xl:[&>button:last-of-type]:col-span-2',
          ]"
          @keydown="onModeKey"
        >
          <PlayModeTile
            v-for="mode in modes"
            :key="mode.type"
            :title="modeTitle(mode.type)"
            :description="
              $t(
                `matchmaking.match_types.${mode.type.toLowerCase()}.description`,
              )
            "
            :expected="mode.expected"
            :in-queue="isGuest ? null : mode.inQueue"
            :party="party"
            :can-queue="mode.canQueue"
            :selected="mode.type === selectedType"
            :tab-stop="mode.type === tabStop"
            :locked="isMember"
            @select="pick(mode.type)"
          />
          <span
            aria-hidden="true"
            class="pointer-events-none absolute left-0 top-0 z-10 rounded-lg shadow-[inset_0_0_0_2px_hsl(var(--tac-amber))] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
            :class="[
              frameShown ? 'opacity-100' : 'opacity-0',
              frameGlides
                ? 'transition-[transform,width,height,opacity]'
                : 'transition-opacity',
            ]"
            :style="{
              transform: `translate3d(${frame.x}px, ${frame.y}px, 0)`,
              width: `${frame.w}px`,
              height: `${frame.h}px`,
            }"
          ></span>
        </div>

        <div
          class="mt-4 flex items-center justify-between gap-x-6 gap-y-3.5 border-t border-border/70 pt-4 max-lg:flex-col max-lg:items-stretch max-sm:contents"
        >
          <div
            class="grid min-w-0 gap-[7px] max-sm:mt-3.5 max-sm:gap-1.5 max-sm:border-t max-sm:border-border/70 max-sm:pt-3"
          >
            <p
              v-if="isGuest"
              class="m-0 text-[13px] text-foreground/85 max-sm:text-[12.5px]"
            >
              {{ $t("pages.play.matchmaking.guest_line") }}
            </p>
            <template v-else>
              <div
                class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-foreground/90 max-sm:text-[12.5px]"
              >
                <!-- One input group: where you play (or the regions a search
                     uses), with the matchmaking settings appended to it. -->
                <div
                  class="inline-flex h-8 min-w-0 max-w-full items-stretch overflow-hidden rounded-md border border-border bg-white/[0.025]"
                >
                  <div
                    v-if="matchmaking.onLan"
                    role="group"
                    :aria-label="$t('matchmaking.where.label')"
                    class="flex min-w-0 items-stretch gap-0.5 p-[3px]"
                  >
                    <button
                      v-for="option in whereOptions"
                      :key="option.value"
                      type="button"
                      :aria-pressed="option.active"
                      :class="[
                        whereOptionClasses,
                        option.active
                          ? 'bg-[hsl(var(--tac-amber)/0.16)] text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      ]"
                      @click="matchmaking.setPlayWhere(option.value)"
                    >
                      <component
                        :is="option.icon"
                        class="size-3.5 shrink-0"
                        :class="option.active && 'text-[hsl(var(--tac-amber))]'"
                      />
                      {{ option.label }}
                      <span
                        v-if="option.detail"
                        class="min-w-0 truncate font-normal tabular-nums text-muted-foreground"
                        >{{ option.detail }}</span
                      >
                    </button>
                  </div>
                  <span v-else class="flex min-w-0 items-center gap-2 px-2.5">
                    <Signal class="size-3.5 shrink-0 text-muted-foreground" />
                    <span class="min-w-0 truncate">
                      <template
                        v-for="(region, index) in usedRegions"
                        :key="region.value"
                      >
                        <span v-if="index" class="text-muted-foreground/55">
                          ·
                        </span>
                        <b class="font-semibold">{{ region.name }}</b>
                        <span
                          v-if="region.ping !== null"
                          class="ml-1 tabular-nums text-foreground/75"
                          >{{
                            $t("pages.play.matchmaking.regions.ms", {
                              ms: region.ping,
                            })
                          }}</span
                        >
                      </template>
                      <template
                        v-for="(region, index) in skippedRegions"
                        :key="region.value"
                      >
                        <span
                          v-if="index || usedRegions.length"
                          class="text-muted-foreground/55"
                        >
                          ·
                        </span>
                        <span class="text-muted-foreground">{{
                          region.ping === null
                            ? $t("pages.play.matchmaking.regions.unreachable", {
                                name: region.name,
                              })
                            : $t("pages.play.matchmaking.regions.skipped", {
                                name: region.name,
                                ms: region.ping,
                              })
                        }}</span>
                      </template>
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    class="my-1.5 w-px shrink-0 bg-border"
                  ></span>
                  <Popover
                    :open="settingsOpen && !isPhone"
                    @update:open="(open) => (settingsOpen = open)"
                  >
                    <PopoverTrigger as-child>
                      <button
                        type="button"
                        class="grid w-8 shrink-0 place-items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--tac-amber))]"
                        :class="
                          settingsOpen
                            ? 'bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        "
                        :aria-label="$t('pages.play.matchmaking.settings')"
                      >
                        <Settings2 class="size-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      class="w-[min(92vw,520px)] p-4"
                    >
                      <MatchmakingSettings />
                    </PopoverContent>
                  </Popover>
                </div>
                <Sheet
                  :open="settingsOpen && isPhone"
                  @update:open="(open) => (settingsOpen = open)"
                >
                  <SheetContent
                    side="bottom"
                    class="max-h-[85dvh] overflow-y-auto rounded-t-xl pb-8"
                  >
                    <SheetTitle class="mb-4 text-base">{{
                      $t("pages.play.matchmaking.settings")
                    }}</SheetTitle>
                    <SheetDescription class="sr-only">{{
                      $t("pages.play.matchmaking.settings")
                    }}</SheetDescription>
                    <MatchmakingSettings />
                  </SheetContent>
                </Sheet>
              </div>

              <div
                class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-foreground/90 max-sm:text-[12.5px]"
              >
                <Users
                  class="size-3.5 shrink-0 self-center text-muted-foreground"
                />
                <template v-if="isMember">
                  <span>{{
                    $t("pages.play.matchmaking.party.member", {
                      name: leader?.name,
                      count: party,
                    })
                  }}</span>
                  <span class="text-muted-foreground/55">·</span>
                  <span>{{
                    $t("layouts.party_room.leader_picks", {
                      name: leader?.name,
                    })
                  }}</span>
                </template>
                <template v-else-if="party > 1">
                  <span>{{
                    $t("pages.play.matchmaking.party.leader", { count: party })
                  }}</span>
                  <span class="text-muted-foreground/55">·</span>
                  <span>{{ $t("pages.play.matchmaking.party.you_lead") }}</span>
                </template>
                <span v-else>{{
                  $t("pages.play.matchmaking.queue_solo")
                }}</span>
                <span class="text-muted-foreground/55">·</span>
                <button type="button" :class="linkClasses" @click="openParty">
                  {{
                    party > 1 || isMember
                      ? $t("pages.play.matchmaking.party.open")
                      : $t("pages.play.matchmaking.party.invite")
                  }}
                </button>
              </div>
            </template>
          </div>

          <!-- On phones only the action sticks to the bottom: the footer
               dissolves (display: contents) so this sticks within the whole
               hero rather than its own row. -->
          <div
            class="flex shrink-0 items-center gap-3.5 max-lg:justify-between max-sm:sticky max-sm:bottom-[env(safe-area-inset-bottom,0px)] max-sm:z-10 max-sm:-mx-3.5 max-sm:-mb-3.5 max-sm:mt-3 max-sm:rounded-b-lg max-sm:bg-[linear-gradient(180deg,hsl(var(--background)/0.94),hsl(var(--background)/0.99))] max-sm:px-3.5 max-sm:py-3"
          >
            <div
              v-if="selectedType && state !== 'guest'"
              class="grid justify-items-end gap-px text-right max-lg:justify-items-start max-lg:text-left max-sm:hidden"
            >
              <b class="text-sm font-bold">
                {{ modeTitle(selectedType) }} · {{ formatName(selectedType) }}
              </b>
              <span class="text-xs text-muted-foreground">
                {{
                  isMember
                    ? $t("pages.play.matchmaking.starts_queue", {
                        name: leader?.name,
                      })
                    : $t(
                        "pages.play.matchmaking.regions.count",
                        usedRegions.length,
                      )
                }}
              </span>
            </div>

            <Button
              v-if="state === 'guest'"
              :class="primaryClasses"
              @click="signIn"
            >
              <SteamIcon class="size-4" />
              {{ $t("pages.play.matchmaking.sign_in") }}
            </Button>
            <Button
              v-else-if="state === 'no-region'"
              :class="primaryClasses"
              @click="settingsOpen = true"
            >
              <Signal class="size-4" />
              {{ $t("pages.play.matchmaking.regions.edit") }}
            </Button>
            <Button
              v-else-if="state === 'member'"
              variant="outline"
              :class="[
                primaryClasses,
                '!bg-transparent !text-muted-foreground',
              ]"
              disabled
            >
              <Lock class="size-4" />
              {{
                $t("pages.play.matchmaking.waiting_for", { name: leader?.name })
              }}
            </Button>
            <Button
              v-else
              :class="primaryClasses"
              :disabled="state !== 'idle' || !selectedType"
              @click="findMatch"
            >
              <Play class="size-4 fill-current" />
              {{
                matchmaking.onLan && matchmaking.playWhere === "lan"
                  ? $t("pages.play.matchmaking.find_lan_match")
                  : $t("pages.play.matchmaking.find_match")
              }}
            </Button>
          </div>
        </div>
      </div>

      <!-- Searching, and the ready check open over it. -->
      <div
        v-else-if="shape === 'search'"
        key="search"
        class="px-[18px] pb-[18px] pt-3.5 max-sm:px-3.5 max-sm:pb-3.5 max-sm:pt-3"
      >
        <div
          class="grid grid-cols-[200px_minmax(0,1fr)_auto] items-center gap-[22px] max-lg:grid-cols-[140px_minmax(0,1fr)] max-sm:grid-cols-1 max-sm:gap-3.5"
        >
          <div
            v-if="searchType"
            class="grid content-center gap-3 rounded-lg border border-border bg-muted/20 p-4 max-sm:hidden"
          >
            <span class="flex items-center gap-3.5">
              <span
                aria-hidden="true"
                class="text-[30px] font-bold leading-none tabular-nums text-foreground/90"
                >{{ expectedPlayers(searchType) / 2
                }}<i
                  class="mx-[0.14em] align-[0.3em] text-[0.5em] font-semibold not-italic text-muted-foreground"
                  >v</i
                >{{ expectedPlayers(searchType) / 2 }}</span
              >
              <PlaySeats
                :expected="expectedPlayers(searchType)"
                :party="party"
              />
            </span>
            <b class="text-[15px] font-bold">{{ modeTitle(searchType) }}</b>
          </div>

          <div class="grid min-w-0 gap-1">
            <div
              class="text-[46px] font-bold leading-none tabular-nums max-sm:text-[40px]"
              role="timer"
              :aria-label="$t('pages.play.matchmaking.clock')"
            >
              {{ clock ?? "0:00" }}
            </div>
            <div v-if="searchType" class="text-[17px] font-bold">
              {{
                $t("pages.play.matchmaking.searching", {
                  mode: modeTitle(searchType),
                })
              }}
            </div>
            <div class="text-[13px] text-foreground/80">
              <template v-for="(name, index) in searchRegions" :key="name">
                <span v-if="index" class="text-muted-foreground/55"> · </span
                >{{ name }}
              </template>
              <span
                v-if="searchRegions.length"
                class="text-muted-foreground/55"
              >
                ·
              </span>
              {{
                searchInQueue > 0
                  ? $t("layouts.queue.in_queue", { count: searchInQueue })
                  : $t("pages.play.matchmaking.first_in_line")
              }}
            </div>
            <div
              v-if="state === 'found'"
              class="mt-0.5 flex items-center gap-2 text-[13px] font-semibold text-[hsl(var(--tac-amber))]"
            >
              <span
                class="size-2 rounded-full bg-[hsl(var(--tac-amber))]"
              ></span>
              {{ $t("pages.play.matchmaking.found") }}
            </div>
            <div v-else class="text-[12.5px] text-muted-foreground">
              <template v-if="isMember">
                {{
                  $t("pages.play.matchmaking.party.member", {
                    name: leader?.name,
                    count: party,
                  })
                }}
              </template>
              <template v-else-if="party > 1">
                {{
                  $t("pages.play.matchmaking.party.leader", { count: party })
                }}
                · {{ $t("pages.play.matchmaking.party.you_lead") }}
              </template>
              <template v-else>
                {{ $t("pages.play.matchmaking.party.solo") }}
              </template>
            </div>
          </div>

          <div
            v-if="state === 'searching'"
            class="flex items-center gap-2.5 max-lg:col-span-full"
          >
            <Button
              v-if="canControl"
              variant="outline"
              class="relative h-8 gap-1.5 after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] [@media(pointer:fine)]:after:hidden"
              @click="leave"
            >
              <X class="size-4" />
              {{ $t("pages.play.matchmaking.cancel") }}
            </Button>
            <span v-else class="text-[12.5px] text-muted-foreground">
              {{
                $t("pages.play.matchmaking.leader_cancels", {
                  name: leader?.name,
                })
              }}
            </span>
          </div>
        </div>
      </div>

      <!-- In the match the ready check produced. -->
      <div
        v-else
        key="match"
        class="px-[18px] pb-[18px] pt-3.5 max-sm:px-3.5 max-sm:pb-3.5 max-sm:pt-3"
      >
        <div
          class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-[22px] gap-y-4 max-sm:grid-cols-1"
        >
          <div class="grid min-w-0 gap-2">
            <div class="flex items-center gap-2 text-[13px] font-semibold">
              <span class="relative inline-flex size-2 shrink-0">
                <span
                  class="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
                ></span>
                <span
                  class="relative inline-flex size-2 rounded-full bg-destructive"
                ></span>
              </span>
              {{ match?.e_match_status?.description ?? match?.status }}
              <span class="font-normal text-foreground/80">
                <template v-if="searchType">
                  · {{ modeTitle(searchType) }}
                </template>
                <template v-if="currentMap">
                  · {{ currentMap.map?.label || currentMap.map?.name }}
                </template>
              </span>
            </div>
            <div class="grid max-w-md gap-1">
              <div
                class="flex items-center justify-between gap-3 text-[17px] font-bold"
              >
                <span class="truncate">{{ match?.lineup_1?.name }}</span>
                <span class="tabular-nums">{{
                  currentMap?.lineup_1_score ?? 0
                }}</span>
              </div>
              <div
                class="flex items-center justify-between gap-3 text-[17px] font-bold text-foreground/70"
              >
                <span class="truncate">{{ match?.lineup_2?.name }}</span>
                <span class="tabular-nums">{{
                  currentMap?.lineup_2_score ?? 0
                }}</span>
              </div>
            </div>
          </div>
          <Button
            as-child
            variant="outline"
            class="h-11 gap-2 px-[22px] text-[15px] max-sm:w-full"
          >
            <NuxtLink
              v-if="match"
              :to="{ name: 'matches-id', params: { id: match.id } }"
            >
              {{ $t("layouts.party_room.open_match") }}
              <ArrowRight class="size-4" />
            </NuxtLink>
          </Button>
          <div v-if="match" class="col-span-full">
            <QuickMatchConnect :match="match" />
          </div>
        </div>
      </div>
    </HeightSwap>
  </section>
</template>
