<script setup lang="ts">
import ChatHeader from "~/components/chat/ChatHeader.vue";
import ChatMessages from "~/components/chat/ChatMessages.vue";
import ChatInput from "~/components/chat/ChatInput.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import ChatMatchHeader from "~/components/chat/ChatMatchHeader.vue";
import Empty from "~/components/ui/empty/Empty.vue";
</script>

<template>
  <Teleport to="#global-chat-container" v-if="global" defer>
    <div
      v-bind="$attrs"
      class="fixed bottom-4 bg-background border rounded-lg shadow-lg z-50 transition-all duration-300 ease-in-out flex flex-col w-96"
      :class="{ 'h-12': isMinimized, 'h-96': !isMinimized }"
      :style="{
        right: rightSidebarOffset + 'px',
      }"
    >
      <ChatHeader
        variant="global"
        :is-minimized="isMinimized"
        :unread-count="unreadCount"
        @toggle-minimize="toggleMinimize"
      >
        <template #title>
          <slot name="chat-label">{{ $t("chat.lobby_chat") }}</slot>
        </template>
      </ChatHeader>
      <div
        v-if="matchInfo"
        class="px-3 py-2 border-b border-border/40 text-[11px] text-muted-foreground flex items-center justify-between gap-2 bg-background/80"
      >
        <div class="flex flex-col gap-0.5 min-w-0">
          <NuxtLink
            :to="`/matches/${(matchInfo as any).id}`"
            class="text-xs font-medium text-primary hover:underline truncate max-w-[220px]"
            @click.stop
          >
            {{ matchLabel }}
          </NuxtLink>
          <NuxtLink
            :to="`/matches/${(matchInfo as any).id}`"
            class="text-[11px] text-primary hover:underline truncate max-w-[220px]"
            @click.stop
          >
            {{ matchMetaText }}
          </NuxtLink>
        </div>
        <div
          v-if="matchScoreText"
          class="text-xs font-semibold whitespace-nowrap"
        >
          {{ matchScoreText }}
        </div>
      </div>
      <div
        class="flex items-center justify-between px-3 py-1 text-[11px] text-muted-foreground border-b border-border/40"
      >
        <div class="flex items-center gap-1.5">
          <div class="relative inline-flex">
            <span
              v-if="participantsCount > 0"
              class="absolute inline-flex h-2.5 w-2.5 rounded-full animate-ping bg-emerald-500/60"
            ></span>
            <span
              class="relative inline-flex h-2.5 w-2.5 rounded-full"
              :class="
                participantsCount > 0 ? 'bg-emerald-400' : 'bg-zinc-500/60'
              "
            ></span>
          </div>
          <button
            type="button"
            class="underline-offset-2 hover:underline"
            @click.stop="showParticipants = !showParticipants"
          >
            {{ participantsCount }} {{ $t("chat.in_chat") }}
          </button>
        </div>
      </div>
      <div
        v-if="showParticipants"
        class="absolute z-50 top-11 left-2 right-2 rounded-md border bg-popover text-popover-foreground shadow-md p-3 text-xs max-h-52 overflow-y-auto"
      >
        <div
          v-if="participantsCount === 0"
          class="text-muted-foreground text-[11px]"
        >
          {{ $t("chat.no_participants", "No one else is in this chat yet.") }}
        </div>
        <ul v-else class="space-y-1.5">
          <li
            v-for="user in participants"
            :key="(user as any).steam_id"
            class="flex items-center gap-2"
          >
            <img
              v-if="(user as any).avatar_url"
              :src="(user as any).avatar_url"
              alt=""
              class="h-5 w-5 rounded-full"
            />
            <span class="truncate text-[11px]">
              {{ (user as any).name }}
            </span>
          </li>
        </ul>
      </div>
      <div
        v-if="!isMinimized"
        class="flex flex-col flex-1 min-h-0 transition-opacity duration-200"
        :class="{ 'opacity-0': isMinimized, 'opacity-100': !isMinimized }"
      >
        <div class="relative flex flex-1 min-h-0 flex-col">
          <ChatMessages
            v-if="messages.length"
            ref="chatMessagesRef"
            :messages="messages"
            :group-key="isMerged ? viewFilter : ''"
            variant="global"
            :is-minimized="isMinimized"
            class="flex-1 overflow-y-auto max-h-96"
            :last-read-count="lastReadMessageCount"
            @bottom-state-change="handleBottomStateChange"
          />
          <Empty v-else class="flex-1 text-muted-foreground">
            <div class="space-y-1">
              <p class="text-sm font-medium">
                {{ $t("chat.no_messages_yet", "No messages yet") }}
              </p>
              <p class="text-xs text-muted-foreground/80">
                {{
                  $t(
                    "chat.start_the_conversation",
                    "Say something to start the conversation.",
                  )
                }}
              </p>
            </div>
          </Empty>
          <button
            v-if="
              lastReadMessageCount > 0 &&
              lastReadMessageCount < messages.length &&
              isAtBottom
            "
            type="button"
            class="absolute top-1 left-1/2 -translate-x-1/2 z-10 rounded-full bg-zinc-900/95 border border-zinc-700 text-zinc-100 text-[11px] px-4 py-1 shadow-md hover:bg-zinc-800"
            @click.stop="handleJumpToNewLine"
          >
            ↑ {{ $t("chat.jump_to_new", "Jump to new") }}
          </button>
          <button
            v-if="lastReadMessageCount < messages.length && !isAtBottom"
            type="button"
            class="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 rounded-full bg-primary text-primary-foreground text-[11px] px-3 py-1 shadow-md hover:bg-primary/90"
            @click.stop="handleJumpToBottom"
          >
            {{ $t("chat.new_messages", "New messages") }} ↓
          </button>
        </div>
        <ChatInput
          v-if="canSend"
          ref="chatInputRef"
          variant="global"
          :channels="chatChannels"
          :destination="sendTo"
          @update:destination="sendTo = $event as any"
          @send-message="handleSendMessage"
        >
          <template #actions>
            <slot name="compose-actions"></slot>
          </template>
        </ChatInput>
        <div v-else class="px-3 py-2 text-center text-xs text-muted-foreground">
          {{ readonlyHint || $t("chat.readonly") }}
        </div>
      </div>
    </div>
  </Teleport>
  <div v-else v-bind="$attrs" :class="embeddedContainerClasses">
    <ChatMatchHeader
      v-if="isGlobalContext && hideParticipantsSummary && matchInfo"
      :match="matchInfo"
    />
    <div
      v-else-if="!hideParticipantsSummary"
      class="mb-2 flex items-center justify-between text-[11px] text-muted-foreground gap-3"
    >
      <!-- min-w-0 so this side is what gives when the row runs out of room.
           The filter beside it is a control at a fixed width; the count is a
           readout, and a clipped count beats a filter pushed off the card. -->
      <div class="flex min-w-0 items-center gap-1.5">
        <!-- A panel serving one room has to say which one, where more than one
             is on screen. Merged, the destination pills over the input carry
             that instead and this would only repeat them. -->
        <span
          v-if="label && !isMerged"
          class="inline-flex items-center rounded-sm border px-1.5 py-[1px] font-mono text-[0.55rem] font-bold uppercase leading-none tracking-[0.14em]"
          :class="
            isTeamContext
              ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
              : 'border-border bg-muted/40 text-muted-foreground'
          "
        >
          {{ label }}
        </span>
        <span
          class="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
          :class="participantsCount > 0 ? 'bg-emerald-400' : 'bg-zinc-500/60'"
        ></span>
        <button
          type="button"
          class="truncate underline-offset-2 hover:underline"
          @click.stop="showParticipants = !showParticipants"
        >
          {{ participantsCount }} {{ $t("chat.in_chat") }}
        </button>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <!-- What is on screen, as opposed to where the next line goes. Both
             rooms by default; narrowing is for reading one of them while the
             other is busy. -->
        <div
          v-if="isMerged"
          class="relative grid grid-cols-3 rounded-sm bg-background/60 p-[2px]"
        >
          <span
            class="pointer-events-none absolute inset-y-[2px] left-[2px] w-[calc(33.333%-1.333px)] rounded-[2px] bg-muted/70 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            :style="{ transform: `translateX(${viewFilterIndex * 100}%)` }"
          ></span>
          <button
            v-for="option in viewFilters"
            :key="option.value"
            type="button"
            class="relative z-10 px-1.5 py-[2px] font-mono text-[0.55rem] font-bold uppercase leading-none tracking-[0.14em] transition-colors duration-200"
            :class="
              viewFilter === option.value
                ? 'text-foreground'
                : 'text-muted-foreground/60 hover:text-muted-foreground'
            "
            @click.stop="viewFilter = option.value as any"
          >
            {{ option.label }}
            <!-- Narrowing the view is the one way to miss a message on this
                 panel, so the way back to it is what carries the mark. -->
            <span
              v-if="unseenFor(option.value)"
              class="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
            ></span>
          </button>
        </div>
        <NuxtLink
          v-if="isGlobalContext && matchInfo"
          :to="`/matches/${(matchInfo as any).id}`"
          class="flex items-center gap-1.5 text-xs text-primary hover:underline whitespace-nowrap"
        >
          {{ matchMetaText }}
        </NuxtLink>
        <slot name="header-actions"></slot>
      </div>
    </div>
    <div
      v-if="showParticipants"
      class="absolute z-20 top-10 right-4 left-4 rounded-md border bg-popover text-popover-foreground shadow-md p-3 text-xs max-h-52 overflow-y-auto"
    >
      <div
        v-if="participantsCount === 0"
        class="text-muted-foreground text-[11px]"
      >
        {{ $t("chat.no_participants", "No one else is in this chat yet.") }}
      </div>
      <ul v-else class="space-y-1.5">
        <li
          v-for="user in participants"
          :key="(user as any).steam_id"
          class="flex items-center gap-2"
        >
          <img
            v-if="(user as any).avatar_url"
            :src="(user as any).avatar_url"
            alt=""
            class="h-5 w-5 rounded-full"
          />
          <span class="truncate text-[11px]">
            {{ (user as any).name }}
          </span>
        </li>
      </ul>
    </div>
    <div class="relative flex flex-1 min-h-0 flex-col gap-2">
      <!-- First message in an empty room dissolves the empty copy under the
           arriving list instead of trading them on a frame. Both branches
           fill the same column slot, so a plain crossfade is right. -->
      <FadeSwap class="flex-1 min-h-0">
        <ChatMessages
          v-if="messages.length"
          key="messages"
          ref="chatMessagesRef"
          :messages="messages"
          :group-key="isMerged ? viewFilter : ''"
          variant="embedded"
          class="h-full overflow-y-auto"
          :last-read-count="tracksReadPosition ? lastReadMessageCount : 0"
          @bottom-state-change="handleBottomStateChange"
        />
        <Empty v-else key="empty" class="h-full text-muted-foreground">
          <div class="space-y-1">
            <p class="text-sm font-medium">
              {{ $t("chat.no_messages_yet", "No messages yet") }}
            </p>
            <p class="text-xs text-muted-foreground/80">
              {{
                $t(
                  "chat.start_the_conversation",
                  "Say something to start the conversation.",
                )
              }}
            </p>
          </div>
        </Empty>
      </FadeSwap>
      <!-- Floating pills fade rather than blink; they are absolute, so this
           costs no layout. -->
      <Transition
        enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
        leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
        enter-from-class="opacity-0 -translate-y-1"
        leave-to-class="opacity-0"
      >
        <button
          v-if="
            tracksReadPosition &&
            lastReadMessageCount > 0 &&
            lastReadMessageCount < messages.length &&
            isAtBottom
          "
          type="button"
          class="absolute top-1 left-1/2 z-10 rounded-full bg-zinc-900/95 border border-zinc-700 text-zinc-100 text-[11px] px-4 py-1 shadow-md hover:bg-zinc-800"
          style="translate: -50% 0"
          @click.stop="handleJumpToNewLine"
        >
          ↑ {{ $t("chat.jump_to_new", "Jump to new") }}
        </button>
      </Transition>
      <Transition
        enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
        leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
        enter-from-class="opacity-0 translate-y-1"
        leave-to-class="opacity-0"
      >
        <button
          v-if="
            tracksReadPosition &&
            lastReadMessageCount < messages.length &&
            !isAtBottom
          "
          type="button"
          class="absolute bottom-20 left-1/2 z-10 rounded-full bg-primary text-primary-foreground text-[11px] px-3 py-1 shadow-md hover:bg-primary/90"
          style="translate: -50% 0"
          @click.stop="handleJumpToBottom"
        >
          {{ $t("chat.new_messages", "New messages") }} ↓
        </button>
      </Transition>
      <!-- Composer <-> readonly hint are different heights; measured swap. -->
      <HeightSwap>
        <ChatInput
          v-if="canSend"
          key="composer"
          ref="chatInputRef"
          variant="embedded"
          :channels="chatChannels"
          :destination="sendTo"
          @update:destination="sendTo = $event as any"
          @send-message="handleSendMessage"
        >
          <!-- Controls that belong to the destination rather than to chat -- the
               team voice channel is the same room as the team pill, so it rides
               the toggle row instead of standing as a second panel. -->
          <template #actions>
            <slot name="compose-actions"></slot>
          </template>
        </ChatInput>
        <div
          v-else
          key="hint"
          class="px-3 py-2 text-center text-xs text-muted-foreground"
        >
          {{ readonlyHint || $t("chat.readonly") }}
        </div>
      </HeightSwap>
    </div>
  </div>
