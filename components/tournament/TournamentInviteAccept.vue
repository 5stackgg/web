<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { Ticket } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toast";
import { useAuthStore } from "~/stores/AuthStore";
import { REDEEM_TOURNAMENT_INVITE_CODE_MUTATION } from "~/graphql/tournamentInviteCodes";
import {
  tournamentInviteErrorKey,
  tournamentInviteErrorMessage,
} from "~/utilities/tournamentInvites";
import { getQueryString } from "~/composables/useRouteTab";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";

/**
 * `/tournaments/{id}?invite={code}` — the landing half of a shared invite link.
 *
 * The link NEVER redeems itself on arrival. The visitor sees the tournament
 * first and then chooses, for the same reason the draft room refuses to
 * auto-join from its own invite links: a URL that mutates state the moment it
 * is opened is a URL that a preview crawler, a chat unfurler or a mis-click can
 * spend. Redeeming is also recorded against the code's use count, so an
 * accidental one is a use the organizer cannot get back.
 */
const props = defineProps<{
  tournament: Record<string, any>;
  // The registration columns, fetched separately by TournamentDetail.
  registration?: Record<string, any> | null;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { client } = useApolloClient();

// Captured, not read live: accepting strips `?invite=` from the URL, and a
// computed straight off the query would tear the panel down mid-request and
// take its own success/failure state with it.
const code = ref<string | null>(getQueryString(route.query, "invite"));

watch(
  () => route.query.invite,
  (value) => {
    const next = getQueryString({ invite: value }, "invite");
    if (next) {
      code.value = next;
    }
  },
);

const me = computed(() => useAuthStore().me);
const accepted = ref(false);

// The api's own words for the refusal, kept raw so the sentence the visitor
// reads is derived and re-derives itself if they switch language.
const failure = ref<string | null>(null);

// The api names a refusal it anticipated with a code, and the whole sentence is
// written here. One it did not is English prose from further up the api
// ("tournament not found"), and gets the translated frame around it instead:
// untranslated innards inside a translated sentence is the price of saying
// anything at all, and is worth paying only for the cases nobody planned for.
const failureMessage = computed(() => {
  if (!failure.value) {
    return null;
  }

  const key = tournamentInviteErrorKey(failure.value);

  return key
    ? t(key)
    : t("tournament.invite_accept.failed", { reason: failure.value });
});

// An invite-only tournament that already reads as unlocked for this viewer has
// nothing left to grant, and prompting anyway invites them to burn a second use
// of the code by reloading the URL they still have in their address bar. On a
// tournament open to everyone `registration_unlocked` is true for the whole
// world, so it says nothing and the prompt stands — accepting there is what
// puts the visitor in the organizer's "who used this link" list.
const alreadyUnlocked = computed(
  () =>
    props.registration?.invite_only === true &&
    props.registration?.registration_unlocked === true,
);

const visible = computed(
  () =>
    !!code.value &&
    !accepted.value &&
    !alreadyUnlocked.value &&
    !props.tournament?.is_organizer,
);

function stripInviteParam() {
  const query = { ...route.query };
  delete query.invite;
  return router.replace({ path: route.path, query, hash: route.hash });
}

async function accept() {
  if (!code.value) {
    return;
  }

  // A guest keeps the whole URL, invite code included, so the accept prompt is
  // waiting for them on the way back rather than a tournament they have no
  // idea why they are looking at.
  if (!me.value) {
    return router.push({
      path: "/login",
      query: { redirect: route.fullPath },
    });
  }

  failure.value = null;
  try {
    await client.mutate({
      mutation: REDEEM_TOURNAMENT_INVITE_CODE_MUTATION,
      variables: { tournamentId: props.tournament.id, code: code.value },
    });
    accepted.value = true;
    toast({ title: t("tournament.invite_accept.accepted") });
    await stripInviteParam();
  } catch (error: unknown) {
    // Rendered in place rather than only toasted: "expired", "revoked" and
    // "already used up" are the answers to a question the visitor is actively
    // asking, and a toast is gone before they finish reading the page.
    //
    failure.value = tournamentInviteErrorMessage(error);
  }
}

async function dismiss() {
  accepted.value = true;
  await stripInviteParam();
}
</script>

<template>
  <section
    v-if="visible"
    class="relative mt-4 rounded-lg border border-[hsl(var(--tac-amber)_/_0.45)] px-6 py-5 [background:linear-gradient(180deg,hsl(var(--card)_/_0.65)_0%,hsl(var(--card)_/_0.35)_100%)] [backdrop-filter:blur(6px)]"
  >
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h3
          class="m-0 flex items-center gap-2 font-sans text-[1.05rem] font-bold tracking-[0.01em] text-foreground"
        >
          <Ticket class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
          {{ $t("tournament.invite_accept.title") }}
        </h3>
        <p
          class="mt-1 max-w-[70ch] text-[0.8rem] leading-relaxed text-muted-foreground"
        >
          {{
            me
              ? $t("tournament.invite_accept.hint")
              : $t("tournament.invite_accept.guest_hint")
          }}
        </p>
        <p
          v-if="failureMessage"
          class="mt-2 max-w-[70ch] text-[0.8rem] leading-relaxed text-destructive"
        >
          {{ failureMessage }}
        </p>
      </div>

      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" @click="dismiss">
          {{ $t("tournament.invite_accept.dismiss") }}
        </Button>
        <!-- Button, not a bare <button>: it tracks the returned promise, so a
             second click cannot spend a second use of the code. -->
        <Button :class="tacticalCtaButtonClasses" @click="accept">
          {{
            me
              ? $t("tournament.invite_accept.accept")
              : $t("tournament.invite_accept.sign_in")
          }}
        </Button>
      </div>
    </div>
  </section>
</template>
