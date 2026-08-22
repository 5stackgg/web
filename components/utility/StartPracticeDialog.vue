<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ListOrdered, Save, ShieldCheck, Signal } from "lucide-vue-next";
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
import { Separator } from "~/components/ui/separator";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import RegionLatency from "~/components/matchmaking/RegionLatency.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import UtilityPracticeSessionPanel from "~/components/utility/UtilityPracticeSessionPanel.vue";
import UtilitySaveLineupDialog from "~/components/utility/UtilitySaveLineupDialog.vue";
import { toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  joinUtilityPracticeMutation,
  loadUtilityPlaybookIntoSessionMutation,
  utilityPlaybooksQuery,
  myUtilityPracticeSessionQuery,
  utilityPracticeServersQuery,
  utilityPracticeSessionSubscription,
  startUtilityPracticeMutation,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { readUtilityPracticeSession } from "~/types/utility";
import {
  UTILITY_ACCESS_FRIENDS,
  UTILITY_ACCESS_OPEN,
  utilityAccessOptions,
} from "~/utilities/utilityPracticeAccess";
import cleanMapName from "~/utilities/cleanMapName";
import type {
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
const NO_PLAYBOOK = "none";
const SERVER_PREFIX = "server:";

const regions = computed(() => useApplicationSettingsStore().availableRegions);
const region = ref<string>(ANY_REGION);
const playbookChoice = ref<string>(NO_PLAYBOOK);

// Friends, not Open. A practice server is a solo drill by default and the host
// is the only person who has asked to be on it -- handing a link to the whole
// internet is the deliberate choice, not the one made for you.
const access = ref<string>(UTILITY_ACCESS_FRIENDS);

const accessOptions = utilityAccessOptions;

const accessFilterOptions = computed(() =>
  accessOptions.map((option) => ({
    key: option.value,
    label: t(option.label),
    icon: option.icon,
  })),
);

const accessDescription = computed(
  () =>
    accessOptions.find((option) => option.value === access.value)?.desc ??
    accessOptions[0].desc,
);
const practiceServers = ref<
  Array<{
    id: string;
    label: string;
    region: string;
    in_use: boolean;
    held_by: string | null;
  }>
>([]);
const practiceServersError = ref<string | null>(null);
const playbooks = ref<UtilityPlaybook[]>([]);
const sessionId = ref<string | null>(null);
const session = ref<UtilityPracticeSession | null>(null);
const started = ref<UtilityPracticeSessionOutput | null>(null);
const joining = ref(false);
// The mutation can sit for seconds on an on-demand region before a session id
// comes back, and until it does nothing on screen has moved.
const starting = ref(false);
const pendingPlaybookId = ref<string | null>(null);

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
// A session outlives the page that started it. Without this the host refreshes,
// the dialog forgets, and a server they are still holding looks like one they
// never booked -- with no way back to its connect string or its stop button.
async function restoreLiveSession() {
  if (sessionId.value || props.joinInviteCode || props.joinSessionId) {
    return;
  }

  const steamId = useAuthStore().me?.steam_id;

  if (!steamId) {
    return;
  }

  try {
    const { data } = await getGraphqlClient().query({
      query: myUtilityPracticeSessionQuery,
      variables: { steam_id: steamId, statuses: ["Starting", "Ready"] },
      fetchPolicy: "network-only",
    });
    const live = ((data as any)?.utility_practice_sessions ?? [])[0];

    if (live?.id) {
      session.value = live;
      subscribeSession(live.id);
    }
  } catch (error) {
    console.error("[utility] live session restore error:", error);
  }
}

async function loadPracticeServers() {
  practiceServersError.value = null;
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityPracticeServersQuery,
      fetchPolicy: "network-only",
    });
    practiceServers.value =
      (data as any)?.utilityPracticeServers?.servers ?? [];
  } catch (error: any) {
    // Surfaced, not swallowed: an empty picker and a broken lookup look
    // identical from the outside, and the difference is the whole diagnosis.
    practiceServersError.value = error?.message ?? "unknown error";
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
    return;
  }
  playbookChoice.value = props.playbookId ?? NO_PLAYBOOK;
  void restoreLiveSession();
  void loadPracticeServers();
  if (playbooks.value.length === 0) {
    void loadPlaybooks();
  }
});

const selectedServerId = computed(() =>
  region.value.startsWith(SERVER_PREFIX)
    ? region.value.slice(SERVER_PREFIX.length)
    : null,
);

// Free first. A picker whose first three rows are greyed out reads as "there
// is nothing here", and the one server you can actually have is below them.
const sortedPracticeServers = computed(() =>
  [...practiceServers.value].sort((a, b) => {
    if (a.in_use !== b.in_use) {
      return a.in_use ? 1 : -1;
    }
    return a.label.localeCompare(b.label);
  }),
);

const freeServerCount = computed(
  () => practiceServers.value.filter((entry) => !entry.in_use).length,
);

