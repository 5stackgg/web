<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Check, ChevronRight, ListChecks } from "lucide-vue-next";
import { Fold } from "~/components/ui/transitions";
import StatusDot from "~/components/admin/StatusDot.vue";
import { TONE_TEXT, type Tone } from "~/components/admin/tone";
import { useListKeyboard } from "~/composables/useListKeyboard";
import type { ServiceRowStats, ServiceStatus } from "./logLines";

const props = defineProps<{
  services: readonly string[];
  selected: string[];
  pods: Record<string, string[]>;
  podsOff: string[];
  stats: Record<string, ServiceRowStats>;
  totals: { warn: number; error: number };
}>();

const emit = defineEmits<{
  (e: "toggle", service: string): void;
  (e: "only", service: string): void;
  (e: "preset", key: string): void;
  (e: "toggle-pod", pod: string): void;
}>();

const presets = [
  ["core", "pages.system_logs.preset_core"],
  ["match", "pages.system_logs.preset_match"],
  ["media", "pages.system_logs.preset_media"],
  ["all", "pages.system_logs.preset_all"],
] as const;

const openPods = ref(new Set<string>());
function togglePods(service: string) {
  const next = new Set(openPods.value);
  next.has(service) ? next.delete(service) : next.add(service);
  openPods.value = next;
}

