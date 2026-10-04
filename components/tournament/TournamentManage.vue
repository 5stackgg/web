<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  Image as ImageIcon,
  Ticket,
  Users,
  Layers,
  SlidersHorizontal,
  Trophy,
  Shield,
  Bell,
} from "lucide-vue-next";
import ManageSection from "~/components/common/ManageSection.vue";
import TournamentInformationForm from "~/components/tournament/TournamentInformationForm.vue";
import TournamentMatchOptionsForm from "~/components/tournament/TournamentMatchOptionsForm.vue";
import TournamentPrizesManage from "~/components/tournament/TournamentPrizesManage.vue";
import TournamentAwardsConfig from "~/components/tournament/TournamentAwardsConfig.vue";
import TournamentAwardsManage from "~/components/tournament/TournamentAwardsManage.vue";
import TournamentOrganizers from "~/components/tournament/TournamentOrganizers.vue";
import TournamentNotifications from "~/components/tournament/TournamentNotifications.vue";
import TournamentStagesManage from "~/components/tournament/TournamentStagesManage.vue";
import TournamentJoinForm from "~/components/tournament/TournamentJoinForm.vue";
import TournamentInvites from "~/components/tournament/TournamentInvites.vue";
import TournamentInviteLinks from "~/components/tournament/TournamentInviteLinks.vue";
import TournamentCheckInReview from "~/components/tournament/TournamentCheckInReview.vue";

// The organizer's console: every setting the page used to spread over six
// tabs, as one left-hand list of sections beside the section being edited.
const props = defineProps<{
  tournament: Record<string, any>;
  registration: Record<string, any> | null;
  checkInTeams: Array<Record<string, any>>;
  checkInReviewVisible: boolean;
  section: string;
}>();

const emit = defineEmits<{ (e: "update:section", value: string): void }>();

const { t } = useI18n();

const sections = computed(() => [
  { key: "details", label: t("tournament.manage.details"), icon: ImageIcon },
  {
    key: "registration",
    label: t("tournament.manage.registration"),
    icon: Ticket,
  },
  {
    key: "teams",
    label: t("tournament.manage.teams"),
    icon: Users,
    attention: props.checkInReviewVisible,
  },
  { key: "stages", label: t("tournament.manage.stages"), icon: Layers },
  {
    key: "match-rules",
    label: t("tournament.manage.match_rules"),
    icon: SlidersHorizontal,
  },
  { key: "prizes", label: t("tournament.manage.prizes_awards"), icon: Trophy },
  { key: "organizers", label: t("tournament.manage.organizers"), icon: Shield },
  { key: "discord", label: t("tournament.manage.discord"), icon: Bell },
]);

const current = computed(
  () =>
    sections.value.find((s) => s.key === props.section) ?? sections.value[0],
);
</script>

<template>
  <div
    class="grid items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10"
  >
    <nav
      :aria-label="$t('tournament.manage.title')"
      class="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:sticky lg:top-6 lg:mx-0 lg:grid lg:overflow-visible lg:px-0 lg:pb-0"
    >
      <button
        v-for="item in sections"
        :key="item.key"
        type="button"
        class="relative flex h-9 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-left text-[0.8rem] font-semibold transition-colors"
        :class="
          item.key === current.key
            ? 'bg-[hsl(var(--tac-amber)/0.1)] text-foreground lg:shadow-[inset_2px_0_0_hsl(var(--tac-amber))]'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
        "
        :aria-current="item.key === current.key ? 'page' : undefined"
        @click="emit('update:section', item.key)"
      >
        <component :is="item.icon" class="h-4 w-4 shrink-0" />
        {{ item.label }}
        <span
          v-if="item.attention"
          class="ml-auto h-2 w-2 rounded-full bg-warning"
          :aria-label="$t('tournament.manage.needs_attention')"
        ></span>
      </button>
    </nav>

    <div class="grid min-w-0 max-w-3xl gap-8 [&>*]:!mx-0">
      <template v-if="current.key === 'details'">
        <TournamentInformationForm :tournament="tournament" part="details" />
      </template>

      <template v-else-if="current.key === 'registration'">
        <TournamentInformationForm
          :tournament="tournament"
          part="registration"
        />
      </template>

      <template v-else-if="current.key === 'teams'">
        <TournamentCheckInReview
          v-if="checkInReviewVisible"
          class="!mt-0"
          :tournament="tournament"
          :registration="registration"
          :teams="checkInTeams"
        />
        <ManageSection
          :label="$t('tournament.add_team.title')"
          :hint="$t('tournament.add_team.description')"
        >
          <TournamentJoinForm :tournament="tournament" />
        </ManageSection>
        <ManageSection :label="$t('tournament.invites.title')">
          <TournamentInvites
            :tournament="tournament"
            :registration="registration"
          />
        </ManageSection>
        <ManageSection :label="$t('tournament.invite_links.tab')">
          <TournamentInviteLinks :tournament="tournament" />
        </ManageSection>
      </template>

      <TournamentStagesManage
        v-else-if="current.key === 'stages'"
        :tournament="tournament"
      />

      <ManageSection
        v-else-if="current.key === 'match-rules'"
        :label="$t('tournament.manage.match_rules')"
      >
        <TournamentMatchOptionsForm :tournament="tournament" />
      </ManageSection>

      <template v-else-if="current.key === 'prizes'">
        <TournamentPrizesManage :tournament="tournament" />
        <TournamentAwardsConfig :tournament="tournament" />
        <TournamentAwardsManage :tournament="tournament" />
      </template>

      <TournamentOrganizers
        v-else-if="current.key === 'organizers'"
        :tournament="tournament"
      />

      <TournamentNotifications
        v-else-if="current.key === 'discord'"
        :tournament="tournament"
      />
    </div>
  </div>
</template>
