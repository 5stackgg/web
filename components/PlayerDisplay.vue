<script lang="ts" setup></script>
<template>
  <Avatar>
    <AvatarImage
      :src="player.avatar_url"
      :alt="player.name"
      v-if="player.avatar_url"
    />
  </Avatar>
  <slot>{{ player.name }}</slot>
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
