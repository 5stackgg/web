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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <a
            href="https://discord.gg/6xUDQRAaYY"
            target="_blank"
            rel="noopener noreferrer"
            class="text-muted-foreground transition-colors hover:text-foreground flex gap-4"
            :class="{
              ['flex h-8 w-8 md:items-center justify-center']: !mobile,
            }"
          >
            <NuxtImg
              src="/img/logos/discord.svg"
              alt="Discord"
              class="w-5 h-5"
              :class="{
                'ml-4': mobile,
              }"
            />
            <span v-if="mobile">Join our Discord</span>
          </a>
        </TooltipTrigger>
        <TooltipContent side="right">
          <span v-if="!mobile"> Join our Discord </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

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
