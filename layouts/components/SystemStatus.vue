<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Globe, RefreshCw, Star } from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useAuthStore } from "~/stores/AuthStore";

type Tone = "ok" | "warn" | "bad";

const { t } = useI18n();
const matchmaking = useMatchmakingStore();
const settings = useApplicationSettingsStore();
const authStore = useAuthStore();

const toneText: Record<Tone, string> = {
  ok: "text-green-500",
  warn: "text-yellow-500",
  bad: "text-red-500",
};

const statusTone = (status: string): Tone =>
  status === "Online" ? "ok" : status === "Offline" ? "bad" : "warn";

// Guests never run the latency probe, so they get status only.
const canMeasure = computed(() => !!authStore.me?.steam_id);
const maxLatency = computed(() => matchmaking.playerMaxAcceptableLatency);

const regions = computed(() =>
  settings.availableRegions.map((region) => {
    const result = matchmaking.getRegionlatencyResult(region.value);
    return {
      ...region,
      tone: statusTone(region.status),
      latency: result ? Math.round(Number(result.latency)) : undefined,
      measuring: matchmaking.getRegionProbeState(region.value) === "measuring",
      starred: matchmaking.storedRegions.includes(region.value),
      matchmade: matchmaking.preferredRegions.some(
        ({ value }) => value === region.value,
      ),
    };
  }),
);

const sortedRegions = computed(() =>
  [...regions.value].sort(
    (a, b) =>
      Number(a.status === "Offline") - Number(b.status === "Offline") ||
      (a.latency ?? Infinity) - (b.latency ?? Infinity),
  ),
);

const onlineCount = computed(
  () => regions.value.filter(({ status }) => status === "Online").length,
);
const offlineCount = computed(
  () => regions.value.filter(({ status }) => status === "Offline").length,
);

const overallTone = computed<Tone>(() => {
  if (onlineCount.value === regions.value.length) {
    return "ok";
  }
  return offlineCount.value === regions.value.length ? "bad" : "warn";
});

const statusLabel = computed(() =>
  overallTone.value === "ok"
    ? t("common.online")
    : overallTone.value === "bad"
      ? t("common.offline")
      : t("common.degraded"),
);

// The tick sits mid-track, so the bar reads as "under / over your max".
const barWidth = (latency: number) =>
  `${Math.min(latency / (maxLatency.value * 2), 1) * 100}%`;

const tagClasses =
  "rounded-sm border px-1 py-0.5 font-sans text-[0.54rem] font-bold uppercase leading-none tracking-[0.14em]";
const wordClasses =
  "font-sans text-[0.6rem] font-bold uppercase tracking-[0.16em]";
</script>

