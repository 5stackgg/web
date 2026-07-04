<script setup lang="ts">
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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
import { ArrowDown, ArrowUp, Check, Minus, Swords } from "lucide-vue-next";
import type { LeagueDivision } from "~/components/league/DivisionTierEditor.vue";

export interface MovementRow {
  id: string;
  type: string;
  final_rank: number | null;
  approved_at: string | null;
  league_team: { id: string; name: string };
  from_division: { id: string; name: string } | null;
  computed_to_division: { id: string; name: string } | null;
  final_to_division: { id: string; name: string } | null;
}

defineProps<{
  movements: MovementRow[];
  divisions: LeagueDivision[];
  isAdmin: boolean;
}>();

const emit = defineEmits<{
  (e: "override", movementId: string, divisionId: string | null): void;
  (e: "approveAll"): void;
}>();

const UP_TYPES = ["Promote", "DirectPromote"];
const DOWN_TYPES = ["Relegate", "DirectRelegate"];
const PLAYOFF_TYPES = ["RelegationUp", "RelegationDown"];

function movementKind(type: string): "up" | "down" | "playoff" | "hold" {
  if (UP_TYPES.includes(type)) return "up";
  if (DOWN_TYPES.includes(type)) return "down";
  if (PLAYOFF_TYPES.includes(type)) return "playoff";
  return "hold";
}
</script>

<template>
  <div class="space-y-3">
    <div class="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-12 text-center">{{
              $t("league.movements.rank")
            }}</TableHead>
            <TableHead>{{ $t("league.movements.team") }}</TableHead>
            <TableHead>{{ $t("league.movements.movement") }}</TableHead>
            <TableHead v-if="isAdmin">{{
              $t("league.movements.override")
            }}</TableHead>
            <TableHead class="text-right">{{
              $t("league.movements.status")
            }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="!movements.length">
            <TableCell
              :colspan="isAdmin ? 5 : 4"
              class="py-8 text-center text-sm text-muted-foreground"
            >
              {{ $t("league.movements.empty") }}
            </TableCell>
          </TableRow>
          <TableRow v-for="movement in movements" :key="movement.id">
            <TableCell class="text-center font-mono text-sm">
              {{ movement.final_rank ?? "—" }}
            </TableCell>
            <TableCell class="font-medium">
              {{ movement.league_team.team.name }}
            </TableCell>
            <TableCell>
              <span class="flex items-center gap-2 text-sm">
                <ArrowUp
                  v-if="movementKind(movement.type) === 'up'"
                  class="h-3.5 w-3.5 text-success"
                />
                <ArrowDown
                  v-else-if="movementKind(movement.type) === 'down'"
                  class="h-3.5 w-3.5 text-destructive"
                />
                <Swords
                  v-else-if="movementKind(movement.type) === 'playoff'"
                  class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
                />
                <Minus v-else class="h-3.5 w-3.5 text-muted-foreground" />
                {{ movement.from_division?.name }}
                <Badge
                  v-if="movementKind(movement.type) === 'playoff'"
                  variant="outline"
                  class="border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]"
                >
                  {{ $t(`league.movements.bands.${movement.type}`) }}
                </Badge>
                <template
                  v-if="
                    (movement.final_to_division ?? movement.computed_to_division)
                      ?.id !== movement.from_division?.id
                  "
                >
                  →
                  {{
                    (movement.final_to_division ?? movement.computed_to_division)
                      ?.name
                  }}
                </template>
              </span>
            </TableCell>
            <TableCell v-if="isAdmin">
              <Select
                v-if="!movement.approved_at"
                :model-value="movement.final_to_division?.id ?? 'none'"
                @update:model-value="
                  (val) =>
                    emit(
                      'override',
                      movement.id,
                      val === 'none' ? null : (val as string),
                    )
                "
              >
                <SelectTrigger class="h-8 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">
                      {{ $t("league.movements.keep_computed") }}
                    </SelectItem>
                    <SelectItem
                      v-for="division in divisions"
                      :key="division.id"
                      :value="division.id"
                    >
                      {{ division.name }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <span v-else class="text-xs text-muted-foreground">—</span>
            </TableCell>
            <TableCell class="text-right">
              <Badge
                v-if="movement.approved_at"
                variant="outline"
                class="gap-1 border-success/50 text-success"
              >
                <Check class="h-3 w-3" />
                {{ $t("league.movements.approved") }}
              </Badge>
              <Badge v-else variant="outline" class="text-muted-foreground">
                {{ $t("league.movements.pending") }}
              </Badge>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Button
      v-if="isAdmin && movements.some((m) => !m.approved_at)"
      @click="emit('approveAll')"
    >
      {{ $t("league.movements.approve_all") }}
    </Button>
  </div>
</template>
