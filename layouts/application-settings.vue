<script setup lang="ts">
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Default from "~/layouts/default.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";

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
  const match = items.find((item) => path.startsWith(item.path + "/"));
  return match ? match.path : (items[0]?.path ?? path);
});

const selectedPath = computed({
  get: () => resolvedPath.value,
  set: (path: string) => {
    if (path !== route.path) router.push(path);
  },
});

const navRef = ref<HTMLElement | null>(null);
const indicatorY = ref(0);
const indicatorHeight = ref(0);
const hasAnimated = ref(false);

function updateIndicator() {
  const nav = navRef.value;
  if (!nav) return;
  const active = nav.querySelector(
    ".router-link-exact-active > button",
  ) as HTMLElement | null;
  if (!active) {
    indicatorHeight.value = 0;
    hasAnimated.value = false;
    return;
  }
  const navRect = nav.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  indicatorY.value = activeRect.top - navRect.top;
  indicatorHeight.value = activeRect.height;
  nextTick(() => {
    hasAnimated.value = true;
  });
}

let observer: MutationObserver | null = null;

watch(
  () => route.path,
  () => nextTick(updateIndicator),
);

onMounted(() => {
  nextTick(updateIndicator);
  const nav = navRef.value;
  if (nav) {
    observer = new MutationObserver(updateIndicator);
    observer.observe(nav, {
      attributes: true,
      subtree: true,
      attributeFilter: ["class"],
    });
    window.addEventListener("resize", updateIndicator);
  }
});

onUnmounted(() => {
  observer?.disconnect();
  window.removeEventListener("resize", updateIndicator);
});

const showIndicator = computed(() => indicatorHeight.value > 0);
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
          <!-- Desktop: vertical nav with sliding indicator -->
          <nav ref="navRef" class="relative hidden flex-col space-y-1 lg:flex">
            <div
              v-show="showIndicator"
              class="absolute top-0 right-0 w-0.5 z-10 pointer-events-none bg-[hsl(var(--tac-amber))] shadow-[0_0_8px_hsl(var(--tac-amber)/0.35)]"
              :class="
                hasAnimated
                  ? '[transition:transform_0.35s_cubic-bezier(0.34,1.56,0.64,1),width_0.2s_ease,height_0.2s_ease]'
                  : ''
              "
              :style="{
                transform: `translateY(${indicatorY}px)`,
                height: `${indicatorHeight}px`,
              }"
            />
            <nuxt-link
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              exact-active-class="[&>button]:!text-sidebar-accent-foreground [&>button]:!bg-transparent"
            >
              <Button
                variant="ghost"
                class="w-full text-left justify-start relative z-[1] hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground transition-colors duration-200"
              >
                {{ item.label }}
              </Button>
            </nuxt-link>
          </nav>
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
