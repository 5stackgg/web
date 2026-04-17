<script setup lang="ts">
import { Bell } from "lucide-vue-next";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import TeamInviteNotification from "~/components/TeamInviteNotification.vue";
import NotificationItem from "~/components/notification/NotificationItem.vue";
import NotificationStack from "~/components/notification/NotificationStack.vue";
</script>

<template>
  <Sheet :open="isOpen" @update:open="(open) => (isOpen = open)">
    <SheetTrigger>
      <div class="relative">
        <Bell size="20" :class="{ 'animate-bell': hasNotifications }" />
        <span
          v-if="hasNotifications"
          class="absolute -top-1 -right-1 inline-flex"
        >
          <span
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"
          ></span>
          <span
            class="relative inline-flex rounded-full h-2 w-2 bg-red-500"
          ></span>
        </span>
      </div>
      <span class="sr-only">{{ $t("layouts.notifications.title") }}</span>
    </SheetTrigger>
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{{ $t("layouts.notifications.title") }}</SheetTitle>
      </SheetHeader>

      <div class="flex flex-col h-full">
        <div class="flex-1 overflow-y-auto">
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
              <Separator v-if="notifications.length > 0"></Separator>
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
              <Separator v-if="notifications.length > 0"></Separator>
            </div>

            <template
              v-for="item of stackedNotifications"
              :key="
                item.kind === 'single' ? item.notification.id : item.entityId
              "
            >
              <NotificationStack
                v-if="item.kind === 'stack'"
                variant="sheet"
                :notifications="item.notifications"
                @dismiss="dismissNotification"
                @delete="deleteNotification"
                @action="handleAction"
                @dismiss-all="dismissMany"
                @delete-all="deleteMany"
              />
              <NotificationItem
                v-else
                variant="sheet"
                :notification="item.notification"
                @dismiss="dismissNotification"
                @delete="deleteNotification"
                @action="handleAction"
              />
            </template>
          </template>
          <template v-else>
            <p class="mt-8 text-center text-muted-foreground">
              {{ $t("layouts.notifications.no_notifications") }}
            </p>
          </template>
        </div>

        <div class="flex gap-2 my-4 py-2 border-t">
          <Button
            size="sm"
            variant="outline"
            @click="dismissAllNotifications"
            class="w-full"
            v-if="notifications.length > 0"
          >
            {{ $t("layouts.notifications.dismiss_all") }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            @click="deleteAllReadNotifications"
            class="w-full bg-destructive text-white"
            v-if="notifications.length > 0"
          >
            {{ $t("layouts.notifications.delete_all_read") }}
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  data() {
    return {
      isOpen: false,
    };
  },
  watch: {
    $route() {
      this.isOpen = false;
    },
  },
  methods: {
    async handleAction(notification, action) {
      if (action.graphql.action) {
        const {
          type,
          action: actionName,
          selection,
          variables,
        } = action.graphql;
        switch (type) {
          case "mutation":
            await this.$apollo.mutate({
              mutation: generateMutation({
                [actionName]: [variables, selection],
              }),
            });
            break;
        }
      }

      await this.deleteNotification(notification.id);
    },
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
              where: {
                is_read: {
                  _eq: true,
                },
              },
              _set: {
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
    async dismissAllNotifications() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_notifications: [
            {
              where: {
                is_read: {
                  _eq: false,
                },
              },
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
    async dismissMany(ids: string[]) {
      if (ids.length === 0) return;
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_notifications: [
            {
              where: { id: { _in: ids } },
              _set: { is_read: true },
            },
            { __typename: true },
          ],
        }),
      });
    },
    async deleteMany(ids: string[]) {
      if (ids.length === 0) return;
      await this.$apollo.mutate({
        mutation: generateMutation({
          update_notifications: [
            {
              where: { id: { _in: ids } },
              _set: { is_read: true, deleted_at: new Date() },
            },
            { __typename: true },
          ],
        }),
      });
    },
  },
  computed: {
    notifications() {
      return useNotificationStore().notifications;
    },
    stackedNotifications() {
      return useNotificationStore().stackedNotifications;
    },
    team_invites() {
      return useNotificationStore().team_invites;
    },
    tournament_team_invites() {
      return useNotificationStore().tournament_team_invites;
    },
    hasNotifications() {
      return useNotificationStore().hasNotifications;
    },
  },
};
</script>
