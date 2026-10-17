<script setup lang="ts">
import { getCurrentInstance, ref } from "vue";
import { Button } from "~/components/ui/button";
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
import AdminSearch from "~/components/admin/AdminSearch.vue";
import SortHeader from "~/components/admin/SortHeader.vue";
import AwardComposer from "~/components/award/AwardComposer.vue";
import AwardDetailSheet from "~/components/award/AwardDetailSheet.vue";
import AwardLedgerRow from "~/components/award/AwardLedgerRow.vue";
import { awardLedgerColumns } from "~/components/award/awardLedger";
import {
  createButtonClasses,
  listCreateButtonClasses,
} from "~/utilities/tacticalClasses";
import { Info, Plus } from "lucide-vue-next";
import { useListKeyboard } from "~/composables/useListKeyboard";

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

// ↑/↓ walk the ledger, Enter opens the award's sheet. The rows live in the
// Options half; they are read lazily, after data() exists.
const instance = getCurrentInstance();
const page = () => instance?.proxy as any;
const activeAwardId = ref<string | null>(null);
const ledgerKeys = useListKeyboard({
  items: () => page()?.pagedAwards ?? [],
  getId: (award: any) => award.id,
  activeId: activeAwardId,
  onOpen: (id) => page()?.openDetailById(id),
});
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.awards.title") }}</h1>

  <PageTransition :delay="0">
    <div class="grid gap-4">
      <div
        v-if="loadingAwards || awards.length"
        class="flex flex-wrap items-center gap-2"
      >
        <AdminSearch
          v-model="search"
          shortcut
          :placeholder="$t('pages.awards.search_placeholder')"
        />

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
            <Button variant="outline" size="sm" @click="clearFilters">
              {{ $t("common.clear_filters") }}
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
                <SortHeader
                  as="span"
                  sort-key="name"
                  :label="$t('pages.awards.col_award')"
                  :active="sort"
                  :dir="dir"
                  @sort="sortBy"
                />
                <span role="columnheader" class="max-md:hidden">{{
                  $t("pages.awards.facet_belongs_to")
                }}</span>
                <span role="columnheader">{{ $t("pages.awards.tier") }}</span>
                <SortHeader
                  as="span"
                  class="text-right"
                  align="end"
                  sort-key="holders"
                  :label="$t('pages.awards.col_holders')"
                  :active="sort"
                  :dir="dir"
                  @sort="sortBy"
                />
                <SortHeader
                  as="span"
                  class="text-right max-md:hidden"
                  align="end"
                  sort-key="last"
                  :label="$t('pages.awards.sort_last_granted')"
                  :active="sort"
                  :dir="dir"
                  @sort="sortBy"
                />
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
                  v-bind="ledgerKeys.rowProps(award.id)"
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
import { nextSort, type SortDir } from "~/components/admin/sort";
import {
  readRememberedView,
  saveRememberedView,
} from "~/composables/useRememberedView";
import {
  facetHits,
  matchesFacets,
  type FacetGroup,
  type FacetSelection,
} from "~/components/admin/facets";
import {
  AWARD_OWNER_VALUES,
  AWARD_PAGE_SIZE,
  AWARD_SORT_DIRS,
  AWARD_STATUS_VALUES,
  AWARD_TIERS,
  awardFacetValues,
  awardViewDefaults,
  awardViewValidators,
  emptyAwardFacets,
  awardOwner,
  holderCount,
  matchesKind,
  matchesSearch,
  ownerLabel,
  sortAwards,
  type AwardKind,
  type AwardSort,
} from "~/components/award/awardLedger";

export default {
  data() {
    // The ledger opens the way it was left: search, kind, sort and facets.
    const view = readRememberedView(
      "awards",
      awardViewDefaults(),
      awardViewValidators,
    );
    return {
      awards: [] as any[],
      loadingAwards: true,
      search: view.search,
      kind: view.kind as string,
      sort: view.sort as AwardSort,
      dir: view.dir as SortDir,
      facets: view.facets as FacetSelection,
      // What the table shows lags the controls by the 110ms the rows take to
      // fade out, so the old set leaves before the new one rises in.
      applied: {
        kind: view.kind,
        sort: view.sort,
        dir: view.dir,
        facets: JSON.parse(JSON.stringify(view.facets)) as FacetSelection,
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
    viewSignature() {
      saveRememberedView(
        "awards",
        {
          search: this.search,
          kind: this.kind as AwardKind,
          sort: this.sort,
          dir: this.dir,
          facets: this.facets as any,
        },
        awardViewDefaults(),
      );
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
      return JSON.stringify([this.kind, this.sort, this.dir, this.facets]);
    },
    viewSignature(): string {
      return JSON.stringify([this.filterSignature, this.search]);
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
          options: AWARD_OWNER_VALUES.map((value) =>
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
          options: AWARD_STATUS_VALUES.map((value) =>
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
      const { kind, sort, dir, facets } = this.applied;
      return sortAwards(
        (this.searched as any[]).filter(
          (award) =>
            matchesKind(award, kind) &&
            matchesFacets(award, facets, (row: any, key: string) =>
              awardFacetValues(row, key, now),
            ),
        ),
        sort,
        dir,
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
    sortBy(key: string) {
      const next = nextSort(
        { key: this.sort, dir: this.dir },
        key as AwardSort,
        AWARD_SORT_DIRS,
      );
      this.sort = next.key;
      this.dir = next.dir;
    },
    applyFilters() {
      const next = {
        kind: this.kind as AwardKind,
        sort: this.sort as AwardSort,
        dir: this.dir as SortDir,
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
    clearFilters() {
      this.search = "";
      this.kind = "all";
      this.facets = emptyAwardFacets();
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
    openDetailById(id: string) {
      const award = this.awards.find((row: any) => row.id === id);
      if (award) this.openDetail(award);
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
