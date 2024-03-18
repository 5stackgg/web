<template>
  <div class="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto">
    <div class="grid md:grid-cols-2 gap-12">
      <div
        class="flex flex-col border rounded-xl p-4 sm:p-6 lg:p-10 dark:border-gray-700"
      >
        <form @submit.prevent="createServer">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Server Details
          </h2>

          <div class="mt-6 grid gap-4 lg:gap-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
              <five-stack-text-input
                label="Label"
                v-model="form.label"
                required
              ></five-stack-text-input>
              <five-stack-text-input
                label="Host / IP"
                v-model="form.host"
                required
              ></five-stack-text-input>
              <five-stack-text-input
                label="RCON Password"
                v-model="form.rcon_password"
                required
              ></five-stack-text-input>
              <five-stack-number-input
                label="Game Port"
                v-model="form.port"
                required
              ></five-stack-number-input>
              <five-stack-number-input
                label="TV Port"
                v-model="form.tv_port"
                required
              ></five-stack-number-input>
            </div>
          </div>
        </form>
      </div>
    </div>
    <div class="mt-10 text-right">
      <five-stack-button type="success" @click="createServer"
        >Create Server</five-stack-button
      >
    </div>
  </div>
</template>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";
import FiveStackCheckbox from "~/components/forms/FiveStackCheckbox.vue";
import FiveStackTextInput from "~/components/forms/FiveStackTextInput.vue";
import FiveStackSearchInput from "~/components/forms/FiveStackSearchInput.vue";
import FiveStackSelectInput from "~/components/forms/FiveStackSelectInput.vue";
import FiveStackNumberInput from "~/components/forms/FiveStackNumberInput.vue";
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";

export default {
  components: {
    FiveStackNumberInput,
    FiveStackCheckbox,
    FiveStackTextInput,
    FiveStackSearchInput,
    FiveStackSelectInput,
  },
  data() {
    return {
      form: {
        host: "",
        label: "",
        port: 27015,
        tv_port: 27020,
        rcon_password: "",
      },
    };
  },
  methods: {
    async createServer() {
      const { data } = await this.$apollo.mutate({
        mutation: generateMutation({
          insert_servers_one: [
            {
              object: {
                label: this.form.label,
                host: this.form.host,
                port: this.form.port,
                tv_port: this.form.tv_port,
                rcon_password: this.form.rcon_password,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });
      this.$router.push(`/servers/${data.insert_servers_one.id}`);
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
  },
};
</script>
