<script setup lang="ts">
import { computed, watch, ref, onUnmounted } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import { buildLineupAvatarOverride } from "~/utilities/teamRosterOverride";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";

type Pair = {
  attacker_steam_id: string;
  attacked_steam_id: string;
  kills: number;
  headshot_kills: number;
  damage_dealt: number;
  hits: number;
  flash_count: number;
};

const props = defineProps<{
  match: any;
  pairs: Pair[];
}>();

// One player picked per side. Exposed via v-model so the radar comparison
// below the tab can mirror the same matchup instead of carrying its own
// player selector.
const selectedA = defineModel<string | null>("selectedA", { default: null });
const selectedB = defineModel<string | null>("selectedB", { default: null });

const apiDomain = useRuntimeConfig().public.apiDomain;

// Kill-pair weapon data from the backend (v_match_kill_pairs) — replaces
// scanning every round's kills for the per-matchup weapon breakdown.
const { client: apolloClient } = useApolloClient();
const killPairRows = ref<any[]>([]);
const KILL_PAIRS_SUB = gql`
  subscription H2HKillPairs($matchId: uuid!) {
    v_match_kill_pairs(where: { match_id: { _eq: $matchId } }) {
      killer_steam_id
      victim_steam_id
      weapon
      kills
    }
  }
`;
let killPairsSub: { unsubscribe: () => void } | null = null;
watch(
  () => props.match?.id,
  (id) => {
    killPairsSub?.unsubscribe();
    killPairsSub = null;
    killPairRows.value = [];
    if (!id) {
      return;
    }
    killPairsSub = apolloClient
      .subscribe({ query: KILL_PAIRS_SUB, variables: { matchId: id } })
      .subscribe({
        next: ({ data }: any) => {
          killPairRows.value = data?.v_match_kill_pairs ?? [];
        },
        error: () => {
          killPairRows.value = [];
        },
      });
  },
  { immediate: true },
);
onUnmounted(() => killPairsSub?.unsubscribe());

const lineup1 = computed(() => props.match.lineup_1);
const lineup2 = computed(() => props.match.lineup_2);
const avatar1 = computed(() => buildLineupAvatarOverride(lineup1.value));
const avatar2 = computed(() => buildLineupAvatarOverride(lineup2.value));

const lineup1Players = computed(() => lineup1.value?.lineup_players ?? []);
const lineup2Players = computed(() => lineup2.value?.lineup_players ?? []);

function avatarFor(steamId: string | null) {
  if (!steamId) return null;
  const sid = String(steamId);
  if (lineup1Players.value.some((m: any) => String(m.steam_id) === sid))
    return avatar1.value(sid);
  if (lineup2Players.value.some((m: any) => String(m.steam_id) === sid))
    return avatar2.value(sid);
  return null;
}

function memberAvatarSrc(member: any, override: string | null | undefined) {
  if (override) return resolveAvatarUrl(override, apiDomain);
  const url =
    member?.player?.roster_image_url ||
    member?.player?.custom_avatar_url ||
    member?.player?.avatar_url;
  return resolveAvatarUrl(url, apiDomain);
}

function nameOf(member: any): string {
  return member?.player?.name ?? member?.placeholder_name ?? "?";
}

const meSteamId = useAuthStore().me?.steam_id
  ? String(useAuthStore().me.steam_id)
  : null;

// Default each side to the logged-in player when they're on that team,
// otherwise the first roster member. Re-resolves if the current pick falls
// out of the roster (map filter / lineup swap).
watch(
  lineup1Players,
  (players) => {
    if (!players.length) return;
    const ids = players.map((m: any) => String(m.steam_id));
    if (!selectedA.value || !ids.includes(selectedA.value)) {
      selectedA.value =
        meSteamId && ids.includes(meSteamId) ? meSteamId : ids[0];
    }
  },
  { immediate: true },
);
watch(
  lineup2Players,
  (players) => {
    if (!players.length) return;
    const ids = players.map((m: any) => String(m.steam_id));
    if (!selectedB.value || !ids.includes(selectedB.value)) {
      selectedB.value =
        meSteamId && ids.includes(meSteamId) ? meSteamId : ids[0];
    }
  },
  { immediate: true },
);

