<script setup lang="ts">
import { Bell, Trash2 } from "lucide-vue-next";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import TimeAgo from "~/components/TimeAgo.vue";
</script>

<template>
  <Sheet>
    <SheetTrigger>
      <div class="relative">
        <Bell :class="{ 'animate-bell': hasNotifications }" />
        <span
          v-if="hasNotifications"
          class="absolute -top-1 -right-1 inline-block h-2 w-2 rounded-full bg-red-600"
        ></span>
      </div>
      <span class="sr-only">Notifications</span>
    </SheetTrigger>
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Notifications</SheetTitle>
        <SheetDescription>
          <template v-if="invites.length > 0">
            <div
              v-for="invite of invites"
              :key="invite.id"
              class="mb-4 p-4 bg-accent rounded-lg"
            >
              <h3 class="text-lg font-semibold mb-2">
                Team Invite: {{ invite.team.name }}
              </h3>
              <p class="text-sm text-muted-foreground mb-2">
                Invited by {{ invite.invited_by.name }}
                <TimeAgo :date="invite.created_at" class="text-xs" />
              </p>
              <div class="flex justify-end space-x-2 mt-3">
                <Button variant="outline" @click="denyInvite(invite.id)"
                  >Deny</Button
                >
                <Button variant="default" @click="acceptInvite(invite.id)"
                  >Accept</Button
                >
              </div>
            </div>
            <Separator v-if="notifications.length > 0"></Separator>
          </template>

          <template
            v-for="notification of notifications"
            :key="notification.id"
          >
            <div :class="['mb-4 p-4 rounded-lg shadow-md relative']">
              <Button
                size="icon"
                variant="ghost"
                @click="deleteNotification(notification.id)"
                class="absolute top-2 right-2"
              >
                <Trash2 class="h-4 w-4" />
                <span class="sr-only">Delete</span>
              </Button>
              <h3
                :class="[
                  'text-lg font-semibold mb-2',
                  notification.is_read ? 'text-muted-foreground' : '',
                ]"
              >
                {{ notification.title }}
              </h3>
              <p
                :class="[
                  'text-sm mb-2',
                  notification.is_read
                    ? 'text-muted-foreground/70'
                    : 'text-muted-foreground',
                ]"
                v-html="notification.message"
              ></p>
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
                <Button
                  size="sm"
                  variant="outline"
                  @click="dismissNotification(notification.id)"
                  v-if="!notification.is_read"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </template>
          <Button
            size="sm"
            variant="outline"
            @click="deleteAllReadNotifications"
            class="mt-4 w-full"
            v-if="notifications.length > 0"
          >
            Delete All Read Notifications
          </Button>
        </SheetDescription>
      </SheetHeader>
    </SheetContent>
  </Sheet>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";

export default {
  data() {
    return {
      invites: [],
      notifications: [],
    };
  },
  apollo: {
    $subscribe: {
      team_invites: {
        query: typedGql("subscription")({
          team_invites: [
            {
              order_by: [
                {},
                {
                  created_at: order_by.desc,
                },
              ],
              where: {
                steam_id: {
                  _eq: $("steam_id", "bigint!"),
                },
              },
            },
            {
              id: true,
              team: {
                name: true,
              },
              invited_by: {
                name: true,
              },
              created_at: true,
            },
          ],
        }),
        variables: function () {
          return {
            steam_id: this.me.steam_id,
          };
        },
        result({ data }: { data: any }) {
          this.invites = data.team_invites;
        },
      },
      notifications: {
        query: typedGql("subscription")({
          notifications: [
            {
              where: {
                _and: [
                  {
                    deleted_at: {
                      _is_null: true,
                    },
                  },
                  {
                    _or: [
                      {
                        is_read: {
                          _eq: false,
                        },
                      },
                      {
                        _and: [
                          {
                            is_read: {
                              _eq: true,
                            },
                          },
                          {
                            created_at: {
                              _gt: new Date(
                                Date.now() - 7 * 24 * 60 * 60 * 1000,
                              ),
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
            {
              id: true,
              title: true,
              message: true,
              steam_id: true,
              type: true,
              entity_id: true,
              is_read: true,
              created_at: true,
            },
          ],
        }),
        result({ data }: { data: any }) {
          this.notifications = data.notifications;
        },
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
              where: {
                is_read: {
                  _eq: true,
                },
              },
              _set: {
                deleted_at: new Date(),
              },
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
    hasNotifications() {
      if (this.invites.length > 0) {
        return true;
      }

      return (
        this.notifications.filter((notification) => {
          return notification.is_read === false;
        }).length > 0
      );
    },
  },
};
</script>
