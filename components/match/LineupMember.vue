<script lang="ts" setup>
import PlayerStatusDisplay from "./PlayerStatusDisplay.vue";
</script>

<template>
  <template v-if="member.player">
    <PlayerStatusDisplay
      :member="member"
      :match="match"
      :at-elo="resolvedAtElo"
    >
      <template v-if="$slots['name-postfix']" #name-postfix>
        <slot name="name-postfix"></slot>
      </template>
      <template v-if="$slots['elo-postfix']" #elo-postfix>
        <slot name="elo-postfix"></slot>
      </template>
      <template v-if="$slots['avatar-badge']" #avatar-badge>
        <slot name="avatar-badge"></slot>
      </template>
    </PlayerStatusDisplay>
  </template>
  <template v-else>
    <div class="ml-1 flex gap-4">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <NuxtImg
              src="/img/logos/discord.svg"
              :alt="$t('alt_text.discord')"
              class="w-5 h-5"
            />
          </TooltipTrigger>
          <TooltipContent>
            {{ $t("match.lineup.discord_user") }}
            <Badge variant="secondary">/link</Badge>
            {{ $t("match.lineup.discord_link") }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {{ member.placeholder_name }}
    </div>
  </template>
</template>

<script lang="ts">
export default {
  props: {
    member: {
      type: Object,
      required: true,
    },
    match: {
      type: Object,
      required: false,
    },
    atElo: {
      type: Number,
      required: false,
      default: null,
    },
  },
  computed: {
    // Every lineup table shows the rating the player held going INTO the
    // match when the match has an elo_changes row for them, not their live
    // one (which costs get_player_elo() per player to fetch).
    resolvedAtElo(): number | null {
      if (this.atElo != null) return this.atElo;
      const sid = String(
        this.member?.steam_id ?? this.member?.player?.steam_id ?? "",
      );
      if (!sid) return null;
      const row = this.match?.elo_changes?.find?.(
        (ec: any) => String(ec.player_steam_id) === sid,
      );
      const start = Number(row?.current_elo);
      return Number.isFinite(start) && start > 0 ? start : null;
    },
  },
};
</script>
