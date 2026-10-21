<script setup lang="ts">
import { LifeBuoy } from "lucide-vue-next";
import FaqHelpGlyph from "~/components/faq/FaqHelpGlyph.vue";
import MatchDockLabel from "~/components/match/MatchDockLabel.vue";
import MatchFixProblemMenu from "~/components/match/MatchFixProblemMenu.vue";
import { dockNeutral } from "~/components/match/matchDockClasses";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { faqHotClasses } from "~/utilities/faqClasses";
import type { FixProblemMenu } from "~/utilities/fixProblem";

defineProps<{
  menu: FixProblemMenu;
  compact?: boolean;
  hot?: boolean;
}>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{ select: [string] }>();
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button type="button" :class="[dockNeutral, hot && faqHotClasses]">
        <MatchDockLabel
          :label="$t('match.recovery.fix.title')"
          :compact="compact"
        >
          <LifeBuoy class="h-3 w-3 shrink-0" />
        </MatchDockLabel>
      </button>
    </PopoverTrigger>
    <PopoverContent
      side="top"
      align="end"
      :side-offset="10"
      class="w-[min(24rem,calc(100vw-2rem))] p-0"
    >
      <MatchFixProblemMenu
        :step-label="menu.stepLabel"
        :now="menu.now"
        :anytime="menu.anytime"
        :later="menu.later"
        @select="emit('select', $event)"
      >
        <template #aside>
          <FaqHelpGlyph section="fix-a-problem" />
        </template>
      </MatchFixProblemMenu>
    </PopoverContent>
  </Popover>
</template>
