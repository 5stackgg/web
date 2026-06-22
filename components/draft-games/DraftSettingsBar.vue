<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Pencil, Link2, LogOut, RotateCw, Clock, X } from "lucide-vue-next";
import { useAuthStore } from "~/stores/AuthStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toast";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import MatchActions from "~/components/match/MatchActions.vue";
import { Crown } from "lucide-vue-next";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import cleanMapName from "~/utilities/cleanMapName";

const props = defineProps<{
  room: any;
  match?: any;
}>();

const emit = defineEmits<{
  (event: "open-settings"): void;
}>();

const { t } = useI18n();

const me = computed(() => useAuthStore().me);
const isHost = computed(() => me.value?.steam_id === props.room.host_steam_id);
const isActive = computed(
  () => !["Completed", "Canceled"].includes(props.room.status),
);
const notStarted = computed(
  () => !props.room.match_id && props.room.status === "Open",
);
const canEdit = computed(() => isHost.value && notStarted.value);

const accepted = computed(() =>
  (props.room.players || []).filter((p: any) => p.status === "Accepted"),
);

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
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
const countdown = computed(() => {
  if (remaining.value === null) {
    return "";
  }
  const m = Math.floor(remaining.value / 60);
  const s = remaining.value % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
});
const showCountdown = computed(
  () => notStarted.value && remaining.value !== null,
);
const urgent = computed(
  () => showCountdown.value && remaining.value !== null && remaining.value < 180,
);
const showTimeGauge = showCountdown;

const canExtend = computed(() => isHost.value && showCountdown.value);
const canCancel = computed(() => isHost.value && notStarted.value);

const extend = async () => {
  try {
    await useDraftGamesStore().extend(props.room.id);
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message,
    });
  }
};

const confirmCancel = ref(false);
const canceling = ref(false);
const cancelDraft = async () => {
  if (canceling.value) {
    return;
  }
  canceling.value = true;
  try {
    await useDraftGamesStore().cancelDraftRoom(props.room.id);
    confirmCancel.value = false;
    return navigateTo("/play");
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message,
    });
  } finally {
    canceling.value = false;
  }
};

const avgRank = computed(() => {
  const list = accepted.value.filter((p: any) => p.elo_snapshot);
  if (list.length === 0) {
    return 0;
  }
  return Math.round(
    list.reduce((sum: number, p: any) => sum + p.elo_snapshot, 0) / list.length,
  );
});

const opts = computed(() => props.match?.options ?? props.room.options ?? {});

const mr = computed(
  () => opts.value.mr ?? (props.room.type === "Competitive" ? 12 : 8),
);

const regions = computed(() => props.room.regions || []);
const isRegionVeto = computed(() => regions.value.length !== 1);
const regionText = computed(() =>
  isRegionVeto.value ? t("draft_games.bar.region_veto") : regions.value[0],
);

const hasRankGate = computed(
  () => !!props.room.min_elo || !!props.room.max_elo,
);
const rankLabel = computed(
  () => `${props.room.min_elo || 0}–${props.room.max_elo || "∞"}`,
);

const ACCESS_LABEL: Record<string, string> = {
  Open: "draft_games.access.open",
  Friends: "draft_games.access.friends",
  Invite: "draft_games.access.invite",
  Private: "draft_games.access.private",
};
const accessText = computed(() =>
  t(ACCESS_LABEL[props.room.access] || ACCESS_LABEL.Open),
);

const MODE_LABEL: Record<string, string> = {
  Captains: "draft_games.mode.captains",
  Host: "draft_games.mode.host",
  Pug: "draft_games.mode.pug",
  Teams: "draft_games.mode.teams",
};
const modeLabel = computed(
  () => MODE_LABEL[props.room.mode] || MODE_LABEL.Captains,
);

const metaLine = computed(() => {
  const parts = [
    props.room.type,
    `MR${mr.value}`,
    accessText.value,
    regionText.value,
    props.room.require_approval
      ? t("draft_games.bar.approval_on")
      : t("draft_games.bar.approval_off"),
  ];
  if (hasRankGate.value) {
    parts.push(rankLabel.value);
  }
  return parts;
});

