<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Library,
  ListOrdered,
  LogOut,
  Rocket,
  Save,
  Share2,
  Signal,
  Square,
  UserPlus,
  Wand2,
  X,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";
import ClipBoard from "~/components/ClipBoard.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
import UtilitySolvePanel from "~/components/utility/UtilitySolvePanel.vue";
import UtilitySaveLineupDialog from "~/components/utility/UtilitySaveLineupDialog.vue";
import { toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  inviteToUtilityPracticeMutation,
  joinUtilityPracticeMutation,
  leaveUtilityPracticeMutation,
  loadUtilityPlaybookIntoSessionMutation,
  utilityCollectionsQuery,
  utilityPlaybooksQuery,
  utilityPracticeServersQuery,
  utilityPracticeSessionSubscription,
  startUtilityPracticeMutation,
  stopUtilityPracticeMutation,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { readUtilityPracticeSession } from "~/types/utility";
import type {
  UtilityCollection,
  UtilityPlaybook,
  UtilityPracticeSession,
  UtilityPracticeSessionOutput,
} from "~/types/utility";

const props = withDefaults(
  defineProps<{
    mapName: string;
    lineupId?: string | null;
    // Preselects an execute to push into the server once it comes up.
    playbookId?: string | null;
    // Shared-link path — the invite code carried by ?practice=.
    joinInviteCode?: string | null;
    // In-app path, for callers that already hold the session id.
    joinSessionId?: string | null;
  }>(),
  {
    lineupId: null,
    playbookId: null,
    joinInviteCode: null,
    joinSessionId: null,
  },
);

const open = defineModel<boolean>("open", { default: false });

const { t } = useI18n();

// Reka Select rejects an empty-string value, so the "unset" choices ride
// sentinels — same shape as the league forms' value="none".
const ANY_REGION = "any";
const NO_COLLECTION = "none";
const NO_PLAYBOOK = "none";
const SERVER_PREFIX = "server:";

const regions = computed(() => useApplicationSettingsStore().availableRegions);
const region = ref<string>(ANY_REGION);
const collectionId = ref<string>(NO_COLLECTION);
const playbookChoice = ref<string>(NO_PLAYBOOK);
const isOpen = ref(true);
const practiceServers = ref<
  Array<{ id: string; label: string; region: string }>
>([]);
const collections = ref<UtilityCollection[]>([]);
const playbooks = ref<UtilityPlaybook[]>([]);
const sessionId = ref<string | null>(null);
const session = ref<UtilityPracticeSession | null>(null);
const started = ref<UtilityPracticeSessionOutput | null>(null);
const joining = ref(false);
const pendingPlaybookId = ref<string | null>(null);
const mode = ref<"session" | "solve">("session");

let sessionSub: { unsubscribe: () => void } | null = null;

function unsubscribeSession() {
  sessionSub?.unsubscribe();
  sessionSub = null;
}

function subscribeSession(id: string) {
  unsubscribeSession();
  sessionId.value = id;
  sessionSub = getGraphqlClient()
    .subscribe({
      query: utilityPracticeSessionSubscription,
      variables: { id },
    })
    .subscribe({
      next: ({ data }: { data: any }) => {
        session.value = data?.utility_practice_sessions_by_pk ?? null;
      },
      error: (error: unknown) => {
        console.error("[utility] practice session subscription error:", error);
      },
    });
}

// A practice book preloads the whole set into the server, which beats walking
// lineups in one at a time.
async function loadCollections() {
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityCollectionsQuery,
      variables: {
        where: { can_view: { _eq: true } },
        order_by: [{ created_at: order_by.desc }],
        limit: 50,
      },
      fetchPolicy: "cache-first",
    });
    collections.value = (data as any)?.utility_collections ?? [];
  } catch (error) {
    console.error("[utility] practice collection load error:", error);
    collections.value = [];
  }
}

async function loadPracticeServers() {
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityPracticeServersQuery,
      fetchPolicy: "network-only",
    });
    practiceServers.value = (data as any)?.utilityPracticeServers?.servers ?? [];
  } catch (error) {
    console.error("[utility] practice server load error:", error);
    practiceServers.value = [];
  }
}

