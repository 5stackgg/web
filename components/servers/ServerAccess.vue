<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useQuery } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import EventSearch from "~/components/events/EventSearch.vue";
import {
  eventPhase,
  formatEventDate,
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

// Moderators and up always get in, so only the roles below them are useful
// as a floor.
const MIN_ROLES = ["user", "verified_user", "streamer"];
const NO_ROLE = "none";
const PLUGIN_STALE_MS = 3 * 60 * 1000;

// Raw documents: the access tables are newer than ~/generated/zeus until
// codegen runs against a migrated database.
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

const { result, refetch } = useQuery(
  QUERY,
  () => ({ serverId: props.serverId }),
  { fetchPolicy: "cache-and-network" },
);

function emptyDraft(): Draft {
  return { restricted: false, minRole: NO_ROLE, players: [], events: [] };
}

// The entries themselves are never edited, only added or dropped, so copying
// the lists is a full copy; structuredClone refuses Vue's reactive proxies.
function copy(value: Draft): Draft {
  return {
    ...value,
    players: [...value.players],
    events: [...value.events],
  };
}

const draft = ref<Draft>(emptyDraft());
const savedDraft = ref<Draft>(emptyDraft());
const now = ref(Date.now());

const clock = setInterval(() => {
  now.value = Date.now();
}, 30_000);

onBeforeUnmount(() => clearInterval(clock));

const server = computed(() => (result.value as any)?.servers_by_pk);

const steamIdsOf = (value: Draft) =>
  value.players.map((player) => player.steam_id);
const eventIdsOf = (value: Draft) => value.events.map((event) => event.id);

function countMissing(from: Array<string>, other: Array<string>): number {
  return from.filter((id) => !other.includes(id)).length;
}

const changes = computed<Array<{ text: string; restart: boolean }>>(() => {
  const before = savedDraft.value;
  const after = draft.value;
  const list: Array<string> = [];
  const key = "pages.dedicated_servers.detail.settings.changes";

  if (after.restricted !== before.restricted) {
    list.push(t(after.restricted ? `${key}.restricted` : `${key}.opened`));
  }

  if (after.minRole !== before.minRole) {
    list.push(t(`${key}.min_role`));
  }

  const playersAdded = countMissing(steamIdsOf(after), steamIdsOf(before));
  const playersRemoved = countMissing(steamIdsOf(before), steamIdsOf(after));
  const eventsAdded = countMissing(eventIdsOf(after), eventIdsOf(before));
  const eventsRemoved = countMissing(eventIdsOf(before), eventIdsOf(after));

  if (playersAdded) {
    list.push(t(`${key}.players_added`, { count: playersAdded }));
  }

  if (playersRemoved) {
    list.push(t(`${key}.players_removed`, { count: playersRemoved }));
  }

  if (eventsAdded) {
    list.push(t(`${key}.events_added`, { count: eventsAdded }));
  }

  if (eventsRemoved) {
    list.push(t(`${key}.events_removed`, { count: eventsRemoved }));
  }

  return list.map((text) => ({ text, restart: false }));
});

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

function reset() {
  savedDraft.value = fromServer();
  draft.value = copy(savedDraft.value);
}

watch(
  result,
  () => {
    if (!changes.value.length) {
      reset();
    }
  },
  { immediate: true },
);

const minRoleModel = computed({
  get: () => draft.value.minRole,
  set: (value: string) => {
    draft.value = { ...draft.value, minRole: value };
  },
});

const ineligiblePlayers = computed(() =>
  Object.fromEntries(
    steamIdsOf(draft.value).map((steamId) => [
      steamId,
      t("pages.dedicated_servers.detail.access.already_added"),
    ]),
  ),
);

function setRestricted(restricted: boolean) {
  draft.value = { ...draft.value, restricted };
}

function addPlayer(player: AccessPlayer) {
  const steamId = String(player.steam_id);

  if (steamIdsOf(draft.value).includes(steamId)) {
    return;
  }

  draft.value = {
    ...draft.value,
    players: [...draft.value.players, { ...player, steam_id: steamId }],
  };
}

function removePlayer(steamId: string) {
  draft.value = {
    ...draft.value,
    players: draft.value.players.filter(
      (player) => player.steam_id !== steamId,
    ),
  };
}

function addEvent(event: AccessEvent) {
  if (eventIdsOf(draft.value).includes(event.id)) {
    return;
  }

  draft.value = { ...draft.value, events: [...draft.value.events, event] };
}

function removeEvent(eventId: string) {
  draft.value = {
    ...draft.value,
    events: draft.value.events.filter((event) => event.id !== eventId),
  };
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

function payload() {
  return {
    restricted: draft.value.restricted,
    min_role: draft.value.minRole === NO_ROLE ? null : draft.value.minRole,
    steam_ids: steamIdsOf(draft.value),
    event_ids: eventIdsOf(draft.value),
  };
}

async function saved() {
  savedDraft.value = copy(draft.value);

  await refetch();
}

defineExpose({ changes, payload, reset, saved });
</script>

<template>
  <div class="grid gap-8">
    <SettingsSection
      id="server-access-restricted"
      :title="$t('pages.dedicated_servers.detail.access.restricted')"
      :description="$t('pages.dedicated_servers.detail.access.description')"
      clickable-header
      @header-click="setRestricted(!draft.restricted)"
    >
      <template #action>
        <Switch
          :model-value="draft.restricted"
          :aria-label="$t('pages.dedicated_servers.detail.access.restricted')"
          @update:model-value="setRestricted"
        />
      </template>
      <p class="text-sm text-muted-foreground">
        {{
          draft.restricted
            ? $t("pages.dedicated_servers.detail.access.staff")
            : $t("pages.dedicated_servers.detail.access.open_hint")
        }}
      </p>
      <p
        v-if="draft.restricted && pluginMissing"
        class="text-sm text-[hsl(var(--tac-amber))]"
      >
        {{ $t("pages.dedicated_servers.detail.access.plugin_missing") }}
      </p>
    </SettingsSection>

    <template v-if="draft.restricted">
      <SettingsSection
        id="server-access-role"
        :title="$t('pages.dedicated_servers.detail.access.min_role')"
        :description="$t('pages.dedicated_servers.detail.access.min_role_hint')"
      >
        <Select v-model="minRoleModel">
          <SelectTrigger
            class="w-full sm:max-w-xs"
            :aria-label="$t('pages.dedicated_servers.detail.access.min_role')"
          >
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
      </SettingsSection>

      <SettingsSection
        id="server-access-players"
        :title="$t('pages.dedicated_servers.detail.access.players')"
        :description="$t('pages.dedicated_servers.detail.access.players_hint')"
      >
        <div class="sm:max-w-xs">
          <PlayerSearch
            :label="$t('pages.dedicated_servers.detail.access.add_player')"
            :ineligible="ineligiblePlayers"
            @selected="addPlayer"
          />
        </div>
        <div
          v-if="draft.players.length"
          class="grid max-h-[320px] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2"
        >
          <div
            v-for="player in draft.players"
            :key="player.steam_id"
            class="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5"
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
              class="h-6 w-6 shrink-0 text-muted-foreground [&_svg]:size-3.5"
              :aria-label="$t('pages.dedicated_servers.detail.access.remove')"
              @click="removePlayer(player.steam_id)"
            >
              <X />
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        id="server-access-events"
        :title="$t('pages.dedicated_servers.detail.access.events')"
        :description="$t('pages.dedicated_servers.detail.access.events_hint')"
      >
        <div class="sm:max-w-xs">
          <EventSearch
            :label="$t('pages.dedicated_servers.detail.access.add_event')"
            :exclude="eventIdsOf(draft)"
            @selected="addEvent"
          />
        </div>
        <div v-if="draft.events.length" class="grid gap-1.5">
          <div
            v-for="event in draft.events"
            :key="event.id"
            class="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2"
          >
            <div class="min-w-0 flex-1">
              <NuxtLink
                :to="`/events/${event.id}`"
                class="block truncate text-sm font-medium hover:underline"
              >
                {{ event.name }}
              </NuxtLink>
              <p class="text-xs text-muted-foreground">
                {{ eventWindow(event) }}
              </p>
            </div>
            <span
              class="inline-flex shrink-0 items-center gap-1.5 text-xs"
              :class="
                eventPhase(event) === 'live'
                  ? 'text-success'
                  : 'text-muted-foreground'
              "
            >
              <span
                v-if="eventPhase(event) === 'live'"
                class="h-1.5 w-1.5 rounded-full bg-success"
              />
              {{ $t(phaseLabelKey(eventPhase(event))) }}
            </span>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6 shrink-0 text-muted-foreground [&_svg]:size-3.5"
              :aria-label="$t('pages.dedicated_servers.detail.access.remove')"
              @click="removeEvent(event.id)"
            >
              <X />
            </Button>
          </div>
        </div>
      </SettingsSection>
    </template>
  </div>
</template>
