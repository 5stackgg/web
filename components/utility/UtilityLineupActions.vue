<script setup lang="ts">
/**
 * What the library does with a lineup, out where it can be seen instead of
 * behind the ⋯ menu. Putting it in your game is the bar's job, at the foot of
 * the card where the server is.
 */
import { ArrowBigDown, CopyPlus, Film, Globe } from "lucide-vue-next";
import { Button } from "~/components/ui/button";

defineProps<{
  canSubmitPublic: boolean;
  canMarkBad: boolean;
  markedBad: boolean;
  canRerender: boolean;
  rendering: boolean;
}>();

const emit = defineEmits<{
  (e: "fork"): void;
  (e: "request-public"): void;
  (e: "mark-bad"): void;
  (e: "rerender"): void;
}>();

const BUTTON =
  "h-7 gap-1.5 border-white/10 bg-white/[0.03] px-2 text-xs font-medium text-muted-foreground hover:bg-white/[0.07] hover:text-foreground [&_svg]:size-3.5";
</script>

<template>
  <div data-library-actions class="flex flex-wrap items-center gap-1.5">
    <Button
      variant="outline"
      size="sm"
      data-action="fork"
      :class="BUTTON"
      @click="emit('fork')"
    >
      <CopyPlus />
      {{ $t("pages.utility.fork.action") }}
    </Button>
    <Button
      v-if="canSubmitPublic"
      variant="outline"
      size="sm"
      data-action="submit"
      :class="BUTTON"
      @click="emit('request-public')"
    >
      <Globe />
      {{ $t("pages.utility.publish.submit") }}
    </Button>
    <Button
      v-if="canMarkBad"
      variant="outline"
      size="sm"
      data-action="bad"
      :class="BUTTON"
      :aria-pressed="markedBad"
      @click="emit('mark-bad')"
    >
      <ArrowBigDown
        class="text-destructive"
        :class="markedBad ? 'fill-current' : ''"
      />
      {{
        markedBad
          ? $t("pages.utility.card.unvote")
          : $t("pages.utility.detail.mark_bad")
      }}
    </Button>
    <Button
      v-if="canRerender"
      variant="outline"
      size="sm"
      data-action="rerender"
      :class="BUTTON"
      :disabled="rendering"
      :title="rendering ? $t('pages.utility.render_queue.in_flight') : undefined"
      @click="emit('rerender')"
    >
      <Film />
      {{ $t("pages.utility.render_queue.rerender") }}
    </Button>
  </div>
</template>
