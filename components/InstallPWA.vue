<script setup lang="ts">
import { MonitorDown, PlusSquare, Share } from "lucide-vue-next";
import { useSidebar } from "@/components/ui/sidebar";

const { state, isMobile } = useSidebar();
</script>

<template>
  <div>
    <NuxtPwaManifest />

    <SidebarMenuItem
      class="mb-1"
      :class="{ 'mx-4': isMobile || state === 'expanded' }"
      v-if="canInstall"
    >
      <SidebarMenuButton as-child tooltip="Install App">
        <Button @click="installPWA" size="sm">
          <MonitorDown />
          <span v-if="isMobile || state === 'expanded'"> Install App </span>
        </Button>
      </SidebarMenuButton>
    </SidebarMenuItem>

    <Drawer
      :open="installPWADrawer"
      @update:open="installPWADrawer = $event"
      v-if="isIOS"
    >
      <DrawerContent class="p-4">
        <DrawerHeader>
          <div class="flex justify-between items-center">
            <DrawerTitle>Add to Home Screen</DrawerTitle>
            <DrawerClose>
              <Button
                variant="link"
                @click="installPWADrawer = false"
                class="text-lg text-blue-500"
              >
                Cancel
              </Button>
            </DrawerClose>
          </div>
          <Separator class="my-4" />
          <DrawerDescription class="text-lg">
            This website offers app-like features. Add it to your home screen
            for easy access.
          </DrawerDescription>
          <Separator class="my-4" />
        </DrawerHeader>

        <div class="flex flex-col gap-4 m-auto">
          <div class="flex items-center gap-4">
            <Share class="size-8 text-blue-500" />
            <div class="flex gap-2 text-muted-foreground">
              <span>1)</span>
              <span> Press the 'Share' button</span>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <PlusSquare class="size-8" />
            <div class="flex gap-2 text-muted-foreground">
              <span>2)</span>
              <span>Select 'Add to Home Screen'</span>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  </div>
</template>

<script lang="ts">
import type { BeforeInstallPromptEvent } from "@vite-pwa/nuxt/dist/runtime/plugins/types.js";

export default {
  created() {
    window.addEventListener(
      "beforeinstallprompt",
      (prompt: BeforeInstallPromptEvent) => {
        if (!prompt) {
          return;
        }

        prompt.preventDefault();
        this.pwaPrompt = prompt;
      },
    );
  },
  data() {
    return {
      installPWADrawer: false,
      pwaPrompt: undefined as BeforeInstallPromptEvent | undefined,
    };
  },
  methods: {
    installPWA() {
      if (this.isIOS) {
        this.installPWADrawer = true;
        return;
      }
      if (!this.pwaPrompt) {
        return;
      }

      this.pwaPrompt.prompt();

      this.pwaPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          this.pwaPrompt = undefined;
        }
      });
    },
  },
  computed: {
    isIOS() {
      return /iPad|iPhone|iPod/.test(navigator.userAgent);
    },
    canInstall() {
      if (this.$pwa?.isPWAInstalled) {
        return false;
      }

      if (this.isIOS) {
        return true;
      }

      if (this.pwaPrompt) {
        return true;
      }

      return false;
    },
  },
};
</script>
