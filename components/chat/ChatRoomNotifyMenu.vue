<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Bell, BellOff } from "lucide-vue-next";
import {
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "~/components/ui/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "~/components/ui/dropdown-menu";
import {
  chatRoomMutedLabel,
  chatRoomQuiet,
  muteChatRoom,
  setChatRoomNotify,
  unmuteChatRoom,
  useChatRoomSettings,
} from "~/composables/useChatRoomSettings";
import {
  CHAT_MUTE_DURATIONS,
  CHAT_NOTIFY_LEVELS,
  type ChatNotifyLevel,
} from "~/utilities/chatRoomSettings";

// The room's own notification controls, for whichever menu it sits in: the
// rail and the dock open a context menu, the room header a dropdown. Only the
// player's own pushes, sounds and badges change; nobody else sees a thing.
const props = withDefaults(
  defineProps<{
    type: string;
    lobbyId: string;
    kind?: "context" | "dropdown";
    // A divider under the controls, for a menu that carries more below them.
    separated?: boolean;
  }>(),
  { kind: "dropdown", separated: false },
);

const { t } = useI18n();
const { supported } = useChatRoomSettings();

const menu = computed(() =>
  props.kind === "context"
    ? {
        Item: ContextMenuItem,
        RadioGroup: ContextMenuRadioGroup,
        RadioItem: ContextMenuRadioItem,
        Separator: ContextMenuSeparator,
        Sub: ContextMenuSub,
        SubContent: ContextMenuSubContent,
        SubTrigger: ContextMenuSubTrigger,
      }
    : {
        Item: DropdownMenuItem,
        RadioGroup: DropdownMenuRadioGroup,
        RadioItem: DropdownMenuRadioItem,
        Separator: DropdownMenuSeparator,
        Sub: DropdownMenuSub,
        SubContent: DropdownMenuSubContent,
        SubTrigger: DropdownMenuSubTrigger,
      },
);

const quiet = computed(() => chatRoomQuiet(props.type, props.lobbyId));

// A conversation has no tags in it, so there is nothing to choose between.
const offersLevels = computed(() => props.type !== "direct");

const isConversation = computed(() => props.type === "direct");

const mutedLabel = computed(() =>
  chatRoomMutedLabel(quiet.value, (key, params) => t(key, params ?? {})),
);

function durationLabel(minutes: number | null) {
  switch (minutes) {
    case 15:
      return t("chat.room_settings.mute_for.minutes_15");
    case 60:
      return t("chat.room_settings.mute_for.hour_1");
    case 480:
      return t("chat.room_settings.mute_for.hours_8");
    case 1440:
      return t("chat.room_settings.mute_for.hours_24");
    default:
      return t("chat.room_settings.mute_for.until_unmuted");
  }
}

function levelLabel(level: ChatNotifyLevel) {
  return t(`chat.room_settings.notify.${level}`);
}

// The api toasts a write it refused, and the room is put back as it was.
function settle(write: Promise<unknown>) {
  write.catch(() => {});
}

function mute(minutes: number | null) {
  settle(muteChatRoom(props.type, props.lobbyId, minutes));
}

function unmute() {
  settle(unmuteChatRoom(props.type, props.lobbyId));
}

function setLevel(level: unknown) {
  if (
    typeof level !== "string" ||
    !CHAT_NOTIFY_LEVELS.includes(level as ChatNotifyLevel) ||
    level === quiet.value.notify
  ) {
    return;
  }

  settle(
    setChatRoomNotify(props.type, props.lobbyId, level as ChatNotifyLevel),
  );
}
</script>

<template>
  <template v-if="supported">
    <component
      :is="menu.Item"
      v-if="quiet.muted"
      data-chat-room-unmute
      class="flex-col items-start gap-0.5"
      @select="unmute"
    >
      <span class="flex items-center gap-2">
        <Bell class="size-3.5 shrink-0" />
        {{
          isConversation
            ? $t("chat.room_settings.unmute_conversation")
            : $t("chat.room_settings.unmute_room")
        }}
      </span>
      <span
        v-if="mutedLabel"
        class="pl-[1.375rem] text-[11px] text-muted-foreground"
      >
        {{ mutedLabel }}
      </span>
    </component>
    <component :is="menu.Sub" v-else>
      <component :is="menu.SubTrigger" data-chat-room-mute>
        <BellOff class="mr-2 size-3.5 shrink-0" />
        {{
          isConversation
            ? $t("chat.room_settings.mute_conversation")
            : $t("chat.room_settings.mute_room")
        }}
      </component>
      <component :is="menu.SubContent" data-right-hub-interactive>
        <component
          :is="menu.Item"
          v-for="minutes in CHAT_MUTE_DURATIONS"
          :key="minutes ?? 'until-unmuted'"
          :data-chat-room-mute-for="minutes ?? 'until-unmuted'"
          @select="mute(minutes)"
        >
          {{ durationLabel(minutes) }}
        </component>
      </component>
    </component>

    <component :is="menu.Sub" v-if="offersLevels">
      <component :is="menu.SubTrigger" data-chat-room-notify>
        {{ $t("chat.room_settings.notify_me_about") }}
        <span class="ml-auto pl-3 text-xs text-muted-foreground">
          {{ levelLabel(quiet.notify) }}
        </span>
      </component>
      <component :is="menu.SubContent" data-right-hub-interactive>
        <component
          :is="menu.RadioGroup"
          :model-value="quiet.notify"
          @update:model-value="setLevel"
        >
          <component
            :is="menu.RadioItem"
            v-for="level in CHAT_NOTIFY_LEVELS"
            :key="level"
            :value="level"
            :data-chat-room-notify-level="level"
          >
            {{ levelLabel(level) }}
          </component>
        </component>
      </component>
    </component>

    <component :is="menu.Separator" v-if="separated" />
  </template>
</template>
