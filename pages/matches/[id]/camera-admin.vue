<script setup lang="ts">
import { computed } from "vue";
import CameraGrid from "~/components/match/CameraGrid.vue";
import { useMatchCameraStatus } from "~/composables/useMatchCameraStatus";

// Opened in a popup from the match page so an organizer can keep the whole
// roster on screen alongside it.
definePageMeta({
  layout: false,
});

const route = useRoute();
const matchId = computed(() => String(route.params.id));

const { summary, loaded } = useMatchCameraStatus(() => matchId.value);
</script>

<template>
  <div class="relative min-h-screen bg-background text-foreground">
    <div
      class="pointer-events-none fixed inset-x-0 top-0 h-56 bg-[radial-gradient(65%_100%_at_50%_0%,hsl(var(--tac-amber)/0.09),transparent_75%)]"
    ></div>

    <header
      class="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur"
    >
      <div
        class="mx-auto flex w-full max-w-[120rem] flex-wrap items-center justify-between gap-3 px-4 py-3"
      >
        <div class="flex min-w-0 items-center gap-[0.6rem]">
          <span
            class="h-[2px] w-[10px] shrink-0 bg-[hsl(var(--tac-amber))]"
          ></span>
          <div class="min-w-0">
            <h1
              class="truncate font-mono text-[0.72rem] font-semibold uppercase tracking-[0.24em]"
            >
              {{ $t("camera.admin_title") }}
            </h1>
            <p
              class="truncate font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground/70"
            >
              {{ $t("camera.admin_subtitle") }}
            </p>
          </div>
        </div>

        <div v-if="loaded" class="flex shrink-0 items-center gap-2">
          <span
            class="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-emerald-400"
          >
            <span
              class="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"
            ></span>
            {{
              $t("camera.admin_live_count", {
                live: summary.live,
                total: summary.total,
              })
            }}
          </span>

          <span
            v-if="summary.stalled"
            class="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-destructive"
          >
            <span
              class="inline-flex h-1.5 w-1.5 rounded-full bg-destructive"
            ></span>
            {{ $t("camera.admin_stalled_count", { count: summary.stalled }) }}
          </span>
        </div>
      </div>
    </header>

    <main class="relative mx-auto w-full max-w-[120rem] px-4 py-5">
      <CameraGrid :match-id="matchId" />
    </main>
  </div>
</template>
