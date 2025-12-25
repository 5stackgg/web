<script setup lang="ts">
import type { SidebarProps } from "~/components/ui/sidebar";
import LeftNav from "@/layouts/components/LeftNav.vue";
import RightNav from "@/layouts/components/RightNav.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { useAuthStore } from "~/stores/AuthStore";

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
  <RightNav v-else-if="authStore.me" />
</template>
