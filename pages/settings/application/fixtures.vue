<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Card } from "~/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useI18n } from "vue-i18n";
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
} from "@/components/ui/alert-dialog";

definePageMeta({
  layout: "application-settings",
});

const { t } = useI18n();
const config = useRuntimeConfig();
const isDev = computed(
  () =>
    config.public.webDomain.includes("localhost") ||
    config.public.webDomain.includes(".local"),
);

const settings = computed(() => useApplicationSettingsStore().settings);

const fixturesLoaded = computed(() => {
  return (
    settings.value?.find(
      (s: { name: string; value: string }) => s.name === "dev.fixtures_loaded",
    )?.value === "true"
  );
});

const showLoadDialog = ref(false);
const showReloadDialog = ref(false);
const showRemoveDialog = ref(false);
const loading = ref(false);

async function doLoadFixtures() {
  loading.value = true;
  showLoadDialog.value = false;
  showReloadDialog.value = false;

  try {
    await useNuxtApp().$apollo.defaultClient.mutate({
      mutation: generateMutation({
        loadFixtures: {
          success: true,
        },
      }),
    });

    toast({
      title: t("pages.settings.application.fixtures.loaded_success"),
    });
  } catch (error: any) {
    toast({
      title: t("pages.settings.application.fixtures.load_failed"),
      description:
        error?.message ||
        t("pages.settings.application.players.error_occurred"),
      variant: "destructive",
    });
  } finally {
    loading.value = false;
  }
}

async function doRemoveFixtures() {
  loading.value = true;
  showRemoveDialog.value = false;

  try {
    await useNuxtApp().$apollo.defaultClient.mutate({
      mutation: generateMutation({
        removeFixtures: {
          success: true,
        },
      }),
    });

    toast({
      title: t("pages.settings.application.fixtures.removed_success"),
    });
  } catch (error: any) {
    toast({
      title: t("pages.settings.application.fixtures.remove_failed"),
      description:
        error?.message ||
        t("pages.settings.application.players.error_occurred"),
      variant: "destructive",
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <PageTransition :delay="0">
    <div v-if="!isDev" class="p-6">
      <p class="text-muted-foreground">
        {{ $t("pages.settings.application.fixtures.dev_only_notice") }}
      </p>
    </div>

    <div v-else>
      <Card variant="gradient" class="p-6">
        <template v-if="!fixturesLoaded">
          <h3 class="text-lg font-semibold">
            {{ $t("pages.settings.application.fixtures.load_title") }}
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ $t("pages.settings.application.fixtures.load_description") }}
          </p>
          <div class="mt-4">
            <Button
              variant="destructive"
              :disabled="loading"
              @click="showLoadDialog = true"
            >
              {{
                loading
                  ? $t("pages.settings.application.fixtures.loading")
                  : $t("pages.settings.application.fixtures.load_button")
              }}
            </Button>
          </div>
        </template>

        <template v-else>
          <h3 class="text-lg font-semibold">
            {{ $t("pages.settings.application.fixtures.loaded_title") }}
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ $t("pages.settings.application.fixtures.loaded_description") }}
          </p>
          <div class="mt-4 flex gap-3">
            <Button
              variant="destructive"
              :disabled="loading"
              @click="showReloadDialog = true"
            >
              {{
                loading
                  ? $t("pages.settings.application.fixtures.processing")
                  : $t("pages.settings.application.fixtures.reload_button")
              }}
            </Button>
            <Button
              variant="outline"
              :disabled="loading"
              @click="showRemoveDialog = true"
            >
              {{
                loading
                  ? $t("pages.settings.application.fixtures.processing")
                  : $t("pages.settings.application.fixtures.remove_button")
              }}
            </Button>
          </div>
        </template>
      </Card>

      <AlertDialog v-model:open="showLoadDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {{ $t("pages.settings.application.fixtures.load_dialog_title") }}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {{
                $t(
                  "pages.settings.application.fixtures.load_dialog_description",
                )
              }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {{ $t("common.cancel") }}
            </AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              @click="doLoadFixtures"
            >
              {{ $t("pages.settings.application.fixtures.load_button") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog v-model:open="showReloadDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {{
                $t("pages.settings.application.fixtures.reload_dialog_title")
              }}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {{
                $t(
                  "pages.settings.application.fixtures.reload_dialog_description",
                )
              }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {{ $t("common.cancel") }}
            </AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              @click="doLoadFixtures"
            >
              {{ $t("pages.settings.application.fixtures.reload_button") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog v-model:open="showRemoveDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {{
                $t("pages.settings.application.fixtures.remove_dialog_title")
              }}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {{
                $t(
                  "pages.settings.application.fixtures.remove_dialog_description",
                )
              }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {{ $t("common.cancel") }}
            </AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              @click="doRemoveFixtures"
            >
              {{ $t("pages.settings.application.fixtures.remove_button") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </PageTransition>
</template>
