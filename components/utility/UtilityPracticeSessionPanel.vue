<script setup lang="ts">
/**
 * A running practice session, everywhere one is shown.
 *
 * The dialog and the top bar were two different renderings of the same four
 * facts -- where to connect, who may join, the link, the roster -- and they had
 * drifted into a panel and a menu that agreed on nothing. This is the panel;
 * the bar renders it too, so there is one layout and one set of verbs.
 */
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ExternalLink, UserPlus, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { Spinner } from "~/components/ui/spinner";
import { Separator } from "~/components/ui/separator";
import ClipBoard from "~/components/ClipBoard.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import UtilityPracticeCommands from "~/components/utility/UtilityPracticeCommands.vue";
import { toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  inviteToUtilityPracticeMutation,
  leaveUtilityPracticeMutation,
  setUtilityPracticeAccessMutation,
  stopUtilityPracticeMutation,
} from "~/graphql/utilityGraphql";
import { readUtilityPracticeSession } from "~/types/utility";
import type {
  UtilityPracticeSession,
  UtilityPracticeSessionOutput,
} from "~/types/utility";
import {
  utilityAccessOption,
  utilityAccessOptions,
  utilityInviteLinkReaches,
} from "~/utilities/utilityPracticeAccess";
import cleanMapName from "~/utilities/cleanMapName";

const props = withDefaults(
  defineProps<{
    session: UtilityPracticeSession | null;
    /** The start mutation's own output, which lands before the first row. */
    started?: UtilityPracticeSessionOutput | null;
    mapName?: string | null;
    /** Deep-links the invite back to the lineup this was opened from. */
    lineupId?: string | null;
    /** The bar has no title above it; the dialog does. */
    showHeader?: boolean;
  }>(),
  { started: null, mapName: null, lineupId: null, showHeader: false },
);

const emit = defineEmits<{ ended: []; joined: [] }>();

const { t } = useI18n();

const practice = computed(() =>
  readUtilityPracticeSession(props.session, props.started),
);

const sessionId = computed(
  () => props.session?.id ?? props.started?.id ?? null,
);

const mapName = computed(
  () => props.mapName ?? props.session?.map_name ?? null,
);

// The file name is what the link and the API want; the title is what a person
// reads. Same function the board title and the map picker use.
const mapDisplay = computed(() =>
  mapName.value ? cleanMapName(mapName.value) : null,
);

// The panel is only mounted for a session that exists or is being joined, so
// "no connect string" means it is still coming up. The bar used to say so in
// its strip and then open onto an empty menu.
const booting = computed(() => !practice.value.isLive);

const liveAccess = computed(() =>
  utilityAccessOption(practice.value.access, practice.value.isOpen),
);

const accessFilterOptions = computed(() =>
  utilityAccessOptions.map((option) => ({
    key: option.value,
    label: t(option.label),
    icon: option.icon,
  })),
);

const settingAccess = ref(false);

/**
 * Access used to be fixed at start, so a host who opened a server to everybody
 * had to stop it to close it again. The row is the source of truth -- this
 * fires the mutation and lets the subscription say whether it took, rather than
 * keeping a local copy that can disagree with the server.
 */
