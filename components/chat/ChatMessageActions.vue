<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { MoreVertical, Pencil, SmilePlus, Trash2 } from "lucide-vue-next";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { CHAT_REACTIONS, type ChatReaction } from "~/constants/chat";
import socket, { type ChatType, type LobbyMessage } from "~/web-sockets/Socket";
import {
  chatErrorFailed,
  toastChatError,
  type ChatError,
} from "~/utilities/chatErrors";
import {
  canToggleChatReaction,
  heldChatReactions,
  type ChatMessagePermissions,
} from "~/utilities/chatMessageActions";
import { tacticalFilterPillActiveClasses } from "~/utilities/tacticalClasses";

const props = defineProps<{
  message: LobbyMessage;
  // The room the message is in, which on a merged match panel is not always
  // the room the panel was opened for.
  room: { type: ChatType; id: string };
  permissions: ChatMessagePermissions;
  own?: boolean;
  viewerSteamId?: string | null;
}>();

const emit = defineEmits<{
  open: [];
  expired: [];
  edit: [];
  react: [reaction: ChatReaction];
}>();

const triggerRef = ref<{ $el?: HTMLElement } | null>(null);

defineExpose({
  focusTrigger() {
    triggerRef.value?.$el?.focus();
  },
});

const menuOpen = ref(false);
const confirmDelete = ref(false);
const pickerOpen = ref(false);
let pickerRequested = false;

// Before the menu renders, so the row re-checks the ten minute window against
// the clock now rather than when the line first rendered.
function setMenuOpen(open: boolean) {
  if (open) {
    pickerRequested = false;
    emit("open");
  }

  menuOpen.value = open;
}

// The menu and what opens from it sit over the right hub, which closes itself
// when the pointer leaves. All count as still interacting with it. The row can
// unmount this before a watcher sees the menu open, so only locks actually
// taken are released.
type HubHold = "menu" | "confirm" | "picker";

const hubHolds = new Set<HubHold>();

function holdRightHub(hold: HubHold, open: boolean) {
  if (open && !hubHolds.has(hold)) {
    hubHolds.add(hold);
    useRightSidebar().suspendHoverClose();
  } else if (!open && hubHolds.delete(hold)) {
    useRightSidebar().resumeHoverClose();
  }
}

watch(menuOpen, (open) => holdRightHub("menu", open));
watch(confirmDelete, (open) => holdRightHub("confirm", open));
watch(pickerOpen, (open) => holdRightHub("picker", open));

onBeforeUnmount(() => {
  holdRightHub("menu", false);
  holdRightHub("confirm", false);
  holdRightHub("picker", false);
});

// The picker opens once the menu has finished closing. Opened any sooner, the
// menu hands focus back to the trigger, which reads as a click outside the
// picker and closes it again.
function menuClosedFocus(event: Event) {
  if (!pickerRequested) {
    return;
  }

  pickerRequested = false;
  event.preventDefault();
  pickerOpen.value = true;
}

const heldReactions = computed(() =>
  heldChatReactions(props.message, props.viewerSteamId),
);

const pickerChoices = computed(() =>
  CHAT_REACTIONS.map(({ id, glyph }) => {
    const mine = heldReactions.value.has(id);

    return {
      id,
      glyph,
      mine,
      disabled: !canToggleChatReaction(props.permissions, mine),
    };
  }),
);

function pickReaction(reaction: ChatReaction) {
  pickerOpen.value = false;
  emit("react", reaction);
}

// Back to the trigger unless the picker was closed by clicking somewhere else,
// where that click decides focus.
let pickerDismissedOutside = false;

function pickerClosedFocus(event: Event) {
  event.preventDefault();

  if (!pickerDismissedOutside) {
    triggerRef.value?.$el?.focus();
  }

  pickerDismissedOutside = false;
}

