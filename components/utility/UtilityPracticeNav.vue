<script setup lang="ts">
/**
 * The practice bar, sat in the top nav beside <MatchLobbies>.
 *
 * Same job as the match lobby bar and deliberately the same shape: a persistent
 * strip that says what is waiting for you and gets you into it in one click.
 * A practice server is booked in a dialog on one page and then used from
 * anywhere, so the only place this can live is the chrome.
 *
 * It also owns "am I on a practice server" for the whole app. useUtilityLoad
 * caches that at module scope, and nothing else asks on a timer -- so this
 * polling is what makes the Practice buttons on cards and dialogs appear
 * without a page refresh.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Copy, LogOut, Rocket, Server, Share2, Square, Users } from "lucide-vue-next";
import { NuxtLink } from "#components";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useAuthStore } from "~/stores/AuthStore";
import { useUtilityLoad } from "~/composables/useUtilityLoad";
import { useUtilityPracticeSession } from "~/composables/useUtilityPracticeSession";
import { useI18n } from "vue-i18n";
import { toast } from "~/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  leaveUtilityPracticeMutation,
  stopUtilityPracticeMutation,
} from "~/graphql/utilityGraphql";

const { t } = useI18n();
const me = computed(() => useAuthStore().me);
const load = useUtilityLoad();
const { session, booting, canManage } = useUtilityPracticeSession();

const CONNECTED_POLL_MS = 15_000;
let poll: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
  if (poll) {
    clearInterval(poll);
    poll = null;
  }
}

watch(
  () => [me.value?.steam_id, session.value?.status] as const,
  ([steamId]) => {
    stopPolling();

    if (!steamId) {
      return;
    }

    // Immediately, because a reservation appearing or turning Ready is exactly
    // when the answer is about to change.
    void load.check(true);
    poll = setInterval(() => void load.check(true), CONNECTED_POLL_MS);
  },
  { immediate: true },
);

onBeforeUnmount(stopPolling);

// Standing on a server, as opposed to holding a reservation for one. Kept
// independent of the session: you can be on a server you did not book.
const connected = computed(() => load.onServer.value);


const mapName = computed(
  () => load.where.value?.map_name ?? session.value?.map_name ?? null,
);

// Only with a server. The header is not the place to advertise practice to
// somebody who has not asked for it -- starting one is the utility page's job.
const visible = computed(() => !!session.value || connected.value);


// One word for the state, because the caption underneath already says what
// kind of thing this is. The old bar said "JOIN PRACTICE" in the status cell
// AND on the button next to it, which is how a strip ends up shouting the same
// thing three times.
const state = computed(() => {
  if (connected.value) {
    return t("pages.utility.practice.nav_connected");
  }

  if (booting.value) {
    return t("pages.utility.practice.nav_starting");
  }

  // The bar only exists with a server, so there is no fourth state.
  return t("pages.utility.practice.nav_ready");
});


// Who can get in, said in the popover so the dialog is not the only place that
// knows. Falls back to the old meaning for a session started before access
// existed as a column.
const accessLabel = computed(() => {
  const access = (session.value as { access?: string } | null)?.access;

  if (!access) {
    return session.value?.is_open === true
      ? t("pages.utility.practice.access_open")
      : null;
  }

  return t(`pages.utility.practice.access_${access.toLowerCase()}`);
});

const inviteLink = computed(() =>
  session.value?.invite_code && mapName.value
    ? `${window.location.origin}/utility/${mapName.value}?practice=${session.value.invite_code}`
    : null,
);

async function copyText(text: string | null, title: string) {
  if (!text) {
    return;
  }

  await navigator.clipboard.writeText(text);

  toast({ title });
}

// Stopping is the host's; leaving is everybody else's. Offering the wrong one
// is how somebody ends a server they only joined.
async function endSession() {
  const id = session.value?.id;

  if (!id) {
    return;
  }

  try {
    await getGraphqlClient().mutate({
      mutation: canManage.value
        ? stopUtilityPracticeMutation
        : leaveUtilityPracticeMutation,
      variables: { session_id: id },
    });
  } catch (error: any) {
    toast({
      title: t("pages.utility.practice.stop_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

async function copyConnect() {
  const connect = session.value?.connection_string;

  if (!connect) {
    return;
  }

  await navigator.clipboard.writeText(connect);

  toast({ title: t("pages.utility.practice.nav_copied") });
}
</script>

<template>
  <DropdownMenu v-if="visible">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="group relative hidden h-12 items-center gap-2.5 overflow-hidden rounded-md border pl-2.5 pr-3 text-left shadow-sm backdrop-blur-sm transition-colors duration-150 md:flex"
        :class="
          connected
            ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.06)]'
            : 'border-zinc-900/90 bg-[#09090b]/95 hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-black/95'
        "
      >
        <!-- A live server earns a moving edge; a booked one does not. -->
        <span
          v-if="connected"
          class="absolute inset-y-0 left-0 w-[2px] bg-[hsl(var(--tac-amber))]"
          aria-hidden="true"
        ></span>

        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[hsl(var(--tac-amber))]"
          :class="connected ? 'bg-[hsl(var(--tac-amber)/0.16)]' : 'bg-zinc-900/80'"
        >
          <span v-if="booting" class="relative flex h-1.5 w-1.5">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
            ></span>
            <span
              class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
            ></span>
          </span>
          <Server v-else class="h-4 w-4" />
        </span>

        <!-- Name over caption, the same hierarchy the match bar uses. -->
        <span class="flex min-w-0 flex-col justify-center leading-tight">
          <span class="truncate text-xs font-medium text-foreground">
            {{ mapName }}
          </span>
          <span
            class="truncate font-mono text-[0.58rem] uppercase tracking-[0.16em]"
            :class="
              connected ? 'text-[hsl(var(--tac-amber))]' : 'text-muted-foreground'
            "
          >
            {{ state }}
          </span>
        </span>
      </button>
    </DropdownMenuTrigger>

    <!-- Everything you would otherwise reopen the Practice dialog for, plus
         the state you would have opened it to read: which map, who can join,
         and the connect string itself. A menu of verbs with no facts made you
         open the dialog anyway just to check. -->
    <DropdownMenuContent align="end" class="w-72">
      <div @click.stop>
        <div class="px-2 py-1.5">
          <div class="flex items-center gap-2">
            <span
              class="h-1.5 w-1.5 shrink-0 rounded-full"
              :class="
                connected
                  ? 'bg-[hsl(var(--tac-amber))]'
                  : booting
                    ? 'animate-pulse bg-[hsl(var(--tac-amber))]'
                    : 'bg-muted-foreground/60'
              "
            ></span>
            <span class="truncate text-sm font-medium">{{ mapName }}</span>
            <span
              class="ml-auto shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              {{ state }}
            </span>
          </div>

          <p
            v-if="accessLabel"
            class="mt-1 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted-foreground"
          >
            {{ accessLabel }}
          </p>

          <p
            v-if="session?.connection_string"
            class="mt-1 truncate font-mono text-[0.6rem] text-muted-foreground/70"
            :title="session.connection_string"
          >
            {{ session.connection_string }}
          </p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          v-if="!connected && session?.connection_link"
          as-child
        >
          <a :href="session.connection_link">
            <Rocket />
            {{ $t("pages.utility.practice.nav_join") }}
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem
          v-if="session?.connection_string"
          @click="
            copyText(
              session.connection_string,
              $t('pages.utility.practice.nav_copied'),
            )
          "
        >
          <Copy />
          {{ $t("pages.utility.practice.copy_connect") }}
        </DropdownMenuItem>

        <DropdownMenuItem
          v-if="inviteLink"
          @click="
            copyText(inviteLink, $t('pages.utility.practice.invite_copied'))
          "
        >
          <Share2 />
          {{ $t("pages.utility.practice.copy_invite") }}
        </DropdownMenuItem>

        <DropdownMenuItem v-if="mapName" as-child>
          <NuxtLink :to="`/utility/${mapName}`">
            <Users />
            {{ $t("pages.utility.practice.manage") }}
          </NuxtLink>
        </DropdownMenuItem>

        <DropdownMenuSeparator v-if="session" />

        <!-- Stopping is the host's, leaving is everybody else's. -->
        <DropdownMenuItem
          v-if="session"
          class="text-red-400"
          @click="endSession()"
        >
          <Square v-if="canManage" />
          <LogOut v-else />
          {{
            canManage
              ? $t("pages.utility.practice.stop")
              : $t("pages.utility.practice.leave")
          }}
        </DropdownMenuItem>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
