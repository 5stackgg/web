<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  Archive,
  ArrowLeft,
  Boxes,
  Crosshair,
  GitFork,
  Heart,
  Rocket,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-vue-next";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import { toast } from "~/components/ui/toast";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import UtilityLineupViewer3D from "~/components/utility/UtilityLineupViewer3D.vue";
import UtilityConfidenceNote from "~/components/utility/UtilityConfidenceNote.vue";
import UtilityDifficultyChip from "~/components/utility/UtilityDifficultyChip.vue";
import UtilityMissPatternPanel from "~/components/utility/UtilityMissPatternPanel.vue";
import UtilityProgressPanel from "~/components/utility/UtilityProgressPanel.vue";
import UtilityCollectionPicker from "~/components/utility/UtilityCollectionPicker.vue";
import UtilitySightlinePanel from "~/components/utility/UtilitySightlinePanel.vue";
import UtilityForkDialog from "~/components/utility/UtilityForkDialog.vue";
import StartPracticeDialog from "~/components/utility/StartPracticeDialog.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import UtilityArchiveDialog from "~/components/utility/UtilityArchiveDialog.vue";
import {
  clearUtilityVoteMutation,
  favoriteUtilityLineupMutation,
  utilityLineupQuery,
  utilityMetaLineupsQuery,
  setUtilityVoteMutation,
  unfavoriteUtilityLineupMutation,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { hasMeshForMap, normalizeMapName } from "~/utilities/mapAssets";
import cleanMapName from "~/utilities/cleanMapName";
import { useAuthStore } from "~/stores/AuthStore";
import {
  jumpThrowBindState,
  matchUtilityMetaSpot,
  toUtilityMetaSpots,
} from "~/utilities/utilityDisplay";
import type { UtilityLineup, UtilityMetaLineup } from "~/types/utility";

const route = useRoute();
const { t } = useI18n();

const lineupId = computed(() => String(route.params.id));
const lineup = ref<UtilityLineup | null>(null);
const loading = ref(true);
const hasMesh = ref(false);
const practiceOpen = ref(false);
const sightlineOpen = ref(false);
const forkOpen = ref(false);

const auth = useAuthStore();
const signedIn = computed(() => !!auth.me?.steam_id);
const mySteamId = computed(() => auth.me?.steam_id ?? null);

const meshCdn = useRuntimeConfig().public.mapMeshCdn as string;

const mapName = computed(() =>
  lineup.value ? normalizeMapName(lineup.value.map_name) : "",
);

// ?practice= carries an invite code, not a session id.
const joinInviteCode = computed(() =>
  typeof route.query.practice === "string" ? route.query.practice : null,
);

watch(
  joinInviteCode,
  (id) => {
    if (id) {
      practiceOpen.value = true;
    }
  },
  { immediate: true },
);

async function fetchLineup() {
  loading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLineupQuery,
      variables: { id: lineupId.value },
      fetchPolicy: "network-only",
    });
    lineup.value = (data as any)?.utility_lineups_by_pk ?? null;
  } catch (error) {
    console.error("[utility] lineup fetch error:", error);
    lineup.value = null;
  } finally {
    loading.value = false;
  }
}

// Mesh mode is decided once inside Replay3DLite, so the 3D view must not mount
// until the probe has answered — otherwise a map without a mesh renders an
// empty scene instead of falling back.
watch(mapName, async (name) => {
  hasMesh.value = false;
  if (!name || !import.meta.client) {
    return;
  }
  hasMesh.value = await hasMeshForMap(meshCdn, name);
});

const router = useRouter();
const archiveOpen = ref(false);

// Straight back to the map: the page it was on now describes something that is
// no longer in any library, and leaving it up invites a reload into "not found".
function onArchived() {
  void router.push({ name: "utility-map", params: { map: mapName.value } });
}

onMounted(fetchLineup);

watch(lineupId, fetchLineup);

const flightSeconds = computed(() => {
  const ms = lineup.value?.flight_time_ms;
  return ms ? (ms / 1000).toFixed(2) : null;
});

const score = computed(
  () => (lineup.value?.upvotes ?? 0) - (lineup.value?.downvotes ?? 0),
);

