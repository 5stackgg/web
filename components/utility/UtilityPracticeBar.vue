<script setup lang="ts">
import { computed } from "vue";
import { ChevronDown, ChevronUp, ExternalLink, Repeat, Server } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useUtilityLoad } from "~/composables/useUtilityLoad";
import { useUtilityPracticeSession } from "~/composables/useUtilityPracticeSession";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import UtilityPracticeButton from "~/components/utility/UtilityPracticeButton.vue";
import { readUtilityPracticeSession } from "~/types/utility";
import cleanMapName from "~/utilities/cleanMapName";
import type { UtilityBarOffer } from "~/utilities/utilityDisplay";

// The foot of the card, under every tab and under whatever is open over the
// list: a lineup, a spot, a collection, an execute. It is the practice
// server's bar -- its state always in view, and the handle of its drawer: the
// panel pulls up out of it and the bar stays where it is, so the press that
// opened it closes it -- and it is where the thing above it is acted on: sent
// to the server once there is one to send it to, or whatever the view's own
// main action is. The bar itself is the launcher: a "start" beside it went to
// the same place.
const props = withDefaults(
  defineProps<{
    mapName: string;
    open: boolean;
    // Off on a phone, which cannot join a server: the bar is then only the
    // view's own action.
    server?: boolean;
    offer?: UtilityBarOffer | null;
  }>(),
  { server: true, offer: null },
);

const emit = defineEmits<{ (e: "toggle"): void }>();

const { session, booting, switching, canManage } = useUtilityPracticeSession();
const load = useUtilityLoad();

const practice = computed(() => readUtilityPracticeSession(session.value));

const serverMap = computed(
  () => load.where.value?.map_name ?? session.value?.map_name ?? null,
);

const host = computed(() => session.value?.host?.name ?? null);

const state = computed<"idle" | "starting" | "switching" | "elsewhere" | "ready">(() => {
  if (!session.value) {
    return "idle";
  }
  if (switching.value) {
    return "switching";
  }
  if (booting.value || !practice.value.isLive) {
    return "starting";
  }
  if (serverMap.value && serverMap.value !== props.mapName) {
    return "elsewhere";
  }
  return "ready";
});

// Sending something to a server needs one you are standing in, on this map or
// one you may bring here. Without it those buttons are not offered at all:
// starting a server is the bar's own job.
const reachable = computed(
  () => load.canLoad(props.mapName) || load.canSwitchTo(props.mapName),
);

const actions = computed(() =>
  props.open
    ? []
    : (props.offer?.actions ?? []).filter(
        (action) => action.kind === "run" || (props.server && reachable.value),
      ),
);

// Two buttons and a title do not fit a 22rem card, so beside another button
// the ones that can say it with a glyph do.
const crowded = computed(() => actions.value.length > 1);

const title = computed(() =>
  actions.value.length ? (props.offer?.title ?? null) : null,
);

// Nothing can be loaded onto a server you are not standing in.
const joinLink = computed(() =>
  state.value === "ready" && !load.onServer.value
    ? (practice.value.connectionLink ?? null)
    : null,
);
</script>

