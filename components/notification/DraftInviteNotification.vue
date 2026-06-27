<script setup lang="ts">
import { ref } from "vue";
import { Button } from "~/components/ui/button";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";

const props = defineProps<{
  invite: {
    draft_game_id: string;
    draft_game?: {
      id: string;
      type?: string;
      mode?: string;
      host?: { name?: string } | null;
    } | null;
  };
}>();

const submitting = ref(false);

const respond = async (accept: boolean) => {
  if (submitting.value) {
    return;
  }
  submitting.value = true;
  try {
    await useDraftGamesStore().respondInvite(props.invite.draft_game_id, accept);
    if (accept) {
      navigateTo(`/draft-room/${props.invite.draft_game_id}`);
    }
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-2 py-1">
    <div class="text-sm">
      <span class="font-semibold text-[hsl(var(--tac-amber))]">
        {{ invite.draft_game?.host?.name || $t("draft_games.host") }}
      </span>
      {{ $t("draft_games.invite.invited_you") }}
      <span class="font-medium">
        {{ invite.draft_game?.type }} {{ invite.draft_game?.mode }}
      </span>
      {{ $t("draft_games.invite.lobby") }}
    </div>
    <div class="flex gap-2">
      <Button size="sm" :disabled="submitting" @click="respond(true)">
        {{ $t("draft_games.room.accept_invite") }}
      </Button>
      <Button
        size="sm"
        variant="outline"
        :disabled="submitting"
        @click="respond(false)"
      >
        {{ $t("draft_games.room.decline_invite") }}
      </Button>
    </div>
  </div>
</template>