async function setAccess(value: string) {
  const id = sessionId.value;

  if (!id || !canManage.value || value === liveAccess.value.value) {
    return;
  }

  settingAccess.value = true;

  try {
    await getGraphqlClient().mutate({
      mutation: setUtilityPracticeAccessMutation,
      variables: { session_id: id, access: value },
    });
  } catch (error: any) {
    toast({
      title: t("pages.utility.practice.access_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    settingAccess.value = false;
  }
}

// Shares the invite code, never the primary key: the code is what the column
// exists for, and a session can be re-shared without leaking its id.
const inviteLink = computed(() => {
  const code = practice.value.inviteCode;

  if (!code || !mapName.value || typeof window === "undefined") {
    return null;
  }

  const path = props.lineupId
    ? `/utility/lineup/${props.lineupId}`
    : `/utility/${mapName.value}`;

  return `${window.location.origin}${path}?practice=${code}`;
});

const showInviteLink = computed(
  () => !!inviteLink.value && utilityInviteLinkReaches(liveAccess.value.value),
);

// can_manage is the server's answer to "may this viewer drive the session", so
// it gates the controls rather than a steam id compare. It decides the way out
// on its own -- a host cancelling a server that is still coming up must be
// offered Stop, not Leave -- while inviting also needs the session to be up.
const canManage = computed(() => practice.value.canManage);
const canDrive = computed(() => practice.value.isLive && canManage.value);

type Invitee = { steamId: string; name: string };

/**
 * Handing off to Steam takes a moment and the page does not change while it
 * happens, so the button holds a spinner rather than looking like a dead click.
 * Same shape and same 10s as <QuickServerConnect>, which is what every match
 * server's join button uses.
 */
const JOIN_SPINNER_MS = 10_000;

const joiningServer = ref(false);
let joinTimer: ReturnType<typeof setTimeout> | null = null;

function onJoinClick() {
  joiningServer.value = true;

  // The hand-off to Steam is the end of what this panel is for, so whatever is
  // hosting it gets out of the way rather than sitting over the game you are
  // about to be looking at.
  emit("joined");

  if (joinTimer) {
    clearTimeout(joinTimer);
  }

  joinTimer = setTimeout(() => {
    joiningServer.value = false;
    joinTimer = null;
  }, JOIN_SPINNER_MS);
}

onBeforeUnmount(() => {
  if (joinTimer) {
    clearTimeout(joinTimer);
  }
});

const invitees = ref<Invitee[]>([]);
const inviting = ref(false);
const ending = ref(false);

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
      variables: { session_id: id, steam_ids: inviteeSteamIds.value },
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

/**
 * Stopping is the host's and leaving is everybody else's -- offering the wrong
 * one is how somebody ends a server they only joined. can_manage decides, and
 * the owner of the session state is told rather than guessing.
 */
async function end() {
  const id = sessionId.value;

  if (!id) {
    return;
  }

  ending.value = true;

  try {
    await getGraphqlClient().mutate({
      mutation: canManage.value
        ? stopUtilityPracticeMutation
        : leaveUtilityPracticeMutation,
      variables: { session_id: id },
    });

    invitees.value = [];
    emit("ended");
  } catch (error: any) {
    toast({
      title: canManage.value
        ? t("pages.utility.practice.stop_failed")
        : t("pages.utility.practice.leave_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    ending.value = false;
  }
}

const sectionLabel =
  "flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground";

// The same full-width tactical shape the dialog's own footer uses, so the panel
// reads the same wherever it is mounted.
const panelCta = "w-full font-bold uppercase tracking-[0.22em]";
</script>

<template>
  <div class="space-y-3">
    <!-- Only the bar needs this: the dialog already names the map in its
         header, and repeating it there would be the third time on screen. -->
    <div v-if="showHeader" class="flex items-center gap-2">
      <span
        class="h-1.5 w-1.5 shrink-0 rounded-full"
        :class="
          booting ? 'bg-muted-foreground/60' : 'bg-[hsl(var(--tac-amber))]'
        "
      />
      <span class="min-w-0 truncate text-sm font-medium">{{ mapDisplay }}</span>
      <span
        class="ml-auto shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.14em]"
        :class="
          booting ? 'text-muted-foreground' : 'text-[hsl(var(--tac-amber))]'
        "
      >
        {{
          booting
            ? $t("pages.utility.practice.nav_starting")
            : $t("pages.utility.practice.nav_ready")
        }}
      </span>
    </div>

    <div v-if="booting" class="flex items-center gap-3 py-1">
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

    <template v-else>
      <!-- Getting in is what the panel is for. Copy rides beside the button
           rather than under it -- the connect string is what the copy does,
           not a second thing to read, so it lives on the button's tooltip. -->
      <div class="flex items-center gap-1.5">
        <Button
          v-if="practice.connectionLink"
          as="a"
          :href="practice.connectionLink"
          size="lg"
          class="tac-amber-cta min-w-0 flex-1 font-bold uppercase tracking-[0.22em]"
          :loading="joiningServer"
          @click="onJoinClick()"
        >
          <ExternalLink class="h-4 w-4" />
          {{ $t("server.join_server") }}
        </Button>
        <ClipBoard
          v-if="practice.connectionString"
          :data="practice.connectionString"
          class="h-10 w-10 shrink-0"
          :title="practice.connectionString"
        />
      </div>

      <Separator />

      <!-- The host picks it here rather than reading it back: closing a
           server you opened used to mean stopping it. Everyone else is told,
           because it is not theirs to change. -->
      <div class="space-y-1.5">
        <div :class="sectionLabel">
          <component :is="liveAccess.icon" class="h-3 w-3" />
          {{ $t("pages.utility.practice.access") }}
        </div>

        <AnimatedFilters
          v-if="canDrive"
          :model-value="liveAccess.value"
          :options="accessFilterOptions"
          square
          block
          :class="settingAccess ? 'pointer-events-none opacity-60' : ''"
          @update:model-value="setAccess($event)"
        />

        <p class="text-xs text-muted-foreground/80">
          <span v-if="!canDrive" class="text-[hsl(var(--tac-amber))]">
            {{ $t(liveAccess.label) }} &mdash;
          </span>
          {{ $t(liveAccess.desc) }}
        </p>
      </div>

      <!-- One way of saying "get somebody on here", not two. The picker puts
           them on the roster directly; the link is the same invitation for
           somebody who is not on the panel, so it sits under it rather than
           under a heading of its own. -->
      <template v-if="canDrive || showInviteLink">
        <Separator />
        <div class="space-y-2">
          <div :class="sectionLabel">
            <UserPlus class="h-3 w-3" />
            {{ $t("pages.utility.practice.invite_players") }}
          </div>

          <template v-if="canDrive">
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
              v-if="invitees.length"
              variant="outline"
              size="sm"
              class="w-full"
              :loading="inviting"
              @click="invitePlayers()"
            >
              {{
                $t("pages.utility.practice.send_invites", {
                  count: invitees.length,
                })
              }}
            </Button>
          </template>

          <div v-if="showInviteLink" class="flex items-center gap-1.5">
            <p
              class="min-w-0 flex-1 truncate text-[0.7rem] text-muted-foreground/70"
              :title="inviteLink ?? undefined"
            >
              {{ inviteLink }}
            </p>
            <ClipBoard :data="inviteLink" class="h-8 w-8 shrink-0" />
          </div>
        </div>
      </template>

      <!-- Everything the server can do once you are on it. The connect string
           is only half of what a practice session is, and the other half was
           discoverable only by knowing to type .help in chat. -->
      <Separator />

      <UtilityPracticeCommands />
    </template>

    <!-- Whatever the surface wants between the session and the way out of it. -->
    <slot name="extra" />

    <Separator />

    <Button
      :variant="canManage ? 'destructive' : 'outline'"
      size="lg"
      :class="panelCta"
      :loading="ending"
      @click="end()"
    >
      {{
        canManage
          ? $t("pages.utility.practice.stop")
          : $t("pages.utility.practice.leave")
      }}
    </Button>
  </div>
</template>
