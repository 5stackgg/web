<script lang="ts" setup>
import TimezoneFlag from "~/components/TimezoneFlag.vue";
import { UserPlus } from "lucide-vue-next";
import SanctionStatusBadge from "~/components/SanctionStatusBadge.vue";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import PlayerElo from "~/components/PlayerElo.vue";
import PlayerPremierRank from "~/components/PlayerPremierRank.vue";
import PlayerFaceitRank from "~/components/PlayerFaceitRank.vue";
import PlayerSkillGroupRank from "~/components/PlayerSkillGroupRank.vue";
import PlayerVacBadge from "~/components/PlayerVacBadge.vue";
import {
  Crown,
  Shield,
  ShieldHalf,
  BadgeCheck,
  BadgeIcon,
  Podcast,
} from "lucide-vue-next";
import FiveStackToolTip from "./FiveStackToolTip.vue";
</script>
<template>
  <NuxtLink
    :to="
      linkable && player?.steam_id
        ? { name: 'players-id', params: { id: player?.steam_id } }
        : null
    "
    active-class="player-display-active"
    exact-active-class="player-display-active"
    class="grid min-h-12"
    :class="{
      'cursor-pointer group/playerlink': linkable,
      'gap-2': !compact,
      'gap-1.5': compact,
      'grid-cols-[52px_1fr]':
        size !== 'xs' &&
        !compact &&
        !truncateName &&
        (showName || showSteamId || showRole || showFlag),
      'grid-cols-[52px_minmax(0,1fr)]':
        size !== 'xs' &&
        !compact &&
        truncateName &&
        (showName || showSteamId || showRole || showFlag),
      'grid-cols-[32px_1fr]':
        (size === 'xs' || compact) &&
        !truncateName &&
        (showName || showSteamId || showRole || showFlag),
      'grid-cols-[32px_minmax(0,1fr)]':
        (size === 'xs' || compact) &&
        truncateName &&
        (showName || showSteamId || showRole || showFlag),
    }"
  >
    <div
      :class="[
        'flex flex-col relative',
        alignTop ? 'items-start justify-start' : 'items-center justify-center',
      ]"
    >
      <div class="relative">
        <slot name="avatar">
          <Avatar shape="square" :class="{ 'h-8 w-8': size === 'xs' || compact }">
            <AvatarImage
              :src="playerAvatarSrc"
              :alt="player.name"
              v-if="playerAvatarSrc"
            />
            <AvatarFallback>
              <slot name="avatar-fallback">
                {{ player?.name.slice(0, 2) }}
              </slot>
            </AvatarFallback>
          </Avatar>
        </slot>
        <slot name="status">
          <template v-if="isOnline && showOnline">
            <span
              class="absolute -top-0.5 -left-0.5 h-2 w-2 rounded-full animate-ping bg-green-500"
              v-if="pingStatus"
            ></span>
            <span
              class="absolute -top-0.5 -left-0.5 h-2 w-2 rounded-full bg-green-500 ring-2 ring-background"
            ></span>
          </template>
        </slot>
      </div>
      <div class="mt-2" v-if="$slots['avatar-sub']">
        <slot name="avatar-sub"></slot>
      </div>
      <div class="absolute -top-1 -right-1 z-10" v-if="$slots['avatar-badge']">
        <slot name="avatar-badge"></slot>
      </div>
      <div
        class="absolute -bottom-1 -right-1 z-10"
        v-if="$slots['avatar-corner']"
      >
        <slot name="avatar-corner"></slot>
      </div>
    </div>
    <div
      :class="{
        'flex items-center':
          !player.steam_id ||
          (!showSteamId && !showRole) ||
          (!showName && !showFlag),
        'min-w-0': truncateName,
      }"
      v-if="showFlag || showName || showSteamId || showRole"
    >
      <slot>
        <div
          class="text-left"
          :class="{
            'text-xs': size === 'xs' || compact,
            'text-sm': size === 'sm' && !compact,
            'text-lg': size === 'lg' && !compact,
            'text-xl': size === 'xl' && !compact,
            'min-w-0': truncateName,
          }"
        >
          <div
            class="flex items-center gap-2"
            :class="{ 'min-w-0': truncateName }"
          >
            <slot name="name-prefix"></slot>
            <div
              class="flex items-center gap-2"
              :class="{ 'min-w-0': truncateName }"
            >
              <TimezoneFlag
                :class="{ 'hidden md:block': compact, 'mt-1': !compact }"
                v-if="showFlag"
                :country="player.country"
              />
              <div
                v-if="showName"
                :class="{
                  'truncate max-w-[80px] sm:max-w-none': compact,
                  'truncate min-w-0': truncateName,
                  'transition-colors group-hover/playerlink:text-[hsl(var(--tac-amber))]':
                    linkable,
                }"
              >
                {{ player.name }}
              </div>
              <div class="flex items-center gap-2">
                <SanctionStatusBadge
                  v-if="activeSanctionType"
                  :type="activeSanctionType"
                  variant="inline"
                />
                <PlayerVacBadge :player="player" />
              </div>
            </div>
            <slot name="name-postfix"></slot>
            <Tooltip
              v-if="
                me && !isMe && showAddFriend && !isFriend && player?.steam_id
              "
            >
              <TooltipTrigger>
                <UserPlus
                  class="w-4 h-4 cursor-pointer hover:text-primary"
                  @click.stop.prevent="addAsFriend"
                />
              </TooltipTrigger>
              <TooltipContent>{{
                $t("player.status.add_friend")
              }}</TooltipContent>
            </Tooltip>
          </div>
          <div
            class="flex items-center gap-2"
            :class="{ 'min-h-[26px]': size !== 'xs' && !compact }"
            v-if="player.steam_id"
          >
            <FiveStackToolTip v-if="showRole && tooltip">
              <template #trigger>
                <template v-if="isUser">
                  <BadgeIcon class="w-3 h-3 mr-1" />
                </template>
                <template v-if="isVerified">
                  <BadgeCheck class="w-3 h-3 mr-1 text-green-500" />
                </template>
                <template v-if="isStreamer">
                  <Podcast class="w-3 h-3 mr-1 text-green-500" />
                </template>
                <template v-if="isModerator">
                  <ShieldHalf class="w-3 h-3 mr-1 text-blue-500" />
                </template>
                <template v-if="isMatchOrganizer">
                  <Shield class="w-3 h-3 mr-1 text-yellow-500" />
                </template>
                <template v-if="isTournamentOrganizer">
                  <Shield class="w-3 h-3 mr-1 text-orange-500" />
                </template>
                <template v-if="isAdmin">
                  <Crown class="w-3 h-3 mr-1 text-red-500" />
                </template>
              </template>
              <span class="capitalize">
                {{ player?.role?.replace("_", " ") }}
              </span>
            </FiveStackToolTip>
            <template v-if="showElo && matchRank">
              <PlayerSkillGroupRank
                v-if="
                  matchRank.rankType === 6 ||
                  matchRank.rankType === 7 ||
                  matchRank.rankType === 12
                "
                :kind="matchRank.rankType === 6 ? 'wingman' : 'competitive'"
                :rank="matchRank.rank"
                :show-label="false"
              />
              <PlayerPremierRank
                v-else-if="matchRank.rankType === 11"
                :premier-rank="matchRank.rank"
              />
              <PlayerElo
                v-else-if="!external"
                :elo="player.elo"
                :type="matchType"
              />
            </template>
            <PlayerPremierRank
              v-else-if="
                showElo && matchType === 'Premier' && player.premier_rank
              "
              :premier-rank="player.premier_rank"
              :premier-rank-updated-at="player.premier_rank_updated_at"
            />
            <PlayerFaceitRank
              v-else-if="
                showElo &&
                matchType === 'Faceit' &&
                (faceitSkillLevel || faceitElo)
              "
              :faceit-skill-level="faceitSkillLevel"
              :faceit-elo="faceitElo"
              :faceit-url="player.faceit_url"
              :faceit-nickname="player.faceit_nickname"
            />
            <PlayerElo
              v-else-if="showElo && !external"
              :elo="player.elo"
              :type="matchType"
            />
            <slot name="elo-postfix"></slot>
            <p
              class="text-muted-foreground text-xs flex items-center gap-1"
              v-if="showSteamId"
            >
              {{ player.steam_id }}
              <a
                v-if="player.profile_url"
                :href="player.profile_url"
                target="_blank"
                class="hover:text-foreground transition-colors"
                :title="$t('ui.tooltips.view_steam_profile')"
              >
                <SteamIcon class="size-3 fill-current" />
              </a>
            </p>
          </div>
          <slot name="subline"></slot>
        </div>
      </slot>
    </div>
    <slot name="footer"></slot>
  </NuxtLink>
