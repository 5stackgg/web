<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowDown } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TimezoneFlag from "~/components/TimezoneFlag.vue";
import StatChevron from "~/components/StatChevron.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import LeaderboardYouTag from "~/components/leaderboard/LeaderboardYouTag.vue";
import {
  AWARD_COLORS,
  LEADERBOARD_CATEGORIES,
  PLACE_COLORS,
  formatLeaderboardField,
  formatLeaderboardValue,
  leaderboardFieldColor,
  leaderboardFieldTier,
  type LeaderboardEntry,
} from "~/utilities/leaderboard";

const props = defineProps<{
  category: string;
  entries: LeaderboardEntry[];
  // #1's value, for the distance bars on pages after the first.
  leaderValue: number | null;
  selectedSteamId: string | null;
  meSteamId: string | null;
  highlightedSteamId: string | null;
}>();

const emit = defineEmits<{ select: [entry: LeaderboardEntry] }>();

const { t } = useI18n();

const config = computed(() => LEADERBOARD_CATEGORIES[props.category]);
const isAwards = computed(() => props.category === "awards");
const firstPage = computed(() => props.entries[0]?.rank === 1);

// Second, first, third: the leader stands in the middle.
const podium = computed(() => {
  if (!firstPage.value) return [];
  const [first, second, third] = props.entries;
  return [
    { place: 2, entry: second ?? null },
    { place: 1, entry: first },
    { place: 3, entry: third ?? null },
  ];
});
const rows = computed(() =>
  firstPage.value ? props.entries.slice(3) : props.entries,
);

const MEDALS = [
  { field: "value", color: AWARD_COLORS.gold },
  { field: "secondary_value", color: AWARD_COLORS.silver },
  { field: "tertiary_value", color: AWARD_COLORS.bronze },
] as const;

const lead = computed(() =>
  firstPage.value ? (props.entries[0]?.value ?? null) : props.leaderValue,
);

function distance(entry: LeaderboardEntry) {
  const base = config.value?.base ?? 0;
  const top = lead.value;
  if (top == null || top <= base) return 100;
  return Math.max(
    2,
    Math.min(100, ((entry.value - base) / (top - base)) * 100),
  );
}

const secondaryLabel = computed(() => {
  const key = config.value?.columns.secondary_value;
  return !isAwards.value && key ? t(key) : "";
});

function secondaryText(entry: LeaderboardEntry) {
  if (!secondaryLabel.value) return "";
  if (props.category === "faceit_elo") {
    return `${t("pages.leaderboard.col.faceit_level")} ${entry.secondary_value ?? "—"}`;
  }
  return formatLeaderboardField(
    props.category,
    "secondary_value",
    entry.secondary_value,
  );
}

function podiumMeta(entry: LeaderboardEntry) {
  const parts: string[] = [];
  if (props.category === "elo") {
    parts.push(
      `${formatLeaderboardField("elo", "secondary_value", entry.secondary_value)} ${t("pages.leaderboard.categories.elo")}`,
    );
  } else if (secondaryLabel.value) {
    parts.push(
      props.category === "faceit_elo"
        ? secondaryText(entry)
        : `${secondaryLabel.value} ${secondaryText(entry)}`,
    );
  }
  if (
    config.value?.columns.matches_played &&
    entry.matches_played != null &&
    !isAwards.value
  ) {
    parts.push(t("pages.leaderboard.matches_count", entry.matches_played));
  }
  return parts.join(" · ");
}

function playerOf(entry: LeaderboardEntry) {
  return {
    steam_id: entry.player_steam_id,
    name: entry.player_name,
    avatar_url: entry.player_avatar_url,
    custom_avatar_url: entry.player_custom_avatar_url,
    country: entry.player_country,
  };
}

function onKey(event: KeyboardEvent, entry: LeaderboardEntry) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    emit("select", entry);
  }
}
</script>

