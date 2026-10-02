<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { blankFor, type JsonSchema } from "~/utilities/pluginConfig";

defineOptions({ name: "SchemaField" });

const props = withDefaults(
  defineProps<{
    schema: JsonSchema;
    modelValue: unknown;
    label?: string;
    depth?: number;
  }>(),
  { label: "", depth: 0 },
);

const emit = defineEmits<{
  "update:modelValue": [value: unknown];
}>();

const record = computed(
  () => (props.modelValue ?? {}) as Record<string, unknown>,
);

const list = computed(() =>
  Array.isArray(props.modelValue) ? (props.modelValue as Array<unknown>) : [],
);

const items = computed(() => props.schema.items ?? {});

// Entries whose fields are all plain values fit on one line; anything with a
// list or a nested object inside gets a card that folds away.
const compactItems = computed(() =>
  Object.values(items.value.properties ?? {}).every(
    (property) => property.type !== "object" && property.type !== "array",
  ),
);

const open = ref(new Set<number>());

function setKey(key: string, value: unknown) {
  const next = { ...record.value };

  if (value === undefined) {
    delete next[key];
  } else {
    next[key] = value;
  }

  emit("update:modelValue", next);
}

function setItem(index: number, value: unknown) {
  const next = [...list.value];
  next[index] = value;
  emit("update:modelValue", next);
}

function setItemKey(index: number, key: string, value: unknown) {
  const item = { ...((list.value[index] ?? {}) as Record<string, unknown>) };

  if (value === undefined) {
    delete item[key];
  } else {
    item[key] = value;
  }

  setItem(index, item);
}

function addItem() {
  emit("update:modelValue", [...list.value, blankFor(items.value)]);
  open.value = new Set([...open.value, list.value.length]);
}

function removeItem(index: number) {
  emit(
    "update:modelValue",
    list.value.filter((_, position) => position !== index),
  );
  open.value = new Set(
    [...open.value]
      .filter((position) => position !== index)
      .map((position) => (position > index ? position - 1 : position)),
  );
}

function moveItem(index: number, offset: number) {
  const target = index + offset;

  if (target < 0 || target >= list.value.length) {
    return;
  }

  const next = [...list.value];
  [next[index], next[target]] = [next[target], next[index]];
  emit("update:modelValue", next);

  const wasOpen = open.value.has(index);
  const targetOpen = open.value.has(target);
  const swapped = new Set(open.value);
  swapped.delete(index);
  swapped.delete(target);

  if (wasOpen) {
    swapped.add(target);
  }

  if (targetOpen) {
    swapped.add(index);
  }

  open.value = swapped;
}

function toggleOpen(index: number) {
  const next = new Set(open.value);

  if (!next.delete(index)) {
    next.add(index);
  }

  open.value = next;
}

function itemTitle(item: unknown, index: number): string {
  const entry = (item ?? {}) as Record<string, unknown>;
  const named = entry.name ?? entry.weapon ?? entry.title;

  return typeof named === "string" && named ? named : `#${index + 1}`;
}

function toggleOption(option: unknown) {
  const selected = list.value.includes(option);

  emit(
    "update:modelValue",
    selected
      ? list.value.filter((entry) => entry !== option)
      : (items.value.enum ?? []).filter(
          (entry) => entry === option || list.value.includes(entry),
        ),
  );
}

function setNumber(value: string | number) {
  const text = String(value ?? "").trim();

  if (text === "") {
    emit("update:modelValue", undefined);
    return;
  }

  const parsed =
    props.schema.type === "integer" ? parseInt(text, 10) : parseFloat(text);

  emit("update:modelValue", Number.isNaN(parsed) ? undefined : parsed);
}

function setLines(value: string | number) {
  const lines = String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  emit(
    "update:modelValue",
    lines.map((line) => {
      switch (items.value.type) {
        case "integer":
          return parseInt(line, 10);
        case "number":
          return parseFloat(line);
        case "boolean":
          return line === "true";
        default:
          return line;
      }
    }),
  );
}
</script>

