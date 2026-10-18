<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient, useSubscription } from "@vue/apollo-composable";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Medal,
  Pencil,
  Trash2,
  X,
} from "lucide-vue-next";
import AwardBadge from "./AwardBadge.vue";
import AwardGrantInline from "./AwardGrantInline.vue";
import StatTile from "~/components/admin/StatTile.vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import LastChanged from "~/components/admin/LastChanged.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { toast } from "~/components/ui/toast";
import {
  createButtonClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { TIER_PALETTES, resolveAwardTier } from "~/utilities/awardSeed";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { awardRecipientDetailFields } from "~/graphql/awardFields";
import { awardLedgerFields } from "~/graphql/awardLedgerFields";
import { lastChangedKey, useLastChanged } from "~/composables/useLastChanged";
import {
  automationLabel,
  awardOwner,
  formatAwardDate,
  isBuiltIn,
  ownerIsLive,
  ownerLabel,
  ownerStatusText,
} from "./awardLedger";

// The award's own sheet, opened from a ledger row: what it is, who holds it,
// grant and revoke in place, edit and delete.
const props = withDefaults(
  defineProps<{
    open: boolean;
    /** The ledger row, so the sheet reads as its award before its query lands. */
    award: any;
    canManage?: boolean;
    canGrant?: boolean;
  }>(),
  { canManage: false, canGrant: false },
);

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "edit", award: any): void;
  (e: "delete", award: any): void;
}>();

const { t } = useI18n();
const { client } = useApolloClient();

const PER_PAGE = 20;

