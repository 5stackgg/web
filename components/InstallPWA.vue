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
    // Full-width, in the amber frame the Create Lobby button wears: for the
    // left nav, where it sits on its own under the fleet status.
    framed?: boolean;
    // Small and labelled, for the end of the left nav's footer row.
    compact?: boolean;
  }>(),
  {
    isMenuItem: true,
    showLabel: false,
    framed: false,
    compact: false,
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
    <div
      v-else-if="framed"
      class="relative flex rounded-md shadow-[0_4px_14px_-8px_hsl(var(--tac-amber)/0.3)] transition-shadow duration-300 hover:shadow-[0_6px_18px_-8px_hsl(var(--tac-amber)/0.4)]"
    >
      <span
        aria-hidden="true"
        class="tac-amber-frame pointer-events-none absolute inset-0 rounded-md"
      ></span>
      <Button
        variant="ghost"
        size="sm"
        class="w-full text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-[hsl(var(--tac-amber))]"
        @click="install"
      >
        <MonitorDown />
        {{ $t("pwa.install.button") }}
      </Button>
    </div>
    <Button
      v-else-if="compact"
      variant="outline"
      size="sm"
      class="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
      @click="install"
    >
      <MonitorDown class="h-3.5 w-3.5" />
      {{ $t("pwa.install.button") }}
    </Button>
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
