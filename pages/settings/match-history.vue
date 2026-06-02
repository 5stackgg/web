<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { gql } from "@apollo/client/core";
import {
  Upload,
  FileCheck2,
  FileWarning,
  X,
  RefreshCw,
  Unlink,
  CheckCircle2,
  AlertCircle,
} from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

definePageMeta({
  layout: "profile-settings",
});

const apolloClient = useApolloClient().client;
const me = computed(() => useAuthStore().me);
const externalMatchesEnabled = computed(
  () => useApplicationSettingsStore().externalMatchesEnabled,
);

const authCode = ref("");
const shareCode = ref("");
const linking = ref(false);
const unlinking = ref(false);
const polling = ref(false);
const showUnlinkConfirm = ref(false);

// Linking auto-triggers a server-side poll. Surface that immediately and keep
// it visible until the first poll lands pending imports, an error, or simply
// completes (last_polled_at). A fallback timeout guards against a missing
// signal so we never spin forever.
const awaitingPoll = ref(false);
let awaitingPollTimeout: ReturnType<typeof setTimeout> | null = null;

function stopAwaitingPoll() {
  awaitingPoll.value = false;
  if (awaitingPollTimeout) {
    clearTimeout(awaitingPollTimeout);
    awaitingPollTimeout = null;
  }
}

const LINK_SUBSCRIPTION = gql`
  subscription PlayerSteamMatchAuth($steam_id: bigint!) {
    player_steam_match_auth_by_pk(steam_id: $steam_id) {
      steam_id
      last_known_share_code
      last_polled_at
      last_error
      updated_at
    }
  }
`;

const LINK_MUTATION = gql`
  mutation LinkSteamMatchHistory($auth_code: String!, $share_code: String!) {
    linkSteamMatchHistory(auth_code: $auth_code, share_code: $share_code) {
      success
      error
    }
  }
`;

const UNLINK_MUTATION = gql`
  mutation UnlinkSteamMatchHistory {
    unlinkSteamMatchHistory {
      success
    }
  }
`;

const POLL_MUTATION = gql`
  mutation PollSteamMatchHistory {
    pollSteamMatchHistory {
      success
      collected
      error
    }
  }
`;

const PENDING_IMPORTS_SUBSCRIPTION = gql`
  subscription PendingMatchImports {
    pending_match_imports(order_by: { updated_at: desc }) {
      valve_match_id
      status
      error
      map_name
      match_start_time
      created_at
      updated_at
    }
  }
`;

const CLEAR_PENDING_MUTATION = gql`
  mutation ClearPendingMatchImport($valve_match_id: String!) {
    clearPendingMatchImport(valve_match_id: $valve_match_id) {
      success
    }
  }
`;

const linkQuery = ref<any>(null);
const linkLoaded = ref(false);
const pendingImports = ref<
  Array<{
    valve_match_id: string;
    status: string;
    error?: string | null;
    map_name?: string | null;
    match_start_time?: string | null;
    created_at: string;
    updated_at: string;
  }>
>([]);

let linkSubHandle: { unsubscribe: () => void } | null = null;
let pendingSubHandle: { unsubscribe: () => void } | null = null;

function teardownSubs() {
  linkSubHandle?.unsubscribe();
  linkSubHandle = null;
  pendingSubHandle?.unsubscribe();
  pendingSubHandle = null;
}

watch(
  () => me.value?.steam_id,
  (steamId) => {
    teardownSubs();
    linkLoaded.value = false;
    if (!steamId) return;

    linkSubHandle = apolloClient
      .subscribe({
        query: LINK_SUBSCRIPTION,
        variables: { steam_id: steamId },
      })
      .subscribe({
        next: ({ data }: any) => {
          linkQuery.value = data?.player_steam_match_auth_by_pk ?? null;
          linkLoaded.value = true;
        },
      });

    pendingSubHandle = apolloClient
      .subscribe({ query: PENDING_IMPORTS_SUBSCRIPTION })
      .subscribe({
        next: ({ data }: any) => {
          const all = data?.pending_match_imports ?? [];
          // Failed imports can't be retrieved (demo expired / gone from Valve);
          // silently drop them from the queue and hide them from the user.
          for (const entry of all) {
            if (entry.status === "Failed")
              autoClearFailed(entry.valve_match_id);
          }
          pendingImports.value = all.filter(
            (entry: any) => entry.status !== "Failed",
          );
        },
      });
  },
  { immediate: true },
);

