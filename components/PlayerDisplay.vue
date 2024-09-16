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
    <div>
      <slot>
        <div class="text-left text-sm">
          <div>
            <div class="flex items-center gap-1">
              <TimezoneFlag :country="player.country" />
              <div>{{ player.name }}</div>
            </div>
            <slot name="name-postfix"></slot>
          </div>
          <p class="text-muted-foreground">
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
  },
};
</script>
