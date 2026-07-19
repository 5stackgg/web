<script setup lang="ts">
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import SettingsSideTabs from "~/components/settings/SettingsSideTabs.vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";

const { t: $t } = useI18n();

const showSeparators = computed(
  () => useApplicationSettingsStore().showSeparators,
);
const hasDiscordLinked = computed(() => useAuthStore().hasDiscordLinked);
const supportsDiscordBot = computed(
  () => useApplicationSettingsStore().supportsDiscordBot,
);

const showUnlinkDiscordDialog = ref(false);

const navItems = computed(() => {
  const items: { path: string; label: string }[] = [
    {
      path: "/settings",
      label: $t("pages.settings.account.my_account"),
    },
    {
      path: "/settings/matchmaking",
      label: $t("pages.settings.account.matchmaking"),
    },
    {
      path: "/settings/linked-accounts",
      label: $t("pages.settings.account.linked_accounts"),
    },
    {
      path: "/settings/notifications",
      label: $t("pages.settings.notifications.title"),
    },
    {
      path: "/settings/api-keys",
      label: $t("pages.settings.account.api_keys"),
    },
  ];
  return items;
});

const route = useRoute();
const router = useRouter();

const resolvedPath = computed(() => {
  const path = route.path;
  const items = navItems.value ?? [];
  if (items.some((item) => item.path === path)) return path;
  const match = items
    .filter((item) => path.startsWith(item.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match ? match.path : (items[0]?.path ?? path);
});

const selectedPath = computed({
  get: () => resolvedPath.value,
  set: (path: string) => {
    if (path !== route.path) router.push(path);
  },
});

function linkDiscord() {
  if (hasDiscordLinked.value) return;
  window.location.href = `https://${useRuntimeConfig().public.webDomain}/auth/discord?redirect=${encodeURIComponent(window.location.toString())}`;
}

async function unlinkDiscord() {
  const { $apollo } = useNuxtApp();
  await ($apollo as any).mutate({
    mutation: generateMutation({
      unlinkDiscord: [
        {},
        {
          success: true,
        },
      ],
    }),
  });

  showUnlinkDiscordDialog.value = false;
  useAuthStore().getMe();

  toast({
    title: $t("pages.settings.account.discord.unlinked"),
  });
}
</script>

<template>
  <TacticalPageHeader>
    <template #title>{{ $t("layouts.account_settings.title") }}</template>
    <template #subtitle>{{
      $t("layouts.account_settings.description")
    }}</template>
  </TacticalPageHeader>
  <Separator v-if="showSeparators" class="my-6" />
  <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
    <aside class="w-full shrink-0 lg:w-auto">
      <!-- Mobile: single dropdown -->
      <div class="lg:hidden">
        <Select v-model="selectedPath">
          <SelectTrigger
            class="w-full"
            :aria-label="$t('ui.tooltips.settings_section')"
          >
            <SelectValue
              :placeholder="$t('layouts.account_settings.select_section')"
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="item in navItems"
              :key="item.path"
              :value="item.path"
            >
              {{ item.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <SettingsSideTabs
        :items="navItems"
        :active-path="resolvedPath"
        :aria-label="$t('ui.tooltips.settings_section')"
      >
        <template #actions>
          <Button
            v-if="hasDiscordLinked"
            variant="ghost"
            class="w-full justify-start rounded-sm px-3 text-left text-muted-foreground transition-colors duration-200 hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-foreground"
            @click.stop.prevent="showUnlinkDiscordDialog = true"
          >
            <Unlink class="mr-2 h-4 w-4" />
            {{ $t("pages.settings.account.discord.unlink") }}
          </Button>
          <Button
            v-else-if="supportsDiscordBot"
            variant="ghost"
            class="w-full justify-start rounded-sm px-3 text-left text-muted-foreground transition-colors duration-200 hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-foreground"
            @click="linkDiscord"
          >
            <Link class="mr-2 h-4 w-4" />
            {{ $t("pages.settings.account.discord.link") }}
          </Button>
        </template>
      </SettingsSideTabs>
    </aside>
    <div class="space-y-6 flex-1 min-w-0">
      <slot />
    </div>
  </div>

  <AlertDialog :open="showUnlinkDiscordDialog">
    <AlertDialogTrigger asChild> </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("pages.settings.account.discord.unlink_dialog.title")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("pages.settings.account.discord.unlink_dialog.description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="showUnlinkDiscordDialog = false">
          {{ $t("common.cancel") }}
        </AlertDialogCancel>
        <AlertDialogAction @click="unlinkDiscord" variant="destructive">
          {{ $t("pages.settings.account.discord.unlink_dialog.confirm") }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
