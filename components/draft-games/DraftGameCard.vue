<script setup lang="ts">
import { computed } from "vue";
import {
  Users2,
  Shield,
  Shuffle,
  Crosshair,
  Hourglass,
  Map as MapIcon,
  Sparkles,
  Crown,
} from "lucide-vue-next";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { toast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";

const { t } = useI18n();

const apiDomain = useRuntimeConfig().public.apiDomain;
const avatarSrc = (p: any) =>
  resolveAvatarUrl(
    p?.roster_image_url || p?.custom_avatar_url || p?.avatar_url,
    apiDomain,
  );

const props = defineProps<{
  draftGame: any;
}>();

const MODE_META: Record<
  string,
  { icon: any; label: string; short: string }
> = {
  Captains: {
    icon: Users2,
    label: "draft_games.mode.captains",
    short: "draft_games.mode_short.captains",
  },
  Host: {
    icon: Shield,
    label: "draft_games.mode.host",
    short: "draft_games.mode_short.host",
  },
  Pug: {
    icon: Shuffle,
    label: "draft_games.mode.pug",
    short: "draft_games.mode_short.pug",
  },
  Teams: {
    icon: Crosshair,
    label: "draft_games.mode.teams",
    short: "draft_games.mode_short.teams",
  },
};
const modeMeta = computed(
  () => MODE_META[props.draftGame.mode] || MODE_META.Captains,
);

const format = computed(() => {
  const cap = props.draftGame.capacity;
  if (cap && cap % 2 === 0) {
    return `${cap / 2}v${cap / 2}`;
  }
  return (props.draftGame.type || "").slice(0, 4);
});

const accepted = computed(() =>
  (props.draftGame.players || []).filter(
    (p: any) => p.status === "Accepted",
  ),
);

const requests = computed(() =>
  (props.draftGame.players || []).filter(
    (p: any) => p.status === "Requested",
  ),
);

const waitlist = computed(() =>
  (props.draftGame.players || []).filter((p: any) => p.status === "Waitlist"),
);

const hostSteamId = computed(
  () => props.draftGame.host_steam_id ?? props.draftGame.host?.steam_id,
);

const otherPlayers = computed(() =>
  accepted.value
    .filter((p: any) => p.steam_id !== hostSteamId.value)
    .sort((a: any, b: any) => (b.elo_snapshot || 0) - (a.elo_snapshot || 0)),
);

const roster = computed(() => {
  const hostRow = accepted.value.find(
    (p: any) => p.steam_id === hostSteamId.value,
  );
  const out: any[] = [];
  if (props.draftGame.host) {
    out.push({
      key: "host",
      player: props.draftGame.host,
      snapshot: hostRow?.elo_snapshot,
      isHost: true,
    });
  }
  for (const p of otherPlayers.value) {
    out.push({
      key: p.steam_id,
      player: p.player,
      snapshot: p.elo_snapshot,
      isHost: false,
    });
  }
  return out;
});

const anchor = computed(() => roster.value[0] ?? null);
const squad = computed(() => roster.value.slice(1));

const playerWithElo = (player: any, snapshot?: number) => {
  const e = player?.elo;
  if (e && (e.competitive || e.wingman || e.duel)) {
    return player;
  }
  return { ...player, elo: snapshot ? { competitive: snapshot } : undefined };
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

const isCustomPool = computed(
  () => props.draftGame.map_pool?.type === "Custom",
);

const showMapPool = computed(() => {
  const g = props.draftGame;
  return !!(isCustomPool.value || (g.map_pool && g.map_pool.type !== g.type));
});

const myMembership = computed(() => {
  const me = useAuthStore().me;
  if (!me) {
    return undefined;
  }
  return (props.draftGame.players || []).find(
    (p: any) => p.steam_id === me.steam_id,
  );
});

const isMember = computed(
  () => myMembership.value?.status !== "Requested" && !!myMembership.value,
);
const hasRequested = computed(() => myMembership.value?.status === "Requested");

const isFull = computed(
  () => accepted.value.length >= props.draftGame.capacity,
);

const requiresApproval = computed(() => props.draftGame.require_approval);

const partyMembers = computed(() =>
  (useMatchmakingStore().currentLobby?.players || []).filter(
    (p: any) => p.status !== "Invited",
  ),
);
const isPartyLeader = computed(() => {
  const meId = useAuthStore().me?.steam_id;
  const meRow = partyMembers.value.find(
    (p: any) => p.player?.steam_id === meId,
  );
  return !!meRow?.captain;
});
const canParty = computed(
  () =>
    isPartyLeader.value &&
    partyMembers.value.length > 1 &&
    !isMember.value &&
    !hasRequested.value,
);
const joinWithParty = async () => {
  try {
    await useDraftGamesStore().joinParty(props.draftGame.id);
    if (!requiresApproval.value) {
      navigateTo(`/draft-room/${props.draftGame.id}`);
    }
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message ?? t("draft_games.card.join_error"),
    });
  }
};

