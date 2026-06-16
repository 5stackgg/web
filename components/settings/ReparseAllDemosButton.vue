<script setup lang="ts">
import { onMounted } from "vue";
import { LucideRefreshCw } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import ReparseAllDemosDialog from "~/components/settings/ReparseAllDemosDialog.vue";
import { useReparseAllDemos } from "~/composables/useReparseAllDemos";

const { running, dialogOpen, ensureLoaded } = useReparseAllDemos();

// Reflect an already-running reparse on the button as soon as the page loads.
onMounted(() => {
  void ensureLoaded();
});
</script>

<template>
  <div>
    <TooltipProvider :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            type="button"
            size="sm"
            variant="outline"
            class="flex items-center gap-2"
            @click="dialogOpen = true"
          >
            <Spinner v-if="running" class="w-4 h-4" />
            <LucideRefreshCw v-else class="w-4 h-4" />
            {{ $t("pages.settings.application.demo_settings.reparse_button") }}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-[18rem]">
          {{ $t("pages.settings.application.demo_settings.reparse_warning_title") }}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    <ReparseAllDemosDialog />
  </div>
</template>
