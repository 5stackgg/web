<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Fold, HeightSwap } from "~/components/ui/transitions";
import { CalendarClock, Check, ExternalLink, Globe, X } from "lucide-vue-next";
import type { Proposal } from "~/utilities/leagueFixtures";
import {
  bracketAgreedAt,
  bracketPendingProposals,
  bracketProposalHistory,
  canNegotiateBracket,
  canRespondToBracketProposal,
  type NegotiationBracket,
  type NegotiationViewer,
} from "~/utilities/bracketNegotiation";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

type DialogBracket = NegotiationBracket & {
  team_1?: { name?: string; team?: { name?: string } } | null;
  team_2?: { name?: string; team?: { name?: string } } | null;
  match?: { id?: string } | null;
};

const props = defineProps<{
  open: boolean;
  bracket: DialogBracket;
  title: string;
  bestOf?: number | null;
  viewer: NegotiationViewer;
  windowOpensAt: string;
  windowClosesAt: string;
  roundWindow: boolean;
  busy?: boolean;
  respond: (
    proposalId: string,
    status: "Accepted" | "Declined",
  ) => Promise<unknown>;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "propose"): void;
  (e: "counter", proposalId: string): void;
}>();

const { t } = useI18n();

const pending = computed(() => bracketPendingProposals(props.bracket));
const history = computed(() => bracketProposalHistory(props.bracket));
const agreedAt = computed(() => bracketAgreedAt(props.bracket));
const canPropose = computed(() =>
  canNegotiateBracket(props.bracket, props.viewer),
);
// The answering side's new time replaces the offer it was sent, so the two
// teams never have two pending times on the table.
const answerable = computed(() => pending.value.find(respondable));

function proposeNewTime() {
  if (answerable.value) {
    emit("counter", answerable.value.id);
    return;
  }
  emit("propose");
}

const team1 = computed(
  () =>
    props.bracket.team_1?.team?.name ||
    props.bracket.team_1?.name ||
    t("common.tbd"),
);
const team2 = computed(
  () =>
    props.bracket.team_2?.team?.name ||
    props.bracket.team_2?.name ||
    t("common.tbd"),
);

function respondable(proposal: Proposal): boolean {
  return canRespondToBracketProposal(props.bracket, proposal, props.viewer);
}

