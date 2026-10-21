<script setup lang="ts">
import { CircleHelp } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { useFaqDialog } from "~/composables/useFaq";

const props = defineProps<{ section: string }>();

const { open } = useFaqDialog();

function onClick(event: MouseEvent) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();
  open(props.section);
}
</script>

<template>
  <FiveStackToolTip as-child side="top" :delay-duration="200">
    <template #trigger>
      <a
        :href="`/faq#${section}`"
        class="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber))]"
        :aria-label="$t('faq.help_glyph')"
        @click="onClick"
      >
        <CircleHelp class="size-4" />
      </a>
    </template>
    {{ $t("faq.help_glyph") }}
  </FiveStackToolTip>
</template>
