<script setup lang="ts">
import { ref } from "vue";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { computed } from "vue";
import { AlertTriangle } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import TeamRankSummary from "~/components/team/TeamRankSummary.vue";
import type { LeagueDivision } from "~/components/league/DivisionTierEditor.vue";

export interface TeamSeasonRow {
  id: string;
  status: string;
  decline_reason: string | null;
  seed: number | null;
  requested_division_id: string | null;
  assigned_division_id: string | null;
  league_team: {
    id: string;
    team: { id: string; name: string };
  };
  roster: { player_steam_id: string; player?: any }[];
}

const props = defineProps<{
  teamSeasons: TeamSeasonRow[];
  divisions: LeagueDivision[];
  minRosterSize: number;
  seasonLive?: boolean;
  busy?: boolean;
}>();

const { t } = useI18n();

// Why the Approve button is disabled, so admins aren't left guessing.
function approveDisabledReason(row: TeamSeasonRow): string | undefined {
  if (row.roster.length < props.minRosterSize) {
    return t("league.registrations.approve_needs_roster", {
      min: props.minRosterSize,
    });
  }
  if (!row.assigned_division_id) {
    return t("league.registrations.approve_needs_division");
  }
  return undefined;
}

// Team average of each rating (5Stack ELO, CS2 Premier, FACEIT) so admins can
// judge what tier a team belongs in, matching how ratings are shown elsewhere.
function teamRanks(row: TeamSeasonRow) {
  const players = (row.roster ?? []).map((r) => r.player).filter(Boolean);
  const avg = (vals: number[]) =>
    vals.length
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      : null;
  const nums = (fn: (p: any) => number | null | undefined) =>
    players.map(fn).filter((v): v is number => v != null);
  return {
    avg_elo: avg(nums((p) => p.elo?.competitive)),
    avg_premier: avg(nums((p) => p.premier_rank)),
    avg_faceit_elo: avg(nums((p) => p.faceit_elo)),
    avg_faceit_level: avg(nums((p) => p.faceit_skill_level)),
    roster_size: players.length,
  };
}

const emit = defineEmits<{
  (e: "assign", teamSeasonId: string, divisionId: string | null): void;
  (
    e: "setStatus",
    teamSeasonId: string,
    status: "Approved" | "Declined" | "Waitlisted",
    reason?: string | null,
  ): void;
  (e: "remove", teamSeasonId: string): void;
}>();

const confirmRemove = ref<string | null>(null);

// Decline flow: capture an optional reason the team will see.
const declineTarget = ref<string | null>(null);
const declineReason = ref("");

function openDecline(teamSeasonId: string) {
  declineTarget.value = teamSeasonId;
  declineReason.value = "";
}

function confirmDecline() {
  if (declineTarget.value) {
    emit(
      "setStatus",
      declineTarget.value,
      "Declined",
      declineReason.value.trim() || null,
    );
  }
  declineTarget.value = null;
  declineReason.value = "";
}