// LAN regions only exist for the people who can reach them, and the probe is
// the only thing that knows which people those are -- the same test the
// matchmaking region list runs.
const onDemandRegions = computed(() =>
  regions.value.filter(
    (entry: any) =>
      !entry.is_lan ||
      useMatchmakingStore().getRegionlatencyResult(entry.value)?.isLan,
  ),
);

// Only the automatic choice needs a line under the closed select: it is the one
// row whose name does not say what it does. A named server and a named region
// explain themselves, and captioning them just put a sentence under every
// selection.
const regionHint = computed(() =>
  region.value === ANY_REGION ? "pages.utility.practice.region_any_hint" : null,
);

// A fixed gutter in front of every label, whether or not that row has a status
// dot to put in it. Without it the dotted rows sit one gap further right than
// the plain ones and the list has two left edges.
const optionGutter = "flex w-1.5 shrink-0 items-center justify-center";

// The item row lives inside reka's SelectItemText span, which is inline and
// would not stretch -- so the ping on the right would sit against the label
// rather than against the edge.
const optionRow =
  "[&>span:last-child]:flex [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1 [&>span:last-child]:items-center [&>span:last-child]:gap-2";

// The dropdown's own headings, in the same mono the form labels use -- the
// shadcn default is a plain bold sentence, which read as another option.
const groupLabel =
  "flex items-center gap-1.5 px-2 pb-0 pt-2 font-mono text-[0.58rem] font-normal uppercase tracking-[0.16em] text-muted-foreground";

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
        UtilityPracticeSessionOutput | undefined;
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
  starting.value = true;
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
        // Collections have no browse surface anywhere in the app, so there is
        // nothing to choose from and nothing to send.
        collection_id: null,
        is_open: access.value === UTILITY_ACCESS_OPEN,
        access: access.value,
      },
    });
    const output = (data as any)?.startUtilityPractice as
      UtilityPracticeSessionOutput | undefined;
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
  } finally {
    starting.value = false;
  }
}

/**
 * The panel ran the mutation; this is the local state that was tracking the
 * session it just ended. `joinedKey` is cleared only for a stop: after a leave
 * the invite code is still in the URL, and clearing it would let the join
 * watcher put the leaver straight back in the next time this opens.
 */
// Handing off to Steam is the end of what this dialog is for.
function onJoinedServer() {
  open.value = false;
}

function onSessionEnded() {
  const wasHost = practice.value.canManage;

  unsubscribeSession();
  sessionId.value = null;
  session.value = null;
  started.value = null;
  pendingPlaybookId.value = null;

  if (wasHost) {
    joinedKey.value = null;
  }
}

const saveFromPracticeOpen = ref(false);

// Column names stop here: everything below reads the mapped view.
const practice = computed(() =>
  readUtilityPracticeSession(session.value, started.value),
);

// Live and host-driven: what the queued execute waits for before it can be
// pushed into the server.
const canDriveSession = computed(
  () => !!sessionId.value && practice.value.isLive && practice.value.canManage,
);

