<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { LogOut, Mic, Plus } from "lucide-vue-next";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import PlaySeat from "~/components/play/PlaySeat.vue";
import MatchmakingLobbyAccess from "~/components/matchmaking-lobby/MatchmakingLobbyAccess.vue";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { EXPECTED_PLAYERS } from "~/utilities/matchmakingPartySize";
import { seatPlan } from "~/components/play/matchmakingHero";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";
import { useVoiceSession } from "~/composables/useVoiceSession";
import { generateMutation } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import type { e_match_types_enum } from "~/generated/zeus";

// The party as seats for the picked mode: your side, or the whole match when
// you play each other. Every mode draws the same height, so switching modes
// never moves the card: seat cards are always a fifth of the row, a whole
// match past five seats folds into two half-height rows, and the one line
// under the seats is reserved even when it's empty.
const props = defineProps<{
  type: e_match_types_enum;
}>();

const { t } = useI18n();
const auth = useAuthStore();
const matchmaking = useMatchmakingStore();
const apiDomain = useRuntimeConfig().public.apiDomain as string;

const me = computed(() => auth.me as any);
const lobby = computed(() => matchmaking.currentLobby as any);

// Leader first, then everyone who joined, then pending invites. With no
// lobby yet it's just you; the first invite creates the lobby.
const slots = computed<any[]>(() => {
  const players = lobby.value?.players ?? [
    { player: me.value, status: "Accepted", captain: true },
  ];
  return [...players].sort((a: any, b: any) => {
    if (a.captain !== b.captain) return a.captain ? -1 : 1;
    if (a.status !== b.status) return a.status === "Invited" ? 1 : -1;
    return 0;
  });
});
const joinedCount = computed(
  () => slots.value.filter((slot) => slot.status !== "Invited").length,
);

const openAll = ref(false);
watch(
  () => props.type,
  () => (openAll.value = false),
);

const plan = computed(() =>
  seatPlan(
    EXPECTED_PLAYERS[props.type] ?? 10,
    joinedCount.value,
    openAll.value,
  ),
);
const seated = computed(() => slots.value.slice(0, plan.value.total));
const overflow = computed(() => slots.value.slice(plan.value.total));

const isMe = (slot: any) =>
  String(slot.player?.steam_id) === String(me.value?.steam_id);
const isLeader = computed(
  () => !lobby.value || slots.value.some((slot) => slot.captain && isMe(slot)),
);

const typeKey = computed(() => props.type.toLowerCase());
function eloOf(player: any): number | null {
  const value = player?.elo?.[typeKey.value];
  return typeof value === "number" ? value : null;
}
const averageElo = computed(() => {
  const values = slots.value
    .filter((slot) => slot.status !== "Invited")
    .map((slot) => eloOf(slot.player))
    .filter((value): value is number => value !== null);
  if (values.length < 2) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
});

const title = computed(() => {
  const { perSide, total, inHouse } = plan.value;
  if (inHouse) {
    return perSide === 1
      ? t("pages.play.matchmaking.seat_row.both_seats")
      : t("pages.play.matchmaking.seat_row.all_seats", { count: total });
  }
  return perSide === 1
    ? t("pages.play.matchmaking.seat_row.just_you")
    : t("pages.play.matchmaking.seat_row.your_side");
});

// Every grid column is a fifth of the row whatever the mode, so the seats
// never resize when the mode changes.
const gridStyle = computed(() => {
  const { perSide, total, twoRows } = plan.value;
  const cols = twoRows ? perSide : total;
  const seat = "calc((100% - 4 * var(--seat-gap)) / 5)";
  return {
    gridTemplateColumns: `repeat(${cols}, ${seat})${showRest.value ? " minmax(0, 1fr)" : ""}`,
    gridTemplateRows: twoRows
      ? "repeat(2, calc((var(--seat-h) - var(--seat-gap)) / 2))"
      : "var(--seat-h)",
  };
});
const showRest = computed(() => !plan.value.inHouse && plan.value.total < 5);

