<script setup lang="ts">
import { computed } from "vue";
import { Crown, LogOut, Plus, X, Mic } from "lucide-vue-next";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import MatchmakingLobbyAccess from "~/components/matchmaking-lobby/MatchmakingLobbyAccess.vue";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";
import { useVoiceSession } from "~/composables/useVoiceSession";
import { generateMutation } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useI18n } from "vue-i18n";

// The top of the party room: who is in it, laid out as seats. Empty seats are
// where invites go, so the gap in the squad is also the way to fill it.
const props = defineProps<{ lobby: any }>();

const SEATS = 5;

const { t } = useI18n();
const authStore = useAuthStore();
const me = computed(() => authStore.me);
const apiDomain = useRuntimeConfig().public.apiDomain as string;

const players = computed(() =>
  [...(props.lobby?.players ?? [])].sort((a: any, b: any) => {
    if (a.captain !== b.captain) return a.captain ? -1 : 1;
    if (a.status !== b.status) return a.status === "Invited" ? 1 : -1;
    return 0;
  }),
);
const memberCount = computed(
  () => players.value.filter((slot: any) => slot.status !== "Invited").length,
);
const emptySeats = computed(() => Math.max(0, SEATS - players.value.length));
const isCaptain = computed(
  () =>
    players.value.find(
      (slot: any) => String(slot.player.steam_id) === String(me.value?.steam_id),
    )?.captain ?? false,
);

const ineligible = computed<Record<string, string>>(() =>
  Object.fromEntries(
    players.value.map((slot: any) => [
      String(slot.player.steam_id),
      t("player.search.ineligible.in_lobby"),
    ]),
  ),
);

// Who is talking, from the party's own voice channel only.
const { session } = useActiveVoiceChannel();
const voiceSession = useVoiceSession();
const partyVoiceEnabled = computed(
  () => useApplicationSettingsStore().voiceChatLobbiesEnabled,
);
const inPartyVoice = computed(() => session.value?.id === props.lobby?.id);
function voiceState(steamId: string) {
  if (!inPartyVoice.value) return null;
  return (
    session.value?.participants.find(
      (participant) => String(participant.steamId) === String(steamId),
    ) ?? null
  );
}

function avatarSrc(player: any) {
  return resolveAvatarUrl(
    player.roster_image_url || player.custom_avatar_url || player.avatar_url,
    apiDomain,
  );
}

function initials(name?: string | null) {
  return (name ?? "?").slice(0, 2).toUpperCase();
}

async function invite(steamId: string) {
  await useMatchmakingStore().inviteToLobby(steamId);
}

async function remove(steamId: string) {
  await getGraphqlClient().mutate({
    mutation: generateMutation({
      delete_lobby_players_by_pk: [
        { lobby_id: props.lobby.id, steam_id: steamId },
        { __typename: true },
      ],
    }),
  });
}

