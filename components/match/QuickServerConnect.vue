<script lang="ts">
import { ExternalLink, Copy } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import ClipBoard from "~/components/ClipBoard.vue";

export default {
  components: {
    ExternalLink,
    Copy,
    ClipBoard,
    Button,
  },
  props: {
    server: {
      type: Object,
      required: true,
    },
    highlight: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      isLoading: false,
    };
  },
  methods: {
    handleClick() {
      this.isLoading = true;
      setTimeout(() => {
        this.isLoading = false;
      }, 10000);
    },
  },
};
</script>

<template>
  <div v-if="server.connection_string" class="flex items-center gap-1">
    <ClipBoard :data="server.connection_string"></ClipBoard>
    <a
      :href="server.connection_link"
      v-if="server.connection_link"
      @click="handleClick"
    >
      <Button
        :variant="highlight ? 'default' : 'outline'"
        class="min-w-32"
        :class="highlight ? 'tac-amber-cta' : ''"
        :loading="isLoading"
      >
        <ExternalLink class="w-4 h-4 mr-1" />
        {{ $t("server.join_server") }}
      </Button>
    </a>
  </div>
</template>
