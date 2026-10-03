<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Target } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import StartPracticeDialog from "~/components/utility/StartPracticeDialog.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { loginLinks } from "~/utilities/loginLinks";
import cleanMapName from "~/utilities/cleanMapName";
import { loadRadarMaps, normalizeMapName } from "~/utilities/mapAssets";

const isGuest = computed(() => !useAuthStore().me?.steam_id);

// The practice dialog books a server for one map, so the tile picks it here.
// Only maps with a radar can carry lineups -- same rule as /utility.
const maps = ref<string[]>([]);
const mapName = ref<string>("");
const practiceOpen = ref(false);

const mapsQuery = generateQuery({
  maps: [
    {
      where: {
        enabled: { _eq: true },
        workshop_map_id: { _is_null: true },
      },
      order_by: [{ name: order_by.asc }],
    },
    { name: true },
  ],
});

onMounted(async () => {
  if (isGuest.value) return;
  try {
    const [{ data }, radarMaps] = await Promise.all([
      getGraphqlClient().query({
        query: mapsQuery,
        fetchPolicy: "cache-first",
      }),
      loadRadarMaps(),
    ]);
    const names = new Set<string>();
    for (const map of ((data as any)?.maps ?? []) as Array<{ name: string }>) {
      const radar = normalizeMapName(map.name);
      if (radarMaps.has(radar)) names.add(radar);
    }
    maps.value = [...names];
    mapName.value =
      maps.value.find((name) => name === "de_mirage") ?? maps.value[0] ?? "";
  } catch (error) {
    console.error("[play] practice maps error:", error);
  }
});

function signIn() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}

const touchTarget =
  "relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] [@media(pointer:fine)]:after:hidden";
</script>

<template>
  <article
    class="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-muted/20 p-4"
  >
    <div class="flex items-center justify-between gap-2">
      <h3 class="m-0 text-[15px] font-bold">
        {{ $t("pages.play.more_ways.practice.title") }}
      </h3>
      <Target aria-hidden="true" class="size-4 text-muted-foreground" />
    </div>

    <p class="m-0 text-[12.5px] text-muted-foreground">
      {{ $t("pages.play.more_ways.practice.description") }}
    </p>

    <div class="mt-auto flex flex-wrap items-center gap-2 pt-1">
      <Button
        v-if="isGuest"
        size="sm"
        variant="outline"
        :class="['h-8', touchTarget]"
        @click="signIn"
      >
        {{ $t("pages.play.more_ways.practice.sign_in") }}
      </Button>
      <template v-else>
        <Select v-if="maps.length > 1" v-model="mapName">
          <SelectTrigger
            class="h-8 w-auto min-w-[8.5rem] gap-2 text-xs"
            :aria-label="$t('pages.play.more_ways.practice.map')"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="map in maps" :key="map" :value="map">
              {{ cleanMapName(map) }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          :class="['h-8', touchTarget]"
          :disabled="!mapName"
          @click="practiceOpen = true"
        >
          {{ $t("pages.play.more_ways.practice.start") }}
        </Button>
      </template>
    </div>

    <StartPracticeDialog
      v-if="mapName"
      v-model:open="practiceOpen"
      :map-name="mapName"
    />
  </article>
</template>
