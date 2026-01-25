<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { Input } from "~/components/ui/input";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import debounce from "~/utilities/debounce";
import { MagnifyingGlassIcon } from "@radix-icons/vue";

const open = ref(false);
const query = ref("");
const players = ref<any[]>([]);
const loading = ref(false);
const selectedIndex = ref(0);

// Handle keyboard shortcut (Cmd+K or Ctrl+K) to open spotlight
const handleGlobalKeydown = (event: KeyboardEvent) => {
  // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  if ((event.metaKey || event.ctrlKey) && event.key === "k") {
    event.preventDefault();
    open.value = true;
  }
  // Close on Escape
  if (event.key === "Escape" && open.value) {
    event.preventDefault();
    open.value = false;
  }
};

// Handle arrow key navigation and enter
const handleResultsKeydown = (event: KeyboardEvent) => {
  if (!open.value || players.value.length === 0) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    selectedIndex.value = Math.min(
      selectedIndex.value + 1,
      players.value.length - 1,
    );
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (players.value[selectedIndex.value]) {
      selectPlayer(players.value[selectedIndex.value]);
    }
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("keydown", handleResultsKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
  window.removeEventListener("keydown", handleResultsKeydown);
});

const debouncedSearch = debounce(async (searchQuery: string) => {
  if (!searchQuery.trim()) {
    players.value = [];
    return;
  }

  loading.value = true;

  try {
    const response = await $fetch("/api/players-search", {
      method: "post",
      body: {
        query: searchQuery,
        per_page: 10,
      },
    });

    players.value = (response.hits || []).map(({ document }: any) => document);
  } catch (error) {
    console.error("Error searching players:", error);
    players.value = [];
  } finally {
    loading.value = false;
  }
}, 300);

watch(query, (newQuery) => {
  selectedIndex.value = 0; // Reset selection when query changes
  debouncedSearch(newQuery);
});

const selectPlayer = (player: any) => {
  open.value = false;
  // Navigate to player page
  navigateTo(`/players/${player.steam_id}`);
};

// Clear results when popover closes
watch(open, (newOpen) => {
  if (!newOpen) {
    query.value = "";
    players.value = [];
    selectedIndex.value = 0;
  }
});

// Focus input when popover opens via keyboard shortcut
watch(open, (newOpen) => {
  if (newOpen) {
    // Use nextTick to ensure DOM is updated before focusing
    nextTick(() => {
      const input = document.querySelector(
        'input[placeholder="Search players..."]',
      );
      if (input) {
        (input as HTMLInputElement).focus();
      }
    });
  }
});

// Close spotlight when clicking on overlay
const closeOnOverlayClick = (event: MouseEvent) => {
  if (event.target === event.currentTarget) {
    open.value = false;
  }
};
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      id="spotlight-overlay"
      class="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-start justify-center pt-[15vh] p-4"
      @click="closeOnOverlayClick"
    >
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 scale-95 translate-y-4"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 scale-100 translate-y-0"
        leave-to-class="opacity-0 scale-95 translate-y-4"
      >
        <div
          v-if="open"
          class="w-full max-w-2xl bg-background rounded-xl shadow-2xl border border-border/50 overflow-hidden"
        >
          <!-- Search Input -->
          <div class="flex items-center gap-3 px-4 py-4 border-b border-border/50">
            <MagnifyingGlassIcon
              class="size-5 text-muted-foreground flex-shrink-0"
            />
            <Input
              v-model="query"
              placeholder="Search players..."
              class="flex-1 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base px-0 h-auto"
              autofocus
            />
          </div>

          <!-- Results -->
          <div class="max-h-[400px] overflow-y-auto">
            <div v-if="loading" class="px-4 py-8 text-center text-muted-foreground text-sm">
              Searching...
            </div>

            <div
              v-else-if="!players?.length && query"
              class="px-4 py-8 text-center text-muted-foreground text-sm"
            >
              No players found
            </div>

            <div
              v-else-if="!query"
              class="px-4 py-8 text-center"
            >
              <div class="text-muted-foreground text-sm">
                Start typing to search players
              </div>
            </div>

            <div v-else class="py-2">
              <div
                v-for="(player, index) in players"
                :key="`player-${player.steam_id}`"
                :class="[
                  'px-4 py-3 cursor-pointer flex items-center gap-3 transition-colors',
                  selectedIndex === index
                    ? 'bg-accent'
                    : 'hover:bg-accent/50',
                ]"
                @click="selectPlayer(player)"
                @mouseenter="selectedIndex = index"
              >
                <PlayerDisplay :player="player" size="md" />
              </div>
            </div>
          </div>

        </div>
      </Transition>
    </div>
  </Transition>
</template>