const pool = computed(() => opts.value.map_pool || props.room.map_pool);
const maps = computed(() => pool.value?.maps || []);
const poolName = computed(() => pool.value?.type || "Default");
const mapName = (map: any) => map.label || cleanMapName(map.name);

const onOff = (value: any) =>
  value ? t("draft_games.bar.on") : t("draft_games.bar.off");

const settings = computed(() => {
  const o = opts.value;
  return [
    { label: t("draft_games.bar.best_of"), value: String(o.best_of ?? 1) },
    { label: t("draft_games.bar.overtime"), value: onOff(o.overtime), on: !!o.overtime },
    { label: t("draft_games.bar.knife"), value: onOff(o.knife_round), on: !!o.knife_round },
    { label: t("draft_games.bar.coaches"), value: onOff(o.coaches), on: !!o.coaches },
    { label: t("draft_games.bar.map_veto"), value: onOff(o.map_veto), on: !!o.map_veto },
  ];
});

const showInvite = computed(
  () =>
    isHost.value &&
    !props.room.match_id &&
    isActive.value &&
    props.room.access === "Invite" &&
    props.room.invite_code,
);

const isMember = computed(
  () =>
    !isHost.value &&
    !props.room.match_id &&
    isActive.value &&
    accepted.value.some((p: any) => p.steam_id === me.value?.steam_id),
);

const copyInvite = async () => {
  const url = `${window.location.origin}/draft-room/${props.room.id}?invite=${props.room.invite_code}`;
  await navigator.clipboard?.writeText(url);
  toast({ title: useNuxtApp().$i18n.t("draft_games.room.invite_copied") });
};

const leave = async () => {
  try {
    await useDraftGamesStore().leave(props.room.id);
    return navigateTo("/play");
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message,
    });
  }
};
</script>

