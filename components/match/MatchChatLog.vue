<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useNow } from "@vueuse/core";
import { EyeOff, Lock, Scissors } from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import { Skeleton } from "~/components/ui/skeleton";
import mapLabel from "~/utilities/mapLabel";
import { dateLocale } from "~/utilities/dateLocale";

type LogMessage = {
  id: string;
  message: string;
  timestamp: string;
  source?: "web" | "game";
  from: { steam_id: string; name: string };
  edited_at?: string;
  // Each earlier text, the original first, with when it was replaced.
  edits?: Array<{ message: string; edited_at: string }>;
  deleted_at?: string;
  deleted_by?: { steam_id: string; name: string };
};

type MatchChatLog = {
  match: LogMessage[];
  teams: Array<{ lineup_id: string; messages: LogMessage[] }>;
  team_chat_withheld: boolean;
  archive_truncated?: boolean;
  expires_at: string | null;
};

const props = defineProps<{
  match: {
    id: string;
    lineup_1?: { id: string; name?: string | null } | null;
    lineup_2?: { id: string; name?: string | null } | null;
    match_maps?: Array<{
      id: string;
      map?: { name?: string | null; label?: string | null } | null;
      started_at?: string | null;
      ended_at?: string | null;
    }>;
  };
  activeMapId?: string | null;
}>();

const { t } = useI18n();

const FULL_MATCH = "full";

const log = ref<MatchChatLog | null>(null);
const openEdits = ref<Record<string, boolean>>({});

function toggleEdits(messageId: string) {
  openEdits.value = {
    ...openEdits.value,
    [messageId]: !openEdits.value[messageId],
  };
}
const failed = ref(false);
const selected = ref(FULL_MATCH);

const clock = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const now = useNow({ interval: 60_000 });

// started_at is stamped again on every move into Knife, Live or Overtime, so a
// map's window runs from the end of the one before it, not from its start.
const playedMaps = computed(() => {
  let from = -Infinity;

  return (props.match.match_maps ?? [])
    .map((map, index) => ({ ...map, number: index + 1 }))
    .filter((map) => !!map.started_at || !!map.ended_at)
    .map((map) => {
      const to = map.ended_at ? new Date(map.ended_at).getTime() : Infinity;
      const range = { from, to };
      if (Number.isFinite(to)) {
        from = to;
      }
      return { ...map, range };
    });
});

watch(
  () => props.activeMapId,
  (id) => {
    selected.value = playedMaps.value.some((map) => map.id === id)
      ? id!
      : FULL_MATCH;
  },
  { immediate: true },
);

// The whole relative phrase comes from Intl, so the noun takes the case its
// preposition needs ("in 6 Tagen", "za 1 godzinę"); a number pasted into a
// translated "in {time}" cannot.
const deleted = computed(() => {
  if (!log.value?.expires_at) {
    return null;
  }

  const remaining =
    new Date(log.value.expires_at).getTime() - now.value.getTime();

  if (remaining < HOUR) {
    return t("match.chat_log.deleted_soon");
  }

  const relative = new Intl.RelativeTimeFormat(dateLocale(), {
    numeric: "always",
  });

  return t("match.chat_log.deleted", {
    relative:
      remaining >= DAY
        ? relative.format(Math.floor(remaining / DAY), "day")
        : relative.format(Math.floor(remaining / HOUR), "hour"),
  });
});

const filterOptions = computed(() => [
  { key: FULL_MATCH, label: t("match.chat_log.full_match") },
  ...playedMaps.value.map((map) => ({
    key: map.id,
    label: t("match.chat_log.map_option", {
      number: map.number,
      name: mapLabel(map.map),
    }),
  })),
]);

const mapWindow = computed(
  () => playedMaps.value.find(({ id }) => id === selected.value)?.range,
);

function inWindow(messages: LogMessage[]) {
  const range = mapWindow.value;
  if (!range) {
    return messages;
  }
  return messages.filter((message) => {
    const at = new Date(message.timestamp).getTime();
    return at > range.from && at <= range.to;
  });
}

const lineups = computed(() => [props.match.lineup_1, props.match.lineup_2]);

const columns = computed(() => {
  if (!log.value) {
    return [];
  }

  return [
    {
      key: "match",
      label: t("match.chat_log.all_chat"),
      tone: "neutral",
      messages: inWindow(log.value.match),
    },
    ...log.value.teams.map((team) => {
      const index = lineups.value.findIndex(
        (lineup) => lineup?.id === team.lineup_id,
      );
      return {
        key: team.lineup_id,
        label: lineups.value[index]?.name || t("match.chat_log.team_chat"),
        tone: index === 1 ? "lineup-2" : "lineup-1",
        messages: inWindow(team.messages),
      };
    }),
  ];
});

const isEmpty = computed(
  () =>
    !!log.value &&
    log.value.match.length === 0 &&
    log.value.teams.every((team) => team.messages.length === 0),
);

const state = computed(() => {
  if (failed.value) {
    return "failed";
  }
  if (!log.value) {
    return "loading";
  }
  return isEmpty.value ? "empty" : "content";
});

const TONES: Record<string, string> = {
  neutral: "border-border bg-muted/40 text-muted-foreground",
  "lineup-1":
    "border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]",
  "lineup-2": "border-sky-400/50 bg-sky-400/10 text-sky-400",
};

onMounted(async () => {
  try {
    log.value = await $fetch<MatchChatLog>(
      `https://${useRuntimeConfig().public.apiDomain}/chat/matches/${props.match.id}/log`,
      { credentials: "include" },
    );
  } catch {
    failed.value = true;
  }
});
</script>

