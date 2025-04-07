<script setup lang="ts">
import { Loader } from "lucide-vue-next";
import ClipBoard from "~/components/ClipBoard.vue";
</script>

<template>
  <div v-if="match.connection_string">
    <template v-if="!match.is_server_online">
      <template v-if="match.server_type === 'Dedicated'">
        {{ $t("match.server.offline") }}
      </template>
      <template v-else>
        <div class="flex">
          {{ $t("match.server.booting") }}
          <Loader class="animate-spin ml-3"></Loader>
        </div>
      </template>
    </template>
    <template v-else>
      <div class="underline flex" v-if="match.connection_string">
        <ClipBoard :data="match.connection_string"></ClipBoard>
        <a
          :href="`https://${useRuntimeConfig().public.webDomain}${match.connection_link}`"
        >
          {{ match.connection_string }}
        </a>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    match: {
      type: Object,
      required: true,
    },
  },
};
</script>
