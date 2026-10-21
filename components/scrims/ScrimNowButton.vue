<script setup lang="ts">
import { computed, ref } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { Zap } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { toast } from "~/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";
import { timeLabel } from "~/utilities/scrimFormat";

const LOOK_HOURS = 2;

const props = defineProps<{ team: any; now: Date; booked?: boolean }>();

const { t } = useI18n();
const { client } = useApolloClient();
const open = ref(false);
const busy = ref(false);

// Scrim now is a one-off window from now; the api's auto-matching pairs any
// team free in that window.
const lookingUntil = computed(() => {
  const nowMs = props.now.getTime();
  const window = (props.team?.scrim_availability ?? []).find(
    (row: any) =>
      !row.recurring_weekly &&
      new Date(row.starts_at).getTime() <= nowMs &&
      new Date(row.ends_at).getTime() > nowMs,
  );
  return window ? new Date(window.ends_at).getTime() : null;
});

async function run(work: () => Promise<unknown>, success: string) {
  busy.value = true;
  try {
    await work();
    toast({ title: success });
    open.value = false;
  } catch (error) {
    toast({
      title: t("scrims.toast.failed"),
      description: error instanceof Error ? error.message : undefined,
      variant: "destructive",
    });
  } finally {
    busy.value = false;
  }
}

function start() {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + LOOK_HOURS * 3_600_000);
  return run(async () => {
    await client.mutate({
      mutation: generateMutation({
        insert_team_scrim_settings_one: [
          {
            object: { team_id: props.team.id, enabled: true },
            on_conflict: {
              constraint: "team_scrim_settings_team_id_key",
              update_columns: ["enabled"],
            },
          },
          { id: true },
        ],
      } as any),
    });
    await client.mutate({
      mutation: generateMutation({
        insert_team_scrim_availability_one: [
          {
            object: {
              team_id: props.team.id,
              starts_at: startsAt.toISOString(),
              ends_at: endsAt.toISOString(),
              recurring_weekly: false,
            },
          },
          { id: true },
        ],
      } as any),
    });
  }, t("scrims.now.started", { team: props.team.name, time: timeLabel(endsAt.getTime()) }));
}

function stop() {
  return run(
    () =>
      client.mutate({
        mutation: generateMutation({
          delete_team_scrim_availability: [
            {
              where: {
                team_id: { _eq: props.team.id },
                recurring_weekly: { _eq: false },
                ends_at: { _gt: new Date().toISOString() },
              },
            },
            { affected_rows: true },
          ],
        } as any),
      }),
    t("scrims.now.stopped"),
  );
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        v-if="lookingUntil"
        variant="outline"
        size="sm"
        class="h-8 gap-1.5 border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]"
      >
        <Zap class="h-3.5 w-3.5" />
        {{ $t("scrims.now.looking", { time: timeLabel(lookingUntil) }) }}
      </Button>
      <Button v-else size="sm" class="tac-amber-cta h-8 gap-1.5">
        <Zap class="h-3.5 w-3.5" />
        {{ $t("scrims.now.button") }}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" class="grid w-72 gap-3 p-3">
      <template v-if="lookingUntil">
        <p class="text-sm text-muted-foreground">
          {{ $t("scrims.now.looking_description", { team: team.name, time: timeLabel(lookingUntil) }) }}
        </p>
        <Button variant="outline" size="sm" class="text-red-400" :loading="busy" @click="stop">
          {{ $t("scrims.now.stop") }}
        </Button>
      </template>
      <template v-else>
        <p class="text-sm font-semibold">{{ $t("scrims.now.title") }}</p>
        <p class="text-sm text-muted-foreground">
          {{ $t("scrims.now.description", { team: team.name, hours: LOOK_HOURS }) }}
        </p>
        <p v-if="booked" class="text-sm text-red-400">{{ $t("scrims.now.booked") }}</p>
        <Button class="tac-amber-cta gap-1.5" size="sm" :disabled="booked" :loading="busy" @click="start">
          <Zap class="h-3.5 w-3.5" />
          {{ $t("scrims.now.start") }}
        </Button>
      </template>
    </PopoverContent>
  </Popover>
</template>
