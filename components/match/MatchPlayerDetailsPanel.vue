<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import LineupOverview from "~/components/match/LineupOverview.vue";
import LineupUtility from "~/components/match/LineupUtility.vue";
import LineupTradeStats from "~/components/match/LineupTradeStats.vue";
import LineupAimStats from "~/components/match/LineupAimStats.vue";
import cleanMapName from "~/utilities/cleanMapName";

const { t } = useI18n();
const tabs = computed(() => [
  { value: "overview", label: t("match.tabs.overview") },
  { value: "utility", label: t("match.tabs.utility") },
  { value: "trades", label: t("match.tabs.trade_stats") },
  { value: "aim", label: t("match.tabs.aim_stats") },
]);

const props = defineProps<{
  match: any;
  focusLineup: any | null;
  loading: boolean;
  activeTab: string;
  selectedMapId?: string | null;
}>();

const emit = defineEmits<{
  (e: "update:active-tab", value: string): void;
  (e: "update:selected-map-id", value: string | null): void;
}>();

function isMapPlayed(mm: any): boolean {
  return !(mm?.lineup_1_score === 0 && mm?.lineup_2_score === 0);
}
function selectMap(id: string | null) {
  emit("update:selected-map-id", id);
}
function toggleMap(mm: any) {
  if (!isMapPlayed(mm)) return;
  emit("update:selected-map-id", props.selectedMapId === mm.id ? null : mm.id);
}
</script>

<template>
  <div>
    <div v-if="loading" class="space-y-2 py-2">
      <Skeleton class="h-6 w-32" />
      <Skeleton class="h-4 w-full" />
      <Skeleton class="h-4 w-5/6" />
    </div>

    <div
      v-else-if="!focusLineup"
      class="py-3 text-center text-xs text-muted-foreground"
    >
      {{ $t("match.player_details_panel.stats_unavailable") }}
    </div>

    <Tabs
      v-else
      :model-value="activeTab"
      @update:model-value="(v) => emit('update:active-tab', v as string)"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <!-- Default variant keeps TabsList's animated sliding indicator
             (amber pill that glides between active tabs). Trigger
             itself stays transparent — only text color flips on active
             — so the indicator behind is the only pill chrome. -->
        <TabsList
          class="inline-flex h-auto items-center gap-1 bg-transparent p-0"
        >
          <TabsTrigger
            v-for="tab in tabs"
            :key="tab.value"
            :value="tab.value"
            class="relative z-[1] rounded-md px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors duration-150 hover:text-foreground data-[state=active]:text-[hsl(var(--tac-amber))]"
          >
            {{ tab.label }}
          </TabsTrigger>
        </TabsList>

        <div
          v-if="match?.match_maps && match.match_maps.length > 0"
          class="ml-auto flex flex-wrap items-center gap-1.5"
        >
          <span
            class="font-mono text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("match.player_details_panel.map_label") }}
          </span>
          <button
            v-if="match.match_maps.length > 1"
            type="button"
            class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] transition-colors"
            :class="
              selectedMapId === null
                ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                : 'border-border bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground'
            "
            @click.stop="selectMap(null)"
          >
            {{ $t("match.player_details_panel.all_maps") }}
          </button>
          <button
            v-for="mm in match.match_maps"
            :key="mm.id"
            type="button"
            class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] transition-colors"
            :class="[
              !isMapPlayed(mm)
                ? 'cursor-not-allowed border-border/40 bg-muted/10 text-muted-foreground/40 line-through'
                : selectedMapId === mm.id
                  ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-border hover:text-foreground',
            ]"
            :disabled="!isMapPlayed(mm) || match.match_maps.length === 1"
            :title="
              !isMapPlayed(mm)
                ? t('match.player_details_panel.map_not_played')
                : cleanMapName(mm.map?.label || mm.map?.name || '')
            "
            @click.stop="toggleMap(mm)"
          >
            {{ cleanMapName(mm.map?.label || mm.map?.name || "") }}
            <span class="tabular-nums opacity-70">
              {{ mm.lineup_1_score }}:{{ mm.lineup_2_score }}
            </span>
          </button>
        </div>
      </div>

      <TabsContent value="overview" class="overflow-x-auto pt-2 min-h-[7rem]">
        <LineupOverview
          :match="match"
          :lineup="focusLineup"
          :show-stats="true"
          :hide-member="true"
        />
      </TabsContent>
      <TabsContent value="utility" class="overflow-x-auto pt-2 min-h-[7rem]">
        <LineupUtility
          :match="match"
          :lineup="focusLineup"
          :hide-member="true"
        />
      </TabsContent>
      <TabsContent value="trades" class="overflow-x-auto pt-2 min-h-[7rem]">
        <LineupTradeStats
          :match="match"
          :lineup="focusLineup"
          :hide-member="true"
        />
      </TabsContent>
      <TabsContent value="aim" class="overflow-x-auto pt-2 min-h-[7rem]">
        <LineupAimStats
          :match="match"
          :lineup="focusLineup"
          :hide-member="true"
        />
      </TabsContent>
    </Tabs>
  </div>
</template>
