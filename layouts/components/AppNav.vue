<script setup lang="ts">
import { Gamepad, PanelLeft, Bell, Trash2 } from "lucide-vue-next";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import BreadCrumbs from "~/components/BreadCrumbs.vue";
import TimeAgo from "~/components/TimeAgo.vue";
</script>

<template>
  <aside
    class="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex"
  >
    <nav class="flex flex-col items-center gap-4 px-2 sm:py-5">
      <nuxt-link
        to="/"
        class="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
      >
        <Gamepad class="h-4 w-4 transition-all group-hover:scale-110" />
        <span class="sr-only">5Stack</span>
      </nuxt-link>
      <template v-for="link of links" :key="link.to">
        <nuxt-link
          :to="link.to"
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
          v-if="!link.role || link.role === me?.role"
        >
          <component :is="link.icon" class="h-5 w-5"></component>
          <span class="sr-only">{{ link.title }}</span>
        </nuxt-link>
      </template>
    </nav>
    <nav class="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
      <Sheet>
        <SheetTrigger>
          <div class="relative">
            <Bell class="h-5 w-5" :class="{ 'animate-bell': hasNotifications }" />
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
              >
                Delete All Read Notifications
              </Button>
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>

      <nuxt-link
        to="/settings"
        class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
      >
        <Avatar>
          <AvatarImage :src="me?.avatar_url" :alt="me?.name" />
          <AvatarFallback>{{ me?.name?.charAt(0) }}</AvatarFallback>
        </Avatar>

        <span class="sr-only">
          {{ me?.name }}
        </span>
      </nuxt-link>
      <div @click="linkDiscord" v-if="!hasDiscordLinked">Link Discord</div>
    </nav>
  </aside>

  <header
    class="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6"
  >
    <Sheet>
      <SheetTrigger as-child>
        <Button size="icon" variant="outline" class="sm:hidden">
          <PanelLeft class="h-5 w-5" />
          <span class="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" class="sm:max-w-xs">
        <nav class="grid gap-6 text-lg font-medium">
          <nuxt-link
            to="/"
            class="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
          >
            <Gamepad class="h-5 w-5 transition-all group-hover:scale-110" />
            <span class="sr-only">5stack</span>
          </nuxt-link>

          <template v-for="link of links" :key="link.to">
            <nuxt-link
              :to="link.to"
              class="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
              v-if="!link.role || link.role === me?.role"
            >
              <component :is="link.icon" class="h-5 w-5"></component>
              {{ link.title }}
            </nuxt-link>
          </template>
        </nav>
      </SheetContent>
    </Sheet>
    <div class="flex justify-between items-center w-full">
      <bread-crumbs></bread-crumbs>
      <small class="text-muted-foreground ml-4">
        ({{ playersOnline }}
        {{ playersOnline === 1 ? "player" : "players" }} online)
      </small>
    </div>
  </header>
</template>

<script lang="ts">
import {
  Swords,
  Server,
  ServerCog,
  Users,
  ShieldHalf,
  Trophy,
  HeartPulse,
} from "lucide-vue-next";
import { e_player_roles_enum } from "~/generated/zeus";
import { getCountryForTimezone } from "countries-and-timezones";
import { generateMutation } from "~/graphql/graphqlGen";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export default {
  apollo: {
    $subscribe: {
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
                          _is_null: true,
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
                              _gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
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
  data() {
    return {
      notifications: [],
      links: [
        {
          to: "/matches",
          title: "Matches",
          icon: Swords,
        },
        {
          to: "/tournaments",
          title: "Tournaments",
          icon: Trophy,
        },
        {
          to: "/teams",
          title: "Teams",
          icon: ShieldHalf,
        },
        {
          to: "/players",
          title: "Players",
          icon: Users,
        },
        {
          to: "/servers",
          title: "Manage Servers",
          icon: Server,
        },
        {
          to: "/game-server-nodes",
          title: "Manage Game Server Nodes",
          icon: ServerCog,
          role: e_player_roles_enum.administrator,
        },
        {
          to: "/status",
          title: "status",
          icon: HeartPulse,
        },
      ],
    };
  },
  methods: {
    linkDiscord() {
      window.location.href = `https://${useRuntimeConfig().public.webDomain}/auth/discord?redirect=${encodeURIComponent(
        window.location.toString(),
      )}`;
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
              where: { is_read: true },
              _set: { deleted_at: new Date() },
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
      return this.notifications.length > 0;
    },
    hasDiscordLinked() {
      return useAuthStore().hasDiscordLinked;
    },
    detectedCountry() {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const country = getCountryForTimezone(timezone);

      if (country) {
        return country.id;
      }
    },
    playersOnline() {
      return useMatchMakingStore().playersOnline;
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
