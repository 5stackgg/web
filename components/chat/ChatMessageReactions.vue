<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { CHAT_REACTIONS, type ChatReaction } from "~/constants/chat";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { dateLocale } from "~/utilities/dateLocale";
import {
  canToggleChatReaction,
  heldChatReactions,
  type ChatMessagePermissions,
} from "~/utilities/chatMessageActions";
import { tacticalFilterPillActiveClasses } from "~/utilities/tacticalClasses";
import socket, { type ChatType, type LobbyMessage } from "~/web-sockets/Socket";

const props = defineProps<{
  message: LobbyMessage;
  room: { type: ChatType; id: string } | null;
  permissions: Pick<ChatMessagePermissions, "canReact" | "canAddReaction">;
  viewerSteamId: string | null;
}>();

const emit = defineEmits<{
  toggle: [reaction: ChatReaction];
}>();

const { t } = useI18n();

const NAMES_SHOWN = 8;

const pillClasses =
  "inline-flex h-5 items-center gap-1 rounded-full border border-border bg-muted/30 px-1.5 text-[10px] leading-none tabular-nums text-muted-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none";

const heldStaticClasses = tacticalFilterPillActiveClasses
  .split(" ")
  .filter((name) => !name.startsWith("hover:"))
  .join(" ");

const pills = computed(() => {
  const held = heldChatReactions(props.message, props.viewerSteamId);

  return CHAT_REACTIONS.flatMap(({ id, glyph }) => {
    const steamIds = props.message?.reactions?.[id];

    if (!Array.isArray(steamIds) || steamIds.length === 0) {
      return [];
    }

    const mine = held.has(id);

    return [
      {
        id,
        glyph,
        steamIds,
        mine,
        interactive: canToggleChatReaction(props.permissions, mine),
      },
    ];
  });
});

function pillTone(pill: { mine: boolean; interactive: boolean }) {
  if (!pill.interactive) {
    return ["cursor-default", pill.mine ? heldStaticClasses : ""];
  }

  return pill.mine
    ? tacticalFilterPillActiveClasses
    : "hover:bg-muted/50 hover:text-foreground";
}

function toggle(pill: { id: ChatReaction; interactive: boolean }) {
  if (pill.interactive) {
    emit("toggle", pill.id);
  }
}

// Only names this browser already has: the room's participants and whoever has
// spoken in it. Read when a tooltip opens, never fetched.
function reactorName(steamId: string) {
  if (props.viewerSteamId && steamId === String(props.viewerSteamId)) {
    return t("chat.reacted_you");
  }

  if (!props.room) {
    return undefined;
  }

  const participants = useMatchLobbyStore().lobbyChat[
    `${props.room.type}:${props.room.id}`
  ] as Map<string, { steam_id?: string; name?: string }> | undefined;

  for (const participant of participants?.values() ?? []) {
    if (String(participant?.steam_id) === steamId && participant.name) {
      return participant.name;
    }
  }

  const messages = socket.lobbyMessages(props.room.type, props.room.id);
  for (let index = messages.length - 1; index >= 0; index--) {
    const from = messages[index]?.from;
    if (String(from?.steam_id) === steamId && from?.name) {
      return from.name;
    }
  }

  return undefined;
}

function reactedBy(pill: {
  glyph: string;
  steamIds: string[];
  mine: boolean;
}) {
  const viewer = String(props.viewerSteamId);
  const steamIds = pill.steamIds.map(String);
  const ordered = pill.mine
    ? [viewer, ...steamIds.filter((steamId) => steamId !== viewer)]
    : steamIds;

  const names: string[] = [];

  for (const steamId of ordered) {
    if (names.length === NAMES_SHOWN) {
      break;
    }

    const name = reactorName(steamId);
    if (name) {
      names.push(name);
    }
  }

  const count = pill.steamIds.length;

  if (names.length === 0) {
    return t("chat.reacted_by_count", { count, emoji: pill.glyph }, count);
  }

  const others = count - names.length;
  if (others > 0) {
    names.push(t("chat.reacted_others", { count: others }, others));
  }

  return t("chat.reacted_by", {
    names: new Intl.ListFormat(dateLocale(), { type: "conjunction" }).format(
      names,
    ),
    emoji: pill.glyph,
  });
}
</script>

<template>
  <div v-if="pills.length" class="mt-1 flex flex-wrap gap-1">
    <FiveStackToolTip
      v-for="pill in pills"
      :key="pill.id"
      as-child
      :delay-duration="120"
      side="top"
      :tap-toggle="!pill.interactive"
    >
      <template #trigger>
        <button
          type="button"
          :class="[pillClasses, pillTone(pill)]"
          :aria-pressed="pill.mine"
          :aria-disabled="pill.interactive ? undefined : 'true'"
          :aria-label="
            t('chat.react_with_count', {
              emoji: pill.glyph,
              count: pill.steamIds.length,
            })
          "
          :data-reaction="pill.id"
          @click="toggle(pill)"
        >
          <span class="text-[11px]" aria-hidden="true">{{ pill.glyph }}</span>
          <span aria-hidden="true">{{ pill.steamIds.length }}</span>
        </button>
      </template>
      {{ reactedBy(pill) }}
    </FiveStackToolTip>
  </div>
</template>
