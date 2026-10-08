<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { LayoutGrid } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { useUtilityMaps } from "~/composables/useUtilityMaps";

const props = defineProps<{
  // Null on the maps index, where no map is picked and the grid entry is lit.
  mapName: string | null;
  /** A strip across the top of the page on narrow screens, a rail beside the map otherwise. */
  horizontal?: boolean;
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { tiles, counts, privateCounts, loadCounts } = useUtilityMaps();

onMounted(() => {
  void loadCounts();
});

function tally(name: string) {
  const pub = counts.value[name] ?? 0;
  const priv = privateCounts.value[name] ?? 0;
  const lines = [`${pub} · ${t("pages.utility.picker.count_public")}`];
  if (priv) {
    lines.push(`${priv} · ${t("pages.utility.picker.count_private")}`);
  }
  return lines;
}

// Scope and filters survive the switch; the open lineup belongs to the old map.
function pick(name: string) {
  if (name === props.mapName) {
    return;
  }
  const query = { ...route.query } as Record<string, unknown>;
  delete query.lineup;
  void router.push({ name: "utility-map", params: { map: name }, query: query as any });
}
</script>

<template>
  <nav
    :aria-label="$t('pages.utility.picker.label')"
    class="flex gap-2.5 rounded-[22px] border border-white/[0.08] bg-[rgba(30,30,34,0.82)] shadow-[0_24px_48px_-16px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl backdrop-saturate-150"
    :class="
      horizontal
        ? 'flex-row overflow-x-auto px-3 py-2 [scrollbar-width:none]'
        : 'w-[60px] shrink-0 flex-col items-center py-3.5'
    "
  >
    <!-- All maps, first: lit on the index, and from a map it is the way back
         there. Until this, the rail only went sideways. -->
    <div
      class="group/dock relative flex shrink-0 justify-center"
      :class="horizontal ? '' : 'w-full'"
    >
      <FiveStackToolTip
        as-child
        :side="horizontal ? 'bottom' : 'right'"
        :delay-duration="120"
        :tap-toggle="false"
      >
        <template #trigger>
          <NuxtLink
            :to="{ name: 'utility' }"
            :aria-label="$t('pages.utility.picker.all_maps')"
            :aria-current="mapName === null ? 'page' : undefined"
            class="grid size-10 place-items-center border transition-[border-radius,background-color,border-color,color,transform] active:scale-[0.96] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:![transition-duration:1ms]"
            :class="
              mapName === null
                ? 'rounded-xl border-white/20 bg-[linear-gradient(180deg,#56565f,#3a3a41)] text-foreground'
                : 'rounded-[20px] border-white/[0.07] bg-[linear-gradient(180deg,#34343a,#242428)] text-zinc-400 group-hover/dock:rounded-xl group-hover/dock:border-white/10 group-hover/dock:bg-[linear-gradient(180deg,#46464e,#2e2e33)] group-hover/dock:text-foreground'
            "
          >
            <LayoutGrid class="size-5" />
          </NuxtLink>
        </template>
        <span class="font-semibold">
          {{ $t("pages.utility.picker.all_maps") }}
        </span>
      </FiveStackToolTip>
    </div>
    <span
      aria-hidden="true"
      class="shrink-0 bg-white/10"
      :class="horizontal ? 'my-1.5 w-px' : 'h-px w-6'"
    />

    <template v-if="tiles.length">
      <div
        v-for="tile of tiles"
        :key="tile.name"
        class="group/dock relative flex shrink-0 justify-center"
        :class="horizontal ? '' : 'w-full'"
      >
        <span class="relative inline-flex">
          <FiveStackToolTip
            as-child
            :side="horizontal ? 'bottom' : 'right'"
            :delay-duration="120"
            :tap-toggle="false"
          >
            <template #trigger>
          <button
            type="button"
            :aria-label="tile.label"
            :aria-current="tile.name === mapName ? 'page' : undefined"
            class="grid size-10 place-items-center border transition-[border-radius,background-color,border-color,transform] active:scale-[0.96] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:![transition-duration:1ms]"
            :class="
              tile.name === mapName
                ? 'rounded-xl border-white/20 bg-[linear-gradient(180deg,#56565f,#3a3a41)]'
                : 'rounded-[20px] border-white/[0.07] bg-[linear-gradient(180deg,#34343a,#242428)] group-hover/dock:rounded-xl group-hover/dock:border-white/10 group-hover/dock:bg-[linear-gradient(180deg,#46464e,#2e2e33)]'
            "
            @click="pick(tile.name)"
          >
            <!-- No panel opens beside the rail, so it has no edge bar pointing at
                 one. The map you are on is the one in colour: squared off,
                 lifted, and the rest stay muted until you reach for them. -->
            <img
              v-if="tile.patch"
              :src="tile.patch"
              alt=""
              class="size-6 object-contain transition-[opacity,filter] [transition-duration:240ms] motion-reduce:![transition-duration:1ms]"
              :class="
                tile.name === mapName
                  ? ''
                  : 'opacity-55 grayscale group-hover/dock:opacity-100 group-hover/dock:grayscale-0'
              "
            />
            <span
              v-else
              class="text-[0.6rem] font-bold uppercase"
              :class="tile.name === mapName ? '' : 'text-zinc-400'"
            >
              {{ tile.label.slice(0, 2) }}
            </span>
          </button>
            </template>
            <span class="font-semibold">{{ tile.label }}</span>
            <span
              v-for="line of tally(tile.name)"
              :key="line"
              class="block tabular-nums text-muted-foreground"
            >
              {{ line }}
            </span>
          </FiveStackToolTip>
          <span
            v-if="counts[tile.name]"
            aria-hidden="true"
            class="pointer-events-none absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-700 px-1 text-[0.6rem] font-bold leading-none tabular-nums text-zinc-200 shadow-[0_0_0_2px_#1e1e22]"
          >
            {{ counts[tile.name] }}
          </span>
        </span>
      </div>
    </template>
    <template v-else>
      <span
        v-for="n of 10"
        :key="n"
        aria-hidden="true"
        class="size-10 shrink-0 rounded-full bg-white/[0.05]"
      />
    </template>
  </nav>
</template>
