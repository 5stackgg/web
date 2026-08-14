<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { RadioTower, ArrowRight } from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { generateQuery } from "~/graphql/graphqlGen";

type WebPushStatus = {
  configured: boolean;
  subscriptions: number;
  players: number;
  active_7d: number;
  new_7d: number;
  never_delivered: number;
  last_delivered_at: string | null;
  platforms: Array<{ platform: string; devices: number }>;
};

const { t } = useI18n();
const nuxtApp = useNuxtApp();

const status = ref<WebPushStatus | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

// "Configured" answers the wrong question -- a keypair existing says nothing
// about whether anything reaches a phone. These four states are ordered by how
// far the feature actually got, and `last_delivered_at` is the only one of them
// that is end-to-end proof.
const verdict = computed<"offline" | "ready" | "standby" | "live" | null>(() => {
  if (!status.value) {
    return null;
  }
  if (!status.value.configured) {
    return "offline";
  }
  if (status.value.subscriptions === 0) {
    return "ready";
  }
  return status.value.last_delivered_at ? "live" : "standby";
});

const isLive = computed(() => verdict.value === "live");
const isOffline = computed(() => verdict.value === "offline");

const stateLabel = computed(() =>
  verdict.value
    ? t(`pages.settings.application.web_push.state_${verdict.value}`)
    : "",
);

const frameClasses = computed(() => {
  if (isOffline.value) {
    return "border-destructive/35 bg-destructive/[0.05]";
  }
  return isLive.value
    ? "border-[hsl(var(--tac-amber))]/25 bg-card/40"
    : "border-border/60 bg-card/30";
});

const markerClasses = computed(() => {
  if (isOffline.value) {
    return "bg-destructive";
  }
  return isLive.value ? "bg-[hsl(var(--tac-amber))]" : "bg-muted-foreground/60";
});

const stateToneClasses = computed(() => {
  if (isOffline.value) {
    return "text-destructive";
  }
  return isLive.value ? "text-[hsl(var(--tac-amber))]" : "text-foreground";
});

// Hairline grid, drawn rather than shipped. Sits under the readout so the panel
// has a surface instead of being another flat translucent card.
const gridTexture =
  "background-image:" +
  "repeating-linear-gradient(0deg,hsl(var(--border)/0.5) 0 1px,transparent 1px 34px)," +
  "repeating-linear-gradient(90deg,hsl(var(--border)/0.5) 0 1px,transparent 1px 34px)";

const ledger = computed(() => {
  if (!status.value) {
    return [];
  }
  return [
    { key: "devices", value: status.value.subscriptions },
    { key: "players", value: status.value.players },
    { key: "active_7d", value: status.value.active_7d },
    { key: "new_7d", value: status.value.new_7d },
  ];
});

// One hue at descending strength beats four arbitrary colours here: the
// segments are already ranked by size, so brightness carries the ranking and
// the bar stays inside the panel's palette instead of importing a new one.
const RAMP = [0.95, 0.6, 0.36, 0.2, 0.12];

const platforms = computed(() => {
  const rows = status.value?.platforms ?? [];
  const total = rows.reduce((sum, row) => sum + row.devices, 0);

  return rows.map((row, index) => ({
    platform: row.platform,
    devices: row.devices,
    share: total > 0 ? (row.devices / total) * 100 : 0,
    tone: `hsl(var(--tac-amber) / ${RAMP[Math.min(index, RAMP.length - 1)]})`,
  }));
});

const platformLabel = (platform: string) =>
  t(`pages.settings.application.web_push.platforms.${platform}`);

