<template>
  <div>
    {{ flag }}
  </div>
</template>

<script lang="ts">
import { getCountryForTimezone } from "countries-and-timezones";

export default {
  props: {
    timezone: {
      type: String,
      required: false,
    },
  },
  data() {
    return {
      flag: "🌍",
    };
  },
  mounted() {
    this.detectTimezone();
  },
  methods: {
    detectTimezone() {
      const timezone =
        this.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

      const country = getCountryForTimezone(timezone);

      if (country) {
        this.flag = this.getFlagEmoji(country.id);
      }
    },
    getFlagEmoji(countryCode: string): string {
      return String.fromCodePoint(
        ...[...countryCode].map((char) => 127397 + char.charCodeAt(0)),
      );
    },
  },
};
</script>
