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
    class="nav-banner relative flex h-[76px] shrink-0 items-center gap-3.5 overflow-hidden border-b border-sidebar-border bg-black/20 pl-3 pr-4 outline-none ring-inset ring-sidebar-ring focus-visible:ring-2"
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
        width="52"
        height="52"
        class="nav-banner-logo relative size-[52px] shrink-0 rounded-xl object-cover"
      />
      <span class="relative flex min-w-0 flex-col gap-2">
        <span class="nav-banner-word relative min-w-0">
          <span aria-hidden="true" class="nav-banner-ghost">{{ name }}</span>
          <span class="nav-banner-name">{{ name }}</span>
        </span>
        <span aria-hidden="true" class="nav-banner-rule"></span>
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
.nav-banner-logo {
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.1),
    0 6px 18px rgb(0 0 0 / 0.5);
}
/* The wordmark: a light-to-silver face over an amber outline set 2px off. */
.nav-banner-word {
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}
.nav-banner-name,
.nav-banner-ghost {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-banner-name {
  position: relative;
  background: linear-gradient(180deg, #fff 0%, #c9c9cf 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.nav-banner-ghost {
  position: absolute;
  inset: 0;
  transform: translate(2px, 2px);
  color: transparent;
  -webkit-text-stroke: 1px hsl(var(--tac-amber) / 0.55);
}
.nav-banner-rule {
  width: min(118px, 100%);
  height: 2px;
  background: linear-gradient(
    90deg,
    hsl(var(--tac-amber)),
    hsl(var(--tac-amber) / 0)
  );
}
</style>
