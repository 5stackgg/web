<template>
  <div class="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <h2
        class="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900"
      >
        <img
          @click="signIn"
          src="https://community.akamai.steamstatic.com/public/images/signinthroughsteam/sits_02.png"
        />
      </h2>
    </div>
  </div>
</template>
<script setup lang="ts">
definePageMeta({
  layout: "public",
});
</script>

<script lang="ts">
import { useAuthStore } from "~/stores/AuthStore";

export default {
  methods: {
    signIn() {
      // TODO - use env variable
      window.location = `https://api.5stack.gg/auth/steam?redirect=${encodeURIComponent(
        window.location.toString(),
      )}`;
    },
  },
  watch: {
    me: {
      immediate: true,
      handler(me: Record<string, unknown>) {
        if (me) {
          this.$router.push("/");
        }
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
  },
};
</script>
