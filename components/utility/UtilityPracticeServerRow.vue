<script setup lang="ts">
import { computed, nextTick, ref, useId } from "vue";
import { useI18n } from "vue-i18n";
import { onClickOutside, useEventListener } from "@vueuse/core";
import { Users } from "lucide-vue-next";
import AnimatedStat from "~/components/AnimatedStat.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Fold, HeightSwap } from "~/components/ui/transitions";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { stopUtilityPracticeMutation } from "~/graphql/utilityGraphql";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import cleanMapName from "~/utilities/cleanMapName";
import type { UtilityRunningPracticeSession } from "~/types/utility";

const props = defineProps<{
  session: UtilityRunningPracticeSession;
  regionName: string | null;
}>();

const { t } = useI18n();

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

const state = computed(() => {
  if (props.session.status === "Starting") {
    return {
      label: t("pages.utility.practice.nav_starting"),
      tone: "text-muted-foreground",
    };
  }

  if (props.session.map_changing_at) {
    return {
      label: t("pages.utility.practice.nav_switching"),
      tone: "text-muted-foreground",
    };
  }

  return {
    label: t("pages.utility.practice_servers.ready"),
    tone: "text-[hsl(var(--tac-amber))]",
  };
});

const canStop = computed(() => props.session.can_stop === true);

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
  <div
    ref="root"
    data-practice-server
    class="flex flex-col rounded-md border px-2.5 py-2 transition-colors duration-200 motion-reduce:transition-none"
    :class="
      confirming
        ? 'border-destructive/50 bg-destructive/[0.06]'
        : 'border-border/70 bg-card/50'
    "
  >
    <div class="flex items-center gap-2.5">
      <NuxtLink
        v-if="hostSteamId"
        :to="{ name: 'players-id', params: { id: hostSteamId } }"
        class="shrink-0"
        tabindex="-1"
        aria-hidden="true"
      >
        <Avatar shape="square" class="h-7 w-7 rounded-md">
          <AvatarImage
            v-if="avatar"
            :src="avatar"
            :alt="hostName ?? ''"
            draggable="false"
            class="select-none"
          />
          <AvatarFallback class="text-[0.6rem]">
            {{ (hostName || "?").slice(0, 2) }}
          </AvatarFallback>
        </Avatar>
      </NuxtLink>

      <div class="min-w-0 flex-1">
        <NuxtLink
          v-if="hostSteamId"
          :to="{ name: 'players-id', params: { id: hostSteamId } }"
          class="block truncate text-[13px] font-semibold transition-colors hover:text-[hsl(var(--tac-amber))]"
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

    <Fold :open="confirming && canStop">
      <div
        role="group"
        :aria-labelledby="promptId"
        class="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2"
      >
        <HeightSwap :id="promptId" aria-live="polite" class="min-w-0 flex-1">
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
</template>
