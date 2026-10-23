<script setup lang="ts">
import { computed, ref } from "vue";
import { Search } from "lucide-vue-next";
import { Input } from "~/components/ui/input";
import HubEmptyState from "~/components/hub/HubEmptyState.vue";
import FriendListItem from "~/components/matchmaking-lobby/FriendListItem.vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const matchmakingStore = useMatchmakingStore();
const authStore = useAuthStore();
const searchQuery = ref("");

const regionName = computed(() => {
  const region = useApplicationSettingsStore().availableRegions.find(
    (candidate: any) => candidate.value === matchmakingStore.lanRegion,
  );
  return region?.description || matchmakingStore.lanRegion;
});

// Like Others before it: accepted friends and incoming requests live in the
// Friends tab, and an outgoing request stays here so adding someone doesn't
// move them mid-action.
const listed = computed(() => {
  const me = String(authStore.me?.steam_id);
  const q = searchQuery.value.toLowerCase();

  return (matchmakingStore.lanPlayers as any[]).filter((player) => {
    if (String(player.steam_id) === me) {
      return false;
    }
    const entry = (matchmakingStore.friends as any[])?.find(
      (friend) => String(friend.steam_id) === String(player.steam_id),
    );
    if (
      entry &&
      (entry.status !== "Pending" || String(entry.invited_by_steam_id) !== me)
    ) {
      return false;
    }
    return (
      !q ||
      player.name?.toLowerCase().includes(q) ||
      String(player.steam_id).includes(searchQuery.value)
    );
  });
});

const left = computed(() => new Set(matchmakingStore.lanLeft as string[]));
const arrivals = computed(
  () => new Set(matchmakingStore.lanArrivals as string[]),
);

const justArrived = computed(() =>
  listed.value.filter(
    (player) =>
      arrivals.value.has(player.steam_id) && !left.value.has(player.steam_id),
  ),
);
const atLan = computed(() =>
  listed.value.filter(
    (player) =>
      !arrivals.value.has(player.steam_id) || left.value.has(player.steam_id),
  ),
);
</script>

<template>
  <div class="flex min-h-full flex-1 flex-col gap-3 p-2">
    <div class="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        data-testid="lan-region"
        class="rounded border border-[hsl(var(--tac-amber)/0.4)] px-1.5 py-px font-mono text-[0.65rem] text-[hsl(var(--tac-amber))]"
      >
        {{ regionName }}
      </span>
      {{ $t("matchmaking.lan.everyone_here") }}
    </div>
    <div class="relative">
      <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        v-model="searchQuery"
        :placeholder="$t('matchmaking.lan.search_placeholder')"
        class="pl-8"
      />
    </div>

    <section v-if="justArrived.length > 0" data-testid="lan-arrived">
      <div class="lan-section-label">
        {{ $t("matchmaking.lan.just_arrived") }}
        <span class="ml-auto tabular-nums opacity-70">
          {{ justArrived.length }}
        </span>
      </div>
      <FriendListItem
        v-for="player in justArrived"
        :key="`arrived-${player.steam_id}`"
        :player="player"
        :online="true"
      />
    </section>

    <section v-if="atLan.length > 0" data-testid="lan-players">
      <div class="lan-section-label">
        {{ $t("matchmaking.lan.at_this_lan") }}
        <span class="ml-auto tabular-nums opacity-70">
          {{ atLan.length }}
        </span>
      </div>
      <div
        v-for="player in atLan"
        :key="`lan-${player.steam_id}`"
        :data-left="left.has(player.steam_id) || undefined"
      >
        <FriendListItem
          :player="player"
          :online="!left.has(player.steam_id)"
          :muted="left.has(player.steam_id)"
        />
        <p
          v-if="left.has(player.steam_id)"
          class="-mt-1 pb-1 pl-12 text-[0.65rem] text-muted-foreground"
        >
          {{ $t("matchmaking.lan.left") }}
        </p>
      </div>
    </section>

    <HubEmptyState
      v-if="listed.length === 0"
      :title="
        searchQuery
          ? $t('layouts.hub.empty.no_match', { query: searchQuery })
          : $t('matchmaking.lan.empty_title')
      "
      :description="
        searchQuery ? null : $t('matchmaking.lan.empty_description')
      "
    />
  </div>
</template>

<style scoped>
.lan-section-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
</style>
