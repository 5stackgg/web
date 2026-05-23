<script lang="ts" setup>
import formatStatValue from "~/utilities/formatStatValue";
import { kdrColor } from "~/utilities/kdrColor";
import EloChangeBadge from "~/components/EloChangeBadge.vue";
import PlayerMatchClipsButton from "~/components/match/PlayerMatchClipsButton.vue";
import MultiKillDrilldown from "~/components/match/MultiKillDrilldown.vue";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "~/components/ui/hover-card";
import { useOverviewColumns } from "~/composables/useMatchTableColumns";
import { useCurrentUserRow } from "~/composables/useCurrentUserRow";
import { buildLineupAvatarOverride } from "~/utilities/teamRosterOverride";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { MoreVertical, Crown, Sparkles } from "lucide-vue-next";
import TimezoneFlag from "~/components/TimezoneFlag.vue";
import PlayerElo from "~/components/PlayerElo.vue";
import RenderHighlightForPlayerDialog from "~/components/match/RenderHighlightForPlayerDialog.vue";
import { ref } from "vue";

const renderHighlightOpen = ref(false);

const { visibility: overviewVis } = useOverviewColumns();
const { rowClass, stickyCellClass } = useCurrentUserRow();

const DASH = "—";
</script>
<template>
  <TableRow :class="['group', rowClass(member)]">
    <TableCell
      v-if="!hideMember"
      :class="[
        'w-[110px] md:w-[220px] sticky left-0 z-30 border-r border-border touch-pan-y [transform:translateZ(0)]',
        stickyCellClass(member) ||
          'bg-card group-hover:bg-muted shadow-[3px_0_6px_-3px_hsl(0_0%_0%/0.7)]',
      ]"
    >
      <div class="flex items-center gap-1 min-w-0">
        <DropdownMenu v-if="canDoActions">
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              class="shrink-0 h-7 w-5 p-0 rounded text-muted-foreground hover:!text-[hsl(var(--tac-amber))] hover:!bg-[hsl(var(--tac-amber)/0.18)] [box-shadow:inset_0_0_0_1px_transparent] hover:[box-shadow:inset_0_0_0_1px_hsl(var(--tac-amber)/0.4)] transition-colors"
            >
              <MoreVertical class="h-4 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-56">
            <template v-if="lineup.can_update_lineup">
              <DropdownMenuItem @click="makeCaptain" :disabled="member.captain">
                <span>{{ $t("match.overview.promote_captain") }}</span>
              </DropdownMenuItem>

              <DropdownMenuItem @click="switchTeams" v-if="canSwitchTeams">
                <span>{{ $t("match.overview.switch_teams") }}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator vp />

              <DropdownMenuItem
                class="text-destructive"
                @click="removeFromLineup"
                v-if="lineup.can_update_lineup"
              >
                <span>{{ $t("match.overview.remove_from_lineup") }}</span>
              </DropdownMenuItem>
            </template>

            <DropdownMenuItem
              @click="switchTeams"
              v-if="!lineup.can_update_lineup && canSwitchTeams"
            >
              <span>{{ $t("match.overview.switch_teams") }}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              class="text-destructive"
              @click="removeFromLineup"
              v-if="canLeaveLineup"
            >
              <span>{{ $t("match.overview.leave_lineup") }}</span>
            </DropdownMenuItem>

            <template v-if="canRequestHighlight">
              <DropdownMenuSeparator
                v-if="
                  lineup.can_update_lineup || canLeaveLineup || canSwitchTeams
                "
              />
              <DropdownMenuItem @click="renderHighlightOpen = true">
                <Sparkles
                  class="h-3.5 w-3.5 mr-2 text-[hsl(var(--tac-amber))]"
                />
                <span>Render highlight…</span>
              </DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenu>
        <div class="min-w-0 flex-1">
          <div class="hidden md:block">
            <LineupMember :match="match" :member="member">
              <template v-if="member.player?.steam_id" #avatar-badge>
                <PlayerMatchClipsButton :steam-id="member.player.steam_id" />
              </template>
              <template v-if="memberEloChange" #elo-postfix>
                <EloChangeBadge :elo-change="memberEloChange" size="xs" />
              </template>
            </LineupMember>
          </div>
          <div class="md:hidden min-w-0">
            <template v-if="member.player?.steam_id">
              <div class="flex items-start gap-2 min-w-0">
                <NuxtLink
                  :to="{
                    name: 'players-id',
                    params: { id: member.player.steam_id },
                  }"
                  class="shrink-0"
                >
                  <div class="relative">
                    <Avatar shape="square" class="h-9 w-9">
                      <AvatarImage
                        v-if="mobileAvatarSrc"
                        :src="mobileAvatarSrc"
                        :alt="member.player.name"
                      />
                      <AvatarFallback>{{
                        member.player.name.slice(0, 2)
                      }}</AvatarFallback>
                    </Avatar>
                    <span
                      v-if="member.captain"
                      :title="$t('match.player.captain')"
                      class="absolute -bottom-1 -right-1 inline-flex items-center justify-center h-3.5 w-3.5 rounded-sm bg-[hsl(var(--tac-amber))] text-black ring-1 ring-background shadow z-10"
                    >
                      <Crown class="h-2.5 w-2.5" />
                    </span>
                  </div>
                </NuxtLink>
                <div class="flex flex-col min-w-0 leading-tight">
                  <NuxtLink
                    :to="{
                      name: 'players-id',
                      params: { id: member.player.steam_id },
                    }"
                    class="truncate text-xs font-medium hover:text-primary"
                  >
                    {{ member.player.name }}
                  </NuxtLink>
                  <div
                    class="flex items-center gap-1.5 min-w-0 mt-0.5 text-muted-foreground"
                  >
                    <TimezoneFlag
                      v-if="member.player.country"
                      :country="member.player.country"
                      class="shrink-0"
                    />
                    <PlayerElo :elo="member.player.elo" />
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="flex items-center gap-2 min-w-0">
              <NuxtImg
                src="/img/logos/discord.svg"
                :alt="$t('alt_text.discord')"
                class="w-5 h-5 shrink-0"
              />
              <span class="truncate text-xs">{{
                member.placeholder_name
              }}</span>
            </div>
          </div>
        </div>
      </div>
      <RenderHighlightForPlayerDialog
        v-if="canRequestHighlight && member.player?.steam_id"
        v-model:open="renderHighlightOpen"
        :match-maps="mapsWithDemo"
        :target-steam-id="String(member.player.steam_id)"
        :target-name="member.player.name ?? null"
      />
    </TableCell>
    <template v-if="showStats">
      <TableCell class="text-center tabular-nums">{{
        hasStats ? sideKills : DASH
      }}</TableCell>
      <TableCell
        v-if="overviewVis.assists !== false"
        class="text-center tabular-nums"
      >
        {{ hasStats ? sideAssists : DASH }}
      </TableCell>
      <TableCell class="text-center tabular-nums">{{
        hasStats ? sideDeaths : DASH
      }}</TableCell>
      <TableCell
        v-if="overviewVis.kd !== false"
        class="text-center tabular-nums"
      >
        <span :class="kdrColor(kd)">{{ kd }}</span>
      </TableCell>
      <TableCell
        v-if="overviewVis.hs !== false"
        class="text-center tabular-nums"
      >
        {{ hs }}
      </TableCell>
      <TableCell
        v-if="overviewVis.survived !== false"
        class="text-center tabular-nums"
      >
        {{ survived }}
      </TableCell>
      <TableCell
        v-if="overviewVis.multikills !== false"
        class="text-center tabular-nums"
      >
        <HoverCard
          v-if="(totalMultiKills ?? 0) > 0"
          :open-delay="100"
          :close-delay="120"
        >
          <HoverCardTrigger as-child>
            <button
              type="button"
              class="font-mono tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-[3px] hover:decoration-[hsl(var(--tac-amber))] hover:text-[hsl(var(--tac-amber))] transition-colors"
            >
              {{ totalMultiKills }}
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            class="w-auto p-3 border-border/80 bg-[hsl(240_8%_10%)]"
            :side-offset="6"
          >
            <div
              class="font-mono text-[0.6rem] font-bold tracking-[0.22em] uppercase text-[hsl(var(--tac-amber))] mb-2"
            >
              {{ $t("match.overview.multi_kill_rounds") }}
            </div>
            <div class="grid grid-cols-4 gap-2 min-w-[14rem]">
              <button
                v-for="row of [
                  { n: 2, count: twoKills },
                  { n: 3, count: threeKills },
                  { n: 4, count: fourKills },
                  { n: 5, count: fiveKills },
                ]"
                :key="row.n"
                type="button"
                :disabled="!hasMultiKillsToShow(row.n)"
                class="flex flex-col items-center gap-0.5 px-2 py-2 border border-border/60 rounded-sm bg-card/60 enabled:hover:border-[hsl(var(--tac-amber)/0.6)] enabled:hover:bg-[hsl(var(--tac-amber)/0.06)] disabled:opacity-50 disabled:cursor-default transition-colors"
                @click="
                  hasMultiKillsToShow(row.n) && openMultiKillDrilldown(row.n)
                "
              >
                <span
                  class="font-mono text-[0.55rem] tracking-[0.2em] uppercase text-muted-foreground"
                >
                  {{ row.n }}K
                </span>
                <span class="font-mono text-[0.95rem] font-bold tabular-nums">
                  {{ row.count }}
                </span>
              </button>
            </div>
          </HoverCardContent>
        </HoverCard>
        <template v-else>{{ totalMultiKills ?? DASH }}</template>
      </TableCell>
      <TableCell
        v-if="overviewVis.hltv !== false"
        class="text-center tabular-nums"
        :class="hltvTierClass"
      >
        {{ hltvRating ?? DASH }}
      </TableCell>
      <TableCell
        v-if="overviewVis.kast !== false"
        class="text-center tabular-nums"
        :class="kastTierClass"
      >
        {{ kast }}
      </TableCell>
      <TableCell class="text-center">
        <span :class="['md:hidden tabular-nums text-xs', adrTierClass]">{{
          hasStats ? adr : DASH
        }}</span>
        <div class="hidden md:flex flex-col items-center leading-tight">
          <span class="tabular-nums">{{ stats?.damage ?? DASH }}</span>
          <span
            v-if="hasStats"
            class="font-mono text-[0.6rem] tracking-[0.18em] uppercase text-muted-foreground"
          >
            <span :class="adrTierClass">{{ adr }}</span>
            <span class="ml-1">ADR</span>
          </span>
        </div>
      </TableCell>
      <TableCell v-if="overviewVis.team_damage" class="text-center">
        {{ stats?.team_damage ?? DASH }}
      </TableCell>
      <TableCell v-if="overviewVis.knife_kills" class="text-center">
        {{ stats?.knife_kills ?? DASH }}
      </TableCell>
      <TableCell v-if="overviewVis.zeus_kills" class="text-center">
        {{ stats?.zeus_kills ?? DASH }}
      </TableCell>
    </template>
    <MultiKillDrilldown
      v-if="drilldownKillCount !== null"
      :open="drilldownKillCount !== null"
      :match-id="match.id"
      :steam-id="member.steam_id"
      :player-name="member.player?.name ?? member.placeholder_name"
      :kills="drilldownKillCount"
      @close="drilldownKillCount = null"
    />
  </TableRow>
