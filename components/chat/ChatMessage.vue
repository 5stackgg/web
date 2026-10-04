<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import TimeAgo from "~/components/TimeAgo.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import ChatMessageActions from "~/components/chat/ChatMessageActions.vue";
import ChatMessageEditor from "~/components/chat/ChatMessageEditor.vue";
import ChatMessageReactions from "~/components/chat/ChatMessageReactions.vue";
import ChatMessageMedia from "~/components/chat/ChatMessageMedia.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
</script>

<template>
  <div
    :class="rowClasses"
    :style="{ paddingTop: `${padTopRem}rem` }"
    @pointerenter="hovered = $event.pointerType !== 'touch'"
    @pointerleave="hovered = false"
  >
    <!-- One rail down a whole run of team lines. Rows inside a run carry no
         margin, so the segments meet and read as a single stroke; a border per
         row broke into dashes the moment two people spoke in a row. -->
    <span
      v-if="isTeamMessage"
      class="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-[hsl(var(--tac-amber)/0.55)]"
      :class="[
        startsTeamRun ? 'rounded-t-full' : '',
        endsTeamRun ? 'rounded-b-full' : '',
      ]"
    ></span>

    <!-- Grouped lines carry no name and no time, which is what makes a run
         readable -- but the time still has to be recoverable, so it comes back
         in the gutter the avatar left empty, on hover. -->
    <span
      v-if="!showMeta"
      class="pointer-events-none absolute left-0 w-12 pr-2 text-right font-mono text-[10px] leading-snug text-muted-foreground/70 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      :style="{ top: `calc(${padTopRem}rem + 1px)` }"
    >
      {{ clockTime }}
    </span>

    <!-- Offset by the row's own top padding. Absolute children measure from the
         padding edge, so a padded team row would drop its text without moving
         the avatar, and the two would sit on different lines. -->
    <div
      v-if="showMeta"
      class="absolute left-2"
      :style="{ top: `${padTopRem}rem` }"
    >
      <PlayerDisplay
        :player="message.from"
        size="sm"
        :compact="true"
        :align-top="true"
        :show-online="false"
        :show-elo="false"
        :show-steam-id="false"
        :tooltip="false"
        :linkable="true"
        :show-name="false"
        :show-flag="false"
        :show-role="false"
      />
    </div>

    <div>
      <div
        v-if="showMeta"
        class="flex items-center space-x-1.5 text-muted-foreground text-xs"
      >
        <h4 class="font-semibold truncate max-w-[160px] text-foreground/90">
          {{ message.from.name }}
        </h4>
        <span class="whitespace-nowrap text-[10px] text-muted-foreground/70">
          <time-ago :date="message.timestamp" hide-icon></time-ago>
        </span>
        <span
          v-if="authorBlocked"
          class="shrink-0 font-mono text-[0.5rem] font-bold uppercase leading-none tracking-[0.16em] text-muted-foreground/70"
        >
          {{ $t("player_blocks.blocked_badge") }}
        </span>
        <!-- Which room, not who is speaking, so it sits away from the name --
             and only where the run starts, since the rail says the rest. -->
        <span
          v-if="isTeamMessage && startsTeamRun"
          class="ml-auto shrink-0 font-mono text-[0.5rem] font-bold uppercase leading-none tracking-[0.16em] text-[hsl(var(--tac-amber)/0.85)]"
        >
          {{ $t("chat.team_tag") }}
        </span>
      </div>
      <ChatMessageEditor
        v-if="editing && room"
        :message="message"
        :room="room"
        @close="endEdit"
      />
      <p
        v-else-if="hasText"
        class="text-[13px] leading-snug break-words whitespace-pre-wrap"
      >
        <span>{{ message.message }}</span>
        <FiveStackToolTip
          v-if="editedAtLabel"
          as-child
          :delay-duration="120"
          side="top"
        >
          <template #trigger>
            <span
              tabindex="0"
              class="ml-1 whitespace-nowrap rounded-sm text-[10px] text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-chat-edited
            >
              {{ $t("chat.edited") }}
            </span>
          </template>
          {{ $t("chat.edited_at", { time: editedAtLabel }) }}
        </FiveStackToolTip>
      </p>
      <ChatMessageMedia v-if="hasMedia" :message="message" />
      <ChatMessageReactions
        :message="message"
        :room="room"
        :permissions="permissions"
        :viewer-steam-id="viewerSteamId"
        @toggle="toggleReaction"
      />
    </div>

    <!-- Floats over the top edge of the line, as the frame is taller than a
         line of chat and would otherwise hide the text it acts on. -->
    <ChatMessageActions
      v-if="hasActions && !editing"
      ref="actions"
      class="absolute right-0.5 z-10"
      :style="{ top: `calc(${padTopRem}rem - 0.75rem)` }"
      :hovered="hovered"
      :message="message"
      :room="room"
      :permissions="permissions"
      :own="isOwnMessage"
      :viewer-steam-id="viewerSteamId"
      @open="recheckPermissions"
      @expired="permissionsCheckedAt = Date.now()"
      @edit="$emit('edit')"
      @react="toggleReaction"
    />
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import socket, { type ChatType } from "~/web-sockets/Socket";
import type { ChatReaction } from "~/constants/chat";
import { toast } from "@/components/ui/toast";
import { toastChatError, type ChatError } from "~/utilities/chatErrors";
import {
  chatMessagePermissions,
  hasChatMessageActions,
  isOwnChatMessage,
} from "~/utilities/chatMessageActions";
import { usePlayerBlocks } from "~/composables/usePlayerBlocks";

