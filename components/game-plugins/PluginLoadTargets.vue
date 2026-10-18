<script setup lang="ts">
import { Switch } from "~/components/ui/switch";

// Which kinds of match load this plugin without a game mode asking for it.
// Ordered by blast radius: ranked reaches matchmaking and is the one worth
// thinking hardest about, so it is read first rather than buried last.
export type PluginLoadTargets = {
  load_ranked: boolean;
  load_tournaments: boolean;
  load_custom: boolean;
};

const props = defineProps<{
  targets: PluginLoadTargets;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  update: [field: keyof PluginLoadTargets, value: boolean];
}>();

const fields: Array<{
  key: keyof PluginLoadTargets;
  label: string;
  hint: string;
}> = [
  {
    key: "load_ranked",
    label: "pages.plugins.load.ranked",
    hint: "pages.plugins.load.ranked_hint",
  },
  {
    key: "load_tournaments",
    label: "pages.plugins.load.tournaments",
    hint: "pages.plugins.load.tournaments_hint",
  },
  {
    key: "load_custom",
    label: "pages.plugins.load.custom",
    hint: "pages.plugins.load.custom_hint",
  },
];
</script>

<template>
  <!-- Rows in the rail's settings list: a heading row, then one indented row
       per kind of match, each with its own switch. -->
  <div class="border-b border-border/40 last:border-b-0">
    <div class="space-y-0.5 pb-1 pt-3">
      <p class="text-sm">{{ $t("pages.plugins.load.title") }}</p>
      <p class="text-xs text-muted-foreground">
        {{ $t("pages.plugins.load.description") }}
      </p>
    </div>

    <div
      v-for="field in fields"
      :key="field.key"
      class="flex items-start justify-between gap-4 border-b border-border/40 py-2.5 pl-3.5 last:border-b-0"
    >
      <div class="space-y-0.5">
        <p class="text-[0.8rem]">{{ $t(field.label) }}</p>
        <p class="text-xs text-muted-foreground">{{ $t(field.hint) }}</p>
      </div>
      <Switch
        :model-value="props.targets[field.key]"
        :disabled="props.disabled"
        :aria-label="$t(field.label)"
        @update:model-value="emit('update', field.key, $event)"
      />
    </div>
  </div>
</template>
