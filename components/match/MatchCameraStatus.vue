<script setup lang="ts">
import { computed } from "vue";
import { LucideVideo } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { cameraAdminGridPath } from "~/composables/useCameraApi";
import { useMatchCameraStatus } from "~/composables/useMatchCameraStatus";

const props = defineProps<{
  matchId: string;
}>();

const { summary, loaded } = useMatchCameraStatus(() => props.matchId);

const missing = computed(() => summary.value.total - summary.value.live);
const alerting = computed(
  () => loaded.value && summary.value.total > 0 && missing.value > 0,
);

function openGrid() {
  window.open(cameraAdminGridPath(props.matchId), "_blank", "noopener");
}
</script>

<template>
  <Button
    size="sm"
    variant="outline"
    :title="$t('match.actions.watch_camera')"
    class="h-9 gap-1.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em]"
    :class="
      alerting
        ? 'border-[hsl(var(--destructive)/0.55)] bg-[hsl(var(--destructive)/0.12)] text-destructive hover:bg-[hsl(var(--destructive)/0.2)] hover:text-destructive'
        : 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] hover:text-[hsl(var(--tac-amber))]'
    "
    @click="openGrid"
  >
    <LucideVideo class="h-3 w-3" />
    {{ $t("camera.cameras") }}
    <!-- Reserved rather than conditional: the count lands a poll later and the
         button must not resize the action row when it does. -->
    <span class="min-w-[2.5rem] text-right tabular-nums">
      {{ loaded && summary.total ? `${summary.live}/${summary.total}` : "—" }}
    </span>
  </Button>
</template>