const { result, loading } = useSubscription(
  typedGql("subscription")({
    awards_by_pk: [
      { id: $("awardId", "uuid!") },
      {
        ...awardLedgerFields,
        updated_at: true,
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
  () => ({ awardId: props.award?.id }),
  () => ({ enabled: props.open && !!props.award?.id }),
);

const detail = computed<any>(() => {
  const row = (result.value as any)?.awards_by_pk;
  return row && row.id === props.award?.id ? row : null;
});
const view = computed<any>(() => detail.value ?? props.award ?? {});

// Who changed it last, once the api stamps that; until then, or for an award
// not edited since, when it was last saved.
const { at: stampedAt, by: stampedBy } = useLastChanged(
  "awards",
  () => props.award?.id ?? null,
  () => lastChangedKey("awards", detail.value),
);
const changedAt = computed<string | null>(
  () => stampedAt.value ?? detail.value?.updated_at ?? null,
);

const tier = computed(() => resolveAwardTier(null, view.value.tier));
const builtIn = computed(() => isBuiltIn(view.value));
const owner = computed(() => awardOwner(view.value));
const ownerName = computed(() => ownerLabel(owner.value, t));
const ownerStatus = computed(() => ownerStatusText(owner.value, t));

const subtitle = computed(() => {
  const parts = [t(`pages.awards.tiers.${tier.value}`)];
  if (builtIn.value) parts.push(automationLabel(view.value, t));
  else if (owner.value) parts.push(ownerName.value, ownerStatus.value);
  else parts.push(t("pages.awards.scope_global"));
  return parts.join(" · ");
});

const holders = computed<any[]>(() =>
  [...((detail.value?.recipients as any[]) ?? [])].sort((a, b) => {
    const da = new Date(a.created_at || 0).getTime();
    const db = new Date(b.created_at || 0).getTime();
    return db - da || (a.placement ?? 99) - (b.placement ?? 99);
  }),
);
const playerHolders = computed(() =>
  holders.value.filter((row) => !!row.player_steam_id),
);
const teamHolders = computed(() =>
  holders.value.filter((row) => !row.player_steam_id),
);

const holderFilter = ref("all");
const page = ref(1);
const granting = ref(false);
const freshIds = ref<string[]>([]);

const holderOptions = computed(() => [
  { key: "all", label: t("pages.award_detail.filter_all") },
  { key: "players", label: t("pages.award_detail.filter_players") },
  { key: "teams", label: t("pages.award_detail.filter_teams") },
]);
const showHolderFilter = computed(
  () => playerHolders.value.length > 0 && teamHolders.value.length > 0,
);
const filteredHolders = computed(() => {
  if (holderFilter.value === "players") return playerHolders.value;
  if (holderFilter.value === "teams") return teamHolders.value;
  return holders.value;
});
const pages = computed(() =>
  Math.max(1, Math.ceil(filteredHolders.value.length / PER_PAGE)),
);
const pagedHolders = computed(() =>
  filteredHolders.value.slice(
    (page.value - 1) * PER_PAGE,
    page.value * PER_PAGE,
  ),
);

watch(holderFilter, () => (page.value = 1));
watch(pages, (count) => {
  if (page.value > count) page.value = count;
});
watch([() => props.open, () => props.award?.id], () => {
  holderFilter.value = "all";
  page.value = 1;
  granting.value = false;
  freshIds.value = [];
});

const stats = computed(() => {
  const aggregate = detail.value?.recipients_aggregate?.aggregate;
  const teams = new Set(
    teamHolders.value
      .map((row) => row.team_id || row.tournament_team?.team_id)
      .filter(Boolean),
  ).size;
  return {
    grants:
      aggregate?.count ??
      view.value?.recipients_aggregate?.aggregate?.count ??
      0,
    players: new Set(
      playerHolders.value.map((row) => String(row.player_steam_id)),
    ).size,
    teams,
    first: aggregate?.min?.created_at ?? null,
    last:
      aggregate?.max?.created_at ??
      view.value?.recipients_aggregate?.aggregate?.max?.created_at ??
      null,
  };
});

const accent = computed(() => TIER_PALETTES[tier.value].primary);

const apiDomain = computed(() => useRuntimeConfig().public.apiDomain as string);

function teamNameFor(row: any): string {
  return (
    row.team?.name ||
    row.team?.short_name ||
    row.tournament_team?.name ||
    t("awards_manage_form.team")
  );
}

function teamAvatarFor(row: any): string {
  return resolveAvatarUrl(row.team?.avatar_url, apiDomain.value, 128) ?? "";
}

function teamLinkFor(row: any): string | undefined {
  const id = row.team_id || row.team?.id || row.tournament_team?.team_id;
  return id ? `/teams/${id}` : undefined;
}

function recipientName(row: any): string {
  if (!row.player_steam_id) return teamNameFor(row);
  return row.player?.name || String(row.player_steam_id);
}

function placementLabel(row: any): string | null {
  if (row.placement === 0) return t("awards.mvp");
  if (row.placement === 1) return t("awards.first_place");
  if (row.placement === 2) return t("awards.second_place");
  if (row.placement === 3) return t("awards.third_place");
  return null;
}

function placementColor(row: any): string {
  return TIER_PALETTES[resolveAwardTier(row.placement, view.value.tier)]
    .primary;
}

// Where this grant was earned, which is not always where the award belongs.
function contextOf(row: any): { label: string; to?: string } {
  if (row.tournament_id) {
    return {
      label: row.tournament?.name ?? t("pages.awards.scope_gone"),
      to: `/tournaments/${row.tournament_id}`,
    };
  }
  if (row.event_id) {
    return {
      label: row.event?.name ?? t("pages.awards.scope_gone"),
      to: `/events/${row.event_id}`,
    };
  }
  if (row.season_id) {
    return {
      label: row.season
        ? t("pages.awards.season_label", { number: row.season.number })
        : t("pages.awards.scope_gone"),
    };
  }
  if (row.league_season_id) {
    return {
      label: row.league_season?.name ?? t("pages.awards.scope_gone"),
      to: `/league/seasons/${row.league_season_id}`,
    };
  }
  return { label: t(`pages.award_detail.source_${row.source}`) };
}

function onGranted(name: string) {
  granting.value = false;
  holderFilter.value = "all";
  page.value = 1;
  const known = new Set(holders.value.map((row) => row.id));
  const stop = watch(holders, (rows) => {
    freshIds.value = rows.filter((row) => !known.has(row.id)).map((r) => r.id);
    stop();
  });
  toast({
    title: t("pages.awards.granted_toast", { award: view.value.name, name }),
  });
}

const revokeTarget = ref<any>(null);
const revoking = ref(false);

async function revoke() {
  const row = revokeTarget.value;
  if (!row || revoking.value) return;
  revoking.value = true;
  try {
    await client.mutate({
      mutation: typedGql("mutation")({
        revokeAward: [{ id: $("id", "uuid!") }, { success: true }],
      }),
      variables: { id: row.id },
    });
    revokeTarget.value = null;
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message,
    });
  } finally {
    revoking.value = false;
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="(value) => emit('update:open', value)">
    <SheetContent class="flex w-full flex-col gap-0 p-0 sm:max-w-[760px]">
      <SheetHeader class="border-b border-border/60 px-6 py-4 text-left">
        <SheetTitle class="truncate pr-8 text-lg">{{ view.name }}</SheetTitle>
        <SheetDescription class="truncate text-xs">
          {{ subtitle }}
        </SheetDescription>
        <LastChanged :at="changedAt" :by="stampedBy" data-award-updated />
      </SheetHeader>

      <div class="grid flex-1 content-start gap-6 overflow-y-auto px-6 py-5">
        <div class="flex items-start gap-4">
          <span
            class="grid size-[5.5rem] shrink-0 place-items-center rounded-[10px] border border-border/60 bg-muted/30"
          >
            <AwardBadge
              :award="view"
              :seed-key="view.id"
              size="sm"
              :interactive="false"
              :show-name="false"
            />
          </span>
          <div class="grid min-w-0 flex-1 gap-2">
            <p v-if="view.description" class="text-sm text-muted-foreground">
              {{ view.description }}
            </p>
            <div class="flex flex-wrap items-center gap-1.5 text-xs">
              <span
                class="inline-flex items-center gap-1.5 text-muted-foreground"
              >
                <span
                  class="size-2 rounded-[2px]"
                  :style="{ background: accent }"
                  aria-hidden="true"
                />
                {{ $t(`pages.awards.tiers.${tier}`) }}
              </span>
              <span
                class="inline-flex h-5 items-center rounded-[5px] border border-border bg-muted/40 px-1.5 text-[0.68rem] font-medium text-muted-foreground"
              >
                {{
                  view.allow_multiple
                    ? $t("pages.awards.repeatable")
                    : $t("pages.awards.once_per_holder")
                }}
              </span>
              <template v-if="owner && !builtIn">
                <NuxtLink
                  v-if="owner.to"
                  :to="owner.to"
                  class="truncate text-muted-foreground transition-colors duration-150 hover:text-[hsl(var(--tac-amber))]"
                >
                  {{ ownerName }}
                </NuxtLink>
                <span v-else class="truncate text-muted-foreground">
                  {{ ownerName }}
                </span>
                <span
                  class="inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground/80"
                >
                  <StatusDot
                    v-if="owner.phase === 'live'"
                    tone="ok"
                    size="sm"
                    :live="ownerIsLive(owner)"
                  />
                  {{ ownerStatus }}
                </span>
              </template>
            </div>
          </div>
          <Button
            v-if="canManage"
            variant="outline"
            size="sm"
            class="shrink-0"
            @click="emit('edit', view)"
          >
            <Pencil class="size-3.5" />
            {{ $t("common.edit") }}
          </Button>
        </div>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            :label="$t('pages.award_detail.total_holders')"
            :value="stats.grants"
          />
          <StatTile
            :label="$t('pages.award_detail.unique_players')"
            :value="stats.players"
          >
            <template v-if="stats.teams" #aside>
              ({{
                $t(
                  "pages.awards.team_count",
                  { count: stats.teams },
                  stats.teams,
                )
              }})
            </template>
          </StatTile>
          <StatTile :label="$t('pages.award_detail.first_granted')">
            <span class="text-sm font-semibold">{{
              stats.first ? formatAwardDate(stats.first) : $t("common.never")
            }}</span>
          </StatTile>
          <StatTile :label="$t('pages.award_detail.last_granted')">
            <span class="text-sm font-semibold">{{
              stats.last ? formatAwardDate(stats.last) : $t("common.never")
            }}</span>
          </StatTile>
        </div>

        <section class="grid gap-3" data-award-holders>
          <div class="flex flex-wrap items-center gap-2.5">
            <div :class="[tacticalSectionLabelClasses, 'mb-0']">
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("pages.award_detail.holders_section") }}
            </div>
            <AnimatedFilters
              v-if="showHolderFilter"
              v-model="holderFilter"
              square
              :options="holderOptions"
            />
            <Button
              v-if="canGrant && !granting"
              size="sm"
              class="ml-auto"
              :class="createButtonClasses"
              @click="granting = true"
            >
              <Medal class="size-3.5" />
              {{ $t("pages.awards.grant") }}
            </Button>
          </div>

          <Fold :open="canGrant && granting">
            <AwardGrantInline
              v-if="detail"
              :award="detail"
              :holders="holders"
              @cancel="granting = false"
              @granted="onGranted"
            />
          </Fold>

          <div v-if="loading && !detail" class="grid gap-2">
            <Skeleton v-for="i in 4" :key="i" class="h-11 w-full rounded-md" />
          </div>

          <div
            v-else-if="!holders.length"
            class="grid min-h-[9rem] place-content-center gap-1 rounded-lg border border-border/60 bg-card/20 px-4 text-center"
          >
            <p class="text-sm font-semibold">
              {{ $t("pages.award_detail.no_holders_title") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ $t("pages.award_detail.no_holders") }}
            </p>
          </div>

          <template v-else>
            <div class="overflow-x-auto rounded-lg border border-border">
              <table class="w-full min-w-[34rem] text-[0.8125rem]">
                <thead>
                  <tr
                    class="border-b border-border text-left text-[0.72rem] text-muted-foreground"
                  >
                    <th class="px-3 py-2.5 font-medium">
                      {{ $t("pages.awards.col_holder") }}
                    </th>
                    <th class="px-3 py-2.5 font-medium">
                      {{ $t("awards.placement") }}
                    </th>
                    <th class="px-3 py-2.5 font-medium">
                      {{ $t("pages.awards.col_earned_at") }}
                    </th>
                    <th class="px-3 py-2.5 font-medium max-md:hidden">
                      {{ $t("pages.awards.note") }}
                    </th>
                    <th class="px-3 py-2.5 text-right font-medium">
                      {{ $t("awards.granted") }}
                    </th>
                    <th v-if="canGrant" class="w-11 px-2 py-2.5">
                      <span class="sr-only">{{
                        $t("pages.award_detail.revoke")
                      }}</span>
                    </th>
                  </tr>
                </thead>
                <TransitionGroup
                  tag="tbody"
                  enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                  enter-from-class="translate-y-1 opacity-0"
                  leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:transition-none"
                  leave-to-class="opacity-0"
                >
                  <tr
                    v-for="row in pagedHolders"
                    :key="row.id"
                    class="border-b border-border/50 transition-colors duration-150 last:border-b-0 hover:bg-muted/30"
                    :class="
                      freshIds.includes(row.id) &&
                      'bg-[hsl(var(--tac-amber)/0.08)]'
                    "
                  >
                    <td class="max-w-[14rem] px-3 py-2">
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
                        <Avatar shape="square" class="size-7 shrink-0">
                          <AvatarImage
                            v-if="teamAvatarFor(row)"
                            :src="teamAvatarFor(row)"
                            :alt="teamNameFor(row)"
                          />
                          <AvatarFallback>{{
                            teamNameFor(row).slice(0, 2)
                          }}</AvatarFallback>
                        </Avatar>
                        <span class="grid min-w-0">
                          <span
                            class="truncate font-semibold group-hover/team:text-[hsl(var(--tac-amber))]"
                          >
                            {{ teamNameFor(row) }}
                          </span>
                          <span class="text-[0.7rem] text-muted-foreground">
                            {{ $t("awards_manage_form.team") }}
                          </span>
                        </span>
                      </NuxtLink>
                    </td>
                    <td class="px-3 py-2">
                      <span
                        v-if="placementLabel(row)"
                        class="inline-flex h-5 items-center whitespace-nowrap rounded-[5px] border px-1.5 text-[0.7rem] font-semibold"
                        :style="{
                          color: placementColor(row),
                          borderColor: placementColor(row) + '59',
                          background: placementColor(row) + '1a',
                        }"
                      >
                        {{ placementLabel(row) }}
                      </span>
                      <span
                        v-else
                        class="inline-flex h-5 items-center rounded-[5px] border border-border bg-muted/40 px-1.5 text-[0.7rem] font-semibold text-muted-foreground"
                      >
                        {{ $t("awards.granted") }}
                      </span>
                    </td>
                    <td class="max-w-[15rem] px-3 py-2">
                      <NuxtLink
                        v-if="contextOf(row).to"
                        :to="contextOf(row).to"
                        class="block truncate text-muted-foreground transition-colors duration-150 hover:text-[hsl(var(--tac-amber))]"
                      >
                        {{ contextOf(row).label }}
                      </NuxtLink>
                      <span v-else class="block truncate text-muted-foreground">
                        {{ contextOf(row).label }}
                      </span>
                    </td>
                    <td class="max-w-[13rem] px-3 py-2 max-md:hidden">
                      <span
                        v-if="row.note"
                        class="block truncate text-xs italic text-muted-foreground"
                        :title="row.note"
                      >
                        {{ row.note }}
                      </span>
                      <span v-else class="text-muted-foreground/60">—</span>
                    </td>
                    <td
                      class="whitespace-nowrap px-3 py-2 text-right tabular-nums"
                      :title="
                        row.awarded_by?.name
                          ? $t('pages.award_detail.granted_by', {
                              name: row.awarded_by.name,
                            })
                          : undefined
                      "
                    >
                      {{ formatAwardDate(row.created_at) }}
                    </td>
                    <td v-if="canGrant" class="px-2 py-2 text-right">
                      <button
                        type="button"
                        class="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-[hsl(var(--destructive)/0.12)] hover:text-destructive"
                        :aria-label="
                          $t('pages.awards.revoke_from', {
                            name: recipientName(row),
                          })
                        "
                        :title="$t('pages.award_detail.revoke')"
                        @click="revokeTarget = row"
                      >
                        <X class="size-3.5" />
                      </button>
                    </td>
                  </tr>
                </TransitionGroup>
              </table>
            </div>

            <div
              v-if="filteredHolders.length > PER_PAGE"
              class="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span class="tabular-nums">
                {{
                  $t("pagination.showing_range", {
                    start: (page - 1) * PER_PAGE + 1,
                    end: Math.min(page * PER_PAGE, filteredHolders.length),
                    total: filteredHolders.length,
                  })
                }}
              </span>
              <span class="flex-1" />
              <Button
                variant="outline"
                size="icon-sm"
                :disabled="page === 1"
                :aria-label="$t('pagination.previous_page')"
                @click="page--"
              >
                <ChevronLeft class="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                :disabled="page === pages"
                :aria-label="$t('pagination.next_page')"
                @click="page++"
              >
                <ChevronRight class="size-4" />
              </Button>
            </div>
          </template>
        </section>

        <template v-if="canManage">
          <p
            v-if="builtIn"
            class="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground"
          >
            <Lock class="mt-px size-3.5 shrink-0" />
            {{ $t("pages.awards.builtin_note") }}
          </p>
          <div
            v-else
            class="flex items-center justify-between gap-4 border-t border-border/60 pt-5"
          >
            <p class="min-w-0 text-xs text-muted-foreground">
              {{ $t("pages.awards.delete_hint") }}
            </p>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              @click="emit('delete', view)"
            >
              <Trash2 class="size-3.5" />
              {{ $t("pages.awards.delete_award") }}
            </Button>
          </div>
        </template>
      </div>
    </SheetContent>
  </Sheet>

  <AlertDialog
    :open="!!revokeTarget"
    @update:open="
      (value) => {
        if (!value) revokeTarget = null;
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
              name: revokeTarget ? recipientName(revokeTarget) : "",
            })
          }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="revoking">{{
          $t("common.cancel")
        }}</AlertDialogCancel>
        <!-- Plain button: AlertDialogAction closes before the mutation runs. -->
        <Button variant="destructive" :disabled="revoking" @click="revoke">
          {{ $t("pages.award_detail.revoke") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
