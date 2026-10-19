<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "~/components/ui/sheet";
import ServiceLogs from "~/components/ServiceLogs.vue";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";

// A game update's log, wide enough for steamcmd's long lines. The api keeps
// each update job for a week, so this is the last week's update or nothing.
const game = defineModel<"cs2" | "csgo" | null>("game", { required: true });

const props = defineProps<{
  node: { id: string; label?: string | null } & Record<string, any>;
}>();

const { t } = useI18n();

const open = computed({
  get: () => game.value !== null,
  set: (value) => {
    if (!value) {
      game.value = null;
    }
  },
});

const running = computed(
  () =>
    !!(game.value === "csgo"
      ? props.node.csgo_update_status
      : props.node.update_status),
);
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"
    >
      <div class="shrink-0 border-b border-border px-5 py-4 pr-12">
        <SheetTitle class="truncate text-sm font-semibold">
          {{
            game === "csgo"
              ? t(`${INSPECTOR}.log.title_csgo`)
              : t(`${INSPECTOR}.log.title_cs2`)
          }}
        </SheetTitle>
        <SheetDescription class="mt-0.5 truncate text-xs">
          <span class="font-mono text-[11.5px]">{{
            node.label || node.id
          }}</span>
          · {{ t(`${INSPECTOR}.log.kept`) }}
        </SheetDescription>
      </div>

      <!-- ServiceLogs renders through a Teleport, so the fill is set on its
           section from here rather than through a class it would not get. -->
      <div
        class="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 [&>section]:min-h-0 [&>section]:flex-1"
      >
        <ServiceLogs
          v-if="game"
          :key="`${game}:${node.id}`"
          :service="`${game === 'csgo' ? 'csgo' : 'cs'}-update:${node.id}`"
          :compact="true"
          :running="running"
          :disable-retry="!running"
        />
      </div>
    </SheetContent>
  </Sheet>
</template>
