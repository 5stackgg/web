<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { Check, X, Inbox, Search } from "lucide-vue-next";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { toast } from "~/components/ui/toast";

const { t } = useI18n();

const props = defineProps<{
  draftGameId: string;
  requests: Array<any>;
  canManage: boolean;
  full: boolean;
  compact?: boolean;
}>();

const search = ref("");
const sort = ref<"elo_high" | "elo_low" | "recent">("elo_high");
const minRank = ref("");
const maxRank = ref("");

const sortOptions = [
  { value: "elo_high", label: "draft_games.room.sort_elo_high" },
  { value: "elo_low", label: "draft_games.room.sort_elo_low" },
  { value: "recent", label: "draft_games.room.sort_recent" },
];

const visible = computed(() => {
  let list = [...props.requests];
  const term = search.value.trim().toLowerCase();
  if (term) {
    list = list.filter((r) =>
      (r.player?.name || "").toLowerCase().includes(term),
    );
  }
  const min = minRank.value ? Number(minRank.value) : null;
  const max = maxRank.value ? Number(maxRank.value) : null;
  if (min !== null) {
    list = list.filter((r) => (r.elo_snapshot || 0) >= min);
  }
  if (max !== null) {
    list = list.filter((r) => (r.elo_snapshot || 0) <= max);
  }
  list.sort((a, b) => {
    if (sort.value === "elo_low") {
      return (a.elo_snapshot || 0) - (b.elo_snapshot || 0);
    }
    if (sort.value === "recent") {
      return (b.joined_at || "").localeCompare(a.joined_at || "");
    }
    return (b.elo_snapshot || 0) - (a.elo_snapshot || 0);
  });
  return list;
});

const pending = ref<Set<string>>(new Set());

const isPending = (steamId: string) => pending.value.has(steamId);

const runGuarded = async (steamId: string, action: () => Promise<unknown>) => {
  if (pending.value.has(steamId)) {
    return;
  }
  pending.value = new Set(pending.value).add(steamId);
  try {
    await action();
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message,
    });
  } finally {
    const next = new Set(pending.value);
    next.delete(steamId);
    pending.value = next;
  }
};

const approve = (steamId: string) => {
  return runGuarded(steamId, () =>
    useDraftGamesStore().approve(props.draftGameId, steamId),
  );
};
const deny = (steamId: string) => {
  return runGuarded(steamId, () =>
    useDraftGamesStore().deny(props.draftGameId, steamId),
  );
};
</script>

<template>
  <div class="flex h-full flex-col">
    <div v-if="!compact" class="mb-3 flex items-center gap-2">
      <Inbox class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
      <h3
        class="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
      >
        {{ $t("draft_games.room.queue") }}
      </h3>
      <span
        v-if="requests.length > 0"
        class="rounded-full border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] px-2 py-0.5 font-mono text-[0.62rem] font-bold text-[hsl(var(--tac-amber))]"
      >
        {{ visible.length }}/{{ requests.length }}
      </span>
    </div>

    <div v-if="!compact" class="mb-3 flex flex-wrap items-center gap-2">
      <div class="relative min-w-[160px] flex-1">
        <Search
          class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="search"
          :placeholder="$t('draft_games.room.search_requests')"
          class="h-8 pl-7 text-xs"
        />
      </div>
      <select
        v-model="sort"
        class="h-8 rounded-md border border-border bg-card px-2 text-xs text-muted-foreground"
      >
        <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
          {{ $t(opt.label) }}
        </option>
      </select>
      <div class="flex items-center gap-1">
        <Input
          v-model="minRank"
          type="number"
          inputmode="numeric"
          :placeholder="$t('draft_games.room.min')"
          class="h-8 w-20 text-xs"
        />
        <span class="text-muted-foreground">–</span>
        <Input
          v-model="maxRank"
          type="number"
          inputmode="numeric"
          :placeholder="$t('draft_games.room.max')"
          class="h-8 w-20 text-xs"
        />
      </div>
    </div>

    <div class="queue-scroll flex-1 overflow-y-auto pr-1">
      <TransitionGroup
        name="queue"
        tag="div"
        class="grid gap-1.5"
        :class="compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'"
      >
        <div
          v-for="request in visible"
          :key="request.steam_id"
          class="queue-row flex items-center gap-2 rounded-md border border-border/70 bg-card/50 px-2 py-1.5"
        >
          <Avatar class="h-6 w-6 shrink-0 rounded">
            <AvatarImage :src="request.player?.avatar_url" />
            <AvatarFallback class="rounded text-[0.6rem]">
              {{ (request.player?.name || "?").slice(0, 1) }}
            </AvatarFallback>
          </Avatar>
          <span class="min-w-0 flex-1 truncate text-xs font-medium">
            {{ request.player?.name }}
          </span>
          <span
            v-if="request.elo_snapshot"
            class="shrink-0 font-mono text-[0.62rem] font-bold text-[hsl(var(--tac-amber))]"
          >
            {{ Math.round(request.elo_snapshot) }}
          </span>
          <div v-if="canManage" class="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              class="queue-btn"
              :class="full ? 'backup' : 'approve'"
              :disabled="isPending(request.steam_id)"
              :title="
                full
                  ? $t('draft_games.room.accept_backup')
                  : $t('draft_games.room.accept')
              "
              @click="approve(request.steam_id)"
            >
              <Check class="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              class="queue-btn deny"
              :disabled="isPending(request.steam_id)"
              :title="$t('draft_games.room.deny')"
              @click="deny(request.steam_id)"
            >
              <X class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </TransitionGroup>

      <div
        v-if="visible.length === 0"
        class="py-6 text-center text-xs text-muted-foreground/50"
      >
        {{
          requests.length === 0
            ? $t("draft_games.room.queue_empty")
            : $t("draft_games.room.no_matches")
        }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.queue-scroll {
  max-height: 30rem;
  min-height: 8rem;
}
.queue-btn {
  display: grid;
  place-items: center;
  height: 1.5rem;
  width: 1.5rem;
  padding: 0;
  border-radius: 0.3rem;
  border: 1px solid;
  transition: all 0.15s ease;
}
.queue-btn:disabled {
  opacity: 0.5;
  cursor: default;
  pointer-events: none;
}
.queue-btn.approve {
  color: hsl(var(--success, 142 70% 45%));
  border-color: hsl(var(--success, 142 70% 45%) / 0.4);
  background: hsl(var(--success, 142 70% 45%) / 0.1);
}
.queue-btn.approve:hover:not(:disabled) {
  background: hsl(var(--success, 142 70% 45%) / 0.25);
}
.queue-btn.backup {
  color: hsl(var(--tac-amber));
  border-color: hsl(var(--tac-amber) / 0.4);
  background: hsl(var(--tac-amber) / 0.1);
}
.queue-btn.backup:hover {
  background: hsl(var(--tac-amber) / 0.25);
}
.queue-btn.deny {
  color: hsl(var(--destructive));
  border-color: hsl(var(--destructive) / 0.4);
  background: hsl(var(--destructive) / 0.1);
}
.queue-btn.deny:hover {
  background: hsl(var(--destructive) / 0.25);
}
.queue-enter-active,
.queue-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.queue-enter-from,
.queue-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