const ineligible = computed<Record<string, string>>(() =>
  Object.fromEntries(
    slots.value.map((slot) => [
      String(slot.player?.steam_id),
      t("player.search.ineligible.in_lobby"),
    ]),
  ),
);

async function invite(player: { steam_id: string }) {
  await matchmaking.inviteToLobby(player.steam_id);
}

async function remove(steamId: string) {
  if (!lobby.value) return;
  await getGraphqlClient().mutate({
    mutation: generateMutation({
      delete_lobby_players_by_pk: [
        { lobby_id: lobby.value.id, steam_id: steamId },
        { __typename: true },
      ],
    }),
  });
}

// The message line: one at a time, most pressing first.
const message = computed<{ text?: string; link?: "open" | "close" } | null>(
  () => {
    const { perSide: side, total, inHouse } = plan.value;
    const joined = joinedCount.value;
    if (inHouse && joined === total) {
      return { text: t("pages.play.matchmaking.seat_row.play_each_other") };
    }
    if (inHouse && joined > side) {
      return {
        text: t("pages.play.matchmaking.seat_row.too_many", {
          count: joined,
          total,
          extra: joined - side,
        }),
      };
    }
    if (inHouse) {
      return {
        text: t("pages.play.matchmaking.seat_row.fill_all", { count: total }),
        link: isLeader.value ? "close" : undefined,
      };
    }
    return isLeader.value ? { link: "open" } : null;
  },
);
const openLabel = computed(() =>
  plan.value.perSide === 1
    ? t("pages.play.matchmaking.seat_row.open_both")
    : t("pages.play.matchmaking.seat_row.open_all", {
        count: plan.value.perSide * 2,
      }),
);

// Invites past the last seat: a pill, the details on press.
const overflowWhy = computed(() => {
  const side = plan.value.perSide;
  const after = joinedCount.value + overflow.value.length;
  const format = `${side}v${side}`;
  if (after === side * 2) {
    return t("pages.play.matchmaking.seat_row.pending_full", { count: after });
  }
  if (after > side * 2) {
    return t("pages.play.matchmaking.seat_row.pending_too_big", { format });
  }
  return t("pages.play.matchmaking.seat_row.pending_side", {
    count: after,
    format,
  });
});

function avatarSrc(player: any) {
  return resolveAvatarUrl(
    player?.roster_image_url || player?.custom_avatar_url || player?.avatar_url,
    apiDomain,
    64,
  );
}

// Who is talking, from the party's own voice channel only.
const { session } = useActiveVoiceChannel();
const voiceSession = useVoiceSession();
const partyVoiceEnabled = computed(
  () => useApplicationSettingsStore().voiceChatLobbiesEnabled,
);
const inPartyVoice = computed(
  () => !!lobby.value && session.value?.id === lobby.value.id,
);
function voiceState(steamId: string) {
  if (!inPartyVoice.value) return null;
  return (
    session.value?.participants.find(
      (participant) => String(participant.steamId) === String(steamId),
    ) ?? null
  );
}
function joinVoice() {
  void voiceSession.join(
    lobby.value.id,
    t("layouts.voice_panel.party_comms"),
    "lobby",
  );
}

const iconButton =
  "relative grid size-8 place-items-center rounded-md border transition-colors after:absolute after:-inset-1.5 after:content-[''] [@media(pointer:fine)]:after:hidden";
</script>

