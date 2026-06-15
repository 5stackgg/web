<script setup lang="ts">
import { watch } from "vue";
import { LucideTrash2, LucideRefreshCw, LucideSearch } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import formatBytes from "~/utilities/formatBytes";
import StorageBreakdown from "~/components/settings/StorageBreakdown.vue";
import { useOrphanedScan } from "~/composables/useOrphanedScan";

const {
  scanning,
  deleting,
  loading,
  result,
  dialogOpen,
  startScan,
  deleteOrphans,
  ensureLoaded,
} = useOrphanedScan();

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
    <DialogContent class="sm:max-w-[640px]">
      <DialogHeader>
        <div class="flex items-start justify-between gap-3 pr-6">
          <DialogTitle class="flex items-center gap-2">
            <LucideSearch class="h-4 w-4" />
            {{ $t("pages.settings.application.demo_settings.orphaned_title") }}
          </DialogTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            :disabled="scanning"
            class="flex items-center gap-2 shrink-0"
            @click="startScan"
          >
            <Spinner v-if="scanning" class="h-4 w-4" />
            <LucideRefreshCw v-else class="h-4 w-4" />
            {{
              scanning
                ? $t("pages.settings.application.demo_settings.orphaned_scanning_short")
                : result?.found
                  ? $t("pages.settings.application.demo_settings.orphaned_rescan")
                  : $t(
                      "pages.settings.application.demo_settings.orphaned_scan_now",
                    )
            }}
          </Button>
        </div>
        <DialogDescription>
          {{
            $t(
              "pages.settings.application.demo_settings.orphaned_dialog_description",
            )
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <StorageBreakdown />

        <div
          v-if="loading && !result"
          class="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Spinner class="h-4 w-4" />
        </div>

        <p v-else-if="!result?.found" class="text-sm text-muted-foreground">
          {{ $t("pages.settings.application.demo_settings.orphaned_no_results") }}
        </p>

        <template v-else>
          <p class="text-xs text-muted-foreground">
            {{
              $t("pages.settings.application.demo_settings.orphaned_last_scanned")
            }}:
            {{
              result.scanned_at
                ? new Date(result.scanned_at).toLocaleString()
                : ""
            }}
            <span v-if="result.bucket"> · {{ result.bucket }}</span>
          </p>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="rounded-md border p-3">
              <div class="text-xs text-muted-foreground">
                {{
                  $t(
                    "pages.settings.application.demo_settings.orphaned_total_size",
                  )
                }}
              </div>
              <div class="text-lg font-semibold">
                {{ formatBytes(result.total_bytes) }}
              </div>
            </div>
            <div class="rounded-md border p-3">
              <div class="text-xs text-muted-foreground">
                {{
                  $t("pages.settings.application.demo_settings.orphaned_tracked")
                }}
              </div>
              <div class="text-lg font-semibold">
                {{ formatBytes(result.tracked_bytes) }}
              </div>
            </div>
            <div
              class="rounded-md border p-3"
              :class="
                result.orphan_objects > 0
                  ? 'border-destructive/40'
                  : 'border-emerald-500/40'
              "
            >
              <div class="text-xs text-muted-foreground">
                {{
                  $t("pages.settings.application.demo_settings.orphaned_orphaned")
                }}
              </div>
              <div
                class="text-lg font-semibold"
                :class="
                  result.orphan_objects > 0
                    ? 'text-destructive'
                    : 'text-emerald-500'
                "
              >
                {{ formatBytes(result.orphan_bytes) }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{
                  $t(
                    "pages.settings.application.demo_settings.orphaned_object_count",
                    { count: result.orphan_objects },
                  )
                }}
              </div>
            </div>
            <div class="rounded-md border p-3">
              <div class="text-xs text-muted-foreground">
                {{
                  $t("pages.settings.application.demo_settings.orphaned_other")
                }}
              </div>
              <div class="text-lg font-semibold">
                {{ formatBytes(result.other_bytes) }}
              </div>
            </div>
          </div>


          <template v-if="result.orphan_objects > 0">
            <div class="text-sm font-medium">
              {{
                $t("pages.settings.application.demo_settings.orphaned_largest")
              }}
            </div>
            <div class="max-h-64 overflow-y-auto rounded-md border divide-y">
              <div
                v-for="orphan in result.orphans"
                :key="orphan.key"
                class="flex items-center justify-between gap-3 px-3 py-2 text-xs"
              >
                <span class="truncate font-mono" :title="orphan.key">
                  {{ orphan.key }}
                </span>
                <span class="shrink-0 text-muted-foreground">
                  {{ formatBytes(orphan.size) }}
                </span>
              </div>
            </div>
            <p
              v-if="result.orphan_objects > result.orphans.length"
              class="text-xs text-muted-foreground"
            >
              {{
                $t("pages.settings.application.demo_settings.orphaned_more", {
                  count: result.orphan_objects - result.orphans.length,
                })
              }}
            </p>

            <div class="flex justify-end">
              <Button
                type="button"
                variant="destructive"
                :disabled="deleting"
                class="flex items-center gap-2"
                @click="deleteOrphans"
              >
                <Spinner v-if="deleting" class="h-4 w-4" />
                <LucideTrash2 v-else class="h-4 w-4" />
                {{
                  $t(
                    "pages.settings.application.demo_settings.orphaned_delete_all",
                  )
                }}
              </Button>
            </div>
          </template>

          <p v-else class="text-sm text-muted-foreground">
            {{
              $t("pages.settings.application.demo_settings.orphaned_none_found")
            }}
          </p>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>
