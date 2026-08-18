<script setup lang="ts">
import { dateLocale } from "~/utilities/dateLocale";
import AwardBadge from "~/components/award/AwardBadge.vue";
import AwardComposer from "~/components/award/AwardComposer.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import Pagination from "~/components/Pagination.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  tacticalCtaButtonClasses,
  tacticalHeaderActionClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { Medal, Trash2 } from "lucide-vue-next";
import { useAwardContext } from "~/composables/useAwardContext";

// Reflect the award name in the browser tab (nuxt.config's titleTemplate
// appends " | 5Stack"). The context is populated by the subscription in the
// Options block below, which cannot reach into <script setup>.
const awardContext = useAwardContext();
useHead({
  title: () => awardContext.value?.name || undefined,
});

// Same hero shell as the event/tournament pages: gradient card with corner
// brackets.
const heroCardClasses =
  "relative overflow-hidden rounded-lg border border-border px-4 py-4 sm:px-6 sm:py-5 [background:linear-gradient(180deg,hsl(var(--card)/0.82)_0%,hsl(var(--card)/0.6)_100%)] [backdrop-filter:blur(10px)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-[14px] before:w-[14px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-[14px] after:w-[14px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-['']";
const heroTitleClasses =
  "relative m-0 min-w-0 font-sans text-[clamp(1.6rem,4vw,2.8rem)] font-bold uppercase leading-[0.95] tracking-[0.02em] [font-stretch:80%]";

const chipClasses =
  "inline-flex items-center gap-1.5 rounded-sm border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.12)] px-[0.45rem] py-[0.1rem] font-mono text-[0.58rem] uppercase leading-none tracking-[0.14em] text-[hsl(var(--tac-amber))]";
</script>

