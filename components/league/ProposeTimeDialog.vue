<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import ProposeTimeForm from "~/components/league/ProposeTimeForm.vue";

// The modal form. On desktop the season calendar anchors the same form to the
// clicked day as a popover instead; this stays the surface for mobile and for
// every entry point that has no day cell to point at (notifications, playoffs,
// countering from the fixture dialog).
defineProps<{
  open: boolean;
  weekOpensAt: string;
  weekClosesAt: string;
  initialDate?: string | null;
  defaultTime?: string | null;
  matchup?: string | null;
  scope?: string | null;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "submit", proposedTime: string, message: string): void;
}>();

function onSubmit(proposedTime: string, message: string) {
  emit("submit", proposedTime, message);
  emit("update:open", false);
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t("league.schedule.propose_title") }}</DialogTitle>
        <DialogDescription class="sr-only">
          {{ [matchup, scope].filter(Boolean).join(" — ") }}
        </DialogDescription>
      </DialogHeader>

      <ProposeTimeForm
        :week-opens-at="weekOpensAt"
        :week-closes-at="weekClosesAt"
        :initial-date="initialDate"
        :default-time="defaultTime"
        :matchup="matchup"
        :scope="scope"
        @submit="onSubmit"
        @cancel="emit('update:open', false)"
      />
    </DialogContent>
  </Dialog>
</template>
