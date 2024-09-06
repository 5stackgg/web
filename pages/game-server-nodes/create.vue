<script setup lang="ts">
import ClipBoard from "~/components/ClipBoard.vue";
</script>

<template>
  <Button @click="setupGameServer">Create Game Server Node</Button>
  <div class="relative">
    <clip-board class="absolute top-3 right-3" :data="script"></clip-board>
    <pre class="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">{{
      script
    }}</pre>
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  data() {
    return {
      script: undefined,
    };
  },
  methods: {
    async setupGameServer() {
      const { data } = await this.$apollo.mutate({
        mutation: generateMutation({
          setupGameServer: {
            link: true,
          },
        }),
      });

      this.script = data.setupGameServer.link;
    },
  },
};
</script>
