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
  <div class="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
    <div class="space-y-0.5">
      <p class="text-sm font-medium">{{ $t("pages.plugins.load.title") }}</p>
      <p class="text-xs text-muted-foreground">
        {{ $t("pages.plugins.load.description") }}
      </p>
    </div>

    <div
      v-for="field in fields"
      :key="field.key"
      class="flex items-start justify-between gap-3"
    >
      <div class="space-y-0.5">
        <p class="text-sm">{{ $t(field.label) }}</p>
        <p class="text-xs text-muted-foreground">{{ $t(field.hint) }}</p>
      </div>
      <Switch
        :model-value="props.targets[field.key]"
        :disabled="props.disabled"
        @update:model-value="emit('update', field.key, $event)"
      />
    </div>
  </div>
</template>