</template>

<script lang="ts">
import { markRaw, type PropType } from "vue";
import socket, { chatMessageKey, chatMessageTime } from "~/web-sockets/Socket";
import type { ChatType, Lobby, LobbyMessage } from "~/web-sockets/Socket";

import { useRightSidebar } from "~/composables/useRightSidebar";
import { useSound } from "~/composables/useSound";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";

const { rightSidebarOpen } = useRightSidebar();
const { playNotificationSound } = useSound();

interface ChatMessagesRef {
  scrollToBottom: (force?: boolean) => void;
  scrollToNewDivider?: () => void;
}

const NO_MESSAGES: LobbyMessage[] = [];

// The same lobby can be mounted in several widgets at once and every one of
// them is handed an incoming message, but the message only arrives once, so the
// sound has to be claimed rather than played per widget.
const notifiedMessages = new Set<string>();
function claimNotification(key: string) {
  if (notifiedMessages.has(key)) {
    return false;
  }
  if (notifiedMessages.size > 500) {
    notifiedMessages.clear();
  }
  notifiedMessages.add(key);
  return true;
}

export default {
  inheritAttrs: false,
  props: {
    instance: {
      type: String,
      required: true,
    },
    lobbyId: {
      type: String,
      required: true,
    },
    // Shown as a badge above the messages. Only needed where more than one
    // lobby is on screen at once.
    label: {
      type: String,
      required: false,
      default: "",
    },
    // A single lineup's room, keyed `${matchId}:${lineupId}`. Passing it merges
    // that room into this one: one stream, one input, and a destination toggle,
    // instead of two identical cards stacked on the same page. Absent for every
    // surface that only ever has one room.
    teamLobbyId: {
      type: String,
      required: false,
      default: "",
    },
    type: {
      type: String,
      required: true,
      validator: (value: string) =>
        [
          "match",
          // One side of a match, keyed `${matchId}:${lineupId}`.
          "match_team",
          "matchmaking",
          "organizers",
          "tournament",
          "draft",
          "direct",
        ].includes(value),
    },
    global: {
      type: Boolean,
      default: false,
    },
    playNotificationSound: {
      type: Boolean,
      default: true,
    },
    tabId: {
      type: String,
      required: false,
    },
    frameless: {
      type: Boolean,
      default: false,
    },
    isGlobalContext: {
      // Global floating/tabs context (styling + metadata), separate from Teleport.
      type: Boolean,
      default: false,
    },
    isActiveTab: {
      // Whether this lobby's tab is currently selected in the global tabs UI.
      type: Boolean,
      default: true,
    },
    hideParticipantsSummary: {
      type: Boolean,
      default: false,
    },
    match: {
      type: Object as PropType<unknown>,
      required: false,
    },
    disableAutoFocusOnActivate: {
      type: Boolean,
      default: false,
    },
    canSend: {
      type: Boolean,
      default: true,
    },
    readonlyHint: {
      type: String,
      required: false,
    },
  },
  data() {
    return {
      lobby: undefined as Lobby | undefined,
      teamLobby: undefined as Lobby | undefined,
      isMinimized: false,
      unreadCount: 0,
      lastReadMessageCount: 0,
      showParticipants: false,
      isAtBottom: true,
      // Everyone until told otherwise, every time. A remembered destination is
      // how a team callout ends up in front of the other side.
      sendTo: "everyone" as "everyone" | "team",
      viewFilter: "all" as "all" | "everyone" | "team",
      // Counted per room, but only while the filter is hiding that room --
      // everything on screen has by definition been offered to the reader.
      unseen: { everyone: 0, team: 0 } as Record<string, number>,
    };
  },
  computed: {
    // Two rooms on one panel. Everywhere else this is off and nothing below it
    // changes shape.
    isMerged() {
      return !!this.teamLobbyId;
    },
    // Whether "where did I leave off" is a question worth answering here. The
    // sidebar and the pop-out are surfaces you come back to; so is a panel
    // carrying two rooms at once, which is why the merged one now counts.
    tracksReadPosition() {
      return this.isGlobalContext || this.isMerged;
    },
    // Read straight off the lobby: the message list belongs to the lobby, and
    // every widget on it renders the same one.
    //
    // Merged, the two lists are interleaved and each line is stamped with the
    // room it came from -- the wire format carries no such marker, so this is
    // the only place that knowledge exists.
    messages(): LobbyMessage[] {
      const everyone = this.lobby?.messages ?? NO_MESSAGES;

      if (!this.isMerged) {
        return everyone;
      }

      const team = this.teamLobby?.messages ?? NO_MESSAGES;

      const tagged: LobbyMessage[] = [];
      if (this.viewFilter !== "team") {
        for (const message of everyone) {
          tagged.push({ ...message, __channel: "everyone" });
        }
      }
      if (this.viewFilter !== "everyone") {
        for (const message of team) {
          tagged.push({ ...message, __channel: "team" });
        }
      }

      // Both source lists arrive already sorted, so this only has to settle the
      // interleave. Ties keep everyone ahead of team for a stable order.
      return tagged.sort((a, b) => {
        const delta = chatMessageTime(a) - chatMessageTime(b);
        if (delta !== 0) {
          return delta;
        }
        return (
          (a.__channel === "team" ? 1 : 0) - (b.__channel === "team" ? 1 : 0)
        );
      });
    },
    // Only a single lineup's room is private; the match room admits both sides.
    isTeamContext() {
      return this.type === "match_team";
    },
    everyoneLabel() {
      return this.label || this.$t("chat.everyone");
    },
    teamLabelText() {
      return this.$t("chat.your_team");
    },
    // Handed to the input, which owns the toggle. The hints are the only place
    // the UI can say that the match room is echoed into the game server and a
    // lineup room is not -- nothing on screen shows that difference.
    chatChannels() {
      if (!this.isMerged) {
        return [];
      }

      return [
        {
          value: "everyone",
          label: this.everyoneLabel,
          hint: this.$t("chat.everyone_hint"),
          placeholder: this.$t("chat.message_placeholder"),
          tone: "muted",
        },
        {
          value: "team",
          label: this.teamLabelText,
          hint: this.$t("chat.team_hint"),
          placeholder: this.$t("chat.message_placeholder_team"),
          tone: "amber",
        },
      ];
    },
    viewFilters() {
      if (!this.isMerged) {
        return [];
      }

      return [
        { value: "all", label: this.$t("chat.all") },
        { value: "everyone", label: this.everyoneLabel },
        { value: "team", label: this.$t("chat.team_tag") },
      ];
    },
    viewFilterIndex() {
      return Math.max(
        0,
        this.viewFilters.findIndex(
          (option) => option.value === this.viewFilter,
        ),
      );
    },
    rightSidebarOffset() {
      const baseOffset = 96;

      if (rightSidebarOpen?.value) {
        return baseOffset + 288;
      }

      return baseOffset;
    },
    // Whose presence the header is reporting. The two rooms admit different
    // people -- the match room lets organizers and both sides in, a lineup room
    // does not -- so these counts are never interchangeable and never summed.
    participantsMap() {
      const key =
        this.isMerged && this.viewFilter === "team"
          ? `match_team:${this.teamLobbyId}`
          : `${this.type}:${this.lobbyId}`;
      return useMatchLobbyStore().lobbyChat[key];
    },
    participants() {
      const map = this.participantsMap as Map<
        string,
        { steam_id: string; name: string; avatar_url?: string }
      >;
      if (!map) {
        return [];
      }
      return Array.from(map.values());
    },
    participantsCount() {
      return this.participants.length;
    },
    matchInfo() {
      if (this.type !== "match") {
        return null;
      }

      if (this.match) {
        return this.match;
      }

      const store = useMatchLobbyStore();
      const matches = (store.myMatches as unknown as any[]) || [];
      return matches.find((m) => m.id === this.lobbyId) || null;
    },
    matchLabel() {
      const match = this.matchInfo as any;
      if (!match) {
        return "";
      }
      return (
        match.label ||
        `${match.lineup_1?.name ?? this.$t("common.tbd")} vs ${match.lineup_2?.name ?? this.$t("common.tbd")}`
      );
    },
    matchStatusText() {
      const match = this.matchInfo as any;
      return match?.e_match_status?.description || "";
    },
    matchScoreText() {
      const match = this.matchInfo as any;
      if (!match?.match_maps || match.match_maps.length === 0) {
        return "";
      }
      let lineup1 = 0;
      let lineup2 = 0;
      for (const mm of match.match_maps) {
        lineup1 += mm.lineup_1_score ?? 0;
        lineup2 += mm.lineup_2_score ?? 0;
      }
      return `${lineup1} - ${lineup2}`;
    },
    matchMapName() {
      const match = this.matchInfo as any;
      if (!match?.match_maps || match.match_maps.length === 0) {
        return "";
      }
      const current = match.match_maps.find((mm: any) => mm.is_current_map);
      const first = current || match.match_maps[0];
      return first?.map?.name || "";
    },
    matchMetaText() {
      const parts: string[] = [];
      if (this.matchStatusText) {
        parts.push(this.matchStatusText);
      }
      if (this.matchMapName) {
        parts.push(this.matchMapName);
      }
      if (this.matchScoreText) {
        parts.push(this.matchScoreText);
      }
      return parts.join(" • ");
    },
    embeddedContainerClasses() {
      if (this.frameless) {
        // Used inside the global tab window – fill available height so the
        // input stays pinned to the bottom even with few messages.
        return "relative flex flex-1 min-h-0 flex-col rounded-b-xl bg-transparent px-3 pb-3 pt-2";
      }

      return "relative flex min-h-[25vh] flex-col rounded-xl bg-muted/50 p-4";
    },
  },
  methods: {
    // The (type, id) pair a destination resolves to. Sending is nothing more
    // than choosing between them.
    channelVisible(channel: "everyone" | "team") {
      return this.viewFilter === "all" || this.viewFilter === channel;
    },
    // What the mark on a filter segment means: pick this and you will see
    // something you have not. "All" carries whatever either room is holding.
    unseenFor(option: string) {
      if (!this.isMerged) {
        return 0;
      }

      if (option === "all") {
        return this.unseen.everyone + this.unseen.team;
      }

      return this.unseen[option] ?? 0;
    },
    channelTarget(channel: "everyone" | "team") {
      return channel === "team" && this.teamLobbyId
        ? { type: "match_team" as ChatType, id: this.teamLobbyId }
        : { type: this.type as ChatType, id: this.lobbyId };
    },
    handleIncomingMessage(
      message: LobbyMessage,
      channel: "everyone" | "team" = "everyone",
    ) {
      const mySteamId = useAuthStore().me?.steam_id;
      const fromSteamId = message?.from?.steam_id;
      const isOwnMessage =
        mySteamId != null &&
        fromSteamId != null &&
        String(fromSteamId) === String(mySteamId);

      if (this.isMinimized && this.global && !isOwnMessage) {
        this.unreadCount++;
      }

      // Only what the filter is actively hiding. A message in a room that is
      // on screen has been shown, whether or not it was read.
      if (this.isMerged && !isOwnMessage && !this.channelVisible(channel)) {
        this.unseen[channel]++;
      }

      // Auto-scroll only when already at the bottom.
      this.safeScrollToBottom(false);

      // Treat our own messages as read everywhere (a parallel ChatLobby
      // instance for the same lobby receives the echo too and would otherwise
      // render a "New" divider on our own text). Otherwise, only advance when
      // actively viewing at the bottom.
      if (
        isOwnMessage ||
        (this.isActiveTab && !this.isMinimized && this.isAtBottom)
      ) {
        this.lastReadMessageCount = this.messages.length;
      }

      // Claimed per room, so a merged panel still rings once for each -- one
      // shared key would let whichever room arrived first mute the other.
      const target = this.channelTarget(channel);
      if (
        this.playNotificationSound &&
        !isOwnMessage &&
        claimNotification(
          `${target.type}:${target.id}:${chatMessageKey(message)}`,
        )
      ) {
        playNotificationSound();
      }

      this.$emit("message-received", {
        tabId: this.tabId,
        message,
        direction: isOwnMessage ? "outbound" : "inbound",
      });
    },
    toggleMinimize() {
      this.isMinimized = !this.isMinimized;
    },
    safeScrollToBottom(force = false) {
      this.$nextTick(() => {
        const chatMessagesRef = this.$refs.chatMessagesRef as ChatMessagesRef;
        if (
          chatMessagesRef &&
          typeof chatMessagesRef.scrollToBottom === "function"
        ) {
          chatMessagesRef.scrollToBottom(force);
        }
      });
    },
    handleSendMessage(message: string, destination?: string) {
      const channel = (destination ?? this.sendTo) as "everyone" | "team";
      const target = this.channelTarget(channel);

      socket.chat(target.type, target.id, message);
      // Sending to the other room from the keyboard is a one-off; the pills do
      // not move, because the next line is almost always going back where the
      // conversation was.
      if (this.viewFilter !== "all" && this.viewFilter !== channel) {
        this.viewFilter = "all";
      }
      // Snap to latest after sending.
      this.safeScrollToBottom(true);
      // Sending a message counts as catching up – clear the \"New\" line.
      this.lastReadMessageCount = this.messages.length + 1;
      this.$emit("message-received", {
        tabId: this.tabId,
        message,
        direction: "outbound",
      });
    },
    handleBottomStateChange(atBottom: boolean) {
      this.isAtBottom = atBottom;
    },
    handleJumpToBottom() {
      this.safeScrollToBottom(true);
      // Jumping to bottom counts as reading everything currently in view, so
      // advance the lastReadMessageCount to the latest message.
      this.lastReadMessageCount = this.messages.length;
    },
    handleJumpToNewLine() {
      this.$nextTick(() => {
        const chatMessagesRef = this.$refs.chatMessagesRef as ChatMessagesRef;
        if (
          chatMessagesRef &&
          typeof chatMessagesRef.scrollToNewDivider === "function"
        ) {
          chatMessagesRef.scrollToNewDivider();
        }
      });
    },
  },
  watch: {
    // Showing a room again is what clears its mark -- the messages it was
    // holding are on screen the moment the filter widens.
    viewFilter: {
      handler() {
        for (const channel of ["everyone", "team"] as const) {
          if (this.channelVisible(channel)) {
            this.unseen[channel] = 0;
          }
        }
      },
    },
    lobbyId: {
      immediate: true,
      handler() {
        this.lobby?.leave();

        const lobby = socket.joinLobby(
          this.instance,
          this.type as ChatType,
          this.lobbyId,
        );

        // Kept out of the reactivity graph: the handle is a stable façade, and
        // the message list it exposes carries its own reactivity.
        this.lobby = markRaw(lobby);

        // Initialize lastReadMessageCount only the first time we join this
        // lobby. Read off the rendered stream rather than this one handle, so a
        // merged panel counts both rooms.
        if (this.lastReadMessageCount === 0) {
          this.lastReadMessageCount = this.messages.length;
        }

        lobby.on("lobby:chat", (message: LobbyMessage) => {
          this.handleIncomingMessage(message, "everyone");
        });
      },
    },
    // The second room. joinLobby is refcounted per call and hands back its own
    // handle, so holding two at once is the same thing the match page and the
    // sidebar tab already do for the same room.
    teamLobbyId: {
      immediate: true,
      handler(teamLobbyId: string) {
        this.teamLobby?.leave();
        this.teamLobby = undefined;

        if (!teamLobbyId) {
          // Nothing to send to, so nothing to point at either.
          this.sendTo = "everyone";
          this.viewFilter = "all";
          return;
        }

        const lobby = socket.joinLobby(
          this.instance,
          "match_team",
          teamLobbyId,
        );

        this.teamLobby = markRaw(lobby);

        if (this.lastReadMessageCount === 0) {
          this.lastReadMessageCount = this.messages.length;
        }

        lobby.on("lobby:chat", (message: LobbyMessage) => {
          this.handleIncomingMessage(message, "team");
        });
      },
    },
    messages: {
      immediate: true,
      handler(current, prev) {
        this.safeScrollToBottom(!prev || prev.length === 0);
      },
    },
    isMinimized: {
      handler(minimized) {
        if (!minimized) {
          this.unreadCount = 0;
          this.$nextTick(() => {
            this.safeScrollToBottom(true);
          });
        }
      },
    },
    isActiveTab: {
      handler(active) {
        // When leaving the tab, consider everything read so the \"New\" line
        // and jump pill are cleared the next time it's opened.
        if (!active) {
          this.lastReadMessageCount = this.messages.length;
          return;
        }

        // When activating a tab, always jump to the bottom so the latest
        // messages are immediately visible, and optionally focus the input.
        if (active && !this.isMinimized) {
          this.safeScrollToBottom(true);
          if (!this.disableAutoFocusOnActivate) {
            this.$nextTick(() => {
              const chatInput = this.$refs.chatInputRef as any;
              if (chatInput) {
                if (typeof chatInput.focus === "function") {
                  chatInput.focus();
                } else if (chatInput.$el) {
                  // Fallback: try to focus the first input inside the component root.
                  const el = chatInput.$el.querySelector(
                    "input, textarea, [tabindex]",
                  ) as HTMLElement | null;
                  el?.focus();
                }
              }
            });
          }
        }
      },
    },
  },
  beforeUnmount() {
    this.lobby?.leave();
    this.teamLobby?.leave();
  },
};
</script>