<template>
  <div
    class="draft-bar relative overflow-hidden rounded-xl border border-border bg-card/50 [backdrop-filter:blur(8px)]"
  >
    <span class="rail" aria-hidden="true"></span>

    <div class="relative z-10 flex flex-col gap-4 py-4 pl-5 pr-4">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 class="callsign">{{ $t(modeLabel) }}</h2>
          <div class="meta">
            <template v-for="(part, i) in metaLine" :key="i">
              <span v-if="i > 0" class="sep" aria-hidden="true">·</span>
              <span>{{ part }}</span>
            </template>
          </div>
        </div>

        <div class="deck flex shrink-0 items-center gap-1.5">
          <MatchActions v-if="match" :match="match" />

          <FiveStackToolTip
            v-if="canEdit"
            as-child
            side="bottom"
            :tap-toggle="false"
          >
            <template #trigger>
              <button
                type="button"
                class="deck-btn deck-primary"
                @click="emit('open-settings')"
              >
                <Pencil class="h-4 w-4" />
              </button>
            </template>
            {{ $t("draft_games.room.edit_settings") }}
          </FiveStackToolTip>

          <FiveStackToolTip
            v-if="showInvite"
            as-child
            side="bottom"
            :tap-toggle="false"
          >
            <template #trigger>
              <button type="button" class="deck-btn" @click="copyInvite">
                <Link2 class="h-4 w-4" />
              </button>
            </template>
            {{ $t("draft_games.room.copy_invite") }}
          </FiveStackToolTip>

          <FiveStackToolTip
            v-if="canExtend"
            as-child
            side="bottom"
            :tap-toggle="false"
          >
            <template #trigger>
              <button type="button" class="deck-btn" @click="extend">
                <RotateCw class="h-4 w-4" />
              </button>
            </template>
            {{ $t("draft_games.room.extend") }}
          </FiveStackToolTip>

          <span v-if="(canExtend || isMember) && canCancel" class="deck-sep" />

          <FiveStackToolTip
            v-if="canCancel"
            as-child
            side="bottom"
            :tap-toggle="false"
          >
            <template #trigger>
              <button
                type="button"
                class="deck-btn deck-danger"
                @click="confirmCancel = true"
              >
                <X class="h-4 w-4" />
              </button>
            </template>
            {{ $t("draft_games.room.cancel_draft") }}
          </FiveStackToolTip>

          <FiveStackToolTip
            v-if="isMember"
            as-child
            side="bottom"
            :tap-toggle="false"
          >
            <template #trigger>
              <button type="button" class="deck-btn deck-danger" @click="leave">
                <LogOut class="h-4 w-4" />
              </button>
            </template>
            {{ $t("draft_games.room.leave") }}
          </FiveStackToolTip>
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-2">
        <div v-if="room.host" class="tile tile--host">
          <span class="tile-label inline-flex items-center gap-1">
            <Crown class="h-2.5 w-2.5 text-[hsl(var(--tac-amber))]" />
            {{ $t("draft_games.room.host_label") }}
          </span>
          <span class="tile-value inline-flex items-center gap-1.5">
            <img
              v-if="room.host.avatar_url"
              :src="room.host.avatar_url"
              class="h-4 w-4 shrink-0 rounded-sm object-cover"
              :alt="room.host.name"
            />
            <span class="truncate">{{ room.host.name }}</span>
          </span>
        </div>

        <HoverCard v-if="maps.length" :open-delay="80" :close-delay="80">
          <HoverCardTrigger as-child>
            <div class="tile tile--pool">
              <span class="tile-label">{{ $t("draft_games.bar.pool") }}</span>
              <span class="tile-value">
                {{ poolName }}
                <span class="count">{{ maps.length }}</span>
              </span>
            </div>
          </HoverCardTrigger>
          <HoverCardContent align="start" class="w-auto max-w-md p-2">
            <div class="map-grid">
              <div v-for="map in maps" :key="map.id" class="map-mini">
                <NuxtImg
                  v-if="map.poster"
                  :src="map.poster"
                  class="map-mini-img"
                  sizes="140px"
                />
                <span class="map-mini-overlay" aria-hidden="true"></span>
                <span class="map-mini-name">{{ mapName(map) }}</span>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
        <div v-else class="tile">
          <span class="tile-label">{{ $t("draft_games.bar.pool") }}</span>
          <span class="tile-value">{{ poolName }}</span>
        </div>

        <div class="tile">
          <span class="tile-label">MR</span>
          <span class="tile-value">{{ mr }}</span>
        </div>
        <div
          v-for="s in settings"
          :key="s.label"
          class="tile"
          :class="{ 'tile--on': s.on }"
        >
          <span class="tile-label">{{ s.label }}</span>
          <span class="tile-value" :class="{ 'text-[hsl(var(--tac-amber))]': s.on }">
            {{ s.value }}
          </span>
        </div>

        <div class="ml-auto flex items-end gap-5 self-end">
          <div
            v-if="showTimeGauge"
            class="gauge gauge--time"
            :class="{ 'gauge--urgent': urgent }"
          >
            <span class="gauge-label inline-flex items-center gap-1">
              <Clock class="h-2.5 w-2.5" />
              {{ $t("draft_games.room.expires_in") }}
            </span>
            <span class="gauge-value tabular-nums">
              {{ countdown }}
            </span>
          </div>
          <div v-if="avgRank > 0" class="gauge">
            <span class="gauge-label">{{ $t("draft_games.room.avg_rank") }}</span>
            <span class="gauge-value text-[hsl(var(--tac-amber))]">{{ avgRank }}</span>
          </div>
          <div class="gauge">
            <span class="gauge-label">{{ $t("draft_games.bar.players") }}</span>
            <span class="gauge-value">
              {{ accepted.length }}<span class="text-muted-foreground">/{{ room.capacity }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
    <span class="scanline" aria-hidden="true"></span>

    <AlertDialog
      :open="confirmCancel"
      @update:open="(open) => (confirmCancel = open)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("draft_games.room.cancel_draft_confirm_title") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("draft_games.room.cancel_draft_confirm_description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="canceling">
            {{ $t("common.cancel") }}
          </AlertDialogCancel>
          <Button variant="destructive" :disabled="canceling" @click="cancelDraft">
            <X class="mr-2 h-4 w-4" />
            {{ $t("draft_games.room.cancel_draft") }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<style scoped>
.draft-bar::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(
    circle at 1px 1px,
    hsl(var(--tac-amber) / 0.06) 1px,
    transparent 0
  );
  background-size: 22px 22px;
  pointer-events: none;
}
.rail {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(
    180deg,
    hsl(var(--tac-amber)),
    hsl(var(--tac-amber) / 0.15)
  );
}

.callsign {
  font-family: var(--font-sans);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: hsl(var(--foreground));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  margin-top: 0.45rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.1rem 0.4rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: hsl(var(--muted-foreground));
}
.meta .sep {
  color: hsl(var(--muted-foreground) / 0.4);
}
.tile--host {
  border-color: hsl(var(--tac-amber) / 0.35);
  background: linear-gradient(
    180deg,
    hsl(var(--tac-amber) / 0.1) 0%,
    hsl(var(--tac-amber) / 0.03) 100%
  );
}

.tile {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  border-radius: 0.4rem;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background) / 0.35);
  padding: 0.4rem 0.7rem;
  min-width: 4.25rem;
}
.tile--on {
  border-color: hsl(var(--tac-amber) / 0.35);
  background: hsl(var(--tac-amber) / 0.06);
}
.tile--pool {
  cursor: help;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.tile--pool:hover {
  border-color: hsl(var(--tac-amber) / 0.5);
  background: hsl(var(--tac-amber) / 0.08);
}
.tile-label {
  font-family: var(--font-mono, monospace);
  font-size: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: hsl(var(--muted-foreground));
}
.tile-value {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  white-space: nowrap;
}
.tile-value .count {
  display: inline-grid;
  place-items: center;
  min-width: 1.05rem;
  height: 1.05rem;
  padding: 0 0.25rem;
  border-radius: 0.3rem;
  background: hsl(var(--tac-amber) / 0.15);
  font-family: var(--font-mono, monospace);
  font-size: 0.58rem;
  font-weight: 700;
  color: hsl(var(--tac-amber));
}

.map-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
}
.map-mini {
  position: relative;
  display: flex;
  align-items: flex-end;
  height: 4rem;
  width: 7.5rem;
  overflow: hidden;
  border-radius: 0.35rem;
  border: 1px solid hsl(var(--border));
  background: hsl(0 0% 0%);
}
.map-mini-img {
  position: absolute;
  inset: 0;
  height: 100%;
  width: 100%;
  object-fit: cover;
  object-position: center;
}
.map-mini-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    hsl(var(--background) / 0.92) 0%,
    hsl(var(--background) / 0.12) 30%,
    hsl(var(--background) / 0.12) 50%,
    hsl(var(--background) / 0.94) 100%
  );
}
.map-mini-name {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 0.2rem 0.35rem;
  font-family: var(--font-sans);
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.1;
  color: hsl(var(--foreground));
  text-shadow: 0 1px 3px hsl(0 0% 0% / 0.8);
}

