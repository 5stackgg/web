<script lang="ts" setup>
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import MatchTableRow from "~/components/MatchTableRow.vue";
import TrophyBadge from "~/components/trophy/TrophyBadge.vue";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import { ChevronRight } from "lucide-vue-next";
</script>

<template>
  <div class="space-y-6">
    <!-- Podium -->
    <section
      v-if="showStandings && podium.length && !isLive"
      class="relative overflow-hidden rounded-lg border border-border px-6 py-7 [background:radial-gradient(ellipse_at_top,hsl(var(--tac-amber)_/_0.08)_0%,transparent_60%),linear-gradient(180deg,hsl(var(--card)_/_0.6)_0%,hsl(var(--card)_/_0.25)_100%)] [backdrop-filter:blur(6px)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-[14px] before:w-[14px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-[14px] after:w-[14px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-['']"
    >
      <div
        class="pointer-events-none absolute inset-0 [background-image:repeating-linear-gradient(3deg,transparent_0,transparent_3px,hsl(var(--tac-amber)_/_0.025)_3px,hsl(var(--tac-amber)_/_0.025)_4px)]"
        aria-hidden="true"
      ></div>

      <header class="relative mb-6 flex flex-col gap-1">
        <div
          class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground"
        >
          <span
            class="translate-y-[-1px] text-[0.7rem] text-[hsl(var(--tac-amber))]"
            >◢</span
          >
          {{ $t("trophies.title") }}
        </div>
        <div
          class="font-mono text-[0.62rem] uppercase tracking-[0.3em] text-muted-foreground/70"
        >
          ▚ FINAL STANDINGS · PODIUM
        </div>
      </header>

      <div
        class="relative flex flex-col items-center justify-center gap-6 sm:flex-row sm:items-end sm:gap-4 md:gap-6"
      >
        <HoverCard
          v-for="entry in podium"
          :key="entry.placement + '-' + entry.teamId"
          :open-delay="120"
          :close-delay="80"
        >
          <HoverCardTrigger as-child>
            <div
              class="group/step relative flex w-full max-w-xs cursor-default flex-col items-center gap-3 sm:w-auto sm:flex-1"
              :class="{
                'order-1 sm:order-2': entry.placement === 1,
                'order-2 sm:order-1': entry.placement === 2,
                'order-3': entry.placement === 3,
              }"
            >
              <div
                class="rounded-sm border px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.22em]"
                :style="{
                  borderColor: tierColor(entry.placement) + '66',
                  background: tierColor(entry.placement) + '14',
                  color: tierColor(entry.placement),
                }"
              >
                {{ placementLabel(entry.placement) }}
              </div>

              <div class="relative">
                <div
                  class="pointer-events-none absolute inset-0 blur-2xl transition-opacity duration-300 group-hover/step:opacity-100"
                  :class="entry.placement === 1 ? 'opacity-60' : 'opacity-30'"
                  :style="{
                    background: `radial-gradient(ellipse at center, ${tierColor(entry.placement)} 0%, transparent 65%)`,
                  }"
                  aria-hidden="true"
                ></div>
                <TrophyBadge
                  :tournament-id="tournament.id"
                  :placement="entry.placement"
                  :tournament-name="tournament.name"
                  :tournament-start="tournament.start"
                  :tournament-type="entry.tournamentType"
                  :custom-name="trophyConfigFor(entry.placement)?.custom_name"
                  :silhouette-override="
                    trophyConfigFor(entry.placement)?.silhouette
                  "
                  :image-url="trophyConfigFor(entry.placement)?.image_url"
                  :size="entry.placement === 1 ? 'lg' : 'md'"
                  :interactive="false"
                  class="relative z-[1]"
                />
              </div>

              <div
                class="relative w-full border border-border/80 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted)_/_0.4)_100%)] px-4 pb-4 pt-3 transition-colors duration-150 group-hover/step:border-[hsl(var(--tac-amber)_/_0.6)]"
                :class="
                  entry.placement === 1
                    ? 'min-h-[130px] sm:min-h-[150px]'
                    : entry.placement === 2
                      ? 'min-h-[110px] sm:min-h-[125px]'
                      : 'min-h-[95px] sm:min-h-[110px]'
                "
                :style="{
                  clipPath:
                    'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%, 0 8px)',
                }"
              >
                <span
                  class="pointer-events-none absolute inset-x-4 top-0 h-[2px]"
                  :style="{
                    background: `linear-gradient(90deg, transparent, ${tierColor(entry.placement)}, transparent)`,
                  }"
                ></span>

                <div class="flex flex-col items-center gap-1">
                  <div
                    class="font-mono text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground"
                  >
                    #{{ String(entry.placement).padStart(2, "0") }}
                  </div>
                  <div
                    class="text-center text-base font-bold uppercase leading-tight tracking-[0.02em] sm:text-lg"
                  >
                    {{ entry.teamName }}
                  </div>
                  <div class="mt-1.5 flex -space-x-2">
                    <div
                      v-for="p in entry.players.slice(0, 5)"
                      :key="p.steam_id"
                      class="relative h-6 w-6 overflow-hidden rounded-sm border border-border/80 bg-muted/40"
                      :title="p.name"
                    >
                      <img
                        v-if="p.custom_avatar_url || p.avatar_url"
                        :src="p.custom_avatar_url || p.avatar_url"
                        :alt="p.name"
                        class="h-full w-full object-cover"
                      />
                      <span
                        v-else
                        class="flex h-full w-full items-center justify-center text-[0.6rem] font-bold uppercase text-muted-foreground"
                      >
                        {{ (p.name || "?").slice(0, 1) }}
                      </span>
                    </div>
                    <div
                      v-if="entry.players.length > 5"
                      class="flex h-6 min-w-6 items-center justify-center rounded-sm border border-border/80 bg-muted/40 px-1 text-[0.55rem] font-bold text-muted-foreground"
                    >
                      +{{ entry.players.length - 5 }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </HoverCardTrigger>
          <HoverCardContent
            class="w-[320px] border-[hsl(var(--tac-amber)_/_0.5)] bg-background/95 p-0 [backdrop-filter:blur(8px)]"
            side="top"
          >
            <div class="border-b border-border/60 px-3 py-2">
              <div
                class="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                ▚ TOURNAMENT STATS · {{ placementLabel(entry.placement) }}
              </div>
              <div class="text-sm font-bold uppercase tracking-[0.04em]">
                {{ entry.teamName }}
              </div>
            </div>
            <div class="divide-y divide-border/40">
              <div
                v-for="p in entry.players"
                :key="p.steam_id"
                class="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 px-3 py-2 text-xs"
              >
                <PlayerDisplay
                  :player="p"
                  :show-flag="true"
                  :show-role="false"
                  :show-elo="false"
                  :show-trophies="false"
                  size="xs"
                />
                <template v-if="playerStatFor(p.steam_id)">
                  <div class="flex flex-col items-end">
                    <span
                      class="font-mono font-bold tabular-nums text-foreground"
                    >
                      {{ playerStatFor(p.steam_id).kills }}
                    </span>
                    <span
                      class="font-mono text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground"
                      >K</span
                    >
                  </div>
                  <div class="flex flex-col items-end">
                    <span
                      class="font-mono font-bold tabular-nums text-foreground"
                    >
                      {{ playerStatFor(p.steam_id).assists }}
                    </span>
                    <span
                      class="font-mono text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground"
                      >A</span
                    >
                  </div>
                  <div class="flex flex-col items-end">
                    <span
                      class="font-mono font-bold tabular-nums text-foreground"
                    >
                      {{ playerStatFor(p.steam_id).deaths }}
                    </span>
                    <span
                      class="font-mono text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground"
                      >D</span
                    >
                  </div>
                  <div class="flex flex-col items-end">
                    <span
                      class="font-mono font-bold tabular-nums"
                      :style="{
                        color:
                          playerStatFor(p.steam_id).kdr >= 1
                            ? 'hsl(142, 71%, 55%)'
                            : 'hsl(0, 84%, 65%)',
                      }"
                    >
                      {{ playerStatFor(p.steam_id).kdr.toFixed(2) }}
                    </span>
                    <span
                      class="font-mono text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground"
                      >K/D</span
                    >
                  </div>
                </template>
                <template v-else>
                  <div
                    class="col-span-4 text-right font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/60"
                  >
                    NO DATA
                  </div>
                </template>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      </div>

      <!-- MVP award -->
      <div
        v-if="mvp"
        class="relative mt-7 flex flex-col gap-4 border-t border-dashed border-border pt-6 sm:flex-row sm:items-center"
      >
        <div class="flex items-center gap-4 sm:flex-1">
          <div class="relative shrink-0">
            <div
              class="pointer-events-none absolute inset-0 blur-2xl"
              :style="{
                background:
                  'radial-gradient(ellipse at center, hsl(195 85% 60%) 0%, transparent 65%)',
                opacity: 0.45,
              }"
              aria-hidden="true"
            ></div>
            <TrophyBadge
              :tournament-id="tournament.id"
              :placement="0"
              :tournament-name="tournament.name"
              :tournament-start="tournament.start"
              :tournament-type="mvp.tournament_type"
              :custom-name="trophyConfigFor(0)?.custom_name"
              :silhouette-override="trophyConfigFor(0)?.silhouette"
              :image-url="trophyConfigFor(0)?.image_url"
              size="md"
              :interactive="false"
              class="relative z-[1]"
            />
          </div>

          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <div
              class="inline-flex w-fit items-center gap-2 rounded-sm border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.24em]"
              style="
                border-color: hsl(195 85% 60% / 0.55);
                background: hsl(195 85% 60% / 0.12);
                color: hsl(195 85% 60%);
              "
            >
              <span
                class="inline-block h-1.5 w-1.5 rounded-full"
                style="
                  background: hsl(195 85% 60%);
                  box-shadow: 0 0 6px hsl(195 85% 60%);
                "
              ></span>
              MOST VALUABLE PLAYER
            </div>
            <PlayerDisplay
              v-if="mvp.player"
              :player="mvp.player"
              :show-flag="true"
              :show-role="false"
              :show-elo="true"
              :show-trophies="false"
              :linkable="true"
              size="sm"
            />
            <div
              v-if="mvpTeamName"
              class="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground"
            >
              ↳ {{ mvpTeamName }}
            </div>
          </div>
        </div>

        <!-- MVP headline stats -->
        <div
          v-if="mvpStats"
          class="grid grid-cols-4 gap-0 overflow-hidden rounded-sm border border-border/80 bg-background/60 [backdrop-filter:blur(4px)] sm:w-auto"
        >
          <div
            class="flex flex-col items-center border-r border-border/60 px-4 py-2"
          >
            <span class="font-mono text-base font-bold tabular-nums">{{
              mvpStats.kills
            }}</span>
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
              >KILLS</span
            >
          </div>
          <div
            class="flex flex-col items-center border-r border-border/60 px-4 py-2"
          >
            <span class="font-mono text-base font-bold tabular-nums">{{
              mvpStats.assists
            }}</span>
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
              >ASSISTS</span
            >
          </div>
          <div
            class="flex flex-col items-center border-r border-border/60 px-4 py-2"
          >
            <span class="font-mono text-base font-bold tabular-nums">{{
              mvpStats.deaths
            }}</span>
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
              >DEATHS</span
            >
          </div>
          <div class="flex flex-col items-center px-4 py-2">
            <span
              class="font-mono text-base font-bold tabular-nums"
              :style="{
                color:
                  mvpStats.kdr >= 1 ? 'hsl(142, 71%, 55%)' : 'hsl(0, 84%, 65%)',
              }"
            >
              {{ mvpStats.kdr.toFixed(2) }}
            </span>
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
              >K/D</span
            >
          </div>
        </div>
      </div>
    </section>

    <!-- Standings Table -->
    <Card v-if="showStandings">
      <CardHeader>
        <div class="flex items-center justify-between gap-3">
          <CardTitle>{{ $t("tournament.standings.title") }}</CardTitle>
          <span
            v-if="isLive"
            class="inline-flex items-center gap-2 rounded-sm border border-destructive/55 bg-destructive/15 px-2.5 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.22em] text-destructive"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-current"></span>
            LIVE · PROVISIONAL
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-10"></TableHead>
              <TableHead class="w-16 text-center">#</TableHead>
              <TableHead>{{ $t("team.table.team") }}</TableHead>
              <TableHead class="text-center">{{
                $t("common.stats.wins")
              }}</TableHead>
              <TableHead class="text-center">{{
                $t("common.stats.losses")
              }}</TableHead>
              <TableHead class="text-center">{{
                $t("tournament.results_table.matches")
              }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template
              v-for="teamResult in teamResults"
              :key="teamResult.teamId"
            >
              <TableRow
                class="cursor-pointer transition-colors duration-150 hover:bg-[hsl(var(--tac-amber)_/_0.04)]"
                :class="{
                  'border-b-0 bg-[hsl(var(--tac-amber)_/_0.06)]': expanded.has(
                    teamResult.teamId,
                  ),
                }"
                @click="toggleExpanded(teamResult.teamId)"
              >
                <TableCell>
                  <ChevronRight
                    class="h-4 w-4 text-muted-foreground transition-transform duration-200"
                    :class="{
                      'rotate-90 text-[hsl(var(--tac-amber))]': expanded.has(
                        teamResult.teamId,
                      ),
                    }"
                  />
                </TableCell>
                <TableCell class="text-center">
                  <div class="flex flex-col items-center gap-0.5">
                    <span
                      class="font-mono text-sm font-bold leading-none tabular-nums"
                      :style="rankStyle(teamResult.rank)"
                    >
                      {{ ordinal(teamResult.rank) }}
                    </span>
                    <span
                      v-if="teamResult.tied && !isLive"
                      class="rounded-sm border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.12)] px-1 py-[1px] font-mono text-[0.5rem] font-bold uppercase leading-none tracking-[0.18em] text-[hsl(var(--tac-amber))]"
                    >
                      TIED
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div class="font-medium">{{ teamResult.teamName }}</div>
                  <div
                    class="mt-1 font-mono text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground/70"
                  >
                    {{ (teamResult.team?.roster || []).length }}
                    {{ $t("trophies.teammates") }}
                  </div>
                </TableCell>
                <TableCell class="text-center font-mono tabular-nums">{{
                  teamResult.wins
                }}</TableCell>
                <TableCell class="text-center font-mono tabular-nums">{{
                  teamResult.losses
                }}</TableCell>
                <TableCell class="text-center font-mono tabular-nums">{{
                  teamResult.matchesPlayed
                }}</TableCell>
              </TableRow>
              <TableRow
                v-if="expanded.has(teamResult.teamId)"
                :key="teamResult.teamId + '-expanded'"
                class="bg-[hsl(var(--tac-amber)_/_0.03)] hover:bg-[hsl(var(--tac-amber)_/_0.03)]"
              >
                <TableCell :colspan="6" class="p-0">
                  <div
                    class="relative border-t border-[hsl(var(--tac-amber)_/_0.25)] px-4 py-3"
                  >
                    <span
                      class="pointer-events-none absolute inset-x-4 top-0 h-[1px]"
                      style="
                        background: linear-gradient(
                          90deg,
                          transparent,
                          hsl(var(--tac-amber) / 0.55),
                          transparent
                        );
                      "
                    ></span>
                    <div
                      class="mb-2 inline-flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
                    >
                      <span
                        class="h-[2px] w-2 bg-[hsl(var(--tac-amber))]"
                      ></span>
                      ROSTER PERFORMANCE
                    </div>
                    <div
                      class="overflow-hidden rounded-sm border border-border/60"
                    >
                      <table class="w-full text-xs">
                        <thead class="bg-background/50">
                          <tr
                            class="font-mono uppercase tracking-[0.18em] text-muted-foreground"
                          >
                            <th class="px-3 py-1.5 text-left text-[0.6rem]">
                              Player
                            </th>
                            <th class="px-2 py-1.5 text-right text-[0.6rem]">
                              K
                            </th>
                            <th class="px-2 py-1.5 text-right text-[0.6rem]">
                              A
                            </th>
                            <th class="px-2 py-1.5 text-right text-[0.6rem]">
                              D
                            </th>
                            <th class="px-2 py-1.5 text-right text-[0.6rem]">
                              K/D
                            </th>
                            <th class="px-2 py-1.5 text-right text-[0.6rem]">
                              HS%
                            </th>
                            <th class="px-3 py-1.5 text-right text-[0.6rem]">
                              MP
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-border/40">
                          <tr
                            v-for="rosterItem in teamResult.team?.roster || []"
                            :key="
                              rosterItem.player?.steam_id || rosterItem.steam_id
                            "
                          >
                            <td class="px-3 py-2">
                              <PlayerDisplay
                                :player="rosterItem.player || rosterItem"
                                :show-flag="true"
                                :show-role="false"
                                :show-elo="false"
                                :show-trophies="false"
                                :linkable="true"
                                size="xs"
                              />
                            </td>
                            <template
                              v-if="
                                playerStatFor(
                                  rosterItem.player?.steam_id ||
                                    rosterItem.steam_id,
                                )
                              "
                            >
                              <td
                                class="px-2 py-2 text-right font-mono font-semibold tabular-nums"
                              >
                                {{
                                  playerStatFor(
                                    rosterItem.player?.steam_id ||
                                      rosterItem.steam_id,
                                  ).kills
                                }}
                              </td>
                              <td
                                class="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground"
                              >
                                {{
                                  playerStatFor(
                                    rosterItem.player?.steam_id ||
                                      rosterItem.steam_id,
                                  ).assists
                                }}
                              </td>
                              <td
                                class="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground"
                              >
                                {{
                                  playerStatFor(
                                    rosterItem.player?.steam_id ||
                                      rosterItem.steam_id,
                                  ).deaths
                                }}
                              </td>
                              <td
                                class="px-2 py-2 text-right font-mono font-semibold tabular-nums"
                                :style="{
                                  color:
                                    playerStatFor(
                                      rosterItem.player?.steam_id ||
                                        rosterItem.steam_id,
                                    ).kdr >= 1
                                      ? 'hsl(142, 71%, 55%)'
                                      : 'hsl(0, 84%, 65%)',
                                }"
                              >
                                {{
                                  playerStatFor(
                                    rosterItem.player?.steam_id ||
                                      rosterItem.steam_id,
                                  ).kdr.toFixed(2)
                                }}
                              </td>
                              <td
                                class="px-2 py-2 text-right font-mono tabular-nums text-muted-foreground"
                              >
                                {{
                                  playerStatFor(
                                    rosterItem.player?.steam_id ||
                                      rosterItem.steam_id,
                                  ).headshot_percentage.toFixed(0)
                                }}%
                              </td>
                              <td
                                class="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground"
                              >
                                {{
                                  playerStatFor(
                                    rosterItem.player?.steam_id ||
                                      rosterItem.steam_id,
                                  ).matches_played
                                }}
                              </td>
                            </template>
                            <template v-else>
                              <td
                                :colspan="6"
                                class="px-3 py-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground/60"
                              >
                                NO DATA
                              </td>
                            </template>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            </template>
            <TableRow v-if="teamResults.length === 0">
              <TableCell colspan="6" class="text-center text-muted-foreground">
                No standings yet
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <!-- All Matches -->
    <Card v-if="showMatches">
      <CardHeader>
        <CardTitle>{{ $t("tournament.results.title") }}</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="space-y-4">
          <MatchTableRow
            v-for="match in allMatches"
            :key="match.id"
            :match="match"
          />
          <div
            v-if="allMatches.length === 0"
            class="text-center text-muted-foreground py-8"
          >
            No matches played yet
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script lang="ts">
import { e_tournament_status_enum } from "~/generated/zeus";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
    showStandings: {
      type: Boolean,
      default: true,
    },
    showMatches: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      expanded: new Set<string>(),
    };
  },
  methods: {
    toggleExpanded(teamId: string) {
      if (this.expanded.has(teamId)) {
        this.expanded.delete(teamId);
      } else {
        this.expanded.add(teamId);
      }
      // force reactivity for Set
      this.expanded = new Set(this.expanded);
    },
    tierColor(placement: number) {
      if (placement === 0) return "hsl(195 85% 60%)";
      if (placement === 1) return "hsl(45 95% 60%)";
      if (placement === 2) return "hsl(0 0% 78%)";
      return "hsl(28 70% 52%)";
    },
    ordinal(n: number) {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },
    rankStyle(rank: number) {
      if ((this as any).isLive) return {};
      if (rank === 1) return { color: "hsl(45 95% 60%)" };
      if (rank === 2) return { color: "hsl(0 0% 78%)" };
      if (rank === 3) return { color: "hsl(28 70% 52%)" };
      return {};
    },
    placementLabel(placement: number) {
      if (placement === 0) return this.$t("trophies.mvp");
      if (placement === 1) return this.$t("trophies.first_place");
      if (placement === 2) return this.$t("trophies.second_place");
      return this.$t("trophies.third_place");
    },
    trophyConfigFor(placement: number) {
      const configs = (this.tournament as any)?.trophy_configs || [];
      return configs.find((c: any) => c.placement === placement) || null;
    },
    // Prefer the underlying linked team's name; tournament_team.name is a
    // copy that sometimes holds a placeholder (e.g. "Team <uuid>"), so using
    // it first produced inconsistent labels between podium and standings.
    displayTeamName(tournamentTeam: any, fallbackId?: string) {
      const underlying = tournamentTeam?.team?.name;
      if (underlying) return underlying;
      const ownName = tournamentTeam?.name;
      if (ownName) return ownName;
      return fallbackId ? `Team ${fallbackId}` : "";
    },
    playerStatFor(steamId: string | number) {
      if (!steamId) return null;
      const stats = (this.tournament as any)?.player_stats || [];
      const raw = stats.find(
        (s: any) => String(s.player_steam_id) === String(steamId),
      );
      if (!raw) return null;
      return {
        ...raw,
        kills: Number(raw.kills ?? 0),
        deaths: Number(raw.deaths ?? 0),
        assists: Number(raw.assists ?? 0),
        headshots: Number(raw.headshots ?? 0),
        matches_played: Number(raw.matches_played ?? 0),
        kdr: Number(raw.kdr ?? 0),
        headshot_percentage: Number(raw.headshot_percentage ?? 0),
      };
    },
  },
  computed: {
    isLive() {
      return (this.tournament as any)?.status === e_tournament_status_enum.Live;
    },
    podium() {
      const trophies = (this.tournament as any)?.trophies || [];
      if (trophies.length === 0) return [];
      const byPlacement = new Map();
      for (const t of trophies) {
        if (t.placement === 0) continue;
        const existing = byPlacement.get(t.placement);
        if (existing) {
          if (
            t.player &&
            !existing.players.some(
              (p: any) => String(p.steam_id) === String(t.player.steam_id),
            )
          ) {
            existing.players.push(t.player);
          }
          continue;
        }
        const rosterPlayers = (t.tournament_team?.roster || [])
          .map((r: any) => r.player)
          .filter(Boolean);
        const players = rosterPlayers.length
          ? rosterPlayers
          : t.player
            ? [t.player]
            : [];
        byPlacement.set(t.placement, {
          placement: t.placement,
          teamId: t.tournament_team_id,
          teamName: this.displayTeamName(
            t.tournament_team,
            t.tournament_team_id,
          ),
          tournamentType: t.tournament_type,
          players,
        });
      }
      return Array.from(byPlacement.values()).sort(
        (a: any, b: any) => a.placement - b.placement,
      );
    },
    mvp() {
      const trophies = (this.tournament as any)?.trophies || [];
      return trophies.find((t: any) => t.placement === 0) || null;
    },
    mvpTeamName() {
      if (!this.mvp?.tournament_team) return "";
      return this.displayTeamName(
        this.mvp.tournament_team,
        this.mvp.tournament_team_id,
      );
    },
    mvpStats() {
      if (!this.mvp?.player_steam_id) return null;
      return this.playerStatFor(this.mvp.player_steam_id);
    },
    teamResults() {
      const results = ((this.tournament as any)?.results || []) as any[];
      const teams = ((this.tournament as any)?.teams || []) as any[];
      if (!results.length) return [];

      const teamById = new Map(teams.map((t: any) => [t.id, t]));

      // Trophy placements come from bracket outcomes, so for elim finals they
      // reflect who actually won — not just best stats. Use them to pin the
      // top rows of the standings so podium and table never disagree.
      const trophies = ((this.tournament as any)?.trophies || []) as any[];
      const placementByTeam = new Map<string, number>();
      for (const t of trophies) {
        if (
          t.placement >= 1 &&
          t.placement <= 3 &&
          t.tournament_team_id &&
          !placementByTeam.has(t.tournament_team_id)
        ) {
          placementByTeam.set(t.tournament_team_id, t.placement);
        }
      }

      const ratio = (a: number, b: number) =>
        b > 0 ? Number(a) / Number(b) : Number(a);

      const sorted = [...results].sort((a: any, b: any) => {
        const aPlace = placementByTeam.get(a.tournament_team_id);
        const bPlace = placementByTeam.get(b.tournament_team_id);
        if (aPlace && bPlace) return aPlace - bPlace;
        if (aPlace) return -1;
        if (bPlace) return 1;

        const aw = Number(a.wins) || 0,
          bw = Number(b.wins) || 0;
        if (aw !== bw) return bw - aw;
        const ah = Number(a.head_to_head_match_wins) || 0,
          bh = Number(b.head_to_head_match_wins) || 0;
        if (ah !== bh) return bh - ah;
        const ahr = Number(a.head_to_head_rounds_won) || 0,
          bhr = Number(b.head_to_head_rounds_won) || 0;
        if (ahr !== bhr) return bhr - ahr;
        const amr = ratio(a.maps_won, a.maps_lost),
          bmr = ratio(b.maps_won, b.maps_lost);
        if (amr !== bmr) return bmr - amr;
        const arr = ratio(a.rounds_won, a.rounds_lost),
          brr = ratio(b.rounds_won, b.rounds_lost);
        if (arr !== brr) return brr - arr;
        const ak = Number(a.team_kdr) || 0,
          bk = Number(b.team_kdr) || 0;
        return bk - ak;
      });

      const tieKey = (r: any) => {
        const place = placementByTeam.get(r.tournament_team_id);
        if (place) return `P${place}`;
        return [
          Number(r.wins) || 0,
          Number(r.head_to_head_match_wins) || 0,
          Number(r.head_to_head_rounds_won) || 0,
          ratio(r.maps_won, r.maps_lost),
          ratio(r.rounds_won, r.rounds_lost),
          Number(r.team_kdr) || 0,
        ].join("|");
      };

      let currentRank = 0;
      let lastKey: string | null = null;
      const rankCounts = new Map<number, number>();

      const ranked = sorted.map((r: any, i: number) => {
        const key = tieKey(r);
        if (key !== lastKey) {
          currentRank = i + 1;
          lastKey = key;
        }
        rankCounts.set(currentRank, (rankCounts.get(currentRank) || 0) + 1);
        const team = teamById.get(r.tournament_team_id);
        return {
          teamId: r.tournament_team_id,
          teamName: this.displayTeamName(team, r.tournament_team_id),
          team,
          rank: currentRank,
          wins: Number(r.wins) || 0,
          losses: Number(r.losses) || 0,
          matches: [] as any[],
          matchesPlayed: Number(r.matches_played) || 0,
          matchesRemaining: Number(r.matches_remaining) || 0,
        };
      });

      return ranked.map((entry) => ({
        ...entry,
        tied: (rankCounts.get(entry.rank) || 0) > 1,
      }));
    },
    standingsMaxRank() {
      const ranked = this.teamResults as any[];
      return ranked.reduce((m, r) => Math.max(m, r.rank), 0);
    },
    allMatches() {
      if (!this.tournament?.stages) {
        return [];
      }

      const matchesMap = new Map();

      this.tournament.stages.forEach((stage: any) => {
        if (stage.brackets) {
          stage.brackets.forEach((bracket: any) => {
            if (bracket.match && !matchesMap.has(bracket.match.id)) {
              matchesMap.set(bracket.match.id, bracket.match);
            }
          });
        }
      });

      return Array.from(matchesMap.values()).sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });
    },
  },
};
</script>
