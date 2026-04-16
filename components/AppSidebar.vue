<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import type { SidebarProps } from "~/components/ui/sidebar";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { useAuthStore } from "~/stores/AuthStore";

const LeftNav = defineAsyncComponent(
  () => import("@/layouts/components/LeftNav.vue"),
);
const RightHub = defineAsyncComponent(
  () => import("@/layouts/components/RightHub.vue"),
);

const props = withDefaults(defineProps<SidebarProps>(), {
  side: "left",
});

const { isMobile, open } = useSidebar();
const authStore = useAuthStore();
</script>

<template>
  <LeftNav
    v-if="props.side === 'left'"
    :is-mobile="isMobile"
    :side-bar-open="open"
  />
  <RightHub v-else-if="authStore.me" />
</template>
