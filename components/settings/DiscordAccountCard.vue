<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { CheckCircle2, Link, Unlink } from "lucide-vue-next";
import { DiscordLogoIcon } from "@radix-icons/vue";
import { Button } from "~/components/ui/button";
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
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { generateMutation } from "~/graphql/graphqlGen";

const { t } = useI18n();

const linked = computed(() => useAuthStore().hasDiscordLinked);

const showUnlinkConfirm = ref(false);
const unlinking = ref(false);

function linkDiscord() {
  window.location.href = `https://${useRuntimeConfig().public.webDomain}/auth/discord?redirect=${encodeURIComponent(window.location.toString())}`;
}

async function confirmUnlink() {
  if (unlinking.value) {
    return;
  }
  unlinking.value = true;
  try {
    const { $apollo } = useNuxtApp();
    await ($apollo as any).mutate({
      mutation: generateMutation({
        unlinkDiscord: { success: true },
      }),
    });
    showUnlinkConfirm.value = false;
    await useAuthStore().getMe();
    toast({ title: t("pages.settings.account.discord.unlinked") });
  } finally {
    unlinking.value = false;
  }
}
</script>

<template>
  <FadeSwap>
    <div
      v-if="linked"
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
            <div class="text-sm font-medium leading-tight">
              {{ $t("pages.settings.account.discord.title") }}
            </div>
            <div class="text-xs text-muted-foreground">
              {{ $t("pages.settings.account.discord.linked") }}
            </div>
          </div>
        </div>

        <FiveStackToolTip side="bottom">
          <template #trigger>
            <Button
              size="icon"
              variant="ghost"
              class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 [&_svg]:size-3.5"
              :aria-label="$t('pages.settings.account.discord.unlink')"
              @click="showUnlinkConfirm = true"
            >
              <Unlink />
            </Button>
          </template>
          {{ $t("pages.settings.account.discord.unlink") }}
        </FiveStackToolTip>
      </div>
    </div>

    <div
      v-else
      key="unlinked"
      class="rounded-lg border border-border bg-card/50 overflow-hidden"
    >
      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <span
            class="shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-muted text-muted-foreground"
          >
            <DiscordLogoIcon class="w-4 h-4" />
          </span>
          <div class="min-w-0">
            <div class="text-sm font-medium leading-tight">
              {{ $t("pages.settings.account.discord.title") }}
            </div>
            <div class="text-xs text-muted-foreground">
              {{ $t("pages.settings.account.discord.description") }}
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          class="shrink-0"
          @click="linkDiscord"
        >
          <Link />
          {{ $t("pages.settings.account.discord.link") }}
        </Button>
      </div>
    </div>
  </FadeSwap>

  <AlertDialog v-model:open="showUnlinkConfirm">
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
        <AlertDialogCancel :disabled="unlinking">{{
          $t("common.cancel")
        }}</AlertDialogCancel>
        <Button
          variant="destructive"
          :loading="unlinking"
          @click="confirmUnlink"
        >
          {{ $t("pages.settings.account.discord.unlink_dialog.confirm") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
