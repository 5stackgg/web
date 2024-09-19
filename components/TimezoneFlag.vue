<template>
  <div>
    {{ flag }}
  </div>
</template>

<script lang="ts">
export default {
  props: {
    country: {
      type: String,
      required: false,
    },
  },
  computed: {
    flag() {
      if (this.country) {
        return this.getFlagEmoji(this.country);
      }

      return "🌍";
    },
  },
  methods: {
    getFlagEmoji(countryCode: string): string {
      return String.fromCodePoint(
        ...[...countryCode].map((char) => 127397 + char.charCodeAt(0)),
      );
    },
  },
};
</script>
