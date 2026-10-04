<script setup lang="ts">
import { CornerDownLeft } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import ChatAttachmentTray from "~/components/chat/ChatAttachmentTray.vue";
import ChatAttachMenu from "~/components/chat/ChatAttachMenu.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";

// Browsers key saved form history to the field's name, and several of them
// ignore autocomplete="off". A name that is never the same twice means there is
// no bucket to remember into, and none of the old ones match.
const fieldName = `chat-message-${Math.random().toString(36).slice(2, 10)}`;
</script>

<template>
  <div
    :class="
      variant === 'global'
        ? 'flex flex-shrink-0 flex-col gap-2 border-t bg-background p-3'
        : 'flex flex-col gap-1.5'
    "
  >
    <!-- Where the message is going, decided before it is typed rather than
         after. Two rooms used to mean two identical boxes and no way to tell
         which one you were about to shout into. -->
    <div
      v-if="hasChannels"
      class="flex items-center justify-between gap-2 px-0.5"
    >
      <!-- One track with a travelling marker rather than two lamps that blink
           on and off. The destination changing is a movement, and reading it as
           one makes it obvious which way it went. -->
      <div
        class="relative grid grid-cols-2 rounded-md border border-border/60 bg-background/50 p-[2px]"
      >
        <span
          class="pointer-events-none absolute inset-y-[2px] left-[2px] w-[calc(50%-2px)] rounded-sm ring-1 ring-inset transition-[transform,background-color,box-shadow] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
          :class="[
            activeChannelIndex === 1 ? 'translate-x-full' : 'translate-x-0',
            isAmber
              ? 'bg-[hsl(var(--tac-amber)/0.16)] ring-[hsl(var(--tac-amber)/0.55)]'
              : 'bg-muted/70 ring-border',
          ]"
        ></span>
        <FiveStackToolTip
          v-for="channel in channels"
          :key="channel.value"
          as-child
          :delay-duration="120"
          side="top"
          align="start"
          :tap-toggle="false"
        >
          <template #trigger>
            <button
              type="button"
              class="relative z-10 inline-flex items-center justify-center px-2 py-[3px] font-mono text-[0.55rem] font-bold uppercase leading-none tracking-[0.14em] transition-colors duration-200"
              :class="pillClasses(channel)"
              @mousedown.prevent
              @click="selectChannel(channel.value)"
            >
              {{ channel.label }}
            </button>
          </template>
          <p class="font-medium">{{ channel.label }}</p>
          <p
            v-if="channel.hint"
            class="mt-0.5 max-w-[16rem] break-words text-[0.7rem] opacity-70"
          >
            {{ channel.hint }}
          </p>
          <p
            v-if="channel.value !== activeChannelValue"
            class="mt-0.5 text-[0.7rem] opacity-70"
          >
            {{ $t("chat.send_other_hint", { channel: channel.label }) }}
          </p>
        </FiveStackToolTip>
      </div>

      <!-- Controls that belong to the destination rather than to the text --
           the team voice channel is the same room as the team pill. -->
      <div class="flex shrink-0 items-center gap-2">
        <slot name="actions"></slot>
      </div>
    </div>

    <form
      autocomplete="off"
      :class="
        variant === 'global'
          ? ''
          : [
              'relative overflow-hidden rounded-lg border bg-background focus-within:ring-1',
              // Eased, because this changes at the same instant the marker
              // above starts moving and two snaps at once read as a flicker.
              'transition-[border-color,box-shadow] duration-300 ease-out',
              isAmber
                ? 'border-[hsl(var(--tac-amber)/0.45)] focus-within:ring-[hsl(var(--tac-amber)/0.5)]'
                : 'focus-within:ring-ring',
            ]
      "
      @submit.prevent="sendMessage()"
    >
      <Fold :open="tray.items.length > 0">
        <div
          :class="variant === 'global' ? 'mb-2' : 'border-b border-border/60'"
        >
          <ChatAttachmentTray
            :items="tray.items"
            @remove="tray.remove($event)"
            @retry="tray.retry($event)"
          />
        </div>
      </Fold>
      <!-- Typing "/" offers the GIF search, the one command there is. Enter,
           Tab or a click takes it; Esc leaves the text to send as typed. -->
      <Fold :open="gifCommandOffered">
        <div
          :class="
            variant === 'global' ? 'mb-2' : 'border-b border-border/60 p-1'
          "
        >
          <button
            type="button"
            data-chat-gif-command
            class="flex w-full items-center gap-2 rounded-sm bg-accent px-2 py-1.5 text-left text-accent-foreground"
            @mousedown.prevent
            @click="runGifCommand"
          >
            <span class="shrink-0 font-mono text-xs font-semibold">/gif</span>
            <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {{
                gifCommandShown
                  ? $t("chat.gifs.command_search_for", {
                      term: gifCommandShown,
                    })
                  : $t("chat.gifs.search")
              }}
            </span>
            <CornerDownLeft
              class="size-3 shrink-0 text-muted-foreground/70 [@media(hover:none)]:hidden"
            />
          </button>
        </div>
      </Fold>
      <FormField v-slot="{ componentField }" name="message">
        <FormItem>
          <FormControl>
            <div
              :class="
                variant === 'global'
                  ? 'flex gap-2'
                  : 'flex items-center gap-2 p-2'
              "
            >
              <template v-if="canAttach">
                <ChatAttachMenu
                  ref="attachMenu"
                  :gifs="gifsEnabled"
                  @files="openFilePicker"
                  @gif="sendGif"
                  @closed="focus"
                />
                <input
                  ref="fileInput"
                  type="file"
                  class="hidden"
                  multiple
                  :accept="acceptTypes"
                  @change="onFilesPicked"
                  @cancel="releaseHub"
                />
              </template>
              <Textarea
                ref="inputRef"
                rows="1"
                :placeholder="activePlaceholder"
                :aria-label="$t('chat.message_label')"
                v-bind="componentField"
                autocomplete="off"
                :name="fieldName"
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                data-form-type="other"
                :class="[
                  'min-h-0 resize-none py-1.5 leading-snug',
                  variant === 'global'
                    ? 'flex-1 transition-[border-color,box-shadow] duration-200'
                    : 'flex-1 border-0 shadow-none focus-visible:ring-0',
                ]"
                @keydown.enter="onEnter"
                @keydown.tab.exact="onTab"
                @keydown.up="onArrowUp"
                @keydown.esc="onEscape"
                @paste="onPaste"
              />
              <span
                v-if="showRemaining"
                class="shrink-0 self-center font-mono text-[0.6rem] tabular-nums leading-none"
                :class="
                  remainingCharacters < 0
                    ? 'text-destructive'
                    : 'text-muted-foreground/70'
                "
              >
                {{ remainingCharacters }}
              </span>
              <Button
                type="submit"
                size="sm"
                :disabled="tray.busy"
                :loading="sending"
                :aria-label="sendBlockedReason || undefined"
                :title="sendBlockedReason || undefined"
                :min-loading-ms="0"
                :class="
                  variant === 'global'
                    ? 'transition-all duration-200 hover:scale-105'
                    : 'shrink-0 gap-1.5'
                "
              >
                <CornerDownLeft class="size-3.5" />
              </Button>
            </div>
          </FormControl>
        </FormItem>
      </FormField>
    </form>
    <Fold :open="!!sendBlockedReason">
      <FadeSwap>
        <p
          :key="sendBlockedReason"
          class="px-1 pt-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
          aria-live="polite"
        >
          {{ sendBlockedReason }}
        </p>
      </FadeSwap>
    </Fold>
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { chatEnterAction } from "~/utilities/chatInputKeys";
import { toastChatError, type ChatError } from "~/utilities/chatErrors";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_REMAINING_HINT_AT,
} from "~/constants/chat";
import { toast } from "@/components/ui/toast";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { useChatAttachmentConfig } from "~/composables/useChatAttachmentConfig";
import { createChatComposerAttachments } from "~/composables/useChatComposerAttachments";
import {
  discardChatAttachment,
  uploadChatAttachment,
} from "~/composables/chatAttachmentUploads";
import {
  pasteAttachesFiles,
  type ChatFileRejection,
  type ChatGif,
} from "~/utilities/chatAttachments";