async function loadPlaybooks() {
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityPlaybooksQuery,
      variables: {
        where: {
          map_name: { _eq: props.mapName },
          can_view: { _eq: true },
        },
        order_by: [{ updated_at: order_by.desc }],
        limit: 50,
      },
      fetchPolicy: "cache-first",
    });
    playbooks.value = (data as any)?.utility_playbooks ?? [];
  } catch (error) {
    console.error("[utility] practice playbook load error:", error);
    playbooks.value = [];
  }
}

watch(open, (isDialogOpen) => {
  if (!isDialogOpen) {
    mode.value = "session";
    return;
  }
  playbookChoice.value = props.playbookId ?? NO_PLAYBOOK;
  void loadPracticeServers();
  if (collections.value.length === 0) {
    void loadCollections();
  }
  if (playbooks.value.length === 0) {
    void loadPlaybooks();
  }
});

const selectedServerId = computed(() =>
  region.value.startsWith(SERVER_PREFIX)
    ? region.value.slice(SERVER_PREFIX.length)
    : null,
);

const joinTarget = computed(() => {
  if (props.joinInviteCode) {
    return {
      key: `code:${props.joinInviteCode}`,
      variables: { session_id: null, invite_code: props.joinInviteCode },
    };
  }
  if (props.joinSessionId) {
    return {
      key: `id:${props.joinSessionId}`,
      variables: { session_id: props.joinSessionId, invite_code: null },
    };
  }
  return null;
});

// An invite code is not a primary key, so the id to subscribe by comes back off
// the join itself rather than out of the link.
const joinedKey = ref<string | null>(null);

watch(
  () => [open.value, joinTarget.value] as const,
  async ([isOpen, target]) => {
    if (!isOpen || !target || joinedKey.value === target.key) {
      return;
    }
    joinedKey.value = target.key;
    joining.value = true;
    try {
      const { data } = await getGraphqlClient().mutate({
        mutation: joinUtilityPracticeMutation,
        variables: target.variables,
      });
      const output = (data as any)?.joinUtilityPractice as
        | UtilityPracticeSessionOutput
        | undefined;
      if (!output?.id) {
        throw new Error("no session");
      }
      started.value = output;
      subscribeSession(output.id);
    } catch (error: any) {
      joinedKey.value = null;
      toast({
        title: t("pages.utility.practice.join_failed"),
        description: error?.message,
        variant: "destructive",
      });
    } finally {
      joining.value = false;
    }
  },
  { immediate: true },
);

onBeforeUnmount(unsubscribeSession);

