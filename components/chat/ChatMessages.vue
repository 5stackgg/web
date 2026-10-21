<template>
  <div
    v-if="variant !== 'global' || !isMinimized"
    ref="chatMessages"
    :class="
      variant === 'global'
        ? 'min-h-0 flex-1 overflow-y-auto p-3'
        : 'min-h-0 flex-1 overflow-y-auto'
    "
  >
    <!-- One fixed height whatever it says, so a page landing above never moves
         the line being read by this row changing too. -->
    <div
      v-if="history"
      role="status"
      aria-live="polite"
      :aria-label="$t('chat.older_messages')"
      class="flex h-7 items-center justify-center text-[11px] text-muted-foreground/70"
      data-chat-history-edge
    >
      <Transition
        mode="out-in"
        enter-from-class="opacity-0"
        enter-active-class="transition-opacity duration-150 ease-out motion-reduce:transition-none"
        leave-active-class="transition-opacity duration-100 ease-in motion-reduce:transition-none"
        leave-to-class="opacity-0"
      >
        <span
          v-if="history.loading"
          key="loading"
          class="inline-flex items-center gap-1.5"
        >
          <Spinner class="h-3 w-3" aria-hidden="true" />
          {{ $t("chat.loading_older") }}
        </span>
        <span
          v-else-if="!history.more"
          key="end"
          class="flex w-full items-center gap-2"
        >
          <span class="h-px flex-1 bg-border/60"></span>
          {{ $t("chat.no_older_messages") }}
          <span class="h-px flex-1 bg-border/60"></span>
        </span>
      </Transition>
    </div>
    <!-- Changing the filter rewrites nearly every row, and animating those in
         and out against each other put two sets of text on the same pixels.
         The whole list leaves before the replacement arrives instead -- one
         thing on screen at a time, which is the only version that reads. -->
    <Transition
      mode="out-in"
      enter-from-class="opacity-0"
      enter-active-class="transition-opacity duration-200 ease-out"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
      @after-enter="scrollToBottom(true)"
    >
      <!-- Keyed on the filter, so it swaps only when the filter does. A message
         merely arriving leaves the key alone and animates on its own below. -->
      <TransitionGroup
        :key="groupKey"
        tag="div"
        enter-from-class="opacity-0 translate-y-1"
        enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="hidden"
      >
        <div
          v-for="(message, index) in messages"
          :key="messageKey(message)"
          :data-chat-key="messageKey(message)"
        >
          <div
            v-if="
              lastReadCount > 0 &&
              lastReadCount < messages.length &&
              index === lastReadCount
            "
            class="relative my-2 flex items-center text-[11px] text-red-400"
            data-new-divider="true"
          >
            <div class="flex-1 h-px bg-red-500/60"></div>
            <span
              class="mx-2 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/60"
            >
              {{ $t("chat.new_since_last_visit", "New") }}
            </span>
            <div class="flex-1 h-px bg-red-500/60"></div>
          </div>
          <ChatMessage
            :message="message"
            :previous-message="messages[index - 1]"
            :next-message="messages[index + 1]"
            :after-media="afterMedia[index]"
            :room="messageRoom ? messageRoom(message) : null"
            :can-moderate="canModerate"
            :can-post="canPost"
            :editing="!!message.id && message.id === editingId"
            @edit="startEditing(message.id)"
            @edit-end="stopEditing(message.id)"
          />
        </div>
      </TransitionGroup>
    </Transition>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import ChatMessage from "~/components/chat/ChatMessage.vue";
import { Spinner } from "~/components/ui/spinner";
import { chatMessageKey } from "~/web-sockets/Socket";
import { continuesChatRun, hasChatMedia } from "~/utilities/chatLobbyMessages";
import { chatMessagePermissions } from "~/utilities/chatMessageActions";
import type {
  ChatType,
  LobbyHistory,
  LobbyMessage,
} from "~/web-sockets/Socket";

// How near the top a scroll has to come to ask for the page before.
const LOAD_OLDER_WITHIN_PX = 80;

