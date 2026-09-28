<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { MoreVertical, Pencil, Trash2 } from "lucide-vue-next";
import { useRightSidebar } from "~/composables/useRightSidebar";
import socket, { type ChatType, type LobbyMessage } from "~/web-sockets/Socket";
import {
  chatErrorFailed,
  toastChatError,
  type ChatError,
} from "~/utilities/chatErrors";
import type { ChatMessagePermissions } from "~/utilities/chatMessageActions";

const props = defineProps<{
  message: LobbyMessage;
  // The room the message is in, which on a merged match panel is not always
  // the room the panel was opened for.
  room: { type: ChatType; id: string };
  permissions: ChatMessagePermissions;
  own?: boolean;
}>();

const emit = defineEmits<{
  open: [];
  edit: [];
}>();

const menuOpen = ref(false);
const confirmDelete = ref(false);
const editRequested = ref(false);

// Before the menu renders, so the row re-checks the ten minute window against
// the clock now rather than when the line first rendered.
function setMenuOpen(open: boolean) {
  if (open) {
    editRequested.value = false;
    emit("open");
  }

  menuOpen.value = open;
}

function startEdit() {
  editRequested.value = true;
  emit("edit");
}

// The editor takes focus as it mounts; handing it back to the trigger would
// pull it straight out again.
function onCloseAutoFocus(event: Event) {
  if (editRequested.value) {
    event.preventDefault();
  }
}

// The menu and the confirm after it sit over the right hub, which closes itself
// when the pointer leaves. Both count as still interacting with it. The row can
// unmount this before a watcher sees the menu open, so only locks actually
// taken are released.
const hubHolds = new Set<"menu" | "confirm">();

function holdRightHub(hold: "menu" | "confirm", open: boolean) {
  if (open && !hubHolds.has(hold)) {
    hubHolds.add(hold);
    useRightSidebar().suspendHoverClose();
  } else if (!open && hubHolds.delete(hold)) {
    useRightSidebar().resumeHoverClose();
  }
}

watch(menuOpen, (open) => holdRightHub("menu", open));
watch(confirmDelete, (open) => holdRightHub("confirm", open));

onBeforeUnmount(() => {
  holdRightHub("menu", false);
  holdRightHub("confirm", false);
});

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

    if (
      !chatErrorFailed(error as ChatError) ||
      (error as ChatError)?.code === "window_closed"
    ) {
      confirmDelete.value = false;
    }
  }
}
</script>

<template>
  <div
    class="opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/chat-message:opacity-100 has-[[data-state=open]]:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
  >
    <DropdownMenu :open="menuOpen" :modal="false" @update:open="setMenuOpen">
      <DropdownMenuTrigger as-child>
        <Button
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
        @close-auto-focus="onCloseAutoFocus"
      >
        <DropdownMenuItem v-if="permissions.canEdit" @select="startEdit">
          <Pencil />
          <span>{{ $t("chat.edit_message") }}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator
          v-if="permissions.canEdit && permissions.canDelete"
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