onUnmounted(() => {
  teardownSubs();
  stopAwaitingPoll();
});

// Clear the "polling…" state once the auto-poll resolves: pending imports
// arrive, an error surfaces, or the poll completes (last_polled_at is set).
watch(
  [
    () => linkQuery.value?.last_polled_at,
    () => linkQuery.value?.last_error,
    () => pendingImports.value.length,
  ],
  ([polledAt, lastError, pendingCount]) => {
    if (!awaitingPoll.value) return;
    if (polledAt || lastError || (pendingCount as number) > 0) {
      stopAwaitingPoll();
    }
  },
);

async function submitLink() {
  if (!authCode.value || !shareCode.value) return;
  linking.value = true;
  try {
    const { data } = await apolloClient.mutate({
      mutation: LINK_MUTATION,
      variables: { auth_code: authCode.value, share_code: shareCode.value },
    });
    const result = data?.linkSteamMatchHistory;
    if (result?.success) {
      toast({ title: "Linked CS2 match history" });
      authCode.value = "";
      shareCode.value = "";
      // We auto-poll right after linking — reflect it straight away.
      awaitingPoll.value = true;
      if (awaitingPollTimeout) clearTimeout(awaitingPollTimeout);
      awaitingPollTimeout = setTimeout(stopAwaitingPoll, 90_000);
    } else {
      toast({
        title: "Could not link",
        description: result?.error ?? "Unknown error",
        variant: "destructive",
      });
    }
  } finally {
    linking.value = false;
  }
}

async function submitUnlink() {
  unlinking.value = true;
  try {
    await apolloClient.mutate({ mutation: UNLINK_MUTATION });
    toast({ title: "Unlinked CS2 match history" });
    showUnlinkConfirm.value = false;
  } finally {
    unlinking.value = false;
  }
}

async function submitPoll() {
  polling.value = true;
  try {
    const { data } = await apolloClient.mutate({ mutation: POLL_MUTATION });
    const result = data?.pollSteamMatchHistory;
    if (result?.success) {
      toast({
        title: "Polled match history",
        description: `Collected ${result.collected} new share codes`,
      });
    } else {
      toast({
        title: "Poll failed",
        description: result?.error ?? "Unknown error",
        variant: "destructive",
      });
    }
  } finally {
    polling.value = false;
  }
}

const isLinked = computed(() => !!linkQuery.value);
const isAdmin = computed(() => me.value?.role === "administrator");

const busyImportId = ref<string | null>(null);
const autoClearedIds = new Set<string>();

function autoClearFailed(valveMatchId: string) {
  if (autoClearedIds.has(valveMatchId)) return;
  autoClearedIds.add(valveMatchId);
  apolloClient
    .mutate({
      mutation: CLEAR_PENDING_MUTATION,
      variables: { valve_match_id: valveMatchId },
    })
    .catch(() => {
      // best-effort — it's filtered from the UI regardless
    });
}

async function clearImport(valveMatchId: string) {
  busyImportId.value = valveMatchId;
  try {
    await apolloClient.mutate({
      mutation: CLEAR_PENDING_MUTATION,
      variables: { valve_match_id: valveMatchId },
    });
    toast({ title: "Cleared pending import" });
  } finally {
    busyImportId.value = null;
  }
}

const PENDING_STATUSES = ["Queued", "Parsing"] as const;
type PendingStatus = (typeof PENDING_STATUSES)[number];

const pendingFilters = ref<Set<string>>(new Set());
const pendingExpanded = ref(false);
const PENDING_VISIBLE_LIMIT = 25;

const pendingCountsByStatus = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {};
  for (const e of pendingImports.value) {
    out[e.status] = (out[e.status] ?? 0) + 1;
  }
  return out;
});