const STATUS_VARIANTS: Record<string, string> = {
  Approved: "border-success/50 text-success",
  Pending: "border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]",
  Waitlisted: "text-muted-foreground",
  Declined: "border-destructive/50 text-destructive",
  Withdrawn: "text-muted-foreground line-through",
};
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-border">
    <Table>
      <TableHeader>
        <TableRow class="hover:bg-transparent">
          <TableHead>{{ $t("league.registrations.status") }}</TableHead>
          <TableHead>{{ $t("league.registrations.team") }}</TableHead>
          <TableHead class="text-center">{{
            $t("league.registrations.roster")
          }}</TableHead>
          <TableHead>{{ $t("league.registrations.division") }}</TableHead>
          <TableHead class="text-right">{{
            $t("league.registrations.actions")
          }}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="!teamSeasons.length">
          <TableCell
            colspan="5"
            class="py-8 text-center text-sm text-muted-foreground"
          >
            {{ $t("league.registrations.empty") }}
          </TableCell>
        </TableRow>
        <TableRow v-for="row in teamSeasons" :key="row.id">
          <TableCell>
            <Badge variant="outline" :class="STATUS_VARIANTS[row.status]">
              {{ row.status }}
            </Badge>
            <p
              v-if="row.status === 'Declined' && row.decline_reason"
              class="mt-1 max-w-[220px] text-xs text-muted-foreground"
            >
              {{ row.decline_reason }}
            </p>
          </TableCell>
          <TableCell class="font-medium">
            <div class="flex flex-col gap-1.5">
              <span>{{ row.league_team.team.name }}</span>
              <TeamRankSummary :ranks="teamRanks(row)" />
            </div>
          </TableCell>
          <TableCell class="text-center font-mono text-sm">
            <span
              :class="
                row.roster.length < minRosterSize
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              "
              >{{ row.roster.length }}</span
            >
          </TableCell>
          <TableCell>
            <div class="relative inline-flex items-center">
              <Select
                :model-value="row.assigned_division_id ?? 'none'"
                @update:model-value="
                  (val) =>
                    emit(
                      'assign',
                      row.id,
                      val === 'none' ? null : (val as string),
                    )
                "
              >
                <SelectTrigger
                  class="h-8 w-[180px]"
                  :class="
                    !row.assigned_division_id
                      ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))]'
                      : ''
                  "
                >
                  <SelectValue
                    :placeholder="$t('league.registrations.unassigned')"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">
                      {{ $t("league.registrations.unassigned") }}
                    </SelectItem>
                    <SelectItem
                      v-for="division in divisions"
                      :key="division.id"
                      :value="division.id"
                    >
                      {{ division.name }}
                      <template v-if="division.id === row.requested_division_id">
                        ({{ $t("league.registrations.requested") }})
                      </template>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <!-- Absolutely positioned so the row height/alignment stays put;
                   the hint lives in a hover tooltip. -->
              <FiveStackToolTip
                v-if="!row.assigned_division_id && row.status !== 'Declined'"
                as-child
                side="top"
              >
                <template #trigger>
                  <span
                    class="absolute left-full top-1/2 ml-1.5 -translate-y-1/2 text-[hsl(var(--tac-amber))]"
                  >
                    <AlertTriangle class="h-4 w-4" />
                  </span>
                </template>
                {{ $t("league.registrations.assign_to_approve") }}
              </FiveStackToolTip>
            </div>
          </TableCell>
          <TableCell class="text-right">
            <div class="flex justify-end gap-1.5">
              <Button
                v-if="row.status !== 'Approved'"
                size="sm"
                variant="outline"
                class="h-7"
                :disabled="!!approveDisabledReason(row) || busy"
                :title="approveDisabledReason(row)"
                @click="emit('setStatus', row.id, 'Approved')"
              >
                {{ $t("league.registrations.approve") }}
              </Button>
              <Button
                v-if="row.status === 'Pending'"
                size="sm"
                variant="ghost"
                class="h-7 text-muted-foreground"
                :loading="busy"
                @click="emit('setStatus', row.id, 'Waitlisted')"
              >
                {{ $t("league.registrations.waitlist") }}
              </Button>
              <Button
                v-if="row.status !== 'Declined' && row.status !== 'Approved'"
                size="sm"
                variant="ghost"
                class="h-7 text-destructive"
                @click="openDecline(row.id)"
              >
                {{ $t("league.registrations.decline") }}
              </Button>
              <Button
                v-if="seasonLive && row.status === 'Approved'"
                size="sm"
                variant="destructive"
                class="h-7"
                @click="confirmRemove = row.id"
              >
                {{ $t("league.registrations.remove") }}
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <AlertDialog
      :open="!!confirmRemove"
      @update:open="(open) => !open && (confirmRemove = null)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            $t("league.registrations.remove_title")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("league.registrations.remove_description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="confirmRemove = null">
            {{ $t("common.cancel") }}
          </AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="
              confirmRemove && emit('remove', confirmRemove);
              confirmRemove = null;
            "
          >
            {{ $t("league.registrations.remove") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      :open="!!declineTarget"
      @update:open="(open) => !open && (declineTarget = null)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            $t("league.registrations.decline_title")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("league.registrations.decline_reason_hint") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          v-model="declineReason"
          :placeholder="$t('league.registrations.decline_reason_placeholder')"
          rows="3"
        />
        <AlertDialogFooter>
          <AlertDialogCancel @click="declineTarget = null">
            {{ $t("common.cancel") }}
          </AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmDecline"
          >
            {{ $t("league.registrations.decline") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