const jumpBind = computed(() =>
  lineup.value ? jumpThrowBindState(lineup.value) : "no",
);

// Best effort: the mined aggregate is context, never a reason to fail the page.
const metaThrowers = ref<number | null>(null);

async function fetchMetaThrowers() {
  const current = lineup.value;
  metaThrowers.value = null;
  if (!current) {
    return;
  }
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityMetaLineupsQuery,
      variables: {
        where: {
          map_name: { _eq: normalizeMapName(current.map_name) },
          utility_type: { _eq: current.utility_type },
        },
        order_by: [{ throwers: order_by.desc }],
        limit: 400,
      },
      fetchPolicy: "cache-first",
    });
    const spot = matchUtilityMetaSpot(
      current,
      toUtilityMetaSpots(
        ((data as any)?.utility_meta_lineups ?? []) as UtilityMetaLineup[],
      ),
    );
    metaThrowers.value = spot && spot.throwers > 0 ? spot.throwers : null;
  } catch (error) {
    console.error("[utility] meta lookup error:", error);
    metaThrowers.value = null;
  }
}

watch(lineup, () => void fetchMetaThrowers());

async function vote(value: 1 | -1) {
  const current = lineup.value;
  if (!current || !mySteamId.value) {
    return;
  }
  const clearing = current.my_vote === value;
  try {
    const client = getGraphqlClient();
    const where = {
      utility_lineup_id: { _eq: current.id },
      steam_id: { _eq: mySteamId.value },
    };
    if (clearing) {
      await client.mutate({
        mutation: clearUtilityVoteMutation,
        variables: { where },
      });
    } else {
      await client.mutate({
        mutation: setUtilityVoteMutation,
        variables: {
          where,
          object: { utility_lineup_id: current.id, vote: value },
        },
      });
    }
    await fetchLineup();
  } catch (error: any) {
    toast({
      title: t("pages.utility.detail.vote_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

async function toggleFavorite() {
  const current = lineup.value;
  if (!current || !mySteamId.value) {
    return;
  }
  try {
    const client = getGraphqlClient();
    if (current.is_favorited) {
      await client.mutate({
        mutation: unfavoriteUtilityLineupMutation,
        variables: {
          where: {
            utility_lineup_id: { _eq: current.id },
            steam_id: { _eq: mySteamId.value },
          },
        },
      });
    } else {
      await client.mutate({
        mutation: favoriteUtilityLineupMutation,
        variables: {
          object: { utility_lineup_id: current.id },
        },
      });
    }
    await fetchLineup();
  } catch (error: any) {
    toast({
      title: t("pages.utility.detail.favorite_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}
</script>

<template>
  <PageTransition v-if="loading">
    <Skeleton class="h-24 w-full rounded-lg" />
    <Skeleton class="mt-4 aspect-video w-full rounded-md" />
  </PageTransition>

  <PageTransition v-else-if="!lineup">
    <Empty>
      <EmptyTitle>{{ $t("pages.utility.detail.not_found") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.utility.detail.not_found_description") }}
      </EmptyDescription>
    </Empty>
  </PageTransition>

  <template v-else>
    <PageTransition>
      <TacticalPageHeader>
        <template #description>
          {{ cleanMapName(lineup.map_name) }} ·
          {{ $t(`pages.utility.types.${lineup.utility_type}`) }}
        </template>
        <template #title>{{ lineup.name }}</template>
        <template #actions>
          <NuxtLink :to="{ name: 'utility-map', params: { map: mapName } }">
            <Button variant="outline">
              <ArrowLeft class="mr-1 h-4 w-4" />
              {{ $t("pages.utility.back_to_map") }}
            </Button>
          </NuxtLink>
          <Button
            v-if="lineup.can_edit"
            variant="outline"
            class="text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            @click="archiveOpen = true"
          >
            <Archive class="mr-1 h-4 w-4" />
            {{ $t("pages.utility.archive.action") }}
          </Button>
          <Button class="tac-amber-cta" @click="practiceOpen = true">
            <Rocket class="mr-1 h-4 w-4" />
            {{ $t("pages.utility.detail.practice_this") }}
          </Button>
        </template>
      </TacticalPageHeader>
    </PageTransition>

    <PageTransition :delay="60" class="mt-4">
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div class="flex flex-col gap-2">
          <UtilityLineupViewer3D v-if="hasMesh" :lineup="lineup" />
          <template v-else>
            <UtilityRadarBoard
              :map-name="mapName"
              :lineups="[lineup]"
              :selected-id="lineup.id"
            />
            <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Boxes class="h-3.5 w-3.5 shrink-0" />
              {{ $t("pages.utility.detail.no_mesh") }}
            </p>
          </template>
        </div>

        <div class="flex flex-col gap-3">
          <UtilityConfidenceNote :lineup="lineup" />

          <div class="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" class="font-mono text-[0.62rem] uppercase">
              {{ $t(`pages.utility.sides.${lineup.side}`) }}
            </Badge>
            <Badge variant="outline" class="font-mono text-[0.62rem] uppercase">
              {{ $t(`pages.utility.techniques.${lineup.technique}`) }}
            </Badge>
            <Badge variant="outline" class="font-mono text-[0.62rem] uppercase">
              {{ $t(`pages.utility.strengths.${lineup.throw_strength}`) }}
            </Badge>
            <Badge
              v-if="jumpBind !== 'no'"
              variant="outline"
              class="font-mono text-[0.62rem] uppercase"
              :class="jumpBind === 'unknown' ? 'text-muted-foreground' : ''"
            >
              {{
                jumpBind === "unknown"
                  ? $t("pages.utility.card.jump_bind_unknown")
                  : $t("pages.utility.card.jump_bind")
              }}
            </Badge>
            <Badge
              variant="outline"
              class="font-mono text-[0.62rem] uppercase"
            >
              {{ $t(`pages.utility.visibility.${lineup.visibility}`) }}
            </Badge>
            <UtilityDifficultyChip :difficulty="lineup.difficulty" />
            <span
              v-if="metaThrowers"
              class="inline-flex items-center gap-1 rounded-sm border border-[hsl(var(--tac-amber)/0.35)] px-1.5 py-0.5 font-mono text-[0.62rem] tabular-nums uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
              :title="$t('pages.utility.meta.throwers_hint')"
            >
              <Users class="h-3 w-3" />
              {{ $t("pages.utility.meta.throwers", { count: metaThrowers }) }}
            </span>
          </div>

          <dl
            class="grid grid-cols-2 gap-2 rounded-md border border-border bg-card/40 p-3 text-xs [backdrop-filter:blur(6px)]"
          >
            <div>
              <dt class="text-muted-foreground">
                {{ $t("pages.utility.detail.flight_time") }}
              </dt>
              <dd class="font-mono tabular-nums">
                {{
                  flightSeconds
                    ? $t("pages.utility.card.flight_time", {
                        seconds: flightSeconds,
                      })
                    : $t("common.na")
                }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">
                {{ $t("pages.utility.detail.view_angles") }}
              </dt>
              <dd class="font-mono tabular-nums">
                {{ Number(lineup.view_yaw ?? 0).toFixed(1) }} /
                {{ Number(lineup.view_pitch ?? 0).toFixed(1) }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">
                {{ $t("pages.utility.detail.origin_source") }}
              </dt>
              <dd class="font-mono uppercase">
                {{ $t(`pages.utility.origin_sources.${lineup.origin_source}`) }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">
                {{ $t("pages.utility.detail.verified") }}
              </dt>
              <dd class="font-mono uppercase">
                {{ lineup.verified_at ? $t("common.yes") : $t("common.no") }}
              </dd>
            </div>
            <div
              v-if="
                lineup.view_yaw_delta != null || lineup.view_pitch_delta != null
              "
              class="col-span-2"
            >
              <dt class="text-muted-foreground">
                {{ $t("pages.utility.detail.aim_delta") }}
              </dt>
              <dd class="font-mono tabular-nums">
                {{ Number(lineup.view_yaw_delta ?? 0).toFixed(2) }} /
                {{ Number(lineup.view_pitch_delta ?? 0).toFixed(2) }}
              </dd>
            </div>
          </dl>

          <p
            v-if="lineup.description"
            class="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90"
          >
            {{ lineup.description }}
          </p>

          <div
            v-if="lineup.tags?.length"
            class="flex flex-wrap gap-1 text-[0.62rem] text-muted-foreground"
          >
            <span
              v-for="tag of lineup.tags"
              :key="tag"
              class="rounded-sm border border-border/70 px-1.5 py-0.5 font-mono uppercase tracking-[0.12em]"
            >
              {{ tag }}
            </span>
          </div>

          <div
            class="flex items-center justify-between gap-2 rounded-md border border-border bg-card/40 p-3 [backdrop-filter:blur(6px)]"
          >
            <PlayerDisplay
              v-if="lineup.author"
              :player="lineup.author"
              size="xs"
              compact
              linkable
              truncate-name
              :show-elo="false"
            />
            <span v-else class="text-xs text-muted-foreground">
              {{ $t("pages.utility.card.unknown_author") }}
            </span>
            <span
              v-if="lineup.team"
              class="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              {{ lineup.team.short_name || lineup.team.name }}
            </span>
          </div>

          <UtilityProgressPanel :progress="lineup.progress" />

          <UtilityMissPatternPanel :lineup-id="lineup.id" />

          <div class="flex flex-wrap items-center gap-2">
            <div
              class="inline-flex items-stretch overflow-hidden rounded-md border border-border"
            >
              <Button
                variant="ghost"
                size="sm"
                class="rounded-none"
                :disabled="!signedIn"
                :class="
                  lineup.my_vote === 1 ? 'text-[hsl(var(--tac-amber))]' : ''
                "
                @click="vote(1)"
              >
                <ThumbsUp class="h-4 w-4" />
              </Button>
              <span
                class="flex min-w-10 items-center justify-center px-1 font-mono text-sm tabular-nums"
              >
                {{ score }}
              </span>
              <Button
                variant="ghost"
                size="sm"
                class="rounded-none"
                :disabled="!signedIn"
                :class="lineup.my_vote === -1 ? 'text-destructive' : ''"
                @click="vote(-1)"
              >
                <ThumbsDown class="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              :disabled="!signedIn"
              @click="toggleFavorite()"
            >
              <Heart
                class="mr-1 h-4 w-4"
                :class="
                  lineup.is_favorited ? 'fill-current text-destructive' : ''
                "
              />
              {{ lineup.favorites ?? 0 }}
            </Button>

            <UtilityCollectionPicker :lineup-id="lineup.id" />

            <Button
              variant="outline"
              size="sm"
              :disabled="!signedIn"
              @click="forkOpen = true"
            >
              <GitFork class="mr-1 h-4 w-4" />
              {{ $t("pages.utility.fork.action") }}
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>

    <PageTransition :delay="100" class="mt-4">
      <div
        class="rounded-md border border-border bg-card/40 p-3 [backdrop-filter:blur(6px)]"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div
              class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
            >
              {{ $t("pages.utility.sightline.eyebrow") }}
            </div>
            <h2 class="text-sm font-semibold">
              {{ $t("pages.utility.sightline.title") }}
            </h2>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ $t("pages.utility.sightline.description") }}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            class="shrink-0"
            @click="sightlineOpen = !sightlineOpen"
          >
            <Crosshair class="mr-1 h-4 w-4" />
            {{
              sightlineOpen
                ? $t("pages.utility.sightline.hide")
                : $t("pages.utility.sightline.open")
            }}
          </Button>
        </div>

        <div v-if="sightlineOpen" class="mt-3">
          <UtilitySightlinePanel :lineup="lineup" />
        </div>
      </div>
    </PageTransition>

    <UtilityForkDialog
      v-model:open="forkOpen"
      :lineup-id="lineup.id"
      :source-name="lineup.name"
    />

    <UtilityArchiveDialog
      v-model:open="archiveOpen"
      :lineup-id="lineup.id"
      :lineup-name="lineup.name"
      @archived="onArchived"
    />

    <StartPracticeDialog
      v-model:open="practiceOpen"
      :map-name="lineup.map_name"
      :lineup-id="lineup.id"
      :join-invite-code="joinInviteCode"
    />
  </template>
</template>