<template>
  <div
    class="mt-4 border-t border-border/70 pt-3.5 [--seat-gap:10px] [--seat-h:172px] max-sm:mt-3.5 max-sm:pt-3 max-sm:[--seat-gap:6px] max-sm:[--seat-h:116px]"
  >
    <div class="mb-3 flex h-8 items-center justify-between gap-3">
      <div class="flex min-w-0 items-baseline gap-2.5 text-[12.5px]">
        <span class="shrink-0 text-sm font-semibold">{{ title }}</span>
        <span class="truncate tabular-nums text-muted-foreground">
          {{
            $t("pages.play.matchmaking.seat_row.count", {
              count: joinedCount,
              total: plan.total,
            })
          }}<template v-if="averageElo !== null">
            ·
            {{
              $t("pages.play.matchmaking.seat_row.avg_elo", {
                elo: averageElo.toLocaleString(),
              })
            }}</template
          >
        </span>
      </div>

      <div class="flex shrink-0 items-center gap-1.5">
        <Popover v-if="overflow.length">
          <PopoverTrigger as-child>
            <button
              type="button"
              class="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] pl-1.5 pr-2.5 text-xs font-semibold text-[hsl(var(--tac-amber))] transition-colors hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)] data-[state=open]:border-[hsl(var(--tac-amber))]"
            >
              <span class="flex">
                <Avatar
                  v-for="(slot, index) in overflow.slice(0, 2)"
                  :key="slot.player.steam_id"
                  shape="square"
                  class="size-5 rounded-[4px] text-[8px]"
                  :class="
                    index
                      ? '-ml-2.5 shadow-[0_0_0_2px_hsl(var(--background))]'
                      : ''
                  "
                >
                  <AvatarImage
                    v-if="avatarSrc(slot.player)"
                    :src="avatarSrc(slot.player)!"
                    :alt="slot.player.name"
                  />
                  <AvatarFallback>{{
                    (slot.player.name ?? "?").slice(0, 2).toUpperCase()
                  }}</AvatarFallback>
                </Avatar>
              </span>
              {{
                $t("pages.play.matchmaking.seat_row.pending_pill", {
                  count: overflow.length,
                })
              }}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" class="grid w-[290px] gap-1 p-2.5">
            <div
              v-for="slot in overflow"
              :key="slot.player.steam_id"
              class="flex min-h-10 items-center gap-2.5"
            >
              <Avatar shape="square" class="size-[30px] text-[10px]">
                <AvatarImage
                  v-if="avatarSrc(slot.player)"
                  :src="avatarSrc(slot.player)!"
                  :alt="slot.player.name"
                />
                <AvatarFallback>{{
                  (slot.player.name ?? "?").slice(0, 2).toUpperCase()
                }}</AvatarFallback>
              </Avatar>
              <span class="grid min-w-0 flex-1 leading-tight">
                <b class="truncate text-[13.5px] font-semibold">{{
                  slot.player.name
                }}</b>
                <span
                  v-if="slot.status === 'Invited'"
                  class="text-xs text-[hsl(var(--tac-amber))]"
                  >{{ $t("matchmaking.lobby.invited") }}</span
                >
              </span>
              <Button
                v-if="isLeader && slot.status === 'Invited'"
                variant="ghost"
                size="sm"
                class="h-7"
                @click="remove(slot.player.steam_id)"
              >
                {{ $t("pages.play.matchmaking.seat_row.cancel_invite") }}
              </Button>
            </div>
            <p
              class="m-0 px-0.5 pt-1 text-[12.5px] text-muted-foreground [text-wrap:pretty]"
            >
              {{ overflowWhy }}
            </p>
          </PopoverContent>
        </Popover>

        <template v-if="lobby">
          <MatchmakingLobbyAccess :lobby="lobby" labelled />
          <FiveStackToolTip
            v-if="partyVoiceEnabled && joinedCount > 1 && !inPartyVoice"
            side="bottom"
            as-child
          >
            <template #trigger>
              <button
                type="button"
                :class="[
                  iconButton,
                  'border-emerald-400/40 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20',
                ]"
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
                :class="[
                  iconButton,
                  'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                ]"
                :aria-label="$t('matchmaking.lobby.leave')"
                @click="remove(me?.steam_id)"
              >
                <LogOut class="size-3.5" />
              </button>
            </template>
            {{ $t("matchmaking.lobby.leave") }}
          </FiveStackToolTip>
        </template>
      </div>
    </div>

    <div class="grid gap-[var(--seat-gap)]" :style="gridStyle">
      <template v-for="index in plan.total" :key="index">
        <PlaySeat
          v-if="seated[index - 1]"
          :player="seated[index - 1].player"
          :elo="eloOf(seated[index - 1].player)"
          :invited="seated[index - 1].status === 'Invited'"
          :captain="!!lobby && seated[index - 1].captain"
          :me="isMe(seated[index - 1])"
          :compact="plan.twoRows"
          :can-remove="isLeader && !!lobby && !isMe(seated[index - 1])"
          :in-voice="!!voiceState(seated[index - 1].player.steam_id)?.connected"
          :speaking="!!voiceState(seated[index - 1].player.steam_id)?.speaking"
          @remove="remove(seated[index - 1].player.steam_id)"
        />
        <div v-else class="grid min-w-0 [&>div]:h-full">
          <PlayerSearch
            :label="$t('matchmaking.lobby.invite_player')"
            :self="false"
            :registered-only="true"
            :group-by-friends="true"
            :ineligible="ineligible"
            @selected="invite"
          >
            <button
              type="button"
              class="group/empty flex size-full min-w-0 items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-border text-muted-foreground transition-colors [transition-duration:150ms] hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.04)] hover:text-[hsl(var(--tac-amber))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
              :class="
                plan.twoRows
                  ? 'flex-row gap-2 max-sm:flex-col max-sm:gap-0.5'
                  : 'flex-col gap-2.5 max-sm:gap-1.5'
              "
              :aria-label="$t('matchmaking.lobby.invite_player')"
            >
              <span
                class="grid shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-current opacity-80"
                :class="
                  plan.twoRows
                    ? 'size-[26px] max-sm:size-[22px]'
                    : 'size-[38px] max-sm:size-[30px]'
                "
              >
                <Plus class="size-4 max-sm:size-3.5" />
              </span>
              <span class="text-[12.5px] max-sm:text-[11.5px]">
                <span class="max-sm:hidden">{{
                  $t("pages.play.matchmaking.seat_row.invite")
                }}</span>
                <span class="sm:hidden">{{
                  $t("pages.play.matchmaking.seat_row.invite_short")
                }}</span>
              </span>
            </button>
          </PlayerSearch>
        </div>
      </template>

      <!-- The room a short side leaves says where the rest of the match
           comes from. -->
      <div
        v-if="showRest"
        class="flex flex-col justify-center gap-1 border-l border-border pl-[18px] pr-2 text-[13px] text-muted-foreground/70 [text-wrap:pretty] max-sm:pl-2.5 max-sm:pr-1 max-sm:text-[11.5px]"
      >
        <span class="text-xs font-bold tracking-[0.14em]">{{
          $t("pages.play.matchmaking.seat_row.vs")
        }}</span>
        <span>{{
          $t("pages.play.matchmaking.seat_row.from_queue", plan.perSide)
        }}</span>
      </div>
    </div>

    <!-- Always takes its height, so a message coming or going never moves
         the card. -->
    <div
      class="mt-1.5 flex h-[34px] flex-wrap items-center gap-x-2.5 gap-y-0.5 overflow-hidden text-[12.5px] max-sm:h-10 max-sm:text-xs"
    >
      <span
        v-if="message?.text"
        class="text-muted-foreground [text-wrap:pretty]"
        >{{ message.text }}</span
      >
      <button
        v-if="message?.link"
        type="button"
        class="text-muted-foreground underline decoration-muted-foreground/40 underline-offset-[3px] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
        @click="openAll = message.link === 'open'"
      >
        {{
          message.link === "open"
            ? openLabel
            : $t("pages.play.matchmaking.seat_row.just_your_side")
        }}
      </button>
    </div>
  </div>
</template>
