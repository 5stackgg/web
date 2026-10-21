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
</script>

<template>
  <article
    class="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-muted/20 p-4"
  >
    <div class="flex items-center justify-between gap-2">
      <h3 class="m-0 text-[15px] font-bold">
        {{ $t("pages.play.more_ways.practice.title") }}
      </h3>
      <Target aria-hidden="true" class="size-4 text-muted-foreground" />
    </div>

    <HeightSwap>
      <p
        v-if="tileState === 'start'"
        key="start"
        class="m-0 text-[12.5px] text-muted-foreground"
      >
        {{ $t("pages.play.more_ways.practice.description") }}
      </p>
      <div v-else key="session" class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <span
            class="h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-200 motion-reduce:transition-none"
            :class="
              tileState === 'ready'
                ? 'bg-[hsl(var(--tac-amber))]'
                : 'bg-muted-foreground/60'
            "
          />
          <span class="min-w-0 truncate text-[13.5px] font-medium">
            {{ sessionMap }}
          </span>
          <!-- Not FadeSwap: its leaver takes the entering label's width, and a
               longer label overflowing that box ignores text-right. -->
          <span class="relative ml-auto shrink-0">
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
        </div>

        <HeightSwap>
          <div
            v-if="tileState !== 'ready'"
            :key="tileState"
            class="flex items-center gap-2 text-[12.5px] text-muted-foreground"
          >
            <Spinner class="h-4 w-4 shrink-0" />
            {{
              tileState === "switching"
                ? $t("pages.utility.practice.switching", { map: sessionMap })
                : $t("pages.utility.practice.booting")
            }}
          </div>
          <p v-else key="ready" class="m-0 text-[12.5px] text-muted-foreground">
            {{ $t(accessLine) }}
            <template v-if="inviteLinkReaches">
              &middot;
              {{ $t("pages.play.more_ways.practice.invite_link_in_panel") }}
            </template>
          </p>
        </HeightSwap>
      </div>
    </HeightSwap>

    <HeightSwap class="mt-auto">
      <div
        v-if="tileState === 'start'"
        key="start"
        class="flex flex-wrap items-center gap-2 pt-1"
      >
        <Button
          v-if="isGuest"
          size="sm"
          variant="outline"
          :class="['h-8', touchTarget]"
          @click="signIn"
        >
          {{ $t("pages.play.more_ways.practice.sign_in") }}
        </Button>
        <template v-else>
          <Select v-if="maps.length > 1" v-model="mapName">
            <SelectTrigger
              class="h-8 w-auto min-w-[8.5rem] gap-2 text-xs"
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
                  <SelectItem v-for="map in group.maps" :key="map" :value="map">
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
            variant="outline"
            :class="['h-8', touchTarget]"
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
        class="flex flex-wrap items-center gap-2 pt-1"
      >
        <Button
          size="sm"
          variant="outline"
          :class="['h-8 text-destructive hover:text-destructive', touchTarget]"
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

      <div
        v-else
        :key="tileState"
        class="flex flex-wrap items-center gap-2 pt-1"
      >
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
          :class="['h-8 w-8 shrink-0', touchTarget, 'after:-inset-x-1.5']"
          :title="practice.connectionString"
        />
        <UtilityPracticeNav>
          <template #trigger>
            <Button
              size="sm"
              variant="outline"
              :class="['h-8', touchTarget]"
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
  </article>
</template>
