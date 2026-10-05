<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "~/components/ui/drawer";
import MatchmakingSettings from "~/components/matchmaking/MatchmakingSettings.vue";

// Every way into the matchmaking settings (the top-bar globe, the /play gear)
// opens this: the same sections everywhere, a popover on desktop and a
// swipe-down drawer on phones, where a popover this tall flips up and clips.
withDefaults(defineProps<{ align?: "start" | "center" | "end" }>(), {
  align: "start",
});

const open = defineModel<boolean>("open", { default: false });
const isPhone = useMediaQuery("(max-width: 767px)");
</script>

<template>
  <Popover
    :open="open && !isPhone"
    @update:open="(value: boolean) => (open = value)"
  >
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverContent
      :align="align"
      :side-offset="6"
      :collision-padding="12"
      class="w-[min(92vw,520px)] p-4"
    >
      <MatchmakingSettings>
        <slot name="extra" />
      </MatchmakingSettings>
    </PopoverContent>
  </Popover>

  <Drawer
    :open="open && isPhone"
    @update:open="(value: boolean) => (open = value)"
  >
    <DrawerContent class="max-h-[85dvh]">
      <div class="overflow-y-auto px-4 pb-8 pt-4">
        <DrawerTitle class="mb-4 text-base">{{
          $t("pages.play.matchmaking.settings")
        }}</DrawerTitle>
        <DrawerDescription class="sr-only">{{
          $t("pages.play.matchmaking.settings")
        }}</DrawerDescription>
        <MatchmakingSettings>
          <slot name="extra" />
        </MatchmakingSettings>
      </div>
    </DrawerContent>
  </Drawer>
</template>
