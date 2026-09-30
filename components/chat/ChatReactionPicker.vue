<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { SmilePlus } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import ChatReactionMenuStrip from "~/components/chat/ChatReactionMenuStrip.vue";
import { useRightSidebar } from "~/composables/useRightSidebar";
import type { ChatReaction } from "~/constants/chat";

// Every reaction, from a smiley button.
const props = defineProps<{
  choices: {
    id: ChatReaction;
    glyph: string;
    mine: boolean;
    disabled: boolean;
  }[];
  gagged: boolean;
  triggerClass?: string;
}>();

const emit = defineEmits<{
  react: [reaction: ChatReaction];
}>();

const open = defineModel<boolean>("open", { default: false });

// reka's tooltip and menu share one popper context, so the menu trigger inside
// the tooltip hands its anchor to the tooltip. Unanchored, the menu opens but
// never positions and stays off screen -- so it is given the button outright.
const triggerRef = ref<{ $el?: HTMLElement } | null>(null);
const reference = computed(() => triggerRef.value?.$el);

// The picker sits over the right hub, which closes itself when the pointer
// leaves.
let holding = false;

// Set on the first pick. The model only reads false once the parent has
// re-rendered, which is after the second click of a double click.
let picked = false;

watch(open, (value) => {
  if (value) {
    picked = false;
  }

  if (value && !holding) {
    holding = true;
    useRightSidebar().suspendHoverClose();
  } else if (!value && holding) {
    holding = false;
    useRightSidebar().resumeHoverClose();
  }
});

onBeforeUnmount(() => {
  if (holding) {
    useRightSidebar().resumeHoverClose();
  }
});

// Closed here rather than a tick later by the item, so the second click of a
// double click can't take the reaction straight back.
function react(reaction: ChatReaction) {
  if (!open.value || picked) {
    return;
  }

  picked = true;
  open.value = false;
  emit("react", reaction);
}
</script>

<template>
  <DropdownMenu v-model:open="open" :modal="false">
    <FiveStackToolTip
      as-child
      side="top"
      :delay-duration="120"
      :tap-toggle="false"
    >
      <template #trigger>
        <DropdownMenuTrigger as-child>
          <Button
            ref="triggerRef"
            variant="ghost"
            size="icon"
            :class="props.triggerClass"
            :aria-label="$t('chat.add_reaction')"
          >
            <SmilePlus />
          </Button>
        </DropdownMenuTrigger>
      </template>
      {{ $t("chat.add_reaction") }}
    </FiveStackToolTip>
    <DropdownMenuContent
      :reference="reference"
      align="end"
      :collision-padding="8"
      class="p-1"
      data-right-hub-interactive
    >
      <ChatReactionMenuStrip
        :choices="choices"
        :gagged="gagged"
        @react="react"
      />
    </DropdownMenuContent>
  </DropdownMenu>
</template>