export default {
  props: {
    message: {
      type: Object,
      required: false,
    },
    previousMessage: {
      type: Object,
      required: false,
    },
    nextMessage: {
      type: Object,
      required: false,
    },
    // The room this line lives in. Without one there is nothing to act on, so
    // no actions are offered.
    room: {
      type: Object as PropType<{ type: ChatType; id: string } | null>,
      default: null,
    },
    canModerate: {
      type: Boolean,
      default: false,
    },
    canPost: {
      type: Boolean,
      default: false,
    },
    editing: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["edit", "edit-end"],
  data() {
    return {
      // Not a ticking clock: the menu refreshes it when it opens.
      permissionsCheckedAt: Date.now(),
      hovered: false,
    };
  },
  methods: {
    // A menu opened after the window closed has nothing left to offer, so the
    // trigger goes and the reason is given instead of an empty menu.
    recheckPermissions() {
      this.permissionsCheckedAt = Date.now();

      if (!hasChatMessageActions(this.permissions)) {
        toast({ title: this.$t("chat.own_message_window_closed") });
      }
    },
    toggleReaction(reaction: ChatReaction) {
      if (!this.room || !this.message?.id) {
        return;
      }

      socket
        .react(this.room.type, this.room.id, this.message.id, reaction)
        .catch((error: ChatError) => toastChatError(error));
    },
    // Focus goes back to the trigger the edit came from, if the window still
    // leaves it anything to offer, rather than falling to the page. An edit
    // started from the composer has already been handed back there.
    endEdit() {
      this.permissionsCheckedAt = Date.now();
      this.$emit("edit-end");

      void this.$nextTick(() => {
        if (
          document.activeElement &&
          document.activeElement !== document.body
        ) {
          return;
        }

        const actions = this.$refs.actions as
          { focusTrigger?: () => void } | undefined;

        actions?.focusTrigger?.();
      });
    },
  },
  computed: {
    hasText() {
      return !!this.message?.message?.trim();
    },
    hasMedia() {
      return (this.message?.attachments?.length ?? 0) > 0 || !!this.message?.gif;
    },
    viewerSteamId() {
      return useAuthStore().me?.steam_id ?? null;
    },
    isOwnMessage() {
      return isOwnChatMessage(this.message, this.viewerSteamId);
    },
    // Not gated on role or room: only a moderator in a group room is ever sent
    // a blocked player's line to begin with.
    authorBlocked() {
      return usePlayerBlocks().isBlocked(this.message?.from?.steam_id);
    },
    permissions() {
      return chatMessagePermissions({
        message: this.message,
        viewerSteamId: this.viewerSteamId,
        viewerGagged: !!useAuthStore().me?.is_gagged,
        canModerate: this.canModerate,
        canPost: this.canPost,
        roomType: this.room?.type ?? "",
        now: this.permissionsCheckedAt,
      });
    },
    editedAtLabel() {
      const editedAt = new Date(this.message?.edited_at ?? NaN);

      if (Number.isNaN(editedAt.getTime())) {
        return "";
      }

      return editedAt.toLocaleString(dateLocale(), {
        dateStyle: "medium",
        timeStyle: "short",
      });
    },
    hasActions() {
      return !!this.room && hasChatMessageActions(this.permissions);
    },
    // A gagged player's trigger comes and goes with the reactions they hold,
    // so the room for it is kept wherever reacting is possible at all.
    reservesActions() {
      return (
        this.hasActions ||
        (!!this.room &&
          this.canPost &&
          !!this.message?.id &&
          !!this.viewerSteamId)
      );
    },
    // Stamped by ChatLobby when it merges the match room with a lineup room.
    // Absent everywhere else, which is what keeps every other chat surface
    // rendering exactly as before.
    isTeamMessage() {
      return this.message?.__channel === "team";
    },
    // Wall clock rather than "5 minutes ago": this only shows on hover over a
    // grouped line, where the question is when that line landed relative to the
    // ones around it, not how long ago it was.
    clockTime() {
      const time = new Date(this.message?.timestamp);

      if (Number.isNaN(time.getTime())) {
        return "";
      }

      return time.toLocaleTimeString(dateLocale(), {
        hour: "numeric",
        minute: "2-digit",
      });
    },
    // A run is consecutive team lines, whoever is speaking -- the rail marks
    // the room, not the speaker, so it should not break when the speaker
    // changes.
    startsTeamRun() {
      return this.previousMessage?.__channel !== "team";
    },
    endsTeamRun() {
      return this.nextMessage?.__channel !== "team";
    },
    // Kept in one place so the row's padding and the absolute children that
    // have to match it can never drift apart.
    padTopRem() {
      if (!this.isTeamMessage) {
        return 0;
      }

      if (this.startsTeamRun) {
        return 0.375;
      }

      return this.showMeta ? 0.625 : 0.25;
    },
    rowClasses() {
      // Same gutter either way. The rail is drawn inside it rather than added
      // to it, so a team line starts on the same column as every other line and
      // the avatars stay in one straight edge down the list.
      const classes = [
        "group group/chat-message relative isolate pl-12 text-[13px] leading-snug",
        // Lifts the line under the pointer, and holds it while one of its menus
        // is open and the pointer has gone into it.
        "before:pointer-events-none before:absolute before:-z-10 before:rounded-sm before:transition-colors before:duration-150 [@media(hover:hover)]:hover:before:bg-muted/25 has-[[data-chat-menu-open]]:before:bg-muted/40",
      ];

      // Room for the actions trigger kept whether or not it is showing, so a
      // hover never rewraps the line under the pointer.
      if (this.reservesActions) {
        classes.push("pr-7");
      }

      if (!this.isTeamMessage) {
        classes.push(
          "before:inset-x-0 before:-inset-y-0.5",
          this.isSameSender && this.isCloseTogether ? "mt-1" : "mt-3",
        );
        return classes;
      }

      classes.push("bg-[hsl(var(--tac-amber)/0.05)] before:inset-0");
      if (!this.reservesActions) {
        classes.push("pr-2");
      }

      // Inside a run the separation between speakers is padding, not margin, so
      // the tinted block and the rail stay unbroken. The amount comes from
      // padTopRem, which the avatar reads too.
      classes.push(this.startsTeamRun ? "mt-3 rounded-t-sm" : "mt-0");
      classes.push(this.endsTeamRun ? "rounded-b-sm pb-1.5" : "pb-0");

      return classes;
    },
    isSameSender() {
      if (!this.previousMessage) {
        return false;
      }
      // Same player, different room is not the same speaker as far as this
      // stream is concerned -- grouping the second line under the first would
      // hand it the wrong rail and hide which room it went to.
      if (this.previousMessage.__channel !== this.message.__channel) {
        return false;
      }
      return (
        String(this.message.from?.steam_id) ===
        String(this.previousMessage.from?.steam_id)
      );
    },
    isCloseTogether() {
      if (!this.isSameSender || !this.previousMessage) {
        return false;
      }
      const previousTimestamp = new Date(this.previousMessage.timestamp);
      const messageTimestamp = new Date(this.message.timestamp);

      messageTimestamp.setMinutes(messageTimestamp.getMinutes() - 5);

      return previousTimestamp > messageTimestamp;
    },
    showMeta() {
      return !this.isSameSender || !this.isCloseTogether;
    },
  },
};
</script>
