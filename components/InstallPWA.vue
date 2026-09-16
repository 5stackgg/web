<script setup lang="ts">
import { MonitorDown } from "lucide-vue-next";
import { useSidebar } from "@/components/ui/sidebar";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import InstallPWADrawer from "~/components/InstallPWADrawer.vue";
import { usePwaInstall } from "~/composables/usePwaInstall";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";

withDefaults(
  defineProps<{
    isMenuItem?: boolean;
    // Nav headers are tight enough that the icon carries it and the label
    // lives in a tooltip. Anywhere with room -- a settings card, say -- wants
    // the words, at every width.
    showLabel?: boolean;
  }>(),
  {
    isMenuItem: true,
    showLabel: false,
  },
);

const { state, isMobile } = useSidebar();

// Shared with the notification settings gate and the enable-push prompt, so
// all three agree on what "installed" means.
const { canInstall, manualInstall, showInstructions, install } =
  usePwaInstall();
</script>

<template>
  <div v-if="canInstall">
    <template v-if="isMenuItem">
      <SidebarMenuItem
        class="mb-1"
        :class="{ 'mx-4': isMobile || state === 'expanded' }"
      >
        <SidebarMenuButton as-child :tooltip="$t('pwa.install.tooltip')">
          <Button @click="install" size="sm">
            <MonitorDown />
            <span v-if="isMobile || state === 'expanded'">{{
              $t("pwa.install.button")
            }}</span>
          </Button>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </template>
    <template v-else>
      <FiveStackToolTip v-if="!isMobile && !showLabel">
        <template #trigger>
          <Button @click="install" size="sm">
            <MonitorDown />
          </Button>
        </template>
        {{ $t("pwa.install.button") }}
      </FiveStackToolTip>
      <!-- Labelled variant is a real call to action rather than a nav affordance
           — it's the one thing standing between the player and a feature. -->
      <Button :class="tacticalCtaButtonClasses" @click="install" v-else>
        {{ $t("pwa.install.button") }}
      </Button>
    </template>

    <InstallPWADrawer
      v-model:open="showInstructions"
      :platform="manualInstall"
    />
  </div>
</template>
