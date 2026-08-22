<script setup lang="ts">
/**
 * "Practice this in game", for any utility at all.
 *
 * A throw is worth standing on whether or not anybody has written it up, so
 * this takes whichever shape the caller happens to hold -- a saved lineup, a
 * mined meta spot, or a draft still being typed -- and asks the same question
 * of the same server. Before this, each surface grew its own copy of the
 * button, its own loading key and its own idea of when to hide it, which is
 * why two of them disagreed about the map check.
 *
 * Only shown to a player already standing on a practice server for THIS map.
 * The action teleports you onto the throw, so without a server behind it there
 * is nothing for it to do -- it offered itself on every card to people just
 * browsing, and the only possible outcome was an error toast. Launching a
 * server is a different job with its own button on the map.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Zap } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { useUtilityLoad } from "~/composables/useUtilityLoad";
import type { UtilityMetaSpot } from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

export type UtilityPracticeDraft = {
  map_name: string;
  utility_type: string;
  side: string;
  technique: string;
  throw_strength: string;
  origin: { x: number; y: number; z: number };
  landing: { x: number; y: number; z: number } | null;
  view_yaw: number;
  view_pitch: number;
};

const props = withDefaults(
  defineProps<{
    /** A saved lineup: sent by id. */
    lineup?: UtilityLineup | null;
    /** A mined cluster with no row behind it. */
    spot?: UtilityMetaSpot | null;
    /** Something still being authored. */
    draft?: UtilityPracticeDraft | null;
    /** Needed for a spot or a draft; a saved lineup carries its own. */
    mapName?: string | null;
    /** What to call it in the toast and on the server. */
    name?: string | null;
    label?: string | null;
    size?: "sm" | "xs" | "default";
    variant?: "default" | "outline" | "ghost";
    block?: boolean;
  }>(),
  {
    lineup: null,
    spot: null,
    draft: null,
    mapName: null,
    name: null,
    label: null,
    size: "sm",
    variant: "default",
    block: false,
  },
);

const { t } = useI18n();
const load = useUtilityLoad();

void load.check();

const map = computed(
  () => props.lineup?.map_name ?? props.draft?.map_name ?? props.mapName ?? null,
);

const title = computed(
  () => props.name ?? props.lineup?.name ?? t("pages.utility.create.untitled"),
);

// The key useUtilityLoad reports progress under, so only the button that was
// pressed spins -- a list of twenty cards sharing one flag would light up all
// of them.
const key = computed(() => {
  if (props.lineup) {
    return props.lineup.id;
  }
  if (props.spot) {
    return `scratch-${props.spot.key}`;
  }
  return "scratch-draft";
});

// Two questions, both of which must hold: is there a throw here at all (a
// draft with no origin is not yet something anybody can stand on), and is
// there a server on this map to stand on it. canLoad answers the second --
// on_server plus a map match, so a session on Mirage does not offer to load
// an Ancient lineup.
const ready = computed(
  () =>
    (!!props.lineup || !!props.spot || !!props.draft?.origin) &&
    load.canLoad(map.value),
);

async function send() {
  if (props.lineup) {
    await load.sendLineup(props.lineup);
    return;
  }

  if (props.spot && map.value) {
    await load.sendSpot(props.spot, map.value, title.value);
    return;
  }

  if (props.draft) {
    await load.sendDraft(props.draft, title.value);
  }
}
</script>

<template>
  <Button
    v-if="ready"
    :size="size === 'xs' ? 'sm' : size"
    :variant="variant"
    :class="[
      variant === 'default' ? 'tac-amber-cta' : '',
      block ? 'w-full justify-start' : '',
      size === 'xs' ? 'h-7 px-2 text-[0.62rem]' : '',
    ]"
    :loading="load.sending.value === key"
    :title="$t('pages.utility.load.test_hint')"
    @click.stop="send()"
  >
    <Zap class="mr-1.5 h-3.5 w-3.5" />
    {{ label ?? $t("pages.utility.load.action") }}
  </Button>
</template>
