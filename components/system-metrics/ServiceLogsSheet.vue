<script setup lang="ts">
import { computed } from "vue";
import { ExternalLink } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "~/components/ui/sheet";
import ServiceLogs from "~/components/ServiceLogs.vue";
import { logTabFor } from "~/components/system-metrics/metricRules";

// Streams any service's pod log in place -- dedicated servers, connectors and
// the rest included -- instead of sending it to the Logs page, which only has
// tabs for the core services. Those still get a hand-off.
const open = defineModel<boolean>("open", { required: true });

const props = defineProps<{
  service: { node: string; name: string } | null;
  nodeLabel?: string;
}>();

const tab = computed(() =>
  props.service ? logTabFor(props.service.name) : null,
);
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"
    >
      <div class="shrink-0 border-b border-border px-5 py-4 pr-12">
        <SheetTitle class="truncate font-mono text-sm font-semibold">
          {{ service?.name }}
        </SheetTitle>
        <SheetDescription class="mt-0.5 truncate text-xs">
          {{
            $t("pages.system_metrics.logs_sheet_sub", {
              node: nodeLabel || service?.node,
            })
          }}
        </SheetDescription>
      </div>

      <!-- ServiceLogs renders through a Teleport, so the fill is set on its
           section from here rather than through a class it would not get. -->
      <div
        class="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 [&>section]:min-h-0 [&>section]:flex-1"
      >
        <ServiceLogs
          v-if="service"
          :key="service.name"
          :service="service.name"
          :compact="true"
        />
      </div>

      <div
        class="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3"
      >
        <Button variant="ghost" size="sm" @click="open = false">
          {{ $t("common.close") }}
        </Button>
        <Button v-if="tab" as-child variant="outline" size="sm">
          <NuxtLink :to="{ path: '/system-logs', query: { tab } }">
            <ExternalLink />
            {{ $t("pages.system_metrics.open_logs_page") }}
          </NuxtLink>
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>
