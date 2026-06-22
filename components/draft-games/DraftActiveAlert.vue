<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";
import { X } from "lucide-vue-next";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useAuthStore } from "~/stores/AuthStore";

const route = useRoute();

const room = computed(() => useDraftGamesStore().myDraftGame);

const draftGameId = computed(() => room.value?.id ?? null);

const isAlertable = computed(() => {
  const r = room.value;
  if (!r || r.match_id) {
    return false;
  }
  const me = useAuthStore().me?.steam_id;
  return (
    r.host_steam_id === me ||
    (r.players || []).some(
      (p: any) => p.steam_id === me && p.status === "Accepted",
    )
  );
});

const accepted = computed(
  () =>
    (room.value?.players || []).filter((p: any) => p.status === "Accepted")
      .length,
);

const roomKey = computed(() =>
  room.value ? `${room.value.id}:${room.value.status}` : null,
);

const isOnDraftPage = computed(() => route.path.startsWith("/draft-room"));

const acknowledgedKey = ref<string | null>(null);

watch(roomKey, (next) => {
  if (next !== acknowledgedKey.value) {
    acknowledgedKey.value = null;
  }
});

const rawShow = computed(
  () =>
    isAlertable.value &&
    !isOnDraftPage.value &&
    acknowledgedKey.value !== roomKey.value,
);

const shouldShow = ref(false);
let showTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  rawShow,
  (show) => {
    clearTimeout(showTimer);
    if (show) {
      showTimer = setTimeout(() => (shouldShow.value = true), 600);
    } else {
      shouldShow.value = false;
    }
  },
  { immediate: true },
);

onUnmounted(() => clearTimeout(showTimer));

const acknowledge = () => {
  acknowledgedKey.value = roomKey.value;
};
</script>

<template>
  <AlertDialog :open="shouldShow">
    <AlertDialogContent
      class="!max-w-md !gap-0 overflow-visible !border-0 !bg-transparent !p-0 !shadow-none"
    >
      <div
        class="relative overflow-hidden rounded-lg border border-border px-6 py-8 [backdrop-filter:blur(10px)] [background:linear-gradient(180deg,hsl(var(--card)/0.95)_0%,hsl(var(--card)/0.85)_100%)] [box-shadow:0_0_0_1px_hsl(var(--tac-amber)/0.3),0_0_40px_hsl(var(--tac-amber)/0.18)]"
      >
        <span
          aria-hidden="true"
          class="pointer-events-none absolute left-2 top-2 h-[14px] w-[14px] border-l-2 border-t-2 border-[hsl(var(--tac-amber))]"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute bottom-2 right-2 h-[14px] w-[14px] border-b-2 border-r-2 border-[hsl(var(--tac-amber))]"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(180deg,transparent_0,transparent_3px,hsl(var(--tac-amber)/0.04)_3px,hsl(var(--tac-amber)/0.04)_4px)]"
        ></span>

        <div class="relative z-10 flex flex-col items-center gap-5 text-center">
          <div
            class="inline-flex items-center gap-2 font-mono text-[0.72rem] font-bold uppercase tracking-[0.28em] text-[hsl(var(--tac-amber))]"
          >
            <span
              class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
            ></span>
            {{ $t("draft_games.active_alert_title") }}
            <span
              class="h-1 w-1 rounded-full animate-soft-pulse bg-[hsl(var(--tac-amber))]"
            ></span>
          </div>

          <div class="font-sans text-sm leading-snug text-muted-foreground">
            {{ $t("draft_games.active_alert_desc") }}
          </div>

          <NuxtLink
            :to="`/draft-room/${draftGameId}`"
            class="tac-amber-cta relative isolate mt-2 inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-md border px-6 py-4 font-sans text-sm font-bold uppercase leading-none tracking-[0.22em]"
            @click="acknowledge"
          >
            <span
              class="inline-block h-[2px] w-[12px] bg-[hsl(var(--tac-amber-foreground))]/70"
            ></span>
            {{ $t("draft_games.room.go_to_room") }}
            <span
              v-if="room"
              class="font-mono tabular-nums opacity-80"
            >
              {{ accepted }}/{{ room.capacity }}
            </span>
            <span
              class="inline-block h-[2px] w-[12px] bg-[hsl(var(--tac-amber-foreground))]/70"
            ></span>
          </NuxtLink>
        </div>

        <button
          type="button"
          class="absolute right-3 top-3 z-20 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          :aria-label="$t('common.close')"
          @click="acknowledge"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </AlertDialogContent>
  </AlertDialog>
</template>
