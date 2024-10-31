<script lang="ts" setup>
import PlayerStatusDisplay from "./PlayerStatusDisplay.vue";
</script>

<template>
  <template v-if="member.player">
    <div @click="viewPlayer" class="cursor-pointer text-left">
      <PlayerStatusDisplay :member="member" :match="match" />
    </div>
  </template>
  <template v-else>
    <div class="ml-1 flex gap-4">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <NuxtImg
              src="/img/logos/discord.svg"
              alt="Discord"
              class="w-5 h-5"
            />
          </TooltipTrigger>
          <TooltipContent>
            This is a Discord user, register your discord id to enable stat
            tracking by typing <Badge variant="secondary">/link</Badge> in the
            officla discord channel.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {{ member.placeholder_name }}
    </div>
  </template>
</template>

<script lang="ts">
import { e_match_status_enum } from "~/generated/zeus";

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
  methods: {
    viewPlayer() {
      this.$router.push(`/players/${this.member.steam_id}`);
    },
  },
};
</script>
