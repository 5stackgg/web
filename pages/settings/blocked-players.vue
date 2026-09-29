<script setup lang="ts">
import { useI18n } from "vue-i18n";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { toast } from "~/components/ui/toast";
import {
  usePlayerBlocks,
  type PlayerBlock,
} from "~/composables/usePlayerBlocks";

const { t } = useI18n();

useHead({ title: () => t("pages.settings.blocked_players.title") });

const { blocks, loaded, unblock } = usePlayerBlocks();

async function unblockPlayer(row: PlayerBlock) {
  try {
    await unblock(row.blocked_steam_id);
  } catch {
    return;
  }

  toast({
    title: t("player_blocks.toasts.unblocked", {
      name: row.blocked?.name ?? row.blocked_steam_id,
    }),
  });
}
</script>

<template>
  <PageTransition :delay="0">
    <div class="space-y-5">
      <p class="max-w-prose text-sm text-muted-foreground">
        {{ $t("pages.settings.blocked_players.description") }}
      </p>

      <div v-if="!loaded" class="space-y-3">
        <div
          v-for="n in 3"
          :key="n"
          class="flex items-center gap-4 rounded-lg border border-border/60 bg-card/40 p-4"
        >
          <div class="min-w-0 flex-1 space-y-2">
            <div class="h-4 w-40 animate-pulse rounded bg-muted" />
            <div class="h-3 w-56 animate-pulse rounded bg-muted/60" />
          </div>
          <div class="h-8 w-20 shrink-0 animate-pulse rounded bg-muted" />
        </div>
      </div>

      <div
        v-else-if="blocks.length === 0"
        class="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/60 bg-card/20 py-14 text-center"
      >
        <div class="space-y-1">
          <p class="text-sm font-medium">
            {{ $t("pages.settings.blocked_players.empty_title") }}
          </p>
          <p class="mx-auto max-w-sm text-xs text-muted-foreground">
            {{ $t("pages.settings.blocked_players.empty_description") }}
          </p>
        </div>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="row in blocks"
          :key="row.blocked_steam_id"
          class="group flex items-center gap-4 rounded-lg border border-border/60 bg-card/40 p-4 transition-colors hover:border-[hsl(var(--tac-amber))]/40"
        >
          <div class="min-w-0 flex-1">
            <PlayerDisplay
              :player="row.blocked ?? { steam_id: row.blocked_steam_id }"
              :linkable="true"
              :show-elo="false"
              :show-online="false"
            />
            <div
              class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground"
            >
              <span class="inline-flex items-center gap-1.5">
                <span
                  class="text-[10px] uppercase tracking-widest text-muted-foreground/60"
                >
                  {{ $t("pages.settings.blocked_players.blocked_on") }}
                </span>
                <TimeAgo :date="row.created_at" />
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            class="shrink-0"
            @click="unblockPlayer(row)"
          >
            {{ $t("player_blocks.unblock") }}
          </Button>
        </div>
      </div>
    </div>
  </PageTransition>
</template>
