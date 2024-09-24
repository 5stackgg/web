<script lang="ts" setup>
import TimezoneFlag from "~/components/TimezoneFlag.vue";
</script>

<template>
  <div class="grid grid-cols-[64px_1fr]">
    <div class="grid grid-cols-1 gap-3 place-items-center">
      <Avatar class="relative">
        <AvatarImage
          :src="player.avatar_url"
          :alt="player.name"
          v-if="player.avatar_url"
        />
      </Avatar>
      <slot name="avatar-sub"></slot>
    </div>
    <div :class="{ 'flex items-center': !showSteamId }">
      <slot>
        <div class="text-left text-sm">
          <div>
            <div class="flex items-center gap-1">
              <TimezoneFlag v-if="showFlag" :country="player.country" />
              <div v-if="showName">{{ player.name }}</div>
            </div>
            <slot name="name-postfix"></slot>
          </div>
          <p class="text-muted-foreground" v-if="showSteamId">
            {{ player.steam_id }}
          </p>
        </div>
      </slot>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    player: {
      type: Object,
      required: true,
    },
    showName: {
      type: Boolean,
      default: true,
    },
    showFlag: {
      type: Boolean,
      default: true,
    },
    showSteamId: {
      type: Boolean,
      default: true,
    },
  },
};
</script>