const filteredPendingImports = computed(() => {
  if (pendingFilters.value.size === 0) {
    return pendingImports.value;
  }
  return pendingImports.value.filter((e) => pendingFilters.value.has(e.status));
});

const visiblePendingImports = computed(() => {
  return pendingExpanded.value
    ? filteredPendingImports.value
    : filteredPendingImports.value.slice(0, PENDING_VISIBLE_LIMIT);
});

const hiddenPendingCount = computed(
  () =>
    filteredPendingImports.value.length - visiblePendingImports.value.length,
);

function togglePendingFilter(status: PendingStatus) {
  if (pendingFilters.value.has(status)) {
    pendingFilters.value.delete(status);
  } else {
    pendingFilters.value.add(status);
  }
  pendingFilters.value = new Set(pendingFilters.value);
}

function formatPendingDate(date: string): string {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const uploadingDemo = ref(false);
const uploadProgress = ref(0);
const uploadedFile = ref<{ name: string; size: number } | null>(null);
const uploadResult = ref<{
  status: "success" | "error";
  message: string;
} | null>(null);
const isDragging = ref(false);
const apiDomain = useRuntimeConfig().public.apiDomain;
const fileInput = ref<HTMLInputElement | null>(null);

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function triggerFileInput() {
  if (uploadingDemo.value) return;
  fileInput.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) void uploadDemo(file);
  target.value = "";
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  if (uploadingDemo.value) return;
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".dem")) {
    toast({
      title: "Wrong file type",
      description: "Please drop a CS2 .dem file.",
      variant: "destructive",
    });
    return;
  }
  void uploadDemo(file);
}

function clearUpload() {
  uploadedFile.value = null;
  uploadResult.value = null;
  uploadProgress.value = 0;
}

async function uploadDemo(file: File) {
  uploadingDemo.value = true;
  uploadProgress.value = 0;
  uploadedFile.value = { name: file.name, size: file.size };
  uploadResult.value = null;
  try {
    const form = new FormData();
    form.append("demo", file);

    const data = await new Promise<{
      match_id: string | null;
      skipped?: string;
    }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://${apiDomain}/steam-match-history/upload`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          uploadProgress.value = Math.round((e.loaded / e.total) * 100);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error("Invalid server response"));
          }
        } else {
          reject(
            new Error(xhr.responseText || `upload failed (${xhr.status})`),
          );
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(form);
    });

    uploadProgress.value = 100;

    if (data.match_id) {
      uploadResult.value = {
        status: "success",
        message: `Imported as match ${data.match_id}`,
      };
      toast({ title: "Demo imported", description: data.match_id });
    } else {
      uploadResult.value = {
        status: "error",
        message: data.skipped ?? "Could not import demo",
      };
      toast({
        title: "Skipped",
        description: data.skipped ?? "Could not import demo",
        variant: "destructive",
      });
    }
  } catch (err) {
    const message = (err as Error).message;
    uploadResult.value = { status: "error", message };
    toast({
      title: "Upload failed",
      description: message,
      variant: "destructive",
    });
  } finally {
    uploadingDemo.value = false;
  }
}
</script>

