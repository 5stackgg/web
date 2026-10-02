<script setup lang="ts">
import { computed } from "vue";
import { AlertTriangle, ChevronDown } from "lucide-vue-next";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cvarsSetIn } from "~/utilities/pluginConfig";

// The cvars a plugin sets itself after every map load. Setting one anywhere
// does nothing, so the ones a config tries are marked.
const props = defineProps<{
  forced: Array<string>;
  cfg: string;
  pluginName: string;
}>();

const setHere = computed(() => {
  const set = cvarsSetIn(props.cfg);

  return props.forced.filter((cvar) => set.has(cvar.toLowerCase()));
});
</script>

<template>
  <Collapsible v-if="props.forced.length > 0">
    <CollapsibleTrigger as-child>
      <button
        type="button"
        class="group flex w-full items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-left transition-colors hover:bg-muted/40 motion-reduce:transition-none"
      >
        <span class="flex items-center gap-1.5 text-xs">
          <AlertTriangle
            v-if="setHere.length > 0"
            class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
          />
          {{ $t("pages.plugins.forced.title", { count: props.forced.length }) }}
        </span>
        <ChevronDown
          class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
        />
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent class="space-y-2 pt-2">
      <p class="text-xs text-muted-foreground">
        {{ $t("pages.plugins.forced.hint", { name: props.pluginName }) }}
      </p>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="cvar in props.forced"
          :key="cvar"
          class="rounded border px-1.5 py-0.5 font-mono text-[0.65rem]"
          :class="
            setHere.includes(cvar)
              ? 'border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]'
              : 'border-border/60 text-muted-foreground'
          "
        >
          {{ cvar }}
        </span>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
