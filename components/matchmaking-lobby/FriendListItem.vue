<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  UserPlus,
  Check,
  X,
  Tent,
  Trash2,
  Clock,
  Swords,
  LogIn,
} from "lucide-vue-next";
import { useFriendActions } from "~/composables/useFriendActions";
import { useFriendStatus } from "~/composables/useFriendStatus";
import FriendMatchPreview from "~/components/matchmaking-lobby/FriendMatchPreview.vue";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { toast } from "~/components/ui/toast";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    player: any;
    muted?: boolean;
  }>(),
  { muted: false },
);

const {
  relationship,
  isBusy,
  pendingAction,
  addFriend,
  acceptFriend,
  declineFriend,
  cancelRequest,
  removeFriend,
  inviteToLobby,
} = useFriendActions();

const rel = computed(() => relationship(props.player.steam_id));
const busy = computed(() => isBusy(props.player.steam_id));

// Tooltip-wrapped buttons read as "trigger-like" to Button, which suppresses
// its auto-spinner — so drive the loading state explicitly per action.
const loadingFor = (action: string) =>
  pendingAction(props.player.steam_id) === action;

const currentLobby = computed(() =>
  useMatchmakingStore().lobbies?.find(
    (lobby: any) => lobby.id === useAuthStore().me?.current_lobby_id,
  ),
);

const isFriend = computed(() => rel.value === "friend");

const isOnline = computed(() =>
  useMatchmakingStore().onlinePlayerSteamIds.includes(
    String(props.player.steam_id),
  ),
);

const {
  statusKey,
  dotClass,
  statusIcon,
  statusLabelKey,
  joinableDraft,
  currentMatch,
} = useFriendStatus(() => props.player, isOnline);

const joiningDraft = ref(false);
async function joinDraft() {
  const draft = joinableDraft.value;
  if (!draft || draft.full || joiningDraft.value) return;
  joiningDraft.value = true;
  try {
    await useDraftGamesStore().join(draft.id);
    if (!draft.requireApproval) {
      navigateTo(`/draft-room/${draft.id}`);
    }
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message ?? t("draft_games.card.join_error"),
    });
  } finally {
    joiningDraft.value = false;
  }
}

const canInviteToLobby = computed(() => {
  const lobby = currentLobby.value as any;
  return (
    !lobby ||
    !lobby.players?.find(
      (p: any) => String(p.player.steam_id) === String(props.player.steam_id),
    )
  );
});

function onMenuOpenChange(open: boolean) {
  const rightSidebar = useRightSidebar();
  if (open) rightSidebar.suspendHoverClose();
  else rightSidebar.resumeHoverClose();
}

// Invite to my draft lobby (right-click) — only when I'm organizing an open
// draft and this player isn't already in it.
const myDraftGame = computed(() => useDraftGamesStore().myDraftGame as any);

const canInviteToDraft = computed(() => {
  const dg = myDraftGame.value;
  if (!dg || dg.match_id) return false;
  if (["Completed", "Canceled"].includes(dg.status)) return false;

  const meId = String(useAuthStore().me?.steam_id ?? "");
  const targetId = String(props.player.steam_id);
  if (targetId === meId) return false;

  // Already in the draft (joined or invited)
  if ((dg.players ?? []).some((p: any) => String(p.steam_id) === targetId)) {
    return false;
  }

  // Host (or elevated organizer) can always invite.
  if (String(dg.host_steam_id) === meId || dg.is_organizer) return true;

  // Otherwise must be a participant AND the lobby access must allow it.
  const meParticipant = (dg.players ?? []).some(
    (p: any) => String(p.steam_id) === meId && p.status !== "Invited",
  );
  return (
    meParticipant && ["Open", "Friends", "Invite"].includes(dg.access)
  );
});

async function inviteToDraft() {
  const dg = myDraftGame.value;
  if (!dg) return;
  await useDraftGamesStore().add(dg.id, props.player.steam_id);
  toast({ title: t("draft_games.room.invite_sent", { name: props.player.name }) });
}

const actionBtn =
  "h-8 w-8 rounded-md p-0 text-muted-foreground transition-colors";
const dangerHover = "hover:bg-destructive/15 hover:text-destructive";
const amberHover =
  "hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))]";
</script>