function sparkPath(values: number[], w = 44, h = 16) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  return values
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(h - 1 - (v / max) * (h - 2)).toFixed(1)}`,
    )
    .join(" ");
}

const dotTone: Record<ServiceStatus, Tone> = {
  ok: "ok",
  warn: "warn",
  bad: "bad",
  off: "off",
};
const statusKey: Record<ServiceStatus, string> = {
  ok: "pages.system_logs.status_ok",
  warn: "pages.system_logs.status_warn",
  bad: "pages.system_logs.status_bad",
  off: "pages.system_logs.status_off",
};

// Below lg the list folds behind a Services button so the stream isn't
// pushed below ten rows; the presets stay out.
const wideQuery =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(min-width: 1024px)")
    : null;
const wide = ref(wideQuery?.matches ?? true);
const open = ref(false);
const onWide = (event: MediaQueryListEvent) => (wide.value = event.matches);
onMounted(() => wideQuery?.addEventListener("change", onWide));
onBeforeUnmount(() => wideQuery?.removeEventListener("change", onWide));

// ↑/↓ move between services, Space or Enter toggles the focused one.
const list = ref<HTMLElement | null>(null);
const activeId = ref<string | null>(null);
const keyboard = useListKeyboard({
  items: () => props.services,
  getId: (service) => service,
  activeId,
  container: list,
  onOpen: (service) => emit("toggle", service),
});
function pickProps(service: string) {
  const { "aria-selected": _selected, ...rest } = keyboard.rowProps(service);
  return rest;
}
function onListFocusOut(event: FocusEvent) {
  if (!list.value?.contains(event.relatedTarget as Node | null)) {
    activeId.value = null;
  }
}
</script>

<template>
  <aside
    class="grid min-w-0 content-start gap-2"
    :aria-label="$t('pages.system_logs.services')"
  >
    <div class="flex items-center gap-2">
      <div
        v-if="wide"
        class="inline-flex grow items-center gap-2 font-sans text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground"
      >
        <span
          class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
        />
        {{ $t("pages.system_logs.services") }}
      </div>
      <button
        v-else
        type="button"
        class="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
        :aria-expanded="open"
        @click="open = !open"
      >
        <ListChecks class="size-3.5" />
        {{ $t("pages.system_logs.services") }}
        <span class="tabular-nums"
          >· {{ selected.length }}/{{ services.length }}</span
        >
      </button>
      <span class="inline-flex gap-[3px]" :class="!wide && 'ml-auto'">
        <span
          v-if="totals.warn"
          :class="['lg-pill is-warn', TONE_TEXT.warn]"
          :title="
            $t(
              'pages.system_logs.warnings_loaded',
              { count: totals.warn },
              totals.warn,
            )
          "
          >W {{ totals.warn.toLocaleString() }}</span
        >
        <span
          v-if="totals.error"
          class="lg-pill is-error"
          :title="
            $t(
              'pages.system_logs.errors_loaded',
              { count: totals.error },
              totals.error,
            )
          "
          >E {{ totals.error.toLocaleString() }}</span
        >
      </span>
    </div>

    <div class="flex flex-wrap gap-1">
      <button
        v-for="[key, label] in presets"
        :key="key"
        type="button"
        class="inline-flex h-7 items-center rounded-md border border-border bg-muted/30 px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        @click="emit('preset', key)"
      >
        {{ $t(label) }}
      </button>
    </div>

    <Fold :open="wide || open">
      <div ref="list" class="lg-list grid gap-px" @focusout="onListFocusOut">
        <template v-for="service in services" :key="service">
          <div class="lg-row group/row flex items-center gap-0.5 rounded-md">
            <button
              v-bind="pickProps(service)"
              type="button"
              role="checkbox"
              class="lg-pick"
              :aria-checked="selected.includes(service)"
              @click="emit('toggle', service)"
            >
              <span class="lg-cb"><Check class="h-3 w-3" /></span>
              <StatusDot
                :tone="dotTone[stats[service]?.status || 'off']"
                :label="$t(statusKey[stats[service]?.status || 'off'])"
              />
              <span class="grid min-w-0 leading-tight">
                <b class="truncate text-[13px]">{{ service }}</b>
                <span
                  v-if="selected.includes(service)"
                  class="flex min-w-0 items-center gap-1.5 whitespace-nowrap"
                >
                  <small
                    class="min-w-0 truncate text-[11px] tabular-nums text-muted-foreground/70"
                  >
                    <template v-if="stats[service]?.streaming">
                      <template v-if="(pods[service]?.length || 0) > 1"
                        >{{
                          $t("pages.system_logs.pod_count", {
                            count: pods[service].length,
                          })
                        }}
                        ·
                      </template>
                      {{
                        $t("pages.system_logs.per_minute", {
                          rate: stats[service].rate,
                        })
                      }}
                    </template>
                    <template v-else>{{ $t("ui.logs.empty") }}</template>
                  </small>
                  <span class="inline-flex gap-[3px]">
                    <span
                      v-if="stats[service]?.warn"
                      :class="['lg-pill is-warn', TONE_TEXT.warn]"
                      :title="
                        $t(
                          'pages.system_logs.warnings_loaded',
                          { count: stats[service].warn },
                          stats[service].warn,
                        )
                      "
                      >W {{ stats[service].warn.toLocaleString() }}</span
                    >
                    <span
                      v-if="stats[service]?.error"
                      class="lg-pill is-error"
                      :title="
                        $t(
                          'pages.system_logs.errors_loaded',
                          { count: stats[service].error },
                          stats[service].error,
                        )
                      "
                      >E {{ stats[service].error.toLocaleString() }}</span
                    >
                  </span>
                </span>
              </span>
              <svg
                v-if="stats[service]?.streaming"
                class="lg-spark"
                width="44"
                height="16"
                viewBox="0 0 44 16"
                aria-hidden="true"
              >
                <polyline
                  :points="sparkPath(stats[service].spark)"
                  fill="none"
                  stroke-width="1.25"
                  stroke-linejoin="round"
                  :stroke="
                    stats[service].status === 'bad'
                      ? 'hsl(var(--destructive))'
                      : 'hsl(var(--info))'
                  "
                />
              </svg>
              <span v-else />
            </button>
            <button
              v-if="(pods[service]?.length || 0) > 1"
              type="button"
              class="lg-podfold grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              :aria-expanded="openPods.has(service)"
              :aria-label="$t('pages.system_logs.pods_of', { service })"
              @click="togglePods(service)"
            >
              <ChevronRight
                class="lg-chev h-3 w-3"
                :class="openPods.has(service) && 'rotate-90'"
              />
            </button>
            <button
              type="button"
              class="lg-only h-7 rounded-md px-2 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100"
              @click="emit('only', service)"
            >
              {{ $t("pages.system_logs.only") }}
            </button>
          </div>
          <Fold
            v-if="(pods[service]?.length || 0) > 1"
            :open="openPods.has(service)"
          >
            <div class="grid gap-px pb-1.5 pl-8">
              <button
                v-for="pod in pods[service]"
                :key="pod"
                type="button"
                role="checkbox"
                class="lg-pod"
                :aria-checked="!podsOff.includes(pod)"
                @click="emit('toggle-pod', pod)"
              >
                <span class="lg-cb is-small"
                  ><Check class="h-2.5 w-2.5"
                /></span>
                <span class="truncate font-mono">{{ pod }}</span>
              </button>
            </div>
          </Fold>
        </template>
      </div>
    </Fold>
  </aside>
</template>

<style scoped>
.lg-row {
  transition: background-color 120ms ease;
}
.lg-row:hover {
  background: hsl(240 4% 9%);
}
.lg-pick {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 8px;
  border-radius: 6px;
  text-align: left;
}
.lg-pick[aria-checked="false"] b {
  color: hsl(var(--muted-foreground));
  font-weight: 500;
}
.lg-cb {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid hsl(240 4% 30%);
  color: transparent;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}
.lg-cb.is-small {
  width: 14px;
  height: 14px;
}
[aria-checked="true"] > .lg-cb {
  background: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber));
  color: hsl(var(--tac-amber-foreground));
}
.lg-pod {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border-radius: 5px;
  font-size: 11.5px;
  color: hsl(var(--muted-foreground));
  text-align: left;
}
.lg-pod:hover {
  background: hsl(240 4% 9%);
  color: hsl(var(--foreground));
}
.lg-pill {
  display: inline-flex;
  align-items: center;
  height: 17px;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.lg-pill.is-warn {
  background: hsl(var(--warning) / 0.14);
}
.lg-pill.is-error {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 0.14);
}
.lg-pick:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 1px hsl(var(--ring));
}
.lg-chev {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
@media (max-width: 1023px) {
  .lg-list {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 4px;
  }
  .lg-spark,
  .lg-only,
  .lg-podfold {
    display: none;
  }
  .lg-pick {
    border: 1px solid hsl(var(--border) / 0.6);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lg-chev {
    transition: none;
  }
}
</style>
