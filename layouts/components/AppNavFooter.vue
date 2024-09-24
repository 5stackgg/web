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
  methods: {
    async dismissNotification(id: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_notifications_by_pk: [
            {
              pk_columns: { id },
              _set: {
                is_read: true,
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async deleteNotification(id: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_notifications_by_pk: [
            {
              pk_columns: { id },
              _set: {
                is_read: true,
                deleted_at: new Date(),
              },
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    async deleteAllReadNotifications() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_notifications: [
            {
              where: { is_read: true },
              _set: { deleted_at: new Date() },
            },
          ],
        }),
      });
    },
    async acceptInvite(inviteId: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          acceptTeamInvite: [
            {
              invite_id: inviteId,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
    async denyInvite(inviteId: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          denyTeamInvite: [
            {
              invite_id: inviteId,
            },
            {
              success: true,
            },
          ],
        }),
      });
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

<style scoped lang="scss">
.animate-bell {
  animation: bell 2s ease-in-out infinite;
}

@keyframes bell {
  0%,
  100% {
    transform: rotate(0deg);
  }
  20% {
    transform: rotate(10deg);
  }
  40% {
    transform: rotate(-10deg);
  }
  60% {
    transform: rotate(5deg);
  }
  80% {
    transform: rotate(-5deg);
  }
}
</style>