<template>
  <div class="lb-board">
    <div v-if="podium.length" class="lb-podium">
      <template v-for="slot in podium" :key="slot.place">
        <div
          v-if="slot.entry"
          role="button"
          tabindex="0"
          class="lb-pod"
          :class="{
            'lb-pod--first': slot.place === 1,
            'lb-pod--me': slot.entry.player_steam_id === meSteamId,
            'lb-pod--highlight':
              slot.entry.player_steam_id === highlightedSteamId,
          }"
          :style="{ '--medal': PLACE_COLORS[slot.place - 1] }"
          :aria-current="
            slot.entry.player_steam_id === selectedSteamId ? 'true' : undefined
          "
          :data-steam-id="slot.entry.player_steam_id"
          @click="emit('select', slot.entry)"
          @keydown="onKey($event, slot.entry)"
        >
          <span class="lb-pod-place">{{ slot.place }}</span>
          <PlayerDisplay
            :player="playerOf(slot.entry)"
            :show-name="false"
            :show-flag="false"
            :show-role="false"
            :show-elo="false"
            :show-online="false"
            class="min-h-0"
          />
          <span class="lb-pod-who">
            <TimezoneFlag :country="slot.entry.player_country ?? undefined" />
            <span class="truncate">{{ slot.entry.player_name }}</span>
          </span>
          <span v-if="isAwards" class="lb-medals">
            <span
              v-for="medal in MEDALS"
              :key="medal.field"
              :class="!slot.entry[medal.field] && 'opacity-35'"
              :style="{ color: medal.color }"
            >
              <i :style="{ background: medal.color }"></i
              >{{ slot.entry[medal.field] ?? 0 }}
            </span>
          </span>
          <span
            v-else
            class="lb-pod-value"
            :style="{
              color: leaderboardFieldColor(category, 'value', slot.entry.value),
            }"
            >{{ formatLeaderboardValue(category, slot.entry.value) }}</span
          >
          <span
            v-if="isAwards"
            class="lb-pod-meta"
            :style="{ color: AWARD_COLORS.mvp }"
            >{{ $t("pages.leaderboard.col.mvp") }}
            {{ slot.entry.matches_played ?? 0 }}</span
          >
          <span v-else-if="podiumMeta(slot.entry)" class="lb-pod-meta">{{
            podiumMeta(slot.entry)
          }}</span>
        </div>
        <div
          v-else
          class="lb-pod lb-pod--empty"
          :style="{ '--medal': PLACE_COLORS[slot.place - 1] }"
        >
          {{ $t("pages.leaderboard.podium_empty") }}
        </div>
      </template>
    </div>

    <div
      v-if="rows.length"
      class="lb-rows"
      :class="podium.length ? 'mt-3.5' : ''"
    >
      <div class="lb-row lb-row--head" aria-hidden="true">
        <span class="text-center">{{
          $t("pages.leaderboard.columns.rank")
        }}</span>
        <span>{{ $t("common.player") }}</span>
        <span>{{
          isAwards
            ? $t("pages.leaderboard.medals")
            : $t("pages.leaderboard.distance_to_first")
        }}</span>
        <span
          class="inline-flex items-center justify-end gap-1 whitespace-nowrap text-foreground"
        >
          <template v-if="isAwards">{{
            $t("pages.leaderboard.col.mvp")
          }}</template>
          <StatLabel
            v-else-if="config?.glossary?.value"
            :stat="config.glossary.value"
            :label="$t(config.columns.value)"
            header
          />
          <template v-else>{{ $t(config.columns.value) }}</template>
          <ArrowDown class="size-3.5 text-[hsl(var(--tac-amber))]" />
        </span>
        <span class="lb-row-sec">{{ secondaryLabel }}</span>
      </div>
      <div
        v-for="(entry, index) in rows"
        :key="entry.player_steam_id"
        role="button"
        tabindex="0"
        class="lb-row"
        :class="{
          'lb-row--me': entry.player_steam_id === meSteamId,
          'lb-row--highlight': entry.player_steam_id === highlightedSteamId,
        }"
        :aria-current="
          entry.player_steam_id === selectedSteamId ? 'true' : undefined
        "
        :data-steam-id="entry.player_steam_id"
        @click="emit('select', entry)"
        @keydown="onKey($event, entry)"
      >
        <span
          class="lb-row-rank"
          :class="entry.rank > 3 && 'text-muted-foreground'"
          :style="{ color: PLACE_COLORS[entry.rank - 1] }"
          >{{ entry.rank }}</span
        >
        <PlayerDisplay
          class="min-w-0"
          :player="playerOf(entry)"
          :show-elo="false"
          :show-online="false"
          :show-role="false"
          truncate-name
          size="xs"
        >
          <template #name-postfix>
            <LeaderboardYouTag v-if="entry.player_steam_id === meSteamId" />
          </template>
        </PlayerDisplay>
        <span v-if="isAwards" class="lb-medals lb-row-track">
          <span
            v-for="medal in MEDALS"
            :key="medal.field"
            :class="!entry[medal.field] && 'opacity-35'"
            :style="{ color: medal.color }"
          >
            <i :style="{ background: medal.color }"></i
            >{{ entry[medal.field] ?? 0 }}
          </span>
        </span>
        <span v-else class="lb-track lb-row-track" aria-hidden="true">
          <i
            :style="{
              width: `${distance(entry).toFixed(1)}%`,
              background: leaderboardFieldColor(category, 'value', entry.value),
              animationDelay: `${index * 18}ms`,
            }"
          ></i>
        </span>
        <span
          class="lb-row-value"
          :style="{
            color: isAwards
              ? AWARD_COLORS.mvp
              : leaderboardFieldColor(category, 'value', entry.value),
          }"
        >
          <template v-if="isAwards">{{ entry.matches_played ?? 0 }}</template>
          <template v-else>
            {{ formatLeaderboardValue(category, entry.value) }}
            <StatChevron
              v-if="leaderboardFieldTier(category, 'value')"
              :cfg="leaderboardFieldTier(category, 'value')"
              :value="entry.value"
            />
          </template>
        </span>
        <span class="lb-row-sec">{{ secondaryText(entry) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lb-board {
  container: lb-board / inline-size;
}

.lb-podium {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
  gap: 0.75rem;
}
.lb-pod {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.375rem;
  min-width: 0;
  padding: 1.125rem 0.875rem 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  background:
    radial-gradient(
      120% 70% at 50% 0%,
      color-mix(in srgb, var(--medal) 9%, transparent),
      transparent 70%
    ),
    hsl(var(--card));
  text-align: center;
  cursor: pointer;
  transition:
    border-color 150ms ease-out,
    box-shadow 150ms ease-out;
}
.lb-pod--first {
  padding-top: 2.125rem;
  border-color: color-mix(in srgb, var(--medal) 32%, hsl(var(--border)));
}
.lb-pod--me {
  box-shadow: inset 0 0 0 1px hsl(var(--tac-amber) / 0.4);
}
.lb-pod[aria-current="true"] {
  border-color: hsl(var(--foreground) / 0.45);
}
.lb-pod--me[aria-current="true"] {
  border-color: hsl(var(--tac-amber));
}
.lb-pod--highlight {
  border-color: hsl(var(--tac-amber));
  box-shadow: inset 0 0 0 1px hsl(var(--tac-amber) / 0.45);
}
.lb-pod--empty {
  min-height: 9.375rem;
  place-content: center;
  border-style: dashed;
  background: transparent;
  color: hsl(var(--muted-foreground) / 0.7);
  font-size: 0.75rem;
  cursor: default;
}
@media (hover: hover) and (pointer: fine) {
  .lb-pod:not(.lb-pod--empty):not([aria-current="true"]):hover {
    border-color: hsl(var(--foreground) / 0.25);
  }
}
.lb-pod:focus-visible,
.lb-row:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
.lb-pod-place {
  position: absolute;
  top: 0.625rem;
  left: 0.75rem;
  color: var(--medal);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.lb-pod-who {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  max-width: 100%;
  margin-top: 0.25rem;
  font-weight: 600;
}
.lb-pod-value {
  @apply font-mono;
  font-size: 1.625rem;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.lb-pod--first .lb-pod-value {
  font-size: 2rem;
}
.lb-pod-meta {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  font-variant-numeric: tabular-nums;
}

.lb-medals {
  display: inline-flex;
  gap: 0.625rem;
  @apply font-mono;
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.lb-medals > span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.lb-medals i {
  width: 0.4375rem;
  height: 0.4375rem;
  border-radius: 9999px;
}

.lb-row {
  display: grid;
  grid-template-columns:
    2.75rem minmax(9.5rem, 1.15fr) minmax(7.5rem, 1fr)
    5.75rem 6.875rem;
  align-items: center;
  gap: 0.875rem;
  min-height: 3.125rem;
  padding: 0.25rem 0.75rem;
  border-bottom: 1px solid hsl(var(--border));
  cursor: pointer;
  transition:
    background-color 150ms ease-out,
    box-shadow 150ms ease-out;
}
.lb-row--head {
  min-height: 2.125rem;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  cursor: default;
}
@media (hover: hover) and (pointer: fine) {
  .lb-row:not(.lb-row--head):hover {
    background: hsl(var(--muted) / 0.45);
  }
}
.lb-row[aria-current="true"] {
  background: hsl(var(--muted) / 0.6);
  box-shadow: inset 2px 0 0 hsl(var(--foreground));
}
.lb-row--me {
  background: hsl(var(--tac-amber) / 0.06);
  box-shadow: inset 3px 0 0 hsl(var(--tac-amber) / 0.55);
}
.lb-row--me[aria-current="true"] {
  background: hsl(var(--tac-amber) / 0.12);
  box-shadow: inset 3px 0 0 hsl(var(--tac-amber));
}
.lb-row--highlight {
  background: hsl(var(--tac-amber) / 0.12);
  box-shadow:
    inset 3px 0 0 hsl(var(--tac-amber)),
    inset 0 0 0 1px hsl(var(--tac-amber) / 0.45);
  animation: lb-row-pulse 1600ms ease-out 1;
}
@keyframes lb-row-pulse {
  0% {
    background: hsl(var(--tac-amber) / 0.28);
  }
}
.lb-row-rank {
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.lb-row-value {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  @apply font-mono;
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.lb-row-sec {
  text-align: right;
  white-space: nowrap;
  @apply font-mono;
  font-size: 0.8rem;
  color: hsl(var(--muted-foreground));
  font-variant-numeric: tabular-nums;
}
.lb-row--head .lb-row-sec {
  font-family: inherit;
  font-size: inherit;
}

.lb-track {
  position: relative;
  height: 0.375rem;
  overflow: hidden;
  border-radius: 9999px;
  background: hsl(var(--muted) / 0.8);
}
.lb-track i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: hsl(var(--foreground) / 0.35);
  transform-origin: left;
  transition: width 300ms cubic-bezier(0.16, 1, 0.3, 1);
  animation: lb-grow 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes lb-grow {
  from {
    transform: scaleX(0);
  }
}

@container lb-board (max-width: 560px) {
  .lb-podium {
    gap: 0.5rem;
  }
  .lb-pod {
    gap: 0.25rem;
    padding: 1.625rem 0.375rem 0.75rem;
  }
  .lb-pod--first {
    padding-top: 2.5rem;
  }
  .lb-pod-place {
    top: 0.5rem;
    left: 0.5625rem;
    font-size: 0.9375rem;
  }
  .lb-pod-who {
    font-size: 0.8rem;
  }
  .lb-pod-who > :first-child {
    display: none;
  }
  .lb-pod-value {
    font-size: 1.0625rem;
  }
  .lb-pod--first .lb-pod-value {
    font-size: 1.25rem;
  }
  .lb-pod-meta {
    display: none;
  }
  .lb-pod--empty {
    min-height: 6rem;
  }
  .lb-medals {
    gap: 0.4rem;
    font-size: 0.75rem;
  }

  .lb-row {
    grid-template-columns: 1.75rem minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
    row-gap: 0.375rem;
    column-gap: 0.625rem;
    padding: 0.625rem 0.375rem;
  }
  .lb-row--head,
  .lb-row-sec {
    display: none;
  }
  .lb-row-rank {
    grid-row: span 2;
  }
  .lb-row-track {
    grid-column: 2 / 4;
    grid-row: 2;
  }
  .lb-track {
    height: 0.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lb-track i {
    animation: none;
    transition: none;
  }
}
</style>
