<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import UtilityPracticePanel from "~/components/utility/UtilityPracticePanel.vue";
import cleanMapName from "~/utilities/cleanMapName";

const props = withDefaults(
  defineProps<{
    mapName: string;
    lineupId?: string | null;
    playbookId?: string | null;
    joinInviteCode?: string | null;
    joinSessionId?: string | null;
  }>(),
  {
    lineupId: null,
    playbookId: null,
    joinInviteCode: null,
    joinSessionId: null,
  },
);

const open = defineModel<boolean>("open", { default: false });

const live = ref(false);

const mapDisplay = computed(() => cleanMapName(props.mapName));
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <span
          class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
        >
          {{ mapDisplay }}
        </span>
        <DialogTitle>
          {{ $t("pages.utility.practice.title") }}
        </DialogTitle>
        <DialogDescription>
          {{
            live
              ? $t("pages.utility.practice.description_live")
              : $t("pages.utility.practice.description")
          }}
        </DialogDescription>
      </DialogHeader>

      <UtilityPracticePanel
        v-model:live="live"
        :active="open"
        :map-name="mapName"
        :lineup-id="lineupId"
        :playbook-id="playbookId"
        :join-invite-code="joinInviteCode"
        :join-session-id="joinSessionId"
        @joined="open = false"
      />
    </DialogContent>
  </Dialog>
</template>
