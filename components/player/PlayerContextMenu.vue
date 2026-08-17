<script lang="ts" setup>
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import {
  User,
  MessageSquare,
  Tent,
  UserPlus,
  Check,
  X,
  Trash2,
  Copy,
} from "lucide-vue-next";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import { useFriendActions } from "~/composables/useFriendActions";
import { toast } from "~/components/ui/toast";

// Cursor-anchored, not trigger-anchored: the caller owns the contextmenu event
// and hands us the point it happened at. A zero-size fixed span teleported to
// <body> is the anchor, which is what keeps this menu out of the caller's DOM
// entirely -- PlayerDisplay renders inside as-child tooltip triggers and
// <TransitionGroup> lists where an extra wrapper (or a fragment root) breaks
// layout or animation.
const props = defineProps<{
  player: Record<string, any>;
  x: number;
  y: number;
  open: boolean;
}>();

const emit = defineEmits<{
  (event: "update:open", value: boolean): void;
}>();

const { t } = useI18n();

const {
  relationship,
  isBusy,
  addFriend,
  acceptFriend,
  declineFriend,
  cancelRequest,
  removeFriend,
  inviteToLobby,
} = useFriendActions();

const { canMessage, openConversation } = useDirectMessages();

const steamId = computed(() =>
  props.player?.steam_id ? String(props.player.steam_id) : null,
);

const me = computed(() => useAuthStore().me);

const isMe = computed(
  () => !!me.value && steamId.value === String(me.value.steam_id),
);

const rel = computed(() =>
  steamId.value ? relationship(steamId.value) : "none",
);

const busy = computed(() => (steamId.value ? isBusy(steamId.value) : false));

const currentLobby = computed(() =>
  useMatchmakingStore().lobbies?.find(
    (lobby: any) => lobby.id === me.value?.current_lobby_id,
  ),
);

const canInviteToLobby = computed(() => {
  if (!me.value || isMe.value || !steamId.value) {
    return false;
  }

  const lobby = currentLobby.value as any;

  return (
    !lobby ||
    !lobby.players?.find(
      (player: any) => String(player.player.steam_id) === steamId.value,
    )
  );
});

const showFriendActions = computed(
  () => !!me.value && !isMe.value && !!steamId.value,
);

// Same rule as the friends list: a mis-click here has no undo.
const confirmRemove = ref(false);

// The menu (and the confirm that follows it) live over the right hub, which
// closes itself when the pointer leaves. Both count as "still interacting".
function holdRightHub(open: boolean, wasOpen: boolean) {
  const rightSidebar = useRightSidebar();

  if (open && !wasOpen) {
    rightSidebar.suspendHoverClose();
  } else if (!open && wasOpen) {
    rightSidebar.resumeHoverClose();
  }
}

watch(() => props.open, holdRightHub);
watch(confirmRemove, holdRightHub);

onBeforeUnmount(() => {
  if (props.open || confirmRemove.value) {
    useRightSidebar().resumeHoverClose();
  }
});

// Every friend action takes the steam id, and the template can't assert it is
// set -- so they all go through here.
function withSteamId(action: (steamId: string) => unknown) {
  return () => {
    if (!steamId.value) {
      return;
    }

    action(steamId.value);
  };
}

const invite = withSteamId(inviteToLobby);
const add = withSteamId(addFriend);
const accept = withSteamId(acceptFriend);
const decline = withSteamId(declineFriend);
const cancel = withSteamId(cancelRequest);
const remove = withSteamId(removeFriend);

function goToProfile() {
  if (!steamId.value) {
    return;
  }

  navigateTo({ name: "players-id", params: { id: steamId.value } });
}

function message() {
  if (!steamId.value) {
    return;
  }

  openConversation({
    steam_id: steamId.value,
    name: props.player.name,
    avatar_url: props.player.avatar_url,
  });
}

async function copySteamId() {
  if (!steamId.value || !navigator.clipboard?.writeText) {
    return;
  }

  await navigator.clipboard.writeText(steamId.value);

  toast({ title: t("player.context_menu.steam_id_copied") });
}

function openSteamProfile() {
  window.open(props.player.profile_url, "_blank", "noopener");
}
</script>

<template>
  <Teleport to="body">
    <DropdownMenu
      :open="open"
      :modal="false"
      @update:open="emit('update:open', $event)"
    >
      <DropdownMenuTrigger as-child>
        <span
          aria-hidden="true"
          class="pointer-events-none fixed block h-0 w-0"
          :style="{ left: `${x}px`, top: `${y}px` }"
        ></span>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        :side-offset="2"
        :collision-padding="8"
        data-right-hub-interactive
        class="w-56"
      >
        <DropdownMenuLabel class="truncate">
          {{ player.name }}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem @select="goToProfile">
          <User />
          <span>{{ $t("player.context_menu.view_profile") }}</span>
        </DropdownMenuItem>

        <DropdownMenuItem v-if="canMessage(steamId)" @select="message">
          <MessageSquare />
          <span>{{ $t("chat.direct.message") }}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          v-if="canInviteToLobby"
          :disabled="busy"
          @select="invite"
        >
          <Tent />
          <span>{{ $t("matchmaking.friends.invite_to_lobby") }}</span>
        </DropdownMenuItem>

        <template v-if="showFriendActions">
          <DropdownMenuSeparator />

          <DropdownMenuItem
            v-if="rel === 'none'"
            :disabled="busy"
            @select="add"
          >
            <UserPlus />
            <span>{{ $t("player.status.add_friend") }}</span>
          </DropdownMenuItem>

          <template v-else-if="rel === 'incoming'">
            <DropdownMenuItem :disabled="busy" @select="accept">
              <Check />
              <span>{{ $t("matchmaking.friends.accept") }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              class="text-destructive focus:text-destructive"
              :disabled="busy"
              @select="decline"
            >
              <X />
              <span>{{ $t("matchmaking.friends.decline") }}</span>
            </DropdownMenuItem>
          </template>

          <DropdownMenuItem
            v-else-if="rel === 'outgoing'"
            class="text-destructive focus:text-destructive"
            :disabled="busy"
            @select="cancel"
          >
            <X />
            <span>{{ $t("matchmaking.friends.cancel_request") }}</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            v-else
            class="text-destructive focus:text-destructive"
            :disabled="busy"
            @select="confirmRemove = true"
          >
            <Trash2 />
            <span>{{ $t("matchmaking.friends.remove") }}</span>
          </DropdownMenuItem>
        </template>

        <DropdownMenuSeparator />

        <DropdownMenuItem @select="copySteamId">
          <Copy />
          <span>{{ $t("player.context_menu.copy_steam_id") }}</span>
        </DropdownMenuItem>

        <DropdownMenuItem v-if="player.profile_url" @select="openSteamProfile">
          <SteamIcon class="size-4 fill-current" />
          <span>{{ $t("ui.tooltips.view_steam_profile") }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <AlertDialog v-model:open="confirmRemove">
      <AlertDialogContent data-right-hub-interactive>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("matchmaking.friends.remove_confirm_title") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{
              $t("matchmaking.friends.remove_confirm_description", {
                name: player.name,
              })
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="remove"
          >
            {{ $t("matchmaking.friends.remove") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Teleport>
</template>
