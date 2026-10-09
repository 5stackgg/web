<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { BadgeCheck, Copy, PencilLine } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";
import { toast } from "~/components/ui/toast";
import TimeAgo from "~/components/TimeAgo.vue";
import UtilityCardView from "~/components/utility/UtilityCardView.vue";
import UtilityDockButton from "~/components/utility/UtilityDockButton.vue";
import UtilityDockMenu from "~/components/utility/UtilityDockMenu.vue";
import UtilityEmpty from "~/components/utility/UtilityEmpty.vue";
import UtilityThrowStrip from "~/components/utility/UtilityThrowStrip.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import UtilitySectionHead from "~/components/utility/UtilitySectionHead.vue";
import { useMapCallouts } from "~/composables/useMapCallouts";
import { useUtilityLoad } from "~/composables/useUtilityLoad";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { utilityLineupsQuery } from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import cleanMapName from "~/utilities/cleanMapName";
import { loginLinks } from "~/utilities/loginLinks";
import { UTILITY_TYPE_COLORS } from "~/utilities/utilityDisplay";
import type {
  UtilityBarOffer,
  UtilityLineupContext,
  UtilityMetaSpot,
} from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

/**
 * One mined spot, opened into the card. Picking a ring on the map or a row in
 * the Meta list is a question about that spot, and the answer is the same
 * shape a lineup's is: how it is thrown first, then how many people throw it,
 * then the lineups written for it -- or, where there are none, the offer to
 * write the first. Standing on it is offered in the bar at the foot of the
 * card.
 */
const props = withDefaults(
  defineProps<{
    spot: UtilityMetaSpot | null;
    mapName: string;
    /**
     * The lineups the page has loaded. The spot fetches its own; where the
     * page holds the same one, the page's copy is shown, because that is the
     * one kept live with your votes and your drill record.
     */
    lineups: UtilityLineup[];
    /** The busiest spot on the map, so the lineup rows' meters share a scale. */
    busiest: number;
    signedIn?: boolean;
    /** Off on a phone: every practice action ends in joining a server in CS2. */
    canPractice?: boolean;
  }>(),
  { signedIn: false, canPractice: false },
);

const emit = defineEmits<{
  (event: "back"): void;
  (event: "open-lineup", id: string, context: UtilityLineupContext): void;
  (event: "write-up", spot: UtilityMetaSpot): void;
  /** What the bar at the foot of the card should offer while this is open. */
  (event: "bar", offer: UtilityBarOffer | null): void;
}>();

const { t } = useI18n();

// The spot that was open stays drawn while the view slides away.
const shown = ref<UtilityMetaSpot | null>(props.spot);
watch(
  () => props.spot,
  (spot) => {
    if (spot) {
      shown.value = spot;
    }
  },
);

const { autoName } = useMapCallouts(() => props.mapName);

const name = computed(() => {
  const spot = shown.value;
  if (!spot) {
    return "";
  }
  return (
    autoName(spot.utilityType, spot.origin, spot.landing) ||
    t("pages.utility.meta.unnamed", {
      type: t(`pages.utility.types.${spot.utilityType}`),
    })
  );
});

// The page only ever holds a window of the library -- one scope, one page of
// it -- so a spot can be written up without the page having the lineup. The
// cluster's key is the same key every saved lineup carries, so the spot asks
// for its own.
const fetched = ref<UtilityLineup[]>([]);
const loaded = ref(false);
let fetchToken = 0;

watch(
  () => props.spot?.key ?? null,
  async (key) => {
    const token = ++fetchToken;
    fetched.value = [];
    loaded.value = false;
    if (!key) {
      return;
    }
    try {
      const { data } = await getGraphqlClient().query({
        query: utilityLineupsQuery(),
        variables: {
          where: {
            lineup_bucket: { _eq: key },
            archived_at: { _is_null: true },
          },
          order_by: [{ upvotes: order_by.desc }],
          limit: 20,
          offset: 0,
        },
        fetchPolicy: "network-only",
      });
      if (token === fetchToken) {
        fetched.value = ((data as any)?.utility_lineups ??
          []) as UtilityLineup[];
        loaded.value = true;
      }
    } catch (error) {
      // The page's own copies still show; the rest are simply not listed.
      console.error("[utility] spot lineups error:", error);
    }
  },
  { immediate: true },
);

const rows = computed(() => {
  const mine = new Map(props.lineups.map((lineup) => [lineup.id, lineup]));
  return fetched.value.map((lineup) => mine.get(lineup.id) ?? lineup);
});

