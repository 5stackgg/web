<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";
import { useSidebar } from "~/components/ui/sidebar/utils";

// The brand across the top of the left nav, and the home link. An uploaded
// banner image fills it; without one it shows the logo and the name.
defineProps<{ to: RouteLocationRaw }>();

const { t } = useI18n();
const { brandName, logoUrl, bannerUrl } = useBranding();
const { setOpenMobile } = useSidebar();
const name = computed(() => brandName.value || t("layouts.app_nav.brand"));
</script>

<template>
  <NuxtLink
    :to="to"
    class="nav-banner relative flex h-[76px] shrink-0 items-center gap-3 overflow-hidden border-b border-sidebar-border bg-black/20 px-4 outline-none ring-inset ring-sidebar-ring focus-visible:ring-2"
    :aria-label="t('layouts.app_nav.navigation.home')"
    @click="setOpenMobile(false)"
  >
    <img
      v-if="bannerUrl"
      :src="bannerUrl"
      alt=""
      class="absolute inset-0 size-full object-cover"
    />
    <template v-else>
      <img
        :src="logoUrl || '/favicon/192.png'"
        alt=""
        width="44"
        height="44"
        class="relative size-11 shrink-0 rounded-[22%] object-cover outline outline-1 -outline-offset-1 outline-white/10"
      />
      <span
        class="relative min-w-0 truncate text-xl font-bold uppercase leading-none tracking-[0.06em] text-foreground"
      >
        {{ name }}
      </span>
    </template>
  </NuxtLink>
</template>

<style scoped>
/* Contour rings rising from the far corner and a faint amber wash, under the
   logo; an amber edge along the bottom, over any banner image. */
.nav-banner::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    repeating-radial-gradient(
      ellipse at 88% 120%,
      transparent 0 11px,
      rgb(255 255 255 / 0.035) 11px 12px
    ),
    linear-gradient(90deg, transparent 30%, hsl(var(--tac-amber) / 0.05));
}
.nav-banner::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    transparent,
    hsl(var(--tac-amber) / 0.5) 50%,
    transparent
  );
}
</style>