<template>
  <PageTransition :delay="0">
    <div>
      <h3 class="text-base font-semibold uppercase tracking-wide">
        External Matches
      </h3>
      <p class="text-sm text-muted-foreground mt-0.5">
        Link your Steam match history so we can automatically import your
        official CS2 matches and Premier rank.
      </p>
    </div>
  </PageTransition>

  <PageTransition v-if="!externalMatchesEnabled" :delay="100">
    <div
      class="max-w-xl rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground"
    >
      {{ $t("pages.settings.application.external_matches.disabled_notice") }}
    </div>
  </PageTransition>

  <PageTransition v-if="externalMatchesEnabled" :delay="100">
    <div
      v-if="!linkLoaded"
      class="flex items-center gap-2 text-sm text-muted-foreground max-w-xl"
    >
      <Spinner class="w-4 h-4" />
      Checking match history link…
    </div>

    <div v-else-if="!isLinked" class="grid gap-4 max-w-xl">
      <p class="text-sm text-muted-foreground">
        You'll need two codes from Valve:
      </p>
      <ol class="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
        <li>
          Your
          <a
            class="underline"
            target="_blank"
            rel="noopener noreferrer"
            href="https://help.steampowered.com/en/wizard/HelpWithGameIssue/?appid=730&issueid=128"
            >Steam Game Authentication Code</a
          >
          — on the Steam help page, look under
          <em>“Access to Your Match History”</em> and click
          <em>Create Authentication Code</em>. Generated once per Steam account.
        </li>
        <li>
          A recent <strong>Match Share Code</strong> — copy from
          <em>Watch → Your Matches</em> in CS2 (any match within the last 30
          days works as a starting point).
        </li>
      </ol>

      <div class="space-y-2">
        <label class="text-sm font-medium">Auth code</label>
        <Input
          v-model="authCode"
          placeholder="XXXX-XXXXX-XXXX"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium">Share code</label>
        <Input
          v-model="shareCode"
          placeholder="CSGO-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <div>
        <Button
          :disabled="!authCode || !shareCode || linking"
          @click="submitLink"
        >
          {{ linking ? "Linking…" : "Link match history" }}
        </Button>
      </div>
    </div>

    <div v-else class="grid gap-4 max-w-xl">
      <div class="rounded-lg border border-border bg-card/50 overflow-hidden">
        <div
          class="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <span
              class="shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
              :class="
                linkQuery?.last_error
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-emerald-500/15 text-emerald-400'
              "
            >
              <AlertCircle v-if="linkQuery?.last_error" class="w-4 h-4" />
              <CheckCircle2 v-else class="w-4 h-4" />
            </span>
            <div class="min-w-0">
              <div class="text-sm font-medium leading-tight">
                {{ linkQuery?.last_error ? "Linked · errors" : "Linked" }}
              </div>
              <div class="text-xs text-muted-foreground">
                Last poll
                <template v-if="linkQuery?.last_polled_at">
                  <TimeAgo :date="linkQuery.last_polled_at" hide-icon />
                </template>
                <template v-else>· never</template>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <FiveStackToolTip side="bottom">
              <template #trigger>
                <Button
                  size="icon"
                  variant="outline"
                  class="h-8 w-8 transition-shadow"
                  :class="{ 'poll-active': polling || awaitingPoll }"
                  :disabled="polling || awaitingPoll"
                  @click="submitPoll"
                >
                  <RefreshCw
                    class="w-3.5 h-3.5"
                    :class="{ 'poll-spin': polling || awaitingPoll }"
                  />
                </Button>
              </template>
              {{ polling || awaitingPoll ? "Polling…" : "Poll now" }}
            </FiveStackToolTip>
            <FiveStackToolTip side="bottom">
              <template #trigger>
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  :disabled="unlinking"
                  @click="showUnlinkConfirm = true"
                >
                  <Unlink class="w-3.5 h-3.5" />
                </Button>
              </template>
              {{ unlinking ? "Unlinking…" : "Unlink" }}
            </FiveStackToolTip>
          </div>
        </div>

        <dl class="divide-y divide-border/60 text-sm">
          <div class="flex items-start justify-between gap-4 px-4 py-2.5">
            <dt class="text-muted-foreground">Most recent share code</dt>
            <dd class="text-right">
              <div class="font-mono text-xs break-all">
                {{ linkQuery?.last_known_share_code || "—" }}
              </div>
              <div
                v-if="linkQuery?.last_polled_at"
                class="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground mt-0.5"
              >
                scanned <TimeAgo :date="linkQuery.last_polled_at" hide-icon />
              </div>
            </dd>
          </div>
          <div
            v-if="linkQuery?.last_error"
            class="flex items-start justify-between gap-4 px-4 py-2.5"
          >
            <dt class="text-muted-foreground">Last error</dt>
            <dd class="font-mono text-xs text-destructive break-all text-right">
              {{ linkQuery.last_error }}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </PageTransition>

  <AlertDialog v-model:open="showUnlinkConfirm">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Unlink match history?</AlertDialogTitle>
        <AlertDialogDescription>
          We'll stop importing your official CS2 matches and Premier rank. You
          can re-link anytime with your Steam auth and share codes.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="unlinking">Cancel</AlertDialogCancel>
        <!-- Plain button — radix's AlertDialogAction auto-closes
             before the async mutation can run. -->
        <button
          type="button"
          :disabled="unlinking"
          class="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          @click="submitUnlink"
        >
          {{ unlinking ? "Unlinking…" : "Unlink" }}
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <PageTransition v-if="externalMatchesEnabled && awaitingPoll" :delay="120">
    <div
      class="flex items-start gap-2.5 rounded-lg border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] px-4 py-3 text-sm max-w-xl mt-4"
    >
      <Spinner
        class="w-4 h-4 mt-0.5 shrink-0 text-[hsl(var(--tac-amber))]"
      />
      <div>
        <div class="font-medium">Polling your match history…</div>
        <div class="text-xs text-muted-foreground mt-0.5">
          Scanning Valve for your recent matches. Pending imports will appear
          below as we find them.
        </div>
      </div>
    </div>
  </PageTransition>

  <PageTransition
    v-if="externalMatchesEnabled && pendingImports.length > 0"
    :delay="150"
  >
    <div class="grid gap-3 max-w-xl mt-8">
      <div>
        <h3 class="text-base font-semibold uppercase tracking-wide">
          Pending imports
          <span class="text-muted-foreground font-normal">
            ({{ pendingImports.length }})
          </span>
        </h3>
        <p class="text-sm text-muted-foreground mt-0.5">
          Matches your linked accounts are waiting on. Demos that fail here are
          typically older than 30 days and no longer hosted by Valve.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="status in PENDING_STATUSES"
          :key="status"
          type="button"
          :disabled="!pendingCountsByStatus[status]"
          class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] transition-colors disabled:opacity-30"
          :class="
            pendingFilters.has(status)
              ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.16)] text-[hsl(var(--tac-amber))]'
              : 'border-border/60 bg-card/40 text-muted-foreground hover:text-foreground'
          "
          @click="togglePendingFilter(status)"
        >
          {{ status }}
          <span class="font-bold">
            {{ pendingCountsByStatus[status] ?? 0 }}
          </span>
        </button>
      </div>
      <ul class="divide-y divide-border/40 rounded border border-border/60">
        <li
          v-for="entry in visiblePendingImports"
          :key="entry.valve_match_id"
          class="flex items-center justify-between gap-4 px-3 py-2 text-sm"
        >
          <div class="min-w-0">
            <div v-if="entry.map_name" class="font-medium truncate">
              {{ entry.map_name }}
            </div>
            <div
              v-if="entry.match_start_time"
              class="font-mono text-[0.7rem] text-muted-foreground"
            >
              {{ formatPendingDate(entry.match_start_time) }}
            </div>
            <div
              v-else-if="!entry.map_name"
              class="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Spinner class="w-3.5 h-3.5" />
              Importing…
            </div>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span
              class="font-mono text-[0.65rem] uppercase tracking-[0.14em]"
              :class="{
                'text-muted-foreground': entry.status === 'Queued',
                'text-[hsl(45_95%_60%)]': entry.status === 'Parsing',
              }"
            >
              {{ entry.status }}
            </span>
            <Button
              size="sm"
              variant="ghost"
              :disabled="busyImportId === entry.valve_match_id"
              @click="clearImport(entry.valve_match_id)"
            >
              Clear
            </Button>
          </div>
        </li>
      </ul>
      <div
        v-if="hiddenPendingCount > 0 || pendingExpanded"
        class="flex justify-center"
      >
        <button
          type="button"
          class="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
          @click="pendingExpanded = !pendingExpanded"
        >
          <template v-if="pendingExpanded">Show less</template>
          <template v-else>Show {{ hiddenPendingCount }} more</template>
        </button>
      </div>
    </div>
  </PageTransition>

  <PageTransition v-if="externalMatchesEnabled && isAdmin" :delay="200">
    <div class="grid gap-3 max-w-xl mt-8">
      <div>
        <h3 class="text-base font-semibold uppercase tracking-wide">
          Upload a demo
        </h3>
        <p class="text-sm text-muted-foreground mt-0.5">
          Drop in a CS2 <code>.dem</code> file to import the match stats. Works
          whether or not your match history is linked.
        </p>
      </div>

      <div
        class="rounded-lg border-2 border-dashed transition-colors p-6 text-center"
        :class="[
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-border/80 hover:bg-accent/30',
          uploadingDemo ? 'cursor-progress opacity-80' : 'cursor-pointer',
        ]"
        role="button"
        tabindex="0"
        @click="triggerFileInput"
        @keydown.enter.prevent="triggerFileInput"
        @keydown.space.prevent="triggerFileInput"
        @drop="handleDrop"
        @dragover.prevent
        @dragenter.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
      >
        <Upload
          class="w-10 h-10 mx-auto mb-3"
          :class="isDragging ? 'text-primary' : 'text-muted-foreground'"
        />
        <p class="text-sm font-medium mb-1">
          <template v-if="isDragging">Drop to upload</template>
          <template v-else
            >Click to choose or drag a <code>.dem</code> file</template
          >
        </p>
        <p class="text-xs text-muted-foreground">
          CS2 demo files only · single file
        </p>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept=".dem"
        :disabled="uploadingDemo"
        class="hidden"
        @change="handleFileSelect"
      />

      <div
        v-if="uploadedFile"
        class="rounded-lg border border-border bg-card/50 p-3 space-y-2"
      >
        <div class="flex items-center gap-3">
          <div
            class="shrink-0 w-9 h-9 rounded-md flex items-center justify-center"
            :class="[
              uploadResult?.status === 'success'
                ? 'bg-emerald-500/15 text-emerald-400'
                : uploadResult?.status === 'error'
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-muted text-muted-foreground',
            ]"
          >
            <FileCheck2
              v-if="uploadResult?.status === 'success'"
              class="w-5 h-5"
            />
            <FileWarning
              v-else-if="uploadResult?.status === 'error'"
              class="w-5 h-5"
            />
            <Upload v-else class="w-5 h-5" />
          </div>

          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium truncate">
              {{ uploadedFile.name }}
            </div>
            <div class="text-xs text-muted-foreground font-mono">
              {{ formatBytes(uploadedFile.size) }}
              <template v-if="uploadingDemo">
                · {{ uploadProgress < 100 ? "Uploading…" : "Parsing…" }}
              </template>
            </div>
          </div>

          <Button
            v-if="!uploadingDemo"
            variant="ghost"
            size="icon"
            class="shrink-0 h-7 w-7"
            @click.stop="clearUpload"
          >
            <X class="w-4 h-4" />
          </Button>
        </div>

        <Progress
          v-if="uploadingDemo || uploadProgress > 0"
          :model-value="uploadProgress"
          class="h-1.5"
        />

        <p
          v-if="uploadResult && !uploadingDemo"
          class="text-xs font-mono break-all"
          :class="
            uploadResult.status === 'success'
              ? 'text-emerald-400'
              : 'text-destructive'
          "
        >
          {{ uploadResult.message }}
        </p>
      </div>
    </div>
  </PageTransition>
</template>

<style scoped>
/* Polling: a deliberate "scanning" rotation with eased cadence rather than a
   flat linear spin, plus a soft amber glow that ties into the tactical theme. */
.poll-active {
  border-color: hsl(var(--tac-amber) / 0.55);
  color: hsl(var(--tac-amber));
  box-shadow:
    inset 0 0 0 1px hsl(var(--tac-amber) / 0.18),
    0 0 14px -3px hsl(var(--tac-amber) / 0.65);
}

.poll-spin {
  animation: poll-spin 1.5s cubic-bezier(0.66, 0, 0.34, 1) infinite;
  transform-origin: center;
}

@keyframes poll-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .poll-spin {
    animation-duration: 2.4s;
    animation-timing-function: linear;
  }
}
</style>