// What the viewer can open, once that is known. The server's count includes
// private and archived lineups, so it only stands in until the answer lands.
const writtenCount = computed(() =>
  loaded.value ? rows.value.length : (shown.value?.lineups ?? 0),
);

const load = useUtilityLoad();

watch(
  () => !!props.spot,
  (open) => {
    if (open) {
      void load.check();
    }
  },
  { immediate: true },
);

const topLineup = computed(() => rows.value[0] ?? null);

// Any spot can be stood on, written up or not: the mined throw goes to the
// server as it is and nothing is saved. A server started from here opens with
// its best lineup ready.
const barOffer = computed<UtilityBarOffer | null>(() => {
  const spot = props.spot;
  if (!spot || !props.signedIn) {
    return null;
  }
  return {
    target: topLineup.value ? { lineupId: topLineup.value.id } : null,
    actions: props.canPractice
      ? [{ kind: "spot", spot, name: name.value }]
      : [],
  };
});

watch(barOffer, (offer) => emit("bar", offer), { immediate: true });

// Back from the lineup lands on this spot again, and the lineup says which
// spot it was written for.
function openLineup(id: string) {
  emit("open-lineup", id, {
    text: t("pages.utility.meta.lineup_context", {
      name: name.value,
      count: shown.value?.throwers ?? 0,
    }),
  });
}

function round(value: number) {
  return Math.round(value);
}

const stand = computed(() => {
  const origin = shown.value?.origin;
  return origin
    ? `${round(origin.x)}, ${round(origin.y)}, ${round(origin.z)}`
    : null;
});

const aim = computed(() => {
  const spot = shown.value;
  if (!spot || spot.viewYaw === null || spot.viewPitch === null) {
    return null;
  }
  return { yaw: spot.viewYaw.toFixed(2), pitch: spot.viewPitch.toFixed(2) };
});

// The pair of console commands that stand you on the spot looking the way the
// cluster's median throw looks.
const setpos = computed(() => {
  const spot = shown.value;
  if (!spot) {
    return "";
  }
  const position = `setpos ${spot.origin.x.toFixed(1)} ${spot.origin.y.toFixed(1)} ${spot.origin.z.toFixed(1)}`;
  return aim.value
    ? `${position}; setang ${aim.value.pitch} ${aim.value.yaw}`
    : position;
});

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: done });
  } catch {
    toast({
      title: t("pages.utility.meta.aim_copy_failed"),
      variant: "destructive",
    });
  }
}

function copySetpos() {
  void copy(setpos.value, t("pages.utility.meta.setpos_copied"));
}

function copyLink() {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "meta");
  if (shown.value) {
    url.searchParams.set("spot", shown.value.key);
  }
  url.searchParams.delete("lineup");
  void copy(url.toString(), t("pages.utility.meta.link_copied"));
}

function signIn() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}
</script>

