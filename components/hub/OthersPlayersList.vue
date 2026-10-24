<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Search } from "lucide-vue-next";
import { useElementVisibility } from "@vueuse/core";
import { Input } from "~/components/ui/input";
import HubEmptyState from "~/components/hub/HubEmptyState.vue";
import FriendListItem from "~/components/matchmaking-lobby/FriendListItem.vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import debounce from "~/utilities/debounce";

const matchmakingStore = useMatchmakingStore();
const authStore = useAuthStore();
const searchQuery = ref("");

const me = computed(() => String(authStore.me?.steam_id));
const onLan = computed(() => !!matchmakingStore.lanRegion);
const listed = computed(() => matchmakingStore.onlineListed);

const regionName = computed(() => {
  const region = useApplicationSettingsStore().availableRegions.find(
    (candidate: any) => candidate.value === matchmakingStore.lanRegion,
  );
  return region?.description || matchmakingStore.lanRegion;
});

// Accepted friends and incoming requests live in the Friends tab, and an
// outgoing request stays here so adding someone doesn't move them mid-action.
const isOther = (steamId: string) => {
  if (steamId === me.value) {
    return false;
  }
  const entry = (matchmakingStore.friends as any[])?.find(
    (friend) => String(friend.steam_id) === steamId,
  );
  return (
    !entry ||
    (entry.status === "Pending" &&
      String(entry.invited_by_steam_id) === me.value)
  );
};

const lanListed = computed(() => {
  const q = searchQuery.value.toLowerCase();

  return (matchmakingStore.lanPlayers as any[]).filter(
    (player) =>
      isOther(String(player.steam_id)) &&
      (!q ||
        player.name?.toLowerCase().includes(q) ||
        String(player.steam_id).includes(searchQuery.value)),
  );
});

const lanIds = computed(
  () =>
    new Set(
      (matchmakingStore.lanPlayers as any[]).map((player) =>
        String(player.steam_id),
      ),
    ),
);
const lanLeft = computed(() => new Set(matchmakingStore.lanLeft as string[]));
const lanArrivals = computed(
  () => new Set(matchmakingStore.lanArrivals as string[]),
);

const justArrived = computed(() =>
  lanListed.value.filter(
    (player) =>
      lanArrivals.value.has(player.steam_id) &&
      !lanLeft.value.has(player.steam_id),
  ),
);
const lanHere = computed(
  () =>
    lanListed.value.filter((player) => !lanLeft.value.has(player.steam_id))
      .length,
);
const atLan = computed(() =>
  lanListed.value.filter(
    (player) =>
      !lanArrivals.value.has(player.steam_id) ||
      lanLeft.value.has(player.steam_id),
  ),
);

const listRoot = ref<HTMLElement | null>(null);
const sentinel = ref<HTMLElement | null>(null);
const visible = useElementVisibility(listRoot);
const sentinelVisible = useElementVisibility(sentinel);
const listing = computed(() => listed.value && visible.value);

const rows = ref<Array<any>>([]);
const next = ref<string | null>(null);
const loading = ref(false);
const loaded = ref(false);
let request = 0;

const onlineShown = computed(() =>
  rows.value.filter(
    (player) => isOther(player.steam_id) && !lanIds.value.has(player.steam_id),
  ),
);

const onlineLeft = computed(
  () =>
    new Set(
      Object.entries(matchmakingStore.onlineChanges as Record<string, boolean>)
        .filter(([, online]) => !online)
        .map(([steamId]) => steamId),
    ),
);

const newOnline = computed(() => {
  const shown = new Set(rows.value.map((player) => player.steam_id));
  return Object.entries(
    matchmakingStore.onlineChanges as Record<string, boolean>,
  ).filter(
    ([steamId, online]) =>
      online &&
      !shown.has(steamId) &&
      isOther(steamId) &&
      !lanIds.value.has(steamId),
  ).length;
});

async function load(reset: boolean) {
  if (reset) {
    request += 1;
    rows.value = [];
    next.value = null;
    loaded.value = false;
    matchmakingStore.clearOnlineChanges();
  } else if (loading.value || !next.value) {
    return;
  }

  const token = request;
  loading.value = true;
  const page = await matchmakingStore.fetchOnlinePage({
    after: next.value,
    query: searchQuery.value.trim(),
  });
  if (token !== request) {
    return;
  }

  loading.value = false;
  if (!page) {
    return;
  }

  loaded.value = true;
  const seen = new Set(rows.value.map((player) => player.steam_id));
  rows.value = page.listed
    ? [
        ...rows.value,
        ...page.players.filter((player) => !seen.has(player.steam_id)),
      ]
    : [];
  next.value = page.listed ? page.next : null;
}

function stop() {
  request += 1;
  rows.value = [];
  next.value = null;
  loaded.value = false;
  loading.value = false;
}

let watching = false;
watch(
  listing,
  (on) => {
    if (on === watching) {
      return;
    }
    watching = on;
    matchmakingStore.watchOnline(on);
    if (on) {
      void load(true);
    } else {
      stop();
    }
  },
  { immediate: true },
);

watch(
  () => matchmakingStore.onlineResets,
  () => {
    if (listing.value) {
      void load(true);
    }
  },
);

const searchOnline = debounce(() => {
  if (listing.value) {
    void load(true);
  }
}, 300);
watch(searchQuery, () => searchOnline());

