<script lang="ts" setup>
import MatchesTable from "~/components/MatchesTable.vue";
import Pagination from "~/components/Pagination.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import TournamentTableRow from "~/components/tournament/TournamentTableRow.vue";
import TrophyCase from "~/components/trophy/TrophyCase.vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { e_player_roles_enum } from "~/generated/zeus";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedCard from "~/components/ui/animated-card/AnimatedCard.vue";
import LastTenWinsAndLosses from "~/components/charts/LastTenWinsAndLosses.vue";
import PlayerEloChart from "~/components/charts/PlayerEloChart.vue";
import formatStatValue from "~/utilities/formatStatValue";
import SanctionPlayer from "~/components/SanctionPlayer.vue";
import PlayerSanctions from "~/components/PlayerSanctions.vue";
import PlayerChangeName from "~/components/PlayerChangeName.vue";
import { kdrStrokeColor } from "~/utilities/kdrColor";
import { PlayIcon, Pencil, ExternalLink } from "lucide-vue-next";
import TimezoneFlag from "~/components/TimezoneFlag.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import RadialStat from "~/components/charts/RadialStat.vue";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "~/components/ui/separator";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import PlayerRoleForm from "~/components/PlayerRoleForm.vue";
import AvatarUpload from "~/components/AvatarUpload.vue";

definePageMeta({
  alias: ["/me/:id"],
});

const { isMobile } = useSidebar();
const playerHeroClasses =
  "relative rounded-lg border border-border px-7 py-6 [background:linear-gradient(180deg,hsl(var(--card)_/_0.55)_0%,hsl(var(--card)_/_0.25)_100%)] [backdrop-filter:blur(6px)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-[14px] before:w-[14px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-[14px] after:w-[14px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-[''] max-md:px-4 max-md:py-5";
const playerHeroEyebrowClasses =
  "mb-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground";
const playerHeroChevronClasses =
  "translate-y-[-1px] text-[0.7rem] text-[hsl(var(--tac-amber))]";
const playerHeroBodyClasses = "flex flex-wrap items-center gap-7 max-md:gap-4";
const playerHeroAvatarFrameClasses =
  "relative h-[140px] w-[140px] border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.12)] p-1 max-md:h-24 max-md:w-24";
const playerHeroAvatarClasses = "block h-full w-full object-cover";
const playerHeroAvatarPlaceholderClasses = `${playerHeroAvatarClasses} flex items-center justify-center bg-muted/20 font-sans text-[3.5rem] font-bold text-[hsl(var(--tac-amber))]`;
const playerHeroAvatarCornerClasses =
  "absolute h-3 w-3 border-[hsl(var(--tac-amber))]";
const playerHeroIdentityClasses = "flex min-w-0 flex-1 flex-col gap-[0.65rem]";
const playerHeroNameRowClasses = "flex min-w-0 flex-wrap items-center gap-3";
const playerHeroNameClasses =
  "relative m-0 min-w-0 font-sans text-[clamp(2.25rem,5vw,3.75rem)] font-bold uppercase leading-[0.9] tracking-[0.02em] [font-stretch:80%]";
const playerHeroNameMainClasses = "relative text-foreground";
const playerHeroNameGhostClasses =
  "pointer-events-none absolute left-[5px] top-[5px] right-[-5px] overflow-hidden whitespace-nowrap text-transparent select-none [-webkit-text-stroke:1px_hsl(var(--tac-amber)_/_0.35)]";
const playerHeroMetaClasses =
  "inline-flex flex-wrap items-center gap-[0.55rem] text-[0.8rem] text-muted-foreground";
const playerHeroSteamIdClasses = "font-mono tracking-[0.05em]";
const playerHeroSteamLinkClasses =
  "inline-flex items-center gap-[0.35rem] rounded border border-border bg-card/60 px-[0.55rem] py-[0.2rem] text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber)_/_0.5)] hover:bg-[hsl(var(--tac-amber)_/_0.08)] hover:text-[hsl(var(--tac-amber))]";
const playerHeroBadgesClasses =
  "mt-[0.15rem] flex flex-wrap items-center gap-2";
const playerHeroNameEditClasses =
  "inline-flex opacity-60 transition-opacity duration-150 hover:opacity-100";
const playerHeroActionsClasses = "mt-1 flex flex-wrap items-center gap-3";
const playerHeroRoleChipClasses =
  "inline-flex items-center rounded border border-border bg-card/60 px-[0.55rem] py-[0.25rem] text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground capitalize";
