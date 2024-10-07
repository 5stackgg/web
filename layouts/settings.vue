<script setup lang="ts">
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Default from "~/layouts/default.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { computed } from "vue";
import { LogOut } from "lucide-vue-next";
import { generateMutation } from "~/graphql/graphqlGen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link, Unlink } from "lucide-vue-next";
import { toast } from "@/components/ui/toast";

interface Item {
  to: string;
  title: string;
}

const $route = useRoute();

const sidebarNavItems: Item[] = [
  {
    title: "Profile",
    to: "/settings",
  },
  {
    title: "Appearance",
    to: "/settings/appearance",
  },
  ...(useAuthStore().isAdmin
    ? [
        {
          title: "App Settings",
          to: "/settings/application",
        },
      ]
    : []),
];

const hasDiscordLinked = computed(() => useAuthStore().hasDiscordLinked);

const linkDiscord = () => {
  if (hasDiscordLinked.value) {
    return;
  }

  window.location.href = `https://${useRuntimeConfig().public.webDomain}/auth/discord?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
};
</script>

<template>
  <default>
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">Settings</h2>
      <p class="text-muted-foreground">Manage your account settings.</p>
    </div>
    <Separator class="my-6" />
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <aside class="-mx-4 lg:w-1/5">
        <nav class="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
          <nuxt-link
            :to="item.to"
            v-for="item in sidebarNavItems"
            :key="item.title"
          >
            <Button
              variant="ghost"
              :class="
                cn(
                  'w-full text-left justify-start',
                  $route.path === `${item.to}` && 'bg-muted hover:bg-muted',
                )
              "
            >
              {{ item.title }}
            </Button>
          </nuxt-link>

          <template v-if="hasDiscordLinked">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" class="w-full text-left justify-start">
                  <Unlink class="mr-2 h-4 w-4" />
                  Unlink Discord
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unlink Discord</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove discord accces?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    @click="unlinkDiscord"
                    variant="destructive"
                  >
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </template>

          <nuxt-link @click.native="linkDiscord" v-else>
            <Button variant="ghost" class="w-full text-left justify-start">
              <Link class="mr-2 h-4 w-4" />

              Link Discord for Bot Support
            </Button>
          </nuxt-link>

          <Button
            variant="ghost"
            class="w-full text-left justify-start"
            @click="logout"
          >
            <LogOut class="mr-2 h-4 w-4" />
            Logout
          </Button>
        </nav>
      </aside>
      <div class="flex-1 lg:max-w-2xl">
        <div class="space-y-6">
          <slot />
        </div>
      </div>
    </div>
  </default>
</template>

<script lang="ts">
export default {
  methods: {
    async unlinkDiscord() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          unlinkDiscord: [
            {},
            {
              success: true,
            },
          ],
        }),
      });

      useAuthStore().getMe();

      toast({
        title: `Unlinked Discord`,
      });
    },
    async logout() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          logout: [
            {},
            {
              success: true,
            },
          ],
        }),
      });

      // Redirect to home page or login page after successful logout
      navigateTo("/");

      window.location.reload();
    },
  },
};
</script>
