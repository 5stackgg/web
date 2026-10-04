<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useMediaQuery } from "@vueuse/core";
import { Popover, PopoverContent } from "~/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "~/components/ui/sheet";
import PlayWhereChoices from "~/components/matchmaking/PlayWhereChoices.vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { roundedPing } from "~/components/play/matchmakingHero";

// Asks a player on a LAN whether to play there or online, the first time they
// queue or host this session. Anchored to the button that asked on desktop; a
// bottom sheet on phones; a small dialog when nothing anchors it (a menu item).
const { t } = useI18n();
const matchmaking = useMatchmakingStore();
const isMobile = useMediaQuery("(max-width: 767px)");

const prompt = computed(() => matchmaking.playWherePrompt);
const anchor = computed(() =>
  !isMobile.value && prompt.value?.anchor?.isConnected
    ? prompt.value.anchor
    : null,
);

const title = computed(() =>
  prompt.value?.kind === "room"
    ? t("matchmaking.where.ask_room")
    : t("matchmaking.where.ask_queue"),
);

function ping(region: { value: string }) {
  const ms = roundedPing(
    matchmaking.getRegionlatencyResult(region.value)?.latency,
  );
  return ms === null ? null : String(ms);
}

const lanPing = computed(() => {
  const region = matchmaking.lanRegions[0];
  return region ? ping(region) : null;
});

const onlineSummary = computed(() =>
  prompt.value?.kind === "room"
    ? t("matchmaking.where.online_room_hint")
    : (
        matchmaking.onlineRegions as Array<{
          value: string;
          description?: string;
        }>
      )
        .map((region) => {
          const ms = ping(region);
          const name = region.description || region.value;
          return ms
            ? `${name} ${t("pages.play.matchmaking.regions.ms", { ms })}`
            : name;
        })
        .join(" · "),
);

function choose(where: "lan" | "online") {
  prompt.value?.resolve(where);
}

function onOpenChange(open: boolean) {
  if (!open) {
    prompt.value?.resolve(null);
  }
}
</script>

<template>
  <Popover v-if="anchor" :open="!!prompt" @update:open="onOpenChange">
    <PopoverContent
      :reference="anchor"
      side="top"
      align="end"
      class="grid w-[22.5rem] gap-3 p-3.5"
    >
      <p class="text-sm font-bold">{{ title }}</p>
      <PlayWhereChoices
        :kind="prompt!.kind"
        :lan-ping="lanPing"
        :online-summary="onlineSummary"
        @choose="choose"
      />
    </PopoverContent>
  </Popover>

  <Sheet v-else-if="isMobile" :open="!!prompt" @update:open="onOpenChange">
    <SheetContent side="bottom" class="grid gap-3 rounded-t-xl pb-7">
      <SheetTitle class="text-base">{{ title }}</SheetTitle>
      <SheetDescription class="sr-only">{{ title }}</SheetDescription>
      <PlayWhereChoices
        v-if="prompt"
        :kind="prompt.kind"
        :lan-ping="lanPing"
        :online-summary="onlineSummary"
        @choose="choose"
      />
    </SheetContent>
  </Sheet>

  <Dialog v-else :open="!!prompt" @update:open="onOpenChange">
    <DialogContent class="grid max-w-sm gap-3">
      <DialogTitle class="text-base">{{ title }}</DialogTitle>
      <DialogDescription class="sr-only">{{ title }}</DialogDescription>
      <PlayWhereChoices
        v-if="prompt"
        :kind="prompt.kind"
        :lan-ping="lanPing"
        :online-summary="onlineSummary"
        @choose="choose"
      />
    </DialogContent>
  </Dialog>
</template>
