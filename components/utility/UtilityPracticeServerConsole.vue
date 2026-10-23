<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";
import { onClickOutside, useEventListener } from "@vueuse/core";
import { ArrowLeft, Users } from "lucide-vue-next";
import AnimatedStat from "~/components/AnimatedStat.vue";
import ClipBoard from "~/components/ClipBoard.vue";
import ServiceLogs from "~/components/ServiceLogs.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import RconCommander from "~/components/servers/RconCommander.vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ui/tabs";
import { Fold, HeightSwap } from "~/components/ui/transitions";
import { practiceServerState } from "~/components/utility/practiceServerState";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { stopUtilityPracticeMutation } from "~/graphql/utilityGraphql";
import { useAuthStore } from "~/stores/AuthStore";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import cleanMapName from "~/utilities/cleanMapName";
import {
  tacticalTabIndicatorClasses,
  tacticalTabIndicatorUpcomingClasses,
  tacticalTabsListClasses,
  tacticalTabsTriggerClasses,
} from "~/utilities/tacticalClasses";
import type { UtilityRunningPracticeSession } from "~/types/utility";

const props = defineProps<{
  session: UtilityRunningPracticeSession;
  regionName: string | null;
  /** Phones show the panel in place of the list, so it needs a way back. */
  showBack: boolean;
}>();

const emit = defineEmits<{ back: [] }>();

const { t } = useI18n();
const auth = useAuthStore();

const apiDomain = useRuntimeConfig().public.apiDomain as string;

const root = ref<HTMLElement | null>(null);
const promptId = useId();
const confirming = ref(false);
const stopping = ref(false);
const failure = ref<string | null>(null);

const hostName = computed(() => props.session.host?.name ?? null);
const hostSteamId = computed(
  () => props.session.host?.steam_id ?? props.session.host_steam_id,
);

const avatar = computed(() =>
  resolveAvatarUrl(props.session.host?.avatar_url, apiDomain, 64),
);

const connected = computed(() => props.session.connected_players ?? 0);
const max = computed(() => props.session.max_players);

const state = computed(() => practiceServerState(props.session, t));

const canStop = computed(() => props.session.can_stop === true);

// The api hands the server id only to viewers RCON lets in, and streams job
// logs to administrators only, so each tab shows only where it can work.
const tabs = computed(() => {
  const available: Array<"console" | "logs"> = [];

  if (props.session.server_id) {
    available.push("console");
  }

  if (auth.isAdmin && props.session.match_id) {
    available.push("logs");
  }

  return available;
});

const tab = ref<string>(tabs.value[0] ?? "console");

watch(tabs, (available) => {
  if (available.length && !(available as string[]).includes(tab.value)) {
    tab.value = available[0];
  }
});

// Moderators reach only their own server's console; anyone else's says why
// rather than leaving the panel bare.
const consoleRefused = computed(
  () =>
    !auth.isAdmin &&
    !!auth.me &&
    props.session.host_steam_id !== auth.me.steam_id,
);

// Logs stream from the api for as long as they are mounted, so they start on
// the first visit to the tab and then stay, like the console's history.
const logsOpened = ref(tab.value === "logs");

watch(tab, (value) => {
  if (value === "logs") {
    logsOpened.value = true;
  }
});

function focusIn(selector: string) {
  root.value?.querySelector<HTMLElement>(selector)?.focus();
}

async function ask() {
  failure.value = null;
  confirming.value = true;

  await nextTick();
  focusIn("[data-practice-server-cancel]");
}

async function cancel(restoreFocus: boolean) {
  if (stopping.value) {
    return;
  }

  confirming.value = false;
  failure.value = null;

  if (restoreFocus) {
    await nextTick();
    focusIn("[data-practice-server-stop]");
  }
}

onClickOutside(root, () => {
  if (confirming.value) {
    void cancel(false);
  }
});

// Captured on the window: the Stop button that had focus is gone by now, so
// a focus that fell to the page would otherwise hand Escape to the hub.
useEventListener(
  "keydown",
  (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !confirming.value) {
      return;
    }

    event.preventDefault();

    const focused = document.activeElement;
    void cancel(
      !focused ||
        focused === document.body ||
        !!root.value?.contains(focused),
    );
  },
  { capture: true },
);

async function stop() {
  stopping.value = true;
  failure.value = null;

  try {
    await getGraphqlClient().mutate({
      mutation: stopUtilityPracticeMutation,
      variables: { session_id: props.session.id },
    });
  } catch (error: any) {
    failure.value = error?.message ?? "";
    stopping.value = false;
  }
}
</script>

