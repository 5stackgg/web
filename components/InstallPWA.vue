<script setup lang="ts">
import { ref } from "vue";
import { MonitorDown, PlusSquare, Share } from "lucide-vue-next";
import { useSidebar } from "@/components/ui/sidebar";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { isIosBrowser, usePwaInstall } from "~/composables/usePwaInstall";
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
const { canInstall, install } = usePwaInstall();

const installPWADrawer = ref(false);

const isIOS = isIosBrowser();

async function installPWA() {
  if (isIOS) {
    installPWADrawer.value = true;
    return;
  }

  await install();
}
</script>

<template>
  <div v-if="canInstall">
    <template v-if="isMenuItem">
      <SidebarMenuItem
        class="mb-1"
        :class="{ 'mx-4': isMobile || state === 'expanded' }"
      >
        <SidebarMenuButton as-child :tooltip="$t('pwa.install.tooltip')">
          <Button @click="installPWA" size="sm">
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
          <Button @click="installPWA" size="sm">
            <MonitorDown />
          </Button>
        </template>
        {{ $t("pwa.install.button") }}
      </FiveStackToolTip>
      <!-- Labelled variant is a real call to action rather than a nav affordance
           — it's the one thing standing between the player and a feature. -->
      <Button :class="tacticalCtaButtonClasses" @click="installPWA" v-else>
        {{ $t("pwa.install.button") }}
      </Button>
    </template>

    <Drawer
      :open="installPWADrawer"
      @update:open="installPWADrawer = $event"
      v-if="isIOS"
    >
      <DrawerContent class="p-4">
        <DrawerHeader>
          <div class="flex justify-between items-center">
            <DrawerTitle>{{ $t("pwa.install.title") }}</DrawerTitle>
            <DrawerClose>
              <Button
                variant="link"
                @click="installPWADrawer = false"
                class="text-lg text-blue-500"
              >
                {{ $t("common.cancel") }}
              </Button>
            </DrawerClose>
          </div>
          <Separator class="my-4" />
          <DrawerDescription class="text-lg">
            {{ $t("pwa.install.description") }}
          </DrawerDescription>
          <Separator class="my-4" />
        </DrawerHeader>

        <div class="flex flex-col gap-4 m-auto">
          <div class="flex items-center gap-4">
            <Share class="size-8 text-blue-500" />
            <div class="flex gap-2 text-muted-foreground">
              <span>1)</span>
              <span>{{ $t("pwa.install.step1") }}</span>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <PlusSquare class="size-8" />
            <div class="flex gap-2 text-muted-foreground">
              <span>2)</span>
              <span>{{ $t("pwa.install.step2") }}</span>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  </div>
</template>