// Saving a throw is not driving the session — anybody in a live one, drilling a
// lineup they opened this from, has a throw of their own to keep.
const canSaveFromPractice = computed(
  () => !!sessionId.value && practice.value.isLive && !!props.lineupId,
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

// The description says "this map"; the header says which one.
const mapDisplay = computed(() => cleanMapName(props.mapName));

// One rhythm for every field heading in the form -- they were four copies of
// the same string, drifting on padding.
const fieldLabel =
  "flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground";

// The footer shows exactly one control at a time, so they share a shape: the
// app's full-width tactical CTA treatment, as on the match and draft alerts.
const footerCta = "w-full font-bold uppercase tracking-[0.22em]";
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <span
          class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
        >
          {{ mapDisplay }}
        </span>
        <DialogTitle>
          {{ $t("pages.utility.practice.title") }}
        </DialogTitle>
        <DialogDescription>
          {{
            sessionId || joining
              ? $t("pages.utility.practice.description_live")
              : $t("pages.utility.practice.description")
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div v-if="!sessionId && !joining" class="space-y-4">
          <div class="space-y-1.5">
            <span :class="fieldLabel">
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
                <!-- The default, and the only row that does not name a
                     machine: it is a preference, not a place. It gets a
                     heading like the other two groups so the list reads as
                     three ways to answer rather than one loose row above two
                     labelled sets. -->
                <SelectGroup>
                  <SelectLabel :class="groupLabel">
                    {{ $t("pages.utility.practice.region_recommended") }}
                  </SelectLabel>
                  <SelectItem :value="ANY_REGION" :class="optionRow">
                    <span :class="optionGutter" aria-hidden="true" />
                    <span class="truncate">
                      {{ $t("pages.utility.practice.any_region") }}
                    </span>
                  </SelectItem>
                </SelectGroup>

                <SelectGroup v-if="practiceServers.length">
                  <SelectLabel :class="groupLabel">
                    {{ $t("pages.utility.practice.dedicated_servers") }}
                    <span
                      v-if="freeServerCount"
                      class="text-[hsl(var(--tac-amber))]"
                    >
                      ·
                      {{
                        $t("pages.utility.practice.servers_free", {
                          count: freeServerCount,
                        })
                      }}
                    </span>
                  </SelectLabel>
                  <SelectItem
                    v-for="entry of sortedPracticeServers"
                    :key="entry.id"
                    :value="`${SERVER_PREFIX}${entry.id}`"
                    :disabled="entry.in_use"
                    :class="optionRow"
                  >
                    <!-- Taken or yours to take, before the label is read. -->
                    <span :class="optionGutter">
                      <span
                        class="h-1.5 w-1.5 rounded-full"
                        :class="
                          entry.in_use
                            ? 'bg-muted-foreground/40'
                            : 'bg-emerald-400'
                        "
                      />
                    </span>
                    <span class="truncate">
                      {{ entry.label }}
                      <span class="text-muted-foreground">
                        ({{ entry.region }})
                      </span>
                    </span>
                    <span
                      v-if="entry.in_use"
                      class="ml-auto shrink-0 truncate pl-2 text-xs text-muted-foreground"
                    >
                      {{
                        entry.held_by
                          ? $t("pages.utility.practice.server_held_by", {
                              name: entry.held_by,
                            })
                          : $t("pages.utility.practice.server_in_use")
                      }}
                    </span>
                  </SelectItem>
                </SelectGroup>

                <SelectGroup v-if="onDemandRegions.length">
                  <SelectLabel :class="groupLabel">
                    {{ $t("match.server.on_demand") }}
                  </SelectLabel>
                  <SelectItem
                    v-for="entry of onDemandRegions"
                    :key="entry.value"
                    :value="entry.value"
                    :class="optionRow"
                  >
                    <span :class="optionGutter" aria-hidden="true" />
                    <span class="truncate">
                      {{ entry.description || entry.value }}
                    </span>
                    <!-- Which of them is actually near you: the one thing a
                         region name never says. -->
                    <RegionLatency
                      :region="entry.value"
                      class="ml-auto shrink-0 pl-2"
                    />
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <p
              v-if="practiceServersError"
              class="text-xs text-[hsl(var(--tac-amber))]"
            >
              {{
                $t("pages.utility.practice.servers_unavailable", {
                  error: practiceServersError,
                })
              }}
            </p>
            <p
              v-else-if="!regions.length && !practiceServers.length"
              class="text-xs text-muted-foreground"
            >
              {{ $t("pages.utility.practice.no_regions") }}
            </p>
            <!-- What the row you picked actually costs you, once the list that
                 explained it has closed. -->
            <p
              v-else-if="regionHint"
              class="text-xs leading-relaxed text-muted-foreground"
            >
              {{ $t(regionHint) }}
            </p>
          </div>

          <div v-if="playbooks.length" class="space-y-1.5">
            <span :class="fieldLabel">
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
          </div>

          <div class="space-y-1.5">
            <span :class="fieldLabel">
              <ShieldCheck class="h-3.5 w-3.5" />
              {{ $t("pages.utility.practice.access") }}
            </span>
            <AnimatedFilters
              v-model="access"
              :options="accessFilterOptions"
              square
              size="lg"
              block
            />
            <!-- The two blurbs wrap to different heights at this width, so the
                 trade is measured rather than letting the footer jump. -->
            <HeightSwap>
              <p
                :key="accessDescription"
                class="text-[0.72rem] leading-snug text-muted-foreground"
              >
                {{ $t(accessDescription) }}
              </p>
            </HeightSwap>
          </div>
        </div>

        <!-- One panel for a running session, shared with the top bar so the
             two surfaces cannot drift into a panel and a menu again. -->
        <div v-else>
          <UtilityPracticeSessionPanel
            :session="session"
            :started="started"
            :map-name="mapName"
            :lineup-id="lineupId"
            @ended="onSessionEnded"
            @joined="onJoinedServer"
          >
            <!-- Saving a throw is not driving the session -- anybody in a live
                 one, drilling a lineup they opened this from, has a throw of
                 their own to keep. -->
            <template v-if="canSaveFromPractice" #extra>
              <Separator />
              <div class="space-y-2">
                <span :class="fieldLabel">
                  <Save class="h-3.5 w-3.5" />
                  {{ $t("pages.utility.save.practice_entry_title") }}
                </span>
                <p class="text-xs text-muted-foreground">
                  {{ $t("pages.utility.save.practice_entry_hint") }}
                </p>
                <Button
                  variant="outline"
                  class="w-full"
                  @click="saveFromPracticeOpen = true"
                >
                  {{ $t("pages.utility.save.practice_entry_open") }}
                </Button>
              </div>
            </template>
          </UtilityPracticeSessionPanel>
        </div>
      </div>

      <!-- Only the start CTA lives here: once a session exists the panel owns
           the way out of it, on both surfaces. -->
      <DialogFooter v-if="!sessionId && !joining">
        <Button
          size="lg"
          :class="['tac-amber-cta', footerCta]"
          :loading="starting"
          @click="start()"
        >
          {{ $t("pages.utility.practice.start_cta") }}
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
