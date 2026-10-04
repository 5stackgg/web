<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { ChevronLeft, ChevronRight, Shield, UserPlus } from "lucide-vue-next";
import { $, order_by } from "~/generated/zeus";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { playerFields } from "~/graphql/playerFields";
import { resolveRosterImageUrl } from "~/utilities/rosterImage";
import { teamRosterBuckets } from "~/utilities/teamRosterBuckets";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TeamMembers from "~/components/teams/TeamMembers.vue";
import HeightGlide from "~/components/ui/transitions/HeightGlide.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{
  team: any;
}>();

const { t } = useI18n();
const { client } = useApolloClient();
const apiDomain = useRuntimeConfig().public.apiDomain as string;

const STARTERS = 5;

const rosterQuery = generateSubscription({
  team_roster: [
    {
      where: { team_id: { _eq: $("teamId", "uuid!") } },
      order_by: [{ player: { name: order_by.asc } }],
    },
    {
      role: true,
      coach: true,
      status: true,
      roster_image_url: true,
      player: playerFields,
    },
  ],
} as any);

const invitesQuery = generateSubscription({
  team_invites: [
    { where: { team_id: { _eq: $("teamId", "uuid!") } } },
    { id: true, player: { steam_id: true } },
  ],
} as any);

const roster = ref<any[]>([]);
const invites = ref<any[]>([]);
// The full roster (TeamMembers) replaces the summary in place.
const expanded = defineModel<boolean>("expanded", { default: false });

let subs: Array<{ unsubscribe: () => void }> = [];
function stop() {
  subs.forEach((sub) => sub.unsubscribe());
  subs = [];
}

watch(
  [() => props.team?.id, () => !!props.team?.can_invite],
  ([teamId, canInvite]) => {
    stop();
    roster.value = [];
    invites.value = [];
    if (!teamId || typeof window === "undefined") return;
    subs.push(
      client
        .subscribe({ query: rosterQuery, variables: { teamId } })
        .subscribe({
          next: ({ data }: any) => {
            roster.value = data?.team_roster ?? [];
          },
          error: (error: any) => {
            console.error("[starting-five] roster subscription error", error);
          },
        }),
    );
    if (canInvite) {
      subs.push(
        client
          .subscribe({ query: invitesQuery, variables: { teamId } })
          .subscribe({
            next: ({ data }: any) => {
              invites.value = data?.team_invites ?? [];
            },
            error: (error: any) => {
              console.error(
                "[starting-five] invites subscription error",
                error,
              );
            },
          }),
      );
    }
  },
  { immediate: true },
);
onBeforeUnmount(stop);

const buckets = computed(() => teamRosterBuckets(roster.value));
const openSlots = computed(() =>
  Math.max(0, STARTERS - buckets.value.starters.length),
);
const canManage = computed(
  () => !!(props.team?.can_change_role || props.team?.can_invite),
);

const captainId = computed(
  () => props.team?.captain_steam_id ?? props.team?.owner_steam_id ?? null,
);
const benchCaptain = computed(() => {
  if (!captainId.value) return null;
  const isStarter = buckets.value.starters.some(
    (member: any) =>
      String(member.player?.steam_id) === String(captainId.value),
  );
  if (isStarter) return null;
  return (
    roster.value.find(
      (member) => String(member.player?.steam_id) === String(captainId.value),
    )?.player?.name ?? null
  );
});

const depth = computed(() =>
  [
    benchCaptain.value
      ? t("team.starting_five.captain", { name: benchCaptain.value })
      : null,
    buckets.value.substitutes.length
      ? t("team.starting_five.substitutes", buckets.value.substitutes.length)
      : null,
    buckets.value.bench.length
      ? t("team.starting_five.bench", { count: buckets.value.bench.length })
      : null,
    buckets.value.coaches.length
      ? t("team.starting_five.coaches", buckets.value.coaches.length)
      : null,
  ]
    .filter(Boolean)
    .join(" · "),
);

// Same eligibility TeamMembers applies, so the search marks teammates and
// people with an open invite instead of letting a re-invite silently no-op.
const ineligible = computed(() => {
  const map: Record<string, string> = {};
  for (const member of roster.value) {
    if (!member.player?.steam_id) continue;
    map[String(member.player.steam_id)] = t(
      member.role === "Invite"
        ? "player.search.ineligible.team_invite_pending"
        : "player.search.ineligible.on_team",
    );
  }
  for (const invite of invites.value) {
    if (!invite.player?.steam_id) continue;
    map[String(invite.player.steam_id)] = t(
      "player.search.ineligible.team_invite_pending",
    );
  }
  return map;
});