<template>
  <div
    class="flex shrink-0 items-center gap-2 border-t border-white/[0.06] bg-[#1e1e22] px-3 py-2.5 max-md:pb-[max(0.625rem,env(safe-area-inset-bottom))]"
  >
    <button
      v-if="server"
      type="button"
      class="group flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      :aria-expanded="open"
      @click="emit('toggle')"
    >
      <!-- The same square the header's tiles are; the colour is the
           server's state. -->
      <span
        class="grid size-8 shrink-0 place-items-center rounded-md border transition-colors"
        :class="
          state === 'ready' || state === 'elsewhere'
            ? 'border-emerald-400/45 bg-emerald-400/10 text-emerald-400'
            : state === 'idle'
              ? 'border-white/10 text-muted-foreground group-hover:bg-white/[0.06] group-hover:text-foreground'
              : 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
        "
      >
        <Spinner v-if="state === 'starting' || state === 'switching'" class="h-4 w-4" />
        <Server v-else class="h-4 w-4" />
      </span>

      <span class="flex min-w-0 flex-1 flex-col leading-tight">
        <span class="truncate text-sm font-semibold">
          <template v-if="title">{{ title }}</template>
          <template v-else-if="state === 'idle'">
            {{ $t("pages.utility.practice.title") }}
          </template>
          <template v-else-if="state === 'starting'">
            {{ $t("pages.utility.practice.nav_starting") }}
          </template>
          <template v-else-if="state === 'switching'">
            {{ $t("pages.utility.practice.nav_switching") }}
          </template>
          <template v-else-if="load.onServer.value">
            {{ $t("pages.utility.practice.nav_connected") }}
          </template>
          <template v-else>
            {{ $t("pages.utility.practice.nav_ready") }}
          </template>
        </span>
        <span class="truncate text-xs text-muted-foreground">
          <template v-if="state === 'idle'">
            {{ $t("pages.utility.practice.description") }}
          </template>
          <template v-else-if="state === 'starting'">
            {{ $t("pages.utility.practice.booting") }}
          </template>
          <template v-else-if="state === 'switching'">
            {{
              $t("pages.utility.practice.switching", {
                map: cleanMapName(serverMap ?? ""),
              })
            }}
          </template>
          <span v-else-if="state === 'elsewhere'" class="text-[hsl(var(--tac-amber))]">
            {{
              $t("pages.utility.practice.map_banner", {
                map: cleanMapName(serverMap ?? ""),
              })
            }}
            <template v-if="!canManage">
              {{
                host
                  ? $t("pages.utility.practice.ask_host", { host })
                  : $t("pages.utility.practice.ask_the_host")
              }}
            </template>
          </span>
          <template v-else>
            {{ cleanMapName(serverMap ?? mapName) }}
          </template>
        </span>
      </span>

      <component
        :is="open ? ChevronDown : ChevronUp"
        class="mr-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
      />
    </button>

    <template v-if="server && !actions.length">
      <Button
        v-if="state === 'elsewhere' && canManage"
        variant="outline"
        size="sm"
        class="h-8 shrink-0 px-3.5"
        :loading="load.sending.value === `map-${mapName}`"
        @click="load.switchMap(mapName)"
      >
        <Repeat class="mr-1 h-4 w-4" />
        {{ $t("pages.utility.practice.switch_map", { map: cleanMapName(mapName) }) }}
      </Button>
      <Button
        v-else-if="joinLink"
        as="a"
        :href="joinLink"
        size="sm"
        class="tac-amber-cta h-8 shrink-0 px-3.5"
      >
        <ExternalLink class="mr-1 h-4 w-4" />
        {{ $t("pages.utility.practice.nav_join") }}
      </Button>
    </template>

    <!-- Beside the view's own action, joining gives up its label. -->
    <FiveStackToolTip
      v-else-if="server && joinLink"
      as-child
      :delay-duration="120"
      :tap-toggle="false"
    >
      <template #trigger>
        <a
          :href="joinLink"
          class="grid size-8 shrink-0 place-items-center rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] transition-colors hover:bg-[hsl(var(--tac-amber)/0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          :aria-label="$t('pages.utility.practice.nav_join')"
        >
          <ExternalLink class="h-4 w-4" />
        </a>
      </template>
      {{ $t("pages.utility.practice.nav_join") }}
    </FiveStackToolTip>

    <template v-for="action of actions" :key="action.kind === 'run' ? action.key : action.kind">
      <UtilityPracticeButton
        v-if="action.kind === 'lineup'"
        :lineup="action.lineup"
        size="sm"
        class="h-8 min-w-0 shrink overflow-hidden px-3.5 text-[13px] font-semibold"
      />
      <UtilityPracticeButton
        v-else-if="action.kind === 'spot'"
        :spot="action.spot"
        :map-name="mapName"
        :name="action.name"
        size="sm"
        :shape="crowded ? 'icon' : 'button'"
        :class="
          crowded
            ? '!h-8 !w-8 border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)]'
            : 'h-8 min-w-0 shrink overflow-hidden px-3.5 text-[13px] font-semibold'
        "
      />
      <Button
        v-else
        size="sm"
        :variant="action.quiet ? 'outline' : 'default'"
        class="h-8 shrink-0 px-3.5 text-[13px] font-semibold"
        :class="[
          action.quiet ? 'border-white/10' : 'tac-amber-cta',
          server ? '' : 'flex-1',
        ]"
        :disabled="action.disabled"
        :loading="action.loading"
        @click="action.run()"
      >
        {{ action.label }}
      </Button>
    </template>
  </div>
</template>
