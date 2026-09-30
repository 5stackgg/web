<script setup lang="ts">
import { ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { CaretSortIcon } from "@radix-icons/vue";
import { CalendarDays } from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import debounce from "~/utilities/debounce";
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import {
  eventPhase,
  formatEventDate,
  phaseBadgeVariant,
  phaseLabelKey,
} from "~/utilities/eventDisplay";

const props = defineProps<{
  label: string;
  exclude?: string[];
}>();

const emit = defineEmits<{ (e: "selected", event: any): void }>();

const SEARCH_EVENTS = typedGql("query")({
  events: [
    {
      limit: 20,
      order_by: [{ starts_at: order_by.desc_nulls_last }],
      where: $("where", "events_bool_exp!"),
    },
    { id: true, name: true, starts_at: true, ends_at: true },
  ],
});

const { client: apolloClient } = useApolloClient();

const open = ref(false);
const query = ref("");
const results = ref<any[] | undefined>(undefined);
const searchToken = ref(0);

async function search() {
  // A slower earlier keystroke must not clobber a newer result set.
  const token = ++searchToken.value;

  const filters: any[] = [];
  if (props.exclude?.length) {
    filters.push({ id: { _nin: props.exclude } });
  }
  if (query.value) {
    filters.push({ name: { _ilike: `%${query.value}%` } });
  }
  const { data } = await apolloClient.query({
    query: SEARCH_EVENTS,
    fetchPolicy: "network-only",
    variables: { where: { _and: filters } },
  });
  if (token !== searchToken.value) {
    return;
  }
  results.value = (data as any)?.events || [];
}

const debouncedSearch = debounce(search, 300);

watch(open, (isOpen) => {
  if (isOpen) {
    void search();
  }
});

function select(event: any) {
  open.value = false;
  query.value = "";
  emit("selected", event);
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        :aria-expanded="open"
        class="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <div class="flex min-w-0 items-center gap-2">
          <CalendarDays class="h-4 w-4 shrink-0 text-muted-foreground" />
          <span class="truncate">{{ label }}</span>
        </div>
        <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>
    </PopoverTrigger>
    <PopoverContent class="w-[400px] p-0">
      <div class="flex flex-col">
        <div class="border-b px-3 py-2">
          <input
            v-model="query"
            :placeholder="label"
            type="search"
            inputmode="search"
            enterkeyhint="search"
            autocomplete="off"
            class="w-full bg-transparent outline-none"
            @input="debouncedSearch"
          />
        </div>

        <div class="max-h-[300px] overflow-y-auto">
          <div
            v-if="!results?.length"
            class="p-4 text-center text-muted-foreground"
          >
            {{ $t("pages.dedicated_servers.detail.access.no_events") }}
          </div>

          <div v-else class="divide-y">
            <div
              v-for="event in results"
              :key="event.id"
              class="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-accent"
              @click="select(event)"
            >
              <CalendarDays
                class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              />
              <span class="min-w-0 flex-1 truncate text-sm">{{
                event.name
              }}</span>
              <span
                v-if="formatEventDate(event.starts_at)"
                class="shrink-0 font-mono text-[0.62rem] text-muted-foreground"
              >
                {{ formatEventDate(event.starts_at) }}
              </span>
              <Badge
                :variant="phaseBadgeVariant(eventPhase(event))"
                class="shrink-0"
              >
                {{ $t(phaseLabelKey(eventPhase(event))) }}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
