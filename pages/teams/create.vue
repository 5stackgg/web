<template>
  <div class="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto">
    <div class="grid md:grid-cols-2 gap-12">
      <div
        class="flex flex-col border rounded-xl p-4 sm:p-6 lg:p-10 dark:border-gray-700"
      >
        <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200">
          Creating a Team
        </h2>

        <div class="mt-6 grid gap-4 lg:gap-6">
          <form @submit.prevent="createTeam">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
              <five-stack-text-input
                :required="true"
                label="Name"
                v-model="form.name"
              ></five-stack-text-input>

              <five-stack-text-input
                :required="true"
                label="Short Name"
                v-model="form.short_name"
              ></five-stack-text-input>
            </div>
            <div class="mt-6 grid gap-4 lg:gap-6">
              <Button>Create Team</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Button } from "@/components/ui/button";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  components: { Button },
  data() {
    return {
      form: {
        name: "",
        short_name: "",
      },
    };
  },
  methods: {
    async createTeam() {
      const { data } = await this.$apollo.mutate({
        mutation: generateMutation({
          insert_teams_one: [
            {
              object: this.form,
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.$router.push(`/teams/${data.insert_teams_one.id}`);
    },
  },
};
</script>
