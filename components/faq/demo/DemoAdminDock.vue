<script setup lang="ts">
import { ChevronUp, LifeBuoy, Play, Shield } from "lucide-vue-next";
import MatchAdminSteps from "~/components/match/MatchAdminSteps.vue";
import MatchFixProblemMenu from "~/components/match/MatchFixProblemMenu.vue";
import FaqHelpGlyph from "~/components/faq/FaqHelpGlyph.vue";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { faqHotClasses } from "~/utilities/faqClasses";
import type { FixProblemItem } from "~/utilities/fixProblem";

defineProps<{
  match: Record<string, any>;
  paused?: boolean;
  items: {
    stepLabel: string;
    now: FixProblemItem[];
    anytime: FixProblemItem[];
    later?: string;
  };
  hot?: "fix" | "resume";
  frozen?: boolean;
}>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{ select: [string]; resume: [] }>();

const dockChip =
  "inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] transition-colors duration-200 ease-out";
const dockPrimary = `${dockChip} border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] data-[state=open]:bg-[hsl(var(--tac-amber)/0.2)]`;
</script>

<template>
  <div
    class="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
  >
    <div class="flex items-stretch">
      <div class="flex min-w-0 flex-1 items-center gap-3 py-2 pl-4 pr-2">
        <div
          class="inline-flex items-center gap-1.5 rounded border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-2 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
        >
          <Shield class="size-3" />
          <span class="max-sm:sr-only">{{ $t("match.admin") }}</span>
        </div>
        <MatchAdminSteps
          :match="match"
          labels="current"
          class="max-md:hidden"
        />
      </div>

      <div class="flex shrink-0 items-center gap-2 px-2">
        <button
          v-if="paused"
          type="button"
          :class="[dockPrimary, hot === 'resume' && faqHotClasses]"
          @click="emit('resume')"
        >
          <Play class="size-3 shrink-0" />
          <span class="max-sm:sr-only">{{ $t("faq.demo.resume") }}</span>
        </button>

        <button
          v-if="frozen"
          type="button"
          :class="[dockPrimary, hot === 'fix' && faqHotClasses]"
        >
          <LifeBuoy class="size-3 shrink-0" />
          {{ $t("match.recovery.fix.title") }}
        </button>
        <Popover v-else v-model:open="open">
          <PopoverTrigger as-child>
            <button
              type="button"
              :class="[dockPrimary, hot === 'fix' && faqHotClasses]"
            >
              <LifeBuoy class="size-3 shrink-0" />
              {{ $t("match.recovery.fix.title") }}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            :side-offset="10"
            class="w-[min(24rem,calc(100vw-2rem))] p-0"
          >
            <MatchFixProblemMenu
              :step-label="items.stepLabel"
              :now="items.now"
              :anytime="items.anytime"
              :later="items.later"
              @select="emit('select', $event)"
            >
              <template #aside>
                <FaqHelpGlyph section="fix-a-problem" />
              </template>
            </MatchFixProblemMenu>
          </PopoverContent>
        </Popover>
      </div>

      <span
        class="flex shrink-0 items-center py-2 pl-2 pr-4 text-muted-foreground/40"
        aria-hidden="true"
      >
        <ChevronUp class="size-4" />
      </span>
    </div>
  </div>
</template>