</template>

<script lang="ts">
import LineupMember from "~/components/match/LineupMember.vue";
import { generateMutation } from "~/graphql/graphqlGen";
import {
  $,
  e_lobby_access_enum,
  e_match_status_enum,
  e_player_roles_enum,
} from "~/generated/zeus";
import { statTierClass } from "~/utils/statTiers";

export default {
  components: {
    LineupMember,
  },
  data() {
    return {
      drilldownKillCount: null as null | number,
    };
  },
  props: {
    matchSide: {
      type: String,
      default: "all",
    },
    match: {
      required: true,
      type: Object,
    },
    member: {
      required: true,
      type: Object,
    },
    lineup: {
      required: true,
      type: Object,
    },
    showStats: {
      type: Boolean,
      default: true,
    },
    hideMember: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    hasMultiKillsToShow(kills: number): boolean {
      if (!this.stats) return false;
      const key = (
        {
          2: "two_kill_rounds",
          3: "three_kill_rounds",
          4: "four_kill_rounds",
          5: "five_kill_rounds",
        } as const
      )[kills];
      return key ? (this.stats[key] ?? 0) > 0 : false;
    },
    openMultiKillDrilldown(kills: number) {
      this.drilldownKillCount = kills;
    },
    async switchTeams() {
      if (!this.lineup.can_update_lineup) {
        return await this.$apollo.mutate({
          mutation: generateMutation({
            switchLineup: [
              {
                match_id: $("match_id", "String!"),
              },
              {
                success: true,
              },
            ],
          }),
          variables: {
            match_id: this.match.id,
          },
        });
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          update_match_lineup_players: [
            {
              where: {
                steam_id: {
                  _eq: $("steam_id", "bigint"),
                },
                match_lineup_id: {
                  _eq: $("match_lineup_id", "uuid"),
                },
              },
              _set: {
                match_lineup_id: $("new_match_lineup_id", "uuid"),
              },
            },
            {
              __typename: true,
            },
          ],
        }),
        variables: {
          steam_id: this.member.steam_id,
          match_lineup_id: this.lineup.id,
          new_match_lineup_id:
            this.lineup.id === this.match.lineup_1_id
              ? this.match.lineup_2_id
              : this.match.lineup_1_id,
        },
      });
    },
    async makeCaptain() {
      if (this.member.captain) {
        return;
      }
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_match_lineup_players: [
            {
              where: {
                steam_id: {
                  _eq: $("steam_id", "bigint"),
                },
                match_lineup_id: {
                  _eq: $("match_lineup_id", "uuid"),
                },
              },
              _set: {
                captain: true,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
        variables: {
          steam_id: this.member.steam_id,
          match_lineup_id: this.lineup.id,
        },
      });
    },
    async removeFromLineup() {
      if (!this.lineup.can_update_lineup) {
        return await this.$apollo.mutate({
          mutation: generateMutation({
            leaveLineup: [
              {
                match_id: $("match_id", "String!"),
              },
              {
                success: true,
              },
            ],
          }),
          variables: {
            match_id: this.match.id,
          },
        });
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_match_lineup_players: [
            {
              where: {
                steam_id: {
                  _eq: $("steam_id", "bigint"),
                },
                match_lineup_id: {
                  _eq: $("match_lineup_id", "uuid"),
                },
              },
            },
            {
              __typename: true,
            },
          ],
        }),
        variables: {
          steam_id: this.member.steam_id,
          match_lineup_id: this.lineup.id,
        },
      });
    },
  },
  computed: {
    canDoActions() {
      if (!this.me?.steam_id) return false;
      const terminal = [
        e_match_status_enum.Finished,
        e_match_status_enum.Forfeit,
        e_match_status_enum.Surrendered,
        e_match_status_enum.Tie,
      ];
      if (terminal.includes(this.match.status)) {
        return this.canRequestHighlight;
      }
      return (
        this.lineup.can_update_lineup ||
        this.canLeaveLineup ||
        this.canSwitchTeams
      );
    },
    mapsWithDemo() {
      const out: Array<{ id: string; label: string }> = [];
      for (const mm of this.match?.match_maps ?? []) {
        const demo = (mm.demos ?? [])[0];
        if (
          !demo ||
          !demo.metadata_parsed_at ||
          !demo.total_ticks ||
          Number(demo.total_ticks) <= 0
        ) {
          continue;
        }
        const label = mm.map?.label ?? mm.map?.name ?? `Map ${out.length + 1}`;
        out.push({ id: String(mm.id), label });
      }
      return out;
    },
    canRequestHighlight() {
      if (!this.me?.steam_id) return false;
      if (!this.member.player?.steam_id) return false;
      const role = this.me.role;
      const allowed =
        role === e_player_roles_enum.verified_user ||
        role === e_player_roles_enum.streamer ||
        role === e_player_roles_enum.match_organizer ||
        role === e_player_roles_enum.tournament_organizer ||
        role === e_player_roles_enum.administrator;
      if (!allowed) return false;
      return this.mapsWithDemo.length > 0;
    },
    canLeaveLineup() {
      if (!this.me?.steam_id) return false;
      return (
        this.match.status === e_match_status_enum.PickingPlayers &&
        this.member.steam_id === this.me.steam_id
      );
    },
    canSwitchTeams() {
      const currentPlayerCount =
        this.lineup.id === this.match.lineup_1_id
          ? this.match.lineup_2.lineup_players.length
          : this.match.lineup_1.lineup_players.length;

      if (currentPlayerCount >= this.match.max_players_per_lineup) {
        return false;
      }

      if (this.lineup.can_update_lineup) return true;

      if (!this.me?.steam_id) return false;

      return (
        this.match.status === e_match_status_enum.PickingPlayers &&
        this.member.steam_id === this.me.steam_id &&
        this.match.options.lobby_access !== e_lobby_access_enum.Private
      );
    },
    me() {
      return useAuthStore().me;
    },
    stats() {
      const arr =
        this.member?.player?.match_map_stats ??
        this.member?.player?.match_stats ??
        null;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    },
    hasStats() {
      return !!this.stats;
    },
    // Per-side stats: when filter is non-"all", compute from round-level
    // events in the subscription (round.kills / round.assists + the
    // round's lineup_X_side enum). This bypasses the SQL aggregate
    // columns (kills_t / kills_ct …) which would otherwise return 0
    // until recompute_player_match_map_stats is re-run on every map.
    // Damage isn't in the subscription at round level so it falls back
    // to the SQL column (damage_t / damage_ct), which is also 0 until
    // recompute runs — acceptable trade-off vs widening the query.
    perSideAgg() {
      const steamId = String(this.member?.steam_id ?? "");
      const side = this.matchSide;
      const isLineup1 = this.lineup?.id === this.match?.lineup_1_id;
      // CS2 enum stores "CT" + "TERRORIST" (not "T"). Normalize.
      const sideMatches = (roundSide: string | null | undefined) => {
        if (side === "CT") return roundSide === "CT";
        if (side === "T") return roundSide === "TERRORIST" || roundSide === "T";
        return true;
      };
      let kills = 0;
      let deaths = 0;
      let assists = 0;
      let hsKills = 0;
      let rounds = 0;
      const maps = this.match?.match_maps ?? [];
      for (const map of maps) {
        for (const round of map.rounds ?? []) {
          if (round.round === 0) continue;
          const playerSide = isLineup1
            ? round.lineup_1_side
            : round.lineup_2_side;
          if (!sideMatches(playerSide)) continue;
          rounds++;
          for (const k of round.kills ?? []) {
            const attackerId = String(k.player?.steam_id ?? "");
            const victimId = String(k.attacked_player?.steam_id ?? "");
            if (attackerId === steamId && victimId && victimId !== steamId) {
              kills++;
              if (k.headshot) hsKills++;
            }
            if (victimId === steamId && attackerId !== steamId) {
              deaths++;
            }
          }
          for (const a of round.assists ?? []) {
            if (String(a.attacker_steam_id ?? "") === steamId) assists++;
          }
        }
      }
      return { kills, deaths, assists, hsKills, rounds };
    },
    sideKills() {
      if (!this.hasStats) return 0;
      if (this.matchSide === "all") return this.stats.kills ?? 0;
      return this.perSideAgg.kills;
    },
    sideDeaths() {
      if (!this.hasStats) return 0;
      if (this.matchSide === "all") return this.stats.deaths ?? 0;
      return this.perSideAgg.deaths;
    },
    sideAssists() {
      if (!this.hasStats) return 0;
      if (this.matchSide === "all") return this.stats.assists ?? 0;
      return this.perSideAgg.assists;
    },
    sideHsKills() {
      if (!this.hasStats) return 0;
      if (this.matchSide === "all") return this.stats.hs_kills ?? 0;
      return this.perSideAgg.hsKills;
    },
    sideDamage() {
      if (!this.hasStats) return 0;
      if (this.matchSide === "T") return this.stats.damage_t ?? 0;
      if (this.matchSide === "CT") return this.stats.damage_ct ?? 0;
      return this.stats.damage ?? 0;
    },
    sideRounds() {
      if (!this.hasStats) return this.totalRounds;
      if (this.matchSide === "all") return this.totalRounds;
      return this.perSideAgg.rounds;
    },
    kd() {
      if (!this.hasStats) return "—";
      const kills = this.sideKills;
      const deaths = this.sideDeaths;
      if (deaths === 0) return kills;
      return formatStatValue(kills / deaths);
    },
    hs() {
      if (!this.hasStats) return "—";
      const kills = this.sideKills;
      if (kills === 0) return 0;
      return formatStatValue((this.sideHsKills / kills) * 100) + "%";
    },
    adr() {
      if (!this.hasStats) return 0;
      const rounds = this.sideRounds;
      if (!rounds) return 0;
      return formatStatValue(this.sideDamage / rounds);
    },
    adrTierClass() {
      return statTierClass(
        { dir: "high", cuts: [90, 70, 50] },
        Number(this.adr) || null,
      );
    },
    perRoundParticipation() {
      const steamId = String(this.member.steam_id);
      let totalRounds = 0;
      let participated = 0;
      let survived = 0;

      const maps = this.match?.match_maps ?? [];
      for (const match_map of maps) {
        const rounds = match_map?.rounds;
        if (!Array.isArray(rounds)) continue;
        for (const round of rounds) {
          if (round.round === 0) continue;
          totalRounds++;

          const kills = round.kills || [];
          const assists = round.assists || [];

          const myDeath = kills.find(
            (k: any) => String(k.attacked_player?.steam_id) === steamId,
          );

          const gotKill = kills.some(
            (k: any) =>
              String(k.player?.steam_id) === steamId &&
              String(k.attacked_player?.steam_id) !== steamId,
          );
          const gotAssist = assists.some(
            (a: any) => String(a.attacker_steam_id) === steamId,
          );
          const didSurvive = !myDeath;
          if (didSurvive) survived++;

          let traded = false;
          if (myDeath) {
            const killerSteamId = String(myDeath.player?.steam_id || "");
            if (killerSteamId) {
              traded = kills.some(
                (k: any, idx: number) =>
                  idx > kills.indexOf(myDeath) &&
                  String(k.attacked_player?.steam_id) === killerSteamId &&
                  String(k.player?.steam_id) !== steamId,
              );
            }
          }

          if (gotKill || gotAssist || didSurvive || traded) participated++;
        }
      }
      return { totalRounds, participated, survived };
    },
    kast() {
      const { totalRounds, participated } = this.perRoundParticipation;
      if (totalRounds === 0) return "—";
      return Math.round((participated / totalRounds) * 100) + "%";
    },
    kastTierClass() {
      const { totalRounds, participated } = this.perRoundParticipation;
      if (totalRounds === 0) return "";
      const pct = (participated / totalRounds) * 100;
      return statTierClass({ dir: "high", cuts: [80, 70, 60] }, pct);
    },
    survived() {
      const { totalRounds, survived } = this.perRoundParticipation;
      if (totalRounds === 0) return "—";
      const pct = Math.round((survived / totalRounds) * 100);
      return `${survived} (${pct}%)`;
    },
    hltvRating() {
      if (!this.hasStats) return null;
      const rounds = this.stats.rounds_played ?? this.totalRounds;
      if (!rounds) return null;
      const k = this.stats.kills ?? 0;
      const d = this.stats.deaths ?? 0;
      const a = this.stats.assists ?? 0;
      const dmg = this.stats.damage ?? 0;
      const kpr = k / rounds;
      const dpr = d / rounds;
      const apr = a / rounds;
      const adr = dmg / rounds;
      const { totalRounds, participated } = this.perRoundParticipation;
      const kastPct = totalRounds > 0 ? (participated / totalRounds) * 100 : 0;
      const impact = 2.13 * kpr + 0.42 * apr - 0.41;
      const rating =
        0.0073 * kastPct +
        0.3591 * kpr -
        0.5329 * dpr +
        0.2372 * impact +
        0.0032 * adr +
        0.1587;
      return rating.toFixed(2);
    },
    hltvTierClass() {
      if (this.hltvRating === null) return "";
      const value = parseFloat(this.hltvRating);
      return statTierClass({ dir: "high", cuts: [1.2, 1.0, 0.85] }, value);
    },
    twoKills() {
      return this.stats?.two_kill_rounds ?? "—";
    },
    threeKills() {
      return this.stats?.three_kill_rounds ?? "—";
    },
    fourKills() {
      return this.stats?.four_kill_rounds ?? "—";
    },
    fiveKills() {
      return this.stats?.five_kill_rounds ?? "—";
    },
    totalMultiKills() {
      if (!this.stats) return null;
      return (
        (this.stats.two_kill_rounds ?? 0) +
        (this.stats.three_kill_rounds ?? 0) +
        (this.stats.four_kill_rounds ?? 0) +
        (this.stats.five_kill_rounds ?? 0)
      );
    },
    totalRounds() {
      let rounds = 0;
      for (const match_map of this.match.match_maps) {
        rounds += match_map.lineup_1_score + match_map.lineup_2_score;
      }
      return rounds;
    },
    mobileAvatarSrc() {
      const steamId = this.member?.player?.steam_id;
      if (!steamId) return null;
      const apiDomain = useRuntimeConfig().public.apiDomain;
      const lineups = [this.match?.lineup_1, this.match?.lineup_2].filter(
        Boolean,
      );
      for (const lineup of lineups) {
        const inLineup = lineup.lineup_players?.some(
          (lp: any) => String(lp.steam_id) === String(steamId),
        );
        if (!inLineup) continue;
        const override = buildLineupAvatarOverride(lineup)(steamId);
        if (override) return resolveAvatarUrl(override, apiDomain);
      }
      return resolveAvatarUrl(
        this.member.player.roster_image_url ||
          this.member.player.custom_avatar_url ||
          this.member.player.avatar_url,
        apiDomain,
      );
    },
    memberEloChange() {
      const steamId = this.member?.steam_id ?? this.member?.player?.steam_id;
      if (!steamId) {
        return null;
      }
      return (
        this.match.elo_changes?.find?.(
          (ec: any) => String(ec.player_steam_id) === String(steamId),
        ) ?? null
      );
    },
  },
};
</script>