watch([sentinelVisible, loading, next], () => {
  if (sentinelVisible.value && listing.value) {
    void load(false);
  }
});

onBeforeUnmount(() => {
  searchOnline.cancel();
  if (watching) {
    matchmakingStore.watchOnline(false);
  }
});

// On a LAN each group says it's empty itself; off one, the online list is all
// there is.
const isEmpty = computed(
  () =>
    !onLan.value &&
    listing.value &&
    loaded.value &&
    !loading.value &&
    onlineShown.value.length === 0 &&
    newOnline.value === 0,
);
</script>

<template>
  <div ref="listRoot" class="flex min-h-full flex-1 flex-col gap-3 p-2">
    <div class="relative">
      <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        v-model="searchQuery"
        :placeholder="
          listed
            ? $t('player.search.placeholder')
            : $t('matchmaking.lan.search_placeholder')
        "
        class="pl-8"
      />
    </div>

    <section v-if="onLan" data-testid="lan-group">
      <div class="others-group-label text-[hsl(var(--tac-amber))]">
        <span class="h-[2px] w-2 bg-[hsl(var(--tac-amber))]" />
        <span data-testid="lan-region">
          {{ $t("matchmaking.lan.at_region", { region: regionName }) }}
        </span>
        <span class="ml-auto tabular-nums opacity-70">{{ lanHere }}</span>
      </div>

      <div v-if="justArrived.length > 0" data-testid="lan-arrived">
        <div class="others-sub-label">
          {{ $t("matchmaking.lan.just_arrived") }}
        </div>
        <FriendListItem
          v-for="player in justArrived"
          :key="`arrived-${player.steam_id}`"
          :player="player"
          :online="true"
        />
      </div>

      <div v-if="atLan.length > 0" data-testid="lan-players">
        <div v-if="justArrived.length > 0" class="others-sub-label">
          {{ $t("matchmaking.lan.at_this_lan") }}
        </div>
        <div
          v-for="player in atLan"
          :key="`lan-${player.steam_id}`"
          :data-left="lanLeft.has(player.steam_id) || undefined"
        >
          <FriendListItem
            :player="player"
            :online="!lanLeft.has(player.steam_id)"
            :muted="lanLeft.has(player.steam_id)"
          />
          <p
            v-if="lanLeft.has(player.steam_id)"
            class="-mt-1 pb-1 pl-12 text-[0.65rem] text-muted-foreground"
          >
            {{ $t("matchmaking.lan.left") }}
          </p>
        </div>
      </div>

      <p
        v-if="lanListed.length === 0"
        class="px-1 text-xs text-muted-foreground"
      >
        {{
          searchQuery
            ? $t("layouts.hub.empty.no_match", { query: searchQuery })
            : $t("matchmaking.lan.empty_title")
        }}
      </p>
    </section>

    <section
      v-if="listing && (onlineShown.length > 0 || newOnline > 0 || onLan)"
      data-testid="online-players"
      :class="{ 'border-t border-border pt-3': onLan }"
    >
      <div class="others-group-label text-muted-foreground">
        <span class="h-2 w-2 rounded-full bg-green-500" />
        {{
          onLan
            ? $t("matchmaking.others.online_elsewhere")
            : $t("common.online")
        }}
      </div>
      <button
        v-if="newOnline > 0 && !searchQuery"
        type="button"
        data-testid="online-new"
        class="sticky top-0 z-10 mb-1 w-full rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-background/95 px-2 py-1 text-xs text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.12)]"
        @click="load(true)"
      >
        {{ $t("matchmaking.others.new_online", { count: newOnline }) }}
      </button>
      <div
        v-for="player in onlineShown"
        :key="`online-${player.steam_id}`"
        :data-left="onlineLeft.has(player.steam_id) || undefined"
      >
        <FriendListItem
          :player="player"
          :online="!onlineLeft.has(player.steam_id)"
          :muted="onlineLeft.has(player.steam_id)"
        />
        <p
          v-if="onlineLeft.has(player.steam_id)"
          class="-mt-1 pb-1 pl-12 text-[0.65rem] text-muted-foreground"
        >
          {{ $t("matchmaking.others.left") }}
        </p>
      </div>
      <p
        v-if="
          onlineShown.length === 0 && newOnline === 0 && loaded && !loading
        "
        class="px-1 text-xs text-muted-foreground"
      >
        {{
          searchQuery
            ? $t("layouts.hub.empty.no_match", { query: searchQuery })
            : $t("layouts.hub.empty.others_title")
        }}
      </p>
    </section>

    <div
      v-if="listing && (next || loading)"
      ref="sentinel"
      data-testid="online-more"
      class="py-2 text-center text-xs text-muted-foreground"
    >
      {{ $t("player.search.loading_more") }}
    </div>

    <HubEmptyState
      v-if="isEmpty"
      :title="
        searchQuery
          ? $t('layouts.hub.empty.no_match', { query: searchQuery })
          : $t('layouts.hub.empty.others_title')
      "
      :description="
        searchQuery ? null : $t('layouts.hub.empty.others_description')
      "
    />
  </div>
</template>

<style scoped>
.others-group-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.others-sub-label {
  margin: 0.25rem 0 0.25rem 0.1rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.55rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
</style>