function joinVoice() {
  void voiceSession.join(
    props.lobby.id,
    t("layouts.voice_panel.party_comms"),
    "lobby",
  );
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <span class="text-sm font-semibold text-foreground">
        {{ $t("layouts.party_room.title") }}
      </span>
      <span
        class="inline-flex h-5 items-center rounded-sm bg-zinc-800 px-1.5 text-[0.65rem] font-semibold tabular-nums text-zinc-300"
      >
        {{ $t("layouts.party_room.members", { count: memberCount }) }}
      </span>
      <div class="ml-auto flex items-center gap-1.5">
        <MatchmakingLobbyAccess v-if="isCaptain" :lobby="lobby" />
        <FiveStackToolTip
          v-if="partyVoiceEnabled && !inPartyVoice"
          side="bottom"
          as-child
        >
          <template #trigger>
            <button
              type="button"
              class="grid size-8 place-items-center rounded-md border border-emerald-400/40 bg-emerald-400/10 text-emerald-400 transition-colors hover:bg-emerald-400/20"
              :aria-label="$t('layouts.party_room.join_voice')"
              @click="joinVoice"
            >
              <Mic class="size-3.5" />
            </button>
          </template>
          {{ $t("layouts.party_room.join_voice") }}
        </FiveStackToolTip>
        <FiveStackToolTip side="bottom" as-child>
          <template #trigger>
            <button
              type="button"
              class="grid size-8 place-items-center rounded-md border border-red-500/35 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20"
              :aria-label="$t('matchmaking.lobby.leave')"
              @click="remove(me?.steam_id)"
            >
              <LogOut class="size-3.5" />
            </button>
          </template>
          {{ $t("matchmaking.lobby.leave") }}
        </FiveStackToolTip>
      </div>
    </div>

    <div class="flex flex-wrap justify-between gap-y-3">
      <div
        v-for="slot in players"
        :key="slot.player.steam_id"
        class="group/seat flex w-[60px] flex-col items-center gap-1.5"
        :class="{ 'opacity-50': slot.status === 'Invited' }"
      >
        <div class="relative">
          <NuxtLink
            :to="{ name: 'players-id', params: { id: slot.player.steam_id } }"
            class="block rounded-md transition-shadow"
            :class="
              voiceState(slot.player.steam_id)?.speaking
                ? 'shadow-[0_0_0_2px_hsl(var(--sidebar-background)),0_0_0_4px_rgb(52_211_153)]'
                : ''
            "
          >
            <Avatar shape="square">
              <AvatarImage
                v-if="avatarSrc(slot.player)"
                :src="avatarSrc(slot.player)!"
                :alt="slot.player.name"
              />
              <AvatarFallback>{{ initials(slot.player.name) }}</AvatarFallback>
            </Avatar>
          </NuxtLink>
          <Crown
            v-if="slot.captain"
            class="absolute -top-2.5 left-1/2 size-3.5 -translate-x-1/2 fill-current text-[hsl(var(--tac-amber))]"
          />
          <span
            v-if="voiceState(slot.player.steam_id)?.connected"
            class="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-emerald-500 text-black shadow-[0_0_0_2px_hsl(var(--sidebar-background))]"
          >
            <Mic class="size-2.5" />
          </span>
          <button
            v-if="
              isCaptain &&
              String(slot.player.steam_id) !== String(me?.steam_id)
            "
            type="button"
            class="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-red-500 text-white opacity-0 shadow-[0_0_0_2px_hsl(var(--sidebar-background))] transition-opacity focus-visible:opacity-100 group-hover/seat:opacity-100"
            :aria-label="$t('layouts.party_room.remove', { name: slot.player.name })"
            @click="remove(slot.player.steam_id)"
          >
            <X class="size-2.5" />
          </button>
        </div>
        <span class="max-w-[60px] truncate text-[0.7rem] text-zinc-300">
          {{
            slot.status === "Invited"
              ? $t("matchmaking.lobby.invited")
              : slot.player.name
          }}
        </span>
      </div>

      <template v-for="seat in emptySeats" :key="`seat-${seat}`">
        <PlayerSearch
          v-if="isCaptain"
          :label="$t('matchmaking.lobby.invite_player')"
          :self="false"
          :registered-only="true"
          :ineligible="ineligible"
          @selected="(player: any) => invite(player.steam_id)"
        >
          <button
            type="button"
            class="flex w-[60px] flex-col items-center gap-1.5"
            :aria-label="$t('matchmaking.lobby.invite_player')"
          >
            <span
              class="grid size-10 place-items-center rounded-md border-[1.5px] border-dashed border-zinc-700 text-zinc-500 transition-colors hover:border-[hsl(var(--tac-amber)/0.6)] hover:text-[hsl(var(--tac-amber))]"
            >
              <Plus class="size-4" />
            </span>
            <span class="text-[0.7rem] text-zinc-500">
              {{ $t("layouts.party_room.invite") }}
            </span>
          </button>
        </PlayerSearch>
        <div v-else class="flex w-[60px] flex-col items-center gap-1.5">
          <span
            class="size-10 rounded-md border-[1.5px] border-dashed border-zinc-800"
          />
          <span class="text-[0.7rem] text-zinc-600">
            {{ $t("layouts.party_room.open_seat") }}
          </span>
        </div>
      </template>
    </div>
  </div>
</template>
