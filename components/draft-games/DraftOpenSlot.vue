<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Plus } from "lucide-vue-next";
import PlayerSearch from "~/components/PlayerSearch.vue";

const props = defineProps<{
  exclude: Array<string>;
}>();

const { t } = useI18n();

// The reason is uniform here, so callers keep passing a plain id list and the
// map is built at the leaf.
const ineligible = computed(() =>
  Object.fromEntries(
    props.exclude.map((steamId) => [
      String(steamId),
      t("player.search.ineligible.in_draft"),
    ]),
  ),
);

const emit = defineEmits<{
  selected: [steamId: string, player: { steam_id: string }];
}>();

const onSelected = (player: { steam_id: string }) => {
  emit("selected", player.steam_id, player);
};
</script>

<template>
  <div>
    <PlayerSearch
      :label="$t('draft_games.room.search_player')"
      :ineligible="ineligible"
      :group-by-friends="true"
      :self="true"
      @selected="onSelected"
    >
      <button type="button" class="open-slot">
        <span class="open-slot-avatar">
          <Plus class="h-3.5 w-3.5" />
        </span>
        <span class="open-slot-label">
          {{ $t("draft_games.room.add_player_slot") }}
        </span>
      </button>
    </PlayerSearch>
  </div>
</template>

<style scoped>
.open-slot {
  display: flex;
  width: 100%;
  min-height: 3.5rem;
  align-items: center;
  gap: 0.6rem;
  border-radius: 0.55rem;
  border: 1px dashed hsl(var(--border) / 0.7);
  background: transparent;
  padding: 0.5rem 0.75rem;
  color: hsl(var(--muted-foreground));
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}
.open-slot:hover {
  border-color: hsl(var(--tac-amber) / 0.55);
  background: hsl(var(--tac-amber) / 0.06);
  color: hsl(var(--tac-amber));
}
.open-slot-avatar {
  display: grid;
  place-items: center;
  height: 1.75rem;
  width: 1.75rem;
  flex-shrink: 0;
  border-radius: 9999px;
  border: 1px dashed hsl(var(--border));
  transition: border-color 0.15s ease;
}
.open-slot:hover .open-slot-avatar {
  border-color: hsl(var(--tac-amber) / 0.5);
}
.open-slot-label {
  font-size: 0.8rem;
  font-weight: 500;
}
</style>
