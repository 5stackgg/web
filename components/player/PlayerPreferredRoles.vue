<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { playerRolesQuery } from "~/graphql/playerMatchMapRolesGraphql";
import { tallyRoles, type CombatRole } from "~/utilities/roleClassify";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";

const props = defineProps<{
  steamId: string;
  matchType?: string | string[] | null;
  source?: string | null;
  limit?: number | null;
  since?: string | null;
}>();

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

const WINDOW_MAPS = 60;
const MIN_ROUNDS = 30;
// A role has to be a meaningful share of the player's maps to count as a
// "preferred" (specialist) role — otherwise they're just a rifler.
const SPECIALIST_SHARE = 0.2;

const ROLE_META: Record<CombatRole, { color: string; bg: string }> = {
  sniper: { color: "rgb(167, 139, 250)", bg: "rgba(167, 139, 250, 0.12)" },
  entry: { color: "rgb(248, 113, 113)", bg: "rgba(248, 113, 113, 0.12)" },
  support: { color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)" },
  rifler: { color: "rgb(148, 163, 184)", bg: "rgba(148, 163, 184, 0.12)" },
};

const loading = ref(true);
const rows = ref<any[]>([]);

function buildMatchesWhere() {
  const where: Record<string, any> = { status: { _eq: "Finished" } };
  if (props.source && props.source !== "all") {
    where.source =
      props.source === "5stack"
        ? { _eq: "5stack" }
        : props.source === "external"
          ? { _neq: "5stack" }
          : props.source === "unknown"
            ? { _nin: ["5stack", "valve", "faceit"] }
            : { _eq: props.source };
  }
  if (props.matchType) {
    where.options = {
      type: {
        _in: Array.isArray(props.matchType)
          ? props.matchType
          : [props.matchType],
      },
    };
  }
  if (props.since) {
    where.started_at = { _gte: props.since };
  }
  return where;
}

let loadGen = 0;

async function load() {
  if (!props.steamId) {
    loading.value = false;
    return;
  }
  loading.value = true;
  const gen = ++loadGen;
  try {
    const { data } = await apolloClient.query({
      query: playerRolesQuery,
      variables: {
        steamId: props.steamId,
        where: buildMatchesWhere(),
        limit: props.limit ?? WINDOW_MAPS,
      },
      fetchPolicy: "network-only",
    });
    if (gen !== loadGen) {
      return;
    }
    rows.value = ((data as any)?.v_player_match_map_roles ?? []) as any[];
  } catch {
    if (gen === loadGen) {
      rows.value = [];
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(
  () => [
    props.steamId,
    props.source,
    props.matchType,
    props.limit,
    props.since,
  ],
  load,
  { immediate: true },
);

const totalRounds = computed(() =>
  rows.value.reduce((sum, r) => sum + Number(r.rounds ?? 0), 0),
);
const hasData = computed(() => totalRounds.value >= MIN_ROUNDS);

const preferredRoles = computed(() => {
  const tally = tallyRoles(rows.value);
  const total = totalRounds.value || 1;
  const specialists = tally
    .filter(
      (entry) =>
        entry.role !== "rifler" && entry.rounds / total >= SPECIALIST_SHARE,
    )
    // Order by maps played (then rounds) so the headline matches the count
    // shown on each chip — primary = the role they play on the most maps.
    .sort((a, b) => b.maps - a.maps || b.rounds - a.rounds);
  const top = specialists.slice(0, 2);
  if (top.length) {
    return top.map((entry) => ({
      role: entry.role,
      detail: t("pages.players.detail.roles.maps_count", { count: entry.maps }),
    }));
  }
  return [
    {
      role: "rifler" as CombatRole,
      detail: t("pages.players.detail.roles.rifler_detail"),
    },
  ];
});

function roleLabel(role: CombatRole): string {
  return t(`match.roles.names.${role}`);
}
</script>

<template>
  <Card class="bg-card/20">
    <CardContent class="p-3 sm:p-4">
      <FadeSwap class="flex flex-col gap-3">
        <div
          v-if="loading"
          key="skeleton"
          class="flex flex-wrap items-center gap-3"
        >
          <Skeleton v-for="i in 2" :key="i" class="h-9 w-40 rounded-md" />
        </div>

        <div
          v-else-if="!hasData"
          key="empty"
          class="rounded-md border border-border bg-muted/20 px-4 py-4 text-center text-sm text-muted-foreground"
        >
          {{ $t("pages.players.detail.roles.no_data") }}
        </div>

        <div v-else key="content" class="flex flex-wrap items-center gap-3">
          <div
            v-for="(r, idx) of preferredRoles"
            :key="r.role"
            class="flex items-center gap-2.5 rounded-md border px-3 py-2"
            :style="{
              borderColor: ROLE_META[r.role].color + '66',
              backgroundColor: ROLE_META[r.role].bg,
            }"
          >
            <span
              class="text-[0.55rem] font-mono uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{
                idx === 0
                  ? $t("pages.players.detail.roles.primary")
                  : $t("pages.players.detail.roles.secondary")
              }}
            </span>
            <span
              class="text-sm font-bold uppercase tracking-[0.1em]"
              :style="{ color: ROLE_META[r.role].color }"
            >
              {{ roleLabel(r.role) }}
            </span>
            <span class="text-[0.65rem] tabular-nums text-muted-foreground">
              {{ r.detail }}
            </span>
          </div>
        </div>
      </FadeSwap>
    </CardContent>
  </Card>
</template>