async function start() {
  try {
    const { data } = await getGraphqlClient().mutate({
      mutation: startUtilityPracticeMutation,
      variables: {
        map_name: props.mapName,
        region: selectedServerId.value
          ? null
          : region.value === ANY_REGION
            ? null
            : region.value,
        server_id: selectedServerId.value,
        collection_id:
          collectionId.value === NO_COLLECTION ? null : collectionId.value,
        is_open: isOpen.value,
      },
    });
    const output = (data as any)?.startUtilityPractice as
      | UtilityPracticeSessionOutput
      | undefined;
    if (!output?.id) {
      throw new Error("no session");
    }
    started.value = output;
    subscribeSession(output.id);
    // The action only takes a live session, and a freshly started one is still
    // booting — the load is queued until the row says it is up.
    pendingPlaybookId.value =
      playbookChoice.value === NO_PLAYBOOK ? null : playbookChoice.value;
  } catch (error: any) {
    toast({
      title: t("pages.utility.practice.start_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

async function stop() {
  const id = sessionId.value;
  if (!id) {
    return;
  }
  try {
    await getGraphqlClient().mutate({
      mutation: stopUtilityPracticeMutation,
      variables: { session_id: id },
    });
    unsubscribeSession();
    sessionId.value = null;
    session.value = null;
    started.value = null;
    joinedKey.value = null;
    pendingPlaybookId.value = null;
    mode.value = "session";
  } catch (error: any) {
    toast({
      title: t("pages.utility.practice.stop_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

type UtilityInvitee = { steamId: string; name: string };

const invitees = ref<UtilityInvitee[]>([]);
const inviting = ref(false);

/**
 * The other end of the session for everyone who is not the host. Stopping is
 * `can_manage`'s to do and always was; without this a joiner is stuck on the
 * roster of a server they cannot end.
 */
async function leave() {
  const id = sessionId.value;
  if (!id) {
    return;
  }
  try {
    await getGraphqlClient().mutate({
      mutation: leaveUtilityPracticeMutation,
      variables: { session_id: id },
    });
    unsubscribeSession();
    sessionId.value = null;
    session.value = null;
    started.value = null;
    pendingPlaybookId.value = null;
    invitees.value = [];
    mode.value = "session";
    // `joinedKey` is deliberately NOT cleared. The invite code is still in the
    // URL, and clearing it lets the join watcher put the leaver straight back
    // into the session they just left the next time this dialog opens.
  } catch (error: any) {
    toast({
      title: t("pages.utility.practice.leave_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

const inviteeSteamIds = computed(() =>
  invitees.value.map((entry) => entry.steamId),
);

function addInvitee(player: { steam_id?: string; name?: string } | null) {
  const steamId = String(player?.steam_id ?? "");
  if (!steamId || inviteeSteamIds.value.includes(steamId)) {
    return;
  }
  invitees.value = [
    ...invitees.value,
    { steamId, name: player?.name || steamId },
  ];
}

function removeInvitee(steamId: string) {
  invitees.value = invitees.value.filter((entry) => entry.steamId !== steamId);
}

async function invitePlayers() {
  const id = sessionId.value;
  if (!id || !invitees.value.length) {
    return;
  }
  inviting.value = true;
  try {
    await getGraphqlClient().mutate({
      mutation: inviteToUtilityPracticeMutation,
      variables: {
        session_id: id,
        steam_ids: inviteeSteamIds.value,
      },
    });
    toast({
      title: t("pages.utility.practice.invited", {
        count: invitees.value.length,
      }),
    });
    invitees.value = [];
  } catch (error: any) {
    toast({
      title: t("pages.utility.practice.invite_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    inviting.value = false;
  }
}

const saveFromPracticeOpen = ref(false);

// Column names stop here: everything below reads the mapped view.
const practice = computed(() =>
  readUtilityPracticeSession(session.value, started.value),
);

// Host-only, live-only. can_manage is the server's answer to "may this viewer
// drive the session", so it gates the controls rather than a steam id compare.
const canDriveSession = computed(
  () => !!sessionId.value && practice.value.isLive && practice.value.canManage,
);

// Saving a throw is not driving the session — anybody in a live one, drilling a
// lineup they opened this from, has a throw of their own to keep.
const canSaveFromPractice = computed(
  () => !!sessionId.value && practice.value.isLive && !!props.lineupId,
);

const loadedPlaybook = computed(
  () =>
    playbooks.value.find(
      (entry) => entry.id === practice.value.playbookId,
    ) ?? null,
);

async function applyPlaybook(id: string | null) {
  const session = sessionId.value;
  if (!session) {
    return;
  }
  try {
    await getGraphqlClient().mutate({
      mutation: loadUtilityPlaybookIntoSessionMutation,
      variables: { session_id: session, playbook_id: id },
    });
  } catch (error: any) {
    toast({
      title: t("pages.utility.playbooks.load_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

watch(canDriveSession, (ready) => {
  if (!ready || !pendingPlaybookId.value) {
    return;
  }
  const id = pendingPlaybookId.value;
  pendingPlaybookId.value = null;
  void applyPlaybook(id);
});

// Shares the invite code, never the primary key: the code is what the column
// exists for, and a session can be re-shared without leaking its id.
const inviteLink = computed(() => {
  const code = practice.value.inviteCode;
  if (!code || typeof window === "undefined") {
    return null;
  }
  const path = props.lineupId
    ? `/utility/lineup/${props.lineupId}`
    : `/utility/${props.mapName}`;
  return `${window.location.origin}${path}?practice=${code}`;
});

const isBooting = computed(
  () => !!sessionId.value && !practice.value.connectionString,
);

const connectServer = computed(() => ({
  connection_string: practice.value.connectionString,
  connection_link: practice.value.connectionLink,
}));
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent :class="mode === 'solve' ? 'sm:max-w-3xl' : 'sm:max-w-lg'">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Rocket class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
          {{ $t("pages.utility.practice.title") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("pages.utility.practice.description") }}
        </DialogDescription>
      </DialogHeader>

      <UtilitySolvePanel
        v-if="mode === 'solve' && sessionId"
        :session-id="sessionId"
        :map-name="mapName"
        @back="mode = 'session'"
      />

      <div v-else class="space-y-4">
        <div v-if="!sessionId" class="space-y-2">
          <span
            class="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <Signal class="h-3.5 w-3.5" />
            {{ $t("pages.utility.practice.region") }}
          </span>
          <Select v-model="region">
            <SelectTrigger>
              <SelectValue
                :placeholder="$t('pages.utility.practice.select_region')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem :value="ANY_REGION">
                  {{ $t("pages.utility.practice.any_region") }}
                </SelectItem>
              </SelectGroup>
              <SelectGroup v-if="practiceServers.length">
                <SelectLabel>
                  {{ $t("pages.utility.practice.dedicated_servers") }}
                </SelectLabel>
                <SelectItem
                  v-for="entry of practiceServers"
                  :key="entry.id"
                  :value="`${SERVER_PREFIX}${entry.id}`"
                >
                  {{ entry.label }}
                  <span class="text-muted-foreground">({{ entry.region }})</span>
                </SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>{{ $t("match.server.on_demand") }}</SelectLabel>
                <SelectItem
                  v-for="entry of regions"
                  :key="entry.value"
                  :value="entry.value"
                >
                  {{ entry.description || entry.value }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <p
            v-if="!regions.length && !practiceServers.length"
            class="text-xs text-muted-foreground"
          >
            {{ $t("pages.utility.practice.no_regions") }}
          </p>

          <span
            class="flex items-center gap-2 pt-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <Library class="h-3.5 w-3.5" />
            {{ $t("pages.utility.practice.collection") }}
          </span>
          <Select v-model="collectionId">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="NO_COLLECTION">
                {{ $t("pages.utility.practice.no_collection") }}
              </SelectItem>
              <SelectItem
                v-for="entry of collections"
                :key="entry.id"
                :value="entry.id"
              >
                {{ entry.name }}
              </SelectItem>
            </SelectContent>
          </Select>

          <template v-if="playbooks.length">
            <span
              class="flex items-center gap-2 pt-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
            >
              <ListOrdered class="h-3.5 w-3.5" />
              {{ $t("pages.utility.playbooks.load_label") }}
            </span>
            <Select v-model="playbookChoice">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NO_PLAYBOOK">
                  {{ $t("common.none") }}
                </SelectItem>
                <SelectItem
                  v-for="entry of playbooks"
                  :key="entry.id"
                  :value="entry.id"
                >
                  {{ entry.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </template>

          <label
            class="flex items-center justify-between gap-3 rounded-md border border-border bg-foreground/5 px-3 py-2"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium">
                {{ $t("pages.utility.practice.open_session") }}
              </span>
              <span class="block text-xs text-muted-foreground">
                {{ $t("pages.utility.practice.open_session_hint") }}
              </span>
            </span>
            <Switch
              :model-value="isOpen"
              @update:model-value="(value) => (isOpen = value)"
            />
          </label>
        </div>

        <div
          v-if="isBooting || joining"
          class="flex items-center gap-3 rounded-md border border-border bg-foreground/5 p-4"
        >
          <Spinner class="shrink-0" />
          <div class="min-w-0">
            <div class="text-sm font-medium">
              {{ $t("pages.utility.practice.booting") }}
            </div>
            <p
              v-if="practice.failureReason"
              class="mt-1 whitespace-pre-wrap break-words text-xs text-[hsl(var(--tac-amber))]"
            >
              {{ practice.failureReason }}
            </p>
          </div>
        </div>

        <div
          v-else-if="practice.connectionString"
          class="space-y-3 rounded-md border border-border bg-foreground/5 p-4"
        >
          <QuickServerConnect :server="connectServer" highlight />

          <template v-if="inviteLink && practice.isOpen">
            <Separator />
            <div class="flex items-center gap-2">
              <ClipBoard :data="inviteLink" />
              <div class="min-w-0">
                <div
                  class="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  <Share2 class="h-3 w-3" />
                  {{ $t("pages.utility.practice.invite") }}
                </div>
                <p class="truncate text-xs text-muted-foreground/80">
                  {{ inviteLink }}
                </p>
              </div>
            </div>
          </template>

          <!-- The link reaches somebody who is not on the panel. This reaches
               the four people who are, and puts them on the roster directly. -->
          <template v-if="canDriveSession">
            <Separator />
            <div class="space-y-2">
              <div
                class="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground"
              >
                <UserPlus class="h-3 w-3" />
                {{ $t("pages.utility.practice.invite_players") }}
              </div>
              <p class="text-xs text-muted-foreground">
                {{ $t("pages.utility.practice.invite_players_hint") }}
              </p>

              <PlayerSearch
                :label="$t('pages.utility.practice.pick_players')"
                :exclude="inviteeSteamIds"
                @selected="addInvitee"
              />

              <div v-if="invitees.length" class="flex flex-wrap gap-1.5">
                <button
                  v-for="entry of invitees"
                  :key="entry.steamId"
                  type="button"
                  class="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-1.5 py-0.5 text-[0.7rem] transition-colors hover:border-destructive/50"
                  :title="$t('common.remove')"
                  @click="removeInvitee(entry.steamId)"
                >
                  {{ entry.name }}
                  <X class="h-3 w-3 opacity-70" />
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                :loading="inviting"
                :disabled="!invitees.length"
                @click="invitePlayers()"
              >
                <UserPlus class="mr-1 h-4 w-4" />
                {{
                  $t("pages.utility.practice.send_invites", {
                    count: invitees.length,
                  })
                }}
              </Button>
            </div>
          </template>
        </div>

        <div
          v-if="canDriveSession"
          class="space-y-2 rounded-md border border-border bg-foreground/5 p-4"
        >
          <span
            class="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <ListOrdered class="h-3.5 w-3.5" />
            {{ $t("pages.utility.playbooks.load_label") }}
          </span>
          <p v-if="loadedPlaybook" class="text-xs text-muted-foreground">
            {{
              $t("pages.utility.playbooks.loaded", { name: loadedPlaybook.name })
            }}
          </p>
          <div class="flex items-center gap-2">
            <div class="min-w-0 flex-1">
              <Select v-model="playbookChoice">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="NO_PLAYBOOK">
                    {{ $t("common.none") }}
                  </SelectItem>
                  <SelectItem
                    v-for="entry of playbooks"
                    :key="entry.id"
                    :value="entry.id"
                  >
                    {{ entry.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              @click="
                applyPlaybook(
                  playbookChoice === NO_PLAYBOOK ? null : playbookChoice,
                )
              "
            >
              {{
                playbookChoice === NO_PLAYBOOK
                  ? $t("pages.utility.playbooks.unload")
                  : $t("pages.utility.playbooks.load")
              }}
            </Button>
          </div>
        </div>

        <div
          v-if="canDriveSession"
          class="space-y-2 rounded-md border border-border bg-foreground/5 p-4"
        >
          <span
            class="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <Wand2 class="h-3.5 w-3.5" />
            {{ $t("pages.utility.solve.title") }}
          </span>
          <p class="text-xs text-muted-foreground">
            {{ $t("pages.utility.solve.entry_hint") }}
          </p>
          <Button variant="outline" @click="mode = 'solve'">
            {{ $t("pages.utility.solve.open") }}
          </Button>
        </div>

        <div
          v-if="canSaveFromPractice"
          class="space-y-2 rounded-md border border-border bg-foreground/5 p-4"
        >
          <span
            class="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <Save class="h-3.5 w-3.5" />
            {{ $t("pages.utility.save.practice_entry_title") }}
          </span>
          <p class="text-xs text-muted-foreground">
            {{ $t("pages.utility.save.practice_entry_hint") }}
          </p>
          <Button variant="outline" @click="saveFromPracticeOpen = true">
            {{ $t("pages.utility.save.practice_entry_open") }}
          </Button>
        </div>
      </div>

      <DialogFooter v-if="mode !== 'solve'" class="gap-2 sm:justify-between">
        <!-- can_manage, not a host_steam_id comparison: whether a viewer may
             end the session is the server's call, not the client's. -->
        <Button
          v-if="sessionId && practice.canManage"
          variant="destructive"
          @click="stop()"
        >
          <Square class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.practice.stop") }}
        </Button>
        <!-- Everyone else gets the door rather than nothing: a joiner cannot
             end a session that is not theirs, but they can stop being in it. -->
        <Button v-else-if="sessionId" variant="outline" @click="leave()">
          <LogOut class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.practice.leave") }}
        </Button>
        <Button v-else class="tac-amber-cta" @click="start()">
          <Rocket class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.practice.start") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <UtilitySaveLineupDialog
    v-model:open="saveFromPracticeOpen"
    source="practice"
    :session-id="sessionId"
    :utility-lineup-id="lineupId"
  />
</template>
