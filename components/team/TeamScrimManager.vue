<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateQuery } from "~/graphql/graphqlGen";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { CalendarPlus } from "lucide-vue-next";
import TeamScrimSettings from "~/components/team/TeamScrimSettings.vue";
import TeamScrimRequests from "~/components/team/TeamScrimRequests.vue";

export default {
  components: {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Button,
    CalendarPlus,
    TeamScrimSettings,
    TeamScrimRequests,
  },
  props: {
    teamId: {
      type: String,
      required: true,
    },
    initialTab: {
      type: String,
      default: "",
    },
  },
  data() {
    return {
      tab: this.initialTab === "requests" ? "requests" : "finder",
      settings: null as any,
      requests: [] as any[],
    };
  },
  watch: {
    tab(value: string) {
      // Update the URL bar via history so the sub-tab is shareable without a
      // router navigation (which was re-rendering the page).
      if (typeof window === "undefined") {
        return;
      }
      const url = new URL(window.location.href);
      if (value === "finder") {
        url.searchParams.delete("scrimTab");
      } else {
        url.searchParams.set("scrimTab", value);
      }
      window.history.replaceState(window.history.state, "", url.toString());
    },
  },
  computed: {
    enabled(): boolean {
      return this.settings?.enabled === true;
    },
    pendingCount(): number {
      return this.requests.filter(
        (request) => request.awaiting_team_id === this.teamId,
      ).length;
    },
    loadout(): Array<{ label: string; value: string }> {
      if (!this.settings) {
        return [];
      }
      const regions = this.settings.regions ?? [];
      const eloMin = this.settings.elo_min;
      const eloMax = this.settings.elo_max;
      return [
        {
          label: "Region",
          value: regions.length ? regions.join(" · ") : "Any",
        },
        {
          label: "ELO",
          value:
            eloMin == null && eloMax == null
              ? "Any"
              : `${eloMin ?? "0"} – ${eloMax ?? "∞"}`,
        },
      ];
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
              regions: true,
              elo_min: true,
              elo_max: true,
            },
          ],
        }),
        variables() {
          return { teamId: this.teamId };
        },
        result({ data }) {
          this.settings = data.team_scrim_settings?.at(0) ?? null;
        },
      },
      team_scrim_requests: {
        query: typedGql("subscription")({
          team_scrim_requests: [
            {
              where: {
                _or: [
                  { from_team_id: { _eq: $("teamId", "uuid!") } },
                  { to_team_id: { _eq: $("teamId", "uuid!") } },
                ],
                status: { _in: ["Pending", "Countered"] },
              },
              order_by: [{ created_at: order_by.desc }],
            },
            { id: true, awaiting_team_id: true },
          ],
        }),
        variables() {
          return { teamId: this.teamId };
        },
        result({ data }) {
          this.requests = data.team_scrim_requests ?? [];
        },
      },
    },
  },
};
</script>

<template>
  <section class="relative">
    <header class="relative flex flex-wrap items-start justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1">
        <span
          class="mb-1 inline-flex items-center gap-2 font-sans text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground"
        >
          <span class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]" />
          Scrim Finder
        </span>
        <p class="text-[0.85rem] text-muted-foreground">
          Advertise your team, set who you'll play, and run your scrim schedule.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="gap-2"
          @click="copyCalendarUrl"
        >
          <CalendarPlus class="h-4 w-4" />
          Subscribe
        </Button>

        <div
          class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] transition-colors"
          :class="
            enabled
              ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
              : 'border-border bg-muted/40 text-muted-foreground'
          "
        >
          <span
            class="relative flex h-2 w-2"
            :class="enabled ? '' : 'opacity-50'"
          >
            <span
              v-if="enabled"
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-75"
            />
            <span
              class="relative inline-flex h-2 w-2 rounded-full"
              :class="enabled ? 'bg-[hsl(var(--tac-amber))]' : 'bg-muted-foreground'"
            />
          </span>
          {{ enabled ? "Open to Scrims" : "Closed" }}
        </div>
      </div>
    </header>

    <div
      v-if="enabled && loadout.length"
      class="relative mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border"
    >
      <div
        v-for="item in loadout"
        :key="item.label"
        class="bg-card/60 px-4 py-2"
      >
        <div
          class="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ item.label }}
        </div>
        <div class="mt-0.5 truncate text-sm font-medium text-foreground">
          {{ item.value }}
        </div>
      </div>
    </div>

    <Tabs v-model="tab" class="relative mt-6">
      <TabsList
        variant="underline"
        class="w-full justify-start overflow-x-auto border-b border-border pb-px"
      >
        <TabsTrigger value="finder">Finder</TabsTrigger>
        <TabsTrigger value="requests" class="gap-2">
          Requests
          <span
            v-if="pendingCount > 0"
            class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--tac-amber))] px-1 text-[0.65rem] font-bold text-[hsl(var(--tac-amber-foreground))]"
          >
            {{ pendingCount }}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="finder" class="mt-5 focus-visible:outline-none">
        <TeamScrimSettings :team-id="teamId" />
      </TabsContent>
      <TabsContent value="requests" class="mt-5 focus-visible:outline-none">
        <TeamScrimRequests :team-id="teamId" />
      </TabsContent>
    </Tabs>
  </section>
</template>
