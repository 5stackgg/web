<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Link2 } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

const props = defineProps<{
  ip?: string | null;
  others?: string[];
  scope: "now" | "week";
}>();

const { t } = useI18n();

const shared = computed(() => (props.others?.length ?? 0) > 0);

const tooltip = computed(() =>
  t(
    props.scope === "now"
      ? "community.ip.shared_now"
      : "community.ip.shared_week",
    { names: (props.others ?? []).join(", ") },
  ),
);
</script>

<template>
  <span
    v-if="!ip"
    class="font-mono text-xs text-muted-foreground/60"
    aria-hidden="true"
    >—</span
  >
  <FiveStackToolTip v-else-if="shared" as-child :delay-duration="120">
    <template #trigger>
      <span
        class="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap font-mono text-xs text-[hsl(var(--tac-amber))]"
        tabindex="0"
        :aria-label="`${ip}. ${tooltip}`"
        data-shared-ip
      >
        <Link2 class="h-3.5 w-3.5 shrink-0" />
        <span class="truncate">{{ ip }}</span>
        <span
          class="rounded-sm bg-[hsl(var(--tac-amber)/0.12)] px-1 text-[0.65rem]"
          >×{{ (others?.length ?? 0) + 1 }}</span
        >
      </span>
    </template>
    {{ tooltip }}
  </FiveStackToolTip>
  <span
    v-else
    class="block truncate whitespace-nowrap font-mono text-xs text-muted-foreground"
    >{{ ip }}</span
  >
</template>
