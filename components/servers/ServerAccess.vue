<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@vue/apollo-composable";
import gql from "graphql-tag";
import {
  CalendarDays,
  Globe,
  Lock,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-vue-next";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import EventSearch from "~/components/events/EventSearch.vue";
import { toast } from "@/components/ui/toast";
import {
  eventPhase,
  formatEventDate,
  phaseBadgeVariant,
  phaseLabelKey,
} from "~/utilities/eventDisplay";

type AccessPlayer = {
  steam_id: string;
  name: string;
  avatar_url?: string | null;
  country?: string | null;
};

type AccessEvent = {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
};

type Draft = {
  restricted: boolean;
  minRole: string;
  players: Array<AccessPlayer>;
  events: Array<AccessEvent>;
};

const props = defineProps<{ serverId: string }>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();

// Moderators and up always get in, so only the roles below them are useful
// as a floor.
const MIN_ROLES = ["user", "verified_user", "streamer"];
const NO_ROLE = "none";
const PLUGIN_STALE_MS = 3 * 60 * 1000;

// Raw documents: the access tables and setServerAccess are newer than
// ~/generated/zeus until codegen runs against a migrated database.
const QUERY = gql`
  query ServerAccess($serverId: uuid!) {
    servers_by_pk(id: $serverId) {
      id
      access_restricted
      access_min_role
      player_management_seen_at
      access_players(order_by: { player: { name: asc } }) {
        steam_id
        player {
          steam_id
          name
          avatar_url
          country
        }
      }
      access_events(order_by: { event: { starts_at: desc } }) {
        event {
          id
          name
          starts_at
          ends_at
        }
      }
    }
  }
`;

const SAVE = gql`
  mutation SetServerAccess(
    $serverId: uuid!
    $restricted: Boolean!
    $minRole: String
    $steamIds: [String!]!
    $eventIds: [uuid!]!
  ) {
    setServerAccess(
      server_id: $serverId
      restricted: $restricted
      min_role: $minRole
      steam_ids: $steamIds
      event_ids: $eventIds
    ) {
      success
    }
  }
`;

const { result, refetch } = useQuery(
  QUERY,
  () => ({ serverId: props.serverId }),
  { fetchPolicy: "cache-and-network" },
);

const draft = ref<Draft>({
  restricted: false,
  minRole: NO_ROLE,
  players: [],
  events: [],
});
const saved = ref(snapshot(draft.value));
const revision = ref(0);
const submitting = ref(false);
const now = ref(Date.now());

const clock = setInterval(() => {
  now.value = Date.now();
}, 30_000);

onBeforeUnmount(() => clearInterval(clock));

const server = computed(() => (result.value as any)?.servers_by_pk);

function fromServer(): Draft {
  return {
    restricted: server.value?.access_restricted ?? false,
    minRole: server.value?.access_min_role ?? NO_ROLE,
    players: (server.value?.access_players ?? [])
      .map((row: { player: AccessPlayer | null }) => row.player)
      .filter(Boolean),
    events: (server.value?.access_events ?? [])
      .map((row: { event: AccessEvent | null }) => row.event)
      .filter(Boolean),
  };
}

function snapshot(value: Draft): string {
  return JSON.stringify({
    restricted: value.restricted,
    minRole: value.minRole,
    players: value.players.map((player) => player.steam_id).sort(),
    events: value.events.map((event) => event.id).sort(),
  });
}

const dirty = computed(() => snapshot(draft.value) !== saved.value);

function reset() {
  draft.value = fromServer();
  saved.value = snapshot(draft.value);
}

watch(
  result,
  () => {
    if (!dirty.value) {
      reset();
    }
  },
  { immediate: true },
);

function touch() {
  revision.value++;
}

const modeModel = computed({
  get: () => (draft.value.restricted ? "restricted" : "open"),
  set: (value: string) => {
    draft.value.restricted = value === "restricted";
    touch();
  },
});

const modeOptions = computed(() => [
  {
    key: "open",
    label: t("pages.dedicated_servers.detail.access.open"),
    icon: Globe,
  },
  {
    key: "restricted",
    label: t("pages.dedicated_servers.detail.access.restricted"),
    icon: Lock,
  },
]);

const minRoleModel = computed({
  get: () => draft.value.minRole,
  set: (value: string) => {
    draft.value.minRole = value;
    touch();
  },
});

const pickedSteamIds = computed(() =>
  draft.value.players.map((player) => player.steam_id),
);

const ineligiblePlayers = computed(() =>
  Object.fromEntries(
    pickedSteamIds.value.map((steamId) => [
      steamId,
      t("pages.dedicated_servers.detail.access.already_added"),
    ]),
  ),
);

function addPlayer(player: AccessPlayer) {
  if (pickedSteamIds.value.includes(String(player.steam_id))) {
    return;
  }

  draft.value.players = [
    ...draft.value.players,
    { ...player, steam_id: String(player.steam_id) },
  ];
  touch();
}

function removePlayer(steamId: string) {
  draft.value.players = draft.value.players.filter(
    (player) => player.steam_id !== steamId,
  );
  touch();
}

function addEvent(event: AccessEvent) {
  if (draft.value.events.some((existing) => existing.id === event.id)) {
    return;
  }

  draft.value.events = [...draft.value.events, event];
  touch();
}

function removeEvent(eventId: string) {
  draft.value.events = draft.value.events.filter(
    (event) => event.id !== eventId,
  );
  touch();
}

function eventWindow(event: AccessEvent): string {
  const starts = formatEventDate(event.starts_at);
  const ends = formatEventDate(event.ends_at);

  if (starts && ends && starts !== ends) {
    return `${starts} – ${ends}`;
  }

  return starts ?? "";
}

// The plugin is what keeps players out; without a recent check-in a saved
// restriction only hides the server in the panel.
const pluginMissing = computed(() => {
  const seenAt = server.value?.player_management_seen_at;

  return !seenAt || now.value - new Date(seenAt).getTime() >= PLUGIN_STALE_MS;
});

async function save() {
  if (submitting.value) {
    return;
  }

  submitting.value = true;
  const startedAt = revision.value;
  const saving = snapshot(draft.value);

  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: SAVE,
      variables: {
        serverId: props.serverId,
        restricted: draft.value.restricted,
        minRole:
          draft.value.minRole === NO_ROLE ? null : draft.value.minRole,
        steamIds: pickedSteamIds.value,
        eventIds: draft.value.events.map((event) => event.id),
      },
    });

    toast({ title: t("pages.dedicated_servers.detail.access.saved") });

    saved.value = saving;

    // Edits made while saving stay pending.
    if (revision.value === startedAt) {
      await refetch();
    }
  } finally {
    submitting.value = false;
  }
}

