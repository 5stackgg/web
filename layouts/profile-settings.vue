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
import Default from "~/layouts/default.vue";

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
  const items: { path: string; label: string; action?: string }[] = [
    {
      path: "/settings",
      label: $t("pages.settings.account.my_account"),
    },
    {
      path: "/settings/matchmaking",
      label: $t("pages.settings.account.matchmaking"),
    },
    {
      path: "/settings/api-keys",
      label: $t("pages.settings.account.api_keys"),
    },
    {
      path: "/settings/notifications",
      label: $t("pages.settings.notifications.title"),
    },
  ];
  return items;
});

const route = useRoute();
const router = useRouter();

const resolvedPath = computed(() => {
  const path = route.path;
  const items = navItems.value;
  if (items.some((item) => item.path === path)) return path;
  const match = items.find((item) => path.startsWith(item.path + "/"));
  return match ? match.path : (items[0]?.path ?? path);
});

const selectedPath = computed({
  get: () => resolvedPath.value,
  set: (path: string) => {
    if (path !== route.path) router.push(path);
  },
});

const navRef = ref<HTMLElement | null>(null);
const indicatorY = ref(0);
const indicatorHeight = ref(0);
const hasAnimated = ref(false);

function updateIndicator() {
  const nav = navRef.value;
  if (!nav) return;
  const active = nav.querySelector(
    ".router-link-exact-active > button",
  ) as HTMLElement | null;
  if (!active) {
    indicatorHeight.value = 0;
    hasAnimated.value = false;
    return;
  }
  const navRect = nav.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  indicatorY.value = activeRect.top - navRect.top;
  indicatorHeight.value = activeRect.height;
  nextTick(() => {
    hasAnimated.value = true;
  });
}

let observer: MutationObserver | null = null;

watch(
  () => route.path,
  () => nextTick(updateIndicator),
);

onMounted(() => {
  nextTick(updateIndicator);
  const nav = navRef.value;
  if (nav) {
    observer = new MutationObserver(updateIndicator);
    observer.observe(nav, {
      attributes: true,
      subtree: true,
      attributeFilter: ["class"],
    });
    window.addEventListener("resize", updateIndicator);
  }
});

onUnmounted(() => {
  observer?.disconnect();
  window.removeEventListener("resize", updateIndicator);
});

const showIndicator = computed(() => indicatorHeight.value > 0);

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
  <default>
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">
        {{ $t("layouts.account_settings.title") }}
      </h2>
      <p class="text-muted-foreground">
        {{ $t("layouts.account_settings.description") }}
      </p>
    </div>
    <Separator v-if="showSeparators" class="my-6" />
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <aside class="w-full shrink-0 lg:w-auto">
        <!-- Mobile: single dropdown -->
        <div class="lg:hidden">
          <Select v-model="selectedPath">
            <SelectTrigger class="w-full" aria-label="Settings section">
              <SelectValue placeholder="Select section" />
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
        <!-- Desktop: vertical nav with sliding indicator -->
        <nav
          ref="navRef"
          class="settings-nav relative hidden flex-col space-y-1 lg:flex"
        >
          <div
            v-show="showIndicator"
            class="absolute top-0 right-0 w-0.5 bg-primary z-10 pointer-events-none"
            :class="hasAnimated ? 'settings-nav-indicator-animated' : ''"
            :style="{
              transform: `translateY(${indicatorY}px)`,
              height: `${indicatorHeight}px`,
            }"
          />
          <nuxt-link v-for="item in navItems" :key="item.path" :to="item.path">
            <Button
              variant="ghost"
              class="w-full text-left justify-start relative z-[1]"
            >
              {{ item.label }}
            </Button>
          </nuxt-link>

          <template v-if="hasDiscordLinked">
            <Button
              variant="ghost"
              class="w-full text-left justify-start"
              @click.stop.prevent="showUnlinkDiscordDialog = true"
            >
              <Unlink class="mr-2 h-4 w-4" />
              {{ $t("pages.settings.account.discord.unlink") }}
            </Button>
          </template>

          <nuxt-link @click.native="linkDiscord" v-else-if="supportsDiscordBot">
            <Button variant="ghost" class="w-full text-left justify-start">
              <Link class="mr-2 h-4 w-4" />
              {{ $t("pages.settings.account.discord.link") }}
            </Button>
          </nuxt-link>
        </nav>
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
            {{ $t("pages.settings.account.discord.unlink_dialog.cancel") }}
          </AlertDialogCancel>
          <AlertDialogAction @click="unlinkDiscord" variant="destructive">
            {{ $t("pages.settings.account.discord.unlink_dialog.confirm") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </default>
</template>

<script lang="ts">
export default {};
</script>

<style lang="postcss">
.settings-nav a > button,
.settings-nav > button {
  @apply hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground transition-colors duration-200;
}
.settings-nav .router-link-exact-active > button {
  @apply text-sidebar-accent-foreground bg-transparent;
}
.settings-nav-indicator-animated {
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    width 0.2s ease,
    height 0.2s ease;
}
</style>