<template>
  <section
    data-practice-server-panel
    class="flex min-w-0 flex-col gap-3.5 rounded-lg border border-border bg-card/50 p-3 sm:p-4"
    :class="
      tabs.length
        ? 'lg:sticky lg:top-4 lg:h-[calc(100dvh-8rem)] lg:max-h-[56rem] lg:min-h-[32rem]'
        : ''
    "
  >
    <button
      v-if="showBack"
      type="button"
      data-practice-server-back
      class="-my-1.5 inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      @click="emit('back')"
    >
      <ArrowLeft class="size-4" />
      {{ $t("layouts.app_nav.administration.practice_servers") }}
    </button>

    <div ref="root" class="flex flex-col">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div class="flex min-w-0 flex-1 basis-56 items-center gap-3">
          <NuxtLink
            v-if="hostSteamId"
            :to="{ name: 'players-id', params: { id: hostSteamId } }"
            class="shrink-0"
            tabindex="-1"
            aria-hidden="true"
          >
            <Avatar shape="square" class="h-10 w-10 rounded-md">
              <AvatarImage
                v-if="avatar"
                :src="avatar"
                :alt="hostName ?? ''"
                draggable="false"
                class="select-none"
              />
              <AvatarFallback class="text-xs">
                {{ (hostName || "?").slice(0, 2) }}
              </AvatarFallback>
            </Avatar>
          </NuxtLink>

          <div class="min-w-0 flex-1">
            <NuxtLink
              v-if="hostSteamId"
              :to="{ name: 'players-id', params: { id: hostSteamId } }"
              class="block truncate text-base font-semibold transition-colors hover:text-[hsl(var(--tac-amber))]"
            >
              {{ hostName ?? hostSteamId }}
            </NuxtLink>
            <div class="truncate text-xs text-muted-foreground">
              {{ cleanMapName(session.map_name) }}
              <template v-if="regionName"> · {{ regionName }}</template>
              ·
              <span :class="state.tone">{{ state.label }}</span>
              ·
              <TimeAgo :date="session.created_at" hide-icon />
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span
            class="inline-flex shrink-0 items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground"
            :title="
              max != null
                ? $t('pages.utility.practice_servers.players', {
                    connected,
                    max,
                  })
                : undefined
            "
          >
            <Users class="h-3 w-3" />
            <AnimatedStat :value="connected" /><template v-if="max != null"
              >/{{ max }}</template
            >
          </span>

          <HeightSwap v-if="canStop" axis="x">
            <Button
              v-if="!confirming"
              key="stop"
              data-practice-server-stop
              variant="outline"
              size="sm"
              class="h-7 shrink-0 text-destructive hover:text-destructive"
              @click="ask()"
            >
              {{ $t("pages.utility.practice_servers.stop") }}
            </Button>
          </HeightSwap>
        </div>
      </div>

      <Fold :open="confirming && canStop">
        <div
          role="group"
          :aria-labelledby="promptId"
          class="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/[0.06] p-2.5"
        >
          <HeightSwap
            :id="promptId"
            aria-live="polite"
            class="min-w-0 flex-1"
          >
            <span
              v-if="failure !== null"
              key="failure"
              class="block text-xs text-destructive"
            >
              {{ $t("pages.utility.practice.stop_failed") }}<template
                v-if="failure"
                >: {{ failure }}</template
              >
            </span>
            <span v-else key="ask" class="block text-xs text-foreground/90">
              {{
                hostName
                  ? $t("pages.utility.practice_servers.stop_ask", {
                      host: hostName,
                    })
                  : $t("pages.utility.practice_servers.stop_ask_unnamed")
              }}
              {{
                $t(
                  "pages.utility.practice_servers.stop_drops",
                  { count: connected },
                  connected,
                )
              }}
            </span>
          </HeightSwap>
          <Button
            data-practice-server-cancel
            variant="outline"
            size="sm"
            class="h-7"
            :disabled="stopping"
            @click="cancel(true)"
          >
            {{ $t("common.cancel") }}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            class="h-7"
            :loading="stopping"
            @click="stop()"
          >
            {{ $t("pages.utility.practice.stop") }}
          </Button>
        </div>
      </Fold>
    </div>

    <Tabs
      v-if="tabs.length"
      v-model="tab"
      :unmount-on-hide="false"
      :scroll-floor="false"
      class="flex min-h-0 flex-1 flex-col gap-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <TabsList
          v-if="tabs.length > 1"
          :class="[tacticalTabsListClasses, 'grid grid-cols-2 max-sm:w-full']"
        >
          <TabsTrigger
            v-for="key of tabs"
            :key="key"
            :value="key"
            :class="tacticalTabsTriggerClasses"
          >
            <span
              :class="[
                tacticalTabIndicatorClasses,
                tacticalTabIndicatorUpcomingClasses,
                'mr-2 align-middle',
              ]"
            />{{ $t(`pages.utility.practice_servers.${key}`) }}
          </TabsTrigger>
        </TabsList>

        <div
          v-if="session.connection_string"
          class="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground max-sm:w-full"
        >
          <span class="truncate" :title="session.connection_string">
            {{ session.connection_string }}
          </span>
          <ClipBoard
            :data="session.connection_string"
            class="h-7 w-7 shrink-0"
          />
        </div>
      </div>

      <TabsContent
        v-if="session.server_id"
        value="console"
        class="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
      >
        <div class="flex h-full min-h-0 flex-col">
          <RconCommander
            :server-id="session.server_id"
            :online="session.status === 'Ready'"
            :match-id="session.match_id ?? undefined"
            compact
            class="lg:flex-1"
          />
        </div>
      </TabsContent>

      <TabsContent
        v-if="tabs.includes('logs')"
        value="logs"
        class="mt-0 min-h-0 flex-1 data-[state=inactive]:hidden"
      >
        <div
          v-if="logsOpened"
          class="flex h-full min-h-0 flex-col lg:[&>section]:min-h-0 lg:[&>section]:flex-1"
        >
          <ServiceLogs :service="`u-${session.match_id}`" compact />
        </div>
      </TabsContent>
    </Tabs>

    <p v-else-if="consoleRefused" class="text-xs text-muted-foreground">
      {{ $t("pages.utility.practice_servers.no_console") }}
    </p>
  </section>
</template>
