<script setup lang="ts">
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Default from "~/layouts/default.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsSideTabs from "~/components/settings/SettingsSideTabs.vue";

const showSeparators = computed(
  () => useApplicationSettingsStore().showSeparators,
);

const isDev = computed(() => {
  const domain = useRuntimeConfig().public.webDomain;
  return domain.includes("localhost") || domain.includes(".local");
});

const { t: $t } = useI18n();

const navItems = computed(() => {
  const items: { path: string; label: string }[] = [
    { path: "/settings/application/players", label: $t("pages.players.title") },
    {
      path: "/settings/application",
      label: $t("pages.settings.application.matchmaking.title"),
    },
    {
      path: "/settings/application/chat",
      label: $t("pages.settings.application.chat.title"),
    },
    {
      path: "/settings/application/streaming",
      label: $t("pages.settings.application.streaming.title"),
    },
    {
      path: "/settings/application/game-type-configs",
      label: $t("pages.settings.application.game_type_configs.title"),
    },
    {
      path: "/settings/application/map-pools",
      label: $t("pages.map_pools.title"),
    },
    {
      path: "/settings/application/demo-settings",
      label: $t("pages.settings.application.demo_settings.title"),
    },
    {
      path: "/settings/application/servers",
      label: $t("pages.settings.application.servers.title"),
    },
    {
      path: "/settings/application/discord",
      label: $t("pages.settings.application.discord.title"),
    },
    {
      path: "/settings/application/telemetry",
      label: $t("pages.settings.application.telemetry.title"),
    },
    {
      path: "/settings/application/branding",
      label: $t("layouts.application_settings.branding_nav"),
    },
  ];
  if (isDev.value) {
    items.push({
      path: "/settings/application/fixtures",
      label: $t("layouts.application_settings.fixtures_nav"),
    });
  }
  return items;
});

const route = useRoute();
const router = useRouter();

/** Resolve current path to a nav item path (for sub-routes like /players/123). */
const resolvedPath = computed(() => {
  const path = route.path;
  const items = navItems.value ?? [];
  if (items.some((item) => item.path === path)) return path;
  const match = items
    .filter((item) => path.startsWith(item.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match ? match.path : (items[0]?.path ?? path);
});

const selectedPath = computed({
  get: () => resolvedPath.value,
  set: (path: string) => {
    if (path !== route.path) router.push(path);
  },
});
</script>

<template>
  <default>
    <PageTransition :delay="0">
      <div class="space-y-0.5">
        <h2 class="text-2xl font-bold tracking-tight">
          {{ $t("layouts.application_settings.title") }}
        </h2>
        <p class="text-muted-foreground">
          {{ $t("layouts.application_settings.description") }}
        </p>
      </div>
    </PageTransition>
    <Separator v-if="showSeparators" class="my-6" />
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <PageTransition :delay="100">
        <aside class="w-full shrink-0 lg:w-auto">
          <!-- Mobile: single dropdown so all sections are one tap away, no scroll -->
          <div class="lg:hidden">
            <Select v-model="selectedPath">
              <SelectTrigger
                class="w-full"
                :aria-label="$t('ui.tooltips.settings_section')"
              >
                <SelectValue
                  :placeholder="
                    $t('layouts.application_settings.select_section')
                  "
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="item in navItems"
                  :key="item.path"
                  :value="item.path"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SettingsSideTabs
            :items="navItems"
            :active-path="resolvedPath"
            :aria-label="$t('ui.tooltips.settings_section')"
          />
        </aside>
      </PageTransition>
      <div class="space-y-6 flex-1 min-w-0">
        <slot />
      </div>
    </div>
  </default>
</template>

<script lang="ts">
export default {};
</script>
