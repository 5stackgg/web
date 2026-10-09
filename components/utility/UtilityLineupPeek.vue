<script setup lang="ts">
import { computed, ref } from "vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import UtilityLineupStills from "~/components/utility/UtilityLineupStills.vue";
import UtilityThrowStrip from "~/components/utility/UtilityThrowStrip.vue";
import { useUtilityRunUp } from "~/composables/useUtilityRunUp";
import type { UtilityLineup } from "~/types/utility";

// Mounted only while the peek is open, so nothing in here loads for a row the
// pointer merely passes over. Never the clip: the lineup open beside it may
// already be playing it. A glance has two questions -- where to point, and
// what the throw does -- so it gets a picture for each.
const props = defineProps<{ lineup: UtilityLineup }>();

const runUp = useUtilityRunUp(() => props.lineup.id);

const stills = ref<InstanceType<typeof UtilityLineupStills> | null>(null);
const onShow = ref<string | null>(null);

const landing = computed(() => {
  const src = props.lineup.preview_stills_url?.landing;
  return typeof src === "string" && src.length > 0 ? src : null;
});

defineExpose({ step: (by: number) => stills.value?.step(by) });
</script>

<template>
  <div class="flex flex-col">
    <UtilityLineupStills
      ref="stills"
      :stills="lineup.preview_stills_url"
      compact
      @show="(kind) => (onShow = kind)"
    />

    <Fold :open="!!landing && onShow !== 'landing'">
      <figure
        v-if="landing"
        data-still-result
        class="relative mt-2 aspect-[2/1] overflow-hidden border-y border-white/[0.08] bg-black"
      >
        <img
          :src="landing"
          :alt="$t('pages.utility.detail.stills.landing')"
          decoding="async"
          class="h-full w-full object-cover"
        />
        <figcaption
          class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-1.5 pt-5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white/90"
        >
          {{ $t("pages.utility.detail.stills.landing") }}
        </figcaption>
      </figure>
    </Fold>

    <div class="p-2.5">
      <UtilityThrowStrip
        :technique="lineup.technique"
        :strength="lineup.throw_strength"
        :run-up="runUp"
      />
    </div>
  </div>
</template>
