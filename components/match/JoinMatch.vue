<script setup lang="ts">
import { AlertTriangle } from "lucide-vue-next";
</script>

<template>
  <Card
    v-if="
      match.is_in_lineup &&
      match.connection_string &&
      match.status === e_match_status_enum.Live
    "
    class="overflow-hidden"
  >
    <CardHeader class="p-4">
      <CardTitle class="flex justify-between">
        <div class="flex items-center gap-2">
          <AlertTriangle class="h-4 w-4" />
          {{ $t("match.join.live") }}
        </div>
        <Button
          size="sm"
          variant="destructive"
          @click="callForOrganizer"
          :disabled="match.requested_organizer"
        >
          {{ $t("match.join.call_organizer") }}
        </Button>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <QuickServerConnect :match="match"></QuickServerConnect>
    </CardContent>
  </Card>
</template>

<script lang="ts">
import TimeAgo from "~/components/TimeAgo.vue";
import QuickServerConnect from "~/components/match/QuickServerConnect.vue";
import { e_match_status_enum } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  components: { QuickServerConnect, TimeAgo },
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
  methods: {
    callForOrganizer() {
      this.$apollo.mutate({
        mutation: generateMutation({
          callForOrganizer: [
            { match_id: this.match.id },
            {
              success: true,
            },
          ],
        }),
      });
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    players() {
      if (!this.match) {
        return [];
      }

      const players = [];

      players.push(...this.match.lineup_1.lineup_players);
      players.push(...this.match.lineup_2.lineup_players);

      return players;
    },
  },
};
</script>
