<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ExternalLink, Target } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { HeightSwap } from "~/components/ui/transitions";
import { toast } from "~/components/ui/toast";
import ClipBoard from "~/components/ClipBoard.vue";
import StartPracticeDialog from "~/components/utility/StartPracticeDialog.vue";
import UtilityPracticeNav from "~/components/utility/UtilityPracticeNav.vue";
import PlayWayCard from "~/components/play/PlayWayCard.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import {
  leaveUtilityPracticeMutation,
  stopUtilityPracticeMutation,
} from "~/graphql/utilityGraphql";
import { e_match_types_enum, order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { useUtilityPracticeSession } from "~/composables/useUtilityPracticeSession";
import { readUtilityPracticeSession } from "~/types/utility";
import {
  UTILITY_ACCESS_FRIENDS,
  UTILITY_ACCESS_INVITE,
  UTILITY_ACCESS_OPEN,
  UTILITY_ACCESS_PRIVATE,
  utilityAccessOption,
  utilityInviteLinkReaches,
} from "~/utilities/utilityPracticeAccess";
import { loginLinks } from "~/utilities/loginLinks";
import cleanMapName from "~/utilities/cleanMapName";
import activeDutyMaps from "~/utilities/activeDutyMaps";
import { loadRadarMaps, normalizeMapName } from "~/utilities/mapAssets";

const props = withDefaults(defineProps<{ layout?: "featured" | "peek" }>(), {
  layout: "featured",
});

const { t } = useI18n();

const isGuest = computed(() => !useAuthStore().me?.steam_id);

// The practice dialog books a server for one map, so the tile picks it here.
// Only maps with a radar can carry lineups -- same rule as /utility.
const maps = ref<string[]>([]);
const activeDuty = ref<Set<string>>(new Set());
const mapName = ref<string>("");
const practiceOpen = ref(false);

const mapsQuery = generateQuery({
  maps: [
    {
      where: {
        enabled: { _eq: true },
        workshop_map_id: { _is_null: true },
        type: { _neq: e_match_types_enum.Rush },
      },
      order_by: [{ name: order_by.asc }],
    },
    { name: true, type: true, active_pool: true },
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
    const rows = ((data as any)?.maps ?? []) as Array<{
      name: string;
      type: string;
      active_pool: boolean;
    }>;
    const names = new Set<string>();
    for (const map of rows) {
      const radar = normalizeMapName(map.name);
      if (radarMaps.has(radar)) names.add(radar);
    }
    maps.value = [...names];
    activeDuty.value = activeDutyMaps(rows);
    mapName.value =
      maps.value.find((name) => name === "de_mirage") ?? maps.value[0] ?? "";
  } catch (error) {
    console.error("[play] practice maps error:", error);
  }
});

const mapGroups = computed(() => {
  const active = maps.value.filter((map) => activeDuty.value.has(map));
  const other = maps.value.filter((map) => !activeDuty.value.has(map));
  if (!active.length || !other.length) {
    return [];
  }
  return [
    { key: "active", label: "maps.active_duty", maps: active },
    { key: "other", label: "maps.other", maps: other },
  ];
});

// The peek's map picker: one row of icons, Active Duty first.
const PEEK_MAPS = 9;
const peekMaps = computed(() =>
  [
    ...maps.value.filter((map) => activeDuty.value.has(map)),
    ...maps.value.filter((map) => !activeDuty.value.has(map)),
  ].slice(0, PEEK_MAPS),
);

const { session, switching } = useUtilityPracticeSession();

const practice = computed(() => readUtilityPracticeSession(session.value));

// A server stays Ready through a map change, which is no time to join it.
const tileState = computed(() => {
  if (!session.value) {
    return "start";
  }

  if (switching.value) {
    return "switching";
  }

  return practice.value.isLive ? "ready" : "booting";
});

const stateLabels: Record<string, string> = {
  booting: "pages.utility.practice.nav_starting",
  switching: "pages.utility.practice.nav_switching",
  ready: "pages.utility.practice.nav_ready",
};

const sessionMap = computed(() =>
  practice.value.mapName ? cleanMapName(practice.value.mapName) : null,
);

const startMap = computed(() =>
  !isGuest.value && mapName.value ? cleanMapName(mapName.value) : null,
);

const title = computed(() => {
  if (props.layout === "featured") {
    if (tileState.value !== "start" && sessionMap.value) {
      return sessionMap.value;
    }
    if (tileState.value === "start" && startMap.value) {
      return t("pages.play.more_ways.practice.on_map", {
        map: startMap.value,
      });
    }
  }
  return t("pages.play.more_ways.practice.title");
});

const peekLine = computed(() => {
  if (tileState.value !== "start") {
    return [sessionMap.value, t(stateLabels[tileState.value])]
      .filter(Boolean)
      .join(" · ");
  }
  return startMap.value
    ? t("pages.play.more_ways.practice.start_on", { map: startMap.value })
    : t("pages.play.more_ways.practice.description");
});

const art = computed(
  () =>
    (tileState.value === "start" ? mapName.value : practice.value.mapName) ||
    "de_mirage",
);

// The featured card holds the controls under its line; the peek shows
// them in place of the map picker.
const controlsSlot = computed(() =>
  props.layout === "featured" ? "actions" : "preview",
);

const access = computed(() =>
  utilityAccessOption(practice.value.access, practice.value.isOpen),
);

const accessLines: Record<string, string> = {
  [UTILITY_ACCESS_OPEN]: "pages.play.more_ways.practice.access_open",
  [UTILITY_ACCESS_FRIENDS]: "pages.play.more_ways.practice.access_friends",
  [UTILITY_ACCESS_INVITE]: "pages.play.more_ways.practice.access_invite",
  [UTILITY_ACCESS_PRIVATE]: "pages.play.more_ways.practice.access_private",
};

const accessLine = computed(() => accessLines[access.value.value]);

const inviteLinkReaches = computed(() =>
  utilityInviteLinkReaches(access.value.value),
);

const JOIN_SPINNER_MS = 10_000;

const joiningServer = ref(false);
let joinTimer: ReturnType<typeof setTimeout> | null = null;

function onJoinClick() {
  joiningServer.value = true;

  if (joinTimer) {
    clearTimeout(joinTimer);
  }

  joinTimer = setTimeout(() => {
    joiningServer.value = false;
    joinTimer = null;
  }, JOIN_SPINNER_MS);
}

onBeforeUnmount(() => {
  if (joinTimer) {
    clearTimeout(joinTimer);
  }
});

const ending = ref(false);

async function end() {
  const id = session.value?.id;

  if (!id) {
    return;
  }

  const canManage = practice.value.canManage;

  ending.value = true;

  try {
    await getGraphqlClient().mutate({
      mutation: canManage
        ? stopUtilityPracticeMutation
        : leaveUtilityPracticeMutation,
      variables: { session_id: id },
    });
  } catch (error: any) {
    toast({
      title: canManage
        ? t("pages.utility.practice.stop_failed")
        : t("pages.utility.practice.leave_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    ending.value = false;
  }
}

function signIn() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}

const touchTarget =
  "relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] [@media(pointer:fine)]:after:hidden";
const amberClasses =
  "bg-[hsl(var(--tac-amber))] font-semibold text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]";
</script>

<template>
  <PlayWayCard :layout="layout" :title="title" :icon="Target" :art="art">
    <template
      v-if="layout === 'featured' && (tileState !== 'start' || startMap)"
      #kicker
    >
      <Target class="size-3.5 shrink-0" aria-hidden="true" />
      {{ $t("pages.play.more_ways.practice.title") }}
      <!-- Not FadeSwap: its leaver takes the entering label's width, and a
           longer label overflowing that box ignores text-right. -->
      <span v-if="tileState !== 'start'" class="relative ml-auto shrink-0">
        <Transition
          enter-active-class="transition-opacity duration-300 ease-out motion-reduce:!duration-0"
          leave-active-class="absolute right-0 top-0 transition-opacity duration-200 ease-in motion-reduce:!duration-0"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <span
            :key="tileState"
            class="block whitespace-nowrap font-mono text-[0.55rem] uppercase tracking-[0.14em]"
            :class="
              tileState === 'ready'
                ? 'text-[hsl(var(--tac-amber))]'
                : 'text-muted-foreground'
            "
          >
            {{ $t(stateLabels[tileState]) }}
          </span>
        </Transition>
      </span>
    </template>

    <template v-if="layout === 'peek'">{{ peekLine }}</template>
    <HeightSwap v-else>
      <p v-if="tileState === 'start'" key="start" class="m-0">
        {{ $t("pages.play.more_ways.practice.description") }}
      </p>
      <div
        v-else-if="tileState !== 'ready'"
        :key="tileState"
        class="flex items-center gap-2"
      >
        <Spinner class="h-4 w-4 shrink-0" />
        {{
          tileState === "switching"
            ? $t("pages.utility.practice.switching", { map: sessionMap })
            : $t("pages.utility.practice.booting")
        }}
      </div>
      <p v-else key="ready" class="m-0">
        {{ $t(accessLine) }}
        <template v-if="inviteLinkReaches">
          &middot;
          {{ $t("pages.play.more_ways.practice.invite_link_in_panel") }}
        </template>
      </p>
    </HeightSwap>

    <template v-if="layout === 'peek' && tileState === 'start'" #actions>
      <Button
        v-if="isGuest"
        size="sm"
        variant="outline"
        :class="['h-8', touchTarget]"
        @click="signIn"
      >
        {{ $t("pages.play.more_ways.practice.sign_in") }}
      </Button>
      <Button
        v-else
        size="sm"
        variant="outline"
        :class="['h-8', touchTarget]"
        :disabled="!mapName"
        @click="practiceOpen = true"
      >
        {{ $t("pages.play.more_ways.practice.start_short") }}
      </Button>
    </template>

    <template #[controlsSlot]>
      <HeightSwap class="w-full">
        <div
          v-if="tileState === 'start' && layout === 'peek'"
          key="maps"
          role="group"
          :aria-label="$t('pages.play.more_ways.practice.map')"
          class="grid grid-cols-9 gap-1"
        >
          <button
            v-for="map in peekMaps"
            :key="map"
            type="button"
            :aria-pressed="map === mapName"
            :aria-label="cleanMapName(map)"
            :title="cleanMapName(map)"
            class="group/map grid h-[34px] place-items-center rounded-md border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] max-md:h-10"
            :class="
              map === mapName
                ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)]'
                : 'border-border hover:border-foreground/25'
            "
            @click="mapName = map"
          >
            <img
              :src="`/img/maps/icons/${map}.svg`"
              alt=""
              class="size-[22px] max-w-full object-contain transition-[opacity,filter] duration-150 max-md:size-5"
              :class="
                map === mapName
                  ? ''
                  : 'opacity-[0.55] grayscale-[0.5] group-hover/map:opacity-90'
              "
            />
          </button>
        </div>

        <div
          v-else-if="tileState === 'start'"
          key="start"
          class="flex flex-wrap items-center gap-2"
        >
          <Button
            v-if="isGuest"
            size="sm"
            :class="[amberClasses, 'h-8 max-md:flex-1', touchTarget]"
            @click="signIn"
          >
            {{ $t("pages.play.more_ways.practice.sign_in") }}
          </Button>
          <template v-else>
            <Select v-if="maps.length > 1" v-model="mapName">
              <SelectTrigger
                class="h-8 w-auto min-w-[8.5rem] gap-2 bg-background/55 text-xs"
                :aria-label="$t('pages.play.more_ways.practice.map')"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <template v-if="mapGroups.length">
                  <SelectGroup v-for="group in mapGroups" :key="group.key">
                    <SelectLabel
                      class="text-[0.65rem] uppercase tracking-wider text-muted-foreground"
                    >
                      {{ $t(group.label) }}
                    </SelectLabel>
                    <SelectItem
                      v-for="map in group.maps"
                      :key="map"
                      :value="map"
                    >
                      {{ cleanMapName(map) }}
                    </SelectItem>
                  </SelectGroup>
                </template>
                <template v-else>
                  <SelectItem v-for="map in maps" :key="map" :value="map">
                    {{ cleanMapName(map) }}
                  </SelectItem>
                </template>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              :class="[amberClasses, 'h-8 max-md:flex-1', touchTarget]"
              :disabled="!mapName"
              @click="practiceOpen = true"
            >
              {{ $t("pages.play.more_ways.practice.start") }}
            </Button>
          </template>
        </div>

        <div
          v-else-if="tileState === 'booting'"
          key="booting"
          class="flex flex-wrap items-center gap-2"
        >
          <Button
            size="sm"
            variant="outline"
            :class="[
              'h-8 text-destructive hover:text-destructive',
              touchTarget,
            ]"
            :loading="ending"
            @click="end()"
          >
            {{
              practice.canManage
                ? $t("pages.utility.practice.stop")
                : $t("pages.utility.practice.leave")
            }}
          </Button>
        </div>

        <div v-else :key="tileState" class="flex flex-wrap items-center gap-2">
          <Button
            v-if="tileState === 'ready' && practice.connectionLink"
            as="a"
            :href="practice.connectionLink"
            size="sm"
            :class="[
              'tac-amber-cta h-8 font-bold uppercase tracking-[0.18em]',
              touchTarget,
            ]"
            :loading="joiningServer"
            @click="onJoinClick()"
          >
            <ExternalLink class="h-4 w-4" />
            {{ $t("server.join_server") }}
          </Button>
          <ClipBoard
            v-if="tileState === 'ready' && practice.connectionString"
            :data="practice.connectionString"
            :class="[
              'h-8 w-8 shrink-0 bg-background/55',
              touchTarget,
              'after:-inset-x-1.5',
            ]"
            :title="practice.connectionString"
          />
          <UtilityPracticeNav>
            <template #trigger>
              <Button
                size="sm"
                variant="outline"
                :class="['h-8 bg-background/55', touchTarget]"
              >
                {{ $t("pages.play.more_ways.practice.manage") }}
              </Button>
            </template>
          </UtilityPracticeNav>
          <Button
            size="sm"
            variant="ghost"
            :class="[
              'h-8 text-destructive hover:bg-destructive/10 hover:text-destructive',
              touchTarget,
            ]"
            :loading="ending"
            @click="end()"
          >
            {{
              practice.canManage
                ? $t("pages.play.more_ways.practice.stop")
                : $t("pages.play.more_ways.practice.leave")
            }}
          </Button>
        </div>
      </HeightSwap>

      <StartPracticeDialog
        v-if="mapName"
        v-model:open="practiceOpen"
        :map-name="mapName"
      />
    </template>
  </PlayWayCard>
</template>
