<script lang="ts" setup>
import TimezoneFlag from "~/components/TimezoneFlag.vue";
</script>

<template>
  <div
    class="grid gap-2"
    @click="viewPlayer"
    :class="{
      'cursor-pointer': linkable,
      'grid-cols-[52px]': !showName && !showSteamId && !showFlag,
      'grid-cols-[52px_1fr]': showName || showSteamId || showFlag,
    }"
  >
    <div class="flex flex-col items-center justify-center relative">
      <Avatar class="rounded">
        <AvatarImage
          :src="player.avatar_url"
          :alt="player.name"
          v-if="player.avatar_url"
        />
        <AvatarFallback>
          {{ player.name.slice(0, 2) }}
        </AvatarFallback>
      </Avatar>
      <slot name="status">
        <template v-if="isOnline && showOnline">
          <span
            class="absolute -top-1 left-0 h-2 w-2 rounded-full animate-ping bg-green-500"
            v-if="pingStatus"
          ></span>
          <span
            class="absolute -top-1 left-0 h-2 w-2 rounded-full bg-green-500"
          ></span>
        </template>
      </slot>
      <div class="mt-2" v-if="$slots['avatar-sub']">
        <slot name="avatar-sub"></slot>
      </div>
    </div>
    <div
      :class="{ 'flex items-center': !showSteamId }"
      v-if="showFlag || showName || showSteamId"
    >
      <slot>
        <div
          class="text-left"
          :class="{
            'text-sm': size === 'sm',
            'text-lg': size === 'lg',
            'text-xl': size === 'xl',
          }"
        >
          <div class="flex items-center gap-2">
            <slot name="name-prefix"></slot>
            <div class="flex items-center gap-2">
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
    showOnline: {
      type: Boolean,
      default: true,
    },
    pingStatus: {
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
  computed: {
    isOnline() {
      return useMatchMakingStore().onlinePlayerSteamIds.includes(
        this.player.steam_id,
      );
    },
  },
};
</script>
