<script setup lang="ts">
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Default from "~/layouts/default.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";

const showSeparators = computed(
  () => useApplicationSettingsStore().showSeparators,
);

const isDev = computed(() => {
  const domain = useRuntimeConfig().public.webDomain;
  return domain.includes("localhost") || domain.includes(".local");
});

const navRef = ref<HTMLElement | null>(null);
const indicatorY = ref(0);
const indicatorX = ref(0);
const indicatorHeight = ref(0);
const indicatorWidth = ref(0);
const hasAnimated = ref(false);
const isVertical = ref(true);

function updateIndicator() {
  const nav = navRef.value;
  if (!nav) return;
  const active = nav.querySelector(
    ".router-link-exact-active > button",
  ) as HTMLElement | null;
  if (!active) {
    indicatorHeight.value = 0;
    indicatorWidth.value = 0;
    hasAnimated.value = false;
    return;
  }
  const navRect = nav.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  indicatorY.value = activeRect.top - navRect.top;
  indicatorX.value = activeRect.left - navRect.left;
  indicatorHeight.value = activeRect.height;
  indicatorWidth.value = activeRect.width;
  isVertical.value = navRect.height > navRect.width;
  nextTick(() => {
    hasAnimated.value = true;
  });
}

let observer: MutationObserver | null = null;
const route = useRoute();

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

const showIndicator = computed(
  () => indicatorHeight.value > 0 && indicatorWidth.value > 0,
);
</script>

<template>
  <default>
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">
        {{ $t("layouts.application_settings.title") }}
      </h2>
      <p class="text-muted-foreground">
        {{ $t("layouts.application_settings.description") }}
      </p>
    </div>
    <Separator v-if="showSeparators" class="my-6" />
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <aside class="w-full lg:w-auto">
        <nav
          ref="navRef"
          class="settings-nav relative flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 overflow-y-auto max-h-[300px] lg:max-h-none"
        >
          <!-- Sliding right accent bar -->
          <div
            v-show="showIndicator"
            class="absolute top-0 right-0 w-0.5 bg-primary z-10 pointer-events-none"
            :class="hasAnimated ? 'settings-nav-indicator-animated' : ''"
            :style="{
              transform: `translateY(${indicatorY}px)`,
              height: `${indicatorHeight}px`,
            }"
          />

          <nuxt-link to="/settings/application/players">
            <Button
              variant="ghost"
              class="w-full text-left justify-start relative z-[1]"
            >
              {{ $t("pages.players.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application">
            <Button
              variant="ghost"
              class="w-full text-left justify-start relative z-[1]"
            >
              {{ $t("pages.settings.application.matchmaking.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/chat">
            <Button
              variant="ghost"
              class="w-full text-left justify-start relative z-[1]"
            >
              {{ $t("pages.settings.application.chat.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/streaming">
            <Button
              variant="ghost"
              class="w-full text-left justify-start relative z-[1]"
            >
              {{ $t("pages.settings.application.streaming.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/game-type-configs">
            <Button
              variant="ghost"
              class="w-full text-left justify-start relative z-[1]"
            >
              {{ $t("pages.settings.application.game_type_configs.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/map-pools">
            <Button
              variant="ghost"
              class="w-full text-left justify-start relative z-[1]"
            >
              {{ $t("pages.map_pools.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/demo-settings">
            <Button
              variant="ghost"
              class="w-full text-left justify-start relative z-[1]"
            >
              {{ $t("pages.settings.application.demo_settings.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/servers">
            <Button
              variant="ghost"
              class="w-full text-left justify-start relative z-[1]"
            >
              {{ $t("pages.settings.application.servers.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/discord">
            <Button
              variant="ghost"
              class="w-full text-left justify-start relative z-[1]"
            >
              {{ $t("pages.settings.application.discord.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/telemetry">
            <Button
              variant="ghost"
              class="w-full text-left justify-start relative z-[1]"
            >
              {{ $t("pages.settings.application.telemetry.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/branding">
            <Button
              variant="ghost"
              class="w-full text-left justify-start relative z-[1]"
            >
              Branding
            </Button>
          </nuxt-link>
          <nuxt-link v-if="isDev" to="/settings/application/fixtures">
            <Button
              variant="ghost"
              class="w-full text-left justify-start relative z-[1]"
            >
              Fixtures
            </Button>
          </nuxt-link>
        </nav>
      </aside>
      <div class="space-y-6 flex-1 min-w-0">
        <slot />
      </div>
    </div>
  </default>
</template>

<script lang="ts">
export default {};
</script>

<style lang="postcss">
.settings-nav a > button {
  @apply hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground transition-colors duration-200;
}
.settings-nav .router-link-exact-active > button {
  @apply text-sidebar-accent-foreground bg-transparent;
}
.settings-nav-indicator-animated {
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    width 0.2s ease,
    height 0.2s ease;
}
</style>
