<script lang="ts" setup>
import TimezoneFlag from "~/components/TimezoneFlag.vue";
</script>

<template>
  <div
    class="grid grid-cols-[64px_1fr]"
    @click="viewPlayer"
    :class="{ 'cursor-pointer': linkable }"
  >
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
        <div
          class="text-left"
          :class="{
            'text-sm': size === 'sm',
            'text-lg': size === 'lg',
            'text-xl': size === 'xl',
          }"
        >
          <div class="flex items-center gap-1">
            <slot name="name-prefix"></slot>
            <div class="flex items-center gap-1">
              <TimezoneFlag
                class="mt-1"
                v-if="showFlag"
                :country="player.country"
              />
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
    size: {
      type: String,
      default: "sm",
    },
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
    linkable: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    viewPlayer() {
      if (this.linkable) {
        this.$router.push(`/players/${this.player.steam_id}`);
      }
    },
  },
};
</script>
