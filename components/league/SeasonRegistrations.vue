<script setup lang="ts">
import { ref, computed, watch } from "vue";
import RegistrationReviewTable from "~/components/league/RegistrationReviewTable.vue";
import Pagination from "~/components/Pagination.vue";
import FilterBar from "~/components/common/FilterBar.vue";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Search, X } from "lucide-vue-next";
import { usePerPage } from "~/composables/usePerPage";

// Search + status filter + pagination over the registration review table, so a
// season with hundreds of registrations stays manageable.
const props = defineProps<{
  teamSeasons: any[];
  divisions: any[];
  minRosterSize: number;
  seasonLive?: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{
  (e: "assign", teamSeasonId: string, divisionId: string | null): void;
  (
    e: "set-status",
    teamSeasonId: string,
    status: string,
    reason?: string,
  ): void;
  (e: "remove", teamSeasonId: string): void;
}>();

const STATUSES = [
  "all",
  "Pending",
  "Approved",
  "Waitlisted",
  "Declined",
] as const;

const search = ref("");
// Pending is what admins act on, so default the review queue to it.
const statusFilter = ref<string>("Pending");
const page = ref(1);
const perPage = usePerPage("league-registrations");

const active = computed(() =>
  (props.teamSeasons ?? []).filter((ts: any) => ts.status !== "Withdrawn"),
);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return active.value.filter((ts: any) => {
    if (statusFilter.value !== "all" && ts.status !== statusFilter.value) {
      return false;
    }
    if (q && !(ts.league_team?.team?.name ?? "").toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
});

const paged = computed(() =>
  filtered.value.slice(
    (page.value - 1) * perPage.value,
    page.value * perPage.value,
  ),
);

watch([search, statusFilter], () => (page.value = 1));
</script>

<template>
  <div class="space-y-3">
    <FilterBar>
      <!-- Search (always visible — type instantly) -->
      <InputGroup class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-xs">
        <InputGroupAddon class="pl-2.5">
          <Search class="h-3.5 w-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          :model-value="search"
          @update:model-value="(v) => (search = String(v ?? ''))"
          :placeholder="$t('league.registrations.search')"
          class="h-full text-sm"
        />
        <InputGroupAddon align="inline-end" class="pr-2">
          <button
            v-if="search"
            type="button"
            class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            @click="search = ''"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </InputGroupAddon>
      </InputGroup>

      <Select v-model="statusFilter">
        <SelectTrigger class="h-8 w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="s in STATUSES" :key="s" :value="s">
            {{
              s === "all"
                ? $t("league.registrations.all_statuses")
                : $t(`league.registration_status.${s}`)
            }}
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- Register a team (admin) — pinned right, inline with the filters -->
      <div class="ml-auto flex items-center">
        <slot name="actions" />
      </div>
    </FilterBar>

    <RegistrationReviewTable
      :team-seasons="paged"
      :divisions="divisions"
      :min-roster-size="minRosterSize"
      :season-live="seasonLive"
      :busy="busy"
      @assign="(id, div) => emit('assign', id, div)"
      @set-status="
        (id, status, reason) => emit('set-status', id, status, reason)
      "
      @remove="(id) => emit('remove', id)"
    />

    <Pagination
      v-if="filtered.length"
      :page="page"
      :per-page="perPage"
      :total="filtered.length"
      :show-per-page-selector="true"
      @page="(p: number) => (page = p)"
      @update:perPage="(v: number) => ((perPage = v), (page = 1))"
    />
  </div>
</template>