const fetchStatus = async () => {
  loading.value = true;
  error.value = null;

  try {
    const { data } = await nuxtApp.$apollo.defaultClient.query({
      fetchPolicy: "no-cache",
      query: generateQuery({
        webPushStatus: {
          configured: true,
          subscriptions: true,
          players: true,
          active_7d: true,
          new_7d: true,
          never_delivered: true,
          last_delivered_at: true,
          platforms: {
            platform: true,
            devices: true,
          },
        },
      }),
    });

    status.value = data.webPushStatus;
  } catch (e) {
    error.value = (e as Error)?.message ?? String(e);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  void fetchStatus();
});
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <SettingsSection
        id="web-push"
        :title="$t('pages.settings.application.web_push.section')"
        :description="$t('pages.settings.application.web_push.description')"
      >
        <div
          v-if="loading && !status"
          class="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ $t("common.loading") }}
        </div>

        <p v-else-if="error" class="text-sm text-destructive">
          {{ error }}
        </p>

        <template v-else-if="status">
          <!-- The verdict. One unambiguous word plus the evidence for it --
               everything else on this page is supporting detail. -->
          <div
            class="relative overflow-hidden rounded-lg border transition-colors duration-200"
            :class="frameClasses"
          >
            <div
              class="pointer-events-none absolute inset-0 opacity-40"
              :style="gridTexture"
            ></div>
            <div
              v-if="isLive"
              class="pointer-events-none absolute -left-20 -top-28 h-72 w-72 rounded-full"
              style="
                background: radial-gradient(
                  circle,
                  hsl(var(--tac-amber) / 0.16) 0%,
                  transparent 70%
                );
              "
            ></div>

            <div
              class="relative flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-10"
            >
              <div class="flex items-start gap-4">
                <span class="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
                  <span
                    v-if="isLive"
                    class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                    :class="markerClasses"
                  ></span>
                  <span
                    class="relative inline-flex h-2.5 w-2.5 rounded-full"
                    :class="markerClasses"
                  ></span>
                </span>

                <div class="grid gap-2">
                  <span
                    class="font-sans text-2xl font-bold uppercase leading-none tracking-[0.05em]"
                    :class="stateToneClasses"
                  >
                    {{ stateLabel }}
                  </span>
                  <span
                    class="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    <template v-if="isLive">
                      {{ $t("pages.settings.application.web_push.last_delivery") }}
                      <TimeAgo
                        :date="status.last_delivered_at"
                        hide-icon
                        class="text-foreground/85"
                      />
                    </template>
                    <template v-else>
                      {{
                        $t(`pages.settings.application.web_push.hint_${verdict}`)
                      }}
                    </template>
                  </span>
                </div>
              </div>

              <!-- Reach ledger. Deliberately smaller than the state word: these
                   numbers describe the feature, they don't diagnose it. -->
              <!-- Grid on mobile, divided row at sm+. Wrapping a flex row here
                   put a divider at the start of the second line. -->
              <div
                v-if="status.subscriptions > 0"
                class="grid grid-cols-4 gap-y-4 sm:flex sm:items-stretch sm:gap-y-0"
              >
                <div
                  v-for="(entry, index) in ledger"
                  :key="entry.key"
                  class="px-2 py-1 sm:min-w-[4.5rem] sm:px-4"
                  :class="index > 0 ? 'sm:border-l sm:border-border/60' : ''"
                >
                  <div
                    class="font-sans text-xl font-semibold leading-none tabular-nums"
                  >
                    {{ entry.value }}
                  </div>
                  <div
                    class="mt-2 font-mono text-[0.55rem] uppercase leading-none tracking-[0.18em] text-muted-foreground/70"
                  >
                    {{
                      $t(`pages.settings.application.web_push.${entry.key}`)
                    }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- The common state on a small install, so it gets a real answer
               rather than a grid of zeroes. -->
          <div
            v-if="status.configured && status.subscriptions === 0"
            class="grid justify-items-center gap-3 rounded-lg border border-dashed border-border/70 px-5 py-8 text-center"
          >
            <RadioTower class="h-6 w-6 text-muted-foreground/40" />
            <p class="font-sans text-sm font-medium">
              {{ $t("pages.settings.application.web_push.empty_title") }}
            </p>
            <p class="max-w-prose text-xs text-muted-foreground">
              {{ $t("pages.settings.application.web_push.empty_body") }}
            </p>
            <NuxtLink
              to="/settings/notification-preferences"
              class="mt-1 inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {{ $t("pages.settings.application.web_push.empty_link") }}
              <ArrowRight class="h-3 w-3" />
            </NuxtLink>
          </div>

          <!-- Platform mix. The one number that answers a question an admin
               actually asks: "do the iOS players get these?" -->
          <div v-if="platforms.length > 0" class="grid gap-3">
            <div
              class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/70"
            >
              {{ $t("pages.settings.application.web_push.platform_mix") }}
            </div>

            <!-- A single segment at 100% is a rule, not a chart -- the legend
                 already says it, so the bar only earns its place on a mix. -->
            <div
              v-if="platforms.length > 1"
              class="flex h-2 w-full overflow-hidden rounded-full bg-muted/30"
            >
              <div
                v-for="entry in platforms"
                :key="entry.platform"
                class="h-full"
                :style="{
                  width: `${entry.share}%`,
                  backgroundColor: entry.tone,
                }"
              ></div>
            </div>

            <div class="flex flex-wrap gap-x-5 gap-y-2">
              <span
                v-for="entry in platforms"
                :key="entry.platform"
                class="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
              >
                <span
                  class="h-[7px] w-[7px] rotate-45"
                  :style="{ backgroundColor: entry.tone }"
                ></span>
                {{ platformLabel(entry.platform) }}
                <span class="tabular-nums text-foreground">
                  {{ entry.devices }}
                </span>
              </span>
            </div>

            <p
              v-if="status.never_delivered > 0"
              class="text-xs text-muted-foreground/80"
            >
              {{
                $t("pages.settings.application.web_push.never_delivered", {
                  count: status.never_delivered,
                })
              }}
            </p>
          </div>
        </template>
      </SettingsSection>
    </PageTransition>
  </SettingsPage>
</template>
