<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Download, FileDown, Maximize2, Minimize2 } from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import AdminSearch from "~/components/admin/AdminSearch.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { Switch } from "~/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { toast } from "~/components/ui/toast";
import LogServiceList from "~/components/system-logs/LogServiceList.vue";
import LogVolumeStrip from "~/components/system-logs/LogVolumeStrip.vue";
import LogRepeats from "~/components/system-logs/LogRepeats.vue";
import LogStream from "~/components/system-logs/LogStream.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import {
  LEVEL_FILTERS,
  PRESETS,
  SERVICES,
  countLevels,
  groupRepeats,
  hourMinute,
  levelMatches,
  ratePerMinute,
  rememberedServices,
  serviceStatus,
  signatureOf,
  sparkBuckets,
  textMatches,
  volumeBuckets,
  type LevelFilter,
  type LogLine,
  type ServiceRowStats,
  type VolumeBucket,
} from "~/components/system-logs/logLines";
import {
  downloadFullServiceLogs,
  saveBlob,
  useSystemLogStreams,
} from "~/composables/useSystemLogStreams";
import { getQueryString } from "~/composables/useRouteTab";
import { useRememberedView } from "~/composables/useRememberedView";

definePageMeta({ middleware: "admin" });

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();

const streams = useSystemLogStreams();
const { lines, pods, offline, earlier, lastFlush } = streams;

// ?tab=<service> (system metrics links here) opens on that one service.
function requestedService() {
  const tab = getQueryString(route.query, "tab");
  const legacy = getQueryString(route.query, "service");
  const wanted = tab || legacy;
  return wanted && (SERVICES as readonly string[]).includes(wanted)
    ? wanted
    : null;
}

// The services you picked, the level and timestamps come back next visit.
// Follow isn't kept: scrolling flips it, and a page that opens paused reads
// as broken. A deep link still opens on its one service without replacing
// what you picked.
const view = useRememberedView(
  "system-logs",
  {
    services: [...PRESETS.core] as string[],
    level: "all" as LevelFilter,
    timestamps: true,
  },
  {
    validate: {
      level: (value) => (LEVEL_FILTERS as readonly unknown[]).includes(value),
    },
  },
);

const selected = ref<string[]>(
  requestedService()
    ? [requestedService() as string]
    : rememberedServices(view.services),
);
const selectedSet = computed(() => new Set(selected.value));
const podsOff = ref<string[]>([]);
const podsOffSet = computed(() => new Set(podsOff.value));
const level = toRef(view, "level");
const query = ref("");
const debouncedQuery = ref("");
const sigFilter = ref<string | null>(null);
const follow = ref(true);
const showTs = toRef(view, "timestamps");
const maximized = ref(false);
const streamRef = ref<InstanceType<typeof LogStream> | null>(null);

let queryTimer: ReturnType<typeof setTimeout> | undefined;
watch(query, (value) => {
  clearTimeout(queryTimer);
  if (!value.trim()) {
    debouncedQuery.value = "";
    return;
  }
  queryTimer = setTimeout(() => (debouncedQuery.value = value.trim()), 90);
});

function pick(services: string[]) {
  selected.value = services;
  view.services = [...services];
}

watch(
  selected,
  (services) => {
    streams.setServices(services);
    const next = { ...route.query };
    delete next.service;
    if (services.length === 1) next.tab = services[0];
    else delete next.tab;
    if (next.tab !== route.query.tab || route.query.service !== undefined) {
      void router.replace({ query: next });
    }
  },
  { immediate: true },
);

watch(
  () => route.query.tab,
  () => {
    const wanted = requestedService();
    if (
      wanted &&
      !(selected.value.length === 1 && selected.value[0] === wanted)
    ) {
      selected.value = [wanted];
    }
  },
);

const levelOptions = computed(() => [
  { key: "all", label: t("common.all") },
  { key: "warn", label: t("pages.system_logs.warnings") },
  { key: "error", label: t("pages.system_logs.errors") },
]);

const matches = (line: LogLine) =>
  selectedSet.value.has(line.service) &&
  !podsOffSet.value.has(line.pod) &&
  levelMatches(line, level.value) &&
  textMatches(line, debouncedQuery.value) &&
  (!sigFilter.value || signatureOf(line) === sigFilter.value);

const visible = computed(() => lines.value.filter(matches));

const filterKey = computed(() =>
  [
    selected.value.join(","),
    podsOff.value.join(","),
    level.value,
    debouncedQuery.value,
    sigFilter.value || "",
  ].join("\u0000"),
);