const playerHeroRightActionsClasses =
  "ml-auto flex shrink-0 items-center justify-center gap-3 self-center max-md:ml-0";
const playerHeroPlayClasses =
  "group/play relative isolate inline-flex cursor-pointer items-center border font-sans text-[0.95rem] font-bold uppercase tracking-[0.18em] no-underline transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-px active:translate-y-0 py-[0.85rem] pr-[1.6rem] pl-[1.4rem] text-[hsl(0_0%_8%)] border-[hsl(var(--tac-amber))] [background:linear-gradient(135deg,hsl(36_100%_65%)_0%,hsl(var(--tac-amber))_50%,hsl(28_90%_52%)_100%)] [clip-path:polygon(12px_0,100%_0,100%_calc(100%_-_12px),calc(100%_-_12px)_100%,0_100%,0_12px)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.4),0_6px_20px_-6px_hsl(var(--tac-amber)/0.6)] hover:shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.6),0_12px_32px_-6px_hsl(var(--tac-amber)/0.8),0_0_24px_hsl(var(--tac-amber)/0.35)]";
const playerHeroPlayInnerClasses =
  "relative z-[1] inline-flex items-center gap-[0.65rem]";
const playerHeroPlayIconClasses =
  "h-5 w-5 fill-current transition-transform duration-300 group-hover/play:translate-x-0.5 group-hover/play:scale-110";
const playerHeroPlayGlowClasses =
  "pointer-events-none absolute inset-0 z-0 -translate-x-full bg-[linear-gradient(90deg,transparent_0%,hsl(0_0%_100%_/_0.4)_50%,transparent_100%)] transition-transform duration-500 group-hover/play:translate-x-full";
const playerHeroTeamsClasses = "mt-6 border-t border-border pt-5";
const playerTeamsLabelClasses =
  "mb-[0.65rem] inline-flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground";
const playerTeamsTickClasses = "h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]";
const playerTeamsCountClasses =
  "rounded-full border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.15)] px-[0.45rem] py-[0.05rem] text-[0.65rem] tracking-[0.08em] text-[hsl(var(--tac-amber))]";
const playerTeamChipClasses =
  "group/team inline-flex items-center gap-[0.55rem] rounded-md border border-border bg-card/55 px-[0.85rem] py-[0.45rem] [backdrop-filter:blur(6px)] transition-[transform,border-color,background-color] duration-150 hover:-translate-y-px hover:border-[hsl(var(--tac-amber)_/_0.6)] hover:bg-[hsl(var(--tac-amber)_/_0.08)]";
const playerTeamChipDotClasses =
  "h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))] [box-shadow:0_0_0_3px_hsl(var(--tac-amber)_/_0.2)]";
const playerTeamChipNameClasses =
  "text-sm font-medium text-foreground group-hover/team:text-[hsl(var(--tac-amber))]";
const playerTeamChipShortClasses =
  "rounded bg-muted/40 px-1.5 py-[0.1rem] font-mono text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground";
</script>

