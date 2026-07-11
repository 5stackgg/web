<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { CaretSortIcon } from "@radix-icons/vue";
import { UserPlus } from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

// Tag selector restricted to players who actually took part in THIS event
// (from the event's derived stats). No online/offline — irrelevant for an
// event-scoped, historical tag.
const props = defineProps<{
  eventId: string;
  exclude?: string[];
  // Trigger/placeholder label; defaults to the tag copy.
  label?: string;
}>();

const labelText = computed(
  () => props.label || useNuxtApp().$i18n.t("event.media.tag_players"),
);

const emit = defineEmits<{ (e: "selected", player: any): void }>();

const PARTICIPANTS_QUERY = typedGql("query")({
  v_event_player_stats: [
    {
      where: { event_id: { _eq: $("eventId", "uuid!") } },
    },
    {
      player_steam_id: true,
      player: {
        steam_id: true,
        name: true,
        avatar_url: true,
        country: true,
      },
    },
  ],
});

const { client: apolloClient } = useApolloClient();

const open = ref(false);
const query = ref("");
const participants = ref<any[] | null>(null);
const loading = ref(false);
const activeIndex = ref(0);

async function load() {
  if (participants.value) return;
  loading.value = true;
  try {
    const { data } = await apolloClient.query({
      query: PARTICIPANTS_QUERY,
      variables: { eventId: props.eventId },
      fetchPolicy: "network-only",
    });
    participants.value = ((data as any)?.v_event_player_stats || [])
      .map((row: any) => row.player)
      .filter(Boolean);
  } catch (error) {
    console.error("Error loading event participants:", error);
    participants.value = [];
  } finally {
    loading.value = false;
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    activeIndex.value = 0;
    void load();
  }
});

const results = computed(() => {
  const excluded = new Set((props.exclude || []).map(String));
  const q = query.value.toLowerCase();
  return (participants.value || []).filter((p) => {
    if (excluded.has(String(p.steam_id))) return false;
    return !q || (p.name || "").toLowerCase().includes(q);
  });
});

watch(results, () => {
  activeIndex.value = 0;
});

function onKeydown(event: KeyboardEvent) {
  const list = results.value;
  if (!list.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeIndex.value = Math.min(activeIndex.value + 1, list.length - 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    activeIndex.value = Math.max(activeIndex.value - 1, 0);
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (list[activeIndex.value]) select(list[activeIndex.value]);
  }
}

function select(player: any) {
  open.value = false;
  query.value = "";
  emit("selected", player);
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
          <UserPlus class="h-4 w-4 shrink-0 text-muted-foreground" />
          <span class="truncate">{{ labelText }}</span>
        </div>
        <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>
    </PopoverTrigger>
    <PopoverContent class="w-[340px] p-0">
      <div class="flex flex-col">
        <div class="border-b px-3 py-2">
          <input
            v-model="query"
            :placeholder="labelText"
            type="search"
            autocomplete="off"
            class="w-full bg-transparent outline-none"
            @keydown="onKeydown"
          />
        </div>
        <div class="max-h-[280px] overflow-y-auto">
          <div
            v-if="loading"
            class="p-4 text-center text-sm text-muted-foreground"
          >
            {{ $t("common.loading") }}
          </div>
          <div
            v-else-if="results.length === 0"
            class="p-4 text-center text-sm text-muted-foreground"
          >
            {{ $t("event.media.no_participants") }}
          </div>
          <button
            v-for="(player, index) in results"
            v-else
            :key="player.steam_id"
            type="button"
            class="flex w-full items-center px-3 py-2 text-left"
            :class="index === activeIndex ? 'bg-accent' : 'hover:bg-accent'"
            @click="select(player)"
            @mouseenter="activeIndex = index"
          >
            <PlayerDisplay
              :player="player"
              size="xs"
              compact
              :show-flag="true"
              :show-role="false"
              :show-elo="false"
              :show-online="false"
              :tooltip="false"
              :linkable="false"
            />
          </button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
