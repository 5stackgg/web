<script setup lang="ts">
import TimeAgo from "~/components/TimeAgo.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <div :class="rowClasses" :style="{ paddingTop: `${padTopRem}rem` }">
    <!-- One rail down a whole run of team lines. Rows inside a run carry no
         margin, so the segments meet and read as a single stroke; a border per
         row broke into dashes the moment two people spoke in a row. -->
    <span
      v-if="isTeamMessage"
      class="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-[hsl(var(--tac-amber)/0.55)]"
      :class="[
        startsTeamRun ? 'rounded-t-full' : '',
        endsTeamRun ? 'rounded-b-full' : '',
      ]"
    ></span>

    <!-- Grouped lines carry no name and no time, which is what makes a run
         readable -- but the time still has to be recoverable, so it comes back
         in the gutter the avatar left empty, on hover. -->
    <span
      v-if="!showMeta"
      class="pointer-events-none absolute left-0 w-12 pr-2 text-right font-mono text-[9px] leading-snug text-muted-foreground/70 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      :style="{ top: `calc(${padTopRem}rem + 1px)` }"
    >
      {{ clockTime }}
    </span>

    <!-- Offset by the row's own top padding. Absolute children measure from the
         padding edge, so a padded team row would drop its text without moving
         the avatar, and the two would sit on different lines. -->
    <div
      v-if="showMeta"
      class="absolute left-2"
      :style="{ top: `${padTopRem}rem` }"
    >
      <PlayerDisplay
        :player="message.from"
        size="sm"
        :compact="true"
        :align-top="true"
        :show-online="false"
        :show-elo="false"
        :show-steam-id="false"
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
        <h4 class="font-semibold truncate max-w-[140px] text-foreground/90">
          {{ message.from.name }}
        </h4>
        <span class="whitespace-nowrap text-[9px] text-muted-foreground/70">
          <time-ago :date="message.timestamp" hide-icon></time-ago>
        </span>
        <!-- Which room, not who is speaking, so it sits away from the name --
             and only where the run starts, since the rail says the rest. -->
        <span
          v-if="isTeamMessage && startsTeamRun"
          class="ml-auto shrink-0 font-mono text-[0.5rem] font-bold uppercase leading-none tracking-[0.16em] text-[hsl(var(--tac-amber)/0.85)]"
        >
          {{ $t("chat.team_tag") }}
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
    nextMessage: {
      type: Object,
      required: false,
    },
  },
  computed: {
    // Stamped by ChatLobby when it merges the match room with a lineup room.
    // Absent everywhere else, which is what keeps every other chat surface
    // rendering exactly as before.
    isTeamMessage() {
      return this.message?.__channel === "team";
    },
    // Wall clock rather than "5 minutes ago": this only shows on hover over a
    // grouped line, where the question is when that line landed relative to the
    // ones around it, not how long ago it was.
    clockTime() {
      const time = new Date(this.message?.timestamp);

      if (Number.isNaN(time.getTime())) {
        return "";
      }

      return time.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    },
    // A run is consecutive team lines, whoever is speaking -- the rail marks
    // the room, not the speaker, so it should not break when the speaker
    // changes.
    startsTeamRun() {
      return this.previousMessage?.__channel !== "team";
    },
    endsTeamRun() {
      return this.nextMessage?.__channel !== "team";
    },
    // Kept in one place so the row's padding and the absolute children that
    // have to match it can never drift apart.
    padTopRem() {
      if (!this.isTeamMessage) {
        return 0;
      }

      if (this.startsTeamRun) {
        return 0.375;
      }

      return this.showMeta ? 0.625 : 0.25;
    },
    rowClasses() {
      // Same gutter either way. The rail is drawn inside it rather than added
      // to it, so a team line starts on the same column as every other line and
      // the avatars stay in one straight edge down the list.
      const classes = ["group relative pl-12 text-[11px] leading-snug"];

      if (!this.isTeamMessage) {
        classes.push(
          this.isSameSender && this.isCloseTogether ? "mt-1" : "mt-3",
        );
        return classes;
      }

      classes.push("pr-2 bg-[hsl(var(--tac-amber)/0.05)]");

      // Inside a run the separation between speakers is padding, not margin, so
      // the tinted block and the rail stay unbroken. The amount comes from
      // padTopRem, which the avatar reads too.
      classes.push(this.startsTeamRun ? "mt-3 rounded-t-sm" : "mt-0");
      classes.push(this.endsTeamRun ? "rounded-b-sm pb-1.5" : "pb-0");

      return classes;
    },
    isSameSender() {
      if (!this.previousMessage) {
        return false;
      }
      // Same player, different room is not the same speaker as far as this
      // stream is concerned -- grouping the second line under the first would
      // hand it the wrong rail and hide which room it went to.
      if (this.previousMessage.__channel !== this.message.__channel) {
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