</template>

<script lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";

export default {
  props: {
    size: {
      type: String,
      default: "sm",
    },
    player: {
      type: Object,
      required: false,
    },
    showName: {
      type: Boolean,
      default: true,
    },
    showFlag: {
      type: Boolean,
      default: true,
    },
    showRole: {
      type: Boolean,
      default: true,
    },
    showSteamId: {
      type: Boolean,
      default: false,
    },
    linkable: {
      type: Boolean,
      default: false,
    },
    showOnline: {
      type: Boolean,
      default: true,
    },
    pingStatus: {
      type: Boolean,
      default: false,
    },
    showAddFriend: {
      type: Boolean,
      default: false,
    },
    showElo: {
      type: Boolean,
      default: true,
    },
    tooltip: {
      type: Boolean,
      default: true,
    },
    compact: {
      type: Boolean,
      default: false,
    },
    truncateName: {
      type: Boolean,
      default: false,
    },
    alignTop: {
      type: Boolean,
      default: false,
    },
    avatarOverride: {
      type: String,
      default: null,
    },
    matchType: {
      type: String,
      default: null,
    },
    external: {
      type: Boolean,
      default: false,
    },
  },
  inject: {
    matchRanks: { from: "matchRanks", default: null },
  },
  methods: {
    async addAsFriend() {
      await this.$apollo.mutate({
        mutation: typedGql("mutation")({
          insert_my_friends_one: [
            {
              object: {
                steam_id: this.player.steam_id,
              },
            },
            {
              steam_id: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    faceitSkillLevel(): number | null {
      return (
        (this.player as any)?.faceit_rank_history?.[0]?.skill_level ??
        (this.player as any)?.faceit_skill_level ??
        null
      );
    },
    faceitElo(): number | null {
      return (
        (this.player as any)?.faceit_rank_history?.[0]?.elo ??
        (this.player as any)?.faceit_elo ??
        null
      );
    },
    matchRank() {
      const inj: any = this.matchRanks;
      const map =
        inj && typeof inj === "object" && "value" in inj ? inj.value : inj;
      if (!map) return null;
      const sid = String(this.player?.steam_id ?? "");
      return sid ? (map[sid] ?? null) : null;
    },
    me() {
      return useAuthStore().me;
    },
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    playerAvatarSrc() {
      if (this.avatarOverride) {
        return resolveAvatarUrl(this.avatarOverride, this.apiDomain);
      }
      if (!this.player) return null;
      return resolveAvatarUrl(
        this.player.roster_image_url ||
          this.player.custom_avatar_url ||
          this.player.avatar_url,
        this.apiDomain,
      );
    },
    isMe() {
      if (!this.player) {
        return false;
      }

      return this.me?.steam_id === this.player.steam_id;
    },
    isOnline() {
      if (!this.player) {
        return false;
      }

      return useMatchmakingStore().onlinePlayerSteamIds.includes(
        this.player.steam_id,
      );
    },
    isFriend() {
      if (!this.player) {
        return false;
      }

      return useMatchmakingStore().friends.find((friend) => {
        return friend.steam_id == this.player.steam_id;
      });
    },
    activeSanctionType(): "ban" | "mute" | "gag" | null {
      // Severity order: ban > mute > (silence) > gag. Driven by the cheap,
      // already-loaded enforcement booleans (no per-row sanction query).
      if (this.player?.is_banned) return "ban";
      if (this.player?.is_muted) return "mute";
      if (this.player?.is_gagged) return "gag";
      return null;
    },
    isUser() {
      return this.player?.role === e_player_roles_enum.user;
    },
    isVerified() {
      return this.player?.role === e_player_roles_enum.verified_user;
    },
    isStreamer() {
      return this.player?.role === e_player_roles_enum.streamer;
    },
    isModerator() {
      return this.player?.role === e_player_roles_enum.moderator;
    },
    isMatchOrganizer() {
      return this.player?.role === e_player_roles_enum.match_organizer;
    },
    isTournamentOrganizer() {
      return this.player?.role === e_player_roles_enum.tournament_organizer;
    },
    isAdmin() {
      return this.player?.role === e_player_roles_enum.administrator;
    },
  },
};
</script>
