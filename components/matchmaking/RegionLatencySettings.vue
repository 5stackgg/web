<script setup lang="ts">
import { computed, useId } from "vue";
import { roundedPing } from "~/components/play/matchmakingHero";
import { RefreshCw, Star } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { FormSection } from "~/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

const matchmaking = useMatchmakingStore();
const settings = useApplicationSettingsStore();
const sliderId = useId();

const maxLatency = computed(() => matchmaking.playerMaxAcceptableLatency);
const sliderMax = computed(() => Number(settings.maxAcceptableLatency) || 100);

const regions = computed(() =>
  settings.availableRegions
    .filter((region) => matchmaking.isMatchmakingRegion(region))
    .map((region) => {
      const result = matchmaking.getRegionlatencyResult(region.value);
      return {
        ...region,
        latency: roundedPing(result?.latency) ?? undefined,
        measuring:
          matchmaking.getRegionProbeState(region.value) === "measuring",
        starred: matchmaking.storedRegions.includes(region.value),
        matchmade: matchmaking.preferredRegions.some(
          ({ value }) => value === region.value,
        ),
      };
    })
    .sort(
      (a, b) =>
        Number(a.status === "Offline") - Number(b.status === "Offline") ||
        (a.latency ?? Infinity) - (b.latency ?? Infinity),
    ),
);

// Bars share the slider's scale, so the tick tracks the thumb as you drag.
const toPercent = (latency: number) =>
  `${Math.min(latency / sliderMax.value, 1) * 100}%`;

function onLatencyInput(event: Event) {
  matchmaking.updateMaxAcceptableLatency(
    Number((event.target as HTMLInputElement).value),
  );
}

const tagClasses =
  "rounded-sm border px-1 py-0.5 font-sans text-[0.54rem] font-bold uppercase leading-none tracking-[0.14em]";
const wordClasses =
  "font-sans text-[0.6rem] font-bold uppercase tracking-[0.16em]";
</script>

<template>
  <div class="space-y-4">
    <FormSection
      v-if="regions.length"
      :title="$t('layouts.system_status.ping_by_region')"
    >
      <template #actions>
        <!-- Popovers auto-focus this button on open; only keyboard focus should pop the tooltip. -->
        <Tooltip ignore-non-keyboard-focus>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="-my-1.5 size-6 text-muted-foreground"
              :aria-label="$t('common.refresh')"
              @click="matchmaking.refreshLatencies()"
            >
              <RefreshCw
                class="size-3.5"
                :class="{
                  'animate-spin-smooth motion-reduce:animate-none':
                    matchmaking.isRefreshing,
                }"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ $t("common.refresh") }}</TooltipContent>
        </Tooltip>
      </template>

      <ul class="-mt-1.5">
        <li
          v-for="region in regions"
          :key="region.value"
          class="grid gap-[7px] border-t border-border/60 py-2.5 first:border-t-0"
        >
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="-m-1 shrink-0 rounded-md p-1 transition-colors hover:bg-[hsl(var(--tac-amber)/0.1)] focus-visible:bg-[hsl(var(--tac-amber)/0.1)] focus-visible:outline-none"
              :aria-pressed="region.starred"
              :aria-label="`${$t('layouts.system_status.preferred')}: ${region.description || region.value}`"
              @click="matchmaking.togglePreferredRegion(region.value)"
            >
              <Star
                class="h-3.5 w-3.5"
                :class="
                  region.starred
                    ? 'fill-current text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground/50'
                "
              />
            </button>
            <span
              class="flex min-w-0 items-center gap-1.5 font-sans text-[0.8rem] font-semibold tracking-[0.04em]"
              :class="
                region.matchmade && region.status !== 'Offline'
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              "
            >
              <span class="truncate">
                {{ region.description || region.value }}
              </span>
              <span
                v-if="
                  region.is_lan &&
                  !/\blan\b/i.test(region.description || region.value)
                "
                :class="[tagClasses, 'border-border text-muted-foreground']"
              >
                LAN
              </span>
              <span
                v-if="region.status === 'Partial'"
                :class="[tagClasses, 'border-yellow-500/45 text-yellow-500']"
              >
                {{ $t("layouts.system_status.partial") }}
              </span>
            </span>

            <span
              class="ml-auto whitespace-nowrap font-sans text-[0.74rem] font-semibold tabular-nums"
              :class="
                region.matchmade && !region.measuring
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              "
            >
              <span
                v-if="region.status === 'Offline'"
                :class="[wordClasses, 'text-red-500']"
              >
                {{ $t("common.offline") }}
              </span>
              <span
                v-else-if="region.latency === undefined"
                :class="[wordClasses, 'text-muted-foreground']"
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
            v-if="region.status !== 'Offline' && region.latency !== undefined"
            class="relative h-1 rounded-[2px] bg-foreground/10 transition-opacity duration-200"
            :class="{ 'opacity-40': region.measuring }"
          >
            <span
              class="absolute inset-y-0 left-0 rounded-[2px] transition-[width] duration-300"
              :class="region.matchmade ? 'bg-green-500/85' : 'bg-foreground/30'"
              :style="{ width: toPercent(region.latency) }"
            ></span>
            <span
              class="absolute -inset-y-[3px] w-px bg-foreground/45"
              :style="{ left: toPercent(maxLatency) }"
            ></span>
          </div>
        </li>
      </ul>
    </FormSection>

    <FormSection>
      <template #title>
        <label :for="sliderId">
          {{ $t("pages.settings.matchmaking.max_acceptable_latency") }}
        </label>
      </template>
      <div class="flex items-center gap-3">
        <input
          :id="sliderId"
          type="range"
          min="5"
          step="5"
          :max="sliderMax"
          :value="maxLatency"
          data-vaul-no-drag
          class="min-w-0 flex-1 cursor-pointer accent-[hsl(var(--tac-amber))]"
          @input="onLatencyInput"
        />
        <span
          class="w-14 shrink-0 whitespace-nowrap text-right font-sans text-sm font-semibold tabular-nums text-foreground"
        >
          {{ maxLatency }} ms
        </span>
      </div>
      <p class="mt-1.5 text-xs leading-snug text-muted-foreground">
        {{
          matchmaking.storedRegions.length
            ? $t("layouts.system_status.uses_starred")
            : $t("layouts.system_status.skips_over", { ms: maxLatency })
        }}
      </p>
    </FormSection>
  </div>
</template>
