<script setup lang="ts">
import { Trash2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import TimeAgo from "~/components/TimeAgo.vue";
import TeamInviteNotification from "~/components/TeamInviteNotification.vue";
import Empty from "~/components/ui/empty/Empty.vue";
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex-1 overflow-y-auto p-4 flex flex-col">
      <template
        v-if="
          team_invites.length > 0 ||
          tournament_team_invites.length > 0 ||
          notifications.length > 0
        "
      >
        <div
          v-if="team_invites.length > 0"
          class="mb-4 p-4 bg-accent rounded-lg"
        >
          <TeamInviteNotification
            type="team"
            :invite="invite"
            :key="invite.id"
            v-for="invite of team_invites"
          />
          <Separator v-if="notifications.length > 0" />
        </div>

        <div
          v-if="tournament_team_invites.length > 0"
          class="mb-4 p-4 bg-accent rounded-lg"
        >
          <TeamInviteNotification
            type="tournament"
            :invite="invite"
            :key="invite.id"
            v-for="invite of tournament_team_invites"
          />
          <Separator v-if="notifications.length > 0" />
        </div>

        <template v-for="notification of notifications" :key="notification.id">
          <div class="mb-4 p-4 rounded-lg shadow-md relative">
            <Button
              v-if="notification.deletable !== false"
              size="icon"
              variant="ghost"
              @click="deleteNotification(notification.id)"
              class="absolute top-2 right-2"
            >
              <Trash2 class="h-4 w-4" />
              <span class="sr-only">{{
                $t("layouts.notifications.delete")
              }}</span>
            </Button>
            <h3
              :class="[
                'text-lg font-semibold mb-2',
                notification.is_read ? 'text-muted-foreground' : '',
              ]"
            >
              {{ notification.title }}
            </h3>

            <template v-if="notification.type !== 'NameChangeRequest'">
              <p
                class="notification"
                :class="[
                  'text-sm mb-2',
                  notification.is_read
                    ? 'text-muted-foreground/70'
                    : 'text-muted-foreground',
                ]"
                v-html="notification.message"
              />
            </template>
            <template v-else>
              <p
                class="notification"
                :class="[
                  'text-sm mb-2',
                  notification.is_read
                    ? 'text-muted-foreground/70'
                    : 'text-muted-foreground',
                ]"
              >
                {{ notification.message }}
              </p>
            </template>

            <div class="flex justify-between items-center">
              <span
                :class="[
                  'text-xs',
                  notification.is_read
                    ? 'text-muted-foreground/50'
                    : 'text-muted-foreground',
                ]"
              >
                <TimeAgo :date="notification.created_at" />
              </span>
              <template v-if="notification.actions">
                <div class="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    @click="handleAction(notification, action)"
                    :key="index"
                    v-for="(action, index) of notification.actions"
                  >
                    {{ action.label }}
                  </Button>
                </div>
              </template>
              <template v-else>
                <Button
                  size="sm"
                  variant="outline"
                  @click="dismissNotification(notification.id)"
                  v-if="!notification.is_read"
                >
                  {{ $t("layouts.notifications.dismiss") }}
                </Button>
              </template>
            </div>
          </div>
        </template>
      </template>
      <template v-else>
        <Empty>
          <div class="space-y-1">
            <p class="text-sm font-medium text-foreground">
              {{ $t("layouts.notifications.no_notifications_title") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ $t("layouts.notifications.no_notifications") }}
            </p>
          </div>
        </Empty>
      </template>
    </div>

    <div
      class="flex gap-2 px-4 py-3 border-t border-zinc-800"
      v-if="notifications.length > 0"
    >
      <Button
        size="sm"
        variant="outline"
        @click="dismissAllNotifications"
        class="w-full"
      >
        {{ $t("layouts.notifications.dismiss_all") }}
      </Button>
      <Button
        size="sm"
        variant="outline"
        @click="deleteAllReadNotifications"
        class="w-full bg-destructive text-white"
      >
        {{ $t("layouts.notifications.delete_all_read") }}
      </Button>
    </div>
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  computed: {
    team_invites() {
      return useNotificationStore().team_invites;
    },
    tournament_team_invites() {
      return useNotificationStore().tournament_team_invites;
    },
    notifications() {
      return useNotificationStore().notifications;
    },
  },
  methods: {
    async handleAction(notification: any, action: any) {
      if (action.graphql.action) {
        const {
          type,
          action: actionName,
          selection,
          variables,
        } = action.graphql;
        if (type === "mutation") {
          await this.$apollo.mutate({
            mutation: generateMutation({
              [actionName]: [variables, selection],
            }),
          });
        }
      }
      await this.deleteNotification(notification.id);
    },
    async dismissNotification(id: string) {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_notifications_by_pk: [
            { pk_columns: { id }, _set: { is_read: true } },
            { __typename: true },
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
              _set: { is_read: true, deleted_at: new Date() },
            },
            { __typename: true },
          ],
        }),
      });
    },
    async deleteAllReadNotifications() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_notifications: [
            {
              where: {
                is_read: { _eq: true },
                deletable: { _neq: false },
              },
              _set: { deleted_at: new Date() },
            },
            { __typename: true },
          ],
        }),
      });
    },
    async dismissAllNotifications() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_notifications: [
            { where: { is_read: { _eq: false } }, _set: { is_read: true } },
            { __typename: true },
          ],
        }),
      });
    },
  },
};
</script>

<style lang="postcss">
.notification {
  a {
    @apply text-blue-500 underline hover:text-blue-700;
  }
}
</style>