const memberA = computed(
  () =>
    lineup1Players.value.find(
      (m: any) => String(m.steam_id) === selectedA.value,
    ) ?? null,
);
const memberB = computed(
  () =>
    lineup2Players.value.find(
      (m: any) => String(m.steam_id) === selectedB.value,
    ) ?? null,
);

function lookupPair(attacker: string, victim: string): Pair | undefined {
  return props.pairs.find(
    (p) =>
      String(p.attacker_steam_id) === String(attacker) &&
      String(p.attacked_steam_id) === String(victim),
  );
}

// A→B and B→A stats for the single selected matchup.
const aOnB = computed(() =>
  selectedA.value && selectedB.value
    ? lookupPair(selectedA.value, selectedB.value)
    : undefined,
);
const bOnA = computed(() =>
  selectedA.value && selectedB.value
    ? lookupPair(selectedB.value, selectedA.value)
    : undefined,
);

// Weapon breakdown — from the backend kill-pairs view (v_match_kill_pairs)
type WeaponBucket =
  | "rifles"
  | "pistols"
  | "snipers"
  | "smg"
  | "shotgun"
  | "other";
const WEAPON_BUCKETS: Record<string, WeaponBucket> = {
  ak47: "rifles",
  m4a1: "rifles",
  m4a1_silencer: "rifles",
  m4a4: "rifles",
  galilar: "rifles",
  famas: "rifles",
  sg556: "rifles",
  aug: "rifles",
  awp: "snipers",
  ssg08: "snipers",
  scar20: "snipers",
  g3sg1: "snipers",
  deagle: "pistols",
  glock: "pistols",
  usp_silencer: "pistols",
  hkp2000: "pistols",
  p250: "pistols",
  fiveseven: "pistols",
  tec9: "pistols",
  cz75a: "pistols",
  elite: "pistols",
  revolver: "pistols",
  mp9: "smg",
  mp7: "smg",
  mp5sd: "smg",
  ump45: "smg",
  p90: "smg",
  bizon: "smg",
  mac10: "smg",
  nova: "shotgun",
  xm1014: "shotgun",
  sawedoff: "shotgun",
  mag7: "shotgun",
};
function bucketOf(weapon: string | null | undefined): WeaponBucket {
  if (!weapon) return "other";
  return WEAPON_BUCKETS[weapon.toLowerCase()] ?? "other";
}
function weaponBreakdownBetween(attacker: string, victim: string) {
  const counts: Record<WeaponBucket, number> = {
    rifles: 0,
    pistols: 0,
    snipers: 0,
    smg: 0,
    shotgun: 0,
    other: 0,
  };
  for (const r of killPairRows.value) {
    if (
      String(r.killer_steam_id) === String(attacker) &&
      String(r.victim_steam_id) === String(victim)
    ) {
      counts[bucketOf(r.weapon)] += r.kills ?? 0;
    }
  }
  return counts;
}
function weaponBuckets(c: Record<WeaponBucket, number>) {
  const order: WeaponBucket[] = [
    "rifles",
    "pistols",
    "snipers",
    "smg",
    "shotgun",
    "other",
  ];
  return order.map((k) => ({ key: k, count: c[k] })).filter((b) => b.count > 0);
}
const aWeapons = computed(() =>
  selectedA.value && selectedB.value
    ? weaponBuckets(weaponBreakdownBetween(selectedA.value, selectedB.value))
    : [],
);
const bWeapons = computed(() =>
  selectedA.value && selectedB.value
    ? weaponBuckets(weaponBreakdownBetween(selectedB.value, selectedA.value))
    : [],
);

