<script setup lang="ts">
import TimeAgo from "~/components/TimeAgo.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <div
    :class="[
      'relative pl-12 text-[11px] leading-snug',
      isSameSender && isCloseTogether ? 'mt-0.5 mb-0.5' : 'my-1.5',
    ]"
  >
    <div
      v-if="showMeta"
      class="absolute left-2 top-0"
    >
      <PlayerDisplay
        :player="message.from"
        size="sm"
        :compact="true"
        :align-top="true"
        :show-online="false"
        :show-elo="false"
        :show-steam-id="false"
        :show-add-friend="false"
        :tooltip="false"
        :linkable="false"
        :show-name="false"
        :show-flag="false"
        :show-role="false"
      />
    </div>

    <div>
      <div
        v-if="showMeta"
        class="flex items-center space-x-1.5 text-muted-foreground text-[10px]"
      >
        <h4 class="font-semibold truncate max-w-[140px]">
          {{ message.from.name }}
        </h4>
        <span class="text-[10px] whitespace-nowrap">
          <time-ago :date="message.timestamp"></time-ago>
        </span>
      </div>
      <p class="text-[11px] leading-snug break-words">
        {{ message.message }}
      </p>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    message: {
      type: Object,
      required: false,
    },
    previousMessage: {
      type: Object,
      required: false,
    },
  },
  computed: {
    isSameSender() {
      if (!this.previousMessage) {
        return false;
      }
      return this.message.from.steam_id === this.previousMessage.from.steam_id;
    },
    isCloseTogether() {
      if (!this.isSameSender || !this.previousMessage) {
        return false;
      }
      const previousTimestamp = new Date(this.previousMessage.timestamp);
      const messageTimestamp = new Date(this.message.timestamp);

      messageTimestamp.setMinutes(messageTimestamp.getMinutes() - 5);

      return previousTimestamp > messageTimestamp;
    },
    showMeta() {
      return !this.isSameSender || !this.isCloseTogether;
    },
  },
};
</script>
