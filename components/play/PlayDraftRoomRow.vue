<script setup lang="ts">
import { computed, ref } from "vue";
import { Crown, Users2 } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { toast } from "~/components/ui/toast";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import {
  acceptedPlayers,
  draftAction,
  draftFormat,
  draftMetaParts,
  draftTitle,
  waitlistPlayers,
  type DraftViewer,
} from "~/components/play/draftRoomRow";

const props = defineProps<{
  draftGame: any;
  viewer: DraftViewer;
}>();

const { t, locale } = useI18n();
const apiDomain = useRuntimeConfig().public.apiDomain;

const path = computed(() => `/draft-room/${props.draftGame.id}`);
const format = computed(() => draftFormat(props.draftGame));
const meta = computed(() =>
  draftMetaParts(props.draftGame, t, locale.value).join(" · "),
);
const accepted = computed(() => acceptedPlayers(props.draftGame));
const title = computed(() => draftTitle(props.draftGame, t));
const subs = computed(() => waitlistPlayers(props.draftGame).length);
const action = computed(() => draftAction(props.draftGame, props.viewer, t));
const drafting = computed(
  () => !!props.draftGame.status && props.draftGame.status !== "Open",
);

const hostSteamId = computed(
  () => props.draftGame.host_steam_id ?? props.draftGame.host?.steam_id,
);
const hostElo = computed(() => {
  const row = accepted.value.find((p) => p.steam_id === hostSteamId.value);
  return row?.elo_snapshot || props.draftGame.host?.elo?.competitive || null;
});

// Everyone but the host, strongest first; five faces and a "+n".
const others = computed(() =>
  accepted.value
    .filter((p) => p.steam_id !== hostSteamId.value)
    .sort((a, b) => (b.elo_snapshot || 0) - (a.elo_snapshot || 0)),
);
const faces = computed(() => others.value.slice(0, 5));
const extraFaces = computed(() => Math.max(others.value.length - 5, 0));

const avatarSrc = (player: any) =>
  resolveAvatarUrl(
    player?.roster_image_url || player?.custom_avatar_url || player?.avatar_url,
    apiDomain,
  );

const busy = ref(false);

