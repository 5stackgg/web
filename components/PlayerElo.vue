<template>
  <div :class="[eloColorClass]" class="text-sm">
    <template v-if="elo">
      {{ elo }}
    </template>
    <template v-else> - </template>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    elo: {
      type: [String, Number],
      required: false,
    },
  },
  computed: {
    eloColorClass(): string {
      const elo = Number(this.elo);

      if (elo >= 30000) return "text-[#EB4B4B]";
      if (elo >= 25000) return "text-[#D22CE6]";
      if (elo >= 20000) return "text-[#FED700]";
      if (elo >= 15000) return "text-[#8846FF]";
      if (elo >= 10000) return "text-[#4B69FF]";
      if (elo >= 5000) return "text-[#5E98D7]";
      return "text-[#B1C3D9]";
    },
  },
};
</script>
