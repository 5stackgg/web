<script lang="ts">
import gql from "graphql-tag";
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { CalendarPlus } from "lucide-vue-next";

// Raw document rather than the zeus builder: the action was renamed from
// `scrimCalendarUrl` and the generated types lag behind until `yarn codegen`
// runs against a Hasura carrying the new metadata.
const TEAM_CALENDAR_URL_QUERY = gql`
  query GetTeamCalendarUrl($teamId: uuid!) {
    teamCalendarUrl(team_id: $teamId) {
      url
    }
  }
`;

// One subscribable feed per team, covering everything the team plays — scrims,
// league fixtures and tournament matches. The URL carries an HMAC token because
// calendar apps can't send auth headers; the `teamCalendarUrl` action mints it
// and refuses anyone who doesn't manage the team.
export default {
  components: {
    Button,
    CalendarPlus,
  },
  props: {
    teamId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      team: null as any,
      fetching: false,
    };
  },
  computed: {
    canSubscribe(): boolean {
      const steamId = useAuthStore().me?.steam_id;
      if (!steamId || !this.team) {
        return false;
      }
      return (
        String(this.team.owner_steam_id) === String(steamId) ||
        String(this.team.captain_steam_id) === String(steamId) ||
        (this.team.roster ?? []).some(
          (member: any) =>
            String(member.player_steam_id) === String(steamId) &&
            member.role === "Admin",
        )
      );
    },
  },
  methods: {
    async copyCalendarUrl() {
      this.fetching = true;
      try {
        const { data } = await this.$apollo.query({
          query: TEAM_CALENDAR_URL_QUERY,
          variables: { teamId: this.teamId },
          fetchPolicy: "no-cache",
        });

        const url = data?.teamCalendarUrl?.url;
        if (!url) {
          throw new Error("no calendar url returned");
        }

        await navigator.clipboard.writeText(url);
        toast({
          title: this.$t("team.calendar.link_copied"),
          description: this.$t("team.calendar.subscription_help"),
        });
      } catch (error) {
        toast({
          title: this.$t("team.calendar.link_error"),
          description: error instanceof Error ? error.message : undefined,
          variant: "destructive",
        });
      } finally {
        this.fetching = false;
      }
    },
  },
  apollo: {
    $subscribe: {
      teams_by_pk: {
        query: typedGql("subscription")({
          teams_by_pk: [
            { id: $("teamId", "uuid!") },
            {
              owner_steam_id: true,
              captain_steam_id: true,
              roster: [{}, { player_steam_id: true, role: true }],
            },
          ],
        }),
        variables() {
          return { teamId: this.teamId };
        },
        result({ data }: { data: any }) {
          this.team = data?.teams_by_pk ?? null;
        },
        error(error: unknown) {
          console.warn("team calendar subscription failed", error);
        },
      },
    },
  },
};
</script>

<template>
  <Button
    v-if="canSubscribe"
    variant="tactical"
    size="xs"
    class="gap-1.5 text-[0.65rem] tracking-[0.12em]"
    :loading="fetching"
    @click="copyCalendarUrl"
  >
    <CalendarPlus class="h-3.5 w-3.5" />
    {{ $t("team.calendar.subscribe") }}
  </Button>
</template>