export default {
  components: {
    ChatMessage,
    Spinner,
  },
  props: {
    messages: {
      type: Array as () => any[],
      required: true,
    },
    variant: {
      type: String,
      default: "embedded",
      validator: (value: string) => ["global", "embedded"].includes(value),
    },
    isMinimized: {
      type: Boolean,
      default: false,
    },
    lastReadCount: {
      type: Number,
      default: 0,
    },
    // Changes when the surface is showing a different slice of the same room.
    // Constant everywhere that only ever shows one thing, which is every
    // surface but the merged match panel.
    groupKey: {
      type: String,
      default: "",
    },
    // Which room a line belongs to, for acting on it. Hand back the same object
    // for the same room, or every row re-renders on every new message.
    messageRoom: {
      type: Function as PropType<
        (message: LobbyMessage) => { type: ChatType; id: string } | null
      >,
      required: false,
    },
    canModerate: {
      type: Boolean,
      default: false,
    },
    canPost: {
      type: Boolean,
      default: false,
    },
    // What is left to page back to. Null where the api does not page.
    history: {
      type: Object as PropType<LobbyHistory>,
      default: null,
    },
  },
  emits: ["bottom-state-change", "edit-last-end", "load-older"],
  data() {
    return {
      isAtBottom: false,
      // Where this component last scrolled the list to, so the scroll event
      // that follows is not taken for the reader's.
      scrolledTo: null as number | null,
      // Set by the room when an older page has landed: once the lines are in
      // and the reading position kept, the top is checked again.
      pageLanded: false,
      editingId: null as string | null,
      editingFromComposer: false,
    };
  },
  methods: {
    messageKey(message: any) {
      return chatMessageKey(message);
    },
    startEditing(messageId: string) {
      this.editingId = messageId;
      this.editingFromComposer = false;
    },
    stopEditing(messageId?: string) {
      if (this.editingId === messageId) {
        this.editingId = null;

        if (this.editingFromComposer) {
          this.$emit("edit-last-end");
        }
      }
    },
    // Up from an empty composer: the newest line the viewer can still change.
    // The composer gets focus back once it is saved or dropped.
    editLast() {
      const me = useAuthStore().me;

      for (let index = this.messages.length - 1; index >= 0; index--) {
        const message = this.messages[index];
        const room = this.messageRoom?.(message);

        if (
          room &&
          chatMessagePermissions({
            message,
            viewerSteamId: me?.steam_id,
            viewerGagged: !!me?.is_gagged,
            canModerate: this.canModerate,
            canPost: this.canPost,
            roomType: room.type,
          }).canEdit
        ) {
          this.editingId = message.id;
          this.editingFromComposer = true;
          return;
        }
      }
    },
    checkIfAtBottom() {
      const chatMessages = this.$refs.chatMessages as HTMLElement;
      if (chatMessages) {
        const { scrollTop, scrollHeight, clientHeight } = chatMessages;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
        this.isAtBottom = atBottom;
        this.$emit("bottom-state-change", atBottom);
      }
    },
    // A scroll that moves nothing fires no event, so only one that moved is
    // waited for.
    scrollListTo(top: number) {
      const chatMessages = this.$refs.chatMessages as HTMLElement;
      const from = chatMessages.scrollTop;
      chatMessages.scrollTop = top;
      this.scrolledTo =
        chatMessages.scrollTop === from ? null : chatMessages.scrollTop;
    },
    // Only the reader asks for more by scrolling. A scroll this component made
    // -- to the bottom on opening, back to the line being read -- does not.
    onScroll() {
      const chatMessages = this.$refs.chatMessages as HTMLElement;
      const ours =
        this.scrolledTo !== null &&
        Math.abs(chatMessages.scrollTop - this.scrolledTo) <= 1;
      this.scrolledTo = null;

      this.checkIfAtBottom();

      if (!ours) {
        this.checkIfNearTop();
      }
    },
    // A list too short to scroll never scrolls; wheeling up over it is the
    // same ask.
    onWheel(event: WheelEvent) {
      if (event.deltaY < 0) {
        this.checkIfNearTop();
      }
    },
    markPageLanded() {
      this.pageLanded = true;
    },
    // A list too short to scroll is at the top already. One with no height
    // at all is hidden, and asks for nothing.
    checkIfNearTop() {
      const chatMessages = this.$refs.chatMessages as HTMLElement;
      if (
        !chatMessages ||
        !this.history?.more ||
        this.history.loading ||
        chatMessages.clientHeight === 0 ||
        chatMessages.scrollTop > LOAD_OLDER_WITHIN_PX
      ) {
        return;
      }

      this.$emit("load-older");
    },
    // The first line whose bottom is on screen, and where it is now.
    readingAnchor() {
      const chatMessages = this.$refs.chatMessages as HTMLElement;
      if (!chatMessages) {
        return null;
      }

      const top = chatMessages.getBoundingClientRect().top;
      for (const element of chatMessages.querySelectorAll<HTMLElement>(
        "[data-chat-key]",
      )) {
        const rect = element.getBoundingClientRect();
        if (rect.bottom > top) {
          return { key: element.dataset.chatKey, top: rect.top };
        }
      }

      return null;
    },
    // Lines landing above the one being read push it down by their height;
    // scrolling by the same amount leaves it where it was. A browser that
    // anchored the scroll itself has already put it back, and this moves
    // nothing.
    keepReadingAnchor(anchor: { key?: string; top: number } | null) {
      const chatMessages = this.$refs.chatMessages as HTMLElement;
      if (!chatMessages || !anchor?.key) {
        return;
      }

      const element = chatMessages.querySelector<HTMLElement>(
        `[data-chat-key="${CSS.escape(anchor.key)}"]`,
      );
      if (!element) {
        return;
      }

      const moved = element.getBoundingClientRect().top - anchor.top;
      if (moved !== 0) {
        this.scrollListTo(chatMessages.scrollTop + moved);
      }
    },
    scrollToBottom(force = false) {
      const chatMessages = this.$refs.chatMessages as HTMLElement;
      if (chatMessages && (this.isAtBottom || force)) {
        this.scrollListTo(chatMessages.scrollHeight);
      }
    },
    scrollToNewDivider() {
      if (
        this.lastReadCount <= 0 ||
        this.lastReadCount >= this.messages.length
      ) {
        return;
      }
      const chatMessages = this.$refs.chatMessages as HTMLElement;
      if (!chatMessages) {
        return;
      }
      const divider = chatMessages.querySelector(
        "[data-new-divider='true']",
      ) as HTMLElement | null;
      if (!divider) {
        return;
      }
      // Measured rather than read off offsetTop: the transition group is a
      // positioned element now, so it -- not the scroller -- is the offset
      // parent, and offsetTop would be short by the scroller's padding.
      const offset =
        divider.getBoundingClientRect().top -
        chatMessages.getBoundingClientRect().top +
        chatMessages.scrollTop;
      const targetTop = offset - Math.max(0, chatMessages.clientHeight / 3);
      this.scrollListTo(targetTop < 0 ? 0 : targetTop);
      this.checkIfAtBottom();
    },
  },
  computed: {
    // Media in a run takes the avatar's column, so every line after it in the
    // same run starts at the media's edge rather than an empty gutter.
    afterMedia() {
      let seen = false;

      return this.messages.map((message, index) => {
        if (!continuesChatRun(this.messages[index - 1], message)) {
          seen = false;
        }

        const after = seen;
        seen ||= hasChatMedia(message);

        return after;
      });
    },
  },
  watch: {
    messages: {
      handler(current, prev) {
        if (
          this.editingId &&
          !current.some((message: any) => message?.id === this.editingId)
        ) {
          this.editingId = null;
        }

        // Read before the list re-renders: the watcher runs ahead of it.
        const anchor =
          prev.length > 0 && !this.isAtBottom ? this.readingAnchor() : null;

        this.$nextTick(() => {
          this.keepReadingAnchor(anchor);
          this.scrollToBottom(prev.length === 0);
          this.checkIfAtBottom();

          // A page that leaves the list still short of the top asks for the
          // next; one that failed or brought nothing never gets here.
          if (this.pageLanded) {
            this.pageLanded = false;
            this.checkIfNearTop();
          }
        });
      },
    },
  },
  mounted() {
    const chatMessages = this.$refs.chatMessages as HTMLElement;
    if (chatMessages) {
      chatMessages.addEventListener("scroll", this.onScroll);
      chatMessages.addEventListener("wheel", this.onWheel, { passive: true });
      this.checkIfAtBottom();
    }
  },
  beforeUnmount() {
    const chatMessages = this.$refs.chatMessages as HTMLElement;
    if (chatMessages) {
      chatMessages.removeEventListener("scroll", this.onScroll);
      chatMessages.removeEventListener("wheel", this.onWheel);
    }
  },
};
</script>
