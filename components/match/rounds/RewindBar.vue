<script setup lang="ts">
import { Check, History, TriangleAlert } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { Button } from "~/components/ui/button";
import { Kbd } from "~/components/ui/kbd";
import { FadeSwap } from "~/components/ui/transitions";
import { faqHotClasses } from "~/utilities/faqClasses";

defineProps<{
  headline: string;
  detail?: string;
  eyebrow?: string;
  stats?: string[];
  confirmLabel: string;
  footnote?: string;
  waiting?: { connected: number; expected: number; names: string[] } | null;
  ready?: boolean;
  busy?: boolean;
  hot?: "confirm" | "cancel" | "waiting";
}>();

const emit = defineEmits<{ cancel: []; confirm: [] }>();
</script>

<template>
  <div
    class="rewind-bar overflow-hidden rounded-xl border border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--background)/0.94)] shadow-[0_-14px_34px_-12px_rgb(0_0_0/0.75)] backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background)/0.82)]"
  >
    <div class="rewind-bar__hatch h-[3px]" aria-hidden="true" />

    <div class="flex flex-col gap-2 px-4 pb-3.5 pt-3">
      <div
        class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5"
      >
        <span
          v-if="eyebrow"
          class="inline-flex items-center gap-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
        >
          <History class="size-3" />
          {{ eyebrow }}
        </span>
        <FiveStackToolTip v-if="waiting" as-child side="top">
          <template #trigger>
            <span
              tabindex="0"
              class="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)] px-2.5 py-0.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber))]"
              :class="hot === 'waiting' && faqHotClasses"
            >
              <TriangleAlert class="size-3.5 text-[hsl(var(--tac-amber))]" />
              <span class="tabular-nums">
                {{
                  $t("match.rewind.connected_count", {
                    connected: waiting.connected,
                    expected: waiting.expected,
                  })
                }}
              </span>
              <span class="text-muted-foreground">
                · {{ waiting.names.join(", ") }}
              </span>
            </span>
          </template>
          {{
            $t("match.rewind.waiting_tip", { names: waiting.names.join(", ") })
          }}
        </FiveStackToolTip>
        <span
          v-else-if="ready"
          class="inline-flex items-center gap-1.5 rounded-full border border-success/35 bg-success/10 px-2.5 py-0.5 text-xs"
        >
          <Check class="size-3.5 text-success" />
          {{ $t("match.rewind.everyone_connected") }}
        </span>
      </div>

      <FadeSwap>
        <div :key="headline" class="flex flex-col gap-2">
          <div class="flex min-w-0 flex-col gap-0.5">
            <span class="truncate text-base font-bold leading-snug">
              {{ headline }}
            </span>
            <span
              class="truncate text-sm leading-snug text-muted-foreground"
              :title="detail"
            >
              {{ detail || "\u00a0" }}
            </span>
          </div>
          <div class="flex min-h-[1.375rem] flex-wrap gap-1.5">
            <span
              v-for="stat in stats ?? []"
              :key="stat"
              class="rounded border border-border/70 bg-muted/30 px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] tabular-nums text-foreground/80"
            >
              {{ stat }}
            </span>
          </div>
        </div>
      </FadeSwap>
    </div>

    <div
      class="rewind-bar__foot flex flex-col gap-2.5 border-t border-border/60 bg-muted/20 px-4 py-2.5"
    >
      <span
        v-if="footnote"
        class="min-w-0 flex-1 text-xs leading-snug text-muted-foreground"
      >
        {{ footnote }}
      </span>
      <div class="rewind-bar__actions flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          class="gap-2"
          :class="hot === 'cancel' && faqHotClasses"
          @click="emit('cancel')"
        >
          {{ $t("common.cancel") }}
          <Kbd class="max-sm:hidden">Esc</Kbd>
        </Button>
        <Button
          :disabled="!!waiting"
          :loading="busy"
          :class="hot === 'confirm' && faqHotClasses"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rewind-bar {
  container-type: inline-size;
}

.rewind-bar__hatch {
  background-image: repeating-linear-gradient(
    -45deg,
    hsl(var(--tac-amber) / 0.7) 0 2px,
    transparent 2px 6px
  );
}

.rewind-bar__actions > * {
  flex: 1 1 0;
}

@container (min-width: 32rem) {
  .rewind-bar__foot {
    flex-direction: row;
    align-items: center;
  }

  .rewind-bar__actions {
    margin-left: auto;
  }

  .rewind-bar__actions > * {
    flex: 0 0 auto;
  }
}
</style>
