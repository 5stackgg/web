<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronDown, Globe, Lock, Send, UserCheck } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { e_lobby_access_enum } from "~/generated/zeus";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";

const props = defineProps<{
  room: any;
}>();

const OPTIONS = [
  { value: e_lobby_access_enum.Open, icon: Globe, key: "open" },
  { value: e_lobby_access_enum.Friends, icon: UserCheck, key: "friends" },
  { value: e_lobby_access_enum.Invite, icon: Send, key: "invite" },
  { value: e_lobby_access_enum.Private, icon: Lock, key: "private" },
];

// The pick shows straight away; the room's subscription confirms it, and a
// refused write (already toasted) falls back to what the room says.
const pending = ref<e_lobby_access_enum | null>(null);

const current = computed(
  () =>
    OPTIONS.find(
      (option) => option.value === (pending.value ?? props.room.access),
    ) ?? OPTIONS[0],
);

const choose = async (value: unknown) => {
  const access = value as e_lobby_access_enum;
  if (pending.value || access === props.room.access) {
    return;
  }
  pending.value = access;
  try {
    await useDraftGamesStore().setAccess(props.room.id, access);
  } catch {
  } finally {
    pending.value = null;
  }
};
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="lg" class="gap-2 px-3">
        <Spinner v-if="pending" class="size-4" />
        <component :is="current.icon" v-else class="size-4" />
        <span class="sr-only">{{ $t("draft_games.create.access") }}:</span>
        {{ $t(`draft_games.access.${current.key}`) }}
        <ChevronDown class="size-3.5 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-72">
      <DropdownMenuLabel>{{
        $t("draft_games.create.access")
      }}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        :model-value="current.value"
        @update:model-value="choose"
      >
        <DropdownMenuRadioItem
          v-for="option in OPTIONS"
          :key="option.value"
          :value="option.value"
          class="items-start"
        >
          <span class="grid gap-0.5">
            <span class="inline-flex items-center gap-2 font-medium">
              <component :is="option.icon" class="size-3.5" />
              {{ $t(`draft_games.access.${option.key}`) }}
            </span>
            <span class="text-xs text-muted-foreground [text-wrap:pretty]">
              {{ $t(`draft_games.access.${option.key}_desc`) }}
            </span>
          </span>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
