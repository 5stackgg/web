<script setup lang="ts">
import { ref, watch } from "vue";
import { Loader2, Trash2, SlidersHorizontal } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { Spinner } from "~/components/ui/spinner";
import CreateDraftGame from "~/components/draft-games/CreateDraftGame.vue";

const props = defineProps<{
  open: boolean;
  roomId: string;
}>();

const emit = defineEmits<{
  (event: "close"): void;
}>();

const draftGame = ref<any | undefined>(undefined);
const loading = ref(false);
const canceling = ref(false);

const load = async () => {
  loading.value = true;
  draftGame.value = undefined;
  const { data } = await getGraphqlClient().query({
    query: generateQuery({
      draft_games_by_pk: [
        { id: $("id", "uuid!") },
        {
          id: true,
          host_steam_id: true,
          status: true,
          mode: true,
          access: true,
          type: true,
          regions: true,
          map_pool_id: true,
          team_1_id: true,
          team_2_id: true,
          captain_selection: true,
          draft_order: true,
          require_approval: true,
          min_elo: true,
          max_elo: true,
          options: {
            ...matchOptionsFields,
          },
        },
      ],
    }),
    variables: {
      id: props.roomId,
    },
  });
  draftGame.value = data.draft_games_by_pk;
  loading.value = false;
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      load();
    }
  },
);

const onSaved = () => {
  emit("close");
};

const cancelDraft = () => {
  if (canceling.value) {
    return;
  }
  canceling.value = true;
  useDraftGamesStore().cancelDraftRoom(props.roomId);
};
</script>

<template>
  <Sheet
    :open="open"
    @update:open="(o) => o === false && emit('close')"
  >
    <SheetContent
      class="flex w-full flex-col gap-0 overflow-y-auto border-l-[hsl(var(--tac-amber)/0.25)] sm:max-w-3xl"
    >
      <SheetHeader class="border-b border-border/60 pb-4 text-left">
        <div class="flex items-start justify-between gap-3 pr-8">
          <div>
            <SheetTitle
              class="flex items-center gap-2 font-sans text-base font-bold uppercase tracking-[0.18em]"
            >
              <SlidersHorizontal class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
              {{ $t("draft_games.room.match_settings") }}
            </SheetTitle>
            <SheetDescription class="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.14em]">
              {{ $t("draft_games.room.edit_settings") }}
            </SheetDescription>
          </div>
          <button
            type="button"
            class="cancel-draft"
            :disabled="canceling"
            @click="cancelDraft"
          >
            <Loader2 v-if="canceling" class="h-3.5 w-3.5 animate-spin" />
            <Trash2 v-else class="h-3.5 w-3.5" />
            {{ $t("draft_games.room.cancel_draft") }}
          </button>
        </div>
      </SheetHeader>

      <div class="flex-1 pt-5">
        <div
          v-if="loading"
          class="flex items-center justify-center py-16 text-muted-foreground"
        >
          <Spinner />
        </div>
        <CreateDraftGame
          v-else-if="draftGame"
          :initial="draftGame"
          :editing="true"
          @created="onSaved"
        />
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.cancel-draft {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.4rem;
  border-radius: 0.4rem;
  border: 1px solid hsl(var(--destructive) / 0.4);
  background: hsl(var(--destructive) / 0.08);
  padding: 0.4rem 0.6rem;
  font-family: var(--font-sans);
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: hsl(var(--destructive));
  cursor: pointer;
  transition: all 0.15s ease;
}
.cancel-draft:hover:not(:disabled) {
  background: hsl(var(--destructive) / 0.16);
  border-color: hsl(var(--destructive) / 0.6);
}
.cancel-draft:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
