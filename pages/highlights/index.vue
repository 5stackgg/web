<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { ListVideo } from "lucide-vue-next";
import { useAuthStore } from "~/stores/AuthStore";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "~/components/ui/sheet";
import RenderQueuePanel from "~/components/clips/RenderQueuePanel.vue";
import HighlightsBrowser from "~/components/clips/HighlightsBrowser.vue";
import { useClipModal } from "~/composables/useClipModal";

definePageMeta({
  persistQueryKeys: ["player", "since", "kills", "view", "sort"],
});

const { activeClipId } = useClipModal();

const auth = useAuthStore();
const canCurate = computed(
  () =>
    auth.isAdmin ||
    auth.isStreamer ||
    auth.isMatchOrganizer ||
    auth.isTournamentOrganizer,
);

const queueOpen = ref(false);

// Auto-close the render-queue sheet when any clip modal opens so the
// modal isn't sandwiched under the sheet's overlay.
watch(activeClipId, (id) => {
  if (id && queueOpen.value) queueOpen.value = false;
});

const activeClips = ref(0);
const queuedClips = ref(0);
const pendingClips = computed(() => activeClips.value + queuedClips.value);
let pendingSub: { unsubscribe: () => void } | null = null;
function subscribePending() {
  pendingSub?.unsubscribe();
  pendingSub = null;
  activeClips.value = 0;
  queuedClips.value = 0;
  if (!canCurate.value) return;
  const obs = getGraphqlClient().subscribe({
    query: generateSubscription({
      clip_render_jobs: [
        {
          where: {
            status: { _in: ["queued", "rendering", "uploading"] },
          },
          limit: 500,
        } as any,
        { id: true, status: true },
      ],
    } as any),
  });
  pendingSub = obs.subscribe({
    next: ({ data }: any) => {
      const rows: Array<{ status: string }> = data?.clip_render_jobs ?? [];
      let active = 0;
      let queued = 0;
      for (const r of rows) {
        if (r.status === "queued") queued++;
        else active++;
      }
      activeClips.value = active;
      queuedClips.value = queued;
    },
    error: (err: any) => {
      console.error("[highlights] pending count subscription error:", err);
    },
  });
}
watch(canCurate, subscribePending, { immediate: true });

onBeforeUnmount(() => {
  pendingSub?.unsubscribe();
});
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.highlights.title") }}</h1>

  <HighlightsBrowser>
    <template v-if="canCurate" #actions>
      <Sheet v-model:open="queueOpen">
        <SheetTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            class="relative h-8 gap-1.5 max-md:px-2"
            :title="$t('pages.highlights.queue')"
            :class="{
              'border-[hsl(var(--tac-amber)/0.55)] text-[hsl(var(--tac-amber))]':
                queueOpen,
            }"
          >
            <ListVideo class="w-4 h-4" />
            <span class="max-md:sr-only">{{
              $t("pages.highlights.queue")
            }}</span>
            <span
              v-if="queuedClips > 0"
              class="inline-flex items-center rounded-full border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.15)] px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold tabular-nums text-[hsl(var(--tac-amber))]"
            >
              {{ queuedClips }}
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" class="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle class="flex items-center gap-2">
              <ListVideo class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
              {{ $t("pages.highlights.render_queue") }}
            </SheetTitle>
            <SheetDescription>
              {{ $t("pages.highlights.render_queue_description") }}
            </SheetDescription>
          </SheetHeader>
          <div class="mt-6">
            <RenderQueuePanel />
          </div>
        </SheetContent>
      </Sheet>
    </template>
  </HighlightsBrowser>
</template>
