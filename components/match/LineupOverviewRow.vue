<script lang="ts" setup>
import formatStatValue from "~/utilities/formatStatValue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import StatChevron from "~/components/StatChevron.vue";
import StatLabel from "~/components/common/StatLabel.vue";
import { KAST_TIER, ADR_TIER, kdColor, hltvColor } from "~/utils/statTiers";
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
import {
  ArrowLeftRight,
  Crown,
  LogOut,
  MoreVertical,
  Shield,
  Sparkles,
  UserMinus,
} from "lucide-vue-next";
import TimezoneFlag from "~/components/TimezoneFlag.vue";
import PlayerElo from "~/components/PlayerElo.vue";
import PlayerFaceitRank from "~/components/PlayerFaceitRank.vue";
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
            <template v-if="canManageLineup">
              <DropdownMenuItem @click="makeCaptain" :disabled="member.captain">
                <Shield />
                <span>{{ $t("match.overview.promote_captain") }}</span>
              </DropdownMenuItem>

              <DropdownMenuItem @click="switchTeams" v-if="canSwitchTeams">
                <ArrowLeftRight />
                <span>{{ $t("match.overview.switch_teams") }}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                class="text-destructive"
                @click="removeFromLineup"
                v-if="canManageLineup"
              >
                <UserMinus />
                <span>{{ $t("match.overview.remove_from_lineup") }}</span>
              </DropdownMenuItem>
            </template>

            <DropdownMenuItem
              @click="switchTeams"
              v-if="!canManageLineup && canSwitchTeams"
            >
              <ArrowLeftRight />
              <span>{{ $t("match.overview.switch_teams") }}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              class="text-destructive"
              @click="removeFromLineup"
              v-if="canLeaveLineup"
            >
              <LogOut />
              <span>{{ $t("match.overview.leave_lineup") }}</span>
            </DropdownMenuItem>

            <template v-if="canRequestHighlight">
              <DropdownMenuSeparator
                v-if="canManageLineup || canLeaveLineup || canSwitchTeams"
              />
              <DropdownMenuItem @click="renderHighlightOpen = true">
                <Sparkles class="text-[hsl(var(--tac-amber))]" />
                <span>{{ $t("match.overview.render_highlight") }}</span>
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
                    <PlayerElo
                      v-if="!isExternalMatch"
                      :elo="member.player.elo"
                      :type="match?.options?.type"
                    />
                    <PlayerFaceitRank
                      v-else-if="
                        isFaceitMatch &&
                        (faceitSkillLevel(member) || faceitElo(member))
                      "
                      :faceit-skill-level="faceitSkillLevel(member)"
                      :faceit-elo="faceitElo(member)"
                      :faceit-url="member.player.faceit_url"
                      :faceit-nickname="member.player.faceit_nickname"
                    />
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
      <TableCell class="tabular-nums">
        <AnimatedStat :value="hasStats ? sideKills : DASH" />
      </TableCell>
      <TableCell v-if="overviewVis.assists !== false" class="tabular-nums">
        <AnimatedStat :value="hasStats ? sideAssists : DASH" />
      </TableCell>
      <TableCell class="tabular-nums">
        <AnimatedStat :value="hasStats ? sideDeaths : DASH" />
      </TableCell>
      <TableCell v-if="overviewVis.kd !== false" class="tabular-nums">
        <AnimatedStat :value="kd" :style="{ color: kdColor(kdNum) }" />
      </TableCell>
      <TableCell v-if="overviewVis.hs !== false" class="tabular-nums">
        <AnimatedStat :value="hs" />
      </TableCell>
      <TableCell v-if="overviewVis.survived !== false" class="tabular-nums">
        <span class="inline-flex items-baseline gap-1">
          <template v-if="survivedPct !== null">
            <span class="tabular-nums"
              ><AnimatedStat :value="survivedCount"
            /></span>
            <span
              class="tabular-nums text-xs text-muted-foreground leading-none"
              >(<StatLabel stat="survived_pct"
                ><AnimatedStat :value="survivedPct + '%'" /></StatLabel
              >)</span
            >
          </template>
          <template v-else>{{ DASH }}</template>
        </span>
      </TableCell>
      <TableCell v-if="overviewVis.multikills !== false" class="tabular-nums">
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
              <AnimatedStat :value="totalMultiKills" />
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
                  <AnimatedStat :value="row.count" />
                </span>
              </button>
            </div>
          </HoverCardContent>
        </HoverCard>
        <template v-else
          ><AnimatedStat :value="totalMultiKills ?? DASH"
        /></template>
      </TableCell>
      <TableCell v-if="overviewVis.hltv !== false" class="tabular-nums">
        <AnimatedStat
          :value="hltvRating ?? DASH"
          :style="{ color: hltvColor(hltvNum) }"
        />
      </TableCell>
      <TableCell v-if="overviewVis.kast !== false" class="tabular-nums">
        <span class="inline-flex items-center gap-0.5">
          <AnimatedStat :value="kast" />
          <StatChevron :cfg="KAST_TIER" :value="kastPct" />
        </span>
      </TableCell>
      <TableCell>
        <span
          class="md:hidden tabular-nums text-xs inline-flex items-center gap-0.5"
        >
          <AnimatedStat :value="hasStats ? adr : DASH" />
          <StatChevron :cfg="ADR_TIER" :value="adrNum" />
        </span>
        <div class="hidden md:flex flex-col items-start leading-tight">
          <span class="tabular-nums"
            ><AnimatedStat :value="stats?.damage ?? DASH"
          /></span>
          <span
            v-if="hasStats"
            class="font-mono text-[0.6rem] tracking-[0.18em] uppercase text-muted-foreground inline-flex items-center gap-0.5"
          >
            <AnimatedStat :value="adr" />
            <StatChevron :cfg="ADR_TIER" :value="adrNum" />
            <span class="ml-1">ADR</span>
          </span>
        </div>
      </TableCell>
      <TableCell v-if="overviewVis.team_damage">
        <AnimatedStat :value="stats?.team_damage ?? DASH" />
      </TableCell>
      <TableCell v-if="overviewVis.knife_kills">
        <AnimatedStat :value="stats?.knife_kills ?? DASH" />
      </TableCell>
      <TableCell v-if="overviewVis.zeus_kills">
        <AnimatedStat :value="stats?.zeus_kills ?? DASH" />
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
import { $, e_match_status_enum, e_player_roles_enum } from "~/generated/zeus";

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
    faceitSkillLevel(member: any): number | null {
      return (
        member?.player?.faceit_rank_history?.[0]?.skill_level ??
        member?.player?.faceit_skill_level ??
        null
      );
    },
    faceitElo(member: any): number | null {
      return (
        member?.player?.faceit_rank_history?.[0]?.elo ??
        member?.player?.faceit_elo ??
        null
      );
    },
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
    // Imported from outside 5stack (e.g. Valve / Faceit match history).
    isExternalMatch() {
      return !!this.match?.source && this.match.source !== "5stack";
    },
    isFaceitMatch() {
      return this.match?.source === "faceit";
    },
    // Roster management (promote captain, switch teams, remove player) is only
    // valid before the match goes live — once it's Live or terminal the lineup
    // is locked, so these actions disappear (and with them the row's action
    // column, which keeps the table from jerking when switching stat lenses).
    canManageLineup() {
      if (!this.lineup.can_update_lineup) return false;
      return [
        e_match_status_enum.PickingPlayers,
        e_match_status_enum.WaitingForCheckIn,
        e_match_status_enum.Scheduled,
        e_match_status_enum.Veto,
        e_match_status_enum.WaitingForServer,
      ].includes(this.match.status);
    },
    canDoActions() {
      if (!this.me?.steam_id) return false;
      return (
        this.canManageLineup ||
        this.canLeaveLineup ||
        this.canSwitchTeams ||
        this.canRequestHighlight
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
      if (this.me.role !== e_player_roles_enum.administrator) return false;
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

      return this.canManageLineup;
    },
    me() {
      return useAuthStore().me;
    },
    stats() {
      const arr =
        this.member?.player?.match_stats ??
        this.member?.player?.match_map_stats ??
        null;
      return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
    },
    hasStats() {
      return !!this.stats;
    },
    // Per-side stats read straight from the SQL aggregate columns
    // (kills_t/kills_ct, deaths_t/ct, …) on player_match_(map_)stats. The
    // backend recompute now normalizes the side token (normalize_side) so
    // these are correct for live matches too — no client-side round walking.
    sideKills() {
      if (!this.hasStats) return 0;
      if (this.matchSide === "T") return this.stats.kills_t ?? 0;
      if (this.matchSide === "CT") return this.stats.kills_ct ?? 0;
      return this.stats.kills ?? 0;
    },
    sideDeaths() {
      if (!this.hasStats) return 0;
      if (this.matchSide === "T") return this.stats.deaths_t ?? 0;
      if (this.matchSide === "CT") return this.stats.deaths_ct ?? 0;
      return this.stats.deaths ?? 0;
    },
    sideAssists() {
      if (!this.hasStats) return 0;
      if (this.matchSide === "T") return this.stats.assists_t ?? 0;
      if (this.matchSide === "CT") return this.stats.assists_ct ?? 0;
      return this.stats.assists ?? 0;
    },
    sideHsKills() {
      if (!this.hasStats) return 0;
      if (this.matchSide === "T") return this.stats.hs_kills_t ?? 0;
      if (this.matchSide === "CT") return this.stats.hs_kills_ct ?? 0;
      return this.stats.hs_kills ?? 0;
    },
    sideDamage() {
      if (!this.hasStats) return 0;
      if (this.matchSide === "T") return this.stats.damage_t ?? 0;
      if (this.matchSide === "CT") return this.stats.damage_ct ?? 0;
      return this.stats.damage ?? 0;
    },
    sideRounds() {
      if (!this.hasStats) return this.totalRounds;
      if (this.matchSide === "T") return this.stats.rounds_t ?? 0;
      if (this.matchSide === "CT") return this.stats.rounds_ct ?? 0;
      return this.totalRounds;
    },
    kd() {
      if (!this.hasStats) return "—";
      const kills = this.sideKills;
      const deaths = this.sideDeaths;
      if (deaths === 0) return kills;
      return formatStatValue(kills / deaths);
    },
    kdNum() {
      if (!this.hasStats) return null;
      const kills = this.sideKills;
      const deaths = this.sideDeaths;
      if (deaths === 0) return kills;
      return kills / deaths;
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
    adrNum() {
      return this.hasStats ? Number(this.adr) || null : null;
    },
    // True when a CT/T side filter is active. KAST is NOT side-split in the
    // backend, so several derived stats can't be side-scoped while filtered.
    sideFiltered() {
      return this.matchSide === "T" || this.matchSide === "CT";
    },
    // Rounds-weighted KAST from the canonical v_player_match_map_hltv view
    // (per map), exposed via the player.match_map_hltv relationship — no
    // round-walking on the client. KAST is not side-split in the backend, so
    // while a side filter is active we have no honest value to show.
    kastPct() {
      if (this.sideFiltered) return null;
      const rows = this.member?.player?.match_map_hltv ?? [];
      let weighted = 0;
      let rounds = 0;
      for (const row of rows) {
        const rp = row.rounds_played ?? 0;
        weighted += (row.kast_pct ?? 0) * rp;
        rounds += rp;
      }
      return rounds > 0 ? weighted / rounds : null;
    },
    kast() {
      return this.kastPct === null ? "—" : Math.round(this.kastPct) + "%";
    },
    survivedCount() {
      if (!this.hasStats) return "—";
      const rounds = this.sideFiltered
        ? this.sideRounds
        : (this.stats.rounds_played ?? 0);
      if (!rounds) return "—";
      const deaths = this.sideFiltered
        ? this.sideDeaths
        : (this.stats.deaths ?? 0);
      return rounds - deaths;
    },
    survivedPct() {
      if (!this.hasStats) return null;
      const rounds = this.sideFiltered
        ? this.sideRounds
        : (this.stats.rounds_played ?? 0);
      if (!rounds) return null;
      const deaths = this.sideFiltered
        ? this.sideDeaths
        : (this.stats.deaths ?? 0);
      const surv = rounds - deaths;
      return Math.round((surv / rounds) * 100);
    },
    hltvRating() {
      if (!this.hasStats) return null;
      // HLTV rating needs KAST, which isn't side-split in the backend. Rather
      // than emit a rating deflated by the missing ~0.5 KAST term, show "—"
      // while a side filter is active (consistent with kastPct).
      if (this.sideFiltered) return null;
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
      const kastPct = this.kastPct ?? 0;
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
    hltvNum() {
      if (this.hltvRating === null) return null;
      return parseFloat(this.hltvRating);
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
