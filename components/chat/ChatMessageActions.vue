<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { MoreVertical, Trash2 } from "lucide-vue-next";
import { useRightSidebar } from "~/composables/useRightSidebar";
import socket, { type ChatType, type LobbyMessage } from "~/web-sockets/Socket";
import { toastChatError, type ChatError } from "~/utilities/chatErrors";
import type { ChatMessagePermissions } from "~/utilities/chatMessageActions";

const props = defineProps<{
  message: LobbyMessage;
  // The room the message is in, which on a merged match panel is not always
  // the room the panel was opened for.
  room: { type: ChatType; id: string };
  permissions: ChatMessagePermissions;
}>();

const menuOpen = ref(false);
const confirmDelete = ref(false);

// The menu and the confirm after it sit over the right hub, which closes itself
// when the pointer leaves. Both count as still interacting with it.
function holdRightHub(open: boolean, wasOpen: boolean) {
  const rightSidebar = useRightSidebar();

  if (open && !wasOpen) {
    rightSidebar.suspendHoverClose();
  } else if (!open && wasOpen) {
    rightSidebar.resumeHoverClose();
  }
}

watch(menuOpen, holdRightHub);
watch(confirmDelete, holdRightHub);

onBeforeUnmount(() => {
  for (const open of [menuOpen.value, confirmDelete.value]) {
    if (open) {
      useRightSidebar().resumeHoverClose();
    }
  }
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
  }
}
</script>

<template>
  <div
    class="opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/chat-message:opacity-100 has-[[data-state=open]]:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
  >
    <DropdownMenu v-model:open="menuOpen" :modal="false">
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
      <DropdownMenuContent align="end" class="w-48" data-right-hub-interactive>
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
          <AlertDialogDescription>
            {{ $t("chat.delete_confirm_description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
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