const cardClasses =
  "relative isolate overflow-hidden rounded-lg border border-border [background:linear-gradient(180deg,hsl(var(--card)/0.2)_0%,hsl(var(--card)/0.04)_100%)]";

const microLabelClasses =
  "font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted-foreground";

const chipClasses =
  "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase leading-none tracking-[0.12em]";
</script>

<template>
  <section>
    <div class="mb-3 flex items-center gap-3">
      <div
        class="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
      >
        <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
        {{ $t("pages.dedicated_servers.detail.access.title") }}
      </div>
      <span class="h-px flex-1 bg-border" />
      <span
        :class="[
          chipClasses,
          server?.access_restricted
            ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))]'
            : 'border-border/70 bg-muted/35 text-muted-foreground',
        ]"
      >
        <Lock v-if="server?.access_restricted" class="h-2.5 w-2.5" />
        {{
          server?.access_restricted
            ? $t("pages.dedicated_servers.detail.access.restricted")
            : $t("pages.dedicated_servers.detail.access.open")
        }}
      </span>
    </div>

    <div :class="cardClasses">
      <div
        class="flex items-start justify-between gap-4 border-b border-border/60 p-4 max-sm:flex-col"
      >
        <p class="max-w-prose text-sm text-muted-foreground">
          {{ $t("pages.dedicated_servers.detail.access.description") }}
        </p>
        <AnimatedFilters
          v-model="modeModel"
          square
          class="shrink-0"
          :options="modeOptions"
        />
      </div>

      <div
        v-if="draft.restricted && pluginMissing"
        class="flex items-start gap-2 border-b border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] px-4 py-2.5 text-xs text-[hsl(var(--tac-amber))]"
      >
        <TriangleAlert class="mt-px h-3.5 w-3.5 shrink-0" />
        {{ $t("pages.dedicated_servers.detail.access.plugin_missing") }}
      </div>

      <div v-if="draft.restricted" class="space-y-5 p-4">
        <p
          class="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <ShieldCheck class="h-3.5 w-3.5 shrink-0" />
          {{ $t("pages.dedicated_servers.detail.access.staff") }}
        </p>

        <div class="space-y-2">
          <p :class="microLabelClasses">
            {{ $t("pages.dedicated_servers.detail.access.min_role") }}
          </p>
          <Select v-model="minRoleModel">
            <SelectTrigger class="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="NO_ROLE">
                {{ $t("pages.dedicated_servers.detail.access.no_role") }}
              </SelectItem>
              <SelectItem v-for="role in MIN_ROLES" :key="role" :value="role">
                {{
                  $t("pages.dedicated_servers.detail.access.role_and_up", {
                    role: $t(`roles.${role}`),
                  })
                }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <p :class="microLabelClasses">
            {{ $t("pages.dedicated_servers.detail.access.players") }}
            <span class="ml-1 tabular-nums text-foreground">{{
              draft.players.length
            }}</span>
          </p>
          <PlayerSearch
            :label="$t('pages.dedicated_servers.detail.access.add_player')"
            :ineligible="ineligiblePlayers"
            @selected="addPlayer"
          />
          <div
            v-if="draft.players.length"
            class="grid max-h-[320px] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2"
          >
            <div
              v-for="player in draft.players"
              :key="player.steam_id"
              class="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5"
            >
              <div class="min-w-0 flex-1">
                <PlayerDisplay
                  :player="player"
                  size="xs"
                  compact
                  :show-flag="true"
                  :show-role="false"
                  :show-elo="false"
                  :show-online="false"
                  :tooltip="false"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6 shrink-0 [&_svg]:size-3.5"
                :aria-label="
                  $t('pages.dedicated_servers.detail.access.remove')
                "
                @click="removePlayer(player.steam_id)"
              >
                <X />
              </Button>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <p :class="microLabelClasses">
            {{ $t("pages.dedicated_servers.detail.access.events") }}
            <span class="ml-1 tabular-nums text-foreground">{{
              draft.events.length
            }}</span>
          </p>
          <EventSearch
            :label="$t('pages.dedicated_servers.detail.access.add_event')"
            :exclude="draft.events.map((event) => event.id)"
            @selected="addEvent"
          />
          <p class="text-xs text-muted-foreground">
            {{ $t("pages.dedicated_servers.detail.access.events_hint") }}
          </p>
          <div v-if="draft.events.length" class="space-y-1.5">
            <div
              v-for="event in draft.events"
              :key="event.id"
              class="flex items-center gap-3 rounded-md border border-border/60 bg-background/40 px-2.5 py-2"
            >
              <CalendarDays
                class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              />
              <div class="min-w-0 flex-1">
                <NuxtLink
                  :to="`/events/${event.id}`"
                  class="block truncate text-sm font-semibold hover:underline"
                >
                  {{ event.name }}
                </NuxtLink>
                <p
                  class="font-mono text-[0.62rem] text-muted-foreground"
                >
                  {{ eventWindow(event) }}
                </p>
              </div>
              <Badge
                :variant="phaseBadgeVariant(eventPhase(event))"
                class="shrink-0"
              >
                {{ $t(phaseLabelKey(eventPhase(event))) }}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                class="h-6 w-6 shrink-0 [&_svg]:size-3.5"
                :aria-label="
                  $t('pages.dedicated_servers.detail.access.remove')
                "
                @click="removeEvent(event.id)"
              >
                <X />
              </Button>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="p-4 text-sm text-muted-foreground">
        {{ $t("pages.dedicated_servers.detail.access.open_hint") }}
      </p>

      <SettingsSaveBar
        contained
        :dirty="dirty"
        :submitting="submitting"
        :description="$t('pages.dedicated_servers.detail.access.save_hint')"
        :action-label="$t('pages.dedicated_servers.detail.access.save')"
        @save="save"
        @discard="reset"
      />
    </div>
  </section>
</template>
