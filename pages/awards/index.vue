<script setup lang="ts">
import { Button } from "~/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import { Skeleton } from "~/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import FacetRail from "~/components/admin/FacetRail.vue";
import AwardComposer from "~/components/award/AwardComposer.vue";
import AwardDetailSheet from "~/components/award/AwardDetailSheet.vue";
import AwardLedgerRow from "~/components/award/AwardLedgerRow.vue";
import { awardLedgerColumns } from "~/components/award/awardLedger";
import {
  createButtonClasses,
  listCreateButtonClasses,
} from "~/utilities/tacticalClasses";
import { Info, Plus, Search, X } from "lucide-vue-next";

// Gated by public.create_awards_role / public.grant_awards_role rather than a
// flat admin check, so lowering either setting actually opens the page. Wait
// for settings to load first so a direct link is not falsely bounced.
const applicationSettingsStore = useApplicationSettingsStore();
watch(
  () => applicationSettingsStore.settings.length,
  () => {
    if (
      applicationSettingsStore.settings.length > 0 &&
      !applicationSettingsStore.canManageAwards &&
      !applicationSettingsStore.canGrantAwards
    ) {
      navigateTo("/");
    }
  },
  { immediate: true },
);
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.awards.title") }}</h1>

  <PageTransition :delay="0">
    <div class="grid gap-4">
      <div
        v-if="loadingAwards || awards.length"
        class="flex flex-wrap items-center gap-2"
      >
        <InputGroup
          class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-[16rem]"
        >
          <InputGroupAddon class="pl-2.5">
            <Search class="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            v-model="search"
            autocomplete="off"
            :placeholder="$t('pages.awards.search_placeholder_v2')"
            :aria-label="$t('pages.awards.search_placeholder')"
            class="h-full text-sm"
          />
          <InputGroupAddon v-if="search" align="inline-end" class="pr-2">
            <button
              type="button"
              class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              :aria-label="$t('pages.awards.clear_search')"
              @click="search = ''"
            >
              <X class="size-3.5" />
            </button>
          </InputGroupAddon>
        </InputGroup>

        <div class="max-w-full overflow-x-auto [scrollbar-width:none]">
          <AnimatedFilters v-model="kind" square :options="kindOptions" />
        </div>

        <Button
          v-if="canManage"
          size="sm"
          class="ml-auto"
          :class="listCreateButtonClasses"
          :title="$t('pages.awards.new_award')"
          @click="openCreate"
        >
          <Plus class="size-4" />
          <span class="max-md:sr-only">{{ $t("pages.awards.new_award") }}</span>
        </Button>
        <p
          v-else
          class="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Info class="size-3.5 shrink-0" />
          {{ $t("pages.awards.grant_only_hint") }}
        </p>
      </div>

      <FadeSwap>
        <SectionEmpty
          v-if="!loadingAwards && !awards.length"
          key="empty"
          :title="$t('pages.awards.no_awards_title')"
          :description="$t('pages.awards.no_awards')"
        >
          <Button
            v-if="canManage"
            size="sm"
            :class="createButtonClasses"
            @click="openCreate"
          >
            <Plus class="size-4" />
            {{ $t("pages.awards.new_award") }}
          </Button>
        </SectionEmpty>

        <FacetRail
          v-else
          key="ledger"
          v-model="facets"
          :groups="facetGroups"
          :label="$t('pages.awards.filter_label')"
        >
          <SectionEmpty
            v-if="!loadingAwards && !visibleAwards.length"
            :title="$t('pages.awards.no_matches_title')"
            :description="$t('pages.awards.no_matches')"
          >
            <Button
              v-if="hasFacets"
              variant="outline"
              size="sm"
              @click="clearFacets"
            >
              {{ $t("pages.awards.clear_filters") }}
            </Button>
            <Button
              v-if="kind !== 'all'"
              variant="outline"
              size="sm"
              @click="kind = 'all'"
            >
              {{ $t("pages.awards.show_all_kinds") }}
            </Button>
            <Button
              v-if="search"
              variant="ghost"
              size="sm"
              @click="search = ''"
            >
              {{ $t("pages.awards.clear_search") }}
            </Button>
          </SectionEmpty>

          <div
            v-else
            class="rounded-lg border border-border bg-card/20"
            data-awards-ledger
          >
            <div
              role="table"
              :aria-label="$t('pages.awards.title')"
              class="text-[0.8125rem]"
            >
              <div
                role="row"
                :class="[
                  awardLedgerColumns,
                  'sticky top-0 z-[3] rounded-t-lg border-b border-border bg-background px-3 py-2.5 text-[0.72rem] font-medium text-muted-foreground',
                ]"
              >
                <span role="columnheader" :aria-sort="ariaSort('name')">
                  <button
                    type="button"
                    class="award-sort"
                    :data-active="sort === 'name'"
                    @click="sortBy('name')"
                  >
                    {{ $t("pages.awards.col_award") }}
                    <span v-if="sort === 'name'" aria-hidden="true">{{
                      sortReverse ? "▼" : "▲"
                    }}</span>
                  </button>
                </span>
                <span role="columnheader" class="max-md:hidden">{{
                  $t("pages.awards.facet_belongs_to")
                }}</span>
                <span role="columnheader">{{ $t("pages.awards.tier") }}</span>
                <span
                  role="columnheader"
                  class="text-right"
                  :aria-sort="ariaSort('holders')"
                >
                  <button
                    type="button"
                    class="award-sort"
                    :data-active="sort === 'holders'"
                    @click="sortBy('holders')"
                  >
                    <span v-if="sort === 'holders'" aria-hidden="true">{{
                      sortReverse ? "▲" : "▼"
                    }}</span>
                    {{ $t("pages.awards.col_holders") }}
                  </button>
                </span>
                <span
                  role="columnheader"
                  class="text-right max-md:hidden"
                  :aria-sort="ariaSort('last')"
                >
                  <button
                    type="button"
                    class="award-sort"
                    :data-active="sort === 'last'"
                    @click="sortBy('last')"
                  >
                    <span v-if="sort === 'last'" aria-hidden="true">{{
                      sortReverse ? "▲" : "▼"
                    }}</span>
                    {{ $t("pages.awards.sort_last_granted") }}
                  </button>
                </span>
                <span role="columnheader">
                  <span class="sr-only">{{ $t("common.actions_label") }}</span>
                </span>
              </div>

              <div v-if="loadingAwards" role="rowgroup" class="grid gap-px p-2">
                <Skeleton
                  v-for="i in 8"
                  :key="i"
                  class="h-12 w-full rounded-md"
                />
              </div>

              <div
                v-else
                role="rowgroup"
                class="transition-opacity motion-reduce:transition-none"
                :class="
                  rowsFading
                    ? 'opacity-0 [transition-duration:110ms] ease-in'
                    : 'opacity-100 [transition-duration:0ms]'
                "
              >
                <AwardLedgerRow
                  v-for="(award, index) in pagedAwards"
                  :key="`${epoch}:${award.id}`"
                  :award="award"
                  :query="search"
                  :can-manage="canManage"
                  :can-grant="canGrantAwards"
                  :stagger="
                    animateRows && index >= staggerFrom
                      ? index - staggerFrom
                      : null
                  "
                  @open="openDetail(award)"
                  @grant="openGrantFor(award)"
                  @edit="openEdit(award)"
                  @delete="deleteTarget = award"
                />
              </div>
            </div>

            <div
              v-if="visibleAwards.length > limit"
              class="flex justify-center border-t border-border/60 p-2.5"
            >
              <Button variant="outline" size="sm" @click="showMore">
                {{ $t("pages.awards.show_more") }}
              </Button>
            </div>
          </div>
        </FacetRail>
      </FadeSwap>
    </div>
  </PageTransition>

  <AwardDetailSheet
    v-model:open="detailOpen"
    :award="detailAward"
    :can-manage="canManage"
    :can-grant="canGrantAwards"
    @edit="openEdit"
    @delete="(award) => (deleteTarget = award)"
  />

  <!-- The catalog row travels with the id, so the panel opens already reading
       as its award rather than blank until its own query lands. -->
  <AwardComposer
    v-if="editOpen"
    v-model:open="editOpen"
    :award-id="editAward?.id || null"
    :award="editAward"
    @saved="editOpen = false"
  />

  <AwardComposer
    v-if="grantOpen"
    v-model:open="grantOpen"
    :award-id="grantAward?.id || null"
    :award="grantAward"
    grant
    @saved="grantOpen = false"
  />

  <AlertDialog
    :open="!!deleteTarget"
    @update:open="
      (open) => {
        if (!open) deleteTarget = null;
      }
    "
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("pages.awards.delete_title", { name: deleteTarget?.name ?? "" })
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{
            deleteGrants
              ? $t(
                  "pages.awards.delete_body",
                  { count: deleteGrants },
                  deleteGrants,
                )
              : $t("pages.awards.delete_body_none")
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="deleting">{{
          $t("common.cancel")
        }}</AlertDialogCancel>
        <!-- Plain button: AlertDialogAction closes before the mutation runs. -->
        <Button variant="destructive" :disabled="deleting" @click="removeAward">
          {{ $t("pages.awards.delete_award") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { awardLedgerFields } from "~/graphql/awardLedgerFields";
import { TIER_PALETTES } from "~/utilities/awardSeed";
import { toast } from "@/components/ui/toast";
import {
  facetHits,
  matchesFacets,
  type FacetGroup,
  type FacetSelection,
} from "~/components/admin/facets";
import {
  AWARD_PAGE_SIZE,
  AWARD_TIERS,
  awardFacetValues,
  awardOwner,
  holderCount,
  matchesKind,
  matchesSearch,
  ownerLabel,
  sortAwards,
  type AwardKind,
  type AwardSort,
} from "~/components/award/awardLedger";

const OWNER_VALUES = ["global", "tournament", "event", "league", "season"];
const STATUS_VALUES = ["recent", "never", "open", "finished"];
const emptyFacets = (): FacetSelection => ({ owner: [], tier: [], status: [] });

export default {
  data() {
    return {
      awards: [] as any[],
      loadingAwards: true,
      search: "",
      kind: "all" as string,
      sort: "last" as string,
      sortReverse: false,
      facets: emptyFacets(),
      // What the table shows lags the controls by the 110ms the rows take to
      // fade out, so the old set leaves before the new one rises in.
      applied: {
        kind: "all" as AwardKind,
        sort: "last" as AwardSort,
        sortReverse: false,
        facets: emptyFacets(),
      },
      rowsFading: false,
      fadeTimer: null as ReturnType<typeof setTimeout> | null,
      epoch: 0,
      animateRows: false,
      staggerFrom: 0,
      limit: AWARD_PAGE_SIZE,
      detailOpen: false,
      detailId: null as string | null,
      editOpen: false,
      grantOpen: false,
      editAward: null as any,
      grantAward: null as any,
      deleteTarget: null as any,
      deleting: false,
    };
  },
  apollo: {
    $subscribe: {
      awards: {
        query: typedGql("subscription")({
          awards: [{ order_by: [{ name: order_by.asc }] }, awardLedgerFields],
        }),
        result: function (this: any, { data }: { data: any }) {
          this.awards = data.awards || [];
          this.loadingAwards = false;
        },
        // Without this a subscription error never clears loading and the
        // skeleton shows forever.
        error: function (this: any) {
          this.loadingAwards = false;
        },
      },
    },
  },
  beforeUnmount(this: any) {
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
  },
  watch: {
    filterSignature() {
      (this as any).applyFilters();
    },
    search() {
      (this as any).limit = AWARD_PAGE_SIZE;
      (this as any).animateRows = false;
    },
  },
  computed: {
    canManage(): boolean {
      return useApplicationSettingsStore().canManageAwards;
    },
    canGrantAwards(): boolean {
      return useApplicationSettingsStore().canGrantAwards;
    },
    kindOptions(): Array<{ key: string; label: string }> {
      return [
        { key: "all", label: this.$t("common.all") },
        { key: "custom", label: this.$t("pages.awards.kind_custom") },
        { key: "builtin", label: this.$t("pages.awards.built_in") },
      ];
    },
    filterSignature(): string {
      return JSON.stringify([
        this.kind,
        this.sort,
        this.sortReverse,
        this.facets,
      ]);
    },
    hasFacets(): boolean {
      return Object.values(this.facets as FacetSelection).some(
        (values) => values.length > 0,
      );
    },
    // The owner's name is searchable too ("Frostbite" finds its awards).
    ownerLabels(): Map<string, string> {
      const labels = new Map<string, string>();
      for (const award of this.awards) {
        labels.set(
          award.id,
          ownerLabel(awardOwner(award), (key, values) =>
            String(this.$t(key, values ?? {})),
          ),
        );
      }
      return labels;
    },
    searched(): any[] {
      const labels = this.ownerLabels as Map<string, string>;
      return this.awards.filter((award: any) =>
        matchesSearch(award, this.search, labels.get(award.id)),
      );
    },
    facetGroups(): FacetGroup[] {
      const now = Date.now();
      const pool = this.searched as any[];
      const values = (award: any, key: string) =>
        awardFacetValues(award, key, now);
      const kindFit = (award: any) =>
        matchesKind(award, this.kind as AwardKind);
      const option = (key: string, value: string, label: string) => ({
        value,
        label,
        empty:
          !this.loadingAwards &&
          facetHits(pool, key, value, this.facets, values, kindFit) === 0,
      });
      return [
        {
          key: "owner",
          label: String(this.$t("pages.awards.facet_belongs_to")),
          options: OWNER_VALUES.map((value) =>
            option(
              "owner",
              value,
              String(this.$t(`pages.awards.owner_kind.${value}`)),
            ),
          ),
        },
        {
          key: "tier",
          label: String(this.$t("pages.awards.tier")),
          options: AWARD_TIERS.map((value) => ({
            ...option(
              "tier",
              value,
              String(this.$t(`pages.awards.tiers.${value}`)),
            ),
            swatch: TIER_PALETTES[value as keyof typeof TIER_PALETTES].primary,
          })),
        },
        {
          key: "status",
          label: String(this.$t("common.status")),
          options: STATUS_VALUES.map((value) =>
            option(
              "status",
              value,
              String(this.$t(`pages.awards.status.${value}`)),
            ),
          ),
        },
      ];
    },
    visibleAwards(): any[] {
      const now = Date.now();
      const { kind, sort, sortReverse, facets } = this.applied;
      return sortAwards(
        (this.searched as any[]).filter(
          (award) =>
            matchesKind(award, kind) &&
            matchesFacets(award, facets, (row: any, key: string) =>
              awardFacetValues(row, key, now),
            ),
        ),
        sort,
        sortReverse,
      );
    },
    pagedAwards(): any[] {
      return (this.visibleAwards as any[]).slice(0, this.limit);
    },
    // Read from the live list so the sheet follows grants made elsewhere.
    detailAward(): any {
      return (
        this.awards.find((award: any) => award.id === this.detailId) ?? null
      );
    },
    deleteGrants(): number {
      return holderCount(this.deleteTarget);
    },
  },
  methods: {
    sortBy(key: AwardSort) {
      if (this.sort === key) {
        this.sortReverse = !this.sortReverse;
        return;
      }
      this.sort = key;
      this.sortReverse = false;
    },
    ariaSort(key: AwardSort) {
      if (this.sort !== key) return "none";
      // Name sorts A–Z first; holders and last granted sort largest first.
      const ascending = (key === "name") !== this.sortReverse;
      return ascending ? "ascending" : "descending";
    },
    applyFilters() {
      const next = {
        kind: this.kind as AwardKind,
        sort: this.sort as AwardSort,
        sortReverse: this.sortReverse as boolean,
        facets: JSON.parse(JSON.stringify(this.facets)) as FacetSelection,
      };
      const reduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (this.fadeTimer) clearTimeout(this.fadeTimer);
      const land = () => {
        this.applied = next;
        this.limit = AWARD_PAGE_SIZE;
        this.staggerFrom = 0;
        this.epoch++;
        this.animateRows = !reduced;
        this.rowsFading = false;
        this.fadeTimer = null;
      };
      if (reduced || this.loadingAwards) {
        land();
        return;
      }
      this.rowsFading = true;
      this.fadeTimer = setTimeout(land, 110);
    },
    showMore() {
      this.staggerFrom = this.limit;
      this.animateRows = true;
      this.limit += AWARD_PAGE_SIZE;
    },
    clearFacets() {
      this.facets = emptyFacets();
    },
    openCreate() {
      this.editAward = null;
      this.editOpen = true;
    },
    openEdit(award: any) {
      this.editAward = award;
      this.editOpen = true;
    },
    openGrantFor(award: any) {
      this.grantAward = award;
      this.grantOpen = true;
    },
    openDetail(award: any) {
      this.detailId = award.id;
      this.detailOpen = true;
    },
    async removeAward() {
      const award = this.deleteTarget;
      if (!award || this.deleting) return;
      this.deleting = true;
      try {
        await (this as any).$apollo.mutate({
          mutation: typedGql("mutation")({
            deleteAward: [{ id: $("id", "uuid!") }, { success: true }],
          }),
          variables: { id: award.id },
        });
        if (this.detailId === award.id) {
          this.detailOpen = false;
        }
        this.deleteTarget = null;
        toast({
          title: String(
            this.$t("pages.awards.deleted_toast", { name: award.name }),
          ),
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: String(this.$t("common.error")),
          description: error?.message,
        });
      } finally {
        this.deleting = false;
      }
    },
  },
};
</script>

<style scoped>
.award-sort {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: color 150ms ease;
}
.award-sort:hover,
.award-sort[data-active="true"] {
  color: hsl(var(--foreground));
}
.award-sort > span {
  font-size: 10px;
  color: hsl(var(--tac-amber));
}
</style>
