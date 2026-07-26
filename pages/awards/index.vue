<script setup lang="ts">
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import AwardVitrine from "~/components/award/AwardVitrine.vue";
import AwardComposer from "~/components/award/AwardComposer.vue";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import {
  tacticalCtaButtonClasses,
  tacticalHeaderActionClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { Plus, Search, X } from "lucide-vue-next";

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
  <PageTransition :delay="0">
    <div class="container mx-auto max-w-6xl space-y-5 py-6">
      <TacticalPageHeader>
        <template #title>{{ $t("pages.awards.title") }}</template>
        <template #subtitle>{{ $t("pages.awards.description") }}</template>
        <template #actions>
          <button
            v-if="canManage"
            type="button"
            :class="[
              tacticalCtaButtonClasses,
              tacticalHeaderActionClasses,
              'max-md:aspect-square max-md:!px-0',
            ]"
            :title="$t('pages.awards.new_award')"
            @click="openCreate"
          >
            <Plus class="h-4 w-4" />
            <span class="hidden md:inline">{{
              $t("pages.awards.new_award")
            }}</span>
          </button>
        </template>
      </TacticalPageHeader>

      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div :class="[tacticalSectionLabelClasses, 'mb-0']">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("pages.awards.catalog_section") }}
            <span
              v-if="awards.length"
              class="rounded-sm border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.12)] px-[0.4rem] py-[0.02rem] text-[0.62rem] tracking-[0.12em] text-[hsl(var(--tac-amber))]"
            >
              {{ String(visibleAwards.length).padStart(2, "0")
              }}<template v-if="visibleAwards.length !== awards.length"
                >/{{ String(awards.length).padStart(2, "0") }}</template
              >
            </span>
          </div>

          <div v-if="awards.length" class="flex flex-wrap items-center gap-2">
            <div class="relative">
              <Search
                class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <input
                v-model="search"
                type="search"
                :placeholder="$t('pages.awards.search_placeholder')"
                :aria-label="$t('pages.awards.search_placeholder')"
                class="h-8 w-[11rem] rounded-md border border-border bg-muted/30 pl-7 pr-2 font-mono text-[0.68rem] tracking-[0.06em] text-foreground placeholder:text-muted-foreground focus:border-[hsl(var(--tac-amber)/0.55)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
            </div>

            <!-- Tier options carry their counts, so the rack the player trophy
                 case shows doubles as the filter here. -->
            <AnimatedFilters
              v-model="tierFilter"
              square
              :options="tierFilterOptions"
            />
          </div>
        </div>

        <div
          v-if="loadingAwards"
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          <Skeleton
            v-for="i in 5"
            :key="i"
            class="h-[19rem] w-full rounded-lg"
          />
        </div>

        <Empty
          v-else-if="!awards.length"
          class="min-h-[200px] border border-dashed border-border"
        >
          <EmptyTitle>{{ $t("pages.awards.no_awards_title") }}</EmptyTitle>
          <EmptyDescription>{{
            $t("pages.awards.no_awards")
          }}</EmptyDescription>
        </Empty>

        <Empty
          v-else-if="!visibleAwards.length"
          class="min-h-[200px] border border-dashed border-border"
        >
          <EmptyTitle>{{ $t("pages.awards.no_matches_title") }}</EmptyTitle>
          <EmptyDescription>{{
            $t("pages.awards.no_matches")
          }}</EmptyDescription>
          <Button
            variant="outline"
            size="sm"
            class="gap-2"
            @click="clearFilters"
          >
            <X class="h-3.5 w-3.5" />
            {{ $t("pages.awards.clear_filters") }}
          </Button>
        </Empty>

        <div
          v-else
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          <AwardVitrine
            v-for="(award, i) in visibleAwards"
            :key="award.id"
            :award="award"
            :index="i"
            :can-manage="canManage"
            :can-grant="canGrantAwards"
            @edit="openEdit(award)"
            @grant="openGrantFor(award)"
            @remove="removeAward(award)"
          />
        </div>
      </section>
    </div>
  </PageTransition>

  <AwardComposer
    v-if="editOpen"
    v-model:open="editOpen"
    :award-id="editAwardId || null"
    @saved="editOpen = false"
  />

  <AwardComposer
    v-if="grantOpen"
    v-model:open="grantOpen"
    :award-id="grantAwardId || null"
    @saved="grantOpen = false"
  />
</template>

<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { awardDefinitionFields } from "~/graphql/awardFields";
import { TIER_PALETTES, resolveAwardTier } from "~/utilities/awardSeed";
import { toast } from "@/components/ui/toast";

const TIERS = ["special", "mvp", "gold", "silver", "bronze"];

export default {
  data() {
    return {
      TIERS,
      awards: [] as any[],
      loadingAwards: true,
      search: "",
      tierFilter: "all",
      editOpen: false,
      grantOpen: false,
      editAwardId: "",
      grantAwardId: "",
    };
  },
  apollo: {
    $subscribe: {
      awards: {
        query: typedGql("subscription")({
          awards: [
            { order_by: [{ name: order_by.asc }] },
            {
              ...awardDefinitionFields,
              recipients_aggregate: [{}, { aggregate: { count: true } }],
            },
          ],
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
  computed: {
    tierFilterOptions(): Array<{ key: string; label: string; count: number }> {
      return [
        {
          key: "all",
          label: this.$t("pages.awards.all_tiers"),
          count: this.awards.length,
        },
        ...this.tierIndex.map((entry) => ({
          key: entry.tier,
          label: entry.tier,
          count: entry.count,
        })),
      ];
    },
    visibleAwards(): any[] {
      const term = this.search.trim().toLowerCase();
      return this.awards.filter((award: any) => {
        if (
          this.tierFilter !== "all" &&
          resolveAwardTier(null, award.tier) !== this.tierFilter
        ) {
          return false;
        }
        if (!term) {
          return true;
        }
        return `${award.name ?? ""} ${award.description ?? ""}`
          .toLowerCase()
          .includes(term);
      });
    },
    // Ordered mvp -> special, skipping tiers nothing occupies.
    tierIndex(): Array<{ tier: string; count: number; accent: string }> {
      const order = ["mvp", "gold", "silver", "bronze", "special"] as const;
      const counts = new Map<string, number>();
      for (const award of this.awards) {
        const tier = resolveAwardTier(null, award.tier);
        counts.set(tier, (counts.get(tier) ?? 0) + 1);
      }
      return order
        .filter((tier) => (counts.get(tier) ?? 0) > 0)
        .map((tier) => ({
          tier,
          count: counts.get(tier) as number,
          accent: TIER_PALETTES[tier].primary,
        }));
    },
    canManage() {
      return useApplicationSettingsStore().canManageAwards;
    },
    canGrantAwards() {
      return useApplicationSettingsStore().canGrantAwards;
    },
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    // Feeds the live preview so the sheet shows the award being built.
  },
  methods: {
    clearFilters() {
      this.search = "";
      this.tierFilter = "all";
    },
    openCreate() {
      this.editAwardId = "";
      this.editOpen = true;
    },
    openEdit(award: any) {
      this.editAwardId = award.id;
      this.editOpen = true;
    },
    openGrantFor(award: any | null) {
      this.grantAwardId = award?.id || "";
      this.grantOpen = true;
    },
    async removeAward(award: any) {
      await (this as any).$apollo.mutate({
        mutation: typedGql("mutation")({
          deleteAward: [{ id: $("id", "uuid!") }, { success: true }],
        }),
        variables: { id: award.id },
      });
    },
  },
};
</script>
