<script setup lang="ts">
import { computed } from "vue";
import {
  EllipsisVertical,
  ExternalLink,
  PlusSquare,
  Share,
} from "lucide-vue-next";
import type { ManualInstallPlatform } from "~/composables/usePwaInstall";

const props = defineProps<{
  platform: ManualInstallPlatform | null;
}>();

const open = defineModel<boolean>("open", { default: false });

const steps = computed(() => {
  switch (props.platform) {
    case "ios":
      return [
        { icon: Share, label: "pwa.install.step1" },
        { icon: PlusSquare, label: "pwa.install.step2" },
      ];
    case "android":
      return [
        { icon: EllipsisVertical, label: "pwa.install.android.step1" },
        { icon: PlusSquare, label: "pwa.install.android.step2" },
      ];
    case "in_app":
      return [
        { icon: ExternalLink, label: "pwa.install.in_app.step1" },
        { icon: PlusSquare, label: "pwa.install.in_app.step2" },
      ];
    default:
      return [];
  }
});
</script>

<template>
  <Drawer v-if="platform" :open="open" @update:open="open = $event">
    <DrawerContent class="p-4">
      <DrawerHeader>
        <div class="flex justify-between items-center">
          <DrawerTitle>{{ $t("pwa.install.title") }}</DrawerTitle>
          <DrawerClose>
            <Button
              variant="link"
              @click="open = false"
              class="text-lg text-blue-500"
            >
              {{ $t("common.cancel") }}
            </Button>
          </DrawerClose>
        </div>
        <Separator class="my-4" />
        <DrawerDescription class="text-lg">
          {{
            platform === "in_app"
              ? $t("pwa.install.in_app.description")
              : $t("pwa.install.description")
          }}
        </DrawerDescription>
        <Separator class="my-4" />
      </DrawerHeader>

      <div class="flex flex-col gap-4 m-auto">
        <div
          v-for="(step, index) in steps"
          :key="step.label"
          class="flex items-center gap-4"
        >
          <component
            :is="step.icon"
            class="size-8"
            :class="{ 'text-blue-500': index === 0 }"
          />
          <div class="flex gap-2 text-muted-foreground">
            <span>{{ index + 1 }})</span>
            <span>{{ $t(step.label) }}</span>
          </div>
        </div>
      </div>

      <!-- Chrome stops prompting once installed, so installed players land here too. -->
      <p
        v-if="platform === 'android'"
        class="mx-auto mt-6 max-w-prose text-center text-xs text-muted-foreground/80"
      >
        {{ $t("pwa.install.android.already_installed") }}
      </p>
    </DrawerContent>
  </Drawer>
</template>
