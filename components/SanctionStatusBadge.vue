<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

type SanctionType = "ban" | "mute" | "gag" | "silence";

// `active` is every sanction in force: the pill still shows only `type` (the
// worst), so a row keeps one geometry however many apply, and counts the rest.
const props = withDefaults(
  defineProps<{
    type: SanctionType;
    active?: SanctionType[];
    variant?: "inline" | "overlay";
  }>(),
  {
    active: undefined,
    variant: "inline",
  },
);

const { t } = useI18n();

const LABEL_KEYS: Record<SanctionType, string> = {
  ban: "banned",
  mute: "muted",
  gag: "gagged",
  silence: "silenced",
};

const tone = computed<"ban" | "warn">(() =>
  props.type === "ban" ? "ban" : "warn",
);

const label = computed(() => t(`player.sanctions.${LABEL_KEYS[props.type]}`));

const extra = computed(() =>
  (props.active ?? []).filter((kind) => kind !== props.type),
);

const activeList = computed(() =>
  [props.type, ...extra.value]
    .map((kind) => t(`player.sanctions.${LABEL_KEYS[kind]}`))
    .join(", "),
);
</script>

<template>
  <!-- Avatar overlay: bottom strip stamp -->
  <FiveStackToolTip v-if="variant === 'overlay'" as-child :delay-duration="120">
    <template #trigger>
      <span
        class="absolute inset-x-1 bottom-1 z-[2] flex items-center justify-center gap-1 border-t px-1 py-0.5 font-mono text-[0.55rem] font-bold uppercase leading-none tracking-[0.1em] backdrop-blur-sm"
        :class="
          tone === 'ban'
            ? 'border-destructive/60 bg-destructive/85 text-destructive-foreground'
            : 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.9)] text-[hsl(var(--tac-amber-foreground))]'
        "
      >
        <span class="relative flex h-1 w-1 shrink-0">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75"
          ></span>
          <span
            class="relative inline-flex h-1 w-1 rounded-full bg-current"
          ></span>
        </span>
        <span class="truncate">{{ label }}</span>
      </span>
    </template>
    {{ $t("player.sanctions.title") }}
  </FiveStackToolTip>

  <!-- Inline pill (compact player displays) -->
  <FiveStackToolTip v-else as-child :delay-duration="120">
    <template #trigger>
      <span
        class="inline-flex shrink-0 items-center gap-1 rounded-sm border px-1 py-0.5 font-mono text-[0.55rem] font-bold uppercase leading-none tracking-wider"
        :class="
          tone === 'ban'
            ? 'border-destructive/50 bg-destructive/15 text-destructive'
            : 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
        "
        :tabindex="active ? 0 : undefined"
      >
        <span class="relative flex h-1 w-1 shrink-0">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75 motion-reduce:animate-none"
          ></span>
          <span
            class="relative inline-flex h-1 w-1 rounded-full bg-current"
          ></span>
        </span>
        {{ label }}
        <span v-if="extra.length" class="opacity-75">+{{ extra.length }}</span>
      </span>
    </template>
    <template v-if="active">
      {{ $t("player.sanctions.active_list", { list: activeList }) }}
    </template>
    <template v-else>{{ $t("player.sanctions.title") }}</template>
  </FiveStackToolTip>
</template>