async function invite(player: any) {
  await client.mutate({
    mutation: generateMutation({
      insert_team_roster_one: [
        {
          object: {
            team_id: props.team.id,
            player_steam_id: player.steam_id,
          },
        },
        { __typename: true },
      ],
    }),
  });
}

function rosterImage(member: any) {
  return resolveRosterImageUrl(member, member.player, apiDomain);
}

const root = ref<HTMLElement | null>(null);
// After a swap, focus lands on the toggle that leads back.
let moveFocus = false;
function toggle(value: boolean) {
  moveFocus = true;
  expanded.value = value;
}
function focusToggle() {
  if (!moveFocus) return;
  moveFocus = false;
  root.value?.querySelector<HTMLElement>("[data-roster-toggle]")?.focus();
}

function showFullRoster() {
  moveFocus = true;
  expanded.value = true;
  root.value?.scrollIntoView({ block: "start", behavior: "smooth" });
}
defineExpose({ showFullRoster });

const linkClasses =
  "relative inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] [@media(pointer:fine)]:after:hidden";
</script>

<template>
  <section
    ref="root"
    :aria-labelledby="expanded ? undefined : 'team-starting-five-label'"
    :aria-label="expanded ? $t('team.starting_five.full_roster') : undefined"
    class="scroll-mt-6"
  >
    <HeightGlide>
      <Transition
        mode="out-in"
        enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        enter-from-class="translate-y-1 opacity-0"
        leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:transition-none"
        leave-to-class="opacity-0"
        @after-enter="focusToggle"
      >
        <div v-if="expanded" key="full">
          <button
            type="button"
            :class="[linkClasses, 'mb-3']"
            data-roster-toggle
            @click="toggle(false)"
          >
            <ChevronLeft class="size-3.5" />
            {{ $t("team.starting_five.starters_only") }}
          </button>
          <TeamMembers :team-id="team.id" />
        </div>
        <div v-else key="five">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2
              id="team-starting-five-label"
              :class="[tacticalSectionLabelClasses, '!mb-0 !flex']"
            >
              <span :class="tacticalSectionTickClasses"></span>
              {{ $t("team.starting_five.title") }}
              <span
                v-if="roster.length"
                class="normal-case tracking-normal text-muted-foreground/80"
              >
                {{ $t("team.starting_five.players", roster.length) }}
              </span>
            </h2>
            <button
              type="button"
              :class="linkClasses"
              data-roster-toggle
              @click="toggle(true)"
            >
              {{
                canManage
                  ? $t("team.starting_five.manage_roster")
                  : $t("team.starting_five.full_roster")
              }}
              <ChevronRight class="size-3.5" />
            </button>
          </div>

          <ul class="grid gap-1">
            <li
              v-for="member in buckets.starters"
              :key="member.player.steam_id"
              class="flex min-h-11 items-center rounded-md bg-muted/15 px-2 py-1.5"
            >
              <PlayerDisplay
                class="min-w-0 flex-1"
                :player="member.player"
                :linkable="true"
                :avatar-override="rosterImage(member)"
              >
                <template #name-postfix>
                  <span
                    v-if="String(member.player.steam_id) === String(captainId)"
                    class="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)] px-1.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--tac-amber))]"
                  >
                    <Shield class="size-3" />
                    {{ $t("team.roles.captain") }}
                  </span>
                </template>
              </PlayerDisplay>
            </li>

            <li
              v-for="n in openSlots"
              :key="`open-${n}`"
              class="flex min-h-11 items-center gap-2.5 rounded-md px-2 py-1.5 shadow-[inset_0_0_0_1px_hsl(var(--muted-foreground)/0.25)]"
            >
              <span
                aria-hidden="true"
                class="size-7 shrink-0 rounded-full shadow-[inset_0_0_0_1px_hsl(var(--muted-foreground)/0.4)]"
              ></span>
              <span class="flex-1 text-sm text-muted-foreground">
                {{ $t("team.starting_five.open_slot") }}
              </span>
              <PlayerSearch
                v-if="team.can_invite"
                :label="$t('team.members.invite_player')"
                :ineligible="ineligible"
                @selected="invite"
              >
                <button
                  type="button"
                  class="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
                >
                  <UserPlus class="size-3.5" />
                  {{ $t("team.starting_five.invite") }}
                </button>
              </PlayerSearch>
            </li>
          </ul>

          <p v-if="depth" class="mt-2 text-[12.5px] text-muted-foreground">
            {{ depth }}
          </p>
        </div>
      </Transition>
    </HeightGlide>
  </section>
</template>