async function act() {
  const id = props.draftGame.id;
  switch (action.value.kind) {
    case "sign_in":
      navigateTo(`/login?next=${path.value}`);
      return;
    case "view":
      navigateTo(path.value);
      return;
    case "requested":
      return;
  }
  busy.value = true;
  try {
    if (action.value.kind === "join_party") {
      await useDraftGamesStore().joinParty(id);
    } else {
      await useDraftGamesStore().join(id);
    }
    if (!props.draftGame.require_approval) {
      navigateTo(path.value);
    }
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message ?? t("draft_games.card.join_error"),
    });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <article
    class="draft-room group/room relative grid items-center gap-4 rounded-lg border border-border bg-muted/20 px-3.5 py-3 transition-colors duration-150 hover:border-foreground/20 hover:bg-muted/30"
  >
    <span
      class="room-format grid h-10 place-items-center rounded-md text-[13px] font-bold tabular-nums"
      :class="
        drafting
          ? 'bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
          : 'bg-muted/55'
      "
    >
      {{ format }}
    </span>

    <div class="room-main grid min-w-0 gap-1">
      <h3
        class="m-0 flex flex-wrap items-center gap-2 text-[15px] font-bold leading-tight"
      >
        <!-- The title is the row's link; it stretches over the row so the
             whole card opens the room, while the controls sit above it. -->
        <NuxtLink
          :to="path"
          class="truncate after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[hsl(var(--tac-amber))]"
        >
          {{ title }}
        </NuxtLink>
        <span
          v-if="drafting"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--tac-amber))]"
        >
          <span class="size-1.5 rounded-full bg-[hsl(var(--tac-amber))]"></span>
          {{ $t("pages.play.draft_rooms.drafting") }}
        </span>
      </h3>
      <p
        v-if="meta"
        class="m-0 text-[12.5px] text-muted-foreground [text-wrap:pretty]"
      >
        {{ meta }}
      </p>
    </div>

    <div class="room-host flex min-w-0 items-center gap-2.5">
      <Avatar class="size-[30px] shrink-0">
        <AvatarImage
          v-if="avatarSrc(draftGame.host)"
          :src="avatarSrc(draftGame.host)!"
          :alt="draftGame.host?.name"
        />
        <AvatarFallback class="text-xs font-semibold uppercase">
          {{ (draftGame.host?.name || "?").slice(0, 1) }}
        </AvatarFallback>
      </Avatar>
      <span class="grid min-w-0">
        <b
          class="flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold"
        >
          <Crown class="size-3 shrink-0 text-[hsl(var(--tac-amber))]" />
          <span class="truncate">{{ draftGame.host?.name }}</span>
        </b>
        <span
          v-if="hostElo"
          class="truncate text-xs tabular-nums text-muted-foreground"
        >
          {{
            $t("pages.play.draft_rooms.host_elo", {
              elo: Number(hostElo).toLocaleString(locale),
            })
          }}
        </span>
      </span>
    </div>

    <div class="room-fill grid min-w-0 gap-1.5">
      <div class="flex items-center justify-between gap-2.5">
        <span class="flex items-center">
          <Avatar
            v-for="(p, index) in faces"
            :key="p.steam_id"
            class="size-[22px] shrink-0 ring-2 ring-background"
            :class="{ '-ml-1.5': index > 0 }"
          >
            <AvatarImage
              v-if="avatarSrc(p.player)"
              :src="avatarSrc(p.player)!"
              :alt="p.player?.name"
            />
            <AvatarFallback class="text-[10px] font-semibold uppercase">
              {{ (p.player?.name || "?").slice(0, 1) }}
            </AvatarFallback>
          </Avatar>
          <span
            v-if="extraFaces"
            class="ml-1.5 text-xs tabular-nums text-muted-foreground"
          >
            +{{ extraFaces }}
          </span>
        </span>
        <span class="whitespace-nowrap text-[13px] font-semibold tabular-nums">
          {{ accepted.length }}/{{ draftGame.capacity }}
          <span v-if="subs" class="font-medium text-muted-foreground">
            {{ $t("pages.play.draft_rooms.subs", { count: subs }) }}
          </span>
        </span>
      </div>
      <div class="flex gap-[3px]" aria-hidden="true">
        <i
          v-for="seat in draftGame.capacity"
          :key="seat"
          class="h-1 flex-1 rounded-sm"
          :class="
            seat <= accepted.length
              ? accepted.length >= draftGame.capacity
                ? 'bg-muted-foreground'
                : 'bg-foreground/70'
              : 'bg-muted'
          "
        ></i>
      </div>
    </div>

    <div class="room-action relative z-10 grid justify-items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        class="hit h-8 w-full gap-1.5"
        :disabled="action.disabled || busy"
        @click="act"
      >
        <Users2 v-if="action.kind === 'join_party'" class="size-3.5" />
        {{ action.label }}
      </Button>
      <small
        v-if="action.reason"
        class="text-right text-xs text-muted-foreground"
      >
        {{ action.reason }}
      </small>
    </div>
  </article>
</template>

<style scoped>
.draft-room {
  grid-template-columns:
    52px minmax(0, 1.5fr) minmax(0, 0.9fr) minmax(0, 1.15fr)
    172px;
}

@media (max-width: 1180px) {
  .draft-room {
    grid-template-columns: 52px minmax(0, 1.4fr) minmax(0, 1fr) 160px;
    grid-template-areas:
      "format main main action"
      "format host fill action";
  }
  .room-format {
    grid-area: format;
    align-self: start;
  }
  .room-main {
    grid-area: main;
  }
  .room-host {
    grid-area: host;
  }
  .room-fill {
    grid-area: fill;
  }
  .room-action {
    grid-area: action;
  }
}

/* Phones: one stacked card. */
@media (max-width: 900px) {
  .draft-room {
    grid-template-columns: 44px minmax(0, 1fr);
    grid-template-areas:
      "format main"
      "host host"
      "fill fill"
      "action action";
    gap: 10px 12px;
  }
  .room-action {
    justify-items: stretch;
  }
  .room-action small {
    text-align: left;
  }
}

.hit {
  position: relative;
}
@media (pointer: coarse) {
  .hit::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: max(100%, 2.75rem);
    transform: translateY(-50%);
  }
}
</style>
