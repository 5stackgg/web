<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Copy, History, MoreVertical, User } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import { toast } from "@/components/ui/toast";

const props = defineProps<{
  steamId: string;
  name: string;
  hasAccount: boolean;
}>();

const emit = defineEmits<{ (e: "history"): void }>();

const { t } = useI18n();
const router = useRouter();

function viewProfile() {
  void router.push({ name: "players-id", params: { id: props.steamId } });
}

async function copySteamId() {
  if (!navigator.clipboard?.writeText) {
    return;
  }

  await navigator.clipboard.writeText(props.steamId);

  toast({ title: t("player.context_menu.steam_id_copied") });
}

function openSteamProfile() {
  window.open(
    `https://steamcommunity.com/profiles/${props.steamId}`,
    "_blank",
    "noopener",
  );
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        size="icon"
        class="shrink-0"
        :aria-label="t('community.player.more', { name })"
      >
        <MoreVertical />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56">
      <DropdownMenuLabel class="truncate">{{ name }}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="emit('history')">
        <History />
        <span>{{ $t("community.player.sanction_history") }}</span>
      </DropdownMenuItem>
      <DropdownMenuItem v-if="hasAccount" @select="viewProfile">
        <User />
        <span>{{ $t("player.context_menu.view_profile") }}</span>
      </DropdownMenuItem>
      <DropdownMenuItem @select="copySteamId">
        <Copy />
        <span>{{ $t("player.context_menu.copy_steam_id") }}</span>
      </DropdownMenuItem>
      <DropdownMenuItem @select="openSteamProfile">
        <SteamIcon class="size-4 fill-current" />
        <span>{{ $t("ui.tooltips.view_steam_profile") }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