// Triage reads on its own slower clock so a busy stream doesn't redraw the
// strip, the counts and the groups on every line.
const clock = ref(Date.now());
let clockTimer: ReturnType<typeof setInterval> | undefined;
watch(lastFlush, () => {
  if (Date.now() - clock.value > 1000) clock.value = Date.now();
});

const scopeLines = computed(() => {
  void clock.value;
  const out: LogLine[] = [];
  for (const service of selected.value) {
    for (const line of streams.serviceLines(service)) {
      if (!podsOffSet.value.has(line.pod)) out.push(line);
    }
  }
  return out;
});

const buckets = computed(() => volumeBuckets(scopeLines.value, clock.value));
const groups = computed(() => groupRepeats(scopeLines.value));

const stats = computed<Record<string, ServiceRowStats>>(() => {
  void clock.value;
  const out: Record<string, ServiceRowStats> = {};
  for (const service of SERVICES) {
    const list = streams.serviceLines(service);
    const counts = countLevels(list);
    out[service] = {
      status: serviceStatus(list, clock.value),
      rate: ratePerMinute(list, clock.value),
      warn: counts.warn,
      error: counts.error,
      spark: sparkBuckets(list, clock.value),
      streaming: list.length > 0,
    };
  }
  return out;
});

const totals = computed(() =>
  selected.value.reduce(
    (acc, s) => ({
      warn: acc.warn + (stats.value[s]?.warn || 0),
      error: acc.error + (stats.value[s]?.error || 0),
    }),
    { warn: 0, error: 0 },
  ),
);

const since = computed(() => {
  let first: number | null = null;
  for (const line of scopeLines.value) {
    if (line.t && (first === null || line.t < first)) first = line.t;
  }
  return first;
});

const liveState = computed<"live" | "waiting" | "reconnecting">(() => {
  if (offline.value) return "reconnecting";
  return selected.value.some((s) => stats.value[s]?.streaming)
    ? "live"
    : "waiting";
});
const liveRate = computed(() =>
  selected.value.reduce((n, s) => n + (stats.value[s]?.rate || 0), 0),
);

const emptyKind = computed(() => {
  if (!selected.value.length) return "no-services" as const;
  if (!scopeLines.value.length && !visible.value.length)
    return "no-logs" as const;
  if (!visible.value.length) return "no-match" as const;
  return null;
});

function toggleService(service: string) {
  pick(
    selectedSet.value.has(service)
      ? selected.value.filter((s) => s !== service)
      : [...selected.value, service],
  );
}
function onlyService(service: string) {
  pick([service]);
}
function applyPreset(key: string) {
  pick([...(PRESETS[key] || PRESETS.core)]);
}
function togglePod(pod: string) {
  podsOff.value = podsOffSet.value.has(pod)
    ? podsOff.value.filter((p) => p !== pod)
    : [...podsOff.value, pod];
}
function showOnlyFromTag(service: string) {
  pick([service]);
  toast({ title: t("pages.system_logs.showing_only", { service }) });
}
function clearFilters() {
  level.value = "all";
  query.value = "";
  debouncedQuery.value = "";
  podsOff.value = [];
  sigFilter.value = null;
}
function searchFor(text: string) {
  query.value = text;
  debouncedQuery.value = text;
}

function jumpTo(bucket: VolumeBucket) {
  const first = visible.value.find(
    (l) => l.t >= bucket.t && l.t < bucket.t + bucket.size,
  );
  if (!first || !streamRef.value?.reveal(first.id)) {
    toast({
      title: t("pages.system_logs.nothing_at", { time: hourMinute(bucket.t) }),
    });
  }
}

const downloadName = computed(() =>
  selected.value.length === 1 ? selected.value[0] : "merged",
);

function downloadVisible() {
  const content = visible.value
    .map((l) => `${l.timestamp} [${l.service}] ${l.pod} ${l.raw}`)
    .join("\n");
  saveBlob(
    new Blob([content], { type: "text/plain" }),
    `${downloadName.value}-logs.txt`,
  );
}

async function downloadFull(service: string) {
  try {
    await downloadFullServiceLogs(config.public.apiDomain as string, service);
  } catch {
    toast({
      title: t("pages.system_logs.download_failed", { service }),
      variant: "destructive",
    });
  }
}

function onKeydown(event: KeyboardEvent) {
  if (
    event.key === "Escape" &&
    maximized.value &&
    !document.querySelector('[role="menu"], [role="dialog"]')
  ) {
    maximized.value = false;
  }
}