.gauge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
}
.gauge-label {
  font-family: var(--font-mono, monospace);
  font-size: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: hsl(var(--muted-foreground));
}
.gauge-value {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1;
  color: hsl(var(--foreground));
}

.deck-btn {
  display: grid;
  place-items: center;
  height: 2.1rem;
  width: 2.1rem;
  border-radius: 0.45rem;
  color: hsl(var(--muted-foreground));
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card) / 0.6);
  cursor: pointer;
  transition: all 0.15s ease;
}
.deck-btn:hover {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.4);
  background: hsl(var(--tac-amber) / 0.1);
  transform: translateY(-1px);
}
.deck-primary {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.45);
  background: hsl(var(--tac-amber) / 0.1);
}
.deck-primary:hover {
  border-color: hsl(var(--tac-amber) / 0.7);
  background: hsl(var(--tac-amber) / 0.18);
}
.deck-danger:hover {
  color: hsl(var(--destructive));
  border-color: hsl(var(--destructive) / 0.4);
  background: hsl(var(--destructive) / 0.12);
}
.deck-sep {
  height: 1.3rem;
  width: 1px;
  margin: 0 0.15rem;
  background: hsl(var(--border));
}

.gauge--time .gauge-value {
  color: hsl(var(--tac-amber));
  font-size: 1rem;
  letter-spacing: 0.02em;
}
.gauge--time.gauge--urgent .gauge-label,
.gauge--time.gauge--urgent .gauge-value {
  color: hsl(var(--destructive));
}
.scanline {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    hsl(var(--tac-amber) / 0.5),
    transparent
  );
}
</style>
