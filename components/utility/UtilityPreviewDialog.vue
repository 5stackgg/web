<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowUpRight, Check, Download, Film, Share2, Trash2 } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import DeleteRenderDialog from "~/components/utility/DeleteRenderDialog.vue";
import cleanMapName from "~/utilities/cleanMapName";
import { utilityLineupRoute } from "~/utilities/utilityDisplay";

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

const downloadName = computed(() => {
  const base = (props.title || "lineup")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();
  return `${base}-preview.mp4`;
});

// Copy the lineup's shareable URL -- the lineup IS the shareable thing here,
// same idea as a highlight's share link.
const linkCopied = ref(false);
async function copyLink() {
  if (!props.lineupId || typeof window === "undefined") return;
  const route = lineupRoute.value;
  const path =
    route && "query" in route && route.query?.lineup
      ? `/utility/${route.params?.map}?lineup=${route.query.lineup}`
      : `/utility/lineup/${props.lineupId}`;
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    linkCopied.value = true;
    window.setTimeout(() => (linkCopied.value = false), 1500);
  } catch {
    // Clipboard denied (insecure context / permission) -- nothing to recover.
  }
}

const showDelete = ref(false);
function onDeleted(id: string) {
  emit("deleted", id);
  emit("update:open", false);
}

// Reset transient UI whenever the modal closes.
watch(
  () => props.open,
  (v) => {
    if (!v) {
      linkCopied.value = false;
      showDelete.value = false;
    }
  },
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
        class="grid gap-0 sm:grid-cols-[minmax(0,3fr)_minmax(240px,1fr)]"
      >
        <!-- Video hero -->
        <div class="relative bg-black">
          <video
            v-if="src && open"
            :key="src"
            :src="src"
            :poster="poster ?? undefined"
            class="aspect-video w-full sm:h-full sm:rounded-l-lg"
            controls
            autoplay
            loop
            playsinline
            preload="metadata"
          />
          <div
            v-else
            class="flex aspect-video w-full items-center justify-center bg-muted/20"
          >
            <Film class="h-6 w-6 text-muted-foreground" />
          </div>
        </div>

        <!-- Info + actions sidebar -->
        <aside class="flex min-w-0 flex-col gap-3 border-l border-border/50 p-4">
          <div class="min-w-0">
            <div
              class="truncate font-mono text-sm font-semibold uppercase tracking-[0.14em] text-foreground"
            >
              {{ title || $t("pages.utility.preview.title") }}
            </div>
            <div
              class="mt-1 flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              <span>{{ cleanMapName(mapName ?? "") }}</span>
              <template v-if="seconds">
                <span aria-hidden="true" class="text-border">/</span>
                <span class="tabular-nums">{{ seconds }}s</span>
              </template>
            </div>
          </div>

          <NuxtLink
            v-if="lineupRoute"
            :to="lineupRoute"
            class="inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))] transition-colors hover:text-foreground"
            @click="emit('update:open', false)"
          >
            {{ $t("pages.utility.preview.view_lineup") }}
            <ArrowUpRight class="h-3 w-3" />
          </NuxtLink>

          <div class="mt-auto flex flex-col gap-2">
            <button
              type="button"
              class="action-tile action-tile--primary group"
              :class="linkCopied ? 'action-tile--primary-copied' : ''"
              :aria-label="
                linkCopied
                  ? $t('toasts.link_copied')
                  : $t('pages.utility.preview.copy_link')
              "
              @click.stop="copyLink"
            >
              <Check v-if="linkCopied" class="h-4 w-4" />
              <Share2 v-else class="h-4 w-4" />
              <span>{{
                linkCopied
                  ? $t("pages.utility.preview.link_copied")
                  : $t("pages.utility.preview.copy_link")
              }}</span>
            </button>

            <div class="grid grid-cols-2 gap-2">
              <a
                v-if="src"
                :href="src"
                :download="downloadName"
                target="_blank"
                rel="noopener"
                class="action-tile group"
                :class="canManage && renderId ? '' : 'col-span-2'"
              >
                <Download class="h-4 w-4" />
                <span>{{ $t("common.download") }}</span>
              </a>
              <button
                v-if="canManage && renderId"
                type="button"
                class="action-tile action-tile--danger group"
                :class="src ? '' : 'col-span-2'"
                @click="showDelete = true"
              >
                <Trash2 class="h-4 w-4" />
                <span>{{ $t("common.delete") }}</span>
              </button>
            </div>
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

<style scoped>
.action-tile {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 2.5rem;
  padding: 0 0.875rem;
  border-radius: 0.375rem;
  border: 1px solid hsl(var(--border) / 0.6);
  background: hsl(var(--card) / 0.45);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: hsl(var(--foreground) / 0.85);
  cursor: pointer;
  transition: all 150ms ease;
  user-select: none;
}
.action-tile::after {
  content: "";
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-top: 1px solid hsl(var(--tac-amber) / 0.55);
  border-right: 1px solid hsl(var(--tac-amber) / 0.55);
  transition: border-color 150ms ease;
}
.action-tile:hover {
  border-color: hsl(var(--tac-amber) / 0.6);
  background: hsl(var(--tac-amber) / 0.08);
  color: hsl(var(--foreground));
}
.action-tile:hover::after {
  border-color: hsl(var(--tac-amber));
}
.action-tile:active {
  transform: translateY(1px);
}
.action-tile--primary {
  height: 2.75rem;
  border-color: hsl(var(--tac-amber));
  background: linear-gradient(
    135deg,
    var(--tac-amber-cta-from) 0%,
    hsl(var(--tac-amber)) 50%,
    var(--tac-amber-cta-to) 100%
  );
  color: hsl(var(--tac-amber-foreground));
  font-weight: 700;
  letter-spacing: 0.18em;
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.35),
    0 6px 18px -6px hsl(var(--tac-amber) / 0.55);
}
.action-tile--primary::after {
  border-top-color: hsl(var(--tac-amber-foreground) / 0.65);
  border-right-color: hsl(var(--tac-amber-foreground) / 0.65);
}
.action-tile--primary:hover {
  transform: translateY(-1px);
  color: hsl(var(--tac-amber-foreground));
  border-color: hsl(var(--tac-amber));
  box-shadow:
    0 0 0 1px hsl(var(--tac-amber) / 0.55),
    0 12px 28px -6px hsl(var(--tac-amber) / 0.75),
    0 0 24px hsl(var(--tac-amber) / 0.35);
}
.action-tile--primary:active {
  transform: translateY(0);
}
.action-tile--primary-copied {
  animation: share-flash 480ms ease-out;
}
@keyframes share-flash {
  0% {
    box-shadow:
      0 0 0 1px hsl(var(--tac-amber)),
      0 0 32px hsl(var(--tac-amber) / 0.9);
  }
  100% {
    box-shadow:
      0 0 0 1px hsl(var(--tac-amber) / 0.55),
      0 12px 28px -6px hsl(var(--tac-amber) / 0.75);
  }
}
.action-tile--danger {
  color: hsl(var(--destructive) / 0.9);
}
.action-tile--danger::after {
  border-top-color: hsl(var(--destructive) / 0.55);
  border-right-color: hsl(var(--destructive) / 0.55);
}
.action-tile--danger:hover {
  border-color: hsl(var(--destructive) / 0.7);
  background: hsl(var(--destructive) / 0.08);
  color: hsl(var(--destructive));
}
.action-tile--danger:hover::after {
  border-top-color: hsl(var(--destructive));
  border-right-color: hsl(var(--destructive));
}
</style>
