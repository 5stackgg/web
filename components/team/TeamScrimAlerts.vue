<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ELO_MAX, eloMin, eloMax } from "~/utilities/scrimElo";
import ScrimRegionPicker from "~/components/team/ScrimRegionPicker.vue";
import ScrimEloRange from "~/components/team/ScrimEloRange.vue";

export default {
  components: { Button, Switch, ScrimRegionPicker, ScrimEloRange },
  props: {
    teamId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      alerts: [] as any[],
      submitting: false,
      regions: [] as string[],
      eloRange: [0, ELO_MAX],
      fieldLabel:
        "text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground",
    };
  },
  apollo: {
    $subscribe: {
      team_scrim_alerts: {
        query: typedGql("subscription")({
          team_scrim_alerts: [
            {
              where: { team_id: { _eq: $("teamId", "uuid!") } },
              order_by: [{ created_at: order_by.desc }],
            },
            {
              id: true,
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
          this.alerts = data.team_scrim_alerts ?? [];
        },
      },
    },
  },
  methods: {
    async create() {
      this.submitting = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            insert_team_scrim_alerts_one: [
              {
                object: {
                  team_id: this.teamId,
                  enabled: true,
                  regions: this.regions,
                  elo_min: eloMin(this.eloRange),
                  elo_max: eloMax(this.eloRange),
                },
              },
              { id: true },
            ],
          }),
        });
        toast({ title: this.$t("scrim.alert_created") });
        this.regions = [];
        this.eloRange = [0, ELO_MAX];
      } finally {
        this.submitting = false;
      }
    },
    async toggle(alert: any) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_team_scrim_alerts_by_pk: [
            {
              pk_columns: { id: alert.id },
              _set: { enabled: !alert.enabled },
            },
            { id: true },
          ],
        }),
      });
    },
    async remove(id: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          delete_team_scrim_alerts_by_pk: [{ id }, { id: true }],
        }),
      });
    },
  },
};
</script>

<template>
  <div class="space-y-5">
    <p class="text-sm text-muted-foreground">
      {{ $t("scrim.alerts_description") }}
    </p>

    <div class="space-y-4 rounded-md border border-border bg-card/40 p-4">
      <div class="space-y-1.5">
        <span :class="fieldLabel">{{ $t("scrim.regions_section") }}</span>
        <ScrimRegionPicker v-model:regions="regions" />
      </div>

      <ScrimEloRange v-model="eloRange" />

      <div class="flex justify-end">
        <Button :loading="submitting" size="sm" class="connect-action" @click="create">
          {{ $t("scrim.add_alert") }}
        </Button>
      </div>
    </div>

    <div class="space-y-2">
      <p
        v-if="alerts.length === 0"
        class="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
      >
        {{ $t("scrim.no_alerts") }}
      </p>
      <div
        v-for="alert in alerts"
        :key="alert.id"
        class="flex items-center justify-between gap-3 rounded-md border border-border bg-card/40 p-3"
      >
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <span
            class="h-2 w-2 rounded-full"
            :class="alert.enabled ? 'bg-[hsl(var(--tac-amber))]' : 'bg-muted-foreground/50'"
          />
          <span v-if="alert.regions?.length" class="font-medium">
            {{ alert.regions.join(", ") }}
          </span>
          <span v-else class="font-medium">{{ $t("scrim.any_region") }}</span>
          <span
            v-if="alert.elo_min || alert.elo_max"
            class="text-muted-foreground"
          >
            · ELO {{ alert.elo_min ?? 0 }}–{{ alert.elo_max ?? "∞" }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <Switch :model-value="alert.enabled" @update:model-value="toggle(alert)" />
          <Button
            size="sm"
            variant="ghost"
            class="text-muted-foreground hover:text-destructive"
            @click="remove(alert.id)"
          >
            {{ $t("common.remove") }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
