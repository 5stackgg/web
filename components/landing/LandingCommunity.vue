<script setup lang="ts">
import ChatHeader from "~/components/chat/ChatHeader.vue";
import ChatMessages from "~/components/chat/ChatMessages.vue";
import CallGrid from "~/components/voice/CallGrid.vue";
import FriendListItem from "~/components/matchmaking-lobby/FriendListItem.vue";
import PartySeats from "~/components/hub/PartySeats.vue";
import { DEMO_PLAYERS } from "~/utilities/landing/demoStats";
import {
  DEMO_VIEWER,
  DEMO_VOICE,
  demoChat,
  demoFriends,
} from "~/utilities/landing/demoCommunity";
import { useDemoFaces } from "~/utilities/landing/demoFaces";

const { avatar, dress } = useDemoFaces();

const now = Date.now();
const messages = demoChat(now).map((message) => ({
  ...message,
  from: { ...message.from, avatar_url: avatar(message.from.name) },
}));
const friends = demoFriends(now).map((friend) => ({
  ...friend,
  row: dress(friend.row),
}));
// vexa's party, as the hub's lobby panel draws it: three in, Moritz invited.
const lobby = {
  id: "demo-lobby",
  players: [
    [DEMO_PLAYERS.vexa, "Accepted", true],
    [DEMO_PLAYERS.kuro, "Accepted", false],
    [DEMO_PLAYERS.Pip, "Accepted", false],
    [DEMO_PLAYERS.Moritz, "Invited", false],
  ].map(([player, status, captain]) => ({
    status,
    captain,
    player: dress(player as (typeof DEMO_PLAYERS)["vexa"]),
  })),
};
const voice = DEMO_VOICE.map((participant) => ({
  ...participant,
  avatarUrl: avatar(participant.name ?? ""),
}));
const noVideo = new Map<string, MediaStream>();

function toggleMute() {}
</script>

<template>
  <div
    class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] sm:items-start"
  >
    <!-- The hub's lobby panel: the party's seats, its chat, then its comms. -->
    <div
      class="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card/60"
    >
      <div
        class="border-b border-border bg-[linear-gradient(180deg,hsl(var(--tac-amber)/0.06),transparent_70%)] px-3 pb-3.5 pt-3"
      >
        <PartySeats :lobby="lobby" />
      </div>
      <ChatHeader
        variant="global"
        :participants-count="DEMO_VOICE.length"
        :show-minimize-button="false"
      />
      <ChatMessages :messages="messages" variant="global" />
      <div class="flex flex-col gap-2 border-t border-border p-3">
        <div
          class="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground"
        >
          {{ $t("layouts.voice_panel.party_comms") }}
          <span class="font-normal">
            {{
              $t("layouts.voice_panel.connected", { count: DEMO_VOICE.length })
            }}
          </span>
        </div>
        <CallGrid
          :participants="voice"
          :peer-video="noVideo"
          :local-video="null"
          :my-steam-id="DEMO_VIEWER.steam_id"
          :on-toggle-self-mute="toggleMute"
          compact
        />
      </div>
    </div>

    <div
      class="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card/60 p-2"
    >
      <div class="px-1 py-1 text-xs font-medium text-muted-foreground">
        {{ $t("matchmaking.friends.title") }}
      </div>
      <FriendListItem
        v-for="friend in friends"
        :key="friend.row.steam_id"
        :player="friend.row"
        relation="friend"
        :online="friend.online"
        :muted="friend.muted"
      />
    </div>
  </div>
</template>
