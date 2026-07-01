<script setup lang="ts">
import { LucideSearch } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useOrphanedScan } from "~/composables/useOrphanedScan";

// The dialog itself is mounted once globally in the default layout so it can be
// opened from anywhere (e.g. the completion notification); this button just
// flips the shared open state.
const { scanning, dialogOpen } = useOrphanedScan();
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
            <Spinner v-if="scanning" class="w-4 h-4" />
            <LucideSearch v-else class="w-4 h-4" />
            {{
              $t(
                "pages.settings.application.demo_settings.orphaned_open_button",
              )
            }}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-[18rem]">
          {{ $t("pages.settings.application.demo_settings.orphaned_tooltip") }}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>
