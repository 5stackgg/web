<script lang="ts" setup>
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <div
    class="flex flex-col gap-4"
    :class="{
      'flex-start': mobile,
      'items-center': !mobile,
    }"
  >
    <nuxt-link
      to="/settings"
      class="text-muted-foreground transition-colors hover:text-foreground"
      :class="{
        ['flex h-8 w-8 md:items-center justify-center']: !mobile,
      }"
    >
      <PlayerDisplay
        :player="me"
        :showSteamId="mobile"
        :showFlag="mobile"
        :showName="mobile"
      />
    </nuxt-link>
  </div>
</template>

<script lang="ts">
import { getCountryForTimezone } from "countries-and-timezones";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  props: {
    mobile: {
      type: Boolean,
      default: false,
    },
  },
  watch: {
    detectedCountry: {
      immediate: true,
      async handler() {
        if (!this.me || this.me.country) {
          return;
        }

        await this.$apollo.mutate({
          mutation: generateMutation({
            update_players_by_pk: [
              {
                pk_columns: {
                  steam_id: this.me.steam_id,
                },
                _set: {
                  country: this.detectedCountry,
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },

    detectedCountry() {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const country = getCountryForTimezone(timezone);

      if (country) {
        return country.id;
      }
    },
  },
};
</script>