<template>
  <div class="flex max-w-[1500px] flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div class="flex flex-col gap-1">
        <p
          class="inline-flex items-center gap-2 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground"
        >
          <span
            class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
          ></span>
          {{ $t("match.tabs.chat_log") }}
        </p>
        <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock class="h-3 w-3 shrink-0" />
          {{ $t("match.chat_log.visibility") }}
          <template v-if="deleted">
            <span aria-hidden="true">·</span>
            {{ deleted }}
          </template>
        </p>
        <PageTransition>
          <p
            v-if="log?.team_chat_withheld"
            class="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <EyeOff class="h-3 w-3 shrink-0" />
            {{ $t("match.chat_log.withheld") }}
          </p>
        </PageTransition>
        <PageTransition>
          <p
            v-if="log?.archive_truncated"
            class="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Scissors class="h-3 w-3 shrink-0" />
            {{ $t("match.chat_log.truncated") }}
          </p>
        </PageTransition>
      </div>
      <AnimatedFilters
        v-if="playedMaps.length > 1"
        v-model="selected"
        :options="filterOptions"
        square
      />
    </div>

    <PageTransition swap>
      <div
        v-if="state === 'loading'"
        key="loading"
        class="grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        <div
          v-for="index in 3"
          :key="index"
          class="flex flex-col gap-2 rounded-xl bg-muted/50 p-3"
        >
          <Skeleton class="h-4 w-20" />
          <Skeleton class="h-8 w-full" />
          <Skeleton class="h-8 w-3/4" />
        </div>
      </div>
      <div
        v-else-if="state === 'failed'"
        key="failed"
        class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-8 text-center"
      >
        <h3 class="font-semibold">{{ $t("match.chat_log.failed_title") }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ $t("match.chat_log.failed_description") }}
        </p>
      </div>
      <div
        v-else-if="state === 'empty'"
        key="empty"
        class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-8 text-center"
      >
        <h3 class="font-semibold">{{ $t("match.chat_log.empty_title") }}</h3>
        <p class="text-sm text-muted-foreground">
          {{
            log?.team_chat_withheld
              ? $t("match.chat_log.empty_withheld_description")
              : $t("match.chat_log.empty_description")
          }}
        </p>
      </div>
      <div v-else key="content" class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <PageTransition
          v-for="(column, index) in columns"
          :key="column.key"
          :delay="index * 60"
        >
          <div
            data-chat-log-column
            class="flex min-w-0 flex-col gap-2 rounded-xl bg-muted/50 p-3"
          >
            <span
              class="inline-flex w-fit max-w-full items-center truncate rounded-sm border px-1.5 py-[1px] font-mono text-[0.55rem] font-bold uppercase leading-none tracking-[0.14em]"
              :class="TONES[column.tone]"
            >
              {{ column.label }}
            </span>
            <HeightSwap>
              <div
                :key="`${column.key}:${selected}`"
                class="flex flex-col gap-2"
              >
                <div
                  v-for="message in column.messages"
                  :key="message.id"
                  data-chat-log-line
                  class="text-[11px] leading-snug"
                >
                  <span class="font-mono text-[9px] text-muted-foreground/70">
                    {{ clock.format(new Date(message.timestamp)) }}
                  </span>
                  <NuxtLink
                    :to="`/players/${message.from.steam_id}`"
                    class="ml-1 font-semibold hover:underline"
                  >
                    {{ message.from.name }}
                  </NuxtLink>
                  <span
                    v-if="message.source === 'web'"
                    class="ml-1 font-mono text-[0.5rem] font-bold uppercase tracking-[0.16em] text-muted-foreground/70"
                  >
                    {{ $t("match.chat_log.web_tag") }}
                  </span>
                  <span
                    v-if="message.deleted_at"
                    data-chat-log-deleted
                    class="ml-1 font-mono text-[0.5rem] font-bold uppercase tracking-[0.16em] text-muted-foreground/70"
                  >
                    {{
                      message.deleted_by?.name
                        ? $t("match.chat_log.deleted_by", {
                            name: message.deleted_by.name,
                          })
                        : $t("match.chat_log.deleted_marker")
                    }}
                  </span>
                  <button
                    v-if="message.edited_at"
                    type="button"
                    data-chat-log-edited
                    :aria-expanded="!!openEdits[message.id]"
                    :disabled="!message.edits?.length"
                    class="ml-1 font-mono text-[0.5rem] font-bold uppercase tracking-[0.16em] text-muted-foreground/70 underline-offset-2 transition-colors enabled:hover:text-foreground enabled:hover:underline"
                    @click="toggleEdits(message.id)"
                  >
                    {{ $t("match.chat_log.edited_marker") }}
                  </button>
                  <p
                    class="whitespace-pre-wrap break-words"
                    :class="{ 'text-muted-foreground': message.deleted_at }"
                  >
                    {{ message.message }}
                  </p>
                  <Fold :open="!!openEdits[message.id]">
                    <ul
                      class="mt-1 flex flex-col gap-0.5 border-l border-border/60 pl-2"
                    >
                      <li
                        v-for="earlier in message.edits ?? []"
                        :key="earlier.edited_at"
                        data-chat-log-earlier
                        class="whitespace-pre-wrap break-words text-muted-foreground"
                      >
                        <span
                          class="font-mono text-[9px] text-muted-foreground/70"
                        >
                          {{ clock.format(new Date(earlier.edited_at)) }}
                        </span>
                        {{ earlier.message }}
                      </li>
                    </ul>
                  </Fold>
                </div>
                <p
                  v-if="column.messages.length === 0"
                  class="text-[11px] text-muted-foreground"
                >
                  {{ $t("match.chat_log.no_messages") }}
                </p>
              </div>
            </HeightSwap>
          </div>
        </PageTransition>
      </div>
    </PageTransition>
  </div>
</template>
