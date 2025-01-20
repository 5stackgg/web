<script setup lang="ts">
import TimeAgo from "~/components/TimeAgo.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <div class="my-2">
    <div class="grid grid-cols-[60px_1fr] gap-x-1">
      <div class="my-1 mx-3">
        <PlayerDisplay
          :player="message.from"
          :show-name="false"
          :show-steam-id="false"
          :show-flag="false"
          v-if="!isSameSender || !isCloseTogether"
        />
      </div>

      <div>
        <div
          class="flex items-center space-x-2 text-muted-foreground"
          v-if="!isSameSender || !isCloseTogether"
        >
          <h4 class="font-semibold">{{ message.from.name }}</h4>
          <span class="text-xs">
            <time-ago :date="message.timestamp"></time-ago>
          </span>
        </div>
        <p>{{ message.message }}</p>
      </div>
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
  },
};
</script>
