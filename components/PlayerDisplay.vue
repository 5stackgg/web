<script lang="ts" setup></script>
<template>
  <Avatar>
    <AvatarImage
      :src="player.avatar_url"
      :alt="player.name"
      v-if="player.avatar_url"
    />
  </Avatar>
  <slot>
    <div class="text-left pl-3 text-sm">
      <p>
        {{ player.name }}
      </p>
      <p class="text-muted-foreground">
        {{ player.steam_id }}
      </p>
    </div>
  </slot>
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
