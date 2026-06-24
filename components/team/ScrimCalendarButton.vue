<script lang="ts">
import { $ } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateQuery } from "~/graphql/graphqlGen";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { CalendarPlus } from "lucide-vue-next";

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
      settings: null as any,
    };
  },
  computed: {
    enabled(): boolean {
      return this.settings?.enabled === true;
    },
  },
  methods: {
    async copyCalendarUrl() {
      try {
        const { data } = await this.$apollo.query({
          query: generateQuery({
            scrimCalendarUrl: [{ team_id: this.teamId }, { url: true }],
          }),
          fetchPolicy: "no-cache",
        });

        const url = data?.scrimCalendarUrl?.url;
        if (!url) {
          throw new Error("no calendar url returned");
        }

        await navigator.clipboard.writeText(url);
        toast({
          title: "Calendar link copied",
          description:
            "Subscribe to this URL in your calendar app to see scheduled scrims.",
        });
      } catch (error) {
        toast({
          title: "Could not get calendar link",
          description: error instanceof Error ? error.message : undefined,
          variant: "destructive",
        });
      }
    },
  },
  apollo: {
    $subscribe: {
      team_scrim_settings: {
        query: typedGql("subscription")({
          team_scrim_settings: [
            { where: { team_id: { _eq: $("teamId", "uuid!") } } },
            {
              enabled: true,
            },
          ],
        }),
        variables() {
          return { teamId: this.teamId };
        },
        result({ data }: { data: any }) {
          this.settings = data.team_scrim_settings?.at(0) ?? null;
        },
      },
    },
  },
};
</script>

<template>
  <Button
    v-if="enabled"
    variant="tactical"
    size="sm"
    class="gap-2"
    @click="copyCalendarUrl"
  >
    <CalendarPlus class="h-4 w-4" />
    Subscribe to Scrims
  </Button>
</template>
