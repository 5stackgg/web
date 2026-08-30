<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { KeyRound, ShieldCheck, ShieldX } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import TournamentChip from "~/components/tournament/TournamentChip.vue";
import { toast } from "~/components/ui/toast";
import { e_tournament_status_enum } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useAuthStore } from "~/stores/AuthStore";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";

const props = defineProps<{
  tournament: Record<string, any>;
  // The registration columns, fetched separately by TournamentDetail.
  registration?: Record<string, any> | null;
  // Already registered — either as a team or in the free agent pool. There is
  // nothing left to warn them about.
  alreadyEntered?: boolean;
}>();

const { t } = useI18n();
const { client } = useApolloClient();

const me = computed(() => useAuthStore().me);

const passcode = ref("");

const inviteOnly = computed(() => props.registration?.invite_only === true);

// A row-level computed field: true when the tournament is not invite-only, the
// viewer organizes it, or they have already redeemed the passcode.
const unlocked = computed(
  () => props.registration?.registration_unlocked !== false,
);

const minRole = computed<string | null>(
  () => props.registration?.min_role ?? null,
);

const minElo = computed<number | null>(() => {
  const value = props.registration?.min_elo;
  return value == null ? null : Number(value);
});

const maxElo = computed<number | null>(() => {
  const value = props.registration?.max_elo;
  return value == null ? null : Number(value);
});

// meets_min_role gates the acting SESSION and is evaluated by the same
// is_above_role the insert trigger uses — server truth, not a re-derivation.
const roleBlocked = computed(
  () => !!minRole.value && props.registration?.meets_min_role === false,
);

// get_tournament_player_elo reads the WINGMAN ladder when the lineup minimum is
// 2 and the Competitive one otherwise, while `players.elo` is only ever the
// latter. Rather than announce a verdict off the wrong ladder, a 2v2 tournament
// gets the requirement without the comparison.
const myElo = computed(() => {
  if (Number(props.tournament?.min_players_per_lineup) === 2) {
    return null;
  }
  const elo = Number(me.value?.elo);
  return Number.isFinite(elo) ? elo : null;
});

const eloBlocked = computed(() => {
  if (myElo.value === null) {
    return false;
  }
  if (minElo.value !== null && myElo.value < minElo.value) {
    return true;
  }
  return maxElo.value !== null && myElo.value > maxElo.value;
});

const eloLabel = computed(() => {
  if (minElo.value !== null && maxElo.value !== null) {
    return t("tournament.entry.elo_between", {
      min: minElo.value,
      max: maxElo.value,
    });
  }
  if (minElo.value !== null) {
    return t("tournament.entry.elo_min", { min: minElo.value });
  }
  if (maxElo.value !== null) {
    return t("tournament.entry.elo_max", { max: maxElo.value });
  }
  return null;
});

const requirements = computed(() => {
  const rows: Array<{ key: string; label: string; blocked: boolean }> = [];
  if (minRole.value) {
    rows.push({
      key: "role",
      label: t("tournament.entry.min_role", {
        role: t(`roles.${minRole.value}`),
      }),
      blocked: roleBlocked.value,
    });
  }
  if (eloLabel.value) {
    rows.push({
      key: "elo",
      label:
        myElo.value === null
          ? eloLabel.value
          : `${eloLabel.value} · ${t("tournament.entry.elo_yours", {
              elo: myElo.value,
            })}`,
      blocked: eloBlocked.value,
    });
  }
  return rows;
});

const needsPasscode = computed(() => inviteOnly.value && !unlocked.value);

const blocked = computed(() => roleBlocked.value || eloBlocked.value);

const chipTone = computed(() => {
  if (blocked.value) {
    return "bad";
  }
  return needsPasscode.value ? "warn" : "ok";
});

const chipLabel = computed(() => {
  if (blocked.value) {
    return t("tournament.entry.blocked_chip");
  }
  return needsPasscode.value
    ? t("tournament.entry.locked_chip")
    : t("tournament.entry.ok_chip");
});

