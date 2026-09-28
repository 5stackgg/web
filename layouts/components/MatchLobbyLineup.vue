<script lang="ts" setup>
import PlayerStatusDisplay from "~/components/match/PlayerStatusDisplay.vue";
</script>

<template>
  <div class="flex">
    <div
      v-for="(member, index) of lineup"
      class="relative -mr-3 transition-all duration-500 ease-out transform-gpu hover:-translate-y-2 hover:shadow-lg"
      :class="[flip ? 'z-[var(--z-index)]' : '']"
      :style="flip ? { '--z-index': lineup.length - index } : {}"
    >
      <div class="relative transition-all duration-500">
        <div
          class="absolute inset-0 bg-black/0 hover:bg-black/5 rounded-lg transition-all duration-500"
        ></div>
        <PlayerStatusDisplay
          :member="member"
          :match="match"
          :show-details="false"
          :linkable="false"
          :flip="flip"
          size="xs"
          :show-name="true"
          v-if="member.player"
        />
        <template v-else>
          <Avatar shape="square">
            <AvatarFallback>
              {{ member.placeholder_name?.slice(0, 2) }}
            </AvatarFallback>
          </Avatar>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    match: {
      required: true,
    },
    lineup: {
      required: true,
    },
    flip: {
      type: Boolean,
      default: false,
    },
  },
};
</script>
