<script setup lang="ts">
import { watch } from "vue";
import { LucideRefreshCw, LucideTriangleAlert } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Progress } from "~/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useReparseAllDemos } from "~/composables/useReparseAllDemos";

const {
  status,
  running,
  progress,
  starting,
  canceling,
  dialogOpen,
  startReparse,
  cancelReparse,
  ensureLoaded,
} = useReparseAllDemos();

watch(
  dialogOpen,
  (open) => {
    if (open) {
      void ensureLoaded();
    }
  },
  { immediate: true },
);

function close(value: boolean) {
  dialogOpen.value = value;
}
</script>

<template>
  <Dialog :open="dialogOpen" @update:open="close">
    <DialogContent class="sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <LucideRefreshCw class="h-4 w-4" />
          {{ $t("pages.settings.application.demo_settings.reparse_confirm_title") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("pages.settings.application.demo_settings.reparse_confirm_body") }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div
          class="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3"
        >
          <LucideTriangleAlert
            class="mt-0.5 h-5 w-5 shrink-0 text-destructive"
          />
          <div class="flex flex-col gap-1 text-sm">
            <span class="font-semibold text-destructive">{{
              $t("pages.settings.application.demo_settings.reparse_warning_title")
            }}</span>
            <span class="text-muted-foreground">{{
              $t("pages.settings.application.demo_settings.reparse_warning_body")
            }}</span>
          </div>
        </div>

        <div v-if="running" class="flex flex-col gap-2">
          <div
            class="flex items-center justify-between text-sm font-mono tabular-nums"
          >
            <span class="flex items-center gap-2">
              <Spinner class="h-4 w-4" />
              {{ $t("pages.settings.application.demo_settings.reparse_running") }}
            </span>
            <span class="text-muted-foreground">
              {{ status?.completed ?? 0 }} / {{ status?.total ?? 0 }} ({{
                progress
              }}%)
            </span>
          </div>
          <Progress :model-value="progress" />
          <span
            v-if="(status?.failed ?? 0) > 0"
            class="text-xs text-destructive"
          >
            {{
              $t(
                "pages.settings.application.demo_settings.reparse_failed_count",
                { count: status?.failed ?? 0 },
              )
            }}
          </span>
        </div>

        <p
          v-else-if="status?.finished_at"
          class="text-xs text-muted-foreground tabular-nums"
        >
          {{
            $t("pages.settings.application.demo_settings.reparse_last_run", {
              completed: status?.completed ?? 0,
              total: status?.total ?? 0,
              failed: status?.failed ?? 0,
            })
          }}
        </p>

        <div class="flex justify-end">
          <Button
            v-if="running"
            type="button"
            variant="outline"
            :disabled="canceling"
            class="flex items-center gap-2"
            @click="cancelReparse"
          >
            <Spinner v-if="canceling" class="h-4 w-4" />
            {{ $t("pages.settings.application.demo_settings.reparse_cancel") }}
          </Button>
          <Button
            v-else
            type="button"
            :disabled="starting"
            class="flex items-center gap-2"
            @click="startReparse"
          >
            <Spinner v-if="starting" class="h-4 w-4" />
            <LucideRefreshCw v-else class="h-4 w-4" />
            {{
              $t("pages.settings.application.demo_settings.reparse_confirm_action")
            }}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
