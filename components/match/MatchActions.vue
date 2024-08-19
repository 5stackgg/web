<script setup lang="ts">
import { MoreVertical } from "lucide-vue-next";
import MatchSelectServer from "~/components/match/MatchSelectServer.vue";
import MatchSelectWinner from "~/components/match/MatchSelectWinner.vue";
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button size="icon" variant="outline">
        <MoreVertical class="h-3.5 w-3.5" />
        <span class="sr-only">More</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem v-if="match.can_assign_server">
        <MatchSelectServer :match="match"></MatchSelectServer>
      </DropdownMenuItem>
      <DropdownMenuItem>
        <MatchSelectWinner :match="match"></MatchSelectWinner>
      </DropdownMenuItem>
      <template v-if="match.can_cancel">
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="cancelMatch">Cancel Match</DropdownMenuItem>
      </template>
      <DropdownMenuSeparator />
      <DropdownMenuItem>Call for Organizer</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
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
    async cancelMatch() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          cancelMatch: [
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
