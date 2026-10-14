<script setup lang="ts">
/**
 * What you can do with a lineup, out where it can be seen instead of behind
 * the ⋯ menu: putting it in your game first, then what the library does with
 * it. Its own component so the layout can change without touching the page.
 */
import { computed } from "vue";
import {
  ArrowBigDown,
  CopyPlus,
  Crosshair,
  Film,
  Globe,
  Repeat,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { useUtilityLoad } from "~/composables/useUtilityLoad";
import type { UtilityLineup } from "~/types/utility";

const props = defineProps<{
  lineup: UtilityLineup;
  canPractice: boolean;
  canSubmitPublic: boolean;
  canMarkBad: boolean;
  markedBad: boolean;
  canRerender: boolean;
  rendering: boolean;
}>();

const emit = defineEmits<{
  (e: "fork"): void;
  (e: "request-public"): void;
  (e: "mark-bad"): void;
  (e: "rerender"): void;
}>();

const load = useUtilityLoad();

const canLoadHere = computed(
  () => props.canPractice && load.canLoad(props.lineup.map_name),
);
const canSwitchHere = computed(
  () => props.canPractice && load.canSwitchTo(props.lineup.map_name),
);

async function loadInGame() {
  if (canLoadHere.value) {
    await load.sendLineup(props.lineup);
    return;
  }
  await load.switchMap(props.lineup.map_name, {
    key: props.lineup.id,
    name: props.lineup.name,
    lineup_id: props.lineup.id,
  });
}

function repeatInGame() {
  return load.sendDrill([props.lineup]);
}
</script>

<template>
  <section data-library-actions class="flex flex-col gap-2">
    <Button
      v-if="canLoadHere || canSwitchHere"
      variant="tactical"
      data-action="load"
      class="w-full"
      @click="loadInGame()"
    >
      <Crosshair />
      {{
        canLoadHere
          ? $t("pages.utility.card.load_in_game")
          : $t("pages.utility.load.switch_and_load")
      }}
    </Button>
    <div v-if="canLoadHere" class="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        data-action="repeat"
        class="flex-auto"
        @click="repeatInGame()"
      >
        <Repeat />
        {{ $t("pages.utility.load.drill") }}
      </Button>
    </div>

    <span
      class="pt-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
    >
      {{ $t("pages.utility.detail.actions_title") }}
    </span>
    <div class="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        data-action="fork"
        class="flex-auto"
        @click="emit('fork')"
      >
        <CopyPlus />
        {{ $t("pages.utility.fork.action") }}
      </Button>
      <Button
        v-if="canSubmitPublic"
        variant="outline"
        size="sm"
        data-action="submit"
        class="flex-auto"
        @click="emit('request-public')"
      >
        <Globe />
        {{ $t("pages.utility.publish.submit") }}
      </Button>
      <Button
        v-if="canMarkBad"
        variant="outline"
        size="sm"
        data-action="bad"
        class="flex-auto"
        :aria-pressed="markedBad"
        @click="emit('mark-bad')"
      >
        <ArrowBigDown
          class="text-destructive"
          :class="markedBad ? 'fill-current' : ''"
        />
        {{
          markedBad
            ? $t("pages.utility.card.unvote")
            : $t("pages.utility.detail.mark_bad")
        }}
      </Button>
      <Button
        v-if="canRerender"
        variant="outline"
        size="sm"
        data-action="rerender"
        class="flex-auto"
        :disabled="rendering"
        :title="
          rendering ? $t('pages.utility.render_queue.in_flight') : undefined
        "
        @click="emit('rerender')"
      >
        <Film />
        {{ $t("pages.utility.render_queue.rerender") }}
      </Button>
    </div>
  </section>
</template>
