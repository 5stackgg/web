<script lang="ts" setup>
import ScheduleMatch from "~/components/match/ScheduleMatch.vue";
import { Separator } from "~/components/ui/separator";
</script>

<template>
  <Card v-if="match.can_schedule || match.can_start">
    <CardHeader class="p-2 pt-0 md:p-4">
      <CardTitle class="flex justify-between">Schedule</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="flex flex-col space-y-4">
        <template v-if="match.can_schedule">
          <ScheduleMatch :match="match" />
        </template>

        <Separator label="or" class="my-12" />

        <div v-if="match.can_start">
          <Button @click.prevent.stop="startMatch" class="w-full">
            Start
            <template
              v-if="
                match.options.map_veto &&
                match.options.best_of !== match.match_maps.length
              "
            >
              Veto
            </template>
            <template v-else> Match </template>
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  methods: {
    async startMatch() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          startMatch: [
            {
              match_id: this.match.id,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