<template>
  <UtilityCardView
    layer="top"
    addressed
    :open="!!spot"
    :label="name"
    @back="emit('back')"
  >
    <template v-if="shown" #kicker>
      <span
        aria-hidden="true"
        class="size-2 shrink-0 rounded-[2px]"
        :style="{ backgroundColor: UTILITY_TYPE_COLORS[shown.utilityType] }"
      />
      <span class="truncate">
        {{ $t("pages.utility.meta.spot_kicker") }} ·
        {{ cleanMapName(mapName) }}
      </span>
      <img
        v-if="shown.side"
        :src="
          shown.side === 'CT'
            ? '/img/teams/ct_logo.svg'
            : '/img/teams/t_logo.svg'
        "
        :alt="$t(`pages.utility.sides.${shown.side}`)"
        class="-my-1 size-[1.125rem] shrink-0 -translate-y-px"
      />
      <!-- Whether anyone has written it up, on the line that says what it
           is: beside the name it took width the name needed. -->
      <span
        class="ml-auto inline-flex h-[1.125rem] shrink-0 items-center gap-1 rounded-sm px-1.5 text-[0.58rem] font-bold leading-none tracking-[0.12em]"
        :class="
          writtenCount
            ? 'bg-success/15 text-success'
            : 'bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
        "
      >
        <template v-if="writtenCount">
          <BadgeCheck class="h-2.5 w-2.5" />
          {{
            $t(
              "pages.utility.meta.lineup_count",
              { count: writtenCount },
              writtenCount,
            )
          }}
        </template>
        <template v-else>
          {{ $t("pages.utility.meta.scope_unwritten") }}
        </template>
      </span>
    </template>

    <template v-if="shown">
      <h2 class="text-lg font-bold leading-tight [text-wrap:balance]">
        {{ name }}
      </h2>

      <UtilityThrowStrip
        :technique="shown.technique"
        :strength="shown.throwStrength"
      />

      <!-- Three different questions: how many people, how many throws, how
           many matches. One player drilling a spot is not a spot the server
           has adopted, so they are never one number. -->
      <dl class="grid grid-cols-3 gap-2">
        <div
          v-for="stat of [
            { key: 'players', value: shown.throwers },
            { key: 'throws', value: shown.throws },
            { key: 'matches', value: shown.matches },
          ]"
          :key="stat.key"
          class="min-w-0"
        >
          <dd class="text-[1.375rem] font-bold leading-none tabular-nums">
            {{ stat.value.toLocaleString() }}
          </dd>
          <dt
            class="mt-1.5 truncate font-mono text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70"
          >
            {{ $t(`pages.utility.meta.${stat.key}`) }}
          </dt>
        </div>
      </dl>

      <p
        v-if="shown.lastSeenAt"
        class="flex flex-wrap items-center gap-x-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        {{ $t("pages.utility.meta.last_seen_label") }}
        <TimeAgo :date="shown.lastSeenAt" hide-icon />
      </p>

      <div class="flex flex-col">
        <UtilitySectionHead
          :label="$t('pages.utility.meta.spot_lineups')"
          :count="writtenCount || null"
        />
        <!-- Real lineup rows, not a summary of them: each opens the lineup,
             and Back from there lands on this spot again. -->
        <div v-if="rows.length" class="flex flex-col gap-2 pt-1">
          <UtilityLineupCard
            v-for="lineup of rows"
            :key="lineup.id"
            :lineup="lineup"
            mode="row"
            :menu="false"
            :show-practice="false"
            :meta-throwers="shown.throwers"
            :meta-busiest="busiest"
            @select="openLineup"
          />
        </div>
        <!-- An unwritten spot's job is to get written, and this is where
             its lineups would be: the offer stands in their place, in the
             amber dashes an unwritten spot wears everywhere else. -->
        <UtilityEmpty
          v-if="!writtenCount"
          class="mt-1 !border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.04)]"
          :title="$t('pages.utility.meta.unwritten_title')"
          :description="
            signedIn ? $t('pages.utility.meta.unwritten_description') : null
          "
        >
          <Button
            v-if="signedIn"
            size="sm"
            class="tac-amber-cta h-8 px-3.5 text-[13px] font-semibold"
            @click="emit('write-up', shown)"
          >
            {{ $t("pages.utility.meta.write_up") }}
          </Button>
        </UtilityEmpty>
      </div>

      <!-- Where to stand and where to look, in the numbers the game reports
           them in. Last, because it is what you read last. -->
      <p
        class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2.5 font-mono text-[0.68rem] tabular-nums text-muted-foreground"
      >
        <span v-if="aim">
          <b class="font-semibold text-foreground/70">
            {{ $t("pages.utility.meta.aim_short") }}
          </b>
          {{ aim.yaw }} / {{ aim.pitch }}
        </span>
        <span v-if="stand">
          <b class="font-semibold text-foreground/70">
            {{ $t("pages.utility.detail.stand") }}
          </b>
          {{ stand }}
        </span>
      </p>
    </template>

    <template v-if="shown" #dock>
      <!-- Signed out there is one thing left to do: the numbers still copy. -->
      <template v-if="!signedIn">
        <Button
          size="sm"
          class="tac-amber-cta h-8 px-3.5 text-[13px] font-semibold"
          @click="signIn()"
        >
          {{ $t("pages.utility.meta.sign_in") }}
        </Button>
        <span class="min-w-0 truncate text-xs text-muted-foreground">
          {{ $t("pages.utility.meta.sign_in_hint") }}
        </span>
        <UtilityDockButton
          :tip="$t('pages.utility.meta.copy_setpos')"
          @click="copySetpos()"
        >
          <Copy class="h-4 w-4" />
        </UtilityDockButton>
      </template>

      <template v-else>
        <UtilityDockButton
          v-if="writtenCount"
          :tip="$t('pages.utility.meta.write_another')"
          @click="emit('write-up', shown)"
        >
          <PencilLine class="h-4 w-4" />
        </UtilityDockButton>

        <UtilityDockMenu>
          <DropdownMenuItem @click="copySetpos()">
            {{ $t("pages.utility.meta.copy_setpos") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="copyLink()">
            {{ $t("pages.utility.meta.copy_link") }}
          </DropdownMenuItem>
        </UtilityDockMenu>
      </template>
    </template>
  </UtilityCardView>
</template>
