<script setup lang="ts">
import { computed, ref, watch } from "vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
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

const apiDomain = useRuntimeConfig().public.apiDomain;

const lineup1 = computed(() => props.match.lineup_1);
const lineup2 = computed(() => props.match.lineup_2);
const avatar1 = computed(() => buildLineupAvatarOverride(lineup1.value));
const avatar2 = computed(() => buildLineupAvatarOverride(lineup2.value));

const allMembers = computed(() => [
  ...(lineup1.value?.lineup_players ?? []),
  ...(lineup2.value?.lineup_players ?? []),
]);

function lineupIdFor(steamId: string): string | null {
  const sid = String(steamId);
  if (
    lineup1.value?.lineup_players?.some((m: any) => String(m.steam_id) === sid)
  )
    return lineup1.value.id;
  if (
    lineup2.value?.lineup_players?.some((m: any) => String(m.steam_id) === sid)
  )
    return lineup2.value.id;
  return null;
}

function avatarFor(steamId: string | null) {
  if (!steamId) return null;
  const lid = lineupIdFor(steamId);
  if (lid === lineup1.value?.id) return avatar1.value(steamId);
  if (lid === lineup2.value?.id) return avatar2.value(steamId);
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
const meIsInMatch = computed(() =>
  meSteamId
    ? allMembers.value.some((m: any) => String(m.steam_id) === meSteamId)
    : false,
);

const selectedSelf = ref<string | null>(null);

watch(
  allMembers,
  (members) => {
    if (members.length === 0) return;
    if (!selectedSelf.value) {
      selectedSelf.value =
        meIsInMatch.value && meSteamId
          ? meSteamId
          : String(members[0].steam_id);
    }
  },
  { immediate: true },
);

const selfMember = computed(
  () =>
    allMembers.value.find(
      (m: any) => String(m.steam_id) === selectedSelf.value,
    ) ?? null,
);

const opponents = computed(() => {
  if (!selectedSelf.value) return [];
  const selfLineupId = lineupIdFor(selectedSelf.value);
  return allMembers.value.filter(
    (m: any) => lineupIdFor(String(m.steam_id)) !== selfLineupId,
  );
});

function lookupPair(attacker: string, victim: string): Pair | undefined {
  return props.pairs.find(
    (p) =>
      String(p.attacker_steam_id) === String(attacker) &&
      String(p.attacked_steam_id) === String(victim),
  );
}

// Weapon breakdown — computed from round.kills (already in subscription)
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
  for (const map of props.match.match_maps ?? []) {
    for (const round of map.rounds ?? []) {
      for (const k of round.kills ?? []) {
        if (
          String(k.player?.steam_id) === String(attacker) &&
          String(k.attacked_player?.steam_id) === String(victim)
        ) {
          counts[bucketOf(k.with)]++;
        }
      }
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

// Damage scale shared across all opponent cards for visual comparability.
const maxDamage = computed(() => {
  if (!selectedSelf.value) return 1;
  let max = 1;
  for (const opp of opponents.value) {
    const a =
      lookupPair(selectedSelf.value, String(opp.steam_id))?.damage_dealt ?? 0;
    const b =
      lookupPair(String(opp.steam_id), selectedSelf.value)?.damage_dealt ?? 0;
    if (a > max) max = a;
    if (b > max) max = b;
  }
  return max;
});
function damageWidth(v: number) {
  return Math.round((v / maxDamage.value) * 100) + "%";
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div
        v-for="(side, idx) in [
          {
            lineup: lineup1,
            accent: 'hsl(var(--tac-amber))',
          },
          {
            lineup: lineup2,
            accent: 'hsl(var(--destructive))',
          },
        ]"
        :key="idx"
        class="border border-border bg-[hsl(var(--card)/0.5)]"
      >
        <header
          class="flex items-center justify-between gap-3 px-3 py-2 border-b border-border"
        >
          <span
            class="font-mono text-[0.65rem] tracking-[0.22em] uppercase text-foreground/90 truncate"
            :title="side.lineup?.name"
          >
            {{ side.lineup?.name }}
          </span>
          <span
            v-if="
              side.lineup?.lineup_players?.some(
                (m) => String(m.steam_id) === selectedSelf,
              )
            "
            class="font-mono text-[0.55rem] tracking-[0.22em] uppercase text-[hsl(var(--tac-amber))]"
          >
            Viewing
          </span>
        </header>

        <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 p-3">
          <button
            v-for="m of side.lineup?.lineup_players ?? []"
            :key="m.steam_id"
            type="button"
            class="group flex flex-col items-center gap-1 pt-1.5 pb-2 px-1 border rounded-sm transition-all min-w-0"
            :class="
              selectedSelf === String(m.steam_id)
                ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.14)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.4),inset_0_0_24px_-12px_hsl(var(--tac-amber)/0.5)]'
                : 'border-border bg-[hsl(var(--card))] hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.04)]'
            "
            @click="selectedSelf = String(m.steam_id)"
          >
            <img
              v-if="memberAvatarSrc(m, avatarFor(String(m.steam_id)))"
              :src="memberAvatarSrc(m, avatarFor(String(m.steam_id)))!"
              :alt="nameOf(m)"
              class="w-10 h-10 rounded-full object-cover transition-transform group-hover:scale-105"
              :class="
                selectedSelf === String(m.steam_id)
                  ? 'ring-2 ring-[hsl(var(--tac-amber))] ring-offset-2 ring-offset-[hsl(var(--card))]'
                  : ''
              "
            />
            <span
              class="font-mono text-[0.65rem] tracking-[0.02em] truncate max-w-full"
              :class="
                selectedSelf === String(m.steam_id)
                  ? 'text-[hsl(var(--tac-amber))] font-bold'
                  : 'text-foreground/80'
              "
            >
              {{ nameOf(m) }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <div
        v-for="opp of opponents"
        :key="opp.steam_id"
        class="border border-border bg-[hsl(var(--card)/0.5)] p-4 flex flex-col gap-3"
      >
        <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div class="flex items-center gap-2 min-w-0">
            <PlayerDisplay
              v-if="selfMember"
              :player="selfMember.player"
              :avatar-override="avatarFor(selectedSelf)"
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
              class="text-2xl font-extrabold text-[hsl(var(--tac-amber))] min-w-[2ch] text-right"
            >
              {{
                selectedSelf
                  ? (lookupPair(selectedSelf, String(opp.steam_id))?.kills ?? 0)
                  : 0
              }}
            </span>
            <div class="flex flex-col items-center min-w-[140px]">
              <span
                class="font-mono text-[0.55rem] tracking-[0.25em] uppercase text-muted-foreground"
              >
                Damage
              </span>
              <div class="flex w-full h-1.5 bg-muted/40 mt-1">
                <div
                  class="bg-[hsl(var(--tac-amber)/0.85)] h-full"
                  :style="{
                    width: damageWidth(
                      selectedSelf
                        ? (lookupPair(selectedSelf, String(opp.steam_id))
                            ?.damage_dealt ?? 0)
                        : 0,
                    ),
                  }"
                />
                <div class="flex-1" />
                <div
                  class="bg-destructive/85 h-full"
                  :style="{
                    width: damageWidth(
                      selectedSelf
                        ? (lookupPair(String(opp.steam_id), selectedSelf)
                            ?.damage_dealt ?? 0)
                        : 0,
                    ),
                  }"
                />
              </div>
              <div
                class="flex w-full justify-between font-mono text-[0.65rem] tabular-nums text-muted-foreground mt-1"
              >
                <span>{{
                  selectedSelf
                    ? (lookupPair(selectedSelf, String(opp.steam_id))
                        ?.damage_dealt ?? 0)
                    : 0
                }}</span>
                <span>{{
                  selectedSelf
                    ? (lookupPair(String(opp.steam_id), selectedSelf)
                        ?.damage_dealt ?? 0)
                    : 0
                }}</span>
              </div>
            </div>
            <span
              class="text-2xl font-extrabold text-destructive min-w-[2ch] text-left"
            >
              {{
                selectedSelf
                  ? (lookupPair(String(opp.steam_id), selectedSelf)?.kills ?? 0)
                  : 0
              }}
            </span>
          </div>

          <div class="flex items-center gap-2 min-w-0 justify-end">
            <PlayerDisplay
              :player="opp.player"
              :avatar-override="avatarFor(String(opp.steam_id))"
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
              Your weapons
            </div>
            <div class="flex flex-wrap gap-2">
              <template
                v-for="b of selectedSelf
                  ? weaponBuckets(
                      weaponBreakdownBetween(
                        selectedSelf,
                        String(opp.steam_id),
                      ),
                    )
                  : []"
                :key="b.key"
              >
                <div
                  class="border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] px-2.5 py-1 flex items-center gap-2"
                >
                  <span
                    class="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-muted-foreground"
                  >
                    {{ b.key }}
                  </span>
                  <span
                    class="font-mono text-sm font-bold tabular-nums text-[hsl(var(--tac-amber))]"
                    >{{ b.count }}</span
                  >
                </div>
              </template>
              <span
                v-if="
                  selectedSelf &&
                  weaponBuckets(
                    weaponBreakdownBetween(selectedSelf, String(opp.steam_id)),
                  ).length === 0
                "
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
              Their weapons
            </div>
            <div class="flex flex-wrap gap-2 md:justify-end">
              <template
                v-for="b of selectedSelf
                  ? weaponBuckets(
                      weaponBreakdownBetween(
                        String(opp.steam_id),
                        selectedSelf,
                      ),
                    )
                  : []"
                :key="b.key"
              >
                <div
                  class="border border-[hsl(var(--destructive)/0.5)] bg-[hsl(var(--destructive)/0.08)] px-2.5 py-1 flex items-center gap-2"
                >
                  <span
                    class="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-muted-foreground"
                  >
                    {{ b.key }}
                  </span>
                  <span
                    class="font-mono text-sm font-bold tabular-nums text-destructive"
                    >{{ b.count }}</span
                  >
                </div>
              </template>
              <span
                v-if="
                  selectedSelf &&
                  weaponBuckets(
                    weaponBreakdownBetween(String(opp.steam_id), selectedSelf),
                  ).length === 0
                "
                class="font-mono text-xs text-muted-foreground/70"
              >
                —
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="
            selectedSelf &&
            (lookupPair(selectedSelf, String(opp.steam_id))?.flash_count ?? 0) +
              (lookupPair(String(opp.steam_id), selectedSelf)?.flash_count ??
                0) >
              0
          "
          class="grid grid-cols-2 gap-3 pt-3 border-t border-border/50 font-mono text-[0.65rem]"
        >
          <div class="flex items-center justify-between">
            <span class="tracking-[0.22em] uppercase text-muted-foreground"
              >Flashes on them</span
            >
            <span class="tabular-nums text-[hsl(var(--tac-amber))] font-bold">{{
              selectedSelf
                ? (lookupPair(selectedSelf, String(opp.steam_id))
                    ?.flash_count ?? 0)
                : 0
            }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="tracking-[0.22em] uppercase text-muted-foreground"
              >Flashes on you</span
            >
            <span class="tabular-nums text-destructive font-bold">{{
              selectedSelf
                ? (lookupPair(String(opp.steam_id), selectedSelf)
                    ?.flash_count ?? 0)
                : 0
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
