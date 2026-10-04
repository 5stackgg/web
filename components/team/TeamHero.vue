<script setup lang="ts">
import { computed, ref, watch } from "vue";
import gql from "graphql-tag";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import AwardBadge from "~/components/award/AwardBadge.vue";
import AwardModal from "~/components/award/AwardModal.vue";
import AwardCase from "~/components/award/AwardCase.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import TeamRankSummary from "~/components/team/TeamRankSummary.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { resolveAwardTier, type AwardTier } from "~/utilities/awardSeed";
import { schemaHasField } from "~/utilities/schemaHasType";
import { dateLocale } from "~/utilities/dateLocale";

const props = defineProps<{
  team: any;
  awards: any[];
  matchesCount: number;
}>();

const { locale } = useI18n();
const { client } = useApolloClient();

const apiDomain = useRuntimeConfig().public.apiDomain;
const avatarSrc = computed(() =>
  props.team?.avatar_url
    ? `https://${apiDomain}/${props.team.avatar_url}`
    : null,
);

// teams.created_at ships with the API ahead of the generated types, so it is
// read on its own once the API serves it; older teams can have none.
const TEAM_CREATED_AT = gql`
  query TeamCreatedAt($id: uuid!) {
    teams_by_pk(id: $id) {
      id
      created_at
    }
  }
`;
const createdAt = ref<string | null>(null);
watch(
  () => props.team?.id,
  async (id) => {
    createdAt.value = null;
    if (!id || typeof window === "undefined") return;
    if (!(await schemaHasField(client, "teams", "created_at"))) return;
    try {
      const { data } = await client.query({
        query: TEAM_CREATED_AT,
        variables: { id },
      });
      if (props.team?.id === id) {
        createdAt.value = (data as any)?.teams_by_pk?.created_at ?? null;
      }
    } catch (error) {
      console.error("[team-hero] created_at query error", error);
    }
  },
  { immediate: true },
);

const founded = computed(() =>
  createdAt.value
    ? new Date(createdAt.value).toLocaleDateString(locale.value, {
        month: "short",
        year: "numeric",
      })
    : null,
);

// Placement medals lead, then standalone awards, newest first within each --
// the same order as the award case.
const TIER_ORDER: Record<AwardTier, number> = {
  mvp: 0,
  gold: 1,
  silver: 2,
  bronze: 3,
  special: 4,
};
const AWARDS_SHOWN = 6;

function grantName(grant: any): string {
  if (grant.source === "manual") {
    return (
      grant.tournament_award?.custom_name ||
      grant.award?.name ||
      grant.tournament?.name ||
      ""
    );
  }
  return (
    grant.tournament_award?.custom_name ||
    grant.tournament?.name ||
    grant.award?.name ||
    ""
  );
}

function grantDate(grant: any): string | null {
  if (grant.source === "manual") return grant.created_at || null;
  return grant.tournament?.start || grant.created_at || null;
}