async function deleteMessage() {
  if (!props.message?.id) {
    return;
  }

  try {
    await socket.deleteMessage(
      props.room.type,
      props.room.id,
      props.message.id,
    );
    confirmDelete.value = false;
  } catch (error) {
    toastChatError(error as ChatError);

    if ((error as ChatError)?.code === "window_closed") {
      confirmDelete.value = false;
      emit("expired");
      return;
    }

    if (!chatErrorFailed(error as ChatError)) {
      confirmDelete.value = false;
    }
  }
}
</script>

<template>
  <div
    class="opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/chat-message:opacity-100 has-[[data-state=open]]:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
  >
    <!-- The picker hangs off the trigger without being opened by it: the
         trigger already belongs to the menu. -->
    <Popover v-model:open="pickerOpen">
      <PopoverAnchor as-child>
        <span
          class="inline-flex"
          :data-state="pickerOpen ? 'open' : 'closed'"
        >
          <DropdownMenu
            :open="menuOpen"
            :modal="false"
            @update:open="setMenuOpen"
          >
            <DropdownMenuTrigger as-child>
              <Button
                ref="triggerRef"
                variant="ghost"
                size="icon"
                class="h-6 w-6 text-muted-foreground hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))] [&_svg]:size-3.5"
                :aria-label="$t('chat.message_actions')"
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              class="w-48"
              data-right-hub-interactive
              @close-auto-focus="menuClosedFocus"
            >
              <DropdownMenuItem
                v-if="permissions.canReact"
                @select="pickerRequested = true"
              >
                <SmilePlus />
                <span>{{ $t("chat.add_reaction") }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="permissions.canEdit"
                @select="emit('edit')"
              >
                <Pencil />
                <span>{{ $t("chat.edit_message") }}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator
                v-if="
                  (permissions.canReact || permissions.canEdit) &&
                  permissions.canDelete
                "
              />
              <DropdownMenuItem
                v-if="permissions.canDelete"
                class="text-destructive focus:text-destructive"
                @select="confirmDelete = true"
              >
                <Trash2 />
                <span>{{ $t("chat.delete_message") }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </PopoverAnchor>
      <PopoverContent
        align="end"
        class="w-auto p-1"
        data-right-hub-interactive
        @interact-outside="pickerDismissedOutside = true"
        @close-auto-focus="pickerClosedFocus"
      >
        <div
          role="group"
          :aria-label="$t('chat.react')"
          class="grid grid-cols-6 gap-0.5"
        >
          <button
            v-for="choice in pickerChoices"
            :key="choice.id"
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-base leading-none transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent motion-reduce:transition-none"
            :class="choice.mine ? tacticalFilterPillActiveClasses : ''"
            :aria-pressed="choice.mine"
            :aria-label="$t('chat.react_with', { emoji: choice.glyph })"
            :disabled="choice.disabled"
            :data-reaction="choice.id"
            @click="pickReaction(choice.id)"
          >
            {{ choice.glyph }}
          </button>
        </div>
        <p
          v-if="!permissions.canAddReaction"
          class="mt-1 max-w-[13rem] px-1 pb-0.5 text-[10px] leading-snug text-muted-foreground"
        >
          {{ $t("chat.react_gagged") }}
        </p>
      </PopoverContent>
    </Popover>

    <AlertDialog v-model:open="confirmDelete">
      <AlertDialogContent data-right-hub-interactive>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("chat.delete_confirm_title") }}
          </AlertDialogTitle>
          <AlertDialogDescription v-if="own">
            {{ $t("chat.delete_own_confirm_description") }}
          </AlertDialogDescription>
          <AlertDialogDescription v-else>
            {{
              $t("chat.delete_confirm_description", {
                name: message.from?.name || $t("common.unknown"),
              })
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <!-- The overlay hides the chat, so the line being removed is repeated
             here rather than left to memory. -->
        <blockquote
          class="line-clamp-3 whitespace-pre-wrap break-words rounded-md border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground"
        >
          {{ message.message }}
        </blockquote>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
          <Button variant="destructive" @click="deleteMessage">
            {{ $t("common.delete") }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
