<script setup lang="ts">
import { CornerDownLeft } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

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
          class="pointer-events-none absolute inset-y-[2px] left-[2px] w-[calc(50%-2px)] rounded-[3px] ring-1 ring-inset transition-[transform,background-color,box-shadow] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
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
              <Input
                ref="inputRef"
                :placeholder="activePlaceholder"
                v-bind="componentField"
                type="text"
                autocomplete="off"
                :name="fieldName"
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                data-form-type="other"
                :class="
                  variant === 'global'
                    ? 'flex-1 transition-all duration-200 focus:scale-[1.02]'
                    : 'flex-1 resize-none border-0 shadow-none focus-visible:ring-0'
                "
                @keydown.enter="onEnter"
              />
              <Button
                type="submit"
                size="sm"
                :loading="sending"
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
  </div>
</template>

<script lang="ts">
import type { PropType } from "vue";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";

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
  },
  emits: ["sendMessage", "update:destination"],
  data() {
    return {
      sending: false,
      sendTimer: undefined as ReturnType<typeof setTimeout> | undefined,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            message: z.string().min(1),
          }),
        ),
      }),
    };
  },
  computed: {
    hasChannels() {
      return this.channels.length > 1;
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
    activePlaceholder() {
      return (
        this.activeChannel?.placeholder ?? this.$t("chat.message_placeholder")
      );
    },
  },
  beforeUnmount() {
    if (this.sendTimer) {
      clearTimeout(this.sendTimer);
    }
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
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }

      if (!this.otherChannelValue) {
        return;
      }

      event.preventDefault();
      this.sendMessage(this.otherChannelValue);
    },
    sendMessage(destination?: string) {
      const { message } = this.form.values;
      if (!message || message?.length === 0) {
        return;
      }
      this.$emit(
        "sendMessage",
        message,
        destination ?? this.activeChannelValue ?? undefined,
      );
      this.form.resetForm();
      this.flashSending();
    },
  },
};
</script>