<template>
  <div
    v-if="props.schema.type === 'object'"
    class="space-y-3"
    :class="
      props.depth > 0 && props.label
        ? 'rounded-md border border-border/60 p-3'
        : ''
    "
  >
    <p
      v-if="props.depth > 0 && props.label"
      class="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
    >
      {{ props.label }}
    </p>
    <SchemaField
      v-for="(property, key) in props.schema.properties"
      :key="key"
      :schema="property"
      :model-value="record[key]"
      :label="property.title ?? String(key)"
      :depth="props.depth + 1"
      @update:model-value="setKey(String(key), $event)"
    />
  </div>

  <div
    v-else-if="props.schema.type === 'array' && items.type === 'object'"
    class="space-y-2"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="space-y-0.5">
        <p v-if="props.label" class="text-sm font-medium">{{ props.label }}</p>
        <!-- The top level's description already heads the panel. -->
        <p
          v-if="props.schema.description && props.depth > 0"
          class="text-xs text-muted-foreground"
        >
          {{ props.schema.description }}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="shrink-0 gap-1.5 [&_svg]:size-3.5"
        @click="addItem"
      >
        <Plus />
        {{ $t("pages.plugins.config_file.add", { item: items.title ?? "" }) }}
      </Button>
    </div>

    <p
      v-if="list.length === 0"
      class="rounded-md border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground"
    >
      {{ $t("pages.plugins.config_file.empty_list") }}
    </p>

    <template v-if="compactItems">
      <div
        v-for="(item, index) in list"
        :key="index"
        class="flex items-end gap-2"
      >
        <SchemaField
          v-for="(property, key) in items.properties"
          :key="key"
          :schema="property"
          :model-value="((item ?? {}) as Record<string, unknown>)[key]"
          :label="property.title ?? String(key)"
          :depth="props.depth + 2"
          class="min-w-0 flex-1"
          @update:model-value="setItemKey(index, String(key), $event)"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive [&_svg]:size-3.5"
          :aria-label="$t('pages.plugins.config_file.remove')"
          :title="$t('pages.plugins.config_file.remove')"
          @click="removeItem(index)"
        >
          <Trash2 />
        </Button>
      </div>
    </template>

    <template v-else>
      <div
        v-for="(item, index) in list"
        :key="index"
        class="overflow-hidden rounded-md border border-border/60"
      >
        <div
          class="flex items-center gap-1 bg-muted/20 px-2 py-1"
          :class="open.has(index) ? 'border-b border-border/60' : ''"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-left text-sm font-medium"
            :aria-expanded="open.has(index)"
            @click="toggleOpen(index)"
          >
            <ChevronDown
              class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none"
              :class="open.has(index) ? '' : '-rotate-90'"
            />
            <span class="truncate">{{ itemTitle(item, index) }}</span>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="h-7 w-7 text-muted-foreground [&_svg]:size-3.5"
            :disabled="index === 0"
            :aria-label="$t('pages.plugins.config_file.move_up')"
            :title="$t('pages.plugins.config_file.move_up')"
            @click="moveItem(index, -1)"
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="h-7 w-7 text-muted-foreground [&_svg]:size-3.5"
            :disabled="index === list.length - 1"
            :aria-label="$t('pages.plugins.config_file.move_down')"
            :title="$t('pages.plugins.config_file.move_down')"
            @click="moveItem(index, 1)"
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="h-7 w-7 text-muted-foreground hover:text-destructive [&_svg]:size-3.5"
            :aria-label="$t('pages.plugins.config_file.remove')"
            :title="$t('pages.plugins.config_file.remove')"
            @click="removeItem(index)"
          >
            <Trash2 />
          </Button>
        </div>
        <div v-if="open.has(index)" class="p-3">
          <SchemaField
            :schema="items"
            :model-value="item"
            :depth="props.depth + 1"
            @update:model-value="setItem(index, $event)"
          />
        </div>
      </div>
    </template>
  </div>

  <div
    v-else-if="props.schema.type === 'array' && items.enum"
    class="space-y-1.5"
  >
    <p v-if="props.label" class="text-xs text-muted-foreground">
      {{ props.label }}
    </p>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="option in items.enum"
        :key="String(option)"
        type="button"
        class="rounded border px-2 py-0.5 font-mono text-xs transition-colors motion-reduce:transition-none"
        :class="
          list.includes(option)
            ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
            : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
        "
        :aria-pressed="list.includes(option)"
        @click="toggleOption(option)"
      >
        {{ option }}
      </button>
    </div>
  </div>

  <div v-else-if="props.schema.type === 'array'" class="space-y-1.5">
    <p v-if="props.label" class="text-xs text-muted-foreground">
      {{ props.label }}
    </p>
    <Textarea
      :model-value="list.join('\n')"
      rows="4"
      class="font-mono text-xs"
      @update:model-value="setLines"
    />
  </div>

  <div
    v-else-if="props.schema.type === 'boolean'"
    class="flex items-center justify-between gap-3"
  >
    <p class="text-xs text-muted-foreground">{{ props.label }}</p>
    <Switch
      :model-value="Boolean(props.modelValue ?? props.schema.default ?? false)"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>

  <div v-else-if="props.schema.enum" class="space-y-1.5">
    <p v-if="props.label" class="text-xs text-muted-foreground">
      {{ props.label }}
    </p>
    <Select
      :model-value="props.modelValue as string"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <SelectTrigger class="h-8 font-mono text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="option in props.schema.enum"
          :key="String(option)"
          :value="option as string"
          class="font-mono text-xs"
        >
          {{ option }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div
    v-else-if="
      props.schema.type === 'integer' || props.schema.type === 'number'
    "
    class="space-y-1.5"
  >
    <p v-if="props.label" class="text-xs text-muted-foreground">
      {{ props.label }}
    </p>
    <Input
      type="number"
      :step="props.schema.type === 'integer' ? '1' : 'any'"
      :min="props.schema.minimum"
      :max="props.schema.maximum"
      :model-value="(props.modelValue as number | undefined) ?? ''"
      class="h-8 font-mono text-xs"
      @update:model-value="setNumber"
    />
  </div>

  <div v-else class="space-y-1.5">
    <p v-if="props.label" class="text-xs text-muted-foreground">
      {{ props.label }}
    </p>
    <Input
      :model-value="(props.modelValue as string | undefined) ?? ''"
      class="h-8 text-sm"
      @update:model-value="emit('update:modelValue', String($event))"
    />
  </div>
</template>