<template>
  <div class="flex-grow flex flex-col gap-6" v-if="player">
    <!-- Player Hero -->
    <PageTransition>
      <header :class="playerHeroClasses">
        <div :class="playerHeroEyebrowClasses">
          <span :class="playerHeroChevronClasses">◢</span>
          Player Profile
        </div>

        <div :class="playerHeroBodyClasses">
          <!-- Avatar with amber ring -->
          <div class="shrink-0">
            <div :class="playerHeroAvatarFrameClasses">
              <img
                v-if="playerAvatarSrc"
                :src="playerAvatarSrc"
                :alt="player.name"
                :class="playerHeroAvatarClasses"
              />
              <div v-else :class="playerHeroAvatarPlaceholderClasses">
                {{ (player.name || "?").charAt(0).toUpperCase() }}
              </div>
              <div
                :class="[
                  playerHeroAvatarCornerClasses,
                  '-left-[2px] -top-[2px] border-l-2 border-t-2',
                ]"
              ></div>
              <div
                :class="[
                  playerHeroAvatarCornerClasses,
                  '-bottom-[2px] -right-[2px] border-b-2 border-r-2',
                ]"
              ></div>
            </div>
          </div>

          <!-- Identity: name, meta row, badges -->
          <div :class="playerHeroIdentityClasses">
            <div :class="playerHeroNameRowClasses">
              <h1 :class="playerHeroNameClasses">
                <span :class="playerHeroNameGhostClasses" aria-hidden="true">
                  {{ player.name }}
                </span>
                <span :class="playerHeroNameMainClasses">{{
                  player.name
                }}</span>
              </h1>
            </div>

            <div :class="playerHeroMetaClasses">
              <TimezoneFlag
                v-if="player.country"
                :country="player.country"
                class="h-auto w-[1.35rem] shrink-0"
              />
              <span v-if="player.country" class="opacity-40">·</span>
              <span :class="playerHeroSteamIdClasses">
                {{ player.steam_id }}
              </span>
              <span v-if="player.profile_url" class="opacity-40">·</span>
              <a
                v-if="player.profile_url"
                :href="player.profile_url"
                target="_blank"
                rel="noopener noreferrer"
                :class="playerHeroSteamLinkClasses"
                :title="$t('ui.tooltips.view_steam_profile')"
              >
                <ExternalLink class="w-3.5 h-3.5" />
                <span>{{ $t("player.player.steam") }}</span>
              </a>
            </div>

            <!-- Actions: role / sanction / edit -->
            <div
              v-if="player.role || canSanction || canEditPlayer"
              :class="playerHeroActionsClasses"
            >
              <PlayerRoleForm v-if="canEditRole" :player="player" />
              <span v-else-if="player.role" :class="playerHeroRoleChipClasses">
                {{ (player.role || "user").replace("_", " ") }}
              </span>
              <SanctionPlayer v-if="canSanction" :player="player" />
              <Button
                v-if="canEditPlayer"
                variant="outline"
                size="icon"
                :title="$t('pages.players.detail.edit_player')"
                @click="editPlayerSheet = true"
              >
                <Pencil class="w-4 h-4" />
              </Button>
            </div>

            <div :class="playerHeroBadgesClasses">
              <PlayerSanctions v-if="playerId" :playerId="playerId" />
            </div>
          </div>

          <!-- Right-side CTA -->
          <div :class="playerHeroRightActionsClasses">
            <NuxtLink
              v-if="me && player.steam_id === me.steam_id"
              to="/play"
              :class="playerHeroPlayClasses"
            >
              <span :class="playerHeroPlayInnerClasses">
                <PlayIcon :class="playerHeroPlayIconClasses" />
                <span>{{ $t("pages.players.detail.play_a_match") }}</span>
              </span>
              <span
                :class="playerHeroPlayGlowClasses"
                aria-hidden="true"
              ></span>
            </NuxtLink>
          </div>
        </div>

        <!-- Teams row -->
        <div
          v-if="player?.teams && player.teams.length > 0"
          :class="playerHeroTeamsClasses"
        >
          <div :class="playerTeamsLabelClasses">
            <span :class="playerTeamsTickClasses"></span>
            Teams
            <span :class="playerTeamsCountClasses">{{
              player.teams.length
            }}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <NuxtLink
              v-for="team in player.teams"
              :key="team.id"
              :to="`/teams/${team.id}`"
              :class="playerTeamChipClasses"
            >
              <span :class="playerTeamChipDotClasses"></span>
              <span :class="playerTeamChipNameClasses">{{ team.name }}</span>
              <span v-if="team.short_name" :class="playerTeamChipShortClasses">
                {{ team.short_name }}
              </span>
            </NuxtLink>
          </div>
        </div>
      </header>
    </PageTransition>

    <!-- Trophy Case -->
    <PageTransition
      :delay="50"
      v-if="playerTrophies && playerTrophies.length > 0"
    >
      <TrophyCase :trophies="playerTrophies" />
    </PageTransition>

    <div class="flex flex-col gap-4 md:gap-6" v-if="player">
      <!-- Stats and Elo Section -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <!-- Performance Stats -->
        <PageTransition :delay="100">
          <AnimatedCard variant="elevated" class="flex flex-col h-full p-4">
            <CardContent class="flex-1 p-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                <!-- Win Rate Column -->
                <div class="flex flex-col items-center justify-center gap-4">
                  <RadialStat
                    :value="winPercentage.toFixed(0) + '%'"
                    :percentage="winPercentage"
                    :label="$t('common.stats.win_rate')"
                    :stroke-color="
                      winPercentage >= 50
                        ? 'hsl(142, 71%, 45%)'
                        : 'hsl(0, 84%, 60%)'
                    "
                  />
                  <div class="flex items-center gap-4">
                    <div class="flex flex-col items-center group/stat">
                      <span
                        class="text-xl md:text-lg lg:text-2xl font-bold text-green-500 group-hover/stat:scale-110 transition-transform duration-300"
                        >{{ player.wins || 0 }}</span
                      >
                      <span
                        class="text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider"
                        >{{ $t("common.stats.wins") }}</span
                      >
                    </div>
                    <div
                      class="w-px h-6 sm:h-8 bg-gradient-to-b from-transparent via-border to-transparent"
                    ></div>
                    <div class="flex flex-col items-center group/stat">
                      <span
                        class="text-xl md:text-lg lg:text-2xl font-bold text-red-500 group-hover/stat:scale-110 transition-transform duration-300"
                        >{{ player.losses || 0 }}</span
                      >
                      <span
                        class="text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider"
                        >{{ $t("common.stats.losses") }}</span
                      >
                    </div>
                  </div>
                </div>

                <!-- K/D Column -->
                <div class="flex flex-col items-center justify-center gap-4">
                  <RadialStat
                    :value="kd"
                    :percentage="kdPercentage"
                    :label="$t('pages.players.detail.kd')"
                    :stroke-color="kdrStrokeColor(Number(kd))"
                  />
                  <div
                    class="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-2 gap-y-3"
                  >
                    <template
                      v-for="(stat, index) in combatStats"
                      :key="stat.key"
                    >
                      <div class="flex flex-col items-center group/stat">
                        <span
                          class="text-lg md:text-base lg:text-xl font-bold group-hover/stat:scale-110 transition-transform duration-300"
                          :class="stat.colorClass"
                        >
                          {{ stat.value }}
                        </span>
                        <span
                          class="text-[8px] sm:text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider"
                          >{{ stat.label }}</span
                        >
                      </div>
                      <div
                        v-if="index < combatStats.length - 1"
                        class="w-px h-6 sm:h-8 bg-gradient-to-b from-transparent via-border to-transparent"
                      ></div>
                    </template>
                  </div>
                </div>
              </div>
            </CardContent>
          </AnimatedCard>
        </PageTransition>

        <!-- Elo History Chart -->
        <PageTransition :delay="200">
          <AnimatedCard
            variant="elevated"
            class="flex flex-col h-full p-4"
            v-if="player?.elo_history"
          >
            <CardHeader>
              <CardTitle
                class="text-lg md:text-base lg:text-xl font-bold text-center"
              >
                {{ $t("pages.players.detail.elo_history") }}
              </CardTitle>
            </CardHeader>
            <CardContent
              class="flex-1 min-h-[200px] sm:min-h-[250px] md:min-h-[300px]"
            >
              <template v-if="player.elo_history.length > 0">
                <PlayerEloChart :elo-history="player.elo_history" />
              </template>
              <template v-else>
                <div
                  class="flex justify-center items-center h-full uppercase text-muted-foreground text-center flex-col"
                >
                  {{ $t("pages.players.detail.no_elo_history") }}
                  <NuxtLink v-if="me" to="/play" class="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      class="hover:scale-105 transition-transform"
                      >{{ $t("pages.players.detail.play_a_match") }}</Button
                    >
                  </NuxtLink>
                </div>
              </template>
            </CardContent>
          </AnimatedCard>
        </PageTransition>
      </div>

      <!-- Charts Section -->
      <div
        class="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
      >
        <!-- Recent Wins/Losses -->
        <PageTransition :delay="300">
          <AnimatedCard variant="elevated" class="flex flex-col h-full p-4">
            <CardHeader>
              <CardTitle
                class="text-lg md:text-base lg:text-xl font-bold text-center"
              >
                {{ $t("pages.players.detail.recent_wins_and_losses") }}
              </CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col h-full">
              <LastTenWinsAndLosses
                class="max-h-[250px] sm:max-h-[300px] md:max-h-[375px] w-full flex-grow"
                :steam_id="playerId"
              />
            </CardContent>
          </AnimatedCard>
        </PageTransition>

        <!-- Weapon Kills -->
        <PageTransition :delay="500">
          <AnimatedCard variant="elevated" class="flex flex-col h-full p-4">
            <CardHeader>
              <CardTitle
                class="text-lg md:text-base lg:text-xl font-bold text-center"
              >
                {{ $t("pages.players.detail.weapon_kills") }}
              </CardTitle>
            </CardHeader>
            <CardContent class="flex flex-col h-full">
              <div
                v-if="
                  !player?.kills_by_weapons ||
                  player.kills_by_weapons.length === 0
                "
                class="text-center py-8 flex-grow flex items-center justify-center"
              >
                <p class="text-sm md:text-base text-muted-foreground">
                  {{ $t("pages.players.detail.no_weapon_kills") }}
                </p>
              </div>
              <div v-else class="overflow-hidden rounded-lg">
                <table class="w-full border-90">
                  <tbody>
                    <tr
                      v-for="(weapon, index) in player.kills_by_weapons"
                      :key="index"
                      :style="{ animationDelay: `${index * 50}ms` }"
                      class="border-b border-border/30 hover:bg-muted/50 hover:scale-[1.02] transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 group/row"
                    >
                      <td class="p-3 flex items-center gap-3">
                        <template
                          v-if="weapon.with && weapon.with !== 'unknown'"
                        >
                          <div class="relative">
                            <img
                              :src="`/img/equipment/${getWeaponImageName(weapon.with)}.svg`"
                              :alt="weapon.with"
                              class="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 group-hover/row:scale-110 transition-transform duration-300"
                              @error="handleImageError"
                              :title="weapon.with"
                            />
                          </div>
                        </template>
                        <span v-else class="font-medium">{{
                          weapon.with
                        }}</span>
                      </td>
                      <td class="p-3 text-right">
                        <span
                          class="font-bold text-lg group-hover/row:text-primary transition-colors"
                        >
                          {{ weapon.kill_count }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </AnimatedCard>
        </PageTransition>
      </div>
    </div>

    <Separator />

    <PageTransition :delay="500">
      <Tabs v-model="activeTab" default-value="matches">
        <TabsList class="grid grid-cols-2 w-full max-w-md mx-auto">
          <TabsTrigger
            value="matches"
            class="transition-all duration-300 data-[state=active]:shadow-lg"
            >{{ $t("pages.players.detail.matches") }}</TabsTrigger
          >
          <TabsTrigger
            value="tournaments"
            class="transition-all duration-300 data-[state=active]:shadow-lg"
            >{{ $t("pages.players.detail.tournaments") }}</TabsTrigger
          >
        </TabsList>

        <TabsContent value="matches">
          <Empty
            v-if="
              playerWithMatchesAggregate &&
              playerWithMatchesAggregate.total_matches === 0
            "
            class="min-h-[200px]"
          >
            <EmptyTitle>{{ $t("pages.players.detail.no_matches") }}</EmptyTitle>
            <EmptyDescription>{{
              $t("pages.players.detail.no_matches_description")
            }}</EmptyDescription>
          </Empty>
          <template v-else-if="playerWithMatches?.matches?.length">
            <MatchesTable
              :player="player"
              :matches="playerWithMatches?.matches"
            />
            <Pagination
              :page="page"
              :per-page="perPage"
              @page="
                (_page) => {
                  page = _page;
                }
              "
              :total="playerWithMatchesAggregate.total_matches"
              v-if="playerWithMatchesAggregate"
            />
          </template>
        </TabsContent>

        <TabsContent value="tournaments">
          <Empty
            v-if="!playerTournaments || playerTournaments.length === 0"
            class="min-h-[200px]"
          >
            <EmptyTitle>{{
              $t("pages.players.detail.no_tournaments")
            }}</EmptyTitle>
            <EmptyDescription>{{
              $t("pages.players.detail.no_tournaments_description")
            }}</EmptyDescription>
          </Empty>
          <div v-else class="space-y-4">
            <TournamentTableRow
              v-for="tournament in playerTournaments"
              :key="tournament.id"
              :tournament="tournament"
            ></TournamentTableRow>
          </div>
        </TabsContent>
      </Tabs>
    </PageTransition>
  </div>

  <Sheet
    v-if="player"
    :open="editPlayerSheet"
    @update:open="(open) => (editPlayerSheet = open)"
  >
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{{ $t("pages.players.detail.edit_player") }}</SheetTitle>
        <SheetDescription class="sr-only">
          {{ $t("pages.players.detail.edit_player") }}
        </SheetDescription>
      </SheetHeader>
      <div class="mt-6 space-y-6">
        <div v-if="canEditAvatar" class="space-y-2">
          <div
            class="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
            {{ $t("avatar.player_avatar") }}
          </div>
          <AvatarUpload
            variant="dropzone"
            :upload-url="`https://${apiDomain}/avatars/players/${player.steam_id}`"
            :delete-url="`https://${apiDomain}/avatars/players/${player.steam_id}`"
            :has-custom="!!player.custom_avatar_url"
            :current-src="playerAvatarSrc"
          />
        </div>

        <div v-if="canEditName" class="space-y-2">
          <div
            class="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
          >
            <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
            {{ $t("pages.players.detail.name") }}
          </div>
          <PlayerChangeName :player="player" />
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by, e_match_types_enum } from "~/generated/zeus";
import { generateQuery } from "~/graphql/graphqlGen";
import { simpleMatchFields } from "~/graphql/simpleMatchFields";
import { playerFields } from "~/graphql/playerFields";
import { eloFields } from "~/graphql/eloFields";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import { simpleTournamentFields } from "~/graphql/simpleTournamentFields";
import { trophyFields } from "~/graphql/trophyFields";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";

