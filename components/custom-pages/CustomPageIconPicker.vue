<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import CustomPageIcon from "./CustomPageIcon.vue";
import { CUSTOM_PAGE_ICON_NAMES } from "./customPageIcons";

const model = defineModel<string>({ default: "" });
const open = ref(false);
const query = ref("");

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return q
    ? CUSTOM_PAGE_ICON_NAMES.filter((name) => name.includes(q))
    : CUSTOM_PAGE_ICON_NAMES;
});

// A URL or inline SVG (e.g. supplied by a plugin manifest) rather than a name.
const isCustom = computed(() => {
  const value = (model.value ?? "").trim();
  return value.startsWith("<") || /^(https?:\/\/|\/|data:)/.test(value);
});

function pick(name: string) {
  model.value = name;
  open.value = false;
}
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-base"
    >
      <CustomPageIcon :name="model" />
    </div>
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <Button
          type="button"
          variant="outline"
          class="min-w-[10rem] justify-start font-normal"
        >
          {{
            isCustom
              ? $t("pages.settings.application.custom_pages.icon_picker.custom")
              : model ||
                $t("pages.settings.application.custom_pages.icon_picker.choose")
          }}
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-72 p-2" align="start">
        <Input
          v-model="query"
          :placeholder="
            $t('pages.settings.application.custom_pages.icon_picker.search')
          "
          class="mb-2"
        />
        <div class="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto">
          <button
            v-for="name in filtered"
            :key="name"
            type="button"
            :title="name"
            class="flex aspect-square items-center justify-center rounded-md border border-transparent text-base hover:border-primary hover:bg-accent"
            :class="{ 'border-primary bg-accent': model === name }"
            @click="pick(name)"
          >
            <CustomPageIcon :name="name" class="h-4 w-4" />
          </button>
        </div>
        <div class="mt-2 space-y-1 border-t pt-2">
          <p class="text-xs text-muted-foreground">
            {{
              $t("pages.settings.application.custom_pages.icon_picker.custom_hint")
            }}
          </p>
          <Input
            v-model="model"
            :placeholder="
              $t('pages.settings.application.custom_pages.icon_picker.custom_placeholder')
            "
          />
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