// Damage scale across the two directions of this matchup.
const maxDamage = computed(() =>
  Math.max(1, aOnB.value?.damage_dealt ?? 0, bOnA.value?.damage_dealt ?? 0),
);
function damageWidth(v: number) {
  return Math.round((v / maxDamage.value) * 100) + "%";
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="border border-border bg-[hsl(var(--card)/0.5)]">
        <header
          class="flex items-center justify-between gap-3 px-3 py-2 border-b border-border"
        >
          <span
            class="font-mono text-[0.65rem] tracking-[0.22em] uppercase text-foreground/90 truncate"
            :title="lineup1?.name"
          >
            {{ lineup1?.name }}
          </span>
        </header>

        <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 p-3">
          <button
            v-for="m of lineup1Players"
            :key="m.steam_id"
            type="button"
            class="group flex flex-col items-center gap-1 pt-1.5 pb-2 px-1 border rounded-sm transition-all min-w-0"
            :class="
              selectedA === String(m.steam_id)
                ? 'border-amber-400 bg-amber-400/15 shadow-[0_0_0_1px_rgb(251_191_36_/_0.4),inset_0_0_24px_-12px_rgb(251_191_36_/_0.5)]'
                : 'border-border bg-[hsl(var(--card))] hover:border-amber-400/50 hover:bg-amber-400/5'
            "
            @click="selectedA = String(m.steam_id)"
          >
            <img
              v-if="memberAvatarSrc(m, avatarFor(String(m.steam_id)))"
              :src="memberAvatarSrc(m, avatarFor(String(m.steam_id)))!"
              :alt="nameOf(m)"
              class="w-10 h-10 rounded-full object-cover transition-transform group-hover:scale-105"
              :class="
                selectedA === String(m.steam_id)
                  ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[hsl(var(--card))]'
                  : ''
              "
            />
            <span
              class="font-mono text-[0.65rem] tracking-[0.02em] truncate max-w-full"
              :class="
                selectedA === String(m.steam_id)
                  ? 'text-amber-400 font-bold'
                  : 'text-foreground/80'
              "
            >
              {{ nameOf(m) }}
            </span>
          </button>
        </div>
      </div>

      <div class="border border-border bg-[hsl(var(--card)/0.5)]">
        <header
          class="flex items-center justify-between gap-3 px-3 py-2 border-b border-border"
        >
          <span
            class="font-mono text-[0.65rem] tracking-[0.22em] uppercase text-foreground/90 truncate"
            :title="lineup2?.name"
          >
            {{ lineup2?.name }}
          </span>
        </header>

        <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 p-3">
          <button
            v-for="m of lineup2Players"
            :key="m.steam_id"
            type="button"
            class="group flex flex-col items-center gap-1 pt-1.5 pb-2 px-1 border rounded-sm transition-all min-w-0"
            :class="
              selectedB === String(m.steam_id)
                ? 'border-sky-400 bg-sky-400/15 shadow-[0_0_0_1px_rgb(56_189_248_/_0.4),inset_0_0_24px_-12px_rgb(56_189_248_/_0.5)]'
                : 'border-border bg-[hsl(var(--card))] hover:border-sky-400/50 hover:bg-sky-400/5'
            "
            @click="selectedB = String(m.steam_id)"
          >
            <img
              v-if="memberAvatarSrc(m, avatarFor(String(m.steam_id)))"
              :src="memberAvatarSrc(m, avatarFor(String(m.steam_id)))!"
              :alt="nameOf(m)"
              class="w-10 h-10 rounded-full object-cover transition-transform group-hover:scale-105"
              :class="
                selectedB === String(m.steam_id)
                  ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-[hsl(var(--card))]'
                  : ''
              "
            />
            <span
              class="font-mono text-[0.65rem] tracking-[0.02em] truncate max-w-full"
              :class="
                selectedB === String(m.steam_id)
                  ? 'text-sky-400 font-bold'
                  : 'text-foreground/80'
              "
            >
              {{ nameOf(m) }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="memberA && memberB"
      class="border border-border bg-[hsl(var(--card)/0.5)] p-4 flex flex-col gap-3"
    >
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div class="flex items-center gap-2 min-w-0">
          <PlayerDisplay
            :player="memberA.player"
            :avatar-override="avatarFor(selectedA)"
            :show-online="false"
            :show-flag="false"
            :show-role="false"
            :show-add-friend="false"
            :show-elo="false"
            class="text-sm"
          />
        </div>

        <div class="flex items-center gap-4 font-mono tabular-nums">
          <span
            class="text-2xl font-extrabold text-amber-400 min-w-[2ch] text-right"
          >
            <AnimatedStat :value="aOnB?.kills ?? 0" />
          </span>
          <div class="flex flex-col items-center min-w-[140px]">
            <span
              class="font-mono text-[0.55rem] tracking-[0.25em] uppercase text-muted-foreground"
            >
              {{ $t("match.head_to_head_matrix.damage") }}
            </span>
            <div class="flex w-full h-1.5 bg-muted/40 mt-1">
              <div
                class="bg-amber-400/85 h-full"
                :style="{ width: damageWidth(aOnB?.damage_dealt ?? 0) }"
              />
              <div class="flex-1" />
              <div
                class="bg-sky-400/85 h-full"
                :style="{ width: damageWidth(bOnA?.damage_dealt ?? 0) }"
              />
            </div>
            <div
              class="flex w-full justify-between font-mono text-[0.65rem] tabular-nums text-muted-foreground mt-1"
            >
              <span><AnimatedStat :value="aOnB?.damage_dealt ?? 0" /></span>
              <span><AnimatedStat :value="bOnA?.damage_dealt ?? 0" /></span>
            </div>
          </div>
          <span
            class="text-2xl font-extrabold text-sky-400 min-w-[2ch] text-left"
          >
            <AnimatedStat :value="bOnA?.kills ?? 0" />
          </span>
        </div>

        <div class="flex items-center gap-2 min-w-0 justify-end">
          <PlayerDisplay
            :player="memberB.player"
            :avatar-override="avatarFor(selectedB)"
            :show-online="false"
            :show-flag="false"
            :show-role="false"
            :show-add-friend="false"
            :show-elo="false"
            class="text-sm"
          />
        </div>
      </div>

      <div
        class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-border/50"
      >
        <div class="flex flex-col gap-1.5 min-w-0">
          <div
            class="font-mono text-[0.55rem] tracking-[0.22em] uppercase text-muted-foreground"
          >
            {{ $t("match.head_to_head_matrix.your_weapons") }}
          </div>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="b of aWeapons"
              :key="b.key"
              class="border border-amber-400/50 bg-amber-400/10 px-2.5 py-1 flex items-center gap-2"
            >
              <span
                class="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-muted-foreground"
              >
                {{ b.key }}
              </span>
              <span
                class="font-mono text-sm font-bold tabular-nums text-amber-400"
                ><AnimatedStat :value="b.count"
              /></span>
            </div>
            <span
              v-if="aWeapons.length === 0"
              class="font-mono text-xs text-muted-foreground/70"
            >
              —
            </span>
          </div>
        </div>

        <div class="flex flex-col gap-1.5 min-w-0 md:items-end">
          <div
            class="font-mono text-[0.55rem] tracking-[0.22em] uppercase text-muted-foreground"
          >
            {{ $t("match.head_to_head_matrix.their_weapons") }}
          </div>
          <div class="flex flex-wrap gap-2 md:justify-end">
            <div
              v-for="b of bWeapons"
              :key="b.key"
              class="border border-sky-400/50 bg-sky-400/10 px-2.5 py-1 flex items-center gap-2"
            >
              <span
                class="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-muted-foreground"
              >
                {{ b.key }}
              </span>
              <span
                class="font-mono text-sm font-bold tabular-nums text-sky-400"
                ><AnimatedStat :value="b.count"
              /></span>
            </div>
            <span
              v-if="bWeapons.length === 0"
              class="font-mono text-xs text-muted-foreground/70"
            >
              —
            </span>
          </div>
        </div>
      </div>

      <!-- Always rendered so the card height doesn't jump between matchups;
           a side with no flashes shows blank rather than a weird "0". -->
      <div
        class="grid grid-cols-2 gap-3 pt-3 border-t border-border/50 font-mono text-[0.65rem]"
      >
        <div class="flex items-center justify-between">
          <span class="tracking-[0.22em] uppercase text-muted-foreground"
            >Flashes on them</span
          >
          <span class="tabular-nums text-amber-400 font-bold">{{
            aOnB?.flash_count || ""
          }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="tracking-[0.22em] uppercase text-muted-foreground"
            >Flashes on you</span
          >
          <span class="tabular-nums text-sky-400 font-bold">{{
            bOnA?.flash_count || ""
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
