<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ShieldCheck, ShieldX } from "lucide-vue-next";
import TournamentChip from "~/components/tournament/TournamentChip.vue";
import { e_tournament_status_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { tournamentPlayerElo } from "~/utilities/tournamentElo";

const props = defineProps<{
  tournament: Record<string, any>;
  // The registration columns, fetched separately by TournamentDetail.
  registration?: Record<string, any> | null;
  // Already registered — either as a team or in the free agent pool. There is
  // nothing left to warn them about.
  alreadyEntered?: boolean;
}>();

const { t } = useI18n();

const me = computed(() => useAuthStore().me);

const inviteOnly = computed(() => props.registration?.invite_only === true);

// A row-level computed field: true when the tournament is not invite-only, the
// viewer organizes it, or an invite / invite link has already unlocked them.
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

// The verdict has to come off the ladder get_tournament_player_elo gates on --
// Wingman when the lineup minimum is 2, Competitive otherwise -- or the panel
// announces a pass the insert trigger is about to refuse.
const myElo = computed(() =>
  tournamentPlayerElo(props.tournament, me.value),
);

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

// There is no longer anything to type in: entry is granted by an invite the
// organizer addresses to you or by an invite link they share, both of which
// arrive from outside this panel. All it can do is say so.
const needsInvite = computed(() => inviteOnly.value && !unlocked.value);

const blocked = computed(() => roleBlocked.value || eloBlocked.value);

const chipTone = computed(() => {
  if (blocked.value) {
    return "bad";
  }
  return needsInvite.value ? "warn" : "ok";
});

const chipLabel = computed(() => {
  if (blocked.value) {
    return t("tournament.entry.blocked_chip");
  }
  return needsInvite.value
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
  return needsInvite.value || requirements.value.length > 0;
});
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
            needsInvite
              ? $t("tournament.entry.locked_title")
              : $t("tournament.entry.title")
          }}
        </h3>
        <p
          class="mt-1 max-w-[70ch] text-[0.8rem] leading-relaxed text-muted-foreground"
        >
          {{
            needsInvite
              ? $t("tournament.entry.invite_hint")
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
  </section>
</template>
