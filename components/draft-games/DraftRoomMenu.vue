<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import {
  Link2,
  MoreVertical,
  Pencil,
  RotateCw,
  XCircle,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { serverNow } from "~/stores/ServerClockStore";
import { clockLabel } from "~/components/draft-games/draftRoomHeader";

// The header's menu until the match exists and MatchActions takes its place.
// In the lobby it also holds the host's room tools.
const props = withDefaults(
  defineProps<{
    edit?: boolean;
    invite?: boolean;
    // When the room closes, for "Keep open"; without it there is nothing to
    // keep open.
    closesAt?: string | null;
    large?: boolean;
  }>(),
  { edit: false, invite: false, closesAt: null, large: false },
);

const emit = defineEmits<{
  (event: "cancel"): void;
  (event: "edit"): void;
  (event: "extend"): void;
  (event: "copy-invite"): void;
}>();

const open = ref(false);

// Only ticks while the menu is open, the one place the time shows.
const now = ref(serverNow());
let timer: ReturnType<typeof setInterval> | undefined;
watch(open, (isOpen) => {
  clearInterval(timer);
  if (!isOpen) {
    return;
  }
  now.value = serverNow();
  timer = setInterval(() => {
    now.value = serverNow();
  }, 1000);
});
onUnmounted(() => clearInterval(timer));

const closesIn = computed(() =>
  props.closesAt
    ? clockLabel(
        Math.max(
          0,
          Math.floor((new Date(props.closesAt).getTime() - now.value) / 1000),
        ),
      )
    : null,
);
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <Button :size="large ? 'icon-lg' : 'icon'" variant="outline">
        <MoreVertical class="h-3.5 w-3.5" />
        <span class="sr-only">{{ $t("common.more") }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem v-if="edit" @click="emit('edit')">
        <Pencil />
        {{ $t("draft_games.room.edit_settings") }}
      </DropdownMenuItem>
      <DropdownMenuItem v-if="invite" @click="emit('copy-invite')">
        <Link2 />
        {{ $t("draft_games.room.copy_invite") }}
      </DropdownMenuItem>
      <DropdownMenuItem v-if="closesIn" @click="emit('extend')">
        <RotateCw class="self-start mt-0.5" />
        <span class="grid gap-0.5">
          {{ $t("draft_games.room.extend") }}
          <i18n-t
            keypath="draft_games.room.closes_in"
            tag="span"
            class="text-xs text-muted-foreground"
          >
            <template #time>
              <span class="tabular-nums">{{ closesIn }}</span>
            </template>
          </i18n-t>
        </span>
      </DropdownMenuItem>
      <DropdownMenuSeparator v-if="edit || invite || closesIn" />
      <DropdownMenuItem class="text-destructive" @click="emit('cancel')">
        <XCircle />
        {{ $t("draft_games.room.cancel_draft") }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
