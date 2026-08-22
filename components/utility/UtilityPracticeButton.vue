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
 * Only shown to a player already standing on a practice server. The action
 * teleports you onto the throw, so without a server behind it there is nothing
 * for it to do -- it offered itself on every card to people just browsing, and
 * the only possible outcome was an error toast. Launching a server is a
 * different job with its own button on the map.
 *
 * A server on ANOTHER map is not a dead end any more. Pressing this brings the
 * server with you: the map change carries the throw, so you come back from the
 * load screen already standing on it. That only belongs to the host, because a
 * changelevel takes everyone else on the server through it too.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Repeat } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import UtilitySendToServerIcon from "~/components/utility/UtilitySendToServerIcon.vue";
import { useUtilityLoad } from "~/composables/useUtilityLoad";
import cleanMapName from "~/utilities/cleanMapName";
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

// The root is the tooltip now, and FiveStackToolTip renders a trigger slot
// instead of its own $attrs sink -- so a `class` from the call site would be
// dropped on the floor rather than landing on the button it was meant for.
defineOptions({ inheritAttrs: false });

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
    /**
     * "overlay" is the same action wearing the tile it acts on: it fills a
     * positioned parent (the row's radar thumb) instead of taking a line of
     * its own. A throw is a place, the thumb is a picture of that place, and
     * this puts you in it -- so the press target is the picture, and a list of
     * twenty rows costs twenty tiles rather than twenty extra buttons.
     */
    shape?: "button" | "overlay";
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
    shape: "button",
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

// Is there a throw here at all? A draft with no origin is not yet something
// anybody can stand on.
const throwable = computed(
  () => !!props.lineup || !!props.spot || !!props.draft?.origin,
);

// The server is already on this map: one command, straight there.
const onThisMap = computed(() => load.canLoad(map.value));

// It is on another one, and this player may move it.
const needsSwitch = computed(() => load.canSwitchTo(map.value));

const ready = computed(
  () => throwable.value && (onThisMap.value || needsSwitch.value),
);

// The label has to say which of the two is about to happen: a button that says
// "load me in" and instead drops the whole server into a load screen is the
// one thing this must never do.
const action = computed(() =>
  needsSwitch.value
    ? t("pages.utility.load.switch_and_load")
    : t("pages.utility.load.action"),
);

// The tooltip has to say which of the two is about to happen: a bubble that
// promises "the server you are already in" while the button is about to move
// that server is the one thing this must never do.
const tooltipTitle = computed(() =>
  needsSwitch.value
    ? t("pages.utility.load.switch_tooltip_title", {
        map: cleanMapName(map.value ?? ""),
      })
    : t("pages.utility.load.tooltip_title"),
);

const tooltip = computed(() =>
  needsSwitch.value
    ? t("pages.utility.load.switch_tooltip")
    : t("pages.utility.load.tooltip"),
);

/** The throw itself, for the paths that send one rather than an id. */
function scratch(): Record<string, unknown> | null {
  if (props.spot && map.value) {
    return load.spotScratch(props.spot, map.value, title.value);
  }

  if (props.draft) {
    return load.draftScratch(props.draft, title.value);
  }

  return null;
}

const isSending = computed(() => load.sending.value === key.value);

async function send() {
  // Bring the server first. It carries the throw with it, so there is no
  // second press waiting on the other side of the level change.
  if (needsSwitch.value && map.value) {
    await load.switchMap(map.value, {
      key: key.value,
      name: title.value,
      lineup_id: props.lineup?.id,
      scratch: props.lineup ? undefined : (scratch() ?? undefined),
    });
    return;
  }

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
  <!-- The label says "load me in", which does not say where or what it costs.
       The bubble does: which server, what happens to you, and that nothing is
       written down. `:loading` is bound rather than left to the Button's own
       spinner because as-child inside a TooltipTrigger it cannot see the click
       that started the send. -->
  <FiveStackToolTip v-if="ready" as-child :delay-duration="120">
    <template #trigger>
      <!-- The tile arms rather than announcing itself: at rest all it wears is
           a hairline of amber, so twenty loadable rows still read as twenty
           radar crops. Point at one and the map recedes behind a scrim and the
           glyph lands in the middle of it -- the press target was always the
           whole tile, the hover just says so.

           Clicks and keys are stopped here: the card underneath is itself a
           button, and without this every send would also open the lineup. -->
      <button
        v-if="shape === 'overlay'"
        v-bind="$attrs"
        type="button"
        class="group/load absolute inset-0 z-10 flex items-center justify-center rounded-[4px] ring-1 ring-[hsl(var(--tac-amber)/0.35)] transition-[box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] [@media(hover:hover)]:hover:ring-[hsl(var(--tac-amber)/0.9)]"
        :class="isSending ? 'ring-[hsl(var(--tac-amber)/0.9)]' : ''"
        @click.stop="send()"
        @keydown.enter.stop
        @keydown.space.stop
        @mousedown.stop
      >
        <span
          class="absolute inset-0 rounded-[3px] bg-background/80 opacity-0 transition-opacity duration-200 ease-out group-focus-visible/load:opacity-100 [@media(hover:hover)]:group-hover/load:opacity-100"
          :class="isSending ? 'opacity-100' : ''"
        />
        <Spinner
          v-if="isSending"
          class="relative h-4 w-4 text-[hsl(var(--tac-amber))]"
        />
        <!-- The glyph is the promise: sending a throw to the server you are on
             and moving that server to another map are not the same press, so
             they are not the same picture. Visible without a hover where there
             is no hover to give. -->
        <component
          :is="needsSwitch ? Repeat : UtilitySendToServerIcon"
          v-else
          class="relative h-4 w-4 scale-75 text-[hsl(var(--tac-amber))] opacity-0 transition duration-200 ease-out group-focus-visible/load:scale-100 group-focus-visible/load:opacity-100 [@media(hover:hover)]:group-hover/load:scale-100 [@media(hover:hover)]:group-hover/load:opacity-100 [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-90"
        />
      </button>

      <Button
        v-else
        v-bind="$attrs"
        :size="size === 'xs' ? 'sm' : size"
        :variant="variant"
        :class="[
          variant === 'default' ? 'tac-amber-cta' : '',
          block ? 'w-full justify-start' : '',
          size === 'xs' ? 'h-7 px-2 text-[0.62rem]' : '',
        ]"
        :loading="load.sending.value === key"
        @click.stop="send()"
      >
        <Repeat v-if="needsSwitch" class="mr-1.5 h-3.5 w-3.5" />
        <UtilitySendToServerIcon v-else class="mr-1.5 h-3.5 w-3.5" />
        {{ label ?? action }}
      </Button>
    </template>
    <div class="flex max-w-[16rem] flex-col gap-1">
      <span class="text-xs font-medium">
        {{ tooltipTitle }}
      </span>
      <span class="text-xs leading-relaxed text-muted-foreground">
        {{ tooltip }}
      </span>
    </div>
  </FiveStackToolTip>
</template>
