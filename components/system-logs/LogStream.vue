<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import { computed, nextTick, ref, watch, type Directive } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowDownToLine, Copy, Filter, WifiOff } from "lucide-vue-next";
import { toast } from "~/components/ui/toast";
import StatusDot from "~/components/admin/StatusDot.vue";
import { clockTime, highlight, type LogLine } from "./logLines";
import type { LogFlush } from "~/composables/useSystemLogStreams";

// The one interleaved stream: newest at the bottom, following while the
// reader sits there, holding still the moment they scroll up.
const MAXDOM = 3000;

const props = defineProps<{
  lines: LogLine[];
  flush: LogFlush;
  matches: (line: LogLine) => boolean;
  filterKey: string;
  query: string;
  showTs: boolean;
  since: number | null;
  earlier: "idle" | "loading" | "start";
  live: "live" | "waiting" | "reconnecting";
  rate: number;
  offline: boolean;
  empty: "no-services" | "no-logs" | "no-match" | null;
  maximized: boolean;
}>();

const emit = defineEmits<{
  (e: "load-earlier"): void;
  (e: "tag", service: string): void;
  (e: "clear-filters"): void;
  (e: "show-core"): void;
  (e: "search", text: string): void;
}>();

const follow = defineModel<boolean>("follow", { default: true });

const { t } = useI18n();

const scroller = ref<HTMLElement | null>(null);
const box = ref<HTMLElement | null>(null);
const anchorId = ref<number | null>(null);
const unseen = ref(0);
const openId = ref<number | null>(null);
const animateAfter = ref(Number.POSITIVE_INFINITY);
let programmatic = false;

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const rendered = computed(() => {
  const list = props.lines;
  if (follow.value || anchorId.value == null) {
    return list.length > MAXDOM ? list.slice(-MAXDOM) : list;
  }
  const i = list.findIndex((l) => l.id === anchorId.value);
  if (i < 0) return list.length > MAXDOM ? list.slice(-MAXDOM) : list;
  return list.slice(i, i + MAXDOM * 2);
});

function quietly(fn: () => void) {
  programmatic = true;
  fn();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      programmatic = false;
    }),
  );
}

function toBottom() {
  const el = scroller.value;
  if (!el) return;
  quietly(() => {
    el.scrollTop = el.scrollHeight;
  });
}

function onScroll() {
  if (programmatic) return;
  const el = scroller.value;
  if (!el) return;
  const near = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  if (!near && follow.value) follow.value = false;
  else if (near && !follow.value) follow.value = true;
}

watch(follow, (on) => {
  if (on) {
    unseen.value = 0;
    anchorId.value = null;
    nextTick(toBottom);
  } else {
    anchorId.value = rendered.value[0]?.id ?? null;
  }
});

// Before the new lines are drawn: remember where the reader is when an
// earlier page is about to land above them.
watch(
  () => props.flush,
  (flush) => {
    if (!flush.added.length) return;
    if (flush.added.length > 20) {
      animateAfter.value = flush.added.reduce((m, l) => Math.max(m, l.id), 0);
    }
    if (follow.value) return;
    if (flush.olderOnly) {
      const el = scroller.value;
      anchorId.value = props.lines[0]?.id ?? null;
      if (!el) return;
      const h0 = el.scrollHeight;
      const t0 = el.scrollTop;
      nextTick(() =>
        quietly(() => {
          el.scrollTop = t0 + (el.scrollHeight - h0);
        }),
      );
      return;
    }
    unseen.value += flush.added.filter(props.matches).length;
  },
  { flush: "pre" },
);

watch(
  () => [props.flush, props.lines.length],
  () => {
    if (follow.value) nextTick(toBottom);
  },
  { flush: "post" },
);

watch(
  () => props.filterKey,
  () => {
    animateAfter.value = props.lines.reduce((m, l) => Math.max(m, l.id), 0);
    if (!follow.value) anchorId.value = null;
    unseen.value = 0;
    nextTick(() => {
      if (follow.value) toBottom();
      if (box.value && !reduced() && typeof box.value.animate === "function") {
        box.value.animate(
          [
            { opacity: 0, transform: "translateY(4px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 240, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
        );
      }
    });
  },
);

watch(
  () => props.maximized,
  () => nextTick(() => follow.value && toBottom()),
);

// A line that arrived live fades in; the first paint and a refilter do not.
const vArrive: Directive<HTMLElement, boolean> = {
  mounted(el, binding) {
    if (!binding.value || reduced() || typeof el.animate !== "function") return;
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 200,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    });
  },
};

