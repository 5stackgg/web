<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ExternalLink, FolderOpen } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SchemaField from "~/components/game-plugins/SchemaField.vue";
import {
  cloneConfig,
  schemaProblems,
  type JsonSchema,
} from "~/utilities/pluginConfig";

// null means the plugin reads the file it ships with. A value is the copy the
// panel writes to every server that loads the plugin.
const props = defineProps<{
  modelValue: unknown;
  schema: JsonSchema | null;
  defaultConfig: unknown;
  path: string;
  repoUrl: string | null;
  canOpenShipped: boolean;
  // Wording for the layer this edits; the plugin page's by default.
  usingText?: string;
  resetText?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: unknown];
  invalid: [invalid: boolean];
  "open-shipped": [];
}>();

const { t } = useI18n();

const view = ref<"form" | "json">(props.schema ? "form" : "json");
const jsonText = ref("");
const jsonError = ref<string | null>(null);

// What the textarea last sent up. Rewriting the text with the pretty-printed
// copy of it would reflow it under the caret on every keystroke.
let typed: string | null = null;

const views = computed(() => [
  { key: "form", label: t("pages.plugins.config_file.view_form") },
  { key: "json", label: t("pages.plugins.config_file.view_json") },
]);

const problems = computed(() =>
  props.schema && props.modelValue !== null
    ? schemaProblems(props.schema, props.modelValue)
    : [],
);

watch(
  () => props.modelValue,
  (value) => {
    if (jsonError.value || JSON.stringify(value) === typed) {
      return;
    }

    jsonText.value =
      value === null || value === undefined
        ? ""
        : JSON.stringify(value, null, 2);
  },
  { immediate: true },
);

watch(view, (next) => {
  if (next === "form" && jsonError.value) {
    jsonError.value = null;
    jsonText.value = JSON.stringify(props.modelValue, null, 2);
  }
});

watch(
  [problems, jsonError],
  () => emit("invalid", problems.value.length > 0 || !!jsonError.value),
  { immediate: true },
);

function customize() {
  emit(
    "update:modelValue",
    cloneConfig(
      props.defaultConfig ?? (props.schema?.type === "array" ? [] : {}),
    ),
  );
}

function useShipped() {
  jsonError.value = null;
  emit("update:modelValue", null);
}

function setJson(value: string | number) {
  jsonText.value = String(value ?? "");

  try {
    const parsed = JSON.parse(jsonText.value);

    jsonError.value = null;
    typed = JSON.stringify(parsed);
    emit("update:modelValue", parsed);
  } catch (error) {
    jsonError.value = (error as Error).message;
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="min-w-0 space-y-1">
      <p class="text-sm font-medium">
        {{ props.schema?.title ?? $t("pages.plugins.config_file.title") }}
      </p>
      <p v-if="props.schema?.description" class="text-xs text-muted-foreground">
        {{ props.schema.description }}
      </p>
      <!-- Where the file lands, and where the plugin's own copy lives: small
           links on the path itself rather than a row of buttons above the
           editor. -->
      <div
        class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.7rem] text-muted-foreground/70"
      >
        <span class="min-w-0 break-all">{{ props.path }}</span>
        <a
          v-if="props.repoUrl"
          :href="props.repoUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex shrink-0 items-center gap-1 font-sans text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-[hsl(var(--tac-amber))] hover:underline motion-reduce:transition-none"
        >
          {{ $t("pages.plugins.config_file.view_repo") }}
          <ExternalLink class="h-3 w-3" />
        </a>
        <button
          v-if="props.canOpenShipped"
          type="button"
          class="inline-flex shrink-0 items-center gap-1 font-sans text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-[hsl(var(--tac-amber))] hover:underline motion-reduce:transition-none"
          @click="emit('open-shipped')"
        >
          {{ $t("pages.plugins.config_file.open_node") }}
          <FolderOpen class="h-3 w-3" />
        </button>
      </div>
    </div>

    <div
      v-if="props.modelValue === null"
      class="space-y-3 rounded-md border border-dashed border-border/60 p-4 text-center"
    >
      <p class="text-sm text-muted-foreground">
        {{ props.usingText ?? $t("pages.plugins.config_file.using_shipped") }}
      </p>
      <Button type="button" variant="tactical" size="sm" @click="customize">
        {{ $t("pages.plugins.config_file.customize") }}
      </Button>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <AnimatedFilters
          v-if="props.schema"
          v-model="view"
          square
          :options="views"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="ml-auto"
          @click="useShipped"
        >
          {{ props.resetText ?? $t("pages.plugins.config_file.use_shipped") }}
        </Button>
      </div>

      <SchemaField
        v-if="props.schema && view === 'form'"
        :schema="props.schema"
        :model-value="props.modelValue"
        @update:model-value="emit('update:modelValue', $event)"
      />

      <div v-else class="space-y-1.5">
        <Textarea
          :model-value="jsonText"
          rows="18"
          class="font-mono text-xs"
          spellcheck="false"
          @update:model-value="setJson"
        />
        <p v-if="jsonError" class="text-xs text-destructive">
          {{ jsonError }}
        </p>
      </div>

      <ul
        v-if="problems.length > 0"
        class="space-y-0.5 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 font-mono text-[0.7rem] text-destructive"
      >
        <li v-for="problem in problems" :key="problem">{{ problem }}</li>
      </ul>
    </template>
  </div>
</template>
