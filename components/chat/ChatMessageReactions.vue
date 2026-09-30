<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import ChatReactionPicker from "~/components/chat/ChatReactionPicker.vue";
import { Fold } from "~/components/ui/transitions";
import { CHAT_REACTIONS, type ChatReaction } from "~/constants/chat";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { dateLocale } from "~/utilities/dateLocale";
import {
  canToggleChatReaction,
  chatReactionChoices,
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
  "inline-flex h-6 items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 pl-1.5 pr-2 text-[11px] font-semibold leading-none tabular-nums text-muted-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none";

const pickerOpen = ref(false);

const canAdd = computed(() => !!props.room && props.permissions.canReact);

const reactionChoices = computed(() =>
  chatReactionChoices(props.message, props.viewerSteamId, props.permissions),
);

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

function reactedBy(pill: { glyph: string; steamIds: string[]; mine: boolean }) {
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
  <!-- The row folds open with its first reaction and shut with its last, the
       dying pill carried by the frozen subtree rather than snapping away. -->
  <Fold :open="pills.length > 0">
    <div class="-m-0.5 flex flex-wrap items-center pt-1">
      <TransitionGroup
        tag="div"
        class="contents"
        enter-active-class="pill-anim"
        enter-from-class="pill-collapsed"
        leave-active-class="pill-anim pill-leave"
        leave-to-class="pill-collapsed"
      >
        <!-- A bare cell whose column folds, so the pills beside it slide over
             rather than jump. Its spacing rides inside the clip. -->
        <div v-for="pill in pills" :key="pill.id" class="grid grid-cols-[1fr]">
          <div class="pill-cell min-w-0">
            <div class="p-0.5">
              <FiveStackToolTip
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
                    <span class="text-sm leading-none" aria-hidden="true">
                      {{ pill.glyph }}
                    </span>
                    <!-- The count rolls rather than blinks when it changes. -->
                    <span
                      class="inline-grid overflow-hidden"
                      aria-hidden="true"
                    >
                      <Transition
                        enter-from-class="translate-y-full opacity-0"
                        enter-active-class="transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none"
                        leave-active-class="transition-[transform,opacity] duration-150 ease-in motion-reduce:transition-none"
                        leave-to-class="-translate-y-full opacity-0"
                      >
                        <span
                          :key="pill.steamIds.length"
                          class="[grid-area:1/1]"
                        >
                          {{ pill.steamIds.length }}
                        </span>
                      </Transition>
                    </span>
                  </button>
                </template>
                {{ reactedBy(pill) }}
              </FiveStackToolTip>
            </div>
          </div>
        </div>
      </TransitionGroup>
      <!-- Always holds its place at the end, so showing it on hover moves
           nothing. A touch screen reacts from the line's menu instead. -->
      <div
        v-if="canAdd"
        class="p-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/chat-message:opacity-100 has-[[aria-expanded=true]]:opacity-100 motion-reduce:transition-none [@media(hover:none)]:hidden"
      >
        <ChatReactionPicker
          v-model:open="pickerOpen"
          :choices="reactionChoices"
          :gagged="!permissions.canAddReaction"
          trigger-class="h-6 w-7 rounded-md border border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground [&_svg]:size-3.5"
          @react="emit('toggle', $event)"
        />
      </div>
    </div>
  </Fold>
</template>

<style scoped>
.pill-anim {
  transition:
    grid-template-columns 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease,
    transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: left center;
}
.pill-leave {
  transition-duration: 0.11s;
  transition-timing-function: ease-in;
}
/* Clipped only while animating, so focus rings survive at rest. */
.pill-anim > .pill-cell {
  overflow: hidden;
}
.pill-collapsed {
  grid-template-columns: 0fr;
  opacity: 0;
  transform: scale(0.6);
}
@media (prefers-reduced-motion: reduce) {
  .pill-anim {
    transition-duration: 1ms;
  }
}
</style>