function formatLocal(value: Date | string): string {
  return new Date(value).toLocaleString(dateLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Neither team's timezone is stored, so every negotiated time is also shown in
// UTC, the one clock both sides can agree on.
function formatUtc(value: Date | string): string {
  return `${new Date(value).toLocaleString(dateLocale(), {
    timeZone: "UTC",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  })} UTC`;
}

function formatBound(value: string): string {
  return new Date(value).toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
  });
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex flex-wrap items-center gap-2">
          <span
            class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
          >
            {{ title }}
          </span>
          <Badge v-if="bestOf" variant="outline" size="sm" class="font-mono">
            BO{{ bestOf }}
          </Badge>
        </DialogTitle>
        <DialogDescription class="sr-only">
          {{ team1 }} vs {{ team2 }}
        </DialogDescription>
      </DialogHeader>

      <div
        class="flex items-center justify-between gap-3 text-base font-semibold"
      >
        <span class="truncate">{{ team1 }}</span>
        <span class="shrink-0 font-mono text-xs text-muted-foreground">vs</span>
        <span class="truncate text-right">{{ team2 }}</span>
      </div>

      <HeightSwap>
        <div
          v-if="pending.length"
          :key="`pending:${pending.map((proposal) => proposal.id).join()}`"
          class="space-y-2"
        >
          <div
            v-for="proposal in pending"
            :key="proposal.id"
            class="rounded-md border border-[hsl(var(--tac-amber)/0.3)] bg-[hsl(var(--tac-amber)/0.05)] px-3 py-2.5"
          >
            <div class="flex items-center gap-1.5 text-sm font-medium">
              <CalendarClock
                class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
              />
              {{ formatLocal(proposal.proposed_time) }}
            </div>
            <div class="mt-1 font-mono text-[0.62rem] text-muted-foreground">
              {{ formatUtc(proposal.proposed_time) }}
            </div>
            <div class="mt-1.5 text-xs text-muted-foreground">
              {{ $t("league.schedule.proposed_by") }}
              {{ proposal.proposed_by?.name ?? "?" }}
              <span v-if="proposal.message" class="italic">
                · “{{ proposal.message }}”
              </span>
            </div>

            <div
              v-if="respondable(proposal)"
              class="mt-2.5 flex flex-wrap gap-1.5"
            >
              <Button
                size="sm"
                class="tac-amber-cta h-7 gap-1 [&_svg]:size-3.5"
                :disabled="busy"
                @click="respond(proposal.id, 'Accepted')"
              >
                <Check class="h-3.5 w-3.5" />
                {{ $t("league.schedule.accept") }}
              </Button>
              <Button
                size="sm"
                variant="outline"
                class="h-7 gap-1 [&_svg]:size-3.5"
                :disabled="busy"
                @click="emit('counter', proposal.id)"
              >
                <CalendarClock class="h-3.5 w-3.5" />
                {{ $t("league.schedule.counter") }}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                class="h-7 gap-1 text-muted-foreground [&_svg]:size-3.5"
                :disabled="busy"
                @click="respond(proposal.id, 'Declined')"
              >
                <X class="h-3.5 w-3.5" />
                {{ $t("league.schedule.decline") }}
              </Button>
            </div>
            <p v-else class="mt-2 text-xs text-muted-foreground">
              {{ $t("league.schedule.awaiting_opponent") }}
            </p>
          </div>
        </div>

        <div
          v-else-if="agreedAt"
          :key="`agreed:${agreedAt}`"
          class="rounded-md border border-border bg-muted/20 px-3 py-2.5"
        >
          <div class="flex items-center gap-1.5 text-sm font-medium">
            <CalendarClock class="h-3.5 w-3.5 text-muted-foreground" />
            {{ formatLocal(agreedAt) }}
          </div>
          <div
            class="mt-1 flex items-center gap-1.5 font-mono text-[0.62rem] text-muted-foreground"
          >
            <Globe class="h-3 w-3" />
            {{ formatUtc(agreedAt) }}
          </div>
        </div>

        <div
          v-else
          key="unscheduled"
          class="flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground"
        >
          <CalendarClock class="h-3.5 w-3.5" />
          {{ $t("tournament.negotiation.no_time") }}
        </div>
      </HeightSwap>

      <Fold :open="history.length > 0">
        <p :class="tacticalSectionLabelClasses" class="!mb-1">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("tournament.negotiation.history") }}
        </p>
        <TransitionGroup
          tag="ul"
          class="relative space-y-1"
          enter-active-class="transition-[opacity,transform] duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          leave-active-class="absolute transition-[opacity,transform] duration-150 motion-reduce:transition-none"
          enter-from-class="opacity-0 -translate-y-1"
          leave-to-class="opacity-0 translate-y-1"
          move-class="transition-transform duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        >
          <li
            v-for="past in history"
            :key="past.id"
            class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          >
            <span class="font-mono line-through">
              {{ formatLocal(past.proposed_time) }}
            </span>
            <span>{{ past.proposed_by?.name ?? "?" }}</span>
            <span class="font-mono uppercase tracking-[0.12em]">
              · {{ $t(`league.schedule.status.${past.status}`) }}
            </span>
          </li>
        </TransitionGroup>
      </Fold>

      <div class="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          v-if="canPropose"
          size="sm"
          :variant="pending.length ? 'outline' : 'default'"
          :class="pending.length ? '' : 'tac-amber-cta'"
          class="gap-1.5 [&_svg]:size-3.5"
          :disabled="busy"
          @click="proposeNewTime"
        >
          <CalendarClock class="h-3.5 w-3.5" />
          {{
            pending.length
              ? $t("league.schedule.propose_new")
              : $t("league.schedule.propose")
          }}
        </Button>

        <NuxtLink
          v-if="bracket.match?.id"
          :to="{ name: 'matches-id', params: { id: bracket.match.id } }"
        >
          <Button size="sm" variant="outline" class="gap-1.5 [&_svg]:size-3.5">
            <ExternalLink class="h-3.5 w-3.5" />
            {{ $t("league.schedule.view_match") }}
          </Button>
        </NuxtLink>

        <p class="text-xs text-muted-foreground">
          {{
            !canPropose
              ? $t("tournament.negotiation.teams_only")
              : roundWindow
                ? $t("tournament.negotiation.window", {
                    from: formatBound(windowOpensAt),
                    to: formatBound(windowClosesAt),
                  })
                : $t("tournament.negotiation.two_weeks")
          }}
        </p>
      </div>
    </DialogContent>
  </Dialog>
</template>
