<script setup lang="ts">
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "~/components/ui/sheet";
import ServiceLogs from "~/components/ServiceLogs.vue";

const open = defineModel<boolean>("open", { required: true });

defineProps<{
  title: string;
  node: { id: string; label?: string | null } & Record<string, any>;
  service: string;
  running: boolean;
  note?: string;
}>();
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"
    >
      <div class="shrink-0 border-b border-border px-5 py-4 pr-12">
        <SheetTitle class="truncate text-sm font-semibold">
          {{ title }}
        </SheetTitle>
        <SheetDescription class="mt-0.5 truncate text-xs">
          <span class="font-mono text-[11.5px]">{{
            node.label || node.id
          }}</span>
          <template v-if="note"> · {{ note }}</template>
        </SheetDescription>
      </div>

      <!-- ServiceLogs renders through a Teleport, so the fill is set on its
           section from here rather than through a class it would not get. -->
      <div
        class="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 [&>section]:min-h-0 [&>section]:flex-1"
      >
        <ServiceLogs
          v-if="open"
          :key="service"
          :service="service"
          :compact="true"
          :running="running"
          :disable-retry="!running"
        />
      </div>
    </SheetContent>
  </Sheet>
</template>
