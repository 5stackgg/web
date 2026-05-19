<script lang="ts" setup>
import { ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import cleanMapName from "~/utilities/cleanMapName";
import { $, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";

const props = defineProps<{
  open: boolean;
  matchId: string;
  steamId: string | number | null | undefined;
  playerName: string | null | undefined;
  kills: number;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

type DrilldownRow = {
  match_map_id: string;
  round: number;
  map_name: string | null;
};

const rounds = ref<DrilldownRow[] | null>(null);

// Group raw player_kills client-side. v_player_multi_kills doesn't expose
// match_map_id and merges same-round-numbers across maps.
const multiKillRoundsQuery = generateQuery({
  player_kills: [
    {
      // _not: exclude suicide kills, matching v_player_multi_kills.
      where: {
        match_id: { _eq: $("matchId", "uuid!") },
        attacker_steam_id: { _eq: $("steamId", "bigint!") },
        _not: { attacked_steam_id: { _eq: $("steamId", "bigint!") } },
      },
      order_by: [{ round: order_by.asc }],
    },
    {
      match_map_id: true,
      round: true,
      match_map: {
        map: {
          name: true,
        },
      },
    },
  ],
});

const { client } = useApolloClient();

async function load() {
  if (!props.open || !props.steamId) {
    rounds.value = null;
    return;
  }
  rounds.value = null;
  const { data } = await client.query({
    query: multiKillRoundsQuery,
    variables: {
      matchId: props.matchId,
      steamId: String(props.steamId),
    },
    fetchPolicy: "network-only",
  });
  const grouped = new Map<string, DrilldownRow & { count: number }>();
  for (const row of (data?.player_kills ?? []) as any[]) {
    const key = `${row.match_map_id}|${row.round}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, {
        match_map_id: row.match_map_id,
        round: row.round,
        map_name: row.match_map?.map?.name ?? null,
        count: 1,
      });
    }
  }
  const target = props.kills;
  rounds.value = Array.from(grouped.values())
    .filter((r) => (target >= 5 ? r.count >= 5 : r.count === target))
    .map(({ match_map_id, round, map_name }) => ({
      match_map_id,
      round,
      map_name,
    }));
}

watch(() => [props.open, props.matchId, props.steamId, props.kills], load, {
  immediate: true,
});
</script>

<template>
  <Dialog
    :open="open"
    @update:open="
      (v) => {
        if (!v) emit('close');
      }
    "
  >
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="font-mono uppercase tracking-wider text-sm">
          {{ kills }}K rounds — {{ playerName || $t("common.unknown") }}
        </DialogTitle>
      </DialogHeader>
      <div
        v-if="rounds === null"
        class="py-8 text-center text-sm text-muted-foreground"
      >
        {{ $t("common.loading") }}
      </div>
      <div
        v-else-if="rounds.length === 0"
        class="py-8 text-center text-sm text-muted-foreground"
      >
        {{ $t("match.no_multi_kill_rounds", { count: kills }) }}
      </div>
      <ul v-else class="space-y-2">
        <li
          v-for="row in rounds"
          :key="`${row.match_map_id}-${row.round}`"
          class="flex items-center justify-between border border-border rounded px-3 py-2"
        >
          <span class="font-mono text-xs uppercase tracking-wider">
            {{ cleanMapName(row.map_name || $t("common.unknown")) }}
          </span>
          <Badge variant="outline" class="font-mono text-xs">
            {{ $t("common.round", { number: row.round }) }}
          </Badge>
        </li>
      </ul>
    </DialogContent>
  </Dialog>
</template>
