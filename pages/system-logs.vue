<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Download,
  FileDown,
  Maximize2,
  Minimize2,
  Search,
} from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
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
import {
  PRESETS,
  SERVICES,
  countLevels,
  groupRepeats,
  hourMinute,
  levelMatches,
  ratePerMinute,
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

const selected = ref<string[]>(
  requestedService() ? [requestedService() as string] : [...PRESETS.core],
);
const selectedSet = computed(() => new Set(selected.value));
const podsOff = ref<string[]>([]);
const podsOffSet = computed(() => new Set(podsOff.value));
const level = ref<LevelFilter>("all");
const query = ref("");
const debouncedQuery = ref("");
const sigFilter = ref<string | null>(null);
const follow = ref(true);
const showTs = ref(true);
const maximized = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);
const streamRef = ref<InstanceType<typeof LogStream> | null>(null);

let queryTimer: ReturnType<typeof setTimeout> | undefined;
watch(query, (value) => {
  clearTimeout(queryTimer);
  queryTimer = setTimeout(() => (debouncedQuery.value = value.trim()), 90);
});

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
  selected.value = selectedSet.value.has(service)
    ? selected.value.filter((s) => s !== service)
    : [...selected.value, service];
}
function onlyService(service: string) {
  selected.value = [service];
}
function applyPreset(key: string) {
  selected.value = [...(PRESETS[key] || PRESETS.core)];
}
function togglePod(pod: string) {
  podsOff.value = podsOffSet.value.has(pod)
    ? podsOff.value.filter((p) => p !== pod)
    : [...podsOff.value, pod];
}
function showOnlyFromTag(service: string) {
  selected.value = [service];
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
  const target = event.target as HTMLElement | null;
  const typing = !!target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
  if (event.key === "/" && !typing && !target?.isContentEditable) {
    event.preventDefault();
    searchInput.value?.focus();
    searchInput.value?.select();
    return;
  }
  if (
    event.key === "Escape" &&
    maximized.value &&
    !document.querySelector('[role="menu"], [role="dialog"]')
  ) {
    maximized.value = false;
  }
}

function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && query.value) {
    event.stopPropagation();
    query.value = "";
    debouncedQuery.value = "";
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
            <label class="relative block w-full sm:w-[300px]">
              <Search
                class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70"
              />
              <input
                ref="searchInput"
                v-model="query"
                type="text"
                autocomplete="off"
                spellcheck="false"
                class="h-8 w-full rounded-md border border-border bg-[hsl(240_6%_6%)] pl-8 pr-8 text-[13px] outline-none placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
                :placeholder="$t('pages.system_logs.filter_lines')"
                :aria-label="$t('pages.system_logs.filter_lines')"
                @keydown="onSearchKeydown"
              />
              <span
                class="pointer-events-none absolute right-2 top-1/2 inline-grid h-[18px] min-w-[18px] -translate-y-1/2 place-items-center rounded border border-border px-1 font-mono text-[10.5px] text-muted-foreground"
                aria-hidden="true"
                >/</span
              >
            </label>
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
                    <span class="text-xs tabular-nums text-muted-foreground">{{
                      visible.length.toLocaleString()
                    }}</span>
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
    </Teleport>
  </div>
</template>
