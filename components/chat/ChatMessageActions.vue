<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useMediaQuery } from "@vueuse/core";
import {
  Ban,
  BellOff,
  Copy,
  MessageSquareOff,
  MicOff,
  MoreHorizontal,
  Pencil,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import SanctionPlayer from "~/components/SanctionPlayer.vue";
import ChatReactionMenuStrip from "~/components/chat/ChatReactionMenuStrip.vue";
import ChatReactionPicker from "~/components/chat/ChatReactionPicker.vue";
import { useRightSidebar } from "~/composables/useRightSidebar";
import type { ChatReaction } from "~/constants/chat";
import socket, { type ChatType, type LobbyMessage } from "~/web-sockets/Socket";
import { toast } from "@/components/ui/toast";
import {
  chatErrorFailed,
  toastChatError,
  type ChatError,
} from "~/utilities/chatErrors";
import {
  chatReactionChoices,
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
  // The pointer is over the line. Only then, or with keyboard focus in it, is
  // the whole toolbar rendered -- one per chat, not one per line.
  hovered?: boolean;
}>();

const emit = defineEmits<{
  open: [];
  expired: [];
  edit: [];
  react: [reaction: ChatReaction];
}>();

const { t } = useI18n();

const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<{ $el?: HTMLElement } | null>(null);

const menuOpen = ref(false);
const pickerOpen = ref(false);
const confirmDelete = ref(false);
const sanctionOpen = ref(false);
const sanctionType = ref<string>();

function startSanction(type: string) {
  sanctionType.value = type;
  sanctionOpen.value = true;
}

// Reactions live on the hover toolbar. A touch screen never gets it, so there
// they stay in the menu -- the only way in.
const canHover = useMediaQuery("(hover: hover)");

// Mildest first, so the one a moderator reaches for most sits at the top.
const sanctionTypes = [
  { type: "warning", icon: TriangleAlert },
  { type: "gag", icon: MessageSquareOff },
  { type: "mute", icon: MicOff },
  { type: "silence", icon: BellOff },
  { type: "ban", icon: Ban },
];

// Keyboard focus only. Focus handed back to a trigger after a menu closed under
// the mouse would otherwise pin the toolbar open after the pointer has gone.
const keyboardFocused = ref(false);

function onFocusIn(event: FocusEvent) {
  keyboardFocused.value = (event.target as HTMLElement).matches(
    ":focus-visible",
  );
}

function onFocusOut(event: FocusEvent) {
  if (!rootRef.value?.contains(event.relatedTarget as Node | null)) {
    keyboardFocused.value = false;
  }
}

const expanded = computed(
  () =>
    props.hovered ||
    keyboardFocused.value ||
    menuOpen.value ||
    pickerOpen.value,
);

// Before the menu renders, so the row re-checks the ten minute window against
// the clock now rather than when the line first rendered.
function setMenuOpen(open: boolean) {
  if (open) {
    emit("open");
  }

  menuOpen.value = open;
}

defineExpose({
  focusTrigger() {
    triggerRef.value?.$el?.focus();
  },
});

// The menu, the confirm and the sanction drawer sit over the right hub, which
// closes itself when the pointer leaves. All count as still interacting with
// it. The row can unmount this before a watcher sees a menu open, so only locks
// actually taken are released. The picker holds it itself.
type HubHold = "menu" | "confirm" | "sanction";

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
watch(sanctionOpen, (open) => holdRightHub("sanction", open));

onBeforeUnmount(() => {
  holdRightHub("menu", false);
  holdRightHub("confirm", false);
  holdRightHub("sanction", false);
});

const reactionChoices = computed(() =>
  chatReactionChoices(props.message, props.viewerSteamId, props.permissions),
);

// Three on the toolbar itself; the picker has them all.
const quickReactions = computed(() => reactionChoices.value.slice(0, 3));

const toolClasses =
  "h-6 w-6 rounded-sm text-muted-foreground hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))] [&_svg]:size-3.5";

const quickReactionClasses =
  "inline-flex h-6 w-6 items-center justify-center rounded-sm border border-transparent text-sm leading-none transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent motion-reduce:transition-none";

// Closed here rather than a tick later by the item, so the second click of a
// double click can't take the reaction straight back.
function react(reaction: ChatReaction) {
  if (!menuOpen.value) {
    return;
  }

  menuOpen.value = false;
  emit("react", reaction);
}

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(props.message.message);
    toast({ title: t("pages.toasts.copied_to_clipboard") });
  } catch {
    toast({ title: t("toasts.copy_failed"), variant: "destructive" });
  }
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
    ref="rootRef"
    class="transition-opacity motion-reduce:transition-none"
    :class="
      expanded
        ? 'opacity-100 duration-150 ease-out'
        : 'opacity-0 duration-100 ease-in [@media(hover:none)]:opacity-100'
    "
    :data-chat-menu-open="menuOpen || pickerOpen ? '' : undefined"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <!-- Fades as one piece at its full size: the buttons stay mounted until the
         fade out has finished, so the frame never visibly shrinks. The frame is
         dropped where nothing hovers: a touch screen only ever gets the bare
         menu trigger, on every line, as before. -->
    <div
      class="flex items-center gap-px rounded-md border border-border bg-popover p-0.5 shadow-md [@media(hover:none)]:translate-y-1 [@media(hover:none)]:border-transparent [@media(hover:none)]:bg-transparent [@media(hover:none)]:shadow-none"
    >
      <Transition
        leave-active-class="transition-opacity duration-100 ease-in motion-reduce:transition-none"
        leave-to-class="opacity-0"
      >
        <div v-if="expanded" class="flex items-center gap-px">
          <template v-if="permissions.canReact">
            <button
              v-for="choice in quickReactions"
              :key="choice.id"
              type="button"
              :class="[
                quickReactionClasses,
                choice.mine ? tacticalFilterPillActiveClasses : '',
              ]"
              :aria-pressed="choice.mine"
              :aria-label="$t('chat.react_with', { emoji: choice.glyph })"
              :disabled="choice.disabled"
              :data-quick-reaction="choice.id"
              @click="emit('react', choice.id)"
            >
              <span aria-hidden="true">{{ choice.glyph }}</span>
            </button>
            <span aria-hidden="true" class="mx-0.5 h-4 w-px bg-border"></span>
            <ChatReactionPicker
              v-model:open="pickerOpen"
              :choices="reactionChoices"
              :gagged="!permissions.canAddReaction"
              :trigger-class="toolClasses"
              @react="emit('react', $event)"
            />
          </template>
          <FiveStackToolTip
            v-if="permissions.canEdit"
            as-child
            side="top"
            :delay-duration="120"
            :tap-toggle="false"
          >
            <template #trigger>
              <Button
                variant="ghost"
                size="icon"
                :class="toolClasses"
                :aria-label="$t('chat.edit_message')"
                @click="emit('edit')"
              >
                <Pencil />
              </Button>
            </template>
            {{ $t("chat.edit_message") }}
          </FiveStackToolTip>
        </div>
      </Transition>

      <DropdownMenu :open="menuOpen" :modal="false" @update:open="setMenuOpen">
        <DropdownMenuTrigger as-child>
          <Button
            ref="triggerRef"
            variant="ghost"
            size="icon"
            :class="toolClasses"
            :aria-label="$t('chat.message_actions')"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          :collision-padding="8"
          class="w-48"
          data-right-hub-interactive
        >
          <template v-if="permissions.canReact && !canHover">
            <ChatReactionMenuStrip
              :choices="reactionChoices"
              :gagged="!permissions.canAddReaction"
              @react="react"
            />
            <DropdownMenuSeparator />
          </template>
          <DropdownMenuItem @select="copyMessage">
            <Copy />
            <span>{{ $t("chat.copy_message") }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem v-if="permissions.canEdit" @select="emit('edit')">
            <Pencil />
            <span>{{ $t("chat.edit_message") }}</span>
          </DropdownMenuItem>
          <template v-if="permissions.canSanction || permissions.canDelete">
            <DropdownMenuSeparator />
            <DropdownMenuSub v-if="permissions.canSanction">
              <DropdownMenuSubTrigger>
                <ShieldAlert class="size-4 shrink-0" />
                <span class="truncate">
                  {{
                    $t("chat.moderate_player", {
                      name: message.from?.name || $t("common.unknown"),
                    })
                  }}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent class="w-40">
                <DropdownMenuItem
                  v-for="sanction in sanctionTypes"
                  :key="sanction.type"
                  :class="
                    sanction.type === 'ban'
                      ? 'text-destructive focus:text-destructive'
                      : ''
                  "
                  :data-sanction="sanction.type"
                  @select="startSanction(sanction.type)"
                >
                  <component :is="sanction.icon" />
                  <span>
                    {{ $t(`player.sanctions.type_labels.${sanction.type}`) }}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              v-if="permissions.canDelete"
              class="text-destructive focus:text-destructive"
              @select="confirmDelete = true"
            >
              <Trash2 />
              <span>{{ $t("chat.delete_message") }}</span>
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <SanctionPlayer
      v-if="permissions.canSanction && message.from"
      v-model:open="sanctionOpen"
      variant="none"
      :preset-type="sanctionType"
      :player="message.from"
    />

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
