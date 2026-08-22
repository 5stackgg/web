<script setup lang="ts">
/**
 * The practice bar, sat in the top nav beside <MatchLobbies>.
 *
 * Same job as the match lobby bar and deliberately the same shape: a persistent
 * strip that says what is waiting for you and gets you into it in one click.
 * A practice server is booked in a dialog on one page and then used from
 * anywhere, so the only place this can live is the chrome.
 *
 * It also owns "am I on a practice server" for the whole app. useUtilityLoad
 * caches that at module scope, and nothing else asks on a timer -- so this
 * polling is what makes the Practice buttons on cards and dialogs appear
 * without a page refresh.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Repeat, Server } from "lucide-vue-next";
import { useAuthStore } from "~/stores/AuthStore";
import { useUtilityLoad } from "~/composables/useUtilityLoad";
import { useUtilityPracticeSession } from "~/composables/useUtilityPracticeSession";
import { useI18n } from "vue-i18n";
import cleanMapName from "~/utilities/cleanMapName";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import UtilityPracticeSessionPanel from "~/components/utility/UtilityPracticeSessionPanel.vue";

const { t } = useI18n();
const me = computed(() => useAuthStore().me);
const load = useUtilityLoad();
const { session, booting, canManage, switching } = useUtilityPracticeSession();
const route = useRoute();

const CONNECTED_POLL_MS = 15_000;
let poll: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
  if (poll) {
    clearInterval(poll);
    poll = null;
  }
}

watch(
  () => [me.value?.steam_id, session.value?.status] as const,
  ([steamId]) => {
    stopPolling();

    if (!steamId) {
      return;
    }

    // Immediately, because a reservation appearing or turning Ready is exactly
    // when the answer is about to change.
    void load.check(true);
    poll = setInterval(() => void load.check(true), CONNECTED_POLL_MS);
  },
  { immediate: true },
);

onBeforeUnmount(stopPolling);

// Standing on a server, as opposed to holding a reservation for one. Kept
// independent of the session: you can be on a server you did not book.
const connected = computed(() => load.onServer.value);

const mapName = computed(
  () => load.where.value?.map_name ?? session.value?.map_name ?? null,
);

// Routes and mutations take the file name; the strip shows the title.
const mapDisplay = computed(() =>
  mapName.value ? cleanMapName(mapName.value) : null,
);

// The map the page is reading, when that page is a utility library. Offering
// the switch from the chrome means it is reachable from every tab of it, not
// only from the strip beside the board.
const pageMap = computed(() =>
  route.name === "utility-map" ? String(route.params.map) : null,
);

const canSwitchToPageMap = computed(
  () =>
    canManage.value &&
    !switching.value &&
    !!pageMap.value &&
    !!mapName.value &&
    pageMap.value !== mapName.value,
);

async function switchToPageMap() {
  if (pageMap.value) {
    await load.switchMap(pageMap.value);
  }
}

// Only with a server. The header is not the place to advertise practice to
// somebody who has not asked for it -- starting one is the utility page's job.
const visible = computed(() => !!session.value || connected.value);

// One word for the state, because the caption underneath already says what
// kind of thing this is. The old bar said "JOIN PRACTICE" in the status cell
// AND on the button next to it, which is how a strip ends up shouting the same
// thing three times.
const state = computed(() => {
  if (connected.value) {
    return t("pages.utility.practice.nav_connected");
  }

  if (switching.value) {
    return t("pages.utility.practice.nav_switching");
  }

  if (booting.value) {
    return t("pages.utility.practice.nav_starting");
  }

  // The bar only exists with a server, so there is no fourth state.
  return t("pages.utility.practice.nav_ready");
});

// The popover holds the session panel, so it has to shut itself: ending a
// session leaves it describing something that is no longer there.
const open = ref(false);

async function switchAndClose() {
  open.value = false;
  await switchToPageMap();
}
</script>

<template>
  <Popover v-if="visible" v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="group relative hidden h-12 items-center gap-2.5 overflow-hidden rounded-md border pl-2.5 pr-3 text-left shadow-sm backdrop-blur-sm transition-colors duration-150 md:flex"
        :class="
          connected
            ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.06)]'
            : 'border-zinc-900/90 bg-[#09090b]/95 hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-black/95'
        "
      >
        <!-- A live server earns a moving edge; a booked one does not. -->
        <span
          v-if="connected"
          class="absolute inset-y-0 left-0 w-[2px] bg-[hsl(var(--tac-amber))]"
          aria-hidden="true"
        ></span>

        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[hsl(var(--tac-amber))]"
          :class="
            connected ? 'bg-[hsl(var(--tac-amber)/0.16)]' : 'bg-zinc-900/80'
          "
        >
          <span v-if="booting" class="relative flex h-1.5 w-1.5">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
            ></span>
            <span
              class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
            ></span>
          </span>
          <Server v-else class="h-4 w-4" />
        </span>

        <!-- Name over caption, the same hierarchy the match bar uses. -->
        <span class="flex min-w-0 flex-col justify-center leading-tight">
          <span class="truncate text-xs font-medium text-foreground">
            {{ mapDisplay }}
          </span>
          <span
            class="truncate font-mono text-[0.58rem] uppercase tracking-[0.16em]"
            :class="
              connected
                ? 'text-[hsl(var(--tac-amber))]'
                : 'text-muted-foreground'
            "
          >
            {{ state }}
          </span>
        </span>
      </button>
    </PopoverTrigger>

    <!-- The same panel the practice dialog renders, rather than a menu of
         verbs beside a summary of the facts. One layout, one set of controls,
         and nothing to keep in step between the chrome and the page. -->
    <PopoverContent align="end" class="w-[23rem] p-3">
      <UtilityPracticeSessionPanel
        v-if="session"
        :session="session"
        :map-name="mapName"
        show-header
        @ended="open = false"
        @joined="open = false"
      >
        <template v-if="canSwitchToPageMap" #extra>
          <Separator />
          <div>
            <Button variant="outline" class="w-full" @click="switchAndClose()">
              <Repeat class="h-4 w-4" />
              {{
                $t("pages.utility.practice.switch_map", {
                  map: cleanMapName(pageMap ?? ""),
                })
              }}
            </Button>
          </div>
        </template>
      </UtilityPracticeSessionPanel>

      <!-- Standing on a server somebody else booked: the row is the host's, so
           there is nothing here to drive -- only the way back to its map. -->
      <div v-else class="space-y-3">
        <div class="flex items-center gap-2">
          <span
            class="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--tac-amber))]"
          />
          <span class="min-w-0 truncate text-sm font-medium">
            {{ mapDisplay }}
          </span>
          <span
            class="ml-auto shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
          >
            {{ state }}
          </span>
        </div>

        <Button
          v-if="mapName"
          as-child
          variant="outline"
          class="w-full"
          @click="open = false"
        >
          <NuxtLink :to="`/utility/${mapName}`">
            {{ $t("pages.utility.practice.open_library") }}
          </NuxtLink>
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
