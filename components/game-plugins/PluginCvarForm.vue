<script setup lang="ts">
import { computed } from "vue";
import { RotateCcw } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import {
  cvarsSetIn,
  isTruthy,
  readCvar,
  writeCvar,
  type PluginCvar,
} from "~/utilities/pluginConfig";

// One row per cvar the plugin reads, editing the same cvar block the Advanced
// tab shows as text. Anything else in that block is left exactly as written.
const props = defineProps<{
  cvars: Array<PluginCvar>;
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const reported = computed(() => props.cvars.some((cvar) => cvar.kind));

const otherLines = computed(() => {
  const listed = new Set(props.cvars.map((cvar) => cvar.name.toLowerCase()));

  return [...cvarsSetIn(props.modelValue)].filter((name) => !listed.has(name))
    .length;
});

function valueOf(cvar: PluginCvar): string | null {
  return readCvar(props.modelValue, cvar.name);
}

function set(cvar: PluginCvar, value: string | null) {
  emit(
    "update:modelValue",
    writeCvar(props.modelValue, cvar.name, value, cvar.kind),
  );
}

function setFromInput(cvar: PluginCvar, value: string | number) {
  const text = String(value ?? "");

  set(cvar, text === "" ? null : text);
}
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="!reported"
      class="rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground"
    >
      {{ $t("pages.plugins.settings.not_reported") }}
    </p>

    <div class="divide-y divide-border/60 rounded-md border border-border/60">
      <div
        v-for="cvar in props.cvars"
        :key="cvar.name"
        class="flex items-start justify-between gap-4 border-l-2 px-3 py-2.5"
        :class="
          valueOf(cvar) !== null
            ? 'border-l-[hsl(var(--tac-amber))]'
            : 'border-l-transparent'
        "
      >
        <div class="min-w-0 space-y-0.5">
          <p class="break-all font-mono text-sm">{{ cvar.name }}</p>
          <p v-if="cvar.description" class="text-xs text-muted-foreground">
            {{ cvar.description }}
          </p>
          <p
            v-if="cvar.defaultValue !== null && cvar.kind !== 'bool'"
            class="font-mono text-[0.7rem] text-muted-foreground/70"
          >
            {{
              $t("pages.plugins.settings.default", {
                value: cvar.defaultValue === "" ? '""' : cvar.defaultValue,
              })
            }}
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <Switch
            v-if="cvar.kind === 'bool'"
            :model-value="isTruthy(valueOf(cvar) ?? cvar.defaultValue)"
            @update:model-value="set(cvar, $event ? '1' : '0')"
          />
          <Input
            v-else
            :type="
              cvar.kind === 'int' || cvar.kind === 'float' ? 'number' : 'text'
            "
            step="any"
            :model-value="valueOf(cvar) ?? ''"
            :placeholder="cvar.defaultValue ?? ''"
            class="h-8 w-44 font-mono text-xs sm:w-56"
            @update:model-value="setFromInput(cvar, $event)"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="h-7 w-7 text-muted-foreground hover:text-[hsl(var(--tac-amber))] [&_svg]:size-3.5"
            :class="valueOf(cvar) === null ? 'invisible' : ''"
            :title="$t('pages.plugins.settings.reset')"
            :aria-label="$t('pages.plugins.settings.reset')"
            @click="set(cvar, null)"
          >
            <RotateCcw />
          </Button>
        </div>
      </div>
    </div>

    <p v-if="otherLines > 0" class="text-xs text-muted-foreground">
      {{ $t("pages.plugins.settings.other_lines", { count: otherLines }) }}
    </p>
  </div>
</template>
