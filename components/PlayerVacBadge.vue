<script lang="ts" setup>
import { computed } from "vue";
import { ShieldAlert, ShieldX } from "lucide-vue-next";

const props = defineProps<{
  player?: Record<string, any> | null;
}>();

const vacBanned = computed(() => {
  const p = props.player;
  return Boolean(p?.vac_banned) || (p?.vac_ban_count ?? 0) > 0;
});

const gameBanned = computed(() => (props.player?.game_ban_count ?? 0) > 0);

const vacBanCount = computed(() => props.player?.vac_ban_count ?? 0);
const gameBanCount = computed(() => props.player?.game_ban_count ?? 0);
</script>

<template>
  <div class="flex items-center gap-1" v-if="vacBanned || gameBanned">
    <Tooltip v-if="vacBanned">
      <TooltipTrigger>
        <ShieldX class="w-4 h-4 text-red-500" />
      </TooltipTrigger>
      <TooltipContent>
        {{
          vacBanCount > 0
            ? $t("player.status.vac_banned_count", { count: vacBanCount })
            : $t("player.status.vac_banned")
        }}
      </TooltipContent>
    </Tooltip>
    <Tooltip v-if="gameBanned">
      <TooltipTrigger>
        <ShieldAlert class="w-4 h-4 text-orange-500" />
      </TooltipTrigger>
      <TooltipContent>
        {{ $t("player.status.game_banned_count", { count: gameBanCount }) }}
      </TooltipContent>
    </Tooltip>
  </div>
</template>