<template>
  <Popover v-if="regions.length">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150 focus-visible:bg-[hsl(var(--tac-amber)/0.08)] focus-visible:outline-none data-[state=open]:bg-[hsl(var(--tac-amber)/0.1)]"
        :aria-label="statusLabel"
      >
        <Globe class="h-4 w-4" :class="toneText[overallTone]" />
      </button>
    </PopoverTrigger>

    <PopoverContent
      align="start"
      :side-offset="6"
      class="relative w-[312px] max-w-[calc(100vw-1rem)] overflow-hidden border-topnav-border bg-[linear-gradient(180deg,hsl(var(--topnav-background)/0.98)_0%,hsl(var(--topnav-background)/0.94)_100%)] p-0 shadow-[inset_0_1px_0_hsl(var(--tac-amber)/0.12),0_20px_40px_-12px_hsl(0_0%_0%/0.55)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,hsl(var(--tac-amber)/0.5),transparent)]"
    >
      <div
        class="flex items-center gap-2 px-3 pb-2 pt-2.5 font-sans text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--topnav-foreground)/0.5)]"
      >
        <span
          class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
        ></span>
        <template v-if="canMeasure">
          {{ $t("layouts.system_status.ping_by_region") }}
          <span class="ml-auto tracking-[0.12em] tabular-nums">
            {{ $t("layouts.system_status.max_latency", { ms: maxLatency }) }}
          </span>
        </template>
        <template v-else>
          {{ $t("layouts.system_status.regions") }}
          <span class="ml-auto tracking-[0.12em] tabular-nums">
            {{
              $t("layouts.system_status.online_count", {
                online: onlineCount,
                total: regions.length,
              })
            }}
          </span>
        </template>
      </div>

      <ul>
        <li
          v-for="region in sortedRegions"
          :key="region.value"
          class="grid gap-[7px] border-t border-[hsl(var(--topnav-foreground)/0.06)] px-3 pb-[11px] pt-[9px]"
        >
          <div class="flex items-center gap-2">
            <span
              class="flex min-w-0 items-center gap-1.5 font-sans text-[0.8rem] font-semibold tracking-[0.04em]"
              :class="
                region.status === 'Offline' || (canMeasure && !region.matchmade)
                  ? 'text-[hsl(var(--topnav-foreground)/0.55)]'
                  : 'text-[hsl(var(--topnav-foreground)/0.92)]'
              "
            >
              <Star
                v-if="canMeasure && region.starred"
                class="h-2.5 w-2.5 shrink-0 fill-current text-[hsl(var(--tac-amber))]"
                :aria-label="$t('layouts.system_status.preferred')"
              />
              <span class="truncate">
                {{ region.description || region.value }}
              </span>
              <span
                v-if="region.is_lan"
                :class="[
                  tagClasses,
                  'border-[hsl(var(--topnav-foreground)/0.2)] text-[hsl(var(--topnav-foreground)/0.6)]',
                ]"
              >
                LAN
              </span>
              <span
                v-if="canMeasure && region.tone === 'warn'"
                :class="[tagClasses, 'border-yellow-500/45 text-yellow-500']"
              >
                {{ $t("layouts.system_status.partial") }}
              </span>
            </span>

            <span
              class="ml-auto whitespace-nowrap font-sans text-[0.74rem] font-semibold tabular-nums"
              :class="
                !region.matchmade || region.measuring
                  ? 'text-[hsl(var(--topnav-foreground)/0.5)]'
                  : 'text-[hsl(var(--topnav-foreground)/0.88)]'
              "
            >
              <span
                v-if="!canMeasure || region.status === 'Offline'"
                :class="[wordClasses, toneText[region.tone]]"
              >
                {{
                  region.tone === "ok"
                    ? $t("common.online")
                    : region.tone === "bad"
                      ? $t("common.offline")
                      : $t("layouts.system_status.partial")
                }}
              </span>
              <span
                v-else-if="region.latency === undefined"
                :class="[
                  wordClasses,
                  'text-[hsl(var(--topnav-foreground)/0.42)]',
                ]"
              >
                {{
                  region.measuring
                    ? $t("latency_status.measuring")
                    : $t("latency_status.unreachable")
                }}
              </span>
              <template v-else>{{ region.latency }} ms</template>
            </span>
          </div>

          <div
            v-if="
              canMeasure &&
              region.status !== 'Offline' &&
              region.latency !== undefined
            "
            class="relative h-1 rounded-[2px] bg-[hsl(var(--topnav-foreground)/0.08)] transition-opacity duration-200"
            :class="{ 'opacity-40': region.measuring }"
          >
            <span
              class="absolute inset-y-0 left-0 rounded-[2px] transition-[width] duration-300"
              :class="
                region.matchmade
                  ? 'bg-green-500/85'
                  : 'bg-[hsl(var(--topnav-foreground)/0.3)]'
              "
              :style="{ width: barWidth(region.latency) }"
            ></span>
            <span
              class="absolute -inset-y-[3px] left-1/2 w-px bg-[hsl(var(--topnav-foreground)/0.45)]"
            ></span>
          </div>
        </li>
      </ul>

      <div
        class="flex items-center gap-2.5 border-t border-[hsl(var(--topnav-foreground)/0.08)] px-3 py-2 text-[0.76rem] leading-snug text-[hsl(var(--topnav-foreground)/0.52)]"
      >
        <span>
          {{
            !canMeasure
              ? $t("layouts.system_status.sign_in")
              : matchmaking.storedRegions.length
                ? $t("layouts.system_status.uses_starred")
                : $t("layouts.system_status.skips_over", { ms: maxLatency })
          }}
        </span>
        <Button
          v-if="canMeasure"
          variant="outline"
          size="xs"
          class="ml-auto shrink-0"
          :loading="matchmaking.isRefreshing"
          @click="matchmaking.refreshLatencies()"
        >
          <RefreshCw class="h-3.5 w-3.5" />
          {{ $t("common.refresh") }}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
