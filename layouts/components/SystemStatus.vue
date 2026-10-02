<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Globe } from "lucide-vue-next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { FormSection } from "~/components/ui/form";
import RegionLatencySettings from "~/components/matchmaking/RegionLatencySettings.vue";
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

const regions = computed(() =>
  settings.availableRegions.map((region) => ({
    ...region,
    tone: statusTone(region.status),
  })),
);

// Signed-in players see matchmaking regions in the shared ping list; anything
// left over is listed here by status alone.
const statusRegions = computed(() =>
  canMeasure.value
    ? regions.value.filter((region) => !matchmaking.isMatchmakingRegion(region))
    : regions.value,
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
      :collision-padding="12"
      class="w-[320px] max-w-[calc(100vw-1.5rem)] space-y-4"
    >
      <RegionLatencySettings v-if="canMeasure" />

      <FormSection
        v-if="statusRegions.length"
        :title="$t('layouts.system_status.regions')"
      >
        <template #actions>
          <span
            class="font-mono text-[0.7rem] uppercase tracking-[0.12em] tabular-nums text-muted-foreground"
          >
            {{
              $t("layouts.system_status.online_count", {
                online: onlineCount,
                total: regions.length,
              })
            }}
          </span>
        </template>

        <ul class="-mt-1.5">
          <li
            v-for="region in statusRegions"
            :key="region.value"
            class="flex items-center gap-2 border-t border-border/60 py-2.5 first:border-t-0"
          >
            <span
              class="min-w-0 truncate font-sans text-[0.8rem] font-semibold tracking-[0.04em]"
              :class="
                region.tone === 'bad'
                  ? 'text-muted-foreground'
                  : 'text-foreground'
              "
            >
              {{ region.description || region.value }}
            </span>
            <span
              v-if="region.is_lan"
              class="rounded-sm border border-border px-1 py-0.5 font-sans text-[0.54rem] font-bold uppercase leading-none tracking-[0.14em] text-muted-foreground"
            >
              LAN
            </span>
            <span
              class="ml-auto font-sans text-[0.6rem] font-bold uppercase tracking-[0.16em]"
              :class="toneText[region.tone]"
            >
              {{
                region.tone === "ok"
                  ? $t("common.online")
                  : region.tone === "bad"
                    ? $t("common.offline")
                    : $t("layouts.system_status.partial")
              }}
            </span>
          </li>
        </ul>

        <p
          v-if="!canMeasure"
          class="mt-1.5 text-xs leading-snug text-muted-foreground"
        >
          {{ $t("layouts.system_status.sign_in") }}
        </p>
      </FormSection>
    </PopoverContent>
  </Popover>
</template>
