<script lang="ts" setup>
import TimezoneFlag from "~/components/TimezoneFlag.vue";
import { Ban, MicOff, MessageSquareOff, UserPlus } from "lucide-vue-next";
</script>
<template>
  <div
    class="grid gap-2"
    @click="viewPlayer"
    :class="{
      'cursor-pointer': linkable,
      'grid-cols-[52px_1fr]': showName || showSteamId || showFlag,
    }"
  >
    <div class="flex flex-col items-center justify-center relative">
      <slot name="avatar">
        <Avatar shape="square">
          <AvatarImage
            :src="player.avatar_url"
            :alt="player.name"
            v-if="player?.avatar_url"
          />
          <AvatarFallback>
            <slot name="avatar-fallback">
              {{ player?.name.slice(0, 2) }}
            </slot>
          </AvatarFallback>
        </Avatar>
      </slot>
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
              <div class="flex gap-2">
                <TooltipProvider v-if="player.is_banned">
                  <Tooltip>
                    <TooltipTrigger>
                      <Ban
                        class="w-4 h-4 text-red-500"
                        v-if="player.is_banned"
                      />
                    </TooltipTrigger>
                    <TooltipContent>Player is banned</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <template v-else>
                  <TooltipProvider v-if="player.is_muted">
                    <Tooltip>
                      <TooltipTrigger>
                        <MicOff
                          class="w-4 h-4 text-red-500"
                          v-if="player.is_muted"
                        />
                      </TooltipTrigger>
                      <TooltipContent>Player is muted</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider v-if="player.is_gagged">
                    <Tooltip>
                      <TooltipTrigger>
                        <MessageSquareOff
                          class="w-4 h-4 text-red-500"
                          v-if="player.is_gagged"
                        />
                      </TooltipTrigger>
                      <TooltipContent>Player is gagged</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </template>
              </div>
            </div>
            <slot name="name-postfix"></slot>
            <TooltipProvider v-if="!isMe && showAddFriend && !isFriend && player?.steam_id">
              <Tooltip>
                <TooltipTrigger>
                  <UserPlus
                    class="w-4 h-4 cursor-pointer hover:text-primary"
                    @click.stop="addAsFriend"
                  />
                </TooltipTrigger>
                <TooltipContent>Add as friend</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p class="text-muted-foreground" v-if="showSteamId">
            {{ player.steam_id }}
          </p>
        </div>
      </slot>
    </div>
    <slot name="footer"></slot>
  </div>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  props: {
    size: {
      type: String,
      default: "sm",
    },
    player: {
      type: Object,
      required: false,
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
    showAddFriend: {
      type: Boolean,
      default: true,
    },
  },
  methods: {
    async addAsFriend() {
      await this.$apollo.mutate({
        mutation: typedGql("mutation")({
          insert_my_friends_one: [
            {
              object: {
                steam_id: this.player.steam_id,
              },
            },
            {
              steam_id: true,
            },
          ],
        }),
      });
    },
    viewPlayer() {
      if (this.linkable && this.player) {
        this.$router.push(`/players/${this.player.steam_id}`);
      }
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    isMe() {
      if (!this.player) {
        return false;
      }

      return this.me?.steam_id === this.player.steam_id;
    },
    isOnline() {
      if (!this.player) {
        return false;
      }

      return useMatchmakingStore().onlinePlayerSteamIds.includes(
        this.player.steam_id,
      );
    },
    isFriend() {
      if (!this.player) {
        return false;
      }

      return useMatchmakingStore().friends.find((friend) => {
        return friend.steam_id == this.player.steam_id;
      });
    },
  },
};
</script>
