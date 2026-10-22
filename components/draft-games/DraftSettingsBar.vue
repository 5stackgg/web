<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronRight, Crown } from "lucide-vue-next";
import { serverNow } from "~/stores/ServerClockStore";
import {
  clockLabel,
  draftRoomOptions,
} from "~/components/draft-games/draftRoomHeader";

const props = defineProps<{
  room: any;
  match?: any;
}>();

const emit = defineEmits<{
  (event: "open-settings"): void;
}>();

const { t } = useI18n();

const notStarted = computed(
  () => !props.room.match_id && props.room.status === "Open",
);

const accepted = computed(() =>
  (props.room.players || []).filter((p: any) => p.status === "Accepted"),
);

const now = ref(serverNow());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    now.value = serverNow();
  }, 1000);
});
onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});

const expiry = computed(() => {
  const deadline = props.room.pick_deadline ?? props.room.expires_at;
  return deadline ? new Date(deadline).getTime() : null;
});
const remaining = computed(() =>
  expiry.value === null
    ? null
    : Math.max(0, Math.floor((expiry.value - now.value) / 1000)),
);
const showCountdown = computed(
  () => notStarted.value && remaining.value !== null,
);
const urgent = computed(
  () =>
    showCountdown.value && remaining.value !== null && remaining.value < 180,
);

const avgRank = computed(() => {
  const list = accepted.value.filter((p: any) => p.elo_snapshot);
  if (list.length === 0) {
    return 0;
  }
  return Math.round(
    list.reduce((sum: number, p: any) => sum + p.elo_snapshot, 0) / list.length,
  );
});

const opts = computed(() => draftRoomOptions(props.room, props.match));

const MODE_LABEL: Record<string, string> = {
  Captains: "pages.play.draft_rooms.types.captains",
  Host: "pages.play.draft_rooms.types.host",
  Pug: "pages.play.draft_rooms.types.pug",
  Teams: "pages.play.draft_rooms.types.teams",
};
const modeLabel = computed(
  () => MODE_LABEL[props.room.mode] || MODE_LABEL.Captains,
);

// A game mode changes what the match actually plays like, so it stays beside
// the mode rather than only in the sheet: players decide whether to join off
// this line.
const gameMode = computed(() => opts.value.game_mode ?? null);

const summary = computed(() => {
  const regions = props.room.regions || [];
  const parts = [
    props.room.type,
    `MR${opts.value.mr}`,
    t("match.options.best_of.option", { count: opts.value.best_of ?? 1 }),
    regions.length === 1 ? regions[0] : t("draft_games.bar.region_veto"),
  ];
  if (props.room.min_elo || props.room.max_elo) {
    parts.push(`${props.room.min_elo || 0}–${props.room.max_elo || "∞"}`);
  }
  return parts.filter(Boolean).join(" · ");
});
</script>

<template>
  <div class="draft-summary">
    <button
      type="button"
      class="draft-summary-row"
      aria-haspopup="dialog"
      @click="emit('open-settings')"
    >
      <span class="grid min-w-0 flex-1 gap-px">
        <span
          class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-semibold leading-5"
        >
          {{ $t(modeLabel) }}
          <span v-if="gameMode" class="gamemode">
            {{ gameMode.name }}
            <!-- Every custom mode is unranked; the badge states it rather
                 than depending on any per-mode flag. -->
            <span class="gamemode__unranked">
              {{ $t("draft_games.bar.unranked") }}
            </span>
          </span>
        </span>
        <span
          class="text-[13px] leading-[18px] text-muted-foreground [text-wrap:pretty]"
        >
          {{ summary }}
        </span>
      </span>
      <span class="draft-summary-more">
        {{ $t("pages.play.draft_rooms.host_bar.all_settings") }}
        <ChevronRight class="size-4" />
      </span>
    </button>

    <p class="draft-summary-foot">
      <span v-if="room.host" class="inline-flex min-w-0 items-center gap-1.5">
        <Crown class="size-3 shrink-0 text-[hsl(var(--tac-amber))]" />
        <i18n-t
          keypath="draft_games.room.hosted_by"
          tag="span"
          class="inline-flex min-w-0 items-center gap-1.5"
        >
          <template #name>
            <span
              class="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground"
            >
              <img
                v-if="room.host.avatar_url"
                :src="room.host.avatar_url"
                class="size-4 shrink-0 rounded-sm object-cover"
                alt=""
              />
              <span class="truncate">{{ room.host.name }}</span>
            </span>
          </template>
        </i18n-t>
      </span>
      <i18n-t
        v-if="showCountdown"
        keypath="draft_games.room.closes_in"
        tag="span"
        class="whitespace-nowrap"
      >
        <template #time>
          <b
            class="draft-summary-closes font-semibold tabular-nums"
            :class="urgent ? 'text-destructive' : 'text-foreground'"
          >
            {{ clockLabel(remaining ?? 0) }}
          </b>
        </template>
      </i18n-t>
      <span v-if="avgRank > 0" class="whitespace-nowrap">
        {{ $t("draft_games.room.avg_rank") }}
        <b class="font-semibold tabular-nums text-foreground">{{ avgRank }}</b>
      </span>
    </p>
  </div>
</template>

<style scoped>
.draft-summary-row {
  display: flex;
  width: 100%;
  min-height: 3.25rem;
  align-items: center;
  gap: 0.75rem;
  border-top: 1px solid hsl(var(--border));
  padding: 0.625rem 0.875rem 0.625rem 1rem;
  text-align: left;
  transition: background-color 150ms ease-out;
}
.draft-summary-row:focus-visible {
  outline: 2px solid hsl(var(--tac-amber) / 0.6);
  outline-offset: -2px;
}
.draft-summary-more {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.125rem;
  white-space: nowrap;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  transition: color 150ms ease-out;
}
@media (hover: hover) and (pointer: fine) {
  .draft-summary-row:hover {
    background: hsl(var(--muted) / 0.35);
  }
  .draft-summary-row:hover .draft-summary-more {
    color: hsl(var(--foreground));
  }
}
.draft-summary-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem 1rem;
  border-top: 1px solid hsl(var(--border));
  padding: 0.625rem 0.875rem 0.75rem 1rem;
  font-size: 12.5px;
  color: hsl(var(--muted-foreground));
}
.gamemode {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid hsl(var(--tac-amber) / 0.45);
  background: hsl(var(--tac-amber) / 0.08);
  color: hsl(var(--tac-amber));
  border-radius: 0.25rem;
  padding: 0.1rem 0.45rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.gamemode__unranked {
  color: hsl(var(--muted-foreground));
  border-left: 1px solid hsl(var(--tac-amber) / 0.35);
  padding-left: 0.4rem;
}
@container draft-header (max-width: 619px) {
  .draft-summary-row,
  .draft-summary-foot {
    padding-inline: 0.75rem;
  }
}
</style>