<template>
  <PageTransition :delay="0">
    <div class="container mx-auto max-w-5xl space-y-5 py-6">
      <div v-if="loading" class="space-y-5">
        <Skeleton class="h-56 w-full rounded-lg" />
        <Skeleton class="h-96 w-full rounded-md" />
      </div>

      <Empty
        v-else-if="!award"
        class="min-h-[200px] border border-dashed border-border"
      >
        <EmptyTitle>{{ $t("pages.award_detail.not_found_title") }}</EmptyTitle>
        <EmptyDescription>{{
          $t("pages.award_detail.not_found")
        }}</EmptyDescription>
      </Empty>

      <template v-else>
        <!-- Hero: the specimen, uplit, beside its designation -->
        <header :class="heroCardClasses">
          <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div class="relative shrink-0 self-center sm:self-auto">
              <div
                class="pointer-events-none absolute inset-x-0 bottom-0 top-1/3 blur-3xl"
                :style="{
                  background: `radial-gradient(ellipse at center bottom, ${accent} 0%, transparent 65%)`,
                  opacity: 0.4,
                }"
                aria-hidden="true"
              ></div>
              <AwardBadge
                :award="award"
                :seed-key="award.id"
                size="lg"
                :interactive="false"
                :show-name="false"
                class="relative z-[1]"
              />
            </div>

            <div class="relative min-w-0 flex-1">
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <span
                  class="inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground"
                >
                  <span
                    class="inline-block h-1.5 w-1.5 rounded-full"
                    :style="{
                      background: accent,
                      boxShadow: `0 0 6px ${accent}`,
                    }"
                  ></span>
                  {{ tier }}
                </span>

                <span
                  v-if="award.system_key"
                  class="rounded-sm border border-border/80 px-1.5 py-[0.1rem] font-mono text-[0.5rem] uppercase leading-none tracking-[0.16em] text-muted-foreground/80"
                  :title="$t('pages.awards.built_in_hint')"
                >
                  {{ $t("pages.awards.built_in") }}
                </span>

                <NuxtLink
                  v-if="scope.label"
                  :to="scope.to"
                  :class="[
                    chipClasses,
                    scope.to
                      ? 'transition-colors duration-150 hover:border-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)]'
                      : '',
                  ]"
                >
                  {{ scope.label }}
                </NuxtLink>
              </div>

              <div class="flex flex-wrap items-start gap-3">
                <h1 :class="heroTitleClasses">{{ award.name }}</h1>
                <button
                  v-if="canGrantAwards"
                  type="button"
                  :class="[
                    tacticalCtaButtonClasses,
                    tacticalHeaderActionClasses,
                    'ml-auto max-md:aspect-square max-md:!px-0',
                  ]"
                  :title="$t('pages.awards.grant')"
                  @click="grantOpen = true"
                >
                  <Medal class="h-4 w-4" />
                  <span class="hidden md:inline">{{
                    $t("pages.awards.grant")
                  }}</span>
                </button>
              </div>

              <p
                v-if="award.description"
                class="mt-2 max-w-prose text-sm text-muted-foreground"
              >
                {{ award.description }}
              </p>
            </div>
          </div>
        </header>

        <!-- Data strip -->
        <dl
          class="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border/70 bg-border/70 text-xs sm:grid-cols-4"
        >
          <div class="flex min-w-0 flex-col gap-1 bg-background/60 p-3">
            <dt
              class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ $t("pages.award_detail.total_holders") }}
            </dt>
            <dd
              class="font-mono text-base font-bold leading-none tabular-nums"
              :style="{ color: accent }"
            >
              {{ String(totalGrants).padStart(2, "0") }}
            </dd>
          </div>
          <div class="flex min-w-0 flex-col gap-1 bg-background/60 p-3">
            <dt
              class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ $t("pages.award_detail.unique_players") }}
            </dt>
            <dd class="font-mono text-base font-bold leading-none tabular-nums">
              {{ String(uniquePlayerCount).padStart(2, "0") }}
              <span
                v-if="uniqueTeamCount"
                class="text-[0.62rem] font-normal tracking-[0.12em] text-muted-foreground"
              >
                · {{ uniqueTeamCount }}
                {{ $t("pages.award_detail.unique_teams") }}
              </span>
            </dd>
          </div>
          <div class="flex min-w-0 flex-col gap-1 bg-background/60 p-3">
            <dt
              class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ $t("pages.award_detail.first_granted") }}
            </dt>
            <dd class="font-mono text-[0.7rem] font-semibold tracking-[0.08em]">
              {{ formatDate(firstGrantAt) || "—" }}
            </dd>
          </div>
          <div class="flex min-w-0 flex-col gap-1 bg-background/60 p-3">
            <dt
              class="font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              {{ $t("pages.award_detail.last_granted") }}
            </dt>
            <dd class="font-mono text-[0.7rem] font-semibold tracking-[0.08em]">
              {{ formatDate(latestGrantAt) || "—" }}
            </dd>
          </div>
        </dl>

        <!-- Holders -->
        <section class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div :class="[tacticalSectionLabelClasses, 'mb-0']">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.award_detail.holders_section") }}
              <span v-if="holders.length" :class="chipClasses">
                {{ String(holders.length).padStart(2, "0") }}
              </span>
            </div>

            <!-- Only worth a control when the award actually has both kinds;
                 otherwise it restates the list. -->
            <AnimatedFilters
              v-if="playerHolders.length && teamHolders.length"
              v-model="holderFilter"
              square
              :options="holderFilterOptions"
            />
          </div>

          <Empty
            v-if="!holders.length"
            class="min-h-[160px] border border-dashed border-border"
          >
            <EmptyTitle>{{
              $t("pages.award_detail.no_holders_title")
            }}</EmptyTitle>
            <EmptyDescription>{{
              $t("pages.award_detail.no_holders")
            }}</EmptyDescription>
          </Empty>

          <template v-else>
            <TransitionGroup
              tag="ul"
              name="grant"
              class="relative divide-y divide-border/60 overflow-hidden rounded-lg border border-border bg-card/30 [backdrop-filter:blur(6px)]"
            >
              <li
                v-for="row in pagedHolders"
                :key="row.id"
                class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
              >
                <!-- Recipient -->
                <div class="min-w-0 flex-1 basis-[13rem]">
                  <PlayerDisplay
                    v-if="row.player_steam_id"
                    :player="row.player"
                    linkable
                    size="xs"
                    truncate-name
                  />
                  <NuxtLink
                    v-else
                    :to="teamLinkFor(row)"
                    class="group/team flex min-w-0 items-center gap-2"
                  >
                    <Avatar shape="square" class="h-8 w-8 shrink-0">
                      <AvatarImage
                        v-if="teamAvatarFor(row)"
                        :src="teamAvatarFor(row)"
                        :alt="teamNameFor(row)"
                      />
                      <AvatarFallback>{{
                        teamNameFor(row).slice(0, 2)
                      }}</AvatarFallback>
                    </Avatar>
                    <span class="min-w-0">
                      <span
                        class="block truncate text-sm font-semibold group-hover/team:text-[hsl(var(--tac-amber))]"
                      >
                        {{ teamNameFor(row) }}
                      </span>
                      <span
                        class="font-mono text-[0.55rem] uppercase tracking-[0.24em] text-muted-foreground"
                      >
                        {{ $t("awards_manage_form.team") }}
                      </span>
                    </span>
                  </NuxtLink>
                </div>

                <!-- Context: where it was earned -->
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    v-if="row.placement !== null && row.placement !== undefined"
                    class="rounded-sm border px-1.5 py-[0.1rem] font-mono text-[0.55rem] uppercase leading-none tracking-[0.18em]"
                    :style="{
                      borderColor: rowColor(row) + '55',
                      background: rowColor(row) + '14',
                      color: rowColor(row),
                    }"
                  >
                    {{ $t(placementLabelKey(row)) }}
                  </span>

                  <NuxtLink
                    :to="contextOf(row).to"
                    class="min-w-0 truncate font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
                    :class="
                      contextOf(row).to
                        ? 'transition-colors duration-150 hover:text-[hsl(var(--tac-amber))]'
                        : ''
                    "
                  >
                    {{ contextOf(row).label }}
                  </NuxtLink>
                </div>

                <p
                  v-if="row.note"
                  class="min-w-0 basis-full truncate text-xs italic text-muted-foreground sm:basis-auto sm:max-w-[14rem]"
                  :title="row.note"
                >
                  {{ row.note }}
                </p>

                <span class="flex-1"></span>

                <!-- Who handed it out only matters on hover, and only manual
                     grants have anyone to name. -->
                <span
                  class="shrink-0 font-mono text-[0.6rem] tracking-[0.12em] tabular-nums text-muted-foreground"
                  :title="
                    row.awarded_by?.name
                      ? $t('pages.award_detail.granted_by', {
                          name: row.awarded_by.name,
                        })
                      : undefined
                  "
                >
                  {{ formatDate(row.created_at) }}
                </span>

                <button
                  v-if="canGrantAwards"
                  type="button"
                  class="grid h-8 w-8 shrink-0 place-items-center rounded border border-border/80 text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--destructive)/0.55)] hover:bg-[hsl(var(--destructive)/0.12)] hover:text-destructive"
                  :title="$t('pages.award_detail.revoke')"
                  :aria-label="$t('pages.award_detail.revoke')"
                  @click="revokeTarget = row"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </li>
            </TransitionGroup>

            <Pagination
              v-if="filteredHolders.length > perPage"
              :total="filteredHolders.length"
              :page="page"
              :per-page="perPage"
              @page="page = $event"
            />
          </template>
        </section>
      </template>
    </div>
  </PageTransition>

  <AwardComposer
    v-if="grantOpen && award"
    v-model:open="grantOpen"
    :award-id="award.id"
    :award="award"
    grant
    @saved="grantOpen = false"
  />

  <AlertDialog
    :open="!!revokeTarget"
    @update:open="
      (open) => {
        if (!open) revokeTarget = null;
      }
    "
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("pages.award_detail.confirm_revoke.title")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{
            $t("pages.award_detail.confirm_revoke.description", {
              name: revokeTarget ? recipientNameFor(revokeTarget) : "",
            })
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="revoking">{{
          $t("common.cancel")
        }}</AlertDialogCancel>
        <!-- Plain button — radix's AlertDialogAction auto-closes before the
             async mutation can run, nulling revokeTarget first. -->
        <button
          type="button"
          :disabled="revoking"
          class="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50"
          @click="revoke"
        >
          {{ $t("pages.award_detail.revoke") }}
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { validate as validateUUID } from "uuid";
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import {
  awardCatalogFields,
  awardRecipientDetailFields,
} from "~/graphql/awardFields";
import { TIER_PALETTES, resolveAwardTier } from "~/utilities/awardSeed";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";

const TIER_COLORS: Record<string, string> = {
  mvp: "hsl(195 85% 60%)",
  gold: "hsl(45 95% 60%)",
  silver: "hsl(0 0% 78%)",
  bronze: "hsl(28 70% 52%)",
  special: "hsl(258 90% 74%)",
};

export default {
  data() {
    return {
      award: undefined as any,
      loading: true,
      holderFilter: "all",
      page: 1,
      perPage: 20,
      grantOpen: false,
      revokeTarget: null as any,
      revoking: false,
    };
  },
  apollo: {
    $subscribe: {
      awards_by_pk: {
        query: typedGql("subscription")({
          awards_by_pk: [
            { id: $("awardId", "uuid!") },
            {
              ...awardCatalogFields,
              created_at: true,
              recipients_aggregate: [
                {},
                {
                  aggregate: {
                    count: true,
                    min: { created_at: true },
                    max: { created_at: true },
                  },
                },
              ],
              recipients: [
                { order_by: [{ created_at: order_by.desc }] },
                awardRecipientDetailFields,
              ],
            },
          ],
        }),
        skip: function (this: any) {
          const id = this.$route.params.id;
          return typeof id !== "string" || !validateUUID(id);
        },
        variables: function (this: any) {
          const id = this.$route.params.id;
          // A malformed id would error the subscription, and without this the
          // skeleton would never come down.
          if (typeof id !== "string" || !validateUUID(id)) {
            this.award = null;
            this.loading = false;
            return undefined;
          }
          return { awardId: id };
        },
        result: function (this: any, { data }: { data: any }) {
          this.award = data?.awards_by_pk ?? null;
          this.loading = false;
          useAwardContext().value = this.award
            ? { id: this.award.id, name: this.award.name }
            : null;
        },
        // Without this a subscription error never clears loading and the
        // skeleton shows forever.
        error: function (this: any) {
          this.loading = false;
        },
      },
    },
  },
  mounted() {
    // skip() never fires result(), so a bad id would sit on the skeleton.
    const id = this.$route.params.id;
    if (typeof id !== "string" || !validateUUID(id)) {
      this.award = null;
      this.loading = false;
    }
  },
  unmounted() {
    useAwardContext().value = null;
  },
  watch: {
    // Filtering to a smaller set must not strand the reader on a page that no
    // longer exists.
    holderFilter() {
      this.page = 1;
    },
  },
  computed: {
    tier(): string {
      // The definition, not a grant, so there is no placement to resolve from.
      return resolveAwardTier(null, this.award?.tier);
    },
    accent(): string {
      return (TIER_PALETTES as any)[this.tier]?.primary ?? TIER_COLORS.special;
    },
    canGrantAwards(): boolean {
      return useApplicationSettingsStore().canGrantAwards;
    },
    apiDomain(): string {
      return useRuntimeConfig().public.apiDomain as string;
    },
    // Newest first, with the better placement leading inside a shared moment
    // (a bracket calculation stamps all of its grants at once).
    holders(): any[] {
      return [...((this.award?.recipients as any[]) || [])].sort((a, b) => {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        if (da !== db) return db - da;
        return (a.placement ?? 99) - (b.placement ?? 99);
      });
    },
    playerHolders(): any[] {
      return this.holders.filter((row: any) => !!row.player_steam_id);
    },
    teamHolders(): any[] {
      return this.holders.filter((row: any) => !row.player_steam_id);
    },
    filteredHolders(): any[] {
      if (this.holderFilter === "players") return this.playerHolders;
      if (this.holderFilter === "teams") return this.teamHolders;
      return this.holders;
    },
    pagedHolders(): any[] {
      const start = (this.page - 1) * this.perPage;
      return this.filteredHolders.slice(start, start + this.perPage);
    },
    holderFilterOptions(): Array<{
      key: string;
      label: string;
      count: number;
    }> {
      return [
        {
          key: "all",
          label: this.$t("pages.award_detail.filter_all"),
          count: this.holders.length,
        },
        {
          key: "players",
          label: this.$t("pages.award_detail.filter_players"),
          count: this.playerHolders.length,
        },
        {
          key: "teams",
          label: this.$t("pages.award_detail.filter_teams"),
          count: this.teamHolders.length,
        },
      ];
    },
    totalGrants(): number {
      return this.award?.recipients_aggregate?.aggregate?.count ?? 0;
    },
    // Counted off the loaded rows: a distinct aggregate would need a second
    // aliased selection for what is already in memory.
    uniquePlayerCount(): number {
      return new Set(
        this.playerHolders.map((row: any) => String(row.player_steam_id)),
      ).size;
    },
    uniqueTeamCount(): number {
      return new Set(
        this.teamHolders
          .map((row: any) => row.team_id || row.tournament_team?.team_id)
          .filter(Boolean),
      ).size;
    },
    firstGrantAt(): string | null {
      return (
        this.award?.recipients_aggregate?.aggregate?.min?.created_at ?? null
      );
    },
    latestGrantAt(): string | null {
      return (
        this.award?.recipients_aggregate?.aggregate?.max?.created_at ?? null
      );
    },
    // What the award itself belongs to, which is not necessarily where any one
    // grant was handed out.
    scope(): { label: string; to: string | null } {
      const award = this.award;
      if (!award) return { label: "", to: null };
      if (award.tournament_id) {
        return {
          label: award.tournament?.name ?? this.$t("pages.awards.scope_gone"),
          to: `/tournaments/${award.tournament_id}`,
        };
      }
      if (award.event_id) {
        return {
          label: award.event?.name ?? this.$t("pages.awards.scope_gone"),
          to: `/events/${award.event_id}`,
        };
      }
      if (award.season_id) {
        return {
          label: award.season
            ? this.$t("pages.awards.season_label", {
                number: award.season.number,
              })
            : this.$t("pages.awards.scope_gone"),
          to: null,
        };
      }
      if (award.league_season_id) {
        return {
          label:
            award.league_season?.name ?? this.$t("pages.awards.scope_gone"),
          to: `/league/seasons/${award.league_season_id}`,
        };
      }
      return { label: "", to: null };
    },
  },
  methods: {
    formatDate(iso?: string | null): string {
      if (!iso) return "";
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return "";
      return date
        .toLocaleDateString(dateLocale(), {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase();
    },
    // A team grant is one with no player on it.
    teamNameFor(row: any): string {
      return (
        row.team?.name ||
        row.team?.short_name ||
        row.tournament_team?.name ||
        this.$t("awards_manage_form.team")
      );
    },
    teamLinkFor(row: any): string | null {
      const id = row.team_id || row.team?.id || row.tournament_team?.team_id;
      return id ? `/teams/${id}` : null;
    },
    teamAvatarFor(row: any): string {
      return resolveAvatarUrl(row.team?.avatar_url, this.apiDomain) ?? "";
    },
    recipientNameFor(row: any): string {
      if (!row.player_steam_id) return this.teamNameFor(row);
      return row.player?.name || String(row.player_steam_id);
    },
    placementLabelKey(row: any): string {
      if (row.placement === 0) return "awards.mvp";
      if (row.placement === 1) return "awards.first_place";
      if (row.placement === 2) return "awards.second_place";
      if (row.placement === 3) return "awards.third_place";
      return "awards.granted";
    },
    rowColor(row: any): string {
      return (
        TIER_COLORS[resolveAwardTier(row.placement, this.award?.tier)] ??
        TIER_COLORS.special
      );
    },
    // Where this particular grant was earned. Falls back to how it was handed
    // out when the grant is not pinned to anything.
    contextOf(row: any): { label: string; to: string | null } {
      if (row.tournament_id) {
        return {
          label: row.tournament?.name ?? this.$t("pages.awards.scope_gone"),
          to: `/tournaments/${row.tournament_id}`,
        };
      }
      if (row.event_id) {
        return {
          label: row.event?.name ?? this.$t("pages.awards.scope_gone"),
          to: `/events/${row.event_id}`,
        };
      }
      if (row.season_id) {
        return {
          label: row.season
            ? this.$t("pages.awards.season_label", {
                number: row.season.number,
              })
            : this.$t("pages.awards.scope_gone"),
          to: null,
        };
      }
      if (row.league_season_id) {
        return {
          label: row.league_season?.name ?? this.$t("pages.awards.scope_gone"),
          to: `/league/seasons/${row.league_season_id}`,
        };
      }
      return {
        label: this.$t(`pages.award_detail.source_${row.source}`),
        to: null,
      };
    },
    async revoke() {
      const row = this.revokeTarget;
      if (!row || this.revoking) return;
      this.revoking = true;
      try {
        await (this as any).$apollo.mutate({
          mutation: typedGql("mutation")({
            revokeAward: [{ id: $("id", "uuid!") }, { success: true }],
          }),
          variables: { id: row.id },
        });
        this.revokeTarget = null;
      } catch (error) {
        console.error("Failed to revoke award", error);
      } finally {
        this.revoking = false;
      }
    },
  },
};
</script>

<style scoped>
/* Revoked rows collapse out rather than vanishing, so the list reads as a
   change rather than a repaint. */
.grant-move,
.grant-enter-active,
.grant-leave-active {
  transition:
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 200ms ease;
}

.grant-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}

.grant-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

/* Taking leaving rows out of flow lets the survivors slide up smoothly. */
.grant-leave-active {
  position: absolute;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .grant-move,
  .grant-enter-active,
  .grant-leave-active {
    transition: none;
  }
}
</style>
