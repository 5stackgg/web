<script setup lang="ts">
import { CheckCheck, Trash2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import TeamInviteNotification from "~/components/TeamInviteNotification.vue";
import DraftInviteNotification from "~/components/notification/DraftInviteNotification.vue";
import Empty from "~/components/ui/empty/Empty.vue";
import NotificationItem from "~/components/notification/NotificationItem.vue";
import NotificationStack from "~/components/notification/NotificationStack.vue";
import NewsNotification from "~/components/notification/NewsNotification.vue";
import LeagueScheduleStack from "~/components/notification/LeagueScheduleStack.vue";
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-3 pt-3 pb-3 flex-shrink-0 border-b border-border">
      <div
        class="flex items-center gap-[0.4rem] font-mono text-[0.62rem] font-bold tracking-[0.24em] uppercase text-muted-foreground"
      >
        <span class="w-2 h-[2px] bg-[hsl(var(--tac-amber))]"></span>
        {{ $t("layouts.hub.notifications") }}
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-3 flex flex-col">
      <NewsNotification />
      <!-- Every section folds its own height open and shut -- dismissing the
           last of anything used to remove rows, invite blocks, separators and
           the footer on one frame. Each block owns its transition, so a mass
           dismiss is a set of folds closing rather than a cut; the mb-3
           spacing rides inside the clipped rows. -->
      <Transition
        enter-active-class="notif-fold"
        enter-from-class="notif-fold-collapsed"
        leave-active-class="notif-fold"
        leave-to-class="notif-fold-collapsed"
      >
        <div v-if="scheduleTasks.length > 0" class="grid grid-rows-[1fr]">
          <div class="min-h-0">
            <div class="mb-3">
              <LeagueScheduleStack :tasks="scheduleTasks" />
            </div>
          </div>
        </div>
      </Transition>

      <Transition
        enter-active-class="notif-fold"
        enter-from-class="notif-fold-collapsed"
        leave-active-class="notif-fold"
        leave-to-class="notif-fold-collapsed"
      >
        <div v-if="draft_invites.length > 0" class="grid grid-rows-[1fr]">
          <div class="min-h-0">
            <div class="mb-3 p-3 bg-card/60 border border-border rounded-md">
              <DraftInviteNotification
                :invite="invite"
                :key="invite.draft_game_id"
                v-for="invite of draft_invites"
              />
              <Separator
                v-if="
                  team_invites.length > 0 ||
                  tournament_team_invites.length > 0 ||
                  tournament_invites.length > 0 ||
                  notifications.length > 0
                "
              />
            </div>
          </div>
        </div>
      </Transition>

      <Transition
        enter-active-class="notif-fold"
        enter-from-class="notif-fold-collapsed"
        leave-active-class="notif-fold"
        leave-to-class="notif-fold-collapsed"
      >
        <div v-if="team_invites.length > 0" class="grid grid-rows-[1fr]">
          <div class="min-h-0">
            <div class="mb-3 p-3 bg-card/60 border border-border rounded-md">
              <TeamInviteNotification
                type="team"
                :invite="invite"
                :key="invite.id"
                v-for="invite of team_invites"
              />
              <Separator v-if="notifications.length > 0" />
            </div>
          </div>
        </div>
      </Transition>

      <Transition
        enter-active-class="notif-fold"
        enter-from-class="notif-fold-collapsed"
        leave-active-class="notif-fold"
        leave-to-class="notif-fold-collapsed"
      >
        <div
          v-if="tournament_team_invites.length > 0"
          class="grid grid-rows-[1fr]"
        >
          <div class="min-h-0">
            <div class="mb-3 p-3 bg-card/60 border border-border rounded-md">
              <TeamInviteNotification
                type="tournament"
                :invite="invite"
                :key="invite.id"
                v-for="invite of tournament_team_invites"
              />
              <Separator v-if="notifications.length > 0" />
            </div>
          </div>
        </div>
      </Transition>

      <!-- Its own block rather than folded into the one above: a registration
           invite and a team invite are separate tables with separate accept
           types, and stacking them would hide which one the player is answering. -->
      <Transition
        enter-active-class="notif-fold"
        enter-from-class="notif-fold-collapsed"
        leave-active-class="notif-fold"
        leave-to-class="notif-fold-collapsed"
      >
        <div v-if="tournament_invites.length > 0" class="grid grid-rows-[1fr]">
          <div class="min-h-0">
            <div class="mb-3 p-3 bg-card/60 border border-border rounded-md">
              <TeamInviteNotification
                type="tournament-registration"
                :invite="invite"
                :key="invite.id"
                v-for="invite of tournament_invites"
              />
              <Separator v-if="notifications.length > 0" />
            </div>
          </div>
        </div>
      </Transition>

      <TransitionGroup
        tag="div"
        class="flex flex-col"
        enter-active-class="notif-fold"
        enter-from-class="notif-fold-collapsed"
        leave-active-class="notif-fold"
        leave-to-class="notif-fold-collapsed"
        move-class="notif-move"
      >
        <div
          v-for="item of stackedNotifications"
          :key="item.kind === 'single' ? item.notification.id : item.entityId"
          class="grid grid-rows-[1fr]"
        >
          <div class="min-h-0">
            <NotificationStack
              v-if="item.kind === 'stack'"
              variant="hub"
              :notifications="item.notifications"
              @dismiss="dismissNotification"
              @delete="deleteNotification"
              @action="handleAction"
              @dismiss-all="dismissMany"
              @delete-all="deleteMany"
            />
            <NotificationItem
              v-else
              variant="hub"
              :notification="item.notification"
              @dismiss="dismissNotification"
              @delete="deleteNotification"
              @action="handleAction"
            />
          </div>
        </div>
      </TransitionGroup>

      <!-- Fades up only after the folds above have closed. -->
      <Transition
        enter-active-class="transition-opacity [transition-duration:240ms] [transition-delay:200ms] motion-reduce:![transition-duration:1ms]"
        leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <Empty v-if="!hasAnyNotifications && !unreadNewsArticle">
          <div class="space-y-1">
            <p class="text-sm font-medium text-foreground">
              {{ $t("layouts.notifications.no_notifications_title") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ $t("layouts.notifications.no_notifications") }}
            </p>
          </div>
        </Empty>
      </Transition>
    </div>

    <Transition
      enter-active-class="notif-fold"
      enter-from-class="notif-fold-collapsed"
      leave-active-class="notif-fold"
      leave-to-class="notif-fold-collapsed"
    >
      <div
        v-if="notifications.length > 0"
        class="flex-shrink-0 grid grid-rows-[1fr]"
      >
        <div class="min-h-0">
          <div class="flex flex-row gap-2 px-3 py-3 border-t border-border">
            <Button
              size="sm"
              variant="outline"
              @click="dismissAllNotifications"
              class="flex-1 justify-center gap-1.5"
            >
              <CheckCheck class="h-4 w-4 shrink-0" />
              {{ $t("layouts.notifications.dismiss_all") }}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              @click="deleteAllReadNotifications"
              class="flex-1 justify-center gap-1.5 text-destructive hover:bg-destructive hover:text-white"
            >
              <Trash2 class="h-4 w-4 shrink-0" />
              {{ $t("layouts.notifications.delete_all_read") }}
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Sections and rows fold their height in place; the clipped cell carries the
   spacing so nothing is left to snap on unmount. */
.notif-fold {
  transition:
    grid-template-rows 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.15s ease;
}
.notif-fold > * {
  overflow: hidden;
}
.notif-fold-collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
}
.notif-move {
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-reduced-motion: reduce) {
  .notif-fold,
  .notif-move {
    transition-duration: 1ms;
  }
}
</style>

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
    tournament_invites() {
      return useNotificationStore().tournament_invites;
    },
    draft_invites() {
      return useNotificationStore().draft_invites;
    },
    notifications() {
      return useNotificationStore().notifications;
    },
    scheduleTasks() {
      return useNotificationStore().scheduleTasks;
    },
    stackedNotifications() {
      return useNotificationStore().stackedNotifications;
    },
    unreadNewsArticle() {
      return useNotificationStore().unreadNewsArticle;
    },
    hasAnyNotifications(): boolean {
      return (
        this.scheduleTasks.length > 0 ||
        this.team_invites.length > 0 ||
        this.tournament_team_invites.length > 0 ||
        this.tournament_invites.length > 0 ||
        this.draft_invites.length > 0 ||
        this.notifications.length > 0
      );
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
      // Synthetic notifications have no backing row to delete.
      if (notification.__synthetic) {
        return;
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
            {
              where: { is_read: { _eq: false }, deletable: { _neq: false } },
              _set: { is_read: true },
            },
            { __typename: true },
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
              where: { id: { _in: ids }, deletable: { _neq: false } },
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
              where: { id: { _in: ids }, deletable: { _neq: false } },
              _set: { is_read: true, deleted_at: new Date() },
            },
            { __typename: true },
          ],
        }),
      });
    },
  },
};
</script>
