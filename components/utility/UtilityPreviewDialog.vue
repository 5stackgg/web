<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowUpRight, Film, Trash2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import ClipPlayer from "~/components/clips/ClipPlayer.vue";
import ClipShareMenu from "~/components/clips/ClipShareMenu.vue";
import DeleteRenderDialog from "~/components/utility/DeleteRenderDialog.vue";
import cleanMapName from "~/utilities/cleanMapName";
import { clipDownloadUrl } from "~/utilities/clipDownloadName";
import {
  utilityClipFileName,
  utilityLineupRoute,
} from "~/utilities/utilityDisplay";
import { useClipFileSize } from "~/composables/useClipFileSize";
import { useUtilityLineupShare } from "~/composables/useUtilityLineupShare";

const props = defineProps<{
  open: boolean;
  renderId?: string | null;
  src: string | null;
  poster?: string | null;
  title?: string | null;
  mapName?: string | null;
  lineupId?: string | null;
  durationMs?: number | null;
  canManage?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "deleted", renderId: string): void;
}>();

const lineupRoute = computed(() =>
  props.lineupId
    ? utilityLineupRoute(props.mapName ?? null, props.lineupId)
    : null,
);

const seconds = computed(() =>
  props.durationMs && props.durationMs > 0
    ? Math.round(props.durationMs / 1000)
    : null,
);

const downloadName = computed(() =>
  utilityClipFileName(props.mapName, props.title),
);
const downloadHref = computed(() =>
  props.src ? clipDownloadUrl(props.src, downloadName.value) : null,
);
const fileSize = useClipFileSize(() => (props.open ? props.src : null));

const { copiedLineupId, shareLineup } = useUtilityLineupShare();
const linkCopied = computed(
  () => !!props.lineupId && copiedLineupId.value === props.lineupId,
);

function copyLink() {
  if (!props.lineupId) {
    return;
  }
  void shareLineup(props.mapName, props.lineupId);
}

const showDelete = ref(false);
function onDeleted(id: string) {
  emit("deleted", id);
  emit("update:open", false);
}

// Same shared surface the clip modal uses, so playback is driven the same way:
// the player never autoplays itself, the consumer calls play() once its clip is
// mounted.
const playerRef = ref<InstanceType<typeof ClipPlayer> | null>(null);

// A lineup preview is a couple of seconds of one throw -- it is meant to be
// watched over and over, so replay on end rather than leaving a dead frame.
function replay() {
  void playerRef.value?.play();
}

// The player itself is a watch source: the dialog's content mounts a beat after
// `open` flips, so keying off `open` alone reaches for a ref that is still null
// and the preview just sits on its poster.
watch(
  [() => props.open, () => props.src, playerRef],
  ([open, src, player]) => {
    // Reset transient UI whenever the modal closes.
    if (!open) {
      showDelete.value = false;
      return;
    }
    if (src && player) void player.play();
  },
  { flush: "post" },
);
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent
      class="max-w-5xl border-border/60 bg-background/95 p-0"
    >
      <DialogTitle class="sr-only">
        {{ title || $t("pages.utility.preview.title") }}
      </DialogTitle>
      <DialogDescription class="sr-only">
        {{ $t("pages.utility.preview.title") }}
      </DialogDescription>

      <div
        class="grid gap-4 p-4 sm:grid-cols-[minmax(0,3fr)_minmax(240px,1fr)] sm:gap-5 sm:p-5"
      >
        <!-- Video hero -->
        <div class="min-w-0">
          <ClipPlayer
            ref="playerRef"
            :src="src"
            :poster="poster ?? null"
            :clip-key="renderId ?? src"
            @ended="replay"
          >
            <template #empty>
              <div
                class="absolute inset-0 flex items-center justify-center bg-muted/20"
              >
                <Film class="h-6 w-6 text-muted-foreground" />
              </div>
            </template>
            <template #top-right>
              <ClipShareMenu
                v-if="lineupId || downloadHref"
                :copied="linkCopied"
                :copy-label="$t('pages.utility.detail.copy_link')"
                :download-href="downloadHref"
                :download-name="downloadName"
                :download-label="$t('pages.utility.detail.download_clip')"
                :size-label="fileSize"
                content-class="z-[70]"
                @copy="copyLink"
              />
            </template>
            <template #top-left>
              <h2
                class="min-w-0 truncate font-mono text-sm font-semibold uppercase tracking-[0.14em] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)] sm:text-base"
                :title="title || $t('pages.utility.preview.title')"
              >
                {{ title || $t("pages.utility.preview.title") }}
              </h2>
            </template>
            <template #bottom>
              <div
                class="flex min-w-0 items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-white/60"
              >
                <span class="truncate">{{ cleanMapName(mapName ?? "") }}</span>
                <template v-if="seconds">
                  <span aria-hidden="true" class="text-white/30">/</span>
                  <span class="shrink-0 tabular-nums">{{ seconds }}s</span>
                </template>
              </div>
            </template>
          </ClipPlayer>
        </div>

        <!-- Info + actions sidebar -->
        <aside class="flex min-w-0 flex-col gap-3">
          <NuxtLink
            v-if="lineupRoute"
            :to="lineupRoute"
            class="inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))] transition-colors hover:text-foreground"
            @click="emit('update:open', false)"
          >
            {{ $t("pages.utility.preview.view_lineup") }}
            <ArrowUpRight class="h-3 w-3" />
          </NuxtLink>

          <div
            v-if="canManage && renderId"
            class="mt-auto flex items-center justify-end"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-white/60 hover:text-destructive"
              :aria-label="$t('common.delete')"
              :title="$t('common.delete')"
              @click="showDelete = true"
            >
              <Trash2 />
            </Button>
          </div>
        </aside>
      </div>

      <DeleteRenderDialog
        v-model="showDelete"
        :render-id="renderId ?? null"
        :title="title ?? null"
        @deleted="onDeleted"
      />
    </DialogContent>
  </Dialog>
</template>