const join = async () => {
  if (!useAuthStore().me) {
    navigateTo(`/login?next=/draft-room/${props.draftGame.id}`);
    return;
  }
  try {
    await useDraftGamesStore().join(props.draftGame.id);
    if (!requiresApproval.value) {
      navigateTo(`/draft-room/${props.draftGame.id}`);
    }
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message ?? t("draft_games.card.join_error"),
    });
  }
};

const openRoom = () => {
  navigateTo(`/draft-room/${props.draftGame.id}`);
};
</script>

<template>
  <div
    class="draft-row group relative flex cursor-pointer items-stretch overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-[hsl(var(--tac-amber)/0.5)]"
    role="button"
    tabindex="0"
    @click="openRoom"
    @keydown.enter="openRoom"
  >
    <div class="type-rail relative flex w-[104px] shrink-0 flex-col items-center justify-center gap-1.5 px-3 py-4 text-center sm:w-[116px]">
      <span class="type-rail-bar"></span>
      <span class="font-sans text-[1.6rem] font-bold uppercase leading-none tracking-tight tabular-nums">
        {{ format }}
      </span>
      <span class="max-w-full font-mono text-[0.5rem] uppercase leading-tight tracking-[0.12em] text-muted-foreground">
        {{ draftGame.type }}
      </span>
      <span
        class="mt-0.5 inline-flex max-w-full items-center gap-1 rounded border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.1)] px-1.5 py-0.5 font-mono text-[0.5rem] font-semibold uppercase leading-tight tracking-[0.1em] text-[hsl(var(--tac-amber))]"
      >
        <component :is="modeMeta.icon" class="h-2.5 w-2.5 shrink-0" />
        {{ $t(modeMeta.short) }}
      </span>
    </div>

    <div class="flex min-w-0 flex-1 flex-col justify-center gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div class="flex min-w-0 flex-1 flex-col gap-2.5">
        <div class="flex min-w-0 items-center gap-3">
          <PlayerDisplay
            v-if="anchor"
            :player="playerWithElo(anchor.player, anchor.snapshot)"
            :show-online="false"
            :show-flag="false"
            :show-name="true"
            :show-role="false"
            :show-add-friend="false"
            :show-elo="true"
            linkable
            compact
            truncate-name
            class="min-w-0 shrink"
          >
            <template v-if="anchor.isHost" #avatar-corner>
              <span
                :title="$t('draft_games.room.host_label')"
                class="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-[hsl(var(--tac-amber))] text-black shadow ring-1 ring-background"
              >
                <Crown class="h-2.5 w-2.5" />
              </span>
            </template>
          </PlayerDisplay>

          <span
            v-if="squad.length"
            class="h-8 w-px shrink-0 bg-border/60"
            aria-hidden="true"
          ></span>

          <div v-if="squad.length" class="flex items-center -space-x-2">
            <FiveStackToolTip
              v-for="item in squad"
              :key="item.key"
              as-child
              side="top"
              :delay-duration="100"
            >
              <template #trigger>
                <NuxtLink
                  :to="
                    item.player?.steam_id
                      ? {
                          name: 'players-id',
                          params: { id: item.player.steam_id },
                        }
                      : null
                  "
                  :title="item.player?.name"
                  class="group/av relative block shrink-0"
                  @click.stop
                >
                  <Avatar
                    shape="square"
                    class="h-8 w-8 rounded-md ring-2 ring-[hsl(var(--card))] transition duration-150 group-hover/av:z-10 group-hover/av:-translate-y-0.5 group-hover/av:ring-[hsl(var(--tac-amber)/0.7)]"
                  >
                    <AvatarImage
                      v-if="avatarSrc(item.player)"
                      :src="avatarSrc(item.player)"
                      :alt="item.player?.name"
                    />
                    <AvatarFallback class="text-[0.55rem] font-semibold uppercase">
                      {{ (item.player?.name || "?").slice(0, 2) }}
                    </AvatarFallback>
                  </Avatar>
                </NuxtLink>
              </template>
              <PlayerDisplay
                :player="playerWithElo(item.player, item.snapshot)"
                :show-online="false"
                :show-flag="true"
                :show-name="true"
                :show-role="false"
                :show-add-friend="false"
                :show-elo="true"
                compact
              />
            </FiveStackToolTip>
          </div>
        </div>

        <div v-if="draftGame.min_elo || draftGame.max_elo" class="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" class="gap-1">
            {{ draftGame.min_elo || 0 }} – {{ draftGame.max_elo || "∞" }}
          </Badge>
        </div>
      </div>

      <div class="flex shrink-0 flex-wrap items-center gap-3 self-end rounded-lg border border-border/70 bg-background/40 px-3 py-2 sm:self-center">
        <template v-if="showMapPool">
          <div class="flex flex-col items-center leading-none">
            <span class="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-muted-foreground">
              {{ $t("draft_games.card.pool") }}
            </span>
            <span
              class="mt-1 inline-flex items-center gap-1 font-mono text-sm font-bold uppercase tabular-nums"
              :class="isCustomPool ? 'text-[hsl(var(--tac-amber))]' : 'text-foreground'"
            >
              <Sparkles v-if="isCustomPool" class="h-3 w-3 shrink-0" />
              <MapIcon v-else class="h-3 w-3 shrink-0" />
              {{ isCustomPool ? $t("draft_games.card.custom") : draftGame.map_pool.type }}
            </span>
          </div>
          <span class="h-8 w-px shrink-0 bg-border/60"></span>
        </template>

        <template v-if="draftGame.regions?.length">
          <div class="flex flex-col items-center leading-none">
            <span class="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-muted-foreground">
              {{ $t("draft_games.card.region") }}
            </span>
            <span class="mt-1 font-mono text-sm font-bold uppercase tabular-nums text-foreground">
              {{ draftGame.regions.join(" · ") }}
            </span>
          </div>
          <span class="h-8 w-px shrink-0 bg-border/60"></span>
        </template>

        <div class="flex flex-col items-center leading-none">
          <span class="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-muted-foreground">
            {{ $t("draft_games.room.avg_rank") }}
          </span>
          <span class="mt-1 font-mono text-lg font-bold tabular-nums text-[hsl(var(--tac-amber))]">
            {{ avgRank || "—" }}
          </span>
        </div>

        <span class="h-8 w-px shrink-0 bg-border/60"></span>

        <div class="flex flex-col items-center leading-none">
          <span class="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-muted-foreground">
            {{ $t("draft_games.card.players") }}
          </span>
          <span class="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
            {{ accepted.length }}
            <span class="text-muted-foreground">/ {{ draftGame.capacity }}</span>
          </span>
        </div>

        <template v-if="waitlist.length > 0">
          <span class="h-8 w-px shrink-0 bg-border/60"></span>
          <div
            class="flex flex-col items-center leading-none"
            :title="$t('draft_games.room.waitlist')"
          >
            <span class="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-muted-foreground">
              {{ $t("draft_games.card.subs") }}
            </span>
            <span class="mt-1 font-mono text-sm font-bold tabular-nums text-muted-foreground">
              {{ waitlist.length }}
            </span>
          </div>
        </template>

        <template v-if="requiresApproval && requests.length > 0">
          <span class="h-8 w-px shrink-0 bg-border/60"></span>
          <div
            class="flex flex-col items-center leading-none"
            :title="$t('draft_games.card.pending_requests')"
          >
            <span class="font-mono text-[0.5rem] uppercase tracking-[0.16em] text-muted-foreground">
              {{ $t("draft_games.card.requests") }}
            </span>
            <span class="mt-1 font-mono text-sm font-bold tabular-nums text-[hsl(var(--tac-amber))]">
              {{ requests.length }}
            </span>
          </div>
        </template>

        <span class="h-8 w-px shrink-0 bg-border/60"></span>
        <Button
          v-if="canParty"
          variant="outline"
          class="gap-1.5"
          :title="$t('draft_games.card.join_party_hint')"
          @click.stop="joinWithParty"
        >
          <Users2 class="h-3.5 w-3.5" />
          {{ $t("draft_games.card.join_party", { count: partyMembers.length }) }}
        </Button>
        <Button v-if="isMember" variant="outline" @click.stop="openRoom">
          {{ $t("draft_games.card.view") }}
        </Button>
        <Button v-else-if="hasRequested" variant="outline" disabled class="gap-1.5" @click.stop>
          <Hourglass class="h-3.5 w-3.5" />
          {{ $t("draft_games.card.requested") }}
        </Button>
        <Button
          v-else
          type="button"
          :class="[
            tacticalCtaButtonClasses,
            'disabled:cursor-not-allowed disabled:opacity-40',
          ]"
          :disabled="isFull"
          @click.stop="join"
        >
          {{
            requiresApproval ? $t("draft_games.card.request") : $t("draft_games.card.join")
          }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.draft-row::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(
    120% 100% at 0% 50%,
    hsl(var(--tac-amber) / 0.06),
    transparent 55%
  );
  transition: opacity 0.25s ease;
}
.draft-row:hover::after {
  opacity: 1;
}
.type-rail {
  background: linear-gradient(
    180deg,
    hsl(var(--tac-amber) / 0.08),
    hsl(var(--tac-amber) / 0.02)
  );
  border-right: 1px solid hsl(var(--border));
}
.type-rail-bar {
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: hsl(var(--tac-amber));
  box-shadow: 0 0 10px hsl(var(--tac-amber) / 0.6);
}
</style>
