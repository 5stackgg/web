<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { CircleAlert, Info, TriangleAlert } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { TONE_TEXT } from "~/components/admin/tone";
import {
  groupSignals,
  type AreaKey,
  type Severity,
  type Signal,
} from "~/components/admin-home/adminSignals";

// Everything that needs an admin, worst first: one row per kind of problem,
// naming the first few things it hits, with the way to fix it on the right.
// Past eight rows the list gathers under area headings.
const props = defineProps<{
  signals: Signal[];
  areaLabel: (area: AreaKey) => string;
}>();

const emit = defineEmits<{ (e: "action", signal: Signal): void }>();

const { t } = useI18n();

type Entry =
  | { kind: "head"; key: string; area: AreaKey; divided: boolean }
  | { kind: "row"; key: string; signal: Signal; divided: boolean };

const groups = computed(() => groupSignals(props.signals));
const grouped = computed(() => groups.value.some((group) => group.area));

const entries = computed<Entry[]>(() => {
  const out: Entry[] = [];
  for (const group of groups.value) {
    if (group.area) {
      out.push({
        kind: "head",
        key: `head:${group.area}`,
        area: group.area,
        divided: out.length > 0,
      });
    }
    for (const signal of group.signals) {
      const previous = out[out.length - 1];
      out.push({
        kind: "row",
        key: signal.key,
        signal,
        divided: !!previous && previous.kind === "row",
      });
    }
  }
  return out;
});

const ICON = { danger: CircleAlert, warning: TriangleAlert, notice: Info };
const TONE: Record<Severity, string> = {
  danger: TONE_TEXT.bad,
  warning: TONE_TEXT.warn,
  notice: TONE_TEXT.info,
};
const WORD: Record<Severity, string> = {
  danger: "system_alerts.types.critical",
  warning: "system_alerts.types.warning",
  notice: "system_alerts.types.info",
};

const message = (signal: Signal) =>
  t(signal.message, { count: signal.count, ...signal.params }, signal.count);

// The app's fold idiom (grid rows 1fr <-> 0fr), per row: a problem that
// clears folds out, a new one folds in where it belongs.
const rowEnter =
  "transition-[grid-template-rows,opacity] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";
const rowLeave =
  "transition-[grid-template-rows,opacity] [transition-duration:110ms] ease-in motion-reduce:transition-none";
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border bg-card/20">
    <TransitionGroup
      :enter-active-class="rowEnter"
      :leave-active-class="rowLeave"
      enter-from-class="!grid-rows-[0fr] opacity-0"
      leave-to-class="!grid-rows-[0fr] opacity-0"
    >
      <div
        v-for="entry in entries"
        :key="entry.key"
        class="grid grid-rows-[1fr]"
      >
        <div class="min-h-0 overflow-hidden">
          <div
            v-if="entry.kind === 'head'"
            class="px-3.5 pb-1 pt-3 text-xs font-medium text-muted-foreground"
            :class="entry.divided && 'border-t border-border/60'"
          >
            {{ areaLabel(entry.area) }}
          </div>

          <div
            v-else
            class="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-3.5 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
            :class="entry.divided && 'border-t border-border/60'"
          >
            <component
              :is="ICON[entry.signal.severity]"
              class="mt-0.5 size-4 shrink-0"
              :class="TONE[entry.signal.severity]"
              aria-hidden="true"
            />

            <div class="min-w-0">
              <p class="text-[13.5px] leading-snug [overflow-wrap:anywhere]">
                <span class="sr-only"
                  >{{ $t(WORD[entry.signal.severity]) }}:
                </span>
                {{ message(entry.signal) }}
              </p>
              <p
                v-if="entry.signal.subjects.length"
                class="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground"
              >
                <template
                  v-for="(subject, index) in entry.signal.subjects"
                  :key="subject.id"
                >
                  <span v-if="index" aria-hidden="true">·</span>
                  <NuxtLink
                    v-if="subject.to"
                    :to="subject.to"
                    class="inline-flex min-w-0 max-w-[16rem] items-baseline gap-1 underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline"
                  >
                    <span class="truncate">{{ subject.label }}</span>
                    <span
                      v-if="subject.detail"
                      class="shrink-0 tabular-nums text-muted-foreground/70"
                      >{{ subject.detail }}</span
                    >
                  </NuxtLink>
                  <span
                    v-else
                    class="inline-flex min-w-0 max-w-[16rem] items-baseline gap-1"
                  >
                    <span class="truncate">{{ subject.label }}</span>
                    <span
                      v-if="subject.detail"
                      class="shrink-0 tabular-nums text-muted-foreground/70"
                      >{{ subject.detail }}</span
                    >
                  </span>
                </template>
                <template v-if="entry.signal.more">
                  <span aria-hidden="true">·</span>
                  <span class="tabular-nums">{{
                    $t(
                      "pages.admin_home.more",
                      { count: entry.signal.more },
                      entry.signal.more,
                    )
                  }}</span>
                </template>
              </p>
              <p
                v-if="!grouped"
                class="mt-1 text-[11px] text-muted-foreground/70 sm:hidden"
              >
                {{ areaLabel(entry.signal.area) }}
              </p>
            </div>

            <!-- Under the sentence on phones, on the right from sm up. -->
            <div
              class="col-start-2 flex items-center gap-3 sm:col-start-auto sm:self-center"
            >
              <span
                v-if="!grouped"
                class="hidden whitespace-nowrap text-[11px] text-muted-foreground sm:inline"
              >
                {{ areaLabel(entry.signal.area) }}
              </span>
              <Button
                v-if="entry.signal.action === 'steam_accounts'"
                variant="outline"
                size="sm"
                @click="emit('action', entry.signal)"
              >
                {{ $t("pages.admin_home.add_steam_account") }}
              </Button>
              <Button v-else as-child variant="outline" size="sm">
                <NuxtLink
                  :to="entry.signal.to"
                  :aria-label="
                    $t('pages.admin_home.open_area', {
                      area: areaLabel(entry.signal.area),
                    })
                  "
                >
                  {{ $t("pages.admin_home.open") }}
                </NuxtLink>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>