function formatGrantDate(grant: any) {
  const iso = grantDate(grant);
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const sortedAwards = computed(() =>
  [...(props.awards ?? [])].sort((a, b) => {
    const tierA = TIER_ORDER[resolveAwardTier(a.placement, a.award?.tier)];
    const tierB = TIER_ORDER[resolveAwardTier(b.placement, b.award?.tier)];
    if (tierA !== tierB) return tierA - tierB;
    return (
      new Date(grantDate(b) || 0).getTime() -
      new Date(grantDate(a) || 0).getTime()
    );
  }),
);

// Awards past the first few open the full award case.
const allAwardsOpen = ref(false);

const selectedAward = ref<any | null>(null);
const awardOpen = ref(false);
function openAward(grant: any) {
  selectedAward.value = grant;
  awardOpen.value = true;
}
</script>

<template>
  <header
    class="relative grid h-full grid-cols-[auto_minmax(0,1fr)] content-center items-start gap-x-4 gap-y-3 rounded-lg border border-border px-5 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-5 sm:px-6 sm:py-5 [background:linear-gradient(180deg,hsl(var(--card)_/_0.55)_0%,hsl(var(--card)_/_0.25)_100%)] [backdrop-filter:blur(6px)]"
  >
    <div
      class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.12)] sm:size-[5.5rem]"
    >
      <img
        v-if="avatarSrc"
        :src="avatarSrc"
        :alt="team.name"
        class="h-full w-full object-cover"
      />
      <span
        v-else
        class="font-sans text-xl font-bold uppercase leading-none tracking-[0.05em] text-[hsl(var(--tac-amber))] sm:text-2xl"
      >
        {{ (team.short_name || team.name).slice(0, 4) }}
      </span>
    </div>

    <div class="grid min-w-0 gap-2.5">
      <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1
          class="m-0 min-w-0 text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-tight [overflow-wrap:anywhere]"
        >
          {{ team.name }}
        </h1>
        <span
          v-if="team.short_name"
          class="inline-flex h-6 items-center rounded-md border border-border bg-muted/40 px-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-foreground/80"
        >
          {{ team.short_name }}
        </span>
      </div>

      <TeamRankSummary :ranks="team.ranks" :reputation="team.reputation" />

      <div
        class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-foreground/80 tabular-nums"
      >
        <span>{{
          $t("team.pulse.hero.players", team.roster?.length ?? 0)
        }}</span>
        <span>{{
          matchesCount
            ? $t("team.pulse.hero.matches", matchesCount)
            : $t("team.pulse.hero.no_matches")
        }}</span>
        <span v-if="founded">{{
          $t("team.pulse.hero.founded", { date: founded })
        }}</span>

        <span
          v-if="sortedAwards.length"
          role="group"
          :aria-label="$t('awards.title')"
          class="inline-flex items-center gap-1"
        >
          <FiveStackToolTip
            v-for="grant in sortedAwards.slice(0, AWARDS_SHOWN)"
            :key="grant.id"
            as-child
            :tap-toggle="false"
          >
            <template #trigger>
              <button
                type="button"
                class="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
                :aria-label="grantName(grant)"
                @click="openAward(grant)"
              >
                <AwardBadge
                  :award="grant.award"
                  :seed-key="grant.tournament_id || grant.award?.id"
                  :placement="grant.placement"
                  :tournament-name="grant.tournament?.name"
                  :tournament-start="grant.tournament?.start"
                  :tournament-type="grant.tournament?.stages?.[0]?.type"
                  :custom-name="grant.tournament_award?.custom_name"
                  :silhouette-override="grant.tournament_award?.silhouette"
                  :image-url="grant.tournament_award?.image_url"
                  size="xs"
                />
              </button>
            </template>
            <span class="font-semibold">{{ grantName(grant) }}</span>
            <span v-if="grantDate(grant)" class="text-muted-foreground">
              · {{ formatGrantDate(grant) }}</span
            >
          </FiveStackToolTip>
          <button
            v-if="sortedAwards.length > AWARDS_SHOWN"
            type="button"
            class="ml-1 rounded-sm px-1 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
            :aria-label="$t('team.pulse.hero.all_awards')"
            @click="allAwardsOpen = true"
          >
            +{{ sortedAwards.length - AWARDS_SHOWN }}
          </button>
        </span>
      </div>
    </div>

    <div
      class="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:justify-end"
    >
      <slot name="actions" />
    </div>

    <Dialog v-model:open="allAwardsOpen">
      <DialogContent class="max-h-[85dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{{ $t("awards.title") }}</DialogTitle>
          <DialogDescription class="sr-only">{{ team.name }}</DialogDescription>
        </DialogHeader>
        <AwardCase :awards="awards" :hide-mvp="true" />
      </DialogContent>
    </Dialog>

    <AwardModal
      v-if="selectedAward"
      :open="awardOpen"
      :award="selectedAward"
      @update:open="(v) => (awardOpen = v)"
    />
  </header>
</template>
