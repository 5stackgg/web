<script lang="ts" setup>
import { computed } from "vue";
import { ShieldAlert, ShieldX } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

const props = withDefaults(
  defineProps<{
    player?: Record<string, any> | null;
    variant?: "icon" | "button";
  }>(),
  {
    player: undefined,
    variant: "icon",
  },
);

const vacBanned = computed(() => Boolean(props.player?.vac_banned));

const gameBanned = computed(() => (props.player?.game_ban_count ?? 0) > 0);

const vacBanCount = computed(() => props.player?.vac_ban_count ?? 0);
const gameBanCount = computed(() => props.player?.game_ban_count ?? 0);

const daysSinceLastBan = computed(() => {
  const days = props.player?.days_since_last_ban;
  return typeof days === "number" ? days : null;
});

const emit = defineEmits<{ (e: "click"): void }>();

const buttonClasses =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors duration-150";
</script>

<template>
  <!-- Hero / meta-strip: one shield, tinted by the worst ban, opens sanctions. -->
  <FiveStackToolTip
    v-if="variant === 'button' && (vacBanned || gameBanned)"
    as-child
    :delay-duration="120"
  >
    <template #trigger>
      <button
        type="button"
        :aria-label="
          vacBanned
            ? $t('player.status.vac_banned')
            : $t('player.status.game_banned')
        "
        :class="[
          buttonClasses,
          vacBanned
            ? 'border-destructive/55 bg-destructive/15 text-destructive hover:border-destructive hover:bg-destructive/25'
            : 'border-orange-500/55 bg-orange-500/15 text-orange-400 hover:border-orange-500 hover:bg-orange-500/25',
        ]"
        @click="emit('click')"
      >
        <ShieldX v-if="vacBanned" class="h-4 w-4" />
        <ShieldAlert v-else class="h-4 w-4" />
      </button>
    </template>
    <div class="flex flex-col gap-0.5">
      <span v-if="vacBanned">
        {{
          vacBanCount > 0
            ? $t("player.status.vac_banned_count", { count: vacBanCount })
            : $t("player.status.vac_banned")
        }}
      </span>
      <span v-if="gameBanned">
        {{ $t("player.status.game_banned_count", { count: gameBanCount }) }}
      </span>
      <span v-if="daysSinceLastBan !== null" class="text-muted-foreground">
        {{ $t("player.status.last_ban_days_ago", { days: daysSinceLastBan }) }}
      </span>
      <span class="text-muted-foreground">
        {{ $t("player.status.view_sanctions_hint") }}
      </span>
    </div>
  </FiveStackToolTip>

  <!-- Inline status row (player displays): one icon per ban kind. -->
  <div v-else-if="vacBanned || gameBanned" class="flex items-center gap-1">
    <FiveStackToolTip v-if="vacBanned" as-child :delay-duration="120">
      <template #trigger>
        <ShieldX class="w-4 h-4 text-red-500" />
      </template>
      <div class="flex flex-col gap-0.5">
        <span>
          {{
            vacBanCount > 0
              ? $t("player.status.vac_banned_count", { count: vacBanCount })
              : $t("player.status.vac_banned")
          }}
        </span>
        <span v-if="daysSinceLastBan !== null" class="text-muted-foreground">
          {{ $t("player.status.last_ban_days_ago", { days: daysSinceLastBan }) }}
        </span>
      </div>
    </FiveStackToolTip>
    <FiveStackToolTip v-if="gameBanned" as-child :delay-duration="120">
      <template #trigger>
        <ShieldAlert class="w-4 h-4 text-orange-500" />
      </template>
      <div class="flex flex-col gap-0.5">
        <span>
          {{ $t("player.status.game_banned_count", { count: gameBanCount }) }}
        </span>
        <span
          v-if="daysSinceLastBan !== null && !vacBanned"
          class="text-muted-foreground"
        >
          {{ $t("player.status.last_ban_days_ago", { days: daysSinceLastBan }) }}
        </span>
      </div>
    </FiveStackToolTip>
  </div>
</template>
