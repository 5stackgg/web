<script setup lang="ts">
import { ref, watch } from "vue";
import { $, order_by } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { resolveWeapon } from "~/utilities/weaponIcon";

// The kills the clip's player made in the clip's round, as one line of chips.
// Read as a guest, and Hasura only shows kills from a finished map, so a
// clip of a live map simply has none.
const props = defineProps<{
  matchMapId: string | null | undefined;
  round: number | null | undefined;
  steamId: string | null | undefined;
}>();

const roundKillsQuery = generateQuery({
  player_kills: [
    {
      where: {
        match_map_id: { _eq: $("matchMapId", "uuid!") },
        round: { _eq: $("round", "Int!") },
        attacker_steam_id: { _eq: $("steamId", "bigint!") },
      },
      order_by: [{ time: order_by.asc }],
    },
    {
      time: true,
      with: true,
      headshot: true,
      attacked_steam_id: true,
      attacked_location: true,
      attacked_player: { name: true },
    },
  ],
} as any);

type Kill = {
  key: string;
  name: string;
  where: string | null;
  headshot: boolean;
  weapon: { icon: string; label: string };
};

const kills = ref<Kill[]>([]);
const brokenIcons = ref(new Set<string>());
let token = 0;

watch(
  () => [props.matchMapId, props.round, props.steamId] as const,
  async ([matchMapId, round, steamId]) => {
    const mine = ++token;
    kills.value = [];
    if (!matchMapId || round == null || !steamId || !import.meta.client) {
      return;
    }
    try {
      const { data } = await getGraphqlClient().query({
        query: roundKillsQuery,
        variables: { matchMapId, round, steamId },
        fetchPolicy: "cache-first",
      });
      if (mine !== token) {
        return;
      }
      kills.value = ((data as any)?.player_kills ?? []).map(
        (row: any, at: number): Kill => ({
          key: `${row.time}-${row.attacked_steam_id}-${at}`,
          name:
            row.attacked_player?.name ?? String(row.attacked_steam_id ?? ""),
          where: row.attacked_location || null,
          headshot: !!row.headshot,
          weapon: resolveWeapon(row.with),
        }),
      );
    } catch {
      if (mine === token) {
        kills.value = [];
      }
    }
  },
  { immediate: true },
);

function hideIcon(key: string) {
  brokenIcons.value = new Set(brokenIcons.value).add(key);
}
</script>

<template>
  <Transition
    appear
    enter-active-class="transition-opacity duration-300 ease-out motion-reduce:!duration-0"
    leave-active-class="transition-opacity duration-200 ease-in motion-reduce:!duration-0"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <ol
      v-if="kills.length"
      :key="`${matchMapId}-${round}-${steamId}`"
      class="flex min-w-0 items-center gap-1.5 max-lg:flex-wrap lg:overflow-hidden lg:[mask-image:linear-gradient(90deg,#000_calc(100%-1.5rem),transparent)]"
      :aria-label="$t('clips.detail.round_kills')"
    >
      <li
        v-for="kill of kills"
        :key="kill.key"
        class="inline-flex h-7 shrink-0 items-center gap-[7px] whitespace-nowrap rounded-[7px] border border-border bg-white/[0.04] pl-[7px] pr-[9px] text-[0.78rem]"
      >
        <img
          v-if="kill.weapon.icon && !brokenIcons.has(kill.key)"
          :src="kill.weapon.icon"
          :alt="kill.weapon.label"
          :title="kill.weapon.label"
          class="h-[13px] w-auto opacity-90"
          @error="hideIcon(kill.key)"
        />
        <span
          v-if="kill.headshot"
          class="rounded border border-[hsl(var(--tac-amber)/0.45)] px-1 font-mono text-[0.6rem] leading-[15px] tracking-[0.08em] text-[hsl(var(--tac-amber))]"
        >
          HS
        </span>
        <span class="font-medium text-white/90">{{ kill.name }}</span>
        <span v-if="kill.where" class="text-[0.72rem] text-muted-foreground">
          {{ kill.where }}
        </span>
      </li>
    </ol>
  </Transition>
</template>
