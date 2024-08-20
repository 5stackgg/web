<script lang="ts" setup></script>
<template>
  <div class="grid grid-cols-[64px_1fr]">
    <div class="grid grid-cols-1 gap-3 place-items-center">
      <Avatar>
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
          <p>{{ player.name }} <slot name="name-postfix"></slot></p>
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
