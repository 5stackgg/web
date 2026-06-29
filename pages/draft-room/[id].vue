<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "~/stores/AuthStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useDraftRoomContext } from "~/composables/useDraftRoomContext";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import DraftRoom from "~/components/draft-games/DraftRoom.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { Button } from "~/components/ui/button";

definePageMeta({
  pageTransition: { name: "page", mode: "out-in" },
});

const { t } = useI18n();
const route = useRoute();
const draftGameId = computed(() => route.params.id as string);
const inviteCode = computed(() => route.query.invite as string | undefined);

const loadTimedOut = ref(false);
const joining = ref(false);
// Once we've actually loaded the room, a later null means it was removed (so we
// redirect). Before that, a null with an invite code means we just can't see an
// invite-only room yet — show the join prompt instead of redirecting.
const hasLoadedRoom = ref(false);

const room = computed(() => {
  const current = useDraftGamesStore().currentRoom;
  if (current && current.id === draftGameId.value) {
    return current;
  }
  return undefined;
});

const showInvitePrompt = computed(
  () =>
    !room.value &&
    useDraftGamesStore().currentRoom === null &&
    !hasLoadedRoom.value &&
    !!inviteCode.value,
);

const invitePreview = ref<any | null>(null);
const previewing = ref(false);

const loadPreview = async () => {
  if (invitePreview.value || previewing.value || !inviteCode.value) return;
  if (!useAuthStore().me) return; // guests preview after logging in
  previewing.value = true;
  try {
    const { data } = await useDraftGamesStore().previewDraftGame(
      draftGameId.value,
      inviteCode.value,
    );
    invitePreview.value = data?.previewDraftGame ?? null;
  } catch {
    invitePreview.value = null;
  } finally {
    previewing.value = false;
  }
};

watch(showInvitePrompt, (show) => {
  if (show) loadPreview();
});

const previewRoster = computed(() =>
  (invitePreview.value?.players ?? []).filter(
    (p: any) => p.status === "Accepted",
  ),
);

const joinViaInvite = async () => {
  if (!useAuthStore().me) {
    navigateTo(
      `/login?next=${encodeURIComponent(`/draft-room/${draftGameId.value}?invite=${inviteCode.value}`)}`,
    );
    return;
  }
  joining.value = true;
  try {
    await useDraftGamesStore().join(draftGameId.value, inviteCode.value);
  } finally {
    joining.value = false;
  }
};

const match = computed(() => useDraftGamesStore().currentMatch);

onMounted(() => {
  // Don't auto-join from an invite link — let the user see the room (who's in
  // it, settings) and choose to join via the in-room join prompt, which passes
  // the invite code along.
  useDraftGamesStore().subscribeToDraftGame(draftGameId.value);
});

onUnmounted(() => {
  useDraftGamesStore().unsubscribeFromDraftGame();
  useDraftGamesStore().unsubscribeFromMatch();
  useDraftRoomContext().value = null;
});

watch(
  room,
  (value) => {
    const ctx = useDraftRoomContext();
    if (value?.host) {
      ctx.value = {
        id: value.id,
        name: t("draft_games.room.host_room", { name: value.host.name }),
      };
    } else {
      ctx.value = null;
    }
  },
  { immediate: true },
);

watch(
  () => room.value?.match_id,
  (matchId, previous) => {
    if (matchId) {
      if (matchId !== previous) {
        useDraftGamesStore().subscribeToMatch(matchId);
      }
      return;
    }
    useDraftGamesStore().unsubscribeFromMatch();
  },
  { immediate: true },
);

watch(
  () => useDraftGamesStore().currentRoom,
  (value) => {
    // Only redirect when the room is genuinely gone — not when we simply can't
    // see an invite-only room yet and still have an invite code to act on.
    if (value === null && (hasLoadedRoom.value || !inviteCode.value)) {
      navigateTo("/play");
    }
  },
);

let loadTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
  if (!room.value) {
    loadTimedOut.value = true;
  }
}, 10000);

watch(room, (value) => {
  if (value) {
    hasLoadedRoom.value = true;
    loadTimedOut.value = false;
    clearTimeout(loadTimer);
    loadTimer = undefined;
  }
});

onUnmounted(() => clearTimeout(loadTimer));

const TERMINAL = ["Canceled", "Finished", "Forfeit", "Tie", "Surrendered"];

watch(
  () => match.value?.status,
  (status) => {
    if (status && TERMINAL.includes(status)) {
      navigateTo("/play");
    }
  },
);

let liveRedirect: ReturnType<typeof setTimeout> | undefined;
watch(
  () => !!match.value?.id && match.value?.status === "Live",
  (live) => {
    if (live && !liveRedirect) {
      liveRedirect = setTimeout(() => {
        if (match.value?.id) {
          navigateTo(`/matches/${match.value.id}`);
        }
      }, 4000);
    }
  },
);
onUnmounted(() => clearTimeout(liveRedirect));

</script>

<template>
  <PageTransition>
    <div>
      <DraftRoom
        v-if="room"
        :room="room"
        :match="match"
        :invite-code="inviteCode"
      />
      <!-- Invite-only room we can't see until we join — preview + choice -->
      <div
        v-else-if="showInvitePrompt"
        class="mx-auto mt-16 flex w-full max-w-md flex-col items-center gap-5 rounded-xl border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.06)] p-8 text-center"
      >
        <span
          class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
        >
          {{ $t("draft_games.room.invite_pending") }}
        </span>

        <!-- Roster preview (validated against the invite code server-side) -->
        <template v-if="invitePreview">
          <div class="flex flex-col items-center gap-1">
            <div class="text-lg font-semibold capitalize">
              {{ invitePreview.type }}
              <span class="text-muted-foreground">·</span>
              {{ invitePreview.mode }}
            </div>
            <div class="text-xs text-muted-foreground">
              <template v-if="invitePreview.host_name">
                {{
                  $t("draft_games.room.host_room", {
                    name: invitePreview.host_name,
                  })
                }}
                <span class="mx-1">·</span>
              </template>
              {{ invitePreview.accepted_count }}/{{ invitePreview.capacity }}
            </div>
          </div>

          <div
            v-if="previewRoster.length"
            class="flex w-full flex-col gap-1 rounded-lg border border-border/60 bg-background/40 p-2"
          >
            <PlayerDisplay
              v-for="p in previewRoster"
              :key="p.steam_id"
              :player="p"
              class="rounded-md p-1.5"
              :show-online="false"
              :show-elo="false"
              :show-role="false"
              :show-flag="false"
            />
          </div>
        </template>

        <div
          v-else-if="previewing"
          class="py-2 text-xs text-muted-foreground"
        >
          {{ $t("draft_games.room.loading") }}
        </div>

        <div class="flex items-center gap-3">
          <Button :loading="joining" @click="joinViaInvite">
            {{ $t("draft_games.card.join") }}
          </Button>
          <Button variant="ghost" @click="navigateTo('/play')">
            {{ $t("common.cancel") }}
          </Button>
        </div>
      </div>
      <div
        v-else-if="loadTimedOut"
        class="text-center text-muted-foreground py-12"
      >
        {{ $t("draft_games.room.load_failed") }}
      </div>
      <div v-else class="text-center text-muted-foreground py-12">
        {{ $t("draft_games.room.loading") }}
      </div>
    </div>
  </PageTransition>
</template>
