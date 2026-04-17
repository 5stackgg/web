<script lang="ts" setup>
import PlayerStatusDisplay from "./PlayerStatusDisplay.vue";
</script>

<template>
  <template v-if="member.player">
    <PlayerStatusDisplay :member="member" :match="match">
      <template v-if="$slots['name-postfix']" #name-postfix>
        <slot name="name-postfix"></slot>
      </template>
      <template v-if="$slots['elo-postfix']" #elo-postfix>
        <slot name="elo-postfix"></slot>
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
  },
};
</script>