// Only ever shown to someone who could still act on it: signed in, not the
// organizer, not already entered, and while entering is still possible.
const visible = computed(() => {
  if (!me.value || props.tournament?.is_organizer || props.alreadyEntered) {
    return false;
  }
  if (props.tournament?.status !== e_tournament_status_enum.RegistrationOpen) {
    return false;
  }
  return needsPasscode.value || requirements.value.length > 0;
});

async function unlock() {
  const code = passcode.value.trim();
  if (!code) {
    return;
  }
  try {
    await client.mutate({
      mutation: generateMutation({
        unlockTournamentRegistration: [
          {
            tournament_id: props.tournament.id,
            passcode: code,
          },
          {
            success: true,
          },
        ],
      }),
    });
    passcode.value = "";
    toast({ title: t("tournament.entry.unlocked") });
  } catch (error: unknown) {
    toast({
      title: t("tournament.entry.unlock_failed"),
      description: error instanceof Error ? error.message : String(error),
      variant: "destructive",
    });
  }
}
</script>

<template>
  <section
    v-if="visible"
    :class="[
      'relative mt-4 rounded-lg border px-6 py-5 [background:linear-gradient(180deg,hsl(var(--card)_/_0.65)_0%,hsl(var(--card)_/_0.35)_100%)] [backdrop-filter:blur(6px)]',
      blocked ? 'border-destructive/50' : 'border-border',
    ]"
  >
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h3
          class="m-0 font-sans text-[1.05rem] font-bold tracking-[0.01em] text-foreground"
        >
          {{
            needsPasscode
              ? $t("tournament.entry.locked_title")
              : $t("tournament.entry.title")
          }}
        </h3>
        <p
          class="mt-1 max-w-[70ch] text-[0.8rem] leading-relaxed text-muted-foreground"
        >
          {{
            needsPasscode
              ? $t("tournament.entry.locked_hint")
              : $t("tournament.entry.requirements_hint")
          }}
        </p>
      </div>
      <TournamentChip :tone="chipTone">
        <component :is="blocked ? ShieldX : ShieldCheck" class="h-3 w-3" />
        {{ chipLabel }}
      </TournamentChip>
    </div>

    <div v-if="requirements.length > 0" class="mt-4 flex flex-col gap-1.5">
      <div
        v-for="requirement in requirements"
        :key="requirement.key"
        class="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-[0.82rem]"
        :class="
          requirement.blocked
            ? 'border-destructive/45 bg-destructive/10 text-destructive'
            : 'border-border bg-card/40 text-muted-foreground'
        "
      >
        <span class="min-w-0 truncate">{{ requirement.label }}</span>
        <TournamentChip :tone="requirement.blocked ? 'bad' : 'muted'">
          {{
            requirement.blocked
              ? $t("tournament.entry.requirement_failed")
              : $t("tournament.entry.requirement_met")
          }}
        </TournamentChip>
      </div>
    </div>

    <!-- Button, not a bare <button>: it tracks the returned promise, so a
         second click while the unlock is in flight is impossible. -->
    <form
      v-if="needsPasscode"
      class="mt-4 flex flex-wrap items-end gap-2.5"
      @submit.prevent="unlock"
    >
      <div class="min-w-[12rem] flex-1">
        <label
          for="tournament-entry-passcode"
          class="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          {{ $t("tournament.entry.passcode_label") }}
        </label>
        <Input
          id="tournament-entry-passcode"
          v-model="passcode"
          :placeholder="$t('tournament.entry.passcode_placeholder')"
        />
      </div>
      <!-- type="button" so a click goes through the Button's own promise
           tracking; Enter in the field still reaches the form's submit. -->
      <Button
        type="button"
        :disabled="passcode.trim().length === 0"
        :class="[tacticalCtaButtonClasses, 'shrink-0']"
        @click="unlock"
      >
        <KeyRound class="h-4 w-4" />
        {{ $t("tournament.entry.unlock") }}
      </Button>
    </form>
  </section>
</template>
