<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useNow } from "@vueuse/core";
import {
  CheckCircle2,
  ExternalLink,
  Link,
  TriangleAlert,
  Unlink,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { toast } from "~/components/ui/toast";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import TwitchIcon from "~/components/icons/TwitchIcon.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { badgePopTransition } from "~/utilities/badgeCount";
import {
  TWITCH_LINK_ERRORS,
  TWITCH_STATUS_STALE_MS,
  twitchChannelUrl,
  twitchLinkUrl,
  useTwitchAccount,
} from "~/composables/useTwitch";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const { account, enabled, state, refresh, unlink } = useTwitchAccount();

const now = useNow({ interval: 30_000 });
const showUnlinkConfirm = ref(false);
const unlinking = ref(false);

const view = computed(() => {
  if (state.value === "failed") {
    return "failed";
  }
  if (state.value === "loading") {
    return "loading";
  }
  return account.value ? "linked" : "unlinked";
});

const statusKey = computed(() => {
  if (!account.value?.is_live) {
    return "offline";
  }
  return account.value.game_name ? "live-game" : "live";
});

const statusText = computed(() => {
  if (statusKey.value === "live-game") {
    return t("twitch.account.live_game", { game: account.value?.game_name });
  }
  if (statusKey.value === "live") {
    return t("twitch.live");
  }
  return t("twitch.account.offline");
});

const stale = computed(() => {
  const confirmed = account.value?.checked_at ?? account.value?.linked_at;
  if (!confirmed) {
    return false;
  }
  return now.value.getTime() - Date.parse(confirmed) > TWITCH_STATUS_STALE_MS;
});

function linkTwitch() {
  const here = new URL(window.location.href);
  here.searchParams.delete("twitch");
  here.searchParams.delete("twitch_error");
  return navigateTo(twitchLinkUrl(here.toString()), { external: true });
}

async function confirmUnlink() {
  if (unlinking.value) {
    return;
  }
  unlinking.value = true;
  try {
    await unlink();
    showUnlinkConfirm.value = false;
    toast({ title: t("twitch.account.unlinked") });
  } catch {
    toast({
      title: t("twitch.account.unlink_failed"),
      variant: "destructive",
    });
  } finally {
    unlinking.value = false;
  }
}

function stripLinkResult() {
  const query = { ...route.query };
  delete query.twitch;
  delete query.twitch_error;
  return router.replace({ path: route.path, query, hash: route.hash });
}

watch(
  () => [route.query.twitch, route.query.twitch_error] as const,
  ([linked, error]) => {
    if (linked === "linked") {
      toast({ title: t("twitch.account.linked") });
      void refresh();
    } else if (typeof error === "string" && error) {
      const code = (TWITCH_LINK_ERRORS as readonly string[]).includes(error)
        ? error
        : "unknown";
      toast({
        title: t("twitch.account.link_failed"),
        description: t(`twitch.account.errors.${code}`),
        variant: "destructive",
      });
    } else {
      return;
    }
    void stripLinkResult();
  },
  { immediate: true },
);
</script>

<template>
  <FadeSwap v-if="view === 'loading' || enabled || view === 'failed'">
    <div
      v-if="view === 'loading'"
      key="loading"
      class="rounded-lg border border-border bg-card/50 overflow-hidden"
      aria-busy="true"
    >
      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <Skeleton class="h-7 w-7 shrink-0 rounded-md" />
          <div class="space-y-1.5">
            <Skeleton class="h-3.5 w-24" />
            <Skeleton class="h-3 w-44" />
          </div>
        </div>
        <Skeleton class="h-8 w-28 rounded-md" />
      </div>
    </div>

    <div
      v-else-if="view === 'linked' && account"
      key="linked"
      class="rounded-lg border border-border bg-card/50 overflow-hidden"
    >
      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <span
            class="shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-emerald-500/15 text-emerald-400"
          >
            <CheckCircle2 class="w-4 h-4" />
          </span>
          <div class="min-w-0">
            <div class="truncate text-sm font-medium leading-tight">
              twitch.tv/{{ account.login }}
            </div>
            <FadeSwap>
              <div
                :key="statusKey"
                class="flex items-center gap-1.5 text-xs text-muted-foreground"
                data-test="twitch-status"
              >
                <span
                  v-if="account.is_live"
                  class="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
                ></span>
                {{ statusText }}
              </div>
            </FadeSwap>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <Transition v-bind="badgePopTransition">
            <span v-if="stale" class="inline-flex">
              <FiveStackToolTip as-child :delay-duration="120">
                <template #trigger>
                  <Button
                    variant="outline"
                    size="icon"
                    as="span"
                    tabindex="0"
                    :aria-label="$t('twitch.account.stale')"
                    data-test="twitch-stale"
                    class="h-6 w-6 cursor-default border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] hover:text-[hsl(var(--tac-amber))] [&_svg]:size-3.5"
                  >
                    <TriangleAlert />
                  </Button>
                </template>
                <span class="block max-w-[18rem]">
                  {{ $t("twitch.account.stale") }}
                </span>
              </FiveStackToolTip>
            </span>
          </Transition>
          <FiveStackToolTip side="bottom">
            <template #trigger>
              <Button
                as="a"
                :href="twitchChannelUrl(account.login)"
                target="_blank"
                rel="noopener noreferrer"
                size="icon"
                variant="outline"
                class="h-8 w-8 [&_svg]:size-3.5"
                :aria-label="$t('twitch.open_on_twitch')"
              >
                <ExternalLink />
              </Button>
            </template>
            {{ $t("twitch.open_on_twitch") }}
          </FiveStackToolTip>
          <FiveStackToolTip side="bottom">
            <template #trigger>
              <Button
                size="icon"
                variant="ghost"
                class="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 [&_svg]:size-3.5"
                :aria-label="$t('twitch.account.unlink')"
                @click="showUnlinkConfirm = true"
              >
                <Unlink />
              </Button>
            </template>
            {{ $t("twitch.account.unlink") }}
          </FiveStackToolTip>
        </div>
      </div>
    </div>

    <div
      v-else
      :key="view"
      class="rounded-lg border border-border bg-card/50 overflow-hidden"
    >
      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <span
            class="shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-muted text-muted-foreground"
          >
            <TwitchIcon class="w-4 h-4" />
          </span>
          <div class="min-w-0">
            <div class="text-sm font-medium leading-tight">
              {{ $t("twitch.account.title") }}
            </div>
            <div class="text-xs text-muted-foreground">
              {{ $t("twitch.account.description") }}
            </div>
          </div>
        </div>

        <FiveStackToolTip
          v-if="view === 'failed'"
          as-child
          :delay-duration="120"
        >
          <template #trigger>
            <Button
              variant="outline"
              size="icon"
              as="span"
              tabindex="0"
              :aria-label="$t('twitch.account.unavailable')"
              data-test="twitch-unavailable"
              class="h-6 w-6 shrink-0 cursor-default border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] hover:text-[hsl(var(--tac-amber))] [&_svg]:size-3.5"
            >
              <TriangleAlert />
            </Button>
          </template>
          <span class="block max-w-[18rem]">
            {{ $t("twitch.account.unavailable") }}
          </span>
        </FiveStackToolTip>
        <Button
          v-else
          variant="outline"
          size="sm"
          class="shrink-0"
          @click="linkTwitch"
        >
          <Link />
          {{ $t("twitch.account.link") }}
        </Button>
      </div>
    </div>
  </FadeSwap>

  <AlertDialog v-model:open="showUnlinkConfirm">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("twitch.account.unlink_dialog.title")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("twitch.account.unlink_dialog.description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="unlinking">{{
          $t("common.cancel")
        }}</AlertDialogCancel>
        <Button
          variant="destructive"
          :loading="unlinking"
          @click="confirmUnlink"
        >
          {{ $t("twitch.account.unlink_dialog.confirm") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