<template>
  <!-- Single element root so the parent <TransitionGroup> has a DOM node to
       animate — ContextMenu (reka-ui) renders a non-element fragment root. -->
  <div>
    <ContextMenu :modal="false" @update:open="onMenuOpenChange">
      <ContextMenuTrigger as-child>
      <div
        class="group/row flex flex-col rounded-md pr-1 transition-colors duration-200 hover:bg-muted/50"
      >
        <!-- Identity + actions -->
        <div class="flex items-center gap-1">
        <PlayerDisplay
          class="min-w-0 flex-1 cursor-pointer rounded-md p-2 transition-opacity duration-200"
          :class="muted ? 'opacity-50 group-hover/row:opacity-90' : ''"
          :player="player"
          :show-online="false"
          :linkable="true"
          :truncate-name="true"
        >
          <!-- Always-on presence dot (friends only) -->
          <template v-if="isFriend" #status>
            <span class="absolute -left-0.5 -top-0.5 flex h-2 w-2">
              <span
                v-if="['in_match', 'in_draft'].includes(statusKey)"
                :class="[
                  'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                  dotClass,
                ]"
              />
              <span
                :class="[
                  'relative inline-flex h-2 w-2 rounded-full ring-2 ring-background',
                  dotClass,
                ]"
              />
            </span>
          </template>
        </PlayerDisplay>

        <!-- Action cluster -->
        <div class="flex shrink-0 items-center gap-0.5">
          <!-- Invite to lobby — any invitable player except incoming requests -->
          <Tooltip v-if="canInviteToLobby && rel !== 'incoming'">
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                :class="[actionBtn, amberHover]"
                :loading="loadingFor('invite')"
                :disabled="busy"
                @click="inviteToLobby(player.steam_id)"
              >
                <Tent class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{
              $t("matchmaking.friends.invite_to_lobby")
            }}</TooltipContent>
          </Tooltip>

          <!-- Relationship-specific actions — animate on change -->
          <Transition
            mode="out-in"
            enter-active-class="transition duration-200 ease-out"
            leave-active-class="transition duration-150 ease-in"
            enter-from-class="opacity-0 scale-90"
            leave-to-class="opacity-0 scale-90"
          >
            <div :key="rel" class="flex items-center gap-0.5">
              <!-- STRANGER -->
              <template v-if="rel === 'none'">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      :class="[actionBtn, amberHover]"
                      :loading="loadingFor('add')"
                      :disabled="busy"
                      @click="addFriend(player.steam_id)"
                    >
                      <UserPlus class="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{{
                    $t("player.status.add_friend")
                  }}</TooltipContent>
                </Tooltip>
              </template>

              <!-- OUTGOING — request you sent (stays in place, no jump) -->
              <template v-else-if="rel === 'outgoing'">
              <span
                class="hidden items-center gap-1 rounded border border-border/70 bg-muted/30 px-1.5 py-1 font-mono text-[0.55rem] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:flex"
              >
                <Clock class="h-3 w-3" />
                {{ $t("matchmaking.friends.requested") }}
              </span>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    :class="[actionBtn, dangerHover]"
                    :loading="loadingFor('cancel')"
                    :disabled="busy"
                    @click="cancelRequest(player.steam_id)"
                  >
                    <X class="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{
                  $t("matchmaking.friends.cancel_request")
                }}</TooltipContent>
              </Tooltip>
            </template>

            <!-- INCOMING — request you received -->
            <template v-else-if="rel === 'incoming'">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    class="h-8 w-8 rounded-md p-0 text-[hsl(var(--tac-amber))] ring-1 ring-inset ring-[hsl(var(--tac-amber)/0.35)] transition-colors hover:bg-[hsl(var(--tac-amber))] hover:text-[hsl(var(--tac-amber-foreground))]"
                    :loading="loadingFor('accept')"
                    :disabled="busy"
                    @click="acceptFriend(player.steam_id)"
                  >
                    <Check class="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{
                  $t("matchmaking.friends.accept")
                }}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    :class="[actionBtn, dangerHover]"
                    :loading="loadingFor('decline')"
                    :disabled="busy"
                    @click="declineFriend(player.steam_id)"
                  >
                    <X class="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{
                  $t("matchmaking.friends.decline")
                }}</TooltipContent>
              </Tooltip>
            </template>

              <!-- FRIEND -->
              <template v-else>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      :class="[
                        actionBtn,
                        dangerHover,
                        loadingFor('remove')
                          ? 'opacity-100'
                          : 'opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100',
                      ]"
                      :loading="loadingFor('remove')"
                      :disabled="busy"
                      @click="removeFriend(player.steam_id)"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{{
                    $t("matchmaking.friends.remove")
                  }}</TooltipContent>
                </Tooltip>
              </template>
            </div>
          </Transition>
        </div>
        </div>

        <!-- Status row (full width): status under the name, timer/join flush right -->
        <div
          v-if="isFriend"
          class="-mt-1 flex min-w-0 items-center gap-2 pb-2 pl-[68px] pr-1 transition-opacity duration-200"
          :class="muted ? 'opacity-50 group-hover/row:opacity-90' : ''"
        >
          <FriendMatchPreview
            v-if="currentMatch"
            :match="currentMatch"
            class="min-w-0 flex-1"
          />
          <span
            v-else
            class="flex items-center gap-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground"
          >
            <component :is="statusIcon" v-if="statusIcon" class="h-3 w-3" />
            {{ $t(statusLabelKey) }}
          </span>

          <!-- Mini join button — flush right — for a joinable lobby/draft -->
          <Button
            v-if="joinableDraft && !joinableDraft.full"
            size="sm"
            :class="[
              'ml-auto h-5 shrink-0 gap-1 px-1.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.1em]',
              'bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.85)]',
            ]"
            :loading="joiningDraft"
            @click.stop.prevent="joinDraft"
          >
            <LogIn class="h-3 w-3" />
            {{ $t("matchmaking.friends.join") }}
          </Button>
        </div>
      </div>
    </ContextMenuTrigger>

    <ContextMenuContent
      v-if="isFriend || canInviteToDraft"
      data-right-hub-interactive
      class="w-56"
    >
      <ContextMenuItem
        v-if="canInviteToDraft"
        @click="inviteToDraft"
      >
        <Swords class="mr-2 h-4 w-4" />
        <span>{{ $t("draft_games.room.invite_to_draft") }}</span>
      </ContextMenuItem>
      <ContextMenuItem
        v-if="isFriend"
        class="text-destructive"
        @click="removeFriend(player.steam_id)"
      >
        <Trash2 class="mr-2 h-4 w-4" />
        <span>{{ $t("matchmaking.friends.remove") }}</span>
      </ContextMenuItem>
    </ContextMenuContent>
    </ContextMenu>
  </div>
</template>
