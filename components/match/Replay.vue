<script lang="ts" setup>
import { ExternalLink } from "lucide-vue-next";
import cleanMapName from "~/utilities/cleanMapName";
</script>

<template>
  <div>
    <div v-if="selectableMaps.length > 1" class="mb-4">
      <p
        v-if="!effectiveMap"
        class="mb-2 font-mono text-[0.7rem] tracking-[0.22em] uppercase text-[hsl(var(--tac-amber))]"
      >
        {{ $t("match.replay.select_map") }}
      </p>
      <div
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))"
        role="tablist"
      >
        <button
          v-for="m in selectableMaps"
          :key="m.id"
          type="button"
          role="tab"
          :aria-selected="effectiveMap?.id === m.id"
          class="group relative overflow-hidden border-2 transition-all text-left"
          :class="
            effectiveMap?.id === m.id
              ? 'border-[hsl(var(--tac-amber))] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.6),_0_8px_24px_-8px_hsl(var(--tac-amber)/0.45)]'
              : 'border-border/60 hover:border-[hsl(var(--tac-amber)/0.7)] hover:-translate-y-0.5'
          "
          @click="selectMap(m.id)"
        >
          <img
            :src="`/radars/${m.map.name
              .toLowerCase()
              .replace(/_night$/, '')}.png`"
            :alt="m.map.name"
            class="aspect-[4/3] w-full object-cover transition-opacity"
            :class="
              effectiveMap?.id === m.id
                ? 'opacity-100'
                : 'opacity-60 group-hover:opacity-90'
            "
            @error="
              ($event.target as HTMLImageElement).style.visibility = 'hidden'
            "
          />
          <div
            class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-2 flex items-end justify-between gap-2"
          >
            <div class="min-w-0">
              <div
                class="font-mono text-sm font-bold tracking-[0.18em] uppercase text-white truncate"
              >
                {{ cleanMapName(m.map.name) }}
              </div>
              <div
                v-if="typeof m.lineup_1_score === 'number'"
                class="font-mono text-[0.7rem] tabular-nums text-white/75"
              >
                {{ m.lineup_1_score }} : {{ m.lineup_2_score }}
              </div>
            </div>
            <span
              class="font-mono text-[0.55rem] tracking-[0.2em] uppercase shrink-0 px-1.5 py-0.5 border"
              :class="
                effectiveMap?.id === m.id
                  ? 'border-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber))]'
                  : 'border-white/40 text-white/70 group-hover:text-white group-hover:border-white'
              "
            >
              {{
                effectiveMap?.id === m.id
                  ? $t("match.replay.selected")
                  : $t("match.replay.select")
              }}
            </span>
          </div>
        </button>
      </div>
    </div>

    <div
      v-if="!effectiveMap && selectableMaps.length <= 1"
      class="py-6 text-center"
    >
      <p
        class="font-mono text-[0.7rem] tracking-[0.2em] uppercase text-muted-foreground"
      >
        {{ $t("match.replay.select_map") }}
      </p>
    </div>

    <div
      v-else-if="effectiveMap"
      class="py-10 flex flex-col items-center gap-4 text-center"
    >
      <button
        type="button"
        class="inline-flex items-center gap-2 px-5 py-2.5 font-mono text-[0.72rem] font-bold tracking-[0.22em] uppercase border border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] transition-colors"
        @click="openPopout(effectiveMap.id)"
      >
        <ExternalLink class="h-4 w-4" />
        {{ $t("match.replay.open") }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { e_match_status_enum } from "~/generated/zeus";

export default {
  props: {
    match: {
      required: true,
      type: Object,
    },
    activeMap: {
      type: Object as () => any,
      default: null,
    },
  },
  data() {
    return {
      localSelectedMapId: null as string | null,
    };
  },
  methods: {
    selectMap(id: string) {
      this.localSelectedMapId = id;
    },
    openPopout(matchMapId: string) {
      if (typeof window === "undefined" || !matchMapId) return;
      window.open(
        `/match-replay-popout/${matchMapId}`,
        `replay-popout-${matchMapId}`,
        "popup=yes,width=1100,height=900,resizable=yes,scrollbars=yes",
      );
    },
  },
  computed: {
    selectableMaps(): any[] {
      return (this.match?.match_maps ?? []).filter(
        (m: any) => m.status !== e_match_status_enum.Scheduled,
      );
    },
    effectiveMap(): any {
      if (this.localSelectedMapId) {
        const local = this.selectableMaps.find(
          (m: any) => m.id === this.localSelectedMapId,
        );
        if (local) return local;
      }
      if (this.activeMap) return this.activeMap;
      const maps = this.selectableMaps;
      if (maps.length === 1) return maps[0];
      return null;
    },
  },
};
</script>
