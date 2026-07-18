<script setup lang="ts">
import { MapPin, X, Loader2 } from "lucide-vue-next";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import debounce from "~/utilities/debounce";

interface AddressResult {
  label: string;
  latitude: number;
  longitude: number;
}

const props = defineProps<{
  modelValue?: string | null;
}>();

const emit = defineEmits<{
  (e: "selected", value: AddressResult): void;
  (e: "cleared"): void;
}>();

const query = ref("");
const results = ref<AddressResult[]>([]);
const loading = ref(false);
const open = ref(false);

const search = debounce(async () => {
  const term = query.value.trim();
  if (term.length < 3) {
    results.value = [];
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    const data = await $fetch<AddressResult[]>("/api/geocode-address", {
      params: { q: term },
    });
    results.value = data ?? [];
    open.value = true;
  } catch (error) {
    results.value = [];
  } finally {
    loading.value = false;
  }
}, 400);

function onInput() {
  loading.value = true;
  open.value = true;
  search();
}

function select(result: AddressResult) {
  emit("selected", result);
  query.value = "";
  results.value = [];
  open.value = false;
}

function clear() {
  emit("cleared");
  query.value = "";
  results.value = [];
  open.value = false;
}
</script>

<template>
  <div class="relative">
    <div v-if="modelValue" class="flex items-center gap-2">
      <div
        class="flex flex-1 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
      >
        <MapPin class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]" />
        <span class="truncate">{{ modelValue }}</span>
      </div>
      <Button type="button" variant="ghost" size="icon" @click="clear">
        <X class="h-4 w-4" />
      </Button>
    </div>

    <template v-else>
      <div class="relative">
        <Input
          v-model="query"
          :placeholder="$t('common.address_search.placeholder')"
          autocomplete="off"
          @input="onInput"
          @focus="open = results.length > 0"
        />
        <Loader2
          v-if="loading"
          class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
        />
      </div>

      <ul
        v-if="open && results.length > 0"
        class="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md"
      >
        <li v-for="result in results" :key="result.label">
          <button
            type="button"
            class="flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
            @click="select(result)"
          >
            <MapPin class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{{ result.label }}</span>
          </button>
        </li>
      </ul>

      <p
        v-else-if="open && !loading && query.trim().length >= 3"
        class="mt-1 text-xs text-muted-foreground"
      >
        {{ $t("common.address_search.no_results") }}
      </p>
    </template>
  </div>
</template>
