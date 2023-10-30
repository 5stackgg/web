<template>
  <pre>{{ servers_by_pk }}</pre>

  <form @submit.prevent="sendCommand">
    <div class="mt-6 grid gap-4 lg:gap-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
        <five-stack-text-input
          label="Command"
          v-model="command"
        ></five-stack-text-input>
      </div>
    </div>
  </form>

  <div class="p-10 overflow-scroll bg-black text-white text-xs font-mono">
    <p v-for="log in logs" :key="log" class="whitespace-pre mt-2 mb-2">
      {{ log }}
    </p>
  </div>
</template>
<script setup lang="ts">
import FiveStackTextInput from "~/components/forms/FiveStackTextInput.vue";
</script>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import socket from "~/web-sockets/Socket";
import { v4 as uuidv4 } from "uuid";

export default {
  apollo: {
    servers_by_pk: {
      query: generateQuery({
        servers_by_pk: [
          {
            id: $("serverId", "uuid!"),
          },
          {
            id: true,
            host: true,
            port: true,
            label: true,
            tv_port: true,
            enabled: true,
          },
        ],
      }),
      variables: function () {
        return {
          serverId: this.$route.params.id,
        };
      },
    },
  },
  data() {
    return {
      logs: [],
      command: "",
      uuid: undefined,
      rconListener: undefined,
    };
  },
  watch: {
    $route: {
      immediate: true,
      handler() {
        if (this.rconListener) {
          this.rconListener.stop();
          this.rconListener = undefined;
        }

        this.uuid = uuidv4();

        this.rconListener = socket.listen("rcon", this.uuid, (data) => {
          this.logs.unshift(data.result);
        });
      },
    },
  },
  methods: {
    sendCommand() {
      if (this.command.length === 0) {
        return;
      }

      socket.event("rcon", this.uuid, {
        serverId: this.$route.params.id,
        command: this.command,
      });
      this.command = "";
    },
  },
  beforeUnmount() {
    this.rconListener?.stop();
  },
};
</script>
