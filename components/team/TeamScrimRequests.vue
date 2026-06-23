<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TimeAgo from "@/components/TimeAgo.vue";
import DateTimePicker from "@/components/common/DateTimePicker.vue";

export default {
  components: { Button, Badge, TimeAgo, DateTimePicker },
  props: {
    teamId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      requests: [] as any[],
      counterTimes: {} as Record<string, string>,
    };
  },
  apollo: {
    $subscribe: {
      team_scrim_requests: {
        query: typedGql("subscription")({
          team_scrim_requests: [
            {
              where: {
                _or: [
                  { from_team_id: { _eq: $("teamId", "uuid!") } },
                  { to_team_id: { _eq: $("teamId", "uuid!") } },
                ],
                status: { _in: ["Pending", "Countered", "Matched"] },
              },
              order_by: [{ created_at: order_by.desc }],
            },
            {
              id: true,
              status: true,
              from_team_id: true,
              to_team_id: true,
              awaiting_team_id: true,
              proposed_scheduled_at: true,
              match_id: true,
              auto_generated: true,
              created_at: true,
              from_team: { id: true, name: true },
              to_team: { id: true, name: true },
              match_options: { best_of: true },
            },
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
  methods: {
    isAwaitingUs(request: any): boolean {
      return request.awaiting_team_id === this.teamId;
    },
    isOurs(request: any): boolean {
      return request.from_team_id === this.teamId;
    },
    opponentName(request: any): string {
      return this.isOurs(request)
        ? request.to_team?.name
        : request.from_team?.name;
    },
    async respond(requestId: string, accept: boolean) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          respondToScrimRequest: [
            { request_id: requestId, accept },
            { success: true },
          ],
        }),
      });
      toast({ title: accept ? "Scrim accepted" : "Scrim declined" });
    },
    async counter(requestId: string) {
      const time = this.counterTimes[requestId];
      if (!time) {
        return;
      }
      await this.$apollo.mutate({
        mutation: generateMutation({
          counterScrimRequest: [
            {
              request_id: requestId,
              proposed_scheduled_at: new Date(time).toISOString(),
            },
            { success: true },
          ],
        }),
      });
      toast({ title: "New time proposed" });
    },
    async cancel(requestId: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          cancelScrimRequest: [{ request_id: requestId }, { success: true }],
        }),
      });
      toast({ title: "Scrim request cancelled" });
    },
  },
};
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="requests.length === 0"
      class="rounded-md border border-dashed border-border px-4 py-10 text-center"
    >
      <p class="text-sm text-muted-foreground">No active scrim requests.</p>
      <p class="mt-1 text-xs text-muted-foreground">
        Challenge a team from the
        <NuxtLink to="/scrims" class="text-[hsl(var(--tac-amber))] hover:underline">
          Scrim Finder
        </NuxtLink>
        to get started.
      </p>
    </div>

    <div
      v-for="request in requests"
      :key="request.id"
      class="relative space-y-3 rounded-md border border-border bg-card/40 p-4"
      :class="
        isAwaitingUs(request) && request.status !== 'Matched'
          ? 'border-l-2 border-l-[hsl(var(--tac-amber))]'
          : ''
      "
    >
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span
            class="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground"
          >
            {{ isOurs(request) ? "Outgoing →" : "Incoming ←" }}
          </span>
          <span class="font-semibold">{{ opponentName(request) }}</span>
        </div>
        <Badge
          variant="outline"
          class="uppercase tracking-wide"
          :class="
            request.status === 'Matched'
              ? 'border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]'
              : ''
          "
        >
          {{ request.status }}
        </Badge>
      </div>

      <div class="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        <span class="text-foreground">
          {{ new Date(request.proposed_scheduled_at).toLocaleString() }}
        </span>
        <span v-if="request.match_options" class="text-muted-foreground">
          · Best of {{ request.match_options.best_of }}
        </span>
        <span v-if="request.auto_generated" class="text-[hsl(var(--tac-amber))]">
          · auto-matched
        </span>
        <TimeAgo :date="request.created_at" class="text-xs" />
      </div>

      <div
        v-if="request.status === 'Matched' && request.match_id"
        class="flex items-center justify-between gap-2 text-sm"
      >
        <NuxtLink
          :to="`/matches/${request.match_id}`"
          class="text-[hsl(var(--tac-amber))] hover:underline"
        >
          View scheduled match →
        </NuxtLink>
        <Button
          size="sm"
          variant="ghost"
          class="text-muted-foreground hover:text-destructive"
          @click="cancel(request.id)"
        >
          Cancel scrim
        </Button>
      </div>

      <div
        v-else-if="isAwaitingUs(request)"
        class="flex flex-wrap items-center gap-2 border-t border-border pt-3"
      >
        <Button size="sm" class="tac-amber-cta" @click="respond(request.id, true)">
          Accept
        </Button>
        <Button size="sm" variant="outline" @click="respond(request.id, false)">
          Decline
        </Button>
        <div class="ml-auto flex items-center gap-2">
          <DateTimePicker v-model="counterTimes[request.id]" size="sm" />
          <Button size="sm" variant="secondary" @click="counter(request.id)">
            Counter
          </Button>
        </div>
      </div>

      <div
        v-else-if="isOurs(request)"
        class="flex justify-between border-t border-border pt-3"
      >
        <p class="text-xs text-muted-foreground">
          Waiting on {{ opponentName(request) }} to respond.
        </p>
        <Button
          size="sm"
          variant="ghost"
          class="text-muted-foreground hover:text-destructive"
          @click="cancel(request.id)"
        >
          Cancel
        </Button>
      </div>
      <p v-else class="text-sm text-muted-foreground">
        Waiting on {{ opponentName(request) }}.
      </p>
    </div>
  </div>
</template>
