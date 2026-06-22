<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "~/stores/AuthStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useDraftRoomContext } from "~/composables/useDraftRoomContext";
import { toast } from "~/components/ui/toast";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import DraftRoom from "~/components/draft-games/DraftRoom.vue";

definePageMeta({
  pageTransition: { name: "page", mode: "out-in" },
});

const { t } = useI18n();
const route = useRoute();
const draftGameId = computed(() => route.params.id as string);

const loadTimedOut = ref(false);
const wasMember = ref(false);

const room = computed(() => {
  const current = useDraftGamesStore().currentRoom;
  if (current && current.id === draftGameId.value) {
    return current;
  }
  return undefined;
});

const match = computed(() => useDraftGamesStore().currentMatch);

onMounted(() => {
  useDraftGamesStore().subscribeToDraftGame(draftGameId.value);
  const invite = route.query.invite as string | undefined;
  if (invite) {
    useDraftGamesStore().join(draftGameId.value, invite);
  }
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
    if (
      value?.players?.some(
        (p: any) => p.steam_id === useAuthStore().me?.steam_id,
      )
    ) {
      wasMember.value = true;
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
    if (value === null) {
      toast({
        title: wasMember.value
          ? t("draft_games.room.removed")
          : t("draft_games.room.unavailable"),
        variant: "destructive",
      });
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
      <DraftRoom v-if="room" :room="room" :match="match" />
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