watch(maximized, (on) => {
  document.body.classList.toggle("overflow-hidden", on);
});

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  clockTimer = setInterval(() => (clock.value = Date.now()), 3000);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  clearInterval(clockTimer);
  clearTimeout(queryTimer);
  document.body.classList.remove("overflow-hidden");
});
</script>

<template>
  <div>
    <h1 class="sr-only">{{ $t("layouts.app_nav.system.logs") }}</h1>

    <Teleport to="body" :disabled="!maximized">
      <PageTransition>
        <div
          class="grid min-w-0 items-start gap-4 lg:grid-cols-[268px_minmax(0,1fr)] lg:items-stretch lg:gap-0"
          :class="
            maximized &&
            'fixed inset-0 z-50 overflow-y-auto bg-background px-4 py-3.5 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden'
          "
        >
          <LogServiceList
            class="lg:border-r lg:border-border/70 lg:pr-3"
            :class="maximized && 'lg:max-h-full lg:overflow-y-auto'"
            :services="SERVICES"
            :selected="selected"
            :pods="pods"
            :pods-off="podsOff"
            :stats="stats"
            :totals="totals"
            @toggle="toggleService"
            @only="onlyService"
            @preset="applyPreset"
            @toggle-pod="togglePod"
          />

          <section
            class="min-w-0 gap-3 lg:pl-6"
            :class="
              maximized
                ? 'flex flex-col lg:h-full lg:min-h-0'
                : 'grid content-start'
            "
          >
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <AdminSearch
                v-model="query"
                :placeholder="$t('pages.system_logs.filter_lines')"
                shortcut
              />
              <AnimatedFilters v-model="level" square :options="levelOptions" />

              <div class="ml-auto flex items-center gap-3">
                <label
                  class="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Switch v-model="follow" />
                  {{ $t("pages.system_logs.follow") }}
                </label>
                <label
                  class="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Switch v-model="showTs" />
                  {{ $t("pages.system_logs.timestamps") }}
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <button
                      type="button"
                      class="grid h-8 w-8 place-items-center rounded-md border border-border bg-muted/30 text-muted-foreground transition-colors hover:text-foreground"
                      :aria-label="$t('pages.system_logs.download')"
                    >
                      <Download class="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-[240px]">
                    <DropdownMenuItem @select="downloadVisible">
                      <FileDown />
                      <span class="grow">{{
                        $t("ui.logs.download_visible")
                      }}</span>
                      <span
                        class="text-xs tabular-nums text-muted-foreground"
                        >{{ visible.length.toLocaleString() }}</span
                      >
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-for="service in selected"
                      :key="service"
                      @select="downloadFull(service)"
                    >
                      <Download />
                      <span class="grow">{{
                        selected.length > 1
                          ? $t("pages.system_logs.full_logs_of", { service })
                          : $t("ui.logs.download_full")
                      }}</span>
                      <span class="text-xs text-muted-foreground">.zip</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <FiveStackToolTip as-child :delay-duration="120">
                  <template #trigger>
                    <button
                      type="button"
                      class="grid h-8 w-8 place-items-center rounded-md border border-border bg-muted/30 text-muted-foreground transition-colors hover:text-foreground"
                      :aria-label="
                        maximized
                          ? $t('pages.system_logs.exit_full_screen')
                          : $t('pages.system_logs.full_screen')
                      "
                      @click="maximized = !maximized"
                    >
                      <Minimize2 v-if="maximized" class="h-3.5 w-3.5" />
                      <Maximize2 v-else class="h-3.5 w-3.5" />
                    </button>
                  </template>
                  {{
                    maximized
                      ? $t("pages.system_logs.exit_full_screen")
                      : $t("pages.system_logs.full_screen")
                  }}
                </FiveStackToolTip>
              </div>
            </div>

            <LogVolumeStrip :buckets="buckets" @jump="jumpTo" />

            <LogRepeats
              :groups="groups"
              :active="sigFilter"
              @show="sigFilter = $event"
            />

            <LogStream
              ref="streamRef"
              v-model:follow="follow"
              :class="maximized && 'flex-1 lg:min-h-0'"
              :lines="visible"
              :flush="lastFlush"
              :matches="matches"
              :filter-key="filterKey"
              :query="debouncedQuery"
              :show-ts="showTs"
              :since="since"
              :earlier="earlier"
              :live="liveState"
              :rate="liveRate"
              :offline="offline"
              :empty="emptyKind"
              :maximized="maximized"
              @load-earlier="streams.loadEarlier()"
              @tag="showOnlyFromTag"
              @clear-filters="clearFilters"
              @show-core="applyPreset('core')"
              @search="searchFor"
            />
          </section>
        </div>
      </PageTransition>
    </Teleport>
  </div>
</template>
