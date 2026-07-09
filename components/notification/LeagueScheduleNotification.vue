<script setup lang="ts">
import { ref } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { Button } from "~/components/ui/button";
import ProposeTimeDialog from "~/components/league/ProposeTimeDialog.vue";
import { CalendarClock, Check, X } from "lucide-vue-next";
import {
  PROPOSE_TIME_MUTATION,
  RESPOND_PROPOSAL_MUTATION,
} from "~/graphql/leagues";
import type { LeagueScheduleTask } from "~/stores/NotificationStore";

// A single client-derived scheduling task rendered in the notifications panel.
// The store's live subscription reconciles the list, so once an action lands
// the task simply drops out — nothing to dismiss/delete.
const props = defineProps<{ task: LeagueScheduleTask }>();

const { client } = useApolloClient();
const submitting = ref(false);
const showPropose = ref(false);
const counterProposalId = ref<string | null>(null);

async function respond(status: "Accepted" | "Declined") {
  if (!props.task.proposal || submitting.value) return;
  submitting.value = true;
  try {
    await client.mutate({
      mutation: RESPOND_PROPOSAL_MUTATION,
      variables: { proposalId: props.task.proposal.id, status },
    });
  } finally {
    submitting.value = false;
  }
}

function startCounter() {
  counterProposalId.value = props.task.proposal?.id ?? null;
  showPropose.value = true;
}

// Every action in the row renders at the same height, padding and type scale —
// the amber CTA differs only in colour, never in size.
const actionClasses = "h-7 shrink-0 gap-1.5 px-2.5 text-[0.7rem] font-medium";

async function onProposeSubmit(proposedTime: string, message: string) {
  submitting.value = true;
  try {
    // Countering rejects the current proposal (kept as history) then proposes.
    if (counterProposalId.value) {
      await client.mutate({
        mutation: RESPOND_PROPOSAL_MUTATION,
        variables: { proposalId: counterProposalId.value, status: "Countered" },
      });
      counterProposalId.value = null;
    }
    await client.mutate({
      mutation: PROPOSE_TIME_MUTATION,
      variables: { bracketId: props.task.bracketId, proposedTime, message },
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <!-- Kicker → title → teams, all on one full-width column. The amber mono
       kicker (with an inline glyph that shares its text line, so nothing to
       vertically reconcile) carries the scheduling identity instead of a
       boxed icon gutter. -->
  <div class="space-y-2">
    <div class="min-w-0">
      <div
        class="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
      >
        <CalendarClock class="h-3 w-3 shrink-0" />
        <span class="truncate">{{
          $t("league.schedule_task.context", {
            season: task.seasonNumber ?? "?",
            week: task.round,
          })
        }}</span>
      </div>
      <div class="mt-1 text-sm font-semibold leading-tight">
        {{
          task.kind === "respond"
            ? $t("league.schedule_task.respond_title")
            : $t("league.schedule_task.schedule_title")
        }}
      </div>
      <div class="mt-0.5 truncate text-xs text-muted-foreground">
        {{ task.team1 }}
        <span class="font-mono text-muted-foreground/60">vs</span>
        {{ task.team2 }}
      </div>
      <div v-if="task.kind === 'respond' && task.proposal" class="mt-1 text-xs">
        <span class="font-medium text-foreground">{{
          new Date(task.proposal.proposedTime).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        }}</span>
        <span class="text-muted-foreground">
          · {{ $t("league.schedule.proposed_by") }}
          {{ task.proposal.proposedByName }}</span
        >
        <span v-if="task.proposal.message" class="italic text-muted-foreground">
          · “{{ task.proposal.message }}”</span
        >
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      <template v-if="task.kind === 'respond'">
        <Button
          size="sm"
          :class="['tac-amber-cta', actionClasses]"
          :loading="submitting"
          @click="respond('Accepted')"
        >
          <Check class="h-3.5 w-3.5" />
          {{ $t("league.schedule.accept") }}
        </Button>
        <Button
          v-if="task.week"
          size="sm"
          variant="outline"
          :class="actionClasses"
          @click="startCounter"
        >
          <CalendarClock class="h-3.5 w-3.5" />
          {{ $t("league.schedule.counter") }}
        </Button>
        <Button
          size="sm"
          variant="outline"
          :class="[actionClasses, 'text-muted-foreground hover:text-destructive']"
          @click="respond('Declined')"
        >
          <X class="h-3.5 w-3.5" />
          {{ $t("league.schedule.decline") }}
        </Button>
      </template>
      <template v-else>
        <Button
          size="sm"
          :class="['tac-amber-cta', actionClasses]"
          :disabled="!task.week"
          @click="showPropose = true"
        >
          {{ $t("league.schedule.propose") }}
        </Button>
      </template>
      <NuxtLink
        :to="{
          name: 'league-seasons-seasonId',
          params: { seasonId: task.seasonId },
          query: { tab: 'schedule' },
        }"
        class="ml-auto"
      >
        <Button
          size="sm"
          variant="outline"
          :class="[actionClasses, 'text-muted-foreground']"
        >
          {{ $t("common.view") }}
        </Button>
      </NuxtLink>
    </div>

    <ProposeTimeDialog
      v-if="task.week"
      :open="showPropose"
      :week-opens-at="task.week.opens_at"
      :week-closes-at="task.week.closes_at"
      :matchup="`${task.team1} vs ${task.team2}`"
      :scope="
        [
          task.seasonNumber
            ? $t('league.schedule.season_number', { number: task.seasonNumber })
            : null,
          $t('league.schedule.week', { week: task.week.week_number }),
        ]
          .filter(Boolean)
          .join(' · ')
      "
      @update:open="
        (o) => ((showPropose = o), !o && (counterProposalId = null))
      "
      @submit="onProposeSubmit"
    />
  </div>
</template>