export default {
  setup() {
    const activeTab = useRouteTab({
      defaultTab: "matches",
      tabs: ["matches", "tournaments"],
    });

    return { activeTab };
  },
  apollo: {
    $subscribe: {
      players_by_pk: {
        query: typedGql("subscription")({
          players_by_pk: [
            {
              steam_id: $("playerId", "bigint!"),
            },
            {
              ...playerFields,
              role: true,
              profile_url: true,
              teams: [
                {},
                {
                  id: true,
                  name: true,
                  short_name: true,
                },
              ],
              wins: true,
              losses: true,
              stats: {
                kills: true,
                deaths: true,
                assists: true,
                headshot_percentage: true,
              },
              kills_by_weapons: [
                {
                  order_by: [
                    {},
                    {
                      kill_count: order_by.desc,
                    },
                  ],
                  limit: 5,
                },
                {
                  with: true,
                  kill_count: true,
                },
              ],
              elo_history: [
                {
                  limit: 10,
                  where: {
                    type: {
                      _eq: e_match_types_enum.Competitive,
                    },
                    match: {
                      winning_lineup_id: {
                        _is_null: false,
                      },
                    },
                  },
                  order_by: [
                    {},
                    {
                      match_created_at: order_by.desc,
                    },
                  ],
                },
                eloFields,
              ],
            },
          ],
        }),
        variables: function () {
          return {
            playerId: this.playerId,
          };
        },
        result: function ({ data }) {
          this.player = data.players_by_pk;
          const ctx = usePlayerContext();
          if (this.player) {
            ctx.value = {
              id: String(this.player.steam_id),
              name: this.player.name,
            };
          } else {
            ctx.value = null;
          }
        },
      },
      playerTournaments: {
        query: typedGql("subscription")({
          tournaments: [
            {
              limit: 10,
              where: {
                rosters: {
                  player_steam_id: {
                    _eq: $("steam_id", "bigint"),
                  },
                },
              },
              order_by: [
                {},
                {
                  start: order_by.desc,
                },
              ],
            },
            simpleTournamentFields,
          ],
        }),
        variables: function () {
          return {
            steam_id: this.playerId,
          };
        },
        skip: function () {
          return !this.playerId;
        },
        result: function ({ data }: { data: any }) {
          this.playerTournaments = data.tournaments || [];
        },
      },
      playerTrophies: {
        query: typedGql("subscription")({
          tournament_trophies: [
            {
              where: {
                player_steam_id: {
                  _eq: $("steam_id", "bigint"),
                },
              },
            },
            trophyFields,
          ],
        }),
        variables: function () {
          return {
            steam_id: this.playerId,
          };
        },
        skip: function () {
          return !this.playerId;
        },
        result: function ({ data }: { data: any }) {
          this.playerTrophies = data.tournament_trophies || [];
        },
      },
    },
    playerWithMatches: {
      fetchPolicy: "network-only",
      query: generateQuery({
        __alias: {
          playerWithMatches: {
            players_by_pk: [
              {
                steam_id: $("playerId", "bigint!"),
              },
              {
                steam_id: true,
                matches: [
                  {
                    limit: $("limit", "Int!"),
                    offset: $("offset", "Int!"),
                    order_by: [
                      {},
                      {
                        created_at: order_by.desc,
                      },
                    ],
                  },
                  {
                    ...simpleMatchFields,
                    elo_changes: [
                      {
                        where: {
                          player_steam_id: {
                            _eq: $("playerId", "bigint!"),
                          },
                        },
                      },
                      eloFields,
                    ],
                  },
                ],
              },
            ],
          },
        },
      }),
      variables: function () {
        return {
          playerId: this.playerId,
          limit: this.perPage,
          offset: (this.page - 1) * this.perPage,
        };
      },
    },
    playerWithMatchesAggregate: {
      fetchPolicy: "network-only",
      query: generateQuery({
        __alias: {
          playerWithMatchesAggregate: {
            players_by_pk: [
              {
                steam_id: $("playerId", "bigint!"),
              },
              {
                steam_id: true,
                total_matches: true,
              },
            ],
          },
        },
      }),
      variables: function () {
        return {
          playerId: this.playerId,
        };
      },
    },
  },
  unmounted() {
    usePlayerContext().value = null;
  },
  data() {
    return {
      player: undefined,
      page: 1,
      perPage: 10,
      playerTournaments: [],
      playerTrophies: undefined,
      editPlayerSheet: false,
    };
  },
  computed: {
    winPercentage() {
      const total = (this.player?.wins || 0) + (this.player?.losses || 0);
      if (!this.player) {
        return 0;
      }
      return total > 0 ? ((this.player?.wins || 0) / total) * 100 : 0;
    },

    kdPercentage() {
      if (
        !this.player?.stats ||
        !this.player.stats.kills ||
        !this.player.stats.deaths
      ) {
        return 0;
      }

      const kdRatio = this.player.stats.kills / this.player.stats.deaths;
      return Math.min((kdRatio / 2) * 100, 100);
    },
    playerId() {
      return this.$route.params.id || this.me?.steam_id || null;
    },
    me() {
      return useAuthStore().me;
    },
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    playerAvatarSrc() {
      if (!this.player) return null;
      return resolveAvatarUrl(
        this.player.custom_avatar_url || this.player.avatar_url,
        this.apiDomain,
      );
    },
    canSanction() {
      if (!this.me || !this.player) {
        return false;
      }
      return (
        this.player.steam_id !== this.me.steam_id &&
        useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer)
      );
    },
    isSelfProfile() {
      return !!(
        this.me &&
        this.player &&
        this.player.steam_id === this.me.steam_id
      );
    },
    isAdmin() {
      return useAuthStore().isRoleAbove(e_player_roles_enum.administrator);
    },
    canEditAvatar() {
      return this.isSelfProfile || this.isAdmin;
    },
    canEditName() {
      return this.isSelfProfile || this.isAdmin;
    },
    canEditRole() {
      if (!this.me || !this.player || this.isSelfProfile) {
        return false;
      }
      return useAuthStore().isRoleAbove(this.player.role);
    },
    canEditPlayer() {
      return this.canEditAvatar || this.canEditName || this.canEditRole;
    },
    kd() {
      if (!this.player?.stats) {
        return 0;
      }

      if (this.player?.stats?.deaths === 0) {
        return this.player?.stats.kills;
      }
      return formatStatValue(
        this.player?.stats.kills / this.player?.stats.deaths,
      );
    },
    winLossRatio() {
      const wins = this.player?.wins || 0;
      const losses = this.player?.losses || 0;
      if (losses === 0) {
        return wins > 0 ? wins : "0.00";
      }
      return formatStatValue(wins / losses);
    },
    combatStats() {
      return [
        {
          key: "kills",
          value: this.player?.stats?.kills ?? "-",
          label: this.$t("common.stats.kills"),
          colorClass: "text-foreground",
        },
        {
          key: "assists",
          value: this.player?.stats?.assists ?? "-",
          label: this.$t("common.stats.assists"),
          colorClass: "text-foreground",
        },
        {
          key: "hs",
          value: this.player?.stats?.headshot_percentage
            ? (this.player.stats.headshot_percentage * 100).toFixed(1) + "%"
            : "-",
          label: this.$t("pages.players.filter_chips.headshot_pct"),
          colorClass: "text-primary",
        },
      ];
    },
  },
  methods: {
    getWeaponImageName(weaponName) {
      if (!weaponName || weaponName === "unknown") return "";

      const overrideMappings = {};

      return overrideMappings[weaponName] || weaponName;
    },
    handleImageError(event) {
      const img = event.target;
      img.style.display = "none";
    },
  },
};
</script>