const vOpen: Directive<HTMLElement> = {
  mounted(el) {
    if (reduced() || typeof el.animate !== "function") return;
    el.animate(
      [
        { opacity: 0, transform: "translateY(-2px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 240, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  },
};

function toggleLine(line: LogLine) {
  if (String(window.getSelection?.() || "").length) return;
  openId.value = openId.value === line.id ? null : line.id;
}

async function copyLine(line: LogLine) {
  try {
    await navigator.clipboard.writeText(line.raw);
    toast({ title: t("pages.system_logs.line_copied") });
  } catch {
    toast({ title: t("pages.database.copy_failed"), variant: "destructive" });
  }
}

// Scroll a line into view, stop following, and flash it once.
function reveal(id: number) {
  if (!props.lines.some((l) => l.id === id)) return false;
  follow.value = false;
  if (!rendered.value.some((l) => l.id === id)) anchorId.value = id;
  nextTick(() => {
    const el = box.value?.querySelector<HTMLElement>(`[data-id="${id}"]`);
    const sc = scroller.value;
    if (!el || !sc) return;
    quietly(() => {
      sc.scrollTop = el.offsetTop - 48;
    });
    if (!reduced() && typeof el.animate === "function") {
      el.animate(
        [
          { backgroundColor: "hsl(33 94% 58% / 0.28)" },
          { backgroundColor: "hsl(33 94% 58% / 0)" },
        ],
        { duration: 1200, easing: "ease-out" },
      );
    }
  });
  return true;
}

defineExpose({ reveal });

const sinceLabel = computed(() =>
  props.since
    ? new Date(props.since).toLocaleString(dateLocale(), {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "",
);

const segments = (text: string) => highlight(text, props.query);

const tagTitles = new Map<string, string>();
const tagTitle = (service: string) => {
  let title = tagTitles.get(service);
  if (!title) {
    title = t("pages.system_logs.show_only", { service });
    tagTitles.set(service, title);
  }
  return title;
};
</script>

<template>
  <div
    class="relative flex min-w-0 flex-col overflow-hidden rounded-[10px] border border-border bg-[hsl(240_6%_4.8%)]"
    :class="maximized && 'min-h-0'"
  >
    <div
      class="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-[7px] text-xs text-muted-foreground"
    >
      <template v-if="since">
        <span>{{ $t("pages.system_logs.since") }}</span>
        <span class="font-mono text-[11.5px] text-foreground">{{
          sinceLabel
        }}</span>
        <span v-if="earlier === 'start'" class="text-muted-foreground/60">{{
          $t("pages.system_logs.start_of_logs")
        }}</span>
        <button
          v-else
          type="button"
          class="text-xs text-muted-foreground underline decoration-muted-foreground/40 underline-offset-[3px] transition-colors hover:text-foreground disabled:pointer-events-none"
          :disabled="earlier === 'loading'"
          @click="emit('load-earlier')"
        >
          {{
            earlier === "loading"
              ? $t("pages.system_logs.loading_earlier")
              : $t("pages.system_logs.load_hour_before")
          }}
        </button>
      </template>
      <span class="ml-auto inline-flex items-center gap-[7px] tabular-nums">
        <!-- The ring only while the tail is following: holding still is
             not live. -->
        <template v-if="live === 'live'">
          <StatusDot tone="ok" :live="follow" />
          {{ $t("pages.system_logs.live_rate", { rate }) }}
        </template>
        <template v-else-if="live === 'reconnecting'">
          <StatusDot tone="warn" />
          {{ $t("pages.system_logs.reconnecting") }}
        </template>
        <template v-else>
          <StatusDot tone="off" />
          {{ $t("pages.system_logs.waiting_for_output") }}
        </template>
      </span>
    </div>

    <div
      v-if="offline"
      class="flex items-center gap-2 border-b border-warning/25 bg-warning/10 px-3 py-2 text-[12.5px] text-warning"
    >
      <WifiOff class="h-3.5 w-3.5 shrink-0" />
      {{ $t("pages.system_logs.connection_lost") }}
    </div>

    <div
      ref="scroller"
      tabindex="0"
      class="lg-scroll overflow-auto overscroll-contain"
      :class="
        maximized
          ? 'min-h-[50vh] flex-1 lg:min-h-0'
          : 'h-[clamp(320px,calc(100vh-300px),900px)]'
      "
      :aria-label="$t('pages.system_logs.log_lines')"
      @scroll.passive="onScroll"
    >
      <div
        ref="box"
        role="log"
        aria-live="off"
        class="pb-10 pt-1 font-mono text-xs leading-[1.55]"
      >
        <div
          v-if="empty"
          class="grid min-h-[260px] place-items-center px-6 py-6 text-center font-sans"
        >
          <div>
            <h3 class="text-[15px] font-semibold">
              {{
                empty === "no-services"
                  ? $t("pages.system_logs.no_services_title")
                  : empty === "no-logs"
                    ? $t("ui.logs.empty")
                    : $t("pages.system_logs.no_match_title")
              }}
            </h3>
            <p
              class="mx-auto mt-1 max-w-[46ch] text-[13px] text-muted-foreground"
            >
              {{
                empty === "no-services"
                  ? $t("pages.system_logs.no_services_hint")
                  : empty === "no-logs"
                    ? $t("ui.logs.empty_hint")
                    : $t("pages.system_logs.no_match_hint")
              }}
            </p>
            <div v-if="empty !== 'no-logs'" class="mt-3.5 flex justify-center">
              <button
                type="button"
                class="inline-flex h-8 items-center rounded-md border border-border bg-muted/30 px-3 text-xs font-medium transition-colors hover:bg-muted"
                @click="
                  empty === 'no-services'
                    ? emit('show-core')
                    : emit('clear-filters')
                "
              >
                {{
                  empty === "no-services"
                    ? $t("pages.system_logs.show_core")
                    : $t("pages.system_logs.clear_filters")
                }}
              </button>
            </div>
          </div>
        </div>

        <template v-else>
          <template v-for="line in rendered" :key="line.id">
            <div
              v-arrive="line.id > animateAfter"
              class="lg-ln"
              :class="[
                `lv-${line.level.toLowerCase()}`,
                openId === line.id && 'is-open',
                line.cont && 'is-cont',
              ]"
              :data-id="line.id"
              @click="toggleLine(line)"
            >
              <span v-if="showTs" class="lg-ts">{{ clockTime(line.t) }}</span>
              <span class="lg-lv">{{ line.cont ? "" : line.level }}</span>
              <button
                type="button"
                class="lg-tag"
                :title="tagTitle(line.service)"
                @click.stop="emit('tag', line.service)"
              >
                {{ line.service }}
              </button>
              <span class="lg-msg"
                ><template v-if="line.ctx"
                  ><span class="lg-ctx"
                    >[<template v-for="(seg, i) in segments(line.ctx)" :key="i"
                      ><mark v-if="seg.hit">{{ seg.text }}</mark
                      ><template v-else>{{ seg.text }}</template></template
                    >]</span
                  >{{ " " }}</template
                ><template v-if="query"
                  ><template v-for="(seg, i) in segments(line.msg)" :key="i"
                    ><mark v-if="seg.hit">{{ seg.text }}</mark
                    ><template v-else>{{ seg.text }}</template></template
                  ></template
                ><template v-else>{{ line.msg }}</template></span
              >
            </div>
            <div v-if="openId === line.id" v-open class="lg-detail font-sans">
              <dl class="lg-meta">
                <dt>{{ $t("pages.system_logs.time") }}</dt>
                <dd class="font-mono">{{ line.timestamp || "—" }}</dd>
                <dt>{{ $t("pages.system_logs.pod") }}</dt>
                <dd class="font-mono">{{ line.pod }}</dd>
                <dt>{{ $t("pages.system_logs.container") }}</dt>
                <dd class="font-mono">{{ line.container || "—" }}</dd>
                <dt>{{ $t("pages.system_logs.node") }}</dt>
                <dd class="font-mono">{{ line.node || "—" }}</dd>
              </dl>
              <pre class="lg-raw">{{ line.raw }}</pre>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 text-xs transition-colors hover:bg-muted"
                  @click.stop="copyLine(line)"
                >
                  <Copy class="h-3 w-3" />
                  {{ $t("pages.system_logs.copy_line") }}
                </button>
                <button
                  v-if="line.ctx"
                  type="button"
                  class="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 text-xs transition-colors hover:bg-muted"
                  @click.stop="emit('search', line.ctx)"
                >
                  <Filter class="h-3 w-3" />
                  {{
                    $t("pages.system_logs.only_context", { context: line.ctx })
                  }}
                </button>
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>

    <button
      type="button"
      class="lg-jump"
      :data-show="!follow && !empty ? '' : undefined"
      :tabindex="!follow && !empty ? 0 : -1"
      @click="follow = true"
    >
      <ArrowDownToLine class="h-3.5 w-3.5" />
      {{ $t("pages.system_logs.jump_to_live") }}
      <span v-if="unseen" class="font-medium text-[hsl(var(--tac-amber)/0.75)]">
        ·
        {{ $t("pages.system_logs.n_new", { count: unseen.toLocaleString() }) }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.lg-scroll {
  scrollbar-width: thin;
  scrollbar-color: #2a2a30 transparent;
}
.lg-ln {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 1px 12px 1px 10px;
  border-left: 2px solid transparent;
}
.lg-ln:hover {
  background: hsl(240 4% 9%);
}
.lg-ln.is-open {
  background: hsl(240 4% 10%);
}
.lg-ts {
  flex: none;
  width: 88px;
  color: hsl(var(--muted-foreground) / 0.7);
  font-variant-numeric: tabular-nums;
  user-select: none;
}
.lg-lv {
  flex: none;
  width: 40px;
  font-size: 10.5px;
  font-weight: 700;
  color: hsl(var(--muted-foreground) / 0.7);
  letter-spacing: 0.02em;
}
.lg-tag {
  flex: none;
  width: 112px;
  height: 17px;
  padding: 0 6px;
  border-radius: 4px;
  background: hsl(240 4% 11%);
  color: hsl(var(--muted-foreground));
  font: inherit;
  font-size: 10.5px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}
.lg-tag:hover {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}
.lg-msg {
  flex: 1;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: hsl(0 0% 86%);
}
.lg-ctx {
  color: hsl(var(--muted-foreground));
  font-weight: 600;
}
.lg-msg mark {
  background: hsl(var(--tac-amber) / 0.25);
  color: hsl(var(--foreground));
  border-radius: 2px;
}
.lv-debug .lg-msg {
  color: hsl(var(--muted-foreground));
}
.lv-warn {
  background: hsl(var(--warning) / 0.045);
}
.lv-warn .lg-lv {
  color: hsl(var(--warning));
}
.lv-error {
  background: hsl(0 82% 62% / 0.07);
  border-left-color: hsl(0 82% 62% / 0.7);
}
.lv-error .lg-lv {
  color: hsl(var(--destructive));
}
.lv-error .lg-msg {
  color: hsl(0 90% 88%);
}
.lg-detail {
  display: grid;
  gap: 10px;
  margin: 2px 12px 8px;
  padding: 10px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(240 6% 7%);
}
.lg-meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 3px 14px;
  margin: 0;
  font-size: 12px;
}
.lg-meta dt {
  color: hsl(var(--muted-foreground));
}
.lg-meta dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 11.5px;
}
.lg-raw {
  margin: 0;
  max-height: 160px;
  overflow: auto;
  padding: 8px 10px;
  border-radius: 6px;
  background: hsl(240 6% 4%);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: hsl(var(--muted-foreground));
}
.lg-jump {
  position: absolute;
  left: 50%;
  bottom: 12px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid hsl(var(--tac-amber) / 0.5);
  border-radius: 6px;
  background: hsl(33 40% 12% / 0.95);
  color: hsl(var(--tac-amber));
  font-size: 12.5px;
  font-weight: 600;
  translate: -50% 6px;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 110ms ease-in,
    translate 110ms ease-in,
    background-color 150ms ease;
}
.lg-jump[data-show] {
  translate: -50% 0;
  opacity: 1;
  pointer-events: auto;
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    translate 240ms cubic-bezier(0.16, 1, 0.3, 1),
    background-color 150ms ease;
}
.lg-jump:hover {
  background: hsl(33 50% 16%);
}
/* Phones: time · level · service on one small line, the message full width
   under it. A continuation carries straight on from the line above. */
@media (max-width: 639px) {
  .lg-ln {
    flex-wrap: wrap;
    gap: 0;
    padding-block: 3px;
  }
  .lg-ln.is-cont {
    padding-top: 0;
  }
  .lg-ts,
  .lg-lv,
  .lg-tag {
    width: auto;
    font-size: 10.5px;
    line-height: 1.5;
  }
  .lg-ts::after,
  .lg-lv::after {
    content: "·";
    margin: 0 6px;
    color: hsl(var(--muted-foreground) / 0.5);
    font-weight: 400;
  }
  .lg-tag {
    min-width: 0;
    max-width: 60%;
    height: auto;
    padding: 0;
    background: none;
  }
  .lg-tag:hover {
    background: none;
  }
  .lg-msg {
    flex: 1 1 100%;
  }
  .lg-ln.is-cont .lg-ts,
  .lg-ln.is-cont .lg-lv,
  .lg-ln.is-cont .lg-tag {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lg-jump,
  .lg-jump[data-show] {
    transition: none;
  }
}
</style>
