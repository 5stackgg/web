<script setup lang="ts">
/**
 * What anyone can do with a lineup, out where it can be seen instead of behind
 * the ⋯ menu: each action with a line on what it is for. Its own component
 * because its layout is still being decided; the detail only says which
 * actions apply.
 */
import { Film, Flag, GitFork, Send } from "lucide-vue-next";
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

const row = "h-9 w-full justify-start gap-2.5 px-2.5";
const hint = "ml-auto min-w-0 truncate text-xs font-normal text-muted-foreground";
</script>

<template>
  <section data-library-actions class="flex flex-col gap-1.5">
    <h3
      class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
    >
      {{ $t("pages.utility.detail.actions_title") }}
    </h3>
    <Button
      variant="outline"
      size="sm"
      data-action="fork"
      :class="row"
      @click="emit('fork')"
    >
      <GitFork />
      <span>{{ $t("pages.utility.fork.action") }}</span>
      <span :class="hint">{{ $t("pages.utility.detail.fork_hint") }}</span>
    </Button>
    <Button
      v-if="canSubmitPublic"
      variant="outline"
      size="sm"
      data-action="submit"
      :class="row"
      @click="emit('request-public')"
    >
      <Send />
      <span>{{ $t("pages.utility.publish.submit") }}</span>
      <span :class="hint">{{ $t("pages.utility.detail.submit_hint") }}</span>
    </Button>
    <Button
      v-if="canMarkBad"
      variant="outline"
      size="sm"
      data-action="bad"
      :class="row"
      :aria-pressed="markedBad"
      @click="emit('mark-bad')"
    >
      <Flag :class="markedBad ? 'fill-current' : ''" />
      <span>
        {{
          markedBad
            ? $t("pages.utility.card.unvote")
            : $t("pages.utility.detail.mark_bad")
        }}
      </span>
      <span :class="hint">{{ $t("pages.utility.detail.bad_hint") }}</span>
    </Button>
    <Button
      v-if="canRerender"
      variant="outline"
      size="sm"
      data-action="rerender"
      :class="row"
      :disabled="rendering"
      :title="rendering ? $t('pages.utility.render_queue.in_flight') : undefined"
      @click="emit('rerender')"
    >
      <Film />
      <span>{{ $t("pages.utility.render_queue.rerender") }}</span>
      <span :class="hint">{{ $t("pages.utility.detail.rerender_hint") }}</span>
    </Button>
  </section>
</template>