export interface ChatInputChannel {
  value: string;
  label: string;
  // Shown in the pill tooltip. The only place the UI can say that one of these
  // rooms is relayed into the game server and the other is not.
  hint?: string;
  placeholder?: string;
  tone?: "amber" | "muted";
}

export default {
  // <script setup> closes the instance to parent refs; ChatLobby focuses the
  // input and hands it files dropped anywhere on the room.
  expose: ["focus", "addFiles"],
  props: {
    variant: {
      type: String,
      default: "embedded",
      validator: (value: string) => ["global", "embedded"].includes(value),
    },
    // Two or more destinations turns on the toggle row. Left empty everywhere a
    // surface only ever has one room, which is every caller but the match page
    // and the draft room.
    channels: {
      type: Array as PropType<ChatInputChannel[]>,
      default: () => [],
    },
    destination: {
      type: String,
      required: false,
    },
    attachmentRoom: {
      type: Object as PropType<{ type: string; id: string } | null>,
      default: null,
    },
  },
  emits: ["sendMessage", "update:destination", "edit-last"],
  watch: {
    attachmentRoomKey: {
      immediate: true,
      handler(current: string, previous?: string) {
        if (previous) {
          this.tray.dispose();
        }

        if (current) {
          void this.mediaConfig.load();
        }
      },
    },
    // Not @input: v-bind="componentField" already binds one, and a second
    // would replace vee-validate's. Watching the value also covers a paste and
    // the reset after sending.
    "form.values.message"() {
      void this.$nextTick(() => this.growToFit());
    },
    // An Esc holds until the box stops reading as the command. The label keeps
    // the last term so it does not change under the row as it folds away.
    gifCommand(term: string | null) {
      if (term === null) {
        this.gifCommandDismissed = false;
      } else {
        this.gifCommandShown = term;
      }
    },
  },
  data() {
    const mediaConfig = useChatAttachmentConfig();

    return {
      mediaConfig,
      tray: createChatComposerAttachments({
        room: () => this.attachmentRoom,
        config: () => mediaConfig.config.value,
        upload: uploadChatAttachment,
        discard: discardChatAttachment,
        onRejected: (rejections: ChatFileRejection[]) =>
          this.toastRejections(rejections),
      }),
      holdingHub: false,
      gone: false,
      gifSentAt: 0,
      gifCommandDismissed: false,
      gifCommandShown: "",
      failedSend: null as { dismiss?: () => void } | null,
      sending: false,
      sendTimer: undefined as ReturnType<typeof setTimeout> | undefined,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            message: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
          }),
        ),
      }),
    };
  },
  computed: {
    hasChannels() {
      return this.channels.length > 1;
    },
    attachmentRoomKey(): string {
      return this.attachmentRoom
        ? `${this.attachmentRoom.type}:${this.attachmentRoom.id}`
        : "";
    },
    canAttach(): boolean {
      return !!this.attachmentRoom && !!this.mediaConfig.config;
    },
    gifsEnabled(): boolean {
      return this.canAttach && !!this.mediaConfig.config?.gifs;
    },
    // What follows "/gif" while the box holds that command, or the start of
    // it, and nothing else.
    gifCommand(): string | null {
      if (!this.gifsEnabled) {
        return null;
      }

      const match = /^\/(\S*)(?:\s+([\s\S]*))?$/.exec(
        this.form.values.message ?? "",
      );

      if (!match) {
        return null;
      }

      const [, name, term] = match;
      const command = name.toLowerCase();

      if (term === undefined ? !"gif".startsWith(command) : command !== "gif") {
        return null;
      }

      return (term ?? "").trim();
    },
    gifCommandOffered(): boolean {
      return this.gifCommand !== null && !this.gifCommandDismissed;
    },
    acceptTypes(): string {
      return (this.mediaConfig.config?.mime_types ?? []).join(",");
    },
    sendBlockedReason(): string {
      const items = this.tray.items as Array<{ status: string }>;

      if (this.tray.sending) {
        return "";
      }

      if (items.some(({ status }) => status === "failed")) {
        return this.$t("chat.attachments.failed_hint");
      }

      if (items.some(({ status }) => status === "uploading")) {
        return this.$t("chat.attachments.waiting_hint");
      }

      return "";
    },
    remainingCharacters(): number {
      const message = this.form.values.message?.trim() ?? "";

      return CHAT_MESSAGE_MAX_LENGTH - message.length;
    },
    showRemaining(): boolean {
      return this.remainingCharacters <= CHAT_REMAINING_HINT_AT;
    },
    activeChannelValue() {
      return this.destination ?? this.channels[0]?.value;
    },
    activeChannel(): ChatInputChannel | undefined {
      return this.channels.find(
        (channel) => channel.value === this.activeChannelValue,
      );
    },
    activeChannelIndex() {
      return Math.max(
        0,
        this.channels.findIndex(
          (channel) => channel.value === this.activeChannelValue,
        ),
      );
    },
    // The one the message goes to on Ctrl/Cmd+Enter. Only meaningful with
    // exactly two, which is the only shape that exists today.
    otherChannelValue() {
      const other = this.channels.find(
        (channel) => channel.value !== this.activeChannelValue,
      );
      return other?.value;
    },
    isAmber() {
      return this.activeChannel?.tone === "amber";
    },
    // Only a channel that needs saying where the message goes has one. A
    // generic "Type a message..." was clipped to "Type a" beside the buttons.
    activePlaceholder() {
      return this.activeChannel?.placeholder;
    },
  },
  beforeUnmount() {
    if (this.sendTimer) {
      clearTimeout(this.sendTimer);
    }

    this.gone = true;
    this.tray.dispose();
    this.releaseHub();
  },
  methods: {
    // Only the text. The marker behind the labels carries the fill and the
    // border, so it can travel between them instead of being redrawn.
    pillClasses(channel: ChatInputChannel) {
      if (channel.value !== this.activeChannelValue) {
        return "text-muted-foreground/60 hover:text-muted-foreground";
      }

      return channel.tone === "amber"
        ? "text-[hsl(var(--tac-amber))]"
        : "text-foreground";
    },
    selectChannel(value: string) {
      this.$emit("update:destination", value);
      // The pill suppresses its own mousedown so the caret never leaves the
      // input; this is only for the case where it was never in it.
      if (document.activeElement !== (this.$refs.inputRef as any)?.$el) {
        this.focus();
      }
    },
    focus() {
      this.$nextTick(() => {
        const el = (this.$refs.inputRef as any)?.$el;
        if (el) el.focus();
      });
    },
    flashSending() {
      this.sending = true;
      if (this.sendTimer) {
        clearTimeout(this.sendTimer);
      }
      this.sendTimer = setTimeout(() => {
        this.sending = false;
        this.sendTimer = undefined;
      }, 1000);
    },
    // Enter sends where the pills say. Ctrl/Cmd+Enter sends this one message to
    // the other room without moving them -- the common case is a single team
    // callout in the middle of talking to everyone.
    onEnter(event: KeyboardEvent) {
      const action = chatEnterAction(event);

      if (action === "newline") {
        return;
      }

      // The box is a textarea now, so nothing submits the form on its own.
      event.preventDefault();

      this.sendMessage(
        action === "send-other" ? this.otherChannelValue : undefined,
      );
    },
    onTab(event: KeyboardEvent) {
      if (!this.gifCommandOffered) {
        return;
      }

      event.preventDefault();
      this.runGifCommand();
    },
    // Up from an empty box picks up the last line sent, to fix it.
    onArrowUp(event: KeyboardEvent) {
      if (
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        this.form.values.message
      ) {
        return;
      }

      event.preventDefault();
      this.$emit("edit-last");
    },
    onEscape(event: KeyboardEvent) {
      if (!this.gifCommandOffered || event.isComposing) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.gifCommandDismissed = true;
    },
    // The search takes the term in its own box, so the command leaves this one.
    runGifCommand() {
      const term = this.gifCommand ?? "";

      this.form.resetForm();
      (
        this.$refs.attachMenu as
          { searchGifs?: (term: string) => void } | undefined
      )?.searchGifs?.(term);
    },
    // One line until the message needs more, then up to five.
    growToFit() {
      const field = this.$refs.inputRef?.$el ?? this.$refs.inputRef;

      if (!field) {
        return;
      }

      field.style.height = "auto";
      field.style.height = `${Math.min(field.scrollHeight, 120)}px`;
    },
    sendMessage(destination?: string) {
      if (this.gifCommandOffered) {
        this.runGifCommand();
        return;
      }

      const message = this.form.values.message?.trim() ?? "";
      const hasFiles = this.tray.items.length > 0;

      if (!message && !hasFiles) {
        return;
      }
      if (this.tray.busy) {
        return;
      }
      if (message.length > CHAT_MESSAGE_MAX_LENGTH) {
        toastChatError({ code: "too_long", max: CHAT_MESSAGE_MAX_LENGTH });
        return;
      }

      const target = destination ?? this.activeChannelValue ?? undefined;

      if (!hasFiles) {
        this.$emit("sendMessage", message, target);
        this.form.resetForm();
        this.flashSending();
        return;
      }

      // The files and the text stay until the room answers: a refusal hands
      // them back rather than leaving them stranded upload-side.
      this.$emit("sendMessage", message, target, {
        attachments: this.tray.beginSend(),
        delivered: (request: Promise<void>) => this.settleSend(request),
        sentLate: () => this.landed(message),
      });
    },
    settleSend(request: Promise<void>) {
      this.sending = true;
      const sentText = this.form.values.message?.trim() ?? "";

      request
        .then(() => {
          this.landed(sentText);
        })
        .catch((error: ChatError) => {
          if (this.gone) {
            return;
          }

          // A retry of a send whose answer was lost: the first one landed.
          if (error?.code === "already_sent") {
            this.landed(sentText);
            return;
          }

          this.tray.unsent();
          this.failedSend = toastChatError(error) ?? null;
        })
        .finally(() => {
          this.sending = false;
        });
    },
    // Text typed since the send stays: only what went out is cleared.
    landed(sentText: string) {
      if (this.gone) {
        return;
      }

      this.tray.sent();
      this.failedSend?.dismiss?.();
      this.failedSend = null;

      if ((this.form.values.message?.trim() ?? "") === sentText) {
        this.form.resetForm();
      }
    },
    // The picker stays on screen through its close animation, where a second
    // click would send the same GIF again.
    sendGif(gif: ChatGif) {
      if (this.gifSentAt && Date.now() - this.gifSentAt < 1000) {
        return;
      }

      this.gifSentAt = Date.now();
      this.$emit("sendMessage", "", this.activeChannelValue ?? undefined, {
        gif,
      });
      this.focus();
    },
    addFiles(files: ArrayLike<File>) {
      if (!this.canAttach || this.gone) {
        return;
      }

      this.tray.add(files);
    },
    // The system file dialog takes the pointer out of the right hub, which
    // closes itself when the pointer leaves.
    openFilePicker() {
      const input = this.$refs.fileInput as HTMLInputElement | undefined;

      if (!input) {
        return;
      }

      if (!this.holdingHub) {
        this.holdingHub = true;
        useRightSidebar().suspendHoverClose();
        window.addEventListener("focus", this.releaseHub, { once: true });
      }

      input.click();
    },
    releaseHub() {
      if (!this.holdingHub) {
        return;
      }

      this.holdingHub = false;
      window.removeEventListener("focus", this.releaseHub);
      useRightSidebar().resumeHoverClose();
    },
    onFilesPicked(event: Event) {
      const input = event.target as HTMLInputElement;

      this.releaseHub();
      this.addFiles(Array.from(input.files ?? []));
      input.value = "";
    },
    onPaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []);
      const text = Array.from(event.clipboardData?.types ?? []).includes(
        "text/plain",
      )
        ? (event.clipboardData?.getData("text/plain") ?? "")
        : "";

      if (
        !this.canAttach ||
        files.length === 0 ||
        !pasteAttachesFiles(text, files)
      ) {
        return;
      }

      event.preventDefault();
      this.addFiles(files);
    },
    toastRejections(rejections: ChatFileRejection[]) {
      const [first] = rejections;
      const config = this.mediaConfig.config;

      if (!first) {
        return;
      }

      const name = first.file.name;
      const title =
        first.reason === "count"
          ? this.$t("chat.attachments.rejected_count", {
              count: config?.max_files ?? 4,
            })
          : first.reason === "size"
            ? this.$t("chat.attachments.rejected_size", {
                name,
                size: `${Math.round((config?.max_file_bytes ?? 0) / 1024 / 1024)} MB`,
              })
            : first.reason === "empty"
              ? this.$t("chat.attachments.rejected_empty", { name })
              : this.$t("chat.attachments.rejected_type", { name });

      toast({ title, variant: "destructive" });
    },
  },
};
</script>
