<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import AnimatedStat from "~/components/AnimatedStat.vue";
import { HeightSwap } from "~/components/ui/transitions";
import UtilityPracticeServerConsole from "~/components/utility/UtilityPracticeServerConsole.vue";
import UtilityPracticeServerRow from "~/components/utility/UtilityPracticeServerRow.vue";
import UtilityRenderWarn from "~/components/utility/UtilityRenderWarn.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { runningUtilityPracticeSessionsSubscription } from "~/graphql/utilityGraphql";
import {
  e_player_roles_enum,
  e_utility_practice_statuses_enum,
} from "~/generated/zeus";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";
import { badgePopTransition } from "~/utilities/badgeCount";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import type { UtilityRunningPracticeSession } from "~/types/utility";

const auth = useAuthStore();

const isStaff = computed(
  () => !!auth.me && auth.isRoleAbove(e_player_roles_enum.moderator),
);

const sessions = shallowRef<UtilityRunningPracticeSession[]>([]);
const loading = ref(true);
const heard = ref(false);
const stale = ref(false);

let subscription: { unsubscribe: () => void } | null = null;

function listen() {
  subscription = getGraphqlClient()
    .subscribe({
      query: runningUtilityPracticeSessionsSubscription,
      variables: {
        statuses: [
          e_utility_practice_statuses_enum.Starting,
          e_utility_practice_statuses_enum.Ready,
        ],
      },
    })
    .subscribe({
      next: ({ data }: any) => {
        sessions.value = data?.utility_practice_sessions ?? [];
        loading.value = false;
        heard.value = true;
        stale.value = false;
      },
      error: (error: unknown) => {
        console.error(
          "[utility] running practice servers subscription:",
          error,
        );
        loading.value = false;
        stale.value = true;
      },
    });
}

function stopListening() {
  subscription?.unsubscribe();
  subscription = null;
}

watch(
  isStaff,
  (staff) => {
    if (!import.meta.client) {
      return;
    }

    if (staff && !subscription) {
      listen();
    } else if (!staff && subscription) {
      stopListening();
      sessions.value = [];
      loading.value = true;
      heard.value = false;
      stale.value = false;
    }
  },
  { immediate: true },
);

onBeforeUnmount(stopListening);

const regions = computed(() => {
  const names = new Map<string, string>();
  for (const region of useApplicationSettingsStore().availableRegions ?? []) {
    names.set(region.value, region.description || region.value);
  }
  return names;
});

// Side by side from lg: one server is always open beside the list. Below
// that the panel takes the list's place, so nothing opens until picked.
const wide = useMediaQuery("(min-width: 1024px)");
const selectedId = ref<string | null>(null);

const selected = computed(
  () =>
    sessions.value.find((session) => session.id === selectedId.value) ??
    (wide.value ? (sessions.value[0] ?? null) : null),
);

function regionName(region: string | null) {
  if (!region) {
    return null;
  }

  return regions.value.get(region) ?? region;
}

const rowEnter =
  "transition-[grid-template-rows,opacity] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] [&>*]:overflow-hidden motion-reduce:transition-none";
const rowLeave =
  "transition-[grid-template-rows,opacity] [transition-duration:110ms] ease-in [&>*]:overflow-hidden motion-reduce:transition-none";
const emptyPanel =
  "rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground";
</script>

<template>
  <section
    v-if="isStaff"
    class="lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-5"
  >
    <div v-show="wide || !selected" class="min-w-0">
      <header class="mb-3 flex min-h-5 items-center gap-2">
        <h2 :class="[tacticalSectionLabelClasses, 'mb-0']">
          <span :class="tacticalSectionTickClasses" />
          {{ $t("pages.utility.practice_servers.title") }}
        </h2>
        <Transition v-bind="badgePopTransition">
          <span
            v-if="heard"
            class="font-mono text-[0.7rem] tabular-nums text-muted-foreground"
          >
            <AnimatedStat :value="sessions.length" />
          </span>
        </Transition>
        <Transition
          enter-active-class="transition-opacity duration-200 ease-out motion-reduce:transition-none"
          leave-active-class="transition-opacity duration-150 ease-in motion-reduce:transition-none"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <span v-if="stale" class="ml-auto inline-flex">
            <UtilityRenderWarn
              :title="$t('pages.utility.practice_servers.stale')"
              :note="$t('pages.utility.practice_servers.stale_note')"
            />
          </span>
        </Transition>
      </header>

      <!-- Every state carries the 8px under its last row itself, and the shell
           takes it back: a negative margin on the list alone only lands once
           the swap lets go of the height, and the card jumps by it. -->
      <HeightSwap data-practice-servers-body class="-mb-2">
        <ul v-if="loading" key="loading" class="flex flex-col gap-2 pb-2">
          <li
            v-for="n of 3"
            :key="n"
            data-practice-server-skeleton
            aria-hidden="true"
            class="h-[3.25rem] animate-pulse rounded-md bg-muted/40 motion-reduce:animate-none"
          />
        </ul>

        <div v-else-if="!heard" key="failed" class="pb-2">
          <p :class="emptyPanel">
            {{ $t("pages.utility.practice_servers.failed") }}
          </p>
        </div>

        <div v-else-if="!sessions.length" key="empty" class="pb-2">
          <p :class="emptyPanel">
            {{ $t("pages.utility.practice_servers.empty") }}
          </p>
        </div>

        <TransitionGroup
          v-else
          key="list"
          tag="ul"
          data-practice-servers-list
          class="flex flex-col transition-opacity duration-200 motion-reduce:transition-none"
          :class="stale ? 'opacity-60' : ''"
          :enter-active-class="rowEnter"
          :leave-active-class="rowLeave"
          enter-from-class="!grid-rows-[0fr] opacity-0"
          leave-to-class="!grid-rows-[0fr] opacity-0"
        >
          <li
            v-for="session of sessions"
            :key="session.id"
            class="grid grid-rows-[1fr]"
          >
            <div class="min-h-0 pb-2">
              <UtilityPracticeServerRow
                :session="session"
                :region-name="regionName(session.region)"
                :selected="selected?.id === session.id"
                @select="selectedId = session.id"
              />
            </div>
          </li>
        </TransitionGroup>
      </HeightSwap>
    </div>

    <div
      v-if="loading && wide"
      aria-hidden="true"
      class="h-[calc(100dvh-8rem)] max-h-[56rem] min-h-[32rem] animate-pulse rounded-lg bg-muted/40 motion-reduce:animate-none"
    />
    <Transition
      v-else
      enter-active-class="transition-opacity duration-200 ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0"
      leave-active-class="hidden"
    >
      <UtilityPracticeServerConsole
        v-if="selected"
        :key="selected.id"
        :session="selected"
        :region-name="regionName(selected.region)"
        :show-back="!wide"
        @back="selectedId = null"
      />
    </Transition>
  </section>
</template>
