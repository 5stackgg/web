<script setup lang="ts">
import { computed, ref } from "vue";
import { MonitorDown, PlusSquare, Share } from "lucide-vue-next";
import { useSidebar } from "@/components/ui/sidebar";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

withDefaults(
  defineProps<{
    isMenuItem?: boolean;
  }>(),
  {
    isMenuItem: true,
  },
);

const { state, isMobile } = useSidebar();
const { $pwa } = useNuxtApp();

const installPWADrawer = ref(false);

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

const canInstall = computed(() => {
  if ($pwa?.isPWAInstalled) {
    return false;
  }

  // Already running as an installed app — don't offer install.
  // `$pwa.isPWAInstalled` only checks the display-mode media query, which
  // is unreliable on iOS, so also check navigator.standalone directly.
  if (
    (window.navigator as Navigator & { standalone?: boolean }).standalone ||
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return false;
  }

  if (isIOS) {
    return true;
  }

  // beforeinstallprompt fires once, shortly after load. On mobile this
  // component lives in the sidebar Sheet, which isn't mounted until the
  // drawer opens — a listener added here would miss the event. The vite-pwa
  // plugin (client.installPrompt) captures it at app init and exposes it
  // reactively, so read that instead of listening ourselves.
  return $pwa?.showInstallPrompt === true;
});

async function installPWA() {
  if (isIOS) {
    installPWADrawer.value = true;
    return;
  }

  await $pwa?.install();
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
      <FiveStackToolTip v-if="!isMobile">
        <template #trigger>
          <Button @click="installPWA" size="sm">
            <MonitorDown />
          </Button>
        </template>
        {{ $t("pwa.install.button") }}
      </FiveStackToolTip>
      <div class="flex items-center gap-2 uppercase font-bold" v-else>
        <MonitorDown class="size-5" @click="installPWA" />
        {{ $t("pwa.install.button") }}
      </div>
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
